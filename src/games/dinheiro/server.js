// src/games/dinheiro/server.js
// 💰 Dinheiro e Troco no servidor: refaz as tarefas da rodada pela semente
// e confere cada resposta (de primeira vale 1, na segunda tentativa ½).

const Levels = require('../../../public/games/dinheiro/levels.js');
const Money = require('../../../public/games/dinheiro/money.js');
const { createPuzzleServer, invalid, seedOf } = require('../puzzle');

const MIN_MS_PER_TASK = 1500;

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'bestScore',
  lower: false,
  check(body, level, durationMs) {
    const tasks = Money.makeRound(level, seedOf(body));
    const answers = body.answers;
    if (!Array.isArray(answers) || answers.length !== tasks.length || durationMs < tasks.length * MIN_MS_PER_TASK) throw invalid();
    let score = 0;
    let first = 0;
    tasks.forEach((t, i) => {
      const tries = answers[i];
      if (!Array.isArray(tries) || tries.length < 1 || tries.length > 2) throw invalid();
      const ok = tries.map((a) => Money.check(t, a, level.money).ok);
      // acertou de primeira: não pode ter uma 2ª tentativa
      if (ok[0] && tries.length > 1) throw invalid();
      if (ok[0]) { score += 1; first++; } else if (ok[1]) score += 0.5;
    });
    const stars = Levels.starsFor(level, { score, count: tasks.length });
    return { stars, record: score, accuracy: Math.round((first / tasks.length) * 100), details: { score, first, count: tasks.length } };
  },
});
