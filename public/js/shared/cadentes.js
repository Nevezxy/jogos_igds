// public/js/shared/cadentes.js
// O que deixa os jogos "Cadentes" (Letras e Números) mais emocionantes,
// igual nos dois:
//   • pontos e combo: acertos seguidos multiplicam os pontos (×2 a cada 5
//     acertos, até ×5); errar uma tecla ou deixar uma peça cair zera o combo
//   • peças especiais, de vez em quando: ⭐ dourada (bônus), 🧊 gelo (o céu
//     congela por 3 s) e 💥 bomba (estoura todas as peças da tela)
//   • os "+20" que sobem do lugar do acerto
// O recorde de pontos de cada fase fica no progresso (servidor).

(function () {
  const MAX_MULT = 5;
  const COMBO_STEP = 5; // a cada 5 acertos seguidos, o multiplicador sobe
  const SPECIAL_CHANCE = 0.12;
  const FREEZE_MS = 3000;
  const GOLD_BONUS = 50;
  const SPECIALS = {
    gold: { badge: '⭐', label: 'Dourada: vale mais pontos!' },
    ice: { badge: '🧊', label: 'Gelo: congela o céu!' },
    bomb: { badge: '💥', label: 'Bomba: estoura tudo!' },
  };

  function createScorer({ onMultiplier } = {}) {
    let score = 0;
    let streak = 0;
    let bestStreak = 0;
    const mult = () => Math.min(MAX_MULT, 1 + Math.floor(streak / COMBO_STEP));
    return {
      // um acerto: devolve os pontos ganhos
      hit(base, { gold = false } = {}) {
        const before = mult();
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        const m = mult();
        const points = (base + (gold ? GOLD_BONUS : 0)) * m;
        score += points;
        if (m > before && onMultiplier) onMultiplier(m);
        return points;
      },
      miss() { streak = 0; },
      get score() { return score; },
      get streak() { return streak; },
      get bestStreak() { return bestStreak; },
      get multiplier() { return mult(); },
    };
  }

  // Quais peças serão especiais (nunca as 3 primeiras; no máximo ~12%).
  function pickSpecials(count) {
    return Array.from({ length: count }, (_, i) => {
      if (i < 3 || Math.random() > SPECIAL_CHANCE) return null;
      const r = Math.random();
      return r < 0.5 ? 'gold' : r < 0.75 ? 'ice' : 'bomb';
    });
  }

  function decorate(el, type) {
    if (!type) return;
    el.classList.add(`is-${type}`);
    const badge = document.createElement('span');
    badge.className = 'cad-badge';
    badge.textContent = SPECIALS[type].badge;
    badge.title = SPECIALS[type].label;
    el.appendChild(badge);
  }

  // texto que sobe e some ("+20", "×3!") a partir de um elemento
  function floatText(sky, el, text, cls = '') {
    const s = sky.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const t = document.createElement('div');
    t.className = `cad-float ${cls}`.trim();
    t.textContent = text;
    t.style.left = `${r.left - s.left + r.width / 2}px`;
    t.style.top = `${r.top - s.top}px`;
    sky.appendChild(t);
    setTimeout(() => t.remove(), 1000);
  }

  window.CadentesKit = { createScorer, pickSpecials, decorate, floatText, FREEZE_MS, MAX_MULT, SPECIALS };
})();
