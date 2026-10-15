// public/games/dinheiro/levels.js
// Fases do 💰 Dinheiro e Troco: contar o dinheiro, pagar o valor exato,
// pagar com menos notas e moedas, dar o troco e a lojinha (somar os preços).
// Cada fase é uma rodada de tarefas; começa com reais inteiros e depois
// entram os centavos.
//   task      'count' | 'pay' | 'fewest' | 'change'
//   money     as notas e moedas que aparecem (em centavos)
//   range     [mín, máx] do valor (ou do preço de cada item), em centavos
//   step      de quanto em quanto o preço varia (100 = reais inteiros)
//   items     quantos itens na compra (lojinha: 2 ou 3)
//   paidWith  as notas com que o cliente paga (troco)
//   hideTotal não mostra o total do que já foi colocado no balcão

(function (root) {
  const P = typeof module !== 'undefined' && module.exports ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;

  const NOTES_SMALL = [100, 200, 500, 1000];
  const NOTES = [100, 200, 500, 1000, 2000, 5000];
  const COINS = [5, 10, 25, 50, 100];
  const ALL_SMALL = [...COINS, 200, 500, 1000];
  const ALL = [...COINS, 200, 500, 1000, 2000, 5000, 10000];

  const WORLDS = [
    {
      id: 'dm1', icon: '🪙', name: 'Quanto tem aqui?', color: 'yellow',
      intro: 'Conte o dinheiro que está na mesa e escolha quanto tem. Comece pelas notas maiores!',
      levels: [
        { id: 'dm1a', title: 'Moedas de 1 real e notas pequenas', task: 'count', money: [100, 200, 500], range: [200, 2000], pieces: 5, count: 6, tip: 'Some primeiro as notas de 5, depois as de 2 e por último as moedas.' },
        { id: 'dm1b', title: 'Notas até R$ 50', task: 'count', money: [200, 500, 1000, 2000, 5000], range: [700, 10000], pieces: 5, count: 6, tip: 'Comece pela nota maior e vá somando.' },
        { id: 'dm1c', title: 'Contando moedas', task: 'count', money: [5, 10, 25, 50, 100], range: [15, 500], pieces: 6, step: 5, count: 6, tip: 'Duas moedas de 50 centavos fazem 1 real. Quatro de 25 também!' },
        { id: 'dm1d', title: 'Notas e moedas juntas', task: 'count', money: ALL_SMALL, range: [105, 3000], pieces: 6, step: 5, count: 6, tip: 'Conte os reais das notas e depois os centavos das moedas.' },
      ],
    },
    {
      id: 'dm2', icon: '🛒', name: 'Pague o valor exato', color: 'green',
      intro: 'Toque no dinheiro para colocar no balcão até dar o preço certinho. Tocou demais? Toque no balcão para tirar.',
      levels: [
        { id: 'dm2a', title: 'Até R$ 10', task: 'pay', money: NOTES_SMALL, range: [200, 1000], count: 6, tip: 'R$ 7 pode ser 5 + 2, ou 5 + 1 + 1...' },
        { id: 'dm2b', title: 'Até R$ 50', task: 'pay', money: NOTES, range: [1100, 5000], count: 6, tip: 'Junte as notas maiores primeiro.' },
        { id: 'dm2c', title: 'Com centavos', task: 'pay', money: ALL_SMALL, range: [105, 1000], step: 5, count: 6, tip: 'Pague os reais com notas e moedas de 1 real, e os centavos com as moedinhas.' },
        { id: 'dm2d', title: 'Sem ver o total', task: 'pay', money: ALL_SMALL, range: [150, 2000], step: 5, hideTotal: true, count: 6, tip: 'Agora o balcão não soma para você: faça a conta de cabeça!' },
      ],
    },
    {
      id: 'dm3', icon: '🧮', name: 'Com menos notas e moedas', color: 'violet',
      intro: 'Pague o valor exato usando o menor número de notas e moedas possível.',
      levels: [
        { id: 'dm3a', title: 'Menos notas até R$ 20', task: 'fewest', money: [100, 200, 500, 1000, 2000], range: [300, 2000], count: 6, tip: 'Use sempre a maior nota que cabe no que falta.' },
        { id: 'dm3b', title: 'Menos notas e moedas', task: 'fewest', money: ALL, range: [105, 10000], step: 5, count: 6, tip: 'Maior nota que cabe, depois a próxima... até as moedas.' },
      ],
    },
    {
      id: 'dm4', icon: '💸', name: 'Dê o troco', color: 'orange',
      intro: 'O cliente pagou com uma nota maior que o preço. Devolva o troco certinho!',
      levels: [
        { id: 'dm4a', title: 'Troco em reais', task: 'change', money: NOTES_SMALL, range: [100, 1800], paidWith: [1000, 2000], count: 6, tip: 'Troco = o que o cliente pagou − o preço. Conte a partir do preço até chegar no que ele deu.' },
        { id: 'dm4b', title: 'Troco com centavos', task: 'change', money: ALL_SMALL, range: [50, 950], step: 5, paidWith: [500, 1000], count: 6, tip: 'Complete os centavos até o próximo real primeiro.' },
        { id: 'dm4c', title: 'Troco grande', task: 'change', money: ALL, range: [500, 9000], step: 50, paidWith: [5000, 10000], count: 6, tip: 'Complete até a dezena de reais e depois até o valor da nota.' },
      ],
    },
    {
      id: 'dm5', icon: '🏪', name: 'Lojinha', color: 'pink',
      intro: 'A lista de compras tem mais de uma coisa: some os preços e pague!',
      levels: [
        { id: 'dm5a', title: 'Duas compras', task: 'pay', items: 2, money: NOTES, range: [100, 1500], count: 5, tip: 'Some os dois preços antes de pagar.' },
        { id: 'dm5b', title: 'Três compras com centavos', task: 'pay', items: 3, money: ALL_SMALL, range: [50, 600], step: 5, count: 5, tip: 'Some os reais, depois os centavos.' },
        { id: 'dm5c', title: 'Compra e troco', task: 'change', items: 2, money: ALL, range: [150, 2400], step: 50, paidWith: [5000, 10000], count: 5, tip: 'Primeiro some a compra. Depois calcule o troco.' },
      ],
    },
  ];

  const api = P.build(WORLDS);
  // pontos: de primeira = 1, na segunda tentativa = ½. Estrelas pela fração.
  api.starsFor = (level, { score, count }) => {
    const f = score / count;
    return f >= 0.9 ? 3 : f >= 0.7 ? 2 : f >= 0.45 ? 1 : 0;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DinheiroLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
