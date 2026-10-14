// public/games/quebracabeca/jigsaw.js
// 🧩 Quebra-cabeça: o corte das peças (o mesmo arquivo serve ao navegador e
// ao servidor). Pela semente sorteia para que lado vai cada encaixe e, nas
// fases de girar, a posição inicial de cada peça. As peças são quadradas;
// o desenho de cada uma é um caminho SVG com os encaixes.

(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Rng = isNode ? require('../../js/shared/rng.js') : root.SeededRng;

  const PAD = 0.26; // o quanto o encaixe sai da peça (em tamanhos de peça)

  function cut(level, seed) {
    const rng = Rng.rng(seed);
    const { cols, rows } = level;
    // V[r][c]: encaixe entre (c, r) e (c + 1, r); +1 = o "dente" vai para a direita
    const V = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, () => (rng() < 0.5 ? 1 : -1)));
    // H[r][c]: encaixe entre (c, r) e (c, r + 1); +1 = o "dente" vai para baixo
    const Hz = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, () => (rng() < 0.5 ? 1 : -1)));
    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pieces.push({
          c, r,
          top: r ? -Hz[r - 1][c] : 0,
          right: c < cols - 1 ? V[r][c] : 0,
          bottom: r < rows - 1 ? Hz[r][c] : 0,
          left: c ? -V[r][c - 1] : 0,
          rot: level.rotate ? rng.pick([90, 180, 270]) : 0,
        });
      }
    }
    const order = rng.shuffle(pieces.map((_, i) => i));
    return { cols, rows, pieces, order };
  }

  // o contorno de uma peça de lado L, com o canto de cima à esquerda em (o, o)
  const KNOB = [[0.40, 0, 0.42, 0.03, 0.40, 0.08], [0.36, 0.18, 0.40, 0.25, 0.50, 0.25], [0.60, 0.25, 0.64, 0.18, 0.60, 0.08], [0.58, 0.03, 0.60, 0, 0.65, 0]];
  function path(p, L, o = PAD * L) {
    const f = (n) => Math.round(n * 10) / 10;
    let d = `M${f(o)} ${f(o)}`;
    // cada lado: começo, direção ao longo e direção "para fora"
    const sides = [
      [p.top, [o, o], [1, 0], [0, -1]],
      [p.right, [o + L, o], [0, 1], [1, 0]],
      [p.bottom, [o + L, o + L], [-1, 0], [0, 1]],
      [p.left, [o, o + L], [0, -1], [-1, 0]],
    ];
    for (const [s, [ax, ay], [ux, uy], [nx, ny]] of sides) {
      const pt = (t, h) => `${f(ax + ux * t * L + nx * h * L * s)} ${f(ay + uy * t * L + ny * h * L * s)}`;
      if (s) {
        d += ` L${pt(0.35, 0)}`;
        for (const [t1, h1, t2, h2, t3, h3] of KNOB) d += ` C${pt(t1, h1)} ${pt(t2, h2)} ${pt(t3, h3)}`;
      }
      d += ` L${pt(1, 0)}`;
    }
    return `${d} Z`;
  }

  const api = { PAD, cut, path };
  if (isNode) module.exports = api;
  else root.Jigsaw = api;
})(typeof window !== 'undefined' ? window : globalThis);
