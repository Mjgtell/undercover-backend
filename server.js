const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ═══════════════════════════════════════
//  IN-MEMORY ROOMS
// ═══════════════════════════════════════
// rooms[code] = {
//   code, host, genre, mrWhite,
//   phase: 'lobby' | 'playing' | 'result',
//   players: { name: { socketId, connected, eliminated, ready } },
//   assignments: { name: { role, word, image } },
//   wordPair: { civilian, undercover, anime1, anime2, hint },
//   round: 1,
//   words: { round1: { playerName: "word" } },   // mots écrits par tour
//   votes: { round1: { voterName: targetName } }, // votes
//   mrWhiteGuessPhase: false,
// }
const rooms = {};

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

function broadcastRoom(code) {
  if (!rooms[code]) return;
  io.to(code).emit('room:update', rooms[code]);
}

function getAlive(room) {
  return Object.entries(room.players)
    .filter(([,p]) => !p.eliminated && p.connected)
    .map(([n]) => n);
}

// ═══════════════════════════════════════
//  ANTHROPIC PROXY
// ═══════════════════════════════════════
app.post('/api/claude', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

// Health check
app.get('/', (_, res) => res.send('Undercover Anime — Backend OK'));

// ═══════════════════════════════════════
//  SOCKET EVENTS
// ═══════════════════════════════════════
io.on('connection', (socket) => {

  // ── CREATE ROOM ──
  socket.on('room:create', ({ name, genre, mrWhite }) => {
    let code;
    do { code = genCode(); } while (rooms[code]);

    rooms[code] = {
      code, genre, mrWhite,
      host: name,
      phase: 'lobby',
      players: { [name]: { socketId: socket.id, connected: true, eliminated: false, ready: false } },
      assignments: {},
      wordPair: null,
      round: 1,
      words: {},
      votes: {},
      mrWhiteGuessPhase: false,
    };

    socket.join(code);
    socket.data = { name, code };
    socket.emit('room:joined', { code, name, isHost: true });
    broadcastRoom(code);
  });

  // ── JOIN ROOM ──
  socket.on('room:join', ({ name, code }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error', 'Salle introuvable !');
    if (room.phase !== 'lobby') return socket.emit('error', 'Partie déjà en cours !');
    if (room.players[name] && room.players[name].connected) return socket.emit('error', 'Ce prénom est déjà pris !');

    // Re-join if same name disconnected
    room.players[name] = { socketId: socket.id, connected: true, eliminated: false, ready: false };
    socket.join(code);
    socket.data = { name, code };
    socket.emit('room:joined', { code, name, isHost: room.host === name });
    broadcastRoom(code);
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    const { name, code } = socket.data || {};
    if (!name || !code || !rooms[code]) return;
    const room = rooms[code];

    if (room.players[name]) {
      room.players[name].connected = false;
    }

    // If host left during lobby, transfer host
    if (room.host === name && room.phase === 'lobby') {
      const others = Object.entries(room.players).find(([n, p]) => n !== name && p.connected);
      if (others) {
        room.host = others[0];
        io.to(room.host).emit('room:promoted', { isHost: true });
      } else {
        delete rooms[code]; return;
      }
    }

    broadcastRoom(code);
    io.to(code).emit('toast', `${name} s'est déconnecté`);
  });

  // ── RECONNECT ──
  socket.on('room:reconnect', ({ name, code }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error', 'Salle introuvable !');
    if (!room.players[name]) return socket.emit('error', 'Joueur introuvable dans cette salle');

    room.players[name].socketId = socket.id;
    room.players[name].connected = true;
    socket.join(code);
    socket.data = { name, code };

    socket.emit('room:joined', { code, name, isHost: room.host === name });

    // Send personal assignment if game in progress
    if (room.assignments && room.assignments[name]) {
      socket.emit('your:assignment', room.assignments[name]);
    }

    broadcastRoom(code);
    io.to(code).emit('toast', `${name} s'est reconnecté !`);
  });

  // ── KICK PLAYER (host only) ──
  socket.on('player:kick', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;
    if (!room.players[target]) return;

    const targetSocket = [...io.sockets.sockets.values()].find(s => s.data?.name === target && s.data?.code === code);
    if (targetSocket) {
      targetSocket.emit('kicked', 'Tu as été expulsé de la salle');
      targetSocket.leave(code);
    }

    delete room.players[target];
    broadcastRoom(code);
    io.to(code).emit('toast', `${target} a été expulsé`);
  });

  // ── LEAVE ROOM ──
  socket.on('room:leave', () => {
    const { name, code } = socket.data || {};
    if (!name || !code || !rooms[code]) return;
    const room = rooms[code];

    delete room.players[name];
    socket.leave(code);
    socket.data = {};

    if (Object.keys(room.players).length === 0) {
      delete rooms[code]; return;
    }

    if (room.host === name) {
      const next = Object.entries(room.players).find(([,p]) => p.connected);
      if (next) {
        room.host = next[0];
        io.to(room.host).emit('room:promoted', { isHost: true });
      }
    }

    broadcastRoom(code);
    io.to(code).emit('toast', `${name} a quitté la partie`);
  });

  // ── START GAME (host triggers after AI generated pair) ──
  socket.on('game:start', ({ wordPair, assignments }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;

    room.wordPair = wordPair;
    room.assignments = assignments;
    room.phase = 'reveal';
    room.round = 1;
    room.words = {};
    room.votes = {};

    // Reset ready flags
    Object.keys(room.players).forEach(p => { room.players[p].ready = false; });

    // Send each player their private assignment
    Object.entries(assignments).forEach(([playerName, assignment]) => {
      const playerSocket = [...io.sockets.sockets.values()]
        .find(s => s.data?.name === playerName && s.data?.code === code);
      if (playerSocket) {
        playerSocket.emit('your:assignment', assignment);
      }
    });

    broadcastRoom(code);
  });

  // ── PLAYER READY (card read) ──
  socket.on('player:ready', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room) return;

    room.players[name].ready = true;
    broadcastRoom(code);

    // Check if all connected non-eliminated players are ready
    const connected = Object.entries(room.players).filter(([,p]) => p.connected && !p.eliminated);
    const allReady = connected.every(([,p]) => p.ready);

    if (allReady && room.phase === 'reveal') {
      room.phase = 'playing';
      broadcastRoom(code);
    }
  });

  // ── SUBMIT WORD (each player writes a word per round) ──
  socket.on('word:submit', ({ word }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.phase !== 'playing') return;

    const roundKey = `round${room.round}`;
    if (!room.words[roundKey]) room.words[roundKey] = {};
    room.words[roundKey][name] = word.trim();

    broadcastRoom(code);

    // Check if all alive players submitted
    const alive = getAlive(room);
    const submitted = Object.keys(room.words[roundKey] || {});
    const allSubmitted = alive.every(n => submitted.includes(n));

    if (allSubmitted) {
      io.to(code).emit('words:all_submitted', { round: room.round, words: room.words[roundKey] });
    }
  });

  // ── SUBMIT VOTE (host applies collective vote) ──
  socket.on('vote:eliminate', ({ target }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name || room.phase !== 'playing') return;

    eliminatePlayer(room, target, code);
  });

  // ── MR WHITE GUESS ──
  socket.on('mrwhite:guess', ({ guess }) => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || !room.mrWhiteGuessPhase) return;

    const correct = room.wordPair?.civilian?.toLowerCase().trim();
    const isCorrect = guess.toLowerCase().trim() === correct;

    room.mrWhiteGuessPhase = false;

    if (isCorrect) {
      endGame(room, code, 'mrwhite-wins');
    } else {
      endGame(room, code, 'civilians-win');
    }
  });

  // ── PLAY AGAIN (host resets to lobby) ──
  socket.on('game:reset', () => {
    const { name, code } = socket.data || {};
    const room = rooms[code];
    if (!room || room.host !== name) return;

    room.phase = 'lobby';
    room.assignments = {};
    room.wordPair = null;
    room.words = {};
    room.votes = {};
    room.round = 1;
    room.mrWhiteGuessPhase = false;
    Object.keys(room.players).forEach(p => {
      room.players[p].ready = false;
      room.players[p].eliminated = false;
    });

    broadcastRoom(code);
  });
});

