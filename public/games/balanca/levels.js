// public/games/balanca/levels.js
// Fases da ⚖️ Balança: pesos pequenos → somar vários pesos → pesos nos dois
// pratos (subtração) → gramas e quilos → "quanto pesa?" (o peso do objeto
// é desconhecido: equilibre e descubra).
//   mode     'right' | 'both' | 'unknown'
//   palette  os pesos que podem aparecer
//   range    [mín, máx] do peso do objeto
//   unit     'g' para gramas e quilos (sem unit: só números)
//   maxUse   quantos pesos, no máximo, a solução usa

(function (root) {
  const P = typeof module !== 'undefined' && module.exports ? require('../../js/shared/puzzlelevels.js') : root.PuzzleLevels;

  const WORLDS = [
    {
      id: 'bl1', icon: '⚖️', name: 'Equilibre com pesos', color: 'sky',
      intro: 'A balança pende para o lado mais pesado. Coloque pesos no prato da direita até ela ficar retinha!',
      levels: [
        { id: 'bl1a', title: 'Até 10', mode: 'right', palette: [1, 2, 5], range: [3, 10], maxUse: 3, count: 5, tip: 'Comece pelo peso maior que cabe.' },
        { id: 'bl1b', title: 'Até 20', mode: 'right', palette: [1, 2, 5, 10], range: [8, 20], maxUse: 3, count: 5, tip: 'Passou? Tire o peso pequeno e tente outro.' },
        { id: 'bl1c', title: 'Até 50', mode: 'right', palette: [1, 2, 5, 10, 20], range: [15, 50], maxUse: 4, count: 5, tip: 'Some de cabeça: 20 + 10 + 5...' },
      ],
    },
    {
      id: 'bl2', icon: '↔️', name: 'Pesos nos dois pratos', color: 'violet',
      intro: 'Agora só os pesos da direita não bastam! Ponha também um peso do lado do objeto: ele "tira" do outro lado.',
      levels: [
        { id: 'bl2a', title: 'Tirando pesos', mode: 'both', palette: [1, 2, 5, 10], range: [2, 15], count: 5, tip: 'Objeto de 7 com um peso de 10? Ponha 1 + 2 do lado do objeto: 7 + 3 = 10.' },
        { id: 'bl2b', title: 'Tirando pesos maiores', mode: 'both', palette: [2, 5, 10, 20], range: [3, 35], count: 5, tip: 'Quanto falta (ou sobra) para os pesos da direita?' },
      ],
    },
    {
      id: 'bl3', icon: '🧈', name: 'Gramas e quilos', color: 'orange',
      intro: 'Pesos de verdade: gramas (g) e quilos (kg). 1 kg = 1.000 g!',
      levels: [
        { id: 'bl3a', title: 'Gramas', mode: 'right', unit: 'g', palette: [50, 100, 200, 500], range: [150, 950], maxUse: 3, count: 5, tip: 'Dois de 500 g fazem 1 kg.' },
        { id: 'bl3b', title: 'Quilos e gramas', mode: 'right', unit: 'g', palette: [100, 200, 500, 1000, 2000], range: [1200, 4500], maxUse: 4, count: 5, tip: '1,5 kg = 1 kg + 500 g.' },
      ],
    },
    {
      id: 'bl4', icon: '❓', name: 'Quanto pesa?', color: 'green',
      intro: 'O peso do objeto é um mistério! Equilibre a balança e depois diga quanto ele pesa.',
      levels: [
        { id: 'bl4a', title: 'Descubra o peso', mode: 'unknown', palette: [1, 2, 5, 10], range: [5, 25], maxUse: 3, count: 5, tip: 'Balança reta: o objeto pesa o mesmo que os pesos do outro lado.' },
        { id: 'bl4b', title: 'Descubra em gramas', mode: 'unknown', unit: 'g', palette: [50, 100, 200, 500], range: [250, 1500], maxUse: 4, count: 5, tip: 'Some os pesos da direita.' },
        { id: 'bl4c', title: 'Descubra com os dois pratos', mode: 'both', ask: true, palette: [1, 2, 5, 10], range: [3, 20], count: 5, tip: 'Objeto + peso do lado dele = pesos do outro lado. Então o objeto = direita − esquerda.' },
      ],
    },
  ];

  const api = P.build(WORLDS);
  // estrelas pelas jogadas a mais (pôr ou tirar um peso) e pelas respostas erradas
  api.starsFor = (level, { extra, count }) => (extra <= count ? 3 : extra <= count * 3 ? 2 : 1);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BalancaLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
