// src/platform/match.js
// 👫 Partidas pela rede entre dois educandos, para os jogos de tabuleiro
// (os que têm `server.board` no registro: Velha, Ligue 4...). Eventos
// Socket.IO com o prefixo "bg:".
//   🔑 código de sala   bg:create { game, variant, studentToken } → { code }
//                       bg:join { code, studentToken }
//   🎲 pareamento       bg:queue { game, variant, studentToken }: espera na
//                       fila daquele jogo; junta dois (de preferência da mesma
//                       turma; depois de alguns segundos, qualquer um)
//                       bg:cancel: sai da fila ou desfaz a sala que criou
//   na partida          bg:move { matchId, move }, bg:resign, bg:draw_offer,
//                       bg:draw_answer { accept }, bg:rejoin { matchId, studentToken }
//   o servidor manda    bg:state (o estado para cada um, com o lado dele)
//
// O servidor é o juiz: confere cada lance com o mesmo arquivo de regras do
// navegador. Quem cair tem RECONNECT_MS para voltar; depois disso, o outro
// vence por abandono. No fim, o resultado vai para o progresso dos dois
// (partida com amigo conta no placar, mas não dá estrela).

const crypto = require('crypto');
const accounts = require('./accounts');
const progress = require('./progress');

const RECONNECT_MS = 60 * 1000;
const SAME_CLASS_WAIT_MS = 8 * 1000; // depois disso, junta com qualquer um da fila
const ROOM_TTL_MS = 30 * 60 * 1000; // sala esperando o amigo
const ENDED_TTL_MS = 10 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I e O (confundem com 1 e 0)

class MatchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function createMatchManager(registry, { now = () => Date.now(), reconnectMs = RECONNECT_MS, sameClassWaitMs = SAME_CLASS_WAIT_MS } = {}) {
  const matches = new Map(); // id -> partida
  const byCode = new Map(); // código -> id
  const queue = []; // { game, variant, student, socketId, at }
  let io = null;

  const boardGame = (id) => {
    const g = registry.games.find((x) => x.id === id && x.server && x.server.board);
    if (!g) throw new MatchError('JOGO_INVALIDO', 'Esse jogo não tem partida pela rede.');
    return g;
  };
  const checkVariant = (game, variant) => {
    const v = String(variant || '');
    if (!game.server.Rules.VARIANTS[v]) throw new MatchError('VARIANTE_INVALIDA', 'Essa variante não existe.');
    return v;
  };
  const studentOf = (token) => accounts.authenticate(token);
  const channel = (m) => `bg:${m.id}`;

