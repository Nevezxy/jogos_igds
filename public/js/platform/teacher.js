// public/js/platform/teacher.js
// Área do professor (/professor): PIN (quando o servidor tem PROFESSOR_PIN),
// ferramentas dos jogos (`teacherTool` no registro; ex.: a sala de bingo, em
// /professor/<id>) e a
// turma: progresso de cada educando, separado por turma (filtro, mudar a
// turma de vários de uma vez), cadastro em lote, renomear, juntar contas
// repetidas, liberar fases, desativar e ligar/desligar o autocadastro.
// O token do professor fica no localStorage e vai no cabeçalho X-Teacher-Token.

(function () {
  const { showScreen, toast, confirmModal, escapeHtml } = window.BingoUI;
  const { play } = window.BingoSound;
  const go = (url) => window.PlataformaRouter.go(url);

  const STORAGE_KEY = 'igds_teacher_v1';
  const FILTER_KEY = 'igds_teacher_turma_v1';
  const ALL = '*';
  const NONE = '';
  let token = null;
  let pinRequired = false;
  let students = [];
  let classes = [];
  let classFilter = ALL; // ALL, NONE (sem turma) ou o nome da turma
  const selected = new Set();
  let pendingUrl = '/professor';

  try { classFilter = localStorage.getItem(FILTER_KEY) ?? ALL; } catch (e) { /* ignore */ }

  try { token = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }

  function storeToken(value) {
    token = value || null;
    try {
      if (token) localStorage.setItem(STORAGE_KEY, token);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  async function request(method, route, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Teacher-Token'] = token;
    const res = await fetch(`/api/teacher${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.message || 'Algo deu errado.');
      err.code = data.code;
      err.status = res.status;
      if (data.code === 'PROFESSOR_NAO_AUTORIZADO') storeToken(null);
      throw err;
    }
    return data;
  }

  // Garante a entrada na área: sem PIN no servidor, entra direto.
  async function ensureAuth(url) {
    const status = await request('GET', '/status');
    pinRequired = status.pinRequired;
    document.getElementById('teacher-logout').hidden = !pinRequired;
    if (status.authenticated && (token || !pinRequired)) {
      if (!token) storeToken((await request('POST', '/login', {})).token);
      return true;
    }
    pendingUrl = url;
    document.getElementById('input-teacher-pin').value = '';
    document.getElementById('teacher-login-error').textContent = '';
    showScreen('screen-teacher-login');
    setTimeout(() => document.getElementById('input-teacher-pin').focus(), 60);
    return false;
  }

  document.getElementById('form-teacher-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const errorEl = document.getElementById('teacher-login-error');
    errorEl.textContent = '';
    try {
      const res = await request('POST', '/login', { pin: document.getElementById('input-teacher-pin').value });
      storeToken(res.token);
      play('start');
      go(pendingUrl || '/professor');
    } catch (e) {
      errorEl.textContent = e.code === 'PIN_INVALIDO' ? 'PIN incorreto. Tente de novo.' : e.message;
      play('bonk');
      window.BingoFx.shake(ev.target);
    }
  });
  document.getElementById('teacher-login-back').addEventListener('click', () => window.PlataformaAuth.goHome());

  // ---------------- tela principal ----------------

  // Um cartão por jogo com `teacherTool` no registro (ex.: Bingo). O jogo só é
  // baixado quando o professor abre a ferramenta.
  async function renderTools() {
    const wrap = document.getElementById('teacher-tools');
    let games = [];
    try { games = await window.Plataforma.listGames(); } catch (e) { /* sem ferramentas */ }
    wrap.innerHTML = '';
    games.filter((g) => g.teacherTool && g.status === 'active').forEach((game) => {
      const tool = { id: game.id, ...game.teacherTool };
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'teacher-tool';
      card.innerHTML = `<span class="teacher-tool-icon" aria-hidden="true">${escapeHtml(tool.icon)}</span>
        <span class="teacher-tool-name">${escapeHtml(tool.name)}</span>
        <span class="teacher-tool-desc">${escapeHtml(tool.description)}</span>`;
      card.addEventListener('click', () => { play('pop'); go(`/professor/${tool.id}`); });
      wrap.appendChild(card);
    });
  }

  function when(ts) {
    if (!ts) return 'nunca';
    const date = new Date(ts);
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (days <= 0) return `hoje, ${time}`;
    if (days === 1) return `ontem, ${time}`;
    if (days < 30) return `há ${days} dias`;
    return date.toLocaleDateString('pt-BR');
  }

  // Como cada jogo aparece na tabela (a partir do teacherSummary do servidor).
  // Jogo sem renderizador próprio aparece com os campos do resumo.
  const GAME_CELLS = {
    digitacao(d) {
      if (!d) return '<span class="muted">—</span>';
      const keys = d.toughest.length
        ? `<div class="teacher-keys" title="Teclas com mais erro">${d.toughest.map((k) => `<span>${escapeHtml(k === ' ' ? '␣' : k)}</span>`).join('')}</div>`
        : '';
      return `<div class="teacher-game"><strong>${escapeHtml(d.current)}</strong>
        <span>⭐ ${d.stars}/${d.maxStars} · ${d.levelsDone}/${d.totalLevels} fases · ${d.avgWpm} PPM</span>
        ${d.unlockedAll && d.lockable ? '<span class="teacher-badge">🔓 fases liberadas</span>' : ''}${keys}</div>`;
    },
    bingo(d) {
      return d && d.wins ? `🏆 ${d.wins}` : '<span class="muted">—</span>';
    },
    matematica(d) {
      if (!d || !d.problems) return '<span class="muted">—</span>';
      const facts = d.toughest.length
        ? `<div class="teacher-keys teacher-facts" title="Contas que mais erra">${d.toughest.map((f) => `<span>${escapeHtml(f)}</span>`).join('')}</div>`
        : '';
      return `<div class="teacher-game"><strong>${escapeHtml(d.current)}</strong>
        <span>⭐ ${d.stars}/${d.maxStars} · ${d.levelsDone}/${d.totalLevels} fases · ${d.accuracy}% de primeira</span>${facts}</div>`;
    },
    desafio(d) {
      if (!d || !d.races) return '<span class="muted">—</span>';
      return `<div class="teacher-game"><strong>🏁 ${d.races} ${d.races === 1 ? 'corrida' : 'corridas'}${d.wins ? ` · 🏆 ${d.wins}` : ''}</strong>
        <span>melhor ${d.bestWpm} PPM · média ${d.avgWpm} PPM</span></div>`;
    },
  };
  function genericCell(d) {
    if (!d || typeof d !== 'object') return '<span class="muted">—</span>';
    return `<div class="teacher-game">${Object.entries(d)
      .map(([k, v]) => `<span>${escapeHtml(k)}: <strong>${escapeHtml(Array.isArray(v) ? v.join(' ') : v)}</strong></span>`).join('')}</div>`;
  }

  // Colunas: uma por jogo que manda resumo para o professor, na ordem do registro.
  let gameColumns = [];
  async function buildColumns() {
    const ids = new Set(students.flatMap((s) => Object.keys(s.games || {})));
    let catalog = [];
    try { catalog = await window.Plataforma.listGames(); } catch (e) { /* usa só os ids */ }
    gameColumns = [
      ...catalog.filter((g) => ids.has(g.id)),
      ...[...ids].filter((id) => !catalog.some((g) => g.id === id)).map((id) => ({ id, icon: '🎲', name: id })),
    ];
    const head = document.getElementById('teacher-head');
    head.innerHTML = '<th class="teacher-check"><input type="checkbox" id="teacher-check-all" aria-label="Selecionar todos da lista" /></th>'
      + '<th>Educando</th><th>Turma</th><th>Último acesso</th>'
      + gameColumns.map((g) => `<th>${escapeHtml(g.icon)} ${escapeHtml(g.name)}</th>`).join('')
      + '<th>Ações</th>';
  }

  // ---------------- turmas ----------------

  const inClass = (s, filter) => (filter === ALL ? true : (s.className || NONE) === filter);

  function setFilter(value) {
    classFilter = value;
    try { localStorage.setItem(FILTER_KEY, value); } catch (e) { /* ignore */ }
    selected.clear();
    renderClasses();
    renderRows();
  }

  // Um botão por turma (com quantos educandos tem), mais "Todas" e "Sem turma".
  function renderClasses() {
    const wrap = document.getElementById('teacher-classes');
    const withoutClass = students.filter((s) => !s.className).length;
    if (classFilter !== ALL && classFilter !== NONE && !classes.includes(classFilter)) classFilter = ALL;
    if (classFilter === NONE && !withoutClass) classFilter = ALL;
    document.getElementById('teacher-class-options').innerHTML = classes.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
    if (!classes.length) { wrap.innerHTML = ''; return; } // ainda sem turmas: nada para filtrar
    const chips = [
      { value: ALL, label: 'Todas', count: students.length },
      ...classes.map((c) => ({ value: c, label: `🏫 ${c}`, count: students.filter((s) => s.className === c).length })),
      ...(withoutClass ? [{ value: NONE, label: 'Sem turma', count: withoutClass, none: true }] : []),
    ];
    wrap.innerHTML = chips.map((c) => `<button type="button" class="teacher-class-chip${c.none ? ' is-none' : ''}" role="radio"
      aria-checked="${c.value === classFilter}" data-class="${escapeHtml(c.value)}">${escapeHtml(c.label)} <small>${c.count}</small></button>`).join('');
    wrap.querySelectorAll('[data-class]').forEach((btn) => btn.addEventListener('click', () => { play('pop'); setFilter(btn.dataset.class); }));
  }

  function renderSelection() {
    const bar = document.getElementById('teacher-selection');
    bar.hidden = selected.size === 0;
    document.getElementById('teacher-selection-count').textContent = selected.size === 1 ? '1 selecionado' : `${selected.size} selecionados`;
  }

  // Janela para escolher a turma de um ou mais educandos.
  function chooseClass(list) {
    const current = list.length === 1 ? (list[0].className || '') : '';
    const who = list.length === 1 ? list[0].name : `${list.length} educandos`;
    openModal({
      title: `🏫 Turma de ${who}`,
      okLabel: 'Salvar turma',
      bodyHtml: `<label class="field"><span>Turma</span>
        <input name="className" type="text" maxlength="20" list="teacher-class-options" value="${escapeHtml(current)}"
          placeholder="ex.: 5A, 3º ano B" autocomplete="off" /></label>
        ${classes.length ? `<div class="teacher-classes">${classes.map((c) => `<button type="button" class="teacher-class-chip" data-pick="${escapeHtml(c)}">🏫 ${escapeHtml(c)}</button>`).join('')}</div>` : ''}
        <p class="muted">Deixe em branco para tirar da turma. Mudar a turma não mexe no progresso.</p>`,
      async onOk(form) {
        const res = await request('POST', '/students/class', { ids: list.map((s) => s.id), className: form.elements.className.value });
        toast(res.className ? `${who} na turma ${res.className} 🏫` : `${who} sem turma agora`, 'success');
        selected.clear();
        loadClass();
        return true;
      },
    });
    document.querySelectorAll('#teacher-modal-body [data-pick]').forEach((btn) => btn.addEventListener('click', () => {
      document.querySelector('#teacher-modal-body [name="className"]').value = btn.dataset.pick;
    }));
  }

  document.getElementById('teacher-selection-class').addEventListener('click', () => {
    chooseClass(students.filter((s) => selected.has(s.id)));
  });
  document.getElementById('teacher-selection-clear').addEventListener('click', () => { selected.clear(); renderRows(); });

  function renderRows() {
    const q = document.getElementById('teacher-search').value.trim().toLowerCase()
      .normalize('NFD').replace(/\p{M}/gu, '');
    const rows = document.getElementById('teacher-rows');
    rows.innerHTML = '';
    const visible = students.filter((s) => inClass(s, classFilter)
      && (!q || s.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(q)));
    for (const id of [...selected]) if (!visible.some((s) => s.id === id)) selected.delete(id);
    document.getElementById('teacher-count').textContent = classFilter === ALL ? students.length : `${visible.length}/${students.length}`;
    document.getElementById('teacher-empty').hidden = students.length > 0;
    document.getElementById('teacher-table').hidden = students.length === 0;
    const checkAll = document.getElementById('teacher-check-all');
    if (checkAll) {
      checkAll.checked = visible.length > 0 && visible.every((s) => selected.has(s.id));
      checkAll.indeterminate = !checkAll.checked && visible.some((s) => selected.has(s.id));
      checkAll.onchange = () => {
        visible.forEach((s) => (checkAll.checked ? selected.add(s.id) : selected.delete(s.id)));
        renderRows();
      };
    }
    renderSelection();
    visible.forEach((s) => {
      const tr = document.createElement('tr');
      tr.classList.toggle('is-inactive', !s.active);
      tr.classList.toggle('is-selected', selected.has(s.id));
      const typing = s.games.digitacao;
      tr.innerHTML = `
        <td class="teacher-check"><input type="checkbox" data-select ${selected.has(s.id) ? 'checked' : ''} aria-label="Selecionar ${escapeHtml(s.name)}" /></td>
        <td><span class="avatar-badge">${escapeHtml(s.avatar)}</span> <strong>${escapeHtml(s.name)}</strong>
          ${s.active ? '' : '<span class="teacher-badge teacher-badge-off">desativada</span>'}</td>
        <td><button type="button" class="teacher-class-btn${s.className ? '' : ' is-none'}" data-act="turma" title="Mudar a turma">${s.className ? `🏫 ${escapeHtml(s.className)}` : '+ turma'}</button></td>
        <td>${escapeHtml(when(s.lastLoginAt))}</td>
        ${gameColumns.map((g) => `<td>${(GAME_CELLS[g.id] || genericCell)(s.games[g.id])}</td>`).join('')}
        <td class="teacher-actions">
          <button type="button" class="btn-mini" data-act="rename" title="Corrigir o nome">✏️ Renomear</button>
          <button type="button" class="btn-mini" data-act="merge" title="Juntar com outra conta da mesma criança">🔀 Juntar</button>
          ${typing && typing.lockable ? `<button type="button" class="btn-mini" data-act="unlock" title="Liberar ou bloquear todas as fases do Teclado Mágico">${typing.unlockedAll ? '🔒 Bloquear fases' : '🔓 Liberar fases'}</button>` : ''}
          <button type="button" class="btn-mini" data-act="active">${s.active ? '⏸ Desativar' : '▶ Reativar'}</button>
        </td>`;
      tr.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => ACTIONS[btn.dataset.act](s)));
      tr.querySelector('[data-select]').addEventListener('change', (ev) => {
        if (ev.target.checked) selected.add(s.id); else selected.delete(s.id);
        renderRows();
      });
      rows.appendChild(tr);
    });
  }

  async function loadClass() {
    try {
      const res = await request('GET', '/students');
      students = res.students;
      classes = res.classes || [];
      document.getElementById('teacher-allow-signup').checked = Boolean(res.settings.allowSignup);
      await buildColumns();
      renderClasses();
      renderRows();
    } catch (e) {
      if (e.code === 'PROFESSOR_NAO_AUTORIZADO') ensureAuth('/professor');
      else toast(e.message, 'error');
    }
  }

  // ---------------- janela de edição ----------------

  // Abre a janela com `bodyHtml`; `onOk(form)` salva e devolve true para fechar.
  function openModal({ title, bodyHtml, okLabel = 'Salvar', onOk }) {
    const overlay = document.getElementById('teacher-modal');
    const form = document.getElementById('teacher-modal-form');
    const errorEl = document.getElementById('teacher-modal-error');
    document.getElementById('teacher-modal-title').textContent = title;
    document.getElementById('teacher-modal-body').innerHTML = bodyHtml;
    document.getElementById('teacher-modal-ok').textContent = okLabel;
    errorEl.textContent = '';
    overlay.hidden = false;
    setTimeout(() => { const first = form.querySelector('input, textarea, select'); if (first) first.focus(); }, 60);

    function close() {
      overlay.hidden = true;
      form.removeEventListener('submit', submit);
      document.getElementById('teacher-modal-cancel').removeEventListener('click', close);
      overlay.removeEventListener('keydown', onKey);
    }
    async function submit(ev) {
      ev.preventDefault();
      errorEl.textContent = '';
      try {
        if (await onOk(form)) close();
      } catch (e) {
        errorEl.textContent = e.message;
      }
    }
    function onKey(ev) { if (ev.key === 'Escape') close(); }
    form.addEventListener('submit', submit);
    document.getElementById('teacher-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('keydown', onKey);
  }

  const ACTIONS = {
    turma(s) { chooseClass([s]); },
    rename(s) {
      openModal({
        title: `✏️ Renomear ${s.name}`,
        bodyHtml: `<label class="field"><span>Nome e sobrenome</span>
          <input name="name" type="text" maxlength="40" value="${escapeHtml(s.name)}" autocomplete="off" /></label>
          <p class="muted">Dica: para duas crianças com o mesmo nome, acrescente outro sobrenome (ou a turma, como "Ana Souza 5A").</p>`,
        async onOk(form) {
          await request('POST', `/students/${s.id}/rename`, { name: form.elements.name.value });
          toast('Nome corrigido ✏️', 'success');
          loadClass();
          return true;
        },
      });
    },
    merge(s) {
      const others = students.filter((o) => o.id !== s.id);
      if (!others.length) { toast('Não há outra conta para juntar.', 'info'); return; }
      openModal({
        title: `🔀 Juntar ${s.name}`,
        okLabel: 'Juntar contas',
        bodyHtml: `<p>Use quando a mesma criança criou duas contas. O progresso das duas fica na conta escolhida abaixo,
          e <strong>${escapeHtml(s.name)}</strong> deixa de existir.</p>
          <label class="field"><span>Juntar na conta</span><select name="into">
          ${others.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.avatar)} ${escapeHtml(o.name)}</option>`).join('')}
          </select></label>`,
        async onOk(form) {
          const into = students.find((o) => o.id === form.elements.into.value);
          const ok = await confirmModal('Juntar contas?', `${s.name} vai ser juntada em ${into.name}. Isso não pode ser desfeito.`, 'Juntar');
          if (!ok) return false;
          await request('POST', '/students/merge', { fromId: s.id, intoId: into.id });
          toast(`Contas juntadas em ${into.name} 🔀`, 'success');
          loadClass();
          return true;
        },
      });
    },
    async unlock(s) {
      const unlocked = !(s.games.digitacao && s.games.digitacao.unlockedAll);
      try {
        await request('POST', `/students/${s.id}/games/digitacao/unlock-all`, { unlocked });
        toast(unlocked ? `Todas as fases liberadas para ${s.firstName} 🔓` : `Fases de ${s.firstName} voltaram ao normal 🔒`, 'success');
        loadClass();
      } catch (e) { toast(e.message, 'error'); }
    },
    async active(s) {
      if (s.active) {
        const ok = await confirmModal('Desativar conta?', `${s.name} não vai conseguir entrar até você reativar. O progresso fica guardado.`, 'Desativar');
        if (!ok) return;
      }
      try {
        await request('POST', `/students/${s.id}/active`, { active: !s.active });
        loadClass();
      } catch (e) { toast(e.message, 'error'); }
    },
  };

  document.getElementById('teacher-bulk').addEventListener('click', () => {
    openModal({
      title: '➕ Cadastrar turma',
      okLabel: 'Cadastrar',
      bodyHtml: `<label class="field"><span>Turma (opcional)</span>
        <input name="className" type="text" maxlength="20" list="teacher-class-options" placeholder="ex.: 5A"
          value="${escapeHtml(classFilter !== ALL && classFilter !== NONE ? classFilter : '')}" autocomplete="off" /></label>
        <label class="field"><span>Um nome e sobrenome por linha</span>
        <textarea name="names" rows="8" placeholder="Ana Souza&#10;Bruno Lima&#10;Carla Dias"></textarea></label>
        <p class="muted">Cada criança recebe um bichinho sorteado e pode trocar depois no painel.</p>`,
      async onOk(form) {
        const res = await request('POST', '/students', { names: form.elements.names.value, className: form.elements.className.value });
        const skipped = res.skipped.length ? ` · ${res.skipped.length} pulado(s): ${res.skipped.map((x) => `${x.name} (${x.reason})`).join('; ')}` : '';
        toast(`${res.created.length} conta(s) criada(s)${skipped}`, res.skipped.length ? 'info' : 'success', 8000);
        loadClass();
        return true;
      },
    });
  });

  document.getElementById('teacher-search').addEventListener('input', renderRows);
  document.getElementById('teacher-allow-signup').addEventListener('change', async (ev) => {
    try {
      await request('POST', '/settings', { allowSignup: ev.target.checked });
      toast(ev.target.checked ? 'As crianças podem criar conta no login.' : 'Só você cadastra contas agora.', 'success');
    } catch (e) {
      ev.target.checked = !ev.target.checked;
      toast(e.message, 'error');
    }
  });
  document.getElementById('teacher-home').addEventListener('click', () => window.PlataformaAuth.goHome());
  document.getElementById('teacher-logout').addEventListener('click', async () => {
    try { await request('POST', '/logout'); } catch (e) { /* sai mesmo assim */ }
    storeToken(null);
    window.PlataformaAuth.goHome();
  });

  // ---------------- rotas ----------------

  async function show() {
    if (!(await ensureAuth('/professor'))) return;
    showScreen('screen-teacher');
    renderTools();
    await loadClass();
  }

  // Abre a ferramenta de um jogo (o módulo do jogo exporta `teacher`:
  // { enter(), leave() }). Devolve o que o roteador chama ao sair.
  async function enterTool(id) {
    if (!(await ensureAuth(`/professor/${id}`))) return null;
    let module;
    try {
      ({ module } = await window.Plataforma.ensureLoaded(id));
    } catch (e) {
      console.error(e);
      toast('Não consegui abrir essa ferramenta 😵', 'error');
      go('/professor');
      return null;
    }
    if (!module.teacher) { go('/professor'); return null; }
    module.teacher.enter();
    return { leave: () => module.teacher.leave && module.teacher.leave() };
  }

  window.PlataformaTeacher = {
    show,
    enterTool,
    token: () => token,
  };
})();
