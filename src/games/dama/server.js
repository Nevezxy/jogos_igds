// src/games/dama/server.js
// ⚫⚪ Dama no servidor: o mesmo juiz de todos os jogos de tabuleiro
// (src/games/boardgame.js), com as regras e as fases do jogo.

const Rules = require('../../../public/games/dama/rules.js');
const Levels = require('../../../public/games/dama/levels.js');
const { createBoardServer } = require('../boardgame');

module.exports = createBoardServer({ Rules, Levels });
