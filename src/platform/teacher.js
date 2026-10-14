// src/platform/teacher.js
// Área do professor no servidor. Protegida por um PIN definido na variável
// de ambiente PROFESSOR_PIN; sem PIN configurado, fica aberta (como era a
// criação de salas do bingo). Quem acerta o PIN recebe um token (válido por
// 12 horas, guardado só em memória: reiniciar o servidor pede o PIN de novo).

const crypto = require('crypto');
const { db } = require('./db');
const { generateToken } = require('./idGenerator');
const accounts = require('./accounts');
const progress = require('./progress');
const settings = require('./settings');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const tokens = new Map(); // token -> expiresAt

class TeacherError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function pin() {
  return String(process.env.PROFESSOR_PIN || '').trim();
}

function pinRequired() {
  return pin().length > 0;
}

// Comparação em tempo constante (não dá pista de quantos dígitos acertou).
function samePin(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// Freio simples contra tentativas em série: 10 erros seguidos = 1 minuto de espera.
let failures = 0;
let blockedUntil = 0;

function login(givenPin) {
  if (pinRequired()) {
    if (Date.now() < blockedUntil) {
      throw new TeacherError('MUITAS_TENTATIVAS', 'Muitas tentativas. Espere um minuto e tente de novo.', 429);
    }
    if (!samePin(givenPin || '', pin())) {
      failures++;
      if (failures >= 10) { blockedUntil = Date.now() + 60 * 1000; failures = 0; }
      throw new TeacherError('PIN_INVALIDO', 'PIN incorreto.', 401);
    }
    failures = 0;
  }
  const token = generateToken();
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function isValid(token) {
  if (!pinRequired()) return true;
  const exp = token && tokens.get(String(token));
  if (!exp) return false;
  if (Date.now() > exp) { tokens.delete(String(token)); return false; }
  return true;
}

function requireTeacher(token) {
  if (!isValid(token)) throw new TeacherError('PROFESSOR_NAO_AUTORIZADO', 'Entre na área do professor com o PIN.', 401);
}

function logout(token) {
  if (token) tokens.delete(String(token));
}

// Lista da turma com o resumo de cada jogo (teacherSummary do jogo).
function classList(registry) {
  return accounts.listStudents().map((student) => {
    const all = progress.allProgress(student.id);
    const games = {};
    for (const game of registry.games) {
      if (game.server && typeof game.server.teacherSummary === 'function') {
        games[game.id] = game.server.teacherSummary(all[game.id] || null);
      }
    }
    return { ...student, games };
  });
}

// Evolução das últimas semanas, a partir do histórico de rodadas: para cada
// educando, semana a semana (0 = últimos 7 dias, 1 = os 7 anteriores...),
// quantas rodadas jogou, quantos minutos, a precisão média e quantas fases
// conseguiu pela primeira vez (1ª estrela). No total e por jogo.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EVOLUTION_WEEKS = 6;
const evolutionStmts = {
  rounds: db.prepare('SELECT student_id, game_id, accuracy, duration_ms, created_at FROM game_results WHERE created_at >= ?'),
  firsts: db.prepare(`SELECT student_id, game_id, level_id, MIN(created_at) AS first FROM game_results
    WHERE stars >= 1 GROUP BY student_id, game_id, level_id HAVING first >= ?`),
};

function evolution(now = Date.now(), weeks = EVOLUTION_WEEKS) {
  const since = now - weeks * WEEK_MS;
  const blank = () => Array.from({ length: weeks }, () => ({ rounds: 0, minutes: 0, accSum: 0, accN: 0, newLevels: 0 }));
  const out = {};
  const bucket = (studentId, gameId, ts) => {
    const w = Math.floor((now - ts) / WEEK_MS);
    if (w < 0 || w >= weeks) return null;
    const s = out[studentId] || (out[studentId] = { all: blank(), games: {} });
    const g = s.games[gameId] || (s.games[gameId] = blank());
    return [s.all[w], g[w]];
  };
  for (const r of evolutionStmts.rounds.all(since)) {
    const cells = bucket(r.student_id, r.game_id, r.created_at);
    if (!cells) continue;
    for (const c of cells) {
      c.rounds++;
      c.minutes += (r.duration_ms || 0) / 60000;
      if (typeof r.accuracy === 'number') { c.accSum += r.accuracy; c.accN++; }
    }
  }
  for (const r of evolutionStmts.firsts.all(since)) {
    const cells = bucket(r.student_id, r.game_id, r.first);
    if (cells) cells.forEach((c) => { c.newLevels++; });
  }
  const finish = (list) => list.map((c) => ({
    rounds: c.rounds,
    minutes: Math.round(c.minutes),
    accuracy: c.accN ? Math.round(c.accSum / c.accN) : null,
    newLevels: c.newLevels,
  }));
  for (const s of Object.values(out)) {
    s.all = finish(s.all);
    for (const id of Object.keys(s.games)) s.games[id] = finish(s.games[id]);
  }
  return out;
}

// Junta a conta `fromId` (criada por engano) na conta `intoId`: progresso de
// cada jogo (o jogo decide como, em mergeAccounts), histórico de rodadas e
// jogadores do bingo passam para a conta certa; a conta repetida some.
const moveHistory = db.transaction((fromId, intoId) => {
  db.prepare('UPDATE game_results SET student_id = ? WHERE student_id = ?').run(intoId, fromId);
  db.prepare('UPDATE players SET student_id = ? WHERE student_id = ?').run(intoId, fromId);
  db.prepare('DELETE FROM game_progress WHERE student_id = ?').run(fromId);
});

function mergeStudents(registry, fromId, intoId) {
  if (String(fromId) === String(intoId)) throw new TeacherError('MESMA_CONTA', 'Escolha duas contas diferentes.');
  const from = accounts.requireStudentRow(fromId);
  const into = accounts.requireStudentRow(intoId);
  const fromAll = progress.allProgress(from.id);
  const intoAll = progress.allProgress(into.id);
  for (const [gameId, fromData] of Object.entries(fromAll)) {
    const game = registry.games.find((g) => g.id === gameId);
    const intoData = intoAll[gameId] || null;
    const merged = game && game.server && typeof game.server.mergeAccounts === 'function'
      ? game.server.mergeAccounts(intoData, fromData)
      : (intoData || fromData);
    if (merged) progress.saveProgress(into.id, gameId, merged);
  }
  moveHistory(from.id, into.id);
  accounts.removeMergedStudent(from.id);
}

// Libera (ou bloqueia de novo) todas as fases de um jogo para um educando.
function setUnlockedAll(registry, studentId, gameId, value) {
  const student = accounts.requireStudentRow(studentId);
  const game = registry.games.find((g) => g.id === gameId);
  if (!game || !game.server || typeof game.server.setUnlockedAll !== 'function') {
    throw new TeacherError('SEM_FASES', 'Esse jogo não tem fases para liberar.');
  }
  const updated = game.server.setUnlockedAll(progress.getProgress(student.id, game.id), value);
  progress.saveProgress(student.id, game.id, updated);
}

// Cadastro da turma de uma vez: um nome por linha, todos na turma `className`
// (opcional).
function bulkRegister(names, className) {
  const turma = accounts.normalizeClass(className); // turma inválida: nem começa
  const list = (Array.isArray(names) ? names : String(names || '').split(/\r?\n/))
    .map((n) => String(n).trim()).filter(Boolean).slice(0, 100);
  const created = [];
  const skipped = [];
  for (const name of list) {
    try {
      created.push(accounts.register(name, null, { byTeacher: true, className: turma }).student.name);
    } catch (e) {
      if (!(e instanceof accounts.AccountError)) throw e;
      skipped.push({ name, reason: e.message });
    }
  }
  return { created, skipped };
}

module.exports = {
  TeacherError,
  pinRequired,
  login,
  logout,
  isValid,
  requireTeacher,
  classList,
  evolution,
  EVOLUTION_WEEKS,
  mergeStudents,
  setUnlockedAll,
  bulkRegister,
  settings,
};
