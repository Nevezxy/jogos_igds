// public/games/carrinhos/game.js
// 🚗 Carrinhos: o estacionamento 6 × 6. Arraste um carro para a frente ou
// para trás (ou toque nele e use as setas do teclado). Tire o carro vermelho
// pela saída à direita. As telas de fora são as de todos os jogos de
// raciocínio (js/shared/puzzleshell.js).

(function () {
  const Levels = window.CarrinhosLevels;
  const T = window.Traffic;
  const N = T.SIZE;
  const COLORS = ['#48DBFB', '#1DD1A1', '#FECA57', '#5F27CD', '#FF9F43', '#FF6BCB', '#54A0FF', '#10AC84', '#C8D6E5', '#8395A7', '#A3CB38', '#F8A5C2', '#7158E2'];
  const COLOR_NAMES = ['azul-claro', 'verde', 'amarelo', 'roxo', 'laranja', 'rosa', 'azul', 'verde-escuro', 'cinza-claro', 'cinza', 'verde-limão', 'rosa-claro', 'violeta'];

  function play(level, area, api) {
    const puzzle = T.parse(level.board);
    let state = puzzle.state.slice();
    const moves = [];
    let hints = 0;
    let ended = false;
    let selected = null;
    let drag = null;

    area.innerHTML = `
      <div class="cr-wrap">
        <div class="cr-board" style="--n:${N}">
          <div class="cr-cells">${'<span></span>'.repeat(N * N)}</div>
          <div class="cr-exit" style="--row:${T.EXIT_ROW}" aria-hidden="true">SAÍDA ▶</div>
          <div class="cr-cars"></div>
        </div>
        <div class="cr-tools">
          <button type="button" class="btn-mini" data-hint>💡 Dica</button>
          <span class="cr-msg" aria-live="polite"></span>
        </div>
      </div>`;
    const board = area.querySelector('.cr-board');
    const carsEl = area.querySelector('.cr-cars');
    const msg = area.querySelector('.cr-msg');

    carsEl.innerHTML = puzzle.vehicles.map((v, i) => {
      const red = i === 0;
      const kind = v.len === 3 ? 'caminhão' : 'carro';
      const color = red ? '#EE5253' : COLORS[(i - 1) % COLORS.length];
      const name = red ? 'carro vermelho' : `${kind} ${COLOR_NAMES[(i - 1) % COLOR_NAMES.length]} ${v.h ? 'deitado' : 'em pé'}`;
      return `<button type="button" class="cr-car ${v.h ? 'is-h' : 'is-v'} ${v.len === 3 ? 'is-truck' : ''} ${red ? 'is-red' : ''}"
        data-i="${i}" style="--len:${v.len};--c:${color}" aria-label="${name}">
        <span class="cr-roof"></span>${red ? '<span class="cr-star">★</span>' : ''}</button>`;
    }).join('');
    const carEls = [...carsEl.querySelectorAll('.cr-car')];

    function place(i, pos = state[i]) {
      const v = puzzle.vehicles[i];
      const el = carEls[i];
      el.style.setProperty('--x', v.h ? pos : v.line);
      el.style.setProperty('--y', v.h ? v.line : pos);
    }

    function render() {
      carEls.forEach((el, i) => { place(i); el.classList.toggle('is-selected', i === selected); el.classList.remove('is-hint'); });
      board.querySelectorAll('.cr-ghost').forEach((g) => g.remove());
      api.stats(`<span title="Jogadas">🔁 <b>${moves.length}</b></span><span title="Mínimo possível">🎯 <b>${level.min}</b></span>${hints ? `<span title="Dicas">💡 <b>${hints}</b></span>` : ''}`);
    }

    function move(m) {
      if (ended || !T.isLegal(puzzle, state, m)) return false;
      state = T.apply(state, m);
      moves.push(m);
      msg.textContent = '';
      api.sound.play('pop');
      render();
      if (T.solved(state)) win();
      return true;
    }

    function win() {
      ended = true;
      const red = carEls[0];
      red.classList.add('is-leaving');
      red.style.setProperty('--x', N + 1);
      api.sound.play('whoosh');
      const stars = Levels.starsFor(level, { moves: moves.length, hints });
      const extra = moves.length - level.min;
      api.finish({
        delay: 1100,
        body: { moves, hints },
        stars,
        record: moves.length,
        msg: extra <= 0 ? `Perfeito: no mínimo de jogadas (${level.min})! 🚗💨` : `Saiu! Você usou ${extra} jogada${extra === 1 ? '' : 's'} a mais que o mínimo (${level.min}).${hints ? ' Sem dica, dá para ganhar mais estrelas!' : ''}`,
        stats: [{ value: moves.length, label: '🔁 jogadas' }, { value: level.min, label: '🎯 mínimo' }, { value: `${Math.round(api.elapsed() / 1000)} s`, label: '⏱ tempo' }],
      });
    }

    // arrastar no trilho do carro; um toque sem arrastar seleciona (para o teclado)
    const cellPx = () => board.querySelector('.cr-cells span').getBoundingClientRect().width;
    carsEl.addEventListener('pointerdown', (ev) => {
      const el = ev.target.closest('.cr-car');
      if (!el || ended) return;
      ev.preventDefault();
      const i = Number(el.dataset.i);
      const v = puzzle.vehicles[i];
      const [lo, hi] = T.range(puzzle, state, i);
      drag = { i, v, lo, hi, x0: ev.clientX, y0: ev.clientY, cell: cellPx() + 4, moved: false, pos: state[i] };
      el.setPointerCapture(ev.pointerId);
      el.classList.add('is-dragging');
    });
    carsEl.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const d = drag.v.h ? ev.clientX - drag.x0 : ev.clientY - drag.y0;
      if (Math.abs(d) > 6) drag.moved = true;
      const pos = Math.max(drag.lo, Math.min(drag.hi, state[drag.i] + d / drag.cell));
      drag.pos = pos;
      place(drag.i, pos);
    });
    const endDrag = () => {
      if (!drag) return;
      const { i, moved } = drag;
      const pos = Math.round(drag.pos);
      carEls[i].classList.remove('is-dragging');
      drag = null;
      if (!moved) { selected = selected === i ? null : i; api.sound.play('click'); render(); return; }
      selected = i;
      if (pos !== state[i]) move([i, pos]);
      else render();
    };
    carsEl.addEventListener('pointerup', endDrag);
    carsEl.addEventListener('pointercancel', endDrag);

    api.hintButton(area.querySelector('[data-hint]'), () => {
      if (ended) return false;
      const path = T.solve(puzzle, state);
      if (!path || !path.length) return false;
      const [i, p] = path[0];
      hints++;
      selected = null;
      render();
      carEls[i].classList.add('is-hint');
      const v = puzzle.vehicles[i];
      const ghost = document.createElement('span');
      ghost.className = `cr-ghost ${v.h ? 'is-h' : 'is-v'}`;
      ghost.style.cssText = `--len:${v.len};--x:${v.h ? p : v.line};--y:${v.h ? v.line : p}`;
      carsEl.appendChild(ghost);
      const dir = v.h ? (p > state[i] ? 'para a direita' : 'para a esquerda') : (p > state[i] ? 'para baixo' : 'para cima');
      msg.textContent = `💡 Mova o ${i === 0 ? 'carro vermelho' : carEls[i].getAttribute('aria-label').split(' ').slice(0, 2).join(' ')} ${dir}, até o tracejado. Faltam ${path.length} jogadas.`;
      api.sound.play('whoosh');
    });
    render();

    return {
      onKey(ev) {
        if (selected === null) {
          if (ev.key.startsWith('Arrow')) { selected = 0; render(); ev.preventDefault(); }
          return;
        }
        const v = puzzle.vehicles[selected];
        const step = { ArrowRight: v.h ? 1 : 0, ArrowLeft: v.h ? -1 : 0, ArrowDown: v.h ? 0 : 1, ArrowUp: v.h ? 0 : -1 }[ev.key];
        if (step) { ev.preventDefault(); if (!move([selected, state[selected] + step])) api.sound.play('bonk'); }
        else if (ev.key === 'Tab') { ev.preventDefault(); selected = (selected + (ev.shiftKey ? puzzle.vehicles.length - 1 : 1)) % puzzle.vehicles.length; render(); }
        else if (ev.key === 'Escape') { selected = null; render(); }
      },
      destroy() { ended = true; },
    };
  }

  let shell = null;
  window.Plataforma.registerGame('carrinhos', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'carrinhos',
        title: 'Carrinhos',
        icon: '🚗',
        hello: 'Tire o carro vermelho do estacionamento! Arraste os carros para abrir caminho.',
        Levels,
        record: { key: 'best', label: 'jogadas', lower: true },
        rules: (level) => [
          '👆 Arraste um carro para a frente ou para trás. Eles nunca andam de lado.',
          '🚗 Leve o carro vermelho ★ até a SAÍDA, à direita.',
          '⌨️ No teclado: toque num carro e use as setas (Tab troca de carro).',
          `🎯 Dá para fazer em ${level.min} jogadas. 💡 A dica ajuda, mas deixa no máximo 2 estrelas.`,
          window.PuzzleLevels.hintRule(level),
        ],
        play,
      });
      ctx.mascot.mount(container);
      await shell.load();
    },
    unmount() { if (shell) shell.destroy(); shell = null; },
  });
})();
