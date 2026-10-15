// public/games/xadrez/rules.js
// Regras do ♟️ Xadrez, completas: roque, en passant, promoção (com escolha
// da peça), xeque, xeque-mate, afogamento e os empates por material
// insuficiente, 3 repetições e 50 lances. Fonte única: navegador, robô (Web
// Worker) e servidor.
//   casa = linha * 8 + coluna, linha 0 = 8ª fileira (as pretas em cima)
//   peças: 'PNBRQK' brancas, 'pnbrqk' pretas, '.' vazio
//   estado: { v, board, turn (0 brancas, 1 pretas), castle ('KQkq'), ep (casa
//             ou -1), half (lances sem captura nem peão), ply, hist (posições
//             desde o último lance sem volta), last: [de, para], check, result }
//   lance: texto "e2e4" (promoção: "e7e8q"; roque: o rei anda 2 casas, "e1g1")
//   result: { winner: 0 | 1 | null, reason: 'mate' | 'afogamento' | 'material' |
//             'repeticao' | '50lances' }
// Variantes: 'classico' (a partida normal) e as posições do "Fim de partida"
// (POSITIONS, em FEN).

(function (root) {
  const FILES = 'abcdefgh';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const VARIANTS = { classico: { label: 'Partida normal', fen: START } };
  // "Fim de partida": posições prontas (as brancas jogam e dão mate)
  const POSITIONS = {
    m1a: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    m1b: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1',
    m1c: '6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1',
    m1d: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    m2a: '7k/8/8/8/8/8/1R6/R5K1 w - - 0 1',
    m2b: '4k3/8/8/5K2/5Q2/8/8/8 w - - 0 1',
    m2c: '8/8/8/5K2/8/7k/3R4/8 w - - 0 1',
    kq: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    kr: '8/8/8/3k4/8/8/8/R3K3 w - - 0 1',
  };

  const name = (sq) => FILES[sq % 8] + (8 - Math.floor(sq / 8));
  const parseSq = (t) => {
    const c = FILES.indexOf(t[0]);
    const r = 8 - Number(t[1]);
    return c < 0 || !(r >= 0 && r < 8) ? -1 : r * 8 + c;
  };
  const isWhite = (p) => p >= 'A' && p <= 'Z';
  const colorOf = (p) => (p === '.' ? -1 : isWhite(p) ? 0 : 1);

  function fromFen(fen, v) {
    const [placement, side, castle, ep, half, full] = fen.split(' ');
    const board = [];
    for (const ch of placement.replace(/\//g, '')) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) board.push('.');
      else board.push(ch);
    }
    const s = {
      v, board, turn: side === 'b' ? 1 : 0, castle: castle === '-' ? '' : castle,
      ep: ep === '-' ? -1 : parseSq(ep), half: Number(half) || 0, ply: ((Number(full) || 1) - 1) * 2 + (side === 'b' ? 1 : 0),
      hist: [], last: null, check: false, result: null,
    };
    s.hist = [key(s)];
    s.check = inCheck(s.board, s.turn);
    return s;
  }

  function initial(v = 'classico') {
    v = String(v);
    const own = (o) => Object.prototype.hasOwnProperty.call(o, v);
    const fen = own(VARIANTS) ? VARIANTS[v].fen : own(POSITIONS) ? POSITIONS[v] : null;
    if (!fen) throw new Error('variante desconhecida');
    return fromFen(fen, v);
  }

  const key = (s) => `${s.board.join('')}${s.turn}${s.castle}${s.ep}`;

  // ---------------- ataques ----------------
  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // a casa sq é atacada pelas peças da cor `by`?
  function attacked(board, sq, by) {
    const r = Math.floor(sq / 8);
    const c = sq % 8;
    const W = by === 0;
    const at = (rr, cc) => (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? board[rr * 8 + cc] : null);
    // peões: os brancos atacam para cima (linha - 1), então vêm de baixo (linha + 1)
    const pr = W ? r + 1 : r - 1;
    const pawn = W ? 'P' : 'p';
    if (at(pr, c - 1) === pawn || at(pr, c + 1) === pawn) return true;
    const knight = W ? 'N' : 'n';
    for (const [dr, dc] of KNIGHT) if (at(r + dr, c + dc) === knight) return true;
    const king = W ? 'K' : 'k';
    for (const [dr, dc] of KING) if (at(r + dr, c + dc) === king) return true;
    const [bq, rq] = W ? ['BQ', 'RQ'] : ['bq', 'rq'];
    for (const [list, dirs] of [[bq, DIAG], [rq, ORTHO]]) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const p = board[rr * 8 + cc];
          if (p !== '.') { if (list.includes(p)) return true; break; }
          rr += dr;
          cc += dc;
        }
      }
    }
    return false;
  }

  const kingSq = (board, side) => board.indexOf(side === 0 ? 'K' : 'k');
  function inCheck(board, side) {
    const k = kingSq(board, side);
    return k >= 0 && attacked(board, k, 1 - side);
  }

  // ---------------- lances ----------------
  // lances "possíveis" sem olhar se o rei fica em xeque: [de, para, promoção]
  function pseudo(s, onlyCaptures = false) {
    const out = [];
    const { board } = s;
    const side = s.turn;
    const W = side === 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (p === '.' || colorOf(p) !== side) continue;
      const r = Math.floor(sq / 8);
      const c = sq % 8;
      const t = p.toUpperCase();
      const add = (to) => {
        const q = board[to];
        if (q !== '.' && colorOf(q) === side) return false;
        if (!onlyCaptures || q !== '.') out.push([sq, to, '']);
        return q === '.';
      };
      if (t === 'P') {
        const dir = W ? -1 : 1;
        const last = W ? 0 : 7;
        const startRow = W ? 6 : 1;
        const one = (r + dir) * 8 + c;
        const push = (to) => {
          if (Math.floor(to / 8) === last) for (const pr of 'qrbn') out.push([sq, to, pr]);
          else out.push([sq, to, '']);
        };
        if (r + dir >= 0 && r + dir < 8 && board[one] === '.') {
          if (!onlyCaptures || Math.floor(one / 8) === last) push(one);
          const two = (r + 2 * dir) * 8 + c;
          if (!onlyCaptures && r === startRow && board[two] === '.') out.push([sq, two, '']);
        }
        for (const dc of [-1, 1]) {
          const cc = c + dc;
          if (cc < 0 || cc > 7 || r + dir < 0 || r + dir > 7) continue;
          const to = (r + dir) * 8 + cc;
          const q = board[to];
          if ((q !== '.' && colorOf(q) !== side) || to === s.ep) push(to);
        }
      } else if (t === 'N' || t === 'K') {
        for (const [dr, dc] of t === 'N' ? KNIGHT : KING) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) add(rr * 8 + cc);
        }
        if (t === 'K' && !onlyCaptures) castles(s, sq, out);
      } else {
        const dirs = t === 'B' ? DIAG : t === 'R' ? ORTHO : DIAG.concat(ORTHO);
        for (const [dr, dc] of dirs) {
          let rr = r + dr;
          let cc = c + dc;
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            if (!add(rr * 8 + cc)) break;
            rr += dr;
            cc += dc;
          }
        }
      }
    }
    return out;
  }

  function castles(s, sq, out) {
    const W = s.turn === 0;
    const home = W ? 60 : 4; // e1 / e8
    if (sq !== home || inCheck(s.board, s.turn)) return;
    const b = s.board;
    const enemy = 1 - s.turn;
    const [k, q, rook] = W ? ['K', 'Q', 'R'] : ['k', 'q', 'r'];
    if (s.castle.includes(k) && b[home + 3] === rook && b[home + 1] === '.' && b[home + 2] === '.'
      && !attacked(b, home + 1, enemy) && !attacked(b, home + 2, enemy)) out.push([home, home + 2, '']);
    if (s.castle.includes(q) && b[home - 4] === rook && b[home - 1] === '.' && b[home - 2] === '.' && b[home - 3] === '.'
      && !attacked(b, home - 1, enemy) && !attacked(b, home - 2, enemy)) out.push([home, home - 2, '']);
  }

  // o tabuleiro depois do lance (sem mexer no original)
  function makeBoard(s, [from, to, promo]) {
    const b = s.board.slice();
    const p = b[from];
    const t = p.toUpperCase();
    let captured = b[to];
    if (t === 'P' && to === s.ep && captured === '.') {
      const victim = to + (s.turn === 0 ? 8 : -8);
      captured = b[victim];
      b[victim] = '.';
    }
    b[to] = promo ? (s.turn === 0 ? promo.toUpperCase() : promo) : p;
    b[from] = '.';
    if (t === 'K' && Math.abs(to - from) === 2) {
      // roque: a torre pula para o outro lado do rei
      const rookFrom = to > from ? from + 3 : from - 4;
      const rookTo = to > from ? from + 1 : from - 1;
      b[rookTo] = b[rookFrom];
      b[rookFrom] = '.';
    }
    return { b, captured };
  }

  function legal(s) {
    return pseudo(s).filter((m) => !inCheck(makeBoard(s, m).b, s.turn));
  }
  const text = ([from, to, promo]) => name(from) + name(to) + promo;
  function parseMove(m) {
    if (typeof m !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)) return null;
    return [parseSq(m.slice(0, 2)), parseSq(m.slice(2, 4)), m[4] || ''];
  }

  function moves(s) {
    if (s.result) return [];
    return legal(s).map(text);
  }

  function isLegal(s, m) {
    return !s.result && typeof m === 'string' && moves(s).includes(m);
  }

  function hasLegal(s) {
    for (const m of pseudo(s)) if (!inCheck(makeBoard(s, m).b, s.turn)) return true;
    return false;
  }

  // só sobrou rei (e no máximo um bispo ou um cavalo): ninguém consegue dar mate
  function insufficient(board) {
    const minor = [];
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p === '.' || p === 'K' || p === 'k') continue;
      const t = p.toUpperCase();
      if (t !== 'B' && t !== 'N') return false;
      minor.push([t, (Math.floor(i / 8) + (i % 8)) % 2]);
    }
    if (minor.length <= 1) return true;
    // só bispos, todos na mesma cor de casa
    return minor.every(([t]) => t === 'B') && minor.every(([, col]) => col === minor[0][1]);
  }

  const CORNER = { 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };
  function play(s, m) {
    const mv = typeof m === 'string' ? parseMove(m) : m;
    if (!mv) throw new Error('lance inválido');
    const [from, to] = mv;
    const p = s.board[from];
    const { b, captured } = makeBoard(s, mv);
    let castle = s.castle;
    if (p === 'K') castle = castle.replace(/[KQ]/g, '');
    if (p === 'k') castle = castle.replace(/[kq]/g, '');
    for (const sq of [from, to]) if (CORNER[sq]) castle = castle.replace(CORNER[sq], '');
    const t = p.toUpperCase();
    // casa de en passant só quando um peão do outro lado pode mesmo capturar
    // (senão a mesma posição contaria como diferente nas 3 repetições)
    const enemyPawn = s.turn === 0 ? 'p' : 'P';
    const nextTo = (d) => (to % 8) + d >= 0 && (to % 8) + d < 8 && b[to + d] === enemyPawn;
    const ep = t === 'P' && Math.abs(to - from) === 16 && (nextTo(-1) || nextTo(1)) ? (from + to) / 2 : -1;
    const irreversible = t === 'P' || captured !== '.';
    const next = {
      v: s.v, board: b, turn: 1 - s.turn, castle, ep, half: irreversible ? 0 : s.half + 1, ply: s.ply + 1,
      hist: null, last: [from, to], check: false, result: null,
    };
    const k = key(next);
    next.hist = irreversible ? [k] : s.hist.concat(k);
    next.check = inCheck(b, next.turn);
    if (!hasLegal(next)) next.result = next.check ? { winner: s.turn, reason: 'mate' } : { winner: null, reason: 'afogamento' };
    else if (insufficient(b)) next.result = { winner: null, reason: 'material' };
    else if (next.hist.filter((x) => x === k).length >= 3) next.result = { winner: null, reason: 'repeticao' };
    else if (next.half >= 100) next.result = { winner: null, reason: '50lances' };
    return next;
  }

  // ---------------- o robô: avaliação e ordem dos lances ----------------
  const VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  // tabelas de posição (do lado das brancas, linha 0 = 8ª fileira)
  const PST = {
    P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    // no fim de jogo o rei vai para o centro (e empurrar o rei inimigo para o canto)
    KE: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };

  // nota para quem joga agora (positivo = bom para ele)
  function evaluate(s) {
    const b = s.board;
    let material = 0;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p !== '.' && p !== 'K' && p !== 'k' && p.toUpperCase() !== 'P') material += VALUE[p.toUpperCase()];
    }
    const endgame = material <= 1300;
    let score = 0;
    let wk = -1;
    let bk = -1;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p === '.') continue;
      const t = p.toUpperCase();
      const W = p === t;
      const table = t === 'K' && endgame ? PST.KE : PST[t];
      const v = VALUE[t] + table[W ? i : (7 - Math.floor(i / 8)) * 8 + (i % 8)];
      score += W ? v : -v;
      if (p === 'K') wk = i;
      if (p === 'k') bk = i;
    }
    // fim de jogo com vantagem: aproximar os reis ajuda a dar o mate
    if (endgame && wk >= 0 && bk >= 0 && Math.abs(score) > 300) {
      const dist = Math.abs(Math.floor(wk / 8) - Math.floor(bk / 8)) + Math.abs((wk % 8) - (bk % 8));
      score += (score > 0 ? 1 : -1) * (14 - dist) * 6;
    }
    if (s.check) score += s.turn === 0 ? -20 : 20;
    return s.turn === 0 ? score : -score;
  }

  // capturas primeiro (vítima valiosa com atacante barato), depois promoções
  function order(s, list) {
    const score = (m) => {
      const from = parseSq(m.slice(0, 2));
      const to = parseSq(m.slice(2, 4));
      const victim = s.board[to];
      let v = victim !== '.' ? 10 * VALUE[victim.toUpperCase()] + 100 - VALUE[s.board[from].toUpperCase()] / 10 : 0;
      if (m.length === 5) v += m[4] === 'q' ? 9000 : 100;
      return v;
    };
    return list.map((m) => [m, score(m)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  }

  // para a busca de capturas do robô (no fim da busca, só capturas e promoções)
  function captures(s) {
    if (s.result) return [];
    return order(s, pseudo(s, true).filter((m) => !inCheck(makeBoard(s, m).b, s.turn)).map(text));
  }

  // casas das peças de `seat` que o adversário está atacando (ajuda opcional)
  function threatened(s, seat) {
    const out = [];
    for (let i = 0; i < 64; i++) {
      const p = s.board[i];
      if (p !== '.' && colorOf(p) === seat && p.toUpperCase() !== 'K' && attacked(s.board, i, 1 - seat)) out.push(i);
    }
    return out;
  }

  const api = {
    id: 'xadrez', VARIANTS, POSITIONS, START, FILES,
    initial, fromFen, moves, isLegal, play, evaluate, order, captures, threatened,
    name, parseSq, parseMove, colorOf, inCheck, attacked, legal, text,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.XadrezRules = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
