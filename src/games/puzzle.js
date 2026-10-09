// src/games/puzzle.js
// O lado do servidor dos jogos de raciocínio (Memória, Hanói, Labirinto...),
// igual para todos. Cada jogo passa as fases e um `check(body, level)` que
// refaz a fase pela semente (ou refaz os movimentos), confere que é possível
// e devolve { stars, record, details }:
//   record   o número do recorde da fase (ex.: jogadas, tentativas)
// Aqui ficam o progresso (estrelas e recorde por fase), o resumo do painel,
// o da área do professor e o "juntar contas".

const { GameError } = require('../platform/progress');

function createPuzzleServer({ Levels, check, recordKey = 'best', lower = true }) {
  const better = (a, b) => (b == null ? a : a == null ? b : lower ? Math.min(a, b) : Math.max(a, b));

  function validateResult(body) {
    const level = Levels.getLevel(String(body.levelId || ''));
    if (!level) throw new GameError('FASE_INVALIDA', 'Essa fase não existe.');
    const durationMs = Math.floor(Number(body.durationMs) || 0);
    if (durationMs < 0 || durationMs > 6 * 60 * 60 * 1000) throw new GameError('RESULTADO_INVALIDO', 'Resultado inválido.');
    const r = check(body, level, durationMs);
    return {
      levelId: level.id,
      stars: r.stars,
      score: r.stars,
      record: r.stars >= 1 ? r.record : null,
      accuracy: r.accuracy ?? null,
      durationMs,
      details: r.details || {},
    };
  }

  function mergeProgress(old, r) {
    const p = { levels: {}, plays: 0, totalTimeMs: 0, ...(old || {}) };
    p.levels = { ...p.levels };
    const prev = p.levels[r.levelId] || { stars: 0, plays: 0 };
    p.levels[r.levelId] = {
      ...prev,
      stars: Math.max(prev.stars || 0, r.stars),
      [recordKey]: r.record != null ? better(r.record, prev[recordKey]) : prev[recordKey],
      plays: (prev.plays || 0) + 1,
      lastPlayedAt: Date.now(),
    };
    p.plays += 1;
    p.totalTimeMs += r.durationMs || 0;
    p.lastLevel = r.levelId;
    return p;
  }

  function summary(progress) {
    if (!progress || !progress.levels || !Object.keys(progress.levels).length) return null;
    const next = Levels.nextLevel(progress);
    const stars = Levels.totalStars(progress);
    return next ? `Fase ${next.index + 1} · ⭐ ${stars}` : `🏆 Tudo completo · ⭐ ${stars}`;
  }

  function teacherSummary(progress) {
    const p = progress || { levels: {} };
    const next = Levels.nextLevel(p);
    const done = Object.values(p.levels || {}).filter((l) => l.stars >= 1).length;
    return {
      current: next ? `${Levels.getWorld(next.world).icon} ${next.fullTitle}` : '🏆 completo',
      levelsDone: done,
      totalLevels: Levels.LEVELS.length,
      stars: Levels.totalStars(p),
      maxStars: Levels.MAX_STARS,
      plays: p.plays || 0,
      minutes: Math.round((p.totalTimeMs || 0) / 60000),
    };
  }

  function mergeAccounts(a, b) {
    if (!a) return b;
    if (!b) return a;
    const levels = { ...a.levels };
    for (const [id, lb] of Object.entries(b.levels || {})) {
      const la = levels[id];
      levels[id] = !la ? lb : {
        ...la,
        stars: Math.max(la.stars || 0, lb.stars || 0),
        [recordKey]: better(la[recordKey], lb[recordKey]),
        plays: (la.plays || 0) + (lb.plays || 0),
        lastPlayedAt: Math.max(la.lastPlayedAt || 0, lb.lastPlayedAt || 0),
      };
    }
    return {
      ...a,
      levels,
      plays: (a.plays || 0) + (b.plays || 0),
      totalTimeMs: (a.totalTimeMs || 0) + (b.totalTimeMs || 0),
    };
  }

  return { validateResult, mergeProgress, summary, teacherSummary, mergeAccounts, Levels };
}

const invalid = () => new GameError('RESULTADO_INVALIDO', 'Resultado inválido.');
const seedOf = (body) => {
  const n = Number(body.seed);
  if (!Number.isInteger(n) || n < 0 || n > 0xFFFFFFFF) throw invalid();
  return n;
};

module.exports = { createPuzzleServer, invalid, seedOf };
