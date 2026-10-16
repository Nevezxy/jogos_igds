// public/games/maratona/master.js
// 🏃 Maratona, painel do professor (/professor/maratona): criar a
// maratona (jogos do catálogo com o nível, os assuntos, o formato, a
// rotação, as rodadas e as opções), a sala de espera com QR Code, as
// equipes (equilibrar, sortear, trocar), e o comando ao vivo: começar,
// votação, rodada em andamento (quem já terminou, resolver um confronto),
// próxima rodada, pausar, dispensar quem faltou e encerrar.
// A chave de dono fica neste navegador (volta para a sala depois de fechar
// a página ou de o servidor reiniciar).

(function () {
  const { socket, emitAsync } = window.BingoSocket;
  const { showScreen, toast, confirmModal, qrUrl, getJoinUrls } = window.BingoUI;
  const { play } = window.BingoSound;
  const C = window.MaratonaCommon;
  const { esc } = C;

  const STORAGE_KEY = 'maratona_master_v1';
  const $ = (id) => document.getElementById(id);

  let active = false;
  let session = null; // { code, masterToken }
  let state = null;
  let stops = [];
  let catalog = []; // status dos jogos (da API do professor)
  const form = { games: new Set(), topics: {}, ordem: [], area: 'todos' };

  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ } };
  const loadSession = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; } };
  const clearSession = () => { session = null; try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ } };
  const stopTimers = () => { stops.forEach((f) => f()); stops = []; };
  const teacherToken = () => window.PlataformaTeacher.token();

  async function act(event, payload = {}, okMsg) {
    try {
      const res = await emitAsync(event, { code: session.code, masterToken: session.masterToken, ...payload });
      if (okMsg) toast(okMsg, 'success');
      return res;
    } catch (e) {
      toast(e.message || 'Não deu certo 😵', 'error', 5000);
      return null;
    }
  }

  // ---------------- criar ----------------
  // Página única: nível, jogos (filtrados por área), formato, rodadas e as
  // opções avançadas à esquerda; o resumo (com a duração estimada e o botão
  // de criar) fica sempre à vista ao lado (no celular, embaixo, com uma
  // barrinha fixa que leva até ele).
  const radio = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const clampInput = (id) => {
    const el = $(id);
    const v = Math.round(Number(el.value));
    return Math.max(Number(el.min), Math.min(Number(el.max), el.value !== '' && Number.isFinite(v) ? v : Number(el.defaultValue)));
  };
  const formValue = () => ({
    nivel: Number(radio('mt-nivel') || 1),
    tempoMin: clampInput('mt-f-tempo'),
    rodadas: clampInput('mt-f-rodadas'),
    votoSeg: clampInput('mt-f-voto'),
    formato: radio('mt-formato') || 'dupla',
    rotacao: radio('mt-rotacao') || 'aleatorio',
  });

  let catalogSeq = 0;
  async function loadCatalog() {
    const seq = ++catalogSeq;
    const { nivel, tempoMin } = formValue();
    const q = new URLSearchParams({ nivel, tempo: tempoMin, assuntos: JSON.stringify(form.topics) });
    try {
      const res = await fetch(`/api/teacher/maratona/catalogo?${q}`, { headers: { 'X-Teacher-Token': teacherToken() || '' } });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);
      if (seq !== catalogSeq) return;
      catalog = data.games;
      // o que deixou de ter fase sai da seleção
      for (const g of [...form.games]) if (!(catalog.find((x) => x.id === g) || {}).count) form.games.delete(g);
      renderGames();
    } catch (e) {
      $('mt-f-games').innerHTML = `<p class="mt-error">${esc(e.message || 'Não consegui carregar os jogos.')}</p>`;
    }
  }
  const HELP = {
    1: 'Só as fases fáceis de cada jogo.',
    2: 'Fases fáceis e médias (inclui as do nível 1).',
    3: 'Fases fáceis, médias e difíceis (inclui as dos níveis 1 e 2).',
    4: 'Todas as fases (inclui as dos níveis 1, 2 e 3).',
  };
  const AREAS = [
    { id: 'digitacao', label: '⌨️ Digitação' }, { id: 'matematica', label: '🔢 Matemática' }, { id: 'mouse', label: '🖱️ Mouse' },
    { id: 'raciocinio', label: '🧩 Raciocínio' }, { id: 'tabuleiro', label: '♟️ Tabuleiro' }, { id: 'outros', label: '🎲 Outros' },
  ];
  const areaOf = (id) => { const s = C.gameOf(id).subject; return AREAS.some((a) => a.id === s) ? s : 'outros'; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function renderFilters(available) {
    const counts = {};
    available.forEach((g) => { counts[areaOf(g.id)] = (counts[areaOf(g.id)] || 0) + 1; });
    if (form.area !== 'todos' && !counts[form.area]) form.area = 'todos';
    const chip = (id, label, n) => `<button type="button" class="mt-chip${form.area === id ? ' is-on' : ''}" data-area="${id}" aria-pressed="${form.area === id}">${label} <b>${n}</b></button>`;
    $('mt-f-filters').innerHTML = chip('todos', 'Todos', available.length) + AREAS.filter((a) => counts[a.id]).map((a) => chip(a.id, a.label, counts[a.id])).join('');
    $('mt-f-filters').querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => { form.area = b.dataset.area; renderGames(); }));
  }

  const visibleGames = () => catalog.filter((g) => g.count && (form.area === 'todos' || areaOf(g.id) === form.area));

  function renderGames() {
    const available = catalog.filter((g) => g.count);
    renderFilters(available);
    const box = $('mt-f-games');
    const list = visibleGames();
    box.innerHTML = list.length ? list.map((g) => {
      const on = form.games.has(g.id);
      const chosen = new Set(form.topics[g.id] || []);
      const topics = on && g.topics.filter((t) => g.byTopicAll[t.id]).length > 1 ? `<div class="mt-topics" data-topics="${esc(g.id)}">
        <small>Assuntos (nenhum marcado = todos):</small>
        ${g.topics.filter((t) => g.byTopicAll[t.id] || chosen.has(t.id)).map((t) => `<button type="button" class="mt-chip${chosen.has(t.id) ? ' is-on' : ''}" data-topic="${esc(t.id)}" aria-pressed="${chosen.has(t.id)}">${esc(t.icon)} ${esc(t.name)} <b>${g.byTopicAll[t.id] || 0}</b></button>`).join('')}
      </div>` : '';
      const badges = [g.requiresKeyboard ? '<span class="mt-badge" title="Precisa de teclado">⌨️</span>' : '', g.trust === 'fraca' ? '<span class="mt-badge is-warn" title="O servidor confere pouco o resultado deste jogo">⚠️ conf. fraca</span>' : '', g.duelos ? '<span class="mt-badge">⚔️ duelo</span>' : '', g.aboveLevel ? '<span class="mt-badge is-up" title="Não tem fases tão fáceis: entra com as mais fáceis que tem">⬆️ mais difícil</span>' : ''].join('');
      // todos os cartões com as mesmas duas linhas (nome; selos e fases);
      // com os assuntos abertos, o cartão ocupa a linha inteira
      return `<div class="mt-game${on ? ' is-on' : ''}${topics ? ' has-topics' : ''}">
        <label><input type="checkbox" data-game="${esc(g.id)}" ${on ? 'checked' : ''} />
          <span class="mt-game-icon">${esc(g.icon)}</span><span class="mt-game-name" title="${esc(g.name)}">${esc(g.name)}</span>
          <span class="mt-game-meta">${badges}<small class="mt-game-count">${plural(g.count, 'fase', 'fases')}</small></span></label>
        ${topics}
      </div>`;
    }).join('') : '<p class="mt-empty">Nenhum jogo desta área tem fases neste nível.</p>';
    box.querySelectorAll('[data-game]').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) form.games.add(cb.dataset.game); else { form.games.delete(cb.dataset.game); delete form.topics[cb.dataset.game]; }
      renderGames();
    }));
    box.querySelectorAll('[data-topics]').forEach((wrap) => wrap.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => {
      const g = wrap.dataset.topics;
      const set = new Set(form.topics[g] || []);
      if (set.has(b.dataset.topic)) set.delete(b.dataset.topic); else set.add(b.dataset.topic);
      if (set.size) form.topics[g] = [...set]; else delete form.topics[g];
      loadCatalog();
    })));
    // os jogos sem fase neste nível ficam recolhidos, com o motivo
    const off = catalog.filter((g) => !g.count);
    $('mt-f-off').hidden = !off.length;
    $('mt-f-off-sum').textContent = `${plural(off.length, 'jogo fica', 'jogos ficam')} de fora no nível ${formValue().nivel}`;
    $('mt-f-off-list').innerHTML = off.map((g) => `<span title="${esc(g.reason || '')}">${esc(g.icon)} ${esc(g.name)}</span>`).join('');
    $('mt-f-games-count').textContent = form.games.size ? `${form.games.size} escolhido${form.games.size === 1 ? '' : 's'}` : '';
    renderOrdem();
  }

  function renderOrdem() {
    const { rotacao } = formValue();
    const show = rotacao === 'ordem';
    $('mt-f-ordem-wrap').hidden = !show;
    $('mt-f-voto-wrap').hidden = rotacao !== 'votacao';
    if (show) {
      form.ordem = form.ordem.filter((g) => form.games.has(g));
      $('mt-f-ordem').innerHTML = form.ordem.length
        ? form.ordem.map((g, i) => `<button type="button" class="mt-chip is-on" data-del="${i}" title="Tirar da lista">${i + 1}. ${esc(C.gameOf(g).icon)} ${esc(C.gameOf(g).name)} ✕</button>`).join('')
        : '<small class="muted">Nenhuma rodada ainda: sem lista, os jogos vão em sequência.</small>';
      $('mt-f-ordem-add').innerHTML = [...form.games].map((g) => `<button type="button" class="mt-chip" data-add="${esc(g)}">＋ ${esc(C.gameOf(g).icon)} ${esc(C.gameOf(g).name)}</button>`).join('');
      $('mt-f-ordem').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { form.ordem.splice(Number(b.dataset.del), 1); renderOrdem(); }));
      $('mt-f-ordem-add').querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { if (form.ordem.length < 20) form.ordem.push(b.dataset.add); renderOrdem(); }));
    }
    renderSummary();
  }

  // o resumo ao lado: o que foi escolhido, quanto tempo leva e os avisos
  function renderSummary() {
    const f = formValue();
    $('mt-f-nivel-help').textContent = HELP[f.nivel];
    $('mt-f-balancear-wrap').hidden = f.formato === 'solo';
    const chosen = catalog.filter((g) => form.games.has(g.id));
    const names = chosen.map((g) => `${g.icon} ${g.name}${form.topics[g.id] ? ` (${plural(form.topics[g.id].length, 'assunto', 'assuntos')})` : ''}`).join(', ');
    const extras = [f.formato !== 'solo' ? ($('mt-f-balancear').checked ? '⚖️ equipes equilibradas' : '🎲 equipes sorteadas') : '', $('mt-f-auto').checked ? '⏩ passa sozinho' : '', $('mt-f-bonus').checked ? '⭐ bônus de perfeição' : ''].filter(Boolean);
    $('mt-sum').innerHTML = `
      <dt>Jogos</dt><dd>${chosen.length ? esc(names) : '<span class="muted">nenhum ainda</span>'}</dd>
      <dt>Nível</dt><dd>${f.nivel}</dd>
      <dt>Formato</dt><dd>${C.FORMATOS[f.formato]}</dd>
      <dt>Rodadas</dt><dd>${f.rodadas} × até ${f.tempoMin} min</dd>
      <dt>Escolha</dt><dd>${C.ROTACAO[f.rotacao]}${f.rotacao === 'votacao' ? ` (${f.votoSeg} s)` : ''}${f.rotacao === 'ordem' && form.ordem.length ? ` (${plural(form.ordem.length, 'rodada', 'rodadas')} na lista)` : ''}</dd>
      ${extras.length ? `<dt>Opções</dt><dd>${extras.join(' · ')}</dd>` : ''}`;
    // pior caso: cada rodada no tempo máximo, mais ~1 min de largada e
    // resultado (e a votação, quando tem)
    const perRound = f.tempoMin + 1 + (f.rotacao === 'votacao' ? f.votoSeg / 60 : 0);
    const total = Math.ceil(f.rodadas * perRound);
    $('mt-sum-time').textContent = `até ~${total} min`;
    const warn = [];
    const kb = chosen.filter((g) => g.requiresKeyboard);
    if (kb.length) warn.push(`⌨️ ${kb.map((g) => g.name).join(', ')}: precisa de teclado (não dá no tablet).`);
    const weak = chosen.filter((g) => g.trust === 'fraca');
    if (weak.length) warn.push(`⚠️ ${weak.map((g) => g.name).join(', ')}: o servidor confere pouco o resultado.`);
    if ((f.rotacao === 'aleatorio' || f.rotacao === 'sequencial') && chosen.length > f.rodadas) warn.push(`🎲 São ${chosen.length} jogos para ${f.rodadas} rodadas: nem todos vão cair.`);
    if (total > 50) warn.push('⏰ Passa de 50 min: talvez não caiba numa aula.');
    $('mt-sum-warn').innerHTML = warn.map((w) => `<li>${esc(w)}</li>`).join('');
    $('mt-sum-bar').innerHTML = `<span>${chosen.length ? `${plural(chosen.length, 'jogo', 'jogos')} · até ~${total} min` : 'Escolha os jogos'}</span><span>Criar ↓</span>`;
  }

  async function create(ev) {
    ev.preventDefault();
    $('mt-create-error').textContent = '';
    const f = formValue();
    const config = {
      games: [...form.games], topics: form.topics, nivel: f.nivel, tempoMin: f.tempoMin,
      formato: f.formato, rotacao: f.rotacao, ordem: form.ordem,
      rodadas: f.rodadas, votoSeg: f.votoSeg,
      balancear: $('mt-f-balancear').checked, auto: $('mt-f-auto').checked, bonus: $('mt-f-bonus').checked,
    };
    if (!config.games.length) {
      $('mt-create-error').textContent = 'Escolha pelo menos um jogo.';
      $('mt-f-games').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    try {
      const res = await emitAsync('mt:create', { teacherToken: teacherToken(), config, name: $('mt-f-name').value });
      session = { code: res.code, masterToken: res.masterToken };
      save();
      play('start');
      render(res.state);
    } catch (e) {
      $('mt-create-error').textContent = e.message || 'Não consegui criar a maratona.';
    }
  }

  // ---------------- maratonas anteriores (o resultado fica salvo) ----------------
  async function teacherGet(route) {
    const res = await fetch(`/api${route}`, { headers: { 'X-Teacher-Token': teacherToken() || '' } });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!res.ok || data.ok === false) throw new Error(data.message || 'Não consegui carregar.');
    return data;
  }
  async function loadArchive() {
    try {
      const { marathons } = await teacherGet('/teacher/maratona/historico');
      const done = marathons.filter((m) => m.status === 'encerrada' && m.startedAt);
      $('mt-archive-card').hidden = !done.length;
      const when = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      $('mt-archive-list').innerHTML = done.slice(0, 20).map((m) => `<li>
        <span><strong>${esc(m.name)}</strong> <small class="muted">${esc(m.code)} · ${when(m.endedAt || m.createdAt)} · ${esc(C.FORMATOS[m.formato] || '')} · ${m.games.map((g) => esc(C.gameOf(g).icon)).join(' ')}</small></span>
        <button type="button" class="btn-mini" data-archive="${esc(m.code)}">🏆 Ver o resultado</button></li>`).join('');
      $('mt-archive-list').querySelectorAll('[data-archive]').forEach((b) => b.addEventListener('click', () => openArchive(b.dataset.archive)));
    } catch (e) { $('mt-archive-card').hidden = true; }
  }
  async function openArchive(code) {
    try {
      const { state: s } = await teacherGet(`/maratona/${encodeURIComponent(code)}`);
      $('mt-archive-code').textContent = s.code;
      showScreen('mt-archive');
      window.MaratonaFinale.render($('mt-archive-root'), s, { replay: true });
    } catch (e) { toast(e.message || 'Não consegui abrir essa maratona.', 'error'); }
  }

  function showCreate() {
    stopTimers();
    state = null;
    loadArchive();
    const saved = loadSession();
    $('mt-resume').hidden = !saved;
    if (saved) $('mt-resume-code').textContent = saved.code;
    showScreen('mt-create');
    C.loadGames().then(loadCatalog);
  }

  // ---------------- painel ----------------
  async function reconnect() {
    try {
      const res = await emitAsync('mt:master', session);
      render(res.state);
      return true;
    } catch (e) {
      toast(e.message || 'Não consegui voltar para a maratona.', 'error');
      clearSession();
      showCreate();
      return false;
    }
  }

  function render(s) {
    if (!active || !s || !session || s.code !== session.code) return;
    state = s;
    C.syncClock(s.serverNow);
    stopTimers();
    $('mt-m-title').textContent = `🏃 ${s.name}`;
    $('mt-m-status').textContent = C.STATUS[s.status] || s.status;
    $('mt-m-status').dataset.status = s.status;
    renderJoin();
    renderConfig();
    renderActions();
    renderRoundPanel();
    renderPeople();
    const started = s.status !== 'sala_de_espera';
    // o fim: a festa também no painel do professor
    const finalBox = $('mt-m-final');
    finalBox.hidden = s.status !== 'encerrada';
    if (s.status === 'encerrada' && window.MaratonaFinale) window.MaratonaFinale.render(finalBox, s, {});
    $('mt-m-standings-card').hidden = !started || s.status === 'encerrada';
    if (started) C.renderStandings($('mt-m-standings'), s.status === 'encerrada' && s.final ? { ...s, standings: s.final.standings } : s);
    $('mt-m-history-card').hidden = !s.history.length;
    $('mt-m-history').innerHTML = s.history.map((h) => `<li><strong>${h.number}. ${esc(h.title || '')}</strong><ul>${h.matches.map((x) => `<li>${x.sideB ? `${C.teamLabel(s, x.sideA)} × ${C.teamLabel(s, x.sideB)}: ${C.outcomeText(s, x)}` : C.outcomeText(s, x)}</li>`).join('')}</ul></li>`).join('');
    showScreen('mt-master');
  }

  let joinFor = null;
  function renderJoin() {
    $('mt-m-code').textContent = state.code;
    if (joinFor === state.code) return;
    joinFor = state.code;
    $('mt-m-url').textContent = C.joinUrl(state.code);
    $('mt-m-qr').src = qrUrl(C.joinUrl(state.code));
    // na escola o QR precisa do endereço da rede (não "localhost")
    getJoinUrls(state.code).then((urls) => {
      const url = (urls[0] || '').replace(/\/\?sala=.*/, `/jogos/maratona?sala=${encodeURIComponent(state.code)}`);
      if (url) { $('mt-m-url').textContent = url; $('mt-m-qr').src = qrUrl(url); }
    }).catch(() => {});
  }

  function renderConfig() {
    const c = state.config;
    const names = c.games.map((g) => `${C.gameOf(g).icon} ${C.gameOf(g).name}${c.topics[g] ? ` (${c.topics[g].length} assunto${c.topics[g].length === 1 ? '' : 's'})` : ''}`).join(', ');
    $('mt-m-config').innerHTML = `
      <dt>Formato</dt><dd>${C.FORMATOS[c.formato]}</dd>
      <dt>Nível</dt><dd>${c.nivel}</dd>
      <dt>Rodadas</dt><dd>${state.round ? `${state.round.number} de ` : ''}${c.rodadas}</dd>
      <dt>Jogos</dt><dd>${esc(names)}</dd>
      <dt>Escolha do jogo</dt><dd>${C.ROTACAO[c.rotacao]}</dd>
      <dt>Tempo máximo</dt><dd>${c.tempoMin} min por rodada</dd>
      <dt>Opções</dt><dd>${[c.balancear ? '⚖️ equilibradas' : '🎲 sorteadas', c.auto ? '⏩ automática' : '', c.bonus ? '⭐ bônus' : ''].filter(Boolean).join(' · ')}</dd>`;
  }

  function gamePicker(id) {
    return `<label class="mt-inline">Jogo: <select id="${id}">${state.config.games.map((g) => `<option value="${esc(g)}">${esc(C.gameOf(g).icon)} ${esc(C.gameOf(g).name)}</option>`).join('')}</select></label>`;
  }

  function renderActions() {
    const s = state;
    const box = $('mt-m-actions');
    const people = s.teams.reduce((n, t) => n + t.members.length, 0) + s.waiting.length;
    const btn = (id, label, cls = 'btn-primary') => `<button type="button" class="btn ${cls}" data-act="${id}">${label}</button>`;
    let html = '';
    if (s.status === 'sala_de_espera') {
      html = `<p class="mt-sub">👋 ${people} na sala. ${people < 2 ? 'Esperando as crianças entrarem…' : 'Quando todos estiverem aqui, monte as equipes e comece!'}</p><div class="mt-row">
        ${s.config.formato !== 'solo' ? `${btn('equilibrar', '⚖️ Equilibrar equipes', 'btn-violet')}${btn('sortear', '🎲 Sortear equipes', 'btn-ghost')}` : ''}
        ${s.config.rotacao === 'professor' ? gamePicker('mt-m-pick') : ''}
        ${btn('start', '🏁 Começar a maratona', 'btn-success btn-lg')}
        ${btn('cancel', '✖ Cancelar', 'btn-ghost')}</div>`;
    } else if (s.status === 'votacao') {
      const v = s.round.vote;
      const total = Object.values(v.counts).reduce((a, b) => a + b, 0);
      html = `<p class="mt-sub">🗳️ Votação da rodada ${s.round.number}: ${total} voto${total === 1 ? '' : 's'} · <b id="mt-m-vote-timer"></b></p>
        <ul class="mt-vote-bars">${v.options.map((g) => `<li><span>${esc(C.gameOf(g).icon)} ${esc(C.gameOf(g).name)}</span><span class="mt-bar"><i style="width:${total ? Math.round(((v.counts[g] || 0) / total) * 100) : 0}%"></i></span><b>${v.counts[g] || 0}</b></li>`).join('')}</ul>
        <div class="mt-row">${btn('end_vote', '⏭ Encerrar a votação agora', 'btn-violet')}${btn('end', '🏁 Encerrar a maratona', 'btn-ghost')}</div>`;
      stops.push(C.ticker(() => { const el = $('mt-m-vote-timer'); if (el) el.textContent = C.formatTime(v.until - C.now()); }));
    } else if (s.status === 'preparando' || s.status === 'disputa') {
      html = `<div class="mt-row">${btn('end', '🏁 Encerrar a maratona', 'btn-ghost')}</div>`;
    } else if (s.status === 'entre_rodadas') {
      const last = s.round && s.round.number >= s.config.rodadas;
      html = `<p class="mt-sub" id="mt-m-next-info">${last ? 'Essa foi a última rodada.' : `Rodada ${s.round.number} de ${s.config.rodadas} apurada.`}</p><div class="mt-row">
        ${!last && s.config.rotacao === 'professor' ? gamePicker('mt-m-pick') : ''}
        ${btn('next', last ? '🏆 Ver o resultado final' : '▶ Próxima rodada', 'btn-success btn-lg')}
        ${btn('pause', '⏸ Pausar', 'btn-ghost')}${btn('end', '🏁 Encerrar a maratona', 'btn-ghost')}</div>`;
      if (s.autoAt) stops.push(C.ticker(() => { const el = $('mt-m-next-info'); if (el) el.textContent = `⏩ A próxima rodada abre sozinha em ${C.formatTime(s.autoAt - C.now())}.`; }));
    } else if (s.status === 'pausada') {
      html = `<p class="mt-sub">⏸️ Maratona pausada.</p><div class="mt-row">${btn('resume', '▶ Retomar', 'btn-success')}${btn('end', '🏁 Encerrar a maratona', 'btn-ghost')}</div>`;
    } else {
      html = `<p class="mt-sub">🏆 Maratona encerrada. O resultado fica salvo.</p><div class="mt-row">${btn('telao', '📺 Mostrar o pódio no telão', 'btn-violet')}${btn('new', '➕ Nova maratona', 'btn-success')}</div>`;
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => onAction(b.dataset.act)));
  }

  async function onAction(a) {
    const pick = () => ($('mt-m-pick') ? $('mt-m-pick').value : null);
    if (a === 'equilibrar' || a === 'sortear') { if (await act('mt:teams', { how: a })) play('whoosh'); return; }
    if (a === 'start') { if (await act('mt:start', { gameId: pick() })) play('start'); return; }
    if (a === 'next') { await act('mt:next', { gameId: pick() }); return; }
    if (a === 'end_vote') { await act('mt:end_vote'); return; }
    if (a === 'pause') { await act('mt:pause'); return; }
    if (a === 'resume') { await act('mt:resume'); return; }
    if (a === 'telao') { openTelao(); return; }
    if (a === 'new') { clearSession(); showCreate(); return; }
    if (a === 'cancel' || a === 'end') {
      const running = state.status === 'preparando' || state.status === 'disputa';
      const ok = await confirmModal(a === 'cancel' ? 'Cancelar a maratona?' : 'Encerrar a maratona?',
        running ? 'A rodada em andamento é apurada como está agora (quem não terminou fica com 0).' : 'O resultado até aqui fica salvo.', a === 'cancel' ? 'Cancelar' : 'Encerrar');
      if (ok) await act('mt:end', {}, 'Maratona encerrada.');
    }
  }

  function renderRoundPanel() {
    const s = state;
    const box = $('mt-m-round');
    const r = s.round;
    if (!r || !['preparando', 'disputa'].includes(s.status)) { box.hidden = true; return; }
    box.hidden = false;
    const game = C.gameOf(r.gameId);
    const entryName = (e) => {
      const p = s.teams.flatMap((t) => t.members).find((m) => m.studentId === e.studentId);
      return p ? `${esc(p.avatar)} ${esc(p.name.split(' ')[0])}` : '?';
    };
    box.innerHTML = `
      <div class="mt-round-head"><h3 class="mt-h3">${esc(game.icon)} Rodada ${r.number}: ${esc(r.title || game.name)}</h3><span class="mt-timer" id="mt-m-timer"></span></div>
      <p class="mt-sub">${r.kind === 'duelo' ? '⚔️ Duelo pela rede' : '🏁 Corrida: todos jogam a mesma fase'} · ${s.status === 'preparando' ? 'largada em instantes' : 'em andamento'}</p>
      <ul class="mt-matches">${r.matches.map((x) => `<li class="mt-match">
        <div class="mt-match-sides">${x.sideB ? `${C.teamLabel(s, x.sideA)} <span class="mt-vs">×</span> ${C.teamLabel(s, x.sideB)}` : `${C.teamLabel(s, x.sideA)} <small>descansa</small>`}
          ${x.status === 'resolvido' ? `<small class="mt-done">${C.outcomeText(s, x)}</small>` : ''}</div>
        <div class="mt-entries">${x.entries.map((e) => `<span class="mt-entry is-${esc(e.status)}" title="${esc(C.ENTRY[e.status] || e.status)}">${entryName(e)} <small>${C.ENTRY[e.status] || ''}${e.stars != null && e.status === 'concluida' && r.kind === 'corrida' ? ` ${'⭐'.repeat(e.stars)}` : ''}</small></span>`).join('')}</div>
        ${x.sideB && x.status === 'aberto' ? `<div class="mt-resolve"><select data-match="${esc(x.id)}" aria-label="Resolver o confronto">
          <option value="">Resolver…</option><option value="a">Vitória de ${C.teamLabel(s, x.sideA, { short: true })}</option><option value="b">Vitória de ${C.teamLabel(s, x.sideB, { short: true })}</option>
          <option value="empate">Empate</option><option value="wo_a">W.O. para ${C.teamLabel(s, x.sideA, { short: true })}</option><option value="wo_b">W.O. para ${C.teamLabel(s, x.sideB, { short: true })}</option><option value="nulo">Anular (0 a 0)</option>
        </select></div>` : ''}
      </li>`).join('')}</ul>`;
    stops.push(C.ticker(() => {
      const el = $('mt-m-timer');
      if (!el) return;
      const left = (s.status === 'preparando' ? r.startsAt : r.deadlineAt) - C.now();
      el.textContent = s.status === 'preparando' ? `largada ${C.formatTime(left)}` : C.formatTime(left);
      el.classList.toggle('is-late', s.status === 'disputa' && left < 30000);
    }, 500));
    box.querySelectorAll('[data-match]').forEach((sel) => sel.addEventListener('change', async () => {
      if (!sel.value) return;
      const motivo = window.prompt('Motivo (fica registrado no histórico):', '') ?? null;
      if (motivo === null) { sel.value = ''; return; }
      await act('mt:resolve', { matchId: sel.dataset.match, outcome: sel.value, motivo }, 'Confronto resolvido.');
    }));
  }

  function renderPeople() {
    const s = state;
    const lobby = s.status === 'sala_de_espera';
    const teamsMode = s.config.formato !== 'solo';
    $('mt-m-teams-title').textContent = s.teams.length ? (teamsMode ? `👥 Equipes (${s.teams.length})` : `👤 Participantes (${s.teams.length})`) : `👋 Na sala (${s.waiting.length})`;
    const ended = s.status === 'encerrada';
    C.renderTeams($('mt-m-teams'), s, {
      extra: (t, p) => {
        const out = [];
        if (p.strength != null) out.push(`<span class="mt-strength" title="Força estimada (pontos globais)"><i style="width:${Math.round(p.strength)}%"></i></span>`);
        if (lobby && teamsMode && s.teams.length > 1) {
          out.push(`<select class="mt-move" data-move="${esc(p.studentId)}" aria-label="Trocar de equipe">${s.teams.map((o) => `<option value="${esc(o.id)}" ${o.id === t.id ? 'selected' : ''}>${esc(o.icon)} ${esc(o.name)}</option>`).join('')}</select>`);
        }
        if (!lobby && !ended) {
          out.push(p.status === 'dispensado'
            ? `<button type="button" class="btn-mini" data-readmit="${esc(p.studentId)}" title="Volta a contar na média">↩ voltar</button>`
            : `<button type="button" class="btn-mini" data-excuse="${esc(p.studentId)}" title="Faltou por motivo justo: sai da média da equipe">🙏 dispensar</button>`);
        }
        return out.join('');
      },
    });
    const wait = $('mt-m-waiting');
    wait.innerHTML = s.waiting.length ? `<p class="mt-sub">${s.teams.length ? 'Ainda sem equipe:' : ''}</p><ul class="mt-members mt-waiting-list">${s.waiting.map((p) => `<li class="${p.online ? '' : 'is-off'}"><span class="avatar-badge">${esc(p.avatar)}</span><span class="mt-mname">${esc(p.name)}</span>${p.online ? '' : '<small>📴</small>'}</li>`).join('')}</ul>` : (s.teams.length ? '' : '<p class="muted">Ninguém entrou ainda. Mostre o QR Code ou o código para a turma 👉</p>');
    $('mt-m-teams').querySelectorAll('[data-move]').forEach((sel) => sel.addEventListener('change', () => act('mt:move', { studentId: sel.dataset.move, teamId: sel.value })));
    $('mt-m-teams').querySelectorAll('[data-excuse]').forEach((b) => b.addEventListener('click', () => act('mt:excuse', { studentId: b.dataset.excuse }, 'Dispensado: sai da média da equipe.')));
    $('mt-m-teams').querySelectorAll('[data-readmit]').forEach((b) => b.addEventListener('click', () => act('mt:readmit', { studentId: b.dataset.readmit })));
  }

  function openTelao() {
    if (session) window.open(`/telao/maratona?sala=${encodeURIComponent(session.code)}`, 'maratona-telao');
  }

  // ---------------- botões e eventos ----------------
  $('mt-form').addEventListener('submit', create);
  document.querySelectorAll('input[name="mt-nivel"]').forEach((r) => r.addEventListener('change', loadCatalog));
  document.querySelectorAll('input[name="mt-formato"], input[name="mt-rotacao"]').forEach((r) => r.addEventListener('change', renderOrdem));
  ['mt-f-balancear', 'mt-f-auto', 'mt-f-bonus'].forEach((id) => $(id).addEventListener('change', renderSummary));
  let tempoTimer = null;
  $('mt-f-tempo').addEventListener('input', () => { renderSummary(); clearTimeout(tempoTimer); tempoTimer = setTimeout(loadCatalog, 400); });
  ['mt-f-rodadas', 'mt-f-voto'].forEach((id) => $(id).addEventListener('input', renderSummary));
  // ao sair do campo, o número volta para dentro dos limites
  ['mt-f-rodadas', 'mt-f-tempo', 'mt-f-voto'].forEach((id) => $(id).addEventListener('change', () => { $(id).value = clampInput(id); }));
  document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const el = $(b.dataset.step);
    el.value = Math.max(Number(el.min), Math.min(Number(el.max), clampInput(b.dataset.step) + Number(b.dataset.d)));
    el.dispatchEvent(new Event('input'));
  }));
  $('mt-f-all').addEventListener('click', () => { visibleGames().forEach((g) => form.games.add(g.id)); renderGames(); });
  $('mt-f-none').addEventListener('click', () => {
    const hadTopics = Object.keys(form.topics).length > 0;
    form.games.clear();
    form.topics = {};
    if (hadTopics) loadCatalog(); else renderGames();
  });
  $('mt-sum-bar').addEventListener('click', () => $('mt-create-submit').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  $('mt-create-back').addEventListener('click', () => window.PlataformaRouter.go('/professor'));
  $('mt-master-back').addEventListener('click', () => window.PlataformaRouter.go('/professor'));
  $('mt-m-telao').addEventListener('click', openTelao);
  $('mt-archive-back').addEventListener('click', () => { window.MaratonaFinale.cancel($('mt-archive-root')); showScreen('mt-create'); });
  $('mt-resume-go').addEventListener('click', async () => { session = loadSession(); if (session) await reconnect(); });
  $('mt-resume-forget').addEventListener('click', () => { clearSession(); $('mt-resume').hidden = true; });

  socket.on('mt:state', (s) => { if (active && session) render(s); });
  socket.on('connect', () => { if (active && session) reconnect(); });

  async function enter() {
    active = true;
    await C.loadGames();
    session = loadSession();
    if (session) { if (await reconnect()) return; }
    showCreate();
  }
  function leave() { active = false; stopTimers(); }

  window.MaratonaMaster = { enter, leave };
})();
