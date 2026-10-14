// public/games/quebracabeca/levels.js
// Fases do 🧩 Quebra-cabeça: de 4 a 48 peças, com as fotos livres (CC0) que
// também estão no 🖱️ Click. Primeiro com a "sombra" da foto no fundo,
// depois sem sombra e, por fim, com as peças viradas (toque para girar).
//   cols × rows  peças      shadow  a foto clarinha no fundo
//   rotate       as peças começam viradas
//   photo        a foto (public/games/click/img/<photo>.jpg)

(function (root) {
  const P = typeof module !== 'undefined' && module.exports ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;

  const PHOTOS = {
    leao: 'Leão', elefante: 'Elefante', girafa: 'Girafa', golfinhos: 'Golfinhos', tartaruga: 'Tartaruga-marinha', borboleta: 'Borboleta',
    panda: 'Panda', papagaio: 'Papagaio', zebras: 'Zebras', coruja: 'Coruja', cachorrinho: 'Cachorrinho', gatinho: 'Gatinho',
    poneis: 'Pôneis', girassol: 'Girassol', balao: 'Balões', pinguim: 'Pinguim', coala: 'Coala', tigre: 'Tigre', raposa: 'Raposa',
  };
  const lv = (id, photo, cols, rows, extra = {}) => ({ id, photo, cols, rows, pieces: cols * rows, title: `${PHOTOS[photo]} · ${cols * rows} peças`, shadow: true, ...extra });

  const WORLDS = [
    {
      id: 'qc1', icon: '🧩', name: 'Primeiras peças', color: 'orange',
      intro: 'Arraste cada peça até o lugar dela na moldura. A foto clarinha no fundo ajuda! Perto do lugar certo, a peça gruda sozinha.',
      levels: [
        lv('qc1a', 'gatinho', 2, 2, { tip: 'Comece pelos cantos: eles têm dois lados retos.' }),
        lv('qc1b', 'cachorrinho', 3, 2),
        lv('qc1c', 'panda', 3, 3),
        lv('qc1d', 'girassol', 4, 3),
      ],
    },
    {
      id: 'qc2', icon: '🖼️', name: 'Mais peças', color: 'sky',
      intro: 'Quebra-cabeças maiores! Monte primeiro a borda, depois o meio.',
      levels: [
        lv('qc2a', 'papagaio', 5, 4, { tip: 'Separe as peças da borda: elas têm um lado reto.' }),
        lv('qc2b', 'golfinhos', 6, 4),
        lv('qc2c', 'leao', 6, 5),
      ],
    },
    {
      id: 'qc3', icon: '🙈', name: 'Sem sombra', color: 'green',
      intro: 'Agora a moldura está vazia: sem a foto no fundo. Olhe as cores e os encaixes de cada peça!',
      levels: [
        lv('qc3a', 'coruja', 4, 3, { shadow: false, tip: 'O céu e o chão ajudam a saber o que vai em cima e embaixo.' }),
        lv('qc3b', 'raposa', 5, 4, { shadow: false }),
        lv('qc3c', 'zebras', 6, 5, { shadow: false }),
        lv('qc3d', 'elefante', 7, 5, { shadow: false }),
      ],
    },
    {
      id: 'qc4', icon: '🔄', name: 'Peças viradas', color: 'violet',
      intro: 'As peças estão viradas! Toque numa peça para girar. Ela só gruda quando estiver na posição certa.',
      levels: [
        lv('qc4a', 'balao', 3, 2, { rotate: true, tip: 'Toque na peça (sem arrastar) para ela girar.' }),
        lv('qc4b', 'pinguim', 4, 3, { rotate: true }),
        lv('qc4c', 'tartaruga', 5, 4, { rotate: true }),
        lv('qc4d', 'coala', 6, 5, { rotate: true, shadow: false }),
      ],
    },
    {
      id: 'qc5', icon: '🏆', name: 'Mestre das peças', color: 'pink',
      intro: 'Os maiores quebra-cabeças: 48 peças! Paciência e atenção.',
      levels: [
        lv('qc5a', 'tigre', 8, 6, { tip: 'Monte a borda primeiro e depois por cores.' }),
        lv('qc5b', 'girafa', 8, 6, { shadow: false }),
        lv('qc5c', 'poneis', 8, 6, { rotate: true, shadow: false, tip: 'O maior desafio: 48 peças viradas e sem sombra!' }),
      ],
    },
  ];

  const api = P.build(WORLDS);
  api.PHOTOS = PHOTOS;
  api.photoUrl = (level) => `/games/click/img/${level.photo}.jpg`;
  // o tempo bom de cada fase: uns segundos por peça (mais sem sombra e com peças viradas)
  api.parSeconds = (level) => level.pieces * ((level.shadow ? 5 : 7) + (level.rotate ? 3 : 0)) + 10;
  api.starsFor = (level, { seconds }) => {
    const par = api.parSeconds(level);
    if (seconds <= par) return 3;
    if (seconds <= par * 2) return 2;
    return 1;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuebraLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
