// public/games/balanca/game.js
// ⚖️ Equilibre a Balança: a balança de dois pratos (inclina para o lado mais
// pesado), o objeto à esquerda e a caixa de pesos. Toque num peso para pôr
// no prato escolhido; toque num peso do prato para devolver. Nas fases de
// "quanto pesa?", depois de equilibrar a criança escolhe o peso do objeto.
// As telas de fora são as de todos os jogos de raciocínio.

(function () {
  const Levels = window.BalancaLevels;
  const S = window.BalancaScale;
  const MAX_TILT = 16; // graus

  function play(level, area, api) {
    const tasks = S.makeRound(level, api.seed);
    const both = level.mode === 'both';
    const ask = level.mode === 'unknown' || level.ask;
    const unit = level.unit;
    const results = [];
    let i = 0;
    let side = 'R';
    let st = null; // { L: [], R: [], moves, wrong, balanced }
    let extra = 0;
    let ended = false;

    area.innerHTML = `
      <div class="bl">
        <div class="bl-dots">${tasks.map(() => '<span class="bl-dot"></span>').join('')}</div>
        <div class="bl-scale">
          <div class="bl-beam" style="--tilt:0deg">
            <div class="bl-pan is-left" data-pan="L"><div class="bl-pan-inner"><div class="bl-pan-items"></div><div class="bl-plate"></div></div></div>
            <div class="bl-pan is-right" data-pan="R"><div class="bl-pan-inner"><div class="bl-pan-items"></div><div class="bl-plate"></div></div></div>
          </div>
          <div class="bl-post"></div>
          <div class="bl-foot"></div>
          <div class="bl-status" data-status></div>
        </div>
        ${both ? `<div class="bl-side" role="radiogroup" aria-label="Em qual prato pôr o peso">
          <button type="button" data-side="L" role="radio">◀ prato do objeto</button>
          <button type="button" data-side="R" role="radio">prato da direita ▶</button></div>` : ''}
        <div class="bl-tray" data-tray></div>
        <div class="bl-ask" data-ask hidden><p>⚖️ Equilibrou! Quanto pesa o objeto?</p><div class="bl-options"></div></div>
        <p class="bl-feedback" data-feedback aria-live="polite"></p>
      </div>`;
    const $ = (s) => area.querySelector(s);
    const dots = [...area.querySelectorAll('.bl-dot')];

    function setSide(s) {
      side = s;
      area.querySelectorAll('[data-side]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.side === s)));
    }
    area.querySelectorAll('[data-side]').forEach((b) => b.addEventListener('click', () => { setSide(b.dataset.side); api.sound.play('click'); }));
    // tocar no prato também escolhe o lado
    area.querySelectorAll('[data-pan]').forEach((p) => p.addEventListener('click', (ev) => {
      const piece = ev.target.closest('[data-piece]');
      if (piece) { removePiece(Number(piece.dataset.piece)); return; }
      if (both) { setSide(p.dataset.pan); api.sound.play('click'); }
    }));
    $('[data-tray]').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-piece]');
      if (b) addPiece(Number(b.dataset.piece));
    });

    const weightHtml = (p, where) => `<button type="button" class="bl-weight" data-piece="${p.id}" style="--size:${sizeOf(p.w)}" aria-label="${where} peso de ${S.fmt(p.w, unit)}"><span>${S.fmt(p.w, unit)}</span></button>`;
    // pesos maiores ficam um pouco maiores no desenho
    const all = level.palette;
    const sizeOf = (w) => (0.75 + 0.5 * (all.indexOf(w) / Math.max(1, all.length - 1))).toFixed(2);

    function show() {
      const t = tasks[i];
      st = { L: [], R: [], moves: 0, wrong: 0, balanced: false };
      setSide('R');
      dots.forEach((d, k) => d.classList.toggle('is-current', k === i));
      $('[data-ask]').hidden = true;
      $('[data-feedback]').textContent = '';
      render();
    }

    function render() {
      const t = tasks[i];
      const r = S.weigh(t, st);
      const diff = r.right - r.left;
      const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, (diff / Math.max(1, t.object.weight)) * MAX_TILT * 1.6));
      $('.bl-beam').style.setProperty('--tilt', `${diff === 0 ? 0 : tilt}deg`);
      const obj = `<div class="bl-object"><span class="bl-object-emoji">${t.object.emoji}</span><b class="bl-object-tag">${ask && !st.balancedAnswered ? '?' : S.fmt(t.object.weight, unit)}</b></div>`;
      const pieceOf = (id) => t.pieces[id];
      area.querySelector('[data-pan="L"] .bl-pan-items').innerHTML = obj + st.L.map((id) => weightHtml(pieceOf(id), 'Tirar o')).join('');
      area.querySelector('[data-pan="R"] .bl-pan-items').innerHTML = st.R.map((id) => weightHtml(pieceOf(id), 'Tirar o')).join('');
      const used = new Set([...st.L, ...st.R]);
      $('[data-tray]').innerHTML = t.pieces.filter((p) => !used.has(p.id)).map((p) => weightHtml(p, 'Pôr o')).join('') || '<span class="bl-empty">Todos os pesos estão na balança.</span>';
      const status = $('[data-status]');
      status.textContent = diff === 0 && used.size ? '⚖️ Equilibrou!' : diff > 0 ? '⬇ direita mais pesada' : used.size ? '⬇ esquerda mais pesada' : '';
      status.classList.toggle('is-ok', diff === 0 && used.size > 0);
      area.querySelector('.bl-scale').classList.toggle('is-balanced', diff === 0 && used.size > 0);
      api.stats(`<span title="Tarefa">📋 <b>${i + 1}/${tasks.length}</b></span><span title="Pesos colocados ou tirados">✋ <b>${st.moves}</b></span>`);
      return r;
    }

    function addPiece(id) {
      if (ended || st.balanced) return;
      st[both ? side : 'R'].push(id);
      st.moves++;
      api.sound.play('pop');
      after();
    }
    function removePiece(id) {
      if (ended || st.balanced) return;
      st.L = st.L.filter((x) => x !== id);
      st.R = st.R.filter((x) => x !== id);
      st.moves++;
      api.sound.play('click');
      after();
    }

    function after() {
      const r = render();
      if (!r.ok) return;
      st.balanced = true;
      api.sound.play('ding');
      if (ask) { askWeight(); return; }
      done();
    }

    function askWeight() {
      const t = tasks[i];
      $('[data-ask]').hidden = false;
      const box = $('.bl-options');
      box.innerHTML = t.options.map((v) => `<button type="button" class="bl-option" data-v="${v}">${S.fmt(v, unit)}</button>`).join('');
      box.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
        const v = Number(b.dataset.v);
        st.answer = v;
        if (v === t.object.weight) {
          st.balancedAnswered = true;
          $('[data-ask]').hidden = true;
          done();
        } else {
          st.wrong++;
          b.disabled = true;
          api.sound.play('bonk');
          $('[data-feedback]').textContent = both ? '💡 O objeto pesa o lado direito menos o peso que está junto dele.' : '💡 Some os pesos do outro prato.';
        }
      }));
    }

    function done() {
      const t = tasks[i];
      const taskExtra = Math.max(0, st.moves - t.min) + st.wrong * 2;
      extra += taskExtra;
      dots[i].classList.add(taskExtra === 0 ? 'is-right' : taskExtra <= 2 ? 'is-second' : 'is-slow');
      results.push({ L: st.L.slice(), R: st.R.slice(), moves: st.moves, wrong: st.wrong, ...(ask ? { answer: st.answer } : {}) });
      render();
      const b = area.querySelector('.bl-scale').getBoundingClientRect();
      api.fx.confetti({ amount: 28, origin: { x: b.left + b.width / 2, y: b.top + 30 }, power: 0.5 });
      $('[data-feedback]').textContent = taskExtra === 0 ? 'Perfeito! Com o mínimo de pesos 🎉' : `Equilibrou! Dava com ${t.min} ${t.min === 1 ? 'peso' : 'pesos'}.`;
      setTimeout(() => {
        if (ended) return;
        i++;
        if (i >= tasks.length) end(); else show();
      }, 1300);
    }

    function end() {
      ended = true;
      const stars = Levels.starsFor(level, { extra, count: tasks.length });
      api.finish({
        body: { tasks: results },
        stars,
        record: null,
        msg: stars === 3 ? 'Você equilibrou tudo quase sem trocar pesos! ⚖️' : 'Muito bem! Para mais estrelas, pense antes de pôr o peso.',
        stats: [{ value: tasks.length, label: '⚖️ equilibradas' }, { value: extra, label: '✋ jogadas a mais' }, { value: `${Math.round(api.elapsed() / 1000)} s`, label: '⏱ tempo' }],
      });
    }

    show();
    return { destroy() { ended = true; } };
  }

  let shell = null;
  window.Plataforma.registerGame('balanca', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'balanca',
        title: 'Equilibre a Balança',
        icon: '⚖️',
        hello: 'Ponha pesos até a balança ficar retinha!',
        Levels,
        rules: (level) => [
          '👆 Toque num peso para pôr na balança. Toque num peso da balança para tirar.',
          level.mode === 'both' || level.ask ? '↔️ Escolha o prato: o do objeto (esquerda) ou o da direita.' : '➡️ Os pesos vão para o prato da direita.',
          ...(level.mode === 'unknown' || level.ask ? ['❓ Depois de equilibrar, diga quanto o objeto pesa.'] : []),
          ...(level.unit ? ['🧈 1 kg = 1.000 g.'] : []),
          '⭐ Quanto menos pesos você trocar, mais estrelas.',
        ],
        play,
      });
      ctx.mascot.mount(container);
      await shell.load();
    },
    unmount() { if (shell) shell.destroy(); shell = null; },
  });
})();
