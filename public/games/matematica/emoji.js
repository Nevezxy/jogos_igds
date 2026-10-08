// public/games/matematica/emoji.js
// Figurinhas do 🔢 Conta Comigo (o mundo "Contando com figurinhas"): troca
// os números da conta por desenhos que mostram o que a operação faz.
//   soma          junta dois grupos              🍎🍎🍎 + 🍎 = ?
//   subtração     risca as figurinhas que saem   🍎🍎🍎🍎🍎 (2 riscadas) = ?
//   multiplicação grupos iguais em cestas        🧺(🍎🍎🍎🍎) × 3
//   divisão       reparte entre crianças         🍎 × 12 ÷ 🧒🧒🧒
//   dezena/centena: material dourado (cubinho = 1, barra = 10, placa = 100)
// Até 20 figurinhas, elas ficam em fileiras de 5 (como no quadro de dez da
// escola). Contas grandes demais para figurinhas continuam com números.
// `plan` também roda no servidor/testes (não usa a página).

(function (root) {
  const THEMES = {
    frutas: { name: 'Frutas', icon: '🍎', items: ['🍎', '🍌', '🍓', '🍊', '🍇', '🍐', '🍉', '🍒'] },
    bichos: { name: 'Bichos', icon: '🐶', items: ['🐶', '🐱', '🐰', '🐸', '🐥', '🐢', '🐟', '🦋'] },
    doces: { name: 'Doces', icon: '🍬', items: ['🍬', '🍭', '🧁', '🍪', '🍩', '🍫'] },
    bolas: { name: 'Bolas', icon: '⚽', items: ['⚽', '🏀', '🎾', '🏐', '🎈'] },
    estrelas: { name: 'Estrelas', icon: '⭐', items: ['⭐', '🌟', '❤️', '🌸', '🍀'] },
  };

  // Que desenho cabe nesta conta (ou null: fica com números).
  function plan(p) {
    if (p.type === 'rem') return p.a <= 30 && p.b <= 6 ? { kind: 'share' } : null;
    if (p.type !== 'bin' || p.hide === 'op') return null;
    const { op, a, b, c, hide } = p;
    if (a < 0 || b < 0 || c < 0) return null;
    if (op === '+') {
      if (c <= 20) return { kind: 'join' };
      if (c <= 999 && hide === 'c') return { kind: 'blocks' };
    }
    if (op === '-') {
      if (a <= 20 && hide === 'c') return { kind: 'take' };
      if (a <= 20 && hide !== 'c') return { kind: 'join-back' };
      if (a <= 999 && hide === 'c') return { kind: 'blocks' };
    }
    if (op === '*' && hide === 'c' && a >= 1 && a <= 6 && b >= 1 && b <= 10) return { kind: 'groups' };
    if (op === '/' && hide === 'c' && a <= 30 && b >= 1 && b <= 6) return { kind: 'share' };
    return null;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // n figurinhas em fileiras de 5; as últimas `crossed` aparecem riscadas
  function group(n, emoji, { crossed = 0, label } = {}) {
    const box = el('span', 'cc-eg');
    if (label) box.setAttribute('aria-label', label);
    if (n === 0) { box.classList.add('is-empty'); box.textContent = 'nada'; return box; }
    for (let i = 0; i < n; i++) {
      const item = el('span', 'cc-ei', emoji);
      if (i >= n - crossed) item.classList.add('is-crossed');
      box.appendChild(item);
    }
    return box;
  }
  const holeBox = () => el('span', 'cc-hole', '?');
  const opSign = (s) => el('span', 'cc-op', s);

  // Material dourado: placas (100), barras (10) e cubinhos (1).
  function blocks(n) {
    const box = el('span', 'cc-blocks');
    box.setAttribute('aria-label', String(n));
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    for (let i = 0; i < h; i++) box.appendChild(el('span', 'cc-plate'));
    for (let i = 0; i < t; i++) box.appendChild(el('span', 'cc-bar'));
    const ones = el('span', 'cc-ones');
    for (let i = 0; i < u; i++) ones.appendChild(el('span', 'cc-cube'));
    if (u) box.appendChild(ones);
    if (!n) box.appendChild(el('span', 'cc-eg is-empty', 'nada'));
    return box;
  }

  // Desenha a conta `p` com figurinhas. Devolve { node, caption } ou null.
  function render(p, emoji) {
    const pl = plan(p);
    if (!pl) return null;
    const row = el('div', 'cc-erow');
    let caption = '';
    const { a, b, c, hide } = p;
    const part = (value, which) => (hide === which ? holeBox() : group(value, emoji));
    switch (pl.kind) {
      case 'join':
        row.append(part(a, 'a'), opSign('+'), part(b, 'b'), opSign('='), hide === 'c' ? holeBox() : group(c, emoji));
        caption = hide === 'c' ? 'Junte tudo: quantas ficam?' : 'Quantas faltam para ficar igual?';
        break;
      case 'take':
        row.append(group(a, emoji, { crossed: b }), opSign('='), holeBox());
        caption = 'Tire as riscadas: quantas sobram?';
        break;
      case 'join-back':
        // "? − 3 = 4" ou "7 − ? = 4": quanto tinha / quanto saiu
        row.append(part(a, 'a'), opSign('−'), part(b, 'b'), opSign('='), group(c, emoji));
        caption = hide === 'a' ? 'Quantas tinha antes de tirar?' : 'Quantas foram tiradas?';
        break;
      case 'groups': {
        const wrap = el('span', 'cc-baskets');
        for (let i = 0; i < a; i++) {
          const basket = el('span', 'cc-basket');
          basket.appendChild(group(b, emoji));
          wrap.appendChild(basket);
        }
        row.append(wrap, opSign('='), holeBox());
        caption = `${a} ${a === 1 ? 'grupo' : 'grupos'} de ${b}: quantas ao todo?`;
        break;
      }
      case 'share': {
        const kids = el('span', 'cc-kids');
        for (let i = 0; i < b; i++) kids.appendChild(el('span', 'cc-kid', '🧒'));
        row.append(group(a, emoji), opSign('÷'), kids, opSign('='), holeBox());
        caption = p.type === 'rem'
          ? `Reparta igualmente entre ${b} crianças: quanto cada uma ganha, e quanto sobra?`
          : `Reparta igualmente entre ${b} crianças: quanto cada uma ganha?`;
        break;
      }
      case 'blocks':
        row.classList.add('is-blocks');
        row.append(blocks(a), opSign(p.op === '-' ? '−' : '+'), blocks(b), opSign('='), holeBox());
        caption = p.op === '-'
          ? 'Placa = 100, barra = 10, cubinho = 1. Tire o segundo do primeiro.'
          : 'Placa = 100, barra = 10, cubinho = 1. Junte e conte.';
        break;
      default:
        return null;
    }
    return { node: row, caption };
  }

  const pickEmoji = (themeId) => {
    const theme = THEMES[themeId] || THEMES.frutas;
    return theme.items[Math.floor(Math.random() * theme.items.length)];
  };

  const api = { THEMES, plan, render, pickEmoji };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ContaEmoji = api;
})(typeof window !== 'undefined' ? window : globalThis);
