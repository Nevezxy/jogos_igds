// public/games/memoria/game.js
// 🃏 Jogo da Memória: a mesa de cartas. As telas de fora (mapa, antes da
// fase, resultado) são as de todos os jogos de raciocínio
// (js/shared/puzzleshell.js). Contra o robô, ele vira as cartas dele e
// "lembra" de cada carta que vê com a chance do nível.

(function () {
  const Levels = window.MemoriaLevels;
  const Cards = window.MemoriaCards;
  const FLIP_BACK_MS = 1000;
  const ROBOT_STEP_MS = 750;

  function faceHtml(face) {
    if (face.t === 'emoji') return `<span class="mc-emoji">${face.v}</span>`;
    if (face.t === 'count') {
      return `<span class="mc-count" data-n="${face.n}">${Array.from({ length: face.n }, () => `<i>${face.v}</i>`).join('')}</span>`;
    }
    return `<span class="mc-text${face.small ? ' is-small' : ''}">${face.v}</span>`;
  }

  function play(level, area, api) {
    const deck = Cards.makeDeck(level, api.seed);
    const versus = Boolean(level.robot);
    const st = { open: [], matched: new Set(), flips: [], tries: 0, turn: 0, pairsBy: [0, 0], locked: false, ended: false };
    const memory = new Map(); // o que o robô lembra: carta → par
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

    area.innerHTML = `
      ${versus ? '<div class="mc-score"><span class="mc-who" data-who="0">🙂 Você: <b>0</b></span><span class="mc-who" data-who="1">🤖 Robô: <b>0</b></span></div>' : ''}
      <div class="mc-table" style="--cols:${Cards.columnsFor(deck.length)}"></div>`;
    const table = area.querySelector('.mc-table');
    const els = deck.map((card, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mc-card';
      b.setAttribute('aria-label', `Carta ${i + 1}`);
      b.innerHTML = `<span class="mc-inner"><span class="mc-back">?</span><span class="mc-front">${faceHtml(card.face)}</span></span>`;
      b.addEventListener('click', () => { if (!versus || st.turn === 0) pick(i); });
      table.appendChild(b);
      return b;
    });

    function stats() {
      const found = st.matched.size / 2;
      if (versus) {
        area.querySelectorAll('.mc-who').forEach((el) => {
          el.querySelector('b').textContent = st.pairsBy[el.dataset.who];
          el.classList.toggle('is-turn', Number(el.dataset.who) === st.turn && !st.ended);
        });
      }
      api.stats(`<span title="Tentativas">🔁 <b>${st.tries}</b></span><span title="Pares achados">✅ <b>${found}/${level.pairs}</b></span>`);
    }
    stats();

    function pick(i) {
      if (st.locked || st.ended || st.matched.has(i) || st.open.includes(i)) return;
      flip(i);
    }

    function flip(i) {
      st.open.push(i);
      st.flips.push(i);
      els[i].classList.add('is-open');
      api.sound.play('click');
      // o robô vê todas as cartas viradas (as dele e as da criança)
      if (versus && Math.random() < level.robot.memory) memory.set(i, deck[i].pair);
      if (st.open.length < 2) return;
      st.tries++;
      st.locked = true;
      const [a, b] = st.open;
      if (deck[a].pair === deck[b].pair) {
        later(() => {
          st.matched.add(a); st.matched.add(b);
          els[a].classList.add('is-matched'); els[b].classList.add('is-matched');
          st.pairsBy[st.turn]++;
          st.open = [];
          st.locked = false;
          api.sound.play('ding');
          const r = els[b].getBoundingClientRect();
          api.fx.confetti({ amount: 18, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, power: 0.45 });
          stats();
          if (st.matched.size === deck.length) { end(); return; }
          if (versus && st.turn === 1) later(robotTurn, ROBOT_STEP_MS); // achou: joga de novo
        }, 350);
      } else {
        later(() => {
          els[a].classList.remove('is-open'); els[b].classList.remove('is-open');
          st.open = [];
          st.locked = false;
          if (versus) {
            st.turn = 1 - st.turn;
            if (st.turn === 1) later(robotTurn, ROBOT_STEP_MS);
          }
          stats();
        }, FLIP_BACK_MS);
      }
      stats();
    }

    // vez do robô: se lembra de um par, vira os dois; senão arrisca
    function robotTurn() {
      if (st.ended) return;
      const free = deck.map((_, i) => i).filter((i) => !st.matched.has(i));
      const known = free.filter((i) => memory.has(i));
      let first = null;
      let second = null;
      for (const i of known) {
        const partner = known.find((j) => j !== i && memory.get(j) === memory.get(i));
        if (partner !== undefined) { first = i; second = partner; break; }
      }
      if (first === null) {
        const unknown = free.filter((i) => !memory.has(i));
        first = unknown.length ? unknown[Math.floor(Math.random() * unknown.length)] : free[0];
      }
      flipRobot(first);
      later(() => {
        if (st.ended) return;
        if (second === null) {
          const partner = free.find((j) => j !== first && memory.has(j) && memory.get(j) === deck[first].pair);
          if (partner !== undefined && memory.has(first)) second = partner;
          else {
            const rest = free.filter((j) => j !== first && !memory.has(j));
            const pool = rest.length ? rest : free.filter((j) => j !== first);
            second = pool[Math.floor(Math.random() * pool.length)];
          }
        }
        flipRobot(second);
      }, ROBOT_STEP_MS);
    }
    function flipRobot(i) {
      st.locked = false;
      flip(i);
    }

    function end() {
      st.ended = true;
      stats();
      const pairs = level.pairs;
      const outcome = st.pairsBy[0] > st.pairsBy[1] ? 'win' : st.pairsBy[0] === st.pairsBy[1] ? 'draw' : 'loss';
      const stars = Levels.starsFor(level, { tries: st.tries, pairs, outcome });
      let msg;
      if (versus) msg = outcome === 'win' ? `Você venceu o robô por ${st.pairsBy[0]} a ${st.pairsBy[1]}! 🏆` : outcome === 'draw' ? 'Empate! Quase...' : `O robô fez ${st.pairsBy[1]} pares. Lembre também das cartas que ele vira!`;
      else msg = stars === 3 ? 'Que memória! 🧠' : stars === 2 ? 'Muito bem! Para a 3ª estrela, faça com menos tentativas.' : 'Terminou! Tente lembrar onde cada carta estava.';
      api.finish({
        body: { flips: st.flips },
        stars,
        title: versus ? (outcome === 'win' ? 'Você venceu!' : outcome === 'draw' ? 'Empate!' : 'O robô venceu!') : undefined,
        msg,
        record: versus ? null : st.tries,
        stats: versus
          ? [{ value: st.pairsBy[0], label: '🙂 seus pares' }, { value: st.pairsBy[1], label: '🤖 pares do robô' }, { value: st.tries, label: '🔁 tentativas' }]
          : [{ value: st.tries, label: '🔁 tentativas' }, { value: pairs, label: '🃏 pares' }, { value: `${Math.round(api.elapsed() / 1000)} s`, label: '⏱ tempo' }],
      });
    }

    return { destroy() { st.ended = true; timers.forEach(clearTimeout); timers.clear(); } };
  }

  let shell = null;
  window.Plataforma.registerGame('memoria', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'memoria',
        title: 'Jogo da Memória',
        icon: '🃏',
        hello: 'Vire as cartas e ache os pares. Quanto menos tentativas, melhor!',
        Levels,
        record: { key: 'best', label: 'tentativas', lower: true },
        rules: (level) => (level.robot
          ? ['🤖 Você e o robô se revezam. Cada um vira duas cartas.', '✅ Achou o par? Joga de novo.', '🏆 Quem fizer mais pares vence.']
          : ['🃏 Toque em duas cartas para virar.', '✅ Iguais (ou que combinam)? Ficam abertas.', '🔁 Cada duas cartas viradas contam uma tentativa: quanto menos, mais estrelas.']),
        play,
      });
      ctx.mascot.mount(container);
      await shell.load();
    },
    unmount() { if (shell) shell.destroy(); shell = null; },
  });
})();
