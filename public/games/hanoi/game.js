// public/games/hanoi/game.js
// 🗼 Torre de Hanói: os pinos e os discos. Toque num pino para pegar o
// disco de cima e toque em outro para soltar (ou arraste de um pino para
// outro; ou as teclas 1 a 4). As telas de fora são as de todos os jogos de
// raciocínio (js/shared/puzzleshell.js).

(function () {
  const Levels = window.HanoiLevels;
  const H = window.HanoiRules;
  const COLORS = ['#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1', '#48DBFB', '#5F27CD', '#FF6BCB'];

  // goalPeg: o pino onde a torre tem que ficar (marcado com 🏁)
  function towerHtml(pos, n, pegs, cls = '', goalPeg = -1) {
    let html = `<div class="hn-pegs ${cls}" style="--pegs:${pegs};--n:${n}">`;
    for (let p = 0; p < pegs; p++) {
      const goal = p === goalPeg;
      html += `<div class="hn-peg${goal ? ' is-goal' : ''}" data-peg="${p}"${goal ? ' aria-label="Pino de chegada: monte a torre aqui"' : ''}>${goal ? '<span class="hn-goal">🏁<span class="hn-goal-text"> Monte aqui</span></span>' : ''}<span class="hn-rod"></span><span class="hn-stack">`;
      // a pilha é desenhada de cima para baixo: do menor (em cima) para o maior
      for (let d = 0; d < n; d++) {
        if (pos[d] === p) html += `<span class="hn-disc" data-d="${d}" style="--w:${30 + (70 * (d + 1)) / n}%;--c:${COLORS[d % COLORS.length]}"></span>`;
      }
      html += `</span><span class="hn-base">${p + 1}</span></div>`;
    }
    return `${html}</div>`;
  }

  function play(level, area, api) {
    const game = H.setup(level, api.seed);
    let pos = game.start.slice();
    const moves = [];
    let selected = null;
    let hints = 0;
    let ended = false;

    area.innerHTML = `
      ${level.mode === 'copy' ? `<div class="hn-model"><span>🖼️ Modelo:</span>${towerHtml(game.goal, game.n, game.pegs, 'is-model')}</div>` : ''}
      <div class="hn-board"></div>
      <div class="hn-tools">
        <button type="button" class="btn-mini" data-hint>💡 Dica</button>
        <span class="hn-msg" aria-live="polite"></span>
      </div>`;
    const boardEl = area.querySelector('.hn-board');
    // torre inteira num pino só (clássica e bagunçada): esse é o pino de chegada
    const goalPeg = game.goal.every((g) => g === game.goal[0]) ? game.goal[0] : -1;
    const msg = area.querySelector('.hn-msg');

    function render(flash) {
      boardEl.innerHTML = towerHtml(pos, game.n, game.pegs, '', goalPeg);
      boardEl.querySelectorAll('.hn-peg').forEach((el) => {
        const p = Number(el.dataset.peg);
        el.classList.toggle('is-selected', p === selected);
        if (p === selected) {
          const d = H.top(pos, p);
          const disc = el.querySelector(`.hn-disc[data-d="${d}"]`);
          if (disc) disc.classList.add('is-lifted');
        }
        if (flash && flash.includes(p)) el.classList.add('is-hint');
        if (selected !== null && p !== selected) el.classList.toggle('can-drop', H.isLegal(pos, game.pegs, [selected, p]));
      });
      api.stats(`<span title="Movimentos">🔁 <b>${moves.length}</b></span><span title="Mínimo possível">🎯 <b>${game.min}</b></span>${hints ? `<span title="Dicas">💡 <b>${hints}</b></span>` : ''}`);
    }

    function tapPeg(p) {
      if (ended) return;
      if (selected === null) {
        if (H.top(pos, p) < 0) { api.sound.play('bonk'); return; }
        selected = p;
        api.sound.play('click');
        msg.textContent = '';
        render();
        return;
      }
      if (p === selected) { selected = null; render(); return; }
      move([selected, p]);
    }

    function move(m) {
      if (!H.isLegal(pos, game.pegs, m)) {
        api.sound.play('bonk');
        msg.textContent = '✋ Disco grande não vai em cima de disco pequeno!';
        const el = boardEl.querySelector(`.hn-peg[data-peg="${m[1]}"]`);
        if (el) { el.classList.remove('fx-shake'); void el.offsetWidth; el.classList.add('fx-shake'); }
        selected = null;
        render();
        return;
      }
      pos = H.apply(pos, m);
      moves.push(m);
      selected = null;
      api.sound.play('pop');
      render();
      if (H.same(pos, game.goal)) end();
    }

    function end() {
      ended = true;
      const stars = Levels.starsFor(level, { moves: moves.length, min: game.min, hints });
      const extra = moves.length - game.min;
      api.finish({
        body: { moves, hints },
        stars,
        record: moves.length,
        msg: extra === 0 ? `Perfeito: no mínimo de movimentos (${game.min})! 🧠` : `Você usou ${extra} movimento${extra === 1 ? '' : 's'} a mais que o mínimo (${game.min}).${hints ? ' Sem dica, dá para ganhar a 3ª estrela!' : ''}`,
        stats: [{ value: moves.length, label: '🔁 movimentos' }, { value: game.min, label: '🎯 mínimo' }, { value: `${Math.round(api.elapsed() / 1000)} s`, label: '⏱ tempo' }],
      });
    }

    // tocar (pega num pino e solta em outro) ou arrastar o disco de cima:
    // o disco segue o dedo/mouse e cai no pino onde for solto
    const DRAG_PX = 8; // menos que isso é um toque
    let drag = null; // { id, from, x0, y0, ghost, dx, dy, over }
    const pegAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const peg = el && el.closest('.hn-peg');
      return peg && boardEl.contains(peg) ? peg : null;
    };
    function startDrag(ev) {
      selected = drag.from;
      render();
      const d = H.top(pos, drag.from);
      const disc = boardEl.querySelector(`.hn-peg[data-peg="${drag.from}"] .hn-disc[data-d="${d}"]`);
      if (!disc) { drag = null; return; }
      const box = disc.getBoundingClientRect();
      const ghost = disc.cloneNode(true);
      ghost.classList.remove('is-lifted');
      ghost.classList.add('is-ghost');
      ghost.style.width = `${box.width}px`;
      ghost.style.height = `${box.height}px`;
      document.body.appendChild(ghost);
      disc.style.visibility = 'hidden';
      Object.assign(drag, { ghost, dx: box.width / 2, dy: box.height / 2 });
      api.sound.play('click');
      moveGhost(ev);
    }
    function moveGhost(ev) {
      drag.ghost.style.transform = `translate(${ev.clientX - drag.dx}px, ${ev.clientY - drag.dy}px)`;
      const peg = pegAt(ev.clientX, ev.clientY);
      if (peg !== drag.over) {
        if (drag.over) drag.over.classList.remove('is-over');
        drag.over = peg;
        if (peg) peg.classList.add('is-over');
      }
    }
    function endDrag() {
      if (drag && drag.ghost) drag.ghost.remove();
      if (drag && drag.over) drag.over.classList.remove('is-over');
      drag = null;
    }
    boardEl.addEventListener('pointerdown', (ev) => {
      if (ended || ev.button > 0) return;
      const peg = ev.target.closest('.hn-peg');
      if (!peg) return;
      drag = { id: ev.pointerId, from: Number(peg.dataset.peg), x0: ev.clientX, y0: ev.clientY, ghost: null, over: null };
      try { boardEl.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    });
    boardEl.addEventListener('pointermove', (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      if (!drag.ghost) {
        if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < DRAG_PX) return;
        // só arrasta de um pino com disco, e se não tinha um disco já pego
        if (selected !== null || H.top(pos, drag.from) < 0) return;
        startDrag(ev);
        if (!drag) return;
      }
      moveGhost(ev);
    });
    boardEl.addEventListener('pointerup', (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const { from, ghost } = drag;
      const peg = pegAt(ev.clientX, ev.clientY);
      endDrag();
      if (ghost) {
        const p = peg ? Number(peg.dataset.peg) : -1;
        if (p >= 0 && p !== from) move([from, p]);
        else { selected = null; render(); }
      } else if (peg) tapPeg(Number(peg.dataset.peg));
    });
    boardEl.addEventListener('pointercancel', () => {
      if (!drag) return;
      const dragged = Boolean(drag.ghost);
      endDrag();
      if (dragged) { selected = null; render(); }
    });
    api.hintButton(area.querySelector('[data-hint]'), () => {
      if (ended) return false;
      const h = H.hint(pos, game.goal, game.pegs);
      if (!h) return false;
      hints++;
      selected = null;
      msg.textContent = `💡 Mova o disco de cima do pino ${h[0] + 1} para o pino ${h[1] + 1}.`;
      api.sound.play('whoosh');
      render(h);
    });
    render();

    return {
      onKey(ev) {
        const n = Number(ev.key);
        if (n >= 1 && n <= game.pegs) { ev.preventDefault(); tapPeg(n - 1); }
        if (ev.key === 'Escape') { selected = null; render(); }
      },
      destroy() { ended = true; endDrag(); },
    };
  }

  let shell = null;
  window.Plataforma.registerGame('hanoi', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'hanoi',
        title: 'Torre de Hanói',
        icon: '🗼',
        hello: 'Mude a torre de lugar, um disco por vez, sem pôr disco grande em cima de pequeno!',
        Levels,
        record: { key: 'best', label: 'movimentos', lower: true },
        rules: (level) => [
          '👆 Arraste o disco de cima até outro pino, ou toque num pino e depois em outro. No teclado: 1, 2, 3' + (level.pegs > 3 ? ' e 4.' : '.'),
          '✋ Disco grande nunca vai em cima de disco pequeno.',
          level.mode === 'copy' ? '🖼️ Deixe os discos igualzinho ao modelo.' : `🏁 Monte a torre inteira no pino ${level.pegs}.`,
          '🎯 3 estrelas no mínimo de movimentos. 💡 A dica ajuda, mas deixa no máximo 2 estrelas.',
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
