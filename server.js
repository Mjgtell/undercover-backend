const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

// ═══════════════════════════════
//  BOT ENGINE
// ═══════════════════════════════

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const BOT_NAMES = ['Kaito','Yuki','Ryu','Hana','Sora','Nami','Ren','Aoi'];
const BOT_THINK_DELAY = 1500; // ms before bot "responds" — keeps socket alive

async function callClaude(systemPrompt, userPrompt) {
  try {
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 60,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('Groq API error:', e.message);
    return null;
  }
}

// Pick a bot name not already in use
function pickBotName(room) {
  const used = Object.keys(room.players);
  return BOT_NAMES.find(n => !used.includes(n)) || 'Bot' + Math.floor(Math.random()*99);
}

// Bot submits its word for its turn
async function botSubmitWord(room, code, botName) {
  const assignment = room.assignments[botName];
  if (!assignment) return;

  const character = assignment.word; // just the character name, NOT the role
  const rk = `round${room.round}`;
  const wordsThisRound = room.words[rk] || {};

  // Words already said by others this round
  const otherWords = Object.entries(wordsThisRound)
    .filter(([n]) => n !== botName)
    .map(([n, w]) => `${n}: "${w}"`)
    .join('\n');

  // History of previous rounds
  let history = '';
  for (let r = 1; r < room.round; r++) {
    const rk2 = `round${r}`;
    const prev = Object.entries(room.words[rk2] || {})
      .map(([n, w]) => `${n}: "${w}"`)
      .join(', ');
    if (prev) history += `Tour ${r} — ${prev}\n`;
  }

  const roundNum = room.round;

  // Anime-grounded vocabulary bank — words players actually use in this game
  const ANIME_VOCAB = {
    early: ['épée','chakra','démon','ninja','magie','titan','feu','glace','ombre','lumière','vengeance','destin','pouvoir','clan','sang','larmes','combat','rival','sensei','sacrifice','promesse','nakama','honneur','chaos','solitude','rage','volonté','cicatrice','malédiction','rêve','monstre','héros','traître','génie','vitesse','armure','lame','ténèbres','espoir','mort'],
    mid: ['shonen','isekai','invocateur','alchimie','psychique','exorciste','chasseur','capitaine','lieutenant','shinigami','démon-roi','titan-colossal','œil-de-sharingan','chakra-noir','sort-maudit','transformation','éveil','limites','dépasser','vaincre'],
    specific: ['bankai','rasengan','géasse','titan','ackerman','zoldyck','quirk','fullbring','resurreccion','jutsu','zanpakuto','nen','devil-fruit','grimoire','stand']
  };

  const vocabPool = roundNum <= 2 ? ANIME_VOCAB.early : [...ANIME_VOCAB.early, ...ANIME_VOCAB.mid];

  const system = `You are playing Undercover, a deduction game about anime characters. Reply in French ONLY.
Your secret character is: ${character}

Pick ONE French word from this vocabulary or similar anime/manga words that fits your character.
Vocabulary examples: ${vocabPool.slice(0, 20).join(', ')}

RULES:
- ONE word only, no spaces, no punctuation, no explanation
- Never use the character name or any part of it
- Round 1-2: pick a COMMON word that fits MANY characters — don't be too specific
- Round 3+: you can be slightly more precise
- The word must feel natural in an anime context
- Do NOT say: "voici", "je dirais", "mon mot est" — just the word itself`;

  const user = `Round ${roundNum}. Character: ${character}.
${otherWords ? `Words already said this round:\n${otherWords}\n` : 'You go first.'}
${history ? `Previous rounds:\n${history}` : ''}
Your word (one French anime word only):`;

  const word = await callClaude(system, user);

  // Fallback if API fails or returns bad response
  const fallbacks = ['courage', 'force', 'mystère', 'regard', 'combat', 'silence', 'volonté', 'puissance'];
  const finalWord = (word && word.split(' ').length === 1 && word.length < 30)
    ? word
    : fallbacks[Math.floor(Math.random() * fallbacks.length)];

  // Check it's not blocked
  const blocked = assignment.blockedWords || [];
  const wLower = finalWord.toLowerCase().replace(/[^a-zàâäéèêëîïôùûü]/gi, '');
  const isBlocked = blocked.some(b => wLower.includes(b) || b.includes(wLower));

  if (isBlocked) {
    // Just use a safe fallback
    return submitBotWordToRoom(room, code, botName, fallbacks[0]);
  }

  return submitBotWordToRoom(room, code, botName, finalWord);
}

function submitBotWordToRoom(room, code, botName, word) {
  const rk = `round${room.round}`;
  if (!room.words[rk]) room.words[rk] = {};
  if (room.words[rk][botName]) return; // already submitted

  room.words[rk][botName] = word;
  io.to(code).emit('word:revealed', { player: botName, word, round: room.round });
  io.to(code).emit('toast', `🤖 ${botName} a joué`);

  // Advance turn (same logic as word:submit handler)
  room.currentTurnIndex++;
  const aliveTurnOrder = room.turnOrder.filter(n => !room.players[n]?.eliminated && room.players[n]?.connected);
  const allDone = aliveTurnOrder.every(n => room.words[rk][n]);

  if (allDone) {
    const votingLocked = room.round < (room.votingUnlockedAtRound || 2);
    if (votingLocked) {
      io.to(code).emit('toast', `Tour ${room.round} terminé — tour ${room.round + 1} !`);
      broadcastRoom(code);
      setTimeout(() => nextRound(room, code), 1400);
    } else {
      room.subPhase = 'vote';
      Object.keys(room.players).forEach(p => { room.players[p].voted = false; });
      broadcastRoom(code);
      if (room.settings?.wordTimer) startTimer(code, VOTE_TIMER_SECS, 'vote');
    }
  } else {
    const nextPlayer = aliveTurnOrder[room.currentTurnIndex % aliveTurnOrder.length];
    broadcastRoom(code);
    io.to(code).emit('turn:next', { player: nextPlayer });
    // If next player is also a bot, chain
    if (room.players[nextPlayer]?.isBot) {
      setTimeout(() => botSubmitWord(room, code, nextPlayer), BOT_THINK_DELAY);
    } else {
      if (room.settings?.wordTimer) startTimer(code, WORD_TIMER_SECS, 'words');
    }
  }
}

// Bot casts its vote — analyzes all words vs its own character, no role knowledge
async function botCastVote(room, code, botName) {
  const assignment = room.assignments[botName];
  if (!assignment) return;

  const character = assignment.word; // bot only knows its character, not its role
  const alive = getAlive(room).filter(n => n !== botName);
  if (alive.length === 0) return;

  // Collect all words from all rounds
  let allWords = {};
  for (let r = 1; r <= room.round; r++) {
    const rk = `round${r}`;
    Object.entries(room.words[rk] || {}).forEach(([n, w]) => {
      if (!allWords[n]) allWords[n] = [];
      allWords[n].push(`tour ${r}: "${w}"`);
    });
  }

  const wordSummary = alive
    .map(n => `${n} — ${(allWords[n] || ['(rien)']).join(', ')}`)
    .join('\n');

  const system = `You are playing Undercover. Your character is: ${character}. Reply with ONE name only.
Analyze each player's words. Vote to eliminate the player whose words seem LEAST related to your character.
Reply with ONLY the exact player name, nothing else, no explanation.`;

  const user = `Your character: ${character}
Players and their words:
${wordSummary}

Which player's words are least consistent with your character? Reply with their name only.`;

  const answer = await callClaude(system, user);

  // Find the closest match to a valid player name
  const target = alive.find(n => answer && answer.toLowerCase().includes(n.toLowerCase()))
    || alive[Math.floor(Math.random() * alive.length)]; // fallback: random

  // Submit the vote
  const rk = `round${room.round}`;
  if (!room.votes[rk]) room.votes[rk] = {};
  if (room.votes[rk][botName]) return; // already voted
  room.votes[rk][botName] = target;
  room.players[botName].voted = true;
  broadcastRoom(code);
  io.to(code).emit('toast', `🤖 ${botName} a voté`);
  tallyVotes(room, code);
}

// Called when it's a bot's turn (word phase)
function scheduleBotTurn(room, code, botName) {
  if (!room.players[botName]?.isBot) return;
  io.to(code).emit('toast', `🤖 ${botName} réfléchit…`);
  setTimeout(() => botSubmitWord(room, code, botName), BOT_THINK_DELAY);
}

