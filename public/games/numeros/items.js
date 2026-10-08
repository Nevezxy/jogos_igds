// public/games/numeros/items.js
// O que cai em cada fase do 🔢 Números Cadentes, gerado com semente: a mesma
// semente dá sempre a mesma lista (o servidor refaz e confere). As contas
// vêm do gerador do Conta Comigo (matematica/problems.js).
//
// Cada peça: { kind: 'calc' | 'dice' | 'domino', text, answer, faces? }
//   text    a conta como aparece ("7 × 8", "√49", "−5 + 3")
//   faces   pontinhos dos dados ([3] ou [2, 5]) ou do dominó ([4, 1])

(function (root) {
  const P = typeof module !== 'undefined' && module.exports
    ? require('../matematica/problems.js')
    : root.ContaProblems;

  const intIn = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

  function dice(r, gen) {
    if (gen.t === 'diceMix') return r() < 0.5 ? dice(r, { t: 'dice', n: intIn(r, 1, 2) }) : dice(r, { t: 'domino' });
    if (gen.t === 'domino') {
      const faces = [intIn(r, 0, 6), intIn(r, 0, 6)];
      return { kind: 'domino', faces, answer: faces[0] + faces[1], text: `${faces[0]}|${faces[1]}` };
    }
    const faces = Array.from({ length: gen.n }, () => intIn(r, 1, 6));
    return { kind: 'dice', faces, answer: faces.reduce((a, b) => a + b, 0), text: faces.join('+') };
  }

  function makeItems(level, seed) {
    const g = level.gen;
    if (g.t !== 'calc') {
      const r = P.rng(seed);
      const out = [];
      let guard = 0;
      while (out.length < level.count) {
        const it = dice(r, g);
        // não repete a mesma peça duas vezes seguidas
        if (out.length && out[out.length - 1].text === it.text && guard++ < 100) continue;
        out.push(it);
      }
      return out;
    }
    // contas: mesma rodada do Conta Comigo para uma fase com esse gerador
    const pseudo = { id: level.id, gen: g.gen, count: level.count, maxAbs: level.maxAbs };
    return P.makeRound(pseudo, seed).map((p) => ({ kind: 'calc', text: P.describe(p), answer: p.answer, key: p.key }));
  }

  const api = { makeItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NumerosItems = api;
})(typeof window !== 'undefined' ? window : globalThis);
