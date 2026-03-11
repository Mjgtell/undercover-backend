const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ═══════════════════════════════════════
//  80+ ANIME PAIRS
// ═══════════════════════════════════════
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
    { civilian:'Kaori Miyazono', undercover:'Anohana Menma', anime1:'Your Lie in April', anime2:'AnoHana', hint:'Filles lumineuses au destin tragique' },
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
    { civilian:'Haruichi Kominato', undercover:'Eijun Sawamura', anime1:'Diamond no Ace', anime2:'Diamond no Ace', hint:'Coéquipiers de baseball aux styles contrastés' },
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

function getRandomPair(genre) {
  const list = PAIRS[genre] || PAIRS.mix;
  return list[Math.floor(Math.random() * list.length)];
}

// ═══════════════════════════════════════
//  ROOMS
// ═══════════════════════════════════════
const rooms = {};

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

function sanitizeRoom(room) {
  const r = { ...room, players: {} };
  for (const [n, p] of Object.entries(room.players)) {
    r.players[n] = { connected: p.connected, eliminated: p.eliminated, ready: p.ready };
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

// ═══════════════════════════════════════
//  JIKAN IMAGE FETCH
// ═══════════════════════════════════════
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

// ═══════════════════════════════════════
//  HEALTH
// ═══════════════════════════════════════
app.get('/', (_, res) => res.send('Undercover Anime Backend OK ✅'));

// ═══════════════════════════════════════
//  SOCKET EVENTS
// ═══════════════════════════════════════
io.on('connection', (socket) => {

  socket.on('room:create', ({ name, genre, mrWhite }) => {
    let code; do { code = genCode(); } while (rooms[code]);
    rooms[code] = { code, genre, mrWhite, host: name, phase: 'lobby',
      players: { [name]: { socketId: socket.id, connected: true, eliminated: false, ready: false } },
      assignments: {}, wordPair: null, round: 1, words: {}, mrWhiteGuessPhase: false };
    socket.join(code); socket.data = { name, code };
    socket.emit('room:joined', { code, name, isHost: true });
    broadcastRoom(code);
  });

  socket.on('room:join', ({ name, code }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error', 'Salle introuvable !');
    if (room.phase !== 'lobby') return socket.emit('error', 'Partie déjà en cours !');
    if (room.players[name]?.connected) return socket.emit('error', 'Ce prénom est déjà pris !');
    room.players[name] = { socketId: socket.id, connected: true, eliminated: false, ready: false };
    socket.join(code); socket.data = { name, code };
    socket.emit('room:joined', { code, name, isHost: room.host === name });
    broadcastRoom(code);
    io.to(code).emit('toast', `${name} a rejoint !`);
  });

  socket.on('disconnect', () => {
    const { name, code } = socket.data || {};
    if (!name || !code || !rooms[code]) return;
    const room = rooms[code];
    if (room.players[name]) room.players[name].connected = false;
    if (room.host === name && room.phase === 'lobby') {
      const other = Object.entries(room.players).find(([n,p]) => n !== name && p.connected);
      if (other) { room.host = other[0]; const s = findSocket(other[0], code); if (s) s.emit('room:promoted', { isHost: true }); }
      else { delete rooms[code]; return; }
    }
    broadcastRoom(code);
    io.to(code).emit('toast', `${name} s'est déconnecté`);
  });

  socket.on('room:reconnect', ({ name, code }) => {
    const room = rooms[code];
    if (!room || !room.players[name]) return socket.emit('error', 'Session introuvable');
    room.players[name].socketId = socket.id;
    room.players[name].connected = true;
    socket.join(code); socket.data = { name, code };
    socket.emit('room:joined', { code, name, isHost: room.host === name });
    if (room.assignments?.[name]) socket.emit('your:assignment', room.assignments[name]);
    broadcastRoom(code);
    io.to(code).emit('toast', `${name} s'est reconnecté !`);
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
    if (Object.keys(room.players).length === 0) { delete rooms[code]; return; }
    if (room.host === name) {
      const next = Object.entries(room.players).find(([,p]) => p.connected);
      if (next) { room.host = next[0]; const s = findSocket(next[0], code); if (s) s.emit('room:promoted', { isHost: true }); }
    }
    broadcastRoom(code);
    io.to(code).emit('toast', `${name} a quitté`);
  });

  socket.on('game:start', async ({ genre, mrWhite }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;

    io.to(code).emit('toast', '🎲 Génération de la partie…');

    const pair = getRandomPair(genre || room.genre);

    // Fetch images in parallel
    const [img1, img2] = await Promise.all([
      fetchCharImage(pair.civilian, pair.anime1),
      fetchCharImage(pair.undercover, pair.anime2),
    ]);
    pair.civilianImg = img1;
    pair.undercoverImg = img2;

    const players = Object.keys(room.players).filter(p => room.players[p].connected);
    const mrwEnabled = (mrWhite !== undefined ? mrWhite : room.mrWhite) && players.length >= 5;
    const shuffled = [...players].sort(() => Math.random() - .5);
    const assignments = {};
    shuffled.forEach((p, i) => {
      if (i === 0) assignments[p] = { role:'undercover', word:pair.undercover, image:pair.undercoverImg };
      else if (i === 1 && mrwEnabled) assignments[p] = { role:'mr-white', word:null, image:null };
      else assignments[p] = { role:'civilian', word:pair.civilian, image:pair.civilianImg };
    });

    room.wordPair = pair; room.assignments = assignments;
    room.phase = 'reveal'; room.round = 1; room.words = {}; room.mrWhiteGuessPhase = false;
    Object.keys(room.players).forEach(p => { room.players[p].ready = false; });

    shuffled.forEach(pName => {
      const ps = findSocket(pName, code);
      if (ps) ps.emit('your:assignment', assignments[pName]);
    });
    broadcastRoom(code);
  });

  socket.on('player:ready', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room) return;
    room.players[name].ready = true;
    broadcastRoom(code);
    const connected = Object.entries(room.players).filter(([,p]) => p.connected && !p.eliminated);
    if (connected.every(([,p]) => p.ready) && room.phase === 'reveal') {
      room.phase = 'playing'; broadcastRoom(code);
    }
  });

  socket.on('word:submit', ({ word }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'playing') return;
    const rk = `round${room.round}`;
    if (!room.words[rk]) room.words[rk] = {};
    room.words[rk][name] = word.trim().substring(0, 40);
    broadcastRoom(code);
    const alive = getAlive(room);
    if (alive.length > 0 && alive.every(n => room.words[rk][n])) {
      io.to(code).emit('words:all_submitted', { round: room.round, words: room.words[rk] });
    }
  });

  socket.on('vote:eliminate', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name || room.phase !== 'playing') return;
    eliminatePlayer(room, target, code);
  });

  socket.on('mrwhite:guess', ({ guess }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || !room.mrWhiteGuessPhase) return;
    room.mrWhiteGuessPhase = false;
    const isCorrect = guess.toLowerCase().trim() === room.wordPair?.civilian?.toLowerCase().trim();
    endGame(room, code, isCorrect ? 'mrwhite-wins' : 'civilians-win');
  });

  socket.on('game:reset', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    room.phase = 'lobby'; room.assignments = {}; room.wordPair = null;
    room.words = {}; room.round = 1; room.mrWhiteGuessPhase = false;
    Object.keys(room.players).forEach(p => { room.players[p].ready = false; room.players[p].eliminated = false; });
    broadcastRoom(code);
  });

});

