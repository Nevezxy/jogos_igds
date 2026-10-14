// public/games/carrinhos/levels.js
// Fases do 🚗 Carrinhos: 40 estacionamentos do banco (bank.js), em ordem de
// mínimo de jogadas, de 2 a mais de 30. Cada mundo traz algo novo: mais
// carros, caminhões, e cada vez mais jogadas para planejar.

(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const P = isNode ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;
  const BANK = isNode ? require('./bank.js') : root.CarrinhosBank;

  const W = [
    { id: 'cr1', icon: '🚗', name: 'Primeiras saídas', color: 'orange', intro: 'Tire o carro vermelho do estacionamento pela saída à direita! Os carros só andam para a frente e para trás, nunca de lado.' },
    { id: 'cr2', icon: '🅿️', name: 'Estacionamento cheio', color: 'sky', intro: 'Mais carros no caminho! Às vezes é preciso tirar um carro do caminho de outro.' },
    { id: 'cr3', icon: '🚚', name: 'Caminhões no caminho', color: 'green', intro: 'Os caminhões ocupam 3 vagas e são mais difíceis de tirar do caminho. Pense antes de mexer!' },
    { id: 'cr4', icon: '🧠', name: 'Pense antes de mexer', color: 'violet', intro: 'Agora são muitas jogadas. Descubra qual carro precisa sair primeiro e trabalhe de trás para frente.' },
    { id: 'cr5', icon: '🏆', name: 'Mestre do trânsito', color: 'pink', intro: 'Os estacionamentos mais difíceis! Só os mestres tiram o carro vermelho com poucas jogadas.' },
  ];
  const TIPS = {
    0: 'Arraste o carro vermelho até a saída!',
    1: 'Tem um carro na frente? Tire-o do caminho primeiro.',
    8: 'Olhe quem está bloqueando quem: siga a corrente até o fim.',
    16: 'Um caminhão em pé no caminho precisa ir todo para cima ou todo para baixo.',
    24: 'Às vezes é preciso afastar o carro vermelho para abrir espaço.',
    32: 'Calma: os mestres resolvem pensando várias jogadas à frente.',
  };

  const WORLDS = W.map((w, wi) => ({
    ...w,
    levels: BANK.slice(wi * 8, wi * 8 + 8).map(([board, min], i) => {
      const n = wi * 8 + i;
      return { id: `${w.id}${'abcdefgh'[i]}`, title: `Estacionamento ${n + 1}`, board, min, tip: TIPS[n] || `Dá para tirar com ${min} jogadas.` };
    }),
  }));

  const api = P.build(WORLDS);
  // estrelas: jogadas perto do mínimo; usar dica limita a 2
  api.starsFor = (level, { moves, hints }) => {
    const s = P.starsByRatio(moves, level.min, [1.25, 2]);
    return hints ? Math.min(2, s) : s;
  };
  if (isNode) module.exports = api;
  else root.CarrinhosLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
