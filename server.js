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
const BOT_THINK_DELAY = 2800; // ms before bot "responds" — feels human

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

  const system = `Tu joues à Undercover, un jeu de déduction.
Ton personnage secret est : ${character}
Tu dois donner UN SEUL MOT qui décrit subtilement ton personnage.

RÈGLE ABSOLUE : ne jamais dire le nom ou partie du nom du personnage.

STRATÉGIE (très important) :
- Tour 1-2 : donne un mot VAGUE et universel qui pourrait s'appliquer à beaucoup de personnages. Exemples : "combat", "force", "mystère", "regard", "silence". Évite les mots trop précis qui te grillent.
- Tour 3+ : tu peux être légèrement plus précis mais reste prudent.
- Observe les mots des autres pour rester cohérent sans te démarquer.
- UN SEUL MOT. Pas de phrase. Pas d'explication.`;

  const user = `Tour ${room.round}.
${otherWords ? `Mots déjà dits ce tour :\n${otherWords}\n` : 'Tu es le premier à parler ce tour.'}
${history ? `Historique :\n${history}` : ''}
Quel est ton mot ? Réponds avec UN SEUL MOT uniquement.`;

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

  const system = `Tu joues à Undercover. Ton personnage est : ${character}
Tu dois voter pour éliminer le joueur dont les mots te semblent les MOINS cohérents avec ton personnage.
Tu ne sais pas si tu es civil ou undercover — tu votes honnêtement selon ton analyse.
Réponds UNIQUEMENT avec le prénom exact du joueur à éliminer, rien d'autre.`;

  const user = `Voici les mots des autres joueurs :\n${wordSummary}\n\nQui votes-tu pour éliminer ? (un seul prénom)`;

  const answer = await callClaude(system, user);

  // Find the closest match to a valid player name
  const target = alive.find(n => answer && answer.toLowerCase().includes(n.toLowerCase()))
    || alive[Math.floor(Math.random() * alive.length)]; // fallback: random

  // Submit the vote
  const rk = `round${room.round}`;
  if (!room.votes[rk]) room.votes[rk] = {};
  room.votes[rk][botName] = target;
  room.players[botName].voted = true;
  broadcastRoom(code);
  io.to(code).emit('toast', `🤖 ${botName} a voté`);

  // Check if all have voted
  const aliveAll = getAlive(room);
  if (aliveAll.every(n => room.votes[rk][n])) {
    clearTimer(code);
    const tally = {};
    aliveAll.forEach(n => { tally[n] = 0; });
    Object.values(room.votes[rk]).forEach(t => { if (tally[t] !== undefined) tally[t]++; });
    const maxV = Math.max(...Object.values(tally));
    const tied = aliveAll.filter(n => tally[n] === maxV);
    if (tied.length === 1) {
      eliminatePlayer(room, tied[0], code);
    } else {
      io.to(code).emit('vote:tie', { tied, tally });
      broadcastRoom(code);
    }
  }
}

// Called when it's a bot's turn (word phase)
function scheduleBotTurn(room, code, botName) {
  if (!room.players[botName]?.isBot) return;
  io.to(code).emit('toast', `🤖 ${botName} réfléchit…`);
  setTimeout(() => botSubmitWord(room, code, botName), BOT_THINK_DELAY);
}

// Called when vote phase starts — bots vote after a delay
function scheduleBotVotes(room, code) {
  const bots = getAlive(room).filter(n => room.players[n]?.isBot);
  bots.forEach((botName, i) => {
    setTimeout(() => {
      if (room.phase === 'playing' && room.subPhase === 'vote' && !room.players[botName]?.voted) {
        botCastVote(room, code, botName);
      }
    }, BOT_THINK_DELAY + i * 1200);
  });
}


