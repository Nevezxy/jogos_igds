// src/platform/routes.js
// Rotas HTTP do núcleo da plataforma: contas (/api/auth) e progresso nos
// jogos (/api/progress). O token de sessão do educando vai no cabeçalho
// "X-Student-Token".

const express = require('express');
const accounts = require('./accounts');
const progress = require('./progress');
const points = require('./points');
const marathonCatalog = require('../marathon/catalog');
const teacher = require('./teacher');

function readToken(req) {
  return req.get('x-student-token') || null;
}

// Envolve um handler: devolve { ok: true, ...resultado } ou o erro em JSON.
function handle(fn) {
  return (req, res) => {
    try {
      res.json({ ok: true, ...fn(req) });
    } catch (e) {
      if (e instanceof accounts.AccountError || e instanceof progress.GameError || e instanceof teacher.TeacherError) {
        res.status(e.status).json({ ok: false, code: e.code, message: e.message });
      } else {
        console.error('[erro inesperado]', e);
        res.status(500).json({ ok: false, code: 'ERRO_INTERNO', message: 'Ocorreu um erro inesperado no servidor.' });
      }
    }
  };
}

// Disponível para as rotas dos jogos: identifica o educando da requisição.
function requireStudent(req) {
  return accounts.authenticate(readToken(req));
}

