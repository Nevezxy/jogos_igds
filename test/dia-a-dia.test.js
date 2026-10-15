// test/dia-a-dia.test.js
// Matemática do dia a dia: Dinheiro e Troco (todo valor dá para pagar com
// o dinheiro da fase, troco possível, alternativas certas, conferência das
// respostas) e Equilibre a Balança (sempre dá para equilibrar; nos dois
// pratos, só pondo peso do lado do objeto; "quanto pesa?"); e o servidor.

const DLevels = require('../public/games/dinheiro/levels.js');
const Money = require('../public/games/dinheiro/money.js');
const BLevels = require('../public/games/balanca/levels.js');
const S = require('../public/games/balanca/scale.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const want = (t) => (t.type === 'count' ? t.total : t.type === 'change' ? t.change : t.price);
const rightAnswer = (t, level) => (t.type === 'count' ? t.total : Money.fewest(want(t), level.money));

// uma solução da balança com o menor número de pesos
function solve(task, mode) {
  const n = task.pieces.length;
  const sides = mode === 'both' ? 3 : 2;
  let best = null;
  for (let code = 0; code < sides ** n; code++) {
    let c = code;
    const L = [];
    const R = [];
    for (let i = 0; i < n; i++) {
      const s = c % sides;
      c = Math.floor(c / sides);
      if (s === 1) R.push(i); else if (s === 2) L.push(i);
    }
    if (S.weigh(task, { L, R }).ok && (!best || L.length + R.length < best.L.length + best.R.length)) best = { L, R };
  }
  return best;
}

function checkMoney() {
  const bad = [];
  for (const level of DLevels.LEVELS) {
    for (let s = 1; s <= 40; s++) {
      const tasks = Money.makeRound(level, s * 2654435761 % 0xFFFFFFFF);
      if (tasks.length !== level.count) bad.push(`${level.id}: ${tasks.length} tarefas`);
      for (const t of tasks) {
        if (t.type === 'count') {
          if (t.options.length !== 4 || new Set(t.options).size !== 4 || !t.options.includes(t.total)) bad.push(`${level.id}: alternativas`);
          if (!t.pieces.every((c) => level.money.includes(c))) bad.push(`${level.id}: dinheiro fora da fase`);
        } else {
          if (!Money.fewest(want(t), level.money)) bad.push(`${level.id}: não dá para pagar ${want(t)}`);
          if (t.type === 'change' && !(t.paid > t.price && level.paidWith.includes(t.paid))) bad.push(`${level.id}: troco`);
          if ((level.step || 100) === 100 && t.price % 100) bad.push(`${level.id}: centavos onde não pode`);
        }
      }
    }
  }
  assert(bad.length === 0, `dinheiro: tarefas certas em todas as ${DLevels.LEVELS.length} fases${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  assert(Money.fmt(1350) === 'R$ 13,50' && Money.fmt(500, true) === 'R$ 5', 'dinheiro: R$ 13,50');
  assert(Money.fewest(1385, [5, 10, 25, 50, 100, 200, 500, 1000]).length === 6, 'dinheiro: menos notas e moedas para R$ 13,85 = 10 + 2 + 1 + 50¢ + 25¢ + 10¢');
  const pay = { type: 'pay', price: 700 };
  assert(Money.check(pay, [500, 200], [100, 200, 500]).ok && Money.check(pay, [500, 100, 100], [100, 200, 500]).ok, 'dinheiro: qualquer jeito certo de pagar vale');
  assert(Money.check(pay, [500, 500], [100, 200, 500]).why === 'more' && Money.check(pay, [500], [100, 200, 500]).why === 'less', 'dinheiro: avisa se passou ou faltou');
  assert(Money.check({ type: 'fewest', price: 700 }, [500, 100, 100], [100, 200, 500]).why === 'many', 'dinheiro: no "menos notas", 5 + 1 + 1 não vale (dá com 5 + 2)');
  assert(!Money.check(pay, [700], [100, 200, 500]).ok, 'dinheiro: nota que não existe na fase é recusada');
}

function checkScale() {
  const bad = [];
  for (const level of BLevels.LEVELS) {
    for (let s = 1; s <= 25; s++) {
      for (const t of S.makeRound(level, s * 7919)) {
        const sol = solve(t, level.mode === 'both' ? 'both' : 'right');
        if (!sol) { bad.push(`${level.id}: não equilibra`); continue; }
        if (sol.L.length + sol.R.length !== t.min) bad.push(`${level.id}: mínimo errado`);
        if (level.mode === 'both' && !sol.L.length) bad.push(`${level.id}: dava sem pôr peso do lado do objeto`);
        if (t.object.weight < level.range[0] || t.object.weight > level.range[1]) bad.push(`${level.id}: peso fora da faixa`);
        if ((level.mode === 'unknown' || level.ask) && !(t.options && t.options.includes(t.object.weight))) bad.push(`${level.id}: alternativas`);
      }
    }
  }
  assert(bad.length === 0, `balança: sempre dá para equilibrar, o mínimo está certo e nos dois pratos precisa tirar${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  assert(S.fmt(1500, 'g') === '1,5 kg' && S.fmt(500, 'g') === '500 g' && S.fmt(7) === '7', 'balança: 1,5 kg e 500 g');
  const t = { object: { weight: 7 }, pieces: [{ id: 0, w: 10 }, { id: 1, w: 3 }] };
  assert(S.weigh(t, { L: [1], R: [0] }).ok && !S.weigh(t, { L: [], R: [0] }).ok && !S.weigh(t, { L: [0], R: [0] }).valid,
    'balança: 7 + 3 = 10 equilibra; o mesmo peso nos dois pratos não vale');
}

async function checkServer() {
  const srv = await startTestServer(3113);
  const { api } = srv;
  try {
    const kid = await srv.student('Rita Alves');
    const dl = DLevels.getLevel('dm4b');
    const tasks = Money.makeRound(dl, 321);
    const right = tasks.map((t) => [rightAnswer(t, dl)]);
    let r = await api('POST', '/api/progress/dinheiro/results', { levelId: dl.id, seed: 321, answers: right, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 3 && r.progress.levels.dm4b.bestScore === 6, 'dinheiro: tudo certo de primeira = 3 estrelas');
    const half = right.map((a, i) => (i < 3 ? [[5], a[0]] : a));
    r = await api('POST', '/api/progress/dinheiro/results', { levelId: dl.id, seed: 321, answers: half, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 2, 'dinheiro: metade na segunda tentativa = 2 estrelas');
    r = await api('POST', '/api/progress/dinheiro/results', { levelId: dl.id, seed: 321, answers: right.map((a) => [a[0], a[0]]), durationMs: 60000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'dinheiro: 2ª tentativa depois de acertar é recusada');
    r = await api('POST', '/api/progress/dinheiro/results', { levelId: dl.id, seed: 321, answers: right, durationMs: 500 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'dinheiro: rápido demais é recusado');

    const bl = BLevels.getLevel('bl4c');
    const bt = S.makeRound(bl, 99);
    const sols = bt.map((t) => ({ ...solve(t, 'both'), moves: t.min, wrong: 0, answer: t.object.weight }));
    r = await api('POST', '/api/progress/balanca/results', { levelId: bl.id, seed: 99, tasks: sols, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 3, 'balança: equilibrou com o mínimo e acertou o peso = 3 estrelas');
    r = await api('POST', '/api/progress/balanca/results', { levelId: bl.id, seed: 99, tasks: sols.map((x) => ({ ...x, answer: x.answer + 1 })), durationMs: 60000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'balança: peso errado do objeto é recusado');
    r = await api('POST', '/api/progress/balanca/results', { levelId: bl.id, seed: 99, tasks: sols.map((x) => ({ ...x, R: [] })), durationMs: 60000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'balança: balança torta é recusada');
    r = await api('POST', '/api/progress/balanca/results', { levelId: bl.id, seed: 99, tasks: sols.map((x) => ({ ...x, moves: x.moves + 2 })), durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 2, 'balança: muitas trocas de peso = menos estrelas');

    const games = (await api('GET', '/api/games')).games;
    const math = games.filter((g) => g.subject === 'matematica').map((g) => g.id);
    assert(math.includes('dinheiro') && math.includes('balanca'), 'Dinheiro e Balança na seção 🔢 Matemática');
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkMoney();
    checkScale();
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
})();
