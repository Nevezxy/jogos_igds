// public/js/player.js
// Tudo relacionado à experiência do educando: tela de espera e tela de
// jogo (cartela + histórico). O servidor é a única fonte de verdade —
// este arquivo só desenha o que chega em `player_state` / `room_summary`
// e envia a intenção de marcar uma casa, nunca decide sozinho se venceu.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast, statusLabel } = window.BingoUI;

  let lastKnownDrawCount = 0;

  function renderWaiting(state) {
    document.getElementById('waiting-room-name').textContent = state.name || `Sala ${state.code}`;
    document.getElementById('waiting-room-code').textContent = state.code;
    document.getElementById('waiting-player-name').textContent = window.BingoApp.session.playerName || '';
    document.getElementById('waiting-count').textContent = state.playerCount ?? 0;
    document.getElementById('waiting-status').textContent = statusLabel(state.status);
  }

  // A cartela é redesenhada a cada estado recebido. Para as animações não
  // repetirem a cada sorteio, guardamos qual cartela já foi mostrada e
  // quais casas já estavam marcadas: só a cartela nova "monta" e só a casa
  // recém-marcada ganha o carimbo.
  let shownCardKey = null;
  let shownMarked = new Set();

  function renderCard(card) {
    const grid = document.getElementById('player-card');
    const cardKey = card.cells.flat().map((cell) => cell.value).join('|');
    const isNewCard = cardKey !== shownCardKey;
    const marked = new Set();

    grid.style.gridTemplateColumns = `repeat(${card.size}, 1fr)`;
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
        }
        if (cell.isFree) {
          btn.innerHTML = '<span>⭐</span>';
        } else {
          btn.textContent = cell.value;
        }
        btn.setAttribute('aria-label', cell.isFree ? 'Casa livre' : `Casa ${cell.value}${cell.marked ? ', marcada' : ''}`);
        if (!cell.isFree) {
          btn.addEventListener('click', () => handleMarkCell(r, c));
        } else {
          btn.disabled = true;
        }
        grid.appendChild(btn);
      });
    });

    shownCardKey = cardKey;
    shownMarked = marked;
  }

  async function handleMarkCell(row, col) {
    try {
      await emitAsync('mark_cell', {
        roomCode: window.BingoApp.session.roomCode,
        playerToken: window.BingoApp.session.playerToken,
        row, col,
      });
    } catch (e) {
      if (e.code === 'ITEM_NAO_SORTEADO') {
        toast('Esse ainda não saiu! 👀', 'error', 1800);
        return;
      }
      toast(e.message || 'Não foi possível marcar essa casa.', 'error');
    }
  }

  function renderHistory(drawnItems) {
    const wrap = document.getElementById('player-history');
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

  function showBanner(text, keep = false) {
    const banner = document.getElementById('player-banner');
    banner.textContent = text;
    banner.hidden = false;
    clearTimeout(showBanner._t);
    if (!keep) showBanner._t = setTimeout(() => { banner.hidden = true; }, 5000);
  }

  function render(state) {
    if (state.status === 'waiting') {
      renderWaiting(state);
      showScreen('screen-waiting');
      return;
    }

    showScreen('screen-player');
    document.getElementById('player-room-badge').textContent = `Sala ${state.code}`;
    const statusBadge = document.getElementById('player-status-badge');
    statusBadge.textContent = statusLabel(state.status);
    statusBadge.dataset.status = statusLabel(state.status);
    document.getElementById('player-name-badge').textContent = state.you.name;

    const lastEl = document.getElementById('player-last-drawn');
    const lastValue = state.lastDrawn ?? '?';
    if (lastEl.textContent !== String(lastValue)) {
      lastEl.textContent = lastValue;
      lastEl.classList.remove('pop');
      void lastEl.offsetWidth;
      lastEl.classList.add('pop');
    }

    if (state.card) {
      renderCard(state.card);
    } else {
      document.getElementById('player-card').innerHTML =
        '<p class="muted" style="grid-column:1/-1;padding:20px;">Aguardando a próxima rodada começar...</p>';
    }
    renderHistory(state.drawnItems);

    if (state.drawnItems.length > lastKnownDrawCount) {
      lastKnownDrawCount = state.drawnItems.length;
    }

    if (state.status === 'ended') {
      showBanner('🌙 O jogo acabou! Valeu por jogar 💜', true);
    } else if (state.you.hasWon) {
      showBanner('🏆 BINGO! Você venceu esta rodada!');
    } else if (state.status === 'paused') {
      showBanner('⏸ A partida está pausada pelo Mestre.');
    }
  }

  // ------------- eventos globais -------------

  socket.on('player_state', (state) => {
    if (window.BingoApp.session.role !== 'player') return;
    render(state);
  });

  socket.on('room_summary', (summary) => {
    if (window.BingoApp.session.role !== 'player') return;
    if (summary.status === 'waiting') renderWaiting(summary);
  });

  socket.on('draw_result', ({ value }) => {
    if (window.BingoApp.session.role !== 'player') return;
    toast(`Saiu: ${value}`, 'info', 2600);
  });

  socket.on('win_announced', ({ playerName }) => {
    if (window.BingoApp.session.role !== 'player') return;
    if (playerName !== window.BingoApp.session.playerName) {
      showBanner(`🎊 ${playerName} fez Bingo!`);
    }
  });

  socket.on('new_match_started', () => {
    if (window.BingoApp.session.role !== 'player') return;
    clearTimeout(showBanner._t);
    document.getElementById('player-banner').hidden = true;
  });

  socket.on('you_were_kicked', () => {
    if (window.BingoApp.session.role !== 'player') return;
    toast('Você foi removido da sala pelo Mestre.', 'error', 6000);
    window.BingoApp.resetSession();
    showScreen('screen-home');
  });

  window.BingoPlayer = { render, renderWaiting };
})();
