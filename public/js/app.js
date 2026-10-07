// public/js/app.js
// Orquestra a aplicação: guarda a sessão do usuário (papel, sala, tokens),
// tenta reconectar automaticamente quando a página é recarregada ou a
// conexão cai, e liga os formulários da tela inicial (entrar / criar).

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast } = window.BingoUI;

  const STORAGE_KEY = 'bingo_virtual_session_v1';

  const session = {
    role: 'none', // 'none' | 'master' | 'player'
    roomCode: null,
    masterToken: null,
    playerToken: null,
    playerId: null,
    playerName: null,
  };

  function saveSession() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function clearStoredSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function resetSession() {
    session.role = 'none';
    session.roomCode = null;
    session.masterToken = null;
    session.playerToken = null;
    session.playerId = null;
    session.playerName = null;
    clearStoredSession();
  }

  function setMasterSession(roomCode, masterToken) {
    session.role = 'master';
    session.roomCode = roomCode;
    session.masterToken = masterToken;
    session.playerToken = null;
    session.playerId = null;
    session.playerName = null;
    saveSession();
  }

  function setPlayerSession(roomCode, playerId, playerToken, playerName) {
    session.role = 'player';
    session.roomCode = roomCode;
    session.masterToken = null;
    session.playerId = playerId;
    session.playerToken = playerToken;
    session.playerName = playerName;
    saveSession();
  }

  // ---------------- home / navegação simples ----------------

  document.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.dataset.go));
  });

  // ---------------- entrar em uma sala ----------------

  document.getElementById('form-join').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const errorEl = document.getElementById('join-error');
    errorEl.textContent = '';
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    const name = document.getElementById('input-player-name').value.trim();
    const submitBtn = ev.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await emitAsync('join_room', { roomCode: code, name });
      setPlayerSession(code, res.playerId, res.playerToken, name);
      window.BingoPlayer.render(res.state);
    } catch (e) {
      errorEl.textContent = e.message || 'Não foi possível entrar na sala.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---------------- criar uma sala ----------------

  document.getElementById('form-create').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const errorEl = document.getElementById('create-error');
    errorEl.textContent = '';
    const name = document.getElementById('input-room-name').value.trim();
    const submitBtn = ev.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await emitAsync('create_room', { name });
      setMasterSession(res.roomCode, res.masterToken);
      window.BingoMaster.render(res.state);
      toast(`Sala criada! Código: ${res.roomCode}`, 'success', 5000);
    } catch (e) {
      errorEl.textContent = e.message || 'Não foi possível criar a sala.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---------------- reconexão automática ----------------

  async function tryResume() {
    const saved = loadSession();
    // Sem sessão salva: fica na tela atual (a criança pode estar no meio
    // da digitação do código quando a conexão volta).
    if (!saved || saved.role === 'none' || !saved.roomCode) return;

    if (saved.role === 'master' && saved.masterToken) {
      try {
        const res = await emitAsync('master_reconnect', { roomCode: saved.roomCode, masterToken: saved.masterToken });
        Object.assign(session, saved);
        window.BingoMaster.render(res.state);
        toast('Painel do Mestre reconectado.', 'success', 2500);
        return;
      } catch (e) {
        clearStoredSession();
        showScreen('screen-home');
        return;
      }
    }

    if (saved.role === 'player' && saved.playerToken) {
      try {
        const res = await emitAsync('join_room', {
          roomCode: saved.roomCode, name: saved.playerName, playerToken: saved.playerToken,
        });
        Object.assign(session, saved);
        session.playerId = res.playerId;
        session.playerToken = res.playerToken;
        saveSession();
        window.BingoPlayer.render(res.state);
        toast('Você foi reconectado(a) à sala.', 'success', 2500);
        return;
      } catch (e) {
        clearStoredSession();
        showScreen('screen-home');
        return;
      }
    }

    showScreen('screen-home');
  }

  socket.on('connect', () => {
    tryResume();
  });
  // A conexão pode abrir antes deste script terminar de carregar; nesse
  // caso o evento 'connect' já passou e a retomada precisa rodar agora.
  if (socket.connected) tryResume();

  socket.on('disconnect', () => {
    toast('Conexão perdida. Tentando reconectar...', 'error', 4000);
  });

  socket.on('connect_error', () => {
    toast('Não foi possível conectar ao servidor.', 'error', 4000);
  });

  // Eventos de partida — feedback leve independente do papel
  const { play } = window.BingoSound;
  socket.on('game_started', () => { toast('A partida começou! 🎉', 'success'); play('start'); });
  socket.on('game_paused', () => { toast('Partida pausada.', 'info'); play('pause'); });
  socket.on('game_resumed', () => { toast('Partida retomada.', 'info'); play('start'); });
  socket.on('game_restarted', () => toast('Partida reiniciada.', 'info'));
  socket.on('new_match_started', () => {
    play('start');
    if (session.role === 'player') toast('Nova partida! Sua cartela nova chegou 🎉', 'success');
  });
  socket.on('game_ended', () => { toast('A sala foi encerrada.', 'info'); play('pause'); });

  // ---------------- som ----------------

  // Botão 🔊/🔇 fixo no canto (vale para este aparelho).
  const soundBtn = document.getElementById('btn-sound');
  function renderSoundButton() {
    const muted = window.BingoSound.isMuted();
    soundBtn.textContent = muted ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-pressed', String(muted));
    soundBtn.setAttribute('aria-label', muted ? 'Ligar o som' : 'Desligar o som');
  }
  soundBtn.addEventListener('click', () => {
    window.BingoSound.setMuted(!window.BingoSound.isMuted());
    play('pop');
  });
  window.BingoSound.onChange(renderSoundButton);
  renderSoundButton();

  // "Clique de brinquedo" nos botões comuns. Casas da cartela e o botão de
  // sortear têm sons próprios.
  document.addEventListener('click', (ev) => {
    // (o clique no rótulo de um chip gera um segundo clique no checkbox; ignora esse)
    if (ev.target.matches('.pack-chip input')) return;
    const target = ev.target.closest('.btn, .btn-mini, .btn-back, .pack-chip');
    if (target && !target.matches('.btn-draw') && !target.disabled) play('click');
  });

  // Tocar no mascote faz ele comemorar (surpresinha para as crianças).
  document.addEventListener('click', (ev) => {
    const mascot = ev.target.closest('.mascot');
    if (!mascot) return;
    window.BingoMascot.setMood('party', mascot, 1200);
    play('boing');
    window.BingoFx.sparkleAt(mascot, 10);
  });

  window.BingoApp = {
    session,
    resetSession,
    setMasterSession,
    setPlayerSession,
    saveSession,
  };

  // inicialização dos módulos que dependem do DOM pronto
  window.BingoMaster.init();
})();
