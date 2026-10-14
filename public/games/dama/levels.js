// public/games/dama/levels.js
// Fases da ⚫⚪ Dama brasileira: cada fase é um robô que pensa mais lances à
// frente. Desfazer só nos dois primeiros.

(function (root) {
  const Board = typeof module !== 'undefined' && module.exports ? require('../../js/shared/boardlevels.js') : root.BoardLevels;

  const WORLDS = [
    {
      id: 'dm', variant: 'brasileira', icon: '⚫', name: 'Dama brasileira', short: 'Dama', color: 'orange',
      intro: 'As brancas começam. Capturar é obrigatório, e vale a jogada que captura mais peças! Chegue do outro lado para virar dama.',
      levels: [
        { id: 'dm1', title: 'Robô Distraído', tip: 'Ele joga quase ao acaso. As peças que podem jogar ficam destacadas.', bot: { depth: 1, random: 0.4 }, undo: true },
        { id: 'dm2', title: 'Robô Guloso', tip: 'Ele só olha o lance seguinte. Ofereça uma peça e capture duas de volta!', bot: { depth: 2, noise: 60 }, undo: true },
        { id: 'dm3', title: 'Robô Atento', tip: 'Ele já pensa no seu lance seguinte. Mantenha as peças juntas.', bot: { depth: 4, noise: 25 } },
        { id: 'dm4', title: 'Robô Pensador', tip: 'Guarde a fileira de trás: assim ele demora a fazer dama.', bot: { depth: 6, noise: 8, maxMs: 1500 } },
        { id: 'dm5', title: 'Robô Mestre', tip: 'O mais forte: pensa até 8 lances à frente. Uma dama vale por três pedras!', bot: { depth: 8, maxMs: 1800 } },
      ],
    },
  ];

  const api = Board.build(WORLDS);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DamaLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
