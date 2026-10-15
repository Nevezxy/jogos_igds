// src/games/velha/server.js
// ❌⭕ Jogo da Velha no servidor: o mesmo juiz de todos os jogos de
// tabuleiro (src/games/boardgame.js), com as regras e as fases da Velha.

const Rules = require('../../../public/games/velha/rules.js');
const Levels = require('../../../public/games/velha/levels.js');
const { createBoardServer } = require('../boardgame');

module.exports = createBoardServer({ Rules, Levels });
