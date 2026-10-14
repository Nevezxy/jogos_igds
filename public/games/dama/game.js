// public/games/dama/game.js
// ⚫⚪ Dama brasileira: só o desenho do tabuleiro. As peças que podem jogar
// ficam destacadas (piscando quando a captura é obrigatória). Toque na peça
// e depois na casa; numa captura de várias peças, toque em cada casa onde a
// peça pousa, passo a passo (as peças puladas ficam marcadas e saem no fim).
// O resto (robôs, partida com amigo pela rede, estrelas) é o mesmo de todos
// os jogos de tabuleiro (js/shared/boardgame.js).

(function () {
  const Rules = window.DamaRules;
  const REASON = {
    presas: (w) => `🏆 As peças ${w === 0 ? 'pretas' : 'brancas'} ficaram presas, sem lance!`,
    'sem pecas': (w) => `🏆 Acabaram as peças ${w === 0 ? 'pretas' : 'brancas'}!`,
    damas: () => '🤝 20 lances de cada lado só com damas, sem captura: empate!',
  };

  // a peça pulada entre duas casas da mesma diagonal
  function jumped(board, a, b) {
    const dr = Math.sign(Math.floor(b / 8) - Math.floor(a / 8));
    const dc = Math.sign((b % 8) - (a % 8));
    let r = Math.floor(a / 8) + dr;
    let c = (a % 8) + dc;
    while (r * 8 + c !== b) {
      if (board[r * 8 + c] !== '.') return r * 8 + c;
      r += dr;
      c += dc;
    }
    return -1;
  }

  function makeBoard(el) {
    el.classList.add('dm-board');
    el.innerHTML = '<p class="dm-must" aria-live="polite"></p><div class="dm-grid"></div><p class="dm-end" aria-live="polite"></p>';
    const grid = el.querySelector('.dm-grid');
    const must = el.querySelector('.dm-must');
    const endBox = el.querySelector('.dm-end');
    const cells = [];
    for (let i = 0; i < 64; i++) {
      const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `dm-sq ${dark ? 'is-dark' : 'is-light'}`;
      b.dataset.sq = i;
      b.innerHTML = '<span class="dm-piece"></span>';
      if (dark) b.addEventListener('click', () => tap(i));
      else b.tabIndex = -1;
      cells.push(b);
    }
    let state = null;
    let opts = null;
    let all = [];
    let path = [];
    let flipped = null;

    function layout(flip) {
      if (flip === flipped) return;
      flipped = flip;
      grid.innerHTML = '';
      for (let k = 0; k < 64; k++) grid.appendChild(cells[flip ? 63 - k : k]);
    }

    const candidates = () => all.filter((m) => path.every((x, i) => m[i] === x));

    function tap(i) {
      if (!opts || !opts.canPlay || !state) return;
      const p = state.board[i];
      const mine = Rules.sideOf(p) === state.turn;
      // trocar de peça (só antes de começar a captura)
      if (mine && path.length <= 1) {
        path = path[0] === i ? [] : [i];
        if (path.length && !candidates().length) {
          const capturing = all.some((m) => jumped(state.board, m[0], m[1]) >= 0);
          endBox.textContent = capturing ? '⚠️ Capturar é obrigatório: jogue com uma das peças que estão piscando.' : 'Essa peça não tem lance agora.';
          path = [];
        } else endBox.textContent = '';
        paint();
        return;
      }
      if (!path.length) return;
      const next = candidates().filter((m) => m[path.length] === i);
      if (!next.length) return;
      path = path.concat(i);
      const done = next.find((m) => m.length === path.length);
      if (done) {
        const mv = done.slice();
        path = [];
        opts.onMove(mv);
        return;
      }
      paint();
    }

    function paint() {
      const cands = candidates();
      const nextSteps = new Set(path.length ? cands.map((m) => m[path.length]).filter((x) => x !== undefined) : []);
      const movable = new Set(all.map((m) => m[0]));
      const isCapture = all.some((m) => jumped(state.board, m[0], m[1]) >= 0);
      // peças já puladas nesta captura (ficam marcadas até o fim)
      const pending = new Set();
      for (let k = 1; k < path.length; k++) pending.add(jumped(state.board, path[k - 1], path[k]));
      const last = new Set(state.last || []);
      const gone = new Set(state.captured || []);
      cells.forEach((cell, i) => {
        const p = state.board[i];
        const piece = cell.firstChild;
        const at = path.length > 1 && i === path[path.length - 1] ? state.board[path[0]] : i === path[0] && path.length > 1 ? '.' : p;
        piece.className = `dm-piece ${at === '.' ? '' : Rules.sideOf(at) === 0 ? 'is-white' : 'is-black'} ${Rules.isKing(at) ? 'is-king' : ''}`;
        piece.textContent = Rules.isKing(at) ? '♛' : '';
        cell.classList.toggle('is-selected', path.length > 0 && i === path[path.length - 1]);
        cell.classList.toggle('is-target', nextSteps.has(i));
        cell.classList.toggle('is-taken', pending.has(i));
        cell.classList.toggle('can-move', Boolean(opts.canPlay) && !path.length && movable.has(i));
        cell.classList.toggle('must-capture', Boolean(opts.canPlay) && !path.length && movable.has(i) && isCapture);
        cell.classList.toggle('is-last', last.has(i));
        cell.classList.toggle('was-captured', gone.has(i) && p === '.');
        cell.disabled = !opts.canPlay || !cell.classList.contains('is-dark');
        const name = 'abcdefgh'[i % 8] + (8 - Math.floor(i / 8));
        cell.setAttribute('aria-label', `${name}${p === '.' ? '' : `, ${Rules.isKing(p) ? 'dama' : 'pedra'} ${Rules.sideOf(p) === 0 ? 'branca' : 'preta'}`}`);
      });
      must.textContent = opts.canPlay && isCapture
        ? (path.length > 1 ? `Continue capturando! (${path.length - 1} peça${path.length > 2 ? 's' : ''} até agora)` : `⚠️ Captura obrigatória: ${all[0].length - 1 > 1 ? `capture ${all[0].length - 1} peças!` : 'capture uma peça!'}`)
        : '';
    }

    return {
      render(s, o) {
        if (!state || s.ply !== state.ply) path = [];
        state = s;
        opts = o;
        layout(o.mySeat === 1);
        all = o.canPlay && !s.result ? Rules.moves(s) : [];
        el.classList.toggle('can-play', Boolean(o.canPlay));
        endBox.textContent = s.result && REASON[s.result.reason] ? REASON[s.result.reason](s.result.winner) : '';
        paint();
      },
      destroy() { el.classList.remove('dm-board', 'can-play'); el.innerHTML = ''; },
    };
  }

  let game = null;
  window.Plataforma.registerGame('dama', {
    async mount(container, ctx) {
      game = window.BoardGame.create(container, ctx, {
        id: 'dama',
        title: 'Dama',
        icon: '⚫⚪',
        Rules,
        rulesName: 'DamaRules',
        rulesUrl: '/games/dama/rules.js',
        Levels: window.DamaLevels,
        seats: [{ name: 'Brancas', icon: '⚪' }, { name: 'Pretas', icon: '⚫' }],
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
