// public/games/diferencas/levels.js
// Fases do 🔍 Encontre a Diferença: de 3 diferenças bem fáceis (figura que
// sumiu, a mais, cor trocada) a 10 diferenças sutis numa cena cheia.
//   theme    'parque' | 'mar' | 'espaco' | 'mix' (sorteado)
//   objects  figuras na cena     diffs  diferenças
//   kinds    os tipos de diferença, na ordem em que vão sendo usados
//   subtle   cores parecidas, mudanças pequenas e figuras menores

(function (root) {
  const P = typeof module !== 'undefined' && module.exports ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;

  const EASY = ['missing', 'color', 'extra'];
  const MID = ['missing', 'size', 'color', 'move', 'extra'];
  const ALL = ['flip', 'color', 'missing', 'size', 'move', 'color2', 'extra'];
  const WORLDS = [
    {
      id: 'df1', icon: '👀', name: 'Olho vivo', color: 'orange',
      intro: 'As duas cenas parecem iguais, mas não são! Toque onde estiver diferente, em qualquer uma das duas.',
      levels: [
        { id: 'df1a', title: 'No parque', theme: 'parque', objects: 7, diffs: 3, kinds: EASY, tip: 'Procure algo que sumiu ou que mudou de cor.' },
        { id: 'df1b', title: 'No fundo do mar', theme: 'mar', objects: 7, diffs: 3, kinds: EASY },
        { id: 'df1c', title: 'No espaço', theme: 'espaco', objects: 8, diffs: 4, kinds: EASY },
        { id: 'df1d', title: 'Passeio surpresa', theme: 'mix', objects: 8, diffs: 4, kinds: EASY, tip: 'O cenário é sorteado: cada vez é um!' },
      ],
    },
    {
      id: 'df2', icon: '📏', name: 'Tamanho e lugar', color: 'sky',
      intro: 'Agora as figuras também crescem, encolhem e mudam de lugar!',
      levels: [
        { id: 'df2a', title: 'Parque crescido', theme: 'parque', objects: 9, diffs: 4, kinds: MID, tip: 'Compare o tamanho de cada figura com a do outro lado.' },
        { id: 'df2b', title: 'Mar agitado', theme: 'mar', objects: 9, diffs: 5, kinds: MID },
        { id: 'df2c', title: 'Planetas fora do lugar', theme: 'espaco', objects: 10, diffs: 5, kinds: MID },
        { id: 'df2d', title: 'Cenário surpresa', theme: 'mix', objects: 10, diffs: 6, kinds: MID },
      ],
    },
    {
      id: 'df3', icon: '🔄', name: 'Tudo ao contrário', color: 'green',
      intro: 'Tem figura virada para o outro lado e detalhe trocado. Olhe para onde cada bicho está olhando!',
      levels: [
        { id: 'df3a', title: 'Passarinhos virados', theme: 'parque', objects: 11, diffs: 6, kinds: ALL, tip: 'Para que lado o passarinho olha?' },
        { id: 'df3b', title: 'Peixes de ponta-cabeça', theme: 'mar', objects: 11, diffs: 6, kinds: ALL },
        { id: 'df3c', title: 'Foguetes ao contrário', theme: 'espaco', objects: 12, diffs: 7, kinds: ALL },
        { id: 'df3d', title: 'Viagem surpresa', theme: 'mix', objects: 12, diffs: 7, kinds: ALL },
      ],
    },
    {
      id: 'df4', icon: '🔎', name: 'Detalhes', color: 'violet',
      intro: 'Diferenças pequenininhas: cores parecidas e mudanças bem sutis. Use a lupa dos seus olhos!',
      levels: [
        { id: 'df4a', title: 'Parque dos detalhes', theme: 'parque', objects: 13, diffs: 7, kinds: ALL, subtle: true, tip: 'A cor pode ter mudado só um pouquinho.' },
        { id: 'df4b', title: 'Mar dos detalhes', theme: 'mar', objects: 13, diffs: 8, kinds: ALL, subtle: true },
        { id: 'df4c', title: 'Espaço dos detalhes', theme: 'espaco', objects: 14, diffs: 8, kinds: ALL, subtle: true },
        { id: 'df4d', title: 'Detalhes surpresa', theme: 'mix', objects: 14, diffs: 9, kinds: ALL, subtle: true },
      ],
    },
    {
      id: 'df5', icon: '🏆', name: 'Detetive mestre', color: 'pink',
      intro: 'Cenas cheias e 10 diferenças sutis. Só os melhores detetives acham todas sem errar!',
      levels: [
        { id: 'df5a', title: 'Parque lotado', theme: 'parque', objects: 16, diffs: 9, kinds: ALL, subtle: true },
        { id: 'df5b', title: 'Recife de corais', theme: 'mar', objects: 16, diffs: 10, kinds: ALL, subtle: true },
        { id: 'df5c', title: 'Galáxia', theme: 'espaco', objects: 17, diffs: 10, kinds: ALL, subtle: true },
        { id: 'df5d', title: 'O grande desafio', theme: 'mix', objects: 17, diffs: 10, kinds: ALL, subtle: true, tip: 'Divida a cena em pedaços e confira um por vez.' },
      ],
    },
  ];

  const api = P.build(WORLDS);
  // estrelas: toques errados e dicas
  api.starsFor = (level, { errors, hints }) => {
    if (errors <= 1 && !hints) return 3;
    if (errors <= 4 && hints <= 1) return 2;
    return 1;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DiferencasLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
