// src/games/registry.js
// Lista de jogos da plataforma. Para adicionar um jogo:
//   1) crie public/games/<id>/ com game.js (que chama Plataforma.registerGame)
//   2) opcional: crie src/games/<id>/server.js (sockets, rotas, validação)
//   3) acrescente a entrada abaixo e reinicie o servidor.
//
// Campos:
//   id, name, icon, tagline   — o que aparece no cartão do painel
//   mode     'solo' | 'turma' — jogo individual ou com a turma em tempo real
//   status   'active' | 'soon' | 'hidden'
//   color    cor do cartão (nome de token do tema: sky, pink, green, ...)
//   client   arquivos em public/games/<id>/: { styles: [], view, scripts: [] }
//            (sem `client`, o jogo ainda é carregado direto pelo index.html)
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
    status: 'active',
    color: 'sky',
    isNew: true,
    requiresKeyboard: true,
    client: {
      styles: ['game.css'],
      view: 'view.html',
      scripts: ['layouts/abnt2.js', 'levels.js', 'content.js', 'engine.js', 'keyboard.js', 'hands.js', 'game.js'],
    },
    server: require('./digitacao/server'),
  },
  {
    id: 'bingo',
    name: 'Bingo',
    icon: '🎯',
    tagline: 'Bingo de números, palavras e emojis com a turma toda!',
    mode: 'turma',
    status: 'active',
    color: 'pink',
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