  function newCode() {
    for (let i = 0; i < 1000; i++) {
      const code = Array.from(crypto.randomBytes(4), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
      if (!byCode.has(code)) return code;
    }
    throw new MatchError('SEM_CODIGO', 'Tente de novo.');
  }

  function createMatch(game, variant, first) {
    const m = {
      id: crypto.randomBytes(8).toString('hex'),
      code: null,
      game: game.id,
      variant,
      players: [first, null],
      state: null,
      moves: [],
      status: 'waiting',
      result: null,
      drawOffer: null,
      createdAt: now(),
      startedAt: null,
      endedAt: null,
      timers: [null, null],
    };
    matches.set(m.id, m);
    return m;
  }

  const playerFor = (student, socket) => ({
    studentId: student.id, name: student.name, firstName: student.firstName, avatar: student.avatar,
    className: student.className, socketId: socket.id, connected: true,
  });

  function start(m, second) {
    // quem começa é sorteado
    if (crypto.randomInt(2)) m.players = [second, m.players[0]];
    else m.players[1] = second;
    const game = boardGame(m.game);
    m.state = game.server.Rules.initial(m.variant);
    m.status = 'playing';
    m.startedAt = now();
    if (m.code) byCode.delete(m.code);
    for (const p of m.players) {
      const s = io && io.sockets.sockets.get(p.socketId);
      if (s) s.join(channel(m));
    }
    broadcast(m);
  }

  // o que cada jogador vê (o lado dele em `you`)
  function view(m, seat) {
    return {
      matchId: m.id,
      code: m.code,
      game: m.game,
      variant: m.variant,
      status: m.status,
      you: seat,
      players: m.players.map((p) => (p ? { name: p.name, firstName: p.firstName, avatar: p.avatar, connected: p.connected } : null)),
      state: m.state,
      moves: m.moves,
      result: m.result,
      drawOffer: m.drawOffer,
      reconnectMs,
    };
  }

  function broadcast(m) {
    if (!io) return;
    m.players.forEach((p, seat) => {
      if (p && p.connected) io.to(p.socketId).emit('bg:state', view(m, seat));
    });
  }

  function seatOf(m, studentId) {
    return m.players.findIndex((p) => p && p.studentId === studentId);
  }

  // fim: grava o resultado dos dois e avisa
  function finish(m, winner, reason) {
    if (m.status === 'ended') return;
    m.status = 'ended';
    m.endedAt = now();
    m.result = { winner, reason };
    m.timers.forEach((t) => t && clearTimeout(t));
    const game = boardGame(m.game);
    m.players.forEach((p, seat) => {
      if (!p) return;
      const outcome = winner === null ? 'draw' : winner === seat ? 'win' : 'loss';
      try {
        progress.recordResult(p.studentId, game, game.server.friendResult({
          outcome, moves: m.moves.length, durationMs: m.endedAt - (m.startedAt || m.endedAt), variant: m.variant, reason,
        }));
      } catch (e) {
        console.error('[partida] não gravou o resultado', e);
      }
    });
    broadcast(m);
  }

  function removeFromQueue(socketId) {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].socketId === socketId) queue.splice(i, 1);
  }

  // junta dois da fila: mesma turma primeiro; quem espera há um tempo, com qualquer um
  function pairQueue() {
    const t = now();
    for (let i = 0; i < queue.length; i++) {
      const a = queue[i];
      let j = queue.findIndex((b, k) => k !== i && b.game === a.game && b.variant === a.variant
        && b.student.id !== a.student.id && a.student.className && b.student.className === a.student.className);
      if (j < 0 && t - a.at >= sameClassWaitMs) {
        j = queue.findIndex((b, k) => k !== i && b.game === a.game && b.variant === a.variant && b.student.id !== a.student.id);
      }
      if (j < 0) continue;
      const b = queue[j];
      queue.splice(Math.max(i, j), 1);
      queue.splice(Math.min(i, j), 1);
      const m = createMatch(boardGame(a.game), a.variant, a.player);
      start(m, b.player);
      return pairQueue();
    }
    return null;
  }

  function cleanup() {
    const t = now();
    for (const m of matches.values()) {
      if ((m.status === 'waiting' && t - m.createdAt > ROOM_TTL_MS) || (m.status === 'ended' && t - m.endedAt > ENDED_TTL_MS)) {
        if (m.code) byCode.delete(m.code);
        matches.delete(m.id);
      }
    }
  }

  // ---------------- ações (também usadas pelos testes, sem socket) ----------------
  const actions = {
    create(socket, { game, variant, studentToken }) {
      const student = studentOf(studentToken);
      const g = boardGame(game);
      const v = checkVariant(g, variant);
      actions.cancel(socket);
      const m = createMatch(g, v, playerFor(student, socket));
      m.code = newCode();
      byCode.set(m.code, m.id);
      broadcast(m);
      return { code: m.code, matchId: m.id };
    },
    join(socket, { code, studentToken }) {
      const student = studentOf(studentToken);
      const id = byCode.get(String(code || '').toUpperCase().replace(/[^A-Z]/g, ''));
      const m = id && matches.get(id);
      if (!m || m.status !== 'waiting') throw new MatchError('SALA_NAO_ENCONTRADA', 'Não achei essa sala. Confira o código.');
      if (m.players[0].studentId === student.id) throw new MatchError('MESMA_CONTA', 'Essa sala é sua: passe o código para um amigo.');
      actions.cancel(socket);
      start(m, playerFor(student, socket));
      return { matchId: m.id, game: m.game, variant: m.variant };
    },
    queue(socket, { game, variant, studentToken }) {
      const student = studentOf(studentToken);
      const g = boardGame(game);
      const v = checkVariant(g, variant);
      actions.cancel(socket);
      queue.push({ game: g.id, variant: v, student, player: playerFor(student, socket), socketId: socket.id, at: now() });
      pairQueue();
      return { waiting: queue.some((q) => q.socketId === socket.id) };
    },
    cancel(socket) {
      removeFromQueue(socket.id);
      for (const m of matches.values()) {
        if (m.status === 'waiting' && m.players[0] && m.players[0].socketId === socket.id) {
          if (m.code) byCode.delete(m.code);
          matches.delete(m.id);
        }
      }
      return {};
    },
    move(socket, { matchId, move }) {
      const { m, seat } = mine(socket, matchId);
      if (m.status !== 'playing') throw new MatchError('PARTIDA_ENCERRADA', 'A partida já acabou.');
      if (m.state.turn !== seat) throw new MatchError('NAO_E_SUA_VEZ', 'Espere a sua vez.');
      const Rules = boardGame(m.game).server.Rules;
      if (!Rules.isLegal(m.state, move)) throw new MatchError('LANCE_INVALIDO', 'Esse lance não vale.');
      m.state = Rules.play(m.state, move);
      m.moves.push(move);
      m.drawOffer = null;
      if (m.state.result) finish(m, m.state.result.winner, 'fim');
      else broadcast(m);
      return {};
    },
    resign(socket, { matchId }) {
      const { m, seat } = mine(socket, matchId);
      if (m.status !== 'playing') throw new MatchError('PARTIDA_ENCERRADA', 'A partida já acabou.');
      finish(m, 1 - seat, 'desistiu');
      return {};
    },
    drawOffer(socket, { matchId }) {
      const { m, seat } = mine(socket, matchId);
      if (m.status !== 'playing') throw new MatchError('PARTIDA_ENCERRADA', 'A partida já acabou.');
      m.drawOffer = seat;
      broadcast(m);
      return {};
    },
    drawAnswer(socket, { matchId, accept }) {
      const { m, seat } = mine(socket, matchId);
      if (m.status !== 'playing' || m.drawOffer === null || m.drawOffer === seat) throw new MatchError('SEM_PROPOSTA', 'Não há proposta de empate.');
      if (accept) finish(m, null, 'acordo');
      else { m.drawOffer = null; broadcast(m); }
      return {};
    },
    // voltou depois de cair (ou abriu de novo a página)
    rejoin(socket, { matchId, studentToken }) {
      const student = studentOf(studentToken);
      const m = matches.get(String(matchId || ''));
      if (!m) throw new MatchError('PARTIDA_NAO_ENCONTRADA', 'Essa partida não existe mais.');
      const seat = seatOf(m, student.id);
      if (seat < 0) throw new MatchError('NAO_E_SUA', 'Essa partida não é sua.');
      const p = m.players[seat];
      p.socketId = socket.id;
      p.connected = true;
      if (m.timers[seat]) { clearTimeout(m.timers[seat]); m.timers[seat] = null; }
      if (typeof socket.join === 'function') socket.join(channel(m));
      broadcast(m);
      return { matchId: m.id };
    },
    disconnect(socket) {
      removeFromQueue(socket.id);
      for (const m of matches.values()) {
        m.players.forEach((p, seat) => {
          if (!p || p.socketId !== socket.id) return;
          if (m.status === 'waiting') {
            if (m.code) byCode.delete(m.code);
            matches.delete(m.id);
            return;
          }
          if (m.status !== 'playing') return;
          p.connected = false;
          broadcast(m);
          // não voltou a tempo: o outro vence por abandono
          m.timers[seat] = setTimeout(() => {
            if (m.status === 'playing' && !m.players[seat].connected) finish(m, 1 - seat, 'abandono');
          }, reconnectMs);
          if (m.timers[seat].unref) m.timers[seat].unref();
        });
      }
    },
  };

  function mine(socket, matchId) {
    const m = matches.get(String(matchId || ''));
    if (!m) throw new MatchError('PARTIDA_NAO_ENCONTRADA', 'Essa partida não existe mais.');
    const seat = m.players.findIndex((p) => p && p.socketId === socket.id);
    if (seat < 0) throw new MatchError('NAO_E_SUA', 'Essa partida não é sua.');
    return { m, seat };
  }

  function register(server) {
    io = server;
    const reply = (fn) => (payload, ack) => {
      const cb = typeof ack === 'function' ? ack : () => {};
      try {
        cb({ ok: true, ...fn(payload || {}) });
      } catch (e) {
        if (e instanceof MatchError || e instanceof accounts.AccountError) cb({ ok: false, code: e.code, message: e.message });
        else { console.error('[partida] erro inesperado', e); cb({ ok: false, code: 'ERRO_INTERNO', message: 'Erro inesperado no servidor.' }); }
      }
    };
    io.on('connection', (socket) => {
      socket.on('bg:create', reply((p) => actions.create(socket, p)));
      socket.on('bg:join', reply((p) => actions.join(socket, p)));
      socket.on('bg:queue', reply((p) => actions.queue(socket, p)));
      socket.on('bg:cancel', reply(() => actions.cancel(socket)));
      socket.on('bg:move', reply((p) => actions.move(socket, p)));
      socket.on('bg:resign', reply((p) => actions.resign(socket, p)));
      socket.on('bg:draw_offer', reply((p) => actions.drawOffer(socket, p)));
      socket.on('bg:draw_answer', reply((p) => actions.drawAnswer(socket, p)));
      socket.on('bg:rejoin', reply((p) => actions.rejoin(socket, p)));
      socket.on('disconnect', () => actions.disconnect(socket));
    });
    // fila: quem espera há um tempo é juntado com qualquer um; e a limpeza
    setInterval(() => { pairQueue(); cleanup(); }, 2000).unref();
  }

  return { register, actions, matches, queue, pairQueue, MatchError };
}

module.exports = { createMatchManager, MatchError };
