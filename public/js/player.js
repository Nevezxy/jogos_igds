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

  function cellLabel(cell) {
    if (cell.isFree) return 'GRÁTIS';
    return cell.value;
  }

  function renderCard(card, drawnSet) {
    const grid = document.getElementById('player-card');
    grid.style.gridTemplateColumns = `repeat(${card.size}, 1fr)`;
    grid.innerHTML = '';
    card.cells.forEach((row, r) => {
      row.forEach((cell, c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bingo-cell';
        if (cell.isFree) btn.classList.add('is-free');
        if (cell.marked) btn.classList.add('is-marked');
        if (!cell.isFree && drawnSet.has(cell.value) && !cell.marked) btn.classList.add('is-drawn');
        btn.textContent = cellLabel(cell);
        btn.setAttribute('aria-label', cell.isFree ? 'Casa livre' : `Casa ${cell.value}`);
        if (!cell.isFree) {
          btn.addEventListener('click', () => handleMarkCell(r, c));
        } else {
          btn.disabled = true;
        }
        grid.appendChild(btn);
      });
    });
  }

  async function handleMarkCell(row, col) {
    try {
      await emitAsync('mark_cell', {
        roomCode: window.BingoApp.session.roomCode,
        playerToken: window.BingoApp.session.playerToken,
        row, col,
      });
    } catch (e) {
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

  function showBanner(text) {
    const banner = document.getElementById('player-banner');
    banner.textContent = text;
    banner.hidden = false;
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => { banner.hidden = true; }, 5000);
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

    const drawnSet = new Set(state.drawnItems);
    document.getElementById('player-last-drawn').textContent = state.lastDrawn ?? '—';

    if (state.card) {
      renderCard(state.card, drawnSet);
    } else {
      document.getElementById('player-card').innerHTML =
        '<p class="muted" style="grid-column:1/-1;padding:20px;">Aguardando a próxima rodada começar...</p>';
    }
    renderHistory(state.drawnItems);

    if (state.drawnItems.length > lastKnownDrawCount) {
      lastKnownDrawCount = state.drawnItems.length;
    }

    if (state.you.hasWon) {
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

  socket.on('you_were_kicked', () => {
    if (window.BingoApp.session.role !== 'player') return;
    toast('Você foi removido da sala pelo Mestre.', 'error', 6000);
    window.BingoApp.resetSession();
    showScreen('screen-home');
  });

  window.BingoPlayer = { render, renderWaiting };
})();
