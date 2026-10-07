const { io } = require('socket.io-client');

const URL = 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  return io(URL, { transports: ['websocket'], forceNew: true });
}
function emitAsync(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (res) => (res && res.ok ? resolve(res) : reject(res)));
  });
}

async function main() {
  const errors = [];
  const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

  const master = connect();
  await new Promise((r) => master.on('connect', r));

  const created = await emitAsync(master, 'create_room', { name: 'Turma Teste' });
  assert(created.ok && created.roomCode, 'sala criada com código: ' + created.roomCode);
  const roomCode = created.roomCode;
  const masterToken = created.masterToken;

  // config: bingo de palavras, 3x3, sem free space pra facilitar vitória por cartela cheia
  await emitAsync(master, 'update_config', {
    roomCode, masterToken,
    config: {
      gridSize: 3,
      freeSpace: false,
      bingoType: 'words',
      words: ['gato', 'cão', 'sol', 'lua', 'mar', 'flor', 'livro', 'chave', 'porta', 'mesa'],
      winPatterns: { row: true, column: true, diagonal: true, fullCard: true },
      autoPauseOnWin: true,
    },
  });
  assert(true, 'configuração de palavras aceita');

  // teste: nome de sala inválido
  try {
    await emitAsync(connect(), 'join_room', { roomCode: 'ZZZZZ', name: 'Fulano' });
    errors.push('deveria falhar com sala inválida');
  } catch (e) { assert(e.code === 'SALA_NAO_ENCONTRADA', 'código de sala inválido rejeitado corretamente'); }

  const p1 = connect();
  await new Promise((r) => p1.on('connect', r));
  const j1 = await emitAsync(p1, 'join_room', { roomCode, name: 'Ana' });
  assert(j1.ok, 'Ana entrou na sala');

  const p2 = connect();
  await new Promise((r) => p2.on('connect', r));
  const j2 = await emitAsync(p2, 'join_room', { roomCode, name: 'Bruno' });
  assert(j2.ok, 'Bruno entrou na sala');

  // nome duplicado deve falhar
  try {
    await emitAsync(connect(), 'join_room', { roomCode, name: 'ana' });
    errors.push('deveria rejeitar nome duplicado (case-insensitive)');
  } catch (e) { assert(e.code === 'NOME_DUPLICADO', 'nome duplicado (case-insensitive) rejeitado'); }

  // player não pode iniciar partida (não é master)
  try {
    await emitAsync(p1, 'start_game', { roomCode, masterToken: 'token-forjado' });
    errors.push('token de master forjado não deveria funcionar');
  } catch (e) { assert(e.code === 'NAO_AUTORIZADO', 'token de master forjado rejeitado'); }

  const started = await emitAsync(master, 'start_game', { roomCode, masterToken });
  assert(started.ok && started.state.status === 'playing', 'partida iniciada');

  await wait(150);

  // captura estado atual da cartela da Ana via get_state
  const anaState1 = await emitAsync(p1, 'get_state', { roomCode, playerToken: j1.playerToken });
  assert(anaState1.state.card && anaState1.state.card.cells.length === 3, 'Ana recebeu cartela 3x3');

  // tentativa de marcar item ainda não sorteado deve falhar
  try {
    await emitAsync(p1, 'mark_cell', { roomCode, playerToken: j1.playerToken, row: 0, col: 0 });
    errors.push('não deveria permitir marcar item não sorteado');
  } catch (e) { assert(e.code === 'ITEM_NAO_SORTEADO', 'marcação de item não sorteado corretamente bloqueada'); }

  // sorteia todas as palavras da cartela da Ana até ela vencer (cartela cheia habilitada)
  let anaWon = false;
  master.on('draw_item_noop', () => {});
  let safety = 0;
  let winEventPlayer = null;
  master.on('connect', () => {});
  p1.on('win_announced', (payload) => { winEventPlayer = payload; });

  while (!anaWon && safety < 20) {
    safety++;
    const cur = await emitAsync(master, 'get_state', { roomCode, masterToken });
    if (cur.state.status === 'paused') {
      // Bruno (ou outro jogador) pode ter vencido primeiro por linha/coluna/diagonal
      // e pausado automaticamente a partida — o Mestre retoma para continuar sorteando.
      await emitAsync(master, 'resume_game', { roomCode, masterToken });
    }
    const drawn = await emitAsync(master, 'draw_item', { roomCode, masterToken });
    await wait(30);
    // o sorteio não marca sozinho: Ana procura o item na cartela e marca
    const before = await emitAsync(p1, 'get_state', { roomCode, playerToken: j1.playerToken });
    const cells = before.state.card.cells;
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells.length; c++) {
        if (cells[r][c].value !== drawn.value) continue;
        assert(!cells[r][c].marked, 'sorteio não marca a cartela automaticamente');
        await emitAsync(p1, 'mark_cell', { roomCode, playerToken: j1.playerToken, row: r, col: c });
      }
    }
    const st = await emitAsync(p1, 'get_state', { roomCode, playerToken: j1.playerToken });
    anaWon = st.state.you.hasWon;
  }
  assert(anaWon, 'Ana venceu a partida (cartela completa) após sorteios suficientes');

  const masterStateAfterWin = await emitAsync(master, 'get_state', { roomCode, masterToken });
  assert(masterStateAfterWin.state.status === 'paused', 'partida pausada automaticamente após vitória');
  assert(masterStateAfterWin.state.players.some((pl) => pl.name === 'Ana' && pl.hasWon), 'Mestre vê Ana como vencedora');

  // undo do último sorteio antes de continuar testes de kick
  await emitAsync(master, 'resume_game', { roomCode, masterToken });

  // expulsar Bruno
  const brunoId = masterStateAfterWin.state.players.find((pl) => pl.name === 'Bruno').id;
  let brunoKicked = false;
  p2.on('you_were_kicked', () => { brunoKicked = true; });
  await emitAsync(master, 'kick_player', { roomCode, masterToken, playerId: brunoId });
  await wait(150);
  assert(brunoKicked, 'Bruno recebeu evento de expulsão');

  try {
    await emitAsync(p2, 'mark_cell', { roomCode, playerToken: j2.playerToken, row: 0, col: 0 });
    errors.push('jogador expulso não deveria conseguir marcar casas');
  } catch (e) { assert(e.code === 'EXPULSO', 'jogador expulso corretamente bloqueado de marcar casas'); }

  // reiniciar partida
  const restarted = await emitAsync(master, 'restart_game', { roomCode, masterToken });
  assert(restarted.ok, 'partida reiniciada');
  const masterAfterRestart = await emitAsync(master, 'get_state', { roomCode, masterToken });
  assert(masterAfterRestart.state.status === 'waiting', 'status voltou para waiting após reiniciar');
  assert(masterAfterRestart.state.drawnItems.length === 0, 'histórico de sorteios zerado após reiniciar');

  // reconexão da Ana simulando refresh de página
  const p1b = connect();
  await new Promise((r) => p1b.on('connect', r));
  const reJoin = await emitAsync(p1b, 'join_room', { roomCode, name: 'Ana', playerToken: j1.playerToken });
  assert(reJoin.ok && reJoin.reconnected, 'Ana reconectou usando o token salvo');

  // encerrar sala
  await emitAsync(master, 'end_game', { roomCode, masterToken });
  const masterAfterEnd = await emitAsync(master, 'get_state', { roomCode, masterToken });
  assert(masterAfterEnd.state.status === 'ended', 'sala encerrada com sucesso');

  try {
    await emitAsync(connect(), 'join_room', { roomCode, name: 'NovoAluno' });
    errors.push('não deveria permitir entrar em sala encerrada');
  } catch (e) { assert(e.code === 'SALA_ENCERRADA', 'entrada em sala encerrada corretamente bloqueada'); }

  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  } else {
    console.log('✅ TODOS OS TESTES PASSARAM');
    process.exit(0);
  }
}

main().catch((e) => { console.error('ERRO FATAL NO TESTE', e); process.exit(1); });