// Called when vote phase starts — bots vote after a delay
function tallyVotes(room, code) {
  if (room.subPhase !== 'vote') return;
  const rk = `round${room.round}`;
  const alive = getAlive(room);
  const submitted = Object.keys(room.votes[rk] || {});
  if (!alive.every(n => submitted.includes(n))) return; // not everyone voted yet
  clearTimer(code);
  const tally = {};
  alive.forEach(n => { tally[n] = 0; });
  Object.values(room.votes[rk]).forEach(t => { if (tally[t] !== undefined) tally[t]++; });
  const maxVotes = Math.max(...Object.values(tally));
  const tied = alive.filter(n => tally[n] === maxVotes);
  if (tied.length === 1) {
    eliminatePlayer(room, tied[0], code);
  } else {
    io.to(code).emit('vote:tie', { tied, tally });
    broadcastRoom(code);
  }
}

function scheduleBotVotes(room, code) {
  const bots = getAlive(room).filter(n => room.players[n]?.isBot);
  bots.forEach((botName, i) => {
    // Stagger bots: first after 2s, then every 1.5s to avoid Groq rate limits
    setTimeout(async () => {
      if (room.phase === 'playing' && room.subPhase === 'vote' && !room.players[botName]?.voted) {
        await botCastVote(room, code, botName);
      }
    }, 2000 + i * 1500);
  });
}


const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] }, pingInterval: 10000, pingTimeout: 30000, upgradeTimeout: 30000 });

// ═══════════════════════════════
//  PAIRS DATABASE
// ═══════════════════════════════
// ═══════════════════════════════
//  CHARACTER IMAGES MAP
// ═══════════════════════════════
const CHARACTER_IMAGES = {
  'Naruto Uzumaki': 'https://cdn.myanimelist.net/images/characters/2/284121.jpg',
  'Izuku Midoriya': 'https://cdn.myanimelist.net/images/characters/5/312676.jpg',
  'Tanjiro Kamado': 'https://cdn.myanimelist.net/images/characters/3/418268.jpg',
  'Yusuke Urameshi': 'https://cdn.myanimelist.net/images/characters/13/68953.jpg',
  'Sasuke Uchiha': 'https://cdn.myanimelist.net/images/characters/9/131317.jpg',
  'Vegeta': 'https://cdn.myanimelist.net/images/characters/4/253393.jpg',
  'Levi Ackerman': 'https://cdn.myanimelist.net/images/characters/2/241413.jpg',
  'Killua Zoldyck': 'https://cdn.myanimelist.net/images/characters/7/171471.jpg',
  'Monkey D. Luffy': 'https://cdn.myanimelist.net/images/characters/9/310307.jpg',
  'Gon Freecss': 'https://cdn.myanimelist.net/images/characters/11/174517.jpg',
  'Gojo Satoru': 'https://cdn.myanimelist.net/images/characters/8/450358.jpg',
  'Saitama': 'https://cdn.myanimelist.net/images/characters/11/207828.jpg',
  'Eren Yeager': 'https://cdn.myanimelist.net/images/characters/10/108914.jpg',
  'Kaneki Ken': 'https://cdn.myanimelist.net/images/characters/6/264525.jpg',
  'Itachi Uchiha': 'https://cdn.myanimelist.net/images/characters/15/72554.jpg',
  'Aizen Sosuke': 'https://cdn.myanimelist.net/images/characters/4/15631.jpg',
  'Yuji Itadori': 'https://cdn.myanimelist.net/images/characters/8/448083.jpg',
  'Denji': 'https://cdn.myanimelist.net/images/characters/10/471020.jpg',
  'Edward Elric': 'https://cdn.myanimelist.net/images/characters/11/174118.jpg',
  'Asta': 'https://cdn.myanimelist.net/images/characters/4/357434.jpg',
  'Ryomen Sukuna': 'https://cdn.myanimelist.net/images/characters/7/448084.jpg',
  'Muzan Kibutsuji': 'https://cdn.myanimelist.net/images/characters/13/418271.jpg',
  'Natsu Dragneel': 'https://cdn.myanimelist.net/images/characters/8/131067.jpg',
  'Portgas D. Ace': 'https://cdn.myanimelist.net/images/characters/7/84638.jpg',
  'Kakashi Hatake': 'https://cdn.myanimelist.net/images/characters/7/284122.jpg',
  'Aizawa Shouta': 'https://cdn.myanimelist.net/images/characters/9/312677.jpg',
  'Kirito': 'https://cdn.myanimelist.net/images/characters/7/204821.jpg',
  'Bell Cranel': 'https://cdn.myanimelist.net/images/characters/8/272225.jpg',
  'Subaru Natsuki': 'https://cdn.myanimelist.net/images/characters/7/321076.jpg',
  'Naofumi Iwatani': 'https://cdn.myanimelist.net/images/characters/13/399793.jpg',
  'Ainz Ooal Gown': 'https://cdn.myanimelist.net/images/characters/11/311898.jpg',
  'Lelouch vi Britannia': 'https://cdn.myanimelist.net/images/characters/8/76655.jpg',
  'Zero Two': 'https://cdn.myanimelist.net/images/characters/8/399332.jpg',
  'Violet Evergarden': 'https://cdn.myanimelist.net/images/characters/10/380395.jpg',
  'Rudeus Greyrat': 'https://cdn.myanimelist.net/images/characters/15/430591.jpg',
  'Rimuru Tempest': 'https://cdn.myanimelist.net/images/characters/15/388376.jpg',
  'Holo': 'https://cdn.myanimelist.net/images/characters/11/76340.jpg',
  'Raphtalia': 'https://cdn.myanimelist.net/images/characters/11/399795.jpg',
  'Shiroe': 'https://cdn.myanimelist.net/images/characters/2/255047.jpg',
  'Sora': 'https://cdn.myanimelist.net/images/characters/10/265968.jpg',
  'Rem': 'https://cdn.myanimelist.net/images/characters/13/321079.jpg',
  'Aqua': 'https://cdn.myanimelist.net/images/characters/13/298097.jpg',
  'Saber': 'https://cdn.myanimelist.net/images/characters/2/11389.jpg',
  'Erza Scarlet': 'https://cdn.myanimelist.net/images/characters/3/131068.jpg',
  'Kazuma Sato': 'https://cdn.myanimelist.net/images/characters/12/298096.jpg',
  'Hajime Nagumo': 'https://cdn.myanimelist.net/images/characters/8/435578.jpg',
  'L Lawliet': 'https://cdn.myanimelist.net/images/characters/8/261785.jpg',
  'Shikamaru Nara': 'https://cdn.myanimelist.net/images/characters/7/74918.jpg',
  'Griffith': 'https://cdn.myanimelist.net/images/characters/9/91465.jpg',
  'Zoro': 'https://cdn.myanimelist.net/images/characters/3/100534.jpg',
  'Guts': 'https://cdn.myanimelist.net/images/characters/10/91462.jpg',
  'Shigaraki Tomura': 'https://cdn.myanimelist.net/images/characters/3/312678.jpg',
  'Megumi Fushiguro': 'https://cdn.myanimelist.net/images/characters/6/448086.jpg',
  'Byakuya Kuchiki': 'https://cdn.myanimelist.net/images/characters/9/15632.jpg',
  'Roy Mustang': 'https://cdn.myanimelist.net/images/characters/7/174119.jpg',
  'Endeavor': 'https://cdn.myanimelist.net/images/characters/11/312679.jpg',
  'Mikasa Ackerman': 'https://cdn.myanimelist.net/images/characters/9/108913.jpg',
  'Motoko Kusanagi': 'https://cdn.myanimelist.net/images/characters/4/57938.jpg',
  'Giyu Tomioka': 'https://cdn.myanimelist.net/images/characters/8/418269.jpg',
  'Neji Hyuga': 'https://cdn.myanimelist.net/images/characters/8/68954.jpg',
  'Mob': 'https://cdn.myanimelist.net/images/characters/6/320019.jpg',
  'Tatsumaki': 'https://cdn.myanimelist.net/images/characters/15/207829.jpg',
  'Accelerator': 'https://cdn.myanimelist.net/images/characters/14/131789.jpg',
  'Hisoka Morow': 'https://cdn.myanimelist.net/images/characters/14/80554.jpg',
  'Taiga Aisaka': 'https://cdn.myanimelist.net/images/characters/9/122398.jpg',
  'Erina Nakiri': 'https://cdn.myanimelist.net/images/characters/9/273614.jpg',
  'Hachiman Hikigaya': 'https://cdn.myanimelist.net/images/characters/4/245851.jpg',
  'Rei Kiriyama': 'https://cdn.myanimelist.net/images/characters/7/320023.jpg',
  'Kousei Arima': 'https://cdn.myanimelist.net/images/characters/10/272469.jpg',
  'Shinichi Chiaki': 'https://cdn.myanimelist.net/images/characters/5/52435.jpg',
  'Shouko Nishimiya': 'https://cdn.myanimelist.net/images/characters/10/349230.jpg',
  'Mei Tachibana': 'https://cdn.myanimelist.net/images/characters/10/193695.jpg',
  'Shoya Ishida': 'https://cdn.myanimelist.net/images/characters/9/349229.jpg',
  'Takeo Goda': 'https://cdn.myanimelist.net/images/characters/3/280736.jpg',
  'Kaori Miyazono': 'https://cdn.myanimelist.net/images/characters/11/272468.jpg',
  'Menma': 'https://cdn.myanimelist.net/images/characters/8/197019.jpg',
  'Tohru Honda': 'https://cdn.myanimelist.net/images/characters/3/54558.jpg',
  'Oreki Houtarou': 'https://cdn.myanimelist.net/images/characters/9/212258.jpg',
  'Miyamura Izumi': 'https://cdn.myanimelist.net/images/characters/5/435577.jpg',
  'Nishikata': 'https://cdn.myanimelist.net/images/characters/13/395586.jpg',
  'Yor Forger': 'https://cdn.myanimelist.net/images/characters/5/481066.jpg',
  'Himeno': 'https://cdn.myanimelist.net/images/characters/5/471021.jpg',
  'Kaguya Shinomiya': 'https://cdn.myanimelist.net/images/characters/5/409841.jpg',
  'Yukino Yukinoshita': 'https://cdn.myanimelist.net/images/characters/10/245852.jpg',
  'Shoyo Hinata': 'https://cdn.myanimelist.net/images/characters/5/262849.jpg',
  'Tetsuya Kuroko': 'https://cdn.myanimelist.net/images/characters/8/223797.jpg',
  'Tobio Kageyama': 'https://cdn.myanimelist.net/images/characters/7/262850.jpg',
  'Seijuro Akashi': 'https://cdn.myanimelist.net/images/characters/5/223800.jpg',
  'Yoichi Isagi': 'https://cdn.myanimelist.net/images/characters/5/476940.jpg',
  'Ryota Kise': 'https://cdn.myanimelist.net/images/characters/12/223798.jpg',
  'Ippo Makunouchi': 'https://cdn.myanimelist.net/images/characters/13/49966.jpg',
  'Joe Yabuki': 'https://cdn.myanimelist.net/images/characters/12/57939.jpg',
  'Ryoma Echizen': 'https://cdn.myanimelist.net/images/characters/4/24156.jpg',
  'Eiichirou Maruo': 'https://cdn.myanimelist.net/images/characters/12/273615.jpg',
  'Takenori Akagi': 'https://cdn.myanimelist.net/images/characters/10/40556.jpg',
  'Ushijima Wakatoshi': 'https://cdn.myanimelist.net/images/characters/11/262851.jpg',
  'Eijun Sawamura': 'https://cdn.myanimelist.net/images/characters/6/262852.jpg',
  'Furuya Satoru': 'https://cdn.myanimelist.net/images/characters/4/270391.jpg',
  'Light Yagami': 'https://cdn.myanimelist.net/images/characters/9/261784.jpg',
  'Jotaro Kujo': 'https://cdn.myanimelist.net/images/characters/7/53397.jpg',
  'Giorno Giovanna': 'https://cdn.myanimelist.net/images/characters/9/53398.jpg',
  'Spike Spiegel': 'https://cdn.myanimelist.net/images/characters/8/57940.jpg',
  'Vash the Stampede': 'https://cdn.myanimelist.net/images/characters/10/57941.jpg',
  'Thorfinn': 'https://cdn.myanimelist.net/images/characters/11/400855.jpg',
  'Senku Ishigami': 'https://cdn.myanimelist.net/images/characters/9/399792.jpg',
  'Ayanokoji Kiyotaka': 'https://cdn.myanimelist.net/images/characters/14/357435.jpg',
  'Rintaro Okabe': 'https://cdn.myanimelist.net/images/characters/5/121598.jpg',
  'Makoto Naegi': 'https://cdn.myanimelist.net/images/characters/13/212259.jpg',
  'Shinji Ikari': 'https://cdn.myanimelist.net/images/characters/5/23821.jpg',
  'Homura Akemi': 'https://cdn.myanimelist.net/images/characters/11/180013.jpg',
  'Usagi Tsukino': 'https://cdn.myanimelist.net/images/characters/9/57942.jpg',
  'Nanoha Takamachi': 'https://cdn.myanimelist.net/images/characters/9/34901.jpg',
  'Satsuki Kiryuin': 'https://cdn.myanimelist.net/images/characters/4/255961.jpg',
  'Yato': 'https://cdn.myanimelist.net/images/characters/14/275273.jpg',
  'Revy': 'https://cdn.myanimelist.net/images/characters/7/57943.jpg',
  'Mahito': 'https://cdn.myanimelist.net/images/characters/4/448087.jpg',
  'Hiei': 'https://cdn.myanimelist.net/images/characters/12/68955.jpg',
  'Hanamichi Sakuragi': 'https://cdn.myanimelist.net/images/characters/7/40557.jpg',
  'Noya Libero': 'https://cdn.myanimelist.net/images/characters/8/262853.jpg',
  'Reo Mikage': 'https://cdn.myanimelist.net/images/characters/7/476941.jpg',
  'Seishiro Nagi': 'https://cdn.myanimelist.net/images/characters/8/476942.jpg',
  'Wataru Kuramochi': 'https://cdn.myanimelist.net/images/characters/5/270392.jpg',
  'Yuri Katsuki': 'https://cdn.myanimelist.net/images/characters/9/335669.jpg',
  'Hanamichi Sakuragi': 'https://cdn.myanimelist.net/images/characters/7/40557.jpg',
  'Takeo Goda': 'https://cdn.myanimelist.net/images/characters/3/280736.jpg',
};

