// src/platform/points.js
// 🏅 Pontos globais da plataforma, iguais para todos os jogos e derivados
// das estrelas: cada fase vale (melhores estrelas) × 10 × (dificuldade, de
// 1 a 4). Repetir uma fase só soma se melhorar as estrelas: dá para treinar
// à vontade sem inflar o ranking. Um jogo novo entra sozinho: basta ter
// fases (levels.js) com estrelas no progresso.
//
// student_points é só um atalho para o ranking ficar rápido: pode ser
// refeito a qualquer hora a partir de game_progress (recomputeAll). Quando a
// regra muda (POINTS_VERSION), o servidor refaz tudo ao subir.
//
// Dificuldade da fase (`tier`): o `tier` da fase, senão o do mundo, senão a
// posição dela no jogo (primeiro quarto das fases = 1, ..., último = 4).

const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const POINTS_VERSION = 1;
const PER_STAR = 10;
const GAMES_DIR = path.join(__dirname, '..', '..', 'public', 'games');

db.exec(`
CREATE TABLE IF NOT EXISTS student_points (
  student_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  levels_done INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (student_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_student_points_points ON student_points(points);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// as fases de cada jogo (o mesmo levels.js do navegador); null = jogo sem fases
const levelsCache = new Map();
function levelsOf(gameId) {
  if (levelsCache.has(gameId)) return levelsCache.get(gameId);
  let Levels = null;
  const file = path.join(GAMES_DIR, String(gameId), 'levels.js');
  if (/^[a-z0-9_-]+$/.test(String(gameId)) && fs.existsSync(file)) {
    const mod = require(file);
    if (mod && Array.isArray(mod.LEVELS) && mod.LEVELS.length) Levels = mod;
  }
  levelsCache.set(gameId, Levels);
  return Levels;
}

function tierOf(Levels, level) {
  if (level.tier) return level.tier;
  const world = Levels.getWorld ? Levels.getWorld(level.world) : null;
  if (world && world.tier) return world.tier;
  const i = Levels.LEVELS.indexOf(level);
  return Math.min(4, Math.max(1, Math.ceil((4 * (i + 1)) / Levels.LEVELS.length)));
}

const levelPoints = (stars, tier) => Math.max(0, Math.min(3, Math.floor(Number(stars) || 0))) * PER_STAR * tier;

// pontos de um jogo a partir do progresso guardado: { points, levelsDone }
function gamePoints(gameId, progress) {
  const Levels = levelsOf(gameId);
  const out = { points: 0, levelsDone: 0 };
  if (!Levels || !progress || !progress.levels) return out;
  for (const level of Levels.LEVELS) {
    const rec = progress.levels[level.id];
    const stars = rec ? rec.stars || 0 : 0;
    if (stars > 0) {
      out.points += levelPoints(stars, tierOf(Levels, level));
      out.levelsDone += 1;
    }
  }
  return out;
}

const prepared = {};
const lazy = (name, sql) => prepared[name] || (prepared[name] = db.prepare(sql));

const stmts = {
  upsert: db.prepare(`
    INSERT INTO student_points (student_id, game_id, points, levels_done, updated_at) VALUES (?,?,?,?,?)
    ON CONFLICT(student_id, game_id) DO UPDATE SET points = excluded.points, levels_done = excluded.levels_done, updated_at = excluded.updated_at
  `),
  get: db.prepare('SELECT points FROM student_points WHERE student_id = ? AND game_id = ?'),
  byStudent: db.prepare('SELECT game_id, points, levels_done FROM student_points WHERE student_id = ? ORDER BY points DESC'),
  deleteStudent: db.prepare('DELETE FROM student_points WHERE student_id = ?'),
  // game_progress é criada em progress.js: estas ficam para a primeira vez que forem usadas
  get progressOf() { return lazy('progressOf', 'SELECT game_id, data_json FROM game_progress WHERE student_id = ?'); },
  get allProgress() { return lazy('allProgress', 'SELECT student_id, game_id, data_json FROM game_progress'); },
  getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
  setMeta: db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
};

const parse = (json) => { try { return JSON.parse(json); } catch (e) { return null; } };

// Atualiza os pontos de um jogo depois de uma rodada; devolve quanto subiu.
// Chamado dentro da transação de progress.recordResult.
function update(studentId, gameId, progress) {
  if (!levelsOf(gameId)) return 0;
  const { points, levelsDone } = gamePoints(gameId, progress);
  const row = stmts.get.get(studentId, gameId);
  const before = row ? row.points : 0;
  stmts.upsert.run(studentId, gameId, points, levelsDone, Date.now());
  return points - before;
}

// Refaz os pontos de um educando (ex.: depois de juntar duas contas).
const recompute = db.transaction((studentId) => {
  stmts.deleteStudent.run(studentId);
  for (const r of stmts.progressOf.all(studentId)) {
    if (!levelsOf(r.game_id)) continue;
    const { points, levelsDone } = gamePoints(r.game_id, parse(r.data_json));
    stmts.upsert.run(studentId, r.game_id, points, levelsDone, Date.now());
  }
});

// Refaz tudo (regra nova ou conferência).
const recomputeAll = db.transaction(() => {
  db.prepare('DELETE FROM student_points').run();
  for (const r of stmts.allProgress.all()) {
    if (!levelsOf(r.game_id)) continue;
    const { points, levelsDone } = gamePoints(r.game_id, parse(r.data_json));
    stmts.upsert.run(r.student_id, r.game_id, points, levelsDone, Date.now());
  }
  stmts.setMeta.run('points_version', String(POINTS_VERSION));
});

// Ao subir: regra nova (ou primeira vez) = refaz a partir do progresso.
function ensureFresh() {
  const row = stmts.getMeta.get('points_version');
  if (!row || Number(row.value) !== POINTS_VERSION) recomputeAll();
}

function byStudent(studentId) {
  const games = stmts.byStudent.all(studentId).map((r) => ({ gameId: r.game_id, points: r.points, levelsDone: r.levels_done }));
  return { total: games.reduce((n, g) => n + g.points, 0), levelsDone: games.reduce((n, g) => n + g.levelsDone, 0), games };
}

// Ranking: educandos ativos com pontos, do maior para o menor. `game` filtra
// um jogo; `className` filtra a turma. Empate: mesma posição (1, 2, 2, 4).
function ranking({ game = null, className = null, limit = 500 } = {}) {
  const where = ['s.active = 1'];
  const args = [];
  if (game) { where.push('p.game_id = ?'); args.push(game); }
  if (className) { where.push('s.class_name = ?'); args.push(className); }
  const rows = db.prepare(`
    SELECT s.id, s.display_name AS name, s.avatar, s.class_name AS className,
           SUM(p.points) AS points, SUM(p.levels_done) AS levelsDone
    FROM student_points p JOIN students s ON s.id = p.student_id
    WHERE ${where.join(' AND ')}
    GROUP BY s.id
    HAVING SUM(p.points) > 0
    ORDER BY points DESC, levelsDone DESC, s.display_name COLLATE NOCASE
    LIMIT ?
  `).all(...args, Math.max(1, Math.min(2000, Number(limit) || 500)));
  let position = 0;
  let prev = null;
  return rows.map((r, i) => {
    if (r.points !== prev) { position = i + 1; prev = r.points; }
    return { position, ...r };
  });
}

module.exports = {
  POINTS_VERSION, PER_STAR, levelsOf, tierOf, levelPoints, gamePoints,
  update, recompute, recomputeAll, ensureFresh, byStudent, ranking,
};
