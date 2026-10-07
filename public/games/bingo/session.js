// public/games/bingo/session.js
// Sessão do bingo: guarda o papel na sala (professor ou criança), o código e
// os tokens, tenta reconectar automaticamente quando a página é recarregada
// ou a conexão cai, e liga o formulário de criar sala.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { toast } = window.BingoUI;

  const STORAGE_KEY = 'bingo_virtual_session_v1';

  const session = {
    role: 'none', // 'none' | 'master' | 'player'
    roomCode: null,
    masterToken: null,
    playerToken: null,
    playerId: null,
    playerName: null,
    playerAvatar: null,
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
    session.playerAvatar = null;
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

  function setPlayerSession(roomCode, playerId, playerToken, playerName, playerAvatar) {
    session.role = 'player';
    session.roomCode = roomCode;
    session.masterToken = null;
    session.playerId = playerId;
    session.playerToken = playerToken;
    session.playerName = playerName;
    session.playerAvatar = playerAvatar || null;
    saveSession();
  }

  // (a entrada da criança, em 3 passos, fica em join.js)

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

  // Link com ?sala=CODE (QR Code do professor): abre a entrada já com o
  // código, uma única vez por carregamento da página.
  let urlCodeHandled = false;
  function openJoinFromUrl() {
    const urlCode = window.BingoJoin.codeFromUrl();
    if (urlCodeHandled || !urlCode) return false;
    urlCodeHandled = true;
    window.BingoJoin.open(urlCode);
    return true;
  }

  async function tryResume() {
    // o telão não tem sessão: ele só assiste a sala (screen.js)
    if (window.BingoScreen.isScreenMode()) return;
    // A criança precisa estar logada na plataforma para entrar ou voltar a
    // uma sala; o professor não (ele entra pela área do professor).
    await window.PlataformaAuth.ready;
    const loggedIn = window.PlataformaAuth.isLoggedIn();
    const { goHome } = window.PlataformaAuth;
    let saved = loadSession();
    // Quem chegou pelo link de outra sala começa a entrada nela, em vez de
    // voltar para a sala antiga guardada no aparelho.
    const urlCode = !urlCodeHandled && window.BingoJoin.codeFromUrl();
    if (saved && urlCode && saved.roomCode !== urlCode && saved.role !== 'master') {
      clearStoredSession();
      saved = null;
    }
    // Sem sessão salva: fica na tela atual (a criança pode estar no meio
    // da digitação do código quando a conexão volta).
    if (!saved || saved.role === 'none' || !saved.roomCode) {
      if (loggedIn) openJoinFromUrl();
      return;
    }

    if (saved.role === 'master' && saved.masterToken) {
      try {
        const res = await emitAsync('master_reconnect', { roomCode: saved.roomCode, masterToken: saved.masterToken });
        Object.assign(session, saved);
        window.BingoMaster.render(res.state);
        toast('Painel do professor reconectado.', 'success', 2500);
        return;
      } catch (e) {
        clearStoredSession();
        if (!(loggedIn && openJoinFromUrl())) goHome();
        return;
      }
    }

    if (saved.role === 'player' && !loggedIn) {
      // sessão de sala de alguém que não está mais logado neste aparelho
      clearStoredSession();
      return;
    }

    if (saved.role === 'player' && saved.playerToken) {
      try {
        const res = await emitAsync('join_room', {
          roomCode: saved.roomCode, name: saved.playerName, playerToken: saved.playerToken, avatar: saved.playerAvatar,
        });
        Object.assign(session, saved);
        session.playerId = res.playerId;
        session.playerToken = res.playerToken;
        saveSession();
        window.BingoPlayer.render(res.state);
        urlCodeHandled = true;
        toast('Você voltou para a sala! 👋', 'success', 2500);
        return;
      } catch (e) {
        clearStoredSession();
        if (!(loggedIn && openJoinFromUrl())) goHome();
        return;
      }
    }

    goHome();
  }

  // Quem acabou de fazer login pelo link/QR de uma sala já cai na entrada dela.
  window.PlataformaAuth.onLogin(() => openJoinFromUrl());
  // Trocar de criança no aparelho apaga a sala da criança anterior.
  window.PlataformaAuth.onLogout(() => { if (session.role === 'player') resetSession(); });

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
  // (para a criança, o começo da partida é a contagem 3-2-1 do player.js)
  socket.on('game_started', () => {
    if (session.role === 'master') { toast('A partida começou! 🎉', 'success'); play('start'); }
  });
  socket.on('game_paused', () => { toast('Pausa! ⏸', 'info'); play('pause'); });
  socket.on('game_resumed', () => { toast('Valendo de novo! ▶️', 'success'); play('start'); });
  socket.on('game_restarted', () => toast('Partida reiniciada.', 'info'));
  socket.on('new_match_started', () => {
    if (session.role === 'master') play('start');
    if (session.role === 'player') toast('Nova partida! Cartela nova 🎉', 'success');
  });
  socket.on('game_ended', () => { toast('A sala foi encerrada.', 'info'); play('pause'); });

  window.BingoApp = {
    session,
    resetSession,
    setMasterSession,
    setPlayerSession,
    saveSession,
  };

  // inicialização dos módulos que dependem do DOM pronto
  window.BingoMaster.init();
  if (window.BingoScreen.isScreenMode()) window.BingoScreen.start();
})();
