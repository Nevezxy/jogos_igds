// public/games/velha/levels.js
// Fases do ❌⭕ Jogo da Velha: cada fase é um robô mais esperto que o
// anterior. No 3 × 3 o último é perfeito (no máximo empata, e empatar já
// vale as estrelas). O 4 × 4 pede 4 em linha.

(function (root) {
  const Board = typeof module !== 'undefined' && module.exports ? require('../../js/shared/boardlevels.js') : root.BoardLevels;

  const WORLDS = [
    {
      id: 'v3', variant: '3x3', icon: '❌', name: 'Velha 3 × 3', short: '3 × 3', color: 'pink',
      intro: 'Faça 3 em linha (deitado, em pé ou na diagonal) antes do robô!',
      levels: [
        { id: 'v3a', title: 'Robô Bobinho', tip: 'Ele joga ao acaso. Faça 3 em linha!', bot: { depth: 0 }, undo: true },
        { id: 'v3b', title: 'Robô Espertinho', tip: 'Ele completa a linha quando pode. Fique de olho!', bot: { depth: 1 }, undo: true },
        { id: 'v3c', title: 'Robô Atento', tip: 'Ele também bloqueia. Tente fazer duas ameaças de uma vez!', bot: { depth: 2, random: 0.15 } },
        { id: 'v3d', title: 'Robô Imbatível', tip: 'Ele não erra nunca: empatar já é uma vitória!', bot: { depth: 9 }, drawIsWin: true },
      ],
    },
    {
      id: 'v4', variant: '4x4', icon: '⭕', name: 'Velha 4 × 4', short: '4 × 4', color: 'violet',
      intro: 'Tabuleiro maior: agora são 4 em linha!',
      levels: [
        { id: 'v4a', title: 'Robô Distraído', tip: '4 em linha: vale deitado, em pé e na diagonal.', bot: { depth: 1, random: 0.3 }, undo: true },
        { id: 'v4b', title: 'Robô Pensador', tip: 'Ele pensa 3 jogadas à frente. Bloqueie as linhas dele!', bot: { depth: 3, noise: 8 } },
        { id: 'v4c', title: 'Robô Estrategista', tip: 'O mais difícil do 4 × 4. Ocupe o meio do tabuleiro!', bot: { depth: 5, maxMs: 1500 } },
      ],
    },
  ];

  const api = Board.build(WORLDS);
  // Dificuldade de cada fase (1 a 4) para os pontos globais e o Modo Maratona: a força do robô.
  const TIERS = { v3a: 1, v3b: 1, v3c: 2, v3d: 2, v4a: 2, v4b: 3, v4c: 3 };
  api.LEVELS.forEach((l) => { l.tier = TIERS[l.id] || l.tier; });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VelhaLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
