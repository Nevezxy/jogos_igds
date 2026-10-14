// test/tabuleiro.test.js
// Jogos de tabuleiro: regras da Velha e do Ligue 4, o robô (o perfeito da
// Velha nunca perde, ganha quando pode, bloqueia), o servidor conferindo as
// partidas contra o robô e a partida pela rede (código de sala, pareamento,
// vez, lance inválido, empate, desistência, queda e volta, abandono).

const os = require('os');
const path = require('path');
const fs = require('fs');

// banco temporário só deste teste (antes de carregar a plataforma)
const DB = path.join(os.tmpdir(), `igds-tabuleiro-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILE = DB;

const Bot = require('../public/js/shared/bot.js');
const Velha = require('../public/games/velha/rules.js');
const VelhaLevels = require('../public/games/velha/levels.js');
const Ligue = require('../public/games/ligue4/rules.js');
const LigueLevels = require('../public/games/ligue4/levels.js');
const registry = require('../src/games/registry');
const accounts = require('../src/platform/accounts');
const progress = require('../src/platform/progress');
const { createMatchManager } = require('../src/platform/match');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const throws = (fn) => { try { fn(); return null; } catch (e) { return e; } };
const playAll = (R, v, moves) => moves.reduce((s, m) => R.play(s, m), R.initial(v));

function checkRules() {
  // Velha
  let s = playAll(Velha, '3x3', [0, 3, 1, 4, 2]);
  assert(s.result && s.result.winner === 0 && s.result.line.join() === '0,1,2', 'velha: 3 em linha deitado ganha');
  s = playAll(Velha, '3x3', [2, 0, 4, 1, 6]);
  assert(s.result && s.result.winner === 0, 'velha: diagonal ganha');
  s = playAll(Velha, '3x3', [0, 1, 2, 4, 3, 5, 7, 6, 8]);
  assert(s.result && s.result.winner === null, 'velha: tabuleiro cheio sem linha = velha (empate)');
  assert(throws(() => Velha.play(Velha.play(Velha.initial('3x3'), 4), 4)), 'velha: casa ocupada não vale');
  s = playAll(Velha, '4x4', [0, 4, 1, 5, 2, 6, 3]);
  assert(s.result && s.result.winner === 0, 'velha 4 × 4: 4 em linha ganha');
  s = playAll(Velha, '4x4', [0, 4, 1, 5, 2]);
  assert(!s.result, 'velha 4 × 4: 3 em linha ainda não ganha');

  // Ligue 4
  s = playAll(Ligue, '4', [0, 6, 1, 6, 2, 6, 3]);
  assert(s.result && s.result.winner === 0, 'ligue 4: 4 deitado ganha');
  s = playAll(Ligue, '4', [0, 1, 0, 1, 0, 1, 0]);
  assert(s.result && s.result.winner === 0, 'ligue 4: 4 em pé ganha');
  s = playAll(Ligue, '4', [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
  assert(s.result && s.result.winner === 0, 'ligue 4: diagonal subindo ganha');
  s = playAll(Ligue, '4', [6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
  assert(s.result && s.result.winner === 0, 'ligue 4: diagonal descendo ganha');
  let full = Ligue.initial('4');
  for (let i = 0; i < 6; i++) full = Ligue.play(full, 0);
  assert(!Ligue.isLegal(full, 0) && Ligue.moves(full).length === 6, 'ligue 4: coluna cheia não aceita peça');
  s = playAll(Ligue, '5', [0, 8, 1, 8, 2, 8, 3, 8]);
  assert(!s.result, 'ligue 5: 4 em linha ainda não ganha');
  s = Ligue.play(s, 4);
  assert(s.result && s.result.winner === 0, 'ligue 5: 5 em linha ganha');
  s = playAll(Ligue, '4', [0, 6, 1, 6, 2]);
  assert(Ligue.threats(s, 0).includes(3), 'ligue 4: a ajuda mostra a ameaça de ganhar');
}

function checkBot() {
  // o robô perfeito da Velha nunca perde
  let lost = 0;
  for (let g = 0; g < 40; g++) {
    let s = Velha.initial('3x3');
    const perfect = g % 2;
    while (!s.result) s = Velha.play(s, Bot.search(Velha, s, s.turn === perfect ? { depth: 9 } : { depth: 0 }).move);
    if (s.result.winner === 1 - perfect) lost++;
  }
  assert(lost === 0, 'velha: o robô imbatível nunca perde (40 partidas contra o robô ao acaso)');
  let s = Velha.initial('3x3');
  while (!s.result) s = Velha.play(s, Bot.search(Velha, s, { depth: 9 }).move);
  assert(s.result.winner === null, 'velha: imbatível contra imbatível dá velha');
  s = playAll(Velha, '3x3', [0, 3, 1, 4]);
  assert(Bot.search(Velha, s, { depth: 1 }).move === 2, 'robô espertinho completa a linha');
  s = playAll(Velha, '3x3', [0, 4, 1]);
  assert(Bot.search(Velha, s, { depth: 2 }).move === 2, 'robô atento bloqueia');
  s = playAll(Ligue, '4', [0, 6, 0, 6, 0]);
  assert(Bot.search(Ligue, s, { depth: 2 }).move === 0, 'ligue 4: o robô bloqueia a coluna');
  const t = Date.now();
  const r = Bot.search(Ligue, Ligue.initial('4'), { depth: 8, maxMs: 1000 });
  assert(Ligue.isLegal(Ligue.initial('4'), r.move) && Date.now() - t < 1600, `ligue 4: o robô mais forte respeita o tempo (${Date.now() - t} ms)`);
  assert(VelhaLevels.LEVELS.every((l) => l.bot) && LigueLevels.LEVELS.length >= 10, 'fases dos robôs');
}

// lances de uma partida inteira entre dois robôs
function gameMoves(R, v, levels) {
  let s = R.initial(v);
  const moves = [];
  while (!s.result) {
    const m = Bot.search(R, s, levels[s.turn]).move;
    moves.push(m);
    s = R.play(s, m);
  }
  return { moves, result: s.result };
}

async function checkServer() {
  const srv = await startTestServer(3111);
  const { api } = srv;
  try {
    const kid = await srv.student('Davi Rocha');
    // vitória da criança (lado 0) contra o robô bobinho
    const win = playAll(Velha, '3x3', [0, 3, 1, 4, 2]);
    const send = (body) => api('POST', '/api/progress/velha/results', { levelId: 'v3a', seat: 0, moves: [0, 3, 1, 4, 2], undos: 0, durationMs: 20000, ...body }, kid);
    let r = await send({});
    assert(win.result.winner === 0 && r.ok && r.result.stars === 3, 'venceu sem desfazer = 3 estrelas');
    r = await send({ undos: 2 });
    assert(r.ok && r.result.stars === 2, 'venceu desfazendo = 2 estrelas');
    r = await send({ levelId: 'v3c', undos: 1 });
    assert(r.code === 'RESULTADO_INVALIDO', 'desfazer onde não pode é recusado');
    r = await send({ moves: [0, 0] });
    assert(r.code === 'RESULTADO_INVALIDO', 'lance inválido é recusado');
    r = await send({ moves: [0, 3, 1] });
    assert(r.code === 'RESULTADO_INVALIDO', 'partida que não acabou é recusada');
    r = await send({ durationMs: 100 });
    assert(r.code === 'RESULTADO_INVALIDO', 'partida rápida demais é recusada');
    r = await send({ moves: [0, 3, 1], resigned: true });
    assert(r.ok && r.result.stars === 0, 'desistiu = derrota');
    const draw = gameMoves(Velha, '3x3', [{ depth: 9 }, { depth: 9 }]);
    r = await send({ levelId: 'v3d', moves: draw.moves });
    assert(r.ok && r.result.stars === 3, 'empatar com o imbatível vale 3 estrelas');
    r = await send({ levelId: 'v3c', moves: draw.moves });
    assert(r.ok && r.result.stars === 1, 'empate comum vale 1 estrela');
    assert(r.progress.levels.v3a.wins === 2 && r.progress.levels.v3a.losses === 1, 'progresso guarda vitórias e derrotas por robô');
    const lg = gameMoves(Ligue, '4', [{ depth: 3 }, { depth: 0 }]);
    r = await api('POST', '/api/progress/ligue4/results', { levelId: 'l4a', seat: 0, moves: lg.moves, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === (lg.result.winner === 0 ? 3 : lg.result.winner === null ? 1 : 0), 'ligue 4: o servidor refaz a partida e dá as estrelas');

    r = await api('GET', '/api/progress', null, kid);
    assert(/⭐ \d+/.test(r.summaries.velha || ''), `cartão do painel ("${r.summaries.velha}")`);
    const t = (await api('POST', '/api/teacher/login', {})).token;
    r = await api('GET', '/api/teacher/students', null, { teacher: t });
    const row = r.students.find((s) => s.name === 'Davi Rocha').games.velha;
    assert(row && row.best && row.vsBot.wins >= 2 && row.totalLevels === VelhaLevels.LEVELS.length, 'área do professor: robô mais forte vencido e placar');
    const games = (await api('GET', '/api/games')).games;
    assert(games.filter((g) => g.subject === 'tabuleiro').map((g) => g.id).join() === 'velha,ligue4', 'Velha e Ligue 4 na seção ♟️ Tabuleiro');
  } finally {
    await srv.stop();
  }
}

// partida pela rede, com sockets de mentira
function checkMatch() {
  let clock = 1000;
  const sent = [];
  // "io" de mentira: guarda o que seria mandado para cada socket
  const fakeIo = { to: (id) => ({ emit: (ev, data) => sent.push({ id, ev, data }) }), sockets: { sockets: new Map() }, on() {} };
  const sock = (id) => ({ id, join() {} });
  const lastFor = (id) => [...sent].reverse().find((x) => x.id === id && x.ev === 'bg:state');
  const make = (name, turma) => accounts.register(`${name}${turma ? ` ${turma}` : ''}`, '🐶').token;

  const tokA = make('Ana Lima', '5A');
  const tokB = make('Beto Reis', '5A');
  const tokC = make('Caio Dias', '4B');
  const tokD = make('Duda Melo', '5A');
  const mm2 = createMatchManager(registry, { now: () => clock, reconnectMs: 50, sameClassWaitMs: 5000 });
  mm2.register(fakeIo); // o relógio da fila usa unref: não segura o teste

  const a = sock('sa'); const b = sock('sb'); const c = sock('sc'); const d = sock('sd');
  // código de sala
  const room = mm2.actions.create(a, { game: 'velha', variant: '3x3', studentToken: tokA });
  assert(/^[A-Z]{4}$/.test(room.code), `sala com código de 4 letras (${room.code})`);
  assert(throws(() => mm2.actions.join(sock('sa2'), { code: room.code, studentToken: tokA })).code === 'MESMA_CONTA', 'não dá para entrar na própria sala');
  assert(throws(() => mm2.actions.join(b, { code: 'ZZZZ', studentToken: tokB })).code === 'SALA_NAO_ENCONTRADA', 'código errado é recusado');
  mm2.actions.join(b, { code: room.code.toLowerCase(), studentToken: tokB });
  let va = lastFor('sa').data;
  const vb = lastFor('sb').data;
  assert(va.status === 'playing' && va.you !== vb.you && va.players.every(Boolean), 'entrou pelo código: a partida começa, um de cada lado');
  const first = va.you === 0 ? { s: a, id: 'sa' } : { s: b, id: 'sb' };
  const second = va.you === 0 ? { s: b, id: 'sb' } : { s: a, id: 'sa' };
  const matchId = va.matchId;
  assert(throws(() => mm2.actions.move(second.s, { matchId, move: 4 })).code === 'NAO_E_SUA_VEZ', 'lance fora da vez é recusado');
  mm2.actions.move(first.s, { matchId, move: 4 });
  assert(throws(() => mm2.actions.move(second.s, { matchId, move: 4 })).code === 'LANCE_INVALIDO', 'lance inválido é recusado pelo servidor');
  // primeiro joga 0,1,2 e ganha
  mm2.actions.move(second.s, { matchId, move: 3 });
  mm2.actions.move(first.s, { matchId, move: 0 });
  mm2.actions.move(second.s, { matchId, move: 5 });
  mm2.actions.move(first.s, { matchId, move: 8 });
  va = lastFor(first.id).data;
  assert(va.status === 'ended' && va.result.winner === va.you && va.result.reason === 'fim', 'a partida acaba com a vitória de quem fez 3 em linha');
  const winnerId = (first.id === 'sa' ? accounts.authenticate(tokA) : accounts.authenticate(tokB)).id;
  const pw = progress.getProgress(winnerId, 'velha');
  assert(pw && pw.friend.wins === 1 && !Object.keys(pw.levels).length, 'resultado contra amigo vai para o placar, sem estrela');

  // pareamento: mesma turma primeiro
  sent.length = 0;
  mm2.actions.queue(c, { game: 'ligue4', variant: '4', studentToken: tokC }); // 4B
  mm2.actions.queue(a, { game: 'ligue4', variant: '4', studentToken: tokA }); // 5A
  assert(!lastFor('sa') && !lastFor('sc'), 'turmas diferentes não se juntam na hora');
  mm2.actions.queue(d, { game: 'ligue4', variant: '4', studentToken: tokD }); // 5A
  const vd = lastFor('sd');
  assert(vd && lastFor('sa') && lastFor('sa').data.matchId === vd.data.matchId && !lastFor('sc'), 'pareamento junta primeiro quem é da mesma turma');
  clock += 6000;
  mm2.actions.queue(b, { game: 'ligue4', variant: '4', studentToken: tokB });
  mm2.pairQueue();
  assert(lastFor('sc') && lastFor('sb') && lastFor('sc').data.matchId === lastFor('sb').data.matchId, 'depois de esperar um pouco, junta com qualquer um');
  mm2.actions.queue(sock('se'), { game: 'velha', variant: '3x3', studentToken: tokA });
  mm2.actions.cancel(sock('se'));
  assert(!mm2.queue.some((q) => q.socketId === 'se'), 'cancelar tira da fila');

  // empate combinado e desistência
  const lig = lastFor('sd').data;
  mm2.actions.drawOffer(d, { matchId: lig.matchId });
  assert(throws(() => mm2.actions.drawAnswer(d, { matchId: lig.matchId, accept: true })).code === 'SEM_PROPOSTA', 'quem propôs não aceita a própria proposta');
  mm2.actions.drawAnswer(a, { matchId: lig.matchId, accept: true });
  assert(lastFor('sd').data.result.winner === null && lastFor('sd').data.result.reason === 'acordo', 'empate combinado');
  const cb = lastFor('sc').data;
  mm2.actions.resign(c, { matchId: cb.matchId });
  assert(lastFor('sb').data.result.winner === lastFor('sb').data.you && lastFor('sb').data.result.reason === 'desistiu', 'quem desiste perde');

  // queda e volta; e abandono
  return new Promise((resolve) => {
    const x = sock('sx'); const y = sock('sy');
    const r2 = mm2.actions.create(x, { game: 'velha', variant: '3x3', studentToken: tokB });
    mm2.actions.join(y, { code: r2.code, studentToken: tokC });
    const id2 = lastFor('sx').data.matchId;
    mm2.actions.disconnect(x);
    assert(lastFor('sy').data.players.some((p) => p.connected === false), 'o outro fica sabendo que a conexão caiu');
    const x2 = sock('sx2');
    mm2.actions.rejoin(x2, { matchId: id2, studentToken: tokB });
    assert(lastFor('sx2').data.status === 'playing', 'voltou a tempo: a partida continua');
    mm2.actions.disconnect(y);
    setTimeout(() => {
      const v = lastFor('sx2').data;
      assert(v.status === 'ended' && v.result.reason === 'abandono' && v.result.winner === v.you, 'não voltou a tempo: o outro vence por abandono');
      resolve();
    }, 120);
  });
}

(async () => {
  try {
    checkRules();
    checkBot();
    await checkMatch();
    await checkServer();
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    process.exit(1);
  }
  try { require('../src/platform/db').db.close(); } catch (e) { /* ignore */ }
  for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(DB + suffix, { force: true }); } catch (e) { /* o Windows às vezes segura o arquivo */ } }
  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
})();
