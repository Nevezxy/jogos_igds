// public/js/player.js
// Tudo relacionado à experiência do educando: tela de espera e tela de
// jogo (cartela + histórico). O servidor é a única fonte de verdade —
// este arquivo só desenha o que chega em `player_state` / `room_summary`
// e envia a intenção de marcar uma casa, nunca decide sozinho se venceu.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast, statusLabel, fitText } = window.BingoUI;
  const { play } = window.BingoSound;
  const { confetti, sparkle, shake } = window.BingoFx;

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

  function renderCard(card) {
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
    const wasMarked = btn.classList.contains('is-marked');
    // posição guardada antes: a cartela pode ser redesenhada antes da resposta
    const rect = btn.getBoundingClientRect();
    try {
      await emitAsync('mark_cell', {
        roomCode: window.BingoApp.session.roomCode,
        playerToken: window.BingoApp.session.playerToken,
        row, col,
      });
      if (wasMarked) {
        play('pop');
      } else {
        play('boing');
        sparkle(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    } catch (e) {
      if (e.code === 'ITEM_NAO_SORTEADO') {
        play('bonk');
        shake(btn);
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
      // (a tela já está visível aqui, então a bola pode ser medida)
      fitText(lastEl, lastValue, { area: 0.66, max: lastEl.clientWidth * 0.42 });
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
      showBanner('⏸ O(a) professor(a) pausou o jogo. Já volta!');
    }
  }

  // a casa muda de tamanho ao girar o tablet ou redimensionar a janela
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => shrinkOverflowingCells(document.getElementById('player-card')), 150);
  });

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
    play('ding');
  });

  socket.on('win_announced', ({ playerName }) => {
    if (window.BingoApp.session.role !== 'player') return;
    if (playerName === window.BingoApp.session.playerName) {
      play('fanfare');
      confetti({ amount: 220 });
    } else {
      play('tada');
      confetti({ amount: 70 });
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
