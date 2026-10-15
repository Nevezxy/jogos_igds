// scripts/carrinhos-banco.js
// Gera o banco de fases do 🚗 Carrinhos (public/games/carrinhos/bank.js).
// Sorteia estacionamentos e vai mexendo neles (tira, põe e muda carros de
// lugar), ficando com os que ficam mais difíceis. Para cada um, monta todas
// as posições alcançáveis e mede, por busca em largura a partir das posições
// resolvidas, o mínimo de jogadas de cada posição. Assim cada fase tem o
// mínimo exato, do fácil (2 jogadas) ao difícil (30 ou mais).
//   node scripts/carrinhos-banco.js [segundos]   (padrão: 300)
// O resultado é sempre o mesmo para a mesma semente e o mesmo tempo.

const fs = require('fs');
const path = require('path');
const T = require('../public/games/carrinhos/traffic.js');

const SEED = 20261014;
const SECONDS = Number(process.argv[2]) || 300;

// mulberry32: sorteio com semente
let s = SEED >>> 0;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const N = T.SIZE;
const LETTERS = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';

// põe um veículo num lugar livre (nunca deitado na linha da saída, que trancaria o vermelho)
function placeOne(g, id, len) {
  for (let tries = 0; tries < 80; tries++) {
    const h = rnd() < 0.5;
    const r = int(0, h ? N - 1 : N - len);
    const c = int(0, h ? N - len : N - 1);
    if (h && r === T.EXIT_ROW) continue;
    const cells = [];
    for (let k = 0; k < len; k++) cells.push(h ? r * N + c + k : (r + k) * N + c);
    if (cells.some((i) => g[i] !== '.')) continue;
    cells.forEach((i) => { g[i] = id; });
    return true;
  }
  return false;
}

function randomBoard(count, trucks) {
  const g = new Array(N * N).fill('.');
  const a = int(0, 2);
  g[T.EXIT_ROW * N + a] = 'A';
  g[T.EXIT_ROW * N + a + 1] = 'A';
  for (let k = 0; k < count; k++) if (!placeOne(g, LETTERS[k], k < trucks ? 3 : 2)) return null;
  return g.join('');
}

const relabel = (board) => {
  const map = new Map([['A', 'A'], ['.', '.']]);
  return board.split('').map((ch) => { if (!map.has(ch)) map.set(ch, LETTERS[map.size - 2]); return map.get(ch); }).join('');
};

// mexe um pouco no estacionamento: tira, põe ou muda um veículo de lugar
function mutate(board) {
  const g = board.split('');
  const ids = [...new Set(g.filter((ch) => ch !== '.' && ch !== 'A'))];
  const op = rnd();
  if ((op < 0.35 && ids.length > 1) || ids.length >= 13) {
    const id = ids[int(0, ids.length - 1)];
    g.forEach((ch, i) => { if (ch === id) g[i] = '.'; });
    if (op < 0.12) return relabel(g.join(''));
  }
  const free = LETTERS.split('').find((l) => !g.includes(l));
  if (!placeOne(g, free, rnd() < 0.3 ? 3 : 2)) return null;
  return relabel(g.join(''));
}

function boardOf(puzzle, state) {
  const g = T.grid(puzzle, state);
  return g.map((v) => (v === -1 ? '.' : v === -2 ? 'x' : puzzle.vehicles[v].id)).join('');
}

// todas as posições alcançáveis e a distância de cada uma até a saída
// (a chave de uma posição é um número: a posição de cada veículo em base 5)
function component(puzzle, cap = 60000) {
  const nv = puzzle.vehicles.length;
  const enc = (st) => { let k = 0; for (let i = nv - 1; i >= 0; i--) k = k * 5 + st[i]; return k; };
  const dec = (k) => { const st = new Array(nv); for (let i = 0; i < nv; i++) { st[i] = k % 5; k = Math.floor(k / 5); } return st; };
  const start = enc(puzzle.state);
  const adj = new Map([[start, null]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const k of frontier) {
      const st = dec(k);
      const ns = [];
      for (const [i, p] of T.moves(puzzle, st)) { const n = st.slice(); n[i] = p; ns.push(enc(n)); }
      adj.set(k, ns);
      for (const n of ns) if (!adj.has(n)) { adj.set(n, null); next.push(n); if (adj.size > cap) return null; }
    }
    frontier = next;
  }
  const dist = new Map();
  frontier = [];
  for (const k of adj.keys()) if (k % 5 === T.GOAL) { dist.set(k, 0); frontier.push(k); }
  if (!frontier.length) return null;
  let d = 0;
  while (frontier.length) {
    d++;
    const next = [];
    for (const k of frontier) for (const n of adj.get(k)) if (!dist.has(n)) { dist.set(n, d); next.push(n); }
    frontier = next;
  }
  let low = Infinity;
  for (const k of adj.keys()) if (k < low) low = k;
  const sig = `${puzzle.vehicles.map((v) => `${v.len}${v.h ? 'h' : 'v'}${v.line}`).join('')}|${low}`;
  return { dist, dec, max: d - 1, sig };
}

