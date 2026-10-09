// public/games/hanoi/levels.js
// Fases da 🗼 Torre de Hanói: a torre clássica de 3 a 7 discos, a torre
// bagunçada, "copie o modelo" e, no fim, com 4 pinos.
//   n     discos
//   pegs  pinos (3 ou 4)
//   mode  'classic' | 'messy' | 'copy'

(function (root) {
  const P = typeof module !== 'undefined' && module.exports ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;

  const WORLDS = [
    {
      id: 'hn1', icon: '🗼', name: 'Torre clássica', color: 'orange',
      intro: 'Leve a torre inteira para o último pino. Só pode mover o disco de cima, um por vez, e nunca colocar um disco grande em cima de um pequeno!',
      levels: [
        { id: 'hn1a', title: '3 discos', n: 3, pegs: 3, mode: 'classic', tip: 'Dá para fazer em 7 movimentos. O disco pequeno anda bastante!' },
        { id: 'hn1b', title: '4 discos', n: 4, pegs: 3, mode: 'classic', tip: 'Primeiro tire os 3 de cima do caminho, como na fase anterior.' },
        { id: 'hn1c', title: '5 discos', n: 5, pegs: 3, mode: 'classic', tip: 'Truque: o disco menor sempre anda na mesma direção, em roda.' },
        { id: 'hn1d', title: '6 discos', n: 6, pegs: 3, mode: 'classic', tip: 'São 63 movimentos no mínimo. Calma e atenção!' },
        { id: 'hn1e', title: '7 discos', n: 7, pegs: 3, mode: 'classic', tip: 'O grande desafio: 127 movimentos no mínimo!' },
      ],
    },
    {
      id: 'hn2', icon: '🌪️', name: 'Torre bagunçada', color: 'pink',
      intro: 'Os discos estão espalhados! Monte a torre toda no último pino.',
      levels: [
        { id: 'hn2a', title: 'Bagunça com 4 discos', n: 4, pegs: 3, mode: 'messy', atLeast: 8, tip: 'Comece pelo disco maior: onde ele precisa ir?' },
        { id: 'hn2b', title: 'Bagunça com 5 discos', n: 5, pegs: 3, mode: 'messy', atLeast: 18, tip: 'Junte primeiro os pequenos numa torre só.' },
        { id: 'hn2c', title: 'Bagunça com 6 discos', n: 6, pegs: 3, mode: 'messy', atLeast: 35, tip: 'Pense de trás para frente: qual disco tem que ir primeiro para o lugar?' },
      ],
    },
    {
      id: 'hn3', icon: '🖼️', name: 'Copie o modelo', color: 'violet',
      intro: 'Arrume os discos igualzinho ao modelo desenhado em cima.',
      levels: [
        { id: 'hn3a', title: 'Modelo com 4 discos', n: 4, pegs: 3, mode: 'copy', atLeast: 8, tip: 'Olhe o modelo: onde fica o disco maior?' },
        { id: 'hn3b', title: 'Modelo com 5 discos', n: 5, pegs: 3, mode: 'copy', atLeast: 16, tip: 'Coloque primeiro os discos grandes no lugar.' },
      ],
    },
    {
      id: 'hn4', icon: '4️⃣', name: 'Quatro pinos', color: 'green',
      intro: 'Agora com 4 pinos! Com um pino a mais, dá para fazer com bem menos movimentos.',
      levels: [
        { id: 'hn4a', title: '5 discos, 4 pinos', n: 5, pegs: 4, mode: 'classic', tip: 'Use os dois pinos do meio para guardar discos.' },
        { id: 'hn4b', title: '6 discos, 4 pinos', n: 6, pegs: 4, mode: 'classic', tip: 'Guarde uma pilha pequena num pino e use os outros.' },
        { id: 'hn4c', title: '7 discos, 4 pinos', n: 7, pegs: 4, mode: 'classic', tip: 'Dá para fazer em 25 movimentos. Será que você consegue?' },
      ],
    },
  ];

  const api = P.build(WORLDS);
  // estrelas: movimentos perto do mínimo; usar dica limita a 2
  api.starsFor = (level, { moves, min, hints }) => {
    const s = P.starsByRatio(moves, min, [1, 1.5]);
    return hints ? Math.min(2, s) : s;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HanoiLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
