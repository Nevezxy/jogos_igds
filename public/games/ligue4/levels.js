// public/games/ligue4/levels.js
// Fases do 🔴🟡 Ligue 4 e Ligue 5: cada fase é um robô que pensa mais
// jogadas à frente. O Ligue 5 tem tabuleiro maior (9 × 7).

(function (root) {
  const Board = typeof module !== 'undefined' && module.exports ? require('../../js/shared/boardlevels.js') : root.BoardLevels;

  const WORLDS = [
    {
      id: 'l4', variant: '4', icon: '🔴', name: 'Ligue 4', short: 'Ligue 4', color: 'red',
      intro: 'Solte as peças nas colunas. Ganha quem ligar 4 da mesma cor: deitado, em pé ou na diagonal!',
      levels: [
        { id: 'l4a', title: 'Robô Bobinho', tip: 'Ele joga quase ao acaso. Ligue 4 peças!', bot: { depth: 1, random: 0.4 }, undo: true },
        { id: 'l4b', title: 'Robô Espertinho', tip: 'Ele já ganha quando pode. Fique de olho nas linhas dele!', bot: { depth: 2, random: 0.15 }, undo: true },
        { id: 'l4c', title: 'Robô Atento', tip: 'Ele bloqueia. Jogue no meio: dá mais chances de ligar 4.', bot: { depth: 3, noise: 30 } },
        { id: 'l4d', title: 'Robô Pensador', tip: 'Ele pensa 4 jogadas à frente. Prepare duas ameaças de uma vez!', bot: { depth: 4, noise: 10 } },
        { id: 'l4e', title: 'Robô Estrategista', tip: 'Cuidado com a peça que você deixa por baixo de uma linha dele.', bot: { depth: 6, maxMs: 1500 } },
        { id: 'l4f', title: 'Robô Mestre', tip: 'O mais forte: pensa 8 jogadas à frente. Boa sorte!', bot: { depth: 8, maxMs: 2000 } },
      ],
    },
    {
      id: 'l5', variant: '5', icon: '🟡', name: 'Ligue 5', short: 'Ligue 5', color: 'yellow',
      intro: 'Tabuleiro maior (9 × 7): agora é preciso ligar 5!',
      levels: [
        { id: 'l5a', title: 'Robô Distraído', tip: '5 em linha: vale deitado, em pé e na diagonal.', bot: { depth: 1, random: 0.3 }, undo: true },
        { id: 'l5b', title: 'Robô Atento', tip: 'Ele bloqueia as suas linhas de 4.', bot: { depth: 3, noise: 20 } },
        { id: 'l5c', title: 'Robô Pensador', tip: 'Ele pensa 4 jogadas à frente.', bot: { depth: 4, maxMs: 1500 } },
        { id: 'l5d', title: 'Robô Mestre', tip: 'O mais forte do Ligue 5.', bot: { depth: 6, maxMs: 2000 } },
      ],
    },
  ];

  const api = Board.build(WORLDS);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ligue4Levels = api;
})(typeof window !== 'undefined' ? window : globalThis);
