// src/platform/db.js
// Camada de persistência (SQLite). Guarda o histórico de salas, partidas,
// participantes, cartelas, sorteios e vitórias, para permitir no futuro
// estatísticas, reaproveitamento de configurações e auditoria.
// O ESTADO "AO VIVO" da partida vive em memória (roomManager.js) por
// performance; aqui gravamos snapshots/eventos para durabilidade.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// DB_FILE permite usar outro arquivo (os testes usam um banco temporário).
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', '..', 'data', 'bingo.sqlite');
const DATA_DIR = path.dirname(DB_FILE);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  name TEXT,
  status TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  card_json TEXT,
  has_won INTEGER DEFAULT 0,
  kicked INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_code) REFERENCES rooms(code)
);

CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  match_number INTEGER NOT NULL DEFAULT 1,
  value TEXT NOT NULL,
  drawn_at INTEGER NOT NULL,
  FOREIGN KEY (room_code) REFERENCES rooms(code)
);

CREATE TABLE IF NOT EXISTS wins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  match_number INTEGER NOT NULL DEFAULT 1,
  won_at INTEGER NOT NULL,
  FOREIGN KEY (room_code) REFERENCES rooms(code)
);
`);

// Migrações simples: colunas acrescentadas depois que o banco já existia.
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing('players', 'student_id', 'TEXT');

function upsertRoom(room) {
  const stmt = db.prepare(`
    INSERT INTO rooms (code, name, status, config_json, created_at, updated_at)
    VALUES (@code, @name, @status, @config_json, @created_at, @updated_at)
    ON CONFLICT(code) DO UPDATE SET
      name=excluded.name,
      status=excluded.status,
      config_json=excluded.config_json,
      updated_at=excluded.updated_at
  `);
  stmt.run({
    code: room.code,
    name: room.name || room.code,
    status: room.status,
    config_json: JSON.stringify(room.config),
    created_at: room.createdAt,
    updated_at: Date.now(),
  });
}

function markRoomEnded(code) {
  db.prepare(`UPDATE rooms SET status='encerrada', ended_at=@t, updated_at=@t WHERE code=@code`)
    .run({ code, t: Date.now() });
}

function upsertPlayer(player, roomCode) {
  const stmt = db.prepare(`
    INSERT INTO players (id, room_code, student_id, name, token, card_json, has_won, kicked, created_at)
    VALUES (@id, @room_code, @student_id, @name, @token, @card_json, @has_won, @kicked, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      card_json=excluded.card_json,
      has_won=excluded.has_won,
      kicked=excluded.kicked
  `);
  stmt.run({
    id: player.id,
    room_code: roomCode,
    student_id: player.studentId || null,
    name: player.name,
    token: player.token,
    card_json: player.card ? JSON.stringify(player.card) : null,
    has_won: player.hasWon ? 1 : 0,
    kicked: player.kicked ? 1 : 0,
    created_at: player.createdAt || Date.now(),
  });
}

function insertDraw(roomCode, matchNumber, value) {
  db.prepare(`INSERT INTO draws (room_code, match_number, value, drawn_at) VALUES (?,?,?,?)`)
    .run(roomCode, matchNumber, String(value), Date.now());
}

function clearDraws(roomCode) {
  db.prepare(`DELETE FROM draws WHERE room_code=?`).run(roomCode);
}

function insertWin(roomCode, playerId, playerName, pattern, matchNumber) {
  db.prepare(`
    INSERT INTO wins (room_code, player_id, player_name, pattern, match_number, won_at)
    VALUES (?,?,?,?,?,?)
  `).run(roomCode, playerId, playerName, pattern, matchNumber, Date.now());
}

module.exports = {
  db,
  upsertRoom,
  markRoomEnded,
  upsertPlayer,
  insertDraw,
  clearDraws,
  insertWin,
};
