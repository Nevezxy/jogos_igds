// src/marathon/socketHandlers.js
// 🏃 Modo Maratona em tempo real (Socket.IO, prefixo "mt:"). Liga o
// gerenciador (manager.js) aos navegadores do professor, dos educandos e do
// telão. Toda resposta é { ok: true, ... } ou { ok: false, code, message }.
//
//   professor  mt:create { teacherToken, config, name } → { code, masterToken }
//              mt:master { code, masterToken }  (entrar ou voltar como dono)
//              mt:config { config, name } · mt:teams { how } · mt:move { studentId, teamId }
//              mt:start { gameId? } · mt:next { gameId? } · mt:end_vote · mt:pause · mt:resume
//              mt:end { anular } · mt:resolve { matchId, outcome, motivo }
//              mt:excuse { studentId } · mt:readmit { studentId }
//              (todos com { code, masterToken })
//   educando   mt:join { code, studentToken } · mt:vote { code, gameId }
//              mt:result { code, body } · mt:leave { code }
//   telão      mt:watch { code }  (só leitura, sem tokens)
//   servidor   mt:state  o estado para cada um (professor, educando ou telão),
//              com serverNow para o relógio do navegador acertar a contagem
//
// Presença: quem está com a maratona aberta (para "conectado", para marcar
// que a criança apareceu na rodada e para separar ausente de tempo esgotado).

const accounts = require('../platform/accounts');
const teacher = require('../platform/teacher');
const { createMarathonManager, MarathonError } = require('./manager');

