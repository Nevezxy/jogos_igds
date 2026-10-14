// public/games/dama/rules.js
// Regras da ⚫⚪ Dama brasileira (oficial). Fonte única: navegador, robô (Web
// Worker) e servidor.
//   • tabuleiro 8 × 8, só as casas escuras; 12 peças de cada lado; as
//     brancas começam (de baixo para cima)
//   • a pedra anda 1 casa na diagonal para a frente e captura para a frente
//     e para trás
//   • a dama anda quantas casas quiser na diagonal ("dama voadora") e captura
//     de longe, parando em qualquer casa livre depois da peça capturada
//   • captura obrigatória, com a lei da maioria: é preciso fazer a sequência
//     que captura mais peças
//   • as peças capturadas só saem no fim da sequência e não podem ser
//     puladas duas vezes (ficam no caminho)
//   • a pedra que só passa pela última fileira no meio de uma captura não
//     vira dama (só vira se terminar lá)
//   • empate: 20 lances seguidos de cada lado só com damas, sem captura
//   • perde quem não tem lance (sem peças ou todas presas)
//   casa = linha * 8 + coluna, linha 0 em cima (lado das pretas); casas
//   escuras: (linha + coluna) ímpar
//   peças: 'w' pedra branca, 'W' dama branca, 'b' pedra preta, 'B' dama preta
//   estado: { v, board, turn (0 brancas, 1 pretas), ply, kingPlies, last,
//             captured, result }
//   lance: o caminho [de, casa1, casa2, ...] (numa captura, cada casa onde
//          a peça pousa)

(function (root) {
  const VARIANTS = { brasileira: { label: 'Dama brasileira' } };
  const DRAW_PLIES = 40; // 20 lances de cada lado
  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  const sideOf = (p) => (p === 'w' || p === 'W' ? 0 : p === 'b' || p === 'B' ? 1 : -1);
  const isKing = (p) => p === 'W' || p === 'B';
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  function initial(v = 'brasileira') {
    if (!Object.prototype.hasOwnProperty.call(VARIANTS, String(v))) throw new Error('variante desconhecida');
    const board = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) board.push((r + c) % 2 === 1 ? (r < 3 ? 'b' : r > 4 ? 'w' : '.') : '.');
    return { v: String(v), board, turn: 0, ply: 0, kingPlies: 0, last: null, captured: [], result: null };
  }

  // todas as sequências de captura a partir de `sq` (cada uma: { path, taken })
  function captureSeqs(board, sq, piece) {
    const side = sideOf(piece);
    const king = isKing(piece);
    const out = [];
    function go(at, path, taken) {
      const r = Math.floor(at / 8);
      const c = at % 8;
      let extended = false;
      for (const [dr, dc] of DIRS) {
        let rr = r + dr;
        let cc = c + dc;
        if (king) while (inside(rr, cc) && board[rr * 8 + cc] === '.') { rr += dr; cc += dc; }
        if (!inside(rr, cc)) continue;
        const mid = rr * 8 + cc;
        const q = board[mid];
        if (q === '.' || sideOf(q) === side || taken.includes(mid)) continue;
        // casas para pousar depois da peça (a dama pode ir longe)
        let lr = rr + dr;
        let lc = cc + dc;
        while (inside(lr, lc) && board[lr * 8 + lc] === '.') {
          extended = true;
          const land = lr * 8 + lc;
          go(land, path.concat(land), taken.concat(mid));
          if (!king) break;
          lr += dr;
          lc += dc;
        }
      }
      if (!extended && taken.length) out.push({ path, taken });
    }
    // a peça sai da casa de origem: ela fica livre durante a sequência
    const b = board;
    const saved = b[sq];
    b[sq] = '.';
    try { go(sq, [sq], []); } finally { b[sq] = saved; }
    return out;
  }

  // todos os lances de quem joga: com a lei da maioria
  function allMoves(s) {
    const board = s.board.slice();
    const side = s.turn;
    let caps = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (sideOf(p) !== side) continue;
      caps = caps.concat(captureSeqs(board, sq, p));
    }
    if (caps.length) {
      const most = Math.max(...caps.map((x) => x.taken.length));
      return caps.filter((x) => x.taken.length === most);
    }
    const out = [];
    const forward = side === 0 ? -1 : 1;
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (sideOf(p) !== side) continue;
      const r = Math.floor(sq / 8);
      const c = sq % 8;
      for (const [dr, dc] of DIRS) {
        if (!isKing(p) && dr !== forward) continue;
        let rr = r + dr;
        let cc = c + dc;
        while (inside(rr, cc) && board[rr * 8 + cc] === '.') {
          out.push({ path: [sq, rr * 8 + cc], taken: [] });
          if (!isKing(p)) break;
          rr += dr;
          cc += dc;
        }
      }
    }
    return out;
  }

  function moves(s) {
    if (s.result) return [];
    return allMoves(s).map((x) => x.path);
  }

  const same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
  function find(s, m) {
    if (s.result || !Array.isArray(m) || m.length < 2 || m.length > 20 || !m.every((x) => Number.isInteger(x))) return null;
    return allMoves(s).find((x) => same(m, x.path)) || null;
  }
  const isLegal = (s, m) => Boolean(find(s, m));

  function play(s, m) {
    const mv = find(s, m);
    if (!mv) throw new Error('lance inválido');
    const board = s.board.slice();
    const from = mv.path[0];
    const to = mv.path[mv.path.length - 1];
    let p = board[from];
    board[from] = '.';
    for (const t of mv.taken) board[t] = '.';
    const lastRow = s.turn === 0 ? 0 : 7;
    const wasKing = isKing(p);
    if (!wasKing && Math.floor(to / 8) === lastRow) p = p.toUpperCase();
    board[to] = p;
    const next = {
      v: s.v, board, turn: 1 - s.turn, ply: s.ply + 1,
      kingPlies: wasKing && !mv.taken.length ? s.kingPlies + 1 : 0,
      last: mv.path.slice(), captured: mv.taken.slice(), result: null,
    };
    if (!allMoves(next).length) next.result = { winner: s.turn, reason: board.some((q) => sideOf(q) === next.turn) ? 'presas' : 'sem pecas' };
    else if (next.kingPlies >= DRAW_PLIES) next.result = { winner: null, reason: 'damas' };
    return next;
  }

  // ---------------- o robô ----------------
  // nota para quem joga agora: material (dama vale ~3 pedras), pedras
  // avançadas, a fileira de trás guardada e o centro
  function evaluate(s) {
    let score = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = s.board[sq];
      if (p === '.') continue;
      const side = sideOf(p);
      const r = Math.floor(sq / 8);
      const c = sq % 8;
      let v;
      if (isKing(p)) v = 330;
      else {
        const adv = side === 0 ? 7 - r : r; // quanto já andou
        v = 100 + adv * 5 + (adv === 0 ? 8 : 0);
      }
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 6;
      score += side === s.turn ? v : -v;
    }
    return score;
  }

  // casas das peças que podem (ou precisam) jogar
  function movable(s) {
    return [...new Set(moves(s).map((m) => m[0]))];
  }

  const api = { id: 'dama', VARIANTS, DRAW_PLIES, initial, moves, isLegal, play, evaluate, movable, allMoves, sideOf, isKing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DamaRules = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
