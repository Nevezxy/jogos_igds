// public/games/pixel/pixel.js
// 🎨 Pixel Art: as regras da pintura por número (o mesmo arquivo serve ao
// navegador e ao servidor). Uma jogada é [quadradinho, cor, balde]:
//   pincel (balde = 0): pinta um quadradinho; cor errada conta um erro e
//     o quadradinho fica marcado para corrigir;
//   balde (balde = 1): pinta de uma vez a região grudada de quadradinhos
//     com o mesmo número; cor errada conta um erro e não pinta nada.
// Quadradinho já certo não se pinta de novo; o fundo ('.') não se pinta.

(function (root) {
  const CODE = '123456789a';

  function parse(design) {
    const h = design.rows.length;
    const w = design.rows[0].length;
    const target = [];
    for (const r of design.rows) for (const ch of r) target.push(ch === '.' ? 0 : CODE.indexOf(ch) + 1);
    const total = target.filter(Boolean).length;
    return { w, h, target, total, colors: design.palette.length };
  }

  // a região grudada (cima, baixo, lados) com o mesmo número, ainda por acertar
  function region(pic, painted, start) {
    const want = pic.target[start];
    const out = [];
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      out.push(i);
      const x = i % pic.w;
      const y = Math.floor(i / pic.w);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= pic.w || ny >= pic.h) continue;
        const j = ny * pic.w + nx;
        if (seen.has(j) || pic.target[j] !== want || painted[j] === want) continue;
        seen.add(j);
        stack.push(j);
      }
    }
    return out;
  }

  // uma jogada: devolve { ok, error, cells } (cells = quadradinhos pintados)
  function paint(pic, painted, [cell, color, bucket]) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= pic.target.length || !Number.isInteger(color) || color < 1 || color > pic.colors) return { ok: false };
    const want = pic.target[cell];
    if (!want || painted[cell] === want) return { ok: false };
    if (bucket) {
      if (color !== want) return { ok: true, error: true, cells: [] };
      const cells = region(pic, painted, cell);
      cells.forEach((i) => { painted[i] = color; });
      return { ok: true, error: false, cells };
    }
    painted[cell] = color;
    return { ok: true, error: color !== want, cells: [cell] };
  }

  const done = (pic, painted) => pic.target.every((t, i) => !t || painted[i] === t);

  function replay(pic, actions) {
    if (!Array.isArray(actions) || actions.length > pic.target.length * 4 + 200) return { ok: false };
    const painted = new Array(pic.target.length).fill(0);
    let errors = 0;
    for (const a of actions) {
      if (!Array.isArray(a)) return { ok: false };
      const r = paint(pic, painted, [a[0], a[1], a[2] ? 1 : 0]);
      if (!r.ok) return { ok: false };
      if (r.error) errors++;
    }
    return { ok: true, done: done(pic, painted), errors, actions: actions.length };
  }

  // a conta que aparece no lugar do número (mundo "Pinte com contas")
  function expression(v, op, rng) {
    const kind = op === 'addsub' ? rng.pick(['add', 'sub']) : op === 'mix' ? rng.pick(['add', 'sub', 'mul', 'div']) : op;
    if (kind === 'add') { const a = v >= 2 ? rng.int(1, v - 1) : rng.int(0, 1); return `${a}+${v - a}`; }
    if (kind === 'sub') { const b = rng.int(1, 6); return `${v + b}−${b}`; }
    if (kind === 'mul') {
      const pairs = [];
      for (let a = 1; a <= v; a++) if (v % a === 0) pairs.push([a, v / a]);
      const nice = pairs.length > 2 ? pairs.filter(([a, b]) => a > 1 && b > 1) : pairs;
      const [a, b] = rng.pick(nice);
      return `${a}×${b}`;
    }
    const d = rng.int(2, 5);
    return `${v * d}÷${d}`;
  }

  const api = { CODE, parse, region, paint, done, replay, expression };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PixelRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
