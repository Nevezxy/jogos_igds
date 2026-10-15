// test/maratona-carga.test.js
// 🏃 Teste de carga da Maratona: N crianças (padrão 40) no Solo, então N/2
// confrontos na mesma rodada, todas mandando o resultado quase juntas (o
// servidor valida cada uma pelo jogo, grava no banco e manda o estado para
// todo mundo). Mede quanto tempo cada resposta leva e quanto o estado leva
// para chegar a todos depois da apuração. 2 rodadas.
// Sobe o próprio servidor: node test/maratona-carga.test.js [quantidade]

const { io } = require('socket.io-client');
const T = require('../public/games/carrinhos/traffic.js');
const CarLevels = require('../public/games/carrinhos/levels.js');
const { startTestServer } = require('./helpers');

const KIDS = Number(process.argv[2]) || 40;
const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fabio', 'Gabi', 'Heitor', 'Iris', 'Joana'];
const LAST = ['Souza', 'Lima', 'Rocha', 'Alves', 'Costa', 'Melo', 'Dias', 'Prado', 'Reis', 'Nunes'];
const kidName = (i) => `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
const AV = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐧'];
const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const pct = (list, p) => list.slice().sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * p))];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(url) {
  const s = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.last = null;
  s.on('mt:state', (st) => { s.last = st; s.lastAt = Date.now(); });
  s.call = (ev, p) => new Promise((res) => s.emit(ev, p, (r) => res(r || { ok: false })));
  s.ready = new Promise((r) => s.on('connect', r));
  return s;
}
const until = async (pred, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred()) return true; await sleep(25); } return false; };

(async () => {
  const srv = await startTestServer(3122);
  const all = [];
  try {
    const tokens = await Promise.all(Array.from({ length: KIDS }, (_, i) => srv.student(kidName(i), AV[i % AV.length])));
    const t = await srv.api('POST', '/api/teacher/login', { pin: '' });
    const prof = client(srv.url); all.push(prof); await prof.ready;
    const c = await prof.call('mt:create', { teacherToken: t.token, name: 'Carga', config: { games: ['carrinhos'], formato: 'solo', nivel: 2, rotacao: 'sequencial', rodadas: 2, tempoMin: 5 } });
    const { code, masterToken } = c;
    const kids = tokens.map(() => client(srv.url));
    all.push(...kids);
    await Promise.all(kids.map((k) => k.ready));
    const t0 = Date.now();
    const joins = await Promise.all(kids.map((k, i) => k.call('mt:join', { code, studentToken: tokens[i] })));
    assert(joins.every((j) => j.ok), `${KIDS} crianças entraram em ${Date.now() - t0} ms`);
    assert(await until(() => prof.last && prof.last.waiting.length === KIDS && prof.last.waiting.every((w) => w.online)), 'o professor vê todas conectadas');

    let started = await prof.call('mt:start', { code, masterToken });
    assert(started.ok, 'começou');
    for (let round = 1; round <= 2; round++) {
      if (round === 2) started = await prof.call('mt:next', { code, masterToken });
      assert(await until(() => kids.every((k) => k.last && k.last.round && k.last.round.number === round && k.last.play)), `rodada ${round}: as ${KIDS} crianças receberam a fase`);
      const matches = prof.last.round.matches.length;
      const lv = CarLevels.getLevel(kids[0].last.play.levelId);
      const moves = T.solve(T.parse(lv.board));
      // todas mandam quase juntas
      const lat = [];
      const sent = Date.now();
      const res = await Promise.all(kids.map(async (k, i) => {
        const a = Date.now();
        const r = await k.call('mt:result', { code, body: { moves, hints: i % 4 === 0 ? 1 : 0, durationMs: 60000 } });
        lat.push(Date.now() - a);
        return r;
      }));
      const okCount = res.filter((r) => r.ok).length;
      assert(okCount === KIDS, `rodada ${round}: ${okCount}/${KIDS} resultados aceitos (${matches} confrontos ao mesmo tempo)`);
      const target = round === 2 ? 'encerrada' : 'entre_rodadas';
      const reached = await until(() => kids.every((k) => k.last && k.last.status === target));
      const spread = Math.max(...kids.map((k) => k.lastAt)) - sent;
      console.log(`   respostas: mediana ${pct(lat, 0.5)} ms · p95 ${pct(lat, 0.95)} ms · máx ${Math.max(...lat)} ms · todos com o estado novo em ${spread} ms`);
      assert(reached, `rodada ${round}: apurada e todos receberam a classificação`);
      assert(pct(lat, 0.95) < 2000, `rodada ${round}: 95% das respostas em menos de 2 s (${pct(lat, 0.95)} ms)`);
    }
    const fin = prof.last;
    assert(fin.final && fin.final.standings.length === KIDS, `fim: classificação com os ${KIDS} lados`);
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    errors.push(String(e && e.stack || e));
  } finally {
    all.forEach((s) => s.disconnect());
    await srv.stop();
  }
  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((x) => console.log(' -', x));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
})();
