// public/games/carrinhos/traffic.js
// 🚗 Carrinhos: as regras do estacionamento 6 × 6 (o mesmo arquivo serve ao
// navegador e ao servidor). Um tabuleiro é uma linha de 36 letras:
//   '.' vaga vazia, 'A' o carro vermelho (sempre deitado, na linha 3),
//   'B'..'Z' os outros carros (2 casas) e caminhões (3 casas).
// O estado é a posição de cada veículo no seu trilho (a coluna dos deitados,
// a linha dos em pé). Uma jogada é [veículo, nova posição]: andar quantas
// casas quiser, para a frente ou para trás, sem passar por cima de ninguém.
// O carro vermelho sai quando chega na coluna 5 (encostado na saída).

(function (root) {
  const SIZE = 6;
  const EXIT_ROW = 2;
  const GOAL = SIZE - 2;

  function parse(board) {
    const cells = String(board);
    const seen = new Map();
    for (let i = 0; i < SIZE * SIZE; i++) {
      const ch = cells[i];
      if (ch === '.' || ch === 'x') continue;
      if (!seen.has(ch)) seen.set(ch, []);
      seen.get(ch).push(i);
    }
    const ids = [...seen.keys()].sort();
    const vehicles = ids.map((id) => {
      const list = seen.get(id);
      const r = Math.floor(list[0] / SIZE);
      const c = list[0] % SIZE;
      const h = list.length > 1 && list[1] === list[0] + 1;
      return { id, len: list.length, h, line: h ? r : c, start: h ? c : r };
    });
    const walls = [];
    for (let i = 0; i < SIZE * SIZE; i++) if (cells[i] === 'x') walls.push(i);
    return { vehicles, walls, state: vehicles.map((v) => v.start) };
  }

  const cellOf = (v, pos, k) => (v.h ? v.line * SIZE + pos + k : (pos + k) * SIZE + v.line);

  function grid(puzzle, state) {
    const g = new Array(SIZE * SIZE).fill(-1);
    for (const w of puzzle.walls) g[w] = -2;
    puzzle.vehicles.forEach((v, i) => { for (let k = 0; k < v.len; k++) g[cellOf(v, state[i], k)] = i; });
    return g;
  }

  // até onde o veículo i anda para trás (min) e para a frente (max)
  function range(puzzle, state, i, g = grid(puzzle, state)) {
    const v = puzzle.vehicles[i];
    let lo = state[i];
    while (lo > 0 && g[cellOf(v, lo - 1, 0)] === -1) lo--;
    let hi = state[i];
    while (hi + v.len < SIZE && g[cellOf(v, hi + v.len, 0)] === -1) hi++;
    return [lo, hi];
  }

  function moves(puzzle, state) {
    const g = grid(puzzle, state);
    const out = [];
    puzzle.vehicles.forEach((v, i) => {
      const [lo, hi] = range(puzzle, state, i, g);
      for (let p = lo; p <= hi; p++) if (p !== state[i]) out.push([i, p]);
    });
    return out;
  }

  function isLegal(puzzle, state, m) {
    if (!Array.isArray(m) || m.length !== 2) return false;
    const [i, p] = m;
    if (!Number.isInteger(i) || i < 0 || i >= puzzle.vehicles.length || !Number.isInteger(p) || p === state[i]) return false;
    const [lo, hi] = range(puzzle, state, i);
    return p >= lo && p <= hi;
  }

  const apply = (state, [i, p]) => { const s = state.slice(); s[i] = p; return s; };
  const solved = (state) => state[0] === GOAL;
  const key = (state) => state.join(',');

  // o caminho mais curto até tirar o carro vermelho (busca em largura)
  function solve(puzzle, state = puzzle.state, limit = 400000) {
    if (solved(state)) return [];
    const prev = new Map([[key(state), null]]);
    let frontier = [state];
    while (frontier.length && prev.size < limit) {
      const next = [];
      for (const s of frontier) {
        for (const m of moves(puzzle, s)) {
          const n = apply(s, m);
          const k = key(n);
          if (prev.has(k)) continue;
          prev.set(k, [key(s), m]);
          if (solved(n)) {
            const path = [];
            let cur = k;
            while (prev.get(cur)) { const [from, mv] = prev.get(cur); path.push(mv); cur = from; }
            return path.reverse();
          }
          next.push(n);
        }
      }
      frontier = next;
    }
    return null;
  }

  // refaz as jogadas: todas têm que valer e o carro vermelho tem que sair
  function replay(puzzle, list) {
    if (!Array.isArray(list) || list.length > 2000) return { ok: false };
    let s = puzzle.state;
    for (const m of list) {
      if (solved(s) || !isLegal(puzzle, s, m)) return { ok: false };
      s = apply(s, m);
    }
    return { ok: true, done: solved(s), moves: list.length };
  }

  const api = { SIZE, EXIT_ROW, GOAL, parse, grid, range, moves, isLegal, apply, solved, solve, replay, cellOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Traffic = api;
})(typeof window !== 'undefined' ? window : globalThis);
