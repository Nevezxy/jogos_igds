// public/games/maratona/session.js
// Liga a 🏃 Maratona à plataforma (carregado por último):
//   /jogos/maratona      criança (player.js)
//   /professor/maratona  professor (master.js), ferramenta da área do professor
//   /telao/maratona      telão (screen.js)

(function () {
  window.Plataforma.registerGame('maratona', {
    enter: (ctx) => window.MaratonaPlayer.enter(ctx),
    leave: () => window.MaratonaPlayer.leave(),
    teacher: {
      enter: () => window.MaratonaMaster.enter(),
      leave: () => window.MaratonaMaster.leave(),
    },
    screen: { start: () => window.MaratonaScreen.start() },
  });

  // Trocar de criança no aparelho apaga a maratona da criança anterior.
  window.PlataformaAuth.onLogout(() => {
    try { localStorage.removeItem('maratona_player_v1'); } catch (e) { /* ignore */ }
  });
})();
