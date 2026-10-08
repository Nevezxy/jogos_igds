// public/js/shared/levelmap.js
// Mapa de mundos e fases usado pelos jogos com fases (Teclado Mágico, Conta
// Comigo). Deixa claro o que já foi feito e o que falta:
//   ✓ feita       (ganhou pelo menos 1 estrela): verde, com o selo ✓
//   ↻ tentou      (jogou, mas sem estrela ainda): laranja
//   • pendente    (nunca jogou): branca, com borda tracejada
//   ▶ agora       (a próxima recomendada): amarela, pulsando
// Em cima, a legenda e o filtro "Todas · Pendentes · Feitas" (guardado no
// navegador). Cada mundo mostra quantas fases já fez.
//
// LevelMap.render(container, {
//   worlds,                     [{ id, icon, name, color, levels: [{ id, title, section? }] }]
//                               `section` abre uma etapa dentro do mundo ("Dezena",
//                               "Centena"...), que vale até a próxima
//   stateOf(level) -> { stars, plays, locked? }
//   nextId,                     fase recomendada
//   storageKey,                 onde guardar o filtro escolhido
//   worldLabel(world, index),   título do mundo (padrão "Mundo N · nome")
//   onPick(level),
// })

(function () {
  const FILTERS = [
    { id: 'all', label: 'Todas' },
    { id: 'pending', label: '• Pendentes' },
    { id: 'done', label: '✓ Feitas' },
  ];

  function statusOf(st, isNext) {
    if (st.locked) return 'locked';
    if (st.stars > 0) return 'done';
    if (isNext) return 'next';
    if (st.plays > 0) return 'tried';
    return 'pending';
  }

  const STATUS_TEXT = {
    done: 'feita',
    next: 'próxima',
    tried: 'tentou, falta estrela',
    pending: 'pendente',
    locked: 'bloqueada',
  };

  const starsText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  function readFilter(key) {
    try { return localStorage.getItem(key) || 'all'; } catch (e) { return 'all'; }
  }
  function saveFilter(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function render(container, opts) {
    const {
      worlds, stateOf, nextId, storageKey = 'levelmap_filter', onPick,
      worldLabel = (w, i) => `Mundo ${i + 1} · ${w.name}`,
    } = opts;
    let filter = readFilter(storageKey);
    if (!FILTERS.some((f) => f.id === filter)) filter = 'all';

    container.innerHTML = '';
    container.classList.add('lm');

    // totais (para o filtro e a legenda)
    const all = worlds.flatMap((w) => w.levels.map((l) => ({ level: l, st: stateOf(l) })));
    const doneCount = all.filter((x) => x.st.stars > 0).length;

    // ---- legenda + filtro ----
    const bar = el('div', 'lm-bar');
    const legend = el('div', 'lm-legend');
    legend.setAttribute('aria-hidden', 'true');
    [['done', '✓', 'feita'], ['tried', '↻', 'tentou'], ['pending', '•', 'pendente'], ['next', '▶', 'próxima']].forEach(([cls, sym, txt]) => {
      const item = el('span', `lm-legend-item is-${cls}`);
      item.append(el('i', null, sym), document.createTextNode(` ${txt}`));
      legend.appendChild(item);
    });
    const count = el('span', 'lm-count', `✓ ${doneCount} de ${all.length} fases feitas`);
    const chips = el('div', 'lm-filters');
    chips.setAttribute('role', 'radiogroup');
    chips.setAttribute('aria-label', 'Mostrar fases');
    FILTERS.forEach((f) => {
      const b = el('button', 'lm-filter', f.label);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(f.id === filter));
      const n = f.id === 'all' ? all.length : f.id === 'done' ? doneCount : all.length - doneCount;
      b.append(el('small', null, ` ${n}`));
      b.addEventListener('click', () => {
        saveFilter(storageKey, f.id);
        render(container, opts);
      });
      chips.appendChild(b);
    });
    bar.append(count, legend, chips);
    container.appendChild(bar);

    // ---- mundos ----
    const list = el('div', 'lm-worlds');
    let shown = 0;
    worlds.forEach((world, w) => {
      const states = world.levels.map((l) => ({ level: l, st: stateOf(l) }));
      const done = states.filter((x) => x.st.stars > 0).length;
      const earned = states.reduce((n, x) => n + (x.st.stars || 0), 0);
      const visible = states.filter((x) => filter === 'all'
        || (filter === 'done' ? x.st.stars > 0 : !(x.st.stars > 0)));
      if (!visible.length) return;
      shown += visible.length;

      const card = el('section', 'lm-world');
      card.style.setProperty('--world', `var(--${world.color || 'violet'})`);
      const complete = done === states.length;
      card.classList.toggle('is-complete', complete);
      const allLocked = states.every((x) => x.st.locked);
      card.classList.toggle('is-locked', allLocked);

      const head = el('header', 'lm-world-head');
      head.append(
        el('span', 'lm-world-icon', allLocked ? '🔒' : world.icon),
        el('span', 'lm-world-name', worldLabel(world, w)),
      );
      const badges = el('span', 'lm-world-badges');
      const prog = el('span', `lm-world-done${complete ? ' is-complete' : ''}`, complete ? `🏆 ${done}/${states.length}` : `✓ ${done}/${states.length}`);
      prog.title = `${done} de ${states.length} fases feitas`;
      badges.append(prog, el('span', 'lm-world-stars', `⭐ ${earned}/${states.length * 3}`));
      head.appendChild(badges);
      // barrinha de quanto do mundo já foi feito
      const meter = el('div', 'lm-world-meter');
      meter.setAttribute('aria-hidden', 'true');
      const fill = el('i');
      fill.style.width = `${(done / states.length) * 100}%`;
      meter.appendChild(fill);

      const grid = el('div', 'lm-levels');
      // etapa de cada fase (a última `section` antes dela)
      const sectionOf = new Map();
      let sec = null;
      world.levels.forEach((l) => { if (l.section) sec = l.section; sectionOf.set(l, sec); });
      let lastSection = null;
      visible.forEach(({ level, st }) => {
        const i = world.levels.indexOf(level);
        const section = sectionOf.get(level);
        if (section && section !== lastSection) {
          const inSection = states.filter((x) => sectionOf.get(x.level) === section);
          const head = el('div', 'lm-section', section);
          head.appendChild(el('small', null, ` ✓ ${inSection.filter((x) => x.st.stars > 0).length}/${inSection.length}`));
          grid.appendChild(head);
        }
        lastSection = section;
        const status = statusOf(st, nextId === level.id);
        const btn = el('button', `lm-level is-${status}`);
        btn.type = 'button';
        btn.disabled = status === 'locked';
        btn.dataset.level = level.id;
        btn.title = status === 'locked' ? 'Ganhe 1 estrela na fase anterior para liberar' : level.title;
        btn.setAttribute('aria-label', `Fase ${i + 1}: ${level.title}. ${STATUS_TEXT[status]}${st.stars ? `, ${st.stars} de 3 estrelas` : ''}`);
        const num = el('span', 'lm-level-num', status === 'locked' ? '🔒' : String(i + 1));
        // a próxima que já foi tentada mostra ↻ (tentou) em vez de ▶
        const tag = el('span', 'lm-level-tag', { done: '✓', tried: '↻', next: st.plays > 0 ? '↻' : '▶', pending: '', locked: '' }[status]);
        tag.setAttribute('aria-hidden', 'true');
        btn.append(num, tag, el('span', 'lm-level-title', level.title), el('span', 'lm-level-stars', starsText(st.stars || 0)));
        if (status === 'next') btn.appendChild(el('span', 'lm-level-now', 'agora'));
        btn.addEventListener('click', () => onPick(level));
        grid.appendChild(btn);
      });
      card.append(head, meter, grid);
      list.appendChild(card);
    });
    if (!shown) {
      list.appendChild(el('p', 'lm-empty', filter === 'done'
        ? 'Nenhuma fase feita ainda. Escolha uma fase e ganhe a primeira estrela! ⭐'
        : 'Você fez todas as fases! 🏆 Jogue de novo para conquistar 3 estrelas em todas.'));
    }
    container.appendChild(list);
  }

  window.LevelMap = { render };
})();
