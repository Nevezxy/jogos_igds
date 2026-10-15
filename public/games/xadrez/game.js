// public/games/xadrez/game.js
// ♟️ Xadrez: só o desenho do tabuleiro. Toque numa peça para ver para onde
// ela pode ir e toque na casa. O peão que chega no fim escolhe a peça. O
// resto (robôs, partida com amigo pela rede, estrelas) é o mesmo de todos
// os jogos de tabuleiro (js/shared/boardgame.js). Ajuda opcional: mostra as
// suas peças que estão sendo atacadas.

(function () {
  const Rules = window.XadrezRules;
  const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
  const NAMES = { K: 'rei', Q: 'dama', R: 'torre', B: 'bispo', N: 'cavalo', P: 'peão' };
  const PROMO = [['q', 'Q'], ['r', 'R'], ['b', 'B'], ['n', 'N']];
  const REASON = {
    mate: (w) => `♚ Xeque-mate! As ${w === 0 ? 'brancas' : 'pretas'} venceram.`,
    afogamento: () => '🤝 Afogamento: o rei não está em xeque, mas não tem lance. Empate!',
    material: () => '🤝 Ninguém tem peças para dar mate. Empate!',
    repeticao: () => '🤝 A mesma posição 3 vezes. Empate!',
    '50lances': () => '🤝 50 lances sem captura nem lance de peão. Empate!',
  };

  function makeBoard(el) {
    el.classList.add('xd-board');
    el.innerHTML = '<div class="xd-check" aria-live="polite"></div><div class="xd-grid"></div><div class="xd-promo" hidden></div><p class="xd-end" aria-live="polite"></p>';
    const grid = el.querySelector('.xd-grid');
    const promoBox = el.querySelector('.xd-promo');
    const checkBox = el.querySelector('.xd-check');
    const endBox = el.querySelector('.xd-end');
    const cells = [];
    for (let i = 0; i < 64; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `xd-sq ${(Math.floor(i / 8) + (i % 8)) % 2 ? 'is-dark' : 'is-light'}`;
      b.dataset.sq = i;
      b.innerHTML = '<span class="xd-piece"></span>';
      b.addEventListener('click', () => tap(i));
      cells.push(b);
    }
    let state = null;
    let opts = null;
    let legal = [];
    let selected = null;
    let flipped = null;

    function layout(flip) {
      if (flip === flipped) return;
      flipped = flip;
      grid.innerHTML = '';
      for (let k = 0; k < 64; k++) {
        const i = flip ? 63 - k : k;
        const cell = cells[i];
        const r = Math.floor(i / 8);
        const c = i % 8;
        cell.querySelectorAll('.xd-coord').forEach((x) => x.remove());
        if (k % 8 === 0) cell.insertAdjacentHTML('beforeend', `<span class="xd-coord is-rank">${8 - r}</span>`);
        if (k >= 56) cell.insertAdjacentHTML('beforeend', `<span class="xd-coord is-file">${Rules.FILES[c]}</span>`);
        grid.appendChild(cell);
      }
    }

    function tap(i) {
      if (!opts || !opts.canPlay || !state) return;
      const p = state.board[i];
      const mine = p !== '.' && Rules.colorOf(p) === state.turn;
      if (selected !== null && selected !== i) {
        const list = legal.filter((m) => m[0] === selected && m[1] === i);
        if (list.length > 1) { askPromotion(list); return; }
        if (list.length === 1) { const m = Rules.text(list[0]); selected = null; opts.onMove(m); return; }
      }
      if (mine) {
        selected = selected === i ? null : i;
        if (selected !== null && !legal.some((m) => m[0] === i)) {
          endBox.textContent = state.check ? '⚠️ O seu rei está em xeque: só valem lances que tiram o xeque.' : `Essa ${NAMES[p.toUpperCase()]} não tem lance agora.`;
        } else endBox.textContent = '';
      } else selected = null;
      paint();
    }

    function askPromotion(list) {
      const white = state.turn === 0;
      promoBox.hidden = false;
      promoBox.innerHTML = `<p>O peão chegou! Vira qual peça?</p><div>${PROMO.map(([k, t]) => `<button type="button" data-p="${k}" class="xd-piece-btn ${white ? 'is-white' : 'is-black'}" aria-label="${NAMES[t]}">${GLYPH[t]}&#xFE0E;</button>`).join('')}</div>`;
      promoBox.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
        const mv = list.find((m) => m[2] === b.dataset.p);
        promoBox.hidden = true;
        selected = null;
        opts.onMove(Rules.text(mv));
      }));
    }

    function paint() {
      const targets = new Set(legal.filter((m) => m[0] === selected).map((m) => m[1]));
      const movable = new Set(legal.map((m) => m[0]));
      const hints = new Set(opts && opts.hints ? opts.hints : []);
      const king = state.check ? state.board.indexOf(state.turn === 0 ? 'K' : 'k') : -1;
      const last = state.last || [];
      cells.forEach((cell, i) => {
        const p = state.board[i];
        const piece = cell.firstChild;
        piece.textContent = p === '.' ? '' : `${GLYPH[p.toUpperCase()]}︎`;
        piece.className = `xd-piece ${p === '.' ? '' : Rules.colorOf(p) === 0 ? 'is-white' : 'is-black'}`;
        cell.setAttribute('aria-label', `${Rules.name(i)}${p === '.' ? '' : `, ${NAMES[p.toUpperCase()]} ${Rules.colorOf(p) === 0 ? 'branco' : 'preto'}`}`);
        cell.classList.toggle('is-selected', i === selected);
        cell.classList.toggle('is-target', targets.has(i));
        cell.classList.toggle('is-capture', targets.has(i) && p !== '.');
        cell.classList.toggle('is-last', last.includes(i));
        cell.classList.toggle('is-check', i === king);
        cell.classList.toggle('is-threat', hints.has(i));
        cell.classList.toggle('can-move', Boolean(opts && opts.canPlay) && movable.has(i));
        cell.disabled = !(opts && opts.canPlay);
      });
      checkBox.textContent = state.check && !state.result ? (opts.canPlay ? '⚠️ Xeque! Proteja o seu rei.' : '⚠️ Xeque!') : '';
    }

    return {
      render(s, o) {
        if (state && s.ply !== state.ply) selected = null;
        state = s;
        opts = o;
        layout(o.mySeat === 1);
        legal = o.canPlay && !s.result ? Rules.legal(s) : [];
        if (!o.canPlay) promoBox.hidden = true;
        el.classList.toggle('can-play', Boolean(o.canPlay));
        endBox.textContent = s.result && REASON[s.result.reason] ? REASON[s.result.reason](s.result.winner) : (selected === null ? '' : endBox.textContent);
        paint();
      },
      destroy() { el.classList.remove('xd-board', 'can-play'); el.innerHTML = ''; },
    };
  }

  let game = null;
  window.Plataforma.registerGame('xadrez', {
    async mount(container, ctx) {
      game = window.BoardGame.create(container, ctx, {
        id: 'xadrez',
        title: 'Xadrez',
        icon: '♟️',
        Rules,
        rulesName: 'XadrezRules',
        rulesUrl: '/games/xadrez/rules.js',
        Levels: window.XadrezLevels,
        seats: [{ name: 'Brancas', icon: '♔' }, { name: 'Pretas', icon: '♚' }],
        makeBoard,
        hintLabel: '⚠️ Mostrar peças atacadas',
        hints: (state, seat) => Rules.threatened(state, 1 - seat),
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
