// public/games/pixel/levels.js
// Fases do 🎨 Pixel Art: de 8 × 8 com 2 cores a 24 × 24 com 10 cores, e no
// fim "Pinte com contas" (no lugar do número vem uma conta).
//   design  o desenho (designs.js)
//   bucket  o balde (pinta a região inteira de uma vez)
//   op      contas: 'add' | 'sub' | 'addsub' | 'mul' | 'div' | 'mix'

(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const P = isNode ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;
  const DESIGNS = isNode ? require('./designs.js') : root.PixelDesigns;

  const lv = (id, design, extra = {}) => ({ id, design, title: DESIGNS[design].name, ...extra });
  const WORLDS = [
    {
      id: 'px1', icon: '🖍️', name: 'Primeiros desenhos', color: 'orange',
      intro: 'Escolha a cor pelo número e pinte os quadradinhos com o mesmo número. No fim aparece o desenho!',
      levels: [
        lv('px1a', 'coracao', { tip: 'Escolha a cor 1 e pinte todos os quadradinhos com 1.' }),
        lv('px1b', 'sorriso', { tip: 'Segure e arraste para pintar vários de uma vez.' }),
        lv('px1c', 'maca', { tip: 'Agora são 3 cores. Termine uma cor antes de trocar.' }),
        lv('px1d', 'cogumelo'),
        lv('px1e', 'barco'),
        lv('px1f', 'peixe'),
      ],
    },
    {
      id: 'px2', icon: '🏡', name: 'Desenhos maiores', color: 'sky',
      intro: 'Desenhos maiores e com mais cores. Agora você tem o balde 🪣: ele pinta de uma vez a área toda do mesmo número!',
      levels: [
        lv('px2a', 'gato', { bucket: true, tip: 'Use o balde 🪣 nas áreas grandes.' }),
        lv('px2b', 'flor', { bucket: true }),
        lv('px2c', 'sorvete', { bucket: true }),
        lv('px2d', 'arvore', { bucket: true }),
        lv('px2e', 'foguete', { bucket: true }),
        lv('px2f', 'casinha', { bucket: true }),
      ],
    },
    {
      id: 'px3', icon: '🦋', name: 'Bichos e bandeira', color: 'green',
      intro: 'Quadros de 14 a 16 quadradinhos de lado, com até 6 cores. Olhe bem os números pequenos!',
      levels: [
        lv('px3a', 'brasil', { bucket: true, tip: 'Verde, amarelo, azul e branco: a nossa bandeira!' }),
        lv('px3b', 'pinguim', { bucket: true }),
        lv('px3c', 'abacaxi', { bucket: true, tip: 'O abacaxi tem muitos quadradinhos soltos: aqui o pincel é melhor que o balde.' }),
        lv('px3d', 'borboleta', { bucket: true }),
        lv('px3e', 'tartaruga', { bucket: true }),
        lv('px3f', 'coruja', { bucket: true }),
      ],
    },
    {
      id: 'px4', icon: '🌈', name: 'Obras de arte', color: 'violet',
      intro: 'Os quadros grandes: até 24 × 24 quadradinhos e 10 cores. Use a lupa 🔍 para ver de perto.',
      levels: [
        lv('px4a', 'arcoiris', { bucket: true, tip: 'As faixas do arco-íris vão na ordem das cores.' }),
        lv('px4b', 'girassol', { bucket: true }),
        lv('px4c', 'robo', { bucket: true }),
        lv('px4d', 'papagaio', { bucket: true }),
        lv('px4e', 'aquario', { bucket: true }),
        lv('px4f', 'casa', { bucket: true, tip: 'O maior quadro: 10 cores! Vá cor por cor.' }),
      ],
    },
    {
      id: 'px5', icon: '🧮', name: 'Pinte com contas', color: 'pink',
      intro: 'Agora, no lugar do número vem uma conta. Faça a conta para descobrir a cor!',
      levels: [
        lv('px5a', 'joaninha', { op: 'add', title: 'Joaninha das somas', tip: '2+1 é a cor 3.' }),
        lv('px5b', 'sapo', { op: 'add', bucket: true, title: 'Sapo das somas' }),
        lv('px5c', 'abelha', { op: 'sub', bucket: true, title: 'Abelha das subtrações', tip: '7−3 é a cor 4.' }),
        lv('px5d', 'carro', { op: 'addsub', bucket: true, title: 'Carro de mais e menos' }),
        lv('px5e', 'picole', { op: 'mul', bucket: true, title: 'Picolé da tabuada', tip: '2×2 é a cor 4.' }),
        lv('px5f', 'polvo', { op: 'mix', bucket: true, title: 'Polvo das quatro contas', tip: 'Tem +, −, × e ÷. 10÷2 é a cor 5.' }),
      ],
    },
  ];

  const api = P.build(WORLDS);
  api.DESIGNS = DESIGNS;
  api.designOf = (level) => DESIGNS[level.design];
  // estrelas pelos erros, conforme o tamanho do desenho
  api.starsFor = (level, { errors, total }) => {
    if (errors <= Math.max(1, Math.floor(total * 0.01))) return 3;
    if (errors <= Math.max(4, Math.floor(total * 0.05))) return 2;
    return 1;
  };
  if (isNode) module.exports = api;
  else root.PixelLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
