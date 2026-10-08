// src/games/desafio/raceManager.js
// Desafio de digitação com a turma toda: fonte única da verdade de cada sala.
// O professor cria a sala e escolhe o texto e o modo; as crianças entram com
// a conta, recebem o mesmo texto ao mesmo tempo e cada tecla é conferida
// AQUI, pelo mesmo motor do Teclado Mágico (engine.js) — o navegador só
// manda os caracteres digitados.
//
// Modos:
//   corrida   todos digitam o mesmo texto; vence quem terminar primeiro
//   relogio   1 minuto (ou outro tempo): vence quem digitar mais caracteres
//             certos; com "turma contra o mascote", a turma soma esforços

const { generateRoomCode, generateId, generateToken } = require('../../platform/idGenerator');
const { normalizeAvatar } = require('../../platform/avatars');
const Levels = require('../../../public/games/digitacao/levels.js');
const Content = require('../../../public/games/digitacao/content.js');
const { TypingRun } = require('../../../public/games/digitacao/engine.js');

const MAX_PLAYERS = 40;
const COUNTDOWN_MS = 3500;
const MAX_RACE_MS = 5 * 60 * 1000; // corrida acaba sozinha depois disso
const CUSTOM_TEXT_MAX = 600;
// ninguém digita mais de ~20 caracteres por segundo: acima disso é robô
const MAX_CHARS_PER_SECOND = 20;
// velocidade do mascote no "turma contra o mascote", por criança (PPM)
const MASCOT_WPM_PER_PLAYER = 8;
const SECONDS_OPTIONS = [30, 60, 90, 120];

const rooms = new Map();

const DEFAULT_CONFIG = {
  mode: 'corrida', // 'corrida' | 'relogio'
  source: 'level', // 'level' (fase do Teclado Mágico) | 'custom' (texto do professor)
  levelId: 'm7f1',
  customText: '',
  seconds: 60, // modo relógio
  vsMascot: false, // modo relógio: turma contra o mascote
  uppercase: false, // texto todo em MAIÚSCULA
  showNames: true, // nomes no telão (sem: só os bichinhos)
};

class RaceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function getRoom(code) {
  return rooms.get(String(code || '').trim().toUpperCase());
}

function requireRoom(code) {
  const room = getRoom(code);
  if (!room) throw new RaceError('SALA_NAO_ENCONTRADA', 'Não achei essa sala.');
  return room;
}

