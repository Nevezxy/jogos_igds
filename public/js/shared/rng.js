// public/js/shared/rng.js
// Sorteio com semente (mulberry32): a mesma semente dá sempre a mesma
// sequência. O navegador monta a fase e o servidor refaz igualzinho para
// conferir o resultado. Usado pelos jogos de raciocínio (Memória, Hanói,
// Labirinto...).

(function (root) {
  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)); // inclusive
    next.pick = (list) => list[Math.floor(next() * list.length)];
    next.shuffle = (list) => {
      const a2 = list.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    };
    return next;
  }
  function randomSeed() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 0xFFFFFFFF); }
  }

  const api = { rng, randomSeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SeededRng = api;
})(typeof window !== 'undefined' ? window : globalThis);
