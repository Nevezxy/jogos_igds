// public/games/digitacao/game.js
// ⌨️ Teclado Mágico — jogo de digitação da plataforma Jogos IGDS.
// Telas internas: mapa dos mundos → antes da fase → jogando → resultado
// (e o treino livre). O progresso (estrelas por fase, melhor PPM, teclas
// com mais erro) fica no servidor: /api/progress/digitacao.
//
// Captura das teclas: um <textarea> invisível, sempre com foco, recebe o que
// é digitado. O caractere final vem do evento `input` (é o único jeito de
// receber "á", "ã" e "ç" montados pelo sistema a partir das teclas de
// acento); o `keydown` só anima a tecla física e percebe o acento "armado".

(function () {
  const Levels = window.DigitacaoLevels;
  const Content = window.DigitacaoContent;
  const { TypingRun } = window.DigitacaoEngine;
  const layout = window.DigitacaoLayouts.abnt2;
  const { createKeyboard } = window.DigitacaoKeyboard;
  const { createHands, fingerName } = window.DigitacaoHands;

  const STOP_KEY = 'tm_stop_on_error';
  const UPPER_KEY = 'tm_uppercase';

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function createGame(container, ctx) {
    const { sound, fx, ui } = ctx;
    const comp = window.Competicao.of(ctx); // 🏃 disputa da maratona (js/shared/competition.js)
    const $ = (sel) => container.querySelector(sel);
    const screens = [...container.querySelectorAll('[data-tm]')];
    const keyboard = createKeyboard($('#tm-kb'), layout);
    const hands = createHands($('#tm-hands'));
    const input = $('#tm-input');
    const textBox = $('#tm-text');

    let progress = { levels: {} };
    let screen = 'map';
    let current = null; // { level, practice, text }
    let run = null;
    let spans = [];
    let deadArmed = false;
    let lastCode = null;
    let timer = null;
    let destroyed = false;
    let stopOnError = true;
    try { stopOnError = localStorage.getItem(STOP_KEY) !== '0'; } catch (e) { /* ignore */ }
    $('#tm-stop-on-error').checked = stopOnError;
    // "Apenas maiúsculas": todo exercício (fases e treino livre) vem em MAIÚSCULA
    let uppercase = false;
    try { uppercase = localStorage.getItem(UPPER_KEY) === '1'; } catch (e) { /* ignore */ }
    // na disputa, todos com as mesmas regras: para no erro e texto como veio
    if (comp) { stopOnError = true; uppercase = false; }
    $('#tm-uppercase').checked = uppercase;
    let capsOn = false; // estado do Caps Lock, lido a cada tecla

    function show(name) {
      screen = name;
      screens.forEach((el) => { el.hidden = el.dataset.tm !== name; });
      if (name !== 'play') { clearInterval(timer); keyboard.releaseAll(); }
      window.scrollTo({ top: 0 });
    }

    // ---------------- mapa ----------------

    function levelStars(id) {
      return (progress.levels && progress.levels[id] && progress.levels[id].stars) || 0;
    }

    function renderMap() {
      const total = Levels.totalStars(progress);
      $('#tm-total-stars').textContent = total;
      $('#tm-max-stars').textContent = Levels.MAX_STARS;
      const next = Levels.nextLevel(progress);
      const first = ctx.student ? ctx.student.firstName : '';
      $('#tm-map-speech').textContent = total === 0
        ? `Oi, ${first}! Vamos aprender a digitar com os 10 dedos? Comece pelo Mundo 1! 🚀`
        : next ? `Você já tem ${total} ⭐! Continue de onde parou 💪` : `Uau, ${first}! Você completou todos os mundos! 🏆`;
      const cont = $('#tm-continue');
      cont.textContent = next ? `▶ Continuar: ${next.title}` : '🏆 Jogar de novo a primeira fase';
      cont.dataset.level = next ? next.id : Levels.LEVELS[0].id;

      // mapa compartilhado: feitas, tentadas, pendentes e a próxima bem diferentes
      window.LevelMap.render($('#tm-worlds'), {
        worlds: Levels.WORLDS,
        storageKey: 'tm_map_filter',
        nextId: next ? next.id : null,
        stateOf: (level) => ({
          stars: levelStars(level.id),
          plays: (progress.levels && progress.levels[level.id] && progress.levels[level.id].plays) || 0,
          locked: !Levels.isUnlocked(progress, level.id),
        }),
        onPick: (level) => { sound.play('pop'); openIntro(level); },
      });
    }

    function renderPractice() {
      const grid = $('#tm-practice-grid');
      grid.innerHTML = '';
      Content.PRACTICE.forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tm-practice-btn';
        btn.innerHTML = `<span aria-hidden="true">${p.icon}</span>`;
        btn.append(p.name);
        btn.addEventListener('click', () => {
          sound.play('pop');
          start({ practice: p, title: `Treino livre · ${p.name}`, text: p.make() });
        });
        grid.appendChild(btn);
      });
    }

    // ---------------- antes da fase ----------------

    function openIntro(level) {
      const world = Levels.getWorld(level.world);
      current = { level, title: level.title };
      $('#tm-intro-world').textContent = `${world.icon} Mundo ${level.worldIndex + 1} · ${world.name} · Fase ${level.indexInWorld + 1}`;
      $('#tm-intro-title').textContent = level.title;
      // a explicação do mundo aparece na primeira fase de cada mundo
      const worldText = $('#tm-intro-world-text');
      worldText.textContent = level.indexInWorld === 0 ? world.intro : '';
      worldText.hidden = level.indexInWorld !== 0;
      $('#tm-intro-tip').textContent = `💡 ${level.tip}`;
      $('#tm-intro-mode').hidden = !uppercase;
      // recorde de velocidade da fase (só conta com a fase bem feita)
      const best = (progress.levels && progress.levels[level.id] && progress.levels[level.id].bestWpm) || 0;
      $('#tm-intro-record').hidden = !best;
      $('#tm-intro-record').textContent = best ? `🏆 Seu recorde nesta fase: ${Math.round(best)} PPM. Consegue bater?` : '';
      show('intro');
      setTimeout(() => $('#tm-start').focus(), 60);
    }

    // ---------------- jogando ----------------

    function renderText(text) {
      textBox.innerHTML = '';
      spans = [];
      let word = null;
      [...text.normalize('NFC')].forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'tm-ch';
        if (ch === ' ') {
          word = null;
          span.classList.add('tm-space');
          // espaço desenhado pelo CSS (␣), para não parecer um ponto final
          span.textContent = '\u00a0';
          textBox.appendChild(span);
          textBox.appendChild(document.createElement('wbr'));
        } else {
          if (!word) {
            word = document.createElement('span');
            word.className = 'tm-word';
            textBox.appendChild(word);
          }
          span.textContent = ch;
          word.appendChild(span);
        }
        spans.push(span);
      });
    }

    function markCurrent() {
      spans.forEach((s) => s.classList.remove('is-current'));
      const span = spans[run.pos];
      if (!span) return;
      span.classList.add('is-current');
      // mantém a linha atual à vista (a caixa mostra umas três linhas)
      const lineHeight = span.offsetHeight || 40;
      textBox.scrollTop = Math.max(0, span.offsetTop - lineHeight * 0.6);
    }

    // Dica da próxima tecla: destaca tecla, Shift e dedo, e explica em texto
    // (a regra está em hint.js, usada também pelo Desafio de digitação).
    function updateHint() {
      const hint = $('#tm-hint');
      const info = window.DigitacaoHint.describe(layout, run.expected, { deadArmed, capsOn, fingerName });
      if (!info) { keyboard.highlight(null); hands.highlight([]); hint.textContent = ''; return; }
      keyboard.highlight(info.stroke);
      hands.highlight(info.fingers);
      hint.textContent = info.text;
    }

    function updateStats() {
      if (!run) return;
      $('#tm-stat-time').textContent = formatTime(run.elapsedMs());
      $('#tm-stat-acc').textContent = `${Math.round(run.accuracy())}%`;
      $('#tm-stat-wpm').textContent = Math.round(run.wpm());
      $('#tm-progress-bar').style.width = `${(run.pos / run.chars.length) * 100}%`;
    }

    function start({ level = null, practice = null, title, text: rawText }) {
      const text = uppercase ? rawText.toLocaleUpperCase('pt-BR') : rawText;
      current = { level, practice, title, text };
      $('#tm-upper-chip').hidden = !uppercase;
      run = new TypingRun(text, { stopOnError });
      deadArmed = false;
      $('#tm-play-title').textContent = title;
      $('#tm-dead').hidden = true;
      renderText(text);
      show('play');
      markCurrent();
      updateHint();
      updateStats();
      clearInterval(timer);
      timer = setInterval(updateStats, 250);
      focusInput();
    }

    function focusInput() {
      $('#tm-focus-cover').hidden = true;
      input.value = '';
      input.focus({ preventScroll: true });
    }

    function handleChars(str) {
      if (!run || run.done || screen !== 'play') return;
      for (const ch of str.normalize('NFC')) {
        if (ch === '\n' || ch === '\r' || ch === '\t') continue;
        const index = run.pos;
        const res = run.type(ch);
        const span = spans[index];
        if (res.ok) {
          span.classList.add('is-done');
          if (run.missed.has(index)) span.classList.add('is-missed');
          if (lastCode) keyboard.flash(lastCode, true);
          sound.play('click');
        } else {
          span.classList.remove('is-wrong');
          void span.offsetWidth;
          span.classList.add('is-wrong');
          if (!stopOnError) span.classList.add('is-done', 'is-missed');
          if (lastCode) keyboard.flash(lastCode, false);
          sound.play('bonk');
        }
        if (res.done) { finish(); return; }
      }
      markCurrent();
      updateHint();
      updateStats();
    }

    input.addEventListener('input', (ev) => {
      if (ev.isComposing) return; // acento no meio de uma composição (Mac)
      const value = input.value;
      input.value = '';
      deadArmed = false;
      $('#tm-dead').hidden = true;
      handleChars(value);
    });
    input.addEventListener('compositionend', () => {
      const value = input.value;
      input.value = '';
      deadArmed = false;
      $('#tm-dead').hidden = true;
      handleChars(value);
    });

    input.addEventListener('keydown', (ev) => {
      if (screen !== 'play') return;
      if (ev.key === 'Tab') { ev.preventDefault(); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); quit(); return; }
      updateCaps(ev);
      keyboard.press(ev.code, true);
      if (!['ShiftLeft', 'ShiftRight', 'CapsLock'].includes(ev.code)) lastCode = ev.code;
      if (ev.key === 'Dead') {
        deadArmed = true;
        $('#tm-dead').hidden = false;
        updateHint();
      }
    });
    input.addEventListener('keyup', (ev) => {
      keyboard.press(ev.code, false);
      updateCaps(ev);
    });
    // Caps Lock: no modo normal avisa para desligar; no modo "apenas
    // maiúsculas" ele é uma ajuda (a dica passa a dispensar o Shift).
    function updateCaps(ev) {
      const on = Boolean(ev.getModifierState && ev.getModifierState('CapsLock'));
      $('#tm-caps').hidden = !on || uppercase;
      if (on !== capsOn) {
        capsOn = on;
        if (run && !run.done) updateHint();
      }
    }

    input.addEventListener('blur', () => {
      keyboard.releaseAll();
      // sem foco, as teclas não chegam: pede um clique para continuar
      setTimeout(() => {
        if (!destroyed && screen === 'play' && run && !run.done && document.activeElement !== input) {
          $('#tm-focus-cover').hidden = false;
        }
      }, 50);
    });
    $('#tm-focus-cover').addEventListener('click', focusInput);
    $('#tm-stage').addEventListener('mousedown', (ev) => {
      if (screen === 'play' && ev.target !== input) { ev.preventDefault(); focusInput(); }
    });

    async function quit() {
      clearInterval(timer);
      const started = run && run.pos > 0 && !run.done;
      if (started) {
        const ok = await ui.confirmModal('Sair da fase?', 'O que você digitou nesta rodada não vai contar.', 'Sair');
        if (!ok) { focusInput(); timer = setInterval(updateStats, 250); return; }
      }
      run = null;
      show('map');
      renderMap();
    }
    $('#tm-quit').addEventListener('click', quit);

    // ---------------- resultado ----------------

    async function finish() {
      clearInterval(timer);
      updateStats();
      keyboard.highlight(null);
      hands.highlight([]);
      input.blur();
      const result = run.result();
      const { level } = current;
      const stars = level ? Levels.starsFor(level.id, result.accuracy, result.wpm) : 0;
      const prevBest = level && progress.levels && progress.levels[level.id] ? progress.levels[level.id].bestWpm || 0 : 0;
      showResult(result, stars);
      // novo recorde de velocidade (com pelo menos 1 estrela: rápido e certo)
      const rec = $('#tm-record');
      const beat = level && stars >= 1 && Math.round(result.wpm) > Math.round(prevBest);
      rec.classList.toggle('is-new', Boolean(beat));
      rec.textContent = !level ? '' : beat
        ? (prevBest ? `🏆 Novo recorde de velocidade! (antes: ${Math.round(prevBest)} PPM)` : '🏆 Primeiro recorde desta fase!')
        : prevBest ? `Seu recorde nesta fase: ${Math.round(prevBest)} PPM` : '';

      if (!level) return;
      try {
        const res = await window.Competicao.send(ctx, '/progress/digitacao/results', { levelId: level.id, ...(comp ? { seed: comp.seed } : {}), ...result });
        progress = res.progress || progress;
        if (comp) { window.Competicao.waiting($('#tm-record')); return; }
        renderNextButton();
      } catch (e) {
        // sem internet: o resultado fica guardado e vai sozinho quando ela voltar
        if (e.queued) ui.toast(e.message, 'info', 6000);
        else ui.toast('Não consegui salvar o seu resultado 😵 Confira a internet.', 'error', 5000);
      }
    }

    function showResult(result, stars) {
      const { level, practice } = current;
      show('result');
      const starEls = [...container.querySelectorAll('.tm-star')];
      starEls.forEach((el) => el.classList.remove('is-on'));
      $('#tm-result-stars').hidden = Boolean(practice);
      starEls.forEach((el, i) => {
        if (i < stars) setTimeout(() => { el.classList.add('is-on'); sound.play('ding'); }, 350 + i * 380);
      });

      const titles = ['Quase lá!', 'Muito bem!', 'Excelente!', 'Perfeito!'];
      $('#tm-result-title').textContent = practice ? 'Treino concluído!' : titles[stars];
      let msg;
      if (practice) msg = 'Bom treino! Continue praticando 💪';
      else if (stars === 0) msg = 'Para ganhar estrela, tente errar menos: vá com calma e olhe a dica da tecla 🙂';
      else if (stars < 3 && result.accuracy >= 97) msg = `Para a 3ª estrela, tente ficar um pouco mais rápido (${Levels.getWorld(level.world).minWpm} PPM).`;
      else if (stars < 3) msg = 'Repita para conquistar mais estrelas! ⭐';
      else msg = 'Você mandou muito bem! 🎉';
      $('#tm-result-msg').textContent = msg;
      $('#tm-res-acc').textContent = `${Math.round(result.accuracy)}%`;
      $('#tm-res-wpm').textContent = Math.round(result.wpm);
      $('#tm-res-time').textContent = formatTime(result.durationMs);

      const tough = run.toughest(5);
      $('#tm-toughest').hidden = tough.length === 0;
      const keysEl = $('#tm-toughest-keys');
      keysEl.innerHTML = '';
      tough.forEach(({ char }) => {
        const k = document.createElement('span');
        k.className = 'tm-tough-key';
        k.textContent = char === ' ' ? 'espaço' : char;
        keysEl.appendChild(k);
      });

      if (stars >= 1 || practice) { fx.confetti({ amount: 40 + stars * 50 }); sound.play(stars === 3 ? 'fanfare' : 'tada'); }
      renderNextButton();
      setTimeout(() => $(stars >= 1 && !practice ? '#tm-next' : '#tm-retry').focus(), 80);
    }

    function nextOf(level) {
      return level ? Levels.LEVELS[level.index + 1] || null : null;
    }

    function renderNextButton() {
      const btn = $('#tm-next');
      const next = nextOf(current && current.level);
      btn.hidden = !next || !Levels.isUnlocked(progress, next.id);
    }

    $('#tm-retry').addEventListener('click', () => {
      if (current.practice) start({ practice: current.practice, title: current.title, text: current.practice.make() });
      else start({ level: current.level, title: current.level.title, text: Content.generate(current.level) });
    });
    $('#tm-next').addEventListener('click', () => {
      const next = nextOf(current.level);
      if (next) openIntro(next);
    });
    $('#tm-start').addEventListener('click', () => {
      const { level } = current;
      start({ level, title: level.title, text: Content.generate(level) });
    });
    $('#tm-continue').addEventListener('click', () => {
      sound.play('pop');
      openIntro(Levels.getLevel($('#tm-continue').dataset.level));
    });
    $('#tm-practice-open').addEventListener('click', () => { renderPractice(); show('practice'); });
    $('#tm-stop-on-error').addEventListener('change', (ev) => {
      stopOnError = ev.target.checked;
      try { localStorage.setItem(STOP_KEY, stopOnError ? '1' : '0'); } catch (e) { /* ignore */ }
    });
    $('#tm-uppercase').addEventListener('change', (ev) => {
      uppercase = ev.target.checked;
      try { localStorage.setItem(UPPER_KEY, uppercase ? '1' : '0'); } catch (e) { /* ignore */ }
      sound.play('pop');
    });
    container.querySelectorAll('[data-tm-go="map"]').forEach((btn) => btn.addEventListener('click', () => {
      show('map');
      renderMap();
    }));

    // Enter na tela de "antes da fase" começa a fase.
    function onDocKeydown(ev) {
      if (screen === 'intro' && ev.key === 'Enter' && document.activeElement?.id !== 'tm-start') {
        ev.preventDefault();
        $('#tm-start').click();
      }
    }
    document.addEventListener('keydown', onDocKeydown);

    async function load() {
      if (comp) {
        // disputa: direto na fase da rodada (texto pela semente), sem mapa e sem saídas
        window.Competicao.hide(container, ['#tm-quit', '[data-tm-go="map"]', '#tm-retry', '#tm-next']);
        const level = Levels.getLevel(comp.levelId);
        if (!level) { ui.toast('Essa fase não existe 😵', 'error'); return; }
        current = { level };
        start({ level, title: level.title, text: Content.generate(level, comp.seed >>> 0) });
        return;
      }
      // tablets e celulares sem teclado físico: avisa (com teclado bluetooth funciona)
      $('#tm-touch-notice').hidden = !window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      try {
        const res = await ctx.api.get('/progress/digitacao');
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
      clearInterval(timer);
      document.removeEventListener('keydown', onDocKeydown);
    }

    return { load, destroy };
  }

  let game = null;
  window.Plataforma.registerGame('digitacao', {
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
