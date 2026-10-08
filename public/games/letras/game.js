// public/games/letras/game.js
// 🔤 Letras Cadentes — letras, sílabas e palavras caem do céu e a criança
// digita cada uma antes que chegue ao chão. Telas: mapa → antes da fase →
// jogando → resultado. O progresso fica no servidor (/api/progress/letras).
//
// Alvo travado: a primeira letra escolhe a peça mais perto do chão que
// começa com ela; as letras seguintes completam aquela peça (Esc solta).
// Letra errada conta um erro, mas não perde a peça. Sem "game over": a
// rodada vai até a última peça, e as estrelas dependem de quantas pegou.
//
// As teclas chegam por um <textarea> escondido (evento `input`), como no
// Teclado Mágico: é o jeito de receber "á", "ã" e "ç" montados pelo sistema.

(function () {
  const Levels = window.LetrasLevels;
  const Items = window.LetrasItems;
  const layout = window.DigitacaoLayouts.abnt2;
  const { createKeyboard } = window.DigitacaoKeyboard;
  const { fingerName } = window.DigitacaoHands;
  const Hint = window.DigitacaoHint;

  const KB_KEY = 'lc_show_kb';

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function randomSeed() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 0xFFFFFFFF); }
  }

  function createGame(container, ctx) {
    const { sound, fx, ui } = ctx;
    const $ = (sel) => container.querySelector(sel);
    const screens = [...container.querySelectorAll('[data-lc]')];
    const keyboard = createKeyboard($('#lc-kb'), layout);
    const input = $('#lc-input');
    const sky = $('#lc-sky');

    let progress = { levels: {} };
    let screen = 'map';
    let destroyed = false;
    let showKb = true;
    try { showKb = localStorage.getItem(KB_KEY) !== '0'; } catch (e) { /* ignore */ }
    $('#lc-show-kb').checked = showKb;

    let current = null; // fase escolhida
    let round = null; // { level, seed, items, engine, target, caught, lost, wrong, errors, startedAt }
    let deadArmed = false;
    let capsOn = false;

    function show(name) {
      screen = name;
      screens.forEach((el) => { el.hidden = el.dataset.lc !== name; });
      window.scrollTo({ top: 0 });
    }

    // ---------------- mapa ----------------
    const levelData = (id) => (progress.levels && progress.levels[id]) || {};
    function renderMap() {
      const total = Levels.totalStars(progress);
      $('#lc-total-stars').textContent = total;
      $('#lc-max-stars').textContent = Levels.MAX_STARS;
      const next = Levels.nextLevel(progress);
      const first = ctx.student ? ctx.student.firstName : '';
      $('#lc-map-speech').textContent = total === 0
        ? `Oi, ${first}! As letras vão cair do céu: digite cada uma antes que chegue ao chão! ☁️`
        : next ? `Você já tem ${total} ⭐! A próxima fase está piscando em amarelo 💪` : `Uau, ${first}! Você fez todas as fases! 🏆`;
      const cont = $('#lc-continue');
      cont.textContent = next ? `▶ Continuar: ${next.fullTitle}` : '🏆 Jogar de novo a primeira fase';
      cont.dataset.level = next ? next.id : Levels.LEVELS[0].id;
      window.LevelMap.render($('#lc-worlds'), {
        worlds: Levels.WORLDS,
        storageKey: 'lc_map_filter',
        nextId: next ? next.id : null,
        stateOf: (level) => ({ stars: levelData(level.id).stars || 0, plays: levelData(level.id).plays || 0 }),
        onPick: (level) => { sound.play('pop'); openIntro(level); },
      });
    }

    // ---------------- antes da fase ----------------
    function openIntro(level) {
      current = level;
      const world = Levels.getWorld(level.world);
      $('#lc-intro-world').textContent = `${world.icon} ${world.name} · fase ${level.indexInWorld + 1} de ${world.levels.length}`;
      $('#lc-intro-title').textContent = level.fullTitle;
      $('#lc-intro-world-text').textContent = level.indexInWorld === 0 ? world.intro : '';
      $('#lc-intro-tip').textContent = `💡 ${level.tip}`;
      const ex = $('#lc-intro-example');
      ex.innerHTML = '';
      [...new Set(Items.makeItems(level, randomSeed()))].slice(0, 8).forEach((it) => {
        ex.appendChild(Object.assign(document.createElement('span'), { className: 'lc-chip', textContent: it }));
      });
      $('#lc-intro-case').textContent = level.caseSensitive
        ? '🔠 Atenção: maiúscula e minúscula contam! Use o Shift (ou o Caps Lock).'
        : '🔡 Maiúscula ou minúscula, tanto faz.';
      show('intro');
      setTimeout(() => $('#lc-start').focus(), 60);
    }

    // ---------------- jogando ----------------
    const norm = (s) => String(s).normalize('NFC');
    const same = (a, b) => (round.level.caseSensitive ? a === b : a.toLocaleLowerCase('pt-BR') === b.toLocaleLowerCase('pt-BR'));

    function renderPiece(text) {
      const el = document.createElement('div');
      el.className = 'lc-piece';
      el.classList.toggle('is-long', [...text].length > 1);
      const done = document.createElement('span');
      done.className = 'lc-done';
      const rest = document.createElement('span');
      rest.className = 'lc-rest';
      rest.textContent = text.replace(/ /g, '␣');
      el.append(done, rest);
      return el;
    }

    function paintPiece(piece) {
      const chars = [...piece.item];
      const pos = piece.pos || 0;
      // espaço vira um tracinho visível (como o ␣ do Teclado Mágico)
      const show = (list) => list.join('').replace(/ /g, '␣');
      piece.el.querySelector('.lc-done').textContent = show(chars.slice(0, pos));
      piece.el.querySelector('.lc-rest').textContent = show(chars.slice(pos));
      piece.el.classList.toggle('is-target', round.target === piece);
    }

    function start(level) {
      if (round) round.engine.destroy();
      const seed = randomSeed();
      const items = Items.makeItems(level, seed);
      sky.querySelectorAll('.lc-piece').forEach((el) => el.remove());
      round = {
        level, seed, items, target: null, caught: 0, lost: [], wrong: 0, errors: {}, started: false,
        engine: window.FallingEngine.create(sky, {
          items,
          fallMs: level.fallMs,
          intervalMs: level.intervalMs,
          maxOnScreen: level.maxOnScreen,
          render: renderPiece,
          onSpawn: () => updateHint(),
          onLand(piece) {
            if (round.target === piece) round.target = null;
            round.lost.push(piece.index);
            sound.play('bonk');
            const g = $('#lc-ground');
            g.classList.remove('is-hit');
            void g.offsetWidth;
            g.classList.add('is-hit');
            updateStats();
            updateHint();
          },
          onEnd: finish,
        }),
      };
      $('#lc-play-title').textContent = `${Levels.getWorld(level.world).icon} ${level.fullTitle}`;
      $('#lc-help').hidden = !showKb;
      $('#lc-pause').hidden = true;
      updateStats();
      updateHint();
      show('play');
      focusInput();
      countdown(() => {
        round.started = true;
        round.engine.start();
        updateHint();
      });
    }

    function countdown(done) {
      const box = $('#lc-countdown');
      const n = $('#lc-countdown-n');
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

    function updateStats() {
      if (!round) return;
      const total = round.items.length;
      const left = total - round.caught - round.lost.length;
      $('#lc-stat-caught').textContent = round.caught;
      $('#lc-stat-lost').textContent = round.lost.length;
      $('#lc-stat-left').textContent = left;
      $('#lc-progress-bar').style.width = `${((total - left) / total) * 100}%`;
    }

    // próxima letra: a da peça travada, ou a primeira da peça mais perto do chão
    function nextChar() {
      if (!round || !round.started) return null;
      if (round.target) return [...round.target.item][round.target.pos];
      const lowest = round.engine.pieces()[0];
      return lowest ? [...lowest.item][0] : null;
    }

    function updateHint() {
      if (!showKb || !round) return;
      const ch = nextChar();
      const info = ch ? Hint.describe(layout, ch, { deadArmed, capsOn, fingerName }) : null;
      keyboard.highlight(info ? info.stroke : null);
      $('#lc-hint').textContent = info ? info.text : '';
    }

    function handleChar(raw) {
      if (!round || !round.started || !round.engine.isRunning()) return;
      const ch = norm(raw);
      if (ch === '\n' || ch === '\r') return;
      let target = round.target;
      if (!target) {
        target = round.engine.pieces().find((p) => same([...p.item][0], ch)) || null;
        if (!target) { miss(nextChar() || ch); return; }
        target.pos = 0;
        round.target = target;
      }
      const expected = [...target.item][target.pos];
      if (!same(expected, ch)) {
        miss(expected);
        target.el.classList.remove('is-wrong');
        void target.el.offsetWidth;
        target.el.classList.add('is-wrong');
        return;
      }
      target.pos++;
      sound.play('click');
      if (target.pos >= [...target.item].length) {
        round.target = null;
        round.caught++;
        round.engine.catchPiece(target);
        sound.play('ding');
        fx.sparkleAt && fx.sparkleAt(target.el, 6);
        updateStats();
      } else {
        paintPiece(target);
      }
      round.engine.pieces().forEach(paintPiece);
      updateHint();
    }

    function miss(expected) {
      round.wrong++;
      if (expected) round.errors[expected] = (round.errors[expected] || 0) + 1;
      sound.play('bonk');
    }

    function releaseTarget() {
      if (!round || !round.target) return;
      round.target.pos = 0;
      paintPiece(round.target);
      round.target = null;
      round.engine.pieces().forEach(paintPiece);
      updateHint();
    }

    // ---------------- teclas ----------------
    input.addEventListener('input', (ev) => {
      if (ev.isComposing) return;
      const value = input.value;
      input.value = '';
      deadArmed = false;
      $('#lc-dead').hidden = true;
      [...value].forEach(handleChar);
    });
    input.addEventListener('compositionend', () => {
      const value = input.value;
      input.value = '';
      deadArmed = false;
      $('#lc-dead').hidden = true;
      [...value].forEach(handleChar);
    });
    input.addEventListener('keydown', (ev) => {
      if (screen !== 'play' || !round) return;
      if (!$('#lc-pause').hidden) { ev.preventDefault(); resume(); return; }
      if (ev.key === 'Tab' || ev.key === 'Enter') { ev.preventDefault(); return; }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (round.target) releaseTarget(); else pause();
        return;
      }
      if (ev.key === 'Backspace') { ev.preventDefault(); releaseTarget(); return; }
      updateCaps(ev);
      keyboard.press(ev.code, true);
      if (ev.key === 'Dead') {
        deadArmed = true;
        $('#lc-dead').hidden = false;
        updateHint();
      }
    });
    input.addEventListener('keyup', (ev) => { keyboard.press(ev.code, false); updateCaps(ev); });
    function updateCaps(ev) {
      const on = Boolean(ev.getModifierState && ev.getModifierState('CapsLock'));
      $('#lc-caps').hidden = !on || Boolean(round && round.level.caseSensitive);
      if (on !== capsOn) { capsOn = on; updateHint(); }
    }

    function focusInput() { input.focus({ preventScroll: true }); }

    // ---------------- pausa ----------------
    function pause() {
      if (!round || !round.started || round.engine.isEnded() || !round.engine.isRunning()) return;
      round.engine.pause();
      keyboard.releaseAll();
      $('#lc-pause').hidden = false;
    }
    function resume() {
      if (!round || round.engine.isEnded()) return;
      $('#lc-pause').hidden = true;
      focusInput();
      round.engine.resume();
    }
    $('#lc-pause').addEventListener('click', resume);
    $('#lc-pause-btn').addEventListener('click', () => (round && !round.engine.isRunning() ? resume() : pause()));
    // sem foco as teclas não chegam: pausa até a criança voltar
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!destroyed && screen === 'play' && document.activeElement !== input) pause();
      }, 50);
    });
    function onVisibility() { if (document.hidden) pause(); }
    document.addEventListener('visibilitychange', onVisibility);
    sky.addEventListener('mousedown', (ev) => {
      if (screen === 'play' && ev.target === sky) { ev.preventDefault(); focusInput(); }
    });

    async function quit() {
      if (round && round.started && !round.engine.isEnded()) {
        pause();
        const ok = await ui.confirmModal('Sair da fase?', 'O que você pegou nesta rodada não vai contar.', 'Sair');
        if (!ok) { resume(); return; }
      }
      if (round) round.engine.destroy();
      round = null;
      show('map');
      renderMap();
    }
    $('#lc-quit').addEventListener('click', quit);

    // ---------------- resultado ----------------
    async function finish() {
      const r = round;
      keyboard.highlight(null);
      input.blur();
      const typed = r.items.filter((_, i) => !r.lost.includes(i)).reduce((n, it) => n + [...it].length, 0);
      const accuracy = typed + r.wrong ? Math.round((typed / (typed + r.wrong)) * 1000) / 10 : 0;
      const durationMs = Math.round(r.engine.elapsed());
      const stars = Levels.starsFor(r.level.id, { caught: r.caught, count: r.items.length, accuracy });
      showResult({ stars, accuracy, durationMs });
      try {
        const res = await ctx.api.post('/progress/letras/results', {
          levelId: r.level.id, seed: r.seed, lost: r.lost, wrong: r.wrong, durationMs, errorsByChar: r.errors,
        });
        progress = res.progress;
      } catch (e) {
        ui.toast('Não consegui salvar o seu resultado 😵 Confira a internet.', 'error', 5000);
      }
    }

    function showResult({ stars, accuracy, durationMs }) {
      const r = round;
      show('result');
      const starEls = [...container.querySelectorAll('.lc-star')];
      starEls.forEach((el) => el.classList.remove('is-on'));
      starEls.forEach((el, i) => {
        if (i < stars) setTimeout(() => { el.classList.add('is-on'); sound.play('ding'); }, 350 + i * 380);
      });
      const titles = ['Quase lá!', 'Muito bem!', 'Excelente!', 'Perfeito!'];
      $('#lc-result-title').textContent = titles[stars];
      const ratio = r.caught / r.items.length;
      let msg;
      if (stars === 0) msg = 'Para ganhar estrela, pegue mais da metade das peças. Comece sempre pela mais perto do chão 🙂';
      else if (stars < 3 && ratio >= 0.95) msg = 'Para a 3ª estrela, tente errar menos teclas.';
      else if (stars < 3) msg = 'Repita para conquistar mais estrelas! ⭐';
      else msg = 'Você pegou quase tudo! 🎉';
      $('#lc-result-msg').textContent = msg;
      $('#lc-res-caught').textContent = `${r.caught}/${r.items.length}`;
      $('#lc-res-acc').textContent = `${Math.round(accuracy)}%`;
      $('#lc-res-time').textContent = formatTime(durationMs);
      const lost = [...new Set(r.lost.map((i) => r.items[i]))];
      $('#lc-lost').hidden = lost.length === 0;
      $('#lc-lost-list').innerHTML = '';
      lost.forEach((it) => $('#lc-lost-list').appendChild(Object.assign(document.createElement('span'), { className: 'lc-chip', textContent: it })));
      const next = Levels.LEVELS[r.level.index + 1];
      $('#lc-next').hidden = !next;
      if (stars >= 1) { fx.confetti({ amount: 40 + stars * 50 }); sound.play(stars === 3 ? 'fanfare' : 'tada'); }
      setTimeout(() => $(stars >= 1 && next ? '#lc-next' : '#lc-retry').focus(), 80);
    }

    $('#lc-retry').addEventListener('click', () => start(round.level));
    $('#lc-next').addEventListener('click', () => {
      const next = Levels.LEVELS[round.level.index + 1];
      if (next) openIntro(next);
    });
    $('#lc-start').addEventListener('click', () => start(current));
    $('#lc-continue').addEventListener('click', () => {
      sound.play('pop');
      openIntro(Levels.getLevel($('#lc-continue').dataset.level));
    });
    container.querySelectorAll('[data-lc-go="map"]').forEach((btn) => btn.addEventListener('click', () => {
      if (round) round.engine.destroy();
      round = null;
      show('map');
      renderMap();
    }));
    $('#lc-show-kb').addEventListener('change', (ev) => {
      showKb = ev.target.checked;
      try { localStorage.setItem(KB_KEY, showKb ? '1' : '0'); } catch (e) { /* ignore */ }
      sound.play('pop');
    });

    function onDocKeydown(ev) {
      if (screen === 'intro' && ev.key === 'Enter' && document.activeElement?.id !== 'lc-start') {
        ev.preventDefault();
        $('#lc-start').click();
      }
    }
    document.addEventListener('keydown', onDocKeydown);

    async function load() {
      $('#lc-touch-notice').hidden = !window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      try {
        const res = await ctx.api.get('/progress/letras');
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
      if (round) round.engine.destroy();
      round = null;
      document.removeEventListener('keydown', onDocKeydown);
      document.removeEventListener('visibilitychange', onVisibility);
    }

    return { load, destroy };
  }

  let game = null;
  window.Plataforma.registerGame('letras', {
    async mount(container, ctx) {
      ctx.mascot.mount(container);
      game = createGame(container, ctx);
      await game.load();
    },
    unmount() {
      if (game) game.destroy();
      game = null;
    },
  });
})();
