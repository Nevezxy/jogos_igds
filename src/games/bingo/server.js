// src/games/bingo/server.js
// Ponto de entrada do bingo para a plataforma (ver src/games/registry.js):
// o bingo é um jogo em tempo real, então só registra seus eventos de socket.

const { registerSocketHandlers } = require('./socketHandlers');

module.exports = {
  registerSockets: registerSocketHandlers,
};
