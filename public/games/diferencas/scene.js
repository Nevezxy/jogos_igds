// public/games/diferencas/scene.js
// 🔍 Encontre a Diferença: o gerador de cenas (o mesmo arquivo serve ao
// navegador e ao servidor). Pela semente sorteia um cenário (parque, fundo
// do mar ou espaço), espalha as figuras sem encostar uma na outra e monta a
// cena da direita com as diferenças:
//   color   a cor principal trocada        color2  a cor de um detalhe trocada
//   missing a figura sumiu                 extra   uma figura a mais
//   size    maior ou menor                 flip    virada (espelhada)
//   move    mudou de lugar
// Cada diferença guarda onde tocar (um ou dois círculos, na cena 400 × 300).
// O desenho (SVG) também fica aqui; o servidor só usa a parte das contas.

(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Rng = isNode ? require('../../js/shared/rng.js') : root.SeededRng;

  const W = 400;
  const H = 300;
  const BASE = 22; // raio de uma figura no tamanho 1

  // cores, cada uma com uma "parecida" (para as diferenças sutis)
  const COLORS = {
    vermelho: ['#E53935', '#FF7043'], laranja: ['#FB8C00', '#FFB74D'], amarelo: ['#FDD835', '#FFF59D'],
    verde: ['#43A047', '#9CCC65'], verdeEsc: ['#2E7D32', '#558B2F'], azul: ['#1E88E5', '#64B5F6'], roxo: ['#8E24AA', '#BA68C8'],
    rosa: ['#EC407A', '#F8BBD0'], marrom: ['#8D6E63', '#A1887F'], branco: ['#FFFFFF', '#E3E3E3'], creme: ['#FFE0B2', '#FFCC80'],
    cinza: ['#B0BEC5', '#ECEFF1'], ciano: ['#26C6DA', '#80DEEA'],
  };
  const hex = (name) => COLORS[name][0];

  // as figuras: zona (onde ficam), tamanho, cores possíveis e se dá para "virar"
  const TYPES = {
    sol: { zone: 'sky', size: [1.1, 1.4], c1: ['amarelo', 'laranja'], c2: ['laranja', 'vermelho'], asym: false },
    nuvem: { zone: 'sky', size: [1.1, 1.5], c1: ['branco', 'cinza'], c2: ['branco'], asym: true },
    passaro: { zone: 'sky', size: [0.7, 1], c1: ['azul', 'vermelho', 'amarelo', 'roxo'], c2: ['laranja', 'amarelo', 'branco'], asym: true },
    balao: { zone: 'sky', size: [0.8, 1.1], c1: ['vermelho', 'azul', 'amarelo', 'rosa', 'roxo', 'verde'], c2: ['branco'], asym: false },
    pipa: { zone: 'sky', size: [0.9, 1.2], c1: ['vermelho', 'azul', 'verde', 'roxo'], c2: ['amarelo', 'laranja', 'branco'], asym: true },
    borboleta: { zone: 'sky', size: [0.7, 1], c1: ['roxo', 'laranja', 'azul', 'rosa'], c2: ['amarelo', 'branco', 'ciano'], asym: false },
    arvore: { zone: 'ground', size: [1.4, 1.9], c1: ['verde', 'verdeEsc'], c2: ['vermelho', 'laranja', 'amarelo'], asym: true },
    casa: { zone: 'ground', size: [1.5, 1.9], c1: ['creme', 'amarelo', 'cinza', 'rosa'], c2: ['vermelho', 'marrom', 'azul'], asym: true },
    flor: { zone: 'ground', size: [0.7, 1], c1: ['rosa', 'vermelho', 'roxo', 'azul', 'laranja'], c2: ['amarelo', 'branco'], asym: false },
    cogumelo: { zone: 'ground', size: [0.7, 1], c1: ['vermelho', 'laranja', 'marrom'], c2: ['branco', 'amarelo'], asym: false },
    peixe: { zone: 'water', size: [0.8, 1.2], c1: ['laranja', 'amarelo', 'azul', 'rosa', 'vermelho'], c2: ['branco', 'azul', 'roxo'], asym: true },
    agua_viva: { zone: 'water', size: [0.8, 1.1], c1: ['rosa', 'roxo', 'ciano'], c2: ['branco', 'rosa'], asym: false },
    tartaruga: { zone: 'water', size: [1, 1.3], c1: ['verde', 'verdeEsc'], c2: ['marrom', 'amarelo'], asym: true },
    bolhas: { zone: 'water', size: [0.7, 1], c1: ['branco', 'ciano'], c2: ['branco'], asym: true },
    estrela_mar: { zone: 'floor', size: [0.7, 1], c1: ['laranja', 'vermelho', 'rosa', 'amarelo'], c2: ['amarelo', 'branco'], asym: false },
    concha: { zone: 'floor', size: [0.7, 0.9], c1: ['rosa', 'creme', 'laranja'], c2: ['branco', 'rosa'], asym: false },
    alga: { zone: 'floor', size: [1, 1.4], c1: ['verde', 'verdeEsc'], c2: ['verde'], asym: true },
    caranguejo: { zone: 'floor', size: [0.8, 1], c1: ['vermelho', 'laranja'], c2: ['branco'], asym: false },
    planeta: { zone: 'space', size: [1, 1.5], c1: ['azul', 'verde', 'vermelho', 'laranja', 'roxo'], c2: ['branco', 'amarelo', 'ciano'], asym: false },
    saturno: { zone: 'space', size: [1.1, 1.5], c1: ['amarelo', 'laranja', 'rosa'], c2: ['marrom', 'roxo', 'branco'], asym: true },
    estrela: { zone: 'space', size: [0.6, 0.9], c1: ['amarelo', 'branco', 'laranja'], c2: ['amarelo'], asym: false },
    foguete: { zone: 'space', size: [1, 1.3], c1: ['branco', 'cinza'], c2: ['vermelho', 'azul', 'laranja'], asym: true },
    lua: { zone: 'space', size: [0.9, 1.3], c1: ['amarelo', 'branco', 'creme'], c2: ['amarelo'], asym: true },
    disco: { zone: 'space', size: [0.9, 1.2], c1: ['cinza', 'roxo', 'verde'], c2: ['ciano', 'amarelo', 'rosa'], asym: false },
    cometa: { zone: 'space', size: [0.8, 1.1], c1: ['amarelo', 'ciano', 'branco'], c2: ['laranja', 'azul'], asym: true },
    et: { zone: 'space', size: [0.8, 1.1], c1: ['verde', 'roxo', 'ciano'], c2: ['amarelo', 'branco'], asym: false },
  };

  const THEMES = {
    parque: { name: 'Parque', zones: { sky: [28, 150], ground: [195, 272] } },
    mar: { name: 'Fundo do mar', zones: { water: [30, 215], floor: [246, 280] } },
    espaco: { name: 'Espaço', zones: { space: [28, 272] } },
  };
  const typesOf = (theme) => Object.keys(TYPES).filter((t) => THEMES[theme].zones[TYPES[t].zone]);

  const radius = (o) => BASE * o.s;
  // figuras maiores nas cenas com poucas figuras; menores nas sutis
  const scaleOf = (level) => (level.subtle ? 0.8 : level.objects <= 8 ? 1.25 : level.objects <= 10 ? 1.1 : 1);

  // longe de todas (as sumidas também: o lugar delas continua ocupado do outro lado)
  function free(objs, x, y, r, skip = -1) {
    return objs.every((o, i) => i === skip || Math.hypot(o.x - x, o.y - y) > (radius(o) + r) * 0.98 + 4);
  }

  function makeObject(rng, theme, objs, type, shrink) {
    const t = TYPES[type];
    const [y0, y1] = THEMES[theme].zones[t.zone];
    for (let tries = 0; tries < 160; tries++) {
      const s = Math.round((t.size[0] + rng() * (t.size[1] - t.size[0])) * shrink * 100) / 100;
      const r = BASE * s;
      const x = Math.round(r + 6 + rng() * (W - 2 * r - 12));
      const y = Math.round(Math.max(y0, r + 4) + rng() * Math.max(0, Math.min(y1, H - r - 4) - Math.max(y0, r + 4)));
      if (!free(objs, x, y, r)) continue;
      return { type, x, y, s, flip: rng() < 0.5, c1: rng.pick(t.c1), c2: rng.pick(t.c2) };
    }
    return null;
  }

  // a cena: o cenário, as figuras da esquerda, as da direita e as diferenças
  function makeScene(level, seed) {
    const rng = Rng.rng(seed);
    const theme = level.theme === 'mix' ? rng.pick(Object.keys(THEMES)) : level.theme;
    const kinds = typesOf(theme);
    const shrink = scaleOf(level);
    for (let attempt = 0; attempt < 30; attempt++) {
      const left = [];
      const bag = rng.shuffle(kinds.concat(kinds));
      for (let i = 0; left.length < level.objects && i < bag.length * 2; i++) {
        const o = makeObject(rng, theme, left, bag[i % bag.length], shrink);
        if (o) left.push(o);
      }
      if (left.length < level.objects) continue;
      const right = left.map((o) => ({ ...o }));
      const diffs = [];
      // cada tipo de diferença, na vez dele, procura uma figura que sirva (nem toda figura dá para virar)
      const pool = rng.shuffle(left.map((_, i) => i));
      for (let k = 0; diffs.length < level.diffs && k < level.diffs * 4; k++) {
        const kind = level.kinds[k % level.kinds.length];
        for (let j = 0; j < pool.length; j++) {
          const d = applyDiff(rng, theme, kind, pool[j], left, right, level);
          if (!d) continue;
          diffs.push(d);
          if (kind !== 'extra') pool.splice(j, 1);
          break;
        }
      }
      if (diffs.length < level.diffs) continue;
      return { theme, left, right, diffs };
    }
    throw new Error('não consegui montar a cena');
  }

  function otherColor(rng, list, current, subtle) {
    if (subtle) return { name: current, near: true };
    const others = list.filter((c) => c !== current);
    const all = Object.keys(COLORS).filter((c) => c !== current && c !== 'branco');
    return { name: rng.pick(others.length ? others : all), near: false };
  }

  function applyDiff(rng, theme, kind, idx, left, right, level) {
    const o = left[idx];
    const t = TYPES[o.type];
    const r = radius(o);
    const circle = (x, y, rr) => [Math.round(x), Math.round(y), Math.round(rr + 8)];
    if (kind === 'color' || kind === 'color2') {
      const key = kind === 'color' ? 'c1' : 'c2';
      const list = t[key];
      if (kind === 'color2' && list.length < 2 && !level.subtle) return null;
      const c = otherColor(rng, list, o[key], level.subtle);
      right[idx][key] = c.name;
      right[idx][`${key}near`] = c.near;
      return { kind, circles: [circle(o.x, o.y, r)] };
    }
    if (kind === 'missing') { right[idx].gone = true; return { kind, circles: [circle(o.x, o.y, r)] }; }
    if (kind === 'flip') {
      if (!t.asym) return null;
      right[idx].flip = !o.flip;
      return { kind, circles: [circle(o.x, o.y, r)] };
    }
    if (kind === 'size') {
      const f = level.subtle ? rng.pick([0.78, 1.25]) : rng.pick([0.62, 1.45]);
      const s = Math.round(o.s * f * 100) / 100;
      const others = right.filter((_, i) => i !== idx);
      if (!free(others, o.x, o.y, BASE * s)) return null;
      right[idx].s = s;
      return { kind, circles: [circle(o.x, o.y, Math.max(r, BASE * s))] };
    }
    if (kind === 'move') {
      const dist = level.subtle ? 22 : 40;
      const [y0, y1] = THEMES[theme].zones[t.zone];
      for (let tries = 0; tries < 12; tries++) {
        const a = rng() * Math.PI * 2;
        const x = Math.round(o.x + Math.cos(a) * (dist + r * 0.6));
        const y = Math.round(o.y + Math.sin(a) * (dist + r * 0.6) * 0.6);
        if (x < r + 4 || x > W - r - 4 || y < Math.max(y0, r + 4) || y > Math.min(y1, H - r - 4)) continue;
        if (!free(right, x, y, r, idx) || !free(left, x, y, r, idx)) continue;
        right[idx].x = x;
        right[idx].y = y;
        return { kind, circles: [circle(o.x, o.y, r), circle(x, y, r)] };
      }
      return null;
    }
    if (kind === 'extra') {
      const n = makeObject(rng, theme, left.concat(right), rng.pick(typesOf(theme)), scaleOf(level));
      if (!n) return null;
      right.push(n);
      // a figura nova também entra na esquerda como "sumida", para não ocupar o lugar de outra
      left.push({ ...n, gone: true });
      return { kind, circles: [circle(n.x, n.y, radius(n))] };
    }
    return null;
  }

  // refaz os toques: cada um acha uma diferença ainda não achada, ou é um erro
  function hit(scene, found, x, y) {
    return scene.diffs.findIndex((d, i) => !found[i] && d.circles.some(([cx, cy, r]) => Math.hypot(cx - x, cy - y) <= r));
  }
  function replay(scene, clicks) {
    if (!Array.isArray(clicks) || clicks.length > 400) return { ok: false };
    const found = scene.diffs.map(() => false);
    let errors = 0;
    for (const c of clicks) {
      if (!Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return { ok: false };
      const i = hit(scene, found, c[0], c[1]);
      if (i >= 0) found[i] = true; else errors++;
      if (found.every(Boolean)) return { ok: true, done: true, errors, clicks: clicks.length };
    }
    return { ok: true, done: false, errors, clicks: clicks.length };
  }

  // ---------- o desenho (só no navegador) ----------
  const col = (o, key) => (o[`${key}near`] ? COLORS[o[key]][1] : hex(o[key]));
  const INK = '#2B1D57';
  const DRAW = {
    sol: (o) => `${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k * Math.PI) / 4; return `<line x1="${(Math.cos(a) * 15).toFixed(1)}" y1="${(Math.sin(a) * 15).toFixed(1)}" x2="${(Math.cos(a) * 21).toFixed(1)}" y2="${(Math.sin(a) * 21).toFixed(1)}" stroke="${col(o, 'c2')}" stroke-width="3.5" stroke-linecap="round"/>`; }).join('')}<circle r="13" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><circle cx="-4" cy="-2" r="1.6" fill="${INK}"/><circle cx="4" cy="-2" r="1.6" fill="${INK}"/><path d="M-5 4 Q0 8 5 4" fill="none" stroke="${INK}" stroke-width="1.6"/>`,
    nuvem: (o) => `<g fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.6"><circle cx="-10" cy="4" r="9"/><circle cx="2" cy="-3" r="12"/><circle cx="13" cy="5" r="8"/></g><rect x="-14" y="3" width="30" height="10" fill="${col(o, 'c1')}"/>`,
    passaro: (o) => `<ellipse cx="0" cy="2" rx="14" ry="10" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M-4 0 Q2 -14 10 -2 Z" fill="${col(o, 'c2')}" stroke="${INK}" stroke-width="1.6"/><path d="M13 0 L21 3 L13 6 Z" fill="#FB8C00" stroke="${INK}" stroke-width="1.4"/><circle cx="8" cy="-2" r="2" fill="${INK}"/><path d="M-14 2 L-21 -3 L-20 7 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.4"/>`,
    balao: (o) => `<path d="M0 12 Q-3 20 2 26" fill="none" stroke="${INK}" stroke-width="1.4"/><ellipse cx="0" cy="-4" rx="13" ry="16" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><ellipse cx="-5" cy="-10" rx="3" ry="5" fill="${col(o, 'c2')}" opacity=".7"/><path d="M-3 12 L3 12 L0 15 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.2"/>`,
    pipa: (o) => `<path d="M0 -20 L14 -2 L0 18 L-14 -2 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M0 -20 L14 -2 L0 -2 Z M0 18 L-14 -2 L0 -2 Z" fill="${col(o, 'c2')}"/><path d="M0 18 Q8 26 2 32 Q-6 38 4 44" fill="none" stroke="${INK}" stroke-width="1.4"/><path d="M5 28 l5 -3 l0 6 z M-1 38 l5 -3 l0 6 z" fill="${col(o, 'c2')}" stroke="${INK}" stroke-width="1"/>`,
    borboleta: (o) => `<g stroke="${INK}" stroke-width="1.6"><ellipse cx="-9" cy="-6" rx="9" ry="10" fill="${col(o, 'c1')}"/><ellipse cx="9" cy="-6" rx="9" ry="10" fill="${col(o, 'c1')}"/><ellipse cx="-7" cy="9" rx="6" ry="7" fill="${col(o, 'c1')}"/><ellipse cx="7" cy="9" rx="6" ry="7" fill="${col(o, 'c1')}"/></g><circle cx="-9" cy="-6" r="3.5" fill="${col(o, 'c2')}"/><circle cx="9" cy="-6" r="3.5" fill="${col(o, 'c2')}"/><rect x="-2" y="-12" width="4" height="26" rx="2" fill="${INK}"/><path d="M-1 -12 L-6 -19 M1 -12 L6 -19" stroke="${INK}" stroke-width="1.4"/>`,
    arvore: (o) => `<rect x="-4" y="4" width="8" height="18" fill="#8D6E63" stroke="${INK}" stroke-width="1.6"/><g fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.6"><circle cx="-8" cy="-2" r="10"/><circle cx="8" cy="-3" r="10"/><circle cx="0" cy="-12" r="11"/></g><circle cx="-6" cy="-6" r="2.4" fill="${col(o, 'c2')}"/><circle cx="7" cy="-1" r="2.4" fill="${col(o, 'c2')}"/><circle cx="2" cy="-14" r="2.4" fill="${col(o, 'c2')}"/>`,
    casa: (o) => `<rect x="-15" y="-4" width="30" height="24" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M-19 -3 L0 -20 L19 -3 Z" fill="${col(o, 'c2')}" stroke="${INK}" stroke-width="2"/><rect x="-10" y="6" width="8" height="14" fill="#8D6E63" stroke="${INK}" stroke-width="1.4"/><rect x="3" y="3" width="8" height="8" fill="#81D4FA" stroke="${INK}" stroke-width="1.4"/><rect x="7" y="-17" width="5" height="8" fill="#8D6E63" stroke="${INK}" stroke-width="1.4"/>`,
    flor: (o) => `<path d="M0 6 L0 22" stroke="#2E7D32" stroke-width="3"/><path d="M0 16 Q8 10 10 16 Q4 20 0 16" fill="#43A047"/>${[0, 1, 2, 3, 4].map((k) => { const a = (k * 2 * Math.PI) / 5 - Math.PI / 2; return `<circle cx="${(Math.cos(a) * 8).toFixed(1)}" cy="${(Math.sin(a) * 8 - 4).toFixed(1)}" r="6" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.4"/>`; }).join('')}<circle cx="0" cy="-4" r="4.5" fill="${col(o, 'c2')}" stroke="${INK}" stroke-width="1.4"/>`,
    cogumelo: (o) => `<rect x="-6" y="0" width="12" height="16" rx="4" fill="#FFF3D6" stroke="${INK}" stroke-width="1.6"/><path d="M-18 2 Q-18 -18 0 -18 Q18 -18 18 2 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><circle cx="-8" cy="-7" r="3" fill="${col(o, 'c2')}"/><circle cx="5" cy="-11" r="3.4" fill="${col(o, 'c2')}"/><circle cx="10" cy="-3" r="2.4" fill="${col(o, 'c2')}"/>`,
    peixe: (o) => `<path d="M-12 0 L-22 -9 L-22 9 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.6"/><ellipse cx="2" cy="0" rx="16" ry="11" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M-2 -10 Q1 0 -2 10" fill="none" stroke="${col(o, 'c2')}" stroke-width="3.5"/><circle cx="10" cy="-3" r="2.4" fill="${INK}"/>`,
    agua_viva: (o) => `<path d="M-14 4 Q-14 -16 0 -16 Q14 -16 14 4 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/>${[-9, -3, 3, 9].map((x) => `<path d="M${x} 4 q3 6 0 10 q-3 5 0 9" fill="none" stroke="${col(o, 'c1')}" stroke-width="2.4"/>`).join('')}<circle cx="-5" cy="-5" r="2" fill="${col(o, 'c2')}"/><circle cx="5" cy="-5" r="2" fill="${col(o, 'c2')}"/>`,
    tartaruga: (o) => `<ellipse cx="17" cy="0" rx="6" ry="5" fill="#9CCC65" stroke="${INK}" stroke-width="1.4"/><ellipse cx="-10" cy="10" rx="5" ry="3" fill="#9CCC65" stroke="${INK}" stroke-width="1.2"/><ellipse cx="10" cy="10" rx="5" ry="3" fill="#9CCC65" stroke="${INK}" stroke-width="1.2"/><ellipse cx="0" cy="0" rx="15" ry="11" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M-6 -6 L6 -6 L9 2 L0 7 L-9 2 Z" fill="${col(o, 'c2')}" opacity=".85"/><circle cx="19" cy="-1" r="1.4" fill="${INK}"/>`,
    bolhas: (o) => `<g fill="${col(o, 'c1')}" fill-opacity=".45" stroke="${INK}" stroke-width="1.4"><circle cx="-6" cy="8" r="8"/><circle cx="7" cy="-4" r="6"/><circle cx="-2" cy="-14" r="4"/></g>`,
    estrela_mar: (o) => `<path d="${star(5, 16, 7)}" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle r="2.4" fill="${col(o, 'c2')}"/>`,
    concha: (o) => `<path d="M0 12 L-14 -4 Q0 -20 14 -4 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M0 12 L-7 -10 M0 12 L0 -13 M0 12 L7 -10" stroke="${col(o, 'c2')}" stroke-width="1.6"/><rect x="-5" y="10" width="10" height="5" rx="2" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.4"/>`,
    alga: (o) => `<path d="M-6 22 Q-14 8 -5 -2 Q2 -12 -4 -22" fill="none" stroke="${col(o, 'c1')}" stroke-width="5" stroke-linecap="round"/><path d="M5 22 Q12 10 5 0 Q0 -8 6 -14" fill="none" stroke="${col(o, 'c1')}" stroke-width="4" stroke-linecap="round"/>`,
    caranguejo: (o) => `<path d="M-14 4 L-20 12 M-10 8 L-14 16 M14 4 L20 12 M10 8 L14 16" stroke="${INK}" stroke-width="2"/><circle cx="-19" cy="-8" r="6" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.6"/><circle cx="19" cy="-8" r="6" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.6"/><ellipse cx="0" cy="2" rx="15" ry="10" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M-5 -7 L-5 -13 M5 -7 L5 -13" stroke="${INK}" stroke-width="1.6"/><circle cx="-5" cy="-14" r="3" fill="${col(o, 'c2')}" stroke="${INK}" stroke-width="1.2"/><circle cx="5" cy="-14" r="3" fill="${col(o, 'c2')}" stroke="${INK}" stroke-width="1.2"/>`,
    planeta: (o) => `<circle r="17" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M-16 -4 Q0 2 16 -4 L15 3 Q0 9 -15 3 Z" fill="${col(o, 'c2')}" opacity=".75"/><circle cx="-7" cy="-9" r="3" fill="#fff" opacity=".35"/>`,
    saturno: (o) => `<ellipse rx="25" ry="7" fill="none" stroke="${col(o, 'c2')}" stroke-width="4" transform="rotate(-18)"/><circle r="13" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M-12 -3 A25 7 -18 0 0 12 -6" fill="none" stroke="${col(o, 'c2')}" stroke-width="4" transform="rotate(-6)"/>`,
    estrela: (o) => `<path d="${star(5, 17, 7)}" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
    foguete: (o) => `<g transform="rotate(30)"><path d="M0 -22 Q11 -10 9 12 L-9 12 Q-11 -10 0 -22 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><path d="M-9 4 L-15 16 L-8 12 Z M9 4 L15 16 L8 12 Z" fill="${col(o, 'c2')}" stroke="${INK}" stroke-width="1.6"/><circle cy="-6" r="5" fill="#81D4FA" stroke="${INK}" stroke-width="1.6"/><path d="M-5 12 L0 22 L5 12 Z" fill="#FB8C00"/></g>`,
    lua: (o) => `<path d="M5 -16 A17 17 0 1 0 5 16 A19 19 0 0 1 5 -16 Z" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><circle cx="-6" cy="-3" r="2" fill="${INK}" opacity=".3"/>`,
    disco: (o) => `<ellipse cy="-4" rx="9" ry="9" fill="${col(o, 'c2')}" fill-opacity=".8" stroke="${INK}" stroke-width="1.6"/><ellipse cy="3" rx="21" ry="7" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><circle cx="-12" cy="4" r="2" fill="#FDD835"/><circle cx="0" cy="6" r="2" fill="#FDD835"/><circle cx="12" cy="4" r="2" fill="#FDD835"/>`,
    cometa: (o) => `<path d="M-6 -4 L-26 -14 L-8 2 L-24 6 L-4 6 Z" fill="${col(o, 'c2')}" opacity=".8"/><circle cx="2" cy="2" r="9" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/>`,
    et: (o) => `<path d="M-6 -14 L-10 -22 M6 -14 L10 -22" stroke="${INK}" stroke-width="1.6"/><circle cx="-10" cy="-22" r="2.6" fill="${col(o, 'c2')}"/><circle cx="10" cy="-22" r="2.6" fill="${col(o, 'c2')}"/><ellipse cy="0" rx="15" ry="16" fill="${col(o, 'c1')}" stroke="${INK}" stroke-width="2"/><ellipse cx="-6" cy="-3" rx="4" ry="5" fill="#fff" stroke="${INK}" stroke-width="1.2"/><ellipse cx="6" cy="-3" rx="4" ry="5" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="-6" cy="-2" r="2" fill="${INK}"/><circle cx="6" cy="-2" r="2" fill="${INK}"/><path d="M-5 8 Q0 11 5 8" fill="none" stroke="${INK}" stroke-width="1.6"/>`,
  };
  function star(n, R, r) {
    let d = '';
    for (let k = 0; k < n * 2; k++) {
      const a = (k * Math.PI) / n - Math.PI / 2;
      const rr = k % 2 ? r : R;
      d += `${k ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
    }
    return `${d}Z`;
  }

  const BACKGROUND = {
    parque: `<rect width="${W}" height="${H}" fill="#BDE7FF"/><path d="M0 178 Q100 150 200 175 T400 170 L400 300 L0 300 Z" fill="#9BD77C"/><rect y="186" width="${W}" height="${H - 186}" fill="#8BCF6A"/>`,
    mar: `<defs><linearGradient id="dfSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FD3F7"/><stop offset="1" stop-color="#1E7FC4"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#dfSea)"/><path d="M0 240 Q100 228 200 240 T400 236 L400 300 L0 300 Z" fill="#F2D492"/>`,
    espaco: `<rect width="${W}" height="${H}" fill="#1B1446"/>${[[30, 40], [90, 120], [150, 30], [220, 90], [300, 50], [360, 130], [60, 220], [180, 250], [260, 200], [340, 260], [120, 180], [380, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff" opacity=".8"/>`).join('')}`,
  };

  function svg(scene, side) {
    const objs = (side === 'right' ? scene.right : scene.left).filter((o) => !o.gone).slice().sort((a, b) => a.y - b.y);
    const body = objs.map((o) => `<g transform="translate(${o.x} ${o.y}) scale(${(o.flip ? -o.s : o.s).toFixed(2)} ${o.s.toFixed(2)})">${DRAW[o.type](o)}</g>`).join('');
    return `${BACKGROUND[scene.theme]}${body}`;
  }

  const api = { W, H, TYPES, THEMES, COLORS, makeScene, hit, replay, svg };
  if (isNode) module.exports = api;
  else root.DiffScene = api;
})(typeof window !== 'undefined' ? window : globalThis);
