// Utilitários dos testes: cada arquivo de teste sobe o próprio servidor, numa
// porta separada e com um banco SQLite temporário (apagado no fim). Assim os
// testes não precisam de `npm start` e não deixam contas no banco de verdade.

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

async function startTestServer(port) {
  const dbFile = path.join(os.tmpdir(), `igds-test-${port}-${process.pid}-${Date.now()}.sqlite`);
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), DB_FILE: dbFile },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('servidor de teste não subiu a tempo')), 15000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('rodando')) { clearTimeout(timer); resolve(); }
    });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`servidor de teste saiu com código ${code}`)); });
  });
  const url = `http://localhost:${port}`;

  async function api(method, route, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Student-Token'] = token;
    const res = await fetch(url + route, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ...data };
  }

  // Cria uma conta de educando e devolve o token da sessão.
  async function student(name, avatar = '🐶') {
    const res = await api('POST', '/api/auth/register', { name, avatar });
    if (!res.ok) throw new Error(`não criou a conta "${name}": ${res.code}`);
    return res.token;
  }

  async function stop() {
    child.removeAllListeners('exit');
    if (child.exitCode === null) {
      child.kill();
      await new Promise((res) => child.on('exit', res));
    }
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbFile + suffix, { force: true });
  }

  return { url, api, student, stop };
}

module.exports = { startTestServer };
