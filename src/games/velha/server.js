// src/games/velha/server.js
// ❌⭕ Jogo da Velha no servidor: o mesmo juiz de todos os jogos de
// tabuleiro (src/games/boardgame.js), com as regras e as fases da Velha.

const Rules = require('../../../public/games/velha/rules.js');
const Levels = require('../../../public/games/velha/levels.js');
const { createBoardServer } = require('../boardgame');

module.exports = createBoardServer({ Rules, Levels });

// 🏃 Modo Maratona (src/marathon/catalog.js): quanto tempo a fase leva
// (estMs), o que fica de fora, a qualidade do resultado já validado (0 a 1,
// desempata entre quem tem as mesmas estrelas) e a força da validação.
module.exports.marathon = {
  trust: 'forte',
  exclude: () => 'contra o robô', // na Maratona a Velha é duelo pela rede
  duels: [
    { variant: '3x3', title: 'Velha 3 × 3', tier: 1, estMs: 60000 },
    { variant: '4x4', title: 'Velha 4 × 4', tier: 2, estMs: 180000 },
  ],
};