const PAIRS = {
  shonen: [
    { civilian:'Naruto Uzumaki', undercovers:['Izuku Midoriya','Gon Freecss','Luffy','Asta','Edward Elric'], hint:'Héros rejetés devenus symboles d\'espoir' },
    { civilian:'Levi Ackerman', undercovers:['Killua Zoldyck','Hiei','Zoro','Mikasa Ackerman','Guts'], hint:'Combattants froids à la vitesse surhumaine' },
    { civilian:'Sasuke Uchiha', undercovers:['Vegeta','Hiei','Byakuya Kuchiki','Neji Hyuga','Griffith'], hint:'Rivaux orgueilleux obsédés par la puissance' },
    { civilian:'Gojo Satoru', undercovers:['Saitama','Accelerator','Aizen Sosuke','Goku','Lelouch vi Britannia'], hint:'Les plus forts de leur monde, détachés' },
    { civilian:'Eren Yeager', undercovers:['Kaneki Ken','Shigaraki Tomura','Denji','Yuji Itadori','Griffith'], hint:'Jeunes hommes consumés par leur propre monstre' },
    { civilian:'Itachi Uchiha', undercovers:['Aizen Sosuke','Lelouch vi Britannia','Griffith','L Lawliet','Giorno Giovanna'], hint:'Géniaux traîtres au sacrifice calculé' },
    { civilian:'Kakashi Hatake', undercovers:['Aizawa Shouta','Roy Mustang','Giyu Tomioka','Byakuya Kuchiki','Levi Ackerman'], hint:'Profs nonchalants cachant une puissance réelle' },
    { civilian:'Yuji Itadori', undercovers:['Denji','Natsu Dragneel','Asta','Gon Freecss','Monkey D. Luffy'], hint:'Hôtes d\'une entité dévastatrice' },
    { civilian:'Ryomen Sukuna', undercovers:['Muzan Kibutsuji','Aizen Sosuke','Griffith','Madara Uchiha','Ainz Ooal Gown'], hint:'Rois des démons quasi-immortels' },
    { civilian:'Natsu Dragneel', undercovers:['Portgas D. Ace','Roy Mustang','Endeavor','Shinra Kusakabe','Rengoku'], hint:'Utilisateurs de flammes impulsifs' },
    { civilian:'Monkey D. Luffy', undercovers:['Gon Freecss','Naruto Uzumaki','Asta','Edward Elric','Denji'], hint:'Garçons solaires à la force brute et pure' },
    { civilian:'Megumi Fushiguro', undercovers:['Byakuya Kuchiki','Neji Hyuga','Sasuke Uchiha','Levi Ackerman','Giyu Tomioka'], hint:'Invocateurs froids au style aristocratique' },
    { civilian:'Shigaraki Tomura', undercovers:['Griffith','Kaneki Ken','Eren Yeager','Mahito','Muzan Kibutsuji'], hint:'Antagonistes qui veulent détruire l\'ordre établi' },
  ],

  fantasy: [
    { civilian:'Kirito', undercovers:['Bell Cranel','Subaru Natsuki','Naofumi Iwatani','Rudeus Greyrat','Hajime Nagumo'], hint:'Solitaires progressant dans un monde RPG' },
    { civilian:'Ainz Ooal Gown', undercovers:['Lelouch vi Britannia','Aizen Sosuke','Shiroe','L Lawliet','Rimuru Tempest'], hint:'Stratèges masqués qui jouent avec des vies' },
    { civilian:'Rem', undercovers:['Aqua','Raphtalia','Holo','Violet Evergarden','Zero Two'], hint:'Filles loyales à leur partenaire dans un isekai' },
    { civilian:'Rimuru Tempest', undercovers:['Ainz Ooal Gown','Rudeus Greyrat','Subaru Natsuki','Kazuma Sato','Naofumi Iwatani'], hint:'Réincarnés overpowered construisant leur empire' },
    { civilian:'Zero Two', undercovers:['Violet Evergarden','Raphtalia','Holo','Rem','Saber'], hint:'Hybrides qui apprennent à être humaines' },
    { civilian:'Saber', undercovers:['Erza Scarlet','Mikasa Ackerman','Motoko Kusanagi','Violet Evergarden','Yor Forger'], hint:'Guerrières en armure à l\'honneur inflexible' },
    { civilian:'Kazuma Sato', undercovers:['Subaru Natsuki','Naofumi Iwatani','Hajime Nagumo','Rudeus Greyrat','Shiroe'], hint:'Isekai inadaptés qui s\'en sortent quand même' },
    { civilian:'Holo', undercovers:['Raphtalia','Rem','Zero Two','Violet Evergarden','Saber'], hint:'Bêtes-humaines loyales à leur partenaire' },
    { civilian:'Subaru Natsuki', undercovers:['Naofumi Iwatani','Kirito','Kazuma Sato','Rudeus Greyrat','Shinji Ikari'], hint:'Isekai traités injustement qui repartent de zéro' },
    { civilian:'Lelouch vi Britannia', undercovers:['Ainz Ooal Gown','L Lawliet','Aizen Sosuke','Light Yagami','Giorno Giovanna'], hint:'Génies stratèges au plan mondial' },
    { civilian:'Shiroe', undercovers:['Ainz Ooal Gown','Kazuma Sato','Kirito','L Lawliet','Ayanokoji Kiyotaka'], hint:'Gamers stratèges qui dominent leur monde' },
    { civilian:'Violet Evergarden', undercovers:['Saber','Rem','Zero Two','Raphtalia','Yor Forger'], hint:'Soldates brisées qui redécouvrent l\'humanité' },
  ],

  action: [
    { civilian:'L Lawliet', undercovers:['Shikamaru Nara','Ayanokoji Kiyotaka','Lelouch vi Britannia','Light Yagami','Shiroe'], hint:'Génies paresseux redoutables en vrai' },
    { civilian:'Zoro', undercovers:['Guts','Levi Ackerman','Mikasa Ackerman','Thorfinn','Giyu Tomioka'], hint:'Combattants à l\'épée solitaires et marqués' },
    { civilian:'Mikasa Ackerman', undercovers:['Motoko Kusanagi','Saber','Erza Scarlet','Yor Forger','Violet Evergarden'], hint:'Soldates froides au corps modifié' },
    { civilian:'Roy Mustang', undercovers:['Endeavor','Natsu Dragneel','Portgas D. Ace','Rengoku','Shinra Kusakabe'], hint:'Héros pyrokinésistes ambitieux' },
    { civilian:'Giyu Tomioka', undercovers:['Neji Hyuga','Byakuya Kuchiki','Levi Ackerman','Sasuke Uchiha','Megumi Fushiguro'], hint:'Combattants d\'élite froids au style parfait' },
    { civilian:'Guts', undercovers:['Thorfinn','Zoro','Levi Ackerman','Mikasa Ackerman','Giyu Tomioka'], hint:'Guerriers solitaires marqués par la tragédie' },
    { civilian:'Jotaro Kujo', undercovers:['Giorno Giovanna','Hiei','Levi Ackerman','Guts','Zoro'], hint:'Combattants stoïques à l\'aura intimidante' },
    { civilian:'Accelerator', undercovers:['Hisoka Morow','Tatsumaki','Mob','Gojo Satoru','Saitama'], hint:'Êtres supérieurs dérangés cherchant une vraie bataille' },
    { civilian:'Spike Spiegel', undercovers:['Vash the Stampede','Revy','Yato','Zoro','Guts'], hint:'Hors-la-loi décontractés avec un passé sombre' },
    { civilian:'Motoko Kusanagi', undercovers:['Mikasa Ackerman','Saber','Yor Forger','Revy','Violet Evergarden'], hint:'Soldates cybernétiques à l\'identité questionnée' },
    { civilian:'Light Yagami', undercovers:['Lelouch vi Britannia','L Lawliet','Ayanokoji Kiyotaka','Giorno Giovanna','Ainz Ooal Gown'], hint:'Génies qui se croient des dieux' },
    { civilian:'Hisoka Morow', undercovers:['Accelerator','Mahito','Griffith','Aizen Sosuke','Dio Brando'], hint:'Antagonistes qui jouent avec leurs proies' },
    { civilian:'Thorfinn', undercovers:['Guts','Zoro','Levi Ackerman','Revy','Spike Spiegel'], hint:'Guerriers brisés en quête de rédemption' },
  ],

  romance: [
    { civilian:'Taiga Aisaka', undercovers:['Erina Nakiri','Kaguya Shinomiya','Yukino Yukinoshita','Satsuki Kiryuin','Himeno'], hint:'Blondes hautaines au cœur tendre caché' },
    { civilian:'Hachiman Hikigaya', undercovers:['Oreki Houtarou','Rei Kiriyama','Ayanokoji Kiyotaka','Shinji Ikari','Nishikata'], hint:'Solitaires intelligents qui observent sans participer' },
    { civilian:'Kousei Arima', undercovers:['Shinichi Chiaki','Rei Kiriyama','Shinji Ikari','Oreki Houtarou','Shoya Ishida'], hint:'Prodiges brisés qui se reconstruisent' },
    { civilian:'Shouko Nishimiya', undercovers:['Mei Tachibana','Tohru Honda','Violet Evergarden','Rem','Menma'], hint:'Filles solitaires qui apprennent la confiance' },
    { civilian:'Kaguya Shinomiya', undercovers:['Yukino Yukinoshita','Taiga Aisaka','Erina Nakiri','Satsuki Kiryuin','Kaguya'], hint:'Héritières froides qui tombent amoureuses malgré leur fierté' },
    { civilian:'Tohru Honda', undercovers:['Rem','Raphtalia','Violet Evergarden','Shouko Nishimiya','Menma'], hint:'Filles lumineuses qui acceptent tout le monde' },
    { civilian:'Miyamura Izumi', undercovers:['Shoya Ishida','Nishikata','Hachiman Hikigaya','Oreki Houtarou','Kousei Arima'], hint:'Garçons introvertis qui s\'ouvrent à une seule personne' },
    { civilian:'Yor Forger', undercovers:['Himeno','Saber','Mikasa Ackerman','Motoko Kusanagi','Erza Scarlet'], hint:'Femmes douces en apparence, tueuses de métier' },
    { civilian:'Kaori Miyazono', undercovers:['Menma','Violet Evergarden','Shouko Nishimiya','Tohru Honda','Rem'], hint:'Filles lumineuses arrachées trop tôt' },
    { civilian:'Oreki Houtarou', undercovers:['Hachiman Hikigaya','Rei Kiriyama','Ayanokoji Kiyotaka','Shinji Ikari','L Lawliet'], hint:'Introvertis économes en énergie mais brillants' },
    { civilian:'Shoya Ishida', undercovers:['Miyamura Izumi','Nishikata','Kousei Arima','Hachiman Hikigaya','Takeo Goda'], hint:'Garçons brisés qui se rachètent par amour sincère' },
    { civilian:'Yukino Yukinoshita', undercovers:['Kaguya Shinomiya','Taiga Aisaka','Erina Nakiri','Satsuki Kiryuin','Yukino'], hint:'Perfectionnistes froides cachant une vraie sensibilité' },
  ],

  sports: [
    { civilian:'Shoyo Hinata', undercovers:['Tetsuya Kuroko','Yoichi Isagi','Ryota Kise','Hanamichi Sakuragi','Noya Libero'], hint:'Petits joueurs invisibles au grand impact' },
    { civilian:'Tobio Kageyama', undercovers:['Seijuro Akashi','Ryoma Echizen','Takenori Akagi','Ushijima Wakatoshi','Reo Mikage'], hint:'Génies du terrain qui contrôlent tout' },
    { civilian:'Ippo Makunouchi', undercovers:['Joe Yabuki','Hanamichi Sakuragi','Asta','Naruto Uzumaki','Eijun Sawamura'], hint:'Combattants du peuple montant par pur acharnement' },
    { civilian:'Tetsuya Kuroko', undercovers:['Shoyo Hinata','Noya Libero','Seishiro Nagi','Yoichi Isagi','Ryota Kise'], hint:'Joueurs discrets à l\'impact décisif' },
    { civilian:'Yoichi Isagi', undercovers:['Seishiro Nagi','Reo Mikage','Tetsuya Kuroko','Ryota Kise','Shoyo Hinata'], hint:'Attaquants analytiques qui copient et dépassent' },
    { civilian:'Seijuro Akashi', undercovers:['Tobio Kageyama','Ushijima Wakatoshi','Ryoma Echizen','Takenori Akagi','Ayanokoji Kiyotaka'], hint:'Meneurs absolus qui ne perdent jamais' },
    { civilian:'Eijun Sawamura', undercovers:['Furuya Satoru','Ippo Makunouchi','Shoyo Hinata','Natsu Dragneel','Asta'], hint:'Lanceurs/attaquants bruts qui évoluent par passion' },
    { civilian:'Hanamichi Sakuragi', undercovers:['Ippo Makunouchi','Asta','Natsu Dragneel','Gon Freecss','Takeo Goda'], hint:'Débutants arrogants qui deviennent des piliers' },
    { civilian:'Yuri Katsuki', undercovers:['Kousei Arima','Rei Kiriyama','Shinji Ikari','Eiichirou Maruo','Shouko Nishimiya'], hint:'Athlètes anxieux qui transcendent leurs limites' },
    { civilian:'Ushijima Wakatoshi', undercovers:['Takenori Akagi','Seijuro Akashi','Tobio Kageyama','Levi Ackerman','Guts'], hint:'Piliers physiques intransigeants et imposants' },
  ],

  mix: [
    { civilian:'Senku Ishigami', undercovers:['Ayanokoji Kiyotaka','L Lawliet','Rintaro Okabe','Makoto Naegi','Shiroe'], hint:'Génies scientifiques qui sauvent le monde par l\'intelligence' },
    { civilian:'Rintaro Okabe', undercovers:['Makoto Naegi','Senku Ishigami','L Lawliet','Shinji Ikari','Hachiman Hikigaya'], hint:'Garçons ordinaires face à des événements extraordinaires' },
    { civilian:'Homura Akemi', undercovers:['Rem','Mikasa Ackerman','Violet Evergarden','Saber','Yor Forger'], hint:'Filles qui sacrifient tout pour protéger une seule personne' },
    { civilian:'Mob', undercovers:['Tatsumaki','Saitama','Accelerator','Gojo Satoru','Shinji Ikari'], hint:'Psychiques overpowered qui semblent absents' },
    { civilian:'Spike Spiegel', undercovers:['Vash the Stampede','Yato','Zoro','Revy','Guts'], hint:'Vagabonds cool avec un passé douloureux' },
    { civilian:'Ayanokoji Kiyotaka', undercovers:['L Lawliet','Light Yagami','Lelouch vi Britannia','Shiroe','Ainz Ooal Gown'], hint:'Génies cachés qui manipulent tout depuis l\'ombre' },
    { civilian:'Makoto Naegi', undercovers:['Rintaro Okabe','Shinji Ikari','Subaru Natsuki','Kazuma Sato','Shoya Ishida'], hint:'Garçons ordinaires survivant à l\'extraordinaire' },
    { civilian:'Shinji Ikari', undercovers:['Kousei Arima','Rei Kiriyama','Rintaro Okabe','Mob','Hachiman Hikigaya'], hint:'Protagonistes dépressifs portant le poids du monde' },
    { civilian:'Vash the Stampede', undercovers:['Spike Spiegel','Yato','Kazuma Sato','Gon Freecss','Monkey D. Luffy'], hint:'Pacifistes redoutables avec un passé mystérieux' },
    { civilian:'Giorno Giovanna', undercovers:['Lelouch vi Britannia','Light Yagami','Giorno','Ayanokoji Kiyotaka','Ainz Ooal Gown'], hint:'Jeunes au calme glacial qui accèdent au sommet' },
    { civilian:'Revy', undercovers:['Motoko Kusanagi','Yor Forger','Mikasa Ackerman','Saber','Himeno'], hint:'Femmes de terrain brutales et sans attaches' },
    { civilian:'Yato', undercovers:['Spike Spiegel','Vash the Stampede','Kazuma Sato','Yusuke Urameshi','Hiei'], hint:'Dieux/esprits décontractés cachant une vraie puissance' },
  ],
};


