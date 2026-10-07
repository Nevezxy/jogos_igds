// public/js/platform/games.js
// Registro e carregador de jogos no navegador. Cada jogo mora em
// public/games/<id>/ e se registra com Plataforma.registerGame(id, módulo),
// onde o módulo tem mount(container, ctx) e unmount(). Os arquivos de um
// jogo (game.css, view.html e game.js) só são baixados quando a criança
// entra nele — sem build step, com <link>/<script> dinâmicos.

(function () {
  const modules = new Map(); // id -> { mount, unmount }
  const loading = new Map(); // id -> Promise (arquivos sendo baixados)
  let catalogPromise = null;
  let current = null; // { id, module, container }

  function registerGame(id, module) {
    if (!module || typeof module.mount !== 'function') {
      throw new Error(`O jogo "${id}" precisa ter uma função mount(container, ctx).`);
    }
    modules.set(id, module);
  }

  // Lista pública de jogos vinda do servidor (src/games/registry.js).
  function listGames() {
    if (!catalogPromise) {
      catalogPromise = fetch('/api/games')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Falha ao listar jogos.'))))
        .then((data) => data.games || [])
        .catch((e) => { catalogPromise = null; throw e; });
    }
    return catalogPromise;
  }

  async function getGame(id) {
    const games = await listGames();
    const game = games.find((g) => g.id === id);
    if (!game) throw new Error(`Jogo "${id}" não encontrado.`);
    return game;
  }

  function loadStyle(href) {
    if (document.querySelector(`link[data-game-style="${href}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.gameStyle = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Não foi possível carregar ${href}.`));
      document.head.appendChild(link);
    });
  }

  function loadScript(src) {
    if (document.querySelector(`script[data-game-script="${src}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.dataset.gameScript = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Não foi possível carregar ${src}.`));
      document.body.appendChild(script);
    });
  }

  // Baixa (uma vez só) os estilos, o HTML e os scripts do jogo.
  function loadAssets(game) {
    if (!loading.has(game.id)) {
      const base = `/games/${game.id}/`;
      const client = game.client || {};
      const promise = (async () => {
        await Promise.all((client.styles || []).map((file) => loadStyle(base + file)));
        const view = client.view
          ? await fetch(base + client.view).then((r) => (r.ok ? r.text() : Promise.reject(new Error('Falha ao carregar a tela do jogo.'))))
          : '';
        // scripts em ordem: um jogo pode dividir o código em vários arquivos
        for (const file of client.scripts || []) await loadScript(base + file);
        return view;
      })();
      promise.catch(() => loading.delete(game.id));
      loading.set(game.id, promise);
    }
    return loading.get(game.id);
  }

  // Monta o jogo dentro do contêiner, desmontando o anterior.
  async function mountGame(id, container, ctx = {}) {
    unmountGame();
    const game = await getGame(id);
    const view = await loadAssets(game);
    const module = modules.get(id);
    if (!module) throw new Error(`O jogo "${id}" não se registrou (Plataforma.registerGame).`);
    if (view) container.innerHTML = view;
    current = { id, module, container };
    await module.mount(container, { ...ctx, game });
    return game;
  }

  function unmountGame() {
    if (!current) return;
    const { module, container } = current;
    current = null;
    try { if (typeof module.unmount === 'function') module.unmount(); } catch (e) { console.error(e); }
    container.innerHTML = '';
  }

  window.Plataforma = {
    registerGame,
    listGames,
    mountGame,
    unmountGame,
    currentGameId: () => (current ? current.id : null),
  };
})();
