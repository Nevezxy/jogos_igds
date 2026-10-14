// public/games/memoria/cards.js
// As cartas do 🃏 Jogo da Memória, com semente: o navegador monta a mesa e
// o servidor refaz a mesma mesa para conferir. Também tem a regra de
// "refazer a partida" a partir das cartas viradas (replay), usada pelos dois.
//   carta: { pair, face: { t: 'emoji' | 'text' | 'count', v, n? } }

(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('../../js/shared/rng.js') : root.SeededRng;

  const THEMES = {
    bichos: ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐸', '🐵', '🦁', '🐷', '🐮', '🐔', '🐢', '🐟', '🦋', '🐘'],
    frutas: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🥥', '🥭', '🍈', '🫐'],
    transportes: ['🚗', '🚕', '🚌', '🚑', '🚒', '🚓', '🚜', '🚲', '🛵', '✈️', '🚁', '🚀', '⛵', '🚂', '🚢', '🛴'],
  };
  THEMES.tudo = [...THEMES.bichos, ...THEMES.frutas, ...THEMES.transportes];
  const COUNT_EMOJI = ['🍎', '⭐', '🐟', '🌸', '🎈', '🍪', '🐞', '⚽'];
  const WORDS = [
    ['GATO', '🐱'], ['PATO', '🦆'], ['BOLA', '⚽'], ['CASA', '🏠'], ['SOL', '☀️'], ['LUA', '🌙'], ['MÃO', '✋'], ['PÉ', '🦶'],
    ['UVA', '🍇'], ['RATO', '🐭'], ['SAPO', '🐸'], ['VACA', '🐮'], ['PEIXE', '🐟'], ['FLOR', '🌸'], ['BOLO', '🎂'], ['LEÃO', '🦁'],
    ['CARRO', '🚗'], ['ÁRVORE', '🌳'], ['BANANA', '🍌'], ['ABACAXI', '🍍'], ['CACHORRO', '🐶'], ['BORBOLETA', '🦋'],
    ['TARTARUGA', '🐢'], ['GIRAFA', '🦒'], ['ELEFANTE', '🐘'], ['FOGUETE', '🚀'], ['BICICLETA', '🚲'], ['MORANGO', '🍓'],
    ['CAVALO', '🐴'], ['ESTRELA', '⭐'], ['CORAÇÃO', '❤️'], ['TELEFONE', '📞'], ['GUARDA-CHUVA', '☂️'], ['PINGUIM', '🐧'],
  ];

  function calcPairs(r, kind, n) {
    const out = [];
    const used = new Set();
    let guard = 0;
    while (out.length < n && guard++ < 5000) {
      let a; let b; let text; let value;
      if (kind === 'mul') {
        a = r.int(2, 9); b = r.int(2, 9); text = `${a} × ${b}`; value = a * b;
      } else if (kind === 'addsub10' && r() < 0.5) {
        a = r.int(2, 10); b = r.int(1, a); text = `${a} − ${b}`; value = a - b;
      } else {
        a = r.int(1, 9); b = r.int(1, 10 - a); text = `${a} + ${b}`; value = a + b;
      }
      // cada resultado aparece uma vez só (senão a mesa teria dois pares iguais)
      if (used.has(value)) continue;
      used.add(value);
      out.push([{ t: 'text', v: text, small: true }, { t: 'text', v: String(value) }]);
    }
    return out;
  }

  // os pares da fase: [faceA, faceB]
  function pairsFor(level, r) {
    const n = level.pairs;
    switch (level.kind) {
      case 'same': return r.shuffle(THEMES[level.theme]).slice(0, n).map((e) => [{ t: 'emoji', v: e }, { t: 'emoji', v: e }]);
      case 'count': {
        const nums = r.shuffle(Array.from({ length: level.max }, (_, i) => i + 1)).slice(0, n);
        return nums.map((k) => [{ t: 'text', v: String(k) }, { t: 'count', v: r.pick(COUNT_EMOJI), n: k }]);
      }
      case 'case': return r.shuffle([...level.letters]).slice(0, n).map((L) => [{ t: 'text', v: L }, { t: 'text', v: L.toLowerCase() }]);
      case 'word': {
        const pool = WORDS.filter(([w]) => (level.len === 'short' ? w.length <= 4 : level.len === 'long' ? w.length >= 6 : true));
        return r.shuffle(pool).slice(0, n).map(([w, e]) => [{ t: 'text', v: w, small: w.length > 5 }, { t: 'emoji', v: e }]);
      }
      case 'calc': return calcPairs(r, level.calc, n);
      default: throw new Error(`tipo desconhecido: ${level.kind}`);
    }
  }

  function makeDeck(level, seed) {
    const r = R.rng(seed);
    const cards = [];
    pairsFor(level, r).forEach(([a, b], pair) => { cards.push({ pair, face: a }); cards.push({ pair, face: b }); });
    return r.shuffle(cards);
  }

  // Refaz a partida a partir das cartas viradas, de duas em duas.
  // Devolve { ok, tries, matched, pairsBy: [jogador0, jogador1] } ou { ok: false }.
  // Contra o robô: quem acha o par joga de novo; quem erra passa a vez.
  function replay(deck, flips, { versus = false } = {}) {
    if (!Array.isArray(flips) || flips.length % 2 || flips.length > deck.length * 40) return { ok: false };
    const matched = new Set();
    const pairsBy = [0, 0];
    let turn = 0;
    let tries = 0;
    for (let i = 0; i < flips.length; i += 2) {
      const a = flips[i];
      const b = flips[i + 1];
      if (![a, b].every((x) => Number.isInteger(x) && x >= 0 && x < deck.length) || a === b || matched.has(a) || matched.has(b)) return { ok: false };
      tries++;
      if (deck[a].pair === deck[b].pair) {
        matched.add(a); matched.add(b);
        pairsBy[turn]++;
      } else if (versus) {
        turn = 1 - turn;
      }
    }
    return { ok: true, tries, matched: matched.size, done: matched.size === deck.length, pairsBy, turn };
  }

  // Colunas da mesa para n cartas (o mais perto de um quadrado, mais larga que alta)
  function columnsFor(n) {
    const options = { 6: 3, 8: 4, 12: 4, 16: 4, 20: 5, 24: 6 };
    return options[n] || Math.ceil(Math.sqrt(n));
  }

  const api = { makeDeck, replay, columnsFor, THEMES, WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MemoriaCards = api;
})(typeof window !== 'undefined' ? window : globalThis);
