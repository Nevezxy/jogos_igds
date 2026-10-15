// public/js/shared/competition.js
// 🏃 Modo competitivo dos jogos (Modo Maratona). Quem monta o jogo pode
// passar no contexto:
//   ctx.competition = {
//     levelId   a fase da rodada (corrida)
//     seed      a semente da rodada: os dois lados recebem as mesmas peças,
//               contas, cartas... (o servidor confere com ela)
//     submit(body) -> Promise   recebe o resultado no lugar do
//               POST /progress/<jogo>/results (o servidor da maratona valida)
//     matchId   (duelo de tabuleiro) a partida pela rede já criada
//     onDone?(info)  avisado quando a criança termina (corrida ou duelo)
//   }
// Com ele, o jogo abre direto na fase (sem mapa), não sorteia semente,
// desliga o que é sorteado sem semente (peças especiais) e esconde os
// botões que levariam para fora da disputa (mapa, próxima fase, jogar de
// novo, sair). Sem ele, nada muda.

(function () {
  const of = (ctx) => (ctx && ctx.competition) || null;

  // o resultado da rodada: na disputa vai para a maratona; senão, o de sempre
  async function send(ctx, route, body) {
    const comp = of(ctx);
    if (!comp) return ctx.api.post(route, body);
    const res = await comp.submit(body);
    if (comp.onDone) comp.onDone({ body, res });
    return res || {};
  }

  // esconde (e desliga) os botões que saem da disputa
  function hide(root, selectors) {
    selectors.forEach((sel) => root.querySelectorAll(sel).forEach((el) => {
      el.hidden = true;
      el.disabled = true;
      el.setAttribute('aria-hidden', 'true');
    }));
  }

  // aviso no lugar dos botões da tela de resultado
  function waiting(el, text = '✅ Resultado enviado! Esperando os outros terminarem…') {
    if (!el) return;
    el.textContent = text;
    el.classList.add('comp-waiting');
  }

  window.Competicao = { of, send, hide, waiting };
})();
