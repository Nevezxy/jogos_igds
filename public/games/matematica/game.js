// public/games/matematica/game.js
// 🔢 Conta Comigo — jogo de matemática da plataforma Jogos IGDS.
// Telas internas: mapa dos mundos → antes da fase → jogando → resultado.
// Uma rodada tem 10 contas. Errou: ganha uma dica e tenta de novo; errou de
// novo: vê a resposta e a conta volta em rodadas futuras. O servidor refaz
// as contas pela semente e decide as estrelas (/api/progress/matematica).
//
// Resposta: teclado numérico na tela (funciona no tablet) ou o teclado do
// computador. No mundo das figurinhas (o único com figurinhas, porque lá os
// números são pequenos), algumas fases dão 3 opções para escolher.

(function () {
  const Levels = window.ContaLevels;
  const P = window.ContaProblems;
  const Emoji = window.ContaEmoji;

  const THEME_KEY = 'cc_theme';
  const SPEECH_KEY = 'cc_speech';
  const OP_KEYS = { '+': '+', '-': '-', '*': '*', x: '*', X: '*', '/': '/', ':': '/' };

  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  function randomSeed() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 0xFFFFFFFF); }
  }

  function createGame(container, ctx) {
    const { sound, fx, ui } = ctx;
    const comp = window.Competicao.of(ctx); // 🏃 disputa da maratona (js/shared/competition.js)
    const $ = (sel) => container.querySelector(sel);
    const screens = [...container.querySelectorAll('[data-cc]')];

    let progress = { levels: {} };
    let screen = 'map';
    let destroyed = false;
    let theme = store.get(THEME_KEY, 'frutas');
    let speechOn = store.get(SPEECH_KEY, '0') === '1';

    // rodada em andamento
    let round = null; // { level, seed, review, problems, i, answers, startedAt, emoji, picture }
    let input = ['']; // um campo (ou dois: quociente e resto)
    let field = 0;
    let waiting = false; // mostrando a resposta certa, esperando "Continuar"
    let locked = false; // entre uma conta e outra

    function show(name) {
      screen = name;
      screens.forEach((el) => { el.hidden = el.dataset.cc !== name; });
      window.scrollTo({ top: 0 });
    }

    // ---------------- voz ----------------
    const canSpeak = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
    let voice = null;
    function pickVoice() {
      if (!canSpeak) return;
      const voices = window.speechSynthesis.getVoices();
      voice = voices.find((v) => /^pt(-|_)BR/i.test(v.lang)) || voices.find((v) => /^pt/i.test(v.lang)) || null;
      $('#cc-speech-toggle').hidden = !voice;
    }
    if (canSpeak) {
      pickVoice();
      window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    }
    function say(text) {
      if (!voice) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }

    // ---------------- mapa ----------------
    const levelData = (id) => (progress.levels && progress.levels[id]) || {};

    function renderMap() {
      const total = Levels.totalStars(progress);
      $('#cc-total-stars').textContent = total;
      $('#cc-max-stars').textContent = Levels.MAX_STARS;
      const next = Levels.nextLevel(progress);
      const first = ctx.student ? ctx.student.firstName : '';
      $('#cc-map-speech').textContent = total === 0
        ? `Oi, ${first}! Bora fazer contas? Comece pela adição, ou escolha qualquer fase! 🔢`
        : next ? `Você já tem ${total} ⭐! A próxima fase está piscando em amarelo 💪` : `Uau, ${first}! Você fez todas as fases! 🏆`;
      const cont = $('#cc-continue');
      cont.textContent = next ? `▶ Continuar: ${next.title}` : '🏆 Jogar de novo a primeira fase';
      cont.dataset.level = next ? next.id : Levels.LEVELS[0].id;

      window.LevelMap.render($('#cc-worlds'), {
        worlds: Levels.WORLDS,
        storageKey: 'cc_map_filter',
        nextId: next ? next.id : null,
        stateOf: (level) => ({ stars: levelData(level.id).stars || 0, plays: levelData(level.id).plays || 0 }),
        onPick: (level) => { sound.play('pop'); openIntro(level); },
      });
    }

    function renderThemes() {
      const wrap = $('#cc-themes');
      wrap.innerHTML = '';
      Object.entries(Emoji.THEMES).forEach(([id, t]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cc-theme';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(id === theme));
        b.title = t.name;
        b.textContent = `${t.icon} ${t.name}`;
        b.addEventListener('click', () => { theme = id; store.set(THEME_KEY, id); sound.play('pop'); renderThemes(); });
        wrap.appendChild(b);
      });
    }

    // ---------------- antes da fase ----------------
    let currentLevel = null;

    function reviewKeys(level) {
      const review = levelData(level.id).review || {};
      return Object.entries(review).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    }

    function openIntro(level) {
      currentLevel = level;
      const world = Levels.getWorld(level.world);
      $('#cc-intro-world').textContent = `${world.icon} ${world.name} · fase ${level.indexInWorld + 1} de ${world.levels.length}`;
      $('#cc-intro-title').textContent = level.title;
      $('#cc-intro-world-text').textContent = level.indexInWorld === 0 ? world.intro : '';
      $('#cc-intro-tip').textContent = `💡 ${level.tip}`;
      const sample = P.makeRound(level, randomSeed()).slice(0, 3);
      const ex = $('#cc-intro-example');
      ex.innerHTML = '';
      sample.forEach((p) => ex.appendChild(renderTokens(p.tokens, { compact: true })));
      // mundo das figurinhas: escolhe o tema antes de começar
      $('#cc-intro-pictures').hidden = !world.emoji;
      if (world.emoji) {
        $('#cc-intro-emoji').textContent = `🍎 As contas vêm com figurinhas${level.choice ? ', e você escolhe a resposta entre 3 opções' : ''}. Escolha as figurinhas:`;
        renderThemes();
      }
      $('#cc-intro-review').hidden = reviewKeys(level).length === 0;
      const bestStreak = levelData(level.id).bestStreak || 0;
      $('#cc-intro-record').hidden = bestStreak < 2;
      $('#cc-intro-record').textContent = `🔥 Seu recorde: ${bestStreak} contas certas seguidas. Consegue bater?`;
      show('intro');
      setTimeout(() => $('#cc-start').focus(), 60);
    }

    // ---------------- desenho da conta ----------------
    function renderTokens(tokens, { compact = false } = {}) {
      const wrap = document.createElement('span');
      wrap.className = compact ? 'cc-expr is-compact' : 'cc-expr';
      const add = (parent, tk) => {
        let node;
        switch (tk.t) {
          case 'n': node = Object.assign(document.createElement('span'), { className: 'cc-num', textContent: P.fmt(tk.v) }); break;
          case 'o': node = Object.assign(document.createElement('span'), { className: tk.unary ? 'cc-op is-unary' : 'cc-op', textContent: tk.v }); break;
          case 'p': node = Object.assign(document.createElement('span'), { className: 'cc-paren', textContent: tk.v }); break;
          case 'eq': node = Object.assign(document.createElement('span'), { className: 'cc-op', textContent: '=' }); break;
          case 'hole': node = Object.assign(document.createElement('span'), { className: tk.op ? 'cc-hole is-op' : 'cc-hole', textContent: '?' }); break;
          case 'sup': node = Object.assign(document.createElement('sup'), { className: tk.v === '?' ? 'cc-sup cc-hole' : 'cc-sup', textContent: tk.v }); break;
          case 'sq':
          case 'cb': {
            node = document.createElement('span');
            node.className = 'cc-root';
            if (tk.t === 'cb') node.appendChild(Object.assign(document.createElement('span'), { className: 'cc-root-index', textContent: '3' }));
            node.appendChild(Object.assign(document.createElement('span'), { className: 'cc-root-sign', textContent: '√' }));
            const rad = document.createElement('span');
            rad.className = 'cc-radicand';
            tk.parts.forEach((x) => add(rad, x));
            node.appendChild(rad);
            break;
          }
          default: return;
        }
        parent.appendChild(node);
      };
      tokens.forEach((tk) => add(wrap, tk));
      return wrap;
    }

    // ---------------- rodada ----------------
    function start(level) {
      const seed = comp ? comp.seed >>> 0 : randomSeed();
      // na disputa, sem as contas de revisão (os dois lados têm as mesmas contas)
      const review = comp ? [] : reviewKeys(level);
      round = {
        level,
        seed,
        review,
        problems: P.makeRound(level, seed, review),
        i: 0,
        answers: [],
        startedAt: Date.now(),
        emoji: Boolean(Levels.getWorld(level.world).emoji),
        picture: Emoji.pickEmoji(theme),
        streak: 0,
        bestStreak: 0,
      };
      $('#cc-play-title').textContent = level.title;
      renderStreak(false);
      $('#cc-say').hidden = !voice;
      const dots = $('#cc-dots');
      dots.innerHTML = '';
      round.problems.forEach(() => dots.appendChild(Object.assign(document.createElement('span'), { className: 'cc-dot' })));
      show('play');
      showProblem();
    }

    const problem = () => round.problems[round.i];
    // ✍️ conta armada (mundo `armada`): + − × com o resultado escondido
    const armada = (p = problem()) => Boolean(Levels.getWorld(round.level.world).armada)
      && p.type === 'bin' && p.hide === 'c' && ['+', '-', '*'].includes(p.op);
    const choiceMode = () => round.emoji && round.level.choice && problem().fields === 1 && problem().hide !== 'op';
    const minusAllowed = () => Boolean(Levels.getWorld(round.level.world).minus);

    function showProblem() {
      const p = problem();
      locked = false;
      waiting = false;
      input = p.fields === 2 ? ['', ''] : [''];
      field = 0;
      round.tries = [];
      [...$('#cc-dots').children].forEach((d, i) => d.classList.toggle('is-current', i === round.i));

      const box = $('#cc-problem');
      box.innerHTML = '';
      box.classList.remove('is-pictures');
      box.classList.remove('is-armada');
      const pic = round.emoji ? Emoji.render(p, round.picture) : null;
      if (pic) {
        box.classList.add('is-pictures');
        box.appendChild(pic.node);
      } else if (armada(p)) {
        box.classList.add('is-armada');
        box.appendChild(renderArmada(p));
      } else {
        box.appendChild(renderTokens(p.tokens));
      }
      $('#cc-caption').hidden = !pic;
      $('#cc-caption').textContent = pic ? pic.caption : '';
      $('#cc-feedback').textContent = '';
      $('#cc-feedback').className = 'cc-feedback';
      $('#cc-next-problem').hidden = true;
      renderAnswer();
      renderPad();
      if (speechOn) say(P.speech(p));
    }

    // A conta armada, como no caderno: o vai-um (caixinhas que a criança
    // marca, só de ajuda), o número de cima, o de baixo com o sinal, o traço
    // e as casas do resultado, que enchem da direita para a esquerda.
    function renderArmada(p) {
      let top = String(p.a);
      let bottom = String(p.b);
      if (p.op === '*' && bottom.length > top.length) [top, bottom] = [bottom, top]; // o maior em cima
      const ans = String(p.answer);
      const cols = Math.max(top.length, bottom.length, ans.length);
      const grid = document.createElement('div');
      grid.className = 'cc-armada';
      grid.style.gridTemplateColumns = `repeat(${cols + 1}, var(--cell))`;
      grid.setAttribute('role', 'img');
      grid.setAttribute('aria-label', P.text(p));
      const cell = (cls, text = '') => grid.appendChild(Object.assign(document.createElement('span'), { className: cls, textContent: text }));
      const digits = (str, cls) => {
        const padded = str.padStart(cols, ' ');
        [...padded].forEach((ch) => cell(`cc-adigit ${cls}`, ch.trim()));
      };
      // vai-um / empréstimo: uma caixinha em cima de cada casa, menos a das unidades
      cell('cc-aop');
      for (let c = 0; c < cols; c++) {
        if (c === cols - 1) { cell('cc-carry-spot'); continue; }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cc-carry';
        b.title = p.op === '-' ? 'Marque o empréstimo' : 'Marque o vai-um';
        b.setAttribute('aria-label', b.title);
        b.addEventListener('click', () => {
          b.textContent = b.textContent ? '' : '1';
          b.classList.toggle('is-on', Boolean(b.textContent));
          sound.play('click');
        });
        grid.appendChild(b);
      }
      cell('cc-aop');
      digits(top, 'is-top');
      cell('cc-aop', P.SYMBOL[p.op]);
      digits(bottom, 'is-bottom');
      cell('cc-aline');
      cell('cc-aop');
      round.armCells = [];
      for (let c = 0; c < cols; c++) round.armCells.push(cell('cc-acell'));
      return grid;
    }
    // as casas do resultado: o que foi digitado fica encostado à direita
    function renderArmadaAnswer() {
      const cells = round.armCells || [];
      const v = input[0];
      const next = cells.length - 1 - v.length; // a próxima casa a preencher
      cells.forEach((el, i) => {
        const k = i - (cells.length - v.length);
        el.textContent = k >= 0 ? v[k] : '';
        el.classList.toggle('is-active', i === next && !waiting);
      });
    }

    // caixas de resposta (ou opções)
    function renderAnswer() {
      const p = problem();
      const wrap = $('#cc-answer');
      wrap.innerHTML = '';
      wrap.className = 'cc-answer';
      if (armada(p)) {
        // o resultado é escrito nas casas da própria conta
        wrap.classList.add('is-armada');
        renderArmadaAnswer();
        return;
      }
      if (p.hide === 'op') {
        wrap.classList.add('is-ops');
        ['+', '-', '*', '/'].forEach((op) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'cc-choice cc-choice-op';
          b.textContent = P.SYMBOL[op];
          b.dataset.value = op;
          b.disabled = round.tries.includes(op) || waiting;
          b.addEventListener('click', () => submit(op));
          wrap.appendChild(b);
        });
        return;
      }
      if (choiceMode()) {
        wrap.classList.add('is-choices');
        if (!round.options) round.options = makeOptions(p);
        round.options.forEach((v, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'cc-choice';
          b.textContent = P.fmt(v);
          b.title = `Tecla ${i + 1}`;
          b.disabled = round.tries.includes(v) || waiting;
          b.addEventListener('click', () => submit(v));
          wrap.appendChild(b);
        });
        return;
      }
      input.forEach((value, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cc-input';
        b.classList.toggle('is-active', i === field && !waiting);
        b.setAttribute('aria-label', p.labels ? p.labels[i] : 'Resposta');
        if (p.labels) b.appendChild(Object.assign(document.createElement('small'), { textContent: p.labels[i] }));
        b.appendChild(Object.assign(document.createElement('span'), { className: 'cc-input-value', textContent: value ? formatTyped(value) : '' }));
        b.addEventListener('click', () => { field = i; renderAnswer(); });
        wrap.appendChild(b);
      });
    }
    // "1450" aparece como "1.450" enquanto digita; "-3" como "−3"
    const formatTyped = (v) => (v === '-' ? '−' : P.fmt(Number(v)));

    // 3 opções: a certa e duas vizinhas (sem negativos e sem repetir)
    function makeOptions(p) {
      const ans = p.answer;
      const set = new Set([ans]);
      const deltas = [1, -1, 2, -2, 10, -10, 3, -3];
      for (const d of deltas.sort(() => Math.random() - 0.5)) {
        if (set.size >= 3) break;
        const v = ans + d;
        if (v >= 0) set.add(v);
      }
      let extra = ans + 4;
      while (set.size < 3) set.add(extra++);
      return [...set].sort(() => Math.random() - 0.5);
    }

    function renderPad() {
      const pad = $('#cc-pad');
      pad.innerHTML = '';
      const p = problem();
      pad.hidden = p.hide === 'op' || choiceMode();
      if (pad.hidden) return;
      const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', minusAllowed() ? '−' : '', '0', '⌫'];
      keys.forEach((k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cc-key';
        if (!k) { b.disabled = true; b.classList.add('is-blank'); b.setAttribute('aria-hidden', 'true'); }
        b.textContent = k;
        if (k === '⌫') b.setAttribute('aria-label', 'Apagar');
        b.addEventListener('click', () => press(k));
        pad.appendChild(b);
      });
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'cc-key cc-key-ok';
      ok.textContent = 'OK ✓';
      ok.addEventListener('click', () => press('OK'));
      pad.appendChild(ok);
    }

    function press(k) {
      if (!round || locked || waiting) return;
      if (k === 'OK') {
        const p = problem();
        // divisão com resto: OK no 1º campo passa para o 2º
        if (p.fields === 2 && field === 0 && input[0] && !input[1]) { field = 1; renderAnswer(); return; }
        if (input.some((v) => !v || v === '-')) {
          window.BingoFx.shake($('#cc-answer'));
          return;
        }
        const value = p.fields === 2 ? input.map(Number) : Number(input[0]);
        submit(value);
        return;
      }
      let v = input[field];
      if (armada()) {
        // conta armada: cada algarismo novo entra à esquerda (unidades primeiro)
        if (k === '⌫') v = v.slice(1);
        else if (/^\d$/.test(k) && v.length < (round.armCells || []).length) v = k + v;
        input[field] = v;
        sound.play('click');
        renderAnswer();
        return;
      }
      if (k === '⌫') v = v.slice(0, -1);
      else if (k === '−' || k === '-') { if (minusAllowed()) v = v.startsWith('-') ? v.slice(1) : `-${v}`; }
      else if (/^\d$/.test(k)) { if (v.replace('-', '').length < 9) v = v === '0' ? k : v === '-0' ? `-${k}` : v + k; }
      input[field] = v;
      sound.play('click');
      renderAnswer();
    }

    function submit(value) {
      if (!round || locked || waiting) return;
      const p = problem();
      round.tries.push(value);
      const dot = $('#cc-dots').children[round.i];
      if (P.isCorrect(p, value)) {
        locked = true;
        const first = round.tries.length === 1;
        dot.classList.add(first ? 'is-right' : 'is-second');
        $('#cc-feedback').textContent = first ? pickPraise() : 'Isso! Na segunda tentativa 👍';
        if (first) bumpStreak(); else resetStreak();
        $('#cc-feedback').className = 'cc-feedback is-right';
        sound.play('ding');
        fillHole(value);
        finishProblem(900);
        return;
      }
      sound.play('bonk');
      window.BingoFx.shake($('#cc-answer'));
      resetStreak();
      if (round.tries.length === 1) {
        $('#cc-feedback').textContent = `💡 ${P.hint(p)}`;
        $('#cc-feedback').className = 'cc-feedback is-hint';
        if (speechOn) say(P.hint(p));
        input = input.map(() => '');
        field = 0;
        renderAnswer();
        return;
      }
      // 2º erro: mostra a resposta e espera "Continuar"
      waiting = true;
      dot.classList.add('is-wrong');
      $('#cc-feedback').textContent = `A resposta certa é ${P.answerText(p)}. Essa conta vai voltar para você treinar ✍️`;
      $('#cc-feedback').className = 'cc-feedback is-solution';
      fillHole(p.fields === 2 ? p.answer : p.hide === 'op' ? p.op : p.answer, 'is-revealed');
      input = input.map(() => '');
      renderAnswer();
      $('#cc-pad').hidden = true;
      $('#cc-next-problem').hidden = false;
      $('#cc-next-problem').focus();
    }

    // 🔥 sequência: contas certas de primeira, uma atrás da outra
    function bumpStreak() {
      round.streak++;
      round.bestStreak = Math.max(round.bestStreak, round.streak);
      renderStreak(true);
      const n = round.streak;
      if (n === 5 || n === 10) {
        $('#cc-feedback').textContent = n === 10 ? '🔥 10 seguidas! Que fera! 🏆' : '🔥 5 seguidas! Pegando fogo!';
        banner(n === 10 ? '10 SEGUIDAS! 🏆' : '5 SEGUIDAS! 🔥', n === 10 ? 'is-tier5' : 'is-tier3');
        fx.confetti({ amount: 30, origin: { x: innerWidth / 2, y: innerHeight / 3 }, power: 0.6 });
        sound.play('tada');
      }
      // passou o recorde da fase durante a rodada
      const prev = levelData(round.level.id).bestStreak || 0;
      if (prev >= 2 && n === prev + 1) setTimeout(() => banner('🏆 NOVO RECORDE!', 'is-record'), 350);
    }
    function resetStreak() {
      if (round.streak >= 3) banner('💔 sequência perdida', 'is-lost');
      round.streak = 0;
      renderStreak(false);
    }
    function renderStreak(bump) {
      const n = round.streak;
      const el = $('#cc-streak');
      el.hidden = n < 2;
      el.querySelector('b').textContent = `🔥 ${n}`;
      el.classList.toggle('is-warm', n >= 5 && n < 10);
      el.classList.toggle('is-fire', n >= 10);
      $('.cc-stage').classList.toggle('is-on-fire', n >= 5);
      if (bump) {
        el.classList.remove('is-hot');
        void el.offsetWidth;
        el.classList.add('is-hot');
      }
      const prev = levelData(round.level.id).bestStreak || 0;
      const best = $('#cc-best-streak');
      best.hidden = prev < 2;
      best.classList.toggle('is-new', n > prev);
      best.textContent = n > prev ? '🏆 NOVO RECORDE!' : `🏆 recorde: ${prev} seguidas`;
    }
    // letreiro grande no meio da área da conta (mesmo estilo dos Cadentes)
    function banner(text, cls) {
      const b = document.createElement('div');
      b.className = `cad-banner ${cls || ''}`.trim();
      b.textContent = text;
      $('.cc-stage').appendChild(b);
      setTimeout(() => b.remove(), 1300);
    }

    const PRAISE = ['Isso! 🎉', 'Muito bem! ⭐', 'Certinho! ✅', 'Mandou bem! 💪', 'Acertou! 🙌', 'Show! 🚀'];
    const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

    // escreve a resposta no lugar do "?" (verde quando acertou, laranja quando o jogo mostrou)
    function fillHole(value, cls = 'is-filled') {
      const hole = $('#cc-problem .cc-hole');
      const p = problem();
      if (armada(p)) {
        const s = String(value).padStart(round.armCells.length, ' ');
        round.armCells.forEach((el, i) => {
          el.textContent = s[i].trim();
          el.classList.remove('is-active');
          el.classList.add(cls);
        });
        return;
      }
      if (hole) {
        hole.classList.add(cls);
        hole.textContent = p.fields === 2 ? `${P.fmt(value[0])} resto ${P.fmt(value[1])}` : p.hide === 'op' ? P.SYMBOL[value] : P.fmt(value);
      }
    }

    function finishProblem(delay) {
      round.answers.push({ tries: round.tries.slice() });
      round.options = null;
      setTimeout(() => {
        if (destroyed || !round) return;
        round.i++;
        if (round.i >= round.problems.length) finishRound();
        else showProblem();
      }, delay);
    }

    $('#cc-next-problem').addEventListener('click', () => {
      if (!waiting) return;
      waiting = false;
      locked = true;
      finishProblem(0);
    });
    $('#cc-say').addEventListener('click', () => { if (round) say(P.speech(problem())); });

    async function quit() {
      if (round && round.i > 0) {
        const ok = await ui.confirmModal('Sair da fase?', 'As contas desta rodada não vão contar.', 'Sair');
        if (!ok) return;
      }
      round = null;
      if (canSpeak) window.speechSynthesis.cancel();
      show('map');
      renderMap();
    }
    $('#cc-quit').addEventListener('click', quit);

    // ---------------- resultado ----------------
    async function finishRound() {
      const r = round;
      const durationMs = Date.now() - r.startedAt;
      const firstTry = r.answers.filter((a, i) => P.isCorrect(r.problems[i], a.tries[0])).length;
      const secondTry = r.answers.filter((a, i) => !P.isCorrect(r.problems[i], a.tries[0]) && a.tries[1] !== undefined && P.isCorrect(r.problems[i], a.tries[1])).length;
      const avgSec = durationMs / 1000 / r.problems.length;
      const stars = Levels.starsFor(r.level.id, { score: firstTry + secondTry * 0.5, count: r.problems.length, avgSec });
      showResult({ firstTry, secondTry, avgSec, stars });
      if (comp) window.Competicao.waiting($('#cc-record'));
      try {
        const res = await window.Competicao.send(ctx, '/progress/matematica/results', {
          levelId: r.level.id,
          seed: r.seed,
          review: r.review,
          answers: r.answers,
          durationMs,
        });
        progress = res.progress || progress;
      } catch (e) {
        // sem internet: o resultado fica guardado e vai sozinho quando ela voltar
        if (e.queued) ui.toast(e.message, 'info', 6000);
        else ui.toast('Não consegui salvar o seu resultado 😵 Confira a internet.', 'error', 5000);
      }
    }

    function showResult({ firstTry, secondTry, avgSec, stars }) {
      const r = round;
      show('result');
      const starEls = [...container.querySelectorAll('.cc-star')];
      starEls.forEach((el) => el.classList.remove('is-on'));
      starEls.forEach((el, i) => {
        if (i < stars) setTimeout(() => { el.classList.add('is-on'); sound.play('ding'); }, 350 + i * 380);
      });
      const titles = ['Quase lá!', 'Muito bem!', 'Excelente!', 'Perfeito!'];
      $('#cc-result-title').textContent = titles[stars];
      const level = r.level;
      let msg;
      if (stars === 0) msg = 'Para ganhar estrela, acerte 6 contas de primeira. Use as dicas e tente de novo! 🙂';
      else if (stars < 3 && firstTry + secondTry * 0.5 >= 9) msg = `Para a 3ª estrela, tente responder um pouco mais rápido (uns ${level.target} segundos por conta).`;
      else if (stars < 3) msg = 'Repita para conquistar mais estrelas! ⭐';
      else msg = 'Você mandou muito bem! 🎉';
      $('#cc-result-msg').textContent = msg;
      $('#cc-res-first').textContent = `${firstTry}/${r.problems.length}`;
      $('#cc-res-second').textContent = secondTry;
      $('#cc-res-time').textContent = `${Math.round(avgSec)} s`;
      const prevStreak = levelData(level.id).bestStreak || 0;
      const rec = $('#cc-record');
      const beat = r.bestStreak >= 2 && r.bestStreak > prevStreak;
      rec.classList.toggle('is-new', beat);
      rec.textContent = beat
        ? `🔥 Novo recorde: ${r.bestStreak} contas certas seguidas!${prevStreak ? ` (antes: ${prevStreak})` : ''}`
        : r.bestStreak >= 2 ? `🔥 Melhor sequência: ${r.bestStreak} (recorde: ${prevStreak})` : '';

      const missed = r.problems.filter((p, i) => !P.isCorrect(p, r.answers[i].tries[0]));
      $('#cc-missed').hidden = missed.length === 0;
      $('#cc-missed-list').innerHTML = '';
      missed.forEach((p) => {
        const li = document.createElement('li');
        li.textContent = P.solution(p);
        $('#cc-missed-list').appendChild(li);
      });
      const next = comp ? null : Levels.LEVELS[level.index + 1];
      $('#cc-next').hidden = !next;
      if (stars >= 1) { fx.confetti({ amount: 40 + stars * 50 }); sound.play(stars === 3 ? 'fanfare' : 'tada'); }
      setTimeout(() => $(stars >= 1 && next ? '#cc-next' : '#cc-retry').focus(), 80);
    }

    $('#cc-retry').addEventListener('click', () => start(round.level));
    $('#cc-next').addEventListener('click', () => {
      const next = Levels.LEVELS[round.level.index + 1];
      if (next) openIntro(next);
    });
    $('#cc-start').addEventListener('click', () => start(currentLevel));
    $('#cc-continue').addEventListener('click', () => {
      sound.play('pop');
      openIntro(Levels.getLevel($('#cc-continue').dataset.level));
    });
    container.querySelectorAll('[data-cc-go="map"]').forEach((btn) => btn.addEventListener('click', () => {
      round = null;
      show('map');
      renderMap();
    }));

    $('#cc-speech').checked = speechOn;
    $('#cc-speech').addEventListener('change', (ev) => {
      speechOn = ev.target.checked;
      store.set(SPEECH_KEY, speechOn ? '1' : '0');
      if (speechOn) say('Vou ler as contas para você.');
    });

    // teclado do computador
    function onKeydown(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (screen === 'intro' && ev.key === 'Enter' && document.activeElement?.id !== 'cc-start') {
        ev.preventDefault();
        $('#cc-start').click();
        return;
      }
      if (screen !== 'play' || !round) return;
      const p = problem();
      if (waiting) {
        if (ev.key === 'Enter') { ev.preventDefault(); $('#cc-next-problem').click(); }
        return;
      }
      if (p.hide === 'op') {
        const op = OP_KEYS[ev.key];
        if (op) { ev.preventDefault(); if (!round.tries.includes(op)) submit(op); }
        return;
      }
      if (choiceMode()) {
        const n = Number(ev.key);
        if (n >= 1 && n <= 3) { ev.preventDefault(); const btns = $('#cc-answer').children; if (btns[n - 1] && !btns[n - 1].disabled) btns[n - 1].click(); }
        return;
      }
      if (/^\d$/.test(ev.key)) { ev.preventDefault(); press(ev.key); }
      else if (ev.key === '-') { ev.preventDefault(); press('-'); }
      else if (ev.key === 'Backspace') { ev.preventDefault(); press('⌫'); }
      else if (ev.key === 'Enter') { ev.preventDefault(); press('OK'); }
      else if (ev.key === 'Tab' && p.fields === 2) { ev.preventDefault(); field = 1 - field; renderAnswer(); }
    }
    document.addEventListener('keydown', onKeydown);

    async function load() {
      if (comp) {
        // disputa: direto na fase da rodada, sem mapa e sem saídas
        window.Competicao.hide(container, ['#cc-quit', '[data-cc-go="map"]', '#cc-retry', '#cc-next']);
        const level = Levels.getLevel(comp.levelId);
        if (!level) { ui.toast('Essa fase não existe 😵', 'error'); return; }
        start(level);
        return;
      }
      try {
        const res = await ctx.api.get('/progress/matematica');
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
      document.removeEventListener('keydown', onKeydown);
      if (canSpeak) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
      }
    }

    return { load, destroy };
  }

  let game = null;
  window.Plataforma.registerGame('matematica', {
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
