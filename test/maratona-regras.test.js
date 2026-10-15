// test/maratona-regras.test.js
// 🏃 Modo Maratona, fase 8: os casos que ainda faltavam.
//   • formatos: Duas Equipes, Trio e Quarteto (tamanhos s ou s + 1, uma
//     rodada de corrida até o fim); rotação "ordem" e "professor escolhe"
//   • prazos: resultado depois do prazo + tolerância é recusado; o que chega
//     dentro da tolerância vale
//   • concorrência (servidor de verdade): o mesmo resultado mandado duas
//     vezes ao mesmo tempo grava uma vez só; dois "próxima rodada" ao mesmo
//     tempo abrem uma rodada só; o professor resolve enquanto chega um resultado
//   • permissões: votar e mandar resultado só na maratona em que entrou;
//     telão não comanda; configuração travada depois de começar

const os = require('os');
const path = require('path');
const fs = require('fs');

const DB = path.join(os.tmpdir(), `igds-regras-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILE = DB;

const { io } = require('socket.io-client');
const registry = require('../src/games/registry');
const accounts = require('../src/platform/accounts');
const { db } = require('../src/platform/db');
const { createMarathonManager, PREP_MS, GRACE_MS } = require('../src/marathon/manager');
const T = require('../public/games/carrinhos/traffic.js');
const CarLevels = require('../public/games/carrinhos/levels.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const throwsCode = (fn) => { try { fn(); return null; } catch (e) { return e.code || e.message; } };
const carBody = (levelId, hints = 0) => ({ moves: T.solve(T.parse(CarLevels.getLevel(levelId).board)), hints, durationMs: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function checkFormats() {
  let t = 2_000_000_000;
  const M = createMarathonManager(registry, { now: () => t });
  const kids = Array.from({ length: 9 }, (_, i) => {
    const r = accounts.register(`Regra ${'ABCDEFGHI'[i]}lvares`, '🐶');
    return accounts.authenticate(r.token);
  });
  // corrida até o fim numa rodada, todos jogando perfeito
  const playRound = (code) => {
    const m = M.get(code);
    const r = m.rounds[m.rounds.length - 1];
    t = r.startsAt + 1000;
    M.checkTimers();
    for (const e of m.entries.filter((x) => x.roundId === r.id && x.status === 'escalado')) M.submit(code, e.studentId, carBody(r.levelId));
    return M.load(code) || M.get(code);
  };
  for (const [formato, n, sizes] of [['duas', 7, '3,4'], ['trio', 9, '3,3,3'], ['quarteto', 9, '4,5']]) {
    const { code, masterToken } = M.create({ games: ['carrinhos'], formato, nivel: 1, rotacao: 'sequencial', rodadas: 1 });
    kids.slice(0, n).forEach((k) => M.join(code, k));
    M.start(code, masterToken);
    const v = M.viewOf(code, { role: 'professor' });
    const got = v.teams.map((x) => x.members.length).sort().join();
    assert(got === sizes, `${formato} com ${n}: equipes de ${got}`);
    const end = playRound(code);
    assert(end.status === 'encerrada' && end.state.final.standings.length === v.teams.length, `${formato}: uma rodada de corrida até o pódio`);
  }
  // ordem do professor
  const ord = M.create({ games: ['carrinhos', 'hanoi'], formato: 'solo', nivel: 1, rotacao: 'ordem', ordem: ['hanoi', 'hanoi', 'carrinhos'], rodadas: 3 });
  kids.slice(0, 2).forEach((k) => M.join(ord.code, k));
  M.start(ord.code, ord.masterToken);
  const games = [M.get(ord.code).rounds[0].gameId];
  for (let i = 0; i < 2; i++) {
    const r = M.get(ord.code).rounds[M.get(ord.code).rounds.length - 1];
    t = r.deadlineAt + 1; M.checkTimers();
    M.nextRound(ord.code, ord.masterToken);
    games.push(M.get(ord.code).rounds[M.get(ord.code).rounds.length - 1].gameId);
  }
  assert(games.join() === 'hanoi,hanoi,carrinhos', `rotação "ordem": segue a lista do professor (${games.join(', ')})`);
  // professor escolhe
  const prof = M.create({ games: ['carrinhos', 'hanoi'], formato: 'solo', nivel: 1, rotacao: 'professor', rodadas: 2 });
  kids.slice(0, 2).forEach((k) => M.join(prof.code, k));
  assert(throwsCode(() => M.start(prof.code, prof.masterToken)) === 'ESCOLHA_O_JOGO', '"professor escolhe": sem escolher o jogo não começa');
  M.start(prof.code, prof.masterToken, { gameId: 'hanoi' });
  assert(M.get(prof.code).rounds[0].gameId === 'hanoi' && M.get(prof.code).status === 'preparando', '"professor escolhe": a rodada é do jogo escolhido');
  assert(throwsCode(() => M.start(prof.code, prof.masterToken, { gameId: 'hanoi' })) === 'JA_COMECOU', 'começar duas vezes: recusado');

  // prazo e tolerância
  const late = M.create({ games: ['carrinhos'], formato: 'solo', nivel: 1, rotacao: 'sequencial', rodadas: 2 });
  kids.slice(0, 2).forEach((k) => M.join(late.code, k));
  M.start(late.code, late.masterToken);
  const r = M.get(late.code).rounds[0];
  t = r.startsAt + 1; M.checkTimers();
  t = r.deadlineAt + GRACE_MS - 100; // no prazo + tolerância (o relógio ainda não apurou)
  const ok = M.submit(late.code, kids[0].id, carBody(r.levelId));
  assert(ok.entry.status === 'concluida', 'resultado que chega na tolerância depois do prazo ainda vale');
  t = r.deadlineAt + GRACE_MS + 100;
  assert(throwsCode(() => M.submit(late.code, kids[1].id, carBody(r.levelId))) === 'FORA_DO_TEMPO', 'resultado depois do prazo + tolerância: recusado');
  M.checkTimers();
  assert(M.get(late.code).status === 'entre_rodadas', 'no prazo a rodada é apurada');
  const after = throwsCode(() => M.submit(late.code, kids[1].id, carBody(r.levelId)));
  assert(['ENTRADA_FECHADA', 'FORA_DO_TEMPO'].includes(after), `rodada apurada não aceita mais nada (${after})`);
  void PREP_MS;
}

function client(url) {
  const s = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.last = null;
  s.on('mt:state', (st) => { s.last = st; });
  s.call = (ev, p) => new Promise((res) => s.emit(ev, p, (r) => res(r || { ok: false })));
  s.ready = new Promise((r) => s.on('connect', r));
  return s;
}
const until = async (pred, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred()) return true; await sleep(25); } return false; };

async function checkSockets() {
  const srv = await startTestServer(3123);
  const all = [];
  try {
    const t = await srv.api('POST', '/api/teacher/login', { pin: '' });
    const tok = [];
    for (const n of ['Lia Concorrencia', 'Mia Concorrencia', 'Noa Concorrencia']) tok.push(await srv.student(n));
    const prof = client(srv.url); all.push(prof); await prof.ready;
    // (cada socket acompanha uma maratona só: a outra é criada por outro professor)
    const prof2 = client(srv.url); all.push(prof2); await prof2.ready;
    const other = await prof2.call('mt:create', { teacherToken: t.token, config: { games: ['carrinhos'], formato: 'solo', nivel: 1, rotacao: 'sequencial', rodadas: 1 } });
    const a = await prof.call('mt:create', { teacherToken: t.token, config: { games: ['carrinhos'], formato: 'solo', nivel: 1, rotacao: 'sequencial', rodadas: 3 } });
    const kids = tok.map(() => client(srv.url));
    all.push(...kids);
    await Promise.all(kids.map((k) => k.ready));
    for (let i = 0; i < 2; i++) await kids[i].call('mt:join', { code: a.code, studentToken: tok[i] });
    await kids[2].call('mt:join', { code: other.code, studentToken: tok[2] });
    // permissões
    let r = await kids[2].call('mt:vote', { code: a.code, gameId: 'carrinhos' });
    assert(!r.ok && r.code === 'ENTRE_NA_MARATONA', 'quem entrou em outra maratona não vota nesta');
    const tv = client(srv.url); all.push(tv); await tv.ready;
    await tv.call('mt:watch', { code: a.code });
    r = await tv.call('mt:next', { code: a.code, masterToken: 'x' });
    assert(!r.ok && r.code === 'NAO_AUTORIZADO', 'o telão não comanda');
    r = await prof.call('mt:start', { code: a.code, masterToken: a.masterToken });
    assert(r.ok, 'começou');
    r = await prof.call('mt:config', { code: a.code, masterToken: a.masterToken, config: { games: ['hanoi'] } });
    assert(!r.ok && r.code === 'CONFIG_TRAVADA', 'trocar os jogos depois de começar: travado');
    r = await kids[2].call('mt:result', { code: a.code, body: {} });
    assert(!r.ok && r.code === 'ENTRE_NA_MARATONA', 'quem é de outra maratona não manda resultado nesta');

    // o mesmo resultado duas vezes ao mesmo tempo
    await until(() => kids[0].last && kids[0].last.play);
    const body = carBody(kids[0].last.play.levelId);
    const [x1, x2] = await Promise.all([kids[0].call('mt:result', { code: a.code, body }), kids[0].call('mt:result', { code: a.code, body })]);
    assert(x1.ok && x2.ok && [x1.duplicate, x2.duplicate].filter(Boolean).length === 1, 'o mesmo resultado mandado duas vezes ao mesmo tempo: um vale, o outro é reconhecido');
    const n = await srv.api('GET', '/api/me/history?game=carrinhos', null, tok[0]);
    assert(n.ok && n.history.length === 1 && n.history[0].source === 'maratona', 'no progresso fica uma rodada só (origem "maratona")');

    // o professor resolve enquanto chega o resultado do outro
    const match = prof.last.round.matches.find((m) => m.sideB);
    const [rs, sub] = await Promise.all([
      prof.call('mt:resolve', { code: a.code, masterToken: a.masterToken, matchId: match.id, outcome: 'empate', motivo: 'teste' }),
      kids[1].call('mt:result', { code: a.code, body: carBody(kids[1].last.play.levelId) }),
    ]);
    assert(rs.ok && (sub.ok || ['ENTRADA_FECHADA', 'SEM_CORRIDA', 'FORA_DO_TEMPO'].includes(sub.code)), `professor resolve e resultado chegando juntos: os dois respondem sem erro inesperado (${sub.ok ? 'resultado aceito antes' : sub.code})`);
    await until(() => prof.last && prof.last.status === 'entre_rodadas');
    const outcome = prof.last.history[0].matches.find((m) => m.sideB).outcome;
    assert(['empate', 'a', 'b'].includes(outcome), `o confronto fica com um resultado só (${outcome})`);

    // dois "próxima rodada" ao mesmo tempo
    const [n1, n2] = await Promise.all([
      prof.call('mt:next', { code: a.code, masterToken: a.masterToken }),
      prof.call('mt:next', { code: a.code, masterToken: a.masterToken }),
    ]);
    await until(() => prof.last && prof.last.round && prof.last.round.number === 2);
    assert([n1, n2].filter((x) => x.ok).length === 1 && [n1, n2].some((x) => x.code === 'RODADA_EM_ANDAMENTO') && prof.last.round.number === 2, 'dois "próxima rodada" ao mesmo tempo: abre uma rodada só');
    const hist = await srv.api('GET', `/api/maratona/${a.code}`, null, tok[0]);
    assert(hist.ok && hist.state.round.number === 2, 'o estado salvo tem a rodada 2 (não a 3)');
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    errors.push(String(e && e.stack || e));
  } finally {
    all.forEach((s) => s.disconnect());
    await srv.stop();
  }
}

(async () => {
  try {
    checkFormats();
    await checkSockets();
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    errors.push(String(e && e.stack || e));
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
