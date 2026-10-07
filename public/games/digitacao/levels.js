// public/games/digitacao/levels.js
// Mundos e fases do Teclado Mágico. Este arquivo é a fonte única das fases:
// o navegador usa para montar o mapa e gerar os exercícios, e o servidor
// (src/games/digitacao/server.js) usa o mesmo arquivo para validar
// resultados, calcular estrelas e liberar fases. Nova fase = nova entrada
// aqui; o conteúdo é gerado por content.js a partir do `kind`.
//
// Tipos de fase (`kind`):
//   drill      grupos de letras com as teclas `keys` (mais vezes as `newKeys`)
//   words      palavras do banco que só usam as letras `letters`
//   mix        metade drill, metade palavras
//   capitals   palavras com maiúscula; `hand` = mão da letra (e/d) ou ambas
//   list       itens prontos de uma lista de content.js (`list`)
//   syllables  sílabas simples
//   length     palavras com tamanho entre `min` e `max`
//   hard       palavras com letras difíceis
//   accent     acentos `chars` sozinhos e em palavras
//   sentences  frases de uma lista (`list`)
//   text       um texto inteiro (`text`)

(function (root) {
  const HOME = 'asdfghjklç';
  const TOP = 'qwertyuiop';
  const HOME_TOP = HOME + TOP;
  const ALL = 'abcdefghijklmnopqrstuvwxyzç';

  const WORLDS = [
    {
      id: 'm1', icon: '🏠', name: 'Fileira do meio', color: 'yellow', minWpm: 0,
      intro: 'Coloque os dedos na fileira do meio: os indicadores no F e no J. Sinta o tracinho dessas duas teclas! Os polegares descansam no espaço.',
      levels: [
        { id: 'm1f1', title: 'F e J', kind: 'drill', keys: 'fj', newKeys: 'fj', tip: 'F com o indicador esquerdo, J com o indicador direito.' },
        { id: 'm1f2', title: 'D e K', kind: 'drill', keys: 'fjdk', newKeys: 'dk', tip: 'Os dedos do meio ficam no D e no K.' },
        { id: 'm1f3', title: 'S e L', kind: 'drill', keys: 'fjdksl', newKeys: 'sl', tip: 'Os anelares ficam no S e no L.' },
        { id: 'm1f4', title: 'A e Ç', kind: 'drill', keys: 'fjdkslaç', newKeys: 'aç', tip: 'Os mindinhos ficam no A e no Ç.' },
        { id: 'm1f5', title: 'G e H', kind: 'drill', keys: HOME, newKeys: 'gh', tip: 'Os indicadores esticam um pouquinho para o G e o H — e voltam para o F e o J!' },
        { id: 'm1f6', title: 'Primeiras palavras', kind: 'words', letters: HOME, tip: 'Já dá para escrever palavras de verdade só com a fileira do meio!' },
        { id: 'm1f7', title: 'Revisão do meio', kind: 'mix', keys: HOME, letters: HOME, tip: 'Tudo que você aprendeu neste mundo.' },
      ],
    },
    {
      id: 'm2', icon: '⬆️', name: 'Fileira de cima', color: 'sky', minWpm: 0,
      intro: 'Agora os dedos sobem para a fileira de cima — e sempre voltam para a casa (F e J) depois de cada tecla.',
      levels: [
        { id: 'm2f1', title: 'R e U', kind: 'drill', keys: HOME + 'ru', newKeys: 'ru', tip: 'Os indicadores sobem para o R e o U.' },
        { id: 'm2f2', title: 'E e I', kind: 'drill', keys: HOME + 'ruei', newKeys: 'ei', tip: 'Os dedos do meio sobem para o E e o I.' },
        { id: 'm2f3', title: 'W e O', kind: 'drill', keys: HOME + 'rueiwo', newKeys: 'wo', tip: 'Os anelares sobem para o W e o O.' },
        { id: 'm2f4', title: 'Q e P', kind: 'drill', keys: HOME + 'rueiwoqp', newKeys: 'qp', tip: 'Os mindinhos sobem para o Q e o P.' },
        { id: 'm2f5', title: 'T e Y', kind: 'drill', keys: HOME_TOP, newKeys: 'ty', tip: 'Os indicadores esticam para o T e o Y.' },
        { id: 'm2f6', title: 'Palavras de cima', kind: 'words', letters: HOME_TOP, tip: 'Palavras com a fileira do meio e a de cima.' },
        { id: 'm2f7', title: 'Revisão de cima', kind: 'mix', keys: HOME_TOP, letters: HOME_TOP, tip: 'Tudo junto: meio e cima.' },
      ],
    },
    {
      id: 'm3', icon: '⬇️', name: 'Fileira de baixo', color: 'green', minWpm: 0,
      intro: 'Hora de descer para a fileira de baixo. Os dedos descem, apertam e voltam para a casa.',
      levels: [
        { id: 'm3f1', title: 'V e M', kind: 'drill', keys: HOME_TOP + 'vm', newKeys: 'vm', tip: 'Os indicadores descem para o V e o M.' },
        { id: 'm3f2', title: 'B e N', kind: 'drill', keys: HOME_TOP + 'vmbn', newKeys: 'bn', tip: 'Os indicadores esticam para o B e o N.' },
        { id: 'm3f3', title: 'C e X', kind: 'drill', keys: HOME_TOP + 'vmbncx', newKeys: 'cx', tip: 'O dedo do meio esquerdo desce para o C e o anelar para o X.' },
        { id: 'm3f4', title: 'Z e vírgula', kind: 'drill', keys: ALL + ',', newKeys: 'z,', tip: 'O mindinho esquerdo desce para o Z. A vírgula fica com o dedo do meio direito.' },
        { id: 'm3f5', title: 'Ponto', kind: 'drill', keys: ALL + ',.', newKeys: '.', tip: 'O ponto fica com o anelar direito.' },
        { id: 'm3f6', title: 'Todas as letras', kind: 'words', letters: ALL, tip: 'Agora você conhece todas as letras!' },
        { id: 'm3f7', title: 'Revisão de baixo', kind: 'mix', keys: ALL, letters: ALL, tip: 'O alfabeto inteiro.' },
      ],
    },
    {
      id: 'm4', icon: '🔠', name: 'Maiúsculas', color: 'orange', minWpm: 0,
      intro: 'Para fazer letra maiúscula, segure o Shift do lado contrário ao da letra com o mindinho, aperte a letra e solte os dois.',
      levels: [
        { id: 'm4f1', title: 'Shift esquerdo', kind: 'capitals', hand: 'd', tip: 'Letras da mão direita (como J, L, M) usam o Shift esquerdo.' },
        { id: 'm4f2', title: 'Shift direito', kind: 'capitals', hand: 'e', tip: 'Letras da mão esquerda (como A, S, F) usam o Shift direito.' },
        { id: 'm4f3', title: 'Nomes', kind: 'list', list: 'nomes', count: 10, tip: 'Nomes de pessoas e lugares começam com maiúscula.' },
        { id: 'm4f4', title: 'Tudo misturado', kind: 'capitals', hand: 'ambas', tip: 'Shift esquerdo ou direito? Olhe de que lado está a letra!' },
      ],
    },
    {
      id: 'm5', icon: '📝', name: 'Palavras', color: 'pink', minWpm: 8,
      intro: 'Agora é treinar palavras inteiras. Tente não olhar para o teclado: olhe para a tela!',
      levels: [
        { id: 'm5f1', title: 'Sílabas', kind: 'syllables', tip: 'Ba, be, bi, bo, bu... as sílabas formam as palavras.' },
        { id: 'm5f2', title: 'Palavras curtas', kind: 'length', min: 2, max: 3, tip: 'Palavras de duas ou três letras.' },
        { id: 'm5f3', title: 'Palavras médias', kind: 'length', min: 4, max: 5, tip: 'Palavras de quatro ou cinco letras.' },
        { id: 'm5f4', title: 'Palavras longas', kind: 'length', min: 6, max: 12, tip: 'Palavras grandes: vá com calma, letra por letra.' },
        { id: 'm5f5', title: 'Letras difíceis', kind: 'hard', tip: 'Palavras com Q, Z, X, K, W, Y e Ç.' },
        { id: 'm5f6', title: 'Desafio das palavras', kind: 'length', min: 3, max: 9, count: 16, tip: 'Muitas palavras! Mostre o que aprendeu.' },
      ],
    },
    {
      id: 'm6', icon: '✨', name: 'Acentuação', color: 'violet', minWpm: 8,
      intro: 'Os acentos usam teclas "mágicas": aperte o acento e solte. Nada aparece ainda! Depois aperte a letra, e ela aparece com o acento.',
      levels: [
        { id: 'm6f1', title: 'Acento agudo ´', kind: 'accent', chars: 'áéíóú', accents: 'áéíóú', tip: 'O acento agudo fica à direita do P. Aperte ´, solte, depois a vogal.' },
        { id: 'm6f2', title: 'Til ~', kind: 'accent', chars: 'ãõ', accents: 'áéíóúãõ', tip: 'O til fica à direita do Ç. Aperte ~, solte, depois o A ou o O.' },
        { id: 'm6f3', title: 'Circunflexo ^', kind: 'accent', chars: 'âêô', accents: 'áéíóúãõâêô', tip: 'O circunflexo é o Shift + a tecla do til.' },
        { id: 'm6f4', title: 'Cedilha ç', kind: 'accent', chars: 'ç', accents: 'áéíóúãõâêôç', tip: 'O Ç tem tecla própria, à direita do L.' },
        { id: 'm6f5', title: 'Crase à', kind: 'list', list: 'crase', count: 6, tip: 'A crase é o Shift + a tecla do acento agudo, e depois o A.' },
        { id: 'm6f6', title: 'Acentos misturados', kind: 'accent', chars: 'áéíóúãõâêôç', accents: 'áéíóúãõâêôçà', count: 14, tip: 'Todos os acentos juntos!' },
        { id: 'm6f7', title: 'Maiúsculas com acento', kind: 'list', list: 'maiusculasAcento', count: 10, tip: 'Primeiro o acento, depois Shift + a letra.' },
      ],
    },
    {
      id: 'm7', icon: '💬', name: 'Frases', color: 'sky', minWpm: 10,
      intro: 'Juntando palavras, nascem as frases. Não esqueça do espaço entre as palavras!',
      levels: [
        { id: 'm7f1', title: 'Frases curtas', kind: 'sentences', list: 'curtas', count: 4, tip: 'Frases pequenas, sem pressa.' },
        { id: 'm7f2', title: 'Maiúscula no começo', kind: 'sentences', list: 'maiuscula', count: 4, tip: 'Toda frase começa com letra maiúscula.' },
        { id: 'm7f3', title: 'Frases com acento', kind: 'sentences', list: 'comAcento', count: 4, tip: 'Frases com palavras acentuadas.' },
        { id: 'm7f4', title: 'Frases longas', kind: 'sentences', list: 'longas', count: 3, tip: 'Frases grandes: respire e vá até o fim.' },
      ],
    },
    {
      id: 'm8', icon: '❗', name: 'Pontuação', color: 'red', minWpm: 10,
      intro: 'A pontuação dá vida ao texto: ponto, vírgula, exclamação, interrogação e muito mais.',
      levels: [
        { id: 'm8f1', title: 'Ponto e vírgula', kind: 'sentences', list: 'pontoVirgula', count: 4, tip: 'O ponto termina a frase. A vírgula dá uma pausa.' },
        { id: 'm8f2', title: 'Exclamação e interrogação', kind: 'sentences', list: 'exclamacao', count: 5, tip: '! é Shift + 1. ? é Shift + a tecla / ao lado do Shift direito.' },
        { id: 'm8f3', title: 'Dois-pontos e ponto e vírgula', kind: 'sentences', list: 'doisPontos', count: 4, tip: 'O ; fica ao lado do ponto. Os : são Shift + essa mesma tecla.' },
        { id: 'm8f4', title: 'Reticências', kind: 'sentences', list: 'reticencias', count: 4, tip: 'Reticências são três pontinhos: ...' },
        { id: 'm8f5', title: 'Aspas e travessão', kind: 'sentences', list: 'aspas', count: 4, tip: 'As aspas são Shift + a tecla à esquerda do 1. O travessão é o tracinho - à direita do 0.' },
        { id: 'm8f6', title: 'Parênteses', kind: 'sentences', list: 'parenteses', count: 4, tip: '( é Shift + 9 e ) é Shift + 0.' },
      ],
    },
    {
      id: 'm9', icon: '🔢', name: 'Números e símbolos', color: 'green', minWpm: 8,
      intro: 'Os números moram na fileira mais alta. Cada dedo cuida dos números acima da sua tecla de casa.',
      levels: [
        { id: 'm9f1', title: 'Números 1 a 5', kind: 'drill', keys: '12345', newKeys: '12345', tip: 'A mão esquerda cuida do 1 ao 5.' },
        { id: 'm9f2', title: 'Números 6 a 0', kind: 'drill', keys: '1234567890', newKeys: '67890', tip: 'A mão direita cuida do 6 ao 0.' },
        { id: 'm9f3', title: 'Números em frases', kind: 'sentences', list: 'numeros', count: 4, tip: 'Números e palavras juntos.' },
        { id: 'm9f4', title: 'Símbolos @ # $ %', kind: 'list', list: 'simbolos1', count: 10, tip: 'Segure o Shift e aperte o número: 2 vira @, 3 vira #, 4 vira $ e 5 vira %.' },
        { id: 'm9f5', title: 'Símbolos & * + =', kind: 'list', list: 'simbolos2', count: 10, tip: '& é Shift + 7, * é Shift + 8, + é Shift + a tecla do =.' },
      ],
    },
    {
      id: 'm10', icon: '📖', name: 'Textos', color: 'yellow', minWpm: 12,
      intro: 'O grande final: textos inteiros, com tudo que você aprendeu. Você é um(a) mestre(a) do teclado!',
      levels: [
        { id: 'm10f1', title: 'O girassol', kind: 'text', text: 'girassol', tip: 'Um texto sobre uma flor que segue o sol.' },
        { id: 'm10f2', title: 'A formiga e a chuva', kind: 'text', text: 'formiga', tip: 'Uma pequena história.' },
        { id: 'm10f3', title: 'O planeta Terra', kind: 'text', text: 'terra', tip: 'Curiosidades sobre o nosso planeta.' },
        { id: 'm10f4', title: 'O robô dançarino', kind: 'text', text: 'robo', tip: 'Uma história com diálogo.' },
        { id: 'm10f5', title: 'Desafio final', kind: 'text', text: 'desafio', tip: 'O texto mais difícil: pontuação, números e acentos!' },
      ],
    },
  ];

  // Estrelas: 1 ⭐ libera a próxima fase.
  const STAR_RULES = [
    { stars: 3, accuracy: 97 }, // e velocidade mínima do mundo
    { stars: 2, accuracy: 93 },
    { stars: 1, accuracy: 85 },
  ];

  const LEVELS = [];
  WORLDS.forEach((world, w) => {
    world.levels.forEach((level, l) => {
      level.world = world.id;
      level.worldIndex = w;
      level.indexInWorld = l;
      level.index = LEVELS.length;
      LEVELS.push(level);
    });
  });
  const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

  function getLevel(id) {
    return BY_ID[id] || null;
  }

  function getWorld(id) {
    return WORLDS.find((w) => w.id === id) || null;
  }

  function starsFor(levelId, accuracy, wpm) {
    const level = getLevel(levelId);
    if (!level) return 0;
    const minWpm = getWorld(level.world).minWpm || 0;
    for (const rule of STAR_RULES) {
      if (accuracy >= rule.accuracy && (rule.stars < 3 || wpm >= minWpm)) return rule.stars;
    }
    return 0;
  }

  // Fase liberada: a primeira sempre; as outras, quando a anterior tem pelo
  // menos 1 estrela (ou quando o professor liberou todas).
  function isUnlocked(progress, levelId) {
    const level = getLevel(levelId);
    if (!level) return false;
    if (level.index === 0 || (progress && progress.unlockedAll)) return true;
    const prev = LEVELS[level.index - 1];
    const prevStars = progress && progress.levels && progress.levels[prev.id] ? progress.levels[prev.id].stars : 0;
    return prevStars >= 1;
  }

  // Próxima fase a jogar: a primeira liberada ainda sem estrela.
  function nextLevel(progress) {
    const levels = (progress && progress.levels) || {};
    return LEVELS.find((l) => !(levels[l.id] && levels[l.id].stars >= 1) && isUnlocked(progress, l.id)) || null;
  }

  function totalStars(progress) {
    return Object.values((progress && progress.levels) || {}).reduce((n, l) => n + (l.stars || 0), 0);
  }

  const api = {
    WORLDS, LEVELS, MAX_STARS: LEVELS.length * 3,
    getLevel, getWorld, starsFor, isUnlocked, nextLevel, totalStars,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DigitacaoLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
