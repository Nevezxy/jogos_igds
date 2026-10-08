// public/games/bingo/screen.js
// Modo Telão (/telao?sala=CODE): tela grande para o projetor ou a TV da sala.
// Entra como espectador (só leitura, sem token) e mostra:
//   - antes de começar: QR Code gigante, link, código e a turma chegando
//   - durante a partida: bola sorteada enorme, últimas bolas, quadro de
//     números e a turma com o progresso ("🔥" de quem está quase lá)
//   - BINGO em tela cheia com o nome e o bichinho de quem ganhou
// A voz fica só no painel do professor (que costuma estar no mesmo computador).

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, fitText, renderNumberBoard, getJoinUrls, qrUrl } = window.BingoUI;
  const { play } = window.BingoSound;
  const { confetti } = window.BingoFx;
  const Overlays = window.BingoOverlays;

  const isScreenMode = () => location.pathname.replace(/\/+$/, '') === '/telao';
  let roomCode = null;
  let current = null;
  let knownIds = null;
  let inviteFor = null;

  function show(part) {
    ['telao-missing', 'telao-lobby', 'telao-game'].forEach((id) => {
      document.getElementById(id).hidden = id !== part;
    });
  }

  // ---------- sala de espera (QR Code gigante) ----------

  function renderLobby(state) {
    show('telao-lobby');
    document.getElementById('telao-code').textContent = state.code;
    if (inviteFor !== state.code) {
      inviteFor = state.code;
      getJoinUrls(state.code).then((urls) => {
        document.getElementById('telao-qr').src = qrUrl(urls[0]);
        document.getElementById('telao-url').textContent = urls[0].replace(/^https?:\/\//, '');
      });
    }
    const n = state.players.length;
    document.getElementById('telao-count').textContent =
      n === 0 ? 'Esperando a turma... ⏳' : n === 1 ? '1 pessoa já entrou! 🎉' : `${n} pessoas já entraram! 🎉`;

    const wrap = document.getElementById('telao-friends');
    const newcomers = knownIds ? state.players.filter((p) => !knownIds.has(p.id)) : [];
    if (newcomers.length) play('join');
    wrap.innerHTML = '';
    state.players.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'friend';
      if (!p.connected) item.classList.add('is-away');
      if (newcomers.includes(p)) item.classList.add('is-new');
      const avatar = document.createElement('span');
      avatar.className = 'avatar-badge';
      avatar.textContent = p.avatar || '🙂';
      const name = document.createElement('small');
      name.textContent = p.name;
      item.append(avatar, name);
      wrap.appendChild(item);
    });
  }

  // ---------- partida ----------

  function renderGame(state) {
    show('telao-game');
    const drawn = state.drawnItems;
    const last = drawn.length ? drawn[drawn.length - 1] : '?';
    const ballValue = document.getElementById('telao-ball-value');
    if (ballValue.textContent !== String(last) || !ballValue.style.fontSize) {
      ballValue.textContent = last;
      fitText(ballValue, last, { area: 0.8, max: ballValue.clientWidth * 0.5 });
    }

    const recent = document.getElementById('telao-recent');
    recent.innerHTML = '';
    drawn.slice(-6, -1).reverse().forEach((item) => {
      const chip = document.createElement('span');
      chip.className = 'chip chip-recent';
      chip.textContent = item;
      recent.appendChild(chip);
    });

    renderNumberBoard(document.getElementById('telao-board'), state.pool || [], drawn);

    // turma: vencedores e "quase lá" primeiro
    const players = state.players.slice().sort((a, b) =>
      (b.hasWon - a.hasWon) || (b.nearWin - a.nearWin) || (b.markedCount - a.markedCount));
    const strip = document.getElementById('telao-players');
    strip.innerHTML = '';
    players.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'telao-player';
      if (p.nearWin) item.classList.add('is-near');
      if (p.hasWon) item.classList.add('is-winner');
      if (!p.connected) item.classList.add('is-away');
      const avatar = document.createElement('span');
      avatar.className = 'avatar-badge';
      avatar.textContent = p.avatar || '🙂';
      const name = document.createElement('small');
      name.textContent = `${p.hasWon ? '🏆 ' : p.nearWin ? '🔥 ' : ''}${p.name}`;
      item.append(avatar, name);
      strip.appendChild(item);
    });

    // pausa por causa de bingo: mostra quem ganhou em vez de "Pausa!"
    const winners = state.players.filter((p) => p.hasWon);
    document.getElementById('telao-paused').hidden = state.status !== 'paused';
    document.getElementById('telao-paused-text').textContent = winners.length
      ? `🏆 ${winners.map((p) => `${p.avatar || ''} ${p.name}`).join(', ')} fez BINGO!`
      : 'Pausa!';
    window.BingoMascot.setMood(winners.length ? 'party' : 'sleep', document.getElementById('telao-paused-mascot'));
    document.getElementById('telao-ended').hidden = state.status !== 'ended';
    updateTimer();
  }

  function updateTimer() {
    const el = document.getElementById('telao-timer');
    const at = current && current.status === 'playing' ? current.nextAutoDrawAt : null;
    el.hidden = !at;
    if (at) el.textContent = `⏱️ Próxima bola em ${Math.max(0, Math.ceil((at - Date.now()) / 1000))}s`;
  }

  function render(state) {
    current = state;
    if (state.status === 'waiting') renderLobby(state);
    else renderGame(state);
    knownIds = new Set(state.players.map((p) => p.id));
  }

  // ---------- conexão ----------

  async function watch() {
    try {
      const res = await emitAsync('watch_room', { roomCode });
      render(res.state);
    } catch (e) {
      show('telao-missing');
    }
  }

  function start() {
    roomCode = (new URLSearchParams(location.search).get('sala') || '').trim().toUpperCase();
    document.title = `Telão · Sala ${roomCode || '?'}`;
    document.body.classList.add('is-telao');
    showScreen('screen-telao');
    if (!roomCode) return show('telao-missing');
    if (socket.connected) watch();
    socket.on('connect', watch); // reconexão: volta a assistir a sala
    setInterval(updateTimer, 250);
  }

  socket.on('screen_state', (state) => {
    if (!isScreenMode()) return;
    render(state);
  });

  socket.on('draw_result', ({ value }) => {
    if (!isScreenMode()) return;
    Overlays.drawBall(value, { holdMs: 1800 });
    play('ding');
  });

  socket.on('win_announced', ({ playerName, avatar }) => {
    if (!isScreenMode()) return;
    play('fanfare');
    confetti({ amount: 260 });
    Overlays.bingo({ text: `${avatar || ''} ${playerName} fez BINGO!`, autoCloseMs: 8000 });
  });

  function startCountdown() {
    if (!isScreenMode()) return;
    Overlays.closeBingo();
    Overlays.countdown();
  }
  socket.on('game_started', startCountdown);
  socket.on('new_match_started', startCountdown);

  // Voltar: o telão costuma ser a aba aberta pelo botão 📺 do painel; aí ela
  // só fecha e o professor volta para o painel, que continua aberto. Se não
  // der para fechar (aba aberta pelo link), vai para a sala no painel.
  document.getElementById('telao-back').addEventListener('click', () => {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    location.assign('/professor/bingo');
  });

  window.BingoScreen = { isScreenMode, start };
})();
