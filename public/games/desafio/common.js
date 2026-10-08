// public/games/desafio/common.js
// Peças usadas pelas três telas do Desafio de digitação (criança,
// professor e telão): relógio acertado com o do servidor, textos dos modos,
// lista de bichinhos, pódio, ranking, placar contra o mascote, contagem
// 3-2-1 e o link de entrada da turma.

(function () {
  const { escapeHtml } = window.BingoUI;

  // diferença entre o relógio do servidor e o deste aparelho
  let offset = 0;
  function syncClock(serverNow) {
    if (serverNow) offset = serverNow - Date.now();
  }
  const now = () => Date.now() + offset;

  function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function modeLabel(config) {
    if (!config) return '';
    if (config.mode === 'relogio') {
      const t = { 30: '30 segundos', 60: '1 minuto', 90: '1 minuto e meio', 120: '2 minutos' }[config.seconds] || `${config.seconds} s`;
      return `⏱ Contra o relógio (${t})${config.vsMascot ? ' · turma contra o mascote 🙂' : ''}`;
    }
    return '🏁 Corrida: vence quem terminar primeiro';
  }

  function renderFriends(el, players, meId) {
    el.innerHTML = '';
    players.forEach((p, i) => {
      const f = document.createElement('div');
      f.className = 'dz-friend';
      f.classList.toggle('is-me', p.id === meId);
      f.classList.toggle('is-away', !p.connected);
      f.style.animationDelay = `${Math.min(i, 20) * 40}ms`;
      const badge = document.createElement('span');
      badge.className = 'avatar-badge';
      badge.textContent = p.avatar;
      f.appendChild(badge);
      if (p.name) {
        const name = document.createElement('small');
        name.textContent = p.name.split(' ')[0];
        f.appendChild(name);
      }
      el.appendChild(f);
    });
  }

  // Ordem "ao vivo" da corrida: quem chegou primeiro, depois quem digitou mais.
  function liveOrder(players, mode) {
    return players.filter((p) => p.racing).slice().sort((a, b) => {
      if (mode === 'corrida' && a.finished !== b.finished) return a.finished ? -1 : 1;
      if (mode === 'corrida' && a.finished) return a.place - b.place;
      return b.correct - a.correct;
    });
  }

  function prizeHtml(icon, label, row, value, meId, i) {
    if (!row) return '';
    const name = row.name ? escapeHtml(row.name) : '';
    return `<div class="dz-prize${row.id === meId ? ' is-me' : ''}" style="--i:${i}">
      <span class="dz-prize-icon" aria-hidden="true">${icon}</span>
      <span class="dz-prize-label">${escapeHtml(label)}</span>
      <span class="avatar-badge">${escapeHtml(row.avatar)}</span>
      ${name ? `<span class="dz-prize-name">${name}</span>` : ''}
      <span class="dz-prize-value">${escapeHtml(value)}</span>
    </div>`;
  }

  // Três prêmios, para não premiar só quem já digita bem.
  function renderPodium(el, results, meId) {
    if (!results) { el.innerHTML = ''; return; }
    const byId = Object.fromEntries(results.ranking.map((r) => [r.id, r]));
    const { fastest, precise, improved } = results.podium;
    const f = byId[fastest];
    const p = byId[precise];
    const m = improved && byId[improved.id];
    const fastValue = f && (results.mode === 'corrida' && f.finished ? `chegou em ${formatTime(f.timeMs)}` : `${f.correct} letras · ${Math.round(f.wpm)} PPM`);
    el.innerHTML = [
      prizeHtml('⚡', results.mode === 'corrida' ? 'Mais rápido' : 'Mais letras', f, fastValue, meId, 0),
      prizeHtml('🎯', 'Mais preciso', p, p && `${Math.round(p.accuracy)}% de acerto`, meId, 1),
      prizeHtml('📈', 'Quem mais melhorou', m, m && `+${improved.gain} PPM na sua média`, meId, 2),
    ].join('');
  }

  function renderRanking(el, results, meId, limit = 40) {
    el.innerHTML = '';
    if (!results) return;
    results.ranking.slice(0, limit).forEach((r) => {
      const li = document.createElement('li');
      li.classList.toggle('is-me', r.id === meId);
      const medal = ['🥇', '🥈', '🥉'][r.position - 1] || `${r.position}º`;
      const stats = results.mode === 'corrida' && r.finished
        ? `${formatTime(r.timeMs)} · ${Math.round(r.wpm)} PPM · ${Math.round(r.accuracy)}%`
        : `${r.correct} letras · ${Math.round(r.wpm)} PPM · ${Math.round(r.accuracy)}%`;
      li.innerHTML = `<span class="dz-rank-pos">${medal}</span><span class="avatar-badge">${escapeHtml(r.avatar)}</span>
        <span>${r.name ? escapeHtml(r.name) : ''}</span><span class="dz-rank-stats">${escapeHtml(stats)}</span>`;
      el.appendChild(li);
    });
  }

  function renderMascotScore(el, mascot) {
    el.hidden = !mascot;
    if (!mascot) return;
    el.classList.toggle('is-lost', !mascot.won);
    el.textContent = mascot.won
      ? `🎉 A turma venceu o Bingolino! ${mascot.team} letras contra ${mascot.target}.`
      : `🙂 O Bingolino venceu desta vez: ${mascot.target} letras contra ${mascot.team} da turma. Na próxima a gente pega ele!`;
  }

  // Contagem 3-2-1-Já até `startAt` (hora do servidor).
  function countdown(overlay, numEl, startAt, onTick) {
    overlay.hidden = false;
    let last = null;
    const timer = setInterval(() => {
      const left = startAt - now();
      if (left <= -700) { clearInterval(timer); overlay.hidden = true; return; }
      const label = left > 0 ? String(Math.ceil(left / 1000)) : 'Já!';
      if (label !== last) {
        last = label;
        numEl.textContent = label;
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = '';
        if (onTick) onTick(label);
      }
    }, 80);
    return () => { clearInterval(timer); overlay.hidden = true; };
  }

  // Links para a turma entrar (rede local), no formato do desafio.
  async function joinUrls(code) {
    const urls = await window.BingoUI.getJoinUrls(code);
    return urls.map((u) => u.replace('/?sala=', '/jogos/desafio?sala='));
  }

  window.DesafioCommon = {
    syncClock, now, formatTime, modeLabel, renderFriends, liveOrder,
    renderPodium, renderRanking, renderMascotScore, countdown, joinUrls,
  };
})();
