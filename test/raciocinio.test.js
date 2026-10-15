// test/raciocinio.test.js
// Jogos de raciocínio: Memória (cartas de cada fase, refazer a partida,
// contra o robô), Torre de Hanói (regras, mínimo de movimentos, dica,
// fases bagunçadas não triviais) e Labirinto (sempre tem saída, chaves antes
// das portas, refazer o caminho absoluto e relativo); e o servidor
// conferindo e dando as estrelas.

const MemLevels = require('../public/games/memoria/levels.js');
const Cards = require('../public/games/memoria/cards.js');
const HanLevels = require('../public/games/hanoi/levels.js');
const H = require('../public/games/hanoi/hanoi.js');
const LabLevels = require('../public/games/labirinto/levels.js');
const M = require('../public/games/labirinto/maze.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

// partida "perfeita" da memória: vira cada par direto (quem joga sabe tudo)
function perfectFlips(deck) {
  const flips = [];
  const byPair = new Map();
  deck.forEach((c, i) => { if (!byPair.has(c.pair)) byPair.set(c.pair, []); byPair.get(c.pair).push(i); });
  for (const [a, b] of byPair.values()) flips.push(a, b);
  return flips;
}
// caminho mais curto do labirinto, como comandos absolutos (BFS com chaves)
function solveMaze(m) {
  const keyAt = new Map(m.keys.map((k) => [k.cell, k.color]));
  const start = { cell: m.start, keys: '', path: '' };
  const seen = new Set([`${m.start}|`]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      if (s.cell === m.exit) return s.path;
      ['U', 'R', 'D', 'L'].forEach((cmd, d) => {
        const n = M.neighbor(m, s.cell, d);
        if (n < 0) return;
        const door = m.doors.find((x) => M.doorKey(x.a, x.b) === M.doorKey(s.cell, n));
        if (door && !s.keys.includes(door.color)) return;
        const k = keyAt.get(n);
        const keys = k && !s.keys.includes(k) ? [...s.keys.split(',').filter(Boolean), k].sort().join(',') : s.keys;
        const id = `${n}|${keys}`;
        if (!seen.has(id)) { seen.add(id); next.push({ cell: n, keys, path: s.path + cmd }); }
      });
    }
    frontier = next;
  }
  return null;
}

