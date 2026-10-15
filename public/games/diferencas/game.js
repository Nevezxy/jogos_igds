// public/games/diferencas/game.js
// 🔍 Encontre a Diferença: as duas cenas lado a lado (uma em cima da outra
// no celular). Toque onde estiver diferente, em qualquer uma das duas: a
// diferença achada fica marcada nas duas. As telas de fora são as de todos
// os jogos de raciocínio (js/shared/puzzleshell.js).

(function () {
  const Levels = window.DiferencasLevels;
  const S = window.DiffScene;
  const NS = 'http://www.w3.org/2000/svg';

  function play(level, area, api) {
    const scene = S.makeScene(level, api.seed);
    const found = scene.diffs.map(() => false);
    const clicks = [];
    let errors = 0;
    let hints = 0;
    let ended = false;
    let lastError = 0;

    const sceneSvg = (side) => `<svg class="df-scene" data-side="${side}" viewBox="0 0 ${S.W} ${S.H}" role="img" aria-label="Cena ${side === 'left' ? 'da esquerda' : 'da direita'}">${S.svg(scene, side)}<g class="df-marks"></g></svg>`;
    area.innerHTML = `
      <div class="df-wrap">
        <div class="df-dots" aria-label="Diferenças achadas">${scene.diffs.map(() => '<span class="df-dot"></span>').join('')}</div>
        <div class="df-scenes">${sceneSvg('left')}${sceneSvg('right')}</div>
        <div class="df-tools">
          <button type="button" class="btn-mini" data-hint>💡 Dica</button>
          <span class="df-msg" aria-live="polite">Encontre ${scene.diffs.length} diferenças entre as duas cenas (${S.THEMES[scene.theme].name.toLowerCase()}).</span>
        </div>
      </div>`;
    const svgs = [...area.querySelectorAll('.df-scene')];
    const dots = [...area.querySelectorAll('.df-dot')];
    const msg = area.querySelector('.df-msg');

    function mark(cls, x, y, r, ttl) {
      svgs.forEach((svg) => {
        const g = svg.querySelector('.df-marks');
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x);
        c.setAttribute('cy', y);
        c.setAttribute('r', r);
        c.setAttribute('class', cls);
        g.appendChild(c);
        if (ttl) setTimeout(() => c.remove(), ttl);
      });
    }

    function cross(svg, x, y) {
      const g = svg.querySelector('.df-marks');
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', y + 8);
      t.setAttribute('class', 'df-miss');
      t.textContent = '✕';
      g.appendChild(t);
      setTimeout(() => t.remove(), 700);
    }

    function stats() {
      const n = found.filter(Boolean).length;
      api.stats(`<span title="Diferenças achadas">🔍 <b>${n}/${found.length}</b></span><span title="Toques errados">❌ <b>${errors}</b></span>${hints ? `<span title="Dicas">💡 <b>${hints}</b></span>` : ''}`);
    }

    function tap(svg, ev) {
      if (ended) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const x = Math.round(p.x * 10) / 10;
      const y = Math.round(p.y * 10) / 10;
      if (x < 0 || y < 0 || x > S.W || y > S.H) return;
      // toque perto de uma diferença já achada não conta como erro
      if (scene.diffs.some((d, i) => found[i] && d.circles.some(([cx, cy, r]) => Math.hypot(cx - x, cy - y) <= r))) return;
      const i = S.hit(scene, found, x, y);
      if (i < 0 && Date.now() - lastError < 350) return; // toques repetidos sem querer
      clicks.push([x, y]);
      if (i >= 0) {
        found[i] = true;
        svgs.forEach((s) => s.querySelectorAll('.df-hint').forEach((h) => h.remove()));
        scene.diffs[i].circles.forEach(([cx, cy, r]) => mark('df-found', cx, cy, r));
        dots[found.filter(Boolean).length - 1].classList.add('is-on');
        api.sound.play('ding');
        const left = found.filter((f) => !f).length;
        msg.textContent = left ? `Achou! Faltam ${left}. 👀` : 'Achou todas! 🎉';
        stats();
        if (!left) win();
        return;
      }
      errors++;
      lastError = Date.now();
      api.sound.play('bonk');
      cross(svg, x, y);
      msg.textContent = 'Aí está igual nas duas. Olhe com calma!';
      stats();
    }

    function win() {
      ended = true;
      const stars = Levels.starsFor(level, { errors, hints });
      api.finish({
        delay: 1200,
        body: { clicks, hints },
        stars,
        record: errors,
        msg: errors === 0 && !hints ? 'Nenhum toque errado! Olho de águia! 🦅' : `Você achou as ${found.length} diferenças${errors ? ` com ${errors} toque${errors === 1 ? '' : 's'} errado${errors === 1 ? '' : 's'}` : ''}${hints ? ` e ${hints} dica${hints === 1 ? '' : 's'}` : ''}.`,
        stats: [{ value: found.length, label: '🔍 diferenças' }, { value: errors, label: '❌ toques errados' }, { value: `${Math.round(api.elapsed() / 1000)} s`, label: '⏱ tempo' }],
      });
    }

    svgs.forEach((svg) => svg.addEventListener('pointerdown', (ev) => { ev.preventDefault(); tap(svg, ev); }));
    api.hintButton(area.querySelector('[data-hint]'), () => {
      if (ended) return false;
      const i = found.findIndex((f) => !f);
      if (i < 0) return false;
      hints++;
      svgs.forEach((s) => s.querySelectorAll('.df-hint').forEach((h) => h.remove()));
      const [cx, cy, r] = scene.diffs[i].circles[0];
      mark('df-hint', cx, cy, r + 6, 3200);
      msg.textContent = '💡 Olhe dentro do círculo amarelo!';
      api.sound.play('whoosh');
      stats();
    });
    stats();

    return { destroy() { ended = true; } };
  }

  let shell = null;
  window.Plataforma.registerGame('diferencas', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'diferencas',
        title: 'Encontre a Diferença',
        icon: '🔍',
        hello: 'As duas cenas parecem iguais, mas não são! Ache as diferenças.',
        Levels,
        record: { key: 'best', label: 'toques errados', lower: true },
        rules: (level) => [
          `🔍 Ache as ${level.diffs} diferenças entre as duas cenas.`,
          '👆 Toque onde estiver diferente, em qualquer uma das cenas.',
          level.kinds.includes('flip') ? '🔄 Pode ter: figura que sumiu ou apareceu, cor trocada, tamanho, lugar e figura virada.' : level.kinds.includes('size') ? '📏 Pode ter: figura que sumiu ou apareceu, cor trocada, tamanho e lugar.' : '👀 Pode ter: figura que sumiu, figura a mais e cor trocada.',
          '⭐ 3 estrelas com no máximo 1 toque errado e sem dica.',
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
