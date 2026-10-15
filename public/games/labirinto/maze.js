// public/games/labirinto/maze.js
// 🌀 Labirinto (navegador e servidor): gera o labirinto pela semente,
// coloca chaves e portas (sempre com solução) e refaz o caminho da criança.
//   walls[c]   paredes da casa c (c = y * w + x): N = 1, L = 2, S = 4, O = 8
//   doors      [{ a, b, color }]: porta entre as casas a e b (abre com a chave da cor)
//   keys       [{ cell, color }]
//   comandos   absolutos 'U' 'R' 'D' 'L' (cima, direita, baixo, esquerda) ou,
//              no modo relativo, 'F' (andar para a frente), 'E' e 'D' (virar
//              para a esquerda e para a direita)

(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('../../js/shared/rng.js') : root.SeededRng;

  const DIRS = [ // 0 cima, 1 direita, 2 baixo, 3 esquerda
    { dx: 0, dy: -1, bit: 1, opp: 4 },
    { dx: 1, dy: 0, bit: 2, opp: 8 },
    { dx: 0, dy: 1, bit: 4, opp: 1 },
    { dx: -1, dy: 0, bit: 8, opp: 2 },
  ];
  const ABS = { U: 0, R: 1, D: 2, L: 3 };
  const COLORS = ['red', 'blue', 'yellow'];

  function generate(w, h, r) {
    const walls = Array(w * h).fill(15);
    const seen = new Uint8Array(w * h);
    const stack = [0];
    seen[0] = 1;
    while (stack.length) {
      const c = stack[stack.length - 1];
      const x = c % w;
      const y = Math.floor(c / w);
      const options = DIRS.map((d, i) => i).filter((i) => {
        const nx = x + DIRS[i].dx;
        const ny = y + DIRS[i].dy;
        return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx];
      });
      if (!options.length) { stack.pop(); continue; }
      const i = r.pick(options);
      const n = (y + DIRS[i].dy) * w + x + DIRS[i].dx;
      walls[c] &= ~DIRS[i].bit;
      walls[n] &= ~DIRS[i].opp;
      seen[n] = 1;
      stack.push(n);
    }
    return walls;
  }

  const doorKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  function neighbor(m, c, dir) {
    if (m.walls[c] & DIRS[dir].bit) return -1;
    return c + DIRS[dir].dy * m.w + DIRS[dir].dx;
  }

  // casas alcançáveis a partir de `from` sem passar pelas portas fechadas
  function reachable(m, from, closed) {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const c = queue.shift();
      for (let d = 0; d < 4; d++) {
        const n = neighbor(m, c, d);
        if (n < 0 || seen.has(n) || closed.has(doorKey(c, n))) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    return seen;
  }

  // o caminho (único) da entrada até a saída
  function pathBetween(m, a, b) {
    const prev = new Map([[a, -1]]);
    const queue = [a];
    while (queue.length) {
      const c = queue.shift();
      if (c === b) break;
      for (let d = 0; d < 4; d++) {
        const n = neighbor(m, c, d);
        if (n >= 0 && !prev.has(n)) { prev.set(n, c); queue.push(n); }
      }
    }
    const path = [];
    for (let c = b; c !== -1; c = prev.get(c)) path.unshift(c);
    return path;
  }

  function makeMaze(level, seed) {
    const r = R.rng(seed);
    const w = level.size;
    const h = level.rows || level.size;
    const m = { w, h, walls: generate(w, h, r), start: 0, exit: w * h - 1, doors: [], keys: [] };
    const k = level.keys || 0;
    if (k) {
      // portas no caminho da saída; a chave de cada porta fica antes dela
      const path = pathBetween(m, m.start, m.exit);
      const onPath = new Set(path);
      // a porta i fica perto de (i + 1)/(k + 1) do caminho, mas só onde há
      // cantos fora do caminho antes dela (para a chave ficar escondida)
      let prevJ = -1;
      for (let i = 0; i < k; i++) {
        const target = Math.max(prevJ + 1, Math.floor(((i + 1) * (path.length - 1)) / (k + 1)));
        let chosen = Math.min(target, path.length - 2);
        for (let j = target; j < path.length - 1 - (k - 1 - i); j++) {
          const closed = new Set([doorKey(path[j], path[j + 1])]);
          const before = [...reachable(m, m.start, closed)].filter((c) => !onPath.has(c));
          if (before.length >= 3 * (i + 1)) { chosen = j; break; }
        }
        prevJ = chosen;
        m.doors.push({ a: path[chosen], b: path[chosen + 1], color: COLORS[i] });
      }
      m.doors.forEach((door, i) => {
        const closed = new Set(m.doors.slice(i).map((d) => doorKey(d.a, d.b)));
        const area = [...reachable(m, m.start, closed)].filter((c) => c !== m.start && !m.keys.some((kk) => kk.cell === c));
        // de preferência fora do caminho (para precisar procurar)
        const off = area.filter((c) => !onPath.has(c));
        m.keys.push({ cell: r.pick(off.length ? off : area), color: door.color });
      });
    }
    m.shortest = shortest(m);
    return m;
  }

  // menor número de passos até a saída, pegando as chaves que precisar
  function shortest(m) {
    const keyAt = new Map(m.keys.map((kk, i) => [kk.cell, i]));
    const doorAt = new Map(m.doors.map((d) => [doorKey(d.a, d.b), COLORS.indexOf(d.color)]));
    const colorBit = (color) => 1 << COLORS.indexOf(color);
    const startMask = keyAt.has(m.start) ? colorBit(m.keys[keyAt.get(m.start)].color) : 0;
    const seen = new Set([`${m.start}:${startMask}`]);
    let frontier = [[m.start, startMask]];
    for (let steps = 0; frontier.length; steps++) {
      const next = [];
      for (const [c, mask] of frontier) {
        if (c === m.exit) return steps;
        for (let d = 0; d < 4; d++) {
          const n = neighbor(m, c, d);
          if (n < 0) continue;
          const door = doorAt.get(doorKey(c, n));
          if (door !== undefined && !(mask & (1 << door))) continue;
          const nm = keyAt.has(n) ? mask | colorBit(m.keys[keyAt.get(n)].color) : mask;
          const s = `${n}:${nm}`;
          if (!seen.has(s)) { seen.add(s); next.push([n, nm]); }
        }
      }
      frontier = next;
    }
    return Infinity;
  }

  // Um passo: devolve o novo estado e o que aconteceu ('move' | 'wall' | 'door').
  function step(m, st, dir) {
    const n = neighbor(m, st.cell, dir);
    if (n < 0) return { ...st, bumps: st.bumps + 1, last: 'wall', bumpDir: dir };
    const door = m.doors.find((d) => doorKey(d.a, d.b) === doorKey(st.cell, n));
    if (door && !st.keys.includes(door.color)) return { ...st, bumps: st.bumps + 1, last: 'door', bumpDir: dir };
    const key = m.keys.find((kk) => kk.cell === n);
    const keys = key && !st.keys.includes(key.color) ? [...st.keys, key.color] : st.keys;
    return { ...st, cell: n, steps: st.steps + 1, keys, last: key && keys !== st.keys ? 'key' : 'move', done: n === m.exit };
  }

  const initial = (m) => ({ cell: m.start, heading: 1, steps: 0, bumps: 0, keys: [], done: false, last: null });

  // aplica um comando (absoluto ou relativo)
  function command(m, st, cmd, relative) {
    if (st.done) return st;
    if (relative) {
      if (cmd === 'E') return { ...st, heading: (st.heading + 3) % 4, last: 'turn' };
      if (cmd === 'D') return { ...st, heading: (st.heading + 1) % 4, last: 'turn' };
      if (cmd === 'F') return step(m, st, st.heading);
      return null;
    }
    if (!(cmd in ABS)) return null;
    return { ...step(m, st, ABS[cmd]), heading: ABS[cmd] };
  }

  // refaz o caminho inteiro; { ok, done, steps, bumps }
  function replay(m, cmds, relative) {
    if (typeof cmds !== 'string' || cmds.length > 20000) return { ok: false };
    let st = initial(m);
    for (const c of cmds) {
      const next = command(m, st, c, relative);
      if (!next) return { ok: false };
      st = next;
      if (st.done) break;
    }
    return { ok: true, done: st.done, steps: st.steps, bumps: st.bumps };
  }

  const api = { makeMaze, replay, command, initial, DIRS, COLORS, doorKey, neighbor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LabirintoMaze = api;
})(typeof window !== 'undefined' ? window : globalThis);
