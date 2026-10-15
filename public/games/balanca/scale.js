// public/games/balanca\scale.js
// ⚖️ Equilibre a Balança (navegador e servidor): as tarefas de cada fase,
// geradas pela semente, e a conferência. À esquerda fica o objeto; a criança
// põe pesos até a balança ficar reta.
//   tarefa: { object: { emoji, weight }, pieces: [{ id, w }], min }
//     min    o menor número de pesos que equilibra (para as estrelas)
//   modos (da fase)
//     right    pesos só no prato da direita
//     both     pesos nos dois pratos: só dá para equilibrar pondo peso
//              também do lado do objeto (é uma subtração)
//     unknown  o peso do objeto é "?": equilibre e depois diga quanto pesa
//   resposta: { L: [ids], R: [ids], answer? }

(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('../../js/shared/rng.js') : root.SeededRng;

  const OBJECTS = ['🍉', '🎃', '🍍', '🧸', '⚽', '🍞', '📦', '🥥', '🐱', '🐶', '🧀', '🥫', '🍎', '🍌', '🎒', '🪴'];

  // 50 g, 1 kg, 1,5 kg (com `unit`); sem unidade, só o número
  function fmt(w, unit) {
    if (!unit) return String(w);
    if (w < 1000) return `${w} g`;
    const kg = w / 1000;
    return `${String(kg).replace('.', ',')} kg`;
  }

  const sum = (list) => list.reduce((n, p) => n + p.w, 0);

  // o menor número de pesos que equilibra (testa todas as arrumações: poucos pesos)
  function minPieces(object, pieces, mode) {
    let best = Infinity;
    const n = pieces.length;
    const sides = mode === 'both' ? 3 : 2; // 0 = fora, 1 = direita, 2 = esquerda
    const total = sides ** n;
    for (let code = 0; code < total; code++) {
      let c = code;
      let left = object;
      let right = 0;
      let used = 0;
      for (let i = 0; i < n; i++) {
        const s = c % sides;
        c = Math.floor(c / sides);
        if (s === 1) { right += pieces[i].w; used++; } else if (s === 2) { left += pieces[i].w; used++; }
      }
      if (left === right && used < best) best = used;
    }
    return best;
  }
  // dá para equilibrar só com o prato da direita?
  const rightOnly = (object, pieces) => minPieces(object, pieces, 'right') < Infinity;

  function makeTask(level, r) {
    const pal = level.palette;
    for (let guard = 0; guard < 500; guard++) {
      let pieces;
      let object;
      if (level.mode === 'both') {
        const right = Array.from({ length: r.int(1, 3) }, () => r.pick(pal));
        const left = [r.pick(pal)];
        object = right.reduce((a, b) => a + b, 0) - left[0];
        const extra = Array.from({ length: r.int(1, 2) }, () => r.pick(pal));
        pieces = [...right, ...left, ...extra];
        if (object < level.range[0] || object > level.range[1]) continue;
        // tem que precisar de peso no lado do objeto
        if (rightOnly(object, pieces.map((w) => ({ w })))) continue;
      } else {
        const use = Array.from({ length: r.int(2, level.maxUse || 3) }, () => r.pick(pal));
        object = use.reduce((a, b) => a + b, 0);
        if (object < level.range[0] || object > level.range[1]) continue;
        const extra = Array.from({ length: r.int(2, 3) }, () => r.pick(pal));
        pieces = [...use, ...extra];
      }
      const list = r.shuffle(pieces).sort((a, b) => b - a).map((w, id) => ({ id, w }));
      const min = minPieces(object, list, level.mode === 'both' ? 'both' : 'right');
      if (!Number.isFinite(min)) continue;
      return { object: { emoji: r.pick(OBJECTS), weight: object }, pieces: list, min };
    }
    throw new Error(`não consegui gerar a balança de ${level.id}`);
  }

  function makeRound(level, seed) {
    const r = R.rng(seed);
    const out = [];
    const seen = new Set();
    for (let guard = 0; out.length < level.count && guard < 300; guard++) {
      const t = makeTask(level, r);
      if (seen.has(t.object.weight) && guard < 200) continue;
      seen.add(t.object.weight);
      out.push(t);
    }
    // "quanto pesa?": 4 alternativas
    if (level.mode === 'unknown' || level.ask) {
      out.forEach((t) => {
        const w = t.object.weight;
        const step = level.palette.slice().sort((a, b) => a - b)[0];
        const opts = new Set([w]);
        for (const d of r.shuffle([step, step * 2, -step, -step * 2, step * 3])) if (w + d > 0 && opts.size < 4) opts.add(w + d);
        t.options = r.shuffle([...opts]);
      });
    }
    return out;
  }

  // a balança ficou reta com esses pesos? ({ ok, left, right })
  function weigh(task, placed) {
    const L = Array.isArray(placed && placed.L) ? placed.L : [];
    const Rr = Array.isArray(placed && placed.R) ? placed.R : [];
    const ids = [...L, ...Rr];
    if (ids.some((id) => !Number.isInteger(id) || id < 0 || id >= task.pieces.length) || new Set(ids).size !== ids.length) return { ok: false, valid: false };
    const w = (list) => list.reduce((n, id) => n + task.pieces[id].w, 0);
    const left = task.object.weight + w(L);
    const right = w(Rr);
    return { ok: left === right, valid: true, left, right, used: ids.length };
  }

  const api = { makeRound, weigh, minPieces, fmt, OBJECTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BalancaScale = api;
})(typeof window !== 'undefined' ? window : globalThis);
