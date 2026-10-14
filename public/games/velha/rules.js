// public/games/velha/rules.js
// Regras do ❌⭕ Jogo da Velha. Fonte única: o navegador desenha e joga, o
// robô (js/shared/bot.js) pensa com elas e o servidor confere cada lance
// das partidas pela rede e das rodadas contra o computador.
//   variantes: '3x3' (3 em linha) e '4x4' (4 em linha)
//   estado: { v, n, k, board: [null | 0 | 1], turn, ply, last, result }
//   lance: o número da casa (0 até n² − 1)
//   result: { winner: 0 | 1 | null (velha), line: [casas] } quando acaba

(function (root) {
  const VARIANTS = {
    '3x3': { n: 3, k: 3, label: '3 × 3' },
    '4x4': { n: 4, k: 4, label: '4 × 4 (4 em linha)' },
  };

  // todas as linhas de k casas seguidas (linhas, colunas e diagonais)
  const LINES = {};
  for (const [id, { n, k }] of Object.entries(VARIANTS)) {
    const lines = [];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        for (const [dr, dc] of dirs) {
          const cells = [];
          for (let i = 0; i < k; i++) {
            const rr = r + dr * i;
            const cc = c + dc * i;
            if (rr < 0 || rr >= n || cc < 0 || cc >= n) break;
            cells.push(rr * n + cc);
          }
          if (cells.length === k) lines.push(cells);
        }
      }
    }
    LINES[id] = lines;
  }

  function initial(v = '3x3') {
    const cfg = VARIANTS[v];
    if (!cfg) throw new Error('variante desconhecida');
    return { v, n: cfg.n, k: cfg.k, board: Array(cfg.n * cfg.n).fill(null), turn: 0, ply: 0, last: null, result: null };
  }

  function moves(s) {
    if (s.result) return [];
    const out = [];
    for (let i = 0; i < s.board.length; i++) if (s.board[i] === null) out.push(i);
    return out;
  }

  function isLegal(s, m) {
    return !s.result && Number.isInteger(m) && m >= 0 && m < s.board.length && s.board[m] === null;
  }

  function play(s, m) {
    if (!isLegal(s, m)) throw new Error('lance inválido');
    const board = s.board.slice();
    board[m] = s.turn;
    const next = { ...s, board, turn: 1 - s.turn, ply: s.ply + 1, last: m, result: null };
    for (const line of LINES[s.v]) {
      if (line.includes(m) && line.every((i) => board[i] === s.turn)) {
        next.result = { winner: s.turn, line };
        return next;
      }
    }
    if (next.ply === board.length) next.result = { winner: null, line: [] };
    return next;
  }

  // Nota para quem joga agora: linhas ainda possíveis, pesando as quase
  // completas (usada pelo robô no 4 × 4, onde não dá para pensar até o fim).
  function evaluate(s) {
    const me = s.turn;
    let score = 0;
    for (const line of LINES[s.v]) {
      let mine = 0;
      let theirs = 0;
      for (const i of line) {
        if (s.board[i] === me) mine++;
        else if (s.board[i] !== null) theirs++;
      }
      if (mine && !theirs) score += 4 ** mine;
      else if (theirs && !mine) score -= 4 ** theirs * 1.2;
    }
    return score;
  }

  // o meio e os cantos primeiro: a poda fica bem melhor
  function order(s, ms) {
    const c = (s.n - 1) / 2;
    return ms.slice().sort((a, b) => {
      const da = Math.abs(Math.floor(a / s.n) - c) + Math.abs((a % s.n) - c);
      const db = Math.abs(Math.floor(b / s.n) - c) + Math.abs((b % s.n) - c);
      return da - db;
    });
  }

  const api = { id: 'velha', VARIANTS, LINES, initial, moves, isLegal, play, evaluate, order };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VelhaRules = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
