// test/offline.test.js
// Internet fraca: o /sw.js (service worker) sai com a lista de arquivos do
// app e uma versão, sem as fotos grandes do Click, e com os cabeçalhos certos.

const { startTestServer } = require('./helpers');
const offline = require('../src/platform/offline');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

(async () => {
  const sw = offline.serviceWorker();
  assert(/^[0-9a-f]{12}$/.test(sw.version), `versão tirada dos arquivos (${sw.version})`);
  for (const f of ['/', '/js/platform/api.js', '/css/platform.css', '/games/click/game.js', '/games/matematica/levels.js', '/socket.io/socket.io.js']) {
    assert(sw.files.includes(f), `guarda ${f}`);
  }
  assert(!sw.files.some((f) => f.startsWith('/games/click/img/')), 'as fotos do Click ficam fora da lista (vão para o cache quando aparecem)');
  assert(!sw.files.includes('/index.html') && new Set(sw.files).size === sw.files.length, 'sem arquivo repetido');
  assert(!sw.source.includes('__VERSION__') && !sw.source.includes('__FILES__'), 'o modelo foi preenchido');
  try { new Function(sw.source); assert(true, 'o service worker é JavaScript válido'); } catch (e) { assert(false, `service worker inválido: ${e.message}`); }

  const srv = await startTestServer(3110);
  try {
    const res = await fetch(`${srv.url}/sw.js`);
    const text = await res.text();
    assert(res.ok && /javascript/.test(res.headers.get('content-type')) && res.headers.get('cache-control') === 'no-cache'
      && res.headers.get('service-worker-allowed') === '/', '/sw.js com tipo e cabeçalhos certos');
    assert(text.includes(`igds-static-`) && text.includes('/games/click/game.js'), '/sw.js traz a lista de arquivos');
  } finally {
    await srv.stop();
  }

  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
})();
