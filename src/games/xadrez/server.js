// src/games/xadrez/server.js
// ♟️ Xadrez no servidor: o mesmo juiz de todos os jogos de tabuleiro
// (src/games/boardgame.js), com as regras e as fases do jogo.

const Rules = require('../../../public/games/xadrez/rules.js');
const Levels = require('../../../public/games/xadrez/levels.js');
const { createBoardServer } = require('../boardgame');

module.exports = createBoardServer({ Rules, Levels });

// 🏃 Modo Maratona (src/marathon/catalog.js): quanto tempo a fase leva
// (estMs), o que fica de fora, a qualidade do resultado já validado (0 a 1,
// desempata entre quem tem as mesmas estrelas) e a força da validação.
module.exports.marathon = {
  trust: 'forte',
  // na Maratona o xadrez é sempre jogador contra jogador: as partidas contra
  // o robô e o Fim de partida (corrida) ficam de fora, em todos os níveis
  exclude: (level) => (level.world === 'xf' ? 'na Maratona é só partida entre jogadores' : 'contra o robô'),
  estMs: (level) => level.par * 20000 + 40000,
  quality: (r, level) => Math.min(1, level.par / Math.max(1, Math.ceil(r.details.moves / 2))), // a criança joga os lances ímpares
  duels: [{ variant: 'classico', title: 'Partida de xadrez', tier: 1, estMs: 900000, capped: true }],
  // desempate no fim do tempo da rodada: pontos das peças capturadas
  // (peão 1, cavalo e bispo 3, torre 5, dama 9). Devolve os pontos que quem
  // acabou de jogar ganhou neste lance (as peças do outro lado só somem
  // quando são capturadas; a promoção não conta).
  pieceValues: { P: 1, N: 3, B: 3, R: 5, Q: 9 },
  captureValue(prev, next) {
    const V = module.exports.marathon.pieceValues;
    const enemy = 1 - prev.turn;
    const sum = (st) => st.board.reduce((acc, p) => acc + (p !== '.' && Rules.colorOf(p) === enemy ? V[p.toUpperCase()] || 0 : 0), 0);
    return Math.max(0, sum(prev) - sum(next));
  },
};
