// public/games/numeros/game.js
// 🔢 Números Cadentes — contas (e dados e dominós) caem do céu e a criança
// digita o resultado antes que cheguem ao chão. Telas: mapa → antes da fase
// → jogando → resultado. O progresso fica no servidor (/api/progress/numeros).
//
// Sem Enter: quando o número digitado é a resposta de uma conta que está
// caindo, ela estoura (a mais perto do chão, se duas tiverem a mesma
// resposta). Se outra resposta na tela começa com o mesmo número (1 e 12),
// o jogo espera um instante pelo próximo algarismo. Número que não leva a
// nenhuma resposta pisca vermelho, apaga e conta um erro. Sem "game over":
// a rodada vai até a última conta.
//
// Teclado numérico na tela (funciona no tablet) e o do computador. O céu
// ocupa todo o espaço que sobra na tela.

(function () {
  const Levels = window.NumerosLevels;
  const Items = window.NumerosItems;
  const P = window.ContaProblems;

  const WAIT_MORE_MS = 800; // espera por mais um algarismo (1 ou 12?)
  const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function randomSeed() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 0xFFFFFFFF); }
  }

  // um dado (ou meio dominó) com os pontinhos numa grade 3 × 3
  function face(n, cls) {
    const el = document.createElement('span');
    el.className = cls;
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('i');
      if (PIPS[n].includes(i)) cell.className = 'is-pip';
      el.appendChild(cell);
    }
    return el;
  }

  function renderPiece(item) {
    const el = document.createElement('div');
    el.className = `nc-piece is-${item.kind}`;
    if (item.kind === 'dice') item.faces.forEach((n) => el.appendChild(face(n, 'nc-die')));
    else if (item.kind === 'domino') {
      el.appendChild(face(item.faces[0], 'nc-half'));
      el.appendChild(face(item.faces[1], 'nc-half'));
    } else el.textContent = item.text;
    return el;
  }

  // recorde da fase: no resultado e antes de começar
  function showRecord(el, score, best) {
    if (score > best && score > 0) {
      el.textContent = best ? `🏆 Novo recorde! (antes: ${best} pontos)` : '🏆 Primeiro recorde desta fase!';
      el.classList.add('is-new');
    } else {
      el.textContent = best ? `Seu recorde nesta fase: ${best} pontos` : '';
      el.classList.remove('is-new');
    }
  }
  function introRecord(el, best) {
    el.hidden = !best;
    el.textContent = best ? `🏆 Seu recorde: ${best} pontos. Consegue bater?` : '';
  }

  function createGame(container, ctx) {
    const { sound, fx, ui } = ctx;
    const $ = (sel) => container.querySelector(sel);
    const screens = [...container.querySelectorAll('[data-nc]')];
    const sky = $('#nc-sky');

    let progress = { levels: {} };
    let screen = 'map';
    let destroyed = false;
    let current = null;
    let round = null; // { level, seed, items, engine, typed, caught, lost, wrong, started }
    let waitTimer = null;

    function show(name) {
      screen = name;
      screens.forEach((el) => { el.hidden = el.dataset.nc !== name; });
      window.scrollTo({ top: 0 });
    }

    // ---------------- mapa ----------------
    const levelData = (id) => (progress.levels && progress.levels[id]) || {};
    function renderMap() {
      const total = Levels.totalStars(progress);
      $('#nc-total-stars').textContent = total;
      $('#nc-max-stars').textContent = Levels.MAX_STARS;
      const next = Levels.nextLevel(progress);
      const first = ctx.student ? ctx.student.firstName : '';
      $('#nc-map-speech').textContent = total === 0
        ? `Oi, ${first}! As contas vão cair do céu: digite o resultado antes que cheguem ao chão! 🔢`
        : next ? `Você já tem ${total} ⭐! A próxima fase está piscando em amarelo 💪` : `Uau, ${first}! Você fez todas as fases! 🏆`;
      const cont = $('#nc-continue');
      cont.textContent = next ? `▶ Continuar: ${next.fullTitle}` : '🏆 Jogar de novo a primeira fase';
      cont.dataset.level = next ? next.id : Levels.LEVELS[0].id;
      window.LevelMap.render($('#nc-worlds'), {
        worlds: Levels.WORLDS,
        storageKey: 'nc_map_filter',
        nextId: next ? next.id : null,
        stateOf: (level) => ({ stars: levelData(level.id).stars || 0, plays: levelData(level.id).plays || 0 }),
        onPick: (level) => { sound.play('pop'); openIntro(level); },
      });
    }

    // ---------------- antes da fase ----------------
    function openIntro(level) {
      current = level;
      const world = Levels.getWorld(level.world);
      $('#nc-intro-world').textContent = `${world.icon} ${world.name} · fase ${level.indexInWorld + 1} de ${world.levels.length}`;
      $('#nc-intro-title').textContent = level.fullTitle;
      $('#nc-intro-world-text').textContent = level.indexInWorld === 0 ? world.intro : '';
      $('#nc-intro-tip').textContent = `💡 ${level.tip}`;
      $('#nc-intro-minus').hidden = !world.minus;
      introRecord($('#nc-intro-record'), levelData(level.id).bestScore);
      const ex = $('#nc-intro-example');
      ex.innerHTML = '';
      const seen = new Set();
      Items.makeItems(level, randomSeed()).forEach((it) => {
        if (seen.size >= 6 || seen.has(it.text)) return;
        seen.add(it.text);
        const piece = renderPiece(it);
        piece.classList.add('is-sample');
        ex.appendChild(piece);
      });
      show('intro');
      setTimeout(() => $('#nc-start').focus(), 60);
    }

    // ---------------- pontos, combo e peças especiais ----------------
    const Kit = window.CadentesKit;
    // o placar grande fica dentro do céu (CadentesKit.createBoard)
    function updateHud() {}
    function onMultiplier() { sound.play('tada'); }
    // acerto: pontos (com combo), confete e o efeito da peça especial
    function scoreCatch(piece, base, { chain = false } = {}) {
      const special = round.specials[piece.index];
      const points = round.scorer.hit(base, { gold: special === 'gold' });
      round.caught++;
      burst(piece.el);
      Kit.floatText(sky, piece.el, `+${points}`, special === 'gold' ? 'is-big' : '');
      round.engine.catchPiece(piece);
      if (chain) return;
      if (special === 'ice') {
        round.engine.freeze(Kit.FREEZE_MS);
        sky.classList.add('is-frozen-sky');
        setTimeout(() => sky.classList.remove('is-frozen-sky'), Kit.FREEZE_MS);
        Kit.floatText(sky, piece.el, '🧊 Congelou!', 'is-big');
        sound.play('whoosh');
      } else if (special === 'bomb') {
        Kit.floatText(sky, piece.el, '💥 BUM!', 'is-big');
        sound.play('fanfare');
        round.engine.pieces().forEach((other) => scoreCatch(other, baseFor(other.item), { chain: true }));
        afterBomb();
      }
    }
    const baseFor = (item) => 10 + 3 * (String(Math.abs(item.answer)).length - 1);
    function afterBomb() { setTyped(''); updateStats(); }

    // ---------------- jogando ----------------
    const minusAllowed = () => Boolean(round && Levels.getWorld(round.level.world).minus);

    function renderPad() {
      const pad = $('#nc-pad');
      pad.innerHTML = '';
      const minus = minusAllowed() ? '−' : '';
      // no celular o teclado vira duas fileiras de 6 embaixo do céu
      const narrow = window.matchMedia('(max-width: 760px)').matches;
      const keys = narrow
        ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', minus, '0', '⌫']
        : ['7', '8', '9', '4', '5', '6', '1', '2', '3', minus, '0', '⌫'];
      keys.forEach((k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nc-key';
        b.textContent = k;
        if (!k) { b.disabled = true; b.classList.add('is-blank'); b.setAttribute('aria-hidden', 'true'); }
        if (k === '⌫') b.setAttribute('aria-label', 'Apagar');
        // pointerdown: responde na hora (sem o atraso do clique no tablet)
        b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); press(k); });
        pad.appendChild(b);
      });
    }

    function start(level) {
      if (round) round.engine.destroy();
      clearTimeout(waitTimer);
      const seed = randomSeed();
      const items = Items.makeItems(level, seed);
      sky.querySelectorAll('.nc-piece').forEach((el) => el.remove());
      round = {
        level, seed, items, typed: '', caught: 0, lost: [], wrong: 0, started: false,
        specials: Kit.pickSpecials(items.length),
        scorer: Kit.createBoard(sky, { best: levelData(level.id).bestScore || 0, onMultiplier }),
        // a rodada acelera: cada conta cai um pouco mais rápido que a anterior
        engine: window.FallingEngine.create(sky, {
          items,
          fallMs: (i) => Levels.paceAt(level, i).fallMs,
          intervalMs: (i) => Levels.paceAt(level, i).intervalMs,
          maxOnScreen: (i) => Levels.paceAt(level, i).maxOnScreen,
          render: (item, index) => {
            const el = renderPiece(item);
            Kit.decorate(el, round.specials[index]);
            return el;
          },
          onLand(piece) {
            round.lost.push(piece.index);
            round.scorer.miss();
            updateHud();
            sound.play('bonk');
            const g = $('#nc-ground');
            g.classList.remove('is-hit');
            void g.offsetWidth;
            g.classList.add('is-hit');
            updateStats();
            // o que estava digitado pode não servir mais para nenhuma conta
            if (round.typed && !candidates().longer.length && !candidates().exact.length) setTyped('');
          },
          onEnd: finish,
        }),
      };
      $('#nc-play-title').textContent = `${Levels.getWorld(level.world).icon} ${level.fullTitle}`;
      $('#nc-pause').hidden = true;
      renderPad();
      setTyped('');
      updateStats();
      updateHud();
      show('play');
      fitSky();
      countdown(() => {
        round.started = true;
        round.engine.start();
      });
    }

    function countdown(done) {
      const box = $('#nc-countdown');
      const n = $('#nc-countdown-n');
      let k = 3;
      box.hidden = false;
      n.textContent = k;
      sound.play('tick');
      const t = setInterval(() => {
        if (destroyed || !round) { clearInterval(t); return; }
        k--;
        if (k === 0) {
          clearInterval(t);
          box.hidden = true;
          sound.play('start');
          done();
          return;
        }
        n.textContent = k;
        sound.play('tick');
      }, 700);
    }

    // O céu vai até o fim da tela; no celular o teclado fica embaixo dele.
    function fitSky() {
      const arena = $('#nc-arena');
      const top = arena.getBoundingClientRect().top;
      const free = Math.max(300, Math.floor(window.innerHeight - top - 14));
      const stacked = getComputedStyle(arena).flexDirection === 'column';
      const side = stacked ? $('.nc-side').offsetHeight + 10 : 0;
      sky.style.height = `${Math.max(220, free - side)}px`;
    }
    function onResize() {
      if (screen !== 'play') return;
      if (round) renderPad();
      fitSky();
    }
    window.addEventListener('resize', onResize);

    function updateStats() {
      if (!round) return;
      const total = round.items.length;
      const left = total - round.caught - round.lost.length;
      $('#nc-stat-caught').textContent = round.caught;
      $('#nc-stat-lost').textContent = round.lost.length;
      $('#nc-stat-left').textContent = left;
      $('#nc-progress-bar').style.width = `${((total - left) / total) * 100}%`;
    }

    function setTyped(v) {
      round.typed = v;
      $('#nc-typed-value').textContent = v.replace('-', '−');
      $('#nc-typed').classList.toggle('is-empty', !v);
    }

    // contas na tela cuja resposta é o número digitado / começa com ele
    function candidates() {
      const pieces = round.engine.pieces(); // a mais perto do chão primeiro
      const t = round.typed;
      return {
        exact: pieces.filter((p) => String(p.item.answer) === t),
        longer: pieces.filter((p) => String(p.item.answer).startsWith(t) && String(p.item.answer) !== t),
      };
    }

    function press(k) {
      if (!round || !round.started) return;
      if (!$('#nc-pause').hidden) { resume(); return; }
      if (!round.engine.isRunning()) return;
      clearTimeout(waitTimer);
      if (k === '⌫') { setTyped(round.typed.slice(0, -1)); sound.play('click'); return; }
      if (k === '−' || k === '-') {
        if (!minusAllowed()) return;
        setTyped(round.typed.startsWith('-') ? round.typed.slice(1) : `-${round.typed}`);
        sound.play('click');
        return;
      }
      if (k === 'Enter') { evaluate(true); return; }
      if (!/^\d$/.test(k) || round.typed.replace('-', '').length >= 6) return;
      setTyped(round.typed + k);
      sound.play('click');
      evaluate(false);
    }

    function evaluate(force) {
      if (!round.typed || round.typed === '-') return;
      const { exact, longer } = candidates();
      if (exact.length && (!longer.length || force)) { pop(exact[0]); return; }
      if (exact.length) {
        // pode ser 1 ou 12: espera um pouquinho pelo próximo algarismo
        waitTimer = setTimeout(() => {
          if (!round) return;
          const again = candidates().exact;
          if (again.length) pop(again[0]);
        }, WAIT_MORE_MS);
        return;
      }
      if (longer.length && !force) return; // ainda pode virar uma resposta
      miss();
    }

    function pop(piece) {
      setTyped('');
      sound.play('ding');
      scoreCatch(piece, baseFor(piece.item));
      updateStats();
      updateHud();
    }

    // estourinho de confetes onde a peça estava
    function burst(el) {
      const r = el.getBoundingClientRect();
      fx.confetti({ amount: 26, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, power: 0.55 });
    }

    function miss() {
      round.wrong++;
      round.scorer.miss();
      updateHud();
      sound.play('bonk');
      const box = $('#nc-typed');
      box.classList.remove('is-wrong');
      void box.offsetWidth;
      box.classList.add('is-wrong');
      setTimeout(() => { if (round) setTyped(''); }, 250);
      setTimeout(() => box.classList.remove('is-wrong'), 450);
    }

    // ---------------- teclado do computador ----------------
    function onKeydown(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (screen === 'intro' && ev.key === 'Enter' && document.activeElement?.id !== 'nc-start') {
        ev.preventDefault();
        $('#nc-start').click();
        return;
      }
      if (screen !== 'play' || !round) return;
      if (!$('#nc-pause').hidden) { ev.preventDefault(); resume(); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); pause(); return; }
      if (/^\d$/.test(ev.key)) { ev.preventDefault(); press(ev.key); }
      else if (ev.key === '-') { ev.preventDefault(); press('-'); }
      else if (ev.key === 'Backspace') { ev.preventDefault(); press('⌫'); }
      else if (ev.key === 'Enter') { ev.preventDefault(); press('Enter'); }
    }
    document.addEventListener('keydown', onKeydown);

    // ---------------- pausa ----------------
    function pause() {
      if (!round || !round.started || round.engine.isEnded() || !round.engine.isRunning()) return;
      round.engine.pause();
      clearTimeout(waitTimer);
      $('#nc-pause').hidden = false;
    }
    function resume() {
      if (!round || round.engine.isEnded()) return;
      $('#nc-pause').hidden = true;
      round.engine.resume();
    }
    $('#nc-pause').addEventListener('click', resume);
    $('#nc-pause-btn').addEventListener('click', () => (round && !round.engine.isRunning() ? resume() : pause()));
    function onVisibility() { if (document.hidden) pause(); }
    function onBlur() { if (screen === 'play') pause(); }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);

    async function quit() {
      if (round && round.started && !round.engine.isEnded()) {
        pause();
        const ok = await ui.confirmModal('Sair da fase?', 'O que você resolveu nesta rodada não vai contar.', 'Sair');
        if (!ok) { resume(); return; }
      }
      if (round) round.engine.destroy();
      round = null;
      show('map');
      renderMap();
    }
    $('#nc-quit').addEventListener('click', quit);

    // ---------------- resultado ----------------
    async function finish() {
      const r = round;
      clearTimeout(waitTimer);
      const typed = r.items.filter((_, i) => !r.lost.includes(i)).reduce((n, it) => n + String(it.answer).length, 0);
      const accuracy = typed + r.wrong ? Math.round((typed / (typed + r.wrong)) * 1000) / 10 : 0;
      const durationMs = Math.round(r.engine.elapsed());
      const stars = Levels.starsFor(r.level.id, { caught: r.caught, count: r.items.length, accuracy });
      const best = levelData(r.level.id).bestScore || 0;
      showResult({ stars, accuracy, durationMs, best });
      try {
        const res = await ctx.api.post('/progress/numeros/results', {
          levelId: r.level.id, seed: r.seed, lost: r.lost, wrong: r.wrong, durationMs, score: r.scorer.score,
        });
        progress = res.progress;
      } catch (e) {
        // sem internet: o resultado fica guardado e vai sozinho quando ela voltar
        if (e.queued) ui.toast(e.message, 'info', 6000);
        else ui.toast('Não consegui salvar o seu resultado 😵 Confira a internet.', 'error', 5000);
      }
    }

    function showResult({ stars, accuracy, durationMs, best }) {
      const r = round;
      show('result');
      showRecord($('#nc-record'), r.scorer.score, best);
      $('#nc-res-score').textContent = r.scorer.score;
      const starEls = [...container.querySelectorAll('.nc-star')];
      starEls.forEach((el) => el.classList.remove('is-on'));
      starEls.forEach((el, i) => {
        if (i < stars) setTimeout(() => { el.classList.add('is-on'); sound.play('ding'); }, 350 + i * 380);
      });
      const titles = ['Quase lá!', 'Muito bem!', 'Excelente!', 'Perfeito!'];
      $('#nc-result-title').textContent = titles[stars];
      const ratio = r.caught / r.items.length;
      let msg;
      if (stars === 0) msg = 'Para ganhar estrela, resolva mais da metade das contas. Comece sempre pela mais perto do chão 🙂';
      else if (stars < 3 && ratio >= 0.95) msg = 'Para a 3ª estrela, tente errar menos números.';
      else if (stars < 3) msg = 'Repita para conquistar mais estrelas! ⭐';
      else msg = 'Você resolveu quase tudo! 🎉';
      $('#nc-result-msg').textContent = msg;
      $('#nc-res-caught').textContent = `${r.caught}/${r.items.length}`;
      $('#nc-res-acc').textContent = `${Math.round(accuracy)}%`;
      $('#nc-res-time').textContent = formatTime(durationMs);
      const lost = [];
      r.lost.forEach((i) => { if (!lost.some((x) => x.text === r.items[i].text)) lost.push(r.items[i]); });
      $('#nc-lost').hidden = lost.length === 0;
      $('#nc-lost-list').innerHTML = '';
      lost.forEach((it) => {
        const li = document.createElement('li');
        li.textContent = it.kind === 'calc' ? `${it.text} = ${P.fmt(it.answer)}` : `${it.kind === 'domino' ? 'dominó' : 'dados'} ${it.text.replace('|', ' e ')} = ${it.answer}`;
        $('#nc-lost-list').appendChild(li);
      });
      const next = Levels.LEVELS[r.level.index + 1];
      $('#nc-next').hidden = !next;
      if (stars >= 1) { fx.confetti({ amount: 40 + stars * 50 }); sound.play(stars === 3 ? 'fanfare' : 'tada'); }
      setTimeout(() => $(stars >= 1 && next ? '#nc-next' : '#nc-retry').focus(), 80);
    }

    $('#nc-retry').addEventListener('click', () => start(round.level));
    $('#nc-next').addEventListener('click', () => {
      const next = Levels.LEVELS[round.level.index + 1];
      if (next) openIntro(next);
    });
    $('#nc-start').addEventListener('click', () => start(current));
    $('#nc-continue').addEventListener('click', () => {
      sound.play('pop');
      openIntro(Levels.getLevel($('#nc-continue').dataset.level));
    });
    container.querySelectorAll('[data-nc-go="map"]').forEach((btn) => btn.addEventListener('click', () => {
      if (round) round.engine.destroy();
      round = null;
      show('map');
      renderMap();
    }));

    async function load() {
      try {
        const res = await ctx.api.get('/progress/numeros');
        progress = res.progress || { levels: {} };
      } catch (e) {
        ui.toast('Não consegui carregar o seu progresso 😵', 'error');
      }
      if (destroyed) return;
      show('map');
      renderMap();
    }

    function destroy() {
      destroyed = true;
      clearTimeout(waitTimer);
      if (round) round.engine.destroy();
      round = null;
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
    }

    return { load, destroy };
  }

  let game = null;
  window.Plataforma.registerGame('numeros', {
    async mount(container, ctx) {
      // o céu usa toda a largura da tela
      container.classList.add('is-wide');
      ctx.mascot.mount(container);
      game = createGame(container, ctx);
      await game.load();
    },
    unmount() {
      if (game) game.destroy();
      game = null;
      document.getElementById('game-root').classList.remove('is-wide');
    },
  });
})();
