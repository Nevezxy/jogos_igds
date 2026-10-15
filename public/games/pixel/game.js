// public/games/pixel/game.js
// 🎨 Pixel Art: o quadro numerado, a paleta, o pincel e o balde. Escolha a
// cor pelo número e pinte (toque, ou segure e arraste). No fim o desenho
// aparece e vai para a galeria, que fica no mapa. As telas de fora são as de
// todos os jogos de raciocínio (js/shared/puzzleshell.js).

(function () {
  const Levels = window.PixelLevels;
  const R = window.PixelRules;
  const ZOOMS = [1, 1.5, 2.2];

  function play(level, area, api) {
    const design = Levels.designOf(level);
    const pic = R.parse(design);
    const painted = new Array(pic.target.length).fill(0);
    const actions = [];
    const rng = window.SeededRng.rng(api.seed);
    const labels = pic.target.map((t) => (!t ? '' : level.op ? R.expression(t, level.op, rng) : String(t)));
    let errors = 0;
    let color = 1;
    let bucket = false;
    let zoom = 0;
    let ended = false;
    let down = null;

    area.innerHTML = `
      <div class="px-wrap ${level.op ? 'is-math' : ''}">
        <div class="px-palette" role="radiogroup" aria-label="Cores">
          ${design.palette.map((c, i) => `<button type="button" class="px-color" role="radio" data-color="${i + 1}" style="--c:${c}" aria-label="Cor ${i + 1}"><b>${i + 1}</b><small data-left></small></button>`).join('')}
        </div>
        <div class="px-tools">
          ${level.bucket ? `<div class="px-mode" role="radiogroup" aria-label="Ferramenta">
            <button type="button" role="radio" data-tool="brush" aria-checked="true">🖌️ Pincel</button>
            <button type="button" role="radio" data-tool="bucket" aria-checked="false">🪣 Balde</button>
          </div>` : ''}
          ${pic.w > 12 ? '<button type="button" class="btn-mini" data-zoom="-1" aria-label="Diminuir">🔍−</button><button type="button" class="btn-mini" data-zoom="1" aria-label="Aumentar">🔍+</button>' : ''}
        </div>
        <div class="px-scroll">
          <div class="px-board" style="--w:${pic.w}">
            ${pic.target.map((t, i) => (t ? `<i data-i="${i}">${labels[i]}</i>` : `<i class="is-bg" data-bg></i>`)).join('')}
          </div>
        </div>
        <p class="px-msg" aria-live="polite"></p>
      </div>`;
    const $ = (s) => area.querySelector(s);
    const board = $('.px-board');
    const scroll = $('.px-scroll');
    const cells = [...board.children];
    const msg = $('.px-msg');
    const colorBtns = [...area.querySelectorAll('[data-color]')];

    function sizeCells() {
      const availW = Math.max(200, area.clientWidth - 30);
      const availH = Math.max(220, window.innerHeight - 330);
      const max = level.op ? 48 : 38;
      const fit = Math.max(level.op ? 26 : 11, Math.min(max, Math.floor(availW / pic.w), Math.floor(availH / pic.h)));
      const size = Math.round(fit * ZOOMS[zoom]);
      board.style.setProperty('--cell', `${size}px`);
      scroll.classList.toggle('is-zoomed', zoom > 0);
    }

    const left = (c) => pic.target.reduce((n, t, i) => n + (t === c && painted[i] !== t ? 1 : 0), 0);

    function renderPalette() {
      colorBtns.forEach((b) => {
        const c = Number(b.dataset.color);
        const n = left(c);
        b.setAttribute('aria-checked', String(c === color));
        b.classList.toggle('is-done', n === 0);
        b.querySelector('[data-left]').textContent = n ? n : '✓';
      });
      cells.forEach((el, i) => { if (pic.target[i]) el.classList.toggle('is-target', pic.target[i] === color && painted[i] !== color); });
      api.stats(`<span title="Quadradinhos que faltam">🎨 <b>${pic.target.reduce((n, t, i) => n + (t && painted[i] !== t ? 1 : 0), 0)}</b></span><span title="Erros">❌ <b>${errors}</b></span>`);
    }

    function pick(c) {
      if (c < 1 || c > pic.colors) return;
      color = c;
      api.sound.play('click');
      msg.textContent = '';
      renderPalette();
    }

    function setTool(tool) {
      bucket = tool === 'bucket';
      area.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tool === tool)));
    }

    function drawCell(i) {
      const el = cells[i];
      const p = painted[i];
      el.style.background = p ? design.palette[p - 1] : '';
      el.classList.toggle('is-ok', p === pic.target[i]);
      el.classList.toggle('is-wrong', Boolean(p) && p !== pic.target[i]);
    }

    function act(i, first) {
      if (ended) return;
      const t = pic.target[i];
      if (!t || painted[i] === t) return;
      if (bucket && !first) return;
      if (!bucket && !first && color !== t) return; // arrastando, a cor errada só passa por cima
      const useBucket = bucket ? 1 : 0;
      const r = R.paint(pic, painted, [i, color, useBucket]);
      if (!r.ok) return;
      actions.push([i, color, useBucket]);
      r.cells.forEach(drawCell);
      if (r.error) {
        errors++;
        api.sound.play('bonk');
        const what = level.op ? `faça a conta: ${labels[i]} = ?` : `esse é da cor ${t}`;
        msg.textContent = bucket ? `🪣 Ops! Essa área não é da cor ${color}: ${what}` : `✋ Ops! ${what[0].toUpperCase()}${what.slice(1)}. Pinte de novo com a cor certa.`;
        cells[i].classList.remove('fx-shake'); void cells[i].offsetWidth; cells[i].classList.add('fx-shake');
      } else {
        api.sound.play(r.cells.length > 4 ? 'whoosh' : 'pop');
        if (msg.textContent.startsWith('✋') || msg.textContent.startsWith('🪣')) msg.textContent = '';
      }
      if (left(color) === 0 && !R.done(pic, painted)) {
        const next = colorBtns.map((b) => Number(b.dataset.color)).find((c) => left(c) > 0);
        msg.textContent = `✓ Cor ${color} completa!${next ? ` Agora a cor ${next}.` : ''}`;
        api.sound.play('ding');
        if (next) color = next;
      }
      renderPalette();
      if (R.done(pic, painted)) win();
    }

    function win() {
      ended = true;
      board.classList.add('is-done');
      cells.forEach((el) => el.classList.remove('is-target'));
      msg.textContent = `🖼️ ${design.name}! Ficou lindo!`;
      const stars = Levels.starsFor(level, { errors, total: pic.total });
      api.finish({
        delay: 1800,
        body: { actions },
        stars,
        record: errors,
        msg: errors === 0 ? 'Nenhum erro! Que artista! 🎨' : `Você errou ${errors} quadradinho${errors === 1 ? '' : 's'}. O desenho foi para a galeria!`,
        stats: [{ value: pic.total, label: '🎨 quadradinhos' }, { value: errors, label: '❌ erros' }, { value: `${Math.round(api.elapsed() / 1000)} s`, label: '⏱ tempo' }],
      });
    }

    // pintar: toque, ou segure e arraste (com a lupa, arrastar o dedo rola o quadro)
    const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest('.px-board [data-i]');
    board.addEventListener('pointerdown', (ev) => {
      const el = ev.target.closest('[data-i]');
      if (!el) return;
      if (ev.pointerType === 'mouse' || zoom === 0) ev.preventDefault();
      down = { last: Number(el.dataset.i) };
      act(down.last, true);
    });
    board.addEventListener('pointermove', (ev) => {
      if (!down || (ev.pointerType !== 'mouse' && zoom > 0)) return;
      const el = cellAt(ev.clientX, ev.clientY);
      if (!el) return;
      const i = Number(el.dataset.i);
      if (i === down.last) return;
      // o dedo pode pular quadradinhos quando anda rápido: pinta a linha toda até aqui
      const [x0, y0] = [down.last % pic.w, Math.floor(down.last / pic.w)];
      const [x1, y1] = [i % pic.w, Math.floor(i / pic.w)];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 1; k <= steps; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / steps);
        const y = Math.round(y0 + ((y1 - y0) * k) / steps);
        act(y * pic.w + x, false);
      }
      down.last = i;
    });
    const up = () => { down = null; };
    window.addEventListener('pointerup', up);
    board.addEventListener('pointercancel', up);

    area.querySelector('.px-palette').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-color]');
      if (b) pick(Number(b.dataset.color));
    });
    area.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { setTool(b.dataset.tool); api.sound.play('click'); }));
    area.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
      zoom = Math.max(0, Math.min(ZOOMS.length - 1, zoom + Number(b.dataset.zoom)));
      sizeCells();
    }));
    const onResize = () => sizeCells();
    window.addEventListener('resize', onResize);

    sizeCells();
    pic.target.forEach((t, i) => { if (t) drawCell(i); });
    renderPalette();

    return {
      onKey(ev) {
        if (/^[0-9]$/.test(ev.key)) { ev.preventDefault(); pick(ev.key === '0' ? 10 : Number(ev.key)); }
        else if ((ev.key === 'b' || ev.key === 'B') && level.bucket) setTool(bucket ? 'brush' : 'bucket');
      },
      destroy() {
        ended = true;
        window.removeEventListener('pointerup', up);
        window.removeEventListener('resize', onResize);
      },
    };
  }

  // a galeria: os desenhos já pintados, no mapa
  function thumb(design, size) {
    const h = design.rows.length;
    const w = design.rows[0].length;
    const canvas = document.createElement('canvas');
    const s = Math.max(1, Math.floor(size / Math.max(w, h)));
    canvas.width = w * s;
    canvas.height = h * s;
    const g = canvas.getContext('2d');
    design.rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = design.palette[R.CODE.indexOf(ch)];
      g.fillRect(x * s, y * s, s, s);
    }));
    return canvas;
  }

  function gallery(el, progress) {
    const done = Levels.LEVELS.filter((l) => progress.levels && progress.levels[l.id] && progress.levels[l.id].stars >= 1);
    el.innerHTML = `<section class="px-gallery">
      <h3>🖼️ Minha galeria <small>${done.length} de ${Levels.LEVELS.length}</small></h3>
      <div class="px-gallery-list">${Levels.LEVELS.map((l) => `<figure data-g="${l.id}" class="${done.includes(l) ? '' : 'is-locked'}" title="${done.includes(l) ? l.title : 'Ainda não pintado'}"><span></span><figcaption>${done.includes(l) ? l.title : '?'}</figcaption></figure>`).join('')}</div>
    </section>`;
    done.forEach((l) => { el.querySelector(`[data-g="${l.id}"] span`).appendChild(thumb(Levels.designOf(l), 64)); });
  }

  let shell = null;
  window.Plataforma.registerGame('pixel', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'pixel',
        title: 'Pixel Art',
        icon: '🎨',
        hello: 'Pinte cada quadradinho com a cor do número e descubra o desenho!',
        Levels,
        record: { key: 'best', label: 'erros', lower: true },
        rules: (level) => [
          '🎨 Toque numa cor da paleta e pinte os quadradinhos com aquele número.',
          '👆 Toque num quadradinho, ou segure e arraste para pintar vários.',
          ...(level.bucket ? ['🪣 O balde pinta de uma vez a área toda do mesmo número.'] : []),
          ...(level.op ? ['🧮 Faça a conta do quadradinho: o resultado é o número da cor.'] : []),
          '✋ Pintou errado? O quadradinho fica marcado: é só pintar de novo com a cor certa.',
          '⭐ 3 estrelas com quase nenhum erro.',
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
