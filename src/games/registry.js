// src/games/registry.js
// Lista de jogos da plataforma. Para adicionar um jogo:
//   1) crie public/games/<id>/ com game.js (que chama Plataforma.registerGame)
//   2) opcional: crie src/games/<id>/server.js (sockets, rotas, validação)
//   3) acrescente a entrada abaixo e reinicie o servidor.
//
// Campos:
//   id, name, icon, tagline   — o que aparece no cartão do painel
//   mode     'solo' | 'turma' — jogo individual ou com a turma em tempo real
//   subject  seção do painel: 'digitacao' | 'matematica' | 'mouse' | 'turma'
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
