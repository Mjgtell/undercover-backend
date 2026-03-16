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
//  HELPERS
// ═══════════════════════════════
function getBlockedWords(characterName) {
  if (!characterName) return [];
  return characterName.toLowerCase()
    .replace(/[^a-zàâäéèêëîïôùûü\s]/gi, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

const CHARACTER_IMAGES = {
  'Naruto Uzumaki': 'https://static.wikia.nocookie.net/naruto/images/d/d6/Naruto_Part_2.png',
  'Izuku Midoriya': 'https://static.wikia.nocookie.net/bokunoheroacademia/images/5/58/Izuku_Midoriya_Full_Body_Hero_Costume.png',
  'Tanjiro Kamado': 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/1/10/Tanjiro_Kamado_Anime.png',
  'Yusuke Urameshi': 'https://static.wikia.nocookie.net/yuyu-hakusho/images/8/89/Yusuke_urameshi.jpg',
  'Sasuke Uchiha': 'https://static.wikia.nocookie.net/naruto/images/2/21/Sasuke_Part_2.png',
  'Vegeta': 'https://static.wikia.nocookie.net/dragonball/images/b/b5/Vegeta_DB_Super.png',
  'Levi Ackerman': 'https://static.wikia.nocookie.net/shingekinokyojin/images/1/1f/Levi_Ackerman_Anime.png',
  'Killua Zoldyck': 'https://static.wikia.nocookie.net/hunterxhunter/images/b/b4/Killua_Zoldyck_2011.png',
  'Monkey D. Luffy': 'https://static.wikia.nocookie.net/onepiece/images/6/6d/Monkey_D._Luffy_Anime_Pre_Timeskip_Infobox.png',
  'Gon Freecss': 'https://static.wikia.nocookie.net/hunterxhunter/images/b/b8/Gon_Freecss_2011.png',
  'Gojo Satoru': 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/d/d4/Satoru_Gojo_Anime.png',
  'Saitama': 'https://static.wikia.nocookie.net/onepunchman/images/5/59/Saitama_Anime.png',
  'Eren Yeager': 'https://static.wikia.nocookie.net/shingekinokyojin/images/8/83/Eren_Yeager_Anime.png',
  'Kaneki Ken': 'https://static.wikia.nocookie.net/tokyoghoul/images/6/6b/Ken_Kaneki_Anime.png',
  'Itachi Uchiha': 'https://static.wikia.nocookie.net/naruto/images/b/bb/Itachi.png',
  'Aizen Sosuke': 'https://static.wikia.nocookie.net/bleach/images/e/ef/Sosuke_Aizen_Anime.png',
  'Yuji Itadori': 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/c/cb/Yuji_Itadori_Anime.png',
  'Denji': 'https://static.wikia.nocookie.net/chainsaw-man/images/4/4f/Denji_Anime.png',
  'Edward Elric': 'https://static.wikia.nocookie.net/fma/images/1/10/Ed_Elric_FMA.png',
  'Asta': 'https://static.wikia.nocookie.net/blackclover/images/0/06/Asta_Anime.png',
  'Ryomen Sukuna': 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/f/fc/Ryomen_Sukuna_Anime.png',
  'Muzan Kibutsuji': 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/c/cc/Muzan_Kibutsuji_Anime.png',
  'Natsu Dragneel': 'https://static.wikia.nocookie.net/fairytail/images/1/11/Natsu_Dragneel_Anime.png',
  'Portgas D. Ace': 'https://static.wikia.nocookie.net/onepiece/images/7/70/Portgas_D._Ace_Anime_Infobox.png',
  'Kakashi Hatake': 'https://static.wikia.nocookie.net/naruto/images/2/27/Kakashi_Hatake.png',
  'Aizawa Shouta': 'https://static.wikia.nocookie.net/bokunoheroacademia/images/c/c6/Shota_Aizawa_Full_Body_Hero_Costume.png',
  'Kirito': 'https://static.wikia.nocookie.net/swordartonline/images/3/34/Kirito_SAO_Aincrad.png',
  'Bell Cranel': 'https://static.wikia.nocookie.net/dungeoni/images/0/02/Bell_Cranel_Anime.png',
  'Subaru Natsuki': 'https://static.wikia.nocookie.net/rezero/images/7/72/Subaru_Natsuki_Anime.png',
  'Naofumi Iwatani': 'https://static.wikia.nocookie.net/shieldhero/images/3/36/Naofumi_Anime.png',
  'Ainz Ooal Gown': 'https://static.wikia.nocookie.net/overlordmaruyama/images/1/11/Ainz_Ooal_Gown_Anime.png',
  'Lelouch vi Britannia': 'https://static.wikia.nocookie.net/codegeass/images/0/00/Lelouch_lamperouge_anime.png',
  'Zero Two': 'https://static.wikia.nocookie.net/darlinginthefranxx/images/9/9e/Zero_Two_Anime.png',
  'Violet Evergarden': 'https://static.wikia.nocookie.net/violet-evergarden/images/3/3b/Violet_Evergarden_Anime.png',
  'Rudeus Greyrat': 'https://static.wikia.nocookie.net/mushokutensei/images/4/48/Rudeus_Greyrat_Anime.png',
  'Rimuru Tempest': 'https://static.wikia.nocookie.net/tensura/images/2/27/Rimuru_Tempest_Anime.png',
  'Holo': 'https://static.wikia.nocookie.net/spice-and-wolf/images/4/41/HoloAnime.png',
  'Raphtalia': 'https://static.wikia.nocookie.net/shieldhero/images/8/8f/Raphtalia_Anime.png',
  'Shiroe': 'https://static.wikia.nocookie.net/loghorizon/images/5/57/Shiroe_Anime.png',
  'Sora': 'https://static.wikia.nocookie.net/ngnl/images/6/67/Sora_Anime.png',
  'Rem': 'https://static.wikia.nocookie.net/rezero/images/d/d6/Rem_Anime.png',
  'Aqua': 'https://static.wikia.nocookie.net/konosuba/images/7/7c/Aqua_Anime.png',
  'Saber': 'https://static.wikia.nocookie.net/typemoon/images/4/42/Saber_anime.png',
  'Erza Scarlet': 'https://static.wikia.nocookie.net/fairytail/images/5/56/Erza_Scarlet_Anime.png',
  'Kazuma Sato': 'https://static.wikia.nocookie.net/konosuba/images/6/6f/Kazuma_Anime.png',
  'Hajime Nagumo': 'https://static.wikia.nocookie.net/arifureta/images/b/bd/Hajime_Nagumo_Anime.png',
  'L Lawliet': 'https://static.wikia.nocookie.net/deathnote/images/e/e0/L_lawliet_anime.png',
  'Shikamaru Nara': 'https://static.wikia.nocookie.net/naruto/images/9/9a/Shikamaru_Part_II.png',
  'Griffith': 'https://static.wikia.nocookie.net/berserk/images/2/24/Griffith_Anime.png',
  'Zoro': 'https://static.wikia.nocookie.net/onepiece/images/d/d1/Roronoa_Zoro_Anime_Pre_Timeskip_Infobox.png',
  'Guts': 'https://static.wikia.nocookie.net/berserk/images/8/82/Guts_Anime.png',
  'Shigaraki Tomura': 'https://static.wikia.nocookie.net/bokunoheroacademia/images/5/54/Tomura_Shigaraki_Anime.png',
  'Megumi Fushiguro': 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/9/96/Megumi_Fushiguro_Anime.png',
  'Byakuya Kuchiki': 'https://static.wikia.nocookie.net/bleach/images/4/4b/Byakuya_Kuchiki_Anime.png',
  'Roy Mustang': 'https://static.wikia.nocookie.net/fma/images/c/c7/Roy_mustang_anime.png',
  'Endeavor': 'https://static.wikia.nocookie.net/bokunoheroacademia/images/0/07/Endeavor_Anime.png',
  'Mikasa Ackerman': 'https://static.wikia.nocookie.net/shingekinokyojin/images/e/e6/Mikasa_Ackerman_Anime.png',
  'Motoko Kusanagi': 'https://static.wikia.nocookie.net/ghostintheshell/images/9/9e/Motoko_kusanagi.jpg',
  'Giyu Tomioka': 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/6/6a/Giyu_Tomioka_Anime.png',
  'Neji Hyuga': 'https://static.wikia.nocookie.net/naruto/images/5/5e/Neji_Part_II.png',
  'Mob': 'https://static.wikia.nocookie.net/mob-psycho-100/images/8/86/Mob_Anime.png',
  'Tatsumaki': 'https://static.wikia.nocookie.net/onepunchman/images/f/f9/Tatsumaki_Anime.png',
  'Accelerator': 'https://static.wikia.nocookie.net/toarumajutsunoindex/images/5/5a/Accelerator_Anime.png',
  'Hisoka Morow': 'https://static.wikia.nocookie.net/hunterxhunter/images/2/29/Hisoka_Morow_2011.png',
  'Taiga Aisaka': 'https://static.wikia.nocookie.net/toradora/images/c/c3/Taiga_Aisaka_Anime.png',
  'Erina Nakiri': 'https://static.wikia.nocookie.net/shokugekinosoma/images/9/95/Erina_Nakiri_Anime.png',
  'Hachiman Hikigaya': 'https://static.wikia.nocookie.net/oregairu/images/5/56/Hachiman_Hikigaya_Anime.png',
  'Rei Kiriyama': 'https://static.wikia.nocookie.net/sangatsunonlion/images/6/6e/Rei_Kiriyama_Anime.png',
  'Kousei Arima': 'https://static.wikia.nocookie.net/yourlieinapril/images/3/30/Kousei_Arima_Anime.png',
  'Shinichi Chiaki': 'https://static.wikia.nocookie.net/nodame-cantabile/images/c/c4/Nodame_Cantabile_Chiaki.jpg',
  'Shouko Nishimiya': 'https://static.wikia.nocookie.net/koenokatachi/images/a/ab/Shoko_Nishimiya_Anime.png',
  'Mei Tachibana': 'https://static.wikia.nocookie.net/sukitte-iinayo/images/1/1c/Mei_Tachibana_Anime.png',
  'Shoya Ishida': 'https://static.wikia.nocookie.net/koenokatachi/images/3/3e/Shoya_Ishida_Anime.png',
  'Takeo Goda': 'https://static.wikia.nocookie.net/ore-monogatari/images/4/4e/Takeo_Goda_Anime.png',
  'Kaori Miyazono': 'https://static.wikia.nocookie.net/yourlieinapril/images/9/9a/Kaori_Miyazono_Anime.png',
  'Menma': 'https://static.wikia.nocookie.net/anohana/images/2/2b/Menma_Anime.png',
  'Tohru Honda': 'https://static.wikia.nocookie.net/fruits-basket/images/7/76/Tohru_Honda_Anime.png',
  'Oreki Houtarou': 'https://static.wikia.nocookie.net/hyouka/images/4/4f/Oreki_Houtarou_Anime.png',
  'Miyamura Izumi': 'https://static.wikia.nocookie.net/horimiya/images/2/29/Izumi_Miyamura_Anime.png',
  'Nishikata': 'https://static.wikia.nocookie.net/takagi-san/images/5/52/Nishikata_Anime.png',
  'Yor Forger': 'https://static.wikia.nocookie.net/spyfamily/images/e/e7/Yor_Forger_Anime.png',
  'Himeno': 'https://static.wikia.nocookie.net/chainsaw-man/images/b/b4/Himeno_Anime.png',
  'Kaguya Shinomiya': 'https://static.wikia.nocookie.net/kaguyasama/images/4/4b/Kaguya_Shinomiya_Anime.png',
  'Yukino Yukinoshita': 'https://static.wikia.nocookie.net/oregairu/images/e/e5/Yukino_Yukinoshita_Anime.png',
  'Shoyo Hinata': 'https://static.wikia.nocookie.net/haikyuu/images/d/df/Shoyo_Hinata_Anime.png',
  'Tetsuya Kuroko': 'https://static.wikia.nocookie.net/kurokonobasuke/images/5/5c/Tetsuya_Kuroko_Anime.png',
  'Tobio Kageyama': 'https://static.wikia.nocookie.net/haikyuu/images/e/e6/Tobio_Kageyama_Anime.png',
  'Seijuro Akashi': 'https://static.wikia.nocookie.net/kurokonobasuke/images/6/6e/Seijuro_Akashi_Anime.png',
  'Yoichi Isagi': 'https://static.wikia.nocookie.net/blue-lock/images/4/45/Yoichi_Isagi_Anime.png',
  'Ryota Kise': 'https://static.wikia.nocookie.net/kurokonobasuke/images/1/14/Ryota_Kise_Anime.png',
  'Ippo Makunouchi': 'https://static.wikia.nocookie.net/hajimenoippo/images/5/5e/Ippo_Makunouchi_Anime.png',
  'Joe Yabuki': 'https://static.wikia.nocookie.net/ashitanojoe/images/4/4f/Joe_Yabuki_Anime.png',
  'Ryoma Echizen': 'https://static.wikia.nocookie.net/princeoftennis/images/f/f2/Ryoma_Echizen_Anime.png',
  'Eiichirou Maruo': 'https://static.wikia.nocookie.net/babysteps/images/3/3a/Eiichiro_Maruo_Anime.png',
  'Takenori Akagi': 'https://static.wikia.nocookie.net/slamdunk/images/6/66/Takenori_Akagi_Anime.png',
  'Ushijima Wakatoshi': 'https://static.wikia.nocookie.net/haikyuu/images/0/0e/Ushijima_Wakatoshi_Anime.png',
  'Eijun Sawamura': 'https://static.wikia.nocookie.net/diamondnoace/images/3/32/Eijun_Sawamura_Anime.png',
  'Furuya Satoru': 'https://static.wikia.nocookie.net/diamondnoace/images/f/f7/Satoru_Furuya_Anime.png',
  'Light Yagami': 'https://static.wikia.nocookie.net/deathnote/images/9/97/Light_Yagami_Anime.png',
  'Jotaro Kujo': 'https://static.wikia.nocookie.net/jojo/images/1/1d/Jotaro_Kujo_Anime.png',
  'Giorno Giovanna': 'https://static.wikia.nocookie.net/jojo/images/6/61/Giorno_Giovanna_Anime.png',
  'Spike Spiegel': 'https://static.wikia.nocookie.net/cowboybebop/images/5/5c/Spike_Spiegel_Anime.png',
  'Vash the Stampede': 'https://static.wikia.nocookie.net/trigun/images/3/38/Vash_the_Stampede_Anime.png',
  'Thorfinn': 'https://static.wikia.nocookie.net/vinlandsaga/images/b/ba/Thorfinn_Anime.png',
  'Senku Ishigami': 'https://static.wikia.nocookie.net/dr-stone/images/a/a3/Senku_Ishigami_Anime.png',
  'Ayanokoji Kiyotaka': 'https://static.wikia.nocookie.net/youkososhitsusei/images/1/1a/Kiyotaka_Ayanokouji_Anime.png',
  'Rintaro Okabe': 'https://static.wikia.nocookie.net/steins-gate/images/6/68/Rintaro_Okabe_Anime.png',
  'Makoto Naegi': 'https://static.wikia.nocookie.net/danganronpa/images/c/c1/Makoto_Naegi_Anime.png',
  'Shinji Ikari': 'https://static.wikia.nocookie.net/evangelion/images/f/f8/Shinji_Ikari_Anime.png',
  'Homura Akemi': 'https://static.wikia.nocookie.net/madoka-magica/images/8/8f/Homura_Akemi_Anime.png',
  'Satsuki Kiryuin': 'https://static.wikia.nocookie.net/kill-la-kill/images/1/17/Satsuki_Kiryuin_Anime.png',
  'Yato': 'https://static.wikia.nocookie.net/noragami/images/9/97/Yato_Anime.png',
  'Revy': 'https://static.wikia.nocookie.net/blacklagoon/images/b/b3/Revy_Anime.png',
  'Mahito': 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/d/d4/Mahito_Anime.png',
  'Hiei': 'https://static.wikia.nocookie.net/yuyu-hakusho/images/5/55/Hiei_Anime.png',
  'Hanamichi Sakuragi': 'https://static.wikia.nocookie.net/slamdunk/images/8/82/Hanamichi_Sakuragi_Anime.png',
  'Noya Libero': 'https://static.wikia.nocookie.net/haikyuu/images/9/9b/Yu_Nishinoya_Anime.png',
  'Reo Mikage': 'https://static.wikia.nocookie.net/blue-lock/images/8/84/Reo_Mikage_Anime.png',
  'Seishiro Nagi': 'https://static.wikia.nocookie.net/blue-lock/images/c/c3/Seishiro_Nagi_Anime.png',
  'Yuri Katsuki': 'https://static.wikia.nocookie.net/yurionice/images/b/b1/Yuri_Katsuki_Anime.png',
  'Rengoku': 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/d/d0/Kyojuro_Rengoku_Anime.png',
  'Shinra Kusakabe': 'https://static.wikia.nocookie.net/fire-force/images/b/b3/Shinra_Kusakabe_Anime.png',
  'Wataru Kuramochi': 'https://static.wikia.nocookie.net/diamondnoace/images/9/9a/Wataru_Kuramochi_Anime.png',
  'Usagi Tsukino': 'https://static.wikia.nocookie.net/sailormoon/images/b/b7/Sailor_Moon_Anime.png',
  'Nanoha Takamachi': 'https://static.wikia.nocookie.net/magicalgirllyricalnanoha/images/6/6f/Nanoha_Takamachi_Anime.png',
  'Gaara': 'https://static.wikia.nocookie.net/naruto/images/5/52/Gaara_Part_II.png',
  'Jiraiya': 'https://static.wikia.nocookie.net/naruto/images/8/88/Jiraiya_Infobox.png',
  'Minato Namikaze': 'https://static.wikia.nocookie.net/naruto/images/9/9c/Minato_Namikaze.png',
  'Madara Uchiha': 'https://static.wikia.nocookie.net/naruto/images/7/72/Madara_Uchiha.png',
  'Obito Uchiha': 'https://static.wikia.nocookie.net/naruto/images/c/c3/Obito_Uchiha.png',
  'Sanji': 'https://static.wikia.nocookie.net/onepiece/images/c/c5/Sanji_Anime_Post_Timeskip_Infobox.png',
  'Nami': 'https://static.wikia.nocookie.net/onepiece/images/d/d7/Nami_Anime_Post_Timeskip_Infobox.png',
  'Trafalgar Law': 'https://static.wikia.nocookie.net/onepiece/images/5/5a/Trafalgar_D._Water_Law_Anime_Infobox.png',
  'Shanks': 'https://static.wikia.nocookie.net/onepiece/images/e/ee/Shanks_Anime_Infobox.png',
  'Boa Hancock': 'https://static.wikia.nocookie.net/onepiece/images/5/55/Boa_Hancock_Anime_Infobox.png',
  'Goku': 'https://static.wikia.nocookie.net/dragonball/images/5/5b/Goku_Anime_Infobox.png',
  'Gohan': 'https://static.wikia.nocookie.net/dragonball/images/6/6d/Gohan_Anime_Infobox.png',
  'Piccolo': 'https://static.wikia.nocookie.net/dragonball/images/3/37/Piccolo_Anime_Infobox.png',
  'Trunks': 'https://static.wikia.nocookie.net/dragonball/images/9/9e/Future_Trunks_Anime_Infobox.png',
  'Frieza': 'https://static.wikia.nocookie.net/dragonball/images/2/2e/Frieza_Anime_Infobox.png',
  'Armin Arlert': 'https://static.wikia.nocookie.net/shingekinokyojin/images/e/e8/Armin_Arlert_Anime.png',
  'Erwin Smith': 'https://static.wikia.nocookie.net/shingekinokyojin/images/5/51/Erwin_Smith_Anime.png',
  'Hange Zoe': 'https://static.wikia.nocookie.net/shingekinokyojin/images/3/3f/Hange_Zoe_Anime.png',
  'Katsuki Bakugo': 'https://static.wikia.nocookie.net/bokunoheroacademia/images/9/9b/Katsuki_Bakugo_Full_Body_Hero_Costume.png',
  'Shoto Todoroki': 'https://static.wikia.nocookie.net/bokunoheroacademia/images/a/aa/Shoto_Todoroki_Full_Body_Hero_Costume.png',
  'Hawks': 'https://static.wikia.nocookie.net/bokunoheroacademia/images/a/a6/Hawks_Anime.png',
  'Zenitsu Agatsuma': 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/0/01/Zenitsu_Agatsuma_Anime.png',
  'Inosuke Hashibira': 'https://static.wikia.nocookie.net/kimetsu-no-yaiba/images/f/fb/Inosuke_Hashibira_Anime.png',
  'Nobara Kugisaki': 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/3/39/Nobara_Kugisaki_Anime.png',
  'Nanami Kento': 'https://static.wikia.nocookie.net/jujutsu-kaisen/images/4/44/Kento_Nanami_Anime.png',
  'Kurapika': 'https://static.wikia.nocookie.net/hunterxhunter/images/c/c9/Kurapika_2011.png',
  'Leorio': 'https://static.wikia.nocookie.net/hunterxhunter/images/9/9d/Leorio_Paradinight_2011.png',
  'Meruem': 'https://static.wikia.nocookie.net/hunterxhunter/images/8/8a/Meruem_2011.png',
  'Alphonse Elric': 'https://static.wikia.nocookie.net/fma/images/2/2c/Alphonse_Elric_Anime.png',
  'Riza Hawkeye': 'https://static.wikia.nocookie.net/fma/images/6/61/Riza_Hawkeye_Anime.png',
  'Greed': 'https://static.wikia.nocookie.net/fma/images/4/42/Greed_Anime.png',
  'King Bradley': 'https://static.wikia.nocookie.net/fma/images/8/8b/King_Bradley_Anime.png',
  'Ichigo Kurosaki': 'https://static.wikia.nocookie.net/bleach/images/3/39/Ichigo_Kurosaki_Anime.png',
  'Rukia Kuchiki': 'https://static.wikia.nocookie.net/bleach/images/c/c6/Rukia_Kuchiki_Anime.png',
  'Kenpachi Zaraki': 'https://static.wikia.nocookie.net/bleach/images/5/5d/Kenpachi_Zaraki_Anime.png',
  'Uryuu Ishida': 'https://static.wikia.nocookie.net/bleach/images/9/9e/Uryuu_Ishida_Anime.png',
  'Gray Fullbuster': 'https://static.wikia.nocookie.net/fairytail/images/6/60/Gray_Fullbuster_Anime.png',
  'Lucy Heartfilia': 'https://static.wikia.nocookie.net/fairytail/images/d/d4/Lucy_Heartfilia_Anime.png',
  'Touka Kirishima': 'https://static.wikia.nocookie.net/tokyoghoul/images/7/7c/Touka_Kirishima_Anime.png',
  'Ryuk': 'https://static.wikia.nocookie.net/deathnote/images/4/42/Ryuk_Anime.png',
  'Misa Amane': 'https://static.wikia.nocookie.net/deathnote/images/8/87/Misa_Amane_Anime.png',
  'Genos': 'https://static.wikia.nocookie.net/onepunchman/images/4/48/Genos_Anime.png',
  'Bang': 'https://static.wikia.nocookie.net/onepunchman/images/7/73/Bang_Anime.png',
  'Reigen': 'https://static.wikia.nocookie.net/mob-psycho-100/images/9/9e/Reigen_Anime.png',
  'Power': 'https://static.wikia.nocookie.net/chainsaw-man/images/5/5a/Power_Anime.png',
  'Makima': 'https://static.wikia.nocookie.net/chainsaw-man/images/8/8c/Makima_Anime.png',
  'Aki Hayakawa': 'https://static.wikia.nocookie.net/chainsaw-man/images/6/6c/Aki_Hayakawa_Anime.png',
  'Dio Brando': 'https://static.wikia.nocookie.net/jojo/images/9/91/Dio_Anime.png',
  'Yoshikage Kira': 'https://static.wikia.nocookie.net/jojo/images/4/43/Yoshikage_Kira_Anime.png',
  'Casca': 'https://static.wikia.nocookie.net/berserk/images/6/6c/Casca_Anime.png',
  'Askeladd': 'https://static.wikia.nocookie.net/vinlandsaga/images/3/3a/Askeladd_Anime.png',
  'Faye Valentine': 'https://static.wikia.nocookie.net/cowboybebop/images/4/4b/Faye_Valentine_Anime.png',
  'Alucard': 'https://static.wikia.nocookie.net/hellsing/images/5/57/Alucard_Anime.png',
  'Rei Ayanami': 'https://static.wikia.nocookie.net/evangelion/images/b/b7/Rei_Ayanami_Anime.png',
  'Asuka Langley': 'https://static.wikia.nocookie.net/evangelion/images/3/37/Asuka_Langley_Anime.png',
  'Misato Katsuragi': 'https://static.wikia.nocookie.net/evangelion/images/6/6e/Misato_Katsuragi_Anime.png',
  'Asuna': 'https://static.wikia.nocookie.net/swordartonline/images/d/d6/Asuna_SAO_Aincrad.png',
  'Emilia': 'https://static.wikia.nocookie.net/rezero/images/4/43/Emilia_Anime.png',
  'Darkness': 'https://static.wikia.nocookie.net/konosuba/images/5/58/Darkness_Anime.png',
  'Albedo': 'https://static.wikia.nocookie.net/overlordmaruyama/images/c/c5/Albedo_Anime.png',
  'Milim': 'https://static.wikia.nocookie.net/tensura/images/7/74/Milim_Anime.png',
  'Tsukasa Shishio': 'https://static.wikia.nocookie.net/dr-stone/images/8/87/Tsukasa_Shishio_Anime.png',
  'Yami Sukehiro': 'https://static.wikia.nocookie.net/blackclover/images/4/45/Yami_Sukehiro_Anime.png',
  'Hestia': 'https://static.wikia.nocookie.net/dungeoni/images/6/61/Hestia_Anime.png',
  'Ryuji Takasu': 'https://static.wikia.nocookie.net/toradora/images/8/87/Ryuji_Takasu_Anime.png',
  'Miyuki Shirogane': 'https://static.wikia.nocookie.net/kaguyasama/images/6/66/Miyuki_Shirogane_Anime.png',
  'Loid Forger': 'https://static.wikia.nocookie.net/spyfamily/images/4/40/Loid_Forger_Anime.png',
  'Anya Forger': 'https://static.wikia.nocookie.net/spyfamily/images/0/09/Anya_Forger_Anime.png',
  'Simon': 'https://static.wikia.nocookie.net/gurrenlagann/images/4/4e/Simon_Anime.png',
  'Shinya Kogami': 'https://static.wikia.nocookie.net/psychopass/images/3/3e/Shinya_Kogami_Anime.png',
  'C.C.': 'https://static.wikia.nocookie.net/codegeass/images/9/9d/C.C._anime.png',
};


const PAIRS = {
  shonen: [
    { civilian:'Naruto Uzumaki', undercovers:['Izuku Midoriya','Gon Freecss','Monkey D. Luffy','Asta','Edward Elric'], hint:'Héros rejetés devenus symboles d\'espoir' },
    { civilian:'Levi Ackerman', undercovers:['Killua Zoldyck','Hiei','Zoro','Mikasa Ackerman','Guts'], hint:'Combattants froids à la vitesse surhumaine' },
    { civilian:'Sasuke Uchiha', undercovers:['Vegeta','Hiei','Byakuya Kuchiki','Neji Hyuga','Griffith'], hint:'Rivaux orgueilleux obsédés par la puissance' },
    { civilian:'Gojo Satoru', undercovers:['Saitama','Accelerator','Aizen Sosuke','Naruto Uzumaki','Lelouch vi Britannia'], hint:'Les plus forts de leur monde, détachés' },
    { civilian:'Eren Yeager', undercovers:['Kaneki Ken','Shigaraki Tomura','Denji','Yuji Itadori','Griffith'], hint:'Jeunes hommes consumés par leur propre monstre' },
    { civilian:'Itachi Uchiha', undercovers:['Aizen Sosuke','Lelouch vi Britannia','Griffith','L Lawliet','Giorno Giovanna'], hint:'Géniaux traîtres au sacrifice calculé' },
    { civilian:'Kakashi Hatake', undercovers:['Aizawa Shouta','Roy Mustang','Giyu Tomioka','Byakuya Kuchiki','Levi Ackerman'], hint:'Profs nonchalants cachant une puissance réelle' },
    { civilian:'Yuji Itadori', undercovers:['Denji','Natsu Dragneel','Asta','Gon Freecss','Monkey D. Luffy'], hint:'Hôtes d\'une entité dévastatrice' },
    { civilian:'Ryomen Sukuna', undercovers:['Muzan Kibutsuji','Aizen Sosuke','Griffith','Itachi Uchiha','Ainz Ooal Gown'], hint:'Rois des démons quasi-immortels' },
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
    { civilian:'Hisoka Morow', undercovers:['Accelerator','Mahito','Griffith','Aizen Sosuke','Jotaro Kujo'], hint:'Antagonistes qui jouent avec leurs proies' },
    { civilian:'Thorfinn', undercovers:['Guts','Zoro','Levi Ackerman','Revy','Spike Spiegel'], hint:'Guerriers brisés en quête de rédemption' },
  ],

  romance: [
    { civilian:'Taiga Aisaka', undercovers:['Erina Nakiri','Kaguya Shinomiya','Yukino Yukinoshita','Satsuki Kiryuin','Himeno'], hint:'Blondes hautaines au cœur tendre caché' },
    { civilian:'Hachiman Hikigaya', undercovers:['Oreki Houtarou','Rei Kiriyama','Ayanokoji Kiyotaka','Shinji Ikari','Nishikata'], hint:'Solitaires intelligents qui observent sans participer' },
    { civilian:'Kousei Arima', undercovers:['Shinichi Chiaki','Rei Kiriyama','Shinji Ikari','Oreki Houtarou','Shoya Ishida'], hint:'Prodiges brisés qui se reconstruisent' },
    { civilian:'Shouko Nishimiya', undercovers:['Mei Tachibana','Tohru Honda','Violet Evergarden','Rem','Menma'], hint:'Filles solitaires qui apprennent la confiance' },
    { civilian:'Kaguya Shinomiya', undercovers:['Yukino Yukinoshita','Taiga Aisaka','Erina Nakiri','Satsuki Kiryuin','Kaguya Shinomiya'], hint:'Héritières froides qui tombent amoureuses malgré leur fierté' },
    { civilian:'Tohru Honda', undercovers:['Rem','Raphtalia','Violet Evergarden','Shouko Nishimiya','Menma'], hint:'Filles lumineuses qui acceptent tout le monde' },
    { civilian:'Miyamura Izumi', undercovers:['Shoya Ishida','Nishikata','Hachiman Hikigaya','Oreki Houtarou','Kousei Arima'], hint:'Garçons introvertis qui s\'ouvrent à une seule personne' },
    { civilian:'Yor Forger', undercovers:['Himeno','Saber','Mikasa Ackerman','Motoko Kusanagi','Erza Scarlet'], hint:'Femmes douces en apparence, tueuses de métier' },
    { civilian:'Kaori Miyazono', undercovers:['Menma','Violet Evergarden','Shouko Nishimiya','Tohru Honda','Rem'], hint:'Filles lumineuses arrachées trop tôt' },
    { civilian:'Oreki Houtarou', undercovers:['Hachiman Hikigaya','Rei Kiriyama','Ayanokoji Kiyotaka','Shinji Ikari','L Lawliet'], hint:'Introvertis économes en énergie mais brillants' },
    { civilian:'Shoya Ishida', undercovers:['Miyamura Izumi','Nishikata','Kousei Arima','Hachiman Hikigaya','Takeo Goda'], hint:'Garçons brisés qui se rachètent par amour sincère' },
    { civilian:'Yukino Yukinoshita', undercovers:['Kaguya Shinomiya','Taiga Aisaka','Erina Nakiri','Satsuki Kiryuin','Yukino Yukinoshita'], hint:'Perfectionnistes froides cachant une vraie sensibilité' },
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
    { civilian:'Giorno Giovanna', undercovers:['Lelouch vi Britannia','Light Yagami','Giorno Giovanna','Ayanokoji Kiyotaka','Ainz Ooal Gown'], hint:'Jeunes au calme glacial qui accèdent au sommet' },
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
  const r = { ...room, players: {}, spectators: room.spectators || [], turnOrder: room.turnOrder || [], currentTurnIndex: room.currentTurnIndex ?? 0, mode: room.mode || 'undercover' };
  // Include tierlist but hide other players' submissions during ranking phase
  if (room.tierlist) {
    r.tierlist = { ...room.tierlist };
    if (room.tierlist.phase === 'ranking') {
      // Only show count of who submitted, not the actual rankings
      r.tierlist.submissions = Object.fromEntries(
        Object.entries(room.tierlist.submissions || {}).map(([k]) => [k, true])
      );
    }
  }
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
//  TIERLIST MODE
// ═══════════════════════════════

const TIERLIST_ANIMES = [
  { title:'Naruto', malId:20 },
  { title:'Naruto Shippuden', malId:1735 },
  { title:'Dragon Ball Z', malId:813 },
  { title:'One Piece', malId:21 },
  { title:'Bleach', malId:269 },
  { title:'Fairy Tail', malId:6702 },
  { title:'Hunter x Hunter (2011)', malId:11061 },
  { title:'Fullmetal Alchemist Brotherhood', malId:5114 },
  { title:'Attack on Titan', malId:16498 },
  { title:'My Hero Academia', malId:31964 },
  { title:'Demon Slayer', malId:38000 },
  { title:'Jujutsu Kaisen', malId:40748 },
  { title:'Black Clover', malId:34235 },
  { title:'Chainsaw Man', malId:44511 },
  { title:'Blue Lock', malId:49596 },
  { title:'Haikyuu!!', malId:20583 },
  { title:'Kuroko no Basket', malId:11771 },
  { title:'Slam Dunk', malId:1254 },
  { title:'Hajime no Ippo', malId:263 },
  { title:'Yu Yu Hakusho', malId:392 },
  { title:'Inuyasha', malId:249 },
  { title:'Dragon Ball', malId:223 },
  { title:'One Punch Man', malId:30276 },
  { title:'Mob Psycho 100', malId:32182 },
  { title:'Tokyo Ghoul', malId:22319 },
  { title:'Sword Art Online', malId:11757 },
  { title:'Berserk', malId:33 },
  { title:'Vinland Saga', malId:37521 },
  { title:'Cowboy Bebop', malId:1 },
  { title:'Death Note', malId:1535 },
  { title:'Code Geass', malId:1575 },
  { title:'Steins;Gate', malId:9253 },
  { title:'Overlord', malId:29803 },
  { title:'Re:Zero', malId:31240 },
  { title:'No Game No Life', malId:19815 },
  { title:'KonoSuba', malId:30831 },
  { title:'Shield Hero', malId:35790 },
  { title:'Mushoku Tensei', malId:39535 },
  { title:'Tensura (Slime)', malId:37430 },
  { title:'Ghost in the Shell', malId:43 },
  { title:'Psycho-Pass', malId:13601 },
  { title:'Black Lagoon', malId:707 },
  { title:'Made in Abyss', malId:34599 },
  { title:'Danganronpa', malId:19761 },
  { title:'Toradora', malId:4224 },
  { title:'Oregairu', malId:14813 },
  { title:'Kaguya-sama', malId:37999 },
  { title:'Horimiya', malId:42897 },
  { title:'Clannad', malId:2167 },
  { title:'AnoHana', malId:9989 },
  { title:'Your Lie in April', malId:23273 },
  { title:'Violet Evergarden', malId:33352 },
  { title:'Fruits Basket', malId:356 },
  { title:'Nana', malId:877 },
  { title:'DanMachi', malId:28121 },
  { title:'Spice and Wolf', malId:2966 },
  { title:'Fate/Zero', malId:10087 },
  { title:'Madoka Magica', malId:9756 },
  { title:'Kill la Kill', malId:18679 },
  { title:'Gurren Lagann', malId:2001 },
  { title:'Neon Genesis Evangelion', malId:30 },
  { title:'Sailor Moon', malId:530 },
  { title:'Yuri on Ice', malId:32995 },
  { title:'Ping Pong the Animation', malId:22135 },
  { title:'JoJo Part 3 - Stardust Crusaders', malId:20899 },
  { title:'JoJo Part 4 - Diamond is Unbreakable', malId:31933 },
  { title:'Noragami', malId:20179 },
  { title:'Fire Force', malId:38671 },
  { title:'Dr. Stone', malId:38691 },
  { title:'Classroom of the Elite', malId:35507 },
  { title:'Seven Deadly Sins', malId:23755 },
  { title:'Tokyo Revengers', malId:45576 },
  { title:'Spy x Family', malId:50265 },
  { title:'Bocchi the Rock', malId:47917 },
  { title:'Oshi no Ko', malId:52034 },
  { title:'Frieren', malId:52991 },
  { title:'Dungeon Meshi', malId:52701 },
];

// Fetch 10 random characters from an anime via Jikan
async function fetchAnimeCharacters(malId) {
  try {
    // Jikan returns top characters by popularity — take first 20 then randomize
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/characters`);
    if (!res.ok) return null;
    const data = await res.json();
    const chars = (data.data || [])
      .filter(c => c.role === 'Main' || c.favorites > 100)
      .slice(0, 30);
    if (chars.length < 5) return null;
    // Shuffle and pick 10
    const shuffled = chars.sort(() => Math.random() - 0.5).slice(0, 10);
    return shuffled.map(c => ({
      name: c.character.name,
      image: c.character.images?.jpg?.image_url || null,
    }));
  } catch(e) {
    console.error('Jikan error:', e.message);
    return null;
  }
}


// ═══════════════════════════════
//  MUSIC RATING MODE
// ═══════════════════════════════

// ═══════════════════════════════
//  HARDCODED MUSIC LISTS
// ═══════════════════════════════

const TOP_OPENINGS = [
  { title:'Gurenge', anime:'Demon Slayer', type:'OP', audioUrl:'https://v.animethemes.moe/KimetsunoYaiba-OP1.ogg' },
  { title:'Again', anime:'Fullmetal Alchemist Brotherhood', type:'OP', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-OP1.ogg' },
  { title:'Silhouette', anime:'Naruto Shippuden', type:'OP', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-OP16.ogg' },
  { title:'Guren no Yumiya', anime:'Attack on Titan', type:'OP', audioUrl:'https://v.animethemes.moe/ShingekinoKyojin-OP1.ogg' },
  { title:'The Hero', anime:'One Punch Man', type:'OP', audioUrl:'https://v.animethemes.moe/OnePunchMan-OP1.ogg' },
  { title:'Odd Future', anime:'My Hero Academia', type:'OP', audioUrl:'https://v.animethemes.moe/BokunoHeroAcademia-OP4.ogg' },
  { title:'Peace Sign', anime:'My Hero Academia', type:'OP', audioUrl:'https://v.animethemes.moe/BokunoHeroAcademia-OP2.ogg' },
  { title:'Pokemon Theme', anime:'Pokemon', type:'OP', audioUrl:'https://v.animethemes.moe/Pokemon-OP1.ogg' },
  { title:'Unravel', anime:'Tokyo Ghoul', type:'OP', audioUrl:'https://v.animethemes.moe/TokyoGhoul-OP1.ogg' },
  { title:'Tank!', anime:'Cowboy Bebop', type:'OP', audioUrl:'https://v.animethemes.moe/CowboyBebop-OP1.ogg' },
  { title:'Bloody Stream', anime:'JoJo Part 2', type:'OP', audioUrl:'https://v.animethemes.moe/JoJonoKimyounaNaBoukenhazimarinoSekaihen-OP2.ogg' },
  { title:'Sono Chi no Sadame', anime:'JoJo Part 1', type:'OP', audioUrl:'https://v.animethemes.moe/JoJonoKimyounaNaBoukenhazimarinoSekaihen-OP1.ogg' },
  { title:'Great Days', anime:'JoJo Part 4', type:'OP', audioUrl:'https://v.animethemes.moe/JoJonoKimyounaNaBoukenDiamondwaKudakenai-OP3.ogg' },
  { title:'Flyers', anime:'Death Parade', type:'OP', audioUrl:'https://v.animethemes.moe/DeathParade-OP1.ogg' },
  { title:'Crossing Field', anime:'Sword Art Online', type:'OP', audioUrl:'https://v.animethemes.moe/SwordArtOnline-OP1.ogg' },
  { title:'Departure', anime:'Hunter x Hunter', type:'OP', audioUrl:'https://v.animethemes.moe/HunterxHunter2011-OP1.ogg' },
  { title:'Colors', anime:'Code Geass', type:'OP', audioUrl:'https://v.animethemes.moe/CodeGeassHangyakunoLelouch-OP1.ogg' },
  { title:'The World', anime:'Death Note', type:'OP', audioUrl:'https://v.animethemes.moe/DeathNote-OP1.ogg' },
  { title:'Cha-La Head-Cha-La', anime:'Dragon Ball Z', type:'OP', audioUrl:'https://v.animethemes.moe/DragonBallZ-OP1.ogg' },
  { title:'Blue Bird', anime:'Naruto Shippuden', type:'OP', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-OP3.ogg' },
  { title:'Silhouette', anime:'Naruto Shippuden', type:'OP', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-OP16.ogg' },
  { title:'GO!!!', anime:'Naruto', type:'OP', audioUrl:'https://v.animethemes.moe/Naruto-OP4.ogg' },
  { title:'Sign', anime:'Naruto Shippuden', type:'OP', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-OP6.ogg' },
  { title:'We Are!', anime:'One Piece', type:'OP', audioUrl:'https://v.animethemes.moe/OnePiece-OP1.ogg' },
  { title:'Kokoro no Chizu', anime:'One Piece', type:'OP', audioUrl:'https://v.animethemes.moe/OnePiece-OP5.ogg' },
  { title:'Fairy Tail Main Theme OP', anime:'Fairy Tail', type:'OP', audioUrl:'https://v.animethemes.moe/FairyTail-OP1.ogg' },
  { title:'Re:Re:', anime:'Erased', type:'OP', audioUrl:'https://v.animethemes.moe/BokuDakegaInaiMachi-OP1.ogg' },
  { title:'99', anime:'Mob Psycho 100', type:'OP', audioUrl:'https://v.animethemes.moe/MobPsycho100-OP1.ogg' },
  { title:'INFERNO', anime:'Fire Force', type:'OP', audioUrl:'https://v.animethemes.moe/EnEnnoShouboutai-OP1.ogg' },
  { title:'Jiyuu no Tsubasa', anime:'Attack on Titan S2', type:'OP', audioUrl:'https://v.animethemes.moe/ShingekinoKyojin2ndSeason-OP1.ogg' },
  { title:'Seishun Kyosokyoku', anime:'Naruto', type:'OP', audioUrl:'https://v.animethemes.moe/Naruto-OP5.ogg' },
  { title:'Boku no Sensou', anime:'Attack on Titan S4', type:'OP', audioUrl:'https://v.animethemes.moe/ShingekinoKyojinTheFinalSeason-OP1.ogg' },
  { title:'Renai Circulation', anime:'Bakemonogatari', type:'OP', audioUrl:'https://v.animethemes.moe/Bakemonogatari-OP4.ogg' },
  { title:'Lion', anime:'Macross Frontier', type:'OP', audioUrl:'https://v.animethemes.moe/MacrossFrontier-OP2.ogg' },
  { title:'Platinum', anime:'Cardcaptor Sakura', type:'OP', audioUrl:'https://v.animethemes.moe/CardcaptorSakura-OP2.ogg' },
  { title:'Catch You Catch Me', anime:'Cardcaptor Sakura', type:'OP', audioUrl:'https://v.animethemes.moe/CardcaptorSakura-OP1.ogg' },
  { title:'Sore ga Ai deshou', anime:'Full Metal Panic Fumoffu', type:'OP', audioUrl:'https://v.animethemes.moe/FullMetalPanicFumoffu-OP1.ogg' },
  { title:'DAYS', anime:'Eureka Seven', type:'OP', audioUrl:'https://v.animethemes.moe/EurekaSevenKokyounoPoetry-OP1.ogg' },
  { title:'Hikari e', anime:'One Piece', type:'OP', audioUrl:'https://v.animethemes.moe/OnePiece-OP6.ogg' },
  { title:'Kimetsu no Yaiba OP2', anime:'Demon Slayer', type:'OP', audioUrl:'https://v.animethemes.moe/KimetsunoYaiba-OP2.ogg' },
  { title:'King Gnu - Specialz', anime:'Jujutsu Kaisen S2', type:'OP', audioUrl:'https://v.animethemes.moe/JujutsuKaisen2ndSeason-OP1.ogg' },
  { title:'Kaikai Kitan', anime:'Jujutsu Kaisen', type:'OP', audioUrl:'https://v.animethemes.moe/JujutsuKaisen-OP1.ogg' },
  { title:'Highest Manga', anime:'Chainsaw Man', type:'OP', audioUrl:'https://v.animethemes.moe/ChainsawMan-OP1.ogg' },
  { title:'W.M.B', anime:'Blue Lock', type:'OP', audioUrl:'https://v.animethemes.moe/BlueLock-OP1.ogg' },
  { title:'KICK BACK', anime:'Chainsaw Man', type:'OP', audioUrl:'https://v.animethemes.moe/ChainsawMan-OP1.ogg' },
  { title:'Cry Baby', anime:'Tokyo Revengers', type:'OP', audioUrl:'https://v.animethemes.moe/TokyoRevengers-OP1.ogg' },
  { title:'Mixed Nuts', anime:'Spy x Family', type:'OP', audioUrl:'https://v.animethemes.moe/SpyxFamily-OP1.ogg' },
  { title:'Subtitle', anime:'Spy x Family S2', type:'OP', audioUrl:'https://v.animethemes.moe/SpyxFamily2ndCour-OP1.ogg' },
  { title:'Aoi Haru', anime:'Blue Lock', type:'OP', audioUrl:'https://v.animethemes.moe/BlueLock-OP2.ogg' },
  { title:'Bling-Bang-Bang-Born', anime:'Mashle', type:'OP', audioUrl:'https://v.animethemes.moe/Mashle-OP1.ogg' },
];

const TOP_ENDINGS = [
  { title:'Dango Daikazoku', anime:'Clannad', type:'ED', audioUrl:'https://v.animethemes.moe/Clannad-ED1.ogg' },
  { title:'Hana no Iro', anime:'Anohana', type:'ED', audioUrl:'https://v.animethemes.moe/AnoHanaMemeMatsuri-ED1.ogg' },
  { title:'Uso', anime:'Fullmetal Alchemist Brotherhood', type:'ED', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-ED1.ogg' },
  { title:'Fukai Mori', anime:'Inuyasha', type:'ED', audioUrl:'https://v.animethemes.moe/InuYasha-ED2.ogg' },
  { title:'Wind', anime:'Naruto', type:'ED', audioUrl:'https://v.animethemes.moe/Naruto-ED1.ogg' },
  { title:'Shunkan Sentimental', anime:'Fullmetal Alchemist Brotherhood', type:'ED', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-ED4.ogg' },
  { title:'Last Moment', anime:'Fairy Tail', type:'ED', audioUrl:'https://v.animethemes.moe/FairyTail-ED2.ogg' },
  { title:'Merry Go Round of Life', anime:"Howl's Moving Castle", type:'ED', audioUrl:'https://v.animethemes.moe/HarunoSorashita-ED1.ogg' },
  { title:'Kokuhaku', anime:'Toradora', type:'ED', audioUrl:'https://v.animethemes.moe/Toradora-ED2.ogg' },
  { title:'Vanilla Salt', anime:'Toradora', type:'ED', audioUrl:'https://v.animethemes.moe/Toradora-ED1.ogg' },
  { title:'Brave Shine', anime:'Fate/Stay Night UBW', type:'ED', audioUrl:'https://v.animethemes.moe/FateStayNightUnlimitedBladeWorks2ndSeason-OP1.ogg' },
  { title:'Nagi no Ashikoto', anime:'Nagi no Asukara', type:'ED', audioUrl:'https://v.animethemes.moe/NaginoAsukara-ED1.ogg' },
  { title:'Tsunaida Te', anime:'A Silent Voice', type:'ED', audioUrl:'https://v.animethemes.moe/KoenoKatachi-ED1.ogg' },
  { title:'Oath Sign', anime:'Fate/Zero', type:'ED', audioUrl:'https://v.animethemes.moe/FateZero-OP1.ogg' },
  { title:'Canaan', anime:'Anohana', type:'ED', audioUrl:'https://v.animethemes.moe/AnoHanaMemeMatsuri-OP1.ogg' },
  { title:'Gravity', anime:"Wolf's Rain", type:'ED', audioUrl:'https://v.animethemes.moe/WolfsRain-ED1.ogg' },
  { title:'Yumesekai', anime:'Madoka Magica', type:'ED', audioUrl:'https://v.animethemes.moe/MahouShoujoMadokaMagica-ED1.ogg' },
  { title:'Tabi no Tochuu', anime:'Mushishi', type:'ED', audioUrl:'https://v.animethemes.moe/Mushishi-ED1.ogg' },
  { title:'Uraomote Lovers', anime:'Oreimo', type:'ED', audioUrl:'https://v.animethemes.moe/OrenoImoutogaKonnaniKawaiiWakeganai-ED1.ogg' },
  { title:'Kimi ja Nakya Dame Mitai', anime:'Fairy Tail', type:'ED', audioUrl:'https://v.animethemes.moe/FairyTail-ED9.ogg' },
  { title:'My Dearest', anime:'Guilty Crown', type:'ED', audioUrl:'https://v.animethemes.moe/GuiltyyCrown-OP1.ogg' },
  { title:'Departures', anime:'Guilty Crown', type:'ED', audioUrl:'https://v.animethemes.moe/GuiltyyCrown-ED1.ogg' },
  { title:'Bless Your Breath', anime:'Overlord', type:'ED', audioUrl:'https://v.animethemes.moe/Overlord-ED1.ogg' },
  { title:'Suki yanen', anime:'Assassination Classroom', type:'ED', audioUrl:'https://v.animethemes.moe/AnsatsuKyoushitsu-ED1.ogg' },
  { title:'Yoru ni Kakeru', anime:'Given', type:'ED', audioUrl:'https://v.animethemes.moe/Given-ED1.ogg' },
  { title:'Tabidachi no Hi ni', anime:'Violet Evergarden', type:'ED', audioUrl:'https://v.animethemes.moe/VioletEvergarden-ED1.ogg' },
  { title:'Ref:rain', anime:'Iroduku', type:'ED', audioUrl:'https://v.animethemes.moe/IrodukuSekainiKimitoWa-ED1.ogg' },
  { title:'Ikimono Gakari - Blue Bird', anime:'Naruto Shippuden', type:'ED', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-ED12.ogg' },
  { title:'Last Dance', anime:'Re:Zero', type:'ED', audioUrl:'https://v.animethemes.moe/ReZero-ED1.ogg' },
  { title:'Stay Alive', anime:'Re:Zero S2', type:'ED', audioUrl:'https://v.animethemes.moe/ReZeroHajimeruIsekaiSeikatsu2ndSeason-ED1.ogg' },
  { title:'Zankyou no Terror ED', anime:'Zankyou no Terror', type:'ED', audioUrl:'https://v.animethemes.moe/ZankyounoTerror-ED1.ogg' },
  { title:'One Last Kiss', anime:'Evangelion 3.0+1.0', type:'ED', audioUrl:'https://v.animethemes.moe/EvangelionShin-ED1.ogg' },
  { title:'Beautiful World', anime:'Evangelion', type:'ED', audioUrl:'https://v.animethemes.moe/EvangelionShin-OP1.ogg' },
  { title:'Koi no Uta', anime:'Rurouni Kenshin', type:'ED', audioUrl:'https://v.animethemes.moe/RurouniKenshin-ED1.ogg' },
  { title:'Waltz', anime:'Fruits Basket', type:'ED', audioUrl:'https://v.animethemes.moe/FruitsBasket2019-ED1.ogg' },
  { title:'Lucky Star ED', anime:'Lucky Star', type:'ED', audioUrl:'https://v.animethemes.moe/LuckyStar-ED1.ogg' },
  { title:'Satoru ED', anime:'Erased', type:'ED', audioUrl:'https://v.animethemes.moe/BokuDakegaInaiMachi-ED1.ogg' },
  { title:'STYX HELIX', anime:'Re:Zero', type:'ED', audioUrl:'https://v.animethemes.moe/ReZero-ED2.ogg' },
  { title:'Haikyuu ED', anime:'Haikyuu', type:'ED', audioUrl:'https://v.animethemes.moe/Haikyuu-ED1.ogg' },
  { title:'Chiisana Tenohira', anime:'Clannad After Story', type:'ED', audioUrl:'https://v.animethemes.moe/ClannadAfterStory-ED1.ogg' },
  { title:'Boku wa Tomodachi ga Sukunai ED', anime:'Haganai', type:'ED', audioUrl:'https://v.animethemes.moe/BokuwaTomodachigaSukunai-ED1.ogg' },
  { title:'Ao no Exorcist ED', anime:'Ao no Exorcist', type:'ED', audioUrl:'https://v.animethemes.moe/AonExorcist-ED1.ogg' },
  { title:'Kuusou Mesorogiwi', anime:'Mirai Nikki', type:'ED', audioUrl:'https://v.animethemes.moe/MiraiNikki-OP1.ogg' },
  { title:'Kaikaikitan ED', anime:'Jujutsu Kaisen', type:'ED', audioUrl:'https://v.animethemes.moe/JujutsuKaisen-ED1.ogg' },
  { title:'Akeboshi ED', anime:'Naruto', type:'ED', audioUrl:'https://v.animethemes.moe/Naruto-ED2.ogg' },
  { title:'Shippuden ED1', anime:'Naruto Shippuden', type:'ED', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-ED1.ogg' },
  { title:'My Soul Your Beats', anime:'Angel Beats', type:'ED', audioUrl:'https://v.animethemes.moe/AngelBeats-OP1.ogg' },
  { title:'Ichiban no Takaramono', anime:'Angel Beats', type:'ED', audioUrl:'https://v.animethemes.moe/AngelBeats-ED1.ogg' },
  { title:'Zankyou Chord', anime:'Your Lie in April', type:'ED', audioUrl:'https://v.animethemes.moe/ShigatsuwaKiminoUso-ED1.ogg' },
  { title:'Nanairo Symphony', anime:'Ro-Kyu-Bu', type:'ED', audioUrl:'https://v.animethemes.moe/RoKyuBu-OP1.ogg' },
  { title:'Sayonara Memory', anime:'Naruto Shippuden', type:'ED', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-ED28.ogg' },
];

const TOP_OST = [
  { title:'Guren no Yumiya (OST)', anime:'Attack on Titan', type:'OS', audioUrl:'https://v.animethemes.moe/ShingekinoKyojin-OP1.ogg' },
  { title:'Merry Go Round of Life', anime:"Howl's Moving Castle", type:'OS', audioUrl:'https://v.animethemes.moe/HowlsMovingCastle-ED1.ogg' },
  { title:'Requiem of the Rose King', anime:'Fullmetal Alchemist Brotherhood', type:'OS', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-ED5.ogg' },
  { title:'Across the Stars', anime:'Sword Art Online', type:'OS', audioUrl:'https://v.animethemes.moe/SwordArtOnline-ED1.ogg' },
  { title:'Lilium', anime:'Elfen Lied', type:'OS', audioUrl:'https://v.animethemes.moe/ElfenLied-OP1.ogg' },
  { title:'Unravel (Piano)', anime:'Tokyo Ghoul', type:'OS', audioUrl:'https://v.animethemes.moe/TokyoGhoul-ED1.ogg' },
  { title:"Ymir's Theme", anime:'Attack on Titan', type:'OS', audioUrl:'https://v.animethemes.moe/ShingekinoKyojin-ED1.ogg' },
  { title:'Tabi no Tochuu', anime:'Spice and Wolf', type:'OS', audioUrl:'https://v.animethemes.moe/OokamitoKoushinryou-OP1.ogg' },
  { title:'Philosophia', anime:'Spice and Wolf', type:'OS', audioUrl:'https://v.animethemes.moe/OokamitoKoushinryouII-OP1.ogg' },
  { title:'Elfen Lied OP', anime:'Elfen Lied', type:'OS', audioUrl:'https://v.animethemes.moe/ElfenLied-OP1.ogg' },
  { title:'Call of Silence', anime:'Attack on Titan', type:'OS', audioUrl:'https://v.animethemes.moe/ShingekinoKyojin3rdSeason-ED1.ogg' },
  { title:'Alchemy', anime:'Fullmetal Alchemist', type:'OS', audioUrl:'https://v.animethemes.moe/FullmetalAlchemist-OP1.ogg' },
  { title:'Shi no Choukokunin', anime:'Death Note', type:'OS', audioUrl:'https://v.animethemes.moe/DeathNote-ED1.ogg' },
  { title:'Kimi no Na wa. Theme', anime:'Your Name', type:'OS', audioUrl:'https://v.animethemes.moe/KiminoNaWa-ED1.ogg' },
  { title:'Sparkle', anime:'Your Name', type:'OS', audioUrl:'https://v.animethemes.moe/KiminoNaWa-OP1.ogg' },
  { title:'Nandemonaiya', anime:'Your Name', type:'OS', audioUrl:'https://v.animethemes.moe/KiminoNaWa-ED2.ogg' },
  { title:'Brave Heart', anime:'Digimon', type:'OS', audioUrl:'https://v.animethemes.moe/DigimonAdventure-OP1.ogg' },
  { title:'Butter-Fly', anime:'Digimon', type:'OS', audioUrl:'https://v.animethemes.moe/DigimonAdventure-OP1.ogg' },
  { title:'Euterpe', anime:'Guilty Crown', type:'OS', audioUrl:'https://v.animethemes.moe/GuiltyyCrown-ED2.ogg' },
  { title:'Bios', anime:'Guilty Crown', type:'OS', audioUrl:'https://v.animethemes.moe/GuiltyyCrown-ED3.ogg' },
  { title:'Kaze no Uta', anime:'Steins;Gate', type:'OS', audioUrl:'https://v.animethemes.moe/SteinsGate-ED1.ogg' },
  { title:'Gate of Steiner', anime:'Steins;Gate', type:'OS', audioUrl:'https://v.animethemes.moe/SteinsGate-OP1.ogg' },
  { title:'Path of the Wind', anime:'My Neighbor Totoro', type:'OS', audioUrl:'https://v.animethemes.moe/TonarinoTotoro-ED1.ogg' },
  { title:"Mother's Theme", anime:'Spirited Away', type:'OS', audioUrl:'https://v.animethemes.moe/SentoChihirono-ED1.ogg' },
  { title:'Inochi no Namae', anime:'Spirited Away', type:'OS', audioUrl:'https://v.animethemes.moe/SentoChihirono-OP1.ogg' },
  { title:'Hikari (Simple and Clean)', anime:'Kingdom Hearts', type:'OS', audioUrl:'https://v.animethemes.moe/KingdomHearts-OP1.ogg' },
  { title:'Madder Sky', anime:'Code Geass R2', type:'OS', audioUrl:'https://v.animethemes.moe/CodeGeassR2-OP1.ogg' },
  { title:'Cagayake! GIRLS', anime:'K-On!', type:'OS', audioUrl:'https://v.animethemes.moe/KOn-OP1.ogg' },
  { title:"Don't say lazy", anime:'K-On!', type:'OS', audioUrl:'https://v.animethemes.moe/KOn-ED1.ogg' },
  { title:'Fuwa Fuwa Time', anime:'K-On!', type:'OS', audioUrl:'https://v.animethemes.moe/KOn-OP2.ogg' },
  { title:'My Girl', anime:'Watashi ga Motenai', type:'OS', audioUrl:'https://v.animethemes.moe/WatashigaMotenainowaDoukangaeteruOmaerachigaWarui-OP1.ogg' },
  { title:'Eternal Blaze', anime:'Magical Lyrical Nanoha', type:'OS', audioUrl:'https://v.animethemes.moe/MahouShoujoLyricalNanohaAS-OP1.ogg' },
  { title:'God Knows', anime:'Haruhi Suzumiya', type:'OS', audioUrl:'https://v.animethemes.moe/SuzumiyaHaruhinoYuuutsu-OP1.ogg' },
  { title:'Hare Hare Yukai', anime:'Haruhi Suzumiya', type:'OS', audioUrl:'https://v.animethemes.moe/SuzumiyaHaruhinoYuuutsu-ED1.ogg' },
  { title:'Tori no Uta', anime:'Air', type:'OS', audioUrl:'https://v.animethemes.moe/Air-OP1.ogg' },
  { title:'Last Regrets', anime:'Kanon', type:'OS', audioUrl:'https://v.animethemes.moe/Kanon2006-OP1.ogg' },
  { title:'Neon Genesis', anime:'Evangelion', type:'OS', audioUrl:'https://v.animethemes.moe/ShinseikiEvangelion-OP1.ogg' },
  { title:'Fly Me to the Moon', anime:'Evangelion', type:'OS', audioUrl:'https://v.animethemes.moe/ShinseikiEvangelion-ED1.ogg' },
  { title:'Inner Universe', anime:'Ghost in the Shell', type:'OS', audioUrl:'https://v.animethemes.moe/KoukakuKidoutaiStandAloneComplex-OP1.ogg' },
  { title:'Rise', anime:'Ghost in the Shell SAC 2nd GIG', type:'OS', audioUrl:'https://v.animethemes.moe/KoukakuKidoutaiStandAloneComplex2ndGIG-OP1.ogg' },
  { title:'Yui - Again', anime:'Fullmetal Alchemist Brotherhood', type:'OS', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-OP1.ogg' },
  { title:'Period', anime:'Fullmetal Alchemist Brotherhood', type:'OS', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-OP4.ogg' },
  { title:'Rain', anime:'Fullmetal Alchemist Brotherhood', type:'OS', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-ED1.ogg' },
  { title:'Lullaby of Birdheads', anime:'Made in Abyss', type:'OS', audioUrl:'https://v.animethemes.moe/MadeinAbyss-OP1.ogg' },
  { title:'Deep in Abyss', anime:'Made in Abyss', type:'OS', audioUrl:'https://v.animethemes.moe/MadeinAbyss-ED1.ogg' },
  { title:'Freesia', anime:'Vinland Saga', type:'OS', audioUrl:'https://v.animethemes.moe/VinlandSaga-OP1.ogg' },
  { title:'Torches', anime:'Vinland Saga', type:'OS', audioUrl:'https://v.animethemes.moe/VinlandSaga-ED1.ogg' },
  { title:'Chainsaw Blood', anime:'Chainsaw Man', type:'OS', audioUrl:'https://v.animethemes.moe/ChainsawMan-ED1.ogg' },
  { title:'Tablet', anime:'Chainsaw Man', type:'OS', audioUrl:'https://v.animethemes.moe/ChainsawMan-ED2.ogg' },
  { title:'Hawatari Niku Soku', anime:'Chainsaw Man', type:'OS', audioUrl:'https://v.animethemes.moe/ChainsawMan-ED3.ogg' },
];


// Hardcoded popular tracks with verified AnimeThemes URL format
const HARDCODED_TRACKS = {
  OP: [
    { title:'Gurenge', anime:'Demon Slayer', audioUrl:'https://v.animethemes.moe/KimetsunoYaiba-OP1.ogg' },
    { title:'Guren no Yumiya', anime:'Attack on Titan', audioUrl:'https://v.animethemes.moe/ShingekinoKyojin-OP1.ogg' },
    { title:'Again', anime:'FMA Brotherhood', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-OP1.ogg' },
    { title:'The World', anime:'Death Note', audioUrl:'https://v.animethemes.moe/DeathNote-OP1.ogg' },
    { title:'Unravel', anime:'Tokyo Ghoul', audioUrl:'https://v.animethemes.moe/TokyoGhoul-OP1.ogg' },
    { title:'Tank!', anime:'Cowboy Bebop', audioUrl:'https://v.animethemes.moe/CowboyBebop-OP1.ogg' },
    { title:'Colors', anime:'Code Geass', audioUrl:'https://v.animethemes.moe/CodeGeassHangyakunoLelouch-OP1.ogg' },
    { title:'Departure', anime:'Hunter x Hunter', audioUrl:'https://v.animethemes.moe/HunterxHunter2011-OP1.ogg' },
    { title:'The Hero', anime:'One Punch Man', audioUrl:'https://v.animethemes.moe/OnePunchMan-OP1.ogg' },
    { title:'99', anime:'Mob Psycho 100', audioUrl:'https://v.animethemes.moe/MobPsycho100-OP1.ogg' },
    { title:'Re:Re:', anime:'Erased', audioUrl:'https://v.animethemes.moe/BokuDakegaInaiMachi-OP1.ogg' },
    { title:'Kaikai Kitan', anime:'Jujutsu Kaisen', audioUrl:'https://v.animethemes.moe/JujutsuKaisen-OP1.ogg' },
    { title:'Odd Future', anime:'My Hero Academia S4', audioUrl:'https://v.animethemes.moe/BokunoHeroAcademia4thSeason-OP1.ogg' },
    { title:'Peace Sign', anime:'My Hero Academia S2', audioUrl:'https://v.animethemes.moe/BokunoHeroAcademia2ndSeason-OP1.ogg' },
    { title:'My Soul Your Beats', anime:'Angel Beats', audioUrl:'https://v.animethemes.moe/AngelBeats-OP1.ogg' },
    { title:'Crossing Field', anime:'Sword Art Online', audioUrl:'https://v.animethemes.moe/SwordArtOnline-OP1.ogg' },
    { title:'Blue Bird', anime:'Naruto Shippuden', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-OP3.ogg' },
    { title:'Sign', anime:'Naruto Shippuden', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-OP6.ogg' },
    { title:'GO!!!', anime:'Naruto', audioUrl:'https://v.animethemes.moe/Naruto-OP4.ogg' },
    { title:'Silhouette', anime:'Naruto Shippuden', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-OP16.ogg' },
    { title:'Sono Chi no Sadame', anime:'JoJo Part 1', audioUrl:'https://v.animethemes.moe/JoJonoKimyounaNaBoukenhazimarinoSekaihen-OP1.ogg' },
    { title:'Bloody Stream', anime:'JoJo Part 2', audioUrl:'https://v.animethemes.moe/JoJonoKimyounaNaBoukenhazimarinoSekaihen-OP2.ogg' },
    { title:'Great Days', anime:'JoJo Part 4', audioUrl:'https://v.animethemes.moe/JoJonoKimyounaNaBoukenDiamondwaKudakenai-OP3.ogg' },
    { title:'Renai Circulation', anime:'Bakemonogatari', audioUrl:'https://v.animethemes.moe/Bakemonogatari-OP4.ogg' },
    { title:'Catch You Catch Me', anime:'Cardcaptor Sakura', audioUrl:'https://v.animethemes.moe/CardcaptorSakura-OP1.ogg' },
    { title:'Cruel Angel Thesis', anime:'Neon Genesis Evangelion', audioUrl:'https://v.animethemes.moe/ShinseikiEvangelion-OP1.ogg' },
    { title:'Connect', anime:'Madoka Magica', audioUrl:'https://v.animethemes.moe/MahouShoujoMadokaMagica-OP1.ogg' },
    { title:'Sirius', anime:'Kill la Kill', audioUrl:'https://v.animethemes.moe/KilllaKill-OP1.ogg' },
    { title:'Happily Ever After', anime:'Fairy Tail', audioUrl:'https://v.animethemes.moe/FairyTail-OP1.ogg' },
    { title:'We Are!', anime:'One Piece', audioUrl:'https://v.animethemes.moe/OnePiece-OP1.ogg' },
    { title:'Cha-La Head-Cha-La', anime:'Dragon Ball Z', audioUrl:'https://v.animethemes.moe/DragonBallZ-OP1.ogg' },
    { title:"Driver's High", anime:'GTO', audioUrl:'https://v.animethemes.moe/GTO-OP1.ogg' },
    { title:'Haruka Kanata', anime:'Naruto', audioUrl:'https://v.animethemes.moe/Naruto-OP2.ogg' },
    { title:'Days', anime:'Eureka Seven', audioUrl:'https://v.animethemes.moe/EurekaSevenKokyounoPoetry-OP1.ogg' },
    { title:'Bling-Bang-Bang-Born', anime:'Mashle S2', audioUrl:'https://v.animethemes.moe/MashleMagicandMuscles2ndSeason-OP1.ogg' },
    { title:'Cry Baby', anime:'Tokyo Revengers', audioUrl:'https://v.animethemes.moe/TokyoRevengers-OP1.ogg' },
    { title:'Mixed Nuts', anime:'Spy x Family', audioUrl:'https://v.animethemes.moe/SpyxFamily-OP1.ogg' },
    { title:'Otonoke', anime:'Dandadan', audioUrl:'https://v.animethemes.moe/DanDaDan-OP1.ogg' },
    { title:'KICK BACK', anime:'Chainsaw Man', audioUrl:'https://v.animethemes.moe/ChainsawMan-OP1.ogg' },
    { title:'Specialz', anime:'Jujutsu Kaisen S2', audioUrl:'https://v.animethemes.moe/JujutsuKaisen2ndSeason-OP1.ogg' },
    { title:'W.M.B', anime:'Blue Lock', audioUrl:'https://v.animethemes.moe/BlueLock-OP1.ogg' },
    { title:'Freesia', anime:'Vinland Saga', audioUrl:'https://v.animethemes.moe/VinlandSaga-OP1.ogg' },
    { title:'Shikigami', anime:'Frieren', audioUrl:'https://v.animethemes.moe/SousounoFrieren-OP1.ogg' },
    { title:'Inner Universe', anime:'Ghost in the Shell SAC', audioUrl:'https://v.animethemes.moe/KoukakuKidoutaiStandAloneComplex-OP1.ogg' },
    { title:'Tabi no Tochuu', anime:'Spice and Wolf', audioUrl:'https://v.animethemes.moe/OokamitoKoushinryou-OP1.ogg' },
    { title:'Bless Your Breath', anime:'Overlord', audioUrl:'https://v.animethemes.moe/Overlord-OP1.ogg' },
    { title:'This Game', anime:'No Game No Life', audioUrl:'https://v.animethemes.moe/NoGameNoLife-OP1.ogg' },
    { title:'Liar Mask', anime:'Akame ga Kill', audioUrl:'https://v.animethemes.moe/AkamegaKill-OP1.ogg' },
    { title:'Uso', anime:'FMA Brotherhood', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-OP2.ogg' },
    { title:'Period', anime:'FMA Brotherhood', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-OP4.ogg' },
    { title:'Boku no Sensou', anime:'Attack on Titan S4', audioUrl:'https://v.animethemes.moe/ShingekinoKyojinTheFinalSeason-OP1.ogg' },
  ],
  ED: [
    { title:'Dango Daikazoku', anime:'Clannad', audioUrl:'https://v.animethemes.moe/Clannad-ED1.ogg' },
    { title:'Uso', anime:'FMA Brotherhood', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-ED1.ogg' },
    { title:'Fukai Mori', anime:'Inuyasha', audioUrl:'https://v.animethemes.moe/InuYasha-ED2.ogg' },
    { title:'Wind', anime:'Naruto', audioUrl:'https://v.animethemes.moe/Naruto-ED1.ogg' },
    { title:'Vanilla Salt', anime:'Toradora', audioUrl:'https://v.animethemes.moe/Toradora-ED1.ogg' },
    { title:'Kokuhaku', anime:'Toradora', audioUrl:'https://v.animethemes.moe/Toradora-ED2.ogg' },
    { title:'Yumesekai', anime:'Madoka Magica', audioUrl:'https://v.animethemes.moe/MahouShoujoMadokaMagica-ED1.ogg' },
    { title:'Last Dance', anime:'Re:Zero', audioUrl:'https://v.animethemes.moe/ReZero-ED1.ogg' },
    { title:'Styx Helix', anime:'Re:Zero', audioUrl:'https://v.animethemes.moe/ReZero-ED2.ogg' },
    { title:'Ichiban no Takaramono', anime:'Angel Beats', audioUrl:'https://v.animethemes.moe/AngelBeats-ED1.ogg' },
    { title:'Tabidachi no Hi ni', anime:'Violet Evergarden', audioUrl:'https://v.animethemes.moe/VioletEvergarden-ED1.ogg' },
    { title:'Kaze no Uta', anime:'Steins;Gate', audioUrl:'https://v.animethemes.moe/SteinsGate-ED1.ogg' },
    { title:'Fly Me to the Moon', anime:'Evangelion', audioUrl:'https://v.animethemes.moe/ShinseikiEvangelion-ED1.ogg' },
    { title:'Departures', anime:'Guilty Crown', audioUrl:'https://v.animethemes.moe/GuiltyyCrown-ED1.ogg' },
    { title:'Zankyou Chord', anime:'Your Lie in April', audioUrl:'https://v.animethemes.moe/ShigatsuwaKiminoUso-ED1.ogg' },
    { title:'Satoru', anime:'Erased', audioUrl:'https://v.animethemes.moe/BokuDakegaInaiMachi-ED1.ogg' },
    { title:'Torches', anime:'Vinland Saga', audioUrl:'https://v.animethemes.moe/VinlandSaga-ED1.ogg' },
    { title:'Deep in Abyss', anime:'Made in Abyss', audioUrl:'https://v.animethemes.moe/MadeinAbyss-ED1.ogg' },
    { title:'Waltz', anime:'Fruits Basket 2019', audioUrl:'https://v.animethemes.moe/FruitsBasket2019-ED1.ogg' },
    { title:"Don't say lazy", anime:'K-On!', audioUrl:'https://v.animethemes.moe/KOn-ED1.ogg' },
    { title:'Hare Hare Yukai', anime:'Haruhi Suzumiya', audioUrl:'https://v.animethemes.moe/SuzumiyaHaruhinoYuuutsu-ED1.ogg' },
    { title:'Chiisana Tenohira', anime:'Clannad After Story', audioUrl:'https://v.animethemes.moe/ClannadAfterStory-ED1.ogg' },
    { title:'Yoru ni Kakeru', anime:'Given', audioUrl:'https://v.animethemes.moe/Given-ED1.ogg' },
    { title:'Chainsaw Blood', anime:'Chainsaw Man', audioUrl:'https://v.animethemes.moe/ChainsawMan-ED1.ogg' },
    { title:'Akeboshi', anime:'Naruto', audioUrl:'https://v.animethemes.moe/Naruto-ED2.ogg' },
    { title:'Blue Bird (ED)', anime:'Naruto Shippuden', audioUrl:'https://v.animethemes.moe/NarutoShippuuden-ED12.ogg' },
    { title:'Gravity', anime:"Wolf's Rain", audioUrl:'https://v.animethemes.moe/WolfsRain-ED1.ogg' },
    { title:'Haikyuu ED', anime:'Haikyuu', audioUrl:'https://v.animethemes.moe/Haikyuu-ED1.ogg' },
    { title:'Ref:rain', anime:'Iroduku', audioUrl:'https://v.animethemes.moe/IrodukuSekainiKimitoWa-ED1.ogg' },
    { title:'Uraomote Lovers', anime:'Oreimo', audioUrl:'https://v.animethemes.moe/OrenoImoutogaKonnaniKawaiiWakeganai-ED1.ogg' },
    { title:'Nobody', anime:'Kaiju No.8', audioUrl:'https://v.animethemes.moe/KaijuNo8-ED1.ogg' },
    { title:'Burning', anime:'Oshi no Ko S2', audioUrl:'https://v.animethemes.moe/OshinoKo2ndSeason-ED1.ogg' },
  ],
  OS: [
    { title:'Nandemonaiya', anime:'Your Name', audioUrl:'https://v.animethemes.moe/KiminoNaWa-ED2.ogg' },
    { title:'Sparkle', anime:'Your Name', audioUrl:'https://v.animethemes.moe/KiminoNaWa-ED1.ogg' },
    { title:'Call of Silence', anime:'Attack on Titan S3', audioUrl:'https://v.animethemes.moe/ShingekinoKyojin3rdSeason-ED1.ogg' },
    { title:'Lullaby of Birdheads', anime:'Made in Abyss', audioUrl:'https://v.animethemes.moe/MadeinAbyss-OP1.ogg' },
    { title:'Gate of Steiner', anime:'Steins;Gate', audioUrl:'https://v.animethemes.moe/SteinsGate-OP1.ogg' },
    { title:'God Knows', anime:'Haruhi Suzumiya', audioUrl:'https://v.animethemes.moe/SuzumiyaHaruhinoYuuutsu-OP1.ogg' },
    { title:'Cagayake Girls', anime:'K-On!', audioUrl:'https://v.animethemes.moe/KOn-OP1.ogg' },
    { title:'Euterpe', anime:'Guilty Crown', audioUrl:'https://v.animethemes.moe/GuiltyyCrown-ED2.ogg' },
    { title:'Brave Heart', anime:'Digimon', audioUrl:'https://v.animethemes.moe/DigimonAdventure-OP1.ogg' },
    { title:'Oath Sign', anime:'Fate/Zero', audioUrl:'https://v.animethemes.moe/FateZero-OP1.ogg' },
    { title:'Crossing', anime:'Fate/Zero S2', audioUrl:'https://v.animethemes.moe/FateZero2ndSeason-OP1.ogg' },
    { title:'Brave Shine', anime:'Fate/Stay Night UBW S2', audioUrl:'https://v.animethemes.moe/FateStayNightUnlimitedBladeWorks2ndSeason-OP1.ogg' },
    { title:'Tori no Uta', anime:'Air', audioUrl:'https://v.animethemes.moe/Air-OP1.ogg' },
    { title:'Inner Universe', anime:'Ghost in the Shell SAC', audioUrl:'https://v.animethemes.moe/KoukakuKidoutaiStandAloneComplex-OP1.ogg' },
    { title:'My Dearest', anime:'Guilty Crown', audioUrl:'https://v.animethemes.moe/GuiltyyCrown-OP1.ogg' },
    { title:'Philosophia', anime:'Spice and Wolf II', audioUrl:'https://v.animethemes.moe/OokamitoKoushinryouII-OP1.ogg' },
    { title:'Bloody Stream', anime:'JoJo Part 2', audioUrl:'https://v.animethemes.moe/JoJonoKimyounaNaBoukenhazimarinoSekaihen-OP2.ogg' },
    { title:'Koi wa Chaos no Shimobe', anime:'Domestic na Kanojo', audioUrl:'https://v.animethemes.moe/DomesticnaKanojo-OP1.ogg' },
    { title:'Period', anime:'FMA Brotherhood', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-OP4.ogg' },
    { title:'Shunkan Sentimental', anime:'FMA Brotherhood', audioUrl:'https://v.animethemes.moe/FullmetalAlchemistBrotherhood-ED4.ogg' },
  ],
};

async function fetchTopAnimeThemes(type) {
  const list = type === 'OP' ? HARDCODED_TRACKS.OP
    : type === 'ED' ? HARDCODED_TRACKS.ED
    : type === 'OS' ? HARDCODED_TRACKS.OS
    : [...HARDCODED_TRACKS.OP, ...HARDCODED_TRACKS.ED];
  return list.map((t, i) => ({ ...t, id: i, type: type === 'both' ? (i < HARDCODED_TRACKS.OP.length ? 'OP' : 'ED') : type }));
}


async function pickMusicTracks(count, type, pool) {
  // For top pool, use hardcoded list directly — no loop needed
  if (pool === 'top') {
    const list = type === 'OP' ? HARDCODED_TRACKS.OP
      : type === 'ED' ? HARDCODED_TRACKS.ED
      : type === 'OS' ? HARDCODED_TRACKS.OS
      : [...HARDCODED_TRACKS.OP, ...HARDCODED_TRACKS.ED];
    return list
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map((t, i) => ({ ...t, id: i, type: t.type || type }));
  }

  let all = [];
  let attempts = 0;

  while (all.length < count * 2 && attempts < 8) {
    attempts++;
    try {
      let tracks = [];
      if (false) {
        // unused branch
        const page = Math.floor(Math.random() * 150) + 1;
        const typeFilter = type === 'OP' ? '&filter[animetheme][type]=OP'
          : type === 'ED' ? '&filter[animetheme][type]=ED'
          : type === 'OS' ? '&filter[animetheme][type]=OS' : '';
        const url = `https://api.animethemes.moe/anime?include=animethemes.animethemeentries.videos.audio,animethemes.song&page[size]=20&page[number]=${page}&filter[has]=animethemes${typeFilter}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'UndercoverAnime/1.0' } });
        if (!res.ok) { await new Promise(r => setTimeout(r, 500)); continue; }
        const data = await res.json();
        for (const anime of (data.anime || [])) {
          for (const t of (anime.animethemes || [])) {
            if (type === 'OP' && t.type !== 'OP') continue;
            if (type === 'ED' && t.type !== 'ED') continue;
            if (type === 'OS' && t.type !== 'OS') continue;
            const entry = t.animethemeentries?.[0];
            const video = entry?.videos?.[0];
            const audioUrl = video?.audio?.link;
            if (!audioUrl) continue;
            tracks.push({ id: t.id, title: t.song?.title || '???', anime: anime.name || '???', type: t.type || 'OP', audioUrl });
          }
        }
      }
      all.push(...tracks);
    } catch(e) { console.error('AnimeThemes error:', e.message); }
    if (all.length < count * 2) await new Promise(r => setTimeout(r, 300));
  }

  const seen = new Set();
  return all.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; })
    .sort(() => Math.random() - 0.5).slice(0, count);
}


