// src/games/diferencas/server.js
// 🔍 Encontre a Diferença no servidor: refaz a cena pela semente e os
// toques um a um (cada um acha uma diferença ou é um erro), confere que
// todas foram achadas e dá as estrelas pelos erros e dicas.

const Levels = require('../../../public/games/diferencas/levels.js');
const S = require('../../../public/games/diferencas/scene.js');
const { createPuzzleServer, invalid, seedOf } = require('../puzzle');

const MIN_MS_PER_DIFF = 600;

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'best',
  lower: true,
  check(body, level, durationMs) {
    const scene = S.makeScene(level, seedOf(body));
    const r = S.replay(scene, body.clicks);
    if (!r.ok || !r.done || durationMs < scene.diffs.length * MIN_MS_PER_DIFF) throw invalid();
    const hints = Math.max(0, Math.min(scene.diffs.length, Math.floor(Number(body.hints) || 0)));
    const stars = Levels.starsFor(level, { errors: r.errors, hints });
    return { stars, record: r.errors, accuracy: Math.round((scene.diffs.length / r.clicks) * 100), details: { errors: r.errors, hints, diffs: scene.diffs.length } };
  },
});
