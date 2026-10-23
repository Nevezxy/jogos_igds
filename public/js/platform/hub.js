// public/js/platform/hub.js
// Painel de seleção de jogos: quem está logado (com troca de bichinho e
// "Não sou eu / Sair") e um cartão por jogo do registro (/api/games),
// separados por assunto (`subject` no registro).
// Nenhum jogo fica fixo no HTML — um jogo novo no registro aparece aqui.

(function () {
  const { showScreen, toast, createAvatarPicker } = window.BingoUI;
  const { play } = window.BingoSound;
  const auth = window.PlataformaAuth;
  const go = (url) => window.PlataformaRouter.go(url);

  const grid = document.getElementById('game-grid');
  // Seções do painel, nesta ordem. Jogo sem `subject` vai para "Outros".
  const SUBJECTS = [
    { id: 'digitacao', label: '⌨️ Digitação' },
    { id: 'matematica', label: '🔢 Matemática' },
    { id: 'mouse', label: '🖱️ Mouse' },
    { id: 'raciocinio', label: '🧩 Raciocínio' },
    { id: 'tabuleiro', label: '♟️ Tabuleiro' },
    { id: 'turma', label: '👥 Com a turma' },
    { id: 'outros', label: '🎲 Outros' },
  ];
  const MODE_LABELS = {
    turma: '👥 com a turma',
    solo: '🙋 sozinho(a)',
  };
  // Frases do mascote no painel, sorteadas a cada visita.
  const GREETINGS = [
    'Do que vamos brincar hoje? 🎈',
    'Escolha um jogo e bora! 🚀',
    'Que bom te ver de novo! 💜',
    'Hoje é dia de aprender brincando! ✨',
  ];

  function renderUser() {
    const student = auth.student();
    if (!student) return;
    document.getElementById('hub-avatar').textContent = student.avatar;
    document.getElementById('hub-first-name').textContent = student.firstName;
  }

  function cardFor(game, index) {
    const soon = game.status === 'soon';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-card';
    card.dataset.game = game.id;
    card.style.setProperty('--card', `var(--${game.color || 'violet'})`);
    card.style.setProperty('--card-dark', `var(--${game.color || 'violet'}-dark)`);
    card.style.setProperty('--i', index);
    card.disabled = soon;

    const icon = document.createElement('span');
    icon.className = 'game-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = game.icon;

    const name = document.createElement('span');
    name.className = 'game-card-name';
    name.textContent = game.name;

    const tagline = document.createElement('span');
    tagline.className = 'game-card-tagline';
    tagline.textContent = game.tagline || '';

    const meta = document.createElement('span');
    meta.className = 'game-card-meta';
    const mode = document.createElement('span');
    mode.className = 'game-chip';
    mode.textContent = soon ? '⏳ em breve' : (MODE_LABELS[game.mode] || '');
    meta.appendChild(mode);
    if (game.isNew && !soon) {
      const fresh = document.createElement('span');
      fresh.className = 'game-chip game-chip-new';
      fresh.textContent = 'Novo!';
      meta.appendChild(fresh);
    }
    // resumo do progresso (ex.: "Fase 7 · ⭐ 18"), quando o jogo tiver
    const summary = document.createElement('span');
    summary.className = 'game-card-summary';
    summary.dataset.summaryFor = game.id;

    const action = document.createElement('span');
    action.className = 'game-card-play';
    action.textContent = soon ? 'Em breve' : (game.mode === 'turma' ? 'ENTRAR' : 'JOGAR');

    card.append(icon, name, tagline, meta, summary, action);
    card.addEventListener('click', () => {
      if (soon) return;
      play('pop');
      go(`/jogos/${game.id}`);
    });
    return card;
  }

  const COLLAPSED_KEY = 'hub_secoes_fechadas_v1';
  let collapsed = new Set();
  try { collapsed = new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]')); } catch (e) { /* ignore */ }

  async function renderGames() {
    let games;
    try {
      games = await window.Plataforma.listGames();
    } catch (e) {
      grid.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'game-grid-empty';
      msg.textContent = 'Não consegui carregar os jogos 😵 Recarregue a página.';
      grid.appendChild(msg);
      return;
    }
    grid.innerHTML = '';
    let i = 0;
    for (const subject of SUBJECTS) {
      const list = games.filter((g) => (SUBJECTS.some((s) => s.id === g.subject) ? g.subject : 'outros') === subject.id);
      if (!list.length) continue;
      // cada seção recolhe e abre (lembra no navegador)
      const head = document.createElement('h2');
      head.className = 'game-section';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'game-section-toggle';
      const closed = collapsed.has(subject.id);
      toggle.setAttribute('aria-expanded', String(!closed));
      toggle.innerHTML = `<span>${subject.label}</span><small>${list.length} ${list.length === 1 ? 'jogo' : 'jogos'}</small><i aria-hidden="true">▾</i>`;
      head.appendChild(toggle);
      grid.appendChild(head);
      const cards = list.map((game) => {
        const card = cardFor(game, i++);
        card.hidden = closed;
        grid.appendChild(card);
        return card;
      });
      toggle.addEventListener('click', () => {
        const nowClosed = !collapsed.has(subject.id);
        if (nowClosed) collapsed.add(subject.id); else collapsed.delete(subject.id);
        try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed])); } catch (e) { /* ignore */ }
        toggle.setAttribute('aria-expanded', String(!nowClosed));
        cards.forEach((c) => { c.hidden = nowClosed; });
      });
    }
    renderSummaries();
  }

  // Progresso de cada jogo no cartão (ex.: "Fase 7 · ⭐ 18"). Se falhar, os
  // cartões continuam funcionando sem o resumo.
  async function renderSummaries() {
    try {
      const { summaries } = await window.PlataformaApi.get('/progress');
      grid.querySelectorAll('[data-summary-for]').forEach((el) => {
        el.textContent = summaries[el.dataset.summaryFor] || '';
      });
    } catch (e) { /* sem resumo */ }
  }

  function show() {
    renderUser();
    document.getElementById('hub-speech').textContent = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    showScreen('screen-hub');
    if (window.PlataformaRanking) window.PlataformaRanking.refreshBadge();
    if (window.PlataformaDinamico) window.PlataformaDinamico.refresh().then((cfg) => { if (cfg && cfg.on) dynamicChanged(cfg); });
    return renderGames();
  }

  // ---------------- trocar bichinho ----------------

  const modal = document.getElementById('avatar-modal');
  const picker = createAvatarPicker(document.getElementById('hub-avatar-grid'));

  document.getElementById('hub-avatar').addEventListener('click', () => {
    picker.select(auth.student()?.avatar);
    modal.hidden = false;
    setTimeout(() => picker.focus(), 60);
  });
  document.getElementById('avatar-cancel').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') modal.hidden = true; });
  document.getElementById('avatar-save').addEventListener('click', async () => {
    const chosen = picker.value();
    if (!chosen || chosen === auth.student()?.avatar) { modal.hidden = true; return; }
    try {
      await auth.setAvatar(chosen);
      renderUser();
      modal.hidden = true;
      play('start');
      window.BingoFx.sparkleAt(document.getElementById('hub-avatar'), 12);
    } catch (e) {
      toast(e.message || 'Não deu para trocar o bichinho.', 'error');
    }
  });

  // ---------------- botões fixos ----------------

  document.getElementById('btn-logout').addEventListener('click', () => auth.logout());
  document.getElementById('game-back').addEventListener('click', () => go('/jogos'));
  document.getElementById('link-teacher').addEventListener('click', () => go('/professor'));

  // 🔀 Modo Dinâmico ligado: o mascote avisa
  function dynamicChanged(cfg) {
    if (!cfg || !cfg.on) return;
    document.getElementById('hub-speech').textContent = '🔀 Modo Dinâmico ligado! Escolha um jogo para começar.';
  }

  window.PlataformaHub = { show, dynamicChanged, SUBJECTS };
})();
