// src/marathon/store.js
// 🏃 Modo Maratona: as tabelas (PLANO_MARATONA.md, seção 9). O banco é a
// fonte da verdade: o gerenciador (manager.js) guarda uma cópia em memória
// de cada maratona em andamento e grava cada mudança aqui, numa transação.
// Reiniciar o servidor = carregar de novo (load) e seguir de onde parou.
// Os votos ficam no JSON da rodada (vote_json): um voto por educando.

const { db } = require('../platform/db');

db.exec(`
CREATE TABLE IF NOT EXISTS mt_marathons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  config_json TEXT NOT NULL,
  master_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  current_round INTEGER NOT NULL DEFAULT 0,
  seed INTEGER NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  ended_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mt_teams (
  id TEXT PRIMARY KEY,
  marathon_id TEXT NOT NULL REFERENCES mt_marathons(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER
);
CREATE TABLE IF NOT EXISTS mt_participants (
  marathon_id TEXT NOT NULL REFERENCES mt_marathons(id),
  student_id TEXT NOT NULL,
  team_id TEXT,
  status TEXT NOT NULL,
  strength REAL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  class_name TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (marathon_id, student_id)
);
CREATE TABLE IF NOT EXISTS mt_rounds (
  id TEXT PRIMARY KEY,
  marathon_id TEXT NOT NULL REFERENCES mt_marathons(id),
  number INTEGER NOT NULL,
  game_id TEXT,
  entry_key TEXT,
  level_id TEXT,
  variant TEXT,
  kind TEXT,
  title TEXT,
  seed INTEGER,
  chosen_by TEXT,
  status TEXT NOT NULL,
  vote_json TEXT NOT NULL DEFAULT '{}',
  starts_at INTEGER,
  deadline_at INTEGER,
  ended_at INTEGER,
  UNIQUE (marathon_id, number)
);
CREATE TABLE IF NOT EXISTS mt_matches (
  id TEXT PRIMARY KEY,
  marathon_id TEXT NOT NULL REFERENCES mt_marathons(id),
  round_id TEXT NOT NULL REFERENCES mt_rounds(id),
  side_a TEXT NOT NULL,
  side_b TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  outcome TEXT,
  score_a REAL, score_b REAL, time_a REAL, time_b REAL,
  bonus_a INTEGER NOT NULL DEFAULT 0, bonus_b INTEGER NOT NULL DEFAULT 0,
  resolved_by TEXT,
  resolved_at INTEGER,
  detail_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS mt_entries (
  id TEXT PRIMARY KEY,
  marathon_id TEXT NOT NULL REFERENCES mt_marathons(id),
  round_id TEXT NOT NULL,
  match_id TEXT NOT NULL REFERENCES mt_matches(id),
  student_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  opponent_id TEXT,
  bg_match_id TEXT,
  status TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0,
  stars INTEGER, quality REAL, score REAL, time_ms INTEGER,
  result_json TEXT,
  submitted_at INTEGER,
  UNIQUE (match_id, student_id)
);
CREATE TABLE IF NOT EXISTS mt_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marathon_id TEXT NOT NULL,
  round_id TEXT,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_mt_rounds_marathon ON mt_rounds(marathon_id);
CREATE INDEX IF NOT EXISTS idx_mt_matches_round ON mt_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_mt_entries_student ON mt_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_mt_entries_marathon ON mt_entries(marathon_id);
CREATE INDEX IF NOT EXISTS idx_mt_events_marathon ON mt_events(marathon_id, at);
`);

const J = (x) => JSON.stringify(x == null ? {} : x);
const P = (s, d = {}) => { try { return JSON.parse(s); } catch (e) { return d; } };

