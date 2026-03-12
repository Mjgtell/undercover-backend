const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

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
    { civilian:'Naruto Uzumaki', undercover:'Izuku Midoriya', anime1:'Naruto', anime2:'My Hero Academia', hint:'Héros déterminés partis de rien' },
    { civilian:'Goku', undercover:'Saitama', anime1:'Dragon Ball Z', anime2:'One Punch Man', hint:'Guerriers surpuissants qui adorent se battre' },
    { civilian:'Monkey D. Luffy', undercover:'Asta', anime1:'One Piece', anime2:'Black Clover', hint:'Capitaines fous qui veulent être les meilleurs' },
    { civilian:'Levi Ackerman', undercover:'Zoro', anime1:'Attack on Titan', anime2:'One Piece', hint:'Combattants froids et ultra-compétents' },
    { civilian:'Tanjiro Kamado', undercover:'Zenitsu Agatsuma', anime1:'Demon Slayer', anime2:'Demon Slayer', hint:'Pourfendeurs de démons dans la même troupe' },
    { civilian:'Itachi Uchiha', undercover:'Aizen Sosuke', anime1:'Naruto', anime2:'Bleach', hint:'Géniaux traîtres au plan caché' },
    { civilian:'Sasuke Uchiha', undercover:'Vegeta', anime1:'Naruto', anime2:'Dragon Ball Z', hint:'Rivaux orgueilleux du héros principal' },
    { civilian:'Edward Elric', undercover:'Alphonse Elric', anime1:'Fullmetal Alchemist', anime2:'Fullmetal Alchemist', hint:'Frères alchimistes en quête de rédemption' },
    { civilian:'Ichigo Kurosaki', undercover:'Yusuke Urameshi', anime1:'Bleach', anime2:'Yu Yu Hakusho', hint:'Ados avec des pouvoirs de l\'au-delà' },
    { civilian:'Killua Zoldyck', undercover:'Feitan', anime1:'Hunter x Hunter', anime2:'Hunter x Hunter', hint:'Assassins froids aux réflexes surhumains' },
    { civilian:'Yuji Itadori', undercover:'Denji', anime1:'Jujutsu Kaisen', anime2:'Chainsaw Man', hint:'Porteurs d\'un démon intérieur dévastateur' },
    { civilian:'Eren Yeager', undercover:'Kaneki Ken', anime1:'Attack on Titan', anime2:'Tokyo Ghoul', hint:'Protagonistes qui basculent dans la noirceur' },
    { civilian:'Natsu Dragneel', undercover:'Ace Portgas', anime1:'Fairy Tail', anime2:'One Piece', hint:'Utilisateurs de feu aux cheveux flashy' },
    { civilian:'Gon Freecss', undercover:'Meruem', anime1:'Hunter x Hunter', anime2:'Hunter x Hunter', hint:'Êtres purs aux capacités hors normes' },
    { civilian:'Ryomen Sukuna', undercover:'Muzan Kibutsuji', anime1:'Jujutsu Kaisen', anime2:'Demon Slayer', hint:'Grands antagonistes quasi-immortels' },
    { civilian:'Gojo Satoru', undercover:'Kakashi Hatake', anime1:'Jujutsu Kaisen', anime2:'Naruto', hint:'Sensei masqués les plus puissants de leur univers' },
    { civilian:'Shanks', undercover:'Whitebeard', anime1:'One Piece', anime2:'One Piece', hint:'Empereurs de la mer au charisme légendaire' },
  ],
  fantasy: [
    { civilian:'Kirito', undercover:'Bell Cranel', anime1:'Sword Art Online', anime2:'DanMachi', hint:'Épéistes solitaires dans un monde de jeu' },
    { civilian:'Subaru Natsuki', undercover:'Naofumi Iwatani', anime1:'Re:Zero', anime2:'Shield Hero', hint:'Isekai protagonistes qui souffrent beaucoup' },
    { civilian:'Ainz Ooal Gown', undercover:'Rimuru Tempest', anime1:'Overlord', anime2:'Tensura', hint:'Overpowered dans un monde fantastique' },
    { civilian:'Rudeus Greyrat', undercover:'Kazuma Sato', anime1:'Mushoku Tensei', anime2:'KonoSuba', hint:'Réincarnés dans un monde de magie' },
    { civilian:'Emilia', undercover:'Rem', anime1:'Re:Zero', anime2:'Re:Zero', hint:'Héroïnes de Re:Zero aux pouvoirs magiques' },
    { civilian:'Asuna Yuuki', undercover:'Eris', anime1:'Sword Art Online', anime2:'KonoSuba', hint:'Guerrières compétentes en monde fantaisie' },
    { civilian:'Zero Two', undercover:'Violet Evergarden', anime1:'Darling in the FranXX', anime2:'Violet Evergarden', hint:'Filles mystérieuses qui découvrent les émotions' },
    { civilian:'Shiroe', undercover:'Momonga', anime1:'Log Horizon', anime2:'Overlord', hint:'Stratèges bloqués dans un MMORPG' },
    { civilian:'Raphtalia', undercover:'Filo', anime1:'Shield Hero', anime2:'Shield Hero', hint:'Compagnes dévouées du héros bouclier' },
    { civilian:'Aqua', undercover:'Wiz', anime1:'KonoSuba', anime2:'KonoSuba', hint:'Magiciennes liées à l\'eau et aux esprits' },
  ],
  action: [
    { civilian:'Levi Ackerman', undercover:'Mikasa Ackerman', anime1:'Attack on Titan', anime2:'Attack on Titan', hint:'Guerriers Ackerman redoutables' },
    { civilian:'Megumi Fushiguro', undercover:'Yuta Okkotsu', anime1:'Jujutsu Kaisen', anime2:'Jujutsu Kaisen', hint:'Exorcistes calmes aux pouvoirs rares' },
    { civilian:'Gojo Satoru', undercover:'Whitebeard', anime1:'Jujutsu Kaisen', anime2:'One Piece', hint:'Les plus forts de leur univers' },
    { civilian:'Denji', undercover:'Power', anime1:'Chainsaw Man', anime2:'Chainsaw Man', hint:'Démons chaotiques qui aiment le sang' },
    { civilian:'Shigaraki Tomura', undercover:'Mahito', anime1:'My Hero Academia', anime2:'Jujutsu Kaisen', hint:'Antagonistes qui détruisent ce qu\'ils touchent' },
    { civilian:'Ken Kaneki', undercover:'Haise Sasaki', anime1:'Tokyo Ghoul', anime2:'Tokyo Ghoul', hint:'Même personnage deux identités' },
    { civilian:'Muichiro Tokito', undercover:'Giyu Tomioka', anime1:'Demon Slayer', anime2:'Demon Slayer', hint:'Piliers au regard vide et froid' },
    { civilian:'Ryuko Matoi', undercover:'Satsuki Kiryuin', anime1:'Kill la Kill', anime2:'Kill la Kill', hint:'Rivales en uniformes surpuissants' },
    { civilian:'Akame', undercover:'Esdeath', anime1:'Akame ga Kill', anime2:'Akame ga Kill', hint:'Tueuses redoutables à l\'épée' },
    { civilian:'Himeko Toga', undercover:'Dabi', anime1:'My Hero Academia', anime2:'My Hero Academia', hint:'Vilains instables avec un passé sombre' },
  ],
  romance: [
    { civilian:'Taiga Aisaka', undercover:'Chitoge Kirisaki', anime1:'Toradora', anime2:'Nisekoi', hint:'Tsundere au caractère explosif' },
    { civilian:'Ryuji Takasu', undercover:'Raku Ichijo', anime1:'Toradora', anime2:'Nisekoi', hint:'Garçons doux coincés dans des romances chaotiques' },
    { civilian:'Kousei Arima', undercover:'Rei Kiriyama', anime1:'Your Lie in April', anime2:'March Comes in Like a Lion', hint:'Prodiges solitaires au passé douloureux' },
    { civilian:'Tohru Honda', undercover:'Rikka Takanashi', anime1:'Fruits Basket', anime2:'Chunibyo', hint:'Filles étranges et attachantes' },
    { civilian:'Holo', undercover:'Raphtalia', anime1:'Spice & Wolf', anime2:'Shield Hero', hint:'Filles-renard loyales à leur compagnon' },
    { civilian:'Miyamura Izumi', undercover:'Handa Sei', anime1:'Horimiya', anime2:'Barakamon', hint:'Introvertis qui s\'épanouissent' },
    { civilian:'Shouko Nishimiya', undercover:'Mei Tachibana', anime1:'A Silent Voice', anime2:'Say I Love You', hint:'Filles discrètes qui apprennent à faire confiance' },
    { civilian:'Shoya Ishida', undercover:'Takeo Goda', anime1:'A Silent Voice', anime2:'My Love Story', hint:'Garçons maladroits qui se rachètent par amour' },
    { civilian:'Kaori Miyazono', undercover:'Menma', anime1:'Your Lie in April', anime2:'AnoHana', hint:'Filles lumineuses au destin tragique' },
    { civilian:'Kyo Sohma', undercover:'Yato', anime1:'Fruits Basket', anime2:'Noragami', hint:'Garçons brusques avec un secret douloureux' },
  ],
  sports: [
    { civilian:'Shoyo Hinata', undercover:'Tetsuya Kuroko', anime1:'Haikyuu', anime2:'Kuroko Basketball', hint:'Petits joueurs invisibles aux grands impacts' },
    { civilian:'Tobio Kageyama', undercover:'Seijuro Akashi', anime1:'Haikyuu', anime2:'Kuroko Basketball', hint:'Génies froids qui commandent leur équipe' },
    { civilian:'Yoichi Isagi', undercover:'Noel Noa', anime1:'Blue Lock', anime2:'Blue Lock', hint:'Stratèges du foot à l\'instinct dévastateur' },
    { civilian:'Ippo Makunouchi', undercover:'Takeshi Sendo', anime1:'Hajime no Ippo', anime2:'Hajime no Ippo', hint:'Boxeurs au style offensif dévastateur' },
    { civilian:'Ryoma Echizen', undercover:'Kunimitsu Tezuka', anime1:'Prince of Tennis', anime2:'Prince of Tennis', hint:'Génies du tennis au regard impassible' },
    { civilian:'Sakuragi Hanamichi', undercover:'Takenori Akagi', anime1:'Slam Dunk', anime2:'Slam Dunk', hint:'Piliers de Shohoku au caractère fort' },
    { civilian:'Tsubasa Ozora', undercover:'Kojiro Hyuga', anime1:'Captain Tsubasa', anime2:'Captain Tsubasa', hint:'Attaquants de foot au shoot surpuissant' },
    { civilian:'Yuri Katsuki', undercover:'Victor Nikiforov', anime1:'Yuri on Ice', anime2:'Yuri on Ice', hint:'Patineurs d\'élite au style élégant' },
    { civilian:'Seishiro Nagi', undercover:'Reo Mikage', anime1:'Blue Lock', anime2:'Blue Lock', hint:'Duo de Blue Lock aux styles opposés' },
    { civilian:'Eijun Sawamura', undercover:'Haruichi Kominato', anime1:'Diamond no Ace', anime2:'Diamond no Ace', hint:'Coéquipiers de baseball aux styles contrastés' },
  ],
  mix: [
    { civilian:'L Lawliet', undercover:'Lelouch vi Britannia', anime1:'Death Note', anime2:'Code Geass', hint:'Géniaux stratèges qui manipulent les autres' },
    { civilian:'Light Yagami', undercover:'Lelouch vi Britannia', anime1:'Death Note', anime2:'Code Geass', hint:'Protagonistes qui jouent à être des dieux' },
    { civilian:'Spike Spiegel', undercover:'Vash the Stampede', anime1:'Cowboy Bebop', anime2:'Trigun', hint:'Pistoleros cool avec un passé douloureux' },
    { civilian:'Motoko Kusanagi', undercover:'Revy', anime1:'Ghost in the Shell', anime2:'Black Lagoon', hint:'Femmes badass hyper-compétentes et cyniques' },
    { civilian:'Shikamaru Nara', undercover:'Ciel Phantomhive', anime1:'Naruto', anime2:'Black Butler', hint:'Stratèges froids qui manipulent l\'échiquier' },
    { civilian:'Saber', undercover:'Erza Scarlet', anime1:'Fate/stay night', anime2:'Fairy Tail', hint:'Guerrières en armure à l\'honneur inflexible' },
    { civilian:'Roy Mustang', undercover:'Endeavor', anime1:'Fullmetal Alchemist', anime2:'My Hero Academia', hint:'Héros pyrokinésistes ambitieux et froids' },
    { civilian:'Kakashi Hatake', undercover:'Aizawa Shouta', anime1:'Naruto', anime2:'My Hero Academia', hint:'Professeurs cools et légèrement nonchalants' },
    { civilian:'Jotaro Kujo', undercover:'Giorno Giovanna', anime1:'JoJo Part 3', anime2:'JoJo Part 5', hint:'Protagonistes JoJo au calme intimidant' },
    { civilian:'Dio Brando', undercover:'Kars', anime1:'JoJo Part 1/3', anime2:'JoJo Part 2', hint:'Antagonistes JoJo qui veulent l\'immortalité' },
    { civilian:'Rintaro Okabe', undercover:'Hachiman Hikigaya', anime1:'Steins;Gate', anime2:'OreGairu', hint:'Inadaptés sociaux au monologue intérieur riche' },
    { civilian:'Yato', undercover:'Hiei', anime1:'Noragami', anime2:'Yu Yu Hakusho', hint:'Esprits sombres au regard tranchant' },
    { civilian:'Shinji Ikari', undercover:'Makoto Naegi', anime1:'Evangelion', anime2:'Danganronpa', hint:'Garçons ordinaires dans des situations extrêmes' },
    { civilian:'Usagi Tsukino', undercover:'Nanoha Takamachi', anime1:'Sailor Moon', anime2:'Magical Girl Lyrical Nanoha', hint:'Magical girls qui défendent la Terre' },
    { civilian:'Edward Elric', undercover:'Roy Mustang', anime1:'Fullmetal Alchemist', anime2:'Fullmetal Alchemist', hint:'Alchimistes militaires aux objectifs liés' },
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
  const r = { ...room, players: {}, spectators: room.spectators || [] };
  for (const [n, p] of Object.entries(room.players)) {
    r.players[n] = { connected: p.connected, eliminated: p.eliminated, ready: p.ready, voted: p.voted, isSpectator: p.isSpectator || false };
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
      // Auto-submit empty for those who haven't
      const rk = `round${r.round}`;
      if (!r.words[rk]) r.words[rk] = {};
      getAlive(r).forEach(n => { if (!r.words[rk][n]) r.words[rk][n] = '…'; });
      io.to(code).emit('words:all_submitted', { round: r.round, words: r.words[rk] });
      r.subPhase = 'vote';
      broadcastRoom(code);
      startTimer(code, VOTE_TIMER_SECS, 'vote');
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
      broadcastRoom(code);
      if (room.settings.wordTimer) startTimer(code, WORD_TIMER_SECS, 'words');
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

    const trimmed = word.trim().substring(0, 40);

    // Check blocked words
    const myAssignment = room.assignments[name];
    const blocked = myAssignment?.blockedWords || [];
    const wordLower = trimmed.toLowerCase().replace(/[^a-zàâäéèêëîïôùûü]/gi, '');
    const isBlocked = blocked.some(b => wordLower.includes(b) || b.includes(wordLower));

    if (isBlocked) {
      // Auto-eliminate for cheating!
      socket.emit('word:blocked', { word: trimmed });
      io.to(code).emit('toast', `🚫 ${name} a dit le nom du perso — éliminé !`);
      eliminatePlayer(room, name, code);
      return;
    }

    room.words[rk][name] = trimmed;
    broadcastRoom(code);

    const alive = getAlive(room);
    if (alive.length > 0 && alive.every(n => room.words[rk][n])) {
      clearTimer(code);
      io.to(code).emit('words:all_submitted', { round: room.round });
      room.subPhase = 'vote';
      Object.keys(room.players).forEach(p => { room.players[p].voted = false; });
      broadcastRoom(code);
      if (room.settings.wordTimer) startTimer(code, VOTE_TIMER_SECS, 'vote');
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
    room.mrWhiteGuessPhase = false; room.subPhase = 'words';
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
  const rk = `round${room.round}`;
  room.words[rk] = {};
  room.votes[rk] = {};
  Object.keys(room.players).forEach(p => { room.players[p].voted = false; });
  broadcastRoom(code);
  if (room.settings?.wordTimer) startTimer(code, WORD_TIMER_SECS, 'words');
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