// ═══════════════════════════════════════
//  GAME LOGIC
// ═══════════════════════════════════════
function eliminatePlayer(room, target, code) {
  room.players[target].eliminated = true;
  const role = room.assignments[target]?.role;
  io.to(code).emit('toast', `💀 ${target} est éliminé !`);

  const alive = getAlive(room);
  const aliveRoles = alive.map(n => room.assignments[n]?.role);
  const undercoverAlive = aliveRoles.includes('undercover');
  const mrWhiteAlive = aliveRoles.includes('mr-white');
  const civilianCount = aliveRoles.filter(r => r === 'civilian').length;

  if (role === 'undercover') {
    if (mrWhiteAlive) {
      room.mrWhiteGuessPhase = true;
      broadcastRoom(code);
      const mrwName = Object.entries(room.assignments).find(([,a]) => a.role === 'mr-white')?.[0];
      const mrwSocket = mrwName ? findSocket(mrwName, code) : null;
      if (mrwSocket) mrwSocket.emit('mrwhite:your_turn');
    } else { endGame(room, code, 'civilians-win'); }
  } else if (role === 'mr-white') {
    if (undercoverAlive) {
      room.round++; broadcastRoom(code);
      io.to(code).emit('toast', `${target} était Mr. White ! Continuez…`);
    } else { endGame(room, code, 'civilians-win'); }
  } else {
    if (!undercoverAlive && !mrWhiteAlive) { endGame(room, code, 'civilians-win'); }
    else if (civilianCount <= 1 && undercoverAlive) { endGame(room, code, 'undercover-wins'); }
    else if (civilianCount <= 1 && mrWhiteAlive) { endGame(room, code, 'mrwhite-wins'); }
    else {
      room.round++; broadcastRoom(code);
      io.to(code).emit('toast', `${target} était Civil. Tour suivant !`);
    }
  }
}

function endGame(room, code, outcome) {
  room.phase = 'result'; room.result = { outcome };
  broadcastRoom(code);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server on port ${PORT}`));