function createMarathonRealtime(registry, { matchManager = null, now } = {}) {
  let io = null;
  // código -> Map(socketId -> { role: 'professor' | 'educando' | 'telao', studentId })
  const rooms = new Map();
  const onlineCount = new Map(); // studentId -> sockets abertos (em qualquer maratona)

  const isOnline = (studentId) => (onlineCount.get(studentId) || 0) > 0;
  const pending = new Set();
  // várias mudanças seguidas = um envio só (no próximo giro)
  function schedule(code) {
    if (pending.has(code)) return;
    pending.add(code);
    setImmediate(() => { pending.delete(code); broadcast(code); });
  }
  const manager = createMarathonManager(registry, { matchManager, now, isOnline, onChange: (m) => schedule(m.code) });

  function broadcast(code) {
    if (!io) return;
    const room = rooms.get(code);
    if (!room || !room.size) return;
    let m;
    try { m = manager.get(code); } catch (e) { return; }
    const cache = {};
    for (const [sid, who] of room) {
      const s = io.sockets.sockets.get(sid);
      if (!s) continue;
      const key = who.role === 'educando' ? `e:${who.studentId}` : who.role;
      if (!cache[key]) cache[key] = manager.view(m, { role: who.role, studentId: who.studentId });
      s.emit('mt:state', cache[key]);
    }
  }

  function attach(socket, code, who) {
    // um socket fica numa maratona só
    detach(socket);
    if (!rooms.has(code)) rooms.set(code, new Map());
    rooms.get(code).set(socket.id, who);
    socket.data.mt = { code, ...who };
    if (who.studentId) onlineCount.set(who.studentId, (onlineCount.get(who.studentId) || 0) + 1);
    schedule(code);
  }
  function detach(socket) {
    const cur = socket.data && socket.data.mt;
    if (!cur) return;
    const room = rooms.get(cur.code);
    if (room) {
      room.delete(socket.id);
      if (!room.size) rooms.delete(cur.code);
    }
    if (cur.studentId) {
      const n = (onlineCount.get(cur.studentId) || 1) - 1;
      if (n > 0) onlineCount.set(cur.studentId, n); else onlineCount.delete(cur.studentId);
    }
    socket.data.mt = null;
    schedule(cur.code);
  }

  const studentOf = (socket, code) => {
    const cur = socket.data && socket.data.mt;
    if (!cur || cur.role !== 'educando' || cur.code !== String(code || '').toUpperCase()) {
      throw new MarathonError('ENTRE_NA_MARATONA', 'Entre na maratona com o código primeiro.');
    }
    return cur.studentId;
  };
  const codeOf = (m) => m.code;

  // ---------------- as ações ----------------
  const handlers = {
    'mt:create': (socket, { teacherToken, config, name }) => {
      teacher.requireTeacher(teacherToken);
      const { code, masterToken, marathon } = manager.create(config, { name });
      attach(socket, code, { role: 'professor' });
      return { code, masterToken, state: manager.view(marathon, { role: 'professor' }) };
    },
    'mt:master': (socket, { code, masterToken }) => {
      const m = manager.get(code);
      if (!manager.isMaster(code, masterToken)) throw new MarathonError('NAO_AUTORIZADO', 'Você não é o dono desta maratona.');
      attach(socket, codeOf(m), { role: 'professor' });
      return { state: manager.view(m, { role: 'professor' }) };
    },
    'mt:join': (socket, { code, studentToken }) => {
      const student = accounts.authenticate(studentToken);
      const m = manager.get(code);
      if (m.status === 'encerrada' || m.status === 'cancelada') {
        // acabou: entra só para ver o resultado
        attach(socket, codeOf(m), { role: 'educando', studentId: student.id });
        return { state: manager.view(m, { role: 'educando', studentId: student.id }), participant: null };
      }
      const p = manager.join(code, student);
      attach(socket, codeOf(m), { role: 'educando', studentId: student.id });
      manager.seen(code, student.id);
      return { state: manager.view(m, { role: 'educando', studentId: student.id }), participant: { teamId: p.teamId, status: p.status } };
    },
    'mt:watch': (socket, { code }) => {
      const m = manager.get(code);
      attach(socket, codeOf(m), { role: 'telao' });
      return { state: manager.view(m, { role: 'telao' }) };
    },
    'mt:leave': (socket, { code }) => {
      const cur = socket.data && socket.data.mt;
      if (cur && cur.role === 'educando') manager.leave(code, cur.studentId);
      detach(socket);
      return {};
    },
    'mt:vote': (socket, { code, gameId }) => { manager.vote(code, studentOf(socket, code), String(gameId || '')); return {}; },
    'mt:result': (socket, { code, body }) => {
      const r = manager.submit(code, studentOf(socket, code), body);
      return { duplicate: r.duplicate, entry: { status: r.entry.status, stars: r.entry.stars, score: r.entry.score } };
    },
    // ações do dono
    'mt:config': (s, { code, masterToken, config, name }) => { manager.updateConfig(code, masterToken, config, { name }); return {}; },
    'mt:teams': (s, { code, masterToken, how }) => { manager.teams(code, masterToken, how); return {}; },
    'mt:move': (s, { code, masterToken, studentId, teamId }) => { manager.moveStudent(code, masterToken, studentId, teamId); return {}; },
    'mt:start': (s, { code, masterToken, gameId }) => { manager.start(code, masterToken, { gameId }); return {}; },
    'mt:next': (s, { code, masterToken, gameId }) => { manager.nextRound(code, masterToken, { gameId }); return {}; },
    'mt:end_vote': (s, { code, masterToken }) => { manager.endVote(code, masterToken); return {}; },
    'mt:pause': (s, { code, masterToken }) => { manager.pause(code, masterToken); return {}; },
    'mt:resume': (s, { code, masterToken }) => { manager.resume(code, masterToken); return {}; },
    'mt:end': (s, { code, masterToken, anular }) => { manager.end(code, masterToken, { anular: Boolean(anular) }); return {}; },
    'mt:resolve': (s, { code, masterToken, matchId, outcome, motivo }) => { manager.resolveMatch(code, masterToken, matchId, outcome, motivo); return {}; },
    'mt:excuse': (s, { code, masterToken, studentId }) => { manager.excuse(code, masterToken, studentId); return {}; },
    'mt:readmit': (s, { code, masterToken, studentId }) => { manager.readmit(code, masterToken, studentId); return {}; },
  };

  function register(server) {
    io = server;
    io.on('connection', (socket) => {
      socket.data = socket.data || {};
      for (const [event, fn] of Object.entries(handlers)) {
        socket.on(event, (payload, ack) => {
          const cb = typeof ack === 'function' ? ack : () => {};
          try {
            cb({ ok: true, ...fn(socket, payload || {}) });
          } catch (e) {
            if (e instanceof MarathonError || e instanceof accounts.AccountError || e instanceof teacher.TeacherError || (e && e.code && e.status)) {
              cb({ ok: false, code: e.code, message: e.message });
            } else {
              console.error('[maratona] erro inesperado', event, e);
              cb({ ok: false, code: 'ERRO_INTERNO', message: 'Erro inesperado no servidor.' });
            }
          }
        });
      }
      socket.on('disconnect', () => detach(socket));
    });
    manager.restore();
    manager.startClock();
  }

  return { register, manager, broadcast, isOnline, rooms };
}

module.exports = { createMarathonRealtime };
