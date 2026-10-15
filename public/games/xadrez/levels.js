// public/games/xadrez/levels.js
// Fases do ♟️ Xadrez: primeiro o "Fim de partida" (posições prontas para dar
// mate, como o End of chess game do GCompris: mate em 1, mate em 2, rei e
// dama contra rei, rei e torre contra rei), depois partidas inteiras contra
// 6 robôs. No fim de partida a criança joga sempre com as brancas, e a 3ª
// estrela é dar o mate em até `par` lances.

(function (root) {
  const Board = typeof module !== 'undefined' && module.exports ? require('../../js/shared/boardlevels.js') : root.BoardLevels;
  const END = { depth: 3, maxMs: 1200 };

  const WORLDS = [
    {
      id: 'xf', icon: '🏁', name: 'Fim de partida', short: 'Fim de partida', color: 'green', friend: false,
      intro: 'Posições prontas: você joga com as brancas e dá xeque-mate no rei preto!',
      levels: [
        { id: 'xf1', title: 'Mate na última fileira', variant: 'm1a', seat: 0, par: 1, bot: END, tip: 'A torre pode dar xeque no rei preto, que está preso pelos próprios peões.' },
        { id: 'xf2', title: 'Mate com a dama', variant: 'm1b', seat: 0, par: 1, bot: END, tip: 'O seu rei protege a dama bem perto do rei preto.' },
        { id: 'xf3', title: 'Mate do cavalo', variant: 'm1c', seat: 0, par: 1, bot: END, tip: 'O rei preto está sufocado pelas próprias peças. Só o cavalo chega lá!' },
        { id: 'xf4', title: 'Mate pastor', variant: 'm1d', seat: 0, par: 1, bot: END, tip: 'A dama e o bispo miram a mesma casa perto do rei.' },
        { id: 'xf5', title: 'A escada das torres', variant: 'm2a', seat: 0, par: 2, bot: END, tip: 'Mate em 2: uma torre fecha uma fileira, a outra dá o mate na seguinte.' },
        { id: 'xf6', title: 'O rei ajuda a dama', variant: 'm2b', seat: 0, par: 2, bot: END, tip: 'Mate em 2: às vezes o melhor lance é com o rei, sem dar xeque!' },
        { id: 'xf7', title: 'O rei ajuda a torre', variant: 'm2c', seat: 0, par: 2, bot: END, tip: 'Mate em 2: aproxime o rei e deixe a torre terminar.' },
        { id: 'xf8', title: 'Rei e dama contra rei', variant: 'kq', seat: 0, par: 12, bot: END, tip: 'Empurre o rei preto para a beirada com a dama e traga o seu rei. Cuidado com o afogamento!' },
        { id: 'xf9', title: 'Rei e torre contra rei', variant: 'kr', seat: 0, par: 20, bot: END, tip: 'A torre fecha uma fileira de cada vez; o seu rei fica de frente para o rei preto.' },
      ],
    },
    {
      id: 'xp', variant: 'classico', icon: '♟️', name: 'Partidas', short: 'Partida', friendLabel: 'Partida normal', color: 'violet',
      intro: 'A partida inteira! As brancas começam. Proteja o seu rei e tente dar xeque-mate.',
      levels: [
        { id: 'xp1', title: 'Robô Comilão', tip: 'Ele adora capturar, sem pensar no resto. Cuidado com as peças desprotegidas!', bot: { depth: 1, random: 0.25, quiesce: false }, undo: true },
        { id: 'xp2', title: 'Robô Aprendiz', tip: 'Ele já olha a sua resposta. Desenvolva cavalos e bispos!', bot: { depth: 2, noise: 80, quiesce: false }, undo: true },
        { id: 'xp3', title: 'Robô Atento', tip: 'Ele confere as trocas de peças. Não deixe nada pendurado!', bot: { depth: 2, noise: 30, maxMs: 1500 } },
        { id: 'xp4', title: 'Robô Pensador', tip: 'Ele pensa 3 lances à frente. Faça o roque para proteger o rei.', bot: { depth: 3, noise: 15, maxMs: 1500 } },
        { id: 'xp5', title: 'Robô Estrategista', tip: 'Ocupe o centro e ataque com várias peças juntas.', bot: { depth: 3, maxMs: 1800 } },
        { id: 'xp6', title: 'Robô Mestre', tip: 'O mais forte: pensa até 4 lances à frente e confere todas as trocas. Boa sorte!', bot: { depth: 4, maxMs: 1800 } },
      ],
    },
  ];

  const api = Board.build(WORLDS);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.XadrezLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
