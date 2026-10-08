// public/js/shared/falling.js
// Motor de queda dos jogos "Cadentes" (Letras e Números Cadentes): as peças
// nascem no topo do céu, em lugares diferentes, e descem até o chão. O jogo
// diz o que cada peça mostra e o que fazer quando ela é pega ou cai.
//
// const round = FallingEngine.create(sky, {
//   items,          lista do que vai cair (na ordem)
//   fallMs,         tempo para uma peça ir do topo ao chão
//   intervalMs,     tempo entre uma peça e a próxima
//   maxOnScreen,    quantas peças podem estar caindo ao mesmo tempo
//                   (os três aceitam um número ou uma função (índice) => valor:
//                   assim a rodada pode acelerar da primeira à última peça)
//   render(item, index), devolve o elemento da peça
//   onSpawn(piece), nasceu uma peça (opcional)
//   onLand(piece),  a peça chegou ao chão (já foi tirada da tela)
//   onEnd(),        não há mais peças para cair nem caindo
// })
// round.start() · pause() · resume() · destroy() · pieces() (as que estão
// caindo, a mais perto do chão primeiro) · catchPiece(piece) · elapsed()
// (tempo jogado, sem as pausas) · freeze(ms) (tudo para de cair por um
// tempo; o 🧊 dos jogos) · isFrozen().
//
// Sem peça na tela, a próxima nasce na hora (ninguém fica esperando). A
// animação mexe só em `transform`, para rodar bem nos computadores da escola.

(function () {
  function create(sky, opts) {
    const { items, fallMs, intervalMs, maxOnScreen = 3, render, onSpawn, onLand, onEnd } = opts;
    let next = 0; // próximo item a nascer
    let active = []; // { el, item, index, x, t (0..1), width }
    let running = false;
    let ended = false;
    let raf = null;
    let last = 0; // último quadro
    let sinceSpawn = Infinity;
    let playedMs = 0;
    let frozenUntil = 0;
    const at = (v, i) => (typeof v === 'function' ? v(i) : v);

    const skySize = () => ({ w: sky.clientWidth, h: sky.clientHeight });

    // Lugar no topo longe das peças que acabaram de nascer.
    function pickX(width) {
      const { w } = skySize();
      const free = Math.max(0, w - width);
      let best = Math.random() * free;
      let bestGap = -1;
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * free;
        const gap = Math.min(Infinity, ...active.filter((p) => p.t < 0.35).map((p) => Math.abs(p.x - x)));
        if (gap > bestGap) { best = x; bestGap = gap; }
      }
      return best;
    }

    function spawn() {
      const item = items[next];
      const el = render(item, next);
      el.classList.add('fall-piece');
      el.style.transform = 'translate(-9999px, 0)';
      sky.appendChild(el);
      const width = el.offsetWidth;
      const piece = { el, item, index: next, x: pickX(width), t: 0, width, fallMs: at(fallMs, next) };
      active.push(piece);
      next++;
      sinceSpawn = 0;
      place(piece);
      onSpawn && onSpawn(piece);
    }

    function place(piece) {
      const { h } = skySize();
      const y = piece.t * (h - piece.el.offsetHeight);
      piece.el.style.transform = `translate(${piece.x}px, ${y}px)`;
    }

    function remove(piece) {
      active = active.filter((p) => p !== piece);
    }

    function checkEnd() {
      if (!ended && next >= items.length && active.length === 0) {
        ended = true;
        stopLoop();
        onEnd && onEnd();
      }
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(100, now - last); // aba voltando do fundo não pula
      last = now;
      playedMs += dt;
      if (playedMs < frozenUntil) { raf = requestAnimationFrame(frame); return; } // congelado
      sinceSpawn += dt;
      for (const piece of active.slice()) {
        piece.t += dt / piece.fallMs;
        if (piece.t >= 1) {
          piece.t = 1;
          remove(piece);
          piece.el.classList.add('is-landed');
          setTimeout(() => piece.el.remove(), 600);
          onLand && onLand(piece);
        } else {
          place(piece);
        }
      }
      const canSpawn = next < items.length && active.length < at(maxOnScreen, next);
      if (canSpawn && (active.length === 0 || sinceSpawn >= at(intervalMs, next))) spawn();
      checkEnd();
      if (running) raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running || ended) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stopLoop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    return {
      start: startLoop,
      pause: stopLoop,
      resume: startLoop,
      isRunning: () => running,
      freeze(ms) { frozenUntil = playedMs + ms; },
      isFrozen: () => playedMs < frozenUntil,
      isEnded: () => ended,
      elapsed: () => playedMs,
      pieces: () => active.slice().sort((a, b) => b.t - a.t),
      // peça pega: sai da tela com uma animação
      catchPiece(piece) {
        remove(piece);
        piece.el.classList.add('is-caught');
        setTimeout(() => piece.el.remove(), 450);
        checkEnd();
      },
      destroy() {
        stopLoop();
        ended = true;
        active.forEach((p) => p.el.remove());
        active = [];
      },
    };
  }

  window.FallingEngine = { create };
})();
