// src/roomManager.js
// Fonte única de verdade para o estado "ao vivo" de cada sala.
// Tudo que importa para a lógica do jogo é decidido e validado AQUI,
// nunca confiando em dados vindos do cliente além de IDs/valores de entrada.

const { generateRoomCode, generateId, generateToken } = require('./idGenerator');
const { getPoolForConfig, validateConfig, generateCard, shuffle } = require('./bingoTypes');
const { getWinningPatterns } = require('./winChecker');
const db = require('./db');

const MAX_PLAYERS_PER_ROOM = 40; // folga acima dos ~20 previstos
const rooms = new Map(); // code -> room

const DEFAULT_CONFIG = {
  gridSize: 5,
  freeSpace: true,
  bingoType: 'numbers',
  minNumber: 1,
  maxNumber: 75,
  words: [],
  emojis: [],
  items: [],
  winPatterns: { row: true, column: true, diagonal: true, fullCard: false },
  autoPauseOnWin: true,
};

function normalizeName(name) {
  return String(name || '').trim();
}

function slugKey(name) {
  return normalizeName(name).toLowerCase();
}

class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function createRoom({ name } = {}) {
  let code;
  do { code = generateRoomCode(); } while (rooms.has(code));

  const masterToken = generateToken();
  const room = {
    code,
    name: name || `Sala ${code}`,
    masterToken,
    masterSocketId: null,
    status: 'waiting', // waiting -> playing -> paused/playing -> ended
    locked: false,
    matchNumber: 1,
    config: { ...DEFAULT_CONFIG },
    pool: [],
    drawnItems: [], // histórico ordenado desta partida
    drawnSet: new Set(),
    players: new Map(), // id -> player
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  db.upsertRoom(room);
  return room;
}

function getRoom(code) {
  return rooms.get(String(code || '').toUpperCase());
}

function requireRoom(code) {
  const room = getRoom(code);
  if (!room) throw new RoomError('SALA_NAO_ENCONTRADA', 'Código de sala inválido ou sala não encontrada.');
  return room;
}

function authMaster(code, token) {
  const room = requireRoom(code);
  if (!token || token !== room.masterToken) {
    throw new RoomError('NAO_AUTORIZADO', 'Você não tem permissão de Mestre nesta sala.');
  }
  return room;
}

function updateConfig(code, token, partialConfig) {
  const room = authMaster(code, token);
  if (room.status !== 'waiting') {
    throw new RoomError('PARTIDA_JA_INICIADA', 'Não é possível alterar configurações após o início da partida.');
  }
  const merged = {
    ...room.config,
    ...partialConfig,
    winPatterns: { ...room.config.winPatterns, ...(partialConfig.winPatterns || {}) },
  };
  merged.gridSize = Number(merged.gridSize);
  const errors = validateConfig(merged);
  if (errors.length) {
    throw new RoomError('CONFIG_INVALIDA', errors.join(' '));
  }
  room.config = merged;
  db.upsertRoom(room);
  return room;
}

function joinRoom(code, name, existingToken) {
  const room = requireRoom(code);

  // Reconexão: se um token válido for enviado e corresponder a um jogador da sala
  if (existingToken) {
    const existing = [...room.players.values()].find((p) => p.token === existingToken);
    if (existing) {
      if (existing.kicked) throw new RoomError('EXPULSO', 'Você foi removido desta sala.');
      return { room, player: existing, reconnected: true };
    }
  }

  if (room.status === 'ended') {
    throw new RoomError('SALA_ENCERRADA', 'Esta sala já foi encerrada.');
  }
  if (room.locked) {
    throw new RoomError('SALA_BLOQUEADA', 'O Mestre bloqueou a entrada de novos participantes.');
  }
  const activePlayers = [...room.players.values()].filter((p) => !p.kicked);
  if (activePlayers.length >= MAX_PLAYERS_PER_ROOM) {
    throw new RoomError('SALA_LOTADA', 'Esta sala atingiu o limite de participantes.');
  }

  const cleanName = normalizeName(name);
  if (!cleanName || cleanName.length < 2 || cleanName.length > 30) {
    throw new RoomError('NOME_INVALIDO', 'Informe um nome válido (2 a 30 caracteres).');
  }
  const key = slugKey(cleanName);
  const duplicate = activePlayers.some((p) => slugKey(p.name) === key);
  if (duplicate) {
    throw new RoomError('NOME_DUPLICADO', 'Já existe um participante com esse nome nesta sala.');
  }

  const player = {
    id: generateId('p_'),
    name: cleanName,
    token: generateToken(),
    socketId: null,
    connected: false,
    kicked: false,
    hasWon: false,
    card: null,
    joinedAt: Date.now(),
  };

  // Se a partida já estiver em andamento, o jogador entra "aguardando a próxima rodada"
  // — não recebe cartela incompatível com o estado atual (ver seção 18 dos requisitos).
  if (room.status === 'playing' || room.status === 'paused') {
    player.waitingNextMatch = true;
  } else if (room.pool.length) {
    // sala em waiting, mas já teve rodada anterior configurada
  }

  room.players.set(player.id, player);
  db.upsertPlayer(player, room.code);
  return { room, player, reconnected: false };
}

function attachSocket(room, entity, socketId) {
  entity.socketId = socketId;
  entity.connected = true;
}

function setMasterSocket(room, socketId) {
  room.masterSocketId = socketId;
}

function kickPlayer(code, token, playerId) {
  const room = authMaster(code, token);
  const player = room.players.get(playerId);
  if (!player) throw new RoomError('JOGADOR_NAO_ENCONTRADO', 'Participante não encontrado.');
  player.kicked = true;
  player.connected = false;
  db.upsertPlayer(player, room.code);
  return { room, player };
}

function lockRoom(code, token, locked) {
  const room = authMaster(code, token);
  room.locked = !!locked;
  return room;
}

function startGame(code, token) {
  const room = authMaster(code, token);
  if (room.status !== 'waiting') {
    throw new RoomError('ESTADO_INVALIDO', 'A partida não pode ser iniciada neste estado.');
  }
  const errors = validateConfig(room.config);
  if (errors.length) throw new RoomError('CONFIG_INVALIDA', errors.join(' '));

  room.pool = getPoolForConfig(room.config);
  room.drawnItems = [];
  room.drawnSet = new Set();
  room.status = 'playing';

  for (const player of room.players.values()) {
    if (player.kicked) continue;
    player.card = generateCard(room.pool, room.config.gridSize, room.config.freeSpace);
    player.hasWon = false;
    player.waitingNextMatch = false;
    db.upsertPlayer(player, room.code);
  }
  db.upsertRoom(room);
  return room;
}

function pauseGame(code, token) {
  const room = authMaster(code, token);
  if (room.status !== 'playing') throw new RoomError('ESTADO_INVALIDO', 'A partida não está em andamento.');
  room.status = 'paused';
  return room;
}

function resumeGame(code, token) {
  const room = authMaster(code, token);
  if (room.status !== 'paused') throw new RoomError('ESTADO_INVALIDO', 'A partida não está pausada.');
  room.status = 'playing';
  return room;
}

function restartGame(code, token) {
  const room = authMaster(code, token);
  if (room.status === 'ended') throw new RoomError('ESTADO_INVALIDO', 'A sala já foi encerrada.');
  room.matchNumber += 1;
  room.drawnItems = [];
  room.drawnSet = new Set();
  room.pool = [];
  room.status = 'waiting';
  for (const player of room.players.values()) {
    player.card = null;
    player.hasWon = false;
    player.waitingNextMatch = false;
  }
  db.clearDraws(room.code);
  db.upsertRoom(room);
  return room;
}

function endGame(code, token) {
  const room = authMaster(code, token);
  room.status = 'ended';
  room.locked = true;
  db.markRoomEnded(room.code);
  return room;
}

function drawItem(code, token) {
  const room = authMaster(code, token);
  if (room.status !== 'playing') {
    throw new RoomError('ESTADO_INVALIDO', 'Só é possível sortear com a partida em andamento.');
  }
  const remaining = room.pool.filter((item) => !room.drawnSet.has(item));
  if (remaining.length === 0) {
    throw new RoomError('POOL_ESGOTADO', 'Todos os itens já foram sorteados.');
  }
  const value = remaining[Math.floor(Math.random() * remaining.length)];
  room.drawnItems.push(value);
  room.drawnSet.add(value);
  db.insertDraw(room.code, room.matchNumber, value);

  // O sorteio NÃO marca as cartelas: cada jogador procura o item na própria
  // cartela e marca com um toque (markCell). Por isso nenhuma vitória nasce
  // aqui — ela é detectada quando o jogador marca a casa que faltava.
  return { room, value, newWinners: [] };
}

function undoLastDraw(code, token) {
  const room = authMaster(code, token);
  if (!room.drawnItems.length) {
    throw new RoomError('NADA_PARA_DESFAZER', 'Ainda não há sorteios para desfazer.');
  }
  const value = room.drawnItems.pop();
  room.drawnSet.delete(value);

  // O item deixou de estar sorteado: desmarca quem já tinha marcado e recalcula vitórias
  for (const player of room.players.values()) {
    if (!player.card) continue;
    for (const row of player.card.cells) {
      for (const cell of row) {
        if (!cell.isFree && cell.value === value) cell.marked = false;
      }
    }
    if (player.hasWon) {
      const patterns = getWinningPatterns(player.card, room.config.winPatterns);
      if (!patterns.length) player.hasWon = false;
    }
  }
  return { room, value };
}

// Marcação manual feita pelo educando — o servidor SEMPRE valida se o
// valor da casa já foi sorteado antes de aceitar a marcação.
function markCell(code, playerToken, row, col) {
  const room = requireRoom(code);
  const player = [...room.players.values()].find((p) => p.token === playerToken);
  if (!player) throw new RoomError('JOGADOR_NAO_ENCONTRADO', 'Participante não encontrado nesta sala.');
  if (player.kicked) throw new RoomError('EXPULSO', 'Você foi removido desta sala.');
  if (room.status !== 'playing') {
    throw new RoomError('ESTADO_INVALIDO', 'Só é possível marcar casas com a partida em andamento.');
  }
  if (!player.card) throw new RoomError('SEM_CARTELA', 'Você ainda não possui uma cartela nesta rodada.');

  const size = player.card.size;
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= size || col >= size) {
    throw new RoomError('CASA_INEXISTENTE', 'Essa casa não existe na sua cartela.');
  }
  const cell = player.card.cells[row][col];
  if (cell.isFree) {
    return { room, player, cell, changed: false }; // já sempre marcada
  }
  if (!room.drawnSet.has(cell.value)) {
    throw new RoomError('ITEM_NAO_SORTEADO', 'Esse item ainda não foi sorteado.');
  }

