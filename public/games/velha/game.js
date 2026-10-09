// public/games/velha/game.js
// ❌⭕ Jogo da Velha: só o desenho do tabuleiro. O resto (robôs, partida
// com amigo pela rede, estrelas) é o mesmo de todos os jogos de tabuleiro
// (js/shared/boardgame.js).

(function () {
  const Rules = window.VelhaRules;
  const PIECES = ['✕', '◯'];

  function makeBoard(el, variant) {
    const { n } = Rules.VARIANTS[variant];
    el.classList.add('vh-board');
    el.style.setProperty('--n', n);
    const cells = [];
    let opts = null;
    for (let i = 0; i < n * n; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vh-cell';
      b.setAttribute('aria-label', `Casa ${Math.floor(i / n) + 1}, ${(i % n) + 1}`);
      b.addEventListener('click', () => { if (opts && opts.canPlay) opts.onMove(i); });
      el.appendChild(b);
      cells.push(b);
    }
    return {
      render(state, o) {
        opts = o;
        el.classList.toggle('can-play', Boolean(o.canPlay));
        el.dataset.me = o.mySeat;
        const win = state.result && state.result.line ? new Set(state.result.line) : new Set();
        cells.forEach((b, i) => {
          const p = state.board[i];
          const txt = p === null ? '' : PIECES[p];
          if (b.textContent !== txt) {
            b.textContent = txt;
            b.classList.toggle('is-new', p !== null);
          }
          b.dataset.piece = p === null ? '' : p;
          b.disabled = p !== null || !o.canPlay;
          b.classList.toggle('is-last', state.last === i);
          b.classList.toggle('is-win', win.has(i));
        });
      },
      destroy() { el.classList.remove('vh-board', 'can-play'); el.innerHTML = ''; },
    };
  }

  let game = null;
  window.Plataforma.registerGame('velha', {
    async mount(container, ctx) {
      game = window.BoardGame.create(container, ctx, {
        id: 'velha',
        title: 'Jogo da Velha',
        icon: '❌⭕',
        Rules,
        rulesName: 'VelhaRules',
        rulesUrl: '/games/velha/rules.js',
        Levels: window.VelhaLevels,
        seats: [{ name: 'X', icon: '✕' }, { name: 'O', icon: '◯' }],
        makeBoard,
      });
      ctx.mascot.mount(container);
      await game.load();
    },
    unmount() {
      if (game) game.destroy();
      game = null;
    },
  });
})();
