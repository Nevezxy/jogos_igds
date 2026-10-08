// public/games/click/levels.js
// Mundos e fases do 🖱️ Click. Fonte única das fases: o navegador usa para o
// mapa e o servidor (src/games/click/server.js) para conferir os resultados.
// Cada fase é uma coisa nova (alvo maior ou menor, parado ou andando, outra
// ação), e a rodada acelera: os alvos começam com bastante tempo e calma e,
// até o último, ficam mais rápidos, menores e mais numerosos (`paceAt`).
// Cada mundo termina com um 🏆 Desafio, mais rápido e misturando o mundo.
//
// Ações (`kinds`):
//   hover   passar o mouse (ou o dedo) por cima       🫧
//   click   um clique                                  👆
//   double  dois cliques seguidos (dentro de dblMs)    ✌️
//   hold    apertar e segurar até o anel encher        ✊
//   drag    arrastar o objeto e soltar no lugar certo  🤏
//
// Campos de uma fase (do começo ao fim da rodada, [de, até]):
//   size      diâmetro do alvo em px (na tela grande)
//   life      quanto tempo o alvo fica na tela (ms)
//   interval  tempo entre um alvo e o próximo (ms)
//   screen    quantos alvos ao mesmo tempo
//   motion    'none' | 'walk' (anda e rebate nas bordas) | 'bounce' (rápido e muda de direção)
//   speed     velocidade de quem anda (px/s)
//   dblMs     tempo máximo entre os dois cliques do duplo clique
//   holdMs    quanto tempo segurar
//   path      os alvos nascem um perto do outro, formando uma trilha
//   drag      { mode: 'basket' | 'color' | 'shadow', colors?, moving? }

