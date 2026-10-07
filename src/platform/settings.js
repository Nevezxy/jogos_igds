// src/platform/settings.js
// Configurações da plataforma que o professor muda pela área do professor
// (guardadas no SQLite, valem para todos os aparelhos).

const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
`);

const DEFAULTS = {
  allowSignup: true, // educandos podem criar a própria conta no login
};

const getStmt = db.prepare('SELECT value_json FROM settings WHERE key = ?');
const setStmt = db.prepare(`
  INSERT INTO settings (key, value_json) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
`);

function get(key) {
  const row = getStmt.get(key);
  if (!row) return DEFAULTS[key];
  try { return JSON.parse(row.value_json); } catch (e) { return DEFAULTS[key]; }
}

function set(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`Configuração desconhecida: ${key}`);
  setStmt.run(key, JSON.stringify(value));
}

function all() {
  return Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, get(k)]));
}

module.exports = { get, set, all };