const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// ═══════════════════════════════
//  PAIRS DATABASE
// ═══════════════════════════════
const PAIRS = {
  shonen: [
    // Héros solaires qui sourient même dans la douleur, puissance née de la volonté pure
    { civilian:'Naruto Uzumaki', undercover:'Izuku Midoriya', anime1:'Naruto', anime2:'My Hero Academia', hint:'Héros rejetés devenus symboles d\'espoir' },
    // Deux garçons calmes, cheveux sombres, pouvoirs surnaturels liés à la mort, aura bleue/froide
    { civilian:'Tanjiro Kamado', undercover:'Yusuke Urameshi', anime1:'Demon Slayer', anime2:'Yu Yu Hakusho', hint:'Garçons bienveillants devenus chasseurs de démons' },
    // Deux rivaux froids, cheveux sombres dressés, regard intense, ego de guerrier
    { civilian:'Sasuke Uchiha', undercover:'Vegeta', anime1:'Naruto', anime2:'Dragon Ball Z', hint:'Rivaux orgueilleux obsédés par la puissance' },
    // Deux guerriers petits mais dévastateurs, regard d'acier, réputation de massacre
    { civilian:'Levi Ackerman', undercover:'Killua Zoldyck', anime1:'Attack on Titan', anime2:'Hunter x Hunter', hint:'Tueurs froids à la vitesse surhumaine' },
    // Deux capitaines fous, sourire constant, corps élastique/libre, vivent pour l'aventure
    { civilian:'Monkey D. Luffy', undercover:'Gon Freecss', anime1:'One Piece', anime2:'Hunter x Hunter', hint:'Garçons solaires à la force brute et pure' },
    // Deux êtres surpuissants décontractés, bras croisés, personne ne peut les toucher
    { civilian:'Gojo Satoru', undercover:'Saitama', anime1:'Jujutsu Kaisen', anime2:'One Punch Man', hint:'Les plus forts de leur monde, mais détachés' },
    // Deux protagonistes qui basculent dans la noirceur, transformation physique, perte d'humanité
    { civilian:'Eren Yeager', undercover:'Kaneki Ken', anime1:'Attack on Titan', anime2:'Tokyo Ghoul', hint:'Jeunes hommes consumés par leur propre monstre' },
    // Deux génies froids qui planifient tout, trahison/sacrifice, portent des masques émotionnels
    { civilian:'Itachi Uchiha', undercover:'Aizen Sosuke', anime1:'Naruto', anime2:'Bleach', hint:'Géniaux traîtres au sacrifice calculé' },
    // Deux porteurs d'un être destructeur en eux, corps impulsif, pouvoir incontrôlable
    { civilian:'Yuji Itadori', undercover:'Denji', anime1:'Jujutsu Kaisen', anime2:'Chainsaw Man', hint:'Hôtes d\'une entité dévastatrice' },
    // Deux petits protagonistes blonds, amputés ou marqués, alchimie vs magie, quête de rédemption
    { civilian:'Edward Elric', undercover:'Asta', anime1:'Fullmetal Alchemist', anime2:'Black Clover', hint:'Petits blondins déterminés malgré tout' },
    // Deux antagonistes ultimes, aristocratiques, pouvoirs de régénération absolue
    { civilian:'Ryomen Sukuna', undercover:'Muzan Kibutsuji', anime1:'Jujutsu Kaisen', anime2:'Demon Slayer', hint:'Rois des démons quasi-immortels' },
    // Deux guerriers rouges au feu, cheveux vifs, chaleur et impulsivité
    { civilian:'Natsu Dragneel', undercover:'Portgas D. Ace', anime1:'Fairy Tail', anime2:'One Piece', hint:'Utilisateurs de flammes aux cheveux sombres' },
    // Deux hommes au regard impassible, masque/chapeau, enseignent en cachant leur vraie force
    { civilian:'Kakashi Hatake', undercover:'Aizawa Shouta', anime1:'Naruto', anime2:'My Hero Academia', hint:'Profs nonchalants qui cachent une puissance réelle' },
  ],

  fantasy: [
    // Deux épéistes solitaires dans un monde de jeu/donjon, noirs vêtus, yeux vides mais déterminés
    { civilian:'Kirito', undercover:'Bell Cranel', anime1:'Sword Art Online', anime2:'DanMachi', hint:'Épéistes solitaires progressant dans un donjon' },
    // Deux isekai qui souffrent à répétition, réinitialisations/revivre la mort, psychologie brisée
    { civilian:'Subaru Natsuki', undercover:'Naofumi Iwatani', anime1:'Re:Zero', anime2:'Shield Hero', hint:'Isekai traités injustement qui repartent de zéro' },
    // Deux seigneurs tout-puissants dans un monde fantastique, froids, manipulateurs mais complexes
    { civilian:'Ainz Ooal Gown', undercover:'Lelouch vi Britannia', anime1:'Overlord', anime2:'Code Geass', hint:'Stratèges masqués qui jouent aux échecs avec des vies' },
    // Deux filles mystérieuses non-humaines, longues tresses, regard distant, découvrent les émotions
    { civilian:'Zero Two', undercover:'Violet Evergarden', anime1:'Darling in the FranXX', anime2:'Violet Evergarden', hint:'Filles hybrides qui apprennent à être humaines' },
    // Deux magiciens overpowered réincarnés, vie précédente de gamer, nouveau monde de magie
    { civilian:'Rudeus Greyrat', undercover:'Rimuru Tempest', anime1:'Mushoku Tensei', anime2:'Tensura', hint:'Réincarnés overpowered qui construisent leur empire' },
    // Deux filles-renard, oreilles et queue, loyales et espièles, lien fort avec leur compagnon
    { civilian:'Holo', undercover:'Raphtalia', anime1:'Spice & Wolf', anime2:'Shield Hero', hint:'Bêtes-humaines loyales à leur partenaire' },
    // Deux stratèges cérébaux bloqués dans un monde de jeu, lunettes ou regard calculateur
    { civilian:'Shiroe', undercover:'Sora', anime1:'Log Horizon', anime2:'No Game No Life', hint:'Gamers stratèges qui dominent leur monde' },
    // Deux héroïnes cheveux bleus, calmes, dévouées, pouvoirs de glace ou d'eau
    { civilian:'Rem', undercover:'Aqua', anime1:'Re:Zero', anime2:'KonoSuba', hint:'Filles aux pouvoirs de froid/eau dans un isekai' },
    // Deux chevaliers en armure, sens de l'honneur absolu, servent leur maître corps et âme
    { civilian:'Saber', undercover:'Erza Scarlet', anime1:'Fate/stay night', anime2:'Fairy Tail', hint:'Guerrières en armure à l\'honneur inflexible' },
    // Deux protagonistes isekai comiques, malchanceux mais débrouillards
    { civilian:'Kazuma Sato', undercover:'Hajime Nagumo', anime1:'KonoSuba', anime2:'Arifureta', hint:'Isekai rejetés par leur équipe qui s\'en sortent quand même' },
  ],

  action: [
    // Deux détectives génies opposés, l'un assis bizarrement, l'autre debout, guerre psychologique
    { civilian:'L Lawliet', undercover:'Shikamaru Nara', anime1:'Death Note', anime2:'Naruto', hint:'Génies paresseux en apparence, redoutables en vrai' },
    // Deux tireurs d'élite froids, visage émacié, yeux enfoncés, silhouette longiligne
    { civilian:'Aizen Sosuke', undercover:'Griffith', anime1:'Bleach', anime2:'Berserk', hint:'Anges déchus au plan millénaire et au sourire glacial' },
    // Deux guerriers solitaires en noir, cicatrices, code moral strict, combattent seuls
    { civilian:'Zoro', undercover:'Guts', anime1:'One Piece', anime2:'Berserk', hint:'Combattants à l\'épée solitaires et marqués' },
    // Deux antagonistes au sourire diabolique, manipulation, société corrompue = leur terrain
    { civilian:'Shigaraki Tomura', undercover:'Griffith', anime1:'My Hero Academia', anime2:'Berserk', hint:'Antagonistes qui veulent détruire l\'ordre établi' },
    // Deux exorcistes aux pouvoirs rares, cheveux sombres, austères, techniques spéciales
    { civilian:'Megumi Fushiguro', undercover:'Byakuya Kuchiki', anime1:'Jujutsu Kaisen', anime2:'Bleach', hint:'Guerriers aristocratiques froids aux pouvoirs de convocation' },
    // Deux pyrokinésistes militaires ambitieux, rouge/flamme, père absent ou ennemi
    { civilian:'Roy Mustang', undercover:'Endeavor', anime1:'Fullmetal Alchemist', anime2:'My Hero Academia', hint:'Héros pyrokinésistes ambitieux et mauvais pères' },
    // Deux femmes soldats ultimes, cheveux courts, pragmatiques, corps modifié
    { civilian:'Mikasa Ackerman', undercover:'Motoko Kusanagi', anime1:'Attack on Titan', anime2:'Ghost in the Shell', hint:'Soldates froides au corps modifié, protègent leur prochain' },
    // Deux piliers calmes, cheveux longs ou attachés, technique parfaite, disent peu
    { civilian:'Giyu Tomioka', undercover:'Neji Hyuga', anime1:'Demon Slayer', anime2:'Naruto', hint:'Combattants d\'élite froids au style technique parfait' },
    // Deux petits psychiques, expression neutre, destruction à distance sans effort
    { civilian:'Mob', undercover:'Tatsumaki', anime1:'Mob Psycho 100', anime2:'One Punch Man', hint:'Psychiques overpowered qui semblent absents' },
    // Deux anti-héros aux pouvoirs de destruction totale, isolés, incompris
    { civilian:'Accelerator', undercover:'Hisoka Morow', anime1:'A Certain Magical Index', anime2:'Hunter x Hunter', hint:'Êtres supérieurs dérangés qui cherchent une vraie bataille' },
  ],

  romance: [
    // Deux tsundere blondes explos, petite taille complexée, tombe amoureuse malgré elle
    { civilian:'Taiga Aisaka', undercover:'Erina Nakiri', anime1:'Toradora', anime2:'Shokugeki no Soma', hint:'Blondes hautaines au cœur tendre caché' },
    // Deux garçons cyniques mal dans leur peau, monologue intérieur acéré, rejet du monde
    { civilian:'Hachiman Hikigaya', undercover:'Rei Kiriyama', anime1:'OreGairu', anime2:'March Comes in Like a Lion', hint:'Solitaires intelligents qui observent sans participer' },
    // Deux prodiges musicaux traumatisés par leur mère, doigts qui tremblent, larmes sur les touches
    { civilian:'Kousei Arima', undercover:'Shinichi Chiaki', anime1:'Your Lie in April', anime2:'Nodame Cantabile', hint:'Pianistes prodiges brisés qui se reconstruisent' },
    // Deux filles discrètes blessées par le passé, communication difficile, lien inattendu
    { civilian:'Shouko Nishimiya', undercover:'Mei Tachibana', anime1:'A Silent Voice', anime2:'Say I Love You', hint:'Filles solitaires qui apprennent la confiance' },
    // Deux garçons ordinaires qui se sacrifient pour leur amour, maladroits mais sincères
    { civilian:'Shoya Ishida', undercover:'Takeo Goda', anime1:'A Silent Voice', anime2:'My Love Story', hint:'Garçons brisés qui se rachètent par amour sincère' },
    // Deux filles solaires au destin tragique, apportent la lumière puis disparaissent
    { civilian:'Kaori Miyazono', undercover:'Menma', anime1:'Your Lie in April', anime2:'AnoHana', hint:'Filles lumineuses arrachées trop tôt' },
    // Deux couples fusionnels bizarre-normal, l'un étrange, l'autre grounded
    { civilian:'Tohru Honda', undercover:'Oreki Houtarou', anime1:'Fruits Basket', anime2:'Hyouka', hint:'Personnages lumineux/sombres qui s\'équilibrent' },
    // Deux garçons introvertis tatoués ou marqués, cachent une vraie tendresse
    { civilian:'Miyamura Izumi', undercover:'Nishikata', anime1:'Horimiya', anime2:'Karakai Jouzu no Takagi-san', hint:'Garçons introvertis qui s\'ouvrent à une seule personne' },
    // Deux filles espionnes ou doubles visages, adorables dehors, calculatrices dedans
    { civilian:'Yor Forger', undercover:'Himeno', anime1:'Spy x Family', anime2:'Chainsaw Man', hint:'Femmes douces en apparence, tueuses de métier' },
    // Deux romances interclasses, différence de statut, tension entre devoir et sentiment
    { civilian:'Kaguya Shinomiya', undercover:'Yukino Yukinoshita', anime1:'Kaguya-sama', anime2:'OreGairu', hint:'Héritières froides qui tombent amoureuses malgré leur fierté' },
  ],

  sports: [
    // Deux petits joueurs discrets, visibles seulement à l'impact, changent les matchs en secret
    { civilian:'Shoyo Hinata', undercover:'Tetsuya Kuroko', anime1:'Haikyuu', anime2:'Kuroko Basketball', hint:'Petits joueurs invisibles au grand impact' },
    // Deux génies froids qui commandent le terrain, regard perçant, équipe obéit sans discuter
    { civilian:'Tobio Kageyama', undercover:'Seijuro Akashi', anime1:'Haikyuu', anime2:'Kuroko Basketball', hint:'Génies du terrain qui contrôlent tout' },
    // Deux attaquants au tir dévastateur, égoïstes assumés, leur puissance est leur identité
    { civilian:'Yoichi Isagi', undercover:'Ryota Kise', anime1:'Blue Lock', anime2:'Kuroko Basketball', hint:'Attaquants offensifs avec une technique de copie/analyse' },
    // Deux boxeurs au style offensif brut, partis de rien, cœur de lion
    { civilian:'Ippo Makunouchi', undercover:'Joe Yabuki', anime1:'Hajime no Ippo', anime2:'Ashita no Joe', hint:'Boxeurs du peuple montant du bas par pur acharnement' },
    // Deux joueurs de raquette génies arrogants, aucun doute sur leur supériorité
    { civilian:'Ryoma Echizen', undercover:'Eiichirou Maruo', anime1:'Prince of Tennis', anime2:'Baby Steps', hint:'Adolescents au talent brut qui dominent la raquette' },
    // Deux pivots physiques impressionnants, présence brute, ancre de l'équipe
    { civilian:'Takenori Akagi', undercover:'Ushijima Wakatoshi', anime1:'Slam Dunk', anime2:'Haikyuu', hint:'Piliers physiques intransigeants et imposants' },
    // Deux ace solitaires au shoot parfait, peu loquaces, résultats parlent
    { civilian:'Eijun Sawamura', undercover:'Furuya Satoru', anime1:'Diamond no Ace', anime2:'Diamond no Ace', hint:'Lanceurs opposés, gauche vs droite, feu vs glace' },
    // Deux outsiders qui redéfinissent leur sport par la donnée/l'analyse
    { civilian:'Wataru Kuramochi', undercover:'Hanamichi Sakuragi', anime1:'Diamond no Ace', anime2:'Slam Dunk', hint:'Athlètes bruyants à l\'énergie débordante mais maladroits' },
    // Deux duos de sport de glisse/vitesse, style élégant, perfection technique
    { civilian:'Yuri Katsuki', undercover:'Noya Libero', anime1:'Yuri on Ice', anime2:'Haikyuu', hint:'Petits gabarits aux réflexes parfaits, techniques de précision' },
    // Deux génie de mur défensif, leur valeur niée, finissent essentiels
    { civilian:'Seishiro Nagi', undercover:'Reo Mikage', anime1:'Blue Lock', anime2:'Blue Lock', hint:'Duo Blue Lock : le génie brut et le stratège raffiné' },
  ],

  mix: [
    // Deux génies de la manipulation, assis bizarrement, tout le monde est leur pion
    { civilian:'L Lawliet', undercover:'Shikamaru Nara', anime1:'Death Note', anime2:'Naruto', hint:'Génies paresseux qui voient 10 coups d\'avance' },
    // Deux protagonistes qui jouent à être des dieux, notes de mort/géass, condamnés par leur propre arme
    { civilian:'Light Yagami', undercover:'Lelouch vi Britannia', anime1:'Death Note', anime2:'Code Geass', hint:'Justiciers déchus qui se prennent pour des dieux' },
    // Deux cowboys de l'espace détachés, cigarette/posture, passé qu'ils fuient
    { civilian:'Spike Spiegel', undercover:'Vash the Stampede', anime1:'Cowboy Bebop', anime2:'Trigun', hint:'Tireurs vagabonds au passé douloureux et au sourire triste' },
    // Deux femmes cyborgs/soldates froides, cheveux courts, efficacité pure
    { civilian:'Motoko Kusanagi', undercover:'Revy', anime1:'Ghost in the Shell', anime2:'Black Lagoon', hint:'Femmes armées froides et cyniques au corps de combat' },
    // Deux protagonistes ordinaires dans des situations de mort extraordinaires, ni super ni chanceux
    { civilian:'Shinji Ikari', undercover:'Makoto Naegi', anime1:'Evangelion', anime2:'Danganronpa', hint:'Garçons ordinaires jetés dans un monde qui veut les tuer' },
    // Deux esprits/dieux mineurs, sombres, pouvoirs de vitesse/ombre, font peur mais cachent un cœur
    { civilian:'Yato', undercover:'Hiei', anime1:'Noragami', anime2:'Yu Yu Hakusho', hint:'Esprits sombres et rapides au cœur insoupçonné' },
    // Deux inventeurs fous du temps/dimension, monologue intérieur de génie, incompris de tous
    { civilian:'Rintaro Okabe', undercover:'Senku Ishigami', anime1:'Steins;Gate', anime2:'Dr. Stone', hint:'Génies scientifiques dramatiques qui sauvent l\'humanité' },
    // Deux magical girls contrairement au cliché, uniforme sombre, pouvoirs lourds à porter
    { civilian:'Homura Akemi', undercover:'Satsuki Kiryuin', anime1:'Puella Magi Madoka', anime2:'Kill la Kill', hint:'Guerrières froides au plan sacrificiel secret' },
    // Deux protagonistes JoJo au calme intimidant, étudiants en apparence
    { civilian:'Jotaro Kujo', undercover:'Giorno Giovanna', anime1:'JoJo Part 3', anime2:'JoJo Part 5', hint:'Protagonistes JoJo au calme glacial et au style parfait' },
    // Deux génies solitaires du jeu, capables de tout retourner seuls
    { civilian:'Sora', undercover:'Ayanokoji Kiyotaka', anime1:'No Game No Life', anime2:'Classroom of the Elite', hint:'Génies qui jouent à perdre pour mieux gagner' },
    // Deux combattants petits mais hyper rapides, armés de lames, regard vide
    { civilian:'Levi Ackerman', undercover:'Zoro', anime1:'Attack on Titan', anime2:'One Piece', hint:'Combattants à la lame les plus forts de leur équipe' },
    // Deux figures paternelles brisées, force monstrueuse, portent le deuil de quelqu'un
    { civilian:'Guts', undercover:'Thorfinn', anime1:'Berserk', anime2:'Vinland Saga', hint:'Guerriers nordiques/médiévaux consumés par la vengeance' },
    // Deux antagonistes au sourire bienveillant qui cache l'horreur
    { civilian:'Griffith', undercover:'Mahito', anime1:'Berserk', anime2:'Jujutsu Kaisen', hint:'Beaux visages qui dissimulent un vide total d\'humanité' },
    // Deux filles magiques légères qui cachent une puissance catastrophique
    { civilian:'Usagi Tsukino', undercover:'Nanoha Takamachi', anime1:'Sailor Moon', anime2:'Magical Girl Lyrical Nanoha', hint:'Magical girls au canon surpuissant et au cœur d\'or' },
  ]
};

