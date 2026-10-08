// public/games/letras/levels.js
// Mundos e fases do 🔤 Letras Cadentes. Fonte única das fases: o navegador
// usa para o mapa e o servidor (src/games/letras/server.js) para conferir os
// resultados e calcular as estrelas.
//
// Cada mundo tem 4 conteúdos, e cada conteúdo vira 3 fases, uma por
// velocidade (🐢 devagar, 🐇 médio, 🚀 rápido): 12 fases por mundo.
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

  // Ritmo de cada velocidade: tempo de queda, intervalo entre peças,
  // quantas ao mesmo tempo e quantas na fase.
  const PACES = {
    letra: [
      { fallMs: 11000, intervalMs: 2400, maxOnScreen: 2, count: 20 },
      { fallMs: 8000, intervalMs: 1700, maxOnScreen: 3, count: 24 },
      { fallMs: 5500, intervalMs: 1100, maxOnScreen: 4, count: 28 },
    ],
    silaba: [
      { fallMs: 13000, intervalMs: 2800, maxOnScreen: 2, count: 18 },
      { fallMs: 10000, intervalMs: 2100, maxOnScreen: 3, count: 22 },
      { fallMs: 7500, intervalMs: 1500, maxOnScreen: 3, count: 26 },
    ],
    palavra: [
      { fallMs: 16000, intervalMs: 3600, maxOnScreen: 2, count: 14 },
      { fallMs: 12500, intervalMs: 2800, maxOnScreen: 3, count: 17 },
      { fallMs: 9500, intervalMs: 2100, maxOnScreen: 3, count: 20 },
    ],
    longa: [
      { fallMs: 19000, intervalMs: 4500, maxOnScreen: 2, count: 12 },
      { fallMs: 15000, intervalMs: 3500, maxOnScreen: 2, count: 14 },
      { fallMs: 11500, intervalMs: 2700, maxOnScreen: 3, count: 16 },
    ],
  };
  const SPEEDS = [
    { label: '🐢 Devagar', tip: 'Sem pressa: as peças caem devagar.' },
    { label: '🐇 Médio', tip: 'Um pouco mais rápido, e mais peças ao mesmo tempo.' },
    { label: '🚀 Rápido', tip: 'Rapidinho! Olhe primeiro para a peça mais perto do chão.' },
  ];

  const SYL_CH = ['cha', 'che', 'chi', 'cho', 'chu', 'lha', 'lhe', 'lhi', 'lho', 'nha', 'nhe', 'nhi', 'nho', 'nhu'];

  const WORLDS = [
    {
      id: 'l1', icon: '🔤', name: 'Letras e números', color: 'yellow', pace: 'letra',
      intro: 'Letras e números caem do céu. Dedos na casa (indicadores no F e no J) e digite cada um antes que chegue ao chão!',
      contents: [
        { title: 'Letras', gen: { t: 'chars', chars: ALL }, tip: 'Todas as letras, de A a Z, e o Ç.' },
        { title: 'Números', gen: { t: 'chars', chars: DIGITS }, tip: 'Todos os números, do 0 ao 9, na fileira de cima.' },
        { title: 'Letras e números', gen: { t: 'chars', chars: ALL + DIGITS }, tip: 'Letras e números misturados.' },
        { title: 'Letras, números, vírgula e ponto', gen: { t: 'chars', chars: `${ALL}${DIGITS},.` }, tip: 'Tudo junto, com a vírgula e o ponto.' },
      ],
    },
    {
      id: 'l5', icon: '🔠', name: 'Maiúsculas', color: 'violet', pace: 'letra', caseSensitive: true,
      intro: 'Agora a letra tem que ser MAIÚSCULA: segure o Shift do lado contrário da letra (ou ligue o Caps Lock).',
      contents: [
        { title: 'Letras maiúsculas', gen: { t: 'chars', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÇ' }, tip: 'Shift + a letra.' },
        { title: 'Nomes', gen: { t: 'list', list: 'nomes' }, pace: 'palavra', tip: 'Nomes começam com letra maiúscula.' },
        { title: 'Siglas', gen: { t: 'list', list: 'siglas' }, pace: 'silaba', tip: 'Siglas são todas em maiúscula.' },
        { title: 'PALAVRAS GRITADAS', gen: { t: 'words', min: 3, max: 6, accents: 'none', upper: 'all' }, pace: 'palavra', tip: 'A palavra inteira em maiúscula.' },
      ],
    },
    {
      id: 'l6', icon: '🔡', name: 'Sílabas', color: 'pink', pace: 'silaba',
      intro: 'Sílabas caindo! Ba, me, pra, lha... são os pedacinhos das palavras.',
      contents: [
        { title: 'Sílabas simples', gen: { t: 'list', list: 'syllables' }, tip: 'Ba, be, bi, bo, bu...' },
        { title: 'Sílabas com R e L', gen: { t: 'list', list: 'silabasRL' }, tip: 'Bra, pla, tre: duas consoantes juntas.' },
        { title: 'CH, LH e NH', gen: { t: 'list', items: SYL_CH }, tip: 'Duas letras que fazem um som só.' },
        { title: 'Sílabas misturadas', gen: { t: 'mix', of: [{ t: 'list', list: 'syllables' }, { t: 'list', list: 'silabasRL' }, { t: 'list', items: SYL_CH }] }, tip: 'Todas as sílabas juntas.' },
      ],
    },
    {
      id: 'l7', icon: '📝', name: 'Palavras simples', color: 'sky', pace: 'palavra',
      intro: 'Palavras inteiras caindo! Comece pela primeira letra e vá até o fim.',
      contents: [
        { title: 'Palavras de 2 e 3 letras', gen: { t: 'words', min: 2, max: 3, accents: 'none' }, pace: 'silaba', tip: 'Palavras curtinhas.' },
        { title: 'Palavras de 4 e 5 letras', gen: { t: 'words', min: 4, max: 5, accents: 'none' }, tip: 'Palavras médias.' },
        { title: 'Palavras de 6 letras ou mais', gen: { t: 'words', min: 6, max: 9, accents: 'none' }, pace: 'longa', tip: 'Palavras compridas: letra por letra.' },
        { title: 'Letras difíceis', gen: { t: 'words', min: 3, max: 8, accents: 'none', has: ['q', 'z', 'x', 'k', 'w', 'y'] }, tip: 'Palavras com Q, Z, X, K, W e Y.' },
      ],
    },
    {
      id: 'l8', icon: '✨', name: 'Palavras com acento', color: 'violet', pace: 'palavra',
      intro: 'Palavras com acento: aperte a tecla do acento, solte, e depois a letra.',
      contents: [
        { title: 'Acento agudo ´', gen: { t: 'words', min: 2, max: 8, accents: 'need', acc: 'áéíóú' }, tip: 'O acento agudo fica à direita do P.' },
        { title: 'Til ~', gen: { t: 'words', min: 2, max: 8, accents: 'need', acc: 'ãõ' }, tip: 'O til fica à direita do Ç.' },
        { title: 'Circunflexo ^', gen: { t: 'words', min: 2, max: 9, accents: 'need', acc: 'âêô' }, tip: 'O circunflexo é Shift + a tecla do til.' },
        { title: 'Todos os acentos e Ç', gen: { t: 'words', min: 2, max: 9, accents: 'need', acc: 'áéíóúãõâêôç' }, tip: 'Todos os acentos misturados.' },
      ],
    },
    {
      id: 'l9', icon: '🏆', name: 'Desafio', color: 'red', pace: 'longa',
      intro: 'O grande desafio: maiúsculas, acentos, palavras longas e duas palavras de uma vez.',
      contents: [
        { title: 'Maiúscula e acento', gen: { t: 'words', min: 3, max: 9, accents: 'need', acc: 'áéíóúãõâêô', upper: 'first' }, caseSensitive: true, pace: 'palavra', tip: 'Primeiro a maiúscula, e não esqueça o acento.' },
        { title: 'Duas palavras', gen: { t: 'two' }, tip: 'Duas palavras com um espaço no meio.' },
        { title: 'Palavras gigantes', gen: { t: 'words', min: 8, max: 14 }, tip: 'As maiores palavras do banco.' },
        { title: 'Tudo misturado', gen: { t: 'mix', of: [{ t: 'words', min: 3, max: 9 }, { t: 'two' }, { t: 'list', list: 'nomes' }, { t: 'chars', chars: '1234567890' }] }, caseSensitive: true, tip: 'Um pouco de tudo!' },
      ],
    },
  ];

  // Estrelas: quanto das peças a criança pegou (e, para a 3ª, poucos erros).
  const STAR_RULES = [
    { stars: 3, caught: 0.95, accuracy: 90 },
    { stars: 2, caught: 0.8 },
    { stars: 1, caught: 0.6 },
  ];

  // cada conteúdo vira 3 fases, uma por velocidade
  const LEVELS = [];
  WORLDS.forEach((world, w) => {
    world.levels = [];
    world.contents.forEach((content, c) => {
      const pace = PACES[content.pace || world.pace];
      SPEEDS.forEach((speed, s) => {
        const level = {
          id: `${world.id}${'abcd'[c]}${s + 1}`,
          title: speed.label,
          topic: content.title,
          fullTitle: `${content.title} · ${speed.label}`,
          section: s === 0 ? content.title : undefined,
          tip: `${content.tip} ${speed.tip}`,
          gen: content.gen,
          caseSensitive: Boolean(content.caseSensitive ?? world.caseSensitive),
          speed: s,
          ...pace[s],
          world: world.id,
          worldIndex: w,
          indexInWorld: world.levels.length,
          index: LEVELS.length,
        };
        world.levels.push(level);
        LEVELS.push(level);
      });
    });
  });
  const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
  const getLevel = (id) => BY_ID[id] || null;
  const getWorld = (id) => WORLDS.find((w) => w.id === id) || null;

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
    getLevel, getWorld, starsFor, isUnlocked, nextLevel, totalStars,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetrasLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
