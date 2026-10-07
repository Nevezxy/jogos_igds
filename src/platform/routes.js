// src/platform/routes.js
// Rotas HTTP do núcleo da plataforma (contas). O token de sessão do educando
// vai no cabeçalho "X-Student-Token".

const express = require('express');
const accounts = require('./accounts');

function readToken(req) {
  return req.get('x-student-token') || null;
}

// Envolve um handler: devolve { ok: true, ...resultado } ou o erro em JSON.
function handle(fn) {
  return (req, res) => {
    try {
      res.json({ ok: true, ...fn(req) });
    } catch (e) {
      if (e instanceof accounts.AccountError) {
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

function createPlatformRouter() {
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

  return router;
}

module.exports = { createPlatformRouter, requireStudent, handle };
