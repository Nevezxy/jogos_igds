// src/games/registry.js
// Lista de jogos da plataforma. Para adicionar um jogo:
//   1) crie public/games/<id>/ com game.js (que chama Plataforma.registerGame)
//   2) opcional: crie src/games/<id>/server.js (sockets, rotas, validação)
//   3) acrescente a entrada abaixo e reinicie o servidor.
//
// Campos:
//   id, name, icon, tagline   — o que aparece no cartão do painel
//   mode     'solo' | 'turma' — jogo individual ou com a turma em tempo real
//   subject  seção do painel: 'digitacao' | 'matematica' | 'mouse' |
//            'raciocinio' | 'tabuleiro' | 'turma'
//   status   'active' | 'soon' | 'hidden'
//   color    cor do cartão (nome de token do tema: sky, pink, green, ...)
//   client   arquivos em public/games/<id>/: { styles: [], view, scripts: [] },
//            todos baixados só quando o jogo é aberto. Com `persistent: true`,
//            o view.html entra na página uma vez e fica (jogos com enter/leave)
//   teacherTool  { icon, name, description }: cartão na área do professor,
//            que abre /professor/<id> (o módulo do jogo precisa de `teacher`)
//   isNew    mostra a etiqueta "Novo!" no cartão
//   server   módulo opcional com:
//              registerSockets(io)            jogos em tempo real
//              validateResult(body, progress) confere uma rodada (POST /api/progress/<id>/results)
//              mergeProgress(old, result)     como a rodada muda o progresso guardado
//              summary(progress)              texto do cartão no painel ("Fase 7 · ⭐ 18")
//              teacherSummary(progress)       resumo na área do professor

