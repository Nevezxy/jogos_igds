// test/cadentes.test.js
// Jogos "Cadentes": o que cai em cada fase (só o conteúdo permitido, tudo
// digitável no teclado ABNT2, mesma semente = mesma lista) e o servidor
// conferindo os resultados e calculando as estrelas.

const fs = require('fs');
const path = require('path');
const Letras = require('../public/games/letras/levels.js');
const LetrasItems = require('../public/games/letras/items.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

// o teclado ABNT2 é um script de navegador: roda com um `window` de mentira
function loadLayout() {
  const sandbox = { window: {} };
  new Function('window', fs.readFileSync(path.join(__dirname, '../public/games/digitacao/layouts/abnt2.js'), 'utf8'))(sandbox.window);
  return sandbox.window.DigitacaoLayouts.abnt2;
}

function checkLetras() {
  const layout = loadLayout();
  const ACCENT = /[áéíóúãõâêôàüç]/i;
  const bad = [];
  assert(Letras.LEVELS.length === 108 && Letras.WORLDS.every((w) => w.levels.length === 12), 'Letras Cadentes: 9 mundos com 12 fases');
  assert(new Set(Letras.LEVELS.map((l) => l.id)).size === Letras.LEVELS.length, 'ids de fase sem repetir');
  for (const level of Letras.LEVELS) {
    for (let s = 1; s <= 40; s++) {
      const items = LetrasItems.makeItems(level, s * 2654435761 % 0xFFFFFFFF);
      if (items.length !== level.count) bad.push(`${level.id}: ${items.length} peças`);
      for (const it of items) {
        if (![...it].every((ch) => layout.canType(ch))) bad.push(`${level.id}: "${it}" tem tecla que não existe`);
        const g = level.gen;
        if (g.t === 'chars' && !g.chars.includes(it)) bad.push(`${level.id}: "${it}" fora das teclas da fase`);
        if (g.accents === 'none' && ACCENT.test(it)) bad.push(`${level.id}: "${it}" tem acento`);
        if (g.accents === 'need' && ![...g.acc].some((ch) => it.toLowerCase().includes(ch))) bad.push(`${level.id}: "${it}" sem o acento da fase`);
        if (g.min && [...it].length < g.min) bad.push(`${level.id}: "${it}" curta demais`);
      }
    }
  }
  assert(bad.length === 0, `peças certas em todas as fases${bad.length ? `: ${bad.slice(0, 5).join(' / ')}` : ''}`);
  const lv = Letras.getLevel('l7b2');
  assert(JSON.stringify(LetrasItems.makeItems(lv, 9)) === JSON.stringify(LetrasItems.makeItems(lv, 9)), 'mesma semente = mesmas peças');
  assert(Letras.LEVELS.filter((l) => l.caseSensitive).every((l) => ['l5', 'l9'].includes(l.world)), 'maiúscula só conta nos mundos de maiúsculas e desafio');
  const speeds = Letras.getWorld('l1').levels.slice(0, 3).map((l) => l.fallMs);
  assert(speeds[0] > speeds[1] && speeds[1] > speeds[2], 'cada conteúdo tem 3 velocidades, da mais lenta para a mais rápida');
}

async function checkServer() {
  const srv = await startTestServer(3108);
  const { api } = srv;
  try {
    const games = await api('GET', '/api/games');
    const byId = Object.fromEntries((games.games || games).map((g) => [g.id, g]));
    assert(byId.letras && byId.letras.subject === 'digitacao' && byId.matematica.subject === 'matematica' && byId.bingo.subject === 'turma',
      'jogos com assunto (seções do painel)');

    const kid = await srv.student('Nina Prado');
    const level = Letras.getLevel('l7b1');
    const seed = 4242;
    const items = LetrasItems.makeItems(level, seed);
    const chars = items.reduce((n, it) => n + [...it].length, 0);
    const send = (body) => api('POST', '/api/progress/letras/results', {
      levelId: level.id, seed, lost: [], wrong: 0, durationMs: 60000, errorsByChar: {}, ...body,
    }, kid);

    let r = await send({ durationMs: chars * 10 });
    assert(r.code === 'RESULTADO_INVALIDO', 'rodada rápida demais é recusada');
    r = await send({ lost: [0, 0] });
    assert(r.code === 'RESULTADO_INVALIDO', 'peça repetida na lista das que caíram é recusada');
    r = await send({ lost: [items.length] });
    assert(r.code === 'RESULTADO_INVALIDO', 'peça que não existe na rodada é recusada');
    r = await send({ levelId: 'nada' });
    assert(r.code === 'FASE_INVALIDA', 'fase inexistente é recusada');

    r = await send({});
    assert(r.ok && r.result.stars === 3, 'pegou tudo sem errar = 3 estrelas');
    r = await send({ wrong: chars });
    assert(r.ok && r.result.stars === 2, 'pegou tudo mas errou muitas teclas = 2 estrelas');
    const lost = [...Array(Math.ceil(items.length * 0.3)).keys()];
    r = await send({ lost, errorsByChar: { q: 3 } });
    assert(r.ok && r.result.stars === 1, 'deixou cair 30% = 1 estrela');
    r = await send({ lost: [...Array(items.length).keys()], durationMs: 1000 });
    assert(r.ok && r.result.stars === 0, 'deixou cair tudo = 0 estrela (e não precisa de tempo mínimo)');
    assert(r.progress.levels.l7b1.stars === 3 && r.progress.trouble[items[0]] >= 1 && r.progress.trouble.q === 3,
      'progresso guarda as melhores estrelas e o que mais caiu');

    r = await api('GET', '/api/progress', null, kid);
    assert(/Fase \d+ · ⭐ 3/.test(r.summaries.letras || ''), `cartão do painel ("${r.summaries.letras}")`);
    const t = (await api('POST', '/api/teacher/login', {})).token;
    r = await api('GET', '/api/teacher/students', null, { teacher: t });
    const row = r.students.find((s) => s.name === 'Nina Prado').games.letras;
    assert(row && row.levelsDone === 1 && row.totalLevels === 108 && row.toughest.length > 0 && typeof row.caughtPct === 'number',
      'área do professor mostra fases, quanto pega e o que mais cai');
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkLetras();
    await checkServer();
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    process.exit(1);
  }
  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
})();