  const wasMarked = cell.marked;
  cell.marked = !wasMarked; // permite alternar (marcar/desmarcar) itens já sorteados

  let newWin = null;
  if (!player.hasWon) {
    const patterns = getWinningPatterns(player.card, room.config.winPatterns);
    if (patterns.length) {
      player.hasWon = true;
      newWin = patterns;
      db.insertWin(room.code, player.id, player.name, patterns.join(','), room.matchNumber);
    }
  } else if (wasMarked && !cell.marked) {
    // desmarcou uma casa que fazia parte da vitória: reavalia
    const patterns = getWinningPatterns(player.card, room.config.winPatterns);
    if (!patterns.length) player.hasWon = false;
  }
  db.upsertPlayer(player, room.code);

  if (newWin && room.config.autoPauseOnWin) room.status = 'paused';

  return { room, player, cell, changed: true, newWin };
}

// ---------- Views (o que cada tipo de usuário pode enxergar) ----------

function publicPlayerSummary(player) {
  const markedCount = player.card
    ? player.card.cells.flat().filter((c) => c.marked && !c.isFree).length
    : 0;
  return {
    id: player.id,
    name: player.name,
    connected: !!player.connected,
    kicked: !!player.kicked,
    hasWon: !!player.hasWon,
    hasCard: !!player.card,
    waitingNextMatch: !!player.waitingNextMatch,
    markedCount,
  };
}

