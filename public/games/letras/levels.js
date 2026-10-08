// public/games/letras/levels.js
// Mundos e fases do 🔤 Letras Cadentes. Fonte única das fases: o navegador
// usa para o mapa e o servidor (src/games/letras/server.js) para conferir os
// resultados e calcular as estrelas.
//
// Cada fase é um conteúdo diferente, e a rodada acelera: começa devagar e
// vai ficando mais rápida até a última peça (`paceAt`). Cada mundo termina
// com um 🏆 Desafio, que mistura tudo do mundo e já começa mais rápido.
// Conteúdo (`gen`, gerado em items.js):
//   { t: 'chars', chars }          letras ou números soltos
//   { t: 'words', ...filtros }     palavras do banco do Teclado Mágico:
//        letters (só essas letras), min/max (tamanho), accents ('none' sem
//        acento; 'need' com algum dos `acc`), has (algum desses pedaços),
//        upper ('first' Maiúscula; 'all' TUDO)
//   { t: 'list', list | items }    lista pronta (do Teclado Mágico ou aqui)
//   { t: 'two' }                   duas palavras ("bola azul")
//   { t: 'mix', of: [...] }        um pouco de cada
// `caseSensitive`: maiúscula e minúscula contam (mundo das maiúsculas). Nos
// outros, tanto faz (o Caps Lock ligado não atrapalha).

