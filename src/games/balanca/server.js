// src/games/balanca/server.js
// ⚖️ Equilibre a Balança no servidor: refaz as tarefas pela semente, confere
// que cada balança ficou reta com os pesos informados (e, no "quanto
// pesa?", que a resposta está certa) e dá as estrelas pelas jogadas a mais.

const Levels = require('../../../public/games/balanca/levels.js');
const S = require('../../../public/games/balanca/scale.js');
const { createPuzzleServer, invalid, seedOf } = require('../puzzle');

const MIN_MS_PER_TASK = 1200;

module.exports = createPuzzleServer({
  Levels,
  recordKey: 'bestExtra',
  lower: true,
  check(body, level, durationMs) {
    const tasks = S.makeRound(level, seedOf(body));
    const list = body.tasks;
    if (!Array.isArray(list) || list.length !== tasks.length || durationMs < tasks.length * MIN_MS_PER_TASK) throw invalid();
    const ask = level.mode === 'unknown' || level.ask;
    let extra = 0;
    tasks.forEach((t, i) => {
      const a = list[i] || {};
      const r = S.weigh(t, a);
      const moves = Math.floor(Number(a.moves) || 0);
      const wrong = Math.max(0, Math.floor(Number(a.wrong) || 0));
      if (!r.valid || !r.ok || moves < r.used || moves > 500 || wrong > 3) throw invalid();
      if (level.mode !== 'both' && Array.isArray(a.L) && a.L.length) throw invalid();
      if (ask && Number(a.answer) !== t.object.weight) throw invalid();
      extra += Math.max(0, moves - t.min) + wrong * 2;
    });
    const stars = Levels.starsFor(level, { extra, count: tasks.length });
    return { stars, record: extra, details: { extra, count: tasks.length } };
  },
});
