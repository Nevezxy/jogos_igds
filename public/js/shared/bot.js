// public/js/shared/bot.js
// O "robô" dos jogos de tabuleiro: busca minimax (negamax) com poda
// alfa-beta e aprofundamento iterativo, limitada por profundidade e por
// tempo. É a mesma para todos os jogos; cada jogo traz as regras:
//   Rules.moves(state)        lances possíveis
//   Rules.play(state, move)   novo estado (o original não muda); quando a
//                             partida acaba, state.result = { winner: 0 | 1 | null }
//                             (null = empate)
//   Rules.evaluate(state)     nota da posição para quem joga agora
//                             (positivo = bom para ele), sem contar o fim
//   Rules.order(state, moves) opcional: melhores lances primeiro (poda mais)
//   Rules.captures(state)     opcional: só as capturas; no fim da busca o robô
//                             continua olhando as trocas (busca de capturas),
//                             para não deixar peça pendurada
// Nível do robô (`level`):
//   depth   quantos lances pensa à frente (0 = joga ao acaso)
//   random  chance (0 a 1) de jogar um lance qualquer, para errar de propósito
//   noise   sorteio somado à nota de cada lance (o robô fica menos previsível)
//   maxMs   tempo máximo para pensar
// Funciona no navegador, no Web Worker (bot-worker.js) e no Node (testes).

(function (root) {
  const WIN = 1e6;

  function shuffle(list, rnd) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // nota do fim da partida para quem "jogaria agora" (quem acabou de jogar é o outro)
  function terminalScore(state, ply) {
    const { winner } = state.result;
    if (winner === null || winner === undefined) return 0;
    // ganhar mais cedo vale mais; perder mais tarde, menos ruim
    return winner === state.turn ? WIN - ply : -(WIN - ply);
  }

  class Timeout extends Error {}

  function search(Rules, state, level, rnd = Math.random) {
    const moves = Rules.moves(state);
    if (!moves.length) return { move: null, score: 0 };
    if (moves.length === 1) return { move: moves[0], score: 0 };
    if (!level.depth || rnd() < (level.random || 0)) {
      return { move: moves[Math.floor(rnd() * moves.length)], score: 0, random: true };
    }
    const deadline = Date.now() + (level.maxMs || 1500);
    let nodes = 0;
    const ordered = (s, ms) => (Rules.order ? Rules.order(s, ms) : ms);

    function negamax(s, depth, alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Timeout();
      if (s.result) return terminalScore(s, ply);
      if (depth === 0) return Rules.captures && level.quiesce !== false ? quiesce(s, alpha, beta, ply, 0) : Rules.evaluate(s);
      let best = -Infinity;
      for (const m of ordered(s, Rules.moves(s))) {
        const v = -negamax(Rules.play(s, m), depth - 1, -beta, -alpha, ply + 1);
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }

    function quiesce(s, alpha, beta, ply, q) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Timeout();
      if (s.result) return terminalScore(s, ply);
      const stand = Rules.evaluate(s);
      if (stand >= beta || q >= 6) return stand;
      if (stand > alpha) alpha = stand;
      let best = stand;
      for (const m of Rules.captures(s)) {
        const v = -quiesce(Rules.play(s, m), -beta, -alpha, ply + 1, q + 1);
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }

    // aprofundamento iterativo: sempre tem uma resposta pronta se o tempo acabar
    let bestMoves = moves;
    let bestScore = 0;
    let reached = 0;
    let root = shuffle(ordered(state, moves), rnd);
    for (let depth = 1; depth <= level.depth; depth++) {
      try {
        // poda também na raiz: lance pior que (o melhor − margem) não precisa de nota exata
        const margin = (level.noise || 0) + 1e-6;
        let bestSoFar = -Infinity;
        const scored = root.map((m) => {
          const lo = bestSoFar - margin;
          const v = -negamax(Rules.play(state, m), depth - 1, -Infinity, -lo, 1);
          if (v > bestSoFar) bestSoFar = v;
          return { m, v: v + (level.noise ? (rnd() - 0.5) * level.noise : 0) };
        });
        const top = Math.max(...scored.map((x) => x.v));
        bestMoves = scored.filter((x) => x.v >= top - 1e-9).map((x) => x.m);
        bestScore = top;
        reached = depth;
        // os melhores primeiro na próxima rodada (poda mais)
        root = scored.sort((a, b) => b.v - a.v).map((x) => x.m);
        if (Math.abs(top) >= WIN - 1000) break; // já achou vitória (ou derrota) certa
      } catch (e) {
        if (!(e instanceof Timeout)) throw e;
        break;
      }
    }
    return { move: bestMoves[Math.floor(rnd() * bestMoves.length)], score: bestScore, depth: reached, nodes };
  }

  const api = { search, WIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardBot = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