// `registry` é a lista de jogos (src/games/registry.js).
function createPlatformRouter(registry) {
  const findGame = (id) => {
    const game = registry.games.find((g) => g.id === id && g.status !== 'hidden');
    if (!game) throw new progress.GameError('JOGO_NAO_ENCONTRADO', 'Esse jogo não existe.', 404);
    return game;
  };

  const router = express.Router();
  const body = (req) => req.body || {};

  router.post('/auth/lookup', handle((req) => accounts.lookup(body(req).name)));
  router.post('/auth/login', handle((req) => accounts.login(body(req).name)));
  router.post('/auth/register', handle((req) => accounts.register(body(req).name, body(req).avatar)));
  router.get('/auth/me', handle((req) => ({ student: requireStudent(req) })));
  router.post('/auth/logout', handle((req) => { accounts.logout(readToken(req)); return {}; }));
  router.post('/auth/avatar', handle((req) => ({
    student: accounts.setAvatar(requireStudent(req).id, body(req).avatar),
  })));

  // ---------------- progresso ----------------

  // Resumos para os cartões do painel ({ digitacao: "Fase 7 · ⭐ 18", ... }).
  router.get('/progress', handle((req) => {
    const student = requireStudent(req);
    const all = progress.allProgress(student.id);
    const summaries = {};
    for (const game of registry.games) {
      if (game.server && typeof game.server.summary === 'function') {
        const text = game.server.summary(all[game.id] || null);
        if (text) summaries[game.id] = text;
      }
    }
    return { summaries };
  }));

  router.get('/progress/:gameId', handle((req) => {
    const student = requireStudent(req);
    const game = findGame(req.params.gameId);
    return { progress: progress.getProgress(student.id, game.id) };
  }));

  // Uma rodada terminada. O jogo valida (e calcula estrelas/pontos) antes de gravar.
  router.post('/progress/:gameId/results', handle((req) => {
    const student = requireStudent(req);
    const game = findGame(req.params.gameId);
    if (!game.server || typeof game.server.validateResult !== 'function') {
      throw new progress.GameError('SEM_RESULTADOS', 'Esse jogo não guarda resultados por aqui.');
    }
    // a mesma rodada de novo (reenvio da caixa de saída, duplo clique): não grava outra vez
    const attemptId = progress.attemptIdOf(body(req));
    const seen = progress.findAttempt(student.id, game.id, attemptId);
    if (seen) {
      return { progress: progress.getProgress(student.id, game.id), result: { levelId: seen.levelId, stars: seen.stars, score: seen.score, points: 0 }, duplicate: true };
    }
    const old = progress.getProgress(student.id, game.id);
    const result = game.server.validateResult(body(req), old);
    const updated = progress.recordResult(student.id, game, result, { attemptId });
    return { progress: updated, result: { levelId: result.levelId, stars: result.stars, score: result.score, points: result.pointsDelta || 0 } };
  }));

  // ---------------- 🏅 pontos e ranking ----------------
  // Pontos globais (derivados das estrelas, ver points.js). O ranking é
  // aberto a quem está logado (educando ou professor).
  const viewer = (req) => {
    if (readToken(req)) return { student: requireStudent(req) };
    if (teacher.isValid(req.get('x-teacher-token'))) return { teacher: true };
    return { student: requireStudent(req) }; // sem ninguém: o erro de login
  };
  router.get('/ranking', handle((req) => {
    const who = viewer(req);
    const game = req.query.game ? findGame(String(req.query.game)).id : null;
    const className = req.query.class ? String(req.query.class).slice(0, 40) : null;
    const list = points.ranking({ game, className, limit: req.query.limit });
    const me = who.student ? list.find((r) => r.id === who.student.id) || null : null;
    return { ranking: list, me, classes: accounts.listClasses(), game, className };
  }));
  router.get('/me/points', handle((req) => {
    const student = requireStudent(req);
    const mine = points.byStudent(student.id);
    const all = points.ranking();
    const cls = student.className ? points.ranking({ className: student.className }) : [];
    const pos = (list) => { const r = list.find((x) => x.id === student.id); return r ? r.position : null; };
    return { ...mine, position: pos(all), classPosition: pos(cls), players: all.length };
  }));
  router.get('/me/history', handle((req) => {
    const student = requireStudent(req);
    const game = req.query.game ? findGame(String(req.query.game)).id : null;
    return { history: progress.history(student.id, game, req.query.limit) };
  }));

  // ---------------- área do professor ----------------
  // Token do professor no cabeçalho "X-Teacher-Token".

  const teacherToken = (req) => req.get('x-teacher-token') || null;
  const asTeacher = (fn) => handle((req) => {
    teacher.requireTeacher(teacherToken(req));
    return fn(req);
  });

  router.get('/teacher/status', handle((req) => ({
    pinRequired: teacher.pinRequired(),
    authenticated: teacher.isValid(teacherToken(req)),
  })));
  router.post('/teacher/login', handle((req) => ({ token: teacher.login(body(req).pin) })));
  router.post('/teacher/logout', handle((req) => { teacher.logout(teacherToken(req)); return {}; }));

  router.get('/teacher/students', asTeacher(() => ({
    students: teacher.classList(registry),
    evolution: teacher.evolution(),
    evolutionWeeks: teacher.EVOLUTION_WEEKS,
    classes: accounts.listClasses(),
    settings: teacher.settings.all(),
  })));
  router.post('/teacher/students', asTeacher((req) => teacher.bulkRegister(body(req).names, body(req).className)));
  // turma de um ou mais educandos: { ids: [...], className } (vazio = sem turma)
  router.post('/teacher/students/class', asTeacher((req) => ({
    className: accounts.setClass(body(req).ids, body(req).className),
  })));
  router.post('/teacher/students/merge', asTeacher((req) => {
    teacher.mergeStudents(registry, body(req).fromId, body(req).intoId);
    return {};
  }));
  router.post('/teacher/students/:id/rename', asTeacher((req) => ({
    student: accounts.renameStudent(req.params.id, body(req).name),
  })));
  router.post('/teacher/students/:id/active', asTeacher((req) => {
    accounts.setActive(req.params.id, Boolean(body(req).active));
    return {};
  }));
  router.post('/teacher/students/:id/games/:gameId/unlock-all', asTeacher((req) => {
    teacher.setUnlockedAll(registry, req.params.id, req.params.gameId, Boolean(body(req).unlocked));
    return {};
  }));
  router.get('/teacher/students/:id/history', asTeacher((req) => {
    const student = accounts.requireStudentRow(req.params.id);
    const game = req.query.game ? findGame(String(req.query.game)).id : null;
    return { history: progress.history(student.id, game, req.query.limit || 200), points: points.byStudent(student.id) };
  }));
  // 🏃 Maratona: jogos e fases que podem cair (nível 1 a 4, tempo da rodada
  // em minutos e, opcional, os assuntos escolhidos: assuntos={"matematica":["mu","dv"]})
  const marathonFilter = (req) => {
    const nivel = Math.max(1, Math.min(4, Math.floor(Number(req.query.nivel) || 1)));
    const { min, max, default: def } = marathonCatalog.ROUND_MS;
    const roundMs = req.query.tempo ? Math.max(min, Math.min(max, Number(req.query.tempo) * 60000 || def)) : def;
    let topics = {};
    try { topics = req.query.assuntos ? JSON.parse(String(req.query.assuntos)) : {}; } catch (e) { topics = {}; }
    if (!topics || typeof topics !== 'object' || Array.isArray(topics)) topics = {};
    return { nivel, roundMs, topics };
  };
  router.get('/teacher/maratona/catalogo', asTeacher((req) => {
    const f = marathonFilter(req);
    return { nivel: f.nivel, roundMs: f.roundMs, niveis: marathonCatalog.NIVEIS, games: marathonCatalog.status(registry, f) };
  }));
  router.get('/teacher/maratona/catalogo/:gameId', asTeacher((req) => {
    const info = marathonCatalog.describe(findGame(req.params.gameId));
    if (!info) throw new progress.GameError('FORA_DA_MARATONA', 'Esse jogo não entra na Maratona.', 404);
    const f = marathonFilter(req);
    const list = marathonCatalog.eligible(info, { ...f, topics: f.topics[info.id] });
    return { game: { id: info.id, name: info.name, icon: info.icon, topics: info.topics }, fases: list };
  }));
  // 🏃 maratonas anteriores (o resultado fica salvo) e o estado de uma
  // maratona (o mesmo que o telão vê: sem tokens)
  const marathons = (req) => {
    const mgr = req.app.locals.marathon;
    if (!mgr) throw new progress.GameError('SEM_MARATONA', 'O Modo Maratona não está ligado.', 503);
    return mgr;
  };
  router.get('/teacher/maratona/historico', asTeacher((req) => ({
    marathons: marathons(req).history(100).map((h) => ({
      code: h.code, name: h.name, status: h.status, createdAt: h.createdAt, startedAt: h.startedAt, endedAt: h.endedAt,
      games: (h.config && h.config.games) || [], formato: h.config && h.config.formato,
      winner: h.state && h.state.final && h.state.final.standings[0] ? h.state.final.standings[0].id : null,
    })),
  })));
  router.get('/maratona/:code', handle((req) => {
    viewer(req);
    const mgr = marathons(req);
    let m;
    try { m = mgr.get(req.params.code); } catch (e) { throw new progress.GameError('MARATONA_NAO_ENCONTRADA', 'Não achei essa maratona.', 404); }
    return { state: mgr.view(m, { role: 'telao' }) };
  }));
  // refaz os pontos de todos a partir do progresso (conferência)
  router.post('/teacher/points/recompute', asTeacher(() => {
    points.recomputeAll();
    return { ranking: points.ranking({ limit: 10 }) };
  }));
  router.post('/teacher/settings', asTeacher((req) => {
    if ('allowSignup' in body(req)) teacher.settings.set('allowSignup', Boolean(body(req).allowSignup));
    return { settings: teacher.settings.all() };
  }));

  return router;
}

module.exports = { createPlatformRouter, requireStudent, handle };
