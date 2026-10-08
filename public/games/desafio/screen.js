// public/games/desafio/screen.js
// Telão do Desafio de digitação (/telao/desafio?sala=CODE), para o
// projetor: QR Code na espera, contagem 3-2-1, a pista com o bichinho de
// cada criança andando conforme ela digita, relógio, placar da turma
// contra o mascote e o pódio no fim. Só assiste: não tem token nenhum.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, escapeHtml, qrUrl } = window.BingoUI;
  const { play } = window.BingoSound;
  const C = window.DesafioCommon;

  const $ = (id) => document.getElementById(id);
  let roomCode = null;
  let state = null;
  let started = false;
  let stopCountdown = null;
  let lastRound = 0;

  function show(part) {
    ['dz-t-missing', 'dz-t-lobby', 'dz-t-race', 'dz-t-results'].forEach((id) => { $(id).hidden = id !== part; });
  }

  async function renderLobby(s) {
    show('dz-t-lobby');
    $('dz-t-code').textContent = s.code;
    $('dz-t-mode').textContent = C.modeLabel(s.config);
    const n = s.players.length;
    $('dz-t-count').textContent = n === 0 ? 'Ninguém entrou ainda…' : n === 1 ? '1 pessoa já entrou! 🎉' : `${n} pessoas já entraram! 🎉`;
    C.renderFriends($('dz-t-friends'), s.players, null);
    if ($('dz-t-qr').dataset.code !== s.code) {
      $('dz-t-qr').dataset.code = s.code;
      const urls = await C.joinUrls(s.code);
      $('dz-t-qr').src = qrUrl(urls[0]);
    }
  }

  // uma raia por criança; os elementos são reaproveitados para o bichinho
  // deslizar em vez de pular
  function renderLanes(s) {
    const wrap = $('dz-t-lanes');
    const racers = s.players.filter((p) => p.racing);
    wrap.classList.toggle('is-two-cols', racers.length > 12);
    wrap.classList.toggle('is-few', racers.length <= 8);
    const seen = new Set();
    racers.forEach((p) => {
      seen.add(p.id);
      let lane = wrap.querySelector(`[data-lane="${CSS.escape(p.id)}"]`);
      if (!lane) {
        lane = document.createElement('div');
        lane.className = 'dz-lane';
        lane.dataset.lane = p.id;
        lane.innerHTML = `<span class="dz-lane-name"></span>
          <div class="dz-lane-track"><div class="dz-lane-runner"><span class="avatar-badge"></span><span class="dz-lane-wpm"></span></div><span class="dz-lane-flag"></span></div>`;
        wrap.appendChild(lane);
      }
      lane.querySelector('.dz-lane-name').textContent = p.name ? p.name.split(' ')[0] : '';
      lane.querySelector('.avatar-badge').textContent = p.avatar;
      lane.querySelector('.dz-lane-wpm').textContent = p.correct ? `${Math.round(p.wpm)} PPM` : '';
      // no relógio, a raia vai até o melhor da turma (o texto é bem comprido)
      const best = Math.max(1, ...racers.map((r) => r.correct));
      const pct = s.config.mode === 'relogio' ? p.correct / best : p.progress;
      // o bichinho anda até onde ele e o texto de velocidade ainda cabem na raia
      lane.querySelector('.dz-lane-runner').style.left = `calc((100% - 160px) * ${Math.min(1, pct)})`;
      lane.classList.toggle('is-done', p.finished);
      lane.querySelector('.dz-lane-flag').textContent = p.finished && p.place ? `🏁 ${p.place}º` : '';
    });
    wrap.querySelectorAll('[data-lane]').forEach((el) => { if (!seen.has(el.dataset.lane)) el.remove(); });
  }

  function renderRace(s) {
    show('dz-t-race');
    $('dz-t-race-title').textContent = s.config.mode === 'relogio' ? '⏱ Contra o relógio!' : '🏁 Corrida!';
    const t = C.now();
    $('dz-t-timer').textContent = s.config.mode === 'relogio'
      ? C.formatTime(s.endsAt - Math.max(t, s.startAt))
      : C.formatTime(Math.max(0, t - s.startAt));
    const m = s.mascot;
    $('dz-t-mascot').hidden = !m;
    if (m) {
      const max = Math.max(m.target, m.team, 1);
      $('dz-t-mteam').style.width = `${(m.team / max) * 100}%`;
      $('dz-t-mmascot').style.width = `${(m.mascotNow / max) * 100}%`;
      $('dz-t-mteam-n').textContent = m.team;
      $('dz-t-mmascot-n').textContent = m.mascotNow;
    }
    renderLanes(s);
  }

  function renderResults(s) {
    show('dz-t-results');
    C.renderPodium($('dz-t-podium'), s.results, null);
    C.renderMascotScore($('dz-t-mascot-score'), s.results.mascot);
    C.renderRanking($('dz-t-ranking'), s.results, null, 20);
  }

  function render(s) {
    state = s;
    C.syncClock(s.now);
    if (s.status === 'countdown' || s.status === 'racing') {
      if (s.round !== lastRound) {
        lastRound = s.round;
        $('dz-t-lanes').innerHTML = '';
        if (s.startAt > C.now()) startCountdown(s.startAt);
      }
      renderRace(s);
    } else if (s.status === 'finished' && s.results) {
      renderResults(s);
    } else if (s.status === 'ended') {
      show('dz-t-missing');
      $('dz-t-missing').querySelector('h1').textContent = 'O desafio acabou 🌙';
      $('dz-t-missing').querySelector('p').textContent = 'Valeu, turma!';
    } else {
      renderLobby(s);
    }
  }

  function startCountdown(startAt) {
    if (stopCountdown) stopCountdown();
    stopCountdown = C.countdown($('dz-t-countdown'), $('dz-t-countdown-num'), startAt, (label) => play(label === 'Já!' ? 'start' : 'tick'));
  }

  async function watch() {
    try {
      const res = await emitAsync('dz:watch', { roomCode });
      render(res.state);
    } catch (e) {
      show('dz-t-missing');
    }
  }

  socket.on('dz:screen_state', (s) => { if (started && s.code === roomCode) render(s); });
  socket.on('dz:round', (r) => {
    if (!started) return;
    C.syncClock(r.now);
    lastRound = r.round;
    $('dz-t-lanes').innerHTML = '';
    startCountdown(r.startAt);
  });
  socket.on('dz:results', (s) => {
    if (!started || s.code !== roomCode || !s.isScreen) return;
    render(s);
    window.BingoFx.confetti();
    play('fanfare');
  });
  socket.on('connect', () => { if (started) watch(); });

  // relógio do telão anda entre uma atualização e outra
  setInterval(() => {
    if (started && state && (state.status === 'countdown' || state.status === 'racing')) {
      const t = C.now();
      $('dz-t-timer').textContent = state.config.mode === 'relogio'
        ? C.formatTime(state.endsAt - Math.max(t, state.startAt))
        : C.formatTime(Math.max(0, t - state.startAt));
    }
  }, 250);

  // Voltar: fecha a aba do telão (aberta pelo painel) ou vai para o painel.
  $('dz-telao-back').addEventListener('click', () => {
    if (window.opener && !window.opener.closed) { window.close(); return; }
    location.assign('/professor/desafio');
  });

  function start() {
    started = true;
    roomCode = (new URLSearchParams(location.search).get('sala') || '').trim().toUpperCase();
    document.title = `Telão · Desafio ${roomCode || '?'}`;
    document.body.classList.add('is-telao');
    showScreen('dz-telao');
    if (!roomCode) { show('dz-t-missing'); return; }
    if (socket.connected) watch();
  }

  window.DesafioScreen = { start };
})();
