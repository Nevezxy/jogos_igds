// public/games/labirinto/levels.js
// Fases do 🌀 Labirinto: do pequeno ao grande, depois com chaves e portas,
// invisível (as paredes só aparecem quando você bate nelas), no escuro (só a
// lanterna em volta) e relativo (virar e andar, para treinar esquerda e
// direita). Cada rodada é um labirinto novo (sorteado pela semente).
//   size      casas de largura (e de altura)
//   keys      quantas portas (cada uma com a chave da sua cor)
//   mode      'normal' | 'invisible' | 'dark' | 'relative'
//   slack     [a, b]: 3 estrelas com até a × o caminho mais curto, 2 com até b ×

(function (root) {
  const P = typeof module !== 'undefined' && module.exports ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;

  const WORLDS = [
    {
      id: 'lb1', icon: '🌀', name: 'Labirintos', color: 'sky',
      intro: 'Leve o explorador até a bandeira 🏁. Use as setas do teclado, os botões da tela ou deslize o dedo.',
      levels: [
        { id: 'lb1a', title: 'Labirinto pequeno', size: 5, mode: 'normal', slack: [1.25, 2], tip: 'Olhe o caminho com os olhos antes de andar.' },
        { id: 'lb1b', title: 'Labirinto médio', size: 7, mode: 'normal', slack: [1.25, 2], tip: 'Achou um beco sem saída? Volte até a última encruzilhada.' },
        { id: 'lb1c', title: 'Labirinto grande', size: 9, mode: 'normal', slack: [1.25, 2], tip: 'Comece de trás para frente: da bandeira até você.' },
        { id: 'lb1d', title: 'Labirinto gigante', size: 11, mode: 'normal', slack: [1.3, 2.1], tip: 'Calma: siga um caminho de cada vez.' },
        { id: 'lb1e', title: 'Labirinto enorme', size: 13, mode: 'normal', slack: [1.3, 2.2], tip: 'O maior de todos. Boa exploração!' },
      ],
    },
    {
      id: 'lb2', icon: '🔑', name: 'Chaves e portas', color: 'orange',
      intro: 'Tem porta trancada no caminho! Pegue a chave da mesma cor para abrir.',
      levels: [
        { id: 'lb2a', title: 'Uma porta', size: 9, keys: 1, mode: 'normal', slack: [1.3, 2.2], tip: 'A chave fica antes da porta. Procure!' },
        { id: 'lb2b', title: 'Duas portas', size: 11, keys: 2, mode: 'normal', slack: [1.35, 2.3], tip: 'Cada porta tem a chave da mesma cor.' },
        { id: 'lb2c', title: 'Três portas', size: 13, keys: 3, mode: 'normal', slack: [1.4, 2.4], tip: 'Planeje: qual chave pegar primeiro?' },
      ],
    },
    {
      id: 'lb3', icon: '👻', name: 'Labirinto invisível', color: 'violet',
      intro: 'As paredes são invisíveis! Elas só aparecem quando você bate nelas. Lembre por onde já passou.',
      levels: [
        { id: 'lb3a', title: 'Invisível pequeno', size: 6, mode: 'invisible', slack: [1.8, 3], tip: 'O rastro mostra por onde você passou.' },
        { id: 'lb3b', title: 'Invisível médio', size: 8, mode: 'invisible', slack: [1.9, 3.2], tip: 'Bateu? Agora você sabe que ali tem parede.' },
        { id: 'lb3c', title: 'Invisível grande', size: 10, mode: 'invisible', slack: [2, 3.4], tip: 'Use a memória: volte pelo rastro quando der em parede.' },
      ],
    },
    {
      id: 'lb4', icon: '🔦', name: 'No escuro', color: 'red',
      intro: 'Apagaram a luz! Você só enxerga em volta da sua lanterna.',
      levels: [
        { id: 'lb4a', title: 'Escuro médio', size: 9, mode: 'dark', slack: [1.6, 2.6], tip: 'Siga sempre a parede da direita: uma hora você chega!' },
        { id: 'lb4b', title: 'Escuro grande', size: 11, mode: 'dark', slack: [1.7, 2.8], tip: 'O rastro aparece mesmo no escuro.' },
        { id: 'lb4c', title: 'Escuro com chave', size: 11, keys: 1, mode: 'dark', slack: [1.8, 3], tip: 'Ache a chave no escuro e depois a porta!' },
      ],
    },
    {
      id: 'lb5', icon: '🧭', name: 'Virar e andar', color: 'green',
      intro: 'Agora você não anda para cima ou para baixo: você vira para a sua esquerda ou para a sua direita e anda para a frente, como se estivesse lá dentro!',
      levels: [
        { id: 'lb5a', title: 'Virando no pequeno', size: 5, mode: 'relative', slack: [1.3, 2.2], tip: 'A seta mostra para onde o explorador está olhando.' },
        { id: 'lb5b', title: 'Virando no médio', size: 7, mode: 'relative', slack: [1.35, 2.3], tip: 'Se ele está olhando para baixo, a esquerda dele é a sua direita!' },
        { id: 'lb5c', title: 'Virando no grande', size: 9, mode: 'relative', slack: [1.4, 2.4], tip: 'Imagine que você é o explorador.' },
      ],
    },
  ];

  const api = P.build(WORLDS);
  api.starsFor = (level, { steps, shortest }) => P.starsByRatio(steps, shortest, level.slack);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LabirintoLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
