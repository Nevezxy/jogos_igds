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
  exclude: () => 'contra o robô', // na Maratona é sempre jogador contra jogador
  // partida longa: em todos os níveis, cortada pelo tempo da rodada
  duels: [{ variant: 'brasileira', title: 'Dama brasileira', tier: 1, estMs: 600000, capped: true }],
  // desempate no fim do tempo da rodada: pontos das peças capturadas
  // (pedra 1, dama 3). Devolve os pontos que quem acabou de jogar ganhou
  // neste lance (virar dama não conta).
  pieceValues: { pedra: 1, dama: 3 },
  captureValue(prev, next) {
    const V = module.exports.marathon.pieceValues;
    const enemy = 1 - prev.turn;
    const sum = (st) => st.board.reduce((acc, p) => acc + (Rules.sideOf(p) === enemy ? (Rules.isKing(p) ? V.dama : V.pedra) : 0), 0);
    return Math.max(0, sum(prev) - sum(next));
  },
};
