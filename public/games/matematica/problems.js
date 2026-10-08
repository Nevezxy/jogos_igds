// public/games/matematica/problems.js
// 🔢 Conta Comigo: gerador e conferidor de contas. Usado no navegador (para
// montar a rodada) e no servidor (para refazer as mesmas contas a partir da
// semente e conferir as respostas: ninguém manda "10 de 10" falso).
//
// Uma rodada = makeRound(fase, semente, revisão). A mesma semente gera
// sempre as mesmas contas. `revisão` são contas que a criança errou antes
// (chaves guardadas no progresso), que voltam para ela treinar.
//
// Cada conta tem uma chave (`key`, JSON) que a descreve inteira:
//   ["bin", op, a, b, esconde]   a op b = c, com uma parte escondida
//                                 (op: + - * / ^; esconde: c, a, b ou op)
//   ["rem", a, b]                divisão com resto (quociente e resto)
//   ["root", n, x, esconde]      raiz n-ésima exata de x (esconde: c ou a)
//   ["expr", modelo, v1, v2...]  expressão (ex.: "a+b*c") com os valores
//
// Tipos de gerador (`gen.t` em levels.js):
//   add, sub, mul, div   as quatro operações, com faixas, vai-um/empréstimo
//   rem                  divisão com resto
//   sign                 "qual é o sinal?"
//   int                  números negativos (inteiros)
//   pow, root            potência e raiz
//   expr                 expressões com ordem das operações
//   pick                 sorteia um dos geradores em `of`
// Faixas: número fixo, [mín, máx], [mín, máx, passo] ou { list: [...] }.

