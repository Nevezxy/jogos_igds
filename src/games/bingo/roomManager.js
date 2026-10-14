// src/games/bingo/roomManager.js
// Fonte única de verdade para o estado "ao vivo" de cada sala.
// Tudo que importa para a lógica do jogo é decidido e validado AQUI,
// nunca confiando em dados vindos do cliente além de IDs/valores de entrada.

const { generateRoomCode, generateId, generateToken } = require('../../platform/idGenerator');
const { getPoolForConfig, validateConfig, generateCard, shuffle } = require('./bingoTypes');
const { getWinningPatterns, isNearWin } = require('./winChecker');
const { normalizeAvatar } = require('../../platform/avatars');
const db = require('../../platform/db');

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
  autoDrawSeconds: 0, // 0 = sorteio manual; senão, um sorteio a cada N segundos
};

const AUTO_DRAW_OPTIONS = [0, 8, 10, 15, 20, 30];

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
  merged.autoDrawSeconds = Number(merged.autoDrawSeconds) || 0;
  const errors = validateConfig(merged);
  if (!AUTO_DRAW_OPTIONS.includes(merged.autoDrawSeconds)) errors.push('Intervalo de sorteio automático inválido.');
  if (errors.length) {
    throw new RoomError('CONFIG_INVALIDA', errors.join(' '));
  }
  room.config = merged;
  db.upsertRoom(room);
  return room;
}

// Entrada de um educando na sala. A identidade vem da conta da plataforma
// (`student`: { id, name, avatar }, já autenticado pelo socketHandlers):
// nome e bichinho são os da conta, e a mesma criança entrando de novo (outra
// aba, outro aparelho, página recarregada) volta para o mesmo jogador.
// `playerToken` continua aceito para a reconexão rápida.
function joinRoom(code, { student = null, playerToken = null } = {}) {
  const room = requireRoom(code);
  const players = [...room.players.values()];

  const refresh = (player) => {
    if (player.kicked) throw new RoomError('EXPULSO', 'Você foi removido desta sala.');
    // a criança pode ter trocado o bichinho no painel desde a última vez
    if (student) { player.name = student.name; player.avatar = normalizeAvatar(student.avatar); }
    return { room, player, reconnected: true };
  };

  if (playerToken) {
    const existing = players.find((p) => p.token === playerToken);
    // o token só vale para a mesma conta (aparelho compartilhado)
    if (existing && (!student || !existing.studentId || existing.studentId === student.id)) return refresh(existing);
  }
  if (!student) {
    throw new RoomError('CONTA_OBRIGATORIA', 'Entre com a sua conta para jogar.');
  }
  const sameStudent = players.find((p) => p.studentId === student.id);
  if (sameStudent) return refresh(sameStudent);

  if (room.status === 'ended') {
    throw new RoomError('SALA_ENCERRADA', 'Esta sala já foi encerrada.');
  }
  if (room.locked) {
    throw new RoomError('SALA_BLOQUEADA', 'O Mestre bloqueou a entrada de novos participantes.');
  }
  const activePlayers = players.filter((p) => !p.kicked);
  if (activePlayers.length >= MAX_PLAYERS_PER_ROOM) {
    throw new RoomError('SALA_LOTADA', 'Esta sala atingiu o limite de participantes.');
  }

  const player = {
    id: generateId('p_'),
    studentId: student.id,
    name: student.name,
    avatar: normalizeAvatar(student.avatar),
    token: generateToken(),
    socketId: null,
    connected: false,
    kicked: false,
    hasWon: false,
    winRecorded: false, // a vitória desta partida já foi gravada (desfazer o sorteio não grava de novo)
    card: null,
    joinedAt: Date.now(),
  };

  // Se a partida já estiver em andamento, o jogador entra "aguardando a próxima rodada"
  // — não recebe cartela incompatível com o estado atual.
  if (room.status === 'playing' || room.status === 'paused') {
    player.waitingNextMatch = true;
  }

  room.players.set(player.id, player);
  db.upsertPlayer(player, room.code);
  return { room, player, reconnected: false };
}

// A criança saiu da sala pelo botão "← Jogos". Antes de a partida começar ela
// some da lista; depois, fica como desconectada (pode voltar a qualquer hora).
function leaveRoom(code, playerToken) {
  const room = requireRoom(code);
  const player = [...room.players.values()].find((p) => p.token === playerToken);
  if (!player) throw new RoomError('JOGADOR_NAO_ENCONTRADO', 'Participante não encontrado.');
  if (room.status === 'waiting' && !player.card) {
    room.players.delete(player.id);
  } else {
    player.connected = false;
    player.socketId = null;
  }
  return { room, player };
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
    player.winRecorded = false;
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
    player.winRecorded = false;
    player.waitingNextMatch = false;
  }
  db.clearDraws(room.code);
  db.upsertRoom(room);
  return room;
}