const st = {
  marathon: db.prepare(`
    INSERT INTO mt_marathons (id, code, name, status, config_json, master_hash, version, current_round, seed, state_json, created_at, started_at, ended_at, updated_at)
    VALUES (@id, @code, @name, @status, @config_json, @master_hash, @version, @current_round, @seed, @state_json, @created_at, @started_at, @ended_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, config_json = excluded.config_json,
      version = excluded.version, current_round = excluded.current_round, state_json = excluded.state_json,
      started_at = excluded.started_at, ended_at = excluded.ended_at, updated_at = excluded.updated_at`),
  team: db.prepare(`
    INSERT INTO mt_teams (id, marathon_id, name, icon, color, position) VALUES (@id, @marathon_id, @name, @icon, @color, @position)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, color = excluded.color, position = excluded.position`),
  deleteTeams: db.prepare('DELETE FROM mt_teams WHERE marathon_id = ?'),
  participant: db.prepare(`
    INSERT INTO mt_participants (marathon_id, student_id, team_id, status, strength, name, avatar, class_name, joined_at)
    VALUES (@marathon_id, @student_id, @team_id, @status, @strength, @name, @avatar, @class_name, @joined_at)
    ON CONFLICT(marathon_id, student_id) DO UPDATE SET team_id = excluded.team_id, status = excluded.status, strength = excluded.strength,
      name = excluded.name, avatar = excluded.avatar, class_name = excluded.class_name`),
  deleteParticipant: db.prepare('DELETE FROM mt_participants WHERE marathon_id = ? AND student_id = ?'),
  round: db.prepare(`
    INSERT INTO mt_rounds (id, marathon_id, number, game_id, entry_key, level_id, variant, kind, title, seed, chosen_by, status, vote_json, starts_at, deadline_at, ended_at)
    VALUES (@id, @marathon_id, @number, @game_id, @entry_key, @level_id, @variant, @kind, @title, @seed, @chosen_by, @status, @vote_json, @starts_at, @deadline_at, @ended_at)
    ON CONFLICT(id) DO UPDATE SET game_id = excluded.game_id, entry_key = excluded.entry_key, level_id = excluded.level_id, variant = excluded.variant,
      kind = excluded.kind, title = excluded.title, seed = excluded.seed, chosen_by = excluded.chosen_by, status = excluded.status,
      vote_json = excluded.vote_json, starts_at = excluded.starts_at, deadline_at = excluded.deadline_at, ended_at = excluded.ended_at`),
  match: db.prepare(`
    INSERT INTO mt_matches (id, marathon_id, round_id, side_a, side_b, kind, status, outcome, score_a, score_b, time_a, time_b, bonus_a, bonus_b, resolved_by, resolved_at, detail_json)
    VALUES (@id, @marathon_id, @round_id, @side_a, @side_b, @kind, @status, @outcome, @score_a, @score_b, @time_a, @time_b, @bonus_a, @bonus_b, @resolved_by, @resolved_at, @detail_json)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, outcome = excluded.outcome, score_a = excluded.score_a, score_b = excluded.score_b,
      time_a = excluded.time_a, time_b = excluded.time_b, bonus_a = excluded.bonus_a, bonus_b = excluded.bonus_b,
      resolved_by = excluded.resolved_by, resolved_at = excluded.resolved_at, detail_json = excluded.detail_json`),
  entry: db.prepare(`
    INSERT INTO mt_entries (id, marathon_id, round_id, match_id, student_id, team_id, opponent_id, bg_match_id, status, seen, stars, quality, score, time_ms, result_json, submitted_at)
    VALUES (@id, @marathon_id, @round_id, @match_id, @student_id, @team_id, @opponent_id, @bg_match_id, @status, @seen, @stars, @quality, @score, @time_ms, @result_json, @submitted_at)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, seen = excluded.seen, stars = excluded.stars, quality = excluded.quality,
      score = excluded.score, time_ms = excluded.time_ms, result_json = excluded.result_json, submitted_at = excluded.submitted_at, bg_match_id = excluded.bg_match_id`),
  event: db.prepare('INSERT INTO mt_events (marathon_id, round_id, at, actor, type, payload_json) VALUES (?, ?, ?, ?, ?, ?)'),
  byId: db.prepare('SELECT * FROM mt_marathons WHERE id = ?'),
  byCode: db.prepare('SELECT id FROM mt_marathons WHERE code = ?'),
  active: db.prepare("SELECT id FROM mt_marathons WHERE status NOT IN ('encerrada', 'cancelada')"),
  history: db.prepare("SELECT id, code, name, status, config_json, state_json, created_at, started_at, ended_at FROM mt_marathons ORDER BY created_at DESC LIMIT ?"),
  teams: db.prepare('SELECT * FROM mt_teams WHERE marathon_id = ? ORDER BY position, id'),
  participants: db.prepare('SELECT * FROM mt_participants WHERE marathon_id = ? ORDER BY joined_at, student_id'),
  rounds: db.prepare('SELECT * FROM mt_rounds WHERE marathon_id = ? ORDER BY number'),
  matches: db.prepare('SELECT * FROM mt_matches WHERE marathon_id = ?'),
  entries: db.prepare('SELECT * FROM mt_entries WHERE marathon_id = ?'),
  events: db.prepare('SELECT * FROM mt_events WHERE marathon_id = ? ORDER BY id'),
};