// Generate blocked words from character name (normalized tokens)
function getBlockedWords(name) {
  if (!name) return [];
  return name.toLowerCase()
    .replace(/[^a-zàâäéèêëîïôùûü\s]/gi, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function getRandomPair(genre) {
  const list = PAIRS[genre] || PAIRS.mix;
  return { ...list[Math.floor(Math.random() * list.length)] };
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
      }
      r.currentTurnIndex++;
      const allDone = aliveTurnOrder.every(n => r.words[rk][n]);
      if (allDone) {
        const votingLocked = r.round < (r.votingUnlockedAtRound || 2);
        if (votingLocked) {
          io.to(code).emit('toast', `Tour ${r.round} terminé — tour ${r.round + 1} !`);
          broadcastRoom(code);
          setTimeout(() => nextRound(r, code), 1400);
        } else {
          r.subPhase = 'vote';
          broadcastRoom(code);
          scheduleBotVotes(r, code);
          startTimer(code, VOTE_TIMER_SECS, 'vote');
        }
      } else {
        const nextPlayer = aliveTurnOrder[r.currentTurnIndex % aliveTurnOrder.length];
        broadcastRoom(code);
        io.to(code).emit('turn:next', { player: nextPlayer });
        startTimer(code, WORD_TIMER_SECS, 'words');
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
//  JIKAN
// ═══════════════════════════════
async function fetchCharImage(charName, animeName) {
  try {
    const q = encodeURIComponent(charName);
    const resp = await fetch(`https://api.jikan.moe/v4/characters?q=${q}&limit=5`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.data?.length) return null;
    let best = data.data[0];
    const animeWord = animeName.toLowerCase().split(' ')[0];
    for (const c of data.data) {
      if ((c.anime||[]).some(a => a.anime?.title?.toLowerCase().includes(animeWord))) { best = c; break; }
    }
    return best.images?.webp?.image_url || best.images?.jpg?.image_url || null;
  } catch { return null; }
}

// ═══════════════════════════════
//  HEALTH + PING (anti-sleep)
// ═══════════════════════════════
app.get('/', (_, res) => res.send('Undercover Anime Backend OK ✅'));
app.get('/ping', (_, res) => res.json({ ok: true, ts: Date.now() }));

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
    const { name, code } = socket.data || {};
    if (!name || !code || !rooms[code]) return;
    const room = rooms[code];
    if (room.players[name]) room.players[name].connected = false;
    if (room.host === name && room.phase === 'lobby') {
      const other = Object.entries(room.players).find(([n,p]) => n !== name && p.connected);
      if (other) { room.host = other[0]; findSocket(other[0], code)?.emit('room:promoted', { isHost: true }); }
      else { clearTimer(code); delete rooms[code]; return; }
    }
    broadcastRoom(code);
    io.to(code).emit('toast', `${name} s'est déconnecté`);
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
    const [img1, img2] = await Promise.all([
      fetchCharImage(pair.civilian, pair.anime1),
      fetchCharImage(pair.undercover, pair.anime2),
    ]);
    pair.civilianImg = img1;
    pair.undercoverImg = img2;

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
    Object.keys(room.players).forEach(p => { room.players[p].ready = room.players[p].isSpectator; room.players[p].voted = false; });

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
    const allDone = newAliveTurnOrder.every(n => room.words[rk][n]);

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

    // Check majority
    const alive = getAlive(room);
    const submitted = Object.keys(room.votes[rk] || {});
    if (alive.every(n => submitted.includes(n))) {
      clearTimer(code);
      // Tally votes
      const tally = {};
      alive.forEach(n => { tally[n] = 0; });
      Object.values(room.votes[rk]).forEach(t => { if (tally[t] !== undefined) tally[t]++; });
      const maxVotes = Math.max(...Object.values(tally));
      const tied = alive.filter(n => tally[n] === maxVotes);

      if (tied.length === 1) {
        eliminatePlayer(room, tied[0], code);
      } else {
        // Tie — broadcast and let host decide
        io.to(code).emit('vote:tie', { tied, tally });
        broadcastRoom(code);
      }
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
      else { room.players[p].ready = false; room.players[p].eliminated = false; room.players[p].voted = false; }
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
  const rk = `round${room.round}`;
  room.words[rk] = {};
  room.votes[rk] = {};
  Object.keys(room.players).forEach(p => { room.players[p].voted = false; });
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
server.listen(PORT, () => console.log(`✅ Undercover Anime backend on port ${PORT}`));
