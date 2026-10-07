// public/js/platform/hub.js
// Painel de seleção de jogos: quem está logado (com troca de bichinho e
// "Não sou eu / Sair") e um cartão por jogo do registro (/api/games).
// Nenhum jogo fica fixo no HTML — um jogo novo no registro aparece aqui.

(function () {
  const { showScreen, toast, createAvatarPicker } = window.BingoUI;
  const { play } = window.BingoSound;
  const auth = window.PlataformaAuth;
  const go = (url) => window.PlataformaRouter.go(url);

  const grid = document.getElementById('game-grid');
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
    games.forEach((game, i) => grid.appendChild(cardFor(game, i)));
  }

  function show() {
    renderUser();
    document.getElementById('hub-speech').textContent = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    showScreen('screen-hub');
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

  window.PlataformaHub = { show };
})();
