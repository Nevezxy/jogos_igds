// public/js/shared/boardlevels.js
// Monta o mapa de fases dos jogos de tabuleiro: cada fase é um nível do
// robô, num mundo que é uma variante do jogo (ex.: Velha 3 × 3, Velha 4 × 4).
// O mesmo arquivo serve ao navegador (mapa) e ao servidor (estrelas).
//
// Fase: { id, title, tip, bot: { depth, random, noise, maxMs }, undo,
//         drawIsWin, variant?, seat?, par? }
//   undo       pode desfazer (só nos níveis fáceis)
//   drawIsWin  contra o robô perfeito não dá para ganhar: empatar já vale
//   variant    a fase tem a própria posição inicial (ex.: "Fim de partida" do
//              xadrez); senão vale a do mundo. Mundo com friend: false não
//              aparece no "jogar com um amigo"
//   seat       a criança joga sempre com essa cor (0 = quem começa)
//   par        vencer em até par lances da criança; passando disso, no máximo ⭐⭐
// Estrelas: ⭐⭐⭐ venceu sem desfazer, ⭐⭐ venceu desfazendo, ⭐ empatou.

(function (root) {
  function build(WORLDS) {
    const LEVELS = [];
    WORLDS.forEach((world, w) => {
      world.levels.forEach((level, i) => {
        Object.assign(level, {
          world: world.id,
          variant: level.variant || world.variant,
          worldIndex: w,
          indexInWorld: i,
          index: LEVELS.length,
          fullTitle: `${level.title} · ${world.short || world.name}`,
        });
        LEVELS.push(level);
      });
    });
    const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
    const getLevel = (id) => BY_ID[id] || null;
    const getWorld = (id) => WORLDS.find((w) => w.id === id) || null;
    const OUTCOMES = ['win', 'draw', 'loss'];

    function starsFor(levelId, outcome, undos = 0, myMoves = 0) {
      const level = getLevel(levelId);
      if (!level) return 0;
      const won = outcome === 'win' || (outcome === 'draw' && level.drawIsWin);
      if (won) return undos || (level.par && myMoves > level.par) ? 2 : 3;
      return outcome === 'draw' ? 1 : 0;
    }
    const starsOf = (progress, id) => (progress && progress.levels && progress.levels[id] ? progress.levels[id].stars || 0 : 0);
    const nextLevel = (progress) => LEVELS.find((l) => starsOf(progress, l.id) < 2) || null;
    const totalStars = (progress) => LEVELS.reduce((n, l) => n + starsOf(progress, l.id), 0);
    // as variantes para jogar com um amigo (sem repetir)
    const variants = () => {
      const seen = new Set();
      return WORLDS.filter((w) => w.variant && w.friend !== false && !seen.has(w.variant) && seen.add(w.variant))
        .map((w) => ({ id: w.variant, label: w.friendLabel || w.name }));
    };

    return {
      WORLDS, LEVELS, OUTCOMES, MAX_STARS: LEVELS.length * 3,
      getLevel, getWorld, starsFor, starsOf, nextLevel, totalStars, variants,
      isUnlocked: (progress, id) => Boolean(getLevel(id)),
    };
  }

  const api = { build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