(function (root) {
  const ALL = 'abcdefghijklmnopqrstuvwxyzç';
  const DIGITS = '0123456789';

  // Ritmo: do começo (`from`) ao fim (`to`) da rodada.
  const PACES = {
    letra: { count: 24, from: { fallMs: 11000, intervalMs: 2400, maxOnScreen: 2 }, to: { fallMs: 5500, intervalMs: 1100, maxOnScreen: 4 } },
    silaba: { count: 22, from: { fallMs: 13000, intervalMs: 2800, maxOnScreen: 2 }, to: { fallMs: 7500, intervalMs: 1500, maxOnScreen: 3 } },
    palavra: { count: 17, from: { fallMs: 16000, intervalMs: 3600, maxOnScreen: 2 }, to: { fallMs: 9500, intervalMs: 2100, maxOnScreen: 3 } },
    longa: { count: 14, from: { fallMs: 19000, intervalMs: 4500, maxOnScreen: 2 }, to: { fallMs: 11500, intervalMs: 2700, maxOnScreen: 3 } },
  };
  // o Desafio começa no meio do caminho e termina 15% mais rápido
  function challengePace(p) {
    const mid = (k) => Math.round((p.from[k] + p.to[k]) / 2);
    return {
      count: p.count + 4,
      from: { fallMs: mid('fallMs'), intervalMs: mid('intervalMs'), maxOnScreen: p.to.maxOnScreen - 1 },
      to: { fallMs: Math.round(p.to.fallMs * 0.85), intervalMs: Math.round(p.to.intervalMs * 0.85), maxOnScreen: p.to.maxOnScreen },
    };
  }

  const SYL_CH = ['cha', 'che', 'chi', 'cho', 'chu', 'lha', 'lhe', 'lhi', 'lho', 'nha', 'nhe', 'nhi', 'nho', 'nhu'];
  const SYL_QU = ['que', 'qui', 'qua', 'quo', 'gue', 'gui', 'gua', 'ce', 'ci', 'ça', 'ço', 'çu', 'ge', 'gi'];

  // A ordem dos mundos é a ordem da dificuldade, uma novidade por vez:
  // letra solta → sílaba → palavra → palavra com maiúscula (Shift) →
  // palavra com acento → grande final. Dentro do mundo, as peças também vão
  // crescendo. `key` guarda o id antigo da fase quando ela mudou de lugar
  // (assim ninguém perde as estrelas).
  const WORLDS = [
    {
      id: 'l1', icon: '🔤', name: 'Letras e números', color: 'yellow', pace: 'letra',
      intro: 'Letras e números caem do céu. Dedos na casa (indicadores no F e no J) e digite cada um antes que chegue ao chão!',
      contents: [
        { title: 'Letras', gen: { t: 'chars', chars: ALL }, tip: 'Todas as letras, de A a Z, e o Ç.' },
        { title: 'Números', gen: { t: 'chars', chars: DIGITS }, tip: 'Todos os números, do 0 ao 9, na fileira de cima.' },
        { title: 'Letras e números', gen: { t: 'chars', chars: ALL + DIGITS }, tip: 'Letras e números misturados.' },
        { title: 'Com vírgula e ponto', gen: { t: 'chars', chars: `${ALL}${DIGITS},.` }, tip: 'Tudo junto, com a vírgula e o ponto.' },
      ],
    },
    {
      id: 'l3', icon: '🔡', name: 'Sílabas', color: 'pink', pace: 'silaba',
      intro: 'Agora caem pedacinhos de palavras: sílabas de 2 e 3 letras. Ba, me, pra, lha...',
      contents: [
        { title: 'Sílabas simples', gen: { t: 'list', list: 'syllables' }, tip: 'Ba, be, bi, bo, bu...' },
        { title: 'Sílabas com R e L', gen: { t: 'list', list: 'silabasRL' }, tip: 'Bra, pla, tre: duas consoantes juntas.' },
        { title: 'CH, LH e NH', gen: { t: 'list', items: SYL_CH }, tip: 'Duas letras que fazem um som só.' },
        { title: 'QU, GU, Ç e G', gen: { t: 'list', items: SYL_QU }, tip: 'Que, gui, ça, ge: sílabas que enganam!' },
      ],
    },
    {
      id: 'l4', icon: '📝', name: 'Palavras', color: 'sky', pace: 'palavra',
      intro: 'Palavras inteiras caindo, das curtinhas às compridas! Comece pela primeira letra e vá até o fim.',
      contents: [
        { key: 'a', title: 'Palavras de 2 e 3 letras', gen: { t: 'words', min: 2, max: 3, accents: 'none' }, pace: 'silaba', tip: 'Palavras curtinhas.' },
        { key: 'b', title: 'Palavras de 4 e 5 letras', gen: { t: 'words', min: 4, max: 5, accents: 'none' }, tip: 'Palavras médias.' },
        { key: 'e', title: 'Ações', gen: { t: 'list', list: 'verbos' }, tip: 'Correr, pular, cantar: palavras de ação.' },
        { key: 'd', title: 'Letras difíceis', gen: { t: 'words', min: 3, max: 8, accents: 'none', has: ['q', 'z', 'x', 'k', 'w', 'y'] }, tip: 'Palavras com Q, Z, X, K, W e Y.' },
        { key: 'c', title: 'Palavras de 6 letras ou mais', gen: { t: 'words', min: 6, max: 9, accents: 'none' }, pace: 'longa', tip: 'Palavras compridas: letra por letra.' },
      ],
    },
    {
      id: 'l2', icon: '🔠', name: 'Maiúsculas', color: 'violet', pace: 'palavra', caseSensitive: true,
      intro: 'Agora a maiúscula conta: segure o Shift do lado contrário da letra (ou ligue o Caps Lock).',
      contents: [
        { key: 'a', title: 'Letras maiúsculas', gen: { t: 'chars', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÇ' }, pace: 'letra', tip: 'Shift + a letra.' },
        { key: 'd', title: 'Siglas', gen: { t: 'list', list: 'siglas' }, pace: 'silaba', tip: 'Siglas são todas em maiúscula.' },
        { key: 'b', title: 'Nomes', gen: { t: 'list', list: 'nomes', accents: 'none' }, tip: 'Nomes começam com letra maiúscula.' },
        { key: 'c', title: 'Lugares do Brasil', gen: { t: 'list', list: 'lugares', accents: 'none', single: true }, tip: 'Cidades e estados, com maiúscula.' },
        { key: 'e', title: 'PALAVRAS GRITADAS', gen: { t: 'words', min: 3, max: 6, accents: 'none', upper: 'all' }, tip: 'A palavra inteira em maiúscula.' },
      ],
    },
    {
      id: 'l5', icon: '✨', name: 'Palavras com acento', color: 'violet', pace: 'palavra',
      intro: 'Palavras com acento: aperte a tecla do acento, solte, e depois a letra.',
      contents: [
        { key: 'd', title: 'Cedilha ç', gen: { t: 'words', min: 3, max: 9, accents: 'need', acc: 'ç' }, tip: 'O Ç tem tecla própria, à direita do L.' },
        { key: 'a', title: 'Acento agudo ´', gen: { t: 'words', min: 2, max: 8, accents: 'need', acc: 'áéíóú' }, tip: 'O acento agudo fica à direita do P.' },
        { key: 'b', title: 'Til ~', gen: { t: 'words', min: 2, max: 8, accents: 'need', acc: 'ãõ' }, tip: 'O til fica à direita do Ç.' },
        { key: 'c', title: 'Circunflexo ^', gen: { t: 'words', min: 2, max: 9, accents: 'need', acc: 'âêô' }, tip: 'O circunflexo é Shift + a tecla do til.' },
      ],
    },
    {
      id: 'l6', icon: '🏆', name: 'Grande final', color: 'red', pace: 'longa',
      intro: 'O grande final: maiúsculas, acentos, duas palavras de uma vez e palavras gigantes.',
      noChallenge: true, // o mundo inteiro já é desafio
      contents: [
        { title: 'Maiúscula e acento', gen: { t: 'words', min: 3, max: 9, accents: 'need', acc: 'áéíóúãõâêô', upper: 'first' }, caseSensitive: true, pace: 'palavra', tip: 'Primeiro a maiúscula, e não esqueça o acento.' },
        { title: 'Duas palavras', gen: { t: 'two' }, tip: 'Duas palavras com um espaço no meio.' },
        { title: 'Palavras gigantes', gen: { t: 'words', min: 8, max: 14 }, tip: 'As maiores palavras do banco.' },
        { title: 'Tudo misturado', gen: { t: 'mix', of: [{ t: 'words', min: 3, max: 9 }, { t: 'two' }, { t: 'list', list: 'nomes' }, { t: 'chars', chars: DIGITS }] }, caseSensitive: true, tip: 'Um pouco de tudo!' },
      ],
    },
  ];

  // Estrelas: quanto das peças a criança pegou (e, para a 3ª, poucos erros).
  const STAR_RULES = [
    { stars: 3, caught: 0.95, accuracy: 90 },
    { stars: 2, caught: 0.8 },
    { stars: 1, caught: 0.6 },
  ];

  const LEVELS = [];
  WORLDS.forEach((world, w) => {
    world.levels = [];
    const add = (content, pace, extra = {}) => {
      const level = {
        id: `${world.id}${extra.idSuffix || content.key || 'abcdefgh'[world.levels.length]}`,
        title: content.title,
        topic: content.title,
        fullTitle: content.title,
        tip: content.tip,
        gen: content.gen,
        caseSensitive: Boolean(content.caseSensitive ?? world.caseSensitive),
        count: pace.count,
        from: pace.from,
        to: pace.to,
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
    world.contents.forEach((content) => add(content, PACES[content.pace || world.pace]));
    if (!world.noChallenge) {
      // 🏆 Desafio do mundo: tudo junto, começando mais rápido
      add({
        title: '🏆 Desafio do mundo',
        gen: { t: 'mix', of: world.contents.map((c) => c.gen) },
        tip: 'Tudo o que caiu neste mundo, misturado e mais rápido!',
        caseSensitive: world.caseSensitive,
      }, challengePace(PACES[world.pace]), { idSuffix: 'x', fullTitle: `Desafio: ${world.name}`, challenge: true });
    }
  });
  const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
  const getLevel = (id) => BY_ID[id] || null;
  const getWorld = (id) => WORLDS.find((w) => w.id === id) || null;

  // Ritmo da peça `index`: vai do `from` ao `to` ao longo da rodada.
  function paceAt(level, index) {
    const k = level.count > 1 ? Math.min(1, index / (level.count - 1)) : 1;
    const mix = (a, b) => a + (b - a) * k;
    return {
      fallMs: Math.round(mix(level.from.fallMs, level.to.fallMs)),
      intervalMs: Math.round(mix(level.from.intervalMs, level.to.intervalMs)),
      maxOnScreen: Math.round(mix(level.from.maxOnScreen, level.to.maxOnScreen)),
    };
  }

  // `caught` e `count`: peças pegas e total; `accuracy`: % de teclas certas.
  function starsFor(levelId, { caught, count, accuracy }) {
    if (!getLevel(levelId) || !count) return 0;
    const ratio = caught / count;
    for (const rule of STAR_RULES) {
      if (ratio >= rule.caught - 1e-9 && (rule.accuracy == null || accuracy >= rule.accuracy)) return rule.stars;
    }
    return 0;
  }

  // Todas as fases abertas; a próxima recomendada fica em destaque.
  const starsOf = (progress, id) => (progress && progress.levels && progress.levels[id] ? progress.levels[id].stars || 0 : 0);
  const isUnlocked = (progress, id) => Boolean(getLevel(id));
  const nextLevel = (progress) => LEVELS.find((l) => starsOf(progress, l.id) === 0) || null;
  const totalStars = (progress) => LEVELS.reduce((n, l) => n + starsOf(progress, l.id), 0);

  const api = {
    WORLDS, LEVELS, PACES, MAX_STARS: LEVELS.length * 3,
    getLevel, getWorld, starsFor, isUnlocked, nextLevel, totalStars, paceAt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetrasLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
