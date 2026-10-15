// test/dama-xadrez.test.js
// Dama brasileira (captura obrigatória, lei da maioria, pedra captura para
// trás, dama voadora, peça capturada não é pulada duas vezes, coroação só no
// fim da captura, empate por damas, peças presas) e Xadrez (perft nas
// posições de referência, roque, en passant, promoção, mate, afogamento,
// material insuficiente, 3 repetições, 50 lances; as posições do "Fim de
// partida" são mesmo mate em 1 e em 2); o robô; e o servidor conferindo.

const D = require('../public/games/dama/rules.js');
const DLevels = require('../public/games/dama/levels.js');
const X = require('../public/games/xadrez/rules.js');
const XLevels = require('../public/games/xadrez/levels.js');
const Bot = require('../public/js/shared/bot.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const throws = (fn) => { try { fn(); return null; } catch (e) { return e; } };

// ---------- dama ----------
const sq = (n) => (8 - Number(n[1])) * 8 + 'abcdefgh'.indexOf(n[0]);
const nm = (i) => 'abcdefgh'[i % 8] + (8 - Math.floor(i / 8));
function pos(pieces, turn = 0) {
  const s = D.initial();
  s.board = s.board.map(() => '.');
  for (const [p, n] of pieces) s.board[sq(n)] = p;
  s.turn = turn;
  return s;
}
const show = (s) => D.moves(s).map((m) => m.map(nm).join('-')).sort().join(' ');

function checkDama() {
  assert(D.moves(D.initial()).length === 7 && D.initial().turn === 0, 'dama: 12 peças de cada lado, as brancas começam com 7 lances');
  assert(show(pos([['w', 'c3'], ['b', 'd4'], ['w', 'g3']])) === 'c3-e5', 'dama: captura obrigatória');
  assert(show(pos([['w', 'c3'], ['b', 'd4'], ['w', 'g1'], ['b', 'f2'], ['b', 'f4']])) === 'c3-e5-g3-e1', 'dama: lei da maioria (3 capturas vencem 2)');
  assert(show(pos([['w', 'd4'], ['b', 'c3']])) === 'd4-b2', 'dama: a pedra captura para trás');
  assert(show(pos([['w', 'd4'], ['b', 'h8']])) === 'd4-c5 d4-e5', 'dama: a pedra anda só para a frente');
  assert(show(pos([['W', 'a1'], ['b', 'e5']])) === 'a1-f6 a1-g7 a1-h8', 'dama: a dama voadora captura de longe e pousa em qualquer casa livre');
  const turk = D.moves(pos([['W', 'a1'], ['b', 'c3'], ['b', 'e5'], ['b', 'c5'], ['b', 'e3']]));
  assert(turk.length && turk.every((m) => m.length === 3), 'dama: peça capturada fica no caminho e não é pulada duas vezes');
  let s = pos([['w', 'd6'], ['b', 'e7'], ['b', 'g7'], ['b', 'a1']]);
  assert(show(s) === 'd6-f8-h6' && D.play(s, D.moves(s)[0]).board[sq('h6')] === 'w', 'dama: passou pela última fileira no meio da captura, continua pedra');
  s = pos([['w', 'd6'], ['b', 'e7'], ['b', 'a1']]);
  assert(D.play(s, D.moves(s)[0]).board[sq('f8')] === 'W', 'dama: terminou na última fileira, vira dama');
  s = pos([['w', 'c3'], ['b', 'd4'], ['b', 'a7']]);
  const after = D.play(s, [sq('c3'), sq('e5')]);
  assert(after.board[sq('d4')] === '.' && after.captured.join() === String(sq('d4')), 'dama: a peça capturada sai no fim');
  assert(throws(() => D.play(s, [sq('c3'), sq('b4')])), 'dama: lance sem capturar, quando dá para capturar, não vale');
  // sem peças: quem fica sem lance perde
  const t = D.play(pos([['w', 'c3'], ['b', 'd4']]), [sq('c3'), sq('e5')]);
  assert(t.result && t.result.winner === 0 && t.result.reason === 'sem pecas', 'dama: quem fica sem lance perde');
  // empate: 20 lances de cada lado só com damas
  s = pos([['W', 'a1'], ['B', 'h2']]);
  let n = 0;
  while (!s.result && n < 100) { const ms = D.moves(s); s = D.play(s, ms[ms.length - 1]); n++; }
  assert(s.result && s.result.winner === null && n === D.DRAW_PLIES, 'dama: 20 lances de cada lado só com damas = empate');
}

// ---------- xadrez ----------
function perft(s, d) {
  const ms = X.legal(s);
  if (d === 1) return ms.length;
  let n = 0;
  for (const m of ms) n += perft(X.play(s, X.text(m)), d - 1);
  return n;
}
const playAll = (s, list) => list.reduce((st, m) => X.play(st, m), s);
const fen = (f) => X.fromFen(f, 't');

function checkXadrez() {
  const cases = [
    [X.START, [20, 400, 8902]],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039]],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812]],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486]],
  ];
  const bad = [];
  for (const [f, exp] of cases) exp.forEach((e, i) => { const got = perft(fen(f), i + 1); if (got !== e) bad.push(`${f.slice(0, 12)} d${i + 1}: ${got} ≠ ${e}`); });
  assert(bad.length === 0, `xadrez: perft confere nas 5 posições de referência${bad.length ? `: ${bad.join(' / ')}` : ''}`);

  let s = fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert(X.moves(s).includes('e1g1') && X.moves(s).includes('e1c1'), 'xadrez: roque pequeno e grande');
  s = X.play(s, 'e1g1');
  assert(s.board[X.parseSq('f1')] === 'R' && s.board[X.parseSq('g1')] === 'K' && !s.castle.includes('K'), 'xadrez: no roque a torre pula o rei');
  s = fen('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
  assert(!X.moves(s).includes('e1g1'), 'xadrez: não pode rocar passando por casa atacada (nem em xeque)');
  s = playAll(X.initial(), ['e2e4', 'a7a6', 'e4e5', 'd7d5']);
  assert(X.moves(s).includes('e5d6') && X.play(s, 'e5d6').board[X.parseSq('d5')] === '.', 'xadrez: en passant captura o peão do lado');
  s = fen('8/P7/8/8/8/8/8/k6K w - - 0 1');
  assert(['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'].every((m) => X.moves(s).includes(m)) && X.play(s, 'a7a8n').board[0] === 'N', 'xadrez: promoção com escolha da peça');
  s = playAll(X.initial(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert(s.result && s.result.winner === 1 && s.result.reason === 'mate', 'xadrez: xeque-mate (mate do louco)');
  s = X.play(fen('7k/8/6Q1/8/8/8/8/K7 w - - 0 1'), 'g6f7');
  assert(s.result && s.result.winner === null && s.result.reason === 'afogamento', 'xadrez: afogamento é empate');
  const ins = fen('7k/8/8/8/8/8/1p6/K6n w - - 0 1');
  assert(!ins.result && X.isLegal(ins, 'a1b2') && X.play(ins, 'a1b2').result.reason === 'material', 'xadrez: sobrou rei e cavalo contra rei = material insuficiente');
  s = X.initial();
  for (let k = 0; k < 2; k++) s = playAll(s, ['g1f3', 'g8f6', 'f3g1', 'f6g8']);
  assert(s.result && s.result.reason === 'repeticao', 'xadrez: a mesma posição 3 vezes = empate');
  s = fen('8/8/8/4k3/8/8/8/R3K3 w - - 99 80');
  s = X.play(s, 'a1a2');
  assert(s.result && s.result.reason === '50lances', 'xadrez: 50 lances sem captura nem peão = empate');
  assert(throws(() => X.play(X.initial(), 'e2e5')) || !X.isLegal(X.initial(), 'e2e5'), 'xadrez: lance impossível não vale');
  assert(!X.isLegal(X.initial(), ['e2', 'e4']) && !X.isLegal(X.initial(), 'e2e4q'), 'xadrez: lance malformado não vale');

  // o "Fim de partida": mate em 1 e em 2 de verdade, e os finais de rei
  const mates = (st) => X.moves(st).filter((m) => { const t = X.play(st, m); return t.result && t.result.reason === 'mate'; });
  const mateIn2 = (st) => X.moves(st).some((m) => {
    const t = X.play(st, m);
    return !t.result && X.moves(t).every((r) => { const u = X.play(t, r); return !u.result && mates(u).length > 0; });
  });
  const badEnd = [];
  for (const l of XLevels.LEVELS.filter((x) => x.world === 'xf')) {
    const st = X.initial(l.variant);
    if (st.turn !== 0 || l.seat !== 0) badEnd.push(`${l.id}: as brancas jogam`);
    if (l.par === 1 && !mates(st).length) badEnd.push(`${l.id}: não é mate em 1`);
    if (l.par === 2 && (mates(st).length || !mateIn2(st))) badEnd.push(`${l.id}: não é mate em 2`);
  }
  assert(badEnd.length === 0, `xadrez: as posições do Fim de partida conferem (mate em 1, mate em 2)${badEnd.length ? `: ${badEnd.join(' / ')}` : ''}`);
  assert(XLevels.variants().map((v) => v.id).join() === 'classico' && DLevels.variants().map((v) => v.id).join() === 'brasileira', 'com um amigo: só a partida normal (sem as posições do Fim de partida)');
}

function checkBot() {
  let r = Bot.search(X, X.initial('m1c'), { depth: 2 });
  assert(r.move === 'e5f7', 'robô do xadrez acha o mate em 1');
  r = Bot.search(X, X.initial('m2b'), { depth: 4, maxMs: 6000 });
  assert(r.move === 'f5e6', 'robô do xadrez acha o lance calmo do mate em 2');
  r = Bot.search(X, fen('rnb1kbnr/pppp1ppp/8/4p1q1/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq - 0 3'), { depth: 2 });
  assert(r.move === 'c1g5', 'robô do xadrez captura a dama pendurada');
  const t0 = Date.now();
  let s = playAll(X.initial(), ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  Bot.search(X, s, XLevels.getLevel('xp6').bot);
  assert(Date.now() - t0 < 2600, `robô mestre do xadrez responde rápido (${Date.now() - t0} ms)`);
  r = Bot.search(D, pos([['w', 'c3'], ['b', 'd4'], ['w', 'g1'], ['b', 'f2'], ['b', 'f4']]), { depth: 3 });
  assert(r.move.join() === [sq('c3'), sq('e5'), sq('g3'), sq('e1')].join(), 'robô da dama faz a captura obrigatória');
  // partida inteira robô × robô na dama termina com lances válidos
  s = D.initial();
  let n = 0;
  while (!s.result && n < 300) { s = D.play(s, Bot.search(D, s, { depth: 2, random: 0.2 }).move); n++; }
  assert(Boolean(s.result), `dama: partida robô × robô termina (${n} lances, ${s.result && s.result.reason})`);
}

async function checkServer() {
  const srv = await startTestServer(3115);
  const { api } = srv;
  try {
    const kid = await srv.student('Caio Lima');
    let r = await api('POST', '/api/progress/xadrez/results', { levelId: 'xf1', seat: 0, moves: ['a1a8'], durationMs: 5000 }, kid);
    assert(r.ok && r.result.stars === 3, 'xadrez: mate em 1 de primeira = 3 estrelas');
    const slow = ['a1a2', 'g8h8', 'a2a8'];
    r = await api('POST', '/api/progress/xadrez/results', { levelId: 'xf1', seat: 0, moves: slow, durationMs: 9000 }, kid);
    assert(r.ok && r.result.stars === 2, 'xadrez: mate depois do par = 2 estrelas');
    r = await api('POST', '/api/progress/xadrez/results', { levelId: 'xf1', seat: 1, moves: ['a1a8'], durationMs: 5000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'xadrez: no Fim de partida a criança joga com as brancas');
    r = await api('POST', '/api/progress/xadrez/results', { levelId: 'xp1', seat: 1, moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], durationMs: 9000 }, kid);
    assert(r.ok && r.result.stars === 3, 'xadrez: partida contra o robô refeita e vencida (mate do louco)');
    r = await api('POST', '/api/progress/xadrez/results', { levelId: 'xp1', seat: 1, moves: ['f2f3', 'e7e5', 'g2g4', 'd8h5'], durationMs: 9000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'xadrez: partida que não acabou é recusada');
    r = await api('POST', '/api/progress/xadrez/results', { levelId: 'xp1', seat: 0, moves: ['e2e5'], durationMs: 9000, resigned: true }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'xadrez: lance impossível é recusado');

    // dama: uma partida inteira robô × robô, com a criança no lado que ganhou
    let s = D.initial();
    const moves = [];
    while (!s.result && moves.length < 300) { const m = Bot.search(D, s, { depth: 2, random: 0.1 }).move; moves.push(m); s = D.play(s, m); }
    const seat = s.result.winner === null ? 0 : s.result.winner;
    r = await api('POST', '/api/progress/dama/results', { levelId: 'dm1', seat, moves, durationMs: 300000 }, kid);
    assert(r.ok && r.result.stars === (s.result.winner === null ? 1 : 3), 'dama: o servidor refaz a partida inteira e dá as estrelas');
    r = await api('POST', '/api/progress/dama/results', { levelId: 'dm1', seat: 0, moves: [[sq('c3'), sq('c4')]], durationMs: 9000, resigned: true }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'dama: lance impossível é recusado');
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkDama();
    checkXadrez();
    checkBot();
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
