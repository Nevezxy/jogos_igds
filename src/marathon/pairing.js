// src/marathon/pairing.js
// 🏃 Modo Maratona: quem enfrenta quem (PLANO_MARATONA.md, 3.6). Puro.
//   • até 8 lados: todos contra todos pelo "método do círculo" (em n − 1
//     rodadas ninguém repete adversário; com número ímpar, um lado
//     "fantasma" = descanso)
//   • mais de 8: suíço (pela classificação, o mais próximo que ainda não
//     enfrentou; o descanso vai para o pior colocado que ainda não descansou)
//   • Duas Equipes: sempre A × B
// Um par é [a, b]; b = null é descanso de a.

const ROUND_ROBIN_MAX = 8;

// rodada r (0, 1, 2...) do todos contra todos, com os lados na ordem dada
function roundRobin(sides, r) {
  const list = sides.slice();
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rounds = n - 1;
  const k = ((r % rounds) + rounds) % rounds;
  // o primeiro fica parado; os outros giram k vezes
  const rest = list.slice(1);
  const rot = rest.slice(rest.length - k).concat(rest.slice(0, rest.length - k));
  const ring = [list[0], ...rot];
  const pairs = [];
  for (let i = 0; i < n / 2; i++) {
    const a = ring[i];
    const b = ring[n - 1 - i];
    // alterna quem fica "à esquerda" para ninguém ser sempre o lado A
    const pair = (r + i) % 2 ? [b, a] : [a, b];
    if (pair[0] === null) pairs.push([pair[1], null]);
    else pairs.push(pair);
  }
  return pairs;
}

// suíço: standings = ids do melhor para o pior; played = Set de "a|b"; byes = Set de quem já descansou
const key = (a, b) => (String(a) < String(b) ? `${a}|${b}` : `${b}|${a}`);
function swiss(standings, played, byes) {
  const left = standings.slice();
  const pairs = [];
  if (left.length % 2) {
    // descanso: o pior colocado que ainda não descansou (se todos já, o último)
    let idx = -1;
    for (let i = left.length - 1; i >= 0; i--) if (!byes.has(left[i])) { idx = i; break; }
    if (idx < 0) idx = left.length - 1;
    pairs.push([left[idx], null]);
    left.splice(idx, 1);
  }
  // emparelha de cima para baixo, com volta atrás; primeiro sem nenhuma
  // revanche e, se não houver jeito, deixando revanche (as novas primeiro)
  // (com um limite de tentativas: com 40 lados a volta atrás poderia demorar)
  let budget = 0;
  function solve(rest, rematch) {
    if (!rest.length) return [];
    if (++budget > 20000 && !rematch) return null;
    const [a, ...others] = rest;
    const fresh = others.filter((b) => !played.has(key(a, b)));
    const options = rematch ? fresh.concat(others.filter((x) => played.has(key(a, x)))) : fresh;
    for (const b of options) {
      const sub = solve(others.filter((x) => x !== b), rematch);
      if (sub) return [[a, b], ...sub];
    }
    return null;
  }
  const strict = solve(left, false);
  budget = 0;
  return pairs.concat(strict || solve(left, true));
}

// pares da rodada `round` (0, 1, ...). ctx: { formato, order (ids na ordem
// fixa do sorteio inicial), standings (ids do melhor ao pior), played, byes }
function pairRound(round, { formato, order, standings, played = new Set(), byes = new Set() }) {
  if (formato === 'duas') return [[order[0], order[1]]];
  if (order.length <= ROUND_ROBIN_MAX) return roundRobin(order, round);
  return swiss(standings || order, played, byes);
}

module.exports = { ROUND_ROBIN_MAX, roundRobin, swiss, pairRound, key };
