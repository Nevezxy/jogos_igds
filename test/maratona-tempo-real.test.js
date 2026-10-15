// test/maratona-tempo-real.test.js
// 🏃 Modo Maratona, fase 5: o tempo real, com o servidor de verdade e
// sockets (professor, três educandos e o telão):
//   • criar (só com o token do professor), entrar com o código, presença
//     (conectado / caiu e voltou), o telão sem tokens
//   • permissões (só o dono comanda; só quem entrou vota e manda resultado)
//   • começar → cada um recebe a fase e a semente da sua rodada → mandar o
//     resultado (repetido = reconhecido) → apuração e fim para todos ao vivo
//   • reiniciar o servidor no meio da maratona (mesmo banco): o professor e
//     as crianças voltam e a maratona continua
//   • o resultado fica salvo (GET /api/maratona/:code e o histórico)

const { io } = require('socket.io-client');
const T = require('../public/games/carrinhos/traffic.js');
const CarLevels = require('../public/games/carrinhos/levels.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const PORT = 3119;

function client(url) {
  const s = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.states = [];
  s.on('mt:state', (st) => s.states.push(st));
  s.call = (event, payload = {}) => new Promise((resolve) => s.emit(event, payload, (res) => resolve(res || { ok: false })));
  s.ready = new Promise((res) => s.on('connect', res));
  // espera o próximo estado que satisfaz a condição (ou o último que já chegou)
  s.until = (pred, ms = 4000) => new Promise((resolve) => {
    const last = s.states[s.states.length - 1];
    if (last && pred(last)) { resolve(last); return; }
    const t = setTimeout(() => { s.off('mt:state', on); resolve(null); }, ms);
    function on(st) { if (pred(st)) { clearTimeout(t); s.off('mt:state', on); resolve(st); } }
    s.on('mt:state', on);
  });
  return s;
}
const bodyFor = (levelId) => ({ moves: T.solve(T.parse(CarLevels.getLevel(levelId).board)), hints: 0, durationMs: 60000 });

(async () => {
  let srv = await startTestServer(PORT);
  const sockets = [];
  const open = async () => { const s = client(srv.url); sockets.push(s); await s.ready; return s; };
  try {
    const t = await srv.api('POST', '/api/teacher/login', { pin: '' });
    const kids = [];
    for (const n of ['Ana', 'Bia', 'Caio']) kids.push(await srv.student(`${n} Tempo Real`));

    // ---------- criar ----------
    const prof = await open();
    let r = await prof.call('mt:create', { teacherToken: 'nao-vale', config: { games: ['carrinhos'] } });
    // sem PIN a área do professor é aberta: qualquer token vale; com PIN, testamos abaixo
    const cfg = { games: ['carrinhos'], formato: 'solo', nivel: 1, rotacao: 'sequencial', rodadas: 2 };
    r = await prof.call('mt:create', { teacherToken: t.token, config: cfg, name: 'Maratona ao vivo' });
    assert(r.ok && /^[A-Z]{4}$/.test(r.code) && r.masterToken && r.state.status === 'sala_de_espera', 'professor cria a maratona e recebe o código e a chave de dono');
    const { code, masterToken } = r;

    // ---------- entrar ----------
    const ks = [];
    for (const tok of kids) {
      const s = await open();
      const j = await s.call('mt:join', { code: code.toLowerCase(), studentToken: tok });
      ks.push(s);
      assert(j.ok && j.state.code === code, 'educando entra com o código (maiúscula ou minúscula)');
    }
    const st = await prof.until((x) => x.waiting.length === 3 && x.waiting.every((w) => w.online));
    assert(Boolean(st), 'o professor vê os 3 na sala de espera, conectados, ao vivo');
    const bad = await open();
    r = await bad.call('mt:join', { code, studentToken: 'token-falso' });
    assert(!r.ok && r.code === 'SESSAO_INVALIDA', 'sem conta válida não entra');
    r = await bad.call('mt:join', { code: 'ZZZZ', studentToken: kids[0] });
    assert(!r.ok && r.code === 'MARATONA_NAO_ENCONTRADA', 'código errado: maratona não encontrada');

    // ---------- telão ----------
    const tv = await open();
    r = await tv.call('mt:watch', { code });
    const raw = JSON.stringify(r.state);
    assert(r.ok && !raw.includes(masterToken) && !kids.some((k) => raw.includes(k)) && !raw.includes('"strength"') && r.state.waiting.length === 3, 'telão: vê a sala sem nenhum token (nem a força de cada um)');

    // ---------- permissões ----------
    r = await ks[0].call('mt:start', { code, masterToken: 'chave-errada' });
    assert(!r.ok && r.code === 'NAO_AUTORIZADO', 'educando não começa a maratona');
    r = await bad.call('mt:result', { code, body: {} });
    assert(!r.ok && r.code === 'ENTRE_NA_MARATONA', 'quem não entrou não manda resultado');

    // ---------- queda e volta ----------
    ks[2].disconnect();
    assert(Boolean(await prof.until((x) => x.waiting.some((w) => !w.online))), 'caiu: o professor vê desconectado');
    const back = await open();
    r = await back.call('mt:join', { code, studentToken: kids[2] });
    ks[2] = back;
    assert(r.ok && Boolean(await prof.until((x) => x.waiting.length === 3 && x.waiting.every((w) => w.online))), 'voltou: a mesma vaga, conectado de novo');

    // ---------- começar ----------
    r = await prof.call('mt:start', { code, masterToken });
    assert(r.ok, 'o dono começa');
    const mine = await Promise.all(ks.map((s) => s.until((x) => x.status === 'preparando')));
    const playing = mine.filter((x) => x && x.play);
    assert(playing.length === 2 && playing.every((x) => x.play.levelId && x.play.seed && x.play.kind === 'corrida') && mine.some((x) => !x.play), 'cada educando recebe a fase e a semente da rodada (com 3, um descansa)');
    assert(mine.every((x) => x.serverNow && x.round.startsAt > x.serverNow), 'o estado traz a hora do servidor e a largada (para a contagem)');
    const tvState = await tv.until((x) => x.status === 'preparando');
    assert(tvState && !tvState.play && !JSON.stringify(tvState).includes('"seed"'), 'o telão não recebe a semente');

    // ---------- resultados ----------
    const idx = mine.map((x, i) => (x.play ? i : -1)).filter((i) => i >= 0);
    r = await ks[idx[0]].call('mt:result', { code, body: bodyFor(mine[idx[0]].play.levelId) });
    assert(r.ok && r.entry.status === 'concluida' && r.entry.stars === 3, 'resultado validado: 3 ⭐');
    r = await ks[idx[0]].call('mt:result', { code, body: bodyFor(mine[idx[0]].play.levelId) });
    assert(r.ok && r.duplicate === true, 'o mesmo resultado de novo: reconhecido');
    r = await ks[idx[1]].call('mt:result', { code, body: { moves: [[0, 4]], durationMs: 60000 } });
    assert(!r.ok && r.code === 'RESULTADO_INVALIDO', 'jogada impossível: recusada');
    r = await ks[idx[1]].call('mt:result', { code, body: { ...bodyFor(mine[idx[1]].play.levelId), hints: 1 } });
    const after = await prof.until((x) => x.status === 'entre_rodadas');
    assert(r.ok && after && after.standings[0].pontos === 3 && after.history.length === 1, 'todos mandaram: a rodada é apurada e todos veem a classificação ao vivo');

    // ---------- reiniciar o servidor no meio ----------
    r = await prof.call('mt:next', { code, masterToken });
    const r2 = await ks[0].until((x) => x.round && x.round.number === 2);
    assert(r.ok && r2, 'rodada 2 aberta');
    const beforeStop = (await prof.until((x) => x.round && x.round.number === 2)).standings.map((x) => `${x.id}:${x.pontos}`).join();
    sockets.forEach((s) => s.disconnect());
    sockets.length = 0;
    const dbFile = srv.dbFile;
    await srv.stop({ keepDb: true });
    srv = await startTestServer(PORT, {}, { dbFile });
    const prof2 = await open();
    r = await prof2.call('mt:master', { code, masterToken });
    const afterRestart = r.ok ? r.state.standings.map((x) => `${x.id}:${x.pontos}`).join() : '';
    assert(r.ok && r.state.round.number === 2 && afterRestart === beforeStop, `servidor reiniciado: o professor volta com a chave e a maratona está como estava (${afterRestart || r.code})`);
    r = await prof2.call('mt:master', { code, masterToken: 'outra' });
    assert(!r.ok && r.code === 'NAO_AUTORIZADO', 'sem a chave certa não entra como dono');
    const again = [];
    for (const tok of kids) {
      const s = await open();
      const j = await s.call('mt:join', { code, studentToken: tok });
      again.push({ s, j });
    }
    const players = again.filter((x) => x.j.state.play);
    for (const { s, j } of players) await s.call('mt:result', { code, body: bodyFor(j.state.play.levelId) });
    const fin = await prof2.until((x) => x.status === 'encerrada');
    assert(fin && fin.final && fin.final.standings.length === 3, 'depois do reinício, as crianças voltam, terminam e a maratona encerra com o pódio');

    // ---------- resultado salvo ----------
    const h = await srv.api('GET', '/api/teacher/maratona/historico', null, { teacher: (await srv.api('POST', '/api/teacher/login', { pin: '' })).token });
    assert(h.ok && h.marathons.some((x) => x.code === code && x.status === 'encerrada' && x.winner), 'histórico de maratonas para o professor');
    const g = await srv.api('GET', `/api/maratona/${code}`, null, kids[0]);
    assert(g.ok && g.state.final && g.state.final.standings.length === 3, 'o resultado final continua disponível depois do fim');
    const late = await open();
    r = await late.call('mt:join', { code, studentToken: kids[1] });
    assert(r.ok && r.state.status === 'encerrada' && r.participant === null, 'entrar numa maratona encerrada: só para ver o resultado');
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    errors.push(String(e && e.stack || e));
  } finally {
    sockets.forEach((s) => s.disconnect());
    await srv.stop();
  }

  // com PIN: criar exige o token do professor
  const pinned = await startTestServer(PORT + 1, { PROFESSOR_PIN: '4321' });
  try {
    const s = client(pinned.url);
    await s.ready;
    const r = await s.call('mt:create', { teacherToken: 'nao-vale', config: { games: ['carrinhos'] } });
    assert(!r.ok && r.code === 'PROFESSOR_NAO_AUTORIZADO', 'com PIN: sem o token do professor não cria maratona');
    s.disconnect();
  } finally { await pinned.stop(); }

  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((x) => console.log(' -', x));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
})();