function createRoom() {
  let code;
  do { code = generateRoomCode(); } while (rooms.has(code));
  const room = {
    code,
    masterToken: generateToken(),
    masterSocketId: null,
    status: 'waiting', // waiting -> countdown -> racing -> finished -> (nova rodada) countdown...
    locked: false,
    round: 0,
    config: { ...DEFAULT_CONFIG },
    text: '',
    startAt: null,
    endsAt: null,
    finishCount: 0,
    results: null,
    players: new Map(),
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

function authMaster(code, token) {
  const room = requireRoom(code);
  if (!token || token !== room.masterToken) throw new RaceError('NAO_AUTORIZADO', 'Só o professor da sala pode fazer isso.');
  return room;
}

function cleanText(text) {
  return String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function updateConfig(code, token, partial = {}) {
  const room = authMaster(code, token);
  if (room.status === 'countdown' || room.status === 'racing') {
    throw new RaceError('EM_ANDAMENTO', 'Espere a rodada acabar para mudar as regras.');
  }
  const next = { ...room.config };
  if ('mode' in partial) {
    if (!['corrida', 'relogio'].includes(partial.mode)) throw new RaceError('CONFIG_INVALIDA', 'Modo inválido.');
    next.mode = partial.mode;
  }
  if ('source' in partial) {
    if (!['level', 'custom'].includes(partial.source)) throw new RaceError('CONFIG_INVALIDA', 'Origem do texto inválida.');
    next.source = partial.source;
  }
  if ('levelId' in partial) {
    if (!Levels.getLevel(partial.levelId)) throw new RaceError('CONFIG_INVALIDA', 'Fase inválida.');
    next.levelId = partial.levelId;
  }
  if ('customText' in partial) {
    const text = cleanText(partial.customText);
    if (text.length > CUSTOM_TEXT_MAX) throw new RaceError('CONFIG_INVALIDA', `O texto pode ter até ${CUSTOM_TEXT_MAX} letras.`);
    next.customText = text;
  }
  if ('seconds' in partial) {
    const s = Number(partial.seconds);
    if (!SECONDS_OPTIONS.includes(s)) throw new RaceError('CONFIG_INVALIDA', 'Tempo inválido.');
    next.seconds = s;
  }
  for (const flag of ['vsMascot', 'uppercase', 'showNames']) {
    if (flag in partial) next[flag] = Boolean(partial[flag]);
  }
  // texto curto demais é aceito aqui (o professor ainda está escrevendo);
  // quem barra é startRound
  room.config = next;
  return room;
}

// Texto da rodada. No relógio, junta exercícios até sobrar texto para todo o tempo.
function buildText(config) {
  let text;
  if (config.source === 'custom') {
    text = config.customText;
    if (text.length < 5) throw new RaceError('TEXTO_CURTO', 'Escreva um texto com pelo menos 5 letras.');
    if (config.mode === 'relogio') {
      const need = config.seconds * MAX_CHARS_PER_SECOND;
      while (text.length < need) text += ` ${config.customText}`;
    }
  } else {
    const level = Levels.getLevel(config.levelId);
    text = Content.generate(level);
    if (config.mode === 'relogio') {
      const need = config.seconds * MAX_CHARS_PER_SECOND;
      while (text.length < need) text += ` ${Content.generate(level)}`;
    }
  }
  text = cleanText(text);
  return config.uppercase ? text.toLocaleUpperCase('pt-BR') : text;
}

// ---------------- jogadores ----------------

function joinRoom(code, { student = null, playerToken = null } = {}) {
  const room = requireRoom(code);
  const players = [...room.players.values()];
  const refresh = (player) => {
    if (player.kicked) throw new RaceError('EXPULSO', 'Você foi removido desta sala.');
    if (student) { player.name = student.name; player.avatar = normalizeAvatar(student.avatar); }
    return { room, player, reconnected: true };
  };
  if (playerToken) {
    const existing = players.find((p) => p.token === playerToken);
    if (existing && (!student || existing.studentId === student.id)) return refresh(existing);
  }
  if (!student) throw new RaceError('CONTA_OBRIGATORIA', 'Entre com a sua conta para jogar.');
  const same = players.find((p) => p.studentId === student.id);
  if (same) return refresh(same);
  if (room.status === 'ended') throw new RaceError('SALA_ENCERRADA', 'Esta sala já foi encerrada.');
  if (room.locked) throw new RaceError('SALA_BLOQUEADA', 'O professor fechou a entrada da sala.');
  if (players.filter((p) => !p.kicked).length >= MAX_PLAYERS) throw new RaceError('SALA_LOTADA', 'A sala está cheia.');

  const player = {
    id: generateId('r_'),
    studentId: student.id,
    name: student.name,
    avatar: normalizeAvatar(student.avatar),
    token: generateToken(),
    socketId: null,
    connected: false,
    kicked: false,
    run: null, // rodada atual (TypingRun), null = esperando a próxima
    finishedAt: null,
    place: null,
  };
  // entrou com a rodada andando: corre na próxima
  room.players.set(player.id, player);
  return { room, player, reconnected: false };
}

function findPlayer(room, playerToken) {
  const player = [...room.players.values()].find((p) => p.token === playerToken);
  if (!player || player.kicked) throw new RaceError('JOGADOR_NAO_ENCONTRADO', 'Participante não encontrado.');
  return player;
}

function leaveRoom(code, playerToken) {
  const room = requireRoom(code);
  const player = findPlayer(room, playerToken);
  if (room.status === 'waiting' || room.status === 'finished') room.players.delete(player.id);
  else { player.connected = false; player.socketId = null; }
  return room;
}

function kickPlayer(code, token, playerId) {
  const room = authMaster(code, token);
  const player = room.players.get(playerId);
  if (!player) throw new RaceError('JOGADOR_NAO_ENCONTRADO', 'Participante não encontrado.');
  player.kicked = true;
  player.connected = false;
  return { room, player };
}

function lockRoom(code, token, locked) {
  const room = authMaster(code, token);
  room.locked = Boolean(locked);
  return room;
}

// ---------------- rodada ----------------

function startRound(code, token, now = Date.now()) {
  const room = authMaster(code, token);
  if (room.status === 'countdown' || room.status === 'racing') throw new RaceError('EM_ANDAMENTO', 'A rodada já começou.');
  if (room.status === 'ended') throw new RaceError('SALA_ENCERRADA', 'Esta sala já foi encerrada.');
  const racers = [...room.players.values()].filter((p) => !p.kicked && p.connected);
  if (!racers.length) throw new RaceError('SEM_JOGADORES', 'Espere pelo menos uma criança entrar.');
  room.text = buildText(room.config);
  room.round += 1;
  room.status = 'countdown';
  room.startAt = now + COUNTDOWN_MS;
  room.endsAt = room.startAt + (room.config.mode === 'relogio' ? room.config.seconds * 1000 : MAX_RACE_MS);
  room.finishCount = 0;
  room.results = null;
  for (const p of room.players.values()) {
    p.finishedAt = null;
    p.place = null;
    p.run = null;
    if (p.kicked || !p.connected) continue;
    // stopOnError: o texto só anda com a tecla certa (como no Teclado Mágico)
    const run = new TypingRun(room.text, { stopOnError: true });
    run.startedAt = room.startAt; // o relógio de todos começa junto
    p.run = run;
  }
  return room;
}

// Caracteres digitados por uma criança (o navegador manda em pacotinhos).
function typeKeys(code, playerToken, chars, now = Date.now()) {
  const room = requireRoom(code);
  const player = findPlayer(room, playerToken);
  if (room.status === 'countdown' && now >= room.startAt) room.status = 'racing';
  if (room.status !== 'racing' || !player.run || player.finishedAt) return { room, player, changed: false };
  const run = player.run;
  // teto de velocidade: o que passar disso é ignorado
  const allowed = Math.floor(((now - room.startAt) / 1000) * MAX_CHARS_PER_SECOND) + 5;
  const typedSoFar = run.pos + run.wrongPresses;
  const budget = Math.max(0, allowed - typedSoFar);
  const list = [...String(chars || '').normalize('NFC')].slice(0, Math.min(40, budget));
  run.now = () => now;
  for (const ch of list) {
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    run.type(ch);
    if (run.done) {
      player.finishedAt = now;
      room.finishCount += 1;
      player.place = room.finishCount;
      break;
    }
  }
  return { room, player, changed: list.length > 0 };
}

// Hora de acabar? (relógio esgotado, todos terminaram, ou tempo máximo)
function shouldEnd(room, now = Date.now()) {
  if (room.status === 'countdown' && now >= room.startAt) room.status = 'racing';
  if (room.status !== 'racing') return false;
  if (now >= room.endsAt) return true;
  if (room.config.mode === 'corrida') {
    const racing = [...room.players.values()].filter((p) => p.run && !p.kicked && p.connected);
    return racing.length > 0 && racing.every((p) => p.finishedAt);
  }
  return false;
}

function playerStats(room, p, now = Date.now()) {
  if (!p.run) return null;
  const end = p.finishedAt || Math.min(now, room.endsAt || now);
  const minutes = Math.max(0, end - room.startAt) / 60000;
  const correct = p.run.pos;
  return {
    correct,
    progress: room.text.length ? correct / [...room.text].length : 0,
    wpm: minutes > 0 ? Math.round((correct / 5 / minutes) * 10) / 10 : 0,
    accuracy: p.run.accuracy(),
    finished: Boolean(p.finishedAt),
    place: p.place,
    timeMs: p.finishedAt ? p.finishedAt - room.startAt : null,
  };
}

// Fim da rodada: classificação e pódio (mais rápido, mais preciso e quem mais
// melhorou em relação à própria média — `history` dá a média anterior de
// cada conta).
function endRound(room, history = {}, now = Date.now()) {
  if (room.status !== 'racing' && room.status !== 'countdown') return room;
  room.status = 'finished';
  const racers = [...room.players.values()].filter((p) => p.run && !p.kicked);
  const rows = racers.map((p) => ({ player: p, stats: playerStats(room, p, now) }));
  rows.sort((a, b) => {
    if (room.config.mode === 'corrida') {
      if (a.stats.finished !== b.stats.finished) return a.stats.finished ? -1 : 1;
      if (a.stats.finished) return a.stats.place - b.stats.place;
    }
    return b.stats.correct - a.stats.correct || b.stats.accuracy - a.stats.accuracy;
  });
  const ranking = rows.map((r, i) => ({
    id: r.player.id,
    studentId: r.player.studentId,
    name: r.player.name,
    avatar: r.player.avatar,
    position: i + 1,
    ...r.stats,
  }));
  const best = ranking[0];
  const enough = ranking.filter((r) => r.correct >= 10 && best && r.correct >= best.correct * 0.5);
  const precise = enough.slice().sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct)[0] || null;
  const improved = ranking
    .filter((r) => history[r.studentId] && history[r.studentId].races > 0 && r.correct >= 10)
    .map((r) => ({ ...r, gain: Math.round((r.wpm - history[r.studentId].avgWpm) * 10) / 10 }))
    .filter((r) => r.gain > 0)
    .sort((a, b) => b.gain - a.gain)[0] || null;

  let mascot = null;
  if (room.config.mode === 'relogio' && room.config.vsMascot) {
    const target = mascotTarget(room);
    const team = ranking.reduce((n, r) => n + r.correct, 0);
    mascot = { target, team, won: team >= target };
  }
  room.results = {
    round: room.round,
    mode: room.config.mode,
    ranking,
    podium: {
      fastest: best && best.correct > 0 ? best.id : null,
      precise: precise ? precise.id : null,
      improved: improved ? { id: improved.id, gain: improved.gain } : null,
    },
    mascot,
  };
  return room;
}

function mascotTarget(room) {
  const count = [...room.players.values()].filter((p) => p.run && !p.kicked).length;
  return Math.round(count * MASCOT_WPM_PER_PLAYER * 5 * (room.config.seconds / 60));
}

function endRoom(code, token) {
  const room = authMaster(code, token);
  room.status = 'ended';
  return room;
}

// ---------------- o que cada um vê ----------------

function publicPlayers(room, { hideNames = false } = {}) {
  const now = Date.now();
  return [...room.players.values()].filter((p) => !p.kicked).map((p) => {
    const stats = playerStats(room, p, now);
    return {
      id: p.id,
      name: hideNames ? null : p.name,
      avatar: p.avatar,
      connected: p.connected,
      racing: Boolean(p.run),
      progress: stats ? stats.progress : 0,
      correct: stats ? stats.correct : 0,
      wpm: stats ? stats.wpm : 0,
      accuracy: stats ? stats.accuracy : 100,
      finished: stats ? stats.finished : false,
      place: p.place,
    };
  });
}

function summary(room, opts = {}) {
  const live = room.status === 'countdown' || room.status === 'racing';
  let mascot = null;
  if (room.config.mode === 'relogio' && room.config.vsMascot && (live || room.status === 'finished')) {
    const target = mascotTarget(room);
    const elapsed = room.startAt ? Math.min(Math.max(Date.now() - room.startAt, 0), room.config.seconds * 1000) : 0;
    mascot = {
      target,
      mascotNow: Math.round(target * (elapsed / (room.config.seconds * 1000))),
      team: [...room.players.values()].reduce((n, p) => n + (p.run ? p.run.pos : 0), 0),
    };
  }
  return {
    code: room.code,
    status: room.status,
    locked: room.locked,
    round: room.round,
    config: {
      mode: room.config.mode,
      seconds: room.config.seconds,
      vsMascot: room.config.vsMascot,
      uppercase: room.config.uppercase,
      showNames: room.config.showNames,
    },
    textLength: [...room.text].length,
    startAt: room.startAt,
    endsAt: room.endsAt,
    now: Date.now(),
    players: publicPlayers(room, opts),
    results: room.results && opts.hideNames
      ? { ...room.results, ranking: room.results.ranking.map((r) => ({ ...r, name: null, studentId: undefined })) }
      : room.results && { ...room.results, ranking: room.results.ranking.map(({ studentId, ...r }) => r) },
    mascot,
  };
}

function masterState(room) {
  return { ...summary(room), config: room.config, isMaster: true, levelTitle: levelTitle(room.config.levelId) };
}

// O que vai para o canal das crianças (sem o texto: ele vai uma vez, no
// começo da rodada, e no join).
function sharedState(room) {
  return summary(room);
}

function screenState(room) {
  return { ...summary(room, { hideNames: !room.config.showNames }), isScreen: true };
}

function playerState(room, player) {
  const live = room.status === 'countdown' || room.status === 'racing';
  return {
    ...summary(room),
    you: { id: player.id, name: player.name, avatar: player.avatar, racing: Boolean(player.run) },
    // o texto só vai para quem está correndo nesta rodada
    text: player.run && (live || room.status === 'finished') ? room.text : null,
    typed: player.run ? player.run.pos : 0,
  };
}

function levelTitle(levelId) {
  const level = Levels.getLevel(levelId);
  if (!level) return '';
  const world = Levels.getWorld(level.world);
  return `${world.icon} Mundo ${level.worldIndex + 1} · ${level.title}`;
}

module.exports = {
  RaceError,
  rooms,
  COUNTDOWN_MS,
  MAX_CHARS_PER_SECOND,
  SECONDS_OPTIONS,
  getRoom,
  requireRoom,
  createRoom,
  authMaster,
  updateConfig,
  buildText,
  joinRoom,
  leaveRoom,
  kickPlayer,
  lockRoom,
  startRound,
  typeKeys,
  shouldEnd,
  endRound,
  endRoom,
  masterState,
  sharedState,
  screenState,
  playerState,
};
