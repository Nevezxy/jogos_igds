// src/games/hanoi/server.js
// 🗼 Torre de Hanói no servidor: refaz a fase pela semente e os movimentos
// um a um (todos têm que valer), confere que chegou no objetivo e calcula
// as estrelas pelo mínimo de movimentos.

const Levels = require('../../../public/games/hanoi/levels.js');
const H = require('../../../public/games/hanoi/hanoi.js');
const { createPuzzleServer, invalid, seedOf } = require('../puzzle');

const MIN_MS_PER_MOVE = 150;

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'best',
  lower: true,
  check(body, level, durationMs) {
    const game = H.setup(level, seedOf(body));
    const r = H.replay(game, body.moves);
    if (!r.ok || !r.done || durationMs < r.moves * MIN_MS_PER_MOVE) throw invalid();
    const hints = Math.max(0, Math.floor(Number(body.hints) || 0));
    const stars = Levels.starsFor(level, { moves: r.moves, min: game.min, hints });
    return { stars, record: r.moves, accuracy: Math.round((game.min / r.moves) * 100), details: { moves: r.moves, min: game.min, hints } };
  },
});
