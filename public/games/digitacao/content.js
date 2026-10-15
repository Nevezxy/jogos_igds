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
    cachorro ferro barro gorro torre burro carroça corrida massa passeio sossego
    assobio tosse nosso isso gesso pássaro osso pessoa
    chuchu chiclete cheiro chute bicho mochila fechar ficha
    milho palha velho trabalho filho olhar molhado orelha joelho
    banho sonho unha minhoca dinheiro caminhão linha senha
    guitarra foguete guerra fogueira seguir formiguinha preguiça mangueira
    quilo queijo aquilo quieto esquilo leque moleque pequeno tanque
    campo tampa bambu sombra tambor pombo empada limpo samba bombom umbigo
    compra tempo sempre lembrar
    estação emoção atenção invenção botão melão leões limões aviões balões
    lições canções corações mamões feijões botões
    fácil difícil útil máquina pêssego tênis lápis ímã pólen
  `.split(/\s+/).filter(Boolean);
  const WORD_BANK = [...new Set(WORDS.map((w) => w.normalize('NFC')))];

  // ---------------- listas prontas ----------------
  const LISTS = {
    nomes: ['Ana', 'Pedro', 'Maria', 'Lucas', 'Julia', 'Rafael', 'Laura', 'Davi', 'Sofia', 'Miguel',
      'Helena', 'Gabriel', 'Alice', 'Arthur', 'Brasil', 'Recife', 'Bahia', 'Manaus', 'Natal', 'Paris',
      'Lisboa', 'Rio', 'Goiás', 'Paraná', 'Amazonas', 'Nilo', 'Terra', 'Lua', 'Marte', 'Saturno'],
    crase: ['vou à escola', 'fui à feira', 'cheguei à praia', 'dei um presente à vovó', 'volto às seis',
      'fomos à festa', 'saí à tarde', 'mandei uma carta à professora', 'vou à praça', 'à noite tem lua'],
    maiusculasAcento: ['É', 'Água', 'Árvore', 'Ônibus', 'Ótimo', 'Ímpar', 'Única', 'Âncora', 'Éramos',
      'Época', 'Ímã', 'Óculos', 'Último', 'Àquela', 'Êxito'],
    simbolos1: ['@', '#', '$', '%', 'ana@escola', '#feliz', 'R$10', '50%', 'oi@turma', '#jogos', '100%', 'R$5', '#girassol'],
    simbolos2: ['&', '*', '+', '=', '2+2=4', '3*3=9', 'Ana & Pedro', '5+5=10', '1+1=2', 'gato & rato', '4*2=8', '10=10'],
    simbolos3: ['(', ')', '-', '_', '/', '(oi)', 'bem-vindo', 'meu_jogo', '1/2', '(5)', 'e/ou', 'super_herói', 'dia/mês', '(sim)', 'guarda-chuva'],
    bichos: ['Rex', 'Bob', 'Mel', 'Tom', 'Lili', 'Nina', 'Thor', 'Luna', 'Pipoca', 'Bolinha', 'Fred', 'Mimi', 'Toby', 'Lola', 'Pingo', 'Fumaça'],
    cidades: ['Goiânia', 'Salvador', 'Fortaleza', 'Belém', 'Curitiba', 'Recife', 'Manaus', 'Natal', 'Palmas', 'Brasília',
      'Anápolis', 'Maceió', 'Teresina', 'Vitória', 'Cuiabá', 'Macapá', 'Aracaju', 'Florianópolis', 'Campinas', 'Santos'],
    estados: ['Goiás', 'Bahia', 'Ceará', 'Pará', 'Paraná', 'Piauí', 'Acre', 'Amapá', 'Amazonas', 'Alagoas', 'Sergipe',
      'Tocantins', 'Maranhão', 'Rondônia', 'Roraima', 'Pernambuco', 'Paraíba', 'Minas Gerais', 'Santa Catarina', 'Mato Grosso'],
    astros: ['Sol', 'Lua', 'Terra', 'Marte', 'Vênus', 'Júpiter', 'Saturno', 'Urano', 'Netuno', 'Mercúrio', 'Plutão', 'Via Láctea', 'Cruzeiro do Sul'],
    siglas: ['BR', 'TV', 'ONU', 'SP', 'RJ', 'GO', 'DF', 'CEP', 'RG', 'CPF', 'PIB', 'NASA', 'DVD', 'USB', 'PDF', 'WWW'],
    nomeSobrenome: ['Ana Lima', 'Pedro Souza', 'Maria Silva', 'Lucas Rocha', 'Julia Costa', 'Rafael Dias', 'Laura Alves',
      'Davi Martins', 'Sofia Ramos', 'Miguel Pereira', 'Helena Gomes', 'Arthur Melo', 'Alice Barros', 'Bruno Teixeira'],
    silabasRL: ['bra', 'bre', 'bri', 'bro', 'pra', 'pre', 'pla', 'cla', 'cle', 'fla', 'flo', 'tra', 'tre', 'tri', 'gra',
      'gre', 'dra', 'dro', 'cra', 'cre', 'fra', 'fre', 'bla', 'glo', 'pri', 'pro'],
    opostos: ['alto baixo', 'quente frio', 'cheio vazio', 'novo velho', 'claro escuro', 'grande pequeno', 'forte fraco',
      'limpo sujo', 'feliz triste', 'abrir fechar', 'subir descer', 'dia noite', 'perto longe', 'muito pouco'],
    verbos: ['andar', 'brincar', 'cantar', 'correr', 'dormir', 'escrever', 'estudar', 'falar', 'jogar', 'ler', 'nadar',
      'olhar', 'pintar', 'pular', 'sonhar', 'subir', 'viajar', 'voar', 'beber', 'comer', 'ajudar', 'aprender', 'desenhar', 'pensar'],
    hifen: ['guarda-chuva', 'beija-flor', 'couve-flor', 'segunda-feira', 'arco-íris', 'bem-te-vi', 'cachorro-quente',
      'quinta-feira', 'micro-ondas', 'porta-retrato', 'guarda-roupa', 'bem-vindo', 'amor-perfeito', 'pica-pau', 'vaga-lume', 'sexta-feira'],
    datas: ['07/09', '15/11', '25/12', '01/01', '12/10', '21/04', '01/05', '02/11', '10/03/2025', '24/06/2024', '31/12/2025', '05/08/2026'],
    horas: ['7:30', '12:00', '9:15', '18:45', '6:00', '13:30', '10:10', '21:00', '8:05', '15:20', '23:59', '0:30'],
    dinheiro: ['R$ 2,50', 'R$ 10,00', 'R$ 0,75', 'R$ 5,00', 'R$ 1,99', 'R$ 20,00', 'R$ 3,50', 'R$ 100,00', 'R$ 12,90', 'R$ 50,00'],
    grandes: ['100', '365', '1.000', '2.500', '10.000', '25.000', '100.000', '1.500.000', '7.000', '999', '12.345', '60.000'],
  };

  LISTS.lugares = [...LISTS.cidades, ...LISTS.estados];

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
    animais: [
      'O macaco pula de galho em galho', 'A girafa tem o pescoço comprido', 'O elefante toma banho no rio',
      'A coruja acorda de noite', 'O cachorro abana o rabo', 'A tartaruga carrega a casa nas costas',
      'O papagaio repete tudo', 'A abelha faz mel', 'O peixe vive na água', 'O coelho come cenoura',
      'A formiga trabalha o dia todo', 'O leão ruge alto',
    ],
    escola: [
      'Hoje tem aula de ciências', 'A professora escreve na lousa', 'Eu guardo o caderno na mochila',
      'Na hora do recreio eu brinco', 'Minha turma gosta de ler', 'O lápis está apontado',
      'Vamos fazer um trabalho em grupo', 'A biblioteca tem muitos livros', 'Eu levo lanche para a escola',
      'A aula de música é divertida', 'O sinal tocou', 'Meu colega me ajudou',
    ],
    natureza: [
      'O rio corre para o mar', 'As folhas caem no outono', 'A semente vira uma planta',
      'O vento balança as árvores', 'A chuva enche o lago', 'O arco colorido aparece depois da chuva',
      'As flores enfeitam o jardim', 'O sol nasce de manhã', 'A montanha é muito alta',
      'As estrelas brilham no céu', 'A floresta tem muitos bichos', 'A areia da praia é fina',
    ],
    familia: [
      'Minha avó faz bolo de fubá', 'Meu pai gosta de cozinhar', 'Minha mãe lê histórias para mim',
      'Meu irmão joga bola comigo', 'Minha tia mora longe', 'O vovô conta piadas',
      'Nós almoçamos juntos no domingo', 'Minha prima tem um gato', 'A família foi ao parque',
      'Eu ajudo a arrumar a casa', 'Meu tio toca violão', 'Minha irmã adora dançar',
    ],
    brincadeiras: [
      'Vamos brincar de pega pega', 'A amarelinha tem dez casas', 'Eu soltei pipa no campo',
      'O pião gira no chão', 'Brincamos de esconde esconde', 'A corda bate e eu pulo',
      'Montei um castelo de areia', 'O balanço vai alto', 'Joguei bolinha de gude',
      'A turma fez uma roda de ciranda', 'Eu ganhei no jogo da memória', 'O escorregador é rápido',
    ],
    comida: [
      'Eu como arroz com feijão', 'A banana é doce', 'O suco de laranja está gelado',
      'A pizza saiu do forno', 'Eu gosto de salada', 'O pão de queijo é gostoso',
      'A sopa está quente', 'O bolo de cenoura tem cobertura', 'A melancia é vermelha por dentro',
      'Eu tomo leite de manhã', 'A pipoca estoura na panela', 'O morango é pequeno',
    ],
    corpo: [
      'Eu escovo os dentes', 'Lavo as mãos antes de comer', 'Os olhos servem para ver',
      'O coração bate no peito', 'Eu tenho dez dedos nas mãos', 'O nariz sente o cheiro',
      'As pernas me levam longe', 'Eu durmo cedo para crescer', 'Beber água faz bem',
      'O ouvido escuta a música', 'Eu corro e fico com sede', 'A boca fala e sorri',
    ],
    esportes: [
      'O goleiro defendeu o chute', 'A nadadora venceu a prova', 'Eu ando de bicicleta',
      'O time marcou um gol', 'A ginasta deu uma cambalhota', 'Jogamos vôlei na quadra',
      'O corredor chegou em primeiro', 'Eu aprendi a andar de skate', 'A bola de basquete quica',
      'O judô ensina respeito', 'Fizemos um campeonato na escola', 'O juiz apitou o fim do jogo',
    ],
    comAcento2: [
      'O jacaré está no rio', 'A música é alegre', 'Você já comeu açaí', 'O ônibus está lotado',
      'Minha avó é gentil', 'O pássaro voa sobre a árvore', 'A lição está fácil', 'O pão está quentinho',
      'O mês que vem é dezembro', 'A régua é de plástico', 'O sabiá canta cedo', 'O café está doce',
    ],
    nomes: [
      'Ana mora em Goiânia', 'Pedro visitou a Bahia', 'Maria e Lucas são irmãos', 'O Brasil é enorme',
      'Sofia viajou para Natal', 'Miguel tem um cachorro chamado Rex', 'Helena nasceu em Manaus',
      'Arthur torce pelo Goiás', 'Laura viu Saturno no telescópio', 'O rio Amazonas é gigante',
    ],
    perguntas: [
      'Qual é a sua cor favorita?', 'Onde você mora?', 'Quantos irmãos você tem?', 'Você gosta de chuva?',
      'Que horas começa a aula?', 'Quem quer brincar?', 'Por que o céu é azul?', 'Como se chama o seu gato?',
      'Você já viu o mar?', 'Qual é o maior planeta?', 'O que você comeu hoje?', 'Quando é o seu aniversário?',
    ],
    exclamacoes: [
      'Que bolo gostoso!', 'Que susto!', 'Viva!', 'Ganhamos o jogo!', 'Que lindo!', 'Socorro!',
      'Até amanhã!', 'Que calor!', 'Feliz aniversário!', 'Muito obrigado!', 'Que alegria!', 'Bom dia, turma!',
    ],
    listas: [
      'Gosto de azul, verde e amarelo.', 'Na fazenda tem vaca, cavalo, porco e galinha.', 'Comprei arroz, feijão e macarrão.',
      'Os planetas são Mercúrio, Vênus, Terra e Marte.', 'Na mochila levo lápis, borracha e régua.',
      'As vogais são a, e, i, o, u.', 'Brinquei, corri, pulei e cansei.', 'No pomar tem manga, caju e goiaba.',
      'Ana, Bia, Caio e Davi são amigos.', 'Segunda, terça e quarta tem aula de inglês.',
    ],
    dialogos: [
      '- Bom dia! - disse a professora.', '- Posso ir ao banheiro? - perguntou Lia.', '- Claro que sim! - respondeu o pai.',
      '- Quem pegou o meu lápis? - gritou Leo.', '- Vamos jogar bola? - chamou o Davi.', '- Que bom! - falou a vovó.',
      '- Estou com fome - disse o menino.', '- Até logo! - acenou a turma.',
    ],
    mistura: [
      'Ufa! Terminei o dever.', 'Você viu? O gato pulou no muro!', 'Hoje, às 7:30, tem passeio.',
      'Ela disse: "Vamos ao parque?"', 'Comprei pão, leite e ovos; esqueci o café...', 'O Sol (que é uma estrela) brilha.',
      '- Oi! Tudo bem? - perguntou Ana.', 'Atenção: amanhã não tem aula!', 'Quantos anos você tem? Eu tenho 9.',
      'Que dia! Choveu, ventou e fez sol.',
    ],
    numeros2: [
      'Minha escola tem 300 alunos.', 'O Brasil tem 26 estados e 1 Distrito Federal.', 'A Lua fica a 384.000 km da Terra.',
      'Nasci em 2016.', 'O jogo começa às 15:00.', 'Ganhei R$ 5,00 da vovó.', 'Hoje é 12/10, Dia das Crianças.',
      'O dia tem 24 horas e a hora tem 60 minutos.', 'O ano de 2024 teve 366 dias.', 'Corri 2 km em 15 minutos.',
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
    abelha: 'As abelhas vivem em grupos chamados colmeias. Cada colmeia tem uma rainha e milhares de operárias. As operárias voam de flor em flor, levando o pólen e ajudando as plantas a dar frutos. Sem as abelhas, faltaria comida no mundo!',
    agua: 'A água do mar e dos rios esquenta com o sol e sobe para o céu em forma de vapor. Lá em cima, o vapor esfria e forma as nuvens. Quando as nuvens ficam pesadas, cai a chuva, que volta para os rios. É o ciclo da água, que nunca para.',
    futebol: 'No sábado, a turma organizou um jogo de futebol na quadra. O time azul começou ganhando, mas o time verde virou o placar no fim: 3 a 2! Ninguém ficou triste, porque todos jogaram juntos e comemoraram com suco de laranja.',
    lua: 'A Lua é o satélite da Terra. Ela não tem luz própria: brilha porque reflete a luz do Sol. A cada noite, vemos uma parte diferente dela, são as fases da Lua: nova, crescente, cheia e minguante. Em 1969, um astronauta pisou lá pela primeira vez.',
    amizade: 'Tito era um cachorro que tinha medo de trovão. Numa noite de tempestade, ele se escondeu embaixo da cama. A gata Mia, que sempre brigava com ele, deitou ao seu lado e ronronou até a chuva passar. Desde aquela noite, os dois são melhores amigos.',
    dinossauros: 'Os dinossauros viveram na Terra há milhões de anos, muito antes das pessoas. Alguns eram enormes, como o braquiossauro, que comia folhas do alto das árvores. Outros eram pequenos e rápidos. Hoje conhecemos os dinossauros pelos fósseis: ossos e pegadas que viraram pedra.',
    reciclagem: 'Separar o lixo ajuda o planeta. O papel vai na lixeira azul, o plástico na vermelha, o vidro na verde e o metal na amarela. Uma garrafa de plástico pode virar camiseta, e uma lata pode virar outra lata. Reciclar é transformar o lixo em coisa nova!',
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
  // sorteio: Math.random, ou a semente da rodada (generate(level, seed): o
  // mesmo texto para os dois lados de uma disputa da Maratona)
  let random = Math.random;
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = (n) => Math.floor(random() * n);
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
  function generate(level, seed) {
    if (seed != null) {
      random = seeded(seed);
      try { return generate(level); } finally { random = Math.random; }
    }
    let parts;
    switch (level.kind) {
      case 'drill':
        parts = drill(level.keys, level.newKeys, level.count || 12);
        break;
      case 'words':
        parts = wordsFrom(level.letters, level.count || 12, level.prefer || '');
        break;
      case 'mix': {
        const half = Math.round((level.count || 12) / 2);
        parts = [...drill(level.keys, level.keys, half), ...wordsFrom(level.letters, half)];
        parts = shuffle(parts);
        break;
      }
      case 'capitals': {
        const hands = level.hand === 'd' ? RIGHT_HAND : level.hand === 'e' ? LEFT_HAND : RIGHT_HAND + LEFT_HAND;
        const pool = WORD_BANK.filter((w) => !ACCENTED.test(w) && w.length >= 2 && hands.includes(w[0]));
        // `whole`: a palavra inteira em maiúscula ("BOLA")
        parts = sample(pool, level.count || 10).map(level.whole ? (w) => w.toUpperCase() : capitalize);
        break;
      }
      case 'pattern': {
        // palavras com algum dos pedaços `has` ("ch", "lh", "ão"...); sem
        // acento, a não ser que a fase seja de acentos (`accents: true`)
        const pool = WORD_BANK.filter((w) => level.has.some((h) => w.includes(h))
          && (level.accents || !ACCENTED.test(w)));
        parts = sample(pool, level.count || 12);
        break;
      }
      case 'list': {
        // `plain`: sem acento (fases que vêm antes do mundo dos acentos)
        const pool = level.plain ? LISTS[level.list].filter((w) => !ACCENTED.test(w)) : LISTS[level.list];
        parts = sample(pool, level.count || 8);
        break;
      }
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
      case 'sentences': {
        // `lists`: junta duas ou mais listas de frases (ex.: bichos e natureza)
        const pool = level.lists ? level.lists.flatMap((name) => SENTENCES[name]) : SENTENCES[level.list];
        return sample(pool, level.count || 4).join(' ');
      }
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

  const api = { generate, PRACTICE, WORD_BANK, LISTS, SENTENCES, TEXTS, SYLLABLES };
  // no navegador vira window.DigitacaoContent; no servidor (Desafio de
  // digitação) é usado com require()
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DigitacaoContent = api;
})(typeof window !== 'undefined' ? window : globalThis);
