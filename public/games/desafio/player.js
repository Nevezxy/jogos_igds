// public/games/desafio/player.js
// Desafio de digitação, lado da criança (/jogos/desafio?sala=CODE):
// entrar com o código, sala de espera, contagem 3-2-1, corrida com o mesmo
// teclado, mãos e dicas do Teclado Mágico, e o resultado com o pódio.
//
// O motor roda aqui também (para o retorno ser imediato), mas quem decide é
// o servidor: os caracteres vão para ele em pacotinhos a cada FLUSH_MS.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast } = window.BingoUI;
  const { play } = window.BingoSound;
  const C = window.DesafioCommon;
  const { TypingRun } = window.DigitacaoEngine;
  const layout = window.DigitacaoLayouts.abnt2;
  const { fingerName } = window.DigitacaoHands;

  const STORAGE_KEY = 'desafio_player_v1';
  const FLUSH_MS = 150;
  const $ = (id) => document.getElementById(id);

  const keyboard = window.DigitacaoKeyboard.createKeyboard($('dz-race-kb'), layout);
  const hands = window.DigitacaoHands.createHands($('dz-race-hands'));
  const input = $('dz-race-input');
  const textBox = $('dz-race-text');

  let active = false;
  let session = null; // { roomCode, playerToken, playerId, studentId }
  let lastState = null;
  let race = null; // { round, run, startAt, endsAt, spans, pending, finished, stopCountdown }
  let ticker = null;
  let flusher = null;
  let deadArmed = false;
  let lastCode = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
  }
  function clear() {
    session = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  const FRIENDLY = {
    SALA_NAO_ENCONTRADA: 'Hmm, não achei esse desafio 🤔 Confere o código com o(a) professor(a)!',
    SALA_ENCERRADA: 'Esse desafio já acabou 🌙 Peça o código novo!',
    SALA_BLOQUEADA: 'A sala está fechada 🔒 Peça ao(à) professor(a) para abrir!',
    SALA_LOTADA: 'A sala está cheia! 😮',
    EXPULSO: 'Você saiu dessa sala 😕 Fale com o(a) professor(a).',
  };

  // ---------------- entrar ----------------

  function showJoin(code = '', message) {
    $('dz-join-code').value = code || '';
    $('dz-join-speech').textContent = message || 'Qual é o código do desafio? 🏁';
    showScreen('dz-join');
    setTimeout(() => $('dz-join-code').focus(), 60);
  }

  async function join(code, playerToken = null, { silent = false } = {}) {
    try {
      const res = await emitAsync('dz:join', {
        roomCode: String(code).trim().toUpperCase(),
        studentToken: window.PlataformaAuth.token(),
        playerToken,
      });
      if (!active) return;
      const me = window.PlataformaAuth.student();
      session = { roomCode: res.state.code, playerToken: res.playerToken, playerId: res.playerId, studentId: me && me.id };
      save();
      if (!silent) play('start');
      handleState(res.state);
    } catch (e) {
      if (!active) return;
      if (e.code === 'SESSAO_INVALIDA' || e.code === 'CONTA_OBRIGATORIA') {
        window.PlataformaAuth.logout();
        return;
      }
      clear();
      play('bonk');
      showJoin(silent ? '' : code, FRIENDLY[e.code] || e.message || 'Não deu para entrar.');
    }
  }

  $('dz-join-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const code = $('dz-join-code').value.trim().toUpperCase();
    if (code.length !== 5) { $('dz-join-speech').textContent = 'O código tem 5 letras 🔤'; play('bonk'); return; }
    join(code);
  });

  async function leaveRoom() {
    if (session) {
      try { await emitAsync('dz:leave', { roomCode: session.roomCode, playerToken: session.playerToken }); } catch (e) { /* já saiu */ }
    }
    stopRace();
    clear();
    window.PlataformaAuth.goHome();
  }
  $('dz-join-back').addEventListener('click', () => window.PlataformaAuth.goHome());
  $('dz-lobby-leave').addEventListener('click', leaveRoom);
  $('dz-result-leave').addEventListener('click', leaveRoom);

  // ---------------- estado da sala ----------------

  const meIn = (state) => state && session && state.players.find((p) => p.id === session.playerId);

  function handleState(state) {
    C.syncClock(state.now);
    lastState = state;
    const me = meIn(state);
    if (state.status === 'ended') { endedRoom(); return; }
    if ((state.status === 'countdown' || state.status === 'racing') && state.text && me && me.racing) {
      if (!race || race.round !== state.round) startRace({ round: state.round, text: state.text, startAt: state.startAt, endsAt: state.endsAt, typed: state.typed });
      return;
    }
    if (state.status === 'finished' && state.results && state.results.ranking.some((r) => r.id === session.playerId)) {
      showResults(state);
      return;
    }
    showLobby(state);
  }

  function showLobby(state) {
    const me = meIn(state);
    const student = window.PlataformaAuth.student();
    $('dz-lobby-avatar').textContent = (me && me.avatar) || (student && student.avatar) || '🙂';
    $('dz-lobby-name').textContent = student ? student.firstName : '';
    $('dz-lobby-code').textContent = state.code;
    $('dz-lobby-count').textContent = state.players.length;
    $('dz-lobby-mode').textContent = C.modeLabel(state.config);
    const live = state.status === 'countdown' || state.status === 'racing';
    $('dz-lobby-speech').textContent = live
      ? 'A rodada já começou! Você corre na próxima 😉'
      : 'Já já começa! Quando o(a) professor(a) der a largada, o texto aparece aqui ✨';
    C.renderFriends($('dz-lobby-friends'), state.players, session && session.playerId);
    showScreen('dz-lobby');
  }

  function endedRoom() {
    stopRace();
    clear();
    toast('O desafio foi encerrado. Valeu por jogar! 💜', 'info', 5000);
    window.PlataformaAuth.goHome();
  }

  // ---------------- corrida ----------------

  function renderText(text) {
    textBox.innerHTML = '';
    const spans = [];
    let word = null;
    [...text].forEach((ch) => {
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
    return spans;
  }

  function markCurrent() {
    race.spans.forEach((s) => s.classList.remove('is-current'));
    const span = race.spans[race.run.pos];
    if (!span) return;
    span.classList.add('is-current');
    const lineHeight = span.offsetHeight || 40;
    textBox.scrollTop = Math.max(0, span.offsetTop - lineHeight * 0.6);
  }

  function updateHint() {
    const info = race && !race.finished ? window.DigitacaoHint.describe(layout, race.run.expected, { deadArmed, fingerName }) : null;
    if (!info) { keyboard.highlight(null); hands.highlight([]); $('dz-race-hint').textContent = ''; return; }
    keyboard.highlight(info.stroke);
    hands.highlight(info.fingers);
    $('dz-race-hint').textContent = info.text;
  }

  function startRace({ round, text, startAt, endsAt, typed = 0 }) {
    stopRace();
    const run = new TypingRun(text, { stopOnError: true, now: C.now });
    run.startedAt = startAt;
    // voltou no meio da rodada (recarregou a página): continua de onde parou
    for (let i = 0; i < typed; i++) run.type(run.expected);
    race = { round, run, startAt, endsAt, spans: renderText(text), pending: '', finished: run.done, place: null };
    race.spans.forEach((s, i) => { if (i < typed) s.classList.add('is-done'); });
    const student = window.PlataformaAuth.student();
    $('dz-race-avatar').textContent = student ? student.avatar : '🙂';
    $('dz-race-title').textContent = C.modeLabel(lastState && lastState.config);
    $('dz-race-done').hidden = true;
    deadArmed = false;
    showScreen('dz-race');
    markCurrent();
    updateHint();
    if (startAt > C.now()) {
      race.stopCountdown = C.countdown($('dz-countdown'), $('dz-countdown-num'), startAt, (label) => play(label === 'Já!' ? 'start' : 'tick'));
    }
    ticker = setInterval(updateRaceStats, 250);
    flusher = setInterval(flush, FLUSH_MS);
    focusInput();
  }

  function stopRace() {
    clearInterval(ticker);
    clearInterval(flusher);
    ticker = null;
    flusher = null;
    if (race && race.stopCountdown) race.stopCountdown();
    if (race) flush();
    keyboard.releaseAll();
    race = null;
  }

  function timeLeft() {
    return lastState && lastState.config.mode === 'relogio' ? race.endsAt - C.now() : null;
  }

  function updateRaceStats() {
    if (!race) return;
    const t = C.now();
    const elapsed = Math.max(0, (race.finishedAt || t) - race.startAt);
    const left = timeLeft();
    $('dz-race-time').textContent = left !== null ? C.formatTime(left) : C.formatTime(elapsed);
    const minutes = elapsed / 60000;
    $('dz-race-wpm').textContent = minutes > 0 ? Math.round(race.run.pos / 5 / minutes) : 0;
    $('dz-race-bar').style.width = `${(race.run.pos / race.run.chars.length) * 100}%`;
    if (lastState) {
      const order = C.liveOrder(lastState.players, lastState.config.mode);
      const idx = order.findIndex((p) => p.id === session.playerId);
      $('dz-race-place').textContent = idx >= 0 ? `${idx + 1}º de ${order.length}` : '–';
    }
    if (left !== null && left <= 0 && !race.finished) {
      race.finished = true;
      race.finishedAt = race.endsAt;
      keyboard.highlight(null);
      hands.highlight([]);
      $('dz-race-hint').textContent = '';
      $('dz-race-done').hidden = false;
      $('dz-race-done').textContent = '⏱ Tempo esgotado! Já já sai o resultado…';
      play('tada');
    }
  }

  function flush() {
    if (!race || !race.pending || !session) return;
    const chars = race.pending;
    race.pending = '';
    emitAsync('dz:keys', { roomCode: session.roomCode, playerToken: session.playerToken, chars })
      .then((ack) => {
        if (race && ack.finished && ack.place) {
          $('dz-race-done').textContent = `🏁 Você terminou em ${ack.place}º lugar! Esperando a turma…`;
        }
      })
      .catch(() => { /* a próxima atualização da sala corrige */ });
  }

  function handleChars(str) {
    if (!race || race.finished) return;
    if (C.now() < race.startAt) return; // ainda na contagem
    for (const ch of str.normalize('NFC')) {
      if (ch === '\n' || ch === '\r' || ch === '\t') continue;
      const index = race.run.pos;
      const res = race.run.type(ch);
      race.pending += ch;
      const span = race.spans[index];
      if (res.ok) {
        span.classList.add('is-done');
        if (race.run.missed.has(index)) span.classList.add('is-missed');
        if (lastCode) keyboard.flash(lastCode, true);
        play('click');
      } else {
        span.classList.remove('is-wrong');
        void span.offsetWidth;
        span.classList.add('is-wrong');
        if (lastCode) keyboard.flash(lastCode, false);
        play('bonk');
      }
      if (res.done) {
        race.finished = true;
        race.finishedAt = C.now();
        flush();
        keyboard.highlight(null);
        hands.highlight([]);
        $('dz-race-hint').textContent = '';
        $('dz-race-done').hidden = false;
        $('dz-race-done').textContent = '🏁 Você terminou! Esperando a turma…';
        window.BingoFx.confetti({ amount: 60 });
        play('tada');
        return;
      }
    }
    markCurrent();
    updateHint();
  }

  function focusInput() {
    $('dz-race-focus').hidden = true;
    input.value = '';
    input.focus({ preventScroll: true });
  }

  input.addEventListener('input', (ev) => {
    if (ev.isComposing) return;
    const value = input.value;
    input.value = '';
    deadArmed = false;
    $('dz-race-dead').hidden = true;
    handleChars(value);
  });
  input.addEventListener('compositionend', () => {
    const value = input.value;
    input.value = '';
    deadArmed = false;
    $('dz-race-dead').hidden = true;
    handleChars(value);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Tab') { ev.preventDefault(); return; }
    keyboard.press(ev.code, true);
    if (!['ShiftLeft', 'ShiftRight', 'CapsLock'].includes(ev.code)) lastCode = ev.code;
    if (ev.key === 'Dead') { deadArmed = true; $('dz-race-dead').hidden = false; updateHint(); }
  });
  input.addEventListener('keyup', (ev) => keyboard.press(ev.code, false));
  input.addEventListener('blur', () => {
    keyboard.releaseAll();
    setTimeout(() => {
      if (active && race && !race.finished && document.activeElement !== input) $('dz-race-focus').hidden = false;
    }, 50);
  });
  $('dz-race-focus').addEventListener('click', focusInput);
  $('dz-race-stage').addEventListener('mousedown', (ev) => {
    if (race && ev.target !== input) { ev.preventDefault(); focusInput(); }
  });

  // ---------------- resultado ----------------

  function showResults(state) {
    stopRace();
    const results = state.results;
    const mine = results.ranking.find((r) => r.id === session.playerId);
    const titles = { 1: '🥇 Você venceu!', 2: '🥈 Segundo lugar!', 3: '🥉 Terceiro lugar!' };
    $('dz-result-title').textContent = mine ? (titles[mine.position] || 'Fim da rodada!') : 'Fim da rodada!';
    $('dz-result-place').textContent = mine ? `Você ficou em ${mine.position}º de ${results.ranking.length}` : '';
    $('dz-result-acc').textContent = mine ? `${Math.round(mine.accuracy)}%` : '–';
    $('dz-result-wpm').textContent = mine ? Math.round(mine.wpm) : '–';
    $('dz-result-chars').textContent = mine ? mine.correct : '–';
    C.renderPodium($('dz-result-podium'), results, session.playerId);
    showScreen('dz-result');
    const onPodium = Object.values(results.podium).some((v) => v && (v === session.playerId || v.id === session.playerId));
    if (onPodium || (mine && mine.position <= 3)) { window.BingoFx.confetti(); play('fanfare'); } else play('tada');
  }

  // ---------------- eventos da sala ----------------

  socket.on('dz:state', (state) => {
    if (!active || !session || state.code !== session.roomCode) return;
    C.syncClock(state.now);
    lastState = state;
    const me = meIn(state);
    if (state.status === 'ended') { endedRoom(); return; }
    if (race) {
      // entrou depois da largada: não corre nesta rodada
      if (me && !me.racing) { stopRace(); showLobby(state); }
      return;
    }
    if (document.getElementById('dz-lobby').classList.contains('active')) showLobby(state);
  });

  socket.on('dz:round', (round) => {
    if (!active || !session) return;
    C.syncClock(round.now);
    startRace({ round: round.round, text: round.text, startAt: round.startAt, endsAt: round.endsAt });
  });

  socket.on('dz:results', (state) => {
    if (!active || !session || state.code !== session.roomCode) return;
    lastState = state;
    if (state.results && state.results.ranking.some((r) => r.id === session.playerId)) showResults(state);
    else showLobby(state);
  });

  socket.on('dz:kicked', () => {
    if (!active) return;
    stopRace();
    clear();
    toast('Você foi removido do desafio pelo(a) professor(a).', 'error', 6000);
    window.PlataformaAuth.goHome();
  });
  socket.on('dz:ended', () => { if (active) endedRoom(); });

  // conexão voltou: volta para a sala
  socket.on('connect', () => {
    if (active && session) join(session.roomCode, session.playerToken, { silent: true });
  });

  // ---------------- entrada pela plataforma ----------------

  function enter(ctx) {
    active = true;
    const code = (ctx.params.get('sala') || '').trim().toUpperCase();
    const saved = load();
    const me = ctx.student;
    if (saved && me && saved.studentId === me.id && (!code || code === saved.roomCode)) {
      session = saved;
      join(saved.roomCode, saved.playerToken, { silent: true });
    } else if (code) {
      if (saved) clear();
      join(code);
    } else {
      showJoin();
    }
  }

  function leave() {
    active = false;
    stopRace();
  }

  window.DesafioPlayer = { enter, leave };
})();