// ═══════════════════════════════════════
//  GAME LOGIC
// ═══════════════════════════════════════
function eliminatePlayer(room, target, code) {
  room.players[target].eliminated = true;
  const role = room.assignments[target]?.role;

  io.to(code).emit('toast', `${target} est éliminé !`);

  const alive = getAlive(room);
  const aliveRoles = alive.map(n => room.assignments[n]?.role);
  const undercoverAlive = aliveRoles.includes('undercover');
  const mrWhiteAlive = aliveRoles.includes('mr-white');
  const civilianCount = aliveRoles.filter(r => r === 'civilian').length;

  if (role === 'undercover') {
    if (mrWhiteAlive) {
      room.mrWhiteGuessPhase = true;
      broadcastRoom(code);
      // Notify Mr. White specifically
      const mrWhiteName = Object.entries(room.assignments).find(([,a]) => a.role === 'mr-white')?.[0];
      if (mrWhiteName) {
        const mrSocket = [...io.sockets.sockets.values()].find(s => s.data?.name === mrWhiteName && s.data?.code === code);
        if (mrSocket) mrSocket.emit('mrwhite:your_turn');
      }
    } else {
      endGame(room, code, 'civilians-win');
    }
  } else if (role === 'mr-white') {
    if (undercoverAlive) {
      room.round++;
      resetRoundWords(room);
      broadcastRoom(code);
    } else {
      endGame(room, code, 'civilians-win');
    }
  } else {
    // Civilian eliminated
    if (!undercoverAlive && !mrWhiteAlive) {
      endGame(room, code, 'civilians-win');
    } else if (civilianCount <= 1 && undercoverAlive) {
      endGame(room, code, 'undercover-wins');
    } else if (civilianCount <= 1 && mrWhiteAlive) {
      endGame(room, code, 'mrwhite-wins');
    } else {
      room.round++;
      resetRoundWords(room);
      broadcastRoom(code);
    }
  }
}

function resetRoundWords(room) {
  // Reset ready for word phase but keep eliminated status
  Object.keys(room.players).forEach(p => {
    if (!room.players[p].eliminated) room.players[p].ready = true;
  });
}

function endGame(room, code, outcome) {
  room.phase = 'result';
  room.result = { outcome };
  broadcastRoom(code);
}

// ═══════════════════════════════════════
//  START
// ═══════════════════════════════════════
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