// Começa uma nova rodada na hora, com a mesma configuração e os mesmos
// participantes: cada um recebe uma cartela nova e o sorteio recomeça.
// (restartGame, ao contrário, volta para a tela de configuração.)
function newMatch(code, token) {
  const room = authMaster(code, token);
  if (room.status === 'ended') throw new RoomError('ESTADO_INVALIDO', 'A sala já foi encerrada.');
  if (room.status === 'waiting') {
    throw new RoomError('ESTADO_INVALIDO', 'A partida ainda não começou. Use "Iniciar partida".');
  }
  // os sorteios antigos ficam no banco (cada um guarda o número da rodada)
  room.matchNumber += 1;
  room.status = 'waiting';
  return startGame(code, token);
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
  return { room, value };
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
  // Casa marcada fica travada: como só itens sorteados podem ser marcados,
  // nenhuma marcação é "errada" e desmarcar só serviria para perder progresso.
  if (cell.marked) return { room, player, cell, changed: false, newWin: null };
  cell.marked = true;

  let newWin = null;
  let firstWin = false;
  if (!player.hasWon) {
    const patterns = getWinningPatterns(player.card, room.config.winPatterns);
    if (patterns.length) {
      player.hasWon = true;
      newWin = patterns;
      // o professor desfez um sorteio depois do bingo e a criança completou de
      // novo: anuncia de novo, mas não conta uma segunda vitória
      firstWin = !player.winRecorded;
      if (firstWin) {
        player.winRecorded = true;
        db.insertWin(room.code, player.id, player.name, patterns.join(','), room.matchNumber);
      }
    }
  }
  db.upsertPlayer(player, room.code);

  if (newWin && room.config.autoPauseOnWin) room.status = 'paused';

  return { room, player, cell, changed: true, newWin, firstWin };
}

// ---------- Views (o que cada tipo de usuário pode enxergar) ----------

function publicPlayerSummary(player, config) {
  const cells = player.card ? player.card.cells.flat().filter((c) => !c.isFree) : [];
  const markedCount = cells.filter((c) => c.marked).length;
  return {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    totalCells: cells.length,
    nearWin: !!(player.card && !player.hasWon && config && isNearWin(player.card, config.winPatterns)),
    connected: !!player.connected,
    kicked: !!player.kicked,
    hasWon: !!player.hasWon,
    hasCard: !!player.card,
    waitingNextMatch: !!player.waitingNextMatch,
    markedCount,
  };
}

// O que as crianças precisam saber da configuração (sem as listas de
// palavras/itens, que podem ter centenas de entradas).
function publicConfig(config) {
  return {
    gridSize: config.gridSize,
    freeSpace: config.freeSpace,
    bingoType: config.bingoType,
    winPatterns: config.winPatterns,
    autoDrawSeconds: config.autoDrawSeconds,
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
    // nomes e avatares para a sala de espera (todo mundo da turma se vê)
    players: players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, connected: !!p.connected })),
    config: publicConfig(room.config),
    nextAutoDrawAt: room.nextAutoDrawAt || null,
  };
}

function getMasterState(room) {
  return {
    ...getRoomSummary(room),
    config: room.config, // o professor precisa da configuração completa para editar
    isMaster: true,
    drawnItems: room.drawnItems,
    lastDrawn: room.drawnItems[room.drawnItems.length - 1] || null,
    remainingCount: Math.max(room.pool.length - room.drawnItems.length, 0),
    poolSize: room.pool.length,
    pool: room.pool,
    players: [...room.players.values()].filter((p) => !p.kicked).map((p) => publicPlayerSummary(p, room.config)),
  };
}

// Telão (projetor): só leitura, sem tokens nem cartelas.
function getScreenState(room) {
  const master = getMasterState(room);
  delete master.isMaster;
  master.isScreen = true;
  return master;
}

function getPlayerState(room, player) {
  return {
    ...getRoomSummary(room),
    isMaster: false,
    you: publicPlayerSummary(player, room.config),
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
  leaveRoom,
  attachSocket,
  setMasterSocket,
  kickPlayer,
  lockRoom,
  startGame,
  pauseGame,
  resumeGame,
  restartGame,
  newMatch,
  endGame,
  drawItem,
  undoLastDraw,
  markCell,
  getRoomSummary,
  getMasterState,
  getScreenState,
  getPlayerState,
  publicPlayerSummary,
};
