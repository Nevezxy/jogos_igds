// public/js/master.js
// Painel do Mestre da Sala: configuração antes do início, sorteio,
// controles de partida e gestão de participantes. Toda ação chama o
// servidor via socket e só atualiza a tela quando a resposta chega —
// o servidor decide o que é permitido em cada estado.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast, confirmModal, statusLabel, escapeHtml } = window.BingoUI;

  let currentState = null;

  function session() { return window.BingoApp.session; }

  // ---------------- helpers de config ----------------

  function bingoTypeFields() {
    document.querySelectorAll('.config-subfields').forEach((el) => (el.hidden = true));
    const type = document.getElementById('cfg-bingo-type').value;
    const map = {
      numbers: 'cfg-numbers-fields',
      words: 'cfg-words-fields',
      emojis: 'cfg-emojis-fields',
      custom: 'cfg-custom-fields',
    };
    const id = map[type];
    if (id) document.getElementById(id).hidden = false;
  }

  // Palavras e itens personalizados: um por linha ou separados por vírgula.
  // Emojis: também aceitam espaço como separador.
  function parseListField(raw, { splitSpaces = false } = {}) {
    return raw
      .split(splitSpaces ? /[\n,\s]+/ : /[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // ---------------- pacotes prontos ----------------

  function isEmojiField(textarea) { return textarea.id === 'cfg-emojis'; }

  function listFor(textarea) {
    return parseListField(textarea.value, { splitSpaces: isEmojiField(textarea) });
  }

  function writeList(textarea, items) {
    textarea.value = items.join(isEmojiField(textarea) ? ' ' : '\n');
  }

  function packsOf(picker) {
    return (window.BingoPacks && window.BingoPacks[picker.dataset.packType]) || [];
  }

  function minItemsNeeded() {
    const size = Number(document.getElementById('cfg-grid-size').value);
    const free = document.getElementById('cfg-free-space').checked && size % 2 === 1;
    return size * size - (free ? 1 : 0);
  }

  // Um pacote aparece marcado quando todos os itens dele estão na lista;
  // assim os chips acompanham edições feitas à mão no campo de texto.
  function refreshPackUi(picker) {
    const textarea = document.getElementById(picker.dataset.target);
    const current = new Set(listFor(textarea));
    picker.querySelectorAll('input[data-pack]').forEach((input) => {
      const pack = packsOf(picker).find((p) => p.id === input.dataset.pack);
      input.checked = !!pack && pack.items.every((item) => current.has(item));
    });

    const countEl = document.querySelector(`[data-count-for="${textarea.id}"]`);
    const need = minItemsNeeded();
    const usesDefault = isEmojiField(textarea) && current.size === 0;
    const low = !usesDefault && current.size < need;
    countEl.textContent = usesDefault
      ? 'Lista vazia: será usado o pacote padrão de emojis.'
      : `${current.size} itens na lista${low ? ` · a cartela precisa de pelo menos ${need}` : ' ✅'}`;
    countEl.classList.toggle('is-low', low);
  }

  function refreshAllPackUis() {
    document.querySelectorAll('.pack-picker').forEach(refreshPackUi);
  }

  function togglePack(picker, pack, on) {
    const textarea = document.getElementById(picker.dataset.target);
    let items = listFor(textarea);
    if (on) {
      const present = new Set(items);
      pack.items.forEach((item) => { if (!present.has(item)) { items.push(item); present.add(item); } });
    } else {
      // itens que também estão em outro pacote marcado continuam na lista
      const keep = new Set();
      picker.querySelectorAll('input[data-pack]:checked').forEach((input) => {
        const other = packsOf(picker).find((p) => p.id === input.dataset.pack);
        if (other && other.id !== pack.id) other.items.forEach((item) => keep.add(item));
      });
      const remove = new Set(pack.items.filter((item) => !keep.has(item)));
      items = items.filter((item) => !remove.has(item));
    }
    writeList(textarea, items);
    refreshPackUi(picker);
  }

  function buildPackPickers() {
    document.querySelectorAll('.pack-picker').forEach((picker) => {
      picker.innerHTML = '';
      packsOf(picker).forEach((pack) => {
        const label = document.createElement('label');
        label.className = 'pack-chip';
        label.innerHTML = `<input type="checkbox" data-pack="${pack.id}"><span>${pack.icon} ${pack.label} <small>${pack.items.length}</small></span>`;
        label.querySelector('input').addEventListener('change', (ev) => togglePack(picker, pack, ev.target.checked));
        picker.appendChild(label);
      });
      document.getElementById(picker.dataset.target).addEventListener('input', () => refreshPackUi(picker));
    });
  }

  // Ao trocar para um modo com a lista vazia, já deixa o primeiro pacote
  // marcado, para a partida funcionar de primeira.
  function preselectFirstPack() {
    const type = document.getElementById('cfg-bingo-type').value;
    const picker = document.querySelector(`.pack-picker[data-pack-type="${type}"]`);
    if (!picker) return;
    const textarea = document.getElementById(picker.dataset.target);
    const first = packsOf(picker)[0];
    if (first && listFor(textarea).length === 0) togglePack(picker, first, true);
  }

  function readConfigFromForm() {
    const type = document.getElementById('cfg-bingo-type').value;
    const config = {
      gridSize: Number(document.getElementById('cfg-grid-size').value),
      freeSpace: document.getElementById('cfg-free-space').checked,
      bingoType: type,
      minNumber: Number(document.getElementById('cfg-min-number').value) || 1,
      maxNumber: Number(document.getElementById('cfg-max-number').value) || 75,
      words: parseListField(document.getElementById('cfg-words').value),
      emojis: parseListField(document.getElementById('cfg-emojis').value, { splitSpaces: true }),
      items: parseListField(document.getElementById('cfg-items').value),
      winPatterns: {
        row: document.getElementById('cfg-win-row').checked,
        column: document.getElementById('cfg-win-col').checked,
        diagonal: document.getElementById('cfg-win-diag').checked,
        fullCard: document.getElementById('cfg-win-full').checked,
      },
      autoPauseOnWin: document.getElementById('cfg-autopause').checked,
    };
    return config;
  }

  function fillFormFromConfig(config) {
    document.getElementById('cfg-grid-size').value = config.gridSize;
    document.getElementById('cfg-free-space').checked = config.freeSpace;
    document.getElementById('cfg-bingo-type').value = config.bingoType;
    document.getElementById('cfg-min-number').value = config.minNumber;
    document.getElementById('cfg-max-number').value = config.maxNumber;
    document.getElementById('cfg-words').value = (config.words || []).join('\n');
    document.getElementById('cfg-emojis').value = (config.emojis || []).join(' ');
    document.getElementById('cfg-items').value = (config.items || []).join('\n');
    document.getElementById('cfg-win-row').checked = !!config.winPatterns.row;
    document.getElementById('cfg-win-col').checked = !!config.winPatterns.column;
    document.getElementById('cfg-win-diag').checked = !!config.winPatterns.diagonal;
    document.getElementById('cfg-win-full').checked = !!config.winPatterns.fullCard;
    document.getElementById('cfg-autopause').checked = !!config.autoPauseOnWin;
    bingoTypeFields();
    refreshAllPackUis();
  }

  // ---------------- render principal ----------------

  function render(state) {
    currentState = state;
    showScreen('screen-master');

    document.getElementById('master-room-code').textContent = state.code;
    const statusBadge = document.getElementById('master-status-badge');
    statusBadge.textContent = statusLabel(state.status);
    statusBadge.dataset.status = statusLabel(state.status);
    document.getElementById('master-player-count').textContent =
      `${state.connectedCount}/${state.playerCount} conectados`;

    const isWaiting = state.status === 'waiting';
    // Durante a partida a configuração some, deixando o sorteio no topo
    document.getElementById('master-config').hidden = !isWaiting;
    document.querySelectorAll('#master-config input, #master-config select, #master-config textarea')
      .forEach((el) => { el.disabled = !isWaiting; });
    document.getElementById('btn-save-config').disabled = !isWaiting;
    document.getElementById('btn-start-game').hidden = !isWaiting;

    document.getElementById('master-draw').hidden = isWaiting;
    document.getElementById('master-winners').hidden = state.players.every((p) => !p.hasWon);

    if (!isWaiting) fillFormFromConfig(state.config);

    // Botão sortear
    const btnDraw = document.getElementById('btn-draw');
    btnDraw.disabled = state.status !== 'playing' || state.remainingCount === 0;
    document.getElementById('draw-remaining').textContent =
      state.poolSize ? `${state.remainingCount} de ${state.poolSize} itens restantes` : '';
    document.getElementById('draw-result-value').textContent = state.lastDrawn ?? '🎲';

    renderHistory(state.drawnItems);
    renderParticipants(state.players);
    renderWinners(state.players);

    // Controles de partida
    document.getElementById('btn-pause').hidden = state.status !== 'playing';
    document.getElementById('btn-resume').hidden = state.status !== 'paused';
    // Nova partida e Mudar regras só fazem sentido com uma rodada em andamento;
    // na sala encerrada nada disso funciona mais, então tudo some.
    const inMatch = state.status === 'playing' || state.status === 'paused';
    const isEnded = state.status === 'ended';
    document.getElementById('btn-new-match').hidden = !inMatch;
    document.getElementById('btn-new-match-win').hidden = !inMatch;
    document.getElementById('btn-restart').hidden = !inMatch;
    document.getElementById('btn-end').hidden = isEnded;
    document.getElementById('master-ended').hidden = !isEnded;
    document.getElementById('btn-undo-draw').hidden = isEnded;
    document.getElementById('btn-toggle-lock').hidden = isEnded;

    const lockBtn = document.getElementById('btn-toggle-lock');
    lockBtn.textContent = state.locked ? '🔒 sala bloqueada' : '🔓 sala aberta';
  }

  function renderHistory(drawnItems) {
    const wrap = document.getElementById('master-history');
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

  function renderParticipants(players) {
    const list = document.getElementById('participants-list');
    list.innerHTML = '';
    if (!players.length) {
      list.innerHTML = '<li class="muted">Nenhum participante ainda.</li>';
      return;
    }
    players.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'participant-row';
      li.innerHTML = `
        <div class="participant-info">
          <span class="participant-dot ${p.connected ? 'online' : ''}"></span>
          <span class="participant-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
          ${p.hasWon ? '<span class="participant-badge">🏆 Bingo</span>' : ''}
        </div>
        <div class="participant-actions">
          <button type="button" title="Expulsar" data-kick="${p.id}">🚫</button>
        </div>
      `;
      list.appendChild(li);
    });
    list.querySelectorAll('[data-kick]').forEach((btn) => {
      btn.addEventListener('click', () => handleKick(btn.dataset.kick, btn.closest('li').querySelector('.participant-name').textContent));
    });
  }

  function renderWinners(players) {
    const box = document.getElementById('master-winners-list');
    const winners = players.filter((p) => p.hasWon);
    box.innerHTML = '';
    winners.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'winner-row';
      row.textContent = `🏆 ${p.name}`;
      box.appendChild(row);
    });
  }

  // ---------------- ações ----------------

  async function handleSaveConfig() {
    document.getElementById('config-error').textContent = '';
    try {
      const config = readConfigFromForm();
      const res = await emitAsync('update_config', {
        roomCode: session().roomCode, masterToken: session().masterToken, config,
      });
      render(res.state);
      toast('Configurações salvas.', 'success', 2200);
    } catch (e) {
      document.getElementById('config-error').textContent = e.message || 'Erro ao salvar configurações.';
    }
  }

  async function handleStartGame() {
    await handleSaveConfig();
    document.getElementById('config-error').textContent = '';
    try {
      const res = await emitAsync('start_game', { roomCode: session().roomCode, masterToken: session().masterToken });
      render(res.state);
      toast('Partida iniciada! Cartelas distribuídas. 🎉', 'success');
    } catch (e) {
      document.getElementById('config-error').textContent = e.message || 'Erro ao iniciar partida.';
      toast(e.message || 'Erro ao iniciar partida.', 'error');
    }
  }

  async function handleDraw() {
    document.getElementById('draw-error').textContent = '';
    try {
      const res = await emitAsync('draw_item', { roomCode: session().roomCode, masterToken: session().masterToken });
      const display = document.getElementById('draw-result-display');
      display.classList.remove('pop');
      void display.offsetWidth;
      display.classList.add('pop');
      document.getElementById('draw-result-value').textContent = res.value;
    } catch (e) {
      document.getElementById('draw-error').textContent = e.message || 'Erro ao sortear.';
    }
  }

  async function handleUndoDraw() {
    try {
      await emitAsync('undo_draw', { roomCode: session().roomCode, masterToken: session().masterToken });
      toast('Último sorteio desfeito.', 'info');
    } catch (e) {
      toast(e.message || 'Não foi possível desfazer.', 'error');
    }
  }

  async function handlePause() {
    try { await emitAsync('pause_game', { roomCode: session().roomCode, masterToken: session().masterToken }); }
    catch (e) { toast(e.message, 'error'); }
  }
  async function handleResume() {
    try { await emitAsync('resume_game', { roomCode: session().roomCode, masterToken: session().masterToken }); }
    catch (e) { toast(e.message, 'error'); }
  }
  // Nova rodada na hora, mesmas regras, mesma turma, cartelas novas.
  async function handleNewMatch() {
    const st = currentState;
    const someoneWon = st && st.players.some((p) => p.hasWon);
    if (st && st.drawnItems.length && !someoneWon) {
      const ok = await confirmModal(
        'Começar nova partida?',
        'Ninguém fez Bingo ainda. A rodada atual termina e todos recebem uma cartela nova.',
        'Nova partida'
      );
      if (!ok) return;
    }
    try {
      const res = await emitAsync('new_match', { roomCode: session().roomCode, masterToken: session().masterToken });
      render(res.state);
      toast('Nova partida! Cartelas novas para todo mundo 🎉', 'success');
    } catch (e) { toast(e.message || 'Não foi possível começar outra partida.', 'error'); }
  }

  async function handleRestart() {
    const ok = await confirmModal(
      'Mudar as regras?',
      'A rodada atual termina e você volta para a configuração. Os participantes continuam na sala esperando a próxima partida.',
      'Mudar regras'
    );
    if (!ok) return;
    try {
      await emitAsync('restart_game', { roomCode: session().roomCode, masterToken: session().masterToken });
      toast('Ajuste as regras e inicie a partida.', 'info');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function handleEnd() {
    const ok = await confirmModal(
      'Encerrar a sala de vez?',
      'Ninguém mais vai poder jogar nesta sala, nem você. Para jogar outra rodada com a mesma turma, use "🎉 Nova partida". Para trocar as regras, use "⚙️ Mudar regras".',
      'Encerrar de vez'
    );
    if (!ok) return;
    try { await emitAsync('end_game', { roomCode: session().roomCode, masterToken: session().masterToken }); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function handleKick(playerId, name) {
    const ok = await confirmModal('Remover participante?', `${name} será removido(a) da sala imediatamente.`, 'Remover');
    if (!ok) return;
    try {
      await emitAsync('kick_player', { roomCode: session().roomCode, masterToken: session().masterToken, playerId });
      toast(`${name} foi removido(a).`, 'info');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleToggleLock() {
    const locked = !(currentState && currentState.locked);
    try {
      await emitAsync('lock_room', { roomCode: session().roomCode, masterToken: session().masterToken, locked });
    } catch (e) { toast(e.message, 'error'); }
  }

  function copyRoomCode() {
    const code = session().roomCode;
    navigator.clipboard?.writeText(code).then(
      () => toast(`Código ${code} copiado!`, 'success', 2000),
      () => toast(`Código da sala: ${code}`, 'info')
    );
  }

  // ---------------- wiring ----------------

  function init() {
    buildPackPickers();
    document.getElementById('cfg-bingo-type').addEventListener('change', () => {
      bingoTypeFields();
      preselectFirstPack();
    });
    document.getElementById('cfg-grid-size').addEventListener('change', refreshAllPackUis);
    document.getElementById('cfg-free-space').addEventListener('change', refreshAllPackUis);
    document.getElementById('btn-save-config').addEventListener('click', handleSaveConfig);
    document.getElementById('btn-start-game').addEventListener('click', handleStartGame);
    document.getElementById('btn-draw').addEventListener('click', handleDraw);
    document.getElementById('btn-undo-draw').addEventListener('click', handleUndoDraw);
    document.getElementById('btn-pause').addEventListener('click', handlePause);
    document.getElementById('btn-resume').addEventListener('click', handleResume);
    document.getElementById('btn-new-match').addEventListener('click', handleNewMatch);
    document.getElementById('btn-new-match-win').addEventListener('click', handleNewMatch);
    document.getElementById('btn-restart').addEventListener('click', handleRestart);
    document.getElementById('btn-end').addEventListener('click', handleEnd);
    document.getElementById('btn-new-room').addEventListener('click', () => {
      window.BingoApp.resetSession();
      showScreen('screen-create');
    });
    document.getElementById('btn-toggle-lock').addEventListener('click', handleToggleLock);
    document.getElementById('btn-copy-code').addEventListener('click', copyRoomCode);
    bingoTypeFields();
    refreshAllPackUis();
  }

  socket.on('master_state', (state) => {
    if (window.BingoApp.session.role !== 'master') return;
    render(state);
  });

  socket.on('win_announced', ({ playerName, patterns }) => {
    if (window.BingoApp.session.role !== 'master') return;
    toast(`🏆 ${playerName} fez Bingo! (${patterns.join(', ')})`, 'success', 6000);
  });

  window.BingoMaster = { init, render };
})();
