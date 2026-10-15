// src/games/dama/server.js
// ⚫⚪ Dama no servidor: o mesmo juiz de todos os jogos de tabuleiro
// (src/games/boardgame.js), com as regras e as fases do jogo.

const Rules = require('../../../public/games/dama/rules.js');
const Levels = require('../../../public/games/dama/levels.js');
const { createBoardServer } = require('../boardgame');

module.exports = createBoardServer({ Rules, Levels });

// 🏃 Modo Maratona (src/marathon/catalog.js): quanto tempo a fase leva
// (estMs), o que fica de fora, a qualidade do resultado já validado (0 a 1,
// desempata entre quem tem as mesmas estrelas) e a força da validação.
module.exports.marathon = {
  trust: 'forte',
  exclude: () => 'contra o robô', // na Maratona é duelo pela rede
  // partida longa: só no nível 4, com prazo e decisão por material (decisão D3)
  duels: [{ variant: 'brasileira', title: 'Dama brasileira', tier: 4, estMs: 600000, capped: true }],
};
