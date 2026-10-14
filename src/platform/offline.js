// src/platform/offline.js
// Monta o /sw.js (src/platform/sw-template.js) com a lista de arquivos do
// app e uma versão tirada dos próprios arquivos (caminho, tamanho e data):
// qualquer arquivo novo ou mudado gera outra versão, e o navegador atualiza
// o que tem guardado. As fotos do Click ficam fora da lista (são grandes e
// vão para o cache na primeira vez que aparecem).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const TEMPLATE = path.join(__dirname, 'sw-template.js');
const EXTENSIONS = new Set(['.html', '.js', '.css', '.svg', '.png', '.ico', '.webmanifest', '.json', '.woff2']);
const SKIP = [/^\/games\/click\/img\//];

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = `${base}/${entry.name}`;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else out.push({ rel, full });
  }
  return out;
}

function build() {
  const all = walk(PUBLIC);
  const hash = crypto.createHash('sha1');
  for (const f of all.concat([{ rel: '#template', full: TEMPLATE }])) {
    const st = fs.statSync(f.full);
    hash.update(`${f.rel}:${st.size}:${st.mtimeMs}\n`);
  }
  const files = all
    .map((f) => f.rel)
    .filter((rel) => EXTENSIONS.has(path.extname(rel).toLowerCase()) && !SKIP.some((re) => re.test(rel)))
    .map((rel) => (rel === '/index.html' ? '/' : rel));
  files.push('/socket.io/socket.io.js');
  const version = hash.digest('hex').slice(0, 12);
  const source = fs.readFileSync(TEMPLATE, 'utf8')
    .replace("const VERSION = '__VERSION__';", `const VERSION = '${version}';`)
    .replace('const FILES = __FILES__;', `const FILES = ${JSON.stringify(files)};`);
  return { version, files, source };
}

// Recalcula de vez em quando (em produção os arquivos não mudam; em
// desenvolvimento, uma edição aparece em até alguns segundos).
let cached = null;
let builtAt = 0;
function serviceWorker() {
  if (!cached || Date.now() - builtAt > 5000) {
    cached = build();
    builtAt = Date.now();
  }
  return cached;
}

function mount(app) {
  app.get('/sw.js', (req, res) => {
    const sw = serviceWorker();
    res.type('application/javascript')
      .set('Cache-Control', 'no-cache')
      .set('Service-Worker-Allowed', '/')
      .send(sw.source);
  });
}

module.exports = { mount, serviceWorker };
