// public/games/desafio/master.js
// Desafio de digitação, painel do professor (/professor/desafio): cria a
// sala, escolhe o modo e o texto (uma fase do Teclado Mágico ou um texto
// próprio), dá a largada, acompanha a turma ao vivo e vê o pódio.
//
// Painel de acompanhamento (durante a rodada): relógio, números da turma,
// uma linha por criança (progresso, velocidade, precisão, erros e situação)
// e quem pode precisar de ajuda — parado há um tempo, errando muito ou que
// saiu da página.

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast, confirmModal, escapeHtml, qrUrl } = window.BingoUI;
  const { play } = window.BingoSound;
  const C = window.DesafioCommon;
  const Levels = window.DigitacaoLevels;

  const STORAGE_KEY = 'desafio_master_v1';
  const $ = (id) => document.getElementById(id);
  const STATUS = { waiting: 'esperando', countdown: 'largada!', racing: 'correndo', finished: 'fim da rodada', ended: 'encerrada' };

  let active = false;
  let session = null; // { roomCode, masterToken }
  let state = null;
  let qrFor = null;
  let sortBy = 'position';

  // Quando avisar o professor. O professor muda na própria tela; fica
  // guardado neste navegador.
  const ALERTS_KEY = 'desafio_alertas_v1';
  const ALERT_LIMITS = { idleSecs: [5, 120, 12], accuracy: [50, 100, 80] }; // [mín, máx, padrão]
  const alerts = { idleSecs: 12, accuracy: 80 };
  try {
    const saved = JSON.parse(localStorage.getItem(ALERTS_KEY)) || {};
    for (const k of Object.keys(alerts)) if (Number.isFinite(saved[k])) alerts[k] = saved[k];
  } catch (e) { /* padrão */ }
  const clampAlert = (k, v) => {
    const [min, max, def] = ALERT_LIMITS[k];
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
  }
  function clear() {
    session = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // lista de fases, agrupada por mundo
  (function fillLevels() {
    const select = $('dz-m-level');
    Levels.WORLDS.forEach((world, w) => {
      const group = document.createElement('optgroup');
      group.label = `${world.icon} Mundo ${w + 1} · ${world.name}`;
      world.levels.forEach((level, i) => {
        const opt = document.createElement('option');
        opt.value = level.id;
        opt.textContent = `${i + 1}. ${level.title}`;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });
  }());

  // ---------------- criar / voltar para a sala ----------------

  async function create() {
    $('dz-create-error').textContent = '';
    try {
      const res = await emitAsync('dz:create', { teacherToken: window.PlataformaTeacher.token() });
      session = { roomCode: res.roomCode, masterToken: res.masterToken };
      save();
      play('start');
      render(res.state);
    } catch (e) {
      $('dz-create-error').textContent = e.message || 'Não foi possível criar a sala.';
    }
  }
  $('dz-create-btn').addEventListener('click', create);
  $('dz-create-back').addEventListener('click', () => window.PlataformaRouter.go('/professor'));

  async function reconnect() {
    try {
      const res = await emitAsync('dz:master_reconnect', session);
      if (active) render(res.state);
      return true;
    } catch (e) {
      clear();
      return false;
    }
  }

  // ---------------- ações ----------------

  async function action(event, payload = {}) {
    $('dz-m-error').textContent = '';
    try {
      const res = await emitAsync(event, { ...session, ...payload });
      render(res.state);
      return res;
    } catch (e) {
      $('dz-m-error').textContent = e.message || 'Algo deu errado.';
      toast(e.message || 'Algo deu errado.', 'error');
      return null;
    }
  }
  const setConfig = (config) => action('dz:config', { config });

  document.querySelectorAll('#dz-m-config [data-mode]').forEach((btn) => btn.addEventListener('click', () => setConfig({ mode: btn.dataset.mode })));
  document.querySelectorAll('#dz-m-config [data-source]').forEach((btn) => btn.addEventListener('click', () => setConfig({ source: btn.dataset.source })));
  $('dz-m-seconds').addEventListener('change', (ev) => setConfig({ seconds: Number(ev.target.value) }));
  $('dz-m-mascot').addEventListener('change', (ev) => setConfig({ vsMascot: ev.target.checked }));
  $('dz-m-level').addEventListener('change', (ev) => setConfig({ levelId: ev.target.value }));
  $('dz-m-upper').addEventListener('change', (ev) => setConfig({ uppercase: ev.target.checked }));
  $('dz-m-names').addEventListener('change', (ev) => setConfig({ showNames: ev.target.checked }));
  let customTimer = null;
  $('dz-m-custom').addEventListener('input', (ev) => {
    clearTimeout(customTimer);
    customTimer = setTimeout(() => setConfig({ customText: ev.target.value }), 500);
  });

  $('dz-m-start').addEventListener('click', async () => {
    clearTimeout(customTimer);
    if (state && state.config.source === 'custom') await setConfig({ customText: $('dz-m-custom').value });
    const res = await action('dz:start');
    if (res) play('start');
  });
  $('dz-m-stop').addEventListener('click', () => action('dz:end_round'));
  $('dz-m-lock').addEventListener('click', () => action('dz:lock', { locked: !(state && state.locked) }));
  $('dz-m-end').addEventListener('click', async () => {
    const ok = await confirmModal('Encerrar a sala?', 'A turma sai do desafio. Os resultados das rodadas já ficaram salvos.', 'Encerrar');
    if (!ok) return;
    await action('dz:end_room');
    clear();
    showScreen('dz-create');
  });
  $('dz-m-screen').addEventListener('click', () => {
    if (session) window.open(`/telao/desafio?sala=${encodeURIComponent(session.roomCode)}`, 'desafio-telao');
  });
  $('dz-m-teacher').addEventListener('click', () => window.PlataformaRouter.go('/professor'));

  // ---------------- tela ----------------

  function setPressed(selector, attr, value) {
    document.querySelectorAll(selector).forEach((btn) => btn.setAttribute('aria-checked', String(btn.dataset[attr] === value)));
  }

  function renderConfig(s) {
    const cfg = s.config;
    const live = s.status === 'countdown' || s.status === 'racing';
    setPressed('#dz-m-config [data-mode]', 'mode', cfg.mode);
    setPressed('#dz-m-config [data-source]', 'source', cfg.source);
    $('dz-m-clock-row').hidden = cfg.mode !== 'relogio';
    $('dz-m-seconds').value = String(cfg.seconds);
    $('dz-m-mascot').checked = cfg.vsMascot;
    $('dz-m-level-row').hidden = cfg.source !== 'level';
    $('dz-m-custom-row').hidden = cfg.source !== 'custom';
    $('dz-m-level').value = cfg.levelId;
    // não apaga o que o professor está escrevendo
    if (document.activeElement !== $('dz-m-custom')) $('dz-m-custom').value = cfg.customText || '';
    $('dz-m-upper').checked = cfg.uppercase;
    $('dz-m-names').checked = cfg.showNames;
    $('dz-m-config').querySelectorAll('button, select, input, textarea').forEach((el) => { el.disabled = live; });
  }

  function renderPlayers(s) {
    const list = $('dz-m-players');
    list.innerHTML = '';
    const order = s.status === 'waiting' ? s.players : [...C.liveOrder(s.players, s.config.mode), ...s.players.filter((p) => !p.racing)];
    order.forEach((p) => {
      const li = document.createElement('li');
      li.classList.toggle('is-away', !p.connected);
      const place = p.finished && p.place ? `🏁 ${p.place}º` : '';
      const stat = p.racing ? `${place} ${Math.round(p.wpm)} PPM · ${Math.round(p.accuracy)}%` : (p.connected ? 'na sala' : 'saiu');
      li.innerHTML = `<span class="avatar-badge">${escapeHtml(p.avatar)}</span>
        <span class="dz-m-pname"><span>${escapeHtml(p.name || '')}</span>
          <span class="dz-m-bar" aria-hidden="true"><i style="width:${Math.round(p.progress * 100)}%"></i></span></span>
        <span class="dz-m-pstat">${escapeHtml(stat.trim())} <button type="button" class="dz-kick" title="Remover da sala" data-kick="${escapeHtml(p.id)}">✕</button></span>`;
      list.appendChild(li);
    });
    list.querySelectorAll('[data-kick]').forEach((btn) => btn.addEventListener('click', async () => {
      const p = s.players.find((x) => x.id === btn.dataset.kick);
      const ok = await confirmModal('Remover da sala?', `${p ? p.name : 'Essa criança'} sai do desafio e não volta nesta sala.`, 'Remover');
      if (ok) action('dz:kick', { playerId: btn.dataset.kick });
    }));
  }

  async function renderJoin(code) {
    if (qrFor === code) return;
    qrFor = code;
    const urls = await C.joinUrls(code);
    const url = urls[0];
    $('dz-m-qr').src = qrUrl(url);
    $('dz-m-url').href = url;
    $('dz-m-url').textContent = url.replace(/^https?:\/\//, '');
  }

  // ---------------- painel de acompanhamento ----------------

  // Situação de uma criança na rodada (e se o professor deveria olhar).
  function situation(p, s, t) {
    if (p.finished) {
      const time = p.timeMs ? ` em ${C.formatTime(p.timeMs)}` : '';
      return { cls: 'is-done', text: `🏁 ${p.place}º lugar${time}`, attention: null };
    }
    if (!p.connected) return { cls: 'is-away', text: '📴 saiu da página', attention: 'saiu da página' };
    if (t < s.startAt) return { cls: '', text: '⏳ na largada', attention: null };
    const idle = t - (p.lastKeyAt || s.startAt);
    if (idle > alerts.idleSecs * 1000) {
      const secs = Math.floor(idle / 1000);
      return { cls: 'is-idle', text: `💤 parado há ${secs} s`, attention: p.correct ? `parado há ${secs} s` : `ainda não começou (${secs} s)` };
    }
    if (p.correct >= 10 && p.accuracy < alerts.accuracy) {
      return { cls: 'is-errors', text: '⚠️ errando bastante', attention: `errando bastante (${Math.round(p.accuracy)}% de acerto)` };
    }
    return { cls: '', text: '✍️ digitando', attention: null };
  }

  const SORTS = {
    position: (list, s) => C.liveOrder(list, s.config.mode),
    name: (list) => list.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    accuracy: (list) => list.slice().sort((a, b) => a.accuracy - b.accuracy),
    attention: (list, s, t) => list.slice().sort((a, b) => Number(Boolean(situation(b, s, t).attention)) - Number(Boolean(situation(a, s, t).attention))),
  };

  document.querySelectorAll('#dz-live [data-sort]').forEach((btn) => btn.addEventListener('click', () => {
    sortBy = btn.dataset.sort;
    setPressed('#dz-live [data-sort]', 'sort', sortBy);
    if (state) renderLive(state);
  }));

  // limites dos avisos ("parado há mais de N s", "acerto abaixo de N%")
  [['dz-live-idle-secs', 'idleSecs'], ['dz-live-low-acc', 'accuracy']].forEach(([id, key]) => {
    const input = $(id);
    input.value = alerts[key];
    input.addEventListener('change', () => {
      alerts[key] = clampAlert(key, input.value);
      input.value = alerts[key];
      try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); } catch (e) { /* ignore */ }
      if (state) renderLive(state);
    });
  });
  $('dz-live-alerts-reset').addEventListener('click', () => {
    for (const k of Object.keys(alerts)) { alerts[k] = ALERT_LIMITS[k][2]; }
    $('dz-live-idle-secs').value = alerts.idleSecs;
    $('dz-live-low-acc').value = alerts.accuracy;
    try { localStorage.removeItem(ALERTS_KEY); } catch (e) { /* ignore */ }
    if (state) renderLive(state);
  });

  function liveTimer(s, t) {
    if (t < s.startAt) return `largada em ${Math.ceil((s.startAt - t) / 1000)}`;
    return s.config.mode === 'relogio' ? C.formatTime(s.endsAt - t) : C.formatTime(t - s.startAt);
  }

  function renderLive(s) {
    const t = C.now();
    const racers = s.players.filter((p) => p.racing);
    const late = s.players.filter((p) => !p.racing);
    const finished = racers.filter((p) => p.finished);
    const infos = new Map(racers.map((p) => [p.id, situation(p, s, t)]));
    const idle = racers.filter((p) => !p.finished && infos.get(p.id).cls === 'is-idle');
    const typing = racers.filter((p) => !p.finished && infos.get(p.id).text.startsWith('✍️'));
    const started = racers.filter((p) => p.correct > 0);
    const avg = (list, f) => (list.length ? list.reduce((n, p) => n + f(p), 0) / list.length : 0);
    const clock = s.config.mode === 'relogio';

    $('dz-live-round').textContent = `#${s.round}`;
    $('dz-live-mode').textContent = C.modeLabel(s.config);
    $('dz-live-timer').textContent = liveTimer(s, t);
    $('dz-live-typing').textContent = typing.length;
    $('dz-live-done').textContent = clock ? '–' : `${finished.length}/${racers.length}`;
    $('dz-live-idle').textContent = idle.length;
    $('dz-live-idle-box').classList.toggle('has-value', idle.length > 0);
    $('dz-live-avg').textContent = Math.round(avg(started, (p) => p.wpm));
    $('dz-live-acc').textContent = `${Math.round(avg(started, (p) => p.accuracy) || 100)}%`;
    $('dz-live-progress').textContent = clock
      ? `${racers.reduce((n, p) => n + p.correct, 0)}`
      : `${Math.round(avg(racers, (p) => p.progress) * 100)}%`;
    $('dz-live-progress').nextElementSibling.textContent = clock ? '📈 letras da turma' : '📈 turma no texto';

    const m = s.mascot;
    $('dz-live-mascot').hidden = !m;
    if (m) {
      const max = Math.max(m.target, m.team, 1);
      $('dz-live-mteam').style.width = `${(m.team / max) * 100}%`;
      $('dz-live-mmascot').style.width = `${(m.mascotNow / max) * 100}%`;
      $('dz-live-mteam-n').textContent = m.team;
      $('dz-live-mmascot-n').textContent = m.mascotNow;
    }

    // quem pode precisar de ajuda
    const help = racers.filter((p) => infos.get(p.id).attention);
    $('dz-live-help').hidden = help.length === 0;
    $('dz-live-help-list').innerHTML = help
      .map((p) => `<li>${escapeHtml(p.avatar)} ${escapeHtml(p.name)} — ${escapeHtml(infos.get(p.id).attention)}</li>`).join('');

    // tabela: uma linha por criança, reaproveitada para as barras deslizarem
    const tbody = $('dz-live-rows');
    const ordered = SORTS[sortBy](racers, s, t);
    const positions = new Map(C.liveOrder(racers, s.config.mode).map((p, i) => [p.id, i + 1]));
    const best = Math.max(1, ...racers.map((r) => r.correct));
    const seen = new Set();
    ordered.forEach((p) => {
      seen.add(p.id);
      let tr = tbody.querySelector(`[data-row="${CSS.escape(p.id)}"]`);
      if (!tr) {
        tr = document.createElement('tr');
        tr.dataset.row = p.id;
        tr.innerHTML = `<td class="num dz-c-pos"></td>
          <td><span class="dz-live-who"><span class="avatar-badge"></span><span class="dz-c-name"></span></span></td>
          <td><div class="dz-live-bar"><i></i><span></span></div></td>
          <td class="num dz-c-wpm"></td><td class="num dz-c-acc"></td><td class="num dz-c-wrong"></td>
          <td><span class="dz-status"></span></td>`;
      }
      tbody.appendChild(tr); // na ordem escolhida
      const info = infos.get(p.id);
      tr.className = [p.finished ? 'is-done' : '', info.attention ? 'is-attention' : '', p.connected ? '' : 'is-away'].join(' ').trim();
      tr.querySelector('.dz-c-pos').textContent = `${positions.get(p.id)}º`;
      tr.querySelector('.avatar-badge').textContent = p.avatar;
      tr.querySelector('.dz-c-name').textContent = p.name;
      const pct = clock ? Math.min(100, (p.correct / best) * 100) : p.progress * 100;
      tr.querySelector('.dz-live-bar i').style.width = `${pct}%`;
      tr.querySelector('.dz-live-bar span').textContent = clock ? `${p.correct} letras` : `${Math.round(pct)}%`;
      tr.querySelector('.dz-c-wpm').textContent = p.correct ? Math.round(p.wpm) : '–';
      tr.querySelector('.dz-c-acc').textContent = p.correct ? `${Math.round(p.accuracy)}%` : '–';
      tr.querySelector('.dz-c-wrong').textContent = p.wrong || 0;
      const status = tr.querySelector('.dz-status');
      status.className = `dz-status ${info.cls}`;
      status.textContent = info.text;
    });
    tbody.querySelectorAll('[data-row]').forEach((tr) => { if (!seen.has(tr.dataset.row)) tr.remove(); });

    $('dz-live-late').hidden = late.length === 0;
    $('dz-live-late').textContent = late.length
      ? `⏳ Entraram depois da largada e correm na próxima rodada: ${late.map((p) => p.name).join(', ')}.`
      : '';
    if ($('dz-live-text').textContent !== (s.text || '')) $('dz-live-text').textContent = s.text || '';
  }

  // relógio e "parado há N s" andam entre uma atualização e outra
  setInterval(() => {
    if (active && state && (state.status === 'countdown' || state.status === 'racing')) renderLive(state);
  }, 1000);

  function render(s) {
    state = s;
    C.syncClock(s.now);
    if (s.status === 'ended') { clear(); showScreen('dz-create'); return; }
    $('dz-m-code').textContent = s.code;
    $('dz-m-code2').textContent = s.code;
    $('dz-m-status').textContent = STATUS[s.status] || s.status;
    $('dz-m-count').textContent = `${s.players.length} na sala`;
    $('dz-m-count2').textContent = s.players.length;
    renderConfig(s);
    const live = s.status === 'countdown' || s.status === 'racing';
    $('dz-m-start').hidden = live;
    $('dz-m-start').textContent = s.round > 0 ? '🔁 Nova rodada' : '▶ Dar a largada';
    $('dz-m-stop').hidden = !live;
    $('dz-m-lock').textContent = s.locked ? '🔓 Abrir entrada' : '🔒 Fechar entrada';
    renderPlayers(s);
    // durante a rodada, as regras e a lista simples dão lugar ao painel ao vivo
    $('dz-live').hidden = !live;
    $('dz-m-config').hidden = live;
    $('dz-m-players-card').hidden = live;
    if (live) renderLive(s);
    $('dz-m-results').hidden = !s.results || live;
    if (s.results && !live) {
      $('dz-m-round').textContent = `#${s.results.round}`;
      C.renderPodium($('dz-m-podium'), s.results, null);
      C.renderMascotScore($('dz-m-mascot-score'), s.results.mascot);
      C.renderRanking($('dz-m-ranking'), s.results, null);
    }
    renderJoin(s.code);
    if (!document.getElementById('dz-master').classList.contains('active')) showScreen('dz-master');
  }

  socket.on('dz:master_state', (s) => { if (active && session && s.code === session.roomCode) render(s); });
  socket.on('dz:results', (s) => {
    if (active && session && s.code === session.roomCode && s.isMaster) { render(s); play('fanfare'); }
  });
  socket.on('connect', () => { if (active && session) reconnect(); });

  async function enter() {
    active = true;
    session = load();
    if (session && (await reconnect())) return;
    showScreen('dz-create');
  }

  function leave() {
    active = false;
  }

  window.DesafioMaster = { enter, leave };
})();