(function (root) {
  // ---------------- sorteio com semente ----------------
  function rng(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const intIn = (r, lo, hi, step = 1) => lo + step * Math.floor(r() * (Math.floor((hi - lo) / step) + 1));
  const choose = (r, list) => list[Math.floor(r() * list.length)];
  function val(r, spec) {
    if (typeof spec === 'number') return spec;
    if (Array.isArray(spec)) return intIn(r, spec[0], spec[1], spec[2] || 1);
    if (spec && spec.list) return choose(r, spec.list);
    throw new Error('faixa inválida');
  }

  // ---------------- números ----------------
  const MINUS = '−';
  // 1450 -> "1.450"; -3 -> "−3"
  function fmt(n) {
    const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return n < 0 ? MINUS + s : s;
  }
  const SYMBOL = { '+': '+', '-': MINUS, '*': '×', '/': '÷', '^': '^' };
  const WORD = { '+': 'mais', '-': 'menos', '*': 'vezes', '/': 'dividido por', '^': 'elevado a' };
  const OPS = ['+', '-', '*', '/'];

  function compute(op, a, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 && a % b === 0 ? a / b : NaN;
      case '^': return b >= 0 ? a ** b : NaN;
      default: return NaN;
    }
  }

  function digits(n) { return String(Math.abs(n)).split('').reverse().map(Number); }
  // alguma coluna passa de 9 (vai-um)?
  function hasCarry(a, b) {
    const da = digits(a); const db = digits(b);
    let carry = 0;
    for (let i = 0; i < Math.max(da.length, db.length); i++) {
      const s = (da[i] || 0) + (db[i] || 0) + carry;
      if (s >= 10) return true;
      carry = 0;
    }
    return false;
  }
  // alguma coluna precisa pedir emprestado? (a ≥ b)
  function hasBorrow(a, b) {
    const da = digits(a); const db = digits(b);
    return db.some((d, i) => (da[i] || 0) < d);
  }
  // multiplicação por um algarismo com vai-um?
  function hasMulCarry(a, b) {
    const [big, small] = Math.abs(a) >= Math.abs(b) ? [a, b] : [b, a];
    if (Math.abs(small) > 9) return true;
    return digits(big).some((d) => d * Math.abs(small) >= 10);
  }

  // ---------------- expressões ----------------
  // Modelos como "a+b*c", "(a-b)*c", "a*[b+(c-d)]", "a^2+b", "r(A)+b" (r( é
  // raiz quadrada; letra MAIÚSCULA = quadrado perfeito), "-a^2" (= −(a²)).
  function parseTemplate(src) {
    let i = 0;
    const vars = [];
    const peek = () => src[i];
    function primary() {
      const ch = src[i];
      if (ch === '(' || ch === '[') {
        i++;
        const inner = expr();
        i++; // ) ou ]
        return { t: 'group', br: ch, e: inner };
      }
      if (ch === 'r' && src[i + 1] === '(') {
        i += 2;
        const inner = expr();
        i++;
        return { t: 'sqrt', e: inner };
      }
      if (/[0-9]/.test(ch)) {
        let s = '';
        while (/[0-9]/.test(src[i] || '')) s += src[i++];
        return { t: 'const', v: Number(s) };
      }
      if (/[a-zA-Z]/.test(ch)) {
        i++;
        if (!vars.includes(ch)) vars.push(ch);
        return { t: 'var', name: ch };
      }
      throw new Error(`modelo inválido: ${src}`);
    }
    function power() {
      const base = primary();
      if (peek() === '^') { i++; return { t: 'op', op: '^', l: base, r: unary() }; }
      return base;
    }
    function unary() {
      if (peek() === '-') { i++; return { t: 'neg', e: unary() }; }
      return power();
    }
    function term() {
      let left = unary();
      while (peek() === '*' || peek() === '/') { const op = src[i++]; left = { t: 'op', op, l: left, r: unary() }; }
      return left;
    }
    function expr() {
      let left = term();
      while (peek() === '+' || peek() === '-') { const op = src[i++]; left = { t: 'op', op, l: left, r: term() }; }
      return left;
    }
    const ast = expr();
    return { ast, vars };
  }
  const TEMPLATE_CACHE = {};
  function template(src) {
    if (!TEMPLATE_CACHE[src]) TEMPLATE_CACHE[src] = parseTemplate(src);
    return TEMPLATE_CACHE[src];
  }

  // Valor (NaN quando não dá: divisão não exata, raiz não exata, ...).
  function evalAst(node, env) {
    switch (node.t) {
      case 'const': return node.v;
      case 'var': return env[node.name];
      case 'group': return evalAst(node.e, env);
      case 'neg': return -evalAst(node.e, env);
      case 'sqrt': {
        const x = evalAst(node.e, env);
        const s = Math.round(Math.sqrt(x));
        return x >= 0 && s * s === x ? s : NaN;
      }
      case 'op': {
        const l = evalAst(node.l, env);
        const r = evalAst(node.r, env);
        if (node.op === '^' && (r > 6 || Math.abs(l) > 100)) return NaN;
        return compute(node.op, l, r);
      }
      default: return NaN;
    }
  }

  // Desenho da expressão em partes ("tokens") para a tela e para a voz.
  //   { t: 'n', v }  número       { t: 'o', v }  sinal (+ − × ÷)
  //   { t: 'p', v }  ( ) [ ]      { t: 'sup', v } expoente
  //   { t: 'sq', parts } raiz quadrada sobre `parts`
  function astTokens(node, env) {
    switch (node.t) {
      case 'const': return [{ t: 'n', v: node.v }];
      case 'var': return [{ t: 'n', v: env[node.name] }];
      case 'group': {
        const close = node.br === '(' ? ')' : ']';
        return [{ t: 'p', v: node.br }, ...astTokens(node.e, env), { t: 'p', v: close }];
      }
      case 'neg': return [{ t: 'o', v: MINUS, unary: true }, ...astTokens(node.e, env)];
      case 'sqrt': return [{ t: 'sq', parts: astTokens(node.e, env) }];
      case 'op':
        if (node.op === '^') return [...astTokens(node.l, env), { t: 'sup', v: astTokens(node.r, env).map((x) => x.v).join('') }];
        return [...astTokens(node.l, env), { t: 'o', v: SYMBOL[node.op] }, ...astTokens(node.r, env)];
      default: return [];
    }
  }

  // ---------------- montar uma conta a partir da chave ----------------
  const num = (n) => ({ t: 'n', v: n });
  const hole = () => ({ t: 'hole' });
  // número negativo depois de um sinal vai entre parênteses: 5 − (−3)
  const wrapNeg = (n) => (n < 0 ? [{ t: 'p', v: '(' }, num(n), { t: 'p', v: ')' }] : [num(n)]);

  function build(key) {
    const [type, ...p] = key;
    const k = JSON.stringify(key);
    if (type === 'bin') {
      const [op, a, b, hide] = p;
      const c = compute(op, a, b);
      if (!Number.isFinite(c)) throw new Error(`conta inválida: ${k}`);
      let tokens;
      if (op === '^') {
        const base = hide === 'a' ? [hole()] : (a < 0 ? wrapNeg(a) : [num(a)]);
        tokens = [...base, { t: 'sup', v: hide === 'b' ? '?' : String(b) }, { t: 'eq' }, hide === 'c' ? hole() : num(c)];
      } else {
        tokens = [
          hide === 'a' ? hole() : num(a),
          hide === 'op' ? { t: 'hole', op: true } : { t: 'o', v: SYMBOL[op] },
          ...(hide === 'b' ? [hole()] : wrapNeg(b)),
          { t: 'eq' },
          hide === 'c' ? hole() : num(c),
        ];
      }
      const answer = { a, b, c, op }[hide];
      return { key: k, type, op, a, b, c, hide, tokens, answer, fields: 1 };
    }
    if (type === 'rem') {
      const [a, b] = p;
      const q = Math.floor(a / b);
      const r = a % b;
      return {
        key: k, type, op: '/', a, b, c: q, rest: r, hide: 'c',
        tokens: [num(a), { t: 'o', v: '÷' }, num(b), { t: 'eq' }, hole()],
        answer: [q, r], fields: 2, labels: ['quociente', 'resto'],
      };
    }
    if (type === 'root') {
      const [n, x, hide] = p;
      const r = Math.round(x ** (1 / n));
      if (r ** n !== x) throw new Error(`raiz inválida: ${k}`);
      const rad = hide === 'a' ? [hole()] : [num(x)];
      return {
        key: k, type, n, a: x, c: r, hide,
        tokens: [{ t: n === 2 ? 'sq' : 'cb', parts: rad }, { t: 'eq' }, hide === 'c' ? hole() : num(r)],
        answer: hide === 'a' ? x : r, fields: 1,
      };
    }
    if (type === 'expr') {
      const [src, ...values] = p;
      const { ast, vars } = template(src);
      const env = Object.fromEntries(vars.map((v, i) => [v, values[i]]));
      const value = evalAst(ast, env);
      if (!Number.isFinite(value)) throw new Error(`expressão inválida: ${k}`);
      return {
        key: k, type, src, values, c: value, hide: 'c',
        tokens: [...astTokens(ast, env), { t: 'eq' }, hole()],
        answer: value, fields: 1,
      };
    }
    throw new Error(`tipo de conta desconhecido: ${type}`);
  }

  function fromKey(k) {
    let key;
    try { key = JSON.parse(k); } catch (e) { return null; }
    if (!Array.isArray(key) || key.length > 12) return null;
    try { return build(key); } catch (e) { return null; }
  }

  // ---------------- geradores ----------------
  const MAX_TRIES = 600;
  function retry(fn) {
    for (let i = 0; i < MAX_TRIES; i++) {
      const out = fn();
      if (out) return out;
    }
    throw new Error('não consegui gerar uma conta para essa fase');
  }
  const hideOf = (r, g) => (g.hide === 'any' ? choose(r, ['a', 'b']) : g.hide || 'c');
  const okCarry = (want, has) => (want === 'yes' ? has : want === 'no' ? !has : true);

  const GEN = {
    add(r, g) {
      return retry(() => {
        let a = val(r, g.a);
        let b = g.same ? a : val(r, g.b);
        if (g.swap && r() < 0.5) [a, b] = [b, a];
        const c = a + b;
        if (g.max != null && c > g.max) return null;
        if (g.min != null && c < g.min) return null;
        if (!okCarry(g.carry, hasCarry(a, b))) return null;
        return ['bin', '+', a, b, hideOf(r, g)];
      });
    },
    sub(r, g) {
      return retry(() => {
        let a = val(r, g.a);
        let b = g.same ? a : val(r, g.b);
        if (b > a) [a, b] = [b, a];
        if (g.min != null && a - b < g.min) return null;
        if (!okCarry(g.borrow, hasBorrow(a, b))) return null;
        return ['bin', '-', a, b, hideOf(r, g)];
      });
    },
    mul(r, g) {
      return retry(() => {
        let a = val(r, g.a);
        let b = val(r, g.b);
        if (g.swap && r() < 0.5) [a, b] = [b, a];
        if (g.max != null && a * b > g.max) return null;
        if (!okCarry(g.carry, hasMulCarry(a, b))) return null;
        return ['bin', '*', a, b, hideOf(r, g)];
      });
    },
    div(r, g) {
      return retry(() => {
        const d = val(r, g.d);
        const q = val(r, g.q);
        const a = d * q;
        if (d === 0) return null;
        if (g.amin != null && a < g.amin) return null;
        if (g.amax != null && a > g.amax) return null;
        return ['bin', '/', a, d, hideOf(r, g)];
      });
    },
    rem(r, g) {
      return retry(() => {
        const d = val(r, g.d);
        const q = val(r, g.q);
        if (d < 2) return null;
        return ['rem', d * q + intIn(r, 1, d - 1), d];
      });
    },
    // "qual é o sinal?": só vale se um único sinal dá aquele resultado
    sign(r, g) {
      return retry(() => {
        const op = choose(r, g.ops);
        let a = val(r, g.n);
        let b = val(r, g.n);
        if (op === '-' && b > a) [a, b] = [b, a];
        if (op === '/') { a *= b; }
        const c = compute(op, a, b);
        if (!Number.isFinite(c) || c < 0 || b === 0) return null;
        const others = OPS.filter((o) => compute(o, a, b) === c);
        if (others.length !== 1) return null;
        return ['bin', op, a, b, 'op'];
      });
    },
    // inteiros (negativos): `need` diz onde tem que aparecer número negativo
    int(r, g) {
      return retry(() => {
        const op = g.op || choose(r, g.ops);
        let a;
        let b;
        if (op === '/') {
          b = val(r, g.b);
          if (b === 0) return null;
          a = b * val(r, g.q || g.b);
        } else {
          a = val(r, g.a);
          b = val(r, g.b);
        }
        if (g.swap && r() < 0.5) [a, b] = [b, a];
        const c = compute(op, a, b);
        if (!Number.isFinite(c)) return null;
        const need = g.need || 'any';
        const neg = (n) => n < 0;
        const ok = {
          any: neg(a) || neg(b) || neg(c),
          'neg-res': neg(c),
          'one-neg': neg(a) !== neg(b) && a !== 0 && b !== 0,
          both: neg(a) && neg(b),
        }[need];
        if (!ok) return null;
        return ['bin', op, a, b, hideOf(r, g)];
      });
    },
    pow(r, g) {
      return retry(() => {
        const a = val(r, g.base);
        const b = val(r, g.exp);
        const c = a ** b;
        if (g.max != null && Math.abs(c) > g.max) return null;
        if (a === 0 && b === 0) return null;
        return ['bin', '^', a, b, hideOf(r, g)];
      });
    },
    root(r, g) {
      const n = g.n || 2;
      const x = val(r, g.r) ** n;
      return ['root', n, x, g.hide || 'c'];
    },
    expr(r, g) {
      return retry(() => {
        const src = choose(r, g.tpl);
        const { ast, vars } = template(src);
        const range = g.n || [1, 9];
        // letra maiúscula = quadrado perfeito (para ficar dentro da raiz)
        const values = vars.map((v) => (v === v.toUpperCase() ? val(r, g.sq || [1, 10]) ** 2 : val(r, range)));
        const env = Object.fromEntries(vars.map((v, i) => [v, values[i]]));
        const value = evalAst(ast, env);
        if (!Number.isFinite(value)) return null;
        if (!g.neg && value < 0) return null;
        if (Math.abs(value) > (g.max || 10000)) return null;
        return ['expr', src, ...values];
      });
    },
    pick(r, g) {
      return generate(choose(r, g.of), r);
    },
  };

  function generate(gen, r) {
    const fn = GEN[gen.t];
    if (!fn) throw new Error(`gerador desconhecido: ${gen.t}`);
    return fn(r, gen);
  }

  // Rodada da fase: `count` contas, sem repetir; as de revisão entram
  // embaralhadas no meio.
  function makeRound(level, seed, review = []) {
    const r = rng(seed);
    const count = level.count || 10;
    const list = [];
    const seen = new Set();
    for (const k of review.slice(0, 3)) {
      const p = fromKey(k);
      if (p && !seen.has(p.key)) { list.push(p); seen.add(p.key); }
    }
    let guard = 0;
    while (list.length < count) {
      const p = build(generate(level.gen, r));
      // fases com poucas contas possíveis (ex.: ×0 e ×1) podem repetir
      if (!seen.has(p.key) || guard++ > 40) { list.push(p); seen.add(p.key); }
    }
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // ---------------- respostas ----------------
  // "1.450" -> 1450; "−3" -> -3; "x" -> "*" (sinal). null = não entendi.
  function parseAnswer(raw) {
    const s = String(raw == null ? '' : raw).trim().replace(/[−–]/g, '-').replace(/[.\s]/g, '');
    if (/^-?\d{1,9}$/.test(s)) return Number(s);
    const op = { '+': '+', '-': '-', '×': '*', x: '*', X: '*', '*': '*', '÷': '/', '/': '/', ':': '/' }[s];
    return op || null;
  }

  // `value`: número, sinal ou [quociente, resto]
  function isCorrect(p, value) {
    if (p.fields === 2) {
      return Array.isArray(value) && value.length === 2 && Number(value[0]) === p.answer[0] && Number(value[1]) === p.answer[1];
    }
    if (p.hide === 'op') return value === p.op;
    if (typeof value !== 'number') return false;
    // ?² = 49: 7 e −7 servem
    if (p.type === 'bin' && p.op === '^' && p.hide === 'a' && p.b % 2 === 0) return Math.abs(value) === Math.abs(p.a);
    return value === p.answer;
  }

  // ---------------- textos ----------------
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '?': 'ˀ' };
  function tokenText(tk) {
    switch (tk.t) {
      case 'n': return fmt(tk.v);
      case 'o': return tk.v;
      case 'p': return tk.v;
      case 'eq': return '=';
      case 'hole': return '?';
      case 'sup': return [...tk.v].map((d) => SUP[d] || d).join('');
      case 'sq': return `√${tk.parts.length > 1 ? `(${text({ tokens: tk.parts })})` : text({ tokens: tk.parts })}`;
      case 'cb': return `∛${text({ tokens: tk.parts })}`;
      default: return '';
    }
  }
  // "27 + 45 = ?" (sem espaço depois de "(" e do menos de sinal, nem antes de ")" e do expoente)
  function text(p) {
    let out = '';
    p.tokens.forEach((tk, i) => {
      const prev = p.tokens[i - 1];
      const glued = i === 0
        || (prev && prev.t === 'p' && (prev.v === '(' || prev.v === '['))
        || (prev && prev.t === 'o' && prev.unary)
        || (tk.t === 'p' && (tk.v === ')' || tk.v === ']'))
        || tk.t === 'sup';
      out += (glued ? '' : ' ') + tokenText(tk);
    });
    return out;
  }
  // A conta sem o "= ?" (para listas: "7 × 8")
  function describe(key) {
    const p = typeof key === 'string' ? fromKey(key) : key;
    if (!p) return '';
    if (p.hide === 'c' && p.fields === 1) return text({ tokens: p.tokens.slice(0, -2) });
    return text(p);
  }
  // A conta resolvida ("27 + 45 = 72"; "17 ÷ 5 = 3, resto 2")
  function solution(p) {
    if (p.fields === 2) return `${fmt(p.a)} ÷ ${fmt(p.b)} = ${fmt(p.answer[0])}, resto ${fmt(p.answer[1])}`;
    const filled = p.tokens.map((tk) => {
      if (tk.t === 'hole') return tk.op ? { t: 'o', v: SYMBOL[p.op] } : num(p.hide === 'c' ? p.c : p.answer);
      if (tk.t === 'sup' && tk.v === '?') return { t: 'sup', v: String(p.b) };
      if ((tk.t === 'sq' || tk.t === 'cb') && tk.parts[0] && tk.parts[0].t === 'hole') return { ...tk, parts: [num(p.a)] };
      return tk;
    });
    return text({ tokens: filled });
  }
  const answerText = (p) => (p.fields === 2 ? `${fmt(p.answer[0])}, resto ${fmt(p.answer[1])}` : p.hide === 'op' ? SYMBOL[p.op] : fmt(p.answer));

  // Como a conta é lida em voz alta.
  function speech(p) {
    const say = (n) => (n < 0 ? `menos ${Math.abs(n)}` : String(n));
    const out = [];
    const walk = (tk) => {
      switch (tk.t) {
        case 'n': out.push(say(tk.v)); break;
        case 'o': out.push(tk.unary ? 'menos' : WORD[{ '+': '+', '−': '-', '×': '*', '÷': '/' }[tk.v]] || tk.v); break;
        case 'p': if (tk.v === '(' || tk.v === '[') out.push('abre parênteses'); else out.push('fecha parênteses'); break;
        case 'eq': out.push('é igual a'); break;
        case 'hole': out.push(tk.op ? 'qual sinal' : 'quanto'); break;
        case 'sup': out.push(tk.v === '2' ? 'ao quadrado' : tk.v === '3' ? 'ao cubo' : `elevado a ${tk.v === '?' ? 'quanto' : tk.v}`); break;
        case 'sq': out.push('raiz quadrada de'); tk.parts.forEach(walk); break;
        case 'cb': out.push('raiz cúbica de'); tk.parts.forEach(walk); break;
        default:
      }
    };
    p.tokens.forEach(walk);
    return `${out.join(' ')}?`;
  }

  // Dica depois do 1º erro.
  function hint(p) {
    const u = (n) => Math.abs(n) % 10;
    if (p.type === 'rem') return `Qual é o maior número da tabuada do ${p.b} que cabe em ${fmt(p.a)}? O que sobra é o resto.`;
    if (p.type === 'root') {
      if (p.hide === 'a') return `Faça ao contrário: ${p.c} × ${p.c}${p.n === 3 ? ` × ${p.c}` : ''} = ?`;
      return p.n === 2 ? `Qual número vezes ele mesmo dá ${fmt(p.a)}?` : `Qual número vezes ele mesmo, três vezes, dá ${fmt(p.a)}?`;
    }
    if (p.type === 'expr') {
      if (p.src.includes('r(')) return 'Resolva as raízes primeiro, depois × e ÷, e por último + e −.';
      if (p.src.includes('^')) return 'Primeiro os parênteses, depois as potências, depois × e ÷, e por último + e −.';
      if (/[([]/.test(p.src)) return 'Comece pelo que está dentro dos parênteses ( ), depois os colchetes [ ].';
      return 'Faça primeiro as contas de × e ÷. Depois, as de + e −, da esquerda para a direita.';
    }
    const { op, a, b, c, hide } = p;
    if (hide === 'op') return `Teste cada sinal: ${fmt(a)} + ${fmt(b)}, ${fmt(a)} − ${fmt(b)}, ${fmt(a)} × ${fmt(b)}... qual dá ${fmt(c)}?`;
    const neg = a < 0 || b < 0 || c < 0;
    if (op === '^') {
      if (hide === 'b') return `Multiplique o ${fmt(a)} por ele mesmo e conte quantas vezes até chegar em ${fmt(c)}.`;
      if (hide === 'a') return `Qual número vezes ele mesmo dá ${fmt(c)}?`;
      if (b === 0) return 'Todo número (menos o zero) elevado a 0 dá 1.';
      if (b === 1) return 'Elevado a 1 é o próprio número.';
      if (a < 0) return `Base negativa: com expoente par o resultado é positivo; com expoente ímpar, negativo. ${fmt(Math.abs(a))}${b === 2 ? '²' : b === 3 ? '³' : `^${b}`} = ${fmt(Math.abs(a) ** b)}.`;
      return `${fmt(a)}${b === 2 ? '²' : b === 3 ? '³' : `^${b}`} é multiplicar o ${fmt(a)} por ele mesmo ${b} vezes: ${Array(Math.min(b, 6)).fill(fmt(a)).join(' × ')}.`;
    }
    if (neg && (op === '*' || op === '/')) return 'Sinais iguais dão resultado positivo (+). Sinais diferentes dão resultado negativo (−).';
    if (neg && op === '-' && b < 0) return `Menos com menos vira mais: ${fmt(a)} − (${fmt(b)}) é o mesmo que ${fmt(a)} + ${fmt(-b)}.`;
    if (neg) return `Pense num termômetro: comece no ${fmt(hide === 'a' ? c : a)} e ande ${Math.abs(b)} para ${(op === '+') === (b >= 0) ? 'cima' : 'baixo'}.`;
    if (op === '+') {
      if (hide === 'a' || hide === 'b') return `Quanto falta de ${fmt(hide === 'a' ? b : a)} para chegar em ${fmt(c)}? Conte a partir do ${fmt(hide === 'a' ? b : a)}.`;
      if (c <= 10) return `Comece no ${a} e conte mais ${b} nos dedos.`;
      if (a < 10 && b < 10) return `Complete o 10 primeiro: ${Math.max(a, b)} + ${10 - Math.max(a, b)} = 10, e ainda sobram ${Math.min(a, b) - (10 - Math.max(a, b))}.`;
      if (hasCarry(a, b)) return `Some as unidades: ${u(a)} + ${u(b)} = ${u(a) + u(b)}. Escreva ${(u(a) + u(b)) % 10} e vai 1 para a próxima casa.`;
      return `Some as unidades (${u(a)} + ${u(b)}) e depois as dezenas, cada casa no seu lugar.`;
    }
    if (op === '-') {
      if (hide === 'a') return `Faça ao contrário: ${fmt(c)} + ${fmt(b)} = ?`;
      if (hide === 'b') return `Quanto falta de ${fmt(c)} para chegar em ${fmt(a)}?`;
      if (a <= 10) return `Comece no ${a} e volte ${b} nos dedos.`;
      if (hasBorrow(a, b)) return `${u(a)} é menor que ${u(b)}: peça 1 dezena emprestada. ${u(a) + 10} − ${u(b)} = ${u(a) + 10 - u(b)}.`;
      return `Tire as unidades (${u(a)} − ${u(b)}) e depois as dezenas, cada casa no seu lugar.`;
    }
    if (op === '*') {
      if (hide === 'a' || hide === 'b') return `Pense na tabuada do ${fmt(hide === 'a' ? b : a)}: ${fmt(hide === 'a' ? b : a)} × ? = ${fmt(c)}.`;
      const small = Math.min(a, b);
      const big = Math.max(a, b);
      if (small === 0) return 'Qualquer número vezes 0 dá 0.';
      if (small === 1) return 'Qualquer número vezes 1 dá ele mesmo.';
      if ([10, 100, 1000].includes(big) || [10, 100, 1000].includes(small)) return 'Para ×10, ×100 ou ×1000, acrescente um, dois ou três zeros no fim do número.';
      if (big > 10 && small < 10) return `Multiplique por partes: ${fmt(big - u(big))} × ${small} e depois ${u(big)} × ${small}. Depois some os dois.`;
      if (small === 9 || big === 9) return `Truque do 9: ${big === 9 ? small : big} × 10 = ${(big === 9 ? small : big) * 10}, menos ${big === 9 ? small : big}.`;
      if (small <= 5) return `${small} × ${big} é somar o ${big}, ${small} vezes: ${Array(small).fill(big).join(' + ')}.`;
      return `${small} × ${big} é o mesmo que ${big} × ${small}. Use a tabuada que você sabe melhor!`;
    }
    if (op === '/') {
      if (hide === 'a') return `Faça ao contrário: ${fmt(c)} × ${fmt(b)} = ?`;
      if (hide === 'b') return `Pense: ${fmt(c)} × ? = ${fmt(a)}.`;
      if (b === 1) return 'Dividir por 1 dá o próprio número.';
      if (a === b) return 'Um número dividido por ele mesmo dá 1.';
      return `Pense na tabuada do ${fmt(b)}: ${fmt(b)} × ? = ${fmt(a)}.`;
    }
    return 'Leia a conta com calma e tente de novo.';
  }

  const api = {
    rng, makeRound, generate, build, fromKey, parseAnswer, isCorrect,
    text, describe, solution, answerText, speech, hint, fmt,
    hasCarry, hasBorrow, hasMulCarry, compute, SYMBOL,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ContaProblems = api;
})(typeof window !== 'undefined' ? window : globalThis);
