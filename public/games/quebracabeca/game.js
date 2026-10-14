// public/games/quebracabeca/game.js
// 🧩 Quebra-cabeça: a moldura (com a "sombra" da foto nas primeiras fases) e
// as peças espalhadas embaixo. Arraste cada peça até o lugar; perto do lugar
// certo ela gruda. Nas fases de peças viradas, toque na peça para girar. A
// foto montada vai para a galeria, no mapa. As telas de fora são as de todos
// os jogos de raciocínio (js/shared/puzzleshell.js).

(function () {
  const Levels = window.QuebraLevels;
  const J = window.Jigsaw;
  const NS = 'http://www.w3.org/2000/svg';
  const SNAP = 0.32; // perto assim do lugar certo (em tamanhos de peça), gruda
  const GAP = 1.38; // espaço de cada peça na mesa

  function play(level, area, api) {
    const game = J.cut(level, api.seed);
    const url = Levels.photoUrl(level);
    const n = game.pieces.length;
    const state = game.pieces.map((p) => ({ x: 0, y: 0, rot: p.rot, placed: false }));
    const placedOrder = [];
    let turns = 0;
    let ended = false;
    let size = 60;
    let z = 10;
    let drag = null;
    let layout = null;
    const uid = `jg${api.seed}`;

    area.innerHTML = `
      <div class="jg-wrap">
        <div class="jg-tools">
          <span class="jg-count" aria-live="polite"></span>
          <button type="button" class="btn-mini" data-tidy>🧺 Arrumar peças</button>
          ${level.shadow ? '' : '<button type="button" class="btn-mini" data-peek>👁️ Espiar a foto</button>'}
        </div>
        <div class="jg-table">
          <div class="jg-board ${level.shadow ? 'has-shadow' : ''}" style="--photo:url('${url}')"></div>
          <div class="jg-peek" hidden style="--photo:url('${url}')"></div>
        </div>
        <p class="jg-msg" aria-live="polite">Carregando a foto…</p>
      </div>`;
    const table = area.querySelector('.jg-table');
    const board = area.querySelector('.jg-board');
    const msg = area.querySelector('.jg-msg');
    const peek = area.querySelector('.jg-peek');

    // as peças: cada uma é um SVG com a foto recortada pelo contorno dela
    const els = game.pieces.map((p, i) => {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'jg-piece');
      svg.dataset.i = i;
      table.appendChild(svg);
      return svg;
    });

    function drawPieces() {
      const W = size * game.cols;
      const H = size * game.rows;
      const o = J.PAD * size;
      const box = size * (1 + 2 * J.PAD);
      els.forEach((svg, i) => {
        const p = game.pieces[i];
        const d = J.path(p, size);
        svg.setAttribute('viewBox', `0 0 ${box} ${box}`);
        svg.setAttribute('width', box);
        svg.setAttribute('height', box);
        svg.innerHTML = `<defs><clipPath id="${uid}-${i}"><path d="${d}"/></clipPath></defs>
          <image href="${url}" x="${o - p.c * size}" y="${o - p.r * size}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${uid}-${i})"/>
          <path class="jg-edge" d="${d}"/>`;
      });
    }

    function place(i, animate) {
      const s = state[i];
      const el = els[i];
      el.classList.toggle('is-animated', Boolean(animate));
      el.style.left = `${(s.x - J.PAD) * size}px`;
      el.style.top = `${(s.y - J.PAD) * size}px`;
      el.style.transform = `rotate(${s.rot}deg)`;
    }

    // mesa: a moldura em cima e as peças soltas embaixo, em fileiras
    function measure() {
      const tableW = Math.max(280, table.clientWidth);
      const maxW = Math.min(tableW - 24, 640);
      const maxH = Math.max(200, window.innerHeight - 420);
      size = Math.max(34, Math.min(130, Math.floor(Math.min(maxW / game.cols, maxH / game.rows))));
      const unitsW = tableW / size;
      const perRow = Math.max(2, Math.floor((unitsW - 0.3) / GAP));
      const loose = state.filter((s) => !s.placed).length;
      const trayRows = Math.ceil(Math.max(loose, 1) / perRow);
      layout = { unitsW, perRow, bx: (unitsW - game.cols) / 2, by: J.PAD + 0.05, trayY: J.PAD + game.rows + 0.75 };
      table.style.height = `${(layout.trayY + trayRows * GAP + 0.2) * size}px`;
      board.style.left = `${layout.bx * size}px`;
      board.style.top = `${layout.by * size}px`;
      board.style.width = `${game.cols * size}px`;
      board.style.height = `${game.rows * size}px`;
      peek.style.cssText = board.style.cssText + `;--photo:url('${url}')`;
    }

    function tidy(animate) {
      const loose = game.order.filter((i) => !state[i].placed);
      const x0 = (layout.unitsW - Math.min(loose.length, layout.perRow) * GAP) / 2 + (GAP - 1) / 2;
      loose.forEach((i, k) => {
        state[i].x = x0 + (k % layout.perRow) * GAP;
        state[i].y = layout.trayY + Math.floor(k / layout.perRow) * GAP;
        place(i, animate);
      });
    }

    function relayout() {
      measure();
      drawPieces();
      state.forEach((s, i) => {
        if (s.placed) { s.x = layout.bx + game.pieces[i].c; s.y = layout.by + game.pieces[i].r; }
        else { s.x = Math.max(0, Math.min(layout.unitsW - 1, s.x)); }
        place(i);
      });
    }

    function stats() {
      const done = state.filter((s) => s.placed).length;
      area.querySelector('.jg-count').textContent = `🧩 ${done} de ${n} peças`;
      api.stats(`<span title="Peças no lugar">🧩 <b>${done}/${n}</b></span><span title="Tempo bom">⏱ <b>${Levels.parSeconds(level)} s</b></span>`);
    }

    function trySnap(i) {
      const s = state[i];
      const p = game.pieces[i];
      const tx = layout.bx + p.c;
      const ty = layout.by + p.r;
      if (s.rot % 360 !== 0 || Math.hypot(s.x - tx, s.y - ty) > SNAP) return false;
      s.x = tx;
      s.y = ty;
      s.placed = true;
      placedOrder.push(i);
      els[i].classList.add('is-placed');
      els[i].style.zIndex = 1;
      place(i, true);
      api.sound.play('pop');
      stats();
      if (placedOrder.length === n) win();
      return true;
    }

    function rotate(i) {
      const s = state[i];
      s.rot = (s.rot + 90) % 360;
      turns++;
      api.sound.play('click');
      place(i, true);
    }

    function win() {
      ended = true;
      board.classList.add('is-done');
      msg.textContent = `🖼️ ${Levels.PHOTOS[level.photo]}! Você montou o quebra-cabeça!`;
      const seconds = Math.round(api.elapsed() / 1000);
      const stars = Levels.starsFor(level, { seconds });
      api.finish({
        delay: 1600,
        body: { placed: placedOrder, turns },
        stars,
        record: seconds,
        msg: stars === 3 ? `Super rápido! Menos de ${Levels.parSeconds(level)} segundos! ⚡` : `Montado em ${seconds} s. Tente fazer em menos de ${Levels.parSeconds(level)} s para ganhar 3 estrelas!`,
        stats: [{ value: n, label: '🧩 peças' }, { value: `${seconds} s`, label: '⏱ tempo' }, { value: `${Levels.parSeconds(level)} s`, label: '⭐ tempo bom' }],
      });
    }

    table.addEventListener('pointerdown', (ev) => {
      const el = ev.target.closest('.jg-piece');
      if (!el || ended) return;
      const i = Number(el.dataset.i);
      if (state[i].placed) return;
      ev.preventDefault();
      ev.target.setPointerCapture(ev.pointerId);
      drag = { i, x0: ev.clientX, y0: ev.clientY, sx: state[i].x, sy: state[i].y, moved: false };
      el.style.zIndex = ++z;
      el.classList.add('is-dragging');
      el.classList.remove('is-animated');
    });
    table.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.x0;
      const dy = ev.clientY - drag.y0;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      const s = state[drag.i];
      s.x = Math.max(-0.2, Math.min(layout.unitsW - 0.8, drag.sx + dx / size));
      s.y = Math.max(0, drag.sy + dy / size);
      place(drag.i);
    });
    const end = () => {
      if (!drag) return;
      const { i, moved } = drag;
      drag = null;
      els[i].classList.remove('is-dragging');
      if (!moved) {
        if (level.rotate) rotate(i);
        return;
      }
      if (!trySnap(i) && level.rotate && state[i].rot % 360 && Math.hypot(state[i].x - (layout.bx + game.pieces[i].c), state[i].y - (layout.by + game.pieces[i].r)) <= SNAP) {
        msg.textContent = '🔄 Esse é o lugar! Toque na peça para girar até ficar certinha.';
      }
    };
    table.addEventListener('pointerup', end);
    table.addEventListener('pointercancel', end);
    area.querySelector('[data-tidy]').addEventListener('click', () => { if (!ended) { tidy(true); api.sound.play('whoosh'); } });
    const peekBtn = area.querySelector('[data-peek]');
    if (peekBtn) {
      const show = (on) => { peek.hidden = !on; };
      peekBtn.addEventListener('pointerdown', () => show(true));
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => peekBtn.addEventListener(e, () => show(false)));
      peekBtn.textContent = '👁️ Segure para espiar';
    }
    const onResize = () => { if (layout) relayout(); };
    window.addEventListener('resize', onResize);

    // espera a foto carregar para montar a mesa
    const img = new Image();
    const start = () => {
      if (ended) return;
      msg.textContent = level.rotate ? 'Arraste as peças até a moldura. Toque numa peça para girar!' : 'Arraste as peças até a moldura!';
      measure();
      drawPieces();
      tidy(false);
      stats();
    };
    img.onload = start;
    img.onerror = start;
    img.src = url;

    return {
      destroy() {
        ended = true;
        window.removeEventListener('resize', onResize);
      },
    };
  }

  function gallery(el, progress) {
    const done = Levels.LEVELS.filter((l) => progress.levels && progress.levels[l.id] && progress.levels[l.id].stars >= 1);
    const photos = [...new Set(Levels.LEVELS.map((l) => l.photo))];
    const has = new Set(done.map((l) => l.photo));
    el.innerHTML = `<section class="jg-gallery">
      <h3>🖼️ Minha galeria <small>${has.size} de ${photos.length} fotos</small></h3>
      <div class="jg-gallery-list">${photos.map((p) => (has.has(p)
        ? `<figure><img src="/games/click/img/${p}.jpg" alt="${Levels.PHOTOS[p]}" loading="lazy"><figcaption>${Levels.PHOTOS[p]}</figcaption></figure>`
        : '<figure class="is-locked"><span>🧩</span><figcaption>?</figcaption></figure>')).join('')}</div>
    </section>`;
  }

  let shell = null;
  window.Plataforma.registerGame('quebracabeca', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'quebracabeca',
        title: 'Quebra-cabeça',
        icon: '🧩',
        hello: 'Monte as fotos de bichos peça por peça!',
        Levels,
        record: { key: 'best', label: 's', lower: true },
        rules: (level) => [
          '👆 Arraste cada peça até o lugar dela na moldura. Perto do lugar certo, ela gruda.',
          level.shadow ? '🖼️ A foto clarinha no fundo mostra onde vai cada peça.' : '🙈 Sem a foto no fundo: segure o botão 👁️ para espiar.',
          ...(level.rotate ? ['🔄 As peças estão viradas: toque numa peça (sem arrastar) para girar.'] : []),
          '🧺 O botão "Arrumar peças" junta as peças soltas embaixo.',
          `⏱ 3 estrelas montando em até ${Levels.parSeconds(level)} segundos.`,
        ],
        mapExtra: gallery,
        play,
      });
      ctx.mascot.mount(container);
      await shell.load();
    },
    unmount() { if (shell) shell.destroy(); shell = null; },
  });
})();
