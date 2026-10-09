// src/games/ligue4/server.js
// 🔴🟡 Ligue 4 (e Ligue 5) no servidor: o mesmo juiz de todos os jogos de
// tabuleiro (src/games/boardgame.js), com as regras e as fases do Ligue 4.

const Rules = require('../../../public/games/ligue4/rules.js');
const Levels = require('../../../public/games/ligue4/levels.js');
const { createBoardServer } = require('../boardgame');

module.exports = createBoardServer({ Rules, Levels });
