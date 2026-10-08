// test/matematica.test.js
// 🔢 Conta Comigo: regras do gerador em todas as fases (sem negativos onde
// não pode, divisão exata, vai-um só onde deve...), mesma semente = mesmas
// contas, e o servidor conferindo as respostas, as estrelas e a revisão.

const Levels = require('../public/games/matematica/levels.js');
const P = require('../public/games/matematica/problems.js');
const Emoji = require('../public/games/matematica/emoji.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

function checkGenerator() {
  const NEG_WORLDS = new Set(['ng', 'pw', 'ex']);
  let problems = 0;
  const bad = [];
  for (const level of Levels.LEVELS) {
    const world = Levels.getWorld(level.world);
    const distinct = new Set();
    for (let s = 1; s <= 120; s++) {
      const round = P.makeRound(level, s * 2654435761 % 0xFFFFFFFF);
      if (round.length !== 10) bad.push(`${level.id}: rodada com ${round.length} contas`);
      for (const p of round) {
        problems++;
        distinct.add(p.key);
        const again = P.fromKey(p.key);
        if (!again || !P.isCorrect(again, again.answer)) bad.push(`${level.id}: chave não refaz a conta ${p.key}`);
        const txt = `${P.text(p)} ${P.solution(p)} ${P.hint(p)} ${P.speech(p)}`;
        if (/undefined|NaN|null/.test(txt)) bad.push(`${level.id}: texto quebrado "${txt}"`);
        if (!NEG_WORLDS.has(world.id) && [p.a, p.b, p.c].some((n) => typeof n === 'number' && n < 0)) bad.push(`${level.id}: negativo fora do mundo dos negativos ${p.key}`);
        if (p.type === 'bin' && p.op === '/' && p.a % p.b !== 0) bad.push(`${level.id}: divisão não exata ${p.key}`);
        if (p.type === 'rem' && !(p.rest > 0 && p.rest < p.b)) bad.push(`${level.id}: resto inválido ${p.key}`);
        const g = level.gen;
        if (g.t === 'add' && g.carry === 'yes' && !P.hasCarry(p.a, p.b)) bad.push(`${level.id}: devia ter vai-um ${p.key}`);
        if (g.t === 'add' && g.carry === 'no' && P.hasCarry(p.a, p.b)) bad.push(`${level.id}: não devia ter vai-um ${p.key}`);
        if (g.t === 'sub' && g.borrow === 'yes' && !P.hasBorrow(p.a, p.b)) bad.push(`${level.id}: devia ter empréstimo ${p.key}`);
        if (g.t === 'sub' && g.borrow === 'no' && P.hasBorrow(p.a, p.b)) bad.push(`${level.id}: não devia ter empréstimo ${p.key}`);
        if (g.t === 'add' && g.max != null && p.c > g.max) bad.push(`${level.id}: soma passou do máximo ${p.key}`);
        if (g.t === 'mul' && typeof g.a === 'number' && p.a !== g.a && p.b !== g.a) bad.push(`${level.id}: fora da tabuada do ${g.a} ${p.key}`);
        if (world.id === 'ng' && ![p.a, p.b, p.c].some((n) => n < 0)) bad.push(`${level.id}: sem nenhum negativo ${p.key}`);
        // mundo das figurinhas: toda conta tem desenho
        if (world.emoji && !Emoji.plan(p)) bad.push(`${level.id}: conta sem figurinha ${p.key}`);
        // multiplicação e divisão só até a dezena
        if (world.id === 'mu' && Math.max(p.a, p.b) > 99) bad.push(`${level.id}: fator acima de 99 ${p.key}`);
        if (world.id === 'dv' && p.a > 99) bad.push(`${level.id}: dividendo acima de 99 ${p.key}`);
        // centena e milhar só na adição e subtração
        if (world.id !== 'as' && P.numbersOf(p).some((n) => Math.abs(n) > 100)) bad.push(`${level.id}: número acima de 100 ${p.key}`);
      }
    }
    // fase pequena demais repete conta na rodada de 10
    if (distinct.size < 10) bad.push(`${level.id}: só ${distinct.size} contas diferentes`);
  }
  assert(Levels.LEVELS.length >= 140, `${Levels.LEVELS.length} fases`);
  assert(Levels.WORLDS.every((w) => w.levels.length >= 12), 'todo mundo tem pelo menos 12 fases');
  assert(Levels.WORLDS.filter((w) => w.emoji).map((w) => w.id).join() === 'fg', 'figurinhas só no mundo das figurinhas');
  assert(Levels.LEVELS.every((l) => !l.choice || Levels.getWorld(l.world).emoji), '3 opções só no mundo das figurinhas');
  const as = Levels.getWorld('as');
  assert(as && as.levels.some((l) => l.id.startsWith('ad')) && as.levels.some((l) => l.id.startsWith('sb'))
    && as.levels.filter((l) => l.section).map((l) => l.section.split(':')[0]).join() === 'Unidade,Unidade,Dezena,Centena,Milhar,Número que falta e revisão',
  'adição e subtração juntas, por unidade, dezena, centena e milhar');
  assert(new Set(Levels.LEVELS.map((l) => l.id)).size === Levels.LEVELS.length, 'ids de fase sem repetir');
  assert(bad.length === 0, `regras do gerador valem em ${problems} contas${bad.length ? `: ${bad.slice(0, 5).join(' / ')}` : ''}`);

  const lvl = Levels.getLevel('mu14');
  assert(JSON.stringify(P.makeRound(lvl, 42)) === JSON.stringify(P.makeRound(lvl, 42)), 'mesma semente gera as mesmas contas');
  assert(P.makeRound(lvl, 42).map((p) => p.key).join() !== P.makeRound(lvl, 43).map((p) => p.key).join(), 'semente diferente gera contas diferentes');
  const review = ['["bin","*",7,8,"c"]'];
  assert(P.makeRound(lvl, 42, review).some((p) => p.key === review[0]), 'conta de revisão entra na rodada');

  // respostas
  assert(P.parseAnswer('1.450') === 1450 && P.parseAnswer('−3') === -3 && P.parseAnswer('x') === '*' && P.parseAnswer('abc') === null, 'entende "1.450", "−3" e o sinal "x"');
  const sq = P.build(['bin', '^', 7, 2, 'a']);
  assert(P.isCorrect(sq, 7) && P.isCorrect(sq, -7) && !P.isCorrect(sq, 49), '?² = 49 aceita 7 e −7');
  const rem = P.build(['rem', 17, 5]);
  assert(P.isCorrect(rem, [3, 2]) && !P.isCorrect(rem, [3, 1]) && P.solution(rem) === '17 ÷ 5 = 3, resto 2', 'divisão com resto: quociente e resto');
  assert(P.text(P.build(['bin', '-', 5, -3, 'c'])) === '5 − (−3) = ?', 'negativo depois do sinal vai entre parênteses');
  assert(P.text(P.build(['expr', '-a^2', 3])) === '−3² = ?' && P.build(['expr', '-a^2', 3]).answer === -9, '−3² = −9 (o expoente vale só para o 3)');
  assert(P.build(['expr', '(-a)^2', 3]).answer === 9, '(−3)² = 9');
  assert(P.describe('["bin","*",7,8,"c"]') === '7 × 8', 'descrição da conta para o professor');
  const sign = P.makeRound(Levels.getLevel('mx5'), 7);
  assert(sign.every((p) => ['+', '-', '*', '/'].filter((o) => P.compute(o, p.a, p.b) === p.c).length === 1), '"qual é o sinal?" sempre tem um sinal só');
}

async function checkServer() {
  const srv = await startTestServer(3107);
  const { api } = srv;
  try {
    const kid = await srv.student('Nina Prado');
    let r = await api('GET', '/api/progress/matematica', null, kid);
    assert(r.ok && r.progress === null, 'começa sem progresso');

    const level = Levels.getLevel('ad7');
    const seed = 123456;
    const round = P.makeRound(level, seed);
    const right = round.map((p) => ({ tries: [p.answer] }));
    const send = (body) => api('POST', '/api/progress/matematica/results', { levelId: level.id, seed, review: [], answers: right, durationMs: 30000, ...body }, kid);

    r = await send({ durationMs: 2000 });
    assert(r.code === 'RESULTADO_INVALIDO', 'rodada rápida demais é recusada');
    r = await send({ answers: right.slice(1) });
    assert(r.code === 'RESULTADO_INVALIDO', 'número de respostas errado é recusado');
    r = await send({ levelId: 'nada' });
    assert(r.code === 'FASE_INVALIDA', 'fase inexistente é recusada');
    r = await send({ answers: right.map(() => ({ tries: ['banana'] })) });
    assert(r.code === 'RESULTADO_INVALIDO', 'resposta que não é número é recusada');

    r = await send({});
    assert(r.ok && r.result.stars === 3, '10 de primeira e rápido = 3 estrelas (o servidor refaz as contas)');
    r = await send({ durationMs: 200000 });
    assert(r.ok && r.result.stars === 2, '10 de primeira, mas devagar = 2 estrelas');
    const fg = Levels.getLevel('fg9');
    const fgRound = P.makeRound(fg, 5);
    r = await api('POST', '/api/progress/matematica/results', {
      levelId: fg.id, seed: 5, review: [], answers: fgRound.map((p) => ({ tries: [p.answer] })), durationMs: 200000, emoji: false,
    }, kid);
    assert(r.ok && r.result.stars === 3, 'no mundo das figurinhas o tempo não conta');
    r = await send({ durationMs: 200000, emoji: true });
    assert(r.ok && r.result.stars === 2, 'fora do mundo das figurinhas, mandar "emoji" não muda nada');

    // 4 erradas de primeira, certas na 2ª: 6 + 4 × ½ = 8 → 2 estrelas
    const mixed = round.map((p, i) => ({ tries: i < 4 ? [p.answer + 1, p.answer] : [p.answer] }));
    r = await send({ answers: mixed });
    assert(r.ok && r.result.stars === 2, 'acerto na 2ª tentativa vale meio ponto');
    // resposta "certa" que está errada não engana
    const lies = round.map((p) => ({ tries: [p.answer + 1] }));
    r = await send({ answers: lies });
    assert(r.ok && r.result.stars === 0, 'respostas erradas não ganham estrela');

    const prog = r.progress;
    const missedKeys = Object.keys(prog.levels.ad7.review);
    assert(missedKeys.length > 0 && prog.levels.ad7.stars === 3, 'o progresso guarda as melhores estrelas e as contas para revisar');
    const review = missedKeys.slice(0, 3);
    const round2 = P.makeRound(level, 999, review);
    r = await api('POST', '/api/progress/matematica/results', {
      levelId: level.id, seed: 999, review, answers: round2.map((p) => ({ tries: [p.answer] })), durationMs: 30000,
    }, kid);
    assert(r.ok && r.result.stars === 3, 'rodada com contas de revisão é aceita');
    r = await api('POST', '/api/progress/matematica/results', {
      levelId: level.id, seed: 999, review: ['["bin","+",1,1,"c"]'], answers: round2.map((p) => ({ tries: [p.answer] })), durationMs: 30000,
    }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'conta de revisão inventada é recusada');

    // negativos (texto com "−"), resto e sinal
    const answerAs = (p) => (p.fields === 2 ? p.answer : p.hide === 'op' ? p.op : String(p.answer).replace('-', '−'));
    for (const id of ['ng3', 'dv17', 'mx5', 'pw9', 'pw11', 'rz8', 'ex12']) {
      const lv = Levels.getLevel(id);
      const rd = P.makeRound(lv, 77);
      r = await api('POST', '/api/progress/matematica/results', {
        levelId: id, seed: 77, review: [], answers: rd.map((p) => ({ tries: [answerAs(p)] })), durationMs: 25000,
      }, kid);
      assert(r.ok && r.result.stars >= 2, `fase ${id} (${lv.title}) confere as respostas`);
    }

    r = await api('GET', '/api/progress', null, kid);
    assert(/Fase \d+ · ⭐ \d+/.test(r.summaries.matematica || ''), `cartão do painel ("${r.summaries.matematica}")`);
    const t = (await api('POST', '/api/teacher/login', {})).token;
    r = await api('GET', '/api/teacher/students', null, { teacher: t });
    const row = r.students.find((s) => s.name === 'Nina Prado').games.matematica;
    assert(row && row.levelsDone >= 6 && row.totalLevels === Levels.LEVELS.length && row.toughest.length > 0 && typeof row.accuracy === 'number',
      'área do professor mostra fases, acertos e as contas que mais erra');
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkGenerator();
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
