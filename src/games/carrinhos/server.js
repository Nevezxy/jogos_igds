// src/games/carrinhos/server.js
// 🚗 Carrinhos no servidor: refaz as jogadas uma a uma no estacionamento da
// fase (todas têm que valer), confere que o carro vermelho saiu e dá as
// estrelas pelo mínimo de jogadas (que vem do banco, calculado por busca).

const Levels = require('../../../public/games/carrinhos/levels.js');
const T = require('../../../public/games/carrinhos/traffic.js');
const { hintsAllowed } = require('../../../public/js/shared/puzzlelevels.js');
const { createPuzzleServer, invalid } = require('../puzzle');

const MIN_MS_PER_MOVE = 200;

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'best',
  lower: true,
  check(body, level, durationMs) {
    const r = T.replay(T.parse(level.board), body.moves);
    if (!r.ok || !r.done || r.moves < level.min || durationMs < r.moves * MIN_MS_PER_MOVE) throw invalid();
    const hints = Math.max(0, Math.floor(Number(body.hints) || 0));
    // até 3 dicas e depois uma a cada 2 minutos: mais que isso não dá
    if (hints > hintsAllowed(level, durationMs)) throw invalid();
    const stars = Levels.starsFor(level, { moves: r.moves, hints });
    return { stars, record: r.moves, accuracy: Math.round((level.min / r.moves) * 100), details: { moves: r.moves, min: level.min, hints } };
  },
});
