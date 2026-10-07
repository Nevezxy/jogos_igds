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
//   server   módulo opcional com registerSockets(io) e, no futuro,
//            routes(router), validateResult(result), mergeProgress(old, result)

const games = [
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
