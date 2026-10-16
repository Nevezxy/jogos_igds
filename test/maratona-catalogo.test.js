// test/maratona-catalogo.test.js
// 🏃 Modo Maratona, fase 2: a dificuldade de cada fase (tier de 1 a 4),
// quais fases podem cair em cada nível, os assuntos (mundos) que o
// professor escolhe, as fases que ficam de fora (contra o robô, longas
// demais), os duelos de tabuleiro (Dama e Xadrez só no nível 4) e a nota de
// desempenho calculada a partir do resultado já validado pelo jogo.

const os = require('os');
const path = require('path');
const fs = require('fs');

const DB = path.join(os.tmpdir(), `igds-catalogo-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILE = DB;

const registry = require('../src/games/registry');
const C = require('../src/marathon/catalog');
const points = require('../src/platform/points');
const CarLevels = require('../public/games/carrinhos/levels.js');
const T = require('../public/games/carrinhos/traffic.js');
const HanoiLevels = require('../public/games/hanoi/levels.js');
const H = require('../public/games/hanoi/hanoi.js');
const Problems = require('../public/games/matematica/problems.js');
const MathLevels = require('../public/games/matematica/levels.js');
const Xadrez = require('../public/games/xadrez/rules.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const game = (id) => registry.games.find((g) => g.id === id);

function checkTiers() {
  const cat = C.catalog(registry);
  const ids = cat.map((c) => c.id);
  assert(cat.length === 18 && !ids.includes('bingo') && !ids.includes('desafio'), `18 jogos entram na Maratona (sem Bingo e Desafio): ${ids.length}`);
  const bad = [];
  for (const info of cat) {
    for (const e of info.entries) {
      if (![1, 2, 3, 4].includes(e.tier)) bad.push(`${info.id}/${e.key}: tier ${e.tier}`);
      if (!e.excluded && !(e.estMs > 0 && Number.isFinite(e.estMs))) bad.push(`${info.id}/${e.key}: estMs ${e.estMs}`);
    }
  }
  assert(bad.length === 0, `toda fase tem dificuldade de 1 a 4 e tempo estimado${bad.length ? `: ${bad.slice(0, 4).join(' / ')}` : ''}`);
  const tier = (g, id) => points.tierOf(points.levelsOf(g), points.levelsOf(g).getLevel(id));
  assert(tier('matematica', 'fg1') === 1 && tier('matematica', 'ad6') === 1 && tier('matematica', 'ad9') === 2 && tier('matematica', 'ad14') === 3
    && tier('matematica', 'mu2') === 2 && tier('matematica', 'mu16') === 3 && tier('matematica', 'mx2') === 2 && tier('matematica', 'mx4') === 3
    && tier('matematica', 'ng1') === 4 && tier('matematica', 'ex12') === 4, 'Matemática: dificuldade pelo conteúdo (figurinhas 1, dezena 2, centena 3, negativos 4)');
  assert(tier('numeros', 'n1a') === 1 && tier('numeros', points.levelsOf('numeros').LEVELS.find((l) => l.world === 'n7').id) === 4, 'Números Cadentes: dados = 1, negativos = 4');
  assert(tier('memoria', 'mm1a') === 1 && tier('memoria', 'mm1d') === 3 && tier('memoria', 'mm5c') === 4, 'Memória: pelo tipo de par e o número de cartas');
  assert(tier('xadrez', 'xf1') === 2 && tier('xadrez', 'xf5') === 3 && tier('xadrez', 'xf8') === 4, 'Xadrez: mate em 1 = 2, mate em 2 = 3, finais = 4');
  const MathCat = cat.find((c) => c.id === 'matematica');
  assert(MathCat.topics.length === 10 && MathCat.topics.some((t) => t.id === 'mu' && t.name === 'Multiplicação'), 'Matemática: os 10 assuntos (mundos) aparecem para o professor escolher');
  assert(points.POINTS_VERSION >= 2, 'regra de pontos nova (os pontos são refeitos ao subir)');
}

function checkEligibility() {
  const info = (id) => C.describe(game(id));
  // o nível escolhe as dificuldades
  for (const [nivel, tiers] of Object.entries(C.NIVEIS)) {
    // (fora da faixa só o jogo que não tem nenhuma fase nela, marcado com aboveLevel)
    const wrong = C.catalog(registry).flatMap((i) => C.eligible(i, { nivel: Number(nivel) }).filter((e) => !tiers.includes(e.tier) && !e.aboveLevel).map((e) => `${i.id}/${e.key}`));
    assert(wrong.length === 0, `nível ${nivel}: só fases de dificuldade ${tiers.join(', ')} (${wrong.join(', ') || 'ok'})`);
  }
  // cada nível inclui as fases dos níveis de baixo
  assert([1, 2, 3, 4].every((n) => C.NIVEIS[n].length === n && C.NIVEIS[n].every((t, i) => t === i + 1)), 'nível N aceita as dificuldades de 1 até N');
  const count = (nivel) => C.status(registry, { nivel }).reduce((a, s) => a + s.count, 0);
  assert(count(1) <= count(2) && count(2) <= count(3) && count(3) <= count(4), `subir de nível nunca tira fases (${[1, 2, 3, 4].map(count).join(' ≤ ')})`);
  const st4 = C.status(registry, { nivel: 4 });
  assert(st4.every((s) => s.count > 0), `nível 4: todo jogo tem fase para cair (${st4.filter((s) => !s.count).map((s) => s.id).join(', ') || 'ok'})`);
  const st1 = C.status(registry, { nivel: 1 });
  assert(st1.every((s) => s.count > 0), `nível 1: todo jogo tem fase para cair (${st1.filter((s) => !s.count).map((s) => s.id).join(', ') || 'ok'})`);
  // sem fase na faixa do nível, o jogo entra com as suas fases mais fáceis
  const above = st1.filter((s) => s.aboveLevel).map((s) => s.id).sort().join();
  assert(above === 'dama,ligue4,xadrez', `nível 1: Dama, Ligue 4 e Xadrez entram com as fases mais fáceis (${above})`);
  assert([2, 3].every((n) => C.status(registry, { nivel: n }).filter((s) => s.aboveLevel).map((s) => s.id).join() === 'dama') && !C.status(registry, { nivel: 4 }).some((s) => s.aboveLevel), 'níveis 2 e 3: só a Dama sobe; nível 4: ninguém');
  // contra o robô fica de fora
  const mem = info('memoria');
  assert(mem.entries.filter((e) => e.levelId && e.levelId.startsWith('mm6')).every((e) => e.excluded === 'contra o robô'), 'Memória contra o robô fica de fora');
  const v = info('velha');
  assert(v.entries.filter((e) => e.kind === 'corrida').every((e) => e.excluded) && v.entries.filter((e) => e.kind === 'duelo').length === 2, 'Velha: só duelo pela rede (3 × 3 e 4 × 4)');
  const x = info('xadrez');
  assert(x.entries.filter((e) => e.levelId && e.levelId.startsWith('xp')).every((e) => e.excluded) && x.entries.filter((e) => e.levelId && e.levelId.startsWith('xf')).every((e) => !e.excluded), 'Xadrez: o Fim de partida é corrida, os robôs ficam de fora');
  // partida de xadrez só no nível 4; a Dama (só tem a partida) em todos, cortada pelo prazo (decisão D3)
  const duel = (id, nivel) => C.eligible(info(id), { nivel }).filter((e) => e.kind === 'duelo').map((e) => e.variant);
  assert([1, 2, 3, 4].every((n) => duel('dama', n).join() === 'brasileira') && duel('xadrez', 3).length === 0 && duel('xadrez', 4).join() === 'classico',
    'Dama em todos os níveis; partida de xadrez só no nível 4');
  const x1 = C.eligible(info('xadrez'), { nivel: 1 });
  assert(x1.length === 4 && x1.every((e) => e.kind === 'corrida' && e.aboveLevel), 'Xadrez no nível 1: os 4 mates em 1 lance');
  assert(C.eligible(info('ligue4'), { nivel: 1 }).map((e) => e.variant).join() === '4', 'Ligue 4 no nível 1: o duelo clássico');
  assert(C.eligible(info('xadrez'), { nivel: 4, roundMs: C.ROUND_MS.min }).some((e) => e.variant === 'classico'), 'a partida de xadrez entra mesmo com rodada curta (acaba no prazo)');
  // tempo da rodada: fase que não cabe fica de fora
  const short = C.eligible(info('quebracabeca'), { nivel: 4, roundMs: C.ROUND_MS.min });
  const long = C.eligible(info('quebracabeca'), { nivel: 4, roundMs: C.ROUND_MS.max });
  assert(short.length < long.length && short.every((e) => e.estMs <= C.ROUND_MS.min), `rodada de 2 min: só as fases que cabem (${short.length} de ${long.length} no Quebra-cabeça)`);
  // assuntos (decisão D2)
  const mu = C.eligible(info('matematica'), { nivel: 2, topics: ['mu'] });
  assert(mu.length > 0 && mu.every((e) => e.topic === 'mu' && e.tier <= 2), `Matemática só "Multiplicação" no nível 2: ${mu.length} fases, todas tabuadas`);
  const up = C.status(registry, { nivel: 1, topics: { matematica: ['ng'] } }).find((s) => s.id === 'matematica');
  assert(up.count > 0 && up.aboveLevel && !up.reason, 'assunto sem fase no nível: entra com as fases mais fáceis dele');
  const none = C.status(registry, { nivel: 1, topics: { matematica: ['nada'] } }).find((s) => s.id === 'matematica');
  assert(none.count === 0 && none.reason === 'nenhuma fase desses assuntos neste nível', 'assunto sem nenhuma fase: o motivo aparece');
  assert(C.describe(game('quebracabeca')).off === true && C.describe(game('quebracabeca')).trust === 'fraca', 'Quebra-cabeça: desligado por padrão (validação fraca)');
}

function checkPerf() {
  // carrinhos no mínimo = 3 ⭐ e qualidade 1
  const cl = CarLevels.getLevel('cr2c');
  const sol = T.solve(T.parse(cl.board));
  const g = game('carrinhos');
  let r = g.server.validateResult({ levelId: cl.id, seed: 1, moves: sol, hints: 0, durationMs: 60000 });
  let p = C.perf(g, r, cl);
  assert(p.concluiu && p.estrelas === 3 && p.qualidade === 1 && p.nota === 499, `carrinhos no mínimo: nota máxima (${p.nota})`);
  r = g.server.validateResult({ levelId: cl.id, seed: 1, moves: sol, hints: 1, durationMs: 60000 });
  const p2 = C.perf(g, r, cl);
  assert(p2.estrelas === 2 && p2.nota === 399, `com dica: 2 ⭐ (${p2.nota})`);
  // hanói com movimentos a mais: mesma estrela, qualidade menor
  const hl = HanoiLevels.getLevel('hn1b');
  const hg = H.setup(hl, 9);
  let pos = hg.start.slice();
  const moves = [];
  while (!H.same(pos, hg.goal)) { const m = H.hint(pos, hg.goal, hg.pegs); moves.push(m); pos = H.apply(pos, m); }
  const extra = [[0, 1], [1, 0], ...moves];
  const hr = game('hanoi').server.validateResult({ levelId: hl.id, seed: 9, moves: extra, durationMs: 60000 });
  const hp = C.perf(game('hanoi'), hr, hl);
  const hr2 = game('hanoi').server.validateResult({ levelId: hl.id, seed: 9, moves, durationMs: 60000 });
  const hp2 = C.perf(game('hanoi'), hr2, hl);
  assert(hp.qualidade < 1 && hp2.qualidade === 1 && hp2.nota > hp.nota, `hanói: movimentos a mais baixam a nota (${hp.nota} < ${hp2.nota})`);
  // matemática: acertos de primeira
  const ml = MathLevels.getLevel('mu4');
  const round = Problems.makeRound(ml, 42);
  const answers = round.map((q, i) => ({ tries: i < 2 ? [q.answer + 1, q.answer] : [q.answer] }));
  const mr = game('matematica').server.validateResult({ levelId: ml.id, seed: 42, review: [], answers, durationMs: 40000 }, null);
  const mp = C.perf(game('matematica'), mr, ml);
  assert(Math.abs(mp.qualidade - 0.8) < 1e-9 && mp.estrelas === 3, `matemática: 8 de 10 de primeira = qualidade 0,8 (${mp.nota})`);
  // xadrez, mate em 1
  const xl = points.levelsOf('xadrez').getLevel('xf1');
  const s = Xadrez.initial(xl.variant);
  const mate = Xadrez.moves(s).find((m) => Xadrez.play(s, m).result);
  const xr = game('xadrez').server.validateResult({ levelId: xl.id, seat: 0, moves: [mate], durationMs: 5000 });
  const xp = C.perf(game('xadrez'), xr, xl);
  assert(xp.estrelas === 3 && xp.qualidade === 1, `xadrez mate em 1: 3 ⭐, nota ${xp.nota}`);
  assert(C.NAO_CONCLUIU.nota === 0, 'quem não termina fica com nota 0');
}

(async () => {
  checkTiers();
  checkEligibility();
  checkPerf();
  const srv = await startTestServer(3118);
  try {
    const t = await srv.api('POST', '/api/teacher/login', { pin: '' });
    const teacher = { teacher: t.token };
    let r = await srv.api('GET', '/api/teacher/maratona/catalogo?nivel=1&tempo=5', null, teacher);
    assert(r.ok && r.games.length === 18 && r.games.every((g) => g.count > 0) && r.games.find((g) => g.id === 'dama').aboveLevel && !r.games.find((g) => g.id === 'carrinhos').aboveLevel, 'API: catálogo do nível 1 com todos os jogos (Dama acima do nível)');
    r = await srv.api('GET', `/api/teacher/maratona/catalogo/matematica?nivel=2&assuntos=${encodeURIComponent(JSON.stringify({ matematica: ['dv'] }))}`, null, teacher);
    assert(r.ok && r.fases.length > 0 && r.fases.every((f) => f.topic === 'dv'), 'API: as fases que podem cair de um jogo, com os assuntos escolhidos');
    const kid = await srv.student('Duda Catalogo');
    r = await srv.api('GET', '/api/teacher/maratona/catalogo?nivel=1', null, kid);
    // sem PIN a área do professor é aberta; o importante é a rota existir e responder
    assert(r.ok || r.status === 401, 'API: rota do catálogo protegida como a área do professor');
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
