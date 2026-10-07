// test/load.test.js
// Teste de carga: uma turma de N crianças (padrão 30) conectadas ao mesmo
// tempo, cada uma marcando as casas sorteadas, enquanto o professor sorteia.
// Mede quanto tempo cada sorteio leva para chegar a TODAS as cartelas.
// Rode com o servidor ligado: node test/load.test.js [quantidade]

const { io } = require('socket.io-client');

const URL = 'http://localhost:3000';
const PLAYERS = Number(process.argv[2]) || 30;
const DRAWS = 25;
const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐧', '🦄', '🐙', '🐢', '🐝', '🦖', '🐰', '🐯', '🐨'];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => io(URL, { transports: ['websocket'], forceNew: true });
const connected = (s) => new Promise((r) => s.on('connect', r));
function emitAsync(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (res) => (res && res.ok ? resolve(res) : reject(res)));
  });
}
const percentile = (list, p) => list.slice().sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * p))];

async function main() {
  const master = connect();
  await connected(master);
  const { roomCode, masterToken } = await emitAsync(master, 'create_room', { name: 'Carga' });
  await emitAsync(master, 'update_config', {
    roomCode, masterToken,
    config: {
      gridSize: 5, freeSpace: true, bingoType: 'numbers', minNumber: 1, maxNumber: 75,
      // vitória só com cartela cheia, para a partida não pausar no meio do teste
      winPatterns: { row: false, column: false, diagonal: false, fullCard: true }, autoPauseOnWin: false,
    },
  });

  // ---------- turma entrando ----------
  const t0 = Date.now();
  const kids = await Promise.all(Array.from({ length: PLAYERS }, async (_, i) => {
    const s = connect();
    await connected(s);
    const res = await emitAsync(s, 'join_room', { roomCode, name: `Criança ${i + 1}`, avatar: AVATARS[i % AVATARS.length] });
    const kid = { s, token: res.playerToken, card: null, lastSeenDraws: 0, marks: 0, errors: 0 };
    s.on('player_state', (st) => {
      kid.card = st.card;
      kid.lastSeenDraws = st.drawnItems.length;
      kid.lastState = st;
    });
    return kid;
  }));
  console.log(`${PLAYERS} crianças entraram em ${Date.now() - t0} ms`);

  await emitAsync(master, 'start_game', { roomCode, masterToken });
  await wait(300);
  const withCard = kids.filter((k) => k.card).length;
  console.log(`${withCard}/${PLAYERS} receberam cartela`);

  // ---------- sorteios: mede até a última criança receber ----------
  const latencies = [];
  for (let d = 1; d <= DRAWS; d++) {
    const start = Date.now();
    const { value } = await emitAsync(master, 'draw_item', { roomCode, masterToken });
    while (kids.some((k) => k.lastSeenDraws < d) && Date.now() - start < 5000) await wait(2);
    latencies.push(Date.now() - start);

    // cada criança procura e marca o item (todas ao mesmo tempo)
    await Promise.all(kids.map(async (k) => {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (k.card.cells[r][c].value !== value) continue;
          try {
            await emitAsync(k.s, 'mark_cell', { roomCode, playerToken: k.token, row: r, col: c });
            k.marks++;
          } catch (e) { k.errors++; }
        }
      }
    }));
  }

  await wait(500); // deixa chegar a última atualização de cada cartela
  const lost = kids.filter((k) => k.lastSeenDraws < DRAWS).length;
  const errors = kids.reduce((n, k) => n + k.errors, 0);
  const marks = kids.reduce((n, k) => n + k.marks, 0);
  const serverMarked = kids.reduce((n, k) => n + k.lastState.you.markedCount, 0);
  console.log(`${DRAWS} sorteios · tempo até a última criança: mediana ${percentile(latencies, 0.5)} ms, `
    + `p95 ${percentile(latencies, 0.95)} ms, máximo ${Math.max(...latencies)} ms`);
  console.log(`${marks} marcações aceitas, ${errors} recusadas; servidor confirma ${serverMarked} casas marcadas`);

  await emitAsync(master, 'end_game', { roomCode, masterToken });
  const ok = withCard === PLAYERS && lost === 0 && errors === 0 && serverMarked === marks && percentile(latencies, 0.95) < 500;
  console.log(ok ? '✅ CARGA OK' : '❌ PROBLEMA NA CARGA');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('ERRO FATAL', e); process.exit(1); });