(function (root) {
  const KINDS = ['hover', 'click', 'double', 'hold', 'drag'];
  const KIND_INFO = {
    hover: { icon: '🫧', name: 'Mover', verb: 'Passe o mouse por cima' },
    click: { icon: '👆', name: 'Clique', verb: 'Clique uma vez' },
    double: { icon: '✌️', name: 'Duplo clique', verb: 'Clique duas vezes, rapidinho' },
    hold: { icon: '✊', name: 'Segurar', verb: 'Aperte e segure até encher' },
    drag: { icon: '🤏', name: 'Arrastar', verb: 'Aperte na fruta, segure, leve até a cesta e solte' },
  };

  const BASE = {
    count: 18, size: [110, 90], life: [6000, 3200], interval: [1500, 800], screen: [1, 3],
    motion: 'none', speed: [0, 0], dblMs: 800, holdMs: 800,
  };
  const DRAG = { count: 12, size: [96, 84], life: [14000, 8000], interval: [700, 400], screen: [1, 1] };

  const WORLDS = [
    {
      id: 'c1', icon: '🫧', name: 'Mover o mouse', color: 'sky', kinds: ['hover'],
      intro: 'Bolhas aparecem na tela. Passe o mouse por cima delas para estourar: nem precisa clicar!',
      contents: [
        { title: 'Bolhas grandes', size: [140, 115], life: [7000, 4500], screen: [1, 2], tip: 'Só passe o mouse por cima da bolha, sem clicar.' },
        { title: 'Bolhas pequenas', size: [80, 55], life: [6000, 3500], tip: 'Bolhas pequenas: mexa o mouse com calma e mire.' },
        { title: 'Bolhas que andam', size: [100, 75], motion: 'walk', speed: [50, 130], tip: 'As bolhas andam pela tela: vá atrás delas!' },
        { title: 'Siga a trilha', path: true, count: 24, size: [64, 48], life: [4500, 2400], interval: [150, 150], screen: [1, 1], tip: 'Cada bolinha nasce pertinho da outra. Vá seguindo o caminho sem parar.' },
      ],
      challenge: { size: [80, 55], life: [4500, 2400], interval: [1100, 600], screen: [2, 4], motion: 'walk', speed: [80, 170] },
    },
    {
      id: 'c2', icon: '👆', name: 'Clique', color: 'pink', kinds: ['click'],
      intro: 'Clique em cada alvo antes que ele suma. O anel em volta mostra quanto tempo falta!',
      contents: [
        { title: 'Alvos grandes', size: [130, 105], life: [6500, 4000], screen: [1, 2], tip: 'Coloque a setinha em cima do alvo e clique uma vez.' },
        { title: 'Alvos pequenos', size: [75, 50], life: [6000, 3500], tip: 'Alvos pequenos: pare o mouse em cima antes de clicar.' },
        { title: 'Alvos que andam', size: [100, 75], motion: 'walk', speed: [50, 130], tip: 'Os alvos andam: clique quando a setinha estiver em cima.' },
        { title: 'Alvos que pulam', size: [95, 70], motion: 'bounce', speed: [110, 220], life: [7000, 4500], tip: 'Esses pulam e mudam de direção, como peixinhos. Capriche na mira!' },
      ],
      challenge: { size: [80, 50], life: [4500, 2300], interval: [1000, 550], screen: [2, 4], motion: 'walk', speed: [80, 180] },
    },
    {
      id: 'c3', icon: '✌️', name: 'Duplo clique', color: 'violet', kinds: ['double'],
      intro: 'Agora é clique duplo: clique duas vezes seguidas, bem rapidinho, no mesmo alvo.',
      contents: [
        { title: 'Com calma', size: [130, 110], life: [8000, 5000], screen: [1, 2], dblMs: 900, tip: 'Clique, clique! Os dois cliques bem juntinhos, sem mexer o mouse.' },
        { title: 'Alvos pequenos', size: [85, 60], life: [7000, 4200], dblMs: 750, tip: 'Mire bem e não mexa o mouse entre os dois cliques.' },
        { title: 'Mais rapidinho', size: [100, 80], life: [6500, 3800], dblMs: 450, tip: 'Agora o tempo entre os dois cliques é bem curtinho: clique-clique!' },
        { title: 'Alvos que andam', size: [100, 80], motion: 'walk', speed: [40, 100], life: [7500, 4500], dblMs: 700, tip: 'Os alvos andam devagar: acompanhe e clique duas vezes.' },
      ],
      challenge: { size: [85, 60], life: [5500, 3200], interval: [1200, 700], screen: [2, 3], motion: 'walk', speed: [40, 110], dblMs: 550 },
    },
    {
      id: 'c4', icon: '✊', name: 'Segurar', color: 'orange', kinds: ['hold'],
      intro: 'Aperte o botão do mouse em cima do alvo e segure até o círculo encher. Só depois solte!',
      contents: [
        { title: 'Segurar um pouquinho', size: [130, 110], holdMs: 600, life: [7000, 4500], screen: [1, 2], tip: 'Aperte e segure sem mexer, até o círculo encher.' },
        { title: 'Segurar mais tempo', size: [115, 95], holdMs: 1300, life: [7500, 5000], screen: [1, 2], tip: 'Agora é para segurar mais: conte até dois com o botão apertado.' },
        { title: 'Alvos pequenos', size: [80, 58], holdMs: 900, tip: 'Alvo pequeno: segure firme e não deixe a setinha sair dele.' },
        { title: 'Segurar andando', size: [110, 90], holdMs: 1000, motion: 'walk', speed: [35, 80], life: [8000, 5500], screen: [1, 2], tip: 'O alvo anda: segure o botão e vá junto com ele, sem sair de cima.' },
      ],
      challenge: { size: [90, 65], holdMs: 1000, life: [5500, 3500], interval: [1300, 800], screen: [2, 3], motion: 'walk', speed: [30, 70] },
    },
    {
      id: 'c5', icon: '🤏', name: 'Arrastar e soltar', color: 'green', kinds: ['drag'],
      intro: 'Aperte em cima do objeto, segure, leve até o lugar certo e solte lá dentro.',
      contents: [
        { title: 'Até a cesta', ...DRAG, drag: { mode: 'basket', size: 190 }, tip: 'Aperte na fruta, arraste até a cesta 🧺 e solte o botão lá dentro.' },
        { title: 'Cestas pequenas', ...DRAG, size: [84, 72], drag: { mode: 'basket', size: 120 }, tip: 'A cesta ficou pequena: solte bem no meio dela.' },
        { title: 'Cada um na sua cor', ...DRAG, count: 14, drag: { mode: 'color', colors: 3, size: 150 }, tip: 'Leve cada coisa para a caixa da mesma cor.' },
        { title: 'Até a sombra', ...DRAG, count: 14, drag: { mode: 'shadow', size: 130 }, tip: 'Olhe o desenho e leve até a sombra igual a ele.' },
        { title: 'Cesta que anda', ...DRAG, drag: { mode: 'basket', size: 160, moving: true }, tip: 'A cesta anda de um lado para o outro: solte quando ela chegar.' },
      ],
      challenge: { ...DRAG, count: 16, life: [10000, 6000], drag: { mode: 'color', colors: 4, size: 130 } },
    },
    {
      id: 'c6', icon: '🎲', name: 'Tudo misturado', color: 'red', kinds: ['click', 'double', 'hold', 'drag', 'hover'],
      intro: 'Cada alvo mostra o que fazer: 👆 clique, ✌️ duplo clique, ✊ segurar, 🫧 passar por cima e 🤏 arrastar. Olhe bem antes!',
      contents: [
        { title: 'Clique ou duplo clique?', kinds: ['click', 'double'], size: [105, 85], life: [7000, 4000], tip: '👆 é um clique. ✌️ são dois cliques rapidinhos.' },
        { title: 'Passar ou arrastar?', kinds: ['hover', 'drag'], count: 14, size: [95, 80], life: [9000, 6000], interval: [1300, 900], screen: [1, 2], drag: { mode: 'basket', size: 160 }, tip: '🫧 é só passar por cima. A fruta vai para a cesta 🧺.' },
        { title: 'Clique, duplo ou segurar?', kinds: ['click', 'double', 'hold'], size: [105, 85], life: [7000, 4200], tip: 'Olhe o desenho: 👆 um clique, ✌️ dois, ✊ segurar até encher.' },
      ],
      challenge: { title: '🏆 Grande final', count: 20, size: [95, 70], life: [6500, 4000], interval: [1300, 750], screen: [1, 3], motion: 'walk', speed: [20, 60], dblMs: 650, holdMs: 900, drag: { mode: 'basket', size: 150 } },
    },
  ];

  // Estrelas com o cronômetro ligado: quantos alvos acertou e, para a 3ª,
  // poucas ações erradas. Sem cronômetro nenhum alvo some, então contam só
  // as ações certas (% de acerto).
  const STAR_RULES = [
    { stars: 3, hits: 0.95, accuracy: 75 },
    { stars: 2, hits: 0.8 },
    { stars: 1, hits: 0.6 },
  ];

  const LEVELS = [];
  WORLDS.forEach((world, w) => {
    world.levels = [];
    const add = (content, extra = {}) => {
      const level = {
        ...BASE,
        kinds: world.kinds,
        ...content,
        id: `${world.id}${extra.idSuffix || 'abcdefghi'[world.levels.length]}`,
        topic: content.title,
        fullTitle: content.title,
        world: world.id,
        worldIndex: w,
        indexInWorld: world.levels.length,
        index: LEVELS.length,
        ...extra,
      };
      delete level.idSuffix;
      world.levels.push(level);
      LEVELS.push(level);
    };
    world.contents.forEach((c) => add(c));
    add({
      title: '🏆 Desafio do mundo',
      tip: 'Tudo o que você treinou neste mundo, mais rápido!',
      ...world.challenge,
    }, { idSuffix: 'x', fullTitle: world.challenge.title ? `${world.challenge.title}` : `Desafio: ${world.name}`, challenge: true });
  });
  const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
  const getLevel = (id) => BY_ID[id] || null;
  const getWorld = (id) => WORLDS.find((w) => w.id === id) || null;

  // Ritmo do alvo `index`: vai do começo ao fim da rodada.
  function paceAt(level, index) {
    const k = level.count > 1 ? Math.min(1, index / (level.count - 1)) : 1;
    const mix = ([a, b]) => a + (b - a) * k;
    return {
      size: Math.round(mix(level.size)),
      lifeMs: Math.round(mix(level.life)),
      intervalMs: Math.round(mix(level.interval)),
      maxOnScreen: Math.round(mix(level.screen)),
      speed: Math.round(mix(level.speed)),
    };
  }

  const NO_TIMER_RULES = [
    { stars: 3, accuracy: 90 },
    { stars: 2, accuracy: 75 },
    { stars: 1, accuracy: 50 },
  ];

  function starsFor(levelId, { hits, count, accuracy, timer = true }) {
    if (!getLevel(levelId) || !count) return 0;
    if (!timer) {
      if (hits < count) return 0;
      const rule = NO_TIMER_RULES.find((r) => accuracy >= r.accuracy);
      return rule ? rule.stars : 0;
    }
    const ratio = hits / count;
    for (const rule of STAR_RULES) {
      if (ratio >= rule.hits - 1e-9 && (rule.accuracy == null || accuracy >= rule.accuracy)) return rule.stars;
    }
    return 0;
  }

  const starsOf = (progress, id) => (progress && progress.levels && progress.levels[id] ? progress.levels[id].stars || 0 : 0);
  const isUnlocked = (progress, id) => Boolean(getLevel(id));
  const nextLevel = (progress) => LEVELS.find((l) => starsOf(progress, l.id) === 0) || null;
  const totalStars = (progress) => LEVELS.reduce((n, l) => n + starsOf(progress, l.id), 0);

  const api = {
    WORLDS, LEVELS, KINDS, KIND_INFO, MAX_STARS: LEVELS.length * 3,
    getLevel, getWorld, starsFor, isUnlocked, nextLevel, totalStars, paceAt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
