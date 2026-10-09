// public/games/hanoi/hanoi.js
// Regras da 🗼 Torre de Hanói (navegador e servidor): mover um disco por vez,
// sempre o de cima, e nunca um disco maior sobre um menor.
//   estado: pos[d] = pino do disco d (d = 0 é o menor)
//   lance: [de, para]
// Fases: torre clássica (tudo do pino 1 para o último), torre bagunçada
// (começa misturada) e "copie o modelo" (chegar numa arrumação desenhada);
// com 3 ou 4 pinos. O mínimo de movimentos vem de uma busca em largura (o
// número de arrumações é pequeno: no máximo 4⁷ = 16.384), que também dá a
// dica do próximo movimento certo.

(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('../../js/shared/rng.js') : root.SeededRng;

  const key = (pos) => pos.join('');
  const top = (pos, peg) => { for (let d = 0; d < pos.length; d++) if (pos[d] === peg) return d; return -1; };

  function isLegal(pos, pegs, [from, to]) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0 || from >= pegs || to >= pegs) return false;
    const d = top(pos, from);
    if (d < 0) return false;
    const t = top(pos, to);
    return t < 0 || t > d;
  }
  function apply(pos, move) {
    const next = pos.slice();
    next[top(pos, move[0])] = move[1];
    return next;
  }

  // uma arrumação qualquer, válida por construção (cada disco num pino ao acaso)
  function randomPos(r, n, pegs, avoid) {
    for (let i = 0; i < 50; i++) {
      const pos = Array.from({ length: n }, () => r.int(0, pegs - 1));
      if (!avoid || !avoid.some((a) => key(a) === key(pos))) return pos;
    }
    return Array.from({ length: n }, (_, d) => d % pegs);
  }

  // a fase: de onde sai e onde tem que chegar
  function setup(level, seed) {
    const { n, pegs } = level;
    const last = pegs - 1;
    const r = R.rng(seed);
    let start = Array(n).fill(0);
    let goal = Array(n).fill(last);
    // bagunçada e modelo: sorteia até a fase pedir pelo menos `atLeast` movimentos
    for (let i = 0; i < 200; i++) {
      if (level.mode === 'messy') start = randomPos(r, n, pegs, [goal]);
      else if (level.mode === 'copy') goal = randomPos(r, n, pegs, [start, Array(n).fill(last)]);
      else break;
      if (distance(start, goal, pegs) >= (level.atLeast || 1)) break;
    }
    return { n, pegs, start, goal, min: distance(start, goal, pegs) };
  }

  // busca em largura: distância de cada arrumação até o objetivo (de trás para frente)
  const cache = new Map();
  function distances(goal, pegs) {
    const k = `${pegs}:${key(goal)}`;
    if (cache.has(k)) return cache.get(k);
    const dist = new Map([[key(goal), 0]]);
    let frontier = [goal];
    while (frontier.length) {
      const next = [];
      for (const pos of frontier) {
        const d = dist.get(key(pos));
        for (let a = 0; a < pegs; a++) {
          for (let b = 0; b < pegs; b++) {
            if (!isLegal(pos, pegs, [a, b])) continue;
            const p2 = apply(pos, [a, b]);
            const k2 = key(p2);
            if (!dist.has(k2)) { dist.set(k2, d + 1); next.push(p2); }
          }
        }
      }
      frontier = next;
    }
    if (cache.size > 40) cache.clear();
    cache.set(k, dist);
    return dist;
  }
  const distance = (from, goal, pegs) => distances(goal, pegs).get(key(from));

  // dica: um movimento que aproxima do objetivo
  function hint(pos, goal, pegs) {
    const dist = distances(goal, pegs);
    const here = dist.get(key(pos));
    for (let a = 0; a < pegs; a++) {
      for (let b = 0; b < pegs; b++) {
        if (isLegal(pos, pegs, [a, b]) && dist.get(key(apply(pos, [a, b]))) === here - 1) return [a, b];
      }
    }
    return null;
  }

  // refaz os movimentos; { ok, moves, done }
  function replay(game, moves) {
    if (!Array.isArray(moves) || moves.length > 5000) return { ok: false };
    let pos = game.start.slice();
    for (const m of moves) {
      if (!Array.isArray(m) || !isLegal(pos, game.pegs, m)) return { ok: false };
      pos = apply(pos, m);
    }
    return { ok: true, moves: moves.length, done: key(pos) === key(game.goal) };
  }

  const api = { setup, isLegal, apply, top, hint, distance, replay, same: (a, b) => key(a) === key(b) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HanoiRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
