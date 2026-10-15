// public/games/maratona/screen.js
// 🏃 Telão da Maratona (/telao/maratona?sala=CODE), para projetar na sala:
// sala de espera com o QR Code, votação, contagem da rodada, a rodada ao
// vivo (quem já terminou), o resultado de cada rodada com a classificação e
// o fim. Só leitura: não recebe tokens nem a semente das fases.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, qrUrl, getJoinUrls } = window.BingoUI;
  const C = window.MaratonaCommon;
  const { esc } = C;
  const $ = (id) => document.getElementById(id);

  let code = null;
  let state = null;
  let stops = [];
  let joinUrl = null;
  let lastStatus = null;
  const stopTimers = () => { stops.forEach((f) => f()); stops = []; };

  function memberName(s, id) {
    const p = s.teams.flatMap((t) => t.members).find((m) => m.studentId === id);
    return p ? `${esc(p.avatar)} ${esc(p.name.split(' ')[0])}` : '';
  }

  function render(s) {
    if (!s || s.code !== code) return;
    state = s;
    C.syncClock(s.serverNow);
    stopTimers();
    const body = $('mt-t-body');
    $('mt-t-missing').hidden = true;
    const st = s.status;
    const changed = lastStatus !== st;
    lastStatus = st;
    if (st === 'sala_de_espera') {
      const people = s.teams.length ? s.teams.reduce((n, t) => n + t.members.length, 0) : s.waiting.length;
      body.innerHTML = `<div class="mt-t-lobby">
        <div class="mt-t-lobby-left">
          <h1 class="title-game mt-t-title">🏃 ${esc(s.name)}</h1>
          <p class="mt-t-call">Entre na maratona! 👇</p>
          <img class="mt-qr mt-t-qr" src="${esc(qrUrl(joinUrl || C.joinUrl(s.code)))}" alt="QR Code para entrar" />
          <p class="mt-t-code">Código: <strong>${esc(s.code)}</strong></p>
          <p class="mt-t-cfg">${esc(C.configText(s.config))}</p>
        </div>
        <div class="mt-t-lobby-right">
          <p class="speech">${people ? `${people} na sala!` : 'Ninguém entrou ainda…'}</p>
          <div class="mt-teams mt-t-teams" id="mt-t-teams"></div>
        </div></div>`;
      if (s.teams.length) C.renderTeams($('mt-t-teams'), s);
      else $('mt-t-teams').innerHTML = `<div class="mt-t-faces">${s.waiting.map((p, i) => `<span class="mt-t-face" style="--i:${Math.min(i, 30)}"><span class="avatar-badge">${esc(p.avatar)}</span><small>${esc(p.name.split(' ')[0])}</small></span>`).join('')}</div>`;
    } else if (st === 'votacao') {
      const v = s.round.vote;
      const total = Object.values(v.counts).reduce((a, b) => a + b, 0);
      body.innerHTML = `<div class="mt-t-center"><h1 class="title-game mt-t-title">🗳️ Qual será o jogo da rodada ${s.round.number}?</h1>
        <p class="mt-t-timer" id="mt-t-timer"></p>
        <div class="mt-t-votes">${v.options.map((g) => { const game = C.gameOf(g); const n = v.counts[g] || 0; return `<div class="mt-t-vote" style="--card:var(--${game.color || 'violet'})"><span class="mt-vote-icon">${esc(game.icon)}</span><strong>${esc(game.name)}</strong><span class="mt-bar"><i style="width:${total ? Math.round((n / total) * 100) : 0}%"></i></span><b>${n}</b></div>`; }).join('')}</div></div>`;
      stops.push(C.ticker(() => { const el = $('mt-t-timer'); if (el) el.textContent = C.formatTime(v.until - C.now()); }));
    } else if (st === 'preparando' || st === 'disputa') {
      const r = s.round;
      const game = C.gameOf(r.gameId);
      body.innerHTML = `<div class="mt-t-round">
        <div class="mt-t-round-head"><h1 class="title-game mt-t-title">${esc(game.icon)} Rodada ${r.number} de ${s.config.rodadas}</h1><span class="mt-t-timer" id="mt-t-timer"></span></div>
        <p class="mt-t-sub">${esc(r.title || game.name)} · ${r.kind === 'duelo' ? '⚔️ duelo pela rede' : '🏁 todo mundo joga a mesma fase'}</p>
        <div class="mt-t-matches">${r.matches.map((x) => `<div class="mt-t-match${x.sideB ? '' : ' is-bye'}">
          <div class="mt-t-sides">${x.sideB ? `<span>${C.teamLabel(s, x.sideA)}</span><span class="mt-vs">×</span><span>${C.teamLabel(s, x.sideB)}</span>` : `<span>${C.teamLabel(s, x.sideA)}</span><small>😴 descansa</small>`}</div>
          <div class="mt-t-entries">${x.entries.filter((e) => e.status !== 'descanso').map((e) => `<span class="mt-entry is-${esc(e.status)}">${memberName(s, e.studentId)} ${e.status === 'concluida' ? '✅' : e.status === 'escalado' ? '🎮' : e.status === 'ausente' ? '🚫' : e.status === 'tempo_esgotado' ? '⏰' : ''}</span>`).join('')}</div>
        </div>`).join('')}</div>
        ${st === 'preparando' ? '<div class="mt-t-countdown" id="mt-t-count"></div>' : ''}</div>`;
      stops.push(C.ticker(() => {
        const el = $('mt-t-timer');
        if (el) el.textContent = C.formatTime((st === 'preparando' ? r.startsAt : r.deadlineAt) - C.now());
        const cd = $('mt-t-count');
        if (cd) { const left = r.startsAt - C.now(); cd.textContent = left > 0 ? Math.ceil(left / 1000) : 'Já!'; }
      }, 200));
    } else if (st === 'encerrada' || st === 'cancelada') {
      if (window.MaratonaFinale) window.MaratonaFinale.render(body, s, { big: true, replay: changed });
      else {
        body.innerHTML = `<div class="mt-t-center"><h1 class="title-game mt-t-title">🏆 ${esc(s.name)}</h1><ol class="mt-standings mt-t-standings" id="mt-t-final"></ol></div>`;
        C.renderStandings($('mt-t-final'), { ...s, standings: (s.final && s.final.standings) || s.standings });
      }
    } else {
      // entre rodadas / pausada
      const last = s.history[s.history.length - 1];
      body.innerHTML = `<div class="mt-t-between">
        <h1 class="title-game mt-t-title">${st === 'pausada' ? '⏸️ Pausa' : `Fim da rodada ${last ? last.number : ''}`}</h1>
        ${last ? `<p class="mt-t-sub">${esc(last.title || '')}</p><ul class="mt-t-results">${last.matches.filter((x) => x.sideB).map((x) => `<li>${C.teamLabel(s, x.sideA)} <span class="mt-vs">×</span> ${C.teamLabel(s, x.sideB)} <b>${C.outcomeText(s, x)}</b></li>`).join('')}</ul>` : ''}
        <h2 class="mt-h3">🏆 Classificação</h2><ol class="mt-standings mt-t-standings" id="mt-t-standings"></ol>
        <p class="mt-t-sub" id="mt-t-next"></p></div>`;
      C.renderStandings($('mt-t-standings'), s);
      if (s.autoAt) stops.push(C.ticker(() => { const el = $('mt-t-next'); if (el) el.textContent = `⏩ Próxima rodada em ${C.formatTime(s.autoAt - C.now())}`; }));
      if (changed && st === 'entre_rodadas') window.BingoFx.confetti({ amount: 70 });
    }
  }

  async function start() {
    showScreen('mt-telao');
    code = (new URLSearchParams(location.search).get('sala') || '').trim().toUpperCase();
    await C.loadGames();
    try {
      const urls = await getJoinUrls(code);
      joinUrl = (urls[0] || '').replace(/\/\?sala=.*/, `/jogos/maratona?sala=${encodeURIComponent(code)}`) || null;
    } catch (e) { joinUrl = null; }
    const watch = async () => {
      try {
        const res = await emitAsync('mt:watch', { code });
        render(res.state);
      } catch (e) {
        $('mt-t-body').innerHTML = '';
        $('mt-t-missing').hidden = false;
        window.BingoMascot.mount($('mt-t-missing'));
      }
    };
    socket.on('mt:state', render);
    socket.on('connect', watch);
    await watch();
  }

  $('mt-telao-back').addEventListener('click', () => {
    if (window.opener) window.close();
    else window.PlataformaRouter.go('/professor/maratona');
  });

  window.MaratonaScreen = { start };
})();