function getRandomPair(genre) {
  const list = PAIRS[genre] || PAIRS.mix;
  const template = list[Math.floor(Math.random() * list.length)];
  const undercoverWord = template.undercovers[Math.floor(Math.random() * template.undercovers.length)];
  return {
    civilian: template.civilian,
    undercover: undercoverWord,
    hint: template.hint,
    civilianImg: CHARACTER_IMAGES[template.civilian] || null,
    undercoverImg: CHARACTER_IMAGES[undercoverWord] || null,
  };
}

// ═══════════════════════════════
//  ROOMS
// ═══════════════════════════════
const rooms = {};
const timers = {}; // code -> setInterval ref

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

function sanitizeRoom(room) {
  const r = { ...room, players: {}, spectators: room.spectators || [], turnOrder: room.turnOrder || [], currentTurnIndex: room.currentTurnIndex ?? 0 };
  for (const [n, p] of Object.entries(room.players)) {
    r.players[n] = { connected: p.connected, eliminated: p.eliminated, ready: p.ready, voted: p.voted, isSpectator: p.isSpectator || false, isBot: p.isBot || false };
  }
  return r;
}

function broadcastRoom(code) {
  if (!rooms[code]) return;
  io.to(code).emit('room:update', sanitizeRoom(rooms[code]));
}

