// public/js/shared/puzzlelevels.js
// Monta mundos e fases dos jogos de raciocínio (o mesmo arquivo serve ao
// navegador, para o mapa, e ao servidor, para conferir). Cada fase ganha
// world, index, indexInWorld; o resto (o que a fase pede) é do jogo.

(function (root) {
  function build(WORLDS) {
    const LEVELS = [];
    WORLDS.forEach((world, w) => {
      world.levels.forEach((level, i) => {
        Object.assign(level, { world: world.id, worldIndex: w, indexInWorld: i, index: LEVELS.length });
        if (!level.fullTitle) level.fullTitle = level.title;
        LEVELS.push(level);
      });
    });
    const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
    const getLevel = (id) => BY_ID[id] || null;
    const getWorld = (id) => WORLDS.find((w) => w.id === id) || null;
    const starsOf = (progress, id) => (progress && progress.levels && progress.levels[id] ? progress.levels[id].stars || 0 : 0);
    return {
      WORLDS, LEVELS, MAX_STARS: LEVELS.length * 3,
      getLevel, getWorld, starsOf,
      nextLevel: (progress) => LEVELS.find((l) => starsOf(progress, l.id) === 0) || null,
      totalStars: (progress) => LEVELS.reduce((n, l) => n + starsOf(progress, l.id), 0),
      isUnlocked: (progress, id) => Boolean(getLevel(id)),
    };
  }

  // estrelas por "quanto passou do mínimo": até a × mínimo = 3, até b × mínimo = 2
  function starsByRatio(value, min, [a, b]) {
    if (value <= Math.ceil(min * a)) return 3;
    if (value <= Math.ceil(min * b)) return 2;
    return 1;
  }

  // 💡 Dicas: até `limit` por fase (ou `level.hintLimit`); depois, uma nova a
  // cada 2 minutos. O servidor confere: numa fase que durou t, cabem no
  // máximo limit + t / 2 min dicas.
  const HINTS = { limit: 3, cooldownMs: 2 * 60 * 1000 };
  const hintLimit = (level) => (level && level.hintLimit != null ? level.hintLimit : HINTS.limit);
  const hintsAllowed = (level, durationMs) => hintLimit(level) + Math.floor(Math.max(0, durationMs) / HINTS.cooldownMs);

  const hintRule = (level) => {
    const n = hintLimit(level);
    return `⏳ Até ${n} dica${n === 1 ? '' : 's'} por fase. Depois, uma nova dica a cada 2 minutos.`;
  };

  const api = { build, starsByRatio, HINTS, hintLimit, hintsAllowed, hintRule };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuzzleLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