// ═══════════════════════════════
//  FREE TIERLIST MODE
// ═══════════════════════════════

const FREE_TIERLIST_POOL = [
  {name:'Naruto Uzumaki',anime:'Naruto'},{name:'Sasuke Uchiha',anime:'Naruto'},
  {name:'Itachi Uchiha',anime:'Naruto'},{name:'Kakashi Hatake',anime:'Naruto'},
  {name:'Shikamaru Nara',anime:'Naruto'},{name:'Gaara',anime:'Naruto'},
  {name:'Jiraiya',anime:'Naruto'},{name:'Minato Namikaze',anime:'Naruto'},
  {name:'Madara Uchiha',anime:'Naruto'},{name:'Obito Uchiha',anime:'Naruto'},
  {name:'Monkey D. Luffy',anime:'One Piece'},{name:'Zoro',anime:'One Piece'},
  {name:'Sanji',anime:'One Piece'},{name:'Nami',anime:'One Piece'},
  {name:'Portgas D. Ace',anime:'One Piece'},{name:'Trafalgar Law',anime:'One Piece'},
  {name:'Shanks',anime:'One Piece'},{name:'Boa Hancock',anime:'One Piece'},
  {name:'Goku',anime:'Dragon Ball Z'},{name:'Vegeta',anime:'Dragon Ball Z'},
  {name:'Gohan',anime:'Dragon Ball Z'},{name:'Piccolo',anime:'Dragon Ball Z'},
  {name:'Trunks',anime:'Dragon Ball Z'},{name:'Frieza',anime:'Dragon Ball Z'},
  {name:'Levi Ackerman',anime:'Attack on Titan'},{name:'Eren Yeager',anime:'Attack on Titan'},
  {name:'Mikasa Ackerman',anime:'Attack on Titan'},{name:'Armin Arlert',anime:'Attack on Titan'},
  {name:'Erwin Smith',anime:'Attack on Titan'},{name:'Hange Zoe',anime:'Attack on Titan'},
  {name:'Izuku Midoriya',anime:'My Hero Academia'},{name:'Katsuki Bakugo',anime:'My Hero Academia'},
  {name:'Shoto Todoroki',anime:'My Hero Academia'},{name:'Endeavor',anime:'My Hero Academia'},
  {name:'Hawks',anime:'My Hero Academia'},{name:'Shigaraki Tomura',anime:'My Hero Academia'},
  {name:'Tanjiro Kamado',anime:'Demon Slayer'},{name:'Zenitsu Agatsuma',anime:'Demon Slayer'},
  {name:'Inosuke Hashibira',anime:'Demon Slayer'},{name:'Giyu Tomioka',anime:'Demon Slayer'},
  {name:'Rengoku',anime:'Demon Slayer'},{name:'Muzan Kibutsuji',anime:'Demon Slayer'},
  {name:'Yuji Itadori',anime:'Jujutsu Kaisen'},{name:'Megumi Fushiguro',anime:'Jujutsu Kaisen'},
  {name:'Nobara Kugisaki',anime:'Jujutsu Kaisen'},{name:'Ryomen Sukuna',anime:'Jujutsu Kaisen'},
  {name:'Nanami Kento',anime:'Jujutsu Kaisen'},{name:'Mahito',anime:'Jujutsu Kaisen'},
  {name:'Killua Zoldyck',anime:'Hunter x Hunter'},{name:'Gon Freecss',anime:'Hunter x Hunter'},
  {name:'Hisoka Morow',anime:'Hunter x Hunter'},{name:'Kurapika',anime:'Hunter x Hunter'},
  {name:'Leorio',anime:'Hunter x Hunter'},{name:'Meruem',anime:'Hunter x Hunter'},
  {name:'Edward Elric',anime:'FMA Brotherhood'},{name:'Roy Mustang',anime:'FMA Brotherhood'},
  {name:'Alphonse Elric',anime:'FMA Brotherhood'},{name:'Riza Hawkeye',anime:'FMA Brotherhood'},
  {name:'Greed',anime:'FMA Brotherhood'},{name:'King Bradley',anime:'FMA Brotherhood'},
  {name:'Ichigo Kurosaki',anime:'Bleach'},{name:'Rukia Kuchiki',anime:'Bleach'},
  {name:'Byakuya Kuchiki',anime:'Bleach'},{name:'Aizen Sosuke',anime:'Bleach'},
  {name:'Kenpachi Zaraki',anime:'Bleach'},{name:'Uryuu Ishida',anime:'Bleach'},
  {name:'Natsu Dragneel',anime:'Fairy Tail'},{name:'Erza Scarlet',anime:'Fairy Tail'},
  {name:'Gray Fullbuster',anime:'Fairy Tail'},{name:'Lucy Heartfilia',anime:'Fairy Tail'},
  {name:'Kaneki Ken',anime:'Tokyo Ghoul'},{name:'Touka Kirishima',anime:'Tokyo Ghoul'},
  {name:'L Lawliet',anime:'Death Note'},{name:'Light Yagami',anime:'Death Note'},
  {name:'Ryuk',anime:'Death Note'},{name:'Misa Amane',anime:'Death Note'},
  {name:'Saitama',anime:'One Punch Man'},{name:'Genos',anime:'One Punch Man'},
  {name:'Tatsumaki',anime:'One Punch Man'},{name:'Bang',anime:'One Punch Man'},
  {name:'Mob',anime:'Mob Psycho 100'},{name:'Reigen',anime:'Mob Psycho 100'},
  {name:'Denji',anime:'Chainsaw Man'},{name:'Power',anime:'Chainsaw Man'},
  {name:'Makima',anime:'Chainsaw Man'},{name:'Aki Hayakawa',anime:'Chainsaw Man'},
  {name:'Jotaro Kujo',anime:'JoJo Part 3'},{name:'Giorno Giovanna',anime:'JoJo Part 5'},
  {name:'Dio Brando',anime:'JoJo Part 1'},{name:'Yoshikage Kira',anime:'JoJo Part 4'},
  {name:'Guts',anime:'Berserk'},{name:'Griffith',anime:'Berserk'},{name:'Casca',anime:'Berserk'},
  {name:'Thorfinn',anime:'Vinland Saga'},{name:'Askeladd',anime:'Vinland Saga'},
  {name:'Spike Spiegel',anime:'Cowboy Bebop'},{name:'Faye Valentine',anime:'Cowboy Bebop'},
  {name:'Vash the Stampede',anime:'Trigun'},{name:'Alucard',anime:'Hellsing'},
  {name:'Lelouch vi Britannia',anime:'Code Geass'},{name:"C.C.",anime:'Code Geass'},
  {name:'Shinji Ikari',anime:'Evangelion'},{name:'Rei Ayanami',anime:'Evangelion'},
  {name:'Asuka Langley',anime:'Evangelion'},{name:'Misato Katsuragi',anime:'Evangelion'},
  {name:'Kirito',anime:'SAO'},{name:'Asuna',anime:'SAO'},
  {name:'Subaru Natsuki',anime:'Re:Zero'},{name:'Rem',anime:'Re:Zero'},{name:'Emilia',anime:'Re:Zero'},
  {name:'Kazuma Sato',anime:'KonoSuba'},{name:'Aqua',anime:'KonoSuba'},{name:'Darkness',anime:'KonoSuba'},
  {name:'Ainz Ooal Gown',anime:'Overlord'},{name:'Albedo',anime:'Overlord'},
  {name:'Rimuru Tempest',anime:'Tensura'},{name:'Milim',anime:'Tensura'},
  {name:'Senku Ishigami',anime:'Dr. Stone'},{name:'Tsukasa Shishio',anime:'Dr. Stone'},
  {name:'Asta',anime:'Black Clover'},{name:'Yami Sukehiro',anime:'Black Clover'},
  {name:'Bell Cranel',anime:'DanMachi'},{name:'Hestia',anime:'DanMachi'},
  {name:'Taiga Aisaka',anime:'Toradora'},{name:'Ryuji Takasu',anime:'Toradora'},
  {name:'Hachiman Hikigaya',anime:'Oregairu'},{name:'Yukino Yukinoshita',anime:'Oregairu'},
  {name:'Kaguya Shinomiya',anime:'Kaguya-sama'},{name:'Miyuki Shirogane',anime:'Kaguya-sama'},
  {name:'Shoyo Hinata',anime:'Haikyuu'},{name:'Tobio Kageyama',anime:'Haikyuu'},
  {name:'Tetsuya Kuroko',anime:'Kuroko Basketball'},{name:'Seijuro Akashi',anime:'Kuroko Basketball'},
  {name:'Yoichi Isagi',anime:'Blue Lock'},{name:'Seishiro Nagi',anime:'Blue Lock'},
  {name:'Ippo Makunouchi',anime:'Hajime no Ippo'},{name:'Joe Yabuki',anime:'Ashita no Joe'},
  {name:'Violet Evergarden',anime:'Violet Evergarden'},
  {name:'Yor Forger',anime:'Spy x Family'},{name:'Loid Forger',anime:'Spy x Family'},{name:'Anya Forger',anime:'Spy x Family'},
  {name:'Yusuke Urameshi',anime:'Yu Yu Hakusho'},{name:'Hiei',anime:'Yu Yu Hakusho'},
  {name:'Motoko Kusanagi',anime:'Ghost in the Shell'},{name:'Revy',anime:'Black Lagoon'},
  {name:'Yato',anime:'Noragami'},{name:'Homura Akemi',anime:'Madoka Magica'},
  {name:'Satsuki Kiryuin',anime:'Kill la Kill'},{name:'Simon',anime:'Gurren Lagann'},
  {name:'Zero Two',anime:'Darling in the FranXX'},{name:'Raphtalia',anime:'Shield Hero'},
  {name:'Naofumi Iwatani',anime:'Shield Hero'},{name:'Tohru Honda',anime:'Fruits Basket'},
  {name:'Oreki Houtarou',anime:'Hyouka'},{name:'Miyamura Izumi',anime:'Horimiya'},
  {name:'Kousei Arima',anime:'Your Lie in April'},{name:'Kaori Miyazono',anime:'Your Lie in April'},
  {name:'Menma',anime:'AnoHana'},{name:'Shinya Kogami',anime:'Psycho-Pass'},
];

