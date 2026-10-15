// public/games/maratona/finale.js
// 🏆 O fim da Maratona, a festa: as posições aparecem de trás para frente
// (com os pontos contando), um rufar antes do pódio, o pódio sobe (3º, 2º e
// o 1º no meio), o campeão ganha coroa, luz e confete, e no fim vêm os
// destaques de cada criança e a linha do tempo das rodadas.
// Usada pela criança, pelo telão e pelo professor (também para rever
// maratonas antigas). Com "movimento reduzido" ligado, mostra tudo de uma vez.
//   MaratonaFinale.render(el, state, { meTeam, big, replay })

(function () {
  const C = window.MaratonaCommon;
  const { esc } = C;
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // cada render tem os seus temporizadores (um render novo cancela o anterior)
  const runs = new WeakMap();
  function cancel(el) {
    const r = runs.get(el);
    if (r) r.timers.forEach(clearTimeout);
    runs.delete(el);
  }

  function countUp(node, to, ms) {
    if (!node) return;
    if (reduced() || ms <= 0) { node.textContent = to; return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      node.textContent = Math.round(to * (1 - (1 - k) ** 3));
      if (k < 1 && node.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function membersOf(state, teamId) {
    const t = C.teamById(state, teamId);
    return t ? t.members : [];
  }

  function podiumBlock(state, row, place, meTeam) {
    const t = C.teamById(state, row.id) || { icon: '❔', name: '?', color: 'violet' };
    const solo = state.config.formato === 'solo';
    const people = solo ? '' : `<div class="fin-faces">${membersOf(state, row.id).slice(0, 6).map((p) => `<span class="avatar-badge" title="${esc(p.name)}">${esc(p.avatar)}</span>`).join('')}</div>`;
    return `<div class="fin-pod fin-pod-${place}${row.id === meTeam ? ' is-me' : ''}" style="--team:var(--${t.color || 'violet'})" data-place="${place}">
      ${place === 1 ? '<div class="fin-rays" aria-hidden="true"></div><div class="fin-crown" aria-hidden="true">👑</div>' : ''}
      <div class="fin-who"><span class="fin-icon">${esc(t.icon)}</span><strong>${esc(t.name)}</strong>${people}</div>
      <div class="fin-block"><span class="fin-medal">${['🥇', '🥈', '🥉'][place - 1]}</span><b class="fin-pts" data-to="${row.pontos}">0</b><small>pontos</small>
        <small class="fin-wdl">${row.vitorias}V · ${row.empates}E · ${row.derrotas}D</small></div>
    </div>`;
  }

  function render(el, state, { meTeam = null, big = false, replay = false } = {}) {
    const final = state.final || { standings: state.standings || [], highlights: {} };
    const key = `${state.code}:${final.at || ''}`;
    // o mesmo fim de novo (outra atualização do servidor): não recomeça a festa
    if (!replay && el.dataset.finale === key && el.querySelector('.fin')) return;
    cancel(el);
    el.dataset.finale = key;
    const run = { timers: [] };
    runs.set(el, run);
    const later = (ms, fn) => { run.timers.push(setTimeout(fn, ms)); };
    const rows = final.standings || [];
    const top = rows.slice(0, Math.min(3, rows.length));
    const rest = rows.slice(top.length);
    const hl = final.highlights || {};
    const hlCard = (icon, label, h, unit) => (h && h.name ? `<div class="fin-hl"><span class="fin-hl-icon">${icon}</span><small>${label}</small><span class="avatar-badge">${esc(h.avatar)}</span><strong>${esc(h.name)}</strong><em>${esc(h.valor)} ${unit}</em></div>` : '');
    const rounds = state.history || [];

    el.innerHTML = `<div class="fin${big ? ' is-big' : ''}">
      <header class="fin-head">
        <p class="fin-kicker">🏁 Fim da maratona</p>
        <h1 class="title-game fin-title">${esc(state.name)}</h1>
        <p class="fin-drum" aria-live="polite">E os vencedores são…</p>
      </header>
      ${rest.length ? `<ol class="fin-rest" start="${top.length + 1}">${rest.slice().reverse().map((r) => {
        const t = C.teamById(state, r.id) || { icon: '❔', name: '?', color: 'violet' };
        return `<li class="fin-row${r.id === meTeam ? ' is-me' : ''}" style="--team:var(--${t.color || 'violet'})" data-pos="${r.posicao}">
          <span class="fin-pos">${r.posicao}º</span><span class="fin-team">${esc(t.icon)} ${esc(t.name)}</span>
          <span class="fin-row-wdl">${r.vitorias}V ${r.empates}E ${r.derrotas}D</span><b class="fin-pts" data-to="${r.pontos}">0</b></li>`;
      }).join('')}</ol>` : ''}
      <div class="fin-podium">${[2, 1, 3].filter((p) => top[p - 1]).map((p) => podiumBlock(state, top[p - 1], p, meTeam)).join('')}</div>
      <section class="fin-after">
        ${hl && (hl.estrelas || hl.rapido || hl.preciso) ? `<h2 class="fin-h2">🌟 Destaques</h2><div class="fin-hls">
          ${hlCard('⭐', 'mais estrelas', hl.estrelas, 'estrelas')}${hlCard('⚡', 'mais rápido', hl.rapido, 's por rodada')}${hlCard('🎯', 'mais preciso', hl.preciso, '% de qualidade')}
        </div>` : ''}
        ${rounds.length ? `<h2 class="fin-h2">📜 As rodadas</h2><ol class="fin-rounds">${rounds.map((r) => `<li><span class="fin-r-icon">${esc(C.gameOf(r.gameId).icon)}</span><div><strong>${r.number}. ${esc(r.title || C.gameOf(r.gameId).name)}</strong>
          <small>${r.matches.filter((x) => x.sideB).map((x) => C.outcomeText(state, x)).join(' · ') || 'descanso'}</small></div></li>`).join('')}</ol>` : ''}
        <div class="fin-actions"><button type="button" class="btn btn-violet" data-fin-replay>🔁 Ver a festa de novo</button></div>
      </section>
    </div>`;
    el.querySelector('[data-fin-replay]').addEventListener('click', () => render(el, state, { meTeam, big, replay: true }));

    const fin = el.querySelector('.fin');
    const sound = window.BingoSound;
    const fx = window.BingoFx;
    if (reduced()) {
      fin.classList.add('is-done');
      el.querySelectorAll('.fin-row, .fin-pod').forEach((n) => n.classList.add('is-in'));
      el.querySelectorAll('.fin-pts').forEach((n) => { n.textContent = n.dataset.to; });
      return;
    }
    // 1) de trás para frente: os de fora do pódio, um a um
    const restRows = [...el.querySelectorAll('.fin-row')];
    const STEP = big ? 900 : 650;
    let t = 900;
    restRows.forEach((row) => {
      later(t, () => { row.classList.add('is-in'); countUp(row.querySelector('.fin-pts'), Number(row.querySelector('.fin-pts').dataset.to), 500); sound.play('pop'); });
      t += STEP;
    });
    // 2) o rufar
    later(t, () => { fin.classList.add('is-drum'); sound.play('drum'); });
    later(t + 700, () => sound.play('drum'));
    t += 1500;
    // 3) o pódio: 3º, 2º e, depois de uma pausa, o 1º
    for (const place of [3, 2]) {
      const pod = el.querySelector(`.fin-pod[data-place="${place}"]`);
      if (!pod) continue;
      later(t, () => { pod.classList.add('is-in'); countUp(pod.querySelector('.fin-pts'), Number(pod.querySelector('.fin-pts').dataset.to), 700); sound.play('ding'); });
      t += STEP + 300;
    }
    const first = el.querySelector('.fin-pod[data-place="1"]');
    t += 600;
    later(t, () => {
      fin.classList.remove('is-drum');
      el.querySelector('.fin-drum').textContent = '🏆 Campeões!';
      if (first) { first.classList.add('is-in'); countUp(first.querySelector('.fin-pts'), Number(first.querySelector('.fin-pts').dataset.to), 900); }
      sound.play('fanfare');
      fx.confetti({ amount: big ? 260 : 180 });
    });
    // uma explosão de confete de cima do campeão
    later(t + 1600, () => {
      if (!first) return;
      const r = first.getBoundingClientRect();
      fx.confetti({ amount: big ? 140 : 80, origin: { x: r.left + r.width / 2, y: r.top + r.height * 0.3 } });
    });
    later(t + 1200, () => fin.classList.add('is-done'));
  }

  window.MaratonaFinale = { render, cancel };
})();
