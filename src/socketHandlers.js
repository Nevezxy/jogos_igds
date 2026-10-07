// src/socketHandlers.js
// Registra todos os eventos de Socket.IO. Cada handler:
//   1) valida entrada básica,
//   2) delega a lógica de verdade para roomManager (fonte única da verdade),
//   3) responde ao autor via callback (ack) e
//   4) faz broadcast (io.to(room)) para manter todo mundo sincronizado.

const rm = require('./roomManager');

function err(e) {
  if (e instanceof rm.RoomError) return { ok: false, code: e.code, message: e.message };
  console.error('[erro inesperado]', e);
  return { ok: false, code: 'ERRO_INTERNO', message: 'Ocorreu um erro inesperado no servidor.' };
}

function roomChannel(code) {
  return `room:${code}`;
}

// Telões (projetor) ficam num canal separado: recebem a visão de espectador.
function screenChannel(code) {
  return `screen:${code}`;
}

// Tempo da contagem 3-2-1 mostrada às crianças no começo de cada partida;
// o primeiro sorteio automático espera ela terminar.
const COUNTDOWN_MS = 3500;

function broadcastRoomState(io, room) {
  // Estado do mestre (se conectado)
  if (room.masterSocketId) {
    io.to(room.masterSocketId).emit('master_state', rm.getMasterState(room));
  }
  // Estado individual de cada jogador conectado
  for (const player of room.players.values()) {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit('player_state', rm.getPlayerState(room, player));
    }
  }
  // Resumo leve para quem ainda está na tela de espera / listas
  io.to(roomChannel(room.code)).emit('room_summary', rm.getRoomSummary(room));
  io.to(screenChannel(room.code)).emit('screen_state', rm.getScreenState(room));
}

function announceWin(io, room, player, patterns) {
  io.to(roomChannel(room.code)).emit('win_announced', {
    playerId: player.id,
    playerName: player.name,
    avatar: player.avatar,
    patterns,
  });
}

// Sorteia um item e avisa todo mundo. Usado pelo botão do professor e pelo
// sorteio automático.
function performDraw(io, room) {
  const { value } = rm.drawItem(room.code, room.masterToken);
  io.to(roomChannel(room.code)).emit('draw_result', { value, drawnItems: room.drawnItems });
  return value;
}

// ---------------- sorteio automático ----------------

function clearAutoDraw(room) {
  clearTimeout(room.autoDrawTimer);
  room.autoDrawTimer = null;
  room.nextAutoDrawAt = null;
}