function pickFreeTierlistChars(count) {
  return [...FREE_TIERLIST_POOL]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(c => ({ ...c, image: CHARACTER_IMAGES[c.name] || null }));
}

// ═══════════════════════════════
//  HEALTH + PING (anti-sleep)
// ═══════════════════════════════
app.get('/', (_, res) => res.send('Undercover Anime Backend OK ✅'));
app.get('/ping', (_, res) => res.json({ ok: true, ts: Date.now() }));

// Image proxy — serves MAL images without CORS issues
app.get('/img', async (req, res) => {
  const url = req.query.url;
  if (!url || (!url.startsWith('https://cdn.myanimelist.net/') && !url.startsWith('https://static.wikia.nocookie.net/'))) {
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

// Audio proxy — streams AnimeThemes audio without CORS issues
app.get('/audio', async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes('animethemes')) {
    return res.status(400).send('Invalid URL');
  }
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animethemes.moe/' },
      redirect: 'follow',
    });
    if (!r.ok) return res.status(r.status).send('Not found');
    const contentType = r.headers.get('content-type') || 'audio/ogg';
    const contentLength = r.headers.get('content-length');
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Accept-Ranges', 'bytes');
    if (contentLength) res.set('Content-Length', contentLength);
    // Stream response body directly to client
    const { Readable } = require('stream');
    if (r.body && r.body.pipeTo) {
      // Web Streams API (Node 18+)
      Readable.fromWeb(r.body).pipe(res);
    } else {
      const buf = await r.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch(e) {
    console.error('Audio proxy error:', e.message);
    res.status(500).send('Error');
  }
});