// ---------------- gravar (cada objeto como está na memória) ----------------
function saveMarathon(m) {
  st.marathon.run({
    id: m.id, code: m.code, name: m.name, status: m.status, config_json: J(m.config), master_hash: m.masterHash,
    version: m.version, current_round: m.currentRound, seed: m.seed, state_json: J(m.state),
    created_at: m.createdAt, started_at: m.startedAt || null, ended_at: m.endedAt || null, updated_at: Date.now(),
  });
}
const saveTeam = (m, t) => st.team.run({ id: t.id, marathon_id: m.id, name: t.name, icon: t.icon, color: t.color, position: t.position ?? null });
const deleteTeams = (m) => st.deleteTeams.run(m.id);
const saveParticipant = (m, p) => st.participant.run({
  marathon_id: m.id, student_id: p.studentId, team_id: p.teamId || null, status: p.status, strength: p.strength ?? null,
  name: p.name, avatar: p.avatar, class_name: p.className || null, joined_at: p.joinedAt,
});
const deleteParticipant = (m, studentId) => st.deleteParticipant.run(m.id, studentId);
const saveRound = (m, r) => st.round.run({
  id: r.id, marathon_id: m.id, number: r.number, game_id: r.gameId || null, entry_key: r.entryKey || null, level_id: r.levelId || null,
  variant: r.variant || null, kind: r.kind || null, title: r.title || null, seed: r.seed ?? null, chosen_by: r.chosenBy || null,
  status: r.status, vote_json: J(r.vote), starts_at: r.startsAt || null, deadline_at: r.deadlineAt || null, ended_at: r.endedAt || null,
});
const saveMatch = (m, x) => st.match.run({
  id: x.id, marathon_id: m.id, round_id: x.roundId, side_a: x.sideA, side_b: x.sideB || null, kind: x.kind, status: x.status,
  outcome: x.outcome || null, score_a: x.scoreA ?? null, score_b: x.scoreB ?? null, time_a: x.timeA ?? null, time_b: x.timeB ?? null,
  bonus_a: x.bonusA || 0, bonus_b: x.bonusB || 0, resolved_by: x.resolvedBy || null, resolved_at: x.resolvedAt || null, detail_json: J(x.detail),
});
const saveEntry = (m, e) => st.entry.run({
  id: e.id, marathon_id: m.id, round_id: e.roundId, match_id: e.matchId, student_id: e.studentId, team_id: e.teamId,
  opponent_id: e.opponentId || null, bg_match_id: e.bgMatchId || null, status: e.status, seen: e.seen ? 1 : 0,
  stars: e.stars ?? null, quality: e.quality ?? null, score: e.score ?? null, time_ms: e.timeMs ?? null,
  result_json: e.result ? JSON.stringify(e.result) : null, submitted_at: e.submittedAt || null,
});
const event = (m, type, actor = 'sistema', payload = {}, roundId = null) => st.event.run(m.id, roundId, Date.now(), String(actor), type, J(payload));

// ---------------- ler ----------------
function load(id) {
  const row = st.byId.get(id);
  if (!row) return null;
  return {
    id: row.id, code: row.code, name: row.name, status: row.status, config: P(row.config_json), masterHash: row.master_hash,
    version: row.version, currentRound: row.current_round, seed: row.seed, state: P(row.state_json),
    createdAt: row.created_at, startedAt: row.started_at, endedAt: row.ended_at,
    teams: st.teams.all(id).map((t) => ({ id: t.id, name: t.name, icon: t.icon, color: t.color, position: t.position })),
    participants: st.participants.all(id).map((p) => ({
      studentId: p.student_id, teamId: p.team_id, status: p.status, strength: p.strength, name: p.name, avatar: p.avatar, className: p.class_name, joinedAt: p.joined_at,
    })),
    rounds: st.rounds.all(id).map((r) => ({
      id: r.id, number: r.number, gameId: r.game_id, entryKey: r.entry_key, levelId: r.level_id, variant: r.variant, kind: r.kind, title: r.title,
      seed: r.seed, chosenBy: r.chosen_by, status: r.status, vote: P(r.vote_json), startsAt: r.starts_at, deadlineAt: r.deadline_at, endedAt: r.ended_at,
    })),
    matches: st.matches.all(id).map((x) => ({
      id: x.id, roundId: x.round_id, sideA: x.side_a, sideB: x.side_b, kind: x.kind, status: x.status, outcome: x.outcome,
      scoreA: x.score_a, scoreB: x.score_b, timeA: x.time_a, timeB: x.time_b, bonusA: x.bonus_a, bonusB: x.bonus_b,
      resolvedBy: x.resolved_by, resolvedAt: x.resolved_at, detail: P(x.detail_json),
    })),
    entries: st.entries.all(id).map((e) => ({
      id: e.id, roundId: e.round_id, matchId: e.match_id, studentId: e.student_id, teamId: e.team_id, opponentId: e.opponent_id,
      bgMatchId: e.bg_match_id, status: e.status, seen: Boolean(e.seen), stars: e.stars, quality: e.quality, score: e.score, timeMs: e.time_ms,
      result: e.result_json ? P(e.result_json, null) : null, submittedAt: e.submitted_at,
    })),
  };
}
const idByCode = (code) => { const r = st.byCode.get(String(code || '').toUpperCase()); return r ? r.id : null; };
const activeIds = () => st.active.all().map((r) => r.id);
const history = (limit = 50) => st.history.all(limit).map((r) => ({
  id: r.id, code: r.code, name: r.name, status: r.status, config: P(r.config_json), state: P(r.state_json),
  createdAt: r.created_at, startedAt: r.started_at, endedAt: r.ended_at,
}));
const events = (id) => st.events.all(id).map((e) => ({ at: e.at, roundId: e.round_id, actor: e.actor, type: e.type, payload: P(e.payload_json) }));

module.exports = {
  db, transaction: (fn) => db.transaction(fn),
  saveMarathon, saveTeam, deleteTeams, saveParticipant, deleteParticipant, saveRound, saveMatch, saveEntry, event,
  load, idByCode, activeIds, history, events,
};
