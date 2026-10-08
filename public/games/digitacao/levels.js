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
        { id: 'm1f8', title: 'Mão esquerda', kind: 'drill', keys: 'asdfg', newKeys: 'asdf', tip: 'Só a mão esquerda: A, S, D, F e G.' },
        { id: 'm1f9', title: 'Mão direita', kind: 'drill', keys: 'hjklç', newKeys: 'jklç', tip: 'Só a mão direita: H, J, K, L e Ç.' },
        { id: 'm1f10', title: 'Indicadores', kind: 'drill', keys: 'fghj', newKeys: 'fghj', tip: 'Os indicadores cuidam de duas teclas cada: F e G, H e J.' },
        { id: 'm1f11', title: 'Mindinhos e anelares', kind: 'drill', keys: HOME, newKeys: 'aslç', tip: 'Os dedos mais fraquinhos também treinam: A, S, L e Ç.' },
        { id: 'm1f6', title: 'Primeiras palavras', kind: 'words', letters: HOME, tip: 'Já dá para escrever palavras de verdade só com a fileira do meio!' },
        { id: 'm1f12', title: 'Palavras com S e L', kind: 'words', letters: HOME, prefer: 'sl', tip: 'Sala, salada, fala... palavras do meio com S e L.' },
        { id: 'm1f7', title: 'Revisão do meio', kind: 'mix', keys: HOME, letters: HOME, tip: 'Tudo que você aprendeu neste mundo.' },
        { id: 'm1f13', title: 'Rapidinho no meio', kind: 'mix', keys: HOME, letters: HOME, count: 18, tip: 'Mais comprido: mantenha o ritmo sem pressa.' },
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
        { id: 'm2f8', title: 'Mão esquerda em cima', kind: 'drill', keys: HOME + 'qwert', newKeys: 'qwert', tip: 'Q, W, E, R e T: a mão esquerda sobe e volta.' },
        { id: 'm2f9', title: 'Mão direita em cima', kind: 'drill', keys: HOME + 'yuiop', newKeys: 'yuiop', tip: 'Y, U, I, O e P: a mão direita sobe e volta.' },
        { id: 'm2f10', title: 'Vogais', kind: 'drill', keys: HOME_TOP, newKeys: 'aeiou', tip: 'A, E, I, O e U: as vogais estão em quase toda palavra.' },
        { id: 'm2f6', title: 'Palavras de cima', kind: 'words', letters: HOME_TOP, tip: 'Palavras com a fileira do meio e a de cima.' },
        { id: 'm2f11', title: 'Palavras com R e T', kind: 'words', letters: HOME_TOP, prefer: 'rt', tip: 'Rato, pote, tatu... palavras com R e T.' },
        { id: 'm2f12', title: 'Palavras com P e Q', kind: 'words', letters: HOME_TOP, prefer: 'pq', tip: 'O P e o Q ficam com os mindinhos.' },
        { id: 'm2f7', title: 'Revisão de cima', kind: 'mix', keys: HOME_TOP, letters: HOME_TOP, tip: 'Tudo junto: meio e cima.' },
        { id: 'm2f13', title: 'Rapidinho em cima', kind: 'mix', keys: HOME_TOP, letters: HOME_TOP, count: 18, tip: 'Mais comprido: mantenha o ritmo sem pressa.' },
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
        { id: 'm3f8', title: 'Mão esquerda embaixo', kind: 'drill', keys: ALL, newKeys: 'zxcvb', tip: 'Z, X, C, V e B: a mão esquerda desce e volta.' },
        { id: 'm3f9', title: 'Mão direita embaixo', kind: 'drill', keys: ALL + ',.', newKeys: 'nm,.', tip: 'N, M, vírgula e ponto: a mão direita desce e volta.' },
        { id: 'm3f6', title: 'Todas as letras', kind: 'words', letters: ALL, tip: 'Agora você conhece todas as letras!' },
        { id: 'm3f10', title: 'Palavras com V e B', kind: 'words', letters: ALL, prefer: 'vb', tip: 'Vaca, bola, vovó... o V e o B ficam com os indicadores.' },
        { id: 'm3f11', title: 'Palavras com C e M', kind: 'words', letters: ALL, prefer: 'cm', tip: 'Casa, mala, cama... C com o dedo do meio, M com o indicador.' },
        { id: 'm3f12', title: 'Palavras com Z e X', kind: 'words', letters: ALL, prefer: 'zx', tip: 'Zebra, xale, lixo... Z com o mindinho, X com o anelar.' },
        { id: 'm3f7', title: 'Revisão de baixo', kind: 'mix', keys: ALL, letters: ALL, tip: 'O alfabeto inteiro.' },
        { id: 'm3f13', title: 'Alfabeto rapidinho', kind: 'mix', keys: ALL, letters: ALL, count: 18, tip: 'Mais comprido: todas as letras, sem pressa.' },
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
        { id: 'm4f5', title: 'Nomes de bichos', kind: 'list', list: 'bichos', count: 10, tip: 'O nome do seu bichinho também começa com maiúscula.' },
        { id: 'm4f6', title: 'Cidades', kind: 'list', list: 'cidades', count: 10, tip: 'Nomes de cidades começam com maiúscula.' },
        { id: 'm4f7', title: 'Estados do Brasil', kind: 'list', list: 'estados', count: 10, tip: 'Os estados do Brasil, com maiúscula.' },
        { id: 'm4f8', title: 'Planetas e astros', kind: 'list', list: 'astros', count: 10, tip: 'Sol, Lua, Terra... nomes de astros com maiúscula.' },
        { id: 'm4f9', title: 'Nome e sobrenome', kind: 'list', list: 'nomeSobrenome', count: 8, tip: 'Nome e sobrenome: as duas palavras com maiúscula.' },
        { id: 'm4f10', title: 'Siglas', kind: 'list', list: 'siglas', count: 10, tip: 'Siglas são todas em maiúscula: segure o Shift em cada letra.' },
        { id: 'm4f11', title: 'PALAVRAS GRITADAS', kind: 'capitals', hand: 'ambas', whole: true, count: 8, tip: 'A palavra inteira em maiúscula! Shift em cada letra (ou o Caps Lock).' },
        { id: 'm4f12', title: 'Frases com nomes', kind: 'sentences', list: 'nomes', count: 4, tip: 'Frases que começam com maiúscula e têm nomes no meio.' },
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
        { id: 'm5f7', title: 'Sílabas com R e L', kind: 'list', list: 'silabasRL', count: 14, tip: 'Bra, pla, tre... duas consoantes juntas.' },
        { id: 'm5f8', title: 'CH, LH e NH', kind: 'pattern', has: ['ch', 'lh', 'nh'], tip: 'Chuva, folha, ninho: duas letras que fazem um som só.' },
        { id: 'm5f9', title: 'RR e SS', kind: 'pattern', has: ['rr', 'ss'], tip: 'Carro, osso: letra dobrada no meio da palavra.' },
        { id: 'm5f10', title: 'QU e GU', kind: 'pattern', has: ['qu', 'gu'], tip: 'Queijo, foguete: o U vem junto do Q e do G.' },
        { id: 'm5f11', title: 'M antes de P e B', kind: 'pattern', has: ['mp', 'mb'], tip: 'Campo, bambu: antes de P e B, use M.' },
        { id: 'm5f12', title: 'Opostos', kind: 'list', list: 'opostos', count: 8, tip: 'Alto e baixo, quente e frio: palavras opostas.' },
        { id: 'm5f13', title: 'Verbos', kind: 'list', list: 'verbos', count: 12, tip: 'Palavras de ação: correr, pular, cantar...' },
        { id: 'm5f6', title: 'Desafio das palavras', kind: 'length', min: 3, max: 9, count: 16, tip: 'Muitas palavras! Mostre o que aprendeu.' },
        { id: 'm5f14', title: 'Palavras gigantes', kind: 'length', min: 8, max: 14, count: 10, tip: 'As maiores palavras do banco. Uma letra de cada vez!' },
      ],
    },
    {
      id: 'm6', icon: '✨', name: 'Acentuação', color: 'violet', minWpm: 8,
      intro: 'Os acentos usam teclas "mágicas": aperte o acento e solte. Nada aparece ainda! Depois aperte a letra, e ela aparece com o acento.',
      levels: [
        { id: 'm6f8', title: 'Agudo no A e no E', kind: 'accent', chars: 'áé', accents: 'áé', tip: 'O acento agudo fica à direita do P. Aperte ´, solte, depois o A ou o E.' },
        { id: 'm6f9', title: 'Agudo no I, O e U', kind: 'accent', chars: 'íóú', accents: 'áéíóú', tip: 'O mesmo acento agudo, agora no I, no O e no U.' },
        { id: 'm6f1', title: 'Acento agudo ´', kind: 'accent', chars: 'áéíóú', accents: 'áéíóú', tip: 'O acento agudo fica à direita do P. Aperte ´, solte, depois a vogal.' },
        { id: 'm6f2', title: 'Til ~', kind: 'accent', chars: 'ãõ', accents: 'áéíóúãõ', tip: 'O til fica à direita do Ç. Aperte ~, solte, depois o A ou o O.' },
        { id: 'm6f3', title: 'Circunflexo ^', kind: 'accent', chars: 'âêô', accents: 'áéíóúãõâêô', tip: 'O circunflexo é o Shift + a tecla do til.' },
        { id: 'm6f10', title: 'Palavras com ÃO', kind: 'pattern', has: ['ão'], accents: true, tip: 'Mão, pão, avião: til no A e depois o O.' },
        { id: 'm6f11', title: 'Palavras com ÕES', kind: 'pattern', has: ['ões'], accents: true, tip: 'Limões, balões: o plural de ÃO muitas vezes vira ÕES.' },
        { id: 'm6f4', title: 'Cedilha ç', kind: 'accent', chars: 'ç', accents: 'áéíóúãõâêôç', tip: 'O Ç tem tecla própria, à direita do L.' },
        { id: 'm6f12', title: 'Palavras com ÇÃO', kind: 'pattern', has: ['ção', 'ções'], accents: true, tip: 'Coração, lição, canções: Ç e til juntos.' },
        { id: 'm6f5', title: 'Crase à', kind: 'list', list: 'crase', count: 6, tip: 'A crase é o Shift + a tecla do acento agudo, e depois o A.' },
        { id: 'm6f6', title: 'Acentos misturados', kind: 'accent', chars: 'áéíóúãõâêôç', accents: 'áéíóúãõâêôçà', count: 14, tip: 'Todos os acentos juntos!' },
        { id: 'm6f7', title: 'Maiúsculas com acento', kind: 'list', list: 'maiusculasAcento', count: 10, tip: 'Primeiro o acento, depois Shift + a letra.' },
        { id: 'm6f13', title: 'Frases acentuadas', kind: 'sentences', list: 'comAcento2', count: 4, tip: 'Frases cheias de acentos. Calma em cada um!' },
        { id: 'm6f14', title: 'Maratona de acentos', kind: 'accent', chars: 'áéíóúãõâêôç', accents: 'áéíóúãõâêôçà', count: 20, tip: 'Muitas palavras acentuadas seguidas!' },
      ],
    },
    {
      id: 'm7', icon: '💬', name: 'Frases', color: 'sky', minWpm: 10,
      intro: 'Juntando palavras, nascem as frases. Não esqueça do espaço entre as palavras!',
      levels: [
        { id: 'm7f1', title: 'Frases curtas', kind: 'sentences', list: 'curtas', count: 4, tip: 'Frases pequenas, sem pressa.' },
        { id: 'm7f2', title: 'Maiúscula no começo', kind: 'sentences', list: 'maiuscula', count: 4, tip: 'Toda frase começa com letra maiúscula.' },
        { id: 'm7f3', title: 'Frases com acento', kind: 'sentences', list: 'comAcento', count: 4, tip: 'Frases com palavras acentuadas.' },
        { id: 'm7f5', title: 'Bichos', kind: 'sentences', list: 'animais', count: 4, tip: 'Frases sobre animais.' },
        { id: 'm7f6', title: 'Escola', kind: 'sentences', list: 'escola', count: 4, tip: 'Frases sobre a escola.' },
        { id: 'm7f7', title: 'Natureza', kind: 'sentences', list: 'natureza', count: 4, tip: 'Frases sobre a natureza.' },
        { id: 'm7f8', title: 'Família', kind: 'sentences', list: 'familia', count: 4, tip: 'Frases sobre a família.' },
        { id: 'm7f9', title: 'Brincadeiras', kind: 'sentences', list: 'brincadeiras', count: 4, tip: 'Frases sobre brincadeiras.' },
        { id: 'm7f10', title: 'Comida', kind: 'sentences', list: 'comida', count: 4, tip: 'Frases sobre comida. Que fome!' },
        { id: 'm7f11', title: 'Corpo e saúde', kind: 'sentences', list: 'corpo', count: 4, tip: 'Frases sobre o corpo e a saúde.' },
        { id: 'm7f12', title: 'Esportes', kind: 'sentences', list: 'esportes', count: 4, tip: 'Frases sobre esportes.' },
        { id: 'm7f4', title: 'Frases longas', kind: 'sentences', list: 'longas', count: 3, tip: 'Frases grandes: respire e vá até o fim.' },
      ],
    },
    {
      id: 'm8', icon: '❗', name: 'Pontuação', color: 'red', minWpm: 10,
      intro: 'A pontuação dá vida ao texto: ponto, vírgula, exclamação, interrogação e muito mais.',
      levels: [
        { id: 'm8f1', title: 'Ponto e vírgula', kind: 'sentences', list: 'pontoVirgula', count: 4, tip: 'O ponto termina a frase. A vírgula dá uma pausa.' },
        { id: 'm8f7', title: 'Vírgula nas listas', kind: 'sentences', list: 'listas', count: 4, tip: 'Numa lista, a vírgula separa as coisas, e o "e" junta as duas últimas.' },
        { id: 'm8f8', title: 'Perguntas', kind: 'sentences', list: 'perguntas', count: 5, tip: 'Toda pergunta termina com ? (Shift + a tecla / ao lado do Shift direito).' },
        { id: 'm8f9', title: 'Exclamações', kind: 'sentences', list: 'exclamacoes', count: 6, tip: 'Alegria, susto, surpresa: ! é Shift + 1.' },
        { id: 'm8f2', title: 'Exclamação e interrogação', kind: 'sentences', list: 'exclamacao', count: 5, tip: '! é Shift + 1. ? é Shift + a tecla / ao lado do Shift direito.' },
        { id: 'm8f3', title: 'Dois-pontos e ponto e vírgula', kind: 'sentences', list: 'doisPontos', count: 4, tip: 'O ; fica ao lado do ponto. Os : são Shift + essa mesma tecla.' },
        { id: 'm8f4', title: 'Reticências', kind: 'sentences', list: 'reticencias', count: 4, tip: 'Reticências são três pontinhos: ...' },
        { id: 'm8f5', title: 'Aspas e travessão', kind: 'sentences', list: 'aspas', count: 4, tip: 'As aspas são Shift + a tecla à esquerda do 1. O travessão é o tracinho - à direita do 0.' },
        { id: 'm8f6', title: 'Parênteses', kind: 'sentences', list: 'parenteses', count: 4, tip: '( é Shift + 9 e ) é Shift + 0.' },
        { id: 'm8f10', title: 'Diálogos', kind: 'sentences', list: 'dialogos', count: 4, tip: 'Na conversa, cada fala começa com o travessão (-).' },
        { id: 'm8f11', title: 'Palavras com hífen', kind: 'list', list: 'hifen', count: 8, tip: 'Guarda-chuva, beija-flor: o hífen (-) fica à direita do 0.' },
        { id: 'm8f12', title: 'Pontuação misturada', kind: 'sentences', list: 'mistura', count: 4, tip: 'Todos os sinais juntos! Olhe com atenção.' },
      ],
    },
    {
      id: 'm9', icon: '🔢', name: 'Números e símbolos', color: 'green', minWpm: 8,
      intro: 'Os números moram na fileira mais alta. Cada dedo cuida dos números acima da sua tecla de casa.',
      levels: [
        { id: 'm9f1', title: 'Números 1 a 5', kind: 'drill', keys: '12345', newKeys: '12345', tip: 'A mão esquerda cuida do 1 ao 5.' },
        { id: 'm9f2', title: 'Números 6 a 0', kind: 'drill', keys: '1234567890', newKeys: '67890', tip: 'A mão direita cuida do 6 ao 0.' },
        { id: 'm9f6', title: 'Todos os números', kind: 'drill', keys: '1234567890', newKeys: '1234567890', count: 16, tip: 'Do 1 ao 0, com os dedos certos.' },
        { id: 'm9f7', title: 'Números grandes', kind: 'list', list: 'grandes', count: 10, tip: 'Mil é 1.000: o ponto separa os grupos de três números.' },
        { id: 'm9f3', title: 'Números em frases', kind: 'sentences', list: 'numeros', count: 4, tip: 'Números e palavras juntos.' },
        { id: 'm9f4', title: 'Símbolos @ # $ %', kind: 'list', list: 'simbolos1', count: 10, tip: 'Segure o Shift e aperte o número: 2 vira @, 3 vira #, 4 vira $ e 5 vira %.' },
        { id: 'm9f5', title: 'Símbolos & * + =', kind: 'list', list: 'simbolos2', count: 10, tip: '& é Shift + 7, * é Shift + 8, + é Shift + a tecla do =.' },
        { id: 'm9f8', title: 'Símbolos ( ) - _ /', kind: 'list', list: 'simbolos3', count: 10, tip: '_ é Shift + o tracinho. A barra / fica ao lado do Shift direito.' },
        { id: 'm9f9', title: 'Datas', kind: 'list', list: 'datas', count: 8, tip: 'Dia/mês/ano, separados pela barra /.' },
        { id: 'm9f10', title: 'Horas', kind: 'list', list: 'horas', count: 10, tip: 'Hora:minuto. Os dois-pontos são Shift + a tecla do ponto e vírgula.' },
        { id: 'm9f11', title: 'Dinheiro', kind: 'list', list: 'dinheiro', count: 8, tip: 'R$ é Shift + R e Shift + 4. Os centavos vêm depois da vírgula.' },
        { id: 'm9f12', title: 'Números em textos', kind: 'sentences', list: 'numeros2', count: 4, tip: 'Frases com números, datas, horas e dinheiro.' },
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
        { id: 'm10f6', title: 'As abelhas', kind: 'text', text: 'abelha', tip: 'Como vivem as abelhas.' },
        { id: 'm10f7', title: 'O ciclo da água', kind: 'text', text: 'agua', tip: 'Para onde vai a água da chuva?' },
        { id: 'm10f8', title: 'O jogo de futebol', kind: 'text', text: 'futebol', tip: 'Uma partida na quadra da escola.' },
        { id: 'm10f9', title: 'A Lua', kind: 'text', text: 'lua', tip: 'Curiosidades sobre a Lua.' },
        { id: 'm10f10', title: 'Tito e Mia', kind: 'text', text: 'amizade', tip: 'Uma história de amizade.' },
        { id: 'm10f11', title: 'Os dinossauros', kind: 'text', text: 'dinossauros', tip: 'Quem foram os dinossauros?' },
        { id: 'm10f12', title: 'Reciclar', kind: 'text', text: 'reciclagem', tip: 'Cada lixo na lixeira certa.' },
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

  // Todas as fases abertas: a criança joga qualquer fase, em qualquer ordem
  // (a estrela continua valendo e o "Continuar" leva à primeira sem estrela).
  // Com `false`, volta a trilha: cada fase abre quando a anterior tem 1 ⭐,
  // e o professor pode liberar todas para um educando.
  const ALL_UNLOCKED = true;

  // Fase liberada: todas (ALL_UNLOCKED); senão, a primeira sempre e as
  // outras quando a anterior tem pelo menos 1 estrela (ou quando o
  // professor liberou todas).
  function isUnlocked(progress, levelId) {
    const level = getLevel(levelId);
    if (!level) return false;
    if (ALL_UNLOCKED || level.index === 0 || (progress && progress.unlockedAll)) return true;
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
    WORLDS, LEVELS, MAX_STARS: LEVELS.length * 3, ALL_UNLOCKED,
    getLevel, getWorld, starsFor, isUnlocked, nextLevel, totalStars,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DigitacaoLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