function checkMemoria() {
  const bad = [];
  for (const level of MemLevels.LEVELS) {
    for (let s = 1; s <= 20; s++) {
      const deck = Cards.makeDeck(level, s * 2654435761 % 0xFFFFFFFF);
      if (deck.length !== level.pairs * 2) bad.push(`${level.id}: ${deck.length} cartas`);
      const pairs = new Map();
      deck.forEach((c) => pairs.set(c.pair, (pairs.get(c.pair) || 0) + 1));
      if ([...pairs.values()].some((n) => n !== 2)) bad.push(`${level.id}: par sem as duas cartas`);
      // dois pares não podem ter a mesma face (senão daria par "errado" que parece certo)
      const faces = deck.map((c) => JSON.stringify(c.face));
      if (level.kind !== 'same' && new Set(faces).size !== faces.length) bad.push(`${level.id}: faces repetidas`);
    }
  }
  assert(bad.length === 0, `memória: cartas certas em todas as ${MemLevels.LEVELS.length} fases${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  const deck = Cards.makeDeck(MemLevels.getLevel('mm1b'), 42);
  assert(JSON.stringify(deck) === JSON.stringify(Cards.makeDeck(MemLevels.getLevel('mm1b'), 42)), 'memória: mesma semente = mesma mesa');
  const flips = perfectFlips(deck);
  let r = Cards.replay(deck, flips);
  assert(r.ok && r.done && r.tries === 6, 'memória: refaz a partida e conta as tentativas');
  assert(!Cards.replay(deck, [flips[0], flips[0]]).ok, 'memória: virar a mesma carta duas vezes não vale');
  assert(!Cards.replay(deck, [...flips, flips[0], flips[1]]).ok, 'memória: virar carta já achada não vale');
  const lv = MemLevels.getLevel('mm1b');
  assert(MemLevels.starsFor(lv, { tries: 6, pairs: 6 }) === 3 && MemLevels.starsFor(lv, { tries: 20, pairs: 6 }) === 1, 'memória: estrelas pelas tentativas');
  // contra o robô: quem erra passa a vez
  const vdeck = Cards.makeDeck(MemLevels.getLevel('mm6a'), 7);
  const vf = perfectFlips(vdeck);
  const wrong = vdeck.findIndex((c) => c.pair !== vdeck[vf[0]].pair);
  r = Cards.replay(vdeck, [vf[0], wrong, ...vf], { versus: true });
  assert(r.ok && r.done && r.pairsBy[0] === 0 && r.pairsBy[1] === 8, 'memória contra o robô: errou, passa a vez; o outro faz os pares');
}

function checkHanoi() {
  const bad = [];
  for (const level of HanLevels.LEVELS) {
    for (let s = 1; s <= 10; s++) {
      const g = H.setup(level, s * 7919);
      if (level.mode === 'classic' && level.pegs === 3 && g.min !== 2 ** level.n - 1) bad.push(`${level.id}: mínimo ${g.min}`);
      if (level.atLeast && g.min < level.atLeast) bad.push(`${level.id}: fácil demais (${g.min})`);
      // seguindo as dicas chega no objetivo com o mínimo de movimentos
      let pos = g.start;
      const moves = [];
      while (!H.same(pos, g.goal) && moves.length < 500) { const m = H.hint(pos, g.goal, g.pegs); moves.push(m); pos = H.apply(pos, m); }
      const r = H.replay(g, moves);
      if (!r.done || r.moves !== g.min) bad.push(`${level.id}: dica não leva ao objetivo`);
    }
  }
  assert(bad.length === 0, `hanói: mínimos certos, fases não triviais e a dica sempre leva ao objetivo${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  assert(H.setup(HanLevels.getLevel('hn4c'), 1).min === 25, 'hanói com 4 pinos e 7 discos: 25 movimentos');
  const g = H.setup(HanLevels.getLevel('hn1a'), 1);
  assert(!H.isLegal([0, 0, 0], 3, [1, 2]) && !H.isLegal([1, 0, 0], 3, [0, 1]) && H.isLegal([1, 0, 0], 3, [1, 2]), 'hanói: só o disco de cima e nunca grande sobre pequeno');
  assert(!H.replay(g, [[0, 1], [0, 1]]).ok, 'hanói: movimento inválido no meio = recusado');
}

function checkMaze() {
  const bad = [];
  for (const level of LabLevels.LEVELS) {
    for (let s = 1; s <= 15; s++) {
      const m = M.makeMaze(level, s * 104729);
      const path = solveMaze(m);
      if (!path) { bad.push(`${level.id}: sem saída`); continue; }
      if (path.length !== m.shortest) bad.push(`${level.id}: caminho mais curto errado`);
      const r = M.replay(m, path, false);
      if (!r.ok || !r.done || r.steps !== m.shortest || r.bumps) bad.push(`${level.id}: refazer o caminho falhou`);
      if (m.keys.length !== (level.keys || 0)) bad.push(`${level.id}: chaves`);
    }
  }
  assert(bad.length === 0, `labirinto: todo labirinto tem saída, as chaves dão para pegar e o caminho é refeito${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  const m = M.makeMaze(LabLevels.getLevel('lb2a'), 5);
  const firstDoor = m.doors[0];
  // ir direto pela porta sem chave: bate
  let st = M.initial(m);
  const path = solveMaze({ ...m, doors: [], keys: [] });
  for (const c of path) st = M.command(m, st, c, false);
  assert(!st.done && st.bumps > 0 && firstDoor, 'labirinto: porta trancada sem a chave não passa');
  // relativo: virar não anda; andar contra a parede bate
  const lm = M.makeMaze(LabLevels.getLevel('lb5a'), 3);
  let rs = M.command(lm, M.initial(lm), 'E', true);
  assert(rs.heading === 0 && rs.cell === lm.start && rs.steps === 0, 'labirinto relativo: virar à esquerda muda a direção sem andar');
  rs = M.command(lm, rs, 'F', true);
  assert(rs.cell === lm.start && rs.bumps === 1, 'labirinto relativo: andar contra a parede (a borda de cima) é uma batida');
  assert(!M.replay(lm, 'X', true).ok && !M.replay(lm, 'F', false).ok, 'labirinto: comando desconhecido é recusado');
}

async function checkServer() {
  const srv = await startTestServer(3112);
  const { api } = srv;
  try {
    const kid = await srv.student('Lara Souza');
    // memória
    const ml = MemLevels.getLevel('mm1b');
    const deck = Cards.makeDeck(ml, 777);
    let r = await api('POST', '/api/progress/memoria/results', { levelId: ml.id, seed: 777, flips: perfectFlips(deck), durationMs: 30000 }, kid);
    assert(r.ok && r.result.stars === 3 && r.progress.levels.mm1b.best === 6, 'memória: partida perfeita = 3 estrelas e recorde de 6 tentativas');
    r = await api('POST', '/api/progress/memoria/results', { levelId: ml.id, seed: 777, flips: perfectFlips(deck).slice(0, 4), durationMs: 30000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'memória: partida que não achou todos os pares é recusada');
    r = await api('POST', '/api/progress/memoria/results', { levelId: ml.id, seed: 777, flips: perfectFlips(deck), durationMs: 100 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'memória: rápido demais é recusado');
    // hanói
    const hl = HanLevels.getLevel('hn1a');
    const g = H.setup(hl, 5);
    let pos = g.start;
    const moves = [];
    while (!H.same(pos, g.goal)) { const m = H.hint(pos, g.goal, g.pegs); moves.push(m); pos = H.apply(pos, m); }
    r = await api('POST', '/api/progress/hanoi/results', { levelId: hl.id, seed: 5, moves, durationMs: 20000 }, kid);
    assert(r.ok && r.result.stars === 3 && r.progress.levels.hn1a.best === 7, 'hanói: no mínimo = 3 estrelas');
    r = await api('POST', '/api/progress/hanoi/results', { levelId: hl.id, seed: 5, moves, hints: 2, durationMs: 20000 }, kid);
    assert(r.ok && r.result.stars === 2, 'hanói: usou dica = no máximo 2 estrelas');
    r = await api('POST', '/api/progress/hanoi/results', { levelId: hl.id, seed: 5, moves, hints: 5, durationMs: 200000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'hanói: 5 dicas em 3 min e 20 s é recusado (cabem 3 + 1)');
    r = await api('POST', '/api/progress/hanoi/results', { levelId: hl.id, seed: 5, moves: moves.slice(0, 6), durationMs: 20000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'hanói: torre incompleta é recusada');
    // labirinto
    const ll = LabLevels.getLevel('lb2b');
    const mz = M.makeMaze(ll, 9);
    const cmds = solveMaze(mz);
    r = await api('POST', '/api/progress/labirinto/results', { levelId: ll.id, seed: 9, cmds, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 3 && r.progress.levels.lb2b.best === mz.shortest, 'labirinto: caminho mais curto (pegando as chaves) = 3 estrelas');
    r = await api('POST', '/api/progress/labirinto/results', { levelId: ll.id, seed: 9, cmds: cmds.slice(0, -1), durationMs: 60000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'labirinto: não chegou na saída = recusado');

    const games = (await api('GET', '/api/games')).games;
    assert(games.filter((x) => x.subject === 'raciocinio').map((x) => x.id).join() === 'memoria,hanoi,carrinhos,labirinto,pixel,diferencas,quebracabeca', 'os 7 jogos na seção 🧩 Raciocínio, na ordem do plano');
    r = await api('GET', '/api/progress', null, kid);
    assert(/⭐ 3/.test(r.summaries.labirinto || ''), `cartão do painel ("${r.summaries.labirinto}")`);
    const t = (await api('POST', '/api/teacher/login', {})).token;
    r = await api('GET', '/api/teacher/students', null, { teacher: t });
    const row = r.students.find((s) => s.name === 'Lara Souza').games.hanoi;
    assert(row && row.levelsDone === 1 && row.totalLevels === HanLevels.LEVELS.length, 'área do professor mostra os jogos de raciocínio');
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkMemoria();
    checkHanoi();
    checkMaze();
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
