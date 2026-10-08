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
    session.studentId = null;
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
    // de quem é a sala guardada (o aparelho pode ser de várias crianças)
    const student = window.PlataformaAuth.student();
    session.studentId = student ? student.id : null;
    saveSession();
  }

  // (a entrada da criança fica em join.js)

  // ---------------- criar uma sala ----------------

  document.getElementById('form-create').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const errorEl = document.getElementById('create-error');
    errorEl.textContent = '';
    const name = document.getElementById('input-room-name').value.trim();
    const submitBtn = ev.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await emitAsync('create_room', { name, teacherToken: window.PlataformaTeacher.token() });
      setMasterSession(res.roomCode, res.masterToken);
      window.BingoMaster.render(res.state);
      toast(`Sala criada! Código: ${res.roomCode}`, 'success', 5000);
    } catch (e) {
      errorEl.textContent = e.message || 'Não foi possível criar a sala.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---------------- entrada, saída e reconexão automática ----------------

  // Onde o bingo está aberto neste aparelho (quem decide é o roteador da
  // plataforma): null = fora do bingo, 'player' = /jogos/bingo (criança
  // logada), 'master' = /professor/bingo (ferramenta da área do professor).
  let mode = null;
  let initialPending = false; // a primeira retomada desta entrada ainda não rodou

  // Volta para a sala guardada no aparelho (recarregou a página ou a conexão
  // caiu). Na primeira vez de cada entrada, sem sala para retomar, abre a
  // tela inicial do papel; nas reconexões seguintes, fica na tela atual (a
  // criança pode estar no meio da digitação do código).
  async function resume({ initial = false } = {}) {
    if (!mode) return;
    let saved = loadSession();
    if (saved && saved.role !== mode) saved = null;
    // sala guardada por outra criança deste aparelho: não é desta
    const me = window.PlataformaAuth.student();
    if (saved && mode === 'player' && saved.studentId && (!me || saved.studentId !== me.id)) {
      clearStoredSession();
      saved = null;
    }

    if (mode === 'master') {
      if (saved && saved.masterToken) {
        try {
          const res = await emitAsync('master_reconnect', { roomCode: saved.roomCode, masterToken: saved.masterToken });
          if (mode !== 'master') return;
          Object.assign(session, saved);
          window.BingoMaster.render(res.state);
          toast('Painel do professor reconectado.', 'success', 2500);
          return;
        } catch (e) {
          clearStoredSession();
        }
      }
      if (initial) window.BingoUI.showScreen('screen-create');
      return;
    }

    // criança: quem chegou pelo link de outra sala começa a entrada nela, em
    // vez de voltar para a sala antiga guardada no aparelho
    const urlCode = window.BingoJoin.codeFromUrl();
    if (saved && urlCode && saved.roomCode !== urlCode) {
      clearStoredSession();
      saved = null;
    }
    if (saved && saved.playerToken) {
      try {
        const res = await emitAsync('join_room', {
          roomCode: saved.roomCode, playerToken: saved.playerToken, studentToken: window.PlataformaAuth.token(),
        });
        if (mode !== 'player') return;
        Object.assign(session, saved);
        session.playerId = res.playerId;
        session.playerToken = res.playerToken;
        // nome e bichinho podem ter mudado na conta
        session.playerName = res.state.you.name;
        session.playerAvatar = res.state.you.avatar;
        saveSession();
        window.BingoPlayer.render(res.state);
        toast('Você voltou para a sala! 👋', 'success', 2500);
        return;
      } catch (e) {
        clearStoredSession();
        initial = true; // a sala não existe mais: mostra a entrada
      }
    }
    if (initial) window.BingoJoin.open(urlCode);
  }

  function enter(newMode) {
    mode = newMode;
    if (socket.connected) resume({ initial: true });
    else initialPending = true; // roda quando a conexão abrir
  }

  function leave() {
    mode = null;
    initialPending = false;
  }

  // Botão "← Jogos" da sala de espera e da sala encerrada: sai da sala de
  // verdade (antes de começar, a criança some da lista do professor).
  async function leaveRoomAndGoHome() {
    if (session.role === 'player' && session.roomCode) {
      try {
        await emitAsync('leave_room', { roomCode: session.roomCode, playerToken: session.playerToken });
      } catch (e) { /* a sala pode já não existir */ }
    }
    resetSession();
    window.PlataformaAuth.goHome();
  }
  document.getElementById('waiting-leave').addEventListener('click', leaveRoomAndGoHome);
  document.getElementById('player-leave').addEventListener('click', leaveRoomAndGoHome);

  socket.on('connect', () => {
    const initial = initialPending;
    initialPending = false;
    resume({ initial });
  });

  // Trocar de criança no aparelho apaga a sala da criança anterior.
  window.PlataformaAuth.onLogout(() => { if (session.role === 'player') resetSession(); });

  // Na plataforma: /jogos/bingo (criança) e /professor/bingo (ferramenta do
  // professor, descrita em teacherTool no registro).
  window.Plataforma.registerGame('bingo', {
    enter: () => enter('player'),
    leave,
    teacher: { enter: () => enter('master'), leave },
  });

  const go = (url) => window.PlataformaRouter.go(url);
  document.getElementById('create-back').addEventListener('click', () => go('/professor'));
  document.getElementById('btn-master-teacher').addEventListener('click', () => go('/professor'));

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
