// src/games/ligue4/server.js
// 🔴🟡 Ligue 4 (e Ligue 5) no servidor: o mesmo juiz de todos os jogos de
// tabuleiro (src/games/boardgame.js), com as regras e as fases do Ligue 4.

const Rules = require('../../../public/games/ligue4/rules.js');
const Levels = require('../../../public/games/ligue4/levels.js');
const { createBoardServer } = require('../boardgame');

module.exports = createBoardServer({ Rules, Levels });

// 🏃 Modo Maratona (src/marathon/catalog.js): quanto tempo a fase leva
// (estMs), o que fica de fora, a qualidade do resultado já validado (0 a 1,
// desempata entre quem tem as mesmas estrelas) e a força da validação.
module.exports.marathon = {
  trust: 'forte',
  exclude: () => 'contra o robô', // na Maratona é duelo pela rede
  duels: [
    { variant: '4', title: 'Ligue 4', tier: 2, estMs: 180000 },
    { variant: '5', title: 'Ligue 5', tier: 3, estMs: 300000 },
  ],
};
