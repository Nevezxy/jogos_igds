// public/games/desafio/master.js
// Desafio de digitação, painel do professor (/professor/desafio): cria a
// sala, escolhe o modo e o texto (uma fase do Teclado Mágico ou um texto
// próprio), dá a largada, acompanha a turma ao vivo e vê o pódio.

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