// ═══════════════════════════════
//  SOCKET
// ═══════════════════════════════
io.on('connection', (socket) => {

  socket.on('room:create', ({ name, genre, mrWhite, doubleUndercover, wordTimer, settings, mode }) => {
    let code; do { code = genCode(); } while (rooms[code]);
    rooms[code] = {
      code, genre, host: name,
      phase: 'lobby', mode: mode || 'undercover',
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
  //  FREE TIERLIST EVENTS
  // ══════════════════════════════════════

  socket.on('freetl:start', () => {
    const { name, code } = socket.data || {};
    console.log('freetl:start received, name=', name, 'code=', code, 'room exists=', !!rooms[code]);
    const room = rooms[code];
    if (!room || room.host !== name) return;
    room.phase = 'freetl';
    room.freetl = {
      characters: pickFreeTierlistChars(10),
      submissions: {},
      phase: 'ranking', // ranking -> reveal -> discuss
      round: (room.freetl?.round || 0) + 1,
    };
    broadcastRoom(code);
  });

  socket.on('freetl:submit', ({ ranking }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'freetl' || room.freetl.phase !== 'ranking') return;
    if (!Array.isArray(ranking) || ranking.length !== 10) return;
    room.freetl.submissions[name] = ranking;
    broadcastRoom(code);
    // Check if all submitted
    const players = Object.keys(room.players).filter(p => room.players[p].connected && !room.players[p].isSpectator);
    if (players.every(p => room.freetl.submissions[p])) {
      room.freetl.phase = 'reveal';
      broadcastRoom(code);
    }
  });

  // Host moves to next round — new chars, no lobby
  socket.on('freetl:next', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name || room.phase !== 'freetl') return;
    room.freetl = {
      characters: pickFreeTierlistChars(10),
      submissions: {},
      phase: 'ranking',
      round: (room.freetl?.round || 0) + 1,
    };
    broadcastRoom(code);
  });

  socket.on('freetl:reset', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    room.phase = 'lobby';
    room.freetl = null;
    broadcastRoom(code);
  });

  // ══════════════════════════════════════
  //  MUSIC RATING MODE EVENTS
  // ══════════════════════════════════════

  socket.on('music:start', async ({ type, count, pool }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name || room.phase !== 'lobby') return;

    const trackCount = Math.min(Math.max(parseInt(count) || 5, 1), 20);
    const musicType = ['OP','ED','both'].includes(type) ? type : 'both';

    room.phase = 'music';
    room.music = {
      tracks: [],
      currentIndex: 0,
      phase: 'loading', // loading -> playing -> rating -> reveal -> next -> done
      ratings: {},      // trackIndex -> { playerName -> 0-10 }
      type: musicType,
      count: trackCount,
    };

    io.to(code).emit('loading', true);
    broadcastRoom(code);

    const tracks = await pickMusicTracks(trackCount, musicType, pool || 'top');
    if (!tracks || tracks.length === 0) {
      io.to(code).emit('loading', false);
      io.to(code).emit('toast', 'Erreur AnimeThemes — réessaie');
      room.phase = 'lobby';
      broadcastRoom(code);
      return;
    }

    room.music.tracks = tracks;
    room.music.phase = 'playing';
    room.music.ratings = {};
    tracks.forEach((_, i) => { room.music.ratings[i] = {}; });

    io.to(code).emit('loading', false);
    broadcastRoom(code);
  });

  // Player submits a rating for current track
  socket.on('music:rate', ({ trackIndex, rating }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'music') return;
    const r = parseFloat(rating);
    if (isNaN(r) || r < 0 || r > 10) return;
    if (!room.music.ratings[trackIndex]) room.music.ratings[trackIndex] = {};
    room.music.ratings[trackIndex][name] = Math.round(r * 10) / 10;
    broadcastRoom(code);
  });

  // Host moves to next track or ends session
  socket.on('music:next', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name || room.phase !== 'music') return;
    room.music.currentIndex++;
    if (room.music.currentIndex >= room.music.tracks.length) {
      room.music.phase = 'done';
    } else {
      room.music.phase = 'playing';
    }
    broadcastRoom(code);
  });

  // Return to lobby
  socket.on('music:reset', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    room.phase = 'lobby';
    room.music = null;
    broadcastRoom(code);
  });

  // ══════════════════════════════════════
  //  TIERLIST MODE EVENTS
  // ══════════════════════════════════════

  // Host starts a tierlist round
  socket.on('tierlist:start', async () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    if (room.phase !== 'lobby') return;

    room.phase = 'tierlist';
    room.tierlist = {
      anime: null,
      characters: [],
      submissions: {}, // name -> ordered array of char names
      votes: {},       // name -> name of player they voted for
      scores: room.tierlist?.scores || {},
      round: (room.tierlist?.round || 0) + 1,
      phase: 'loading', // loading -> ranking -> reveal -> vote -> result
    };

    // Init scores for all players
    Object.keys(room.players).forEach(p => {
      if (!room.tierlist.scores[p]) room.tierlist.scores[p] = 0;
    });

    io.to(code).emit('loading', true);
    broadcastRoom(code);

    // Pick random anime
    const anime = TIERLIST_ANIMES[Math.floor(Math.random() * TIERLIST_ANIMES.length)];
    room.tierlist.anime = anime;

    // Fetch characters with retry
    let chars = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      chars = await fetchAnimeCharacters(anime.malId);
      if (chars) break;
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!chars) {
      // Fallback: try another anime
      const fallback = TIERLIST_ANIMES[Math.floor(Math.random() * TIERLIST_ANIMES.length)];
      room.tierlist.anime = fallback;
      chars = await fetchAnimeCharacters(fallback.malId);
    }

    if (!chars) {
      io.to(code).emit('loading', false);
      io.to(code).emit('toast', 'Erreur Jikan — réessaie', 'err');
      room.phase = 'lobby';
      broadcastRoom(code);
      return;
    }

    room.tierlist.characters = chars;
    room.tierlist.phase = 'ranking';
    io.to(code).emit('loading', false);
    broadcastRoom(code);
  });

  // Player submits their tierlist
  socket.on('tierlist:submit', ({ ranking }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'tierlist' || room.tierlist.phase !== 'ranking') return;
    if (!Array.isArray(ranking) || ranking.length !== 10) return;

    room.tierlist.submissions[name] = ranking;
    broadcastRoom(code);

    // Check if everyone submitted
    const alive = Object.keys(room.players).filter(p => room.players[p].connected && !room.players[p].isSpectator);
    if (alive.every(p => room.tierlist.submissions[p])) {
      room.tierlist.phase = 'reveal';
      broadcastRoom(code);
    }
  });

  // Player votes for best tierlist
  socket.on('tierlist:vote', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'tierlist' || room.tierlist.phase !== 'vote') return;
    if (target === name) return; // can't vote for yourself
    if (room.tierlist.votes[name]) return; // already voted

    room.tierlist.votes[name] = target;
    broadcastRoom(code);

    // Check if everyone voted
    const players = Object.keys(room.players).filter(p => room.players[p].connected && !room.players[p].isSpectator);
    if (players.every(p => room.tierlist.votes[p])) {
      // Tally
      const tally = {};
      players.forEach(p => { tally[p] = 0; });
      Object.values(room.tierlist.votes).forEach(t => { if (tally[t] !== undefined) tally[t]++; });
      const maxVotes = Math.max(...Object.values(tally));
      const winners = players.filter(p => tally[p] === maxVotes);
      // Award point (split on tie)
      winners.forEach(w => { room.tierlist.scores[w] = (room.tierlist.scores[w] || 0) + 1; });
      room.tierlist.winner = winners;
      room.tierlist.tally = tally;
      room.tierlist.phase = 'result';
      broadcastRoom(code);
    }
  });

  // Host opens vote phase (after everyone reviewed)
  socket.on('tierlist:openVote', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name || room.tierlist?.phase !== 'reveal') return;
    room.tierlist.phase = 'vote';
    room.tierlist.votes = {};
    broadcastRoom(code);
  });

  // Host starts next round or ends game
  socket.on('tierlist:next', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    // Check if someone hit 10 points
    const scores = room.tierlist.scores;
    const champion = Object.entries(scores).find(([, s]) => s >= 10);
    if (champion) {
      room.tierlist.phase = 'champion';
      broadcastRoom(code);
    } else {
      // Next round
      room.phase = 'lobby';
      room.tierlist.phase = 'idle';
      broadcastRoom(code);
    }
  });

  // Return to lobby from tierlist
  socket.on('tierlist:reset', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    room.phase = 'lobby';
    if (room.tierlist) room.tierlist.phase = 'idle';
    broadcastRoom(code);
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
