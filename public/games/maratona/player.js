// public/games/maratona/player.js
// 🏃 Maratona, lado da criança (/jogos/maratona?sala=CODE): entrar com o
// código, sala de espera (com a equipe), votação, a contagem antes da
// rodada, a rodada (o próprio jogo, aberto direto na fase e com a semente da
// rodada: js/shared/competition.js), o resultado de cada rodada e o fim.
// Quem manda é o servidor (mt:state); se a conexão cai, volta sozinho.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast } = window.BingoUI;
  const { play } = window.BingoSound;
  const C = window.MaratonaCommon;
  const { esc } = C;

  const STORAGE_KEY = 'maratona_player_v1';
  const $ = (id) => document.getElementById(id);

  let active = false;
  let ctxRef = null;
  let code = null;
  let state = null;
  let mounted = null; // { round, gameId } da rodada que está montada
  let mounting = false;
  let stops = [];
  let lastScreen = null;

  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ code })); } catch (e) { /* ignore */ } };
  const load = () => { try { return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}).code || null; } catch (e) { return null; } };
  const forget = () => { code = null; try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ } };
  const stopTimers = () => { stops.forEach((f) => f()); stops = []; };

  const FRIENDLY = {
    MARATONA_NAO_ENCONTRADA: 'Hmm, não achei essa maratona 🤔 Confira o código com o(a) professor(a)!',
    MARATONA_LOTADA: 'A maratona está cheia! 😮',
    MARATONA_ENCERRADA: 'Essa maratona já acabou 🌙',
  };

  function go(screen) {
    if (lastScreen !== screen) { showScreen(screen); window.scrollTo({ top: 0 }); }
    lastScreen = screen;
  }

  // ---------------- entrar ----------------
  function showJoin(value = '', message) {
    $('mt-join-code').value = value || '';
    $('mt-join-speech').textContent = message || 'Qual é o código da maratona? 🏃';
    go('mt-join');
    setTimeout(() => $('mt-join-code').focus(), 80);
  }

  async function join(c) {
    const studentToken = window.PlataformaAuth.token();
    try {
      const res = await emitAsync('mt:join', { code: c, studentToken });
      code = res.state.code;
      save();
      play('start');
      render(res.state);
    } catch (e) {
      forget();
      showJoin(c, FRIENDLY[e.code] || e.message || 'Não consegui entrar 😵');
    }
  }

  // ---------------- o estado que chega do servidor ----------------
  function render(s) {
    if (!active || !s || (code && s.code !== code)) return;
    const prev = state;
    state = s;
    C.syncClock(s.serverNow);
    stopTimers();
    const st = s.status;
    if (st === 'encerrada' || st === 'cancelada') { unmountGame(); renderFinal(); return; }
    if (st === 'sala_de_espera' || (st === 'pausada' && !s.round)) { unmountGame(); renderLobby(); return; }
    if (st === 'votacao') { unmountGame(); renderVote(prev); return; }
    if (st === 'preparando' || st === 'disputa') { renderRound(); return; }
    // entre_rodadas, pausada
    unmountGame();
    renderBetween(prev);
  }

  function renderLobby() {
    $('mt-lobby-title').textContent = `🏃 ${state.name}`;
    $('mt-lobby-code').textContent = state.code;
    $('mt-lobby-config').textContent = C.configText(state.config);
    const team = C.myTeam(state);
    const box = $('mt-lobby-myteam');
    box.hidden = !team || state.config.formato === 'solo';
    if (team) box.innerHTML = `Sua equipe: <strong style="color:var(--${team.color}-dark, inherit)">${esc(team.icon)} ${esc(team.name)}</strong>`;
    if (state.teams.length) {
      C.renderTeams($('mt-lobby-teams'), state, { meId: state.me && state.me.studentId });
    } else {
      $('mt-lobby-teams').innerHTML = `<div class="mt-team"><div class="mt-team-head"><strong>👋 Na sala (${state.waiting.length})</strong></div><ul class="mt-members">${state.waiting.map((p) => `<li class="${state.me && p.studentId === state.me.studentId ? 'is-me' : ''}${p.online ? '' : ' is-off'}"><span class="avatar-badge">${esc(p.avatar)}</span><span class="mt-mname">${esc(p.name)}</span></li>`).join('')}</ul></div>`;
    }
    $('mt-lobby-speech').textContent = state.status === 'pausada'
      ? 'A maratona está pausada ⏸️ Espere o(a) professor(a).'
      : state.teams.length ? 'As equipes estão prontas! Esperando a largada 🏁' : 'Já já começa! Quando o(a) professor(a) der a largada, a primeira rodada aparece aqui ✨';
    go('mt-lobby');
  }

  // ---------------- votação ----------------
  function renderVote(prev) {
    const v = state.round.vote;
    const box = $('mt-vote-cards');
    box.innerHTML = v.options.map((g) => {
      const game = C.gameOf(g);
      return `<button type="button" class="mt-vote-card${v.mine === g ? ' is-mine' : ''}" data-game="${esc(g)}" style="--card:var(--${game.color || 'violet'})">
        <span class="mt-vote-icon">${esc(game.icon)}</span><strong>${esc(game.name)}</strong>
        <span class="mt-vote-count">${v.counts[g] || 0} voto${v.counts[g] === 1 ? '' : 's'}</span>${v.mine === g ? '<span class="mt-vote-check">✔ seu voto</span>' : ''}
      </button>`;
    }).join('');
    box.querySelectorAll('[data-game]').forEach((b) => b.addEventListener('click', () => vote(b.dataset.game)));
    stops.push(C.ticker(() => { $('mt-vote-timer').textContent = C.formatTime(v.until - C.now()); }));
    if (!prev || prev.status !== 'votacao') play('pop');
    go('mt-vote');
  }
  async function vote(gameId) {
    try { await emitAsync('mt:vote', { code, gameId }); play('click'); } catch (e) { toast(e.message || 'Não deu para votar.', 'error'); }
  }

  // ---------------- a rodada ----------------
  function versusText() {
    const x = C.myMatch(state);
    if (!x) return '';
    if (!x.sideB) return '😴 Descanso';
    const mine = state.me.teamId;
    const other = x.sideA === mine ? x.sideB : x.sideA;
    if (state.round.kind === 'duelo' && state.play && state.play.opponentId) {
      const opp = state.teams.flatMap((t) => t.members).find((p) => p.studentId === state.play.opponentId);
      if (opp) return `Você × ${esc(opp.avatar)} ${esc(opp.name.split(' ')[0])}`;
    }
    return state.config.formato === 'solo' ? `Você × ${C.teamLabel(state, other)}` : `${C.teamLabel(state, mine)} × ${C.teamLabel(state, other)}`;
  }
  function doneText() {
    const x = C.myMatch(state);
    const all = (state.round.matches || []).flatMap((m) => m.entries).filter((e) => e.status !== 'descanso' && e.status !== 'dispensado');
    const done = all.filter((e) => e.status !== 'escalado').length;
    return x ? `✔ ${done} de ${all.length} terminaram` : '';
  }

  function renderRound() {
    const r = state.round;
    const p = state.play;
    const game = C.gameOf(r.gameId);
    const ready = p && p.entryStatus === 'escalado' || (p && mounted && mounted.round === r.number);
    if (!p) {
      // descansa, dispensado ou entrou depois
      unmountGame();
      $('mt-prep-round').textContent = `Rodada ${r.number}`;
      $('mt-prep-game').innerHTML = `<span class="mt-prep-icon">${esc(game.icon)}</span><strong>${esc(r.title || game.name)}</strong>`;
      const x = C.myMatch(state);
      $('mt-prep-versus').innerHTML = '';
      $('mt-prep-msg').textContent = x && !x.sideB ? '😴 Você descansa nesta rodada (vale 1 ponto). Torça pelos amigos!'
        : state.me && state.me.status === 'dispensado' ? '🙏 Você está dispensado(a) nesta rodada.'
          : '⏳ Você entra na próxima rodada. Espere um pouquinho!';
      $('mt-prep-count').hidden = true;
      go('mt-prep');
      return;
    }
    if (!ready) {
      // a criança já terminou ou o tempo dela acabou: espera os outros
      if (!mounted) {
        $('mt-prep-round').textContent = `Rodada ${r.number}`;
        $('mt-prep-game').innerHTML = `<span class="mt-prep-icon">${esc(game.icon)}</span><strong>${esc(r.title || game.name)}</strong>`;
        $('mt-prep-versus').innerHTML = versusText();
        $('mt-prep-msg').textContent = p.entryStatus === 'concluida' ? '✅ Você já terminou! Esperando os outros…' : '⏰ Seu tempo nesta rodada acabou. Esperando os outros…';
        $('mt-prep-count').hidden = true;
        go('mt-prep');
      } else updateStrip();
      return;
    }
    if (C.now() < r.startsAt && !(mounted && mounted.round === r.number)) {
      // contagem antes da largada
      $('mt-prep-round').textContent = `Rodada ${r.number} de ${state.config.rodadas}`;
      $('mt-prep-game').innerHTML = `<span class="mt-prep-icon">${esc(game.icon)}</span><strong>${esc(r.title || game.name)}</strong>`;
      $('mt-prep-versus').innerHTML = versusText();
      $('mt-prep-msg').textContent = r.kind === 'duelo' ? 'Duelo pela rede: um contra o outro!' : 'Todo mundo joga a mesma fase. Capricha!';
      const count = $('mt-prep-count');
      count.hidden = false;
      let lastN = null;
      stops.push(C.ticker(() => {
        const left = r.startsAt - C.now();
        if (left <= 0) { stopTimers(); startGame(); return; }
        const n = Math.ceil(left / 1000);
        count.textContent = n;
        if (n !== lastN && n <= 3) play('tick');
        lastN = n;
      }, 100));
      go('mt-prep');
      return;
    }
    startGame();
  }

  async function startGame() {
    const r = state.round;
    const p = state.play;
    if (!p) return;
    if (mounted && mounted.round === r.number) { go('mt-play'); updateStrip(); return; }
    if (mounting) return;
    mounting = true;
    unmountGame();
    try {
      const game = (await window.Plataforma.listGames()).find((g) => g.id === p.gameId);
      const ctx = window.Plataforma.createContext(game, new URLSearchParams(), () => {});
      const thisCode = code;
      const roundNumber = r.number;
      ctx.competition = p.kind === 'duelo'
        ? { matchId: p.matchId }
        : {
          levelId: p.levelId,
          seed: p.seed,
          async submit(body) {
            try {
              const res = await emitAsync('mt:result', { code: thisCode, body });
              play('ding');
              return res;
            } catch (e) {
              toast(e.message || 'Não consegui mandar o resultado 😵', 'error', 5000);
              return {};
            }
          },
        };
      play('start');
      go('mt-play');
      mounted = { round: roundNumber, gameId: p.gameId };
      updateStrip();
      await window.Plataforma.mountGame(p.gameId, $('mt-game-root'), ctx);
    } catch (e) {
      console.error(e);
      mounted = null;
      toast('Não consegui abrir o jogo da rodada 😵', 'error');
    } finally {
      mounting = false;
    }
  }

  function updateStrip() {
    if (!state || !state.round) return;
    const r = state.round;
    $('mt-play-round').textContent = `${C.gameOf(r.gameId).icon} Rodada ${r.number}/${state.config.rodadas}`;
    $('mt-play-vs').innerHTML = versusText();
    $('mt-play-done').textContent = doneText();
    stops.push(C.ticker(() => {
      const left = r.deadlineAt - C.now();
      const el = $('mt-play-timer');
      el.textContent = C.formatTime(left);
      el.classList.toggle('is-late', left < 30000);
    }, 500));
  }

  function unmountGame() {
    if (!mounted) return;
    mounted = null;
    try { window.Plataforma.unmountGame(); } catch (e) { /* ignore */ }
    $('mt-game-root').innerHTML = '';
  }

  // ---------------- entre as rodadas ----------------
  function renderBetween(prev) {
    const last = state.history[state.history.length - 1];
    const r = state.round;
    $('mt-between-title').textContent = state.status === 'pausada' ? '⏸️ Maratona pausada' : `Fim da rodada ${r ? r.number : ''}`;
    const x = C.myMatch(state);
    const mine = C.myOutcome(state, x);
    const box = $('mt-between-outcome');
    box.className = `mt-outcome ${mine ? `is-${mine.kind}` : ''}`;
    // como a própria criança foi (estrelas da corrida)
    const me = x && state.me ? x.entries.find((e) => e.studentId === state.me.studentId) : null;
    const myLine = !me ? '' : me.status === 'concluida' && r && r.kind === 'corrida' ? `Você: ${'⭐'.repeat(me.stars || 0)}${'☆'.repeat(3 - (me.stars || 0))}`
      : me.status === 'tempo_esgotado' ? '⏰ Seu tempo acabou antes de terminar.' : me.status === 'ausente' ? 'Você não jogou esta rodada.' : '';
    box.innerHTML = mine ? `<strong>${mine.text}</strong>${myLine ? `<span class="mt-mine">${myLine}</span>` : ''}<small>${esc(r ? `${C.gameOf(r.gameId).icon} ${r.title}` : '')}</small>` : `<strong>${last ? esc(last.title) : ''}</strong>`;
    C.renderStandings($('mt-between-standings'), state, { highlight: state.me && state.me.teamId });
    const next = $('mt-between-next');
    if (state.autoAt) stops.push(C.ticker(() => { next.textContent = `⏩ Próxima rodada em ${C.formatTime(state.autoAt - C.now())}`; }));
    else next.textContent = state.status === 'pausada' ? 'Espere o(a) professor(a) retomar.' : '⏳ Esperando o(a) professor(a) abrir a próxima rodada…';
    if (!prev || prev.status !== state.status) {
      if (mine && mine.kind === 'vitoria') { play('fanfare'); window.BingoFx.confetti({ amount: 90 }); } else play('tada');
    }
    go('mt-between');
  }

  // ---------------- fim (o ranking animado é a fase 7; aqui, o simples) ----------------
  function renderFinal() {
    if (window.MaratonaFinale) window.MaratonaFinale.render($('mt-final-root'), state, { meTeam: state.me && state.me.teamId });
    else {
      $('mt-final-root').innerHTML = `<h2 class="title-game mt-title">🏆 ${esc(state.name)}</h2><ol class="mt-standings" id="mt-final-standings"></ol>`;
      C.renderStandings($('mt-final-standings'), { ...state, standings: (state.final && state.final.standings) || state.standings }, { highlight: state.me && state.me.teamId });
    }
    // (a festa, com som e confete, é da MaratonaFinale)
    if (lastScreen !== 'mt-final' && !window.MaratonaFinale) { play('fanfare'); window.BingoFx.confetti({ amount: 160 }); }
    go('mt-final');
  }

  // ---------------- botões ----------------
  $('mt-join-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const c = $('mt-join-code').value.trim().toUpperCase();
    if (c.length !== 4) { $('mt-join-speech').textContent = 'O código tem 4 letras 😉'; return; }
    join(c);
  });
  $('mt-join-code').addEventListener('input', (ev) => { ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  $('mt-join-back').addEventListener('click', () => window.PlataformaRouter.go('/jogos'));
  $('mt-lobby-leave').addEventListener('click', async () => {
    try { await emitAsync('mt:leave', { code }); } catch (e) { /* ignore */ }
    forget();
    window.PlataformaRouter.go('/jogos');
  });
  $('mt-final-back').addEventListener('click', () => { forget(); window.PlataformaRouter.go('/jogos'); });

  socket.on('mt:state', (s) => { if (active) render(s); });
  // a conexão voltou: entra de novo (o servidor guarda a vaga)
  socket.on('connect', () => { if (active && code) join(code); });

  function enter(ctx) {
    active = true;
    ctxRef = ctx;
    lastScreen = null;
    C.loadGames();
    const sala = ctx && ctx.params && ctx.params.get('sala');
    if (sala) history.replaceState(null, '', location.pathname);
    const c = (sala || load() || '').toUpperCase().replace(/[^A-Z]/g, '');
    window.BingoMascot.mount($('mt-join-mascot'));
    window.BingoMascot.mount($('mt-lobby-mascot'));
    if (c.length === 4) join(c); else showJoin();
  }
  function leave() {
    active = false;
    stopTimers();
    unmountGame();
    ctxRef = null;
  }

  window.MaratonaPlayer = { enter, leave };
})();
