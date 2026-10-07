// src/platform/progress.js
// Progresso genérico por educando e por jogo, para qualquer jogo da
// plataforma:
//   game_progress  um JSON por (educando, jogo), formato decidido pelo jogo
//   game_results   uma linha por rodada (fase, estrelas, precisão, ...)
// Cada jogo diz no seu módulo de servidor (src/games/<id>/server.js) como
// validar um resultado (validateResult), como ele muda o progresso
// (mergeProgress) e o resumo que aparece no cartão do painel (summary).

const { db } = require('./db');

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
    INSERT INTO game_results (student_id, game_id, level_id, score, stars, accuracy, speed, duration_ms, details_json, created_at)
    VALUES (@student_id, @game_id, @level_id, @score, @stars, @accuracy, @speed, @duration_ms, @details_json, @created_at)
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

// Grava uma rodada já validada pelo jogo e atualiza o progresso.
// `game` é a entrada do registro (com o módulo `server`).
const recordResult = db.transaction((studentId, game, result) => {
  const old = getProgress(studentId, game.id);
  const merged = game.server.mergeProgress ? game.server.mergeProgress(old, result) : old;
  if (merged) saveProgress(studentId, game.id, merged);
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
  });
  return merged;
});

module.exports = {
  GameError,
  getProgress,
  allProgress,
  saveProgress,
  recordResult,
};
