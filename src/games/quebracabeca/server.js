// src/games/quebracabeca/server.js
// 🧩 Quebra-cabeça no servidor: confere que todas as peças da fase foram
// encaixadas (cada uma uma vez só), que o tempo é possível e dá as estrelas
// pelo tempo (o recorde é o menor tempo, em segundos).

const Levels = require('../../../public/games/quebracabeca/levels.js');
const { createPuzzleServer, invalid } = require('../puzzle');

const MIN_MS_PER_PIECE = 700;

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'best',
  lower: true,
  check(body, level, durationMs) {
    const placed = body.placed;
    if (!Array.isArray(placed) || placed.length !== level.pieces) throw invalid();
    const seen = new Set(placed);
    if (seen.size !== level.pieces || placed.some((i) => !Number.isInteger(i) || i < 0 || i >= level.pieces)) throw invalid();
    if (durationMs < level.pieces * MIN_MS_PER_PIECE) throw invalid();
    const seconds = Math.round(durationMs / 1000);
    const stars = Levels.starsFor(level, { seconds });
    return { stars, record: seconds, details: { seconds, pieces: level.pieces, turns: Math.max(0, Math.floor(Number(body.turns) || 0)) } };
  },
});
