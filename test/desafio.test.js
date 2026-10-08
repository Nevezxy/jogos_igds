// test/desafio.test.js
// Desafio de digitação: sala do professor (com PIN), entrada com a conta,
// texto igual para todos, teclas conferidas no servidor, teto de
// velocidade, fim automático da corrida, pódio, progresso e telão.

const { io } = require('socket.io-client');
const { startTestServer } = require('./helpers');

const PIN = '2468';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let srv;

function connect() {
  return io(srv.url, { transports: ['websocket'], forceNew: true });
}
const connected = (s) => new Promise((r) => s.on('connect', r));
const emit = (s, event, payload) => new Promise((resolve) => s.emit(event, payload, resolve));

async function main() {
  srv = await startTestServer(3106, { PROFESSOR_PIN: PIN });
  const errors = [];
  const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

  const teacherToken = (await srv.api('POST', '/api/teacher/login', { pin: PIN })).token;
  const master = connect();
  await connected(master);

  let r = await emit(master, 'dz:create', {});
  assert(!r.ok && r.code === 'PROFESSOR_NAO_AUTORIZADO', 'com PIN, só o professor cria a sala do desafio');
  r = await emit(master, 'dz:create', { teacherToken });
  assert(r.ok && r.roomCode && r.state.status === 'waiting', 'professor cria a sala');
  const { roomCode, masterToken } = r;
  const M = (event, extra = {}) => emit(master, event, { roomCode, masterToken, ...extra });

  // ---- configuração ----
  r = await M('dz:config', { config: { mode: 'voar' } });
  assert(r.code === 'CONFIG_INVALIDA', 'modo inválido é recusado');
  r = await M('dz:config', { config: { seconds: 45 } });
  assert(r.code === 'CONFIG_INVALIDA', 'tempo fora das opções é recusado');
  r = await M('dz:config', { config: { source: 'custom', customText: 'oi  sol\n mar' } });
  assert(r.ok && r.state.config.customText === 'oi sol mar', 'texto do professor é limpo (espaços e quebras de linha)');
  r = await emit(master, 'dz:config', { roomCode, masterToken: 'falso', config: {} });
  assert(r.code === 'NAO_AUTORIZADO', 'token de professor falso é recusado');

  // ---- crianças ----
  const kid = async (name) => {
    const token = await srv.student(name);
    const s = connect();
    await connected(s);
    const j = await emit(s, 'dz:join', { roomCode, studentToken: token });
    return { s, token, j, T: j.playerToken, rounds: [], results: [] };
  };
  r = await emit(connect(), 'dz:join', { roomCode });
  assert(r.code === 'CONTA_OBRIGATORIA', 'sem conta não entra');
  r = await M('dz:start');
  assert(r.code === 'SEM_JOGADORES', 'não começa sem criança na sala');

  const ana = await kid('Ana Souza');
  const bia = await kid('Bia Lima');
  const caio = await kid('Caio Dias');
  assert(ana.j.ok && ana.j.state.you.name === 'Ana Souza' && ana.j.state.text === null, 'criança entra com a conta e ainda não vê texto');
  const again = await emit(connect(), 'dz:join', { roomCode, studentToken: ana.token });
  assert(again.reconnected && again.playerId === ana.j.playerId, 'mesma conta em outro aparelho volta para o mesmo lugar');

  const screen = connect();
  await connected(screen);
  r = await emit(screen, 'dz:watch', { roomCode });
  assert(r.ok && r.state.isScreen && r.state.players.length === 3 && !JSON.stringify(r.state).includes(masterToken), 'telão vê a turma, sem tokens');

  for (const k of [ana, bia, caio]) {
    k.s.on('dz:round', (p) => k.rounds.push(p));
    k.s.on('dz:results', (p) => k.results.push(p));
  }

  // ---- rodada no modo corrida ----
  r = await M('dz:start');
  assert(r.ok && r.state.status === 'countdown' && r.state.startAt > Date.now(), 'rodada começa com contagem');
  await wait(100);
  const text = ana.rounds[0] && ana.rounds[0].text;
  assert(text === 'oi sol mar' && bia.rounds[0].text === text, 'todos recebem o mesmo texto');
  r = await emit(ana.s, 'dz:keys', { roomCode, playerToken: ana.T, chars: 'oi' });
  assert(r.ok && r.typed === 0, 'teclas antes da largada não contam');
  r = await M('dz:config', { config: { mode: 'relogio' } });
  assert(r.code === 'EM_ANDAMENTO', 'não muda regras com a rodada andando');

  await wait(4600); // contagem 3-2-1 + 1 s de corrida (o teto de velocidade é por segundo)
  r = await emit(caio.s, 'dz:keys', { roomCode, playerToken: caio.T, chars: 'x'.repeat(200) });
  assert(r.ok && r.typed === 0, 'tecla errada não avança o texto');
  r = await emit(bia.s, 'dz:keys', { roomCode, playerToken: bia.T, chars: 'oi sol' });
  assert(r.typed === 6, 'texto avança com as teclas certas (conferidas no servidor)');
  const live = await emit(master, 'dz:master_reconnect', { roomCode, masterToken });
  const biaLive = live.state.players.find((x) => x.name === 'Bia Lima');
  const caioLive = live.state.players.find((x) => x.name === 'Caio Dias');
  assert(live.state.text === 'oi sol mar' && biaLive.lastKeyAt > 0 && caioLive.wrong > 0,
    'painel do professor recebe o texto, a última tecla e os erros de cada um');
  const scr = await emit(screen, 'dz:watch', { roomCode });
  assert(!('lastKeyAt' in scr.state.players[0]) && !scr.state.text, 'telão não recebe esses detalhes');
  r = await emit(ana.s, 'dz:keys', { roomCode, playerToken: ana.T, chars: 'oi sol mar' });
  assert(r.typed === 10 && r.finished && r.place === 1, 'Ana termina em 1º lugar');
  r = await emit(bia.s, 'dz:keys', { roomCode, playerToken: bia.T, chars: ' mxar' });
  assert(r.finished && r.place === 2, 'Bia termina em 2º, com um erro');
  // gasta o limite de novo logo antes de conferir (com a máquina lenta, o
  // tempo entre um envio e outro já liberaria mais algumas teclas)
  await emit(caio.s, 'dz:keys', { roomCode, playerToken: caio.T, chars: 'x'.repeat(200) });
  r = await emit(caio.s, 'dz:keys', { roomCode, playerToken: caio.T, chars: 'oi sol mar' });
  assert(r.ok && r.typed === 0, 'teto de velocidade: as 200 teclas de uma vez gastaram o limite, as seguintes não contam');
  await wait(2000);
  r = await emit(caio.s, 'dz:keys', { roomCode, playerToken: caio.T, chars: 'oi sol mar' });
  assert(r.ok && r.finished && r.place === 3, 'depois de um tempo, Caio volta a digitar e termina por último');
  await wait(500);
  const res = ana.results[0];
  assert(res && res.status === 'finished', 'com todos no fim, a rodada acaba sozinha');
  const rank = res.results.ranking;
  assert(rank.map((x) => x.name).join(',') === 'Ana Souza,Bia Lima,Caio Dias', 'classificação na ordem de chegada');
  assert(rank[1].accuracy < 100 && rank[0].accuracy === 100, 'precisão de cada um vem do motor do servidor');
  assert(res.results.podium.fastest === rank[0].id && res.results.podium.precise === rank[0].id, 'pódio: mais rápido e mais preciso');
  assert(!JSON.stringify(res).includes('studentId'), 'resultado não expõe ids de conta');

  const p = await srv.api('GET', '/api/progress', null, ana.token);
  assert(/^🏁 1 desafio · \d+ PPM$/.test(p.summaries.desafio), `o desafio conta no progresso ("${p.summaries.desafio}")`);
  const tl = await srv.api('GET', '/api/teacher/students', null, { teacher: teacherToken });
  const anaRow = tl.students.find((x) => x.name === 'Ana Souza');
  assert(anaRow.games.desafio.races === 1 && anaRow.games.desafio.wins === 1, 'área do professor mostra corridas e vitórias');

  // ---- modo relógio, turma contra o mascote, encerrado pelo professor ----
  r = await M('dz:config', { config: { mode: 'relogio', seconds: 30, vsMascot: true, showNames: false, source: 'level', levelId: 'm1f1', uppercase: true } });
  assert(r.ok && r.state.config.mode === 'relogio', 'professor troca para o modo relógio');
  r = await M('dz:start');
  await wait(100);
  const longText = ana.rounds[1].text;
  assert(longText.length >= 30 * 20 && longText === longText.toLocaleUpperCase('pt-BR'), 'no relógio, o texto é longo e (aqui) todo em maiúsculas');
  r = await emit(screen, 'dz:watch', { roomCode });
  assert(r.state.players.every((x) => x.name === null) && r.state.mascot, 'telão sem nomes, com a corrida contra o mascote');
  await wait(3600);
  r = await emit(ana.s, 'dz:keys', { roomCode, playerToken: ana.T, chars: longText.slice(0, 200) });
  assert(r.typed > 0 && r.typed <= 15, `teto de velocidade: 200 teclas certas de uma vez, só ${r.typed} valeram`);
  r = await M('dz:end_round');
  await wait(300);
  const res2 = ana.results[1];
  assert(res2 && res2.results.mode === 'relogio' && res2.results.ranking[0].name === 'Ana Souza' && res2.results.mascot, 'professor encerra a rodada; ranking e placar contra o mascote');

  // ---- sair, expulsar, encerrar ----
  r = await M('dz:kick', { playerId: caio.j.playerId });
  r = await emit(connect(), 'dz:join', { roomCode, studentToken: caio.token });
  assert(r.code === 'EXPULSO', 'quem foi removido não volta');
  r = await M('dz:end_room');
  r = await emit(connect(), 'dz:join', { roomCode, studentToken: await srv.student('Davi Reis') });
  assert(r.code === 'SALA_ENCERRADA', 'sala encerrada não aceita ninguém');

  console.log('\n----------------------------------------');
  await srv.stop();
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ERRO FATAL NO TESTE', e);
  if (srv) await srv.stop();
  process.exit(1);
});
