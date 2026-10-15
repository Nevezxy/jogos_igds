// src/games/memoria/server.js
// 🃏 Jogo da Memória no servidor: refaz a mesa pela semente e a partida
// pelas cartas viradas (de duas em duas), confere que todas foram achadas
// e que o tempo é possível, e calcula as estrelas.

const Levels = require('../../../public/games/memoria/levels.js');
const Cards = require('../../../public/games/memoria/cards.js');
const { createPuzzleServer, invalid, seedOf } = require('../puzzle');

const MIN_MS_PER_TRY = 350; // virar duas cartas e olhar leva pelo menos isso

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'best',
  lower: true,
  check(body, level, durationMs) {
    const deck = Cards.makeDeck(level, seedOf(body));
    const r = Cards.replay(deck, body.flips, { versus: Boolean(level.robot) });
    if (!r.ok || !r.done) throw invalid();
    // contra o robô, só as jogadas da criança contam no tempo mínimo
    if (!level.robot && durationMs < r.tries * MIN_MS_PER_TRY) throw invalid();
    const outcome = r.pairsBy[0] > r.pairsBy[1] ? 'win' : r.pairsBy[0] === r.pairsBy[1] ? 'draw' : 'loss';
    const stars = Levels.starsFor(level, { tries: r.tries, pairs: level.pairs, outcome });
    return {
      stars,
      record: level.robot ? null : r.tries,
      accuracy: Math.round((level.pairs / r.tries) * 100),
      details: { tries: r.tries, pairs: level.pairs, ...(level.robot ? { outcome, pairsBy: r.pairsBy } : {}) },
    };
  },
});

// 🏃 Modo Maratona (src/marathon/catalog.js): quanto tempo a fase leva
// (estMs), o que fica de fora, a qualidade do resultado já validado (0 a 1,
// desempata entre quem tem as mesmas estrelas) e a força da validação.
module.exports.marathon = {
  trust: 'forte',
  estMs: (level) => level.pairs * 2 * 2500 + 10000,
  exclude: (level) => (level.robot ? 'contra o robô' : null),
  quality: (r) => r.accuracy / 100, // pares ÷ tentativas
};
