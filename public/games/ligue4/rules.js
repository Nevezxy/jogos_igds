// public/games/ligue4/rules.js
// Regras do 🔴🟡 Ligue 4 (e Ligue 5). As peças caem na coluna escolhida e
// param na casa livre mais baixa; ganha quem alinhar k peças (na linha, na
// coluna ou na diagonal). Fonte única: navegador, robô e servidor.
//   variantes: '4' (7 colunas × 6 linhas, 4 em linha) e '5' (9 × 7, 5 em linha)
//   estado: { v, cols, rows, k, board: [null | 0 | 1] (casa = col * rows + linha,
//             linha 0 embaixo), heights, turn, ply, last, result }
//   lance: o número da coluna
//   result: { winner: 0 | 1 | null (empate), line: [casas] }

(function (root) {
  const VARIANTS = {
    4: { cols: 7, rows: 6, k: 4, label: 'Ligue 4 (7 × 6)' },
    5: { cols: 9, rows: 7, k: 5, label: 'Ligue 5 (9 × 7)' },
  };

  // janelas de k casas seguidas, para avaliar a posição (calculadas uma vez)
  const WINDOWS = {};
  for (const [id, { cols, rows, k }] of Object.entries(VARIANTS)) {
    const out = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const cells = [];
          for (let i = 0; i < k; i++) {
            const cc = c + dc * i;
            const rr = r + dr * i;
            if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) break;
            cells.push(cc * rows + rr);
          }
          if (cells.length === k) out.push(cells);
        }
      }
    }
    WINDOWS[id] = out;
  }

  function initial(v = '4') {
    v = String(v);
    const cfg = VARIANTS[v];
    if (!cfg) throw new Error('variante desconhecida');
    return {
      v, cols: cfg.cols, rows: cfg.rows, k: cfg.k,
      board: Array(cfg.cols * cfg.rows).fill(null), heights: Array(cfg.cols).fill(0),
      turn: 0, ply: 0, last: null, result: null,
    };
  }

  function moves(s) {
    if (s.result) return [];
    const out = [];
    for (let c = 0; c < s.cols; c++) if (s.heights[c] < s.rows) out.push(c);
    return out;
  }

  function isLegal(s, col) {
    return !s.result && Number.isInteger(col) && col >= 0 && col < s.cols && s.heights[col] < s.rows;
  }

  // a sequência que passa pela casa (c, r) numa direção, com a própria casa
  function lineThrough(board, s, c, r, dc, dr, who) {
    const cells = [c * s.rows + r];
    for (const sign of [1, -1]) {
      let cc = c + dc * sign;
      let rr = r + dr * sign;
      while (cc >= 0 && cc < s.cols && rr >= 0 && rr < s.rows && board[cc * s.rows + rr] === who) {
        cells.push(cc * s.rows + rr);
        cc += dc * sign;
        rr += dr * sign;
      }
    }
    return cells;
  }

  function play(s, col) {
    if (!isLegal(s, col)) throw new Error('lance inválido');
    const board = s.board.slice();
    const heights = s.heights.slice();
    const r = heights[col]++;
    const cell = col * s.rows + r;
    board[cell] = s.turn;
    const next = { ...s, board, heights, turn: 1 - s.turn, ply: s.ply + 1, last: cell, result: null };
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const line = lineThrough(board, s, col, r, dc, dr, s.turn);
      if (line.length >= s.k) {
        next.result = { winner: s.turn, line };
        return next;
      }
    }
    if (next.ply === board.length) next.result = { winner: null, line: [] };
    return next;
  }

  // Nota para quem joga agora: janelas abertas (só com peças de um lado),
  // pesando as quase completas, e um bônus para a coluna do meio.
  const WEIGHTS = [0, 1, 6, 40, 300, 2000];
  function evaluate(s) {
    const me = s.turn;
    let score = 0;
    for (const w of WINDOWS[s.v]) {
      let mine = 0;
      let theirs = 0;
      for (const i of w) {
        const p = s.board[i];
        if (p === me) mine++;
        else if (p !== null) theirs++;
      }
      if (mine && !theirs) score += WEIGHTS[mine];
      else if (theirs && !mine) score -= WEIGHTS[theirs] * 1.1;
    }
    const mid = Math.floor(s.cols / 2);
    for (let r = 0; r < s.heights[mid]; r++) {
      const p = s.board[mid * s.rows + r];
      score += p === me ? 3 : -3;
    }
    return score;
  }

  // colunas do meio primeiro
  function order(s, ms) {
    const mid = (s.cols - 1) / 2;
    return ms.slice().sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  }

  // casas onde o jogador `who` ganharia jogando agora (para a ajuda "ameaça")
  function threats(s, who) {
    const out = [];
    for (const col of moves(s)) {
      const r = s.heights[col];
      const board = s.board.slice();
      board[col * s.rows + r] = who;
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        if (lineThrough(board, s, col, r, dc, dr, who).length >= s.k) { out.push(col); break; }
      }
    }
    return out;
  }

  const api = { id: 'ligue4', VARIANTS, WINDOWS, initial, moves, isLegal, play, evaluate, order, threats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ligue4Rules = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