function getAlive(room) {
  return Object.entries(room.players).filter(([,p]) => !p.eliminated && p.connected).map(([n]) => n);
}

function findSocket(name, code) {
  return [...io.sockets.sockets.values()].find(s => s.data?.name === name && s.data?.code === code);
}

// ═══════════════════════════════
//  TIMER
// ═══════════════════════════════
const WORD_TIMER_SECS = 45;
const VOTE_TIMER_SECS = 60;

function startTimer(code, seconds, phase) {
  clearTimer(code);
  const room = rooms[code];
  if (!room) return;
  room.timerEnd = Date.now() + seconds * 1000;
  room.timerPhase = phase;
  broadcastRoom(code);

  timers[code] = setTimeout(() => {
    const r = rooms[code];
    if (!r) return;
    if (phase === 'words') {
      // Timer expired for current player — auto-submit '…' and advance turn
      const rk = `round${r.round}`;
      if (!r.words[rk]) r.words[rk] = {};
      const aliveTurnOrder = r.turnOrder.filter(n => !r.players[n]?.eliminated && r.players[n]?.connected);
      const currentPlayer = aliveTurnOrder[r.currentTurnIndex % aliveTurnOrder.length];
      if (currentPlayer && !r.words[rk][currentPlayer]) {
        r.words[rk][currentPlayer] = '…';
        io.to(code).emit('word:revealed', { player: currentPlayer, word: '…', round: r.round });
        r.currentTurnIndex++;
      }
      // Recompute allDone AFTER potential auto-submit — check words submitted vs alive count
      const wordsSubmitted = Object.keys(r.words[rk] || {}).filter(n => aliveTurnOrder.includes(n));
      const allDone = wordsSubmitted.length >= aliveTurnOrder.length;
      if (allDone) {
        // Reset turnIndex cleanly before moving on
        r.currentTurnIndex = 0;
        const votingLocked = r.round < (r.votingUnlockedAtRound || 2);
        if (votingLocked) {
          io.to(code).emit('toast', `Tour ${r.round} terminé — tour ${r.round + 1} !`);
          broadcastRoom(code);
          setTimeout(() => nextRound(r, code), 1400);
        } else {
          r.subPhase = 'vote';
          r.currentTurnIndex = 0;
          Object.keys(r.players).forEach(p => { r.players[p].voted = false; });
          broadcastRoom(code);
          scheduleBotVotes(r, code);
          startTimer(code, VOTE_TIMER_SECS, 'vote');
        }
      } else {
        const nextPlayer = aliveTurnOrder[r.currentTurnIndex % aliveTurnOrder.length];
        broadcastRoom(code);
        io.to(code).emit('turn:next', { player: nextPlayer });
        // If next is a bot, schedule it
        if (r.players[nextPlayer]?.isBot) {
          setTimeout(() => botSubmitWord(r, code, nextPlayer), BOT_THINK_DELAY);
        } else {
          startTimer(code, WORD_TIMER_SECS, 'words');
        }
      }
    } else if (phase === 'vote') {
      // Auto-eliminate highest voted or random alive
      const alive = getAlive(r);
      const voteCount = {};
      alive.forEach(n => { voteCount[n] = 0; });
      Object.values(r.votes?.[`round${r.round}`] || {}).forEach(t => { if (voteCount[t] !== undefined) voteCount[t]++; });
      const sorted = alive.sort((a, b) => (voteCount[b]||0) - (voteCount[a]||0));
      if (sorted[0]) eliminatePlayer(r, sorted[0], code);
    }
  }, seconds * 1000);
}

