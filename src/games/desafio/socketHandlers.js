// src/games/desafio/socketHandlers.js
// Eventos Socket.IO do Desafio de digitação (todos com o prefixo "dz:").
// Cada handler valida a entrada, delega para raceManager e responde pelo
// callback; um relógio por servidor (TICK_MS) manda o estado da corrida para
// o professor, as crianças e o telão, e encerra a rodada na hora certa.

const rm = require('./raceManager');
const accounts = require('../../platform/accounts');
const progress = require('../../platform/progress');
const teacher = require('../../platform/teacher');

const TICK_MS = 300;

function err(e) {
  if (e instanceof rm.RaceError || e instanceof accounts.AccountError || e instanceof teacher.TeacherError) {
    return { ok: false, code: e.code, message: e.message };
  }
  console.error('[desafio] erro inesperado', e);
  return { ok: false, code: 'ERRO_INTERNO', message: 'Ocorreu um erro inesperado no servidor.' };
}

const roomChannel = (code) => `dz:room:${code}`;
const screenChannel = (code) => `dz:screen:${code}`;

function game() {
  return require('../registry').games.find((g) => g.id === 'desafio');
}

function broadcast(io, room) {
  if (room.masterSocketId) io.to(room.masterSocketId).emit('dz:master_state', rm.masterState(room));
  io.to(roomChannel(room.code)).emit('dz:state', rm.sharedState(room));
  io.to(screenChannel(room.code)).emit('dz:screen_state', rm.screenState(room));
}

// Fim da rodada: pódio (com a média anterior de cada conta, para "quem mais
// melhorou") e resultado de cada criança no progresso dela.
function finishRound(io, room) {
  const history = {};
  for (const p of room.players.values()) {
    if (p.run && p.studentId) history[p.studentId] = progress.getProgress(p.studentId, 'desafio') || null;
  }
  rm.endRound(room, Object.fromEntries(Object.entries(history).map(([id, h]) => [id, h || { races: 0 }])));
  const entry = game();
  for (const r of room.results.ranking) {
    if (!r.studentId) continue;
    try {
      progress.recordResult(r.studentId, entry, {
        levelId: room.results.mode,
        score: r.position === 1 ? 1 : 0,
        wpm: r.wpm,
        accuracy: r.accuracy,
        durationMs: r.timeMs,
        position: r.position,
        podium: Object.values(room.results.podium).some((v) => v && (v === r.id || v.id === r.id)),
        details: { position: r.position, correct: r.correct, finished: r.finished, players: room.results.ranking.length },
      });
    } catch (e) {
      console.error('[desafio] não gravou o resultado', e);
    }
  }
  io.to(roomChannel(room.code)).emit('dz:results', rm.sharedState(room));
  io.to(screenChannel(room.code)).emit('dz:results', rm.screenState(room));
  if (room.masterSocketId) io.to(room.masterSocketId).emit('dz:results', rm.masterState(room));
}

