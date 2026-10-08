// test/cadentes.test.js
// Jogos "Cadentes": o que cai em cada fase (só o conteúdo permitido, tudo
// digitável no teclado ABNT2, mesma semente = mesma lista) e o servidor
// conferindo os resultados e calculando as estrelas.

const fs = require('fs');
const path = require('path');
const Letras = require('../public/games/letras/levels.js');
const LetrasItems = require('../public/games/letras/items.js');
const Numeros = require('../public/games/numeros/levels.js');
const NumerosItems = require('../public/games/numeros/items.js');
const P = require('../public/games/matematica/problems.js');
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
  assert(Letras.LEVELS.length >= 30 && Letras.WORLDS.every((w) => w.levels.length >= 4), `Letras Cadentes: ${Letras.LEVELS.length} fases, todas diferentes`);
  assert(new Set(Letras.LEVELS.map((l) => JSON.stringify(l.gen))).size === Letras.LEVELS.length, 'nenhuma fase repete o conteúdo de outra');
  assert(Letras.getWorld('l1').contents.every((c) => c.gen.t === 'chars'), 'letras e números num mundo só');
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
  const lv = Letras.getLevel('l4b');
  assert(JSON.stringify(LetrasItems.makeItems(lv, 9)) === JSON.stringify(LetrasItems.makeItems(lv, 9)), 'mesma semente = mesmas peças');
  assert(Letras.LEVELS.filter((l) => l.caseSensitive).every((l) => ['l2', 'l6'].includes(l.world)), 'maiúscula só conta nos mundos de maiúsculas e no grande final');
  const l1 = Letras.getLevel('l1a');
  const first = Letras.paceAt(l1, 0); const last = Letras.paceAt(l1, l1.count - 1);
  assert(first.fallMs > last.fallMs && first.intervalMs > last.intervalMs && first.maxOnScreen < last.maxOnScreen, 'a rodada acelera da primeira à última peça');
  assert(Letras.WORLDS.slice(0, -1).every((w) => w.levels[w.levels.length - 1].challenge), 'cada mundo termina com um desafio');
}

function checkNumeros() {
  const bad = [];
  assert(Numeros.LEVELS.length >= 40 && Numeros.WORLDS.every((w) => w.levels.length >= 4 && w.levels[w.levels.length - 1].challenge), `Números Cadentes: ${Numeros.LEVELS.length} fases, cada mundo com desafio`);
  assert(new Set(Numeros.LEVELS.map((l) => JSON.stringify(l.gen))).size === Numeros.LEVELS.length, 'nenhuma fase repete o conteúdo de outra');
  for (const level of Numeros.LEVELS) {
    const world = Numeros.getWorld(level.world);
    const distinct = new Set();
    for (let s = 1; s <= 40; s++) {
      const items = NumerosItems.makeItems(level, s * 2654435761 % 0xFFFFFFFF);
      if (items.length !== level.count) bad.push(`${level.id}: ${items.length} peças`);
      for (const it of items) {
        distinct.add(it.text);
        if (!Number.isInteger(it.answer)) bad.push(`${level.id}: resposta não é número inteiro (${it.text})`);
        if (it.answer < 0 && !world.minus) bad.push(`${level.id}: negativo fora do mundo dos negativos (${it.text})`);
        if (it.kind === 'calc') {
          const p = P.fromKey(it.key);
          if (!p || p.hide !== 'c' || p.fields !== 1) bad.push(`${level.id}: conta sem resposta única (${it.text})`);
          if (world.maxAbs && P.numbersOf(p).some((n) => Math.abs(n) > world.maxAbs)) bad.push(`${level.id}: número acima de ${world.maxAbs} (${it.text})`);
        } else if (it.faces.some((f) => f < 0 || f > 6) || it.answer !== it.faces.reduce((a, b) => a + b, 0)) {
          bad.push(`${level.id}: dado ou dominó errado (${it.text})`);
        }
      }
    }
    if (distinct.size < 6) bad.push(`${level.id}: só ${distinct.size} peças diferentes`);
  }
  assert(bad.length === 0, `contas certas em todas as fases${bad.length ? `: ${bad.slice(0, 5).join(' / ')}` : ''}`);
  const lv = Numeros.getLevel('n4f');
  assert(JSON.stringify(NumerosItems.makeItems(lv, 9)) === JSON.stringify(NumerosItems.makeItems(lv, 9)), 'mesma semente = mesmas contas');
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
    const level = Letras.getLevel('l4b');
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
    r = await send({ score: 999999999 });
    assert(r.code === 'RESULTADO_INVALIDO', 'pontos impossíveis são recusados');
    r = await send({ score: 1234, lost: [...Array(items.length).keys()], durationMs: 1000 });
    assert(r.ok && r.progress.levels.l4b.bestScore === 1234, 'o recorde de pontos da fase fica guardado');
    assert(r.progress.levels.l4b.stars === 3 && r.progress.trouble[items[0]] >= 1 && r.progress.trouble.q === 3,
      'progresso guarda as melhores estrelas e o que mais caiu');

    // Números Cadentes: contam os algarismos das respostas
    const nl = Numeros.getLevel('n4b');
    const nItems = NumerosItems.makeItems(nl, 777);
    const digits = nItems.reduce((n, it) => n + String(it.answer).length, 0);
    const nsend = (body) => api('POST', '/api/progress/numeros/results', { levelId: nl.id, seed: 777, lost: [], wrong: 0, durationMs: 60000, ...body }, kid);
    r = await nsend({ durationMs: digits * 20 });
    assert(r.code === 'RESULTADO_INVALIDO', 'Números Cadentes: rodada rápida demais é recusada');
    r = await nsend({ lost: [nItems.length + 3] });
    assert(r.code === 'RESULTADO_INVALIDO', 'Números Cadentes: conta que não existe é recusada');
    r = await nsend({});
    assert(r.ok && r.result.stars === 3, 'Números Cadentes: resolveu tudo sem errar = 3 estrelas');
    r = await nsend({ lost: [0, 1, 2, 3, 4] });
    assert(r.ok && r.result.stars === 1 && r.progress.trouble[nItems[0].text] === 1, 'Números Cadentes: deixou cair 1/3 = 1 estrela, e guarda as contas que caíram');

    r = await api('GET', '/api/progress', null, kid);
    assert(/Fase \d+ · ⭐ 3/.test(r.summaries.letras || ''), `cartão do painel ("${r.summaries.letras}")`);
    assert(/Fase \d+ · ⭐ 3/.test(r.summaries.numeros || ''), `cartão do Números Cadentes ("${r.summaries.numeros}")`);
    const t = (await api('POST', '/api/teacher/login', {})).token;
    r = await api('GET', '/api/teacher/students', null, { teacher: t });
    const row = r.students.find((s) => s.name === 'Nina Prado').games.letras;
    const nrow = r.students.find((x) => x.name === 'Nina Prado').games.numeros;
    assert(nrow && nrow.totalLevels === Numeros.LEVELS.length && nrow.toughest.length > 0, 'área do professor mostra o Números Cadentes');
    assert(row && row.levelsDone === 1 && row.totalLevels === Letras.LEVELS.length && row.toughest.length > 0 && typeof row.caughtPct === 'number',
      'área do professor mostra fases, quanto pega e o que mais cai');
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkLetras();
    checkNumeros();
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
