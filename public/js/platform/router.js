// public/js/platform/router.js
// Rotas da plataforma (History API; o servidor devolve o index.html para
// qualquer rota de tela):
//   /                 login (ou o painel, se já houver alguém logado)
//   /jogos            painel de seleção de jogos
//   /jogos/<id>       um jogo (ex.: /jogos/bingo?sala=CODE)
//   /professor        área do professor (turma e ferramentas dos jogos)
//   /professor/<id>   ferramenta de um jogo (ex.: /professor/bingo, a sala do bingo)
//   /telao?sala=CODE  telão do bingo (sem login; a rota só carrega o bingo)
//   /telao/<id>?sala=CODE  telão de outro jogo (o módulo do jogo exporta `screen`)
// Links antigos /?sala=CODE (QR Codes já impressos) viram /jogos/bingo?sala=CODE.

(function () {
  const auth = window.PlataformaAuth;
  const { showScreen, toast } = window.BingoUI;

  let pendingUrl = null; // rota pedida antes do login
  let leaveCurrent = null; // desmonta o que a rota atual montou
  // Cada navegação ganha um número; uma rota que terminou de carregar depois
  // de a criança já ter ido para outra (ex.: voltou antes de o jogo abrir)
  // não pode tomar a tela.
  let navId = 0;

  function currentUrl() {
    return location.pathname + location.search;
  }

  function go(url, { replace = false } = {}) {
    if (url !== currentUrl()) history[replace ? 'replaceState' : 'pushState'](null, '', url);
    return handle();
  }

  function leave() {
    const fn = leaveCurrent;
    leaveCurrent = null;
    if (fn) {
      try { fn(); } catch (e) { console.error(e); }
    }
  }

  function requireLogin() {
    if (auth.isLoggedIn()) return true;
    pendingUrl = currentUrl();
    leave();
    auth.openLogin();
    return false;
  }

  async function openGame(id, nav) {
    const params = new URLSearchParams(location.search);
    let game;
    try {
      game = (await window.Plataforma.listGames()).find((g) => g.id === id && g.status === 'active');
    } catch (e) {
      if (nav !== navId) return;
      toast('Não consegui carregar os jogos 😵 Tente de novo!', 'error');
      return go('/jogos', { replace: true });
    }
    if (nav !== navId) return;
    if (!game) {
      toast('Esse jogo não existe 🤔', 'error');
      return go('/jogos', { replace: true });
    }
    const ctx = window.Plataforma.createContext(game, params, () => go('/jogos'));
    if (game.client && game.client.persistent) {
      // jogo que cuida das próprias telas (o bingo): baixa uma vez e entra
      let module;
      try {
        ({ module } = await window.Plataforma.ensureLoaded(id));
      } catch (e) {
        if (nav !== navId) return;
        console.error(e);
        toast('Não consegui abrir esse jogo 😵', 'error');
        return go('/jogos', { replace: true });
      }
      if (nav !== navId) return;
      leaveCurrent = () => module.leave && module.leave();
      return module.enter(ctx);
    }
    // jogo carregado sob demanda dentro da tela genérica
    document.getElementById('game-title').textContent = `${game.icon} ${game.name}`;
    showScreen('screen-game');
    leaveCurrent = () => window.Plataforma.unmountGame();
    try {
      // (se a criança sair antes de terminar de carregar, o carregador desiste sozinho)
      await window.Plataforma.mountGame(id, document.getElementById('game-root'), ctx);
    } catch (e) {
      if (nav !== navId) return;
      console.error(e);
      toast('Não consegui abrir esse jogo 😵', 'error');
      go('/jogos', { replace: true });
    }
  }

  async function handle() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(location.search);

    const screenMatch = path.match(/^\/telao\/([a-z0-9-]+)$/);
    if (screenMatch) {
      return window.Plataforma.ensureLoaded(screenMatch[1])
        .then(({ module }) => { if (module.screen) module.screen.start(); else go('/', { replace: true }); })
        .catch((e) => {
          console.error(e);
          toast('Não consegui abrir o telão 😵 Recarregue a página.', 'error');
        });
    }
    if (path === '/telao') {
      // o telão do bingo começa sozinho quando os scripts do bingo carregam
      return window.Plataforma.ensureLoaded('bingo').catch((e) => {
        console.error(e);
        toast('Não consegui abrir o telão 😵 Recarregue a página.', 'error');
      });
    }
    const nav = ++navId;
    leave();

    if (path === '/') {
      if (params.get('sala')) return go(`/jogos/bingo?sala=${encodeURIComponent(params.get('sala'))}`, { replace: true });
      if (auth.isLoggedIn()) return go('/jogos', { replace: true });
      return auth.openLogin();
    }
    if (path === '/jogos') {
      if (!requireLogin()) return;
      return window.PlataformaHub.show();
    }
    const gameMatch = path.match(/^\/jogos\/([a-z0-9-]+)$/);
    if (gameMatch) {
      if (!requireLogin()) return;
      return openGame(gameMatch[1], nav);
    }
    if (path === '/professor') return window.PlataformaTeacher.show();
    const toolMatch = path.match(/^\/professor\/([a-z0-9-]+)$/);
    if (toolMatch) {
      const tool = await window.PlataformaTeacher.enterTool(toolMatch[1]);
      if (tool && nav === navId) leaveCurrent = () => tool.leave && tool.leave();
      else if (tool) tool.leave && tool.leave();
      return;
    }
    return go('/', { replace: true });
  }

  window.addEventListener('popstate', () => handle());

  // Login feito: vai para a rota que a criança tinha pedido (ex.: o link
  // de uma sala) ou para o painel. Saiu: volta para o login.
  auth.onLogin(() => {
    const url = pendingUrl && pendingUrl !== '/' ? pendingUrl : '/jogos';
    pendingUrl = null;
    go(url);
  });
  auth.onLogout(() => {
    pendingUrl = null;
    go('/');
  });

  auth.ready.then(() => handle());

  window.PlataformaRouter = { go, handle, back: () => history.back() };
})();