// cada subida dá no máximo 2 fases, para os estacionamentos não ficarem parecidos
// fases: [mínimo de jogadas, veículos (mín, máx), caminhões (mín)]
const PLAN = [
  [2, 3, 5, 0], [2, 4, 6, 0], [3, 4, 6, 0], [3, 5, 7, 0], [4, 5, 7, 0], [4, 5, 8, 1], [5, 6, 8, 1], [5, 6, 8, 1],
  [6, 6, 9, 1], [6, 7, 9, 1], [7, 7, 10, 1], [8, 6, 11, 0], [8, 8, 11, 2], [9, 8, 11, 2], [10, 8, 11, 2], [10, 9, 12, 2],
  [11, 8, 12, 1], [12, 8, 12, 1], [13, 9, 12, 2], [14, 9, 13, 2], [15, 9, 13, 2], [15, 10, 13, 2], [16, 10, 13, 2], [17, 10, 13, 2],
  [18, 8, 14, 1], [19, 8, 14, 1], [20, 8, 14, 1], [21, 8, 14, 1], [22, 8, 14, 1], [23, 8, 14, 1], [24, 8, 14, 1], [25, 8, 14, 1],
  [26, 8, 14, 0], [27, 8, 14, 0], [28, 8, 14, 0], [29, 8, 14, 0], [30, 8, 14, 0], [31, 8, 14, 0], [32, 8, 14, 0], [34, 8, 14, 0],
];

const found = PLAN.map(() => null);
const used = new Set();

function offer(board, comp) {
  if (used.has(comp.sig)) return false;
  const puzzle = T.parse(board);
  const count = puzzle.vehicles.length;
  const trucks = puzzle.vehicles.filter((v) => v.len === 3).length;
  let pick = -1;
  for (let i = PLAN.length - 1; i >= 0; i--) {
    const [min, lo, hi, tr] = PLAN[i];
    if (!found[i] && comp.max >= min && count >= lo && count <= hi && trucks >= tr) { pick = i; break; }
  }
  if (pick < 0) return false;
  const min = PLAN[pick][0];
  // entre as posições com esse mínimo, a que deixa o vermelho mais longe da saída
  let chosen = null;
  for (const [k, d] of comp.dist) {
    if (d !== min) continue;
    const st = comp.dec(k);
    if (!chosen || st[0] < chosen[0]) chosen = st;
  }
  const out = boardOf(puzzle, chosen);
  const check = T.solve(T.parse(out));
  if (!check || check.length !== min) throw new Error(`mínimo errado em ${out}`);
  found[pick] = { board: out, min, vehicles: count };
  used.add(comp.sig);
  console.log(`fase ${pick + 1}: ${min} jogadas (${count} veículos)`);
  return true;
}

const deadline = Date.now() + SECONDS * 1000;
let tried = 0;
let best = 0;
while (Date.now() < deadline && found.some((f) => !f)) {
  // uma subida: começa num sorteio e vai mexendo, ficando com o que fica mais difícil
  const count = int(2, 12);
  let board = randomBoard(count, int(0, Math.min(3, Math.max(0, count - 3))));
  if (!board) continue;
  let comp = component(T.parse(board));
  tried++;
  if (!comp) continue;
  let gave = offer(board, comp) ? 1 : 0;
  for (let step = 0; step < 200 && Date.now() < deadline; step++) {
    const b = mutate(board);
    if (!b) continue;
    const c = component(T.parse(b));
    tried++;
    if (!c || c.max < comp.max) continue;
    board = b;
    comp = c;
    if (c.max > best) { best = c.max; console.log(`  (mais difícil até agora: ${best})`); }
    if (gave < 2 && (c.max >= 18 || step % 40 === 0) && offer(board, comp)) gave++;
  }
  if (gave < 2) offer(board, comp);
}

console.log(`\n${tried} estacionamentos testados; o mais difícil visto: ${best} jogadas.`);
const missing = PLAN.map((p, i) => (found[i] ? null : i + 1)).filter(Boolean);
if (missing.length) { console.log('Faltaram as fases', missing.join(', '), '(rode por mais tempo)'); process.exit(1); }

const out = `// public/games/carrinhos/bank.js
// Banco de fases do 🚗 Carrinhos, gerado por scripts/carrinhos-banco.js
// (não edite à mão). Cada fase: o estacionamento (36 letras, linha a linha)
// e o mínimo de jogadas, calculado por busca em largura.

(function (root) {
  const BANK = [
${found.map((f) => `    ['${f.board}', ${f.min}],`).join('\n')}
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = BANK;
  else root.CarrinhosBank = BANK;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(__dirname, '../public/games/carrinhos/bank.js'), out);
console.log('bank.js gravado.');
