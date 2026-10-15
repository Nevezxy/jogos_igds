// public/games/ligue4/game.js
// 🔴🟡 Ligue 4 (e Ligue 5): só o desenho do tabuleiro (as peças caem na
// coluna, com uma "fantasma" mostrando onde vão parar). O resto (robôs,
// partida com amigo pela rede, estrelas) é o mesmo de todos os jogos de
// tabuleiro (js/shared/boardgame.js). Ajuda opcional: mostra as colunas
// onde o adversário ganharia na próxima jogada.

(function () {
  const Rules = window.Ligue4Rules;

  function makeBoard(el, variant) {
    const { cols, rows } = Rules.VARIANTS[variant];
    el.classList.add('lg-board');
    el.style.setProperty('--cols', cols);
    el.style.setProperty('--rows', rows);
    const cells = []; // índice = col * rows + linha (linha 0 embaixo)
    let opts = null;
    let state = null;
    let hover = null;
    // de cima para baixo na tela
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'lg-cell';
        cell.dataset.col = c;
        cell.setAttribute('aria-label', `Coluna ${c + 1}`);
        cell.appendChild(Object.assign(document.createElement('span'), { className: 'lg-disc' }));
        cell.addEventListener('click', () => { if (opts && opts.canPlay) opts.onMove(c); });
        cell.addEventListener('pointerenter', () => { hover = c; paintGhost(); });
        cells[c * rows + r] = cell;
        el.appendChild(cell);
      }
    }
    el.addEventListener('pointerleave', () => { hover = null; paintGhost(); });

    // a peça "fantasma" na casa onde a peça vai parar
    function paintGhost() {
      cells.forEach((c) => c.classList.remove('is-ghost'));
      if (!opts || !opts.canPlay || hover === null || !state || state.heights[hover] >= rows) return;
      const cell = cells[hover * rows + state.heights[hover]];
      cell.classList.add('is-ghost');
      cell.dataset.ghost = opts.mySeat;
    }

    return {
      render(s, o) {
        const prevLast = state ? state.last : null;
        state = s;
        opts = o;
        el.classList.toggle('can-play', Boolean(o.canPlay));
        const win = s.result && s.result.line ? new Set(s.result.line) : new Set();
        const threat = new Set((o.hints || []).map((c) => c * rows + s.heights[c]));
        cells.forEach((cell, i) => {
          const p = s.board[i];
          cell.dataset.piece = p === null ? '' : p;
          cell.disabled = !o.canPlay || s.heights[Math.floor(i / rows)] >= rows;
          cell.classList.toggle('is-last', s.last === i);
          cell.classList.toggle('is-win', win.has(i));
          cell.classList.toggle('is-threat', threat.has(i));
          // a peça nova cai de cima até a casa dela
          if (s.last === i && prevLast !== i && p !== null) {
            const disc = cell.firstChild;
            disc.style.setProperty('--fall', rows - (i % rows));
            disc.classList.remove('is-drop');
            void disc.offsetWidth;
            disc.classList.add('is-drop');
          }
        });
        paintGhost();
      },
      destroy() { el.classList.remove('lg-board', 'can-play'); el.innerHTML = ''; },
    };
  }

  let game = null;
  window.Plataforma.registerGame('ligue4', {
    async mount(container, ctx) {
      game = window.BoardGame.create(container, ctx, {
        id: 'ligue4',
        title: 'Ligue 4',
        icon: '🔴🟡',
        Rules,
        rulesName: 'Ligue4Rules',
        rulesUrl: '/games/ligue4/rules.js',
        Levels: window.Ligue4Levels,
        seats: [{ name: 'Vermelho', icon: '🔴' }, { name: 'Amarelo', icon: '🟡' }],
        makeBoard,
        hintLabel: '⚠️ Mostrar ameaças',
        hints: (state, seat) => Rules.threats(state, seat),
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
