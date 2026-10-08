// public/games/click/targets.js
// Gera, com semente, a lista de alvos de uma rodada do 🖱️ Click: a ação de
// cada alvo, onde ele nasce (em frações da área, 0 a 1), a direção em que
// anda e, nos de arrastar, o objeto e o destino. O navegador e o servidor
// usam o mesmo gerador: o servidor refaz a rodada pela semente para conferir
// o resultado.

(function (root) {
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  function shuffle(r, list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const FRUITS = ['🍎', '🍐', '🍊', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥕', '🌽', '🥥'];
  const COLORS = [
    { id: 'red', name: 'vermelha', css: '#FF6B6B', items: ['🍎', '🍓', '🍒', '🌹', '🚗'] },
    { id: 'yellow', name: 'amarela', css: '#FFD93D', items: ['🍌', '🍋', '🌻', '⭐', '🐥'] },
    { id: 'blue', name: 'azul', css: '#4D96FF', items: ['🫐', '🐳', '🦋', '💎', '🧢'] },
    { id: 'green', name: 'verde', css: '#6BCB77', items: ['🍏', '🥦', '🐸', '🍀', '🦖'] },
  ];
  const SHAPES = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐸', '🐵', '🦁', '🐷', '🐮', '🐔', '🐢', '🐟', '🦋', '🌵', '⛄', '🚀', '✈️', '🏠', '🎈', '⚽', '🎸', '☂️'];
  // figura escondida no fundo, que aparece a cada acerto
  const PICTURES = [
    { emoji: '🦁', name: 'o leão' }, { emoji: '🐘', name: 'o elefante' }, { emoji: '🦒', name: 'a girafa' },
    { emoji: '🐬', name: 'o golfinho' }, { emoji: '🦄', name: 'o unicórnio' }, { emoji: '🐢', name: 'a tartaruga' },
    { emoji: '🦋', name: 'a borboleta' }, { emoji: '🐙', name: 'o polvo' }, { emoji: '🚀', name: 'o foguete' },
    { emoji: '🏰', name: 'o castelo' }, { emoji: '🌈', name: 'o arco-íris' }, { emoji: '🐼', name: 'o panda' },
    { emoji: '🦖', name: 'o dinossauro' }, { emoji: '🐳', name: 'a baleia' }, { emoji: '🦜', name: 'o papagaio' },
  ];

  // As ações em rodízio embaralhado: todas aparecem e nenhuma domina a rodada.
  function kindSequence(r, kinds, count) {
    const out = [];
    while (out.length < count) {
      let block = shuffle(r, kinds);
      // sem repetir a mesma ação na emenda entre dois blocos
      if (block.length > 1 && block[0] === out[out.length - 1]) block = block.slice(1).concat(block[0]);
      out.push(...block);
    }
    return out.slice(0, count);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round3 = (v) => Math.round(v * 1000) / 1000;

  function makeTargets(level, seed) {
    const r = rng(seed);
    const kinds = kindSequence(r, level.kinds, level.count);
    const drag = level.drag || { mode: 'basket' };
    const colors = COLORS.slice(0, drag.colors || 3);
    let px = 0.2 + r() * 0.6;
    let py = 0.25 + r() * 0.5;
    const targets = kinds.map((kind) => {
      const t = { kind, angle: round3(r() * Math.PI * 2) };
      if (level.path) {
        // trilha: o próximo nasce perto do anterior, sem sair da área
        const a = r() * Math.PI * 2;
        const d = 0.14 + r() * 0.1;
        px = clamp(px + Math.cos(a) * d, 0.06, 0.94);
        py = clamp(py + Math.sin(a) * d * 1.3, 0.08, 0.92);
        t.x = round3(px);
        t.y = round3(py);
      } else if (kind === 'drag') {
        // o objeto nasce em cima; o destino fica embaixo
        t.x = round3(0.1 + r() * 0.8);
        t.y = round3(0.1 + r() * 0.3);
      } else {
        t.x = round3(0.05 + r() * 0.9);
        t.y = round3(0.05 + r() * 0.9);
      }
      if (kind !== 'drag') return t;
      if (drag.mode === 'color') {
        const c = pick(r, colors);
        t.color = c.id;
        t.emoji = pick(r, c.items);
      } else if (drag.mode === 'shadow') {
        const options = shuffle(r, SHAPES).slice(0, 3);
        t.emoji = options[0];
        t.shadows = shuffle(r, options);
      } else {
        t.emoji = pick(r, FRUITS);
        // cesta longe do objeto, na parte de baixo
        t.bx = round3(0.12 + r() * 0.76);
        if (Math.abs(t.bx - t.x) < 0.25) t.bx = round3(t.x < 0.5 ? t.x + 0.3 + r() * 0.15 : t.x - 0.3 - r() * 0.15);
        t.bx = round3(clamp(t.bx, 0.1, 0.9));
        t.by = round3(0.68 + r() * 0.2);
      }
      return t;
    });
    return targets;
  }

  function pictureFor(seed) {
    return PICTURES[(seed >>> 0) % PICTURES.length];
  }

  const api = { makeTargets, pictureFor, kindSequence, COLORS, FRUITS, SHAPES, PICTURES, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickTargets = api;
})(typeof window !== 'undefined' ? window : globalThis);
