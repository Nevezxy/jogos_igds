// public/games/dinheiro/money.js
// 💰 Dinheiro e Troco (navegador e servidor): moedas e cédulas do Real, as
// tarefas de cada fase (geradas pela semente) e a conferência das
// respostas. Tudo em centavos, para não ter erro de conta com vírgula.
//   tarefa: { type, ... }
//     count    "Quanto tem aqui?": pieces (o dinheiro na mesa), options, total
//     pay      "Pague o valor exato": items (o que compra), price
//     fewest   igual a pay, mas com o menor número de notas e moedas
//     change   "Dê o troco": items, price, paid (a nota do cliente), change
//   resposta: count → um valor; os outros → a lista do dinheiro entregue

(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('../../js/shared/rng.js') : root.SeededRng;

  // as notas e moedas (o bicho de cada cédula é o mesmo das de verdade)
  const MONEY = {
    5: { kind: 'coin', label: '5¢', name: '5 centavos', color: 'bronze' },
    10: { kind: 'coin', label: '10¢', name: '10 centavos', color: 'gold' },
    25: { kind: 'coin', label: '25¢', name: '25 centavos', color: 'gold' },
    50: { kind: 'coin', label: '50¢', name: '50 centavos', color: 'silver' },
    100: { kind: 'coin', label: 'R$ 1', name: '1 real', color: 'bimetal' },
    200: { kind: 'note', label: 'R$ 2', name: '2 reais', color: '#4A90D9', animal: '🐢' },
    500: { kind: 'note', label: 'R$ 5', name: '5 reais', color: '#9B6BC8', animal: '🦩' },
    1000: { kind: 'note', label: 'R$ 10', name: '10 reais', color: '#E2574C', animal: '🦜' },
    2000: { kind: 'note', label: 'R$ 20', name: '20 reais', color: '#F2C14E', animal: '🐒' },
    5000: { kind: 'note', label: 'R$ 50', name: '50 reais', color: '#D9893B', animal: '🐆' },
    10000: { kind: 'note', label: 'R$ 100', name: '100 reais', color: '#3BB5C9', animal: '🐟' },
    20000: { kind: 'note', label: 'R$ 200', name: '200 reais', color: '#9AA3AD', animal: '🐺' },
  };
  const ALL = Object.keys(MONEY).map(Number).sort((a, b) => b - a);

  const ITEMS = [
    ['🍎', 'maçã'], ['🍌', 'banana'], ['🧃', 'suco'], ['🥛', 'leite'], ['🍞', 'pão'], ['🍫', 'chocolate'],
    ['✏️', 'lápis'], ['📓', 'caderno'], ['🖍️', 'giz de cera'], ['🎈', 'balão'], ['⚽', 'bola'], ['🧸', 'ursinho'],
    ['🍦', 'sorvete'], ['🧁', 'bolinho'], ['🪀', 'ioiô'], ['📚', 'livro'], ['🎨', 'tinta'], ['🧢', 'boné'],
  ];

  // R$ 13,50 (sem ",00" quando é inteiro, se `short`)
  function fmt(cents, short = false) {
    const reais = Math.floor(cents / 100);
    const c = cents % 100;
    if (short && c === 0) return `R$ ${reais}`;
    return `R$ ${reais},${String(c).padStart(2, '0')}`;
  }

  // o jeito com menos notas e moedas (com essas notas, o guloso é o melhor)
  function fewest(cents, allowed) {
    const out = [];
    let left = cents;
    for (const d of allowed.slice().sort((a, b) => b - a)) {
      while (left >= d) { out.push(d); left -= d; }
    }
    return left === 0 ? out : null;
  }

  const sum = (list) => list.reduce((n, v) => n + v, 0);
  const roundTo = (v, step) => Math.round(v / step) * step;

  function pickItems(r, n) {
    return r.shuffle(ITEMS).slice(0, n).map(([emoji, name]) => ({ emoji, name }));
  }

  // um preço entre min e max, de `step` em `step`
  function price(r, [min, max], step) {
    return roundTo(r.int(Math.ceil(min / step), Math.floor(max / step)) * step, step);
  }

  function makeTask(level, r) {
    const allowed = level.money;
    const step = level.step || 100;
    switch (level.task) {
      case 'count': {
        // de 2 a level.pieces notas/moedas, sem passar do máximo
        let pieces = [];
        for (let guard = 0; guard < 100; guard++) {
          pieces = Array.from({ length: r.int(2, level.pieces || 5) }, () => r.pick(allowed)).sort((a, b) => b - a);
          if (sum(pieces) <= level.range[1]) break;
        }
        const total = sum(pieces);
        // alternativas: a certa e outras perto (uma nota/moeda a mais ou a menos)
        const opts = new Set([total]);
        const deltas = r.shuffle([...new Set([...allowed, step])]);
        for (const d of deltas) {
          if (opts.size >= 4) break;
          for (const v of [total + d, total - d]) if (v > 0 && opts.size < 4) opts.add(v);
        }
        for (let k = 1; opts.size < 4; k++) opts.add(total + k * step);
        return { type: 'count', pieces, total, options: r.shuffle([...opts]) };
      }
      case 'pay':
      case 'fewest': {
        const items = pickItems(r, level.items || 1);
        const prices = items.map(() => price(r, level.range, step));
        items.forEach((it, i) => { it.price = prices[i]; });
        return { type: level.task, items, price: sum(prices), hideTotal: Boolean(level.hideTotal) };
      }
      case 'change': {
        const items = pickItems(r, level.items || 1);
        for (let guard = 0; guard < 200; guard++) {
          const prices = items.map(() => price(r, level.range, step));
          const p = sum(prices);
          const notes = level.paidWith.filter((n) => n > p);
          if (!notes.length) continue;
          const paid = r.pick(notes);
          items.forEach((it, i) => { it.price = prices[i]; });
          return { type: 'change', items, price: p, paid, change: paid - p, hideTotal: Boolean(level.hideTotal) };
        }
        throw new Error(`não consegui gerar troco para ${level.id}`);
      }
      default: throw new Error(`tarefa desconhecida: ${level.task}`);
    }
  }

  // as tarefas da rodada (sem repetir valor)
  function makeRound(level, seed) {
    const r = R.rng(seed);
    const out = [];
    const seen = new Set();
    for (let guard = 0; out.length < level.count && guard < 500; guard++) {
      const t = makeTask(level, r);
      const key = t.type === 'count' ? `c${t.total}` : t.type === 'change' ? `t${t.price}/${t.paid}` : `p${t.price}`;
      if (seen.has(key) && guard < 400) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }

  // a resposta está certa? ({ ok, why })
  function check(task, answer, allowed) {
    if (task.type === 'count') return { ok: Number(answer) === task.total };
    if (!Array.isArray(answer) || answer.length > 60 || !answer.every((d) => allowed.includes(d))) return { ok: false, why: 'invalid' };
    const total = sum(answer);
    const want = task.type === 'change' ? task.change : task.price;
    if (total !== want) return { ok: false, why: total > want ? 'more' : 'less' };
    if (task.type === 'fewest' && answer.length > fewest(want, allowed).length) return { ok: false, why: 'many' };
    return { ok: true };
  }

  const api = { MONEY, ALL, ITEMS, fmt, fewest, sum, makeRound, check };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DinheiroMoney = api;
})(typeof window !== 'undefined' ? window : globalThis);
