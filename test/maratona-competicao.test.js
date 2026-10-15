// test/maratona-competicao.test.js
// 🏃 Modo Maratona, fase 3: o modo competitivo dos jogos.
//   • corrida: para cada um dos 15 jogos de corrida, uma fase jogada com a
//     semente S que o servidor sorteou é aceita pela mesma validação do
//     modo livre (com a fase e a semente impostas pelo servidor) e vira uma
//     nota; o que foi jogado com outra semente não serve
//   • o texto do Teclado Mágico sai igual para a mesma semente
//   • duelo: o servidor cria a partida entre dois educandos escolhidos, eles
//     entram com bg:rejoin, o fim é avisado (onEnd) e grava com a origem
//     "maratona"; no prazo, Velha empata e Dama/Xadrez vão pelo material

const os = require('os');
const path = require('path');
const fs = require('fs');

const DB = path.join(os.tmpdir(), `igds-competicao-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILE = DB;

const registry = require('../src/games/registry');
const competitive = require('../src/marathon/competitive');
const accounts = require('../src/platform/accounts');
const { db } = require('../src/platform/db');
const { createMatchManager } = require('../src/platform/match');
const L = (id) => require(`../public/games/${id}/levels.js`);
const Cards = require('../public/games/memoria/cards.js');
const H = require('../public/games/hanoi/hanoi.js');
const T = require('../public/games/carrinhos/traffic.js');
const M = require('../public/games/labirinto/maze.js');
const PX = require('../public/games/pixel/pixel.js');
const SC = require('../public/games/diferencas/scene.js');
const Money = require('../public/games/dinheiro/money.js');
const BS = require('../public/games/balanca/scale.js');
const Problems = require('../public/games/matematica/problems.js');
const NItems = require('../public/games/numeros/items.js');
const LItems = require('../public/games/letras/items.js');
const Targets = require('../public/games/click/targets.js');
const Content = require('../public/games/digitacao/content.js');
const Xadrez = require('../public/games/xadrez/rules.js');
const Dama = require('../public/games/dama/rules.js');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const game = (id) => registry.games.find((g) => g.id === id);
const S1 = 123456789;
const S2 = 987654321;

// ---------------- jogadas perfeitas de cada jogo, para a semente dada ----------------
function perfectFlips(deck) {
  const byPair = new Map();
  deck.forEach((c, i) => { if (!byPair.has(c.pair)) byPair.set(c.pair, []); byPair.get(c.pair).push(i); });
  return [...byPair.values()].flat();
}
function hanoiMoves(level, seed) {
  const g = H.setup(level, seed);
  let pos = g.start.slice();
  const moves = [];
  while (!H.same(pos, g.goal)) { const m = H.hint(pos, g.goal, g.pegs); moves.push(m); pos = H.apply(pos, m); }
  return moves;
}
function mazeCmds(m) {
  const seen = new Set([m.start]);
  let frontier = [{ cell: m.start, path: '' }];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      if (s.cell === m.exit) return s.path;
      ['U', 'R', 'D', 'L'].forEach((cmd, d) => {
        const n = M.neighbor(m, s.cell, d);
        if (n >= 0 && !seen.has(n)) { seen.add(n); next.push({ cell: n, path: s.path + cmd }); }
      });
    }
    frontier = next;
  }
  return null;
}
function paintAll(pic) {
  const painted = new Array(pic.target.length).fill(0);
  const actions = [];
  pic.target.forEach((t, i) => {
    if (!t || painted[i] === t) return;
    PX.paint(pic, painted, [i, t, 1]);
    actions.push([i, t, 1]);
  });
  return actions;
}
const want = (t) => (t.type === 'count' ? t.total : t.type === 'change' ? t.change : t.price);
const moneyAnswer = (t, level) => (t.type === 'count' ? t.total : Money.fewest(want(t), level.money));
function balance(task, mode) {
  const n = task.pieces.length;
  const sides = mode === 'both' ? 3 : 2;
  let best = null;
  for (let code = 0; code < sides ** n; code++) {
    let c = code;
    const Ls = [];
    const R = [];
    for (let i = 0; i < n; i++) {
      const s = c % sides;
      c = Math.floor(c / sides);
      if (s === 1) R.push(i); else if (s === 2) Ls.push(i);
    }
    if (BS.weigh(task, { L: Ls, R }).ok && (!best || Ls.length + R.length < best.L.length + best.R.length)) best = { L: Ls, R };
  }
  return best;
}

// corpo do resultado que o navegador mandaria, jogando bem a fase com a semente
const PLAYS = {
  memoria: (lv, seed) => ({ flips: perfectFlips(Cards.makeDeck(lv, seed)), durationMs: 60000 }),
  hanoi: (lv, seed) => ({ moves: hanoiMoves(lv, seed), hints: 0, durationMs: 90000 }),
  carrinhos: (lv) => ({ moves: T.solve(T.parse(lv.board)), hints: 0, durationMs: 90000 }),
  labirinto: (lv, seed) => ({ cmds: mazeCmds(M.makeMaze(lv, seed)), durationMs: 60000 }),
  pixel: (lv) => ({ actions: paintAll(PX.parse(L('pixel').designOf(lv))), durationMs: 60000 }),
  diferencas: (lv, seed) => ({ clicks: SC.makeScene(lv, seed).diffs.map((d) => [d.circles[0][0], d.circles[0][1]]), hints: 0, durationMs: 60000 }),
  quebracabeca: (lv) => ({ placed: Array.from({ length: lv.pieces }, (_, i) => i), turns: 0, durationMs: Math.max(60000, lv.pieces * 900) }),
  dinheiro: (lv, seed) => ({ answers: Money.makeRound(lv, seed).map((t) => [moneyAnswer(t, lv)]), durationMs: 90000 }),
  balanca: (lv, seed) => ({ tasks: BS.makeRound(lv, seed).map((t) => ({ ...balance(t, lv.mode === 'both' ? 'both' : 'right'), moves: t.min, wrong: 0, answer: t.object.weight })), durationMs: 90000 }),
  matematica: (lv, seed) => ({ answers: Problems.makeRound(lv, seed).map((p) => ({ tries: [p.answer] })), durationMs: 40000 }),
  numeros: (lv, seed) => ({ lost: [], wrong: 0, durationMs: NItems.makeItems(lv, seed).length * 3000, score: 0 }),
  letras: (lv, seed) => ({ lost: [], wrong: 0, durationMs: LItems.makeItems(lv, seed).length * 3000, score: 0 }),
  click: (lv) => ({ timer: true, lost: [], wrong: 0, durationMs: 120000, score: 0, bestStreak: 0 }),
  digitacao: (lv, seed) => {
    const text = Content.generate(lv, seed);
    const chars = [...text].length;
    const durationMs = 60000;
    return { chars, durationMs, accuracy: 100, wpm: chars / 5 / (durationMs / 60000), wrongPresses: 0 };
  },
  xadrez: (lv) => {
    const s = Xadrez.initial(lv.variant);
    return { moves: [Xadrez.moves(s).find((m) => Xadrez.play(s, m).result)], durationMs: 8000 };
  },
};
const LEVEL = {
  memoria: 'mm1c', hanoi: 'hn2a', carrinhos: 'cr1d', labirinto: 'lb1b', pixel: 'px1b', diferencas: 'df2a', quebracabeca: 'qc1a',
  dinheiro: 'dm2c', balanca: 'bl2a', matematica: 'mu8', numeros: 'n4a', letras: 'l1a', click: 'c1b', digitacao: 'm2f1', xadrez: 'xf2',
};

function checkRaces() {
  for (const [id, levelId] of Object.entries(LEVEL)) {
    const g = game(id);
    const lv = L(id).getLevel(levelId);
    let out;
    try {
      // o navegador pode mandar outra fase e outra semente: valem as da rodada
      out = competitive.validate(g, { levelId, seed: S1 }, { ...PLAYS[id](lv, S1), levelId: 'outra-fase', seed: 1 });
    } catch (e) {
      errors.push(`${id}: a jogada boa foi recusada (${e.message})`);
      continue;
    }
    assert(out.result.levelId === levelId && out.perf.concluiu && out.perf.estrelas >= 2 && out.perf.nota >= 300,
      `${id}: corrida na fase ${levelId} com a semente da rodada é aceita (${out.perf.estrelas} ⭐, nota ${out.perf.nota})`);
  }
  // o que foi jogado com outra semente não serve (nos jogos sorteados pela semente)
  const wrongSeed = [];
  for (const id of ['memoria', 'hanoi', 'labirinto', 'diferencas', 'dinheiro', 'balanca', 'matematica']) {
    const lv = L(id).getLevel(LEVEL[id]);
    let ok = false;
    try {
      const out = competitive.validate(game(id), { levelId: lv.id, seed: S2 }, PLAYS[id](lv, S1));
      ok = out.perf.estrelas === 3 && out.perf.qualidade === 1;
    } catch (e) { ok = false; }
    if (ok) wrongSeed.push(id);
  }
  assert(wrongSeed.length === 0, `jogada feita com outra semente não vale nota cheia (${wrongSeed.join(', ') || 'nenhum'})`);
  // matemática: sem contas de revisão na disputa
  const lv = L('matematica').getLevel('mu8');
  const out = competitive.validate(game('matematica'), { levelId: lv.id, seed: S1 }, { ...PLAYS.matematica(lv, S1), review: ['["bin","+",1,1,"c"]'] });
  assert(out.perf.estrelas === 3, 'matemática: as contas de revisão do navegador são ignoradas na disputa');
  // teclado: o mesmo texto para a mesma semente
  const dl = L('digitacao').getLevel('m5f3') || L('digitacao').LEVELS[30];
  assert(Content.generate(dl, 5) === Content.generate(dl, 5) && Content.generate(dl, 5) !== Content.generate(dl, 6), 'Teclado Mágico: mesmo texto para a mesma semente, outro para outra');
}

async function checkDuels() {
  // contas de verdade no banco do teste
  const a = accounts.register('Ana Duelo', '🐶');
  const b = accounts.register('Beto Duelo', '🐱');
  const sa = accounts.authenticate(a.token);
  const sb = accounts.authenticate(b.token);
  const mm = createMatchManager(registry, { reconnectMs: 50 });
  const ends = [];
  const sock = (id) => ({ id, join() {} });

  // velha: os dois entram e jogam até o fim
  const id = mm.createDuel('velha', '3x3', [sa, sb], { onEnd: (r) => ends.push(r) });
  mm.actions.rejoin(sock('s-a'), { matchId: id, studentToken: a.token });
  mm.actions.rejoin(sock('s-b'), { matchId: id, studentToken: b.token });
  const m = mm.matches.get(id);
  assert(m.status === 'playing' && m.players[0].studentId === sa.id && m.players[0].connected && m.players[1].connected, 'duelo: o servidor cria a partida e os dois entram com bg:rejoin');
  for (const [who, move] of [['s-a', 0], ['s-b', 3], ['s-a', 1], ['s-b', 4], ['s-a', 2]]) mm.actions.move(sock(who), { matchId: id, move });
  assert(ends.length === 1 && ends[0].winner === 0 && ends[0].students[0] === sa.id, 'duelo: o fim é avisado para a maratona (quem venceu)');
  const rows = db.prepare("SELECT source FROM game_results WHERE game_id = 'velha'").all();
  assert(rows.length === 2 && rows.every((r) => r.source === 'maratona'), 'duelo: o resultado vai para o progresso dos dois com a origem "maratona"');
  assert(mm.timeUp(id) === 0, 'prazo de um duelo que já acabou não muda nada');

  // prazo: velha sem fim = empate
  const v2 = mm.createDuel('velha', '4x4', [sb, sa], { onEnd: (r) => ends.push(r) });
  assert(mm.timeUp(v2) === null && mm.matches.get(v2).result.reason === 'prazo', 'prazo na Velha: empate');
  // dama: quem tem mais peças
  const d = mm.createDuel('dama', 'brasileira', [sa, sb], { onEnd: (r) => ends.push(r) });
  const dm = mm.matches.get(d);
  dm.state = { ...dm.state, board: dm.state.board.map((p, i) => (p === 'b' && i < 8 ? '.' : p)) }; // brancas com 4 a mais
  assert(mm.timeUp(d) === 0, 'prazo na Dama: vence quem tem mais material');
  // xadrez: material igual = empate; dama a mais = vence
  const x = mm.createDuel('xadrez', 'classico', [sa, sb]);
  assert(mm.timeUp(x) === null, 'prazo no xadrez com material igual: empate');
  const x2 = mm.createDuel('xadrez', 'classico', [sa, sb]);
  const xm = mm.matches.get(x2);
  xm.state = { ...xm.state, board: xm.state.board.map((p) => (p === 'Q' ? '.' : p)) }; // brancas sem a dama
  assert(mm.timeUp(x2) === 1, 'prazo no xadrez: as pretas com a dama a mais vencem');
  let e = null;
  try { mm.createDuel('velha', '3x3', [sa, sa]); } catch (err) { e = err; }
  assert(e && e.code === 'DUELO_INVALIDO', 'duelo precisa de dois educandos diferentes');
  // quem nunca entrou também é resolvido pelo prazo (a maratona chama timeUp)
  const lone = mm.createDuel('ligue4', '4', [sa, sb], { onEnd: (r) => ends.push(r) });
  mm.actions.rejoin(sock('s-a2'), { matchId: lone, studentToken: a.token });
  assert(mm.timeUp(lone) === null && ends[ends.length - 1].reason === 'prazo', 'duelo em que o outro nunca entrou acaba no prazo');
  // a regra de material da Dama no próprio adaptador
  const judge = game('dama').server.marathon.adjudicate;
  assert(judge(Dama.initial()) === null, 'Dama no começo: empate de material');
}

(async () => {
  try {
    checkRaces();
    await checkDuels();
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    errors.push(String(e));
  }
  try { db.close(); } catch (e) { /* ignore */ }
  for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(DB + suffix, { force: true }); } catch (e) { /* ignore */ } }
  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((x) => console.log(' -', x));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
})();
