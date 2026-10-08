// test/click.test.js
// 🖱️ Click: o reconhecimento das ações com eventos de mentira (clique, duplo
// clique dentro e fora do tempo, segurar curto demais, sair do alvo, soltar
// fora), os alvos de cada fase (mesma semente = mesma rodada, todas as ações
// aparecem) e o servidor conferindo os resultados.

const Levels = require('../public/games/click/levels.js');
const Targets = require('../public/games/click/targets.js');
const Actions = require('../public/games/click/actions.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

function checkActions() {
  const { createGesture, dropResult } = Actions;
  assert(createGesture('click').down(0) === 'ok', 'clique: um clique basta');
  assert(createGesture('hover').over() === 'ok' && createGesture('click').over() === null, 'mover: só de passar por cima (o clique não estoura passando)');

  let g = createGesture('double', { dblMs: 500 });
  assert(g.down(0) === 'wait' && g.armed && g.down(300) === 'ok', 'duplo clique: dois cliques dentro do tempo');
  g = createGesture('double', { dblMs: 500 });
  g.down(0);
  assert(g.tick(400) === null && g.tick(501) === 'wrong:one' && !g.armed, 'duplo clique: o 2º clique não veio a tempo = erro');
  g = createGesture('double', { dblMs: 500 });
  g.down(0);
  assert(g.down(700) === 'wait', 'duplo clique: clique tardio vira o 1º de um novo duplo');

  g = createGesture('hold', { holdMs: 800 });
  g.down(0);
  const mid = g.tick(400);
  assert(mid && Math.abs(mid.progress - 0.5) < 1e-9, 'segurar: o anel enche aos poucos');
  assert(g.tick(800) === 'ok', 'segurar: encheu = acerto');
  g = createGesture('hold', { holdMs: 800 });
  g.down(0);
  assert(g.up(300) === 'wrong:early' && !g.holding, 'segurar: soltou cedo demais = erro');
  g = createGesture('hold', { holdMs: 800 });
  g.down(0);
  assert(g.leave() === 'wrong:left', 'segurar: saiu de cima do alvo = erro');
  g = createGesture('hold', { holdMs: 800 });
  g.down(0);
  g.reset();
  assert(g.tick(900) === null && g.up(900) === null, 'pausa: o que estava pela metade é esquecido');

  const dests = [{ id: 'red', left: 0, top: 0, right: 100, bottom: 100 }, { id: 'blue', left: 200, top: 0, right: 300, bottom: 100 }];
  assert(dropResult({ x: 50, y: 50 }, dests, 'red') === 'ok', 'arrastar: soltou no destino certo');
  assert(dropResult({ x: 250, y: 50 }, dests, 'red') === 'wrong:place', 'arrastar: soltou no destino errado');
  assert(dropResult({ x: 150, y: 50 }, dests, 'red') === 'wrong:outside', 'arrastar: soltou fora de tudo');
}

function checkLevels() {
  assert(Levels.LEVELS.length >= 28 && Levels.WORLDS.every((w) => w.levels.length >= 4 && w.levels[w.levels.length - 1].challenge),
    `Click: ${Levels.LEVELS.length} fases, cada mundo com desafio no fim`);
  assert(new Set(Levels.LEVELS.map((l) => l.id)).size === Levels.LEVELS.length, 'ids de fase sem repetir');
  const shape = (l) => JSON.stringify([l.kinds, l.size, l.life, l.motion, l.dblMs, l.holdMs, l.path, l.drag, l.screen]);
  assert(new Set(Levels.LEVELS.map(shape)).size === Levels.LEVELS.length, 'nenhuma fase é igual a outra');
  assert(Levels.WORLDS.map((w) => w.kinds.join('+')).join(' → ') === 'hover → click → double → hold → drag → click+double+hold+drag+hover',
    'mundos em ordem: mover → clique → duplo → segurar → arrastar → misturado');
  const c2 = Levels.getLevel('c2a');
  const a = Levels.paceAt(c2, 0); const b = Levels.paceAt(c2, c2.count - 1);
  assert(a.lifeMs > b.lifeMs && a.intervalMs > b.intervalMs && a.size >= b.size && a.maxOnScreen <= b.maxOnScreen, 'a rodada acelera do primeiro ao último alvo');

  const bad = [];
  for (const level of Levels.LEVELS) {
    for (let s = 1; s <= 30; s++) {
      const items = Targets.makeTargets(level, s * 2654435761 % 0xFFFFFFFF);
      if (items.length !== level.count) bad.push(`${level.id}: ${items.length} alvos`);
      for (const it of items) {
        if (!level.kinds.includes(it.kind)) bad.push(`${level.id}: ação ${it.kind}`);
        if (!(it.x >= 0 && it.x <= 1 && it.y >= 0 && it.y <= 1)) bad.push(`${level.id}: fora da área`);
        if (it.kind === 'drag' && level.drag.mode === 'shadow' && !it.shadows.includes(it.emoji)) bad.push(`${level.id}: sombra certa faltando`);
        if (it.kind === 'drag' && level.drag.mode === 'color' && !Targets.COLORS.slice(0, level.drag.colors).some((c) => c.id === it.color)) bad.push(`${level.id}: cor fora da fase`);
      }
      if (level.kinds.length > 1 && !level.kinds.every((k) => items.some((it) => it.kind === k))) bad.push(`${level.id}: falta alguma ação`);
    }
  }
  assert(bad.length === 0, `alvos certos em todas as fases${bad.length ? `: ${bad.slice(0, 5).join(' / ')}` : ''}`);
  const lv = Levels.getLevel('c6x');
  assert(JSON.stringify(Targets.makeTargets(lv, 9)) === JSON.stringify(Targets.makeTargets(lv, 9)), 'mesma semente = mesmos alvos');
}

async function checkServer() {
  const srv = await startTestServer(3109);
  const { api } = srv;
  try {
    const games = await api('GET', '/api/games');
    const click = (games.games || games).find((g) => g.id === 'click');
    assert(click && click.subject === 'mouse' && click.requiresKeyboard === false, 'Click na seção 🖱️ Mouse, sem precisar de teclado');

    const kid = await srv.student('Caio Mendes');
    const level = Levels.getLevel('c6c');
    const seed = 1234;
    const items = Targets.makeTargets(level, seed);
    const send = (body) => api('POST', '/api/progress/click/results', {
      levelId: level.id, seed, timer: true, lost: [], wrong: 0, durationMs: 90000, ...body,
    }, kid);

    let r = await send({ durationMs: 500 });
    assert(r.code === 'RESULTADO_INVALIDO', 'rodada rápida demais é recusada');
    r = await send({ lost: [1, 1] });
    assert(r.code === 'RESULTADO_INVALIDO', 'alvo repetido na lista dos que sumiram é recusado');
    r = await send({ lost: [items.length] });
    assert(r.code === 'RESULTADO_INVALIDO', 'alvo que não existe na rodada é recusado');
    r = await send({ score: 99999999 });
    assert(r.code === 'RESULTADO_INVALIDO', 'pontos impossíveis são recusados');

    r = await send({ score: 900, bestStreak: 18 });
    assert(r.ok && r.result.stars === 3 && r.progress.levels.c6c.bestScore === 900, 'acertou tudo sem errar = 3 estrelas, e o recorde fica guardado');
    r = await send({ wrong: items.length });
    assert(r.ok && r.result.stars === 2, 'acertou tudo mas fez muita ação errada = 2 estrelas');
    const doubles = items.map((it, i) => (it.kind === 'double' ? i : -1)).filter((i) => i >= 0);
    r = await send({ lost: doubles, wrongBy: { double: 4 } });
    const dk = r.progress.byKind.double;
    assert(r.ok && dk.total === doubles.length * 3 && dk.ok === doubles.length * 2 && dk.wrong === 4, 'guarda o acerto de cada ação');

    // sem cronômetro: nenhum alvo some, as estrelas vêm das ações certas
    r = await send({ timer: false, lost: [0] });
    assert(r.code === 'RESULTADO_INVALIDO', 'sem cronômetro, alvo perdido é recusado');
    r = await send({ timer: false, wrong: 1 });
    assert(r.ok && r.result.stars === 3, 'sem cronômetro: quase sem erro = 3 estrelas');
    r = await send({ timer: false, wrong: items.length });
    assert(r.ok && r.result.stars === 1, 'sem cronômetro: metade das ações erradas = 1 estrela');
    r = await send({ timer: undefined, lost: [0] });
    assert(r.code === 'RESULTADO_INVALIDO', 'o cronômetro vem desligado quando não é informado');

    const t = (await api('POST', '/api/teacher/login', {})).token;
    r = await api('GET', '/api/teacher/students', null, { teacher: t });
    const row = r.students.find((s) => s.name === 'Caio Mendes').games.click;
    assert(row && row.totalLevels === Levels.LEVELS.length && row.byKind.some((k) => k.kind === 'double' && k.pct < 100) && typeof row.hitPct === 'number',
      'área do professor mostra a % de acerto de cada ação');
    r = await api('GET', '/api/progress', null, kid);
    assert(/Fase \d+ · ⭐ 3/.test(r.summaries.click || ''), `cartão do painel ("${r.summaries.click}")`);
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkActions();
    checkLevels();
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