function clearTimer(code) {
  if (timers[code]) { clearTimeout(timers[code]); delete timers[code]; }
}

// ═══════════════════════════════
//  CHARACTER IMAGES (hardcoded)
// ═══════════════════════════════
function fetchCharImage(charName) {
  return CHARACTER_IMAGES[charName] || null;
}

// ═══════════════════════════════
//  HEALTH + PING (anti-sleep)
// ═══════════════════════════════
app.get('/', (_, res) => res.send('Undercover Anime Backend OK ✅'));
app.get('/ping', (_, res) => res.json({ ok: true, ts: Date.now() }));

// Image proxy — serves MAL images without CORS issues
app.get('/img', async (req, res) => {
  const url = req.query.url;
  if (!url || !url.startsWith('https://cdn.myanimelist.net/')) {
    return res.status(400).send('Invalid URL');
  }
  try {
    const r = await fetch(url, {
      headers: { 'Referer': 'https://myanimelist.net/', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) return res.status(404).send('Not found');
    const buf = await r.arrayBuffer();
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(500).send('Error');
  }
});

// ═══════════════════════════════
//  SOCKET
// ═══════════════════════════════
io.on('connection', (socket) => {

  socket.on('room:create', ({ name, genre, mrWhite, doubleUndercover, wordTimer }) => {
    let code; do { code = genCode(); } while (rooms[code]);
    rooms[code] = {
      code, genre, host: name,
      phase: 'lobby',
      settings: { mrWhite: !!mrWhite, doubleUndercover: !!doubleUndercover, wordTimer: wordTimer !== false },
      players: { [name]: { socketId: socket.id, connected: true, eliminated: false, ready: false, voted: false, isSpectator: false } },
      spectators: [],
      assignments: {}, wordPair: null,
      round: 1, words: {}, votes: {}, accusations: {},
      subPhase: 'words',
      mrWhiteGuessPhase: false,
      scores: {},
      timerEnd: null, timerPhase: null,
      countdown: null,
    };
    socket.join(code); socket.data = { name, code, isSpectator: false };
    socket.emit('room:joined', { code, name, isHost: true });
    broadcastRoom(code);
  });

  socket.on('room:join', ({ name, code, asSpectator }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error', 'Salle introuvable !');
    if (room.players[name]?.connected) return socket.emit('error', 'Ce prénom est déjà pris !');

    // Join mid-game as spectator
    if (room.phase !== 'lobby' && !asSpectator) {
      // Offer spectator mode
      return socket.emit('spectator:offer', { code, name });
    }

    const isSpectator = asSpectator || room.phase !== 'lobby';
    room.players[name] = { socketId: socket.id, connected: true, eliminated: isSpectator, ready: isSpectator, voted: false, isSpectator };
    if (isSpectator && !room.spectators) room.spectators = [];
    if (isSpectator) room.spectators.push(name);
    socket.join(code); socket.data = { name, code, isSpectator };
    socket.emit('room:joined', { code, name, isHost: false, isSpectator });
    if (isSpectator) socket.emit('spectator:joined', { message: 'Tu observes la partie en cours !' });
    broadcastRoom(code);
    io.to(code).emit('toast', isSpectator ? `👁 ${name} observe la partie` : `${name} a rejoint !`);
  });

  socket.on('disconnect', () => {
    const disconnectedSocketId = socket.id;
    const { name, code } = socket.data || {};
    if (!name || !code) return;
    // Grace period: 4s before marking disconnected (handles brief reconnects during countdown)
    setTimeout(() => {
      const r = rooms[code];
      if (!r || !r.players[name]) return;
      // If player reconnected with a new socket already, skip
      const current = findSocket(name, code);
      if (current && current.id !== disconnectedSocketId) return;
      r.players[name].connected = false;
      if (r.host === name && r.phase === 'lobby') {
        const other = Object.entries(r.players).find(([n,p]) => n !== name && p.connected && !p.isBot);
        if (other) { r.host = other[0]; findSocket(other[0], code)?.emit('room:promoted', { isHost: true }); }
        else { clearTimer(code); delete rooms[code]; return; }
      }
      broadcastRoom(code);
      io.to(code).emit('toast', `${name} s'est déconnecté`);
    }, 4000);
  });

  socket.on('room:reconnect', ({ name, code }) => {
    const room = rooms[code];
    if (!room || !room.players[name]) return socket.emit('error', 'Session introuvable');
    room.players[name].socketId = socket.id;
    room.players[name].connected = true;
    socket.join(code); socket.data = { name, code, isSpectator: room.players[name].isSpectator };
    socket.emit('room:joined', { code, name, isHost: room.host === name, isSpectator: room.players[name].isSpectator });
    if (room.assignments?.[name]) socket.emit('your:assignment', room.assignments[name]);
    // Restore vote state
    const rk = `round${room.round}`;
    const myVote = room.votes?.[rk]?.[name];
    if (myVote) socket.emit('vote:restore', { target: myVote });
    broadcastRoom(code);
    io.to(code).emit('toast', `${name} est de retour !`);
  });

  socket.on('player:kick', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    const ts = findSocket(target, code);
    if (ts) { ts.emit('kicked', 'Tu as été expulsé'); ts.leave(code); ts.data = {}; }
    delete room.players[target];
    broadcastRoom(code);
    io.to(code).emit('toast', `${target} a été expulsé`);
  });

  socket.on('room:leave', () => {
    const { name, code } = socket.data || {};
    if (!name || !code || !rooms[code]) return;
    const room = rooms[code];
    delete room.players[name]; socket.leave(code); socket.data = {};
    if (Object.keys(room.players).length === 0) { clearTimer(code); delete rooms[code]; return; }
    if (room.host === name) {
      const next = Object.entries(room.players).find(([,p]) => p.connected);
      if (next) { room.host = next[0]; findSocket(next[0], code)?.emit('room:promoted', { isHost: true }); }
    }
    broadcastRoom(code);
    io.to(code).emit('toast', `${name} a quitté`);
  });

  // ── ACCUSATION ──
  socket.on('player:accuse', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'playing') return;
    if (room.players[name]?.eliminated) return;
    const rk = `round${room.round}`;
    if (!room.accusations[rk]) room.accusations[rk] = {};
    room.accusations[rk][name] = target;
    io.to(code).emit('player:accused', { accuser: name, target });
    broadcastRoom(code);
  });

  // ── START GAME (with countdown) ──
  socket.on('game:start', async ({ genre, settings }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;

    // Countdown 3-2-1
    io.to(code).emit('game:countdown', 3);
    await new Promise(r => setTimeout(r, 1000));
    io.to(code).emit('game:countdown', 2);
    await new Promise(r => setTimeout(r, 1000));
    io.to(code).emit('game:countdown', 1);
    await new Promise(r => setTimeout(r, 1000));
    io.to(code).emit('game:countdown', 0);

    io.to(code).emit('loading', true);

    const g = genre || room.genre;
    const s = settings || room.settings;
    room.settings = s;

    const pair = getRandomPair(g);
    // Images already set in getRandomPair

    const players = Object.keys(room.players).filter(p => room.players[p].connected && !room.players[p].isSpectator);
    const shuffled = [...players].sort(() => Math.random() - .5);

    const assignments = {};
    let ucCount = (s.doubleUndercover && players.length >= 6) ? 2 : 1;
    let mrwSet = false;

    shuffled.forEach((p, i) => {
      if (i < ucCount) {
        assignments[p] = { role:'undercover', word:pair.undercover, image:pair.undercoverImg, blockedWords:getBlockedWords(pair.undercover) };
      } else if (!mrwSet && s.mrWhite && players.length >= 5) {
        mrwSet = true;
        assignments[p] = { role:'mr-white', word:null, image:null, blockedWords:[] };
      } else {
        assignments[p] = { role:'civilian', word:pair.civilian, image:pair.civilianImg, blockedWords:getBlockedWords(pair.civilian) };
      }
    });

    players.forEach(p => { if (!room.scores[p]) room.scores[p] = { wins: 0 }; });

    room.wordPair = pair; room.assignments = assignments;
    room.phase = 'reveal'; room.round = 1; room.words = {}; room.votes = {}; room.accusations = {};
    room.subPhase = 'words'; room.mrWhiteGuessPhase = false;
    room.turnOrder = shuffled; // random order locked at game start — only alive non-spectator players
    room.currentTurnIndex = 0;  // whose turn it is within turnOrder
    room.votingUnlockedAtRound = 2; // vote only available from round 2
    Object.keys(room.players).forEach(p => { room.players[p].ready = room.players[p].isSpectator || room.players[p].isBot || false; room.players[p].voted = false; });

    shuffled.forEach(pName => { findSocket(pName, code)?.emit('your:assignment', assignments[pName]); });

    io.to(code).emit('loading', false);
    broadcastRoom(code);
  });

  // ── PLAYER READY ──
  socket.on('player:ready', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room) return;
    room.players[name].ready = true;
    broadcastRoom(code);
    const connected = Object.entries(room.players).filter(([,p]) => p.connected && !p.eliminated);
    if (connected.every(([,p]) => p.ready) && room.phase === 'reveal') {
      room.phase = 'playing';
      room.subPhase = 'words';
      room.currentTurnIndex = 0;
      broadcastRoom(code);
      const firstPlayer = room.turnOrder.filter(n => !room.players[n]?.eliminated && room.players[n]?.connected)[0];
      if (firstPlayer) io.to(code).emit('turn:next', { player: firstPlayer });
      // Bots are always "ready" — if first player is a bot, schedule its turn
      if (firstPlayer && room.players[firstPlayer]?.isBot) {
        scheduleBotTurn(room, code, firstPlayer);
      } else if (room.settings.wordTimer) {
        startTimer(code, WORD_TIMER_SECS, 'words');
      }
    }
  });

  // ── SUBMIT WORD ──
  socket.on('word:submit', ({ word }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'playing' || room.subPhase !== 'words') return;

    const rk = `round${room.round}`;
    if (!room.words[rk]) room.words[rk] = {};
    if (room.words[rk][name]) return; // already submitted

    // Enforce turn order — only the current active player can submit
    const aliveTurnOrder = room.turnOrder.filter(n => !room.players[n]?.eliminated && room.players[n]?.connected);
    const currentPlayer = aliveTurnOrder[room.currentTurnIndex % aliveTurnOrder.length];
    if (name !== currentPlayer) {
      socket.emit('error', `C'est le tour de ${currentPlayer} !`);
      return;
    }

    const trimmed = word.trim().substring(0, 40);

    // Check blocked words
    const myAssignment = room.assignments[name];
    const blocked = myAssignment?.blockedWords || [];
    const wordLower = trimmed.toLowerCase().replace(/[^a-zàâäéèêëîïôùûü]/gi, '');
    const isBlocked = blocked.some(b => wordLower.includes(b) || b.includes(wordLower));

    if (isBlocked) {
      socket.emit('word:blocked', { word: trimmed });
      io.to(code).emit('toast', `🚫 ${name} a dit le nom du perso — éliminé !`);
      // Advance turn before eliminating
      room.currentTurnIndex++;
      eliminatePlayer(room, name, code);
      return;
    }

    room.words[rk][name] = trimmed;
    clearTimer(code); // clear per-player timer

    // Broadcast the word to everyone
    io.to(code).emit('word:revealed', { player: name, word: trimmed, round: room.round });

    // Advance turn
    room.currentTurnIndex++;
    const newAliveTurnOrder = room.turnOrder.filter(n => !room.players[n]?.eliminated && room.players[n]?.connected);
    const wordsIn = Object.keys(room.words[rk] || {}).filter(n => newAliveTurnOrder.includes(n));
    const allDone = wordsIn.length >= newAliveTurnOrder.length;

    if (allDone) {
      // Everyone has spoken this round
      const votingLocked = room.round < (room.votingUnlockedAtRound || 2);
      if (votingLocked) {
        io.to(code).emit('toast', `Tour ${room.round} terminé — tour ${room.round + 1} !`);
        broadcastRoom(code);
        setTimeout(() => nextRound(room, code), 1400);
      } else {
        room.subPhase = 'vote';
        Object.keys(room.players).forEach(p => { room.players[p].voted = false; });
        broadcastRoom(code);
        scheduleBotVotes(room, code);
        if (room.settings.wordTimer) startTimer(code, VOTE_TIMER_SECS, 'vote');
      }
    } else {
      // Notify who is next
      const nextPlayer = newAliveTurnOrder[room.currentTurnIndex % newAliveTurnOrder.length];
      broadcastRoom(code);
      io.to(code).emit('turn:next', { player: nextPlayer });
      // If next player is a bot, schedule its turn; else start timer
      if (room.players[nextPlayer]?.isBot) {
        scheduleBotTurn(room, code, nextPlayer);
      } else if (room.settings.wordTimer) {
        startTimer(code, WORD_TIMER_SECS, 'words');
      }
    }
  });

  // ── CAST VOTE ──
  socket.on('vote:cast', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'playing' || room.subPhase !== 'vote') return;
    if (room.players[name]?.eliminated) return;

    const rk = `round${room.round}`;
    if (!room.votes[rk]) room.votes[rk] = {};
    room.votes[rk][name] = target;
    room.players[name].voted = true;
    broadcastRoom(code);

    // Trigger any bots that haven't voted yet (in case scheduleBotVotes missed them)
    const aliveBots = getAlive(room).filter(n => room.players[n]?.isBot && !room.players[n]?.voted);
    aliveBots.forEach((botName, i) => {
      setTimeout(() => {
        if (room.phase === 'playing' && room.subPhase === 'vote' && !room.players[botName]?.voted) {
          botCastVote(room, code, botName);
        }
      }, 600 + i * 800);
    });

    // Only tally if no bots still pending (bots will call tallyVotes when they finish)
    const pendingBots = getAlive(room).filter(n => room.players[n]?.isBot && !room.players[n]?.voted);
    if (pendingBots.length === 0) {
      tallyVotes(room, code);
    }
  });

  // ── HOST OVERRIDE ELIMINATE ──
  socket.on('vote:eliminate', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    if (!room.players[target] || room.players[target].eliminated) return;
    clearTimer(code);
    eliminatePlayer(room, target, code);
  });

  // ── HOST BREAKS TIE ──
  socket.on('vote:tiebreak', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    eliminatePlayer(room, target, code);
  });

  // ── MR WHITE GUESS ──
  socket.on('mrwhite:guess', ({ guess }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || !room.mrWhiteGuessPhase) return;
    room.mrWhiteGuessPhase = false;
    const isCorrect = guess.toLowerCase().trim() === room.wordPair?.civilian?.toLowerCase().trim();
    endGame(room, code, isCorrect ? 'mrwhite-wins' : 'civilians-win');
  });

  // ── RESET ──
  socket.on('game:reset', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    clearTimer(code);
    room.phase = 'lobby'; room.assignments = {}; room.wordPair = null;
    room.words = {}; room.votes = {}; room.accusations = {}; room.round = 1;
    room.mrWhiteGuessPhase = false; room.subPhase = 'words'; room.turnOrder = [];
    room.timerEnd = null; room.timerPhase = null;
    // Remove spectators from players, keep real players
    Object.keys(room.players).forEach(p => {
      if (room.players[p].isSpectator) { delete room.players[p]; }
      else { room.players[p].ready = room.players[p].isBot || false; room.players[p].eliminated = false; room.players[p].voted = false; }
    });
    room.spectators = [];
    broadcastRoom(code);
  });

  // ── UPDATE SETTINGS (host only) ──
  socket.on('settings:update', (settings) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    room.settings = { ...room.settings, ...settings };
    broadcastRoom(code);
  });


  // ── ADD BOT ──
  socket.on('bot:add', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name || room.phase !== 'lobby') return;
    if (Object.keys(room.players).length >= 10) return socket.emit('error', 'Salle pleine !');
    const botName = pickBotName(room);
    room.players[botName] = { socketId: null, connected: true, eliminated: false, ready: true, voted: false, isSpectator: false, isBot: true };
    if (!room.scores[botName]) room.scores[botName] = { wins: 0 };
    broadcastRoom(code);
    io.to(code).emit('toast', `🤖 ${botName} a rejoint la salle !`);
  });

  // ── REMOVE BOT ──
  socket.on('bot:remove', ({ botName }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name || room.phase !== 'lobby') return;
    if (!room.players[botName]?.isBot) return;
    delete room.players[botName];
    broadcastRoom(code);
    io.to(code).emit('toast', `🤖 ${botName} a quitté la salle`);
  });

  // ══════════════════════════════════════
  //  WEBRTC SIGNALING (relay only)
  // ══════════════════════════════════════

  socket.on('rtc:offer', ({ to, offer }) => {
    const { name, code } = socket.data || {};
    const target = [...io.sockets.sockets.values()].find(s => s.data?.name === to && s.data?.code === code);
    if (target) target.emit('rtc:offer', { from: name, offer });
  });

  socket.on('rtc:answer', ({ to, answer }) => {
    const { name, code } = socket.data || {};
    const target = [...io.sockets.sockets.values()].find(s => s.data?.name === to && s.data?.code === code);
    if (target) target.emit('rtc:answer', { from: name, answer });
  });

  socket.on('rtc:ice', ({ to, candidate }) => {
    const { name, code } = socket.data || {};
    const target = [...io.sockets.sockets.values()].find(s => s.data?.name === to && s.data?.code === code);
    if (target) target.emit('rtc:ice', { from: name, candidate });
  });

  socket.on('rtc:ready', () => {
    const { name, code } = socket.data || {};
    if (name && code) socket.to(code).emit('rtc:peer_joined', { name });
  });

  socket.on('rtc:leave', () => {
    const { name, code } = socket.data || {};
    if (name && code) socket.to(code).emit('rtc:peer_left', { name });
  });

});

