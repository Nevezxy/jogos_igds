// test/pontos.test.js
// 🏅 Pontos globais e ranking (Modo Maratona, fase 1): cada fase vale
// estrelas × 10 × dificuldade; repetir só soma se melhorar; o mesmo
// resultado enviado de novo (mesma identificação da rodada, ou mesma fase e
// semente nos navegadores antigos) não é gravado duas vezes; o ranking é
// calculado no servidor e aberto a quem está logado; juntar contas e o
// recálculo completo batem com os pontos somados rodada a rodada.

const os = require('os');
const path = require('path');
const fs = require('fs');

// banco temporário para as regras carregadas aqui (o servidor do teste tem o dele)
const DB = path.join(os.tmpdir(), `igds-pontos-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILE = DB;

const CarLevels = require('../public/games/carrinhos/levels.js');
const T = require('../public/games/carrinhos/traffic.js');
const HanoiLevels = require('../public/games/hanoi/levels.js');
const H = require('../public/games/hanoi/hanoi.js');
const points = require('../src/platform/points');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

function checkRules() {
  const L = points.levelsOf('carrinhos');
  const tiers = L.LEVELS.map((l) => points.tierOf(L, l));
  assert(tiers[0] === 1 && tiers[tiers.length - 1] === 4 && tiers.every((t, i) => i === 0 || t >= tiers[i - 1]), 'dificuldade padrão: do 1 (primeiras fases) ao 4 (últimas), sem descer');
  assert(points.levelPoints(3, 1) === 30 && points.levelPoints(2, 4) === 80 && points.levelPoints(0, 4) === 0, 'pontos da fase = estrelas × 10 × dificuldade');
  const p = points.gamePoints('carrinhos', { levels: { cr1a: { stars: 3 }, cr5h: { stars: 1 }, xx: { stars: 3 } } });
  assert(p.points === 30 + 40 && p.levelsDone === 2, 'pontos do jogo somam só as fases que existem');
  assert(points.levelsOf('bingo') === null && points.gamePoints('bingo', { levels: {} }).points === 0, 'jogo sem fases (bingo) não dá pontos');
}

(async () => {
  checkRules();
  const srv = await startTestServer(3116);
  const { api } = srv;
  try {
    const ana = await srv.student('Ana Pontos 5A');
    const bia = await srv.student('Bia Pontos 5A');
    const caio = await srv.student('Caio Pontos 4B');

    const lv = CarLevels.getLevel('cr1a');
    const sol = T.solve(T.parse(lv.board));
    const body = { levelId: lv.id, seed: 11, moves: sol, hints: 0, durationMs: 30000, attemptId: 'rodada-ana-0001' };

    // 1ª vez: grava e soma
    let r = await api('POST', '/api/progress/carrinhos/results', body, ana);
    assert(r.ok && r.result.stars === 3 && r.result.points === 30 && !r.duplicate, 'carrinhos 3 ⭐ numa fase de dificuldade 1 = +30 pontos');
    // o mesmo resultado de novo (caixa de saída): não grava outra vez
    r = await api('POST', '/api/progress/carrinhos/results', body, ana);
    assert(r.ok && r.duplicate === true && r.result.points === 0 && r.result.stars === 3, 'reenvio da mesma rodada: reconhecido, nada gravado de novo');
    let h = await api('GET', '/api/me/history?game=carrinhos', null, ana);
    assert(h.ok && h.history.length === 1 && h.history[0].pointsDelta === 30, 'o histórico tem a rodada uma vez só, com os pontos que ela deu');
    // navegador antigo (sem attemptId): fase + semente identificam a rodada
    const old = { levelId: lv.id, seed: 77, moves: sol, durationMs: 30000 };
    r = await api('POST', '/api/progress/carrinhos/results', old, ana);
    const r2 = await api('POST', '/api/progress/carrinhos/results', old, ana);
    assert(r.ok && !r.duplicate && r2.ok && r2.duplicate === true, 'sem attemptId (navegador antigo): o mesmo resultado reenviado também é reconhecido');
    r = await api('POST', '/api/progress/carrinhos/results', { ...old, durationMs: 31000 }, ana);
    assert(r.ok && !r.duplicate, 'sem attemptId: outra rodada (resultado diferente) é gravada normalmente');
    // jogar de novo sem melhorar: treina, mas não soma
    r = await api('POST', '/api/progress/carrinhos/results', { ...body, attemptId: 'rodada-ana-0002', hints: 1 }, ana);
    assert(r.ok && r.result.stars === 2 && r.result.points === 0, 'repetir a fase sem melhorar não dá pontos (o melhor fica)');
    let me = await api('GET', '/api/me/points', null, ana);
    assert(me.ok && me.total === 30 && me.levelsDone === 1 && me.games[0].gameId === 'carrinhos', 'meus pontos: 30 em 1 fase');

    // Bia: duas fases, uma com dica (2 ⭐) e depois melhora para 3 ⭐
    const lv2 = CarLevels.getLevel('cr1b');
    const sol2 = T.solve(T.parse(lv2.board));
    r = await api('POST', '/api/progress/carrinhos/results', { levelId: lv2.id, seed: 1, moves: sol2, hints: 1, durationMs: 30000, attemptId: 'rodada-bia-0001' }, bia);
    assert(r.ok && r.result.points === 20, 'Bia: 2 ⭐ = +20');
    r = await api('POST', '/api/progress/carrinhos/results', { levelId: lv2.id, seed: 2, moves: sol2, hints: 0, durationMs: 30000, attemptId: 'rodada-bia-0002' }, bia);
    assert(r.ok && r.result.points === 10, 'Bia melhorou para 3 ⭐: soma só a diferença (+10)');
    r = await api('POST', '/api/progress/carrinhos/results', { ...body, attemptId: 'rodada-bia-0003' }, bia);
    // Hanói clássico de 7 discos é das últimas fases (dificuldade alta)
    const hl = HanoiLevels.getLevel('hn1a');
    const g = H.setup(hl, 3);
    let pos = g.start.slice();
    const moves = [];
    while (!H.same(pos, g.goal)) { const m = H.hint(pos, g.goal, g.pegs); moves.push(m); pos = H.apply(pos, m); }
    r = await api('POST', '/api/progress/hanoi/results', { levelId: hl.id, seed: 3, moves, durationMs: 20000, attemptId: 'rodada-bia-0004' }, bia);
    assert(r.ok && r.result.points === 30, 'Hanói 3 ⭐ numa fase de dificuldade 1 = +30');
    me = await api('GET', '/api/me/points', null, bia);
    assert(me.total === 90 && me.games.length === 2, 'Bia: 90 pontos em 2 jogos');

    // Caio, de outra turma
    r = await api('POST', '/api/progress/carrinhos/results', { ...body, attemptId: 'rodada-caio-001' }, caio);

    // ranking
    let rk = await api('GET', '/api/ranking', null, ana);
    assert(rk.ok && rk.ranking[0].name === 'Bia Pontos 5A' && rk.ranking[0].position === 1, 'ranking geral: Bia em 1º');
    const ranks = rk.ranking.map((x) => `${x.position}:${x.points}`).join(' ');
    assert(ranks === '1:90 2:30 2:30', `empate divide a posição (${ranks})`);
    assert(rk.me && rk.me.points === 30, 'o ranking marca quem está olhando');
    rk = await api('GET', '/api/ranking?class=4B', null, ana);
    assert(rk.ok && rk.ranking.length === 1 && rk.ranking[0].name.startsWith('Caio'), 'ranking da turma 4B');
    rk = await api('GET', '/api/ranking?game=hanoi', null, caio);
    assert(rk.ok && rk.ranking.length === 1 && rk.ranking[0].points === 30, 'ranking de um jogo só');
    // sem PIN do professor (como neste teste) a área do professor é aberta; com PIN, pede login (abaixo)
    rk = await api('GET', '/api/ranking', null, null);
    assert(rk.ok, 'sem PIN configurado, o ranking abre como a área do professor');
    const t = await api('POST', '/api/teacher/login', { pin: '' });
    const teacher = { teacher: t.token };
    rk = await api('GET', '/api/ranking', null, teacher);
    assert(rk.ok && rk.ranking.length === 3, 'o professor também vê o ranking');
    me = await api('GET', '/api/me/points', null, caio);
    assert(me.position === 2 && me.classPosition === 1, 'minha posição geral e na turma');

    // juntar contas: Caio era a Ana com outro nome
    const list = await api('GET', '/api/teacher/students', null, teacher);
    const id = (name) => list.students.find((s) => s.name === name).id;
    r = await api('POST', '/api/teacher/students/merge', { fromId: id('Caio Pontos 4B'), intoId: id('Ana Pontos 5A') }, teacher);
    rk = await api('GET', '/api/ranking', null, teacher);
    assert(r.ok && rk.ranking.length === 2 && rk.ranking.find((x) => x.name.startsWith('Ana')).points === 30, 'juntar contas: os pontos da conta certa são refeitos (sem somar a mesma fase duas vezes)');
    h = await api('GET', `/api/teacher/students/${id('Bia Pontos 5A')}/history`, null, teacher);
    assert(h.ok && h.history.length === 4 && h.points.total === 90, 'professor: histórico e pontos de um educando');

    // com PIN: sem login nenhum, o ranking pede login
    const pinned = await startTestServer(3117, { PROFESSOR_PIN: '4321' });
    try {
      const nobody = await pinned.api('GET', '/api/ranking', null, null);
      assert(!nobody.ok && nobody.status === 401, 'com PIN: sem login nenhum, o ranking pede login');
    } finally { await pinned.stop(); }

    // recálculo completo = soma rodada a rodada
    const before = (await api('GET', '/api/ranking', null, teacher)).ranking.map((x) => `${x.name}:${x.points}`).join();
    r = await api('POST', '/api/teacher/points/recompute', {}, teacher);
    const after = (await api('GET', '/api/ranking', null, teacher)).ranking.map((x) => `${x.name}:${x.points}`).join();
    assert(r.ok && before === after, 'recalcular tudo a partir do progresso dá o mesmo ranking');
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    errors.push(String(e));
  } finally {
    await srv.stop();
    try { require('../src/platform/db').db.close(); } catch (e) { /* ignore */ }
    for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(DB + suffix, { force: true }); } catch (e) { /* ignore */ } }
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
