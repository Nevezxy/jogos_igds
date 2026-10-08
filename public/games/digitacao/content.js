// public/games/digitacao/content.js
// Conteúdo do Teclado Mágico: banco de palavras em português (vocabulário
// infantil), frases por nível, textos curtos escritos para o jogo, e o
// gerador que transforma uma fase de levels.js em um exercício (texto).
// As fases de letras só usam as letras já aprendidas: o gerador filtra o
// banco de palavras pelas letras permitidas. Também é usado pelo servidor,
// para gerar o texto do Desafio de digitação.

(function (root) {
  // ---------------- banco de palavras ----------------
  const WORDS = `
    a as asa asas sala salas fala falas gala galas ala alas alga algas fada fadas dada dadas
    salada saladas salsa sal da das haja falsa falsas alfa
    pato gato rato sapo tatu dedo pipa rua roda rosa casa caju suco sopa pera pote pito
    fogo foto figo galo gelo gola gota lago lata leite lixo lua luz mala mapa mato mesa
    moto muro nariz neve ninho noite nuvem olho onda osso ovo pai mãe pé pão papel parque
    pedra peixe pena pente perna pipoca porta prato praia queijo quente quilo rabo rede
    rei rio sacola sapato seta sino sofá sol sorvete tapete teto tigre time tinta trem
    uva urso vaca vaso vela vento verde vida vidro vovó vovô xale zebra zero
    abelha abacaxi agulha alegria alface amigo amiga amor anel animal ano arco areia
    arroz árvore asa avião avô avó azul bala balão banana banho barco bebê beijo
    bicho bicicleta boca bola bolo bolsa boneca bota braço branco bruxa cabelo
    cabra caderno café caixa cama camelo caminho campo caneca caneta capa carro carta
    casaco castelo cavalo cebola cenoura céu chapéu chave chão chinelo chocolate chuva
    cidade cinema circo cobra coelho cola colher copo coração corda corpo cozinha
    criança cuca dado dança dente desenho dia dinossauro doce dragão elefante escada
    escola espelho estrela faca família farinha feijão feira festa fita flor floresta
    folha formiga fruta fumaça futebol galinha garrafa gelatina girafa girassol goiaba
    grama gravata guitarra hipopótamo história hoje hora ilha irmã irmão janela jardim
    jacaré jogo joelho jornal jabuti kiwi lagarto lâmpada lanche laranja leão lençol
    letra livro lobo loja lousa macaco maçã madeira mamão manga manhã mão mar marrom
    martelo médico mel melancia menino menina mochila moeda montanha morango música
    navio ninho número óculos onça orelha ovelha padaria palhaço panela papagaio pássaro
    pastel pato peteca piano pijama pincel pinguim pirata planeta polvo ponte porco
    presente princesa professor professora pulo quadro quarto queijo quintal rádio raposa
    régua relógio remédio robô roupa sabão sabonete sacola sanduíche sapo semente sereia
    sorriso tartaruga teatro telefone terra tesoura tomate trator travesseiro tubarão
    urubu vassoura vela vestido viagem violão vizinho xícara xadrez zíper
    abraço água amarelo bonito bonita feliz grande pequeno pequena rápido devagar
    alto baixo forte gordo magro novo velho quente frio limpo sujo cheio vazio doce
    azedo salgado claro escuro bom boa ruim alegre calmo esperto curioso gentil
    andar brincar cantar correr dançar dormir escrever estudar falar jogar ler nadar
    olhar pintar pular rir sonhar subir viajar voar beber comer abrir fechar ganhar
    ajudar aprender contar desenhar ouvir pensar sentir sorrir
    sim não mais menos muito pouco sempre nunca aqui ali agora depois antes junto
    um dois três quatro cinco seis sete oito nove dez cem mil
    kiwi karatê ketchup web wifi yakisoba
    quiosque quilo quatro queijo quente quintal quarto quadro
    zebra zero zíper azul nariz luz paz feliz arroz vez voz cruz
    xale xadrez lixo peixe caixa bruxa ameixa abacaxi
    maçã coração ação canção lição pão mão irmão limão feijão avião balão
    você café pé chapéu bebê três mês português
    lâmpada pêssego ônibus ônix avô avó tênis
    açúcar açaí cabeça palhaço moço poço laço praça abraço cansaço onça
  `.split(/\s+/).filter(Boolean);
  const WORD_BANK = [...new Set(WORDS.map((w) => w.normalize('NFC')))];

  // ---------------- listas prontas ----------------
  const LISTS = {
    nomes: ['Ana', 'Pedro', 'Maria', 'Lucas', 'Julia', 'Rafael', 'Laura', 'Davi', 'Sofia', 'Miguel',
      'Helena', 'Gabriel', 'Alice', 'Arthur', 'Brasil', 'Recife', 'Bahia', 'Manaus', 'Natal', 'Paris',
      'Lisboa', 'Rio', 'Goiás', 'Paraná', 'Amazonas', 'Nilo', 'Terra', 'Lua', 'Marte', 'Saturno'],
    crase: ['vou à escola', 'fui à feira', 'cheguei à praia', 'dei um presente à vovó', 'volto às seis',
      'fomos à festa', 'saí à tarde', 'mandei uma carta à professora', 'vou à praça', 'à noite tem lua'],
    maiusculasAcento: ['É', 'Água', 'Árvore', 'Ônibus', 'Ótimo', 'Índio', 'Única', 'Âncora', 'Éramos',
      'Época', 'Ímã', 'Óculos', 'Último', 'Àquela', 'Êxito'],
    simbolos1: ['@', '#', '$', '%', 'ana@escola', '#feliz', 'R$10', '50%', 'oi@turma', '#jogos', '100%', 'R$5', '#girassol'],
    simbolos2: ['&', '*', '+', '=', '2+2=4', '3*3=9', 'Ana & Pedro', '5+5=10', '1+1=2', 'gato & rato', '4*2=8', '10=10'],
  };

  // ---------------- frases ----------------
  const SENTENCES = {
    curtas: [
      'o gato pula o muro', 'a bola rolou longe', 'o sol esquenta a terra', 'eu gosto de ler', 'a lua brilha',
      'o sapo pula no lago', 'o pato nada', 'a menina corre', 'o menino canta', 'a flor cheira bem',
      'o cachorro late alto', 'a vaca come grama', 'o peixe nada no rio', 'a chuva molha tudo',
      'meu amigo sorri', 'o trem passa depressa', 'a pipa voa alto', 'o bolo ficou gostoso',
      'a turma brinca junto', 'o urso dorme muito',
    ],
    maiuscula: [
      'Hoje tem aula de arte', 'O dia amanheceu bonito', 'Minha casa tem jardim', 'Ana gosta de pintar',
      'Pedro joga bola com os amigos', 'A escola fica perto', 'Eu tenho um gato amarelo',
      'O passarinho canta cedo', 'Vamos brincar de esconder', 'A professora conta casos engraçados',
      'Meu primo gosta de futebol', 'O Brasil tem muitas praias', 'Lucas tem uma bicicleta azul',
      'Sofia desenha uma estrela', 'O circo chegou na cidade',
    ],
    comAcento: [
      'O avião voa no céu', 'A árvore é bem alta', 'Eu comi pão com mel', 'O café está quente',
      'A maçã é vermelha', 'Meu avô conta histórias', 'O ônibus passou cedo', 'A música é bonita',
      'Você vem amanhã', 'O mês de julho é frio', 'A criança está feliz', 'O pássaro fez um ninho',
      'Hoje é dia de férias', 'A lâmpada está acesa', 'O leão é o rei',
    ],
    longas: [
      'A tartaruga anda devagar mas sempre chega ao seu destino', 'No fim de semana fomos ao parque e brincamos no balanço',
      'O girassol gira a sua cabeça para seguir o sol durante o dia', 'Meu sonho é viajar pelo mundo e conhecer muitos lugares',
      'A professora leu uma história sobre um dragão que tinha medo do escuro', 'Quando chove muito as crianças ficam em casa jogando',
      'O planeta Terra gira em volta do sol e leva um ano para dar a volta', 'Os peixes coloridos nadam entre as pedras do fundo do mar',
    ],
    pontoVirgula: [
      'Eu gosto de maçã, banana e uva.', 'Hoje choveu muito.', 'Ana, Pedro e Lia foram à praia.',
      'O gato dormiu, comeu e brincou.', 'Comprei lápis, caderno e borracha.', 'O dia acabou.',
      'Na feira tem fruta, verdura e flor.', 'Amanhã, bem cedo, vamos viajar.', 'A aula foi ótima.',
      'Corri, pulei e dancei.',
    ],
    exclamacao: [
      'Que dia lindo!', 'Você vem brincar?', 'Parabéns!', 'Onde está o meu lápis?', 'Que legal!',
      'Qual é o seu nome?', 'Cuidado!', 'Quantos anos você tem?', 'Oba, vai ter festa!', 'Quer um pedaço de bolo?',
      'Uau!', 'Que horas são?', 'Vamos lá!', 'Você gosta de ler?',
    ],
    doisPontos: [
      'Na mochila tem: lápis, caderno e livro.', 'Choveu muito; ficamos em casa.', 'Minhas cores favoritas: azul e verde.',
      'Eu queria sair; estava frio.', 'Lista de compras: pão, leite e ovos.', 'O jogo acabou; todos comemoraram.',
      'Animais da fazenda: vaca, galo e porco.', 'Estudei muito; tirei nota boa.',
    ],
    reticencias: [
      'Era uma vez...', 'Hmm... deixa eu pensar.', 'E então... a luz apagou!', 'Eu ia falar, mas...',
      'Um, dois, três...', 'Será que vai chover...', 'Lá longe... um barulho!', 'E viveram felizes...',
    ],
    aspas: [
      'A professora disse: "Muito bem!"', '- Oi, tudo bem?', '- Tudo ótimo!', 'O livro se chama "O pequeno sapo".',
      'Mamãe falou: "Hora de dormir."', '- Vamos jogar?', 'Ele gritou: "Gol!"', '- Que bom te ver!',
    ],
    parenteses: [
      'O Brasil (nosso país) é enorme.', 'Comi uma fruta (era uma pera).', 'A Lua (que é linda) brilhou.',
      'Ana (minha prima) chegou.', 'Leve o casaco (está frio).', 'O cão (chamado Bob) latiu.',
      'Faça o dever (página dez).', 'Eu (e você) vamos juntos.',
    ],
    numeros: [
      'Tenho 9 anos.', 'A turma tem 25 alunos.', 'O ano tem 12 meses.', 'Comprei 3 balas e 2 chicletes.',
      'Moro na casa 47.', 'A semana tem 7 dias.', 'O jogo foi 2 a 1.', 'Ganhei 10 figurinhas.',
      'O ônibus 380 passa aqui.', 'Hoje é dia 15.',
    ],
  };

  // ---------------- textos (escritos para o jogo) ----------------
  const TEXTS = {
    girassol: 'O girassol é uma flor amarela e muito alegre. Quando é jovem, ele vira a cabeça para seguir o sol, do nascer até o pôr do sol. As suas sementes alimentam os passarinhos e também viram óleo. Que flor generosa!',
    formiga: 'Uma formiga carregava uma folha enorme. De repente, começou a chover. Ela usou a folha como guarda-chuva e chegou seca ao formigueiro. As amigas aplaudiram: "Que ideia brilhante!" Desde então, todas levam uma folha no bolso.',
    terra: 'A Terra é o terceiro planeta a partir do Sol. Ela gira em torno de si mesma e, por isso, temos o dia e a noite. A volta completa ao redor do Sol leva 365 dias. Quase três quartos do planeta são cobertos por água!',
    robo: '- Eu quero dançar! - disse o pequeno robô. - Mas robôs não dançam - respondeu o gato. O robô não desistiu: treinou todos os dias, mexendo um parafuso de cada vez. Na festa da rua, foi o primeiro a entrar na roda. E dançou a noite toda!',
    desafio: 'Na segunda-feira, 14 crianças da turma 5A visitaram o museu. Viram ossos de dinossauros (alguns com mais de 70 milhões de anos!), um meteorito e até uma múmia. Na volta, a professora perguntou: "Qual foi a parte favorita?" Cada um respondeu uma coisa diferente... e todos queriam voltar!',
  };

  const SYLLABLES = ('ba be bi bo bu ca co cu da de di do du fa fe fi fo fu ga go gu ja je ji jo ju '
    + 'la le li lo lu ma me mi mo mu na ne ni no nu pa pe pi po pu ra re ri ro ru sa se si so su '
    + 'ta te ti to tu va ve vi vo vu xa xe xi xo xu za ze zi zo zu').split(' ');

  const RIGHT_HAND = 'yuiophjklçnm';
  const LEFT_HAND = 'qwertasdfgzxcvb';
  const HARD = 'qzxkwyç';
  const ACCENTED = /[áéíóúãõâêôàü]/;

  // ---------------- utilitários ----------------
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (list) => list[rand(list.length)];
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // `count` itens sem repetir enquanto der; se a lista for curta, repete.
  function sample(list, count) {
    const out = [];
    while (out.length < count && list.length) out.push(...shuffle(list).slice(0, count - out.length));
    return out;
  }
  const onlyLetters = (word, letters) => [...word].every((ch) => letters.includes(ch));

  // Grupos de 2 a 4 letras (ex.: "fjf jjf") com as teclas da fase; as teclas
  // novas aparecem bem mais vezes. Começa com repetições das teclas novas.
  function drill(keys, newKeys = keys, groups = 12) {
    const keyList = [...keys];
    const fresh = [...newKeys];
    const weighted = [...keyList, ...fresh, ...fresh, ...fresh];
    const out = fresh.map((k) => k.repeat(3));
    while (out.length < groups) {
      const size = 2 + rand(3);
      let g = '';
      for (let i = 0; i < size; i++) g += pick(weighted);
      out.push(g);
    }
    return out;
  }

  function wordsFrom(letters, count = 12, prefer = '') {
    const pool = WORD_BANK.filter((w) => onlyLetters(w, letters));
    const preferred = prefer ? pool.filter((w) => [...prefer].some((ch) => w.includes(ch))) : pool;
    const base = preferred.length >= 5 ? preferred : pool;
    if (base.length < 3) return drill(letters, prefer || letters, count);
    return sample(base, count);
  }

  const capitalize = (w) => w[0].toUpperCase() + w.slice(1);

  // ---------------- gerador ----------------
  // Devolve o texto do exercício de uma fase de levels.js.
  function generate(level) {
    let parts;
    switch (level.kind) {
      case 'drill':
        parts = drill(level.keys, level.newKeys, level.count || 12);
        break;
      case 'words':
        parts = wordsFrom(level.letters, level.count || 12);
        break;
      case 'mix':
        parts = [...drill(level.keys, level.keys, 6), ...wordsFrom(level.letters, 6)];
        parts = shuffle(parts);
        break;
      case 'capitals': {
        const hands = level.hand === 'd' ? RIGHT_HAND : level.hand === 'e' ? LEFT_HAND : RIGHT_HAND + LEFT_HAND;
        const pool = WORD_BANK.filter((w) => !ACCENTED.test(w) && w.length >= 2 && hands.includes(w[0]));
        parts = sample(pool, level.count || 10).map(capitalize);
        break;
      }
      case 'list':
        parts = sample(LISTS[level.list], level.count || 8);
        break;
      case 'syllables':
        parts = sample(SYLLABLES, level.count || 14);
        break;
      case 'length': {
        const pool = WORD_BANK.filter((w) => !ACCENTED.test(w) && w.length >= level.min && w.length <= level.max);
        parts = sample(pool, level.count || 12);
        break;
      }
      case 'hard': {
        const pool = WORD_BANK.filter((w) => !ACCENTED.test(w.replace(/ç/g, '')) && [...HARD].some((ch) => w.includes(ch)));
        parts = sample(pool, level.count || 12);
        break;
      }
      case 'accent': {
        const alone = [...level.chars].map((ch) => ch.repeat(2));
        const allowedAccents = level.accents || level.chars;
        const pool = WORD_BANK.filter((w) => [...level.chars].some((ch) => w.includes(ch))
          && [...w].every((ch) => !ACCENTED.test(ch) || allowedAccents.includes(ch)));
        parts = [...alone, ...sample(pool, level.count || 10)];
        break;
      }
      case 'sentences':
        return sample(SENTENCES[level.list], level.count || 4).join(' ');
      case 'text':
        return TEXTS[level.text];
      default:
        parts = drill('fj');
    }
    return parts.join(' ');
  }

  // Treino livre: exercícios que não contam para o progresso.
  const PRACTICE = [
    { id: 'letras', icon: '🔤', name: 'Letras', make: () => drill('abcdefghijklmnopqrstuvwxyzç', 'abcdefghijklmnopqrstuvwxyzç', 16).join(' ') },
    { id: 'palavras', icon: '📝', name: 'Palavras', make: () => sample(WORD_BANK.filter((w) => !ACCENTED.test(w)), 14).join(' ') },
    { id: 'acentos', icon: '✨', name: 'Acentos', make: () => sample(WORD_BANK.filter((w) => ACCENTED.test(w)), 12).join(' ') },
    { id: 'frases', icon: '💬', name: 'Frases', make: () => sample([...SENTENCES.comAcento, ...SENTENCES.maiuscula], 4).join(' ') },
    { id: 'pontuacao', icon: '❗', name: 'Pontuação', make: () => sample([...SENTENCES.exclamacao, ...SENTENCES.pontoVirgula], 5).join(' ') },
    { id: 'numeros', icon: '🔢', name: 'Números', make: () => sample(SENTENCES.numeros, 4).join(' ') },
  ];

  const api = { generate, PRACTICE, WORD_BANK, LISTS, SENTENCES, TEXTS };
  // no navegador vira window.DigitacaoContent; no servidor (Desafio de
  // digitação) é usado com require()
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DigitacaoContent = api;
})(typeof window !== 'undefined' ? window : globalThis);
