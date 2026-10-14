// public/games/memoria/levels.js
// Fases do 🃏 Jogo da Memória. Cada mundo é um jeito diferente de formar
// par (figura igual, número e quantidade, maiúscula e minúscula, palavra e
// figura, conta e resultado), e as fases crescem em número de cartas. O
// último mundo é contra o robô, que também esquece cartas.
//   kind   'same' | 'count' | 'case' | 'word' | 'calc'
//   pairs  quantos pares (cartas = 2 × pares)
//   theme  (same) bichos | frutas | transportes | tudo
//   calc   (calc) 'add10' | 'addsub10' | 'mul'
//   robot  { memory }: chance de o robô lembrar de cada carta que viu

(function (root) {
  const P = typeof module !== 'undefined' && module.exports ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;

  const WORLDS = [
    {
      id: 'mm1', icon: '🐶', name: 'Figuras iguais', color: 'pink',
      intro: 'Vire duas cartas. Se forem iguais, ficam abertas! Lembre onde cada figura está.',
      levels: [
        { id: 'mm1a', title: '3 pares de bichos', kind: 'same', theme: 'bichos', pairs: 3, tip: 'Comece virando cartas de um canto e vá lembrando.' },
        { id: 'mm1b', title: '6 pares de frutas', kind: 'same', theme: 'frutas', pairs: 6, tip: 'Diga o nome da fruta baixinho: ajuda a lembrar!' },
        { id: 'mm1c', title: '8 pares de transportes', kind: 'same', theme: 'transportes', pairs: 8, tip: 'Lembre a fileira de cada carta: em cima, no meio, embaixo.' },
        { id: 'mm1d', title: '12 pares de tudo', kind: 'same', theme: 'tudo', pairs: 12, tip: 'Muitas cartas! Vá por partes, linha por linha.' },
      ],
    },
    {
      id: 'mm2', icon: '🔢', name: 'Número e quantidade', color: 'green',
      intro: 'Agora o par é o número e a quantidade: o 3 combina com 🍎🍎🍎.',
      levels: [
        { id: 'mm2a', title: 'Números de 1 a 5', kind: 'count', max: 5, pairs: 4, tip: 'Conte as figurinhas da carta.' },
        { id: 'mm2b', title: 'Números de 1 a 8', kind: 'count', max: 8, pairs: 6, tip: 'Conte de dois em dois para ir mais rápido.' },
        { id: 'mm2c', title: 'Números de 1 a 10', kind: 'count', max: 10, pairs: 8, tip: 'Cinco e mais um pouco: conte a partir do 5.' },
      ],
    },
    {
      id: 'mm3', icon: '🔠', name: 'Maiúscula e minúscula', color: 'violet',
      intro: 'O par é a mesma letra, grande e pequena: A combina com a.',
      levels: [
        { id: 'mm3a', title: '6 letras', kind: 'case', pairs: 6, letters: 'ABDEFHMNRT', tip: 'A letra grande e a pequena têm o mesmo som.' },
        { id: 'mm3b', title: '8 letras', kind: 'case', pairs: 8, letters: 'ABDEFGHJLMNQRT', tip: 'Cuidado: b e d, p e q parecem, mas são diferentes!' },
        { id: 'mm3c', title: '12 letras', kind: 'case', pairs: 12, letters: 'ABCDEFGHIJLMNOPQRSTUVXZ', tip: 'O alfabeto quase todo.' },
      ],
    },
    {
      id: 'mm4', icon: '📖', name: 'Palavra e figura', color: 'sky',
      intro: 'Leia a palavra e ache a figura: GATO combina com 🐱.',
      levels: [
        { id: 'mm4a', title: 'Palavras curtas', kind: 'word', len: 'short', pairs: 6, tip: 'Leia devagar, sílaba por sílaba.' },
        { id: 'mm4b', title: 'Mais palavras', kind: 'word', len: 'any', pairs: 8, tip: 'Algumas começam com a mesma letra: leia até o fim!' },
        { id: 'mm4c', title: 'Palavras compridas', kind: 'word', len: 'long', pairs: 10, tip: 'Palavras grandes: olhe o começo e o fim.' },
      ],
    },
    {
      id: 'mm5', icon: '➕', name: 'Conta e resultado', color: 'orange',
      intro: 'O par é a conta e o resultado dela: 3 + 4 combina com 7.',
      levels: [
        { id: 'mm5a', title: 'Somas até 10', kind: 'calc', calc: 'add10', pairs: 6, tip: 'Faça a conta antes de virar a segunda carta.' },
        { id: 'mm5b', title: 'Somar e tirar até 10', kind: 'calc', calc: 'addsub10', pairs: 8, tip: 'Olhe o sinal: + junta, − tira.' },
        { id: 'mm5c', title: 'Tabuada', kind: 'calc', calc: 'mul', pairs: 10, tip: 'Tabuada do 2 ao 9. Lembre os resultados que já viu!' },
      ],
    },
    {
      id: 'mm6', icon: '🤖', name: 'Contra o robô', color: 'red',
      intro: 'Agora é você contra o robô! Cada um vira duas cartas na sua vez. Achou o par? Joga de novo. Quem fizer mais pares vence.',
      levels: [
        { id: 'mm6a', title: 'Robô esquecido', kind: 'same', theme: 'bichos', pairs: 8, robot: { memory: 0.25 }, tip: 'Ele esquece quase tudo. Aproveite!' },
        { id: 'mm6b', title: 'Robô atento', kind: 'same', theme: 'tudo', pairs: 10, robot: { memory: 0.55 }, tip: 'Ele lembra de metade das cartas que vê. As que ele vira, você também vê!' },
        { id: 'mm6c', title: 'Robô memória de elefante', kind: 'count', max: 10, pairs: 10, robot: { memory: 0.85 }, tip: 'Ele quase não esquece. Lembre também das cartas que ele virou!' },
      ],
    },
  ];

  const api = P.build(WORLDS);
  // Estrelas sozinho: tentativas (duas cartas viradas) perto do número de pares.
  // Contra o robô: vencer = 3, empatar = 2, perder = 1 (terminou a partida).
  api.starsFor = (level, { tries, pairs, outcome }) => {
    if (level.robot) return outcome === 'win' ? 3 : outcome === 'draw' ? 2 : 1;
    return P.starsByRatio(tries, pairs, [1.6, 2.4]);
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MemoriaLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