function registerSocketHandlers(io) {
  // relógio: estado ao vivo e fim automático das rodadas
  setInterval(() => {
    const now = Date.now();
    for (const room of rm.rooms.values()) {
      if (room.status === 'countdown' || room.status === 'racing') {
        if (rm.shouldEnd(room, now)) finishRound(io, room);
        else broadcast(io, room);
      } else if (room.dirty) {
        broadcast(io, room);
      }
      room.dirty = false;
    }
  }, TICK_MS).unref();

  io.on('connection', (socket) => {
    // ---------------- professor ----------------

    socket.on('dz:create', ({ teacherToken } = {}, cb) => {
      try {
        teacher.requireTeacher(teacherToken);
        const room = rm.createRoom();
        room.masterSocketId = socket.id;
        socket.data.dz = { role: 'master', code: room.code };
        cb && cb({ ok: true, roomCode: room.code, masterToken: room.masterToken, state: rm.masterState(room) });
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('dz:master_reconnect', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.authMaster(roomCode, masterToken);
        room.masterSocketId = socket.id;
        socket.data.dz = { role: 'master', code: room.code };
        cb && cb({ ok: true, state: rm.masterState(room) });
      } catch (e) { cb && cb(err(e)); }
    });

    const masterAction = (event, fn) => {
      socket.on(event, (payload = {}, cb) => {
        try {
          const room = fn(payload);
          room.dirty = true;
          cb && cb({ ok: true, state: rm.masterState(room) });
          broadcast(io, room);
        } catch (e) { cb && cb(err(e)); }
      });
    };

    masterAction('dz:config', ({ roomCode, masterToken, config }) => rm.updateConfig(roomCode, masterToken, config || {}));
    masterAction('dz:lock', ({ roomCode, masterToken, locked }) => rm.lockRoom(roomCode, masterToken, locked));
    masterAction('dz:kick', ({ roomCode, masterToken, playerId }) => {
      const { room, player } = rm.kickPlayer(roomCode, masterToken, playerId);
      if (player.socketId) io.to(player.socketId).emit('dz:kicked');
      return room;
    });
    masterAction('dz:start', ({ roomCode, masterToken }) => {
      const room = rm.startRound(roomCode, masterToken);
      const round = { round: room.round, startAt: room.startAt, endsAt: room.endsAt, now: Date.now() };
      io.to(roomChannel(room.code)).emit('dz:round', { ...round, text: room.text });
      io.to(screenChannel(room.code)).emit('dz:round', round);
      return room;
    });
    masterAction('dz:end_round', ({ roomCode, masterToken }) => {
      const room = rm.authMaster(roomCode, masterToken);
      if (room.status === 'countdown' || room.status === 'racing') finishRound(io, room);
      return room;
    });
    masterAction('dz:end_room', ({ roomCode, masterToken }) => {
      const room = rm.endRoom(roomCode, masterToken);
      io.to(roomChannel(room.code)).emit('dz:ended');
      return room;
    });

    // ---------------- telão ----------------

    socket.on('dz:watch', ({ roomCode } = {}, cb) => {
      try {
        const room = rm.requireRoom(roomCode);
        socket.join(screenChannel(room.code));
        cb && cb({ ok: true, state: rm.screenState(room) });
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- criança ----------------

    socket.on('dz:join', ({ roomCode, studentToken, playerToken } = {}, cb) => {
      try {
        const student = studentToken ? accounts.authenticate(studentToken) : null;
        const { room, player, reconnected } = rm.joinRoom(roomCode, { student, playerToken });
        player.socketId = socket.id;
        player.connected = true;
        socket.join(roomChannel(room.code));
        socket.data.dz = { role: 'player', code: room.code, token: player.token };
        room.dirty = true;
        cb && cb({ ok: true, reconnected, playerId: player.id, playerToken: player.token, state: rm.playerState(room, player) });
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('dz:leave', ({ roomCode, playerToken } = {}, cb) => {
      try {
        const room = rm.leaveRoom(roomCode, playerToken);
        socket.leave(roomChannel(room.code));
        socket.data.dz = null;
        room.dirty = true;
        cb && cb({ ok: true });
      } catch (e) { cb && cb(err(e)); }
    });

    // Teclas: a criança manda os caracteres em pacotinhos; o servidor confere
    // com o mesmo motor do Teclado Mágico e responde quanto do texto valeu.
    socket.on('dz:keys', ({ roomCode, playerToken, chars } = {}, cb) => {
      try {
        const { room, player, changed } = rm.typeKeys(roomCode, playerToken, chars);
        if (changed) room.dirty = true;
        cb && cb({ ok: true, typed: player.run ? player.run.pos : 0, finished: Boolean(player.finishedAt), place: player.place });
        if (changed && rm.shouldEnd(room)) finishRound(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('disconnect', () => {
      const info = socket.data.dz;
      if (!info) return;
      const room = rm.getRoom(info.code);
      if (!room) return;
      if (info.role === 'master' && room.masterSocketId === socket.id) room.masterSocketId = null;
      if (info.role === 'player') {
        const player = [...room.players.values()].find((p) => p.socketId === socket.id);
        if (player) { player.connected = false; player.socketId = null; }
      }
      room.dirty = true;
    });
  });
}

module.exports = { registerSocketHandlers };