// ═══════════════════════════════
//  GAME LOGIC
// ═══════════════════════════════
function eliminatePlayer(room, target, code) {
  if (!room.players[target]) return;
  room.players[target].eliminated = true;
  const role = room.assignments[target]?.role;

  // Emit elimination event WITH role (for animation) but only AFTER a short delay so it's dramatic
  io.to(code).emit('player:eliminated', { name: target, role });

  const alive = getAlive(room);
  const aliveRoles = alive.map(n => room.assignments[n]?.role);
  const undercoverCount = aliveRoles.filter(r => r === 'undercover').length;
  const mrWhiteAlive = aliveRoles.includes('mr-white');
  const civilianCount = aliveRoles.filter(r => r === 'civilian').length;

  clearTimer(code);

  if (role === 'undercover') {
    if (undercoverCount > 0) {
      // Still undercouvers alive
      nextRound(room, code);
    } else if (mrWhiteAlive) {
      room.mrWhiteGuessPhase = true;
      broadcastRoom(code);
      const mrwName = Object.entries(room.assignments).find(([,a]) => a.role === 'mr-white')?.[0];
      findSocket(mrwName, code)?.emit('mrwhite:your_turn');
    } else {
      endGame(room, code, 'civilians-win');
    }
  } else if (role === 'mr-white') {
    if (undercoverCount > 0) { nextRound(room, code); }
    else { endGame(room, code, 'civilians-win'); }
  } else {
    // Civilian eliminated
    if (undercoverCount === 0 && !mrWhiteAlive) { endGame(room, code, 'civilians-win'); }
    else if (civilianCount <= undercoverCount) {
      endGame(room, code, undercoverCount > 0 ? 'undercover-wins' : 'mrwhite-wins');
    } else {
      nextRound(room, code);
    }
  }
}

