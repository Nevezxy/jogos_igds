// public/games/desafio/session.js
// Liga o Desafio de digitação à plataforma (carregado por último):
//   /jogos/desafio      criança (player.js)
//   /professor/desafio  professor (master.js), ferramenta da área do professor
//   /telao/desafio      telão (screen.js)

(function () {
  window.Plataforma.registerGame('desafio', {
    enter: (ctx) => window.DesafioPlayer.enter(ctx),
    leave: () => window.DesafioPlayer.leave(),
    teacher: {
      enter: () => window.DesafioMaster.enter(),
      leave: () => window.DesafioMaster.leave(),
    },
    screen: { start: () => window.DesafioScreen.start() },
  });

  // Trocar de criança no aparelho apaga a sala da criança anterior.
  window.PlataformaAuth.onLogout(() => {
    try { localStorage.removeItem('desafio_player_v1'); } catch (e) { /* ignore */ }
  });
})();
