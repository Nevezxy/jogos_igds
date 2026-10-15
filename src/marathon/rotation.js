// src/marathon/rotation.js
// 🏃 Modo Maratona: qual jogo e qual fase em cada rodada (PLANO_MARATONA.md,
// 3.7). Puro e determinístico: o sorteio usa um rng com semente (a da
// maratona + o número da rodada), então refazer dá o mesmo resultado.
//   ordem       a lista do professor (rodada r = item r; acabou, volta)
//   sequencial  os jogos escolhidos em ciclo
//   aleatorio   "saco": cada jogo sai uma vez antes de repetir; nunca o
//               mesmo jogo duas rodadas seguidas (se houver 2 ou mais)
//   votacao     3 opções do saco (sem o jogo da rodada anterior); vence a
//               maioria; empate = sorteio entre os empatados; sem votos = sorteio
//   professor   o professor escolhe na hora

const MODOS = ['ordem', 'sequencial', 'aleatorio', 'votacao', 'professor'];
const VOTE_OPTIONS = 3;

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

// o saco: os jogos que ainda não saíram desde o último "esvaziar"
function bag(games, history) {
  const counts = Object.fromEntries(games.map((g) => [g, 0]));
  for (const g of history) if (g in counts) counts[g]++;
  const min = Math.min(...Object.values(counts));
  return games.filter((g) => counts[g] === min);
}

function nextGame({ modo, games, ordem = [], history = [], rng }) {
  const r = history.length;
  const last = history[history.length - 1];
  if (modo === 'ordem') { const list = ordem.length ? ordem : games; return list[r % list.length]; }
  if (modo === 'sequencial') return games[r % games.length];
  if (modo === 'aleatorio') {
    let options = bag(games, history);
    if (games.length > 1 && options.length > 1) options = options.filter((g) => g !== last);
    if (games.length > 1 && options.length === 1 && options[0] === last) options = games.filter((g) => g !== last);
    return pick(options, rng);
  }
  return null; // votacao e professor: decidido de outro jeito
}

// opções da votação (até 3), sem o jogo da rodada anterior quando der
function voteOptions({ games, history = [], rng }) {
  const last = history[history.length - 1];
  let pool = games.length > 1 ? games.filter((g) => g !== last) : games.slice();
  const fresh = bag(pool, history);
  const out = [];
  const take = (list) => {
    const l = list.filter((g) => !out.includes(g));
    while (out.length < VOTE_OPTIONS && l.length) out.push(l.splice(Math.floor(rng() * l.length), 1)[0]);
  };
  take(fresh);
  take(pool);
  pool = null;
  return out;
}

// votos: { studentId: gameId } -> { winner, counts, tie }
function tally(votes, options, rng) {
  const counts = Object.fromEntries(options.map((g) => [g, 0]));
  for (const g of Object.values(votes || {})) if (g in counts) counts[g]++;
  const max = Math.max(...Object.values(counts));
  const top = options.filter((g) => counts[g] === max);
  return { winner: top.length === 1 ? top[0] : pick(top, rng), counts, tie: top.length > 1, votes: Object.keys(votes || {}).length };
}

// a fase da rodada: das que podem cair, uma que ainda não saiu; acabaram,
// a menos usada (outra semente faz a rodada ser outra)
function nextLevel(entries, usedKeys, rng) {
  if (!entries.length) return null;
  const counts = {};
  for (const k of usedKeys) counts[k] = (counts[k] || 0) + 1;
  const min = Math.min(...entries.map((e) => counts[e.key] || 0));
  return pick(entries.filter((e) => (counts[e.key] || 0) === min), rng);
}

module.exports = { MODOS, VOTE_OPTIONS, nextGame, voteOptions, tally, nextLevel, bag };
