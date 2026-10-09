// src/games/labirinto/server.js
// 🌀 Labirinto no servidor: refaz o labirinto pela semente e o caminho
// comando a comando (paredes, portas e chaves com as mesmas regras),
// confere que chegou na saída e dá as estrelas pelo caminho mais curto.

const Levels = require('../../../public/games/labirinto/levels.js');
const M = require('../../../public/games/labirinto/maze.js');
const { createPuzzleServer, invalid, seedOf } = require('../puzzle');

const MIN_MS_PER_STEP = 60;

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'best',
  lower: true,
  check(body, level, durationMs) {
    const m = M.makeMaze(level, seedOf(body));
    const r = M.replay(m, body.cmds, level.mode === 'relative');
    if (!r.ok || !r.done || durationMs < r.steps * MIN_MS_PER_STEP) throw invalid();
    const stars = Levels.starsFor(level, { steps: r.steps, shortest: m.shortest });
    return { stars, record: r.steps, accuracy: Math.round((m.shortest / r.steps) * 100), details: { steps: r.steps, shortest: m.shortest, bumps: r.bumps } };
  },
});
