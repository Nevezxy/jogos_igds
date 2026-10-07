// public/games/bingo/player.js
// Tudo relacionado à experiência da criança: sala de espera (com os amigos
// chegando e balões para estourar) e tela de jogo (bola sorteada, cartela,
// "falta 1!", BINGO, pausa). O servidor é a única fonte de verdade — este
// arquivo só desenha o que chega em `player_state` / `room_summary` e envia
// a intenção de marcar uma casa, nunca decide sozinho se venceu.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast, statusLabel, fitText } = window.BingoUI;
  const { play } = window.BingoSound;
  const { confetti, sparkle, sparkleAt, shake } = window.BingoFx;
  const Overlays = window.BingoOverlays;

  const session = () => window.BingoApp.session;
  const isPlayer = () => session().role === 'player';
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =====================================================================
  // SALA DE ESPERA
  // =====================================================================

  let knownFriendIds = null;
  let lastWaitingState = null;

  function renderWaiting(state) {
    lastWaitingState = state;
    document.getElementById('waiting-room-name').textContent = state.name || `Sala ${state.code}`;
    document.getElementById('waiting-room-code').textContent = state.code;
    document.getElementById('waiting-player-name').textContent = session().playerName || '';
    document.getElementById('waiting-avatar').textContent = session().playerAvatar || '🙂';
    document.getElementById('waiting-count').textContent = state.playerCount ?? 0;
    renderFriends(state.players || []);
    startWaitingFun();
  }

  // Avatares de quem já está na sala; quem acabou de chegar "cai" quicando.
  function renderFriends(players) {
    const wrap = document.getElementById('waiting-friends');
    const isFirstRender = knownFriendIds === null;
    const newcomers = players.filter((p) => !isFirstRender && !knownFriendIds.has(p.id));
    if (newcomers.length) play('join');
    knownFriendIds = new Set(players.map((p) => p.id));

    wrap.innerHTML = '';
    players.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'friend';
      if (p.id === session().playerId) item.classList.add('is-me');
      if (!p.connected) item.classList.add('is-away');
      if (isFirstRender || newcomers.includes(p)) {
        item.classList.add('is-new');
        item.style.setProperty('--i', isFirstRender ? i : 0);
      }
      const avatar = document.createElement('span');
      avatar.className = 'avatar-badge';
      avatar.textContent = p.avatar || '🙂';
      const name = document.createElement('small');
      name.textContent = p.id === session().playerId ? 'você' : p.name;
      item.append(avatar, name);
      wrap.appendChild(item);
    });
  }

  // ----- fala do mascote e balões (só enquanto a sala de espera aparece) -----

  let speechTimer = null;
  let balloonTimer = null;
  let speechIndex = 0;
  let poppedCount = 0;

  function waitingIsVisible() {
    return document.getElementById('screen-waiting').classList.contains('active');
  }

  function startWaitingFun() {
    if (!speechTimer) {
      speechTimer = setInterval(() => {
        if (!waitingIsVisible()) return stopWaitingFun();
        const n = lastWaitingState ? lastWaitingState.playerCount : 0;
        const lines = [
          'Esperando a turma... ⏳',
          n > 1 ? `Já somos ${n}! 🎉` : 'Chama a turma! 📣',
          'Estoure os balões! 🎈',
          'Prepara o dedinho! 👆',
        ];
        speechIndex = (speechIndex + 1) % lines.length;
        document.getElementById('waiting-speech').textContent = lines[speechIndex];
      }, 3500);
    }
    if (!balloonTimer && !reducedMotion()) {
      balloonTimer = setInterval(spawnBalloon, 1300);
      spawnBalloon();
    }
  }

  function stopWaitingFun() {
    clearInterval(speechTimer);
    clearInterval(balloonTimer);
    speechTimer = null;
    balloonTimer = null;
    document.getElementById('balloon-layer').innerHTML = '';
  }

  const BALLOON_COLORS = ['#FF4FA3', '#FFD23F', '#3DDC84', '#2EC4FF', '#FF8A3D', '#8B5CF6'];

  function spawnBalloon() {
    if (!waitingIsVisible()) return stopWaitingFun();
    const layer = document.getElementById('balloon-layer');
    if (layer.children.length >= 7) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'balloon';
    b.tabIndex = -1;
    b.style.setProperty('--x', `${4 + Math.random() * 86}%`);
    b.style.setProperty('--c', BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)]);
    b.style.setProperty('--d', `${7 + Math.random() * 4}s`);
    b.style.setProperty('--sway', `${(Math.random() - 0.5) * 60}px`);
    b.addEventListener('pointerdown', () => {
      if (b.classList.contains('is-popped')) return;
      b.classList.add('is-popped');
      play('pop');
      sparkleAt(b, 10);
      poppedCount++;
      document.querySelector('.balloon-hint').textContent =
        `🎈 Você estourou ${poppedCount} ${poppedCount === 1 ? 'balão' : 'balões'}!`;
      setTimeout(() => b.remove(), 180);
    });
    b.addEventListener('animationend', (ev) => { if (ev.animationName === 'balloonRise') b.remove(); });
    layer.appendChild(b);
  }

  // =====================================================================
  // CARTELA
  // =====================================================================

  // A cartela é redesenhada a cada estado recebido. Para as animações não
  // repetirem a cada sorteio, guardamos qual cartela já foi mostrada e
  // quais casas já estavam marcadas: só a cartela nova "monta" e só a casa
  // recém-marcada ganha o carimbo.
  let shownCardKey = null;
  let shownMarked = new Set();

  // Passa ao CSS o tamanho do texto da casa: a palavra mais longa limita a
  // largura da letra (para nenhuma palavra quebrar no meio) e o número de
  // palavras limita a altura (cada uma pode ir para uma linha).
  function fitCellText(btn, text) {
    const words = text.split(/\s+/).filter(Boolean);
    const longest = Math.max(2, ...words.map((w) => [...w].length));
    btn.style.setProperty('--longest', longest);
    btn.style.setProperty('--words', Math.max(1, words.length));
    if (words.length === 1 && /^\p{Extended_Pictographic}/u.test(text) && [...text].length <= 3) {
      btn.classList.add('is-emoji');
    }
  }

  // Linhas da cartela que valem nesta partida, e quais estão completas ou a
  // uma casa de fechar. Usa só o que a criança já marcou — não revela nada
  // sobre o sorteio.
  function analyzeCard(card, patterns) {
    const size = card.size;
    const lines = [];
    for (let i = 0; i < size; i++) {
      if (patterns.row) lines.push(Array.from({ length: size }, (_, c) => [i, c]));
      if (patterns.column) lines.push(Array.from({ length: size }, (_, r) => [r, i]));
    }
    if (patterns.diagonal) {
      lines.push(Array.from({ length: size }, (_, i) => [i, i]));
      lines.push(Array.from({ length: size }, (_, i) => [i, size - 1 - i]));
    }
    if (patterns.fullCard) lines.push(card.cells.flatMap((row, r) => row.map((_, c) => [r, c])));

    const complete = [];
    const near = [];
    for (const line of lines) {
      const missing = line.filter(([r, c]) => !card.cells[r][c].marked).length;
      if (missing === 0) complete.push(line);
      else if (missing === 1) near.push(line);
    }
    const keys = (list) => new Set(list.flat().map(([r, c]) => `${r}-${c}`));
    return { completeCells: keys(complete), nearCells: keys(near), isNear: near.length > 0 };
  }

  function renderCard(card, { analysis, hasWon }) {
    const grid = document.getElementById('player-card');
    const cardKey = card.cells.flat().map((cell) => cell.value).join('|');
    const isNewCard = cardKey !== shownCardKey;
    const marked = new Set();

    grid.style.gridTemplateColumns = `repeat(${card.size}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${card.size}, 1fr)`;
    grid.classList.toggle('is-entering', isNewCard);
    grid.innerHTML = '';
    card.cells.forEach((row, r) => {
      row.forEach((cell, c) => {
        const key = `${r}-${c}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bingo-cell';
        btn.dataset.col = c % 6;
        btn.style.setProperty('--i', r * card.size + c);
        if (cell.isFree) btn.classList.add('is-free');
        if (cell.marked) {
          marked.add(key);
          btn.classList.add('is-marked');
          if (!isNewCard && !shownMarked.has(key)) btn.classList.add('just-marked');
          if (hasWon && analysis.completeCells.has(key)) btn.classList.add('is-win');
          else if (!hasWon && analysis.nearCells.has(key)) btn.classList.add('is-near');
        }
        const label = document.createElement('span');
        label.className = 'cell-text';
        if (cell.isFree) {
          label.textContent = '⭐';
        } else {
          label.textContent = cell.value;
          fitCellText(btn, String(cell.value));
        }
        btn.appendChild(label);
        btn.setAttribute('aria-label', cell.isFree ? 'Casa livre' : `Casa ${cell.value}${cell.marked ? ', marcada' : ''}`);
        if (!cell.isFree) {
          btn.addEventListener('click', () => handleMarkCell(r, c, btn));
        } else {
          btn.disabled = true;
        }
        grid.appendChild(btn);
      });
    });

    shownCardKey = cardKey;
    shownMarked = marked;
    requestAnimationFrame(() => shrinkOverflowingCells(grid));
    // terminada a montagem, tira a animação de entrada (senão ela se
    // repetiria quando outro efeito, como a tremida, mexe na casa)
    if (isNewCard) {
      clearTimeout(renderCard._enterTimer);
      renderCard._enterTimer = setTimeout(() => grid.classList.remove('is-entering'), 1500);
    }
  }

  // Ajuste final: o CSS estima o tamanho pela quantidade de letras; se
  // alguma casa ainda transbordar (letras largas como M e W), diminui a
  // letra aos poucos até caber.
  function shrinkOverflowingCells(grid) {
    grid.querySelectorAll('.bingo-cell:not(.is-free) .cell-text').forEach((label) => {
      const cell = label.parentElement;
      label.style.fontSize = '';
      const fits = () => label.offsetWidth <= cell.clientWidth - 6 && label.offsetHeight <= cell.clientHeight - 6;
      let size = parseFloat(getComputedStyle(label).fontSize);
      for (let i = 0; i < 10 && !fits() && size > 8; i++) {
        size *= 0.9;
        label.style.fontSize = `${size}px`;
      }
    });
  }

  async function handleMarkCell(row, col, btn) {
    // casa marcada fica travada: nada a fazer
    if (btn.classList.contains('is-marked')) return;
    // posição guardada antes: a cartela pode ser redesenhada antes da resposta
    const rect = btn.getBoundingClientRect();
    try {
      await emitAsync('mark_cell', {
        roomCode: session().roomCode,
        playerToken: session().playerToken,
        row, col,
      });
      play('boing');
      sparkle(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } catch (e) {
      if (e.code === 'ITEM_NAO_SORTEADO') {
        play('bonk');
        shake(btn);
        toast('Esse ainda não saiu! 👀', 'error', 1800);
        return;
      }
      if (e.code === 'ESTADO_INVALIDO') {
        toast('Espere o jogo voltar! 😴', 'info', 2000);
        return;
      }
      toast(e.message || 'Não foi possível marcar essa casa.', 'error');
    }
  }

  // =====================================================================
  // BOLAS, HISTÓRICO E FAIXAS
  // =====================================================================

  function renderBalls(drawnItems) {
    const lastEl = document.getElementById('player-last-drawn');
    const lastValue = drawnItems.length ? drawnItems[drawnItems.length - 1] : '?';
    if (lastEl.textContent !== String(lastValue)) {
      lastEl.textContent = lastValue;
      // (a tela já está visível aqui, então a bola pode ser medida)
      fitText(lastEl, lastValue, { area: 0.66, max: lastEl.clientWidth * 0.42 });
      lastEl.classList.remove('pop');
      void lastEl.offsetWidth;
      lastEl.classList.add('pop');
    }

    // as 4 bolas anteriores à última, da mais nova para a mais velha
    const recent = document.getElementById('player-recent');
    recent.innerHTML = '';
    drawnItems.slice(-5, -1).reverse().forEach((item) => {
      const chip = document.createElement('span');
      chip.className = 'chip chip-recent';
      chip.textContent = item;
      recent.appendChild(chip);
    });
  }

  function renderHistory(drawnItems) {
    const wrap = document.getElementById('player-history');
    document.getElementById('player-history-count').textContent = drawnItems.length;
    wrap.innerHTML = '';
    if (!drawnItems.length) {
      wrap.innerHTML = '<span class="muted">Nenhum sorteio ainda.</span>';
      return;
    }
    drawnItems.slice().reverse().forEach((item, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip' + (i === 0 ? ' chip-latest' : '');
      chip.textContent = item;
      wrap.appendChild(chip);
    });
  }

  // Faixa de aviso: uma mensagem "fixa" (fim de jogo, você venceu) e
  // mensagens temporárias (alguém fez bingo) que, ao sumir, devolvem a fixa.
  let persistentBanner = '';

  function setPersistentBanner(text) {
    persistentBanner = text;
    if (!showBanner._t) applyBanner(text);
  }

  function applyBanner(text) {
    const banner = document.getElementById('player-banner');
    banner.textContent = text;
    banner.hidden = !text;
  }

  function showBanner(text) {
    applyBanner(text);
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => {
      showBanner._t = null;
      applyBanner(persistentBanner);
    }, 5000);
  }

  let wasNear = false;

  function renderNearWin(isNear) {
    const strip = document.getElementById('near-win-strip');
    strip.hidden = !isNear;
    if (isNear && !wasNear) {
      play('drum');
      strip.classList.remove('anim-pop-in');
      void strip.offsetWidth;
      strip.classList.add('anim-pop-in');
    }
    wasNear = isNear;
  }

  // =====================================================================
  // RENDER PRINCIPAL
  // =====================================================================

  function render(state) {
    if (state.you && state.you.avatar && state.you.avatar !== session().playerAvatar) {
      session().playerAvatar = state.you.avatar;
      window.BingoApp.saveSession();
    }

    if (state.status === 'waiting') {
      renderWaiting(state);
      showScreen('screen-waiting');
      return;
    }

    stopWaitingFun();
    showScreen('screen-player');

    const you = state.you;
    document.getElementById('player-avatar').textContent = you.avatar || '🙂';
    document.getElementById('player-name-badge').textContent = you.name;
    document.getElementById('player-trophy').hidden = !you.hasWon;
    document.getElementById('player-progress').textContent = `${you.markedCount}/${you.totalCells}`;
    const statusBadge = document.getElementById('player-status-badge');
    statusBadge.textContent = statusLabel(state.status);
    statusBadge.dataset.status = statusLabel(state.status);

    renderBalls(state.drawnItems);
    renderHistory(state.drawnItems);

    let isNear = false;
    if (state.card) {
      const analysis = analyzeCard(state.card, state.config.winPatterns);
      isNear = analysis.isNear && !you.hasWon && state.status === 'playing';
      renderCard(state.card, { analysis, hasWon: you.hasWon });
    } else {
      shownCardKey = null;
      document.getElementById('player-card').innerHTML =
        '<p class="card-wait">Você entrou no meio da rodada 😉<br>Sua cartela chega na próxima partida!</p>';
    }
    renderNearWin(isNear);

    // quem acabou de vencer continua vendo a própria linha dourada na pausa
    document.getElementById('pause-cover').hidden = state.status !== 'paused' || you.hasWon;

    if (state.status === 'ended') setPersistentBanner('🌙 O jogo acabou! Valeu por jogar 💜');
    else if (you.hasWon) setPersistentBanner('🏆 Você fez BINGO nesta rodada! 🎉');
    else setPersistentBanner('');
  }

  // a casa muda de tamanho ao girar o tablet ou redimensionar a janela
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => shrinkOverflowingCells(document.getElementById('player-card')), 150);
  });

  // =====================================================================
  // EVENTOS
  // =====================================================================

  socket.on('player_state', (state) => {
    if (!isPlayer()) return;
    render(state);
  });

  socket.on('room_summary', (summary) => {
    if (!isPlayer()) return;
    if (summary.status === 'waiting') renderWaiting(summary);
  });

  socket.on('draw_result', ({ value }) => {
    if (!isPlayer()) return;
    if (!document.getElementById('screen-player').classList.contains('active')) return;
    Overlays.drawBall(value);
    play('ding');
  });

  socket.on('win_announced', ({ playerName, playerId, avatar }) => {
    if (!isPlayer()) return;
    if (playerId === session().playerId) {
      play('fanfare');
      confetti({ amount: 240 });
      Overlays.bingo({ text: 'Você fez BINGO! 🏆' });
    } else {
      play('tada');
      confetti({ amount: 70 });
      showBanner(`🎊 ${avatar || ''} ${playerName} fez BINGO!`);
    }
  });

  function startCountdown() {
    if (!isPlayer()) return;
    Overlays.closeBingo();
    clearTimeout(showBanner._t);
    showBanner._t = null;
    applyBanner('');
    wasNear = false;
    Overlays.countdown();
  }
  socket.on('game_started', startCountdown);
  socket.on('new_match_started', startCountdown);

  socket.on('you_were_kicked', () => {
    if (!isPlayer()) return;
    toast('Você foi removido da sala pelo(a) professor(a).', 'error', 6000);
    window.BingoApp.resetSession();
    stopWaitingFun();
    window.PlataformaAuth.goHome();
  });

  window.BingoPlayer = { render, renderWaiting };
})();
