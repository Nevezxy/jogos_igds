// src/games/pixel/server.js
// 🎨 Pixel Art no servidor: refaz a pintura jogada por jogada (pincel e
// balde), confere que o desenho ficou todo certo e conta os erros para as
// estrelas.

const Levels = require('../../../public/games/pixel/levels.js');
const R = require('../../../public/games/pixel/pixel.js');
const { createPuzzleServer, invalid } = require('../puzzle');

const MIN_MS_PER_ACTION = 25;

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'best',
  lower: true,
  check(body, level, durationMs) {
    const pic = R.parse(Levels.designOf(level));
    const r = R.replay(pic, body.actions);
    if (!r.ok || !r.done || durationMs < Math.max(3000, r.actions * MIN_MS_PER_ACTION)) throw invalid();
    const stars = Levels.starsFor(level, { errors: r.errors, total: pic.total });
    return { stars, record: r.errors, accuracy: Math.round((pic.total / (pic.total + r.errors)) * 100), details: { errors: r.errors, cells: pic.total } };
  },
});

// 🏃 Modo Maratona (src/marathon/catalog.js): quanto tempo a fase leva
// (estMs), o que fica de fora, a qualidade do resultado já validado (0 a 1,
// desempata entre quem tem as mesmas estrelas) e a força da validação.
module.exports.marathon = {
  trust: 'forte',
  estMs: (level) => R.parse(Levels.designOf(level)).total * (level.bucket ? 250 : 450) + 10000,
  quality: (r) => r.accuracy / 100, // casas ÷ (casas + erros)
};
