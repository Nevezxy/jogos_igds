// test/features.test.js
// Testes dos recursos do redesign: avatar, filtro de nomes, casa marcada
// travada, "quase lá", sorteio automático, telão (espectador), QR Code e
// endereços de rede. Rode com o servidor ligado: node test/features.test.js

const http = require('http');
const { io } = require('socket.io-client');

const URL = 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  return io(URL, { transports: ['websocket'], forceNew: true });
}
function connected(socket) {
  return new Promise((r) => socket.on('connect', r));
}
function emitAsync(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (res) => (res && res.ok ? resolve(res) : reject(res)));
  });
}
function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(URL + path, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    }).on('error', reject);
  });
}

async function main() {
  const errors = [];
  const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

  // ---------- HTTP: endereços e QR ----------
  const info = JSON.parse((await httpGet('/api/join-info')).body);
  assert(Array.isArray(info.urls), `join-info lista endereços (${info.urls.join(', ') || 'nenhum'})`);
  const qr = await httpGet('/qr.svg?data=' + encodeURIComponent('http://exemplo:3000/?sala=ABCDE'));
  assert(qr.status === 200 && /svg/.test(qr.type) && qr.body.includes('<svg'), 'QR Code gerado em SVG');

  // ---------- sala: 3x3, 9 palavras, só linhas valem ----------
  const master = connect();
  await connected(master);
  const { roomCode, masterToken } = await emitAsync(master, 'create_room', { name: 'Recursos' });
  const words = ['gato', 'cão', 'sol', 'lua', 'mar', 'flor', 'livro', 'chave', 'porta'];
  await emitAsync(master, 'update_config', {
    roomCode, masterToken,
    config: {
      gridSize: 3, freeSpace: false, bingoType: 'words', words,
      winPatterns: { row: true, column: false, diagonal: false, fullCard: false },
      autoPauseOnWin: false,
    },
  });

  // ---------- avatar e filtro de nome ----------
  const p1 = connect();
  await connected(p1);
  const j1 = await emitAsync(p1, 'join_room', { roomCode, name: 'Ana', avatar: '🦊' });
  assert(j1.state.you.avatar === '🦊', 'avatar escolhido é guardado');

  const p2 = connect();
  await connected(p2);
  const j2 = await emitAsync(p2, 'join_room', { roomCode, name: 'Bruno', avatar: '💣' });
  assert(j2.state.you.avatar && j2.state.you.avatar !== '💣', 'avatar fora da lista vira um bichinho válido');
  assert(j2.state.players.some((p) => p.name === 'Ana' && p.avatar === '🦊'), 'sala de espera vê nomes e avatares');

  try {
    await emitAsync(connect(), 'join_room', { roomCode, name: 'm3rda' });
    errors.push('nome impróprio deveria ser rejeitado');
  } catch (e) { assert(e.code === 'NOME_IMPROPRIO', 'nome impróprio rejeitado (mesmo com número no lugar de letra)'); }
  const j3 = await emitAsync(connect(), 'join_room', { roomCode, name: 'Carla Pinto' });
  assert(j3.ok, 'sobrenome comum não é bloqueado pelo filtro');

  // ---------- telão ----------
  const screen = connect();
  await connected(screen);
  const watch = await emitAsync(screen, 'watch_room', { roomCode });
  const watchJson = JSON.stringify(watch.state);
  assert(watch.state.isScreen && watch.state.players.length === 3, 'telão recebe a lista de participantes');
  assert(!watchJson.includes(masterToken) && !watchJson.includes(j1.playerToken), 'telão não recebe tokens');
  let screenGotState = false;
  screen.on('screen_state', () => { screenGotState = true; });

  // ---------- partida: sorteia tudo, Ana marca a primeira linha ----------
  await emitAsync(master, 'start_game', { roomCode, masterToken });
  for (let i = 0; i < words.length; i++) await emitAsync(master, 'draw_item', { roomCode, masterToken });
  await wait(100);
  assert(screenGotState, 'telão recebe atualizações durante a partida');

  await emitAsync(p1, 'mark_cell', { roomCode, playerToken: j1.playerToken, row: 0, col: 0 });
  const again = await emitAsync(p1, 'mark_cell', { roomCode, playerToken: j1.playerToken, row: 0, col: 0 });
  assert(again.card.cells[0][0].marked, 'tocar de novo numa casa marcada não desmarca');

  await emitAsync(p1, 'mark_cell', { roomCode, playerToken: j1.playerToken, row: 0, col: 1 });
  let ms = await emitAsync(master, 'get_state', { roomCode, masterToken });
  let ana = ms.state.players.find((p) => p.name === 'Ana');
  assert(ana.nearWin && ana.markedCount === 2 && ana.totalCells === 9, 'professor vê Ana "quase lá" (falta 1 na linha)');

  let winPayload = null;
  master.on('win_announced', (p) => { winPayload = p; });
  await emitAsync(p1, 'mark_cell', { roomCode, playerToken: j1.playerToken, row: 0, col: 2 });
  await wait(100);
  assert(winPayload && winPayload.avatar === '🦊', 'anúncio de bingo leva o avatar do vencedor');
  ms = await emitAsync(master, 'get_state', { roomCode, masterToken });
  ana = ms.state.players.find((p) => p.name === 'Ana');
  assert(ana.hasWon && !ana.nearWin, 'depois do bingo, Ana não aparece mais como "quase lá"');

  // ---------- sorteio automático ----------
  const master2 = connect();
  await connected(master2);
  const room2 = await emitAsync(master2, 'create_room', { name: 'Auto' });
  await emitAsync(master2, 'update_config', {
    roomCode: room2.roomCode, masterToken: room2.masterToken,
    config: { gridSize: 3, freeSpace: false, bingoType: 'numbers', minNumber: 1, maxNumber: 30, autoDrawSeconds: 8 },
  });
  try {
    await emitAsync(master2, 'update_config', {
      roomCode: room2.roomCode, masterToken: room2.masterToken, config: { autoDrawSeconds: 3 },
    });
    errors.push('intervalo de sorteio automático inválido deveria ser rejeitado');
  } catch (e) { assert(e.code === 'CONFIG_INVALIDA', 'intervalo de sorteio automático inválido rejeitado'); }

  const started = await emitAsync(master2, 'start_game', { roomCode: room2.roomCode, masterToken: room2.masterToken });
  assert(started.state.nextAutoDrawAt > Date.now(), 'sorteio automático agendado ao iniciar');
  const autoDraw = new Promise((r) => master2.once('draw_result', r));
  const firstDraw = await Promise.race([autoDraw, wait(14000).then(() => null)]);
  assert(firstDraw && firstDraw.value, 'sorteio automático aconteceu sozinho (depois da contagem + 8 s)');

  await emitAsync(master2, 'pause_game', { roomCode: room2.roomCode, masterToken: room2.masterToken });
  const paused = await emitAsync(master2, 'get_state', { roomCode: room2.roomCode, masterToken: room2.masterToken });
  assert(paused.state.nextAutoDrawAt === null, 'pausar cancela o sorteio automático');
  await emitAsync(master2, 'end_game', { roomCode: room2.roomCode, masterToken: room2.masterToken });
  await emitAsync(master, 'end_game', { roomCode, masterToken });

  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
}

main().catch((e) => { console.error('ERRO FATAL NO TESTE', e); process.exit(1); });