function nextRound(room, code) {
  room.round++;
  room.subPhase = 'words';
  room.currentTurnIndex = 0;
  room.subPhase = 'words';
  const rk = `round${room.round}`;
  room.words[rk] = {};
  room.votes[rk] = {};
  Object.keys(room.players).forEach(p => { room.players[p].voted = false; room.players[p].ready = room.players[p].isBot || room.players[p].isSpectator || room.players[p].ready; });
  broadcastRoom(code);
  // Announce who goes first this round
  const aliveTurnOrder = room.turnOrder.filter(n => !room.players[n]?.eliminated && room.players[n]?.connected);
  const firstPlayer = aliveTurnOrder[0];
  if (firstPlayer) io.to(code).emit('turn:next', { player: firstPlayer });
  if (firstPlayer && room.players[firstPlayer]?.isBot) {
    scheduleBotTurn(room, code, firstPlayer);
  } else if (room.settings?.wordTimer) {
    startTimer(code, WORD_TIMER_SECS, 'words');
  }
}

function endGame(room, code, outcome) {
  room.phase = 'result';
  room.result = { outcome };

  // Update scores
  const asgn = room.assignments || {};
  if (outcome === 'civilians-win') {
    Object.entries(asgn).forEach(([n, a]) => {
      if (a.role === 'civilian' && room.players[n] && !room.players[n].eliminated) {
        if (!room.scores[n]) room.scores[n] = { wins: 0 };
        room.scores[n].wins++;
      }
    });
  } else if (outcome === 'undercover-wins') {
    Object.entries(asgn).forEach(([n, a]) => {
      if (a.role === 'undercover') {
        if (!room.scores[n]) room.scores[n] = { wins: 0 };
        room.scores[n].wins++;
      }
    });
  } else if (outcome === 'mrwhite-wins') {
    Object.entries(asgn).forEach(([n, a]) => {
      if (a.role === 'mr-white') {
        if (!room.scores[n]) room.scores[n] = { wins: 0 };
        room.scores[n].wins++;
      }
    });
  }

  broadcastRoom(code);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Undercover Anime backend on port ${PORT}`);
  // Note: anti-sleep ping is handled client-side
});