const games = [
  {
    id: 'digitacao',
    name: 'Teclado Mágico',
    icon: '⌨️',
    tagline: 'Aprenda a digitar com os 10 dedos: letras, palavras, acentos e frases!',
    mode: 'solo',
    subject: 'digitacao',
    status: 'active',
    color: 'sky',
    isNew: true,
    requiresKeyboard: true,
    client: {
      styles: ['game.css'],
      view: 'view.html',
      scripts: ['layouts/abnt2.js', 'levels.js', 'content.js', 'engine.js', 'keyboard.js', 'hands.js', 'hint.js', 'game.js'],
    },
    server: require('./digitacao/server'),
  },
  {
    id: 'letras',
    name: 'Letras Cadentes',
    icon: '🔤',
    tagline: 'Letras e palavras caem do céu: digite cada uma antes que chegue ao chão!',
    mode: 'solo',
    subject: 'digitacao',
    status: 'active',
    color: 'violet',
    isNew: true,
    requiresKeyboard: true,
    // usa o banco de palavras do Teclado Mágico
    client: {
      styles: ['game.css'],
      view: 'view.html',
      scripts: ['../digitacao/content.js', 'levels.js', 'items.js', 'game.js'],
    },
    server: require('./letras/server'),
  },
  {
    id: 'matematica',
    name: 'Conta Comigo',
    icon: '🔢',
    tagline: 'Contas de +, −, × e ÷, da unidade ao milhar, e depois negativos, potências e raízes!',
    mode: 'solo',
    subject: 'matematica',
    status: 'active',
    color: 'green',
    isNew: true,
    // teclado numérico na tela: funciona no tablet e no celular
    requiresKeyboard: false,
    client: {
      styles: ['game.css'],
      view: 'view.html',
      scripts: ['levels.js', 'problems.js', 'emoji.js', 'game.js'],
    },
    server: require('./matematica/server'),
  },
  {
    id: 'numeros',
    name: 'Números Cadentes',
    icon: '☄️',
    tagline: 'Contas caem do céu: digite o resultado antes que cheguem ao chão!',
    mode: 'solo',
    subject: 'matematica',
    status: 'active',
    color: 'orange',
    isNew: true,
    // teclado numérico na tela: funciona no tablet e no celular
    requiresKeyboard: false,
    client: {
      styles: ['game.css'],
      view: 'view.html',
      scripts: ['../matematica/problems.js', 'levels.js', 'items.js', 'game.js'],
    },
    server: require('./numeros/server'),
  },
  {
    id: 'click',
    name: 'Click',
    icon: '🖱️',
    tagline: 'Treine o mouse: estoure bolhas, clique, clique duas vezes, segure e arraste!',
    mode: 'solo',
    subject: 'mouse',
    status: 'active',
    color: 'yellow',
    isNew: true,
    // funciona com o mouse, com o dedo no tablet e com caneta
    requiresKeyboard: false,
    client: {
      styles: ['game.css'],
      view: 'view.html',
      scripts: ['levels.js', 'targets.js', 'actions.js', 'game.js'],
    },
    server: require('./click/server'),
  },
  {
    id: 'memoria',
    name: 'Jogo da Memória',
    icon: '🃏',
    tagline: 'Ache os pares: figuras, números e quantidades, letras, palavras e contas. E desafie o robô!',
    mode: 'solo',
    subject: 'raciocinio',
    status: 'active',
    color: 'violet',
    isNew: true,
    requiresKeyboard: false,
    // as telas de fora (mapa, antes da fase, resultado) são as de todos os jogos de raciocínio
    client: {
      styles: ['../../css/puzzle.css', 'game.css'],
      view: 'view.html',
      scripts: ['../../js/shared/rng.js', '../../js/shared/puzzlelevels.js', '../../js/shared/puzzleshell.js', 'levels.js', 'cards.js', 'game.js'],
    },
    server: require('./memoria/server'),
  },
  {
    id: 'hanoi',
    name: 'Torre de Hanói',
    icon: '🗼',
    tagline: 'Mude a torre de lugar, um disco por vez, sem pôr disco grande em cima de pequeno!',
    mode: 'solo',
    subject: 'raciocinio',
    status: 'active',
    color: 'orange',
    isNew: true,
    requiresKeyboard: false,
    // as telas de fora (mapa, antes da fase, resultado) são as de todos os jogos de raciocínio
    client: {
      styles: ['../../css/puzzle.css', 'game.css'],
      view: 'view.html',
      scripts: ['../../js/shared/rng.js', '../../js/shared/puzzlelevels.js', '../../js/shared/puzzleshell.js', 'hanoi.js', 'levels.js', 'game.js'],
    },
    server: require('./hanoi/server'),
  },
  {
    id: 'labirinto',
    name: 'Labirinto',
    icon: '🌀',
    tagline: 'Ache a saída! Labirintos com chaves e portas, invisíveis, no escuro e virando para a esquerda e a direita.',
    mode: 'solo',
    subject: 'raciocinio',
    status: 'active',
    color: 'sky',
    isNew: true,
    requiresKeyboard: false,
    // as telas de fora (mapa, antes da fase, resultado) são as de todos os jogos de raciocínio
    client: {
      styles: ['../../css/puzzle.css', 'game.css'],
      view: 'view.html',
      scripts: ['../../js/shared/rng.js', '../../js/shared/puzzlelevels.js', '../../js/shared/puzzleshell.js', 'maze.js', 'levels.js', 'game.js'],
    },
    server: require('./labirinto/server'),
  },
  {
    id: 'velha',
    name: 'Jogo da Velha',
    icon: '❌',
    tagline: 'Três em linha contra robôs cada vez mais espertos, ou contra um amigo pela rede!',
    mode: 'solo',
    subject: 'tabuleiro',
    status: 'active',
    color: 'pink',
    isNew: true,
    requiresKeyboard: false,
    // a parte de fora (robôs, amigo pela rede) é a mesma de todos os tabuleiros
    client: {
      styles: ['../../css/boardgame.css'],
      view: 'view.html',
      scripts: ['../../js/shared/boardlevels.js', '../../js/shared/boardgame.js', 'rules.js', 'levels.js', 'game.js'],
    },
    server: require('./velha/server'),
  },
  {
    id: 'ligue4',
    name: 'Ligue 4',
    icon: '🔴',
    tagline: 'Solte as peças e ligue 4 (ou 5) da mesma cor antes do adversário!',
    mode: 'solo',
    subject: 'tabuleiro',
    status: 'active',
    color: 'red',
    isNew: true,
    requiresKeyboard: false,
    // a parte de fora (robôs, amigo pela rede) é a mesma de todos os tabuleiros
    client: {
      styles: ['../../css/boardgame.css'],
      view: 'view.html',
      scripts: ['../../js/shared/boardlevels.js', '../../js/shared/boardgame.js', 'rules.js', 'levels.js', 'game.js'],
    },
    server: require('./ligue4/server'),
  },
  {
    id: 'desafio',
    name: 'Desafio de Digitação',
    icon: '🏁',
    tagline: 'Corrida de digitação com a turma toda, ao vivo, com telão e pódio!',
    mode: 'turma',
    subject: 'turma',
    status: 'active',
    color: 'orange',
    isNew: true,
    requiresKeyboard: true,
    // usa o teclado, as mãos, as fases e o motor do Teclado Mágico
    client: {
      persistent: true,
      styles: ['../digitacao/game.css', 'desafio.css'],
      view: 'view.html',
      scripts: [
        '../digitacao/layouts/abnt2.js', '../digitacao/levels.js', '../digitacao/engine.js',
        '../digitacao/keyboard.js', '../digitacao/hands.js', '../digitacao/hint.js',
        'common.js', 'player.js', 'master.js', 'screen.js', 'session.js',
      ],
    },
    teacherTool: {
      icon: '🏁',
      name: 'Desafio de Digitação',
      description: 'Corrida de digitação ao vivo: escolha o texto e o modo, a turma digita junta e o telão mostra a pista e o pódio.',
    },
    server: require('./desafio/server'),
  },
  {
    id: 'bingo',
    name: 'Bingo',
    icon: '🎯',
    tagline: 'Bingo de números, palavras e emojis com a turma toda!',
    mode: 'turma',
    subject: 'turma',
    status: 'active',
    color: 'pink',
    // persistent: o HTML (view.html) entra na página uma vez e fica; o jogo
    // cuida das próprias telas com enter/leave (sala de espera, cartela, telão).
    client: {
      persistent: true,
      styles: ['play.css', 'master.css'],
      view: 'view.html',
      scripts: ['packs.js', 'overlays.js', 'master.js', 'player.js', 'join.js', 'screen.js', 'session.js'],
    },
    // cartão na área do professor (/professor/bingo)
    teacherTool: {
      icon: '🎯',
      name: 'Bingo',
      description: 'Crie uma sala (ou volte para a sala aberta) e comande os sorteios. Tem QR Code e telão.',
    },
    server: require('./bingo/server'),
  },
];

// Visão pública (vai para o navegador em /api/games): sem o módulo do servidor.
function publicGames() {
  return games
    .filter((g) => g.status !== 'hidden')
    .map(({ server, ...pub }) => pub);
}

module.exports = { games, publicGames };