// (Re)agenda o próximo sorteio automático se a sala estiver valendo, com
// intervalo configurado e itens restantes. `extraDelay` cobre a contagem
// inicial. Chamado depois de toda ação que muda o ritmo do jogo.
function scheduleAutoDraw(io, room, extraDelay = 0) {
  clearAutoDraw(room);
  const seconds = room.config.autoDrawSeconds;
  const remaining = room.pool.length - room.drawnItems.length;
  if (room.status !== 'playing' || !seconds || remaining <= 0) return;
  const delay = seconds * 1000 + extraDelay;
  room.nextAutoDrawAt = Date.now() + delay;
  room.autoDrawTimer = setTimeout(() => {
    room.autoDrawTimer = null;
    room.nextAutoDrawAt = null;
    if (room.status !== 'playing') return;
    try {
      performDraw(io, room);
      scheduleAutoDraw(io, room);
      broadcastRoomState(io, room);
    } catch (e) {
      if (!(e instanceof rm.RoomError)) console.error('[sorteio automático]', e);
    }
  }, delay);
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    // ---------------- CRIAÇÃO / ENTRADA ----------------

    socket.on('create_room', (payload = {}, cb) => {
      try {
        const room = rm.createRoom({ name: payload.name });
        rm.setMasterSocket(room, socket.id);
        socket.join(roomChannel(room.code));
        socket.data.role = 'master';
        socket.data.roomCode = room.code;
        socket.data.masterToken = room.masterToken;
        cb && cb({ ok: true, roomCode: room.code, masterToken: room.masterToken, state: rm.getMasterState(room) });
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('master_reconnect', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.authMaster(roomCode, masterToken);
        rm.setMasterSocket(room, socket.id);
        socket.join(roomChannel(room.code));
        socket.data.role = 'master';
        socket.data.roomCode = room.code;
        socket.data.masterToken = masterToken;
        cb && cb({ ok: true, state: rm.getMasterState(room) });
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('join_room', ({ roomCode, name, playerToken, avatar } = {}, cb) => {
      try {
        const { room, player, reconnected } = rm.joinRoom(roomCode, name, playerToken, avatar);
        rm.attachSocket(room, player, socket.id);
        socket.join(roomChannel(room.code));
        socket.data.role = 'player';
        socket.data.roomCode = room.code;
        socket.data.playerToken = player.token;
        cb && cb({
          ok: true,
          reconnected,
          playerId: player.id,
          playerToken: player.token,
          state: rm.getPlayerState(room, player),
        });
        broadcastRoomState(io, room);
        if (room.masterSocketId) io.to(room.masterSocketId).emit('master_state', rm.getMasterState(room));
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- CONFIGURAÇÃO ----------------

    socket.on('update_config', ({ roomCode, masterToken, config } = {}, cb) => {
      try {
        const room = rm.updateConfig(roomCode, masterToken, config || {});
        cb && cb({ ok: true, state: rm.getMasterState(room) });
        io.to(roomChannel(room.code)).emit('room_summary', rm.getRoomSummary(room));
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- CONTROLE DE PARTIDA ----------------

    socket.on('start_game', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.startGame(roomCode, masterToken);
        scheduleAutoDraw(io, room, COUNTDOWN_MS);
        cb && cb({ ok: true, state: rm.getMasterState(room) });
        io.to(roomChannel(room.code)).emit('game_started');
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('pause_game', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.pauseGame(roomCode, masterToken);
        clearAutoDraw(room);
        cb && cb({ ok: true });
        io.to(roomChannel(room.code)).emit('game_paused');
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('resume_game', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.resumeGame(roomCode, masterToken);
        scheduleAutoDraw(io, room);
        cb && cb({ ok: true });
        io.to(roomChannel(room.code)).emit('game_resumed');
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('restart_game', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.restartGame(roomCode, masterToken);
        clearAutoDraw(room);
        cb && cb({ ok: true });
        io.to(roomChannel(room.code)).emit('game_restarted');
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('new_match', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.newMatch(roomCode, masterToken);
        scheduleAutoDraw(io, room, COUNTDOWN_MS);
        cb && cb({ ok: true, state: rm.getMasterState(room) });
        io.to(roomChannel(room.code)).emit('new_match_started', { matchNumber: room.matchNumber });
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('end_game', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.endGame(roomCode, masterToken);
        clearAutoDraw(room);
        cb && cb({ ok: true });
        io.to(roomChannel(room.code)).emit('game_ended');
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- SORTEIO ----------------

    socket.on('draw_item', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const room = rm.authMaster(roomCode, masterToken);
        const value = performDraw(io, room);
        scheduleAutoDraw(io, room); // sorteio manual reinicia a contagem do automático
        cb && cb({ ok: true, value });
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('undo_draw', ({ roomCode, masterToken } = {}, cb) => {
      try {
        const { room, value } = rm.undoLastDraw(roomCode, masterToken);
        scheduleAutoDraw(io, room);
        cb && cb({ ok: true, value });
        io.to(roomChannel(room.code)).emit('draw_undone', { value, drawnItems: room.drawnItems });
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- PARTICIPANTES ----------------

    socket.on('kick_player', ({ roomCode, masterToken, playerId } = {}, cb) => {
      try {
        const { room, player } = rm.kickPlayer(roomCode, masterToken, playerId);
        cb && cb({ ok: true });
        if (player.socketId) {
          io.to(player.socketId).emit('you_were_kicked');
          io.sockets.sockets.get(player.socketId)?.leave(roomChannel(room.code));
        }
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    socket.on('lock_room', ({ roomCode, masterToken, locked } = {}, cb) => {
      try {
        const room = rm.lockRoom(roomCode, masterToken, locked);
        cb && cb({ ok: true });
        io.to(roomChannel(room.code)).emit('room_summary', rm.getRoomSummary(room));
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- JOGADOR: MARCAR CASA ----------------

    socket.on('mark_cell', ({ roomCode, playerToken, row, col } = {}, cb) => {
      try {
        const { room, player, newWin } = rm.markCell(roomCode, playerToken, Number(row), Number(col));
        cb && cb({ ok: true, card: player.card });
        if (newWin) {
          announceWin(io, room, player, newWin);
          if (room.status !== 'playing') clearAutoDraw(room); // pausa automática na vitória
        }
        broadcastRoomState(io, room);
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- TELÃO (espectador) ----------------

    socket.on('watch_room', ({ roomCode } = {}, cb) => {
      try {
        const room = rm.requireRoom(roomCode);
        socket.join(screenChannel(room.code));
        // também ouve os eventos de jogo (sorteio, vitória, início...)
        socket.join(roomChannel(room.code));
        socket.data.role = 'screen';
        socket.data.roomCode = room.code;
        cb && cb({ ok: true, state: rm.getScreenState(room) });
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- ESTADO / PING ----------------

    socket.on('get_state', ({ roomCode, masterToken, playerToken } = {}, cb) => {
      try {
        const room = rm.requireRoom(roomCode);
        if (masterToken) {
          rm.authMaster(roomCode, masterToken);
          cb && cb({ ok: true, role: 'master', state: rm.getMasterState(room) });
        } else if (playerToken) {
          const player = [...room.players.values()].find((p) => p.token === playerToken);
          if (!player) throw new rm.RoomError('JOGADOR_NAO_ENCONTRADO', 'Participante não encontrado.');
          cb && cb({ ok: true, role: 'player', state: rm.getPlayerState(room, player) });
        } else {
          cb && cb({ ok: true, role: 'guest', state: rm.getRoomSummary(room) });
        }
      } catch (e) { cb && cb(err(e)); }
    });

    // ---------------- DESCONEXÃO ----------------

    socket.on('disconnect', () => {
      const { role, roomCode } = socket.data || {};
      if (!roomCode) return;
      const room = rm.getRoom(roomCode);
      if (!room) return;

      if (role === 'master' && room.masterSocketId === socket.id) {
        room.masterSocketId = null;
        // Mestre offline não encerra a sala — pode reconectar (master_reconnect)
      } else if (role === 'player') {
        const player = [...room.players.values()].find((p) => p.socketId === socket.id);
        if (player) {
          player.connected = false;
          player.socketId = null;
        }
      }
      broadcastRoomState(io, room);
    });
  });
}

module.exports = { registerSocketHandlers };
