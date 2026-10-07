// src/platform/routes.js
// Rotas HTTP do núcleo da plataforma: contas (/api/auth) e progresso nos
// jogos (/api/progress). O token de sessão do educando vai no cabeçalho
// "X-Student-Token".

const express = require('express');
const accounts = require('./accounts');
const progress = require('./progress');

function readToken(req) {
  return req.get('x-student-token') || null;
}

// Envolve um handler: devolve { ok: true, ...resultado } ou o erro em JSON.
function handle(fn) {
  return (req, res) => {
    try {
      res.json({ ok: true, ...fn(req) });
    } catch (e) {
      if (e instanceof accounts.AccountError || e instanceof progress.GameError) {
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
    const old = progress.getProgress(student.id, game.id);
    const result = game.server.validateResult(body(req), old);
    const updated = progress.recordResult(student.id, game, result);
    return { progress: updated, result: { levelId: result.levelId, stars: result.stars, score: result.score } };
  }));

  return router;
}

module.exports = { createPlatformRouter, requireStudent, handle };
