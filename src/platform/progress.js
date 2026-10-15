// src/platform/progress.js
// Progresso genérico por educando e por jogo, para qualquer jogo da
// plataforma:
//   game_progress  um JSON por (educando, jogo), formato decidido pelo jogo
//   game_results   uma linha por rodada (fase, estrelas, precisão, ...)
// Cada jogo diz no seu módulo de servidor (src/games/<id>/server.js) como
// validar um resultado (validateResult), como ele muda o progresso
// (mergeProgress) e o resumo que aparece no cartão do painel (summary).

const crypto = require('crypto');
const { db, addColumnIfMissing } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS game_progress (
  student_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (student_id, game_id)
);

CREATE TABLE IF NOT EXISTS game_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  level_id TEXT,
  score INTEGER,
  stars INTEGER,
  accuracy REAL,
  speed REAL,
  duration_ms INTEGER,
  details_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_game_results_student ON game_results(student_id, game_id);
`);

// Cada rodada tem uma identificação (attempt_id), criada no navegador antes
// do primeiro envio: o mesmo resultado reenviado (internet lenta, caixa de
// saída, duplo clique) não é gravado duas vezes. source: 'livre' (o jogo
// normal) ou 'maratona'. points_delta: quanto a rodada somou aos pontos.
addColumnIfMissing('game_results', 'attempt_id', 'TEXT');
addColumnIfMissing('game_results', 'source', "TEXT NOT NULL DEFAULT 'livre'");
addColumnIfMissing('game_results', 'points_delta', 'INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_game_results_attempt ON game_results(student_id, game_id, attempt_id)');

const points = require('./points');
points.ensureFresh();

class GameError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const stmts = {
  get: db.prepare('SELECT data_json FROM game_progress WHERE student_id = ? AND game_id = ?'),
  all: db.prepare('SELECT game_id, data_json FROM game_progress WHERE student_id = ?'),
  save: db.prepare(`
    INSERT INTO game_progress (student_id, game_id, data_json, updated_at) VALUES (?,?,?,?)
    ON CONFLICT(student_id, game_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
  `),
  insertResult: db.prepare(`
    INSERT INTO game_results (student_id, game_id, level_id, score, stars, accuracy, speed, duration_ms, details_json, created_at, attempt_id, source, points_delta)
    VALUES (@student_id, @game_id, @level_id, @score, @stars, @accuracy, @speed, @duration_ms, @details_json, @created_at, @attempt_id, @source, @points_delta)
  `),
  byAttempt: db.prepare('SELECT level_id, score, stars, points_delta FROM game_results WHERE student_id = ? AND game_id = ? AND attempt_id = ?'),
  history: db.prepare(`
    SELECT game_id, level_id, stars, score, accuracy, duration_ms, source, points_delta, created_at
    FROM game_results WHERE student_id = ? AND (? IS NULL OR game_id = ?) ORDER BY created_at DESC, id DESC LIMIT ?
  `),
};

function parse(json) {
  try { return JSON.parse(json); } catch (e) { return null; }
}

function getProgress(studentId, gameId) {
  const row = stmts.get.get(studentId, gameId);
  return row ? parse(row.data_json) : null;
}

function allProgress(studentId) {
  return Object.fromEntries(stmts.all.all(studentId).map((r) => [r.game_id, parse(r.data_json)]));
}

function saveProgress(studentId, gameId, data) {
  stmts.save.run(studentId, gameId, JSON.stringify(data), Date.now());
}

// Identificação da rodada: a que o navegador mandou ou, nos navegadores
// antigos (sem attemptId, ex.: resultados que já estavam na caixa de saída),
// uma impressão digital do resultado inteiro: só o reenvio idêntico é
// reconhecido. null = sem proteção (resultados que não vêm do navegador,
// como partidas pela rede e bingo).
function attemptIdOf(body) {
  if (!body || typeof body !== 'object') return null;
  const raw = body.attemptId;
  if (typeof raw === 'string' && /^[A-Za-z0-9_:.-]{8,80}$/.test(raw)) return raw;
  return `h:${crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 32)}`;
}

// Essa rodada já foi gravada? Devolve { levelId, stars, score, pointsDelta } ou null.
function findAttempt(studentId, gameId, attemptId) {
  if (!attemptId) return null;
  const row = stmts.byAttempt.get(studentId, gameId, attemptId);
  return row ? { levelId: row.level_id, stars: row.stars, score: row.score, pointsDelta: row.points_delta } : null;
}

// Grava uma rodada já validada pelo jogo, atualiza o progresso e os pontos.
// `game` é a entrada do registro (com o módulo `server`). opts: { attemptId, source }.
// Devolve o progresso novo (result.pointsDelta recebe quanto os pontos subiram).
const recordResult = db.transaction((studentId, game, result, opts = {}) => {
  const old = getProgress(studentId, game.id);
  const merged = game.server.mergeProgress ? game.server.mergeProgress(old, result) : old;
  if (merged) saveProgress(studentId, game.id, merged);
  const pointsDelta = merged ? points.update(studentId, game.id, merged) : 0;
  result.pointsDelta = pointsDelta;
  stmts.insertResult.run({
    student_id: studentId,
    game_id: game.id,
    level_id: result.levelId ?? null,
    score: result.score ?? null,
    stars: result.stars ?? null,
    accuracy: result.accuracy ?? null,
    speed: result.wpm ?? result.speed ?? null,
    duration_ms: result.durationMs ?? null,
    details_json: JSON.stringify(result.details || {}),
    created_at: Date.now(),
    attempt_id: opts.attemptId || null,
    source: opts.source || 'livre',
    points_delta: pointsDelta,
  });
  return merged;
});

// Últimas rodadas de um educando (de um jogo ou de todos).
function history(studentId, gameId = null, limit = 50) {
  const n = Math.max(1, Math.min(500, Math.floor(Number(limit) || 50)));
  return stmts.history.all(studentId, gameId, gameId, n).map((r) => ({
    gameId: r.game_id, levelId: r.level_id, stars: r.stars, score: r.score, accuracy: r.accuracy,
    durationMs: r.duration_ms, source: r.source, pointsDelta: r.points_delta, at: r.created_at,
  }));
}

module.exports = {
  GameError,
  getProgress,
  allProgress,
  saveProgress,
  recordResult,
  attemptIdOf,
  findAttempt,
  history,
};
