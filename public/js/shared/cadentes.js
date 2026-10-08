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

  // Placar grande dentro do céu (atrás das peças, para não tapar o jogo):
  // pontos que contam até o valor novo, o multiplicador 🔥 ×N com a barra
  // até o próximo, os acertos seguidos e o recorde da fase. Combo novo,
  // recorde batido e marcos (10, 20, 30 seguidos) viram um letreiro grande no
  // meio do céu, e a borda do céu esquenta conforme o combo.
  // Funciona como um scorer: board.hit(base, {gold}) / board.miss().
  function createBoard(sky, { best = 0, onMultiplier } = {}) {
    sky.querySelectorAll('.cad-board, .cad-banner').forEach((el) => el.remove());
    const board = document.createElement('div');
    board.className = 'cad-board';
    board.setAttribute('aria-hidden', 'true');
    board.innerHTML = `
      <div class="cad-board-score"><small>pontos</small><b>0</b></div>
      <div class="cad-board-combo">
        <span class="cad-board-mult">🔥 ×1</span>
        <span class="cad-board-bar">${'<i></i>'.repeat(COMBO_STEP)}</span>
        <span class="cad-board-streak"></span>
      </div>
      <div class="cad-board-best"></div>`;
    sky.appendChild(board);
    const scoreEl = board.querySelector('.cad-board-score b');
    const multEl = board.querySelector('.cad-board-mult');
    const bars = [...board.querySelectorAll('.cad-board-bar i')];
    const streakEl = board.querySelector('.cad-board-streak');
    const bestEl = board.querySelector('.cad-board-best');
    let shown = 0;
    let anim = null;
    let beatBest = false;

    const scorer = createScorer({
      onMultiplier(m) {
        banner(`COMBO ×${m}!`, `is-tier${m}`);
        if (onMultiplier) onMultiplier(m);
      },
    });

    function pulse(el, cls = 'is-pulse') {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    }
    function banner(text, cls = '') {
      const b = document.createElement('div');
      b.className = `cad-banner ${cls}`.trim();
      b.textContent = text;
      sky.appendChild(b);
      setTimeout(() => b.remove(), 1300);
    }
    // os pontos sobem contando, rapidinho
    function countTo(target) {
      cancelAnimationFrame(anim);
      const from = shown;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 380);
        shown = Math.round(from + (target - from) * k);
        scoreEl.textContent = shown;
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }
    function render() {
      const m = scorer.multiplier;
      const s = scorer.streak;
      multEl.textContent = `🔥 ×${m}`;
      board.dataset.tier = m;
      sky.dataset.combo = m;
      const filled = m >= MAX_MULT ? COMBO_STEP : s % COMBO_STEP;
      bars.forEach((el, i) => el.classList.toggle('is-on', i < filled));
      streakEl.textContent = s >= 2 ? `${s} seguidas` : '';
      bestEl.textContent = best ? (beatBest ? '🏆 NOVO RECORDE!' : `🏆 recorde ${best}`) : '';
      bestEl.classList.toggle('is-new', beatBest);
    }

    render();
    return {
      hit(base, opts) {
        const points = scorer.hit(base, opts);
        countTo(scorer.score);
        pulse(board.querySelector('.cad-board-score'));
        const s = scorer.streak;
        if (s % 10 === 0) banner(`${s} seguidas! 🔥`, 'is-streak');
        if (best && !beatBest && scorer.score > best) {
          beatBest = true;
          setTimeout(() => banner('🏆 NOVO RECORDE!', 'is-record'), 350);
        }
        render();
        return points;
      },
      miss() {
        const lost = scorer.streak;
        scorer.miss();
        if (lost >= 3) {
          pulse(board, 'is-broken');
          banner('💔 combo perdido', 'is-lost');
        }
        render();
      },
      destroy() { cancelAnimationFrame(anim); board.remove(); delete sky.dataset.combo; },
      get score() { return scorer.score; },
      get streak() { return scorer.streak; },
      get bestStreak() { return scorer.bestStreak; },
      get multiplier() { return scorer.multiplier; },
    };
  }

  window.CadentesKit = { createScorer, createBoard, pickSpecials, decorate, floatText, FREEZE_MS, MAX_MULT, SPECIALS };
})();
