// public/games/click/actions.js
// Reconhece as ações do 🖱️ Click em cada alvo, sem depender do navegador
// (por isso dá para testar com eventos de mentira). O jogo avisa quando o
// botão desce e sobe em cima do alvo, quando o ponteiro sai dele e, a cada
// quadro, chama tick(); cada chamada devolve o que aconteceu:
//   'ok'                  ação certa: o alvo estoura
//   'wait'                começou (1º clique do duplo, começou a segurar)
//   { progress: 0..1 }    quanto já segurou
//   'wrong:<motivo>'      ação errada: o alvo continua, mas conta um erro
//     one     só um clique num alvo de duplo clique (ou o 2º veio tarde)
//     early   soltou antes de encher
//     left    saiu de cima do alvo enquanto segurava
//   null                  nada a dizer
// O duplo clique e o segurar são medidos aqui, com os tempos da fase, e não
// dependem da configuração do Windows.

(function (root) {
  function createGesture(kind, { dblMs = 800, holdMs = 800 } = {}) {
    let firstAt = null; // duplo: hora do 1º clique
    let holdAt = null; // segurar: hora em que apertou

    return {
      kind,
      down(now) {
        if (kind === 'hover' || kind === 'click') return 'ok';
        if (kind === 'double') {
          if (firstAt != null && now - firstAt <= dblMs) { firstAt = null; return 'ok'; }
          firstAt = now;
          return 'wait';
        }
        if (kind === 'hold') { holdAt = now; return 'wait'; }
        return null;
      },
      // o ponteiro passou por cima (sem clicar): só estoura as bolhas
      over() { return kind === 'hover' ? 'ok' : null; },
      up(now) {
        if (kind !== 'hold' || holdAt == null) return null;
        const done = now - holdAt >= holdMs;
        holdAt = null;
        return done ? 'ok' : 'wrong:early';
      },
      leave() {
        if (kind !== 'hold' || holdAt == null) return null;
        holdAt = null;
        return 'wrong:left';
      },
      tick(now) {
        if (kind === 'double' && firstAt != null && now - firstAt > dblMs) {
          firstAt = null;
          return 'wrong:one';
        }
        if (kind === 'hold' && holdAt != null) {
          const p = (now - holdAt) / holdMs;
          if (p >= 1) { holdAt = null; return 'ok'; }
          return { progress: p };
        }
        return null;
      },
      // pausa: esquece o que estava pela metade
      reset() { firstAt = null; holdAt = null; },
      get armed() { return firstAt != null; },
      get holding() { return holdAt != null; },
    };
  }

  // Onde o objeto arrastado foi solto: 'ok' (destino certo), 'wrong:place'
  // (outro destino) ou 'wrong:outside' (fora de todos).
  // dests: [{ id, left, top, right, bottom }]
  function dropResult(point, dests, wanted) {
    const hit = dests.find((d) => point.x >= d.left && point.x <= d.right && point.y >= d.top && point.y <= d.bottom);
    if (!hit) return 'wrong:outside';
    return hit.id === wanted ? 'ok' : 'wrong:place';
  }

  const api = { createGesture, dropResult };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickActions = api;
})(typeof window !== 'undefined' ? window : globalThis);
