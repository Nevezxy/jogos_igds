// test/dinamico.test.js
// 🔀 Modo Dinâmico (PLANO_MODO_DINAMICO.md): os jogos que podem entrar, a
// configuração da criança, a escolha da próxima fase (outro jogo, mesma
// dificuldade, nunca uma fase já jogada, o intervalo) e as rotas
// /api/dinamico com resultados de verdade.

const os = require('os');
const path = require('path');
const fs = require('fs');

const DB = path.join(os.tmpdir(), `igds-dinamico-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILE = DB;

const registry = require('../src/games/registry');
const D = require('../src/platform/dynamic');
const points = require('../src/platform/points');
const CarLevels = require('../public/games/carrinhos/levels.js');
const T = require('../public/games/carrinhos/traffic.js');
const HanoiLevels = require('../public/games/hanoi/levels.js');
const H = require('../public/games/hanoi/hanoi.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const throwsCode = (fn, code) => { try { fn(); return false; } catch (e) { return e.code === code; } };

const cat = D.catalog(registry);
const gamesById = Object.fromEntries(cat.map((g) => [g.id, registry.games.find((x) => x.id === g.id)]));
const L = (id) => points.levelsOf(id);
const tier = (g, id) => points.tierOf(L(g), L(g).getLevel(id));
const settings = (over = {}) => ({ on: true, games: cat.map((g) => g.id), interval: 1, streak: 0, current: null, last: null, recent: [], ...over });
// progresso com estas fases jogadas: { jogo: { fase: estrelas } }
const prog = (spec) => Object.fromEntries(Object.entries(spec).map(([g, lv]) => [g, {
  levels: Object.fromEntries(Object.entries(lv).map(([id, stars]) => [id, { stars, plays: 1 }])),
}]));

function checkCatalog() {
  const ids = cat.map((g) => g.id);
  assert(cat.length === 18 && !['bingo', 'desafio', 'maratona'].some((id) => ids.includes(id)),
    `18 jogos individuais com fases entram (sem Bingo, Desafio e Maratona): ${ids.length}`);
  assert(cat.every((g) => g.levels > 0 && g.name && g.icon && g.subject), 'cada jogo do catálogo tem nome, ícone, seção e fases');
  assert(JSON.stringify(D.tierBands(2, 1)) === '[[2],[1],[3],[1,2,3,4]]' && JSON.stringify(D.tierBands(2, 3)) === '[[2],[3],[1],[1,2,3,4]]'
    && JSON.stringify(D.tierBands(1, 1)) === '[[1],[2],[1,2,3,4]]' && JSON.stringify(D.tierBands(4, 3)) === '[[4],[3],[1,2,3,4]]',
  'faixas: mesmo tier, depois o de baixo (1 ⭐) ou o de cima (3 ⭐), depois qualquer');
}

function checkPick() {
  const from = { gameId: 'hanoi', levelId: 'hn1a', stars: 3 };
  const base = { gamesById, from, rng: () => 0.5 };

  let r = D.pickNext({ ...base, settings: settings({ on: false }), progressAll: prog({ hanoi: { hn1a: 3 } }) });
  assert(r.reason === 'DESLIGADO' && r.next === null, 'desligado: não sugere nada');

  r = D.pickNext({ ...base, settings: settings(), progressAll: prog({ hanoi: { hn1a: 0 } }) });
  assert(r.reason === 'NAO_CONCLUIU' && r.next === null && r.state.streak === 0, '0 ⭐ não conclui a fase: fica no jogo e o intervalo não anda');

  r = D.pickNext({ ...base, settings: settings(), progressAll: prog({ hanoi: { hn1a: 3 } }) });
  assert(r.reason === 'TROCA' && r.next.gameId !== 'hanoi', `intervalo 1: troca de jogo (${r.next && r.next.gameId})`);
  assert(r.next.tier === tier('hanoi', 'hn1a'), `mesma dificuldade (${r.next.tier})`);
  assert(r.state.recent[0] === 'hanoi' && r.state.current === r.next.gameId && r.state.streak === 0, 'o andamento guarda o jogo anterior e zera o contador');
  assert(r.next.levelId === L(r.next.gameId).LEVELS.find((l) => points.tierOf(L(r.next.gameId), l) === r.next.tier).id,
    'dentro do jogo: a primeira fase daquela dificuldade, na ordem do jogo');

  // nunca uma fase já jogada (inclusive na Maratona ou com 0 ⭐)
  const onlyCar = settings({ games: ['hanoi', 'carrinhos'] });
  const first = CarLevels.LEVELS.filter((l) => tier('carrinhos', l.id) === 1);
  r = D.pickNext({ ...base, settings: onlyCar, progressAll: { ...prog({ hanoi: { hn1a: 3 } }), carrinhos: { levels: { [first[0].id]: { stars: 3, plays: 1 }, [first[1].id]: { stars: 0, plays: 2 } } } } });
  assert(r.next.gameId === 'carrinhos' && r.next.levelId === first[2].id, `pula as fases já jogadas, até as sem estrela (${r.next.levelId})`);

  // intervalo 2: na 1ª conclusão fica no jogo (fase seguinte nova), na 2ª troca
  const s2 = settings({ interval: 2, games: ['hanoi', 'carrinhos', 'memoria'] });
  r = D.pickNext({ ...base, settings: s2, progressAll: prog({ hanoi: { hn1a: 3 } }) });
  assert(r.reason === 'MESMO_JOGO' && r.next.gameId === 'hanoi' && r.next.levelId === 'hn1b' && r.state.streak === 1, 'intervalo 2: 1ª fase concluída, segue no mesmo jogo');
  const r2 = D.pickNext({ ...base, settings: { ...s2, ...r.state }, from: { gameId: 'hanoi', levelId: 'hn1b', stars: 2 }, progressAll: prog({ hanoi: { hn1a: 3, hn1b: 2 } }) });
  assert(r2.reason === 'TROCA' && r2.next.gameId !== 'hanoi', 'intervalo 2: 2ª fase concluída, troca de jogo');

  // a mesma fase de novo ("jogar de novo") não conta outra vez e devolve a mesma sugestão
  const again = D.pickNext({ ...base, settings: { ...s2, ...r.state }, progressAll: prog({ hanoi: { hn1a: 3 } }) });
  assert(again.state.streak === 1 && again.next.levelId === 'hn1b', '"jogar de novo" a mesma fase: o intervalo não anda e a sugestão é a mesma');
  const twice = D.pickNext({ ...base, settings: { ...settings(), ...D.pickNext({ ...base, settings: settings(), progressAll: prog({ hanoi: { hn1a: 3 } }) }).state }, rng: () => 0.01, progressAll: prog({ hanoi: { hn1a: 3 } }) });
  const once = D.pickNext({ ...base, settings: settings(), progressAll: prog({ hanoi: { hn1a: 3 } }) });
  assert(twice.next.gameId === once.next.gameId && twice.next.levelId === once.next.levelId, 'pedido repetido (duplo clique): a mesma sugestão, mesmo com outro sorteio');

  // jogo atual fora da escolha: troca na hora
  r = D.pickNext({ ...base, settings: settings({ interval: 5, games: ['carrinhos', 'memoria'] }), progressAll: prog({ hanoi: { hn1a: 3 } }) });
  assert(r.reason === 'TROCA' && ['carrinhos', 'memoria'].includes(r.next.gameId), 'jogo fora da escolha: vai direto para um dos escolhidos');

  // os recentes perdem a vez quando há outro
  const three = settings({ games: ['hanoi', 'carrinhos', 'memoria', 'labirinto'], recent: ['carrinhos', 'memoria'] });
  const seen = new Set();
  for (const x of [0, 0.3, 0.6, 0.99]) seen.add(D.pickNext({ ...base, rng: () => x, settings: three, progressAll: prog({ hanoi: { hn1a: 3 } }) }).next.gameId);
  assert(seen.size === 1 && seen.has('labirinto'), `não repete os jogos recentes quando há alternativa (${[...seen]})`);

  // sem fase da mesma dificuldade no outro jogo: cai para ± 1
  const t1 = L('carrinhos').LEVELS.filter((l) => tier('carrinhos', l.id) === 1);
  const allT1 = Object.fromEntries(t1.map((l) => [l.id, 3]));
  r = D.pickNext({ ...base, from: { gameId: 'hanoi', levelId: 'hn1a', stars: 1 }, settings: onlyCar, progressAll: prog({ hanoi: { hn1a: 1 }, carrinhos: allT1 }) });
  assert(r.next.gameId === 'carrinhos' && r.next.tier === 2, `sem fase do mesmo tier: o tier vizinho (${r.next.tier})`);

  // só sobrou fase nova no jogo atual
  const allCar = Object.fromEntries(L('carrinhos').LEVELS.map((l) => [l.id, 3]));
  r = D.pickNext({ ...base, settings: onlyCar, progressAll: prog({ hanoi: { hn1a: 3 }, carrinhos: allCar }) });
  assert(r.reason === 'SO_ESTE_JOGO' && r.next.gameId === 'hanoi' && r.next.levelId !== 'hn1a', 'o outro jogo acabou: segue com fase nova deste');

  // tudo jogado: oferece melhorar (< 3 ⭐); tudo com 3 ⭐: acabou
  const allHanoi = (stars) => Object.fromEntries(L('hanoi').LEVELS.map((l) => [l.id, stars]));
  const carOne2 = { ...allCar, [CarLevels.LEVELS[5].id]: 2 };
  r = D.pickNext({ ...base, settings: onlyCar, progressAll: prog({ hanoi: allHanoi(3), carrinhos: carOne2 }) });
  assert(r.reason === 'MELHORAR' && r.next.levelId === CarLevels.LEVELS[5].id, 'tudo jogado: sugere a fase com menos de 3 ⭐');
  r = D.pickNext({ ...base, settings: onlyCar, progressAll: prog({ hanoi: allHanoi(3), carrinhos: allCar }) });
  assert(r.reason === 'TUDO_COMPLETO' && r.next === null, 'tudo com 3 ⭐: next = null');

  assert(throwsCode(() => D.pickNext({ ...base, settings: settings(), from: { gameId: 'hanoi', levelId: 'xx' }, progressAll: {} }), 'FASE_INVALIDA')
    && throwsCode(() => D.pickNext({ ...base, settings: settings(), from: { gameId: 'bingo', levelId: 'x' }, progressAll: {} }), 'FASE_INVALIDA'),
  'fase ou jogo que não existe no catálogo: erro');

  // tablet sem teclado: nunca sugere jogo de digitação
  const kb = settings({ games: ['hanoi', 'digitacao', 'letras', 'carrinhos'] });
  const picks = new Set();
  for (const x of [0, 0.3, 0.6, 0.99]) picks.add(D.pickNext({ ...base, rng: () => x, settings: kb, from: { ...from, noKeyboard: true }, progressAll: prog({ hanoi: { hn1a: 3 } }) }).next.gameId);
  assert(picks.size === 1 && picks.has('carrinhos'), `sem teclado: só jogos que não precisam dele (${[...picks]})`);

  // fases bloqueadas (Teclado Mágico com a trilha ligada) não são sugeridas
  const Typing = L('digitacao');
  if (!Typing.ALL_UNLOCKED) {
    r = D.pickNext({ ...base, settings: settings({ games: ['hanoi', 'digitacao'] }), progressAll: prog({ hanoi: { hn1a: 3 } }) });
    assert(Typing.isUnlocked(null, r.next.levelId), 'nunca sugere fase bloqueada');
  }
}

async function checkRoutes() {
  const srv = await startTestServer(4391);
  const { api } = srv;
  try {
    const ana = await srv.student('Ana Dinâmica');
    let r = await api('GET', '/api/dinamico', null, ana);
    assert(r.ok && r.settings.on === false && r.settings.games.length === 18 && r.settings.interval === 1 && r.catalog.length === 18,
      'GET /api/dinamico: desligado, todos os jogos e intervalo 1 por padrão');
    assert((await api('GET', '/api/dinamico')).status === 401, 'sem login: 401');

    r = await api('POST', '/api/dinamico', { on: true, games: ['hanoi'] }, ana);
    assert(!r.ok && r.code === 'POUCOS_JOGOS', 'ligar com 1 jogo só: recusado');
    r = await api('POST', '/api/dinamico', { on: true, games: ['hanoi', 'bingo'] }, ana);
    assert(!r.ok && r.code === 'JOGO_INVALIDO', 'jogo de turma: recusado');
    r = await api('POST', '/api/dinamico', { on: true, interval: 0 }, ana);
    assert(!r.ok && r.code === 'INTERVALO_INVALIDO', 'intervalo 0: recusado');
    r = await api('POST', '/api/dinamico', { on: 'sim' }, ana);
    assert(!r.ok && r.code === 'CONFIG_INVALIDA', 'on que não é verdadeiro/falso: recusado');
    r = await api('POST', '/api/dinamico', { on: true, games: ['hanoi', 'carrinhos', 'hanoi'], interval: 1 }, ana);
    assert(r.ok && r.settings.on && r.settings.games.join() === 'hanoi,carrinhos' && r.settings.interval === 1 && !('streak' in r.settings),
      'salva a configuração (sem repetir jogos e sem mostrar o andamento)');
    r = await api('GET', '/api/dinamico', null, ana);
    assert(r.settings.on && r.settings.games.length === 2, 'a configuração fica guardada no servidor');

    // sem concluir: nada
    r = await api('POST', '/api/dinamico/proxima', { gameId: 'hanoi', levelId: 'hn1a', stars: 3 }, ana);
    assert(r.ok && r.next === null && r.reason === 'NAO_CONCLUIU', 'pedir a próxima sem ter concluído a fase (o servidor confere o progresso)');

    // conclui Hanói 3 discos de verdade
    const hl = HanoiLevels.getLevel('hn1a');
    const g = H.setup(hl, 3);
    let pos = g.start.slice();
    const moves = [];
    while (!H.same(pos, g.goal)) { const m = H.hint(pos, g.goal, g.pegs); moves.push(m); pos = H.apply(pos, m); }
    r = await api('POST', '/api/progress/hanoi/results', { levelId: hl.id, seed: 3, moves, durationMs: 20000, attemptId: 'din-ana-0001' }, ana);
    assert(r.ok && r.result.stars === 3, 'Hanói 3 discos concluído');

    // a 1ª fase de dificuldade 1 do Carrinhos já foi jogada no modo livre
    const lv = CarLevels.LEVELS[0];
    r = await api('POST', '/api/progress/carrinhos/results', { levelId: lv.id, seed: 1, moves: T.solve(T.parse(lv.board)), hints: 0, durationMs: 30000, attemptId: 'din-ana-0002' }, ana);
    assert(r.ok && r.result.stars >= 1, 'Carrinhos fase 1 jogada no modo livre');

    r = await api('POST', '/api/dinamico/proxima', { gameId: 'hanoi', levelId: 'hn1a', stars: 3 }, ana);
    const expected = CarLevels.LEVELS.find((l) => l.id !== lv.id && tier('carrinhos', l.id) === tier('hanoi', 'hn1a'));
    assert(r.ok && r.reason === 'TROCA' && r.next.gameId === 'carrinhos' && r.next.levelId === expected.id && r.next.gameName === 'Carrinhos' && r.next.number === expected.index + 1,
      `depois do Hanói: Carrinhos, pulando a fase já jogada (${r.next && r.next.levelId})`);
    const again = await api('POST', '/api/dinamico/proxima', { gameId: 'hanoi', levelId: 'hn1a', stars: 3 }, ana);
    assert(again.ok && again.next.levelId === r.next.levelId, 'o mesmo pedido de novo: a mesma sugestão');

    // '_dinamico' não aparece no painel, nos pontos nem na área do professor
    r = await api('GET', '/api/progress', null, ana);
    assert(r.ok && !('_dinamico' in r.summaries), 'o painel não mostra a configuração como jogo');
    r = await api('GET', '/api/me/points', null, ana);
    assert(r.ok && r.games.every((x) => x.gameId !== '_dinamico'), 'os pontos ignoram a configuração');
    r = await api('GET', '/api/progress/_dinamico', null, ana);
    assert(r.status === 404, 'a configuração não é lida como progresso de jogo');

    // desligar
    r = await api('POST', '/api/dinamico', { on: false }, ana);
    r = await api('POST', '/api/dinamico/proxima', { gameId: 'hanoi', levelId: 'hn1a', stars: 3 }, ana);
    assert(r.ok && r.next === null && r.reason === 'DESLIGADO', 'desligado: nenhuma sugestão');
    r = await api('POST', '/api/dinamico/proxima', { gameId: 'bingo', levelId: 'x' }, await srv.student('Bia Dinâmica'));
    assert(r.ok && r.reason === 'DESLIGADO', 'outra criança começa com o modo desligado');
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkCatalog();
    checkPick();
    await checkRoutes();
  } catch (e) {
    errors.push(`exceção: ${e.stack || e}`);
  }
  try { require('../src/platform/db').db.close(); } catch (e) { /* ignore */ }
  for (const s of ['', '-wal', '-shm']) { try { fs.rmSync(DB + s, { force: true }); } catch (e) { /* ignore */ } }
  if (errors.length) {
    console.error(`\n${errors.length} FALHA(S):`);
    errors.forEach((e) => console.error(' ✗', e));
    process.exit(1);
  }
  console.log('\nModo Dinâmico: tudo certo ✅');
  process.exit(0);
})();
