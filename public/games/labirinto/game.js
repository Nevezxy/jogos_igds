// public/games/labirinto/game.js
// 🌀 Labirinto: desenho (SVG), controles (setas do teclado, botões da tela e
// deslizar o dedo) e os modos invisível, no escuro e relativo. As telas de
// fora são as de todos os jogos de raciocínio (js/shared/puzzleshell.js).

(function () {
  const Levels = window.LabirintoLevels;
  const M = window.LabirintoMaze;
  const C = 40; // tamanho da casa no desenho
  const PAD = 4;
  const COLOR_CSS = { red: '#FF4D5E', blue: '#3A6FF7', yellow: '#F5B800' };
  const COLOR_NAME = { red: 'vermelha', blue: 'azul', yellow: 'amarela' };
  const KEYS_ABS = { ArrowUp: 'U', ArrowRight: 'R', ArrowDown: 'D', ArrowLeft: 'L', w: 'U', d: 'R', s: 'D', a: 'L', W: 'U', D: 'R', S: 'D', A: 'L' };
  const KEYS_REL = { ArrowUp: 'F', ArrowLeft: 'E', ArrowRight: 'D', w: 'F', a: 'E', d: 'D', W: 'F', A: 'E', D: 'D' };

  function play(level, area, api) {
    const m = M.makeMaze(level, api.seed);
    const relative = level.mode === 'relative';
    const invisible = level.mode === 'invisible';
    const dark = level.mode === 'dark';
    let st = M.initial(m);
    let cmds = '';
    let ended = false;
    const seenWalls = new Set(); // paredes descobertas (modo invisível): "casa:direção"
    const trail = new Set([m.start]);
    const W = m.w * C + PAD * 2;
    const H = m.h * C + PAD * 2;
    const xy = (c) => [(c % m.w) * C + PAD, Math.floor(c / m.w) * C + PAD];

    area.innerHTML = `
      <div class="lb-wrap">
        <svg class="lb-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Labirinto">
          <defs>
            <mask id="lb-light"><rect width="${W}" height="${H}" fill="white"/><circle class="lb-hole" r="${C * 1.9}" fill="black"/></mask>
          </defs>
          <rect class="lb-floor" x="${PAD}" y="${PAD}" width="${m.w * C}" height="${m.h * C}" rx="6"/>
          <g class="lb-trail"></g>
          <g class="lb-items"></g>
          <path class="lb-walls"/>
          <g class="lb-doors"></g>
          ${dark ? `<rect class="lb-dark" width="${W}" height="${H}" mask="url(#lb-light)"/>` : ''}
          <g class="lb-player"><circle r="${C * 0.38}"/><text text-anchor="middle" dominant-baseline="central" font-size="${C * 0.55}">🧒</text>
            ${relative ? `<path class="lb-arrow" d="M ${C * 0.42} 0 L ${C * 0.22} -${C * 0.16} L ${C * 0.22} ${C * 0.16} Z"/>` : ''}</g>
        </svg>
        <div class="lb-pad ${relative ? 'is-relative' : ''}">
          ${relative
            ? '<button type="button" data-cmd="E" aria-label="Virar para a esquerda">↶<small>virar</small></button><button type="button" data-cmd="F" aria-label="Andar para a frente">⬆<small>andar</small></button><button type="button" data-cmd="D" aria-label="Virar para a direita">↷<small>virar</small></button>'
            : '<span></span><button type="button" data-cmd="U" aria-label="Cima">▲</button><span></span><button type="button" data-cmd="L" aria-label="Esquerda">◀</button><button type="button" data-cmd="D" aria-label="Baixo">▼</button><button type="button" data-cmd="R" aria-label="Direita">▶</button>'}
        </div>
        <p class="lb-msg" aria-live="polite"></p>
      </div>`;
    const svg = area.querySelector('.lb-svg');
    const msg = area.querySelector('.lb-msg');

    // paredes: linha de cima e da esquerda de cada casa, e as bordas de baixo e da direita
    function drawWalls() {
      let d = '';
      for (let c = 0; c < m.w * m.h; c++) {
        const [x, y] = xy(c);
        const show = (dir) => !invisible || seenWalls.has(`${c}:${dir}`) || isBorder(c, dir);
        if ((m.walls[c] & 1) && show(0)) d += `M${x} ${y}h${C}`;
        if ((m.walls[c] & 8) && show(3)) d += `M${x} ${y}v${C}`;
        if ((c % m.w === m.w - 1) && (m.walls[c] & 2) && show(1)) d += `M${x + C} ${y}v${C}`;
        if ((Math.floor(c / m.w) === m.h - 1) && (m.walls[c] & 4) && show(2)) d += `M${x} ${y + C}h${C}`;
        // no modo invisível, a parede vista de uma casa também vale para a vizinha
        if (invisible) {
          if ((m.walls[c] & 2) && seenWalls.has(`${c}:1`) && c % m.w < m.w - 1) d += `M${x + C} ${y}v${C}`;
          if ((m.walls[c] & 4) && seenWalls.has(`${c}:2`) && Math.floor(c / m.w) < m.h - 1) d += `M${x} ${y + C}h${C}`;
        }
      }
      svg.querySelector('.lb-walls').setAttribute('d', d);
    }
    const isBorder = (c, dir) => (dir === 0 && c < m.w) || (dir === 2 && c >= m.w * (m.h - 1)) || (dir === 3 && c % m.w === 0) || (dir === 1 && c % m.w === m.w - 1);

    function drawItems() {
      const [ex, ey] = xy(m.exit);
      let html = `<text x="${ex + C / 2}" y="${ey + C / 2}" text-anchor="middle" dominant-baseline="central" font-size="${C * 0.62}">🏁</text>`;
      for (const k of m.keys) {
        if (st.keys.includes(k.color)) continue;
        const [kx, ky] = xy(k.cell);
        html += `<circle cx="${kx + C / 2}" cy="${ky + C / 2}" r="${C * 0.36}" fill="${COLOR_CSS[k.color]}" opacity=".35"/>
          <text x="${kx + C / 2}" y="${ky + C / 2}" text-anchor="middle" dominant-baseline="central" font-size="${C * 0.5}">🔑</text>`;
      }
      svg.querySelector('.lb-items').innerHTML = html;
      let doors = '';
      for (const door of m.doors) {
        if (st.keys.includes(door.color)) continue;
        const [ax, ay] = xy(door.a);
        const [bx, by] = xy(door.b);
        const vertical = ay === by; // vizinhas na horizontal: porta em pé
        const x = vertical ? Math.max(ax, bx) : ax;
        const y = vertical ? ay : Math.max(ay, by);
        doors += vertical
          ? `<rect x="${x - 4}" y="${y + 3}" width="8" height="${C - 6}" rx="3" fill="${COLOR_CSS[door.color]}"/><text x="${x}" y="${y + C / 2}" text-anchor="middle" dominant-baseline="central" font-size="${C * 0.34}">🔒</text>`
          : `<rect x="${x + 3}" y="${y - 4}" width="${C - 6}" height="8" rx="3" fill="${COLOR_CSS[door.color]}"/><text x="${x + C / 2}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${C * 0.34}">🔒</text>`;
      }
      svg.querySelector('.lb-doors').innerHTML = doors;
    }

    function drawTrail() {
      svg.querySelector('.lb-trail').innerHTML = [...trail].map((c) => {
        const [x, y] = xy(c);
        return `<rect x="${x + C * 0.3}" y="${y + C * 0.3}" width="${C * 0.4}" height="${C * 0.4}" rx="${C * 0.2}"/>`;
      }).join('');
    }

    function drawPlayer() {
      const [x, y] = xy(st.cell);
      const g = svg.querySelector('.lb-player');
      g.setAttribute('transform', `translate(${x + C / 2} ${y + C / 2})`);
      const arrow = g.querySelector('.lb-arrow');
      if (arrow) arrow.setAttribute('transform', `rotate(${(st.heading - 1) * 90})`);
      const hole = svg.querySelector('.lb-hole');
      if (hole) { hole.setAttribute('cx', x + C / 2); hole.setAttribute('cy', y + C / 2); }
    }

    function stats() {
      api.stats(`<span title="Passos">👣 <b>${st.steps}</b></span><span title="Batidas na parede">💥 <b>${st.bumps}</b></span>${m.keys.length ? `<span title="Chaves">🔑 <b>${st.keys.length}/${m.keys.length}</b></span>` : ''}`);
    }

    function run(cmd) {
      if (ended) return;
      const next = M.command(m, st, cmd, relative);
      if (!next) return;
      cmds += cmd;
      const before = st;
      st = next;
      if (st.last === 'wall' || st.last === 'door') {
        api.sound.play('bonk');
        if (invisible && st.last === 'wall') { seenWalls.add(`${before.cell}:${st.bumpDir}`); drawWalls(); }
        msg.textContent = st.last === 'door' ? `🔒 Porta trancada! Ache a chave ${COLOR_NAME[m.doors.find((d) => !st.keys.includes(d.color)).color]}.` : '';
        svg.classList.remove('fx-shake');
        void svg.getBoundingClientRect();
        svg.classList.add('fx-shake');
      } else if (st.last === 'key') {
        api.sound.play('ding');
        msg.textContent = `🔑 Pegou a chave ${COLOR_NAME[st.keys[st.keys.length - 1]]}!`;
        drawItems();
      } else if (st.last === 'move') {
        api.sound.play('click');
        msg.textContent = '';
      }
      trail.add(st.cell);
      drawTrail();
      drawPlayer();
      stats();
      if (st.done) end();
    }

    function end() {
      ended = true;
      const stars = Levels.starsFor(level, { steps: st.steps, shortest: m.shortest });
      api.sound.play('fanfare');
      api.finish({
        body: { cmds },
        stars,
        record: st.steps,
        msg: st.steps === m.shortest ? 'Pelo caminho mais curto! 🧭' : `O caminho mais curto tinha ${m.shortest} passos. Você deu ${st.steps}.`,
        stats: [{ value: st.steps, label: '👣 passos' }, { value: m.shortest, label: '🎯 mais curto' }, { value: st.bumps, label: '💥 batidas' }],
      });
    }

    // botões (segurar repete)
    let repeat = null;
    area.querySelectorAll('.lb-pad [data-cmd]').forEach((b) => {
      b.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        run(b.dataset.cmd);
        clearInterval(repeat);
        let first = true;
        repeat = setInterval(() => { if (first) { first = false; return; } run(b.dataset.cmd); }, 170);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => b.addEventListener(e, () => clearInterval(repeat)));
    });
    // deslizar o dedo no labirinto
    let swipe = null;
    svg.addEventListener('pointerdown', (ev) => { swipe = { x: ev.clientX, y: ev.clientY }; });
    svg.addEventListener('pointerup', (ev) => {
      if (!swipe) return;
      const dx = ev.clientX - swipe.x;
      const dy = ev.clientY - swipe.y;
      swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (relative) run(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'D' : 'E') : dy < 0 ? 'F' : 'F');
      else run(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U');
    });

    drawWalls();
    drawItems();
    drawTrail();
    drawPlayer();
    stats();

    return {
      onKey(ev) {
        const cmd = (relative ? KEYS_REL : KEYS_ABS)[ev.key];
        if (cmd) { ev.preventDefault(); run(cmd); }
      },
      destroy() { ended = true; clearInterval(repeat); },
    };
  }

  let shell = null;
  window.Plataforma.registerGame('labirinto', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'labirinto',
        title: 'Labirinto',
        icon: '🌀',
        hello: 'Leve o explorador até a bandeira 🏁 pelo caminho mais curto!',
        Levels,
        record: { key: 'best', label: 'passos', lower: true },
        rules: (level) => [
          level.mode === 'relative'
            ? '🧭 ↶ vira para a esquerda do explorador, ⬆ anda para a frente, ↷ vira para a direita (no teclado: ← ↑ →).'
            : '⌨️ Setas do teclado (ou W A S D), os botões da tela ou deslize o dedo no labirinto.',
          ...(level.keys ? ['🔑 Pegue a chave da mesma cor para abrir cada porta 🔒.'] : []),
          ...(level.mode === 'invisible' ? ['👻 As paredes só aparecem quando você bate nelas.'] : []),
          ...(level.mode === 'dark' ? ['🔦 Só dá para ver em volta da lanterna.'] : []),
          '🎯 Quanto mais perto do caminho mais curto, mais estrelas.',
        ],
        play,
      });
      ctx.mascot.mount(container);
      await shell.load();
    },
    unmount() { if (shell) shell.destroy(); shell = null; },
  });
})();