function getRoomSummary(room) {
  const players = [...room.players.values()].filter((p) => !p.kicked);
  return {
    code: room.code,
    name: room.name,
    status: room.status,
    locked: room.locked,
    matchNumber: room.matchNumber,
    playerCount: players.length,
    connectedCount: players.filter((p) => p.connected).length,
    config: room.config,
  };
}

function getMasterState(room) {
  return {
    ...getRoomSummary(room),
    isMaster: true,
    drawnItems: room.drawnItems,
    lastDrawn: room.drawnItems[room.drawnItems.length - 1] || null,
    remainingCount: Math.max(room.pool.length - room.drawnItems.length, 0),
    poolSize: room.pool.length,
    players: [...room.players.values()].filter((p) => !p.kicked).map(publicPlayerSummary),
  };
}

function getPlayerState(room, player) {
  return {
    ...getRoomSummary(room),
    isMaster: false,
    you: publicPlayerSummary(player),
    card: player.card,
    drawnItems: room.drawnItems,
    lastDrawn: room.drawnItems[room.drawnItems.length - 1] || null,
  };
}

module.exports = {
  RoomError,
  rooms,
  createRoom,
  getRoom,
  requireRoom,
  authMaster,
  updateConfig,
  joinRoom,
  attachSocket,
  setMasterSocket,
  kickPlayer,
  lockRoom,
  startGame,
  pauseGame,
  resumeGame,
  restartGame,
  endGame,
  drawItem,
  undoLastDraw,
  markCell,
  getRoomSummary,
  getMasterState,
  getPlayerState,
  publicPlayerSummary,
};
