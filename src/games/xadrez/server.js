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
  // o Fim de partida é corrida (a mesma posição para os dois); as partidas
  // contra o robô ficam de fora, e a partida inteira é duelo pela rede
  exclude: (level) => (level.world === 'xf' ? null : 'contra o robô'),
  estMs: (level) => level.par * 20000 + 40000,
  // mate dentro do número de lances (3 ⭐) e quanto sobrou deles
  quality: (r, level) => Math.min(1, level.par / Math.max(1, Math.ceil(r.details.moves / 2))), // a criança joga os lances ímpares
  duels: [{ variant: 'classico', title: 'Partida de xadrez', tier: 4, estMs: 900000, capped: true }],
};
