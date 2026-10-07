// src/platform/accounts.js
// Contas dos educandos. O login é só o nome e o sobrenome, sem senha: a
// comparação ignora maiúsculas, acentos e espaços extras ("joao  silva" é a
// mesma conta que "João Silva"). Cada login gera um token de sessão, guardado
// no navegador, que identifica o educando em todos os jogos.

const { db } = require('./db');
const { generateId, generateToken } = require('./idGenerator');
const { normalizeAvatar, isNameAllowed, AVATARS } = require('./avatars');
const settings = require('./settings');

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  avatar TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS student_sessions (
  token TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id)
);
CREATE INDEX IF NOT EXISTS idx_student_sessions_student ON student_sessions(student_id);
`);

const NAME_MIN = 3;
const NAME_MAX = 40;
// Sessões paradas por mais tempo que isso deixam de valer (computador da
// escola esquecido logado).
const SESSION_MAX_IDLE_MS = 180 * 24 * 60 * 60 * 1000;
// Palavras que ficam em minúscula no meio do nome ("Ana da Silva").
const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

class AccountError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Espaços colapsados e apóstrofos tipográficos trocados pelo simples.
function cleanName(name) {
  return String(name || '')
    .normalize('NFC')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Chave de comparação: sem acentos, minúsculas, espaços colapsados.
function nameKey(name) {
  return cleanName(name)
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase();
}

// "maria DA silva" -> "Maria da Silva". Palavras com maiúsculas e minúsculas
// misturadas de propósito ("McAlister") ficam como foram digitadas.
function formatDisplayName(name) {
  const capitalize = (part) => (part ? part[0].toUpperCase() + part.slice(1) : part);
  return cleanName(name).split(' ').map((word, i) => {
    if (/\p{N}/u.test(word)) return word.toUpperCase(); // turma: "5a" -> "5A"
    const lower = word.toLowerCase();
    const mixed = word !== lower && word !== word.toUpperCase();
    if (mixed) return word;
    if (i > 0 && PARTICLES.has(lower)) return lower;
    return lower.split('-').map(capitalize).join('-');
  }).join(' ');
}

// Confere o nome e devolve { display, key } ou lança AccountError.
function validateName(name) {
  const clean = cleanName(name);
  if (clean.length < NAME_MIN || clean.length > NAME_MAX) {
    throw new AccountError('NOME_INVALIDO', `O nome precisa ter de ${NAME_MIN} a ${NAME_MAX} letras.`);
  }
  // letras, espaço, hífen e apóstrofo; números só junto de letras, para
  // diferenciar a turma ("Ana Souza 5A"), nunca sozinhos ("Ana 123")
  const words = clean.split(' ');
  if (!/^[\p{L}][\p{L}\p{N}' -]*$/u.test(clean) || !words.every((w) => /\p{L}/u.test(w))) {
    throw new AccountError('NOME_INVALIDO', 'Use só letras no nome (a turma pode ir junto, como 5A).');
  }
  // nome + sobrenome: pelo menos duas palavras com duas letras ou mais
  const realWords = words.filter((w) => w.replace(/['\-\p{N}]/gu, '').length >= 2);
  if (realWords.length < 2) {
    throw new AccountError('NOME_SEM_SOBRENOME', 'Escreva o nome e o sobrenome.');
  }
  if (!isNameAllowed(clean)) {
    throw new AccountError('NOME_IMPROPRIO', 'Esse nome não pode ser usado.');
  }
  return { display: formatDisplayName(clean), key: nameKey(clean) };
}

function publicStudent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name,
    firstName: row.display_name.split(' ')[0],
    avatar: row.avatar,
  };
}

const stmts = {
  byKey: db.prepare('SELECT * FROM students WHERE name_key = ?'),
  byId: db.prepare('SELECT * FROM students WHERE id = ?'),
  insertStudent: db.prepare(`
    INSERT INTO students (id, display_name, name_key, avatar, active, created_at, last_login_at)
    VALUES (@id, @display_name, @name_key, @avatar, 1, @now, @last_login_at)
  `),
  touchLogin: db.prepare('UPDATE students SET last_login_at = ? WHERE id = ?'),
  setAvatar: db.prepare('UPDATE students SET avatar = ? WHERE id = ?'),
  insertSession: db.prepare('INSERT INTO student_sessions (token, student_id, created_at, last_seen_at) VALUES (?,?,?,?)'),
  sessionWithStudent: db.prepare(`
    SELECT s.token, s.last_seen_at, st.* FROM student_sessions s
    JOIN students st ON st.id = s.student_id
    WHERE s.token = ?
  `),
  touchSession: db.prepare('UPDATE student_sessions SET last_seen_at = ? WHERE token = ?'),
  deleteSession: db.prepare('DELETE FROM student_sessions WHERE token = ?'),
  purgeSessions: db.prepare('DELETE FROM student_sessions WHERE last_seen_at < ?'),
  list: db.prepare('SELECT * FROM students ORDER BY display_name COLLATE NOCASE'),
  rename: db.prepare('UPDATE students SET display_name = ?, name_key = ? WHERE id = ?'),
  setActive: db.prepare('UPDATE students SET active = ? WHERE id = ?'),
  deleteSessionsOf: db.prepare('DELETE FROM student_sessions WHERE student_id = ?'),
  deleteStudent: db.prepare('DELETE FROM students WHERE id = ?'),
};

stmts.purgeSessions.run(Date.now() - SESSION_MAX_IDLE_MS);

function createSession(studentId) {
  const token = generateToken();
  const now = Date.now();
  stmts.insertSession.run(token, studentId, now, now);
  stmts.touchLogin.run(now, studentId);
  return token;
}

function requireActive(row) {
  if (!row.active) {
    throw new AccountError('CONTA_DESATIVADA', 'Esta conta foi desativada. Fale com o(a) professor(a).', 403);
  }
}

// Só diz se a conta existe (e mostra o bichinho, para a criança se
// reconhecer) e se ela pode criar uma conta nova.
function lookup(name) {
  const { display, key } = validateName(name);
  const row = stmts.byKey.get(key);
  if (!row || !row.active) return { exists: false, name: display, canRegister: Boolean(settings.get('allowSignup')) };
  return { exists: true, name: row.display_name, avatar: row.avatar };
}

function login(name) {
  const { key } = validateName(name);
  const row = stmts.byKey.get(key);
  if (!row) throw new AccountError('CONTA_NAO_ENCONTRADA', 'Não existe conta com esse nome.', 404);
  requireActive(row);
  return { token: createSession(row.id), student: publicStudent(row) };
}

// `byTeacher`: cadastro feito pela área do professor (vale mesmo com o
// autocadastro desligado e não abre sessão).
function register(name, avatar, { byTeacher = false } = {}) {
  if (!byTeacher && !settings.get('allowSignup')) {
    throw new AccountError('CADASTRO_FECHADO', 'Peça ao professor(a) para criar a sua conta.', 403);
  }
  const { display, key } = validateName(name);
  if (stmts.byKey.get(key)) {
    throw new AccountError('CONTA_JA_EXISTE', 'Já existe uma conta com esse nome.', 409);
  }
  const row = {
    id: generateId('s_'),
    display_name: display,
    name_key: key,
    avatar: normalizeAvatar(avatar),
    now: Date.now(),
    // cadastrada pelo professor: a criança ainda não entrou
    last_login_at: byTeacher ? null : Date.now(),
  };
  try {
    stmts.insertStudent.run(row);
  } catch (e) {
    // duas crianças criando a mesma conta ao mesmo tempo
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) {
      throw new AccountError('CONTA_JA_EXISTE', 'Já existe uma conta com esse nome.', 409);
    }
    throw e;
  }
  const created = stmts.byId.get(row.id);
  if (byTeacher) return { student: publicStudent(created) };
  return { token: createSession(created.id), student: publicStudent(created) };
}

// Educando dono do token, ou lança AccountError (401).
function authenticate(token) {
  const row = token ? stmts.sessionWithStudent.get(String(token)) : null;
  const now = Date.now();
  if (!row || now - row.last_seen_at > SESSION_MAX_IDLE_MS) {
    throw new AccountError('SESSAO_INVALIDA', 'Sessão expirada. Entre de novo.', 401);
  }
  requireActive(row);
  // não grava a cada requisição: uma vez por minuto basta
  if (now - row.last_seen_at > 60 * 1000) stmts.touchSession.run(now, row.token);
  return publicStudent(row);
}

function logout(token) {
  if (token) stmts.deleteSession.run(String(token));
}

function setAvatar(studentId, avatar) {
  if (!AVATARS.includes(avatar)) throw new AccountError('AVATAR_INVALIDO', 'Bichinho inválido.');
  stmts.setAvatar.run(avatar, studentId);
  return publicStudent(stmts.byId.get(studentId));
}

// ---------------- área do professor ----------------

function requireStudentRow(id) {
  const row = stmts.byId.get(String(id || ''));
  if (!row) throw new AccountError('CONTA_NAO_ENCONTRADA', 'Educando não encontrado.', 404);
  return row;
}

function listStudents() {
  return stmts.list.all().map((row) => ({
    ...publicStudent(row),
    active: Boolean(row.active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }));
}

// Corrige o nome (ex.: erro de digitação, ou "Ana Souza 5A" para diferenciar).
function renameStudent(id, name) {
  const row = requireStudentRow(id);
  const { display, key } = validateName(name);
  const other = stmts.byKey.get(key);
  if (other && other.id !== row.id) {
    throw new AccountError('CONTA_JA_EXISTE', 'Já existe uma conta com esse nome.', 409);
  }
  stmts.rename.run(display, key, row.id);
  return publicStudent(stmts.byId.get(row.id));
}

// Desativar: a conta não entra mais (e quem estava logado sai).
function setActive(id, active) {
  const row = requireStudentRow(id);
  stmts.setActive.run(active ? 1 : 0, row.id);
  if (!active) stmts.deleteSessionsOf.run(row.id);
}

// Apaga a conta `fromId` depois que o progresso dela foi juntado em outra.
function removeMergedStudent(fromId) {
  stmts.deleteSessionsOf.run(fromId);
  stmts.deleteStudent.run(fromId);
}

module.exports = {
  requireStudentRow,
  listStudents,
  renameStudent,
  setActive,
  removeMergedStudent,
  AccountError,
  nameKey,
  formatDisplayName,
  validateName,
  lookup,
  login,
  register,
  authenticate,
  logout,
  setAvatar,
};
