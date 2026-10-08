// public/games/letras/items.js
// O que cai em cada fase do 🔤 Letras Cadentes, gerado com semente: a mesma
// semente dá sempre a mesma lista. O navegador usa para jogar e o servidor
// para refazer a lista e conferir o resultado. As palavras vêm do banco do
// Teclado Mágico (digitacao/content.js).

(function (root) {
  const Content = typeof module !== 'undefined' && module.exports
    ? require('../digitacao/content.js')
    : root.DigitacaoContent;

  const ACCENTED = /[áéíóúãõâêôàü]/;

  function rng(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const choose = (r, list) => list[Math.floor(r() * list.length)];

  const LISTS = () => ({ ...Content.LISTS, syllables: Content.SYLLABLES });

  // Todas as peças possíveis de um conteúdo (cacheado).
  const POOLS = new Map();
  function pool(gen) {
    const key = JSON.stringify(gen);
    if (POOLS.has(key)) return POOLS.get(key);
    let out;
    switch (gen.t) {
      case 'chars': out = [...gen.chars]; break;
      case 'list':
        out = gen.items ? gen.items.slice() : LISTS()[gen.list].slice();
        // sem acento (e sem ç) antes do mundo dos acentos; `single`: sem nomes compostos
        if (gen.accents === 'none') out = out.filter((w) => !ACCENTED.test(w.toLowerCase()) && !w.toLowerCase().includes('ç'));
        if (gen.single) out = out.filter((w) => !w.includes(' '));
        break;
      case 'words': {
        out = Content.WORD_BANK.filter((w) => {
          if (gen.letters && ![...w].every((ch) => gen.letters.includes(ch))) return false;
          if (gen.min && w.length < gen.min) return false;
          if (gen.max && w.length > gen.max) return false;
          if (gen.accents === 'none' && (ACCENTED.test(w) || w.includes('ç'))) return false;
          if (gen.accents === 'need' && ![...gen.acc].some((ch) => w.includes(ch))) return false;
          if (gen.accents === 'need' && [...w].some((ch) => (ACCENTED.test(ch) || ch === 'ç') && !gen.acc.includes(ch))) return false;
          if (gen.has && !gen.has.some((h) => w.includes(h))) return false;
          return true;
        });
        if (gen.upper === 'all') out = out.map((w) => w.toLocaleUpperCase('pt-BR'));
        if (gen.upper === 'first') out = out.map((w) => w[0].toLocaleUpperCase('pt-BR') + w.slice(1));
        break;
      }
      case 'two': out = null; break; // sorteado na hora (combinações demais)
      case 'mix': out = null; break;
      default: throw new Error(`conteúdo desconhecido: ${gen.t}`);
    }
    POOLS.set(key, out);
    return out;
  }

  const SHORT = () => pool({ t: 'words', min: 3, max: 6, accents: 'none' });
  function one(gen, r) {
    if (gen.t === 'mix') return one(choose(r, gen.of), r);
    if (gen.t === 'two') {
      const words = SHORT();
      return `${choose(r, words)} ${choose(r, words)}`;
    }
    return choose(r, pool(gen));
  }

  // `count` peças, sem a mesma peça duas vezes seguidas (nem três
  // começando com a mesma letra, para o alvo não ficar confuso).
  function makeItems(level, seed) {
    const r = rng(seed);
    const out = [];
    let guard = 0;
    while (out.length < level.count) {
      const item = one(level.gen, r);
      const prev = out[out.length - 1];
      const prev2 = out[out.length - 2];
      const sameStart = prev && prev2 && prev[0] === item[0] && prev2[0] === item[0];
      if ((item === prev || sameStart) && guard++ < 200) continue;
      out.push(item);
    }
    return out;
  }

  // Quantas peças diferentes o conteúdo pode ter (usado nos testes).
  function variety(gen) {
    if (gen.t === 'mix') return gen.of.reduce((n, g) => n + variety(g), 0);
    if (gen.t === 'two') return SHORT().length ** 2;
    return pool(gen).length;
  }

  const api = { rng, makeItems, variety, pool };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetrasItems = api;
})(typeof window !== 'undefined' ? window : globalThis);
