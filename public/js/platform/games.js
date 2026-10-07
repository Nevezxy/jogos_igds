// public/js/platform/games.js
// Registro e carregador de jogos no navegador. Cada jogo mora em
// public/games/<id>/ e se registra com Plataforma.registerGame(id, módulo).
// Há dois jeitos de um jogo funcionar:
//   - mount(container, ctx) / unmount(): o jogo é desenhado dentro da tela
//     genérica de jogo. Os arquivos dele (game.css, view.html, game.js) só
//     são baixados quando a criança entra — sem build step, com
//     <link>/<script> dinâmicos. É o jeito recomendado para jogos novos.
//   - enter(ctx) / leave(): o jogo já está na página e cuida das próprias
//     telas (é o caso do bingo, que tem sala de espera, cartela, telão...).

(function () {
  const modules = new Map(); // id -> { mount, unmount }
  const loading = new Map(); // id -> Promise (arquivos sendo baixados)
  let catalogPromise = null;
  let current = null; // { id, module, container }
  // Conta as montagens: se outra montagem (ou uma desmontagem) acontecer
  // enquanto os arquivos de um jogo ainda baixam, esse jogo não é montado.
  let mountSeq = 0;

  let teacherArea = null; // { enter(), leave() } — por enquanto, a do bingo

  function registerGame(id, module) {
    if (!module || (typeof module.mount !== 'function' && typeof module.enter !== 'function')) {
      throw new Error(`O jogo "${id}" precisa ter mount(container, ctx) ou enter(ctx).`);
    }
    modules.set(id, module);
  }

  // O que todo jogo recebe da plataforma.
  function createContext(game, params, exit) {
    const student = window.PlataformaAuth.student();
    return {
      game,
      student,
      params,
      exit,
      api: window.PlataformaApi,
      sound: window.BingoSound,
      fx: window.BingoFx,
      mascot: window.BingoMascot,
      ui: window.BingoUI,
    };
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

  // Monta o jogo dentro do contêiner, desmontando o anterior. Devolve null
  // se a montagem foi cancelada no meio do carregamento.
  async function mountGame(id, container, ctx = {}) {
    unmountGame();
    const seq = ++mountSeq;
    const game = await getGame(id);
    const view = await loadAssets(game);
    if (seq !== mountSeq) return null;
    const module = modules.get(id);
    if (!module) throw new Error(`O jogo "${id}" não se registrou (Plataforma.registerGame).`);
    if (view) container.innerHTML = view;
    current = { id, module, container };
    await module.mount(container, { game, ...ctx });
    return game;
  }

  function unmountGame() {
    mountSeq++;
    if (!current) return;
    const { module, container } = current;
    current = null;
    try { if (typeof module.unmount === 'function') module.unmount(); } catch (e) { console.error(e); }
    container.innerHTML = '';
  }

  window.Plataforma = {
    registerGame,
    getModule: (id) => modules.get(id),
    createContext,
    registerTeacherArea: (area) => { teacherArea = area; },
    getTeacherArea: () => teacherArea,
    listGames,
    mountGame,
    unmountGame,
    currentGameId: () => (current ? current.id : null),
  };
})();
