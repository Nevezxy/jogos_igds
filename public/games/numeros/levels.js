// public/games/numeros/levels.js
// Mundos e fases do 🔢 Números Cadentes. Fonte única das fases: o navegador
// usa para o mapa e o servidor (src/games/numeros/server.js) para conferir
// os resultados. Cada mundo tem 4 conteúdos, e cada conteúdo vira 3 fases,
// uma por velocidade (🐢 devagar, 🐇 médio, 🚀 rápido): 12 fases por mundo.
//
// Conteúdo (`gen`, gerado em items.js):
//   { t: 'dice', n }        n dados (1 ou 2): a criança conta os pontinhos
//   { t: 'domino' }         um dominó (0 a 6 de cada lado)
//   { t: 'diceMix' }        dados e dominós misturados
//   { t: 'calc', gen }      contas do gerador do Conta Comigo (problems.js);
//                           só contas de uma resposta, com a resposta no fim
// `maxAbs` do mundo: nenhum número da conta passa disso (centena e milhar só
// nos mundos de adição e subtração, como no Conta Comigo).

(function (root) {
  const SMALL = 100;
  const PACES = {
    dado: [
      { fallMs: 11000, intervalMs: 2600, maxOnScreen: 2, count: 18 },
      { fallMs: 8500, intervalMs: 2000, maxOnScreen: 3, count: 21 },
      { fallMs: 6500, intervalMs: 1500, maxOnScreen: 3, count: 24 },
    ],
    conta: [
      { fallMs: 15000, intervalMs: 3400, maxOnScreen: 2, count: 15 },
      { fallMs: 11500, intervalMs: 2600, maxOnScreen: 3, count: 18 },
      { fallMs: 8500, intervalMs: 1900, maxOnScreen: 3, count: 21 },
    ],
    longa: [
      { fallMs: 19000, intervalMs: 4500, maxOnScreen: 2, count: 12 },
      { fallMs: 15000, intervalMs: 3500, maxOnScreen: 2, count: 14 },
      { fallMs: 11500, intervalMs: 2700, maxOnScreen: 3, count: 16 },
    ],
  };
  const SPEEDS = [
    { label: '🐢 Devagar', tip: 'Sem pressa: as contas caem devagar.' },
    { label: '🐇 Médio', tip: 'Um pouco mais rápido, e mais contas ao mesmo tempo.' },
    { label: '🚀 Rápido', tip: 'Rapidinho! Olhe primeiro para a conta mais perto do chão.' },
  ];

  const calc = (gen) => ({ t: 'calc', gen });
  const table = (list) => calc({ t: 'mul', a: { list }, b: [0, 10], swap: true });
  const divBy = (list) => calc({ t: 'div', d: { list }, q: [0, 10], amax: 99 });

  const WORLDS = [
    {
      id: 'n1', icon: '🎲', name: 'Dados e dominós', color: 'pink', pace: 'dado',
      intro: 'Dados e dominós caem do céu. Conte os pontinhos e digite o número antes que cheguem ao chão!',
      contents: [
        { title: 'Um dado', gen: { t: 'dice', n: 1 }, tip: 'Conte os pontinhos do dado: de 1 a 6.' },
        { title: 'Dois dados', gen: { t: 'dice', n: 2 }, tip: 'Some os pontinhos dos dois dados.' },
        { title: 'Dominós', gen: { t: 'domino' }, tip: 'Some os pontinhos dos dois lados do dominó.' },
        { title: 'Dados e dominós', gen: { t: 'diceMix' }, tip: 'Dados e dominós misturados.' },
      ],
    },
    {
      id: 'n2', icon: '➕', name: 'Somar e tirar: unidades', color: 'green', pace: 'conta',
      intro: 'Contas de mais e de menos com números pequenos. Digite o resultado: a conta estoura sozinha!',
      contents: [
        { title: 'Somas até 10', gen: calc({ t: 'add', a: [0, 10], b: [0, 10], max: 10 }), tip: 'Conte nos dedos a partir do maior número.' },
        { title: 'Subtrações até 10', gen: calc({ t: 'sub', a: [1, 10], b: [0, 10] }), tip: 'Comece no maior e volte.' },
        { title: 'Somas até 20', gen: calc({ t: 'add', a: [0, 20], b: [0, 20], max: 20 }), tip: 'Complete o 10 primeiro e some o que sobra.' },
        { title: 'Mais e menos até 20', gen: calc({ t: 'pick', of: [{ t: 'add', a: [0, 20], b: [0, 20], max: 20 }, { t: 'sub', a: [0, 20], b: [0, 20] }] }), tip: 'Olhe o sinal antes de responder!' },
      ],
    },
    {
      id: 'n3', icon: '🧮', name: 'Somar e tirar: dezenas e centenas', color: 'sky', pace: 'conta',
      intro: 'Contas de mais e de menos com dezenas e centenas. Resolva de cabeça!',
      contents: [
        { title: 'Dezenas inteiras', gen: calc({ t: 'pick', of: [{ t: 'add', a: [10, 90, 10], b: [10, 90, 10], max: 100 }, { t: 'sub', a: [20, 100, 10], b: [10, 90, 10] }] }), tip: '30 + 40 é como 3 + 4, com um zero no fim.' },
        { title: 'Dezena e unidade', gen: calc({ t: 'pick', of: [{ t: 'add', a: [10, 89], b: [1, 9], carry: 'no', swap: true }, { t: 'sub', a: [11, 99], b: [1, 9], borrow: 'no' }] }), tip: 'Mexa só nas unidades: a dezena fica igual.' },
        { title: 'Dezena e dezena', gen: calc({ t: 'pick', of: [{ t: 'add', a: [10, 88], b: [10, 88], carry: 'no', max: 99 }, { t: 'sub', a: [20, 99], b: [10, 89], borrow: 'no' }] }), pace: 'longa', tip: 'Unidade com unidade, dezena com dezena.' },
        { title: 'Centenas inteiras', gen: calc({ t: 'pick', of: [{ t: 'add', a: [100, 900, 100], b: [100, 900, 100], max: 1000 }, { t: 'sub', a: [200, 1000, 100], b: [100, 900, 100] }] }), tip: '300 + 400 é como 3 + 4, com dois zeros no fim.' },
      ],
    },
    {
      id: 'n4', icon: '✖️', name: 'Tabuadas', color: 'orange', pace: 'conta', maxAbs: SMALL,
      intro: 'As tabuadas caindo do céu! Quanto mais você souber de cabeça, mais rápido estoura.',
      contents: [
        { title: '×2, ×5 e ×10', gen: table([2, 5, 10]), tip: 'As tabuadas mais fáceis.' },
        { title: '×3 e ×4', gen: table([3, 4]), tip: 'Vezes 4 é o dobro do dobro.' },
        { title: '×6 e ×7', gen: table([6, 7]), tip: 'Vezes 6 é o dobro da tabuada do 3.' },
        { title: '×8 e ×9', gen: table([8, 9]), tip: 'Truque do 9: vezes 10, menos o número.' },
      ],
    },
    {
      id: 'n5', icon: '➗', name: 'Divisão', color: 'violet', pace: 'conta', maxAbs: SMALL,
      intro: 'Divisões caindo! Pense na tabuada ao contrário.',
      contents: [
        { title: '÷2, ÷5 e ÷10', gen: divBy([2, 5, 10]), tip: 'Dividir por 2 é achar a metade.' },
        { title: '÷3 e ÷4', gen: divBy([3, 4]), tip: 'Pense na tabuada do 3 e do 4.' },
        { title: '÷6 e ÷7', gen: divBy([6, 7]), tip: 'Pense na tabuada do 6 e do 7.' },
        { title: '÷8 e ÷9', gen: divBy([8, 9]), tip: 'Pense na tabuada do 8 e do 9.' },
      ],
    },
    {
      id: 'n6', icon: '🎯', name: 'Misturadas', color: 'pink', pace: 'conta', maxAbs: SMALL,
      intro: 'As quatro operações misturadas. Olhe bem o sinal!',
      contents: [
        { title: 'Mais e menos', gen: calc({ t: 'pick', of: [{ t: 'add', a: [5, 60], b: [5, 39], max: 99 }, { t: 'sub', a: [20, 99], b: [5, 60] }] }), tip: 'Somar ou tirar?' },
        { title: 'Vezes e dividir', gen: calc({ t: 'pick', of: [{ t: 'mul', a: [2, 10], b: [2, 10] }, { t: 'div', d: [2, 10], q: [1, 10], amax: 99 }] }), tip: 'Tabuada para os dois lados.' },
        { title: 'As quatro operações', gen: calc({ t: 'pick', of: [{ t: 'add', a: [0, 20], b: [0, 20], max: 20 }, { t: 'sub', a: [0, 20], b: [0, 20] }, { t: 'mul', a: [2, 10], b: [2, 10] }, { t: 'div', d: [2, 10], q: [1, 10], amax: 99 }] }), tip: '+, −, × e ÷ juntos.' },
        { title: 'Dobro e metade', gen: calc({ t: 'pick', of: [{ t: 'mul', a: 2, b: [2, 50], swap: true }, { t: 'div', d: 2, q: [2, 50] }] }), tip: 'Dobro é ×2. Metade é ÷2.' },
      ],
    },
    {
      id: 'n7', icon: '🌡️', name: 'Números negativos', color: 'sky', pace: 'conta', maxAbs: SMALL, minus: true,
      intro: 'Abaixo do zero também tem números! Para digitar um negativo, aperte − e depois o número.',
      contents: [
        { title: 'Subindo do negativo', gen: calc({ t: 'int', op: '+', a: [-9, -1], b: [1, 9] }), tip: '−5 + 3 = −2: suba a partir de baixo do zero.' },
        { title: 'Descendo abaixo do zero', gen: calc({ t: 'int', op: '-', a: [0, 9], b: [1, 15], need: 'neg-res' }), tip: '2 − 5 = −3: desça além do zero.' },
        { title: '+ e − com negativos', gen: calc({ t: 'int', ops: ['+', '-'], a: [-20, 20], b: [-20, 20] }), tip: 'Tirar um negativo é somar.' },
        { title: '× e ÷ com sinais', gen: calc({ t: 'int', ops: ['*', '/'], a: [-10, 10], b: [-10, 10], q: [-10, 10] }), tip: 'Sinais iguais: +. Sinais diferentes: −.' },
      ],
    },
    {
      id: 'n8', icon: '🚀', name: 'Potências e raízes', color: 'red', pace: 'conta', maxAbs: SMALL,
      intro: 'Potências e raízes caindo! 7² = 49, e √49 = 7.',
      contents: [
        { title: 'Quadrados', gen: calc({ t: 'pow', base: [0, 10], exp: 2 }), tip: 'O número vezes ele mesmo.' },
        { title: 'Raízes quadradas', gen: calc({ t: 'root', n: 2, r: [0, 10] }), tip: 'Que número vezes ele mesmo dá esse?' },
        { title: 'Cubos e raízes cúbicas', gen: calc({ t: 'pick', of: [{ t: 'pow', base: [1, 4], exp: 3 }, { t: 'root', n: 3, r: [1, 4] }, { t: 'pow', base: { list: [2, 3] }, exp: [0, 6], max: 100 }] }), tip: '3³ = 27, e ∛27 = 3.' },
        { title: 'Tudo junto', gen: calc({ t: 'pick', of: [{ t: 'pow', base: [0, 10], exp: 2 }, { t: 'root', n: 2, r: [0, 10] }, { t: 'pow', base: [1, 4], exp: 3 }, { t: 'root', n: 3, r: [1, 4] }] }), tip: 'Potências e raízes misturadas.' },
      ],
    },
  ];

  // Estrelas: quanto das peças a criança pegou (e, para a 3ª, poucos erros).
  const STAR_RULES = [
    { stars: 3, caught: 0.95, accuracy: 85 },
    { stars: 2, caught: 0.8 },
    { stars: 1, caught: 0.6 },
  ];

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
          maxAbs: world.maxAbs,
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

  function starsFor(levelId, { caught, count, accuracy }) {
    if (!getLevel(levelId) || !count) return 0;
    const ratio = caught / count;
    for (const rule of STAR_RULES) {
      if (ratio >= rule.caught - 1e-9 && (rule.accuracy == null || accuracy >= rule.accuracy)) return rule.stars;
    }
    return 0;
  }

  const starsOf = (progress, id) => (progress && progress.levels && progress.levels[id] ? progress.levels[id].stars || 0 : 0);
  const isUnlocked = (progress, id) => Boolean(getLevel(id));
  const nextLevel = (progress) => LEVELS.find((l) => starsOf(progress, l.id) === 0) || null;
  const totalStars = (progress) => LEVELS.reduce((n, l) => n + starsOf(progress, l.id), 0);

  const api = {
    WORLDS, LEVELS, PACES, MAX_STARS: LEVELS.length * 3,
    getLevel, getWorld, starsFor, isUnlocked, nextLevel, totalStars,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NumerosLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
