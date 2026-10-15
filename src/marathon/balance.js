// src/marathon/balance.js
// 🏃 Modo Maratona: equipes (PLANO_MARATONA.md, seção 4). Funções puras.
//   • força de cada educando: percentil dos pontos globais entre os da sala;
//     quem quase não jogou (menos de 5 fases) fica com a mediana (50), para
//     não começar em desvantagem
//   • formar equipes: serpentina por força + trocas que diminuem a diferença
//     entre a maior e a menor média (desempate: menor variância)
//   • quem chega depois: a equipe com menos gente (empate: a mais fraca)

const FORMATOS = {
  solo: { size: 1, label: 'Solo' },
  dupla: { size: 2, label: 'Dupla' },
  trio: { size: 3, label: 'Trio' },
  quarteto: { size: 4, label: 'Quarteto' },
  duas: { size: null, label: 'Duas Equipes' },
};
const NEWCOMER_LEVELS = 5;
const MAX_ITER = 2000;

class BalanceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// participantes: [{ id, points, levelsDone }] -> { id: força 0..100 }
function strengths(list) {
  const out = {};
  const ranked = list.filter((p) => (p.levelsDone || 0) >= NEWCOMER_LEVELS).sort((a, b) => a.points - b.points);
  ranked.forEach((p, i) => {
    // percentil médio (empates recebem o mesmo valor)
    const lower = ranked.filter((q) => q.points < p.points).length;
    const equal = ranked.filter((q) => q.points === p.points).length;
    out[p.id] = ranked.length === 1 ? 50 : Math.round(((lower + (equal - 1) / 2) / (ranked.length - 1)) * 1000) / 10;
    void i;
  });
  for (const p of list) if (out[p.id] == null) out[p.id] = 50;
  return out;
}

// quantas equipes e de que tamanho, ou erro quando não dá
function plan(n, formato) {
  const f = FORMATOS[formato];
  if (!f) throw new BalanceError('FORMATO_INVALIDO', 'Formato desconhecido.');
  if (formato === 'solo') {
    if (n < 2) throw new BalanceError('POUCOS_EDUCANDOS', 'São precisos pelo menos 2 educandos.');
    return { teams: n };
  }
  if (formato === 'duas') {
    if (n < 2) throw new BalanceError('POUCOS_EDUCANDOS', 'São precisos pelo menos 2 educandos.');
    return { teams: 2 };
  }
  if (n < 2 * f.size) throw new BalanceError('POUCOS_EDUCANDOS', `Poucos educandos para ${f.label}: são precisos pelo menos ${2 * f.size}. Use um formato menor.`);
  return { teams: Math.floor(n / f.size) };
}

const avg = (team, st) => team.reduce((s, id) => s + st[id], 0) / team.length;
function spread(teams, st) {
  const a = teams.map((t) => avg(t, st));
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  return { range: Math.max(...a) - Math.min(...a), variance: a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length };
}

// players: [{ id, name, strength }] -> [[ids], ...] (determinístico)
function form(players, formato) {
  const { teams: k } = plan(players.length, formato);
  const st = Object.fromEntries(players.map((p) => [p.id, p.strength]));
  const order = players.slice().sort((a, b) => b.strength - a.strength || String(a.name).localeCompare(String(b.name), 'pt-BR') || String(a.id).localeCompare(String(b.id)));
  const teams = Array.from({ length: k }, () => []);
  // serpentina: 1..k, k..1, 1..k... (quem sobra cai um por equipe, então
  // os tamanhos ficam s ou s + 1)
  order.forEach((p, i) => {
    const round = Math.floor(i / k);
    const pos = i % k;
    teams[round % 2 === 0 ? pos : k - 1 - pos].push(p.id);
  });
  if (k < 2 || formato === 'solo') return teams;
  // trocas que diminuem a diferença entre as médias
  let cur = spread(teams, st);
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let best = null;
    for (let a = 0; a < k; a++) {
      for (let b = a + 1; b < k; b++) {
        for (let i = 0; i < teams[a].length; i++) {
          for (let j = 0; j < teams[b].length; j++) {
            [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
            const s = spread(teams, st);
            [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
            if (s.range < cur.range - 1e-9 || (Math.abs(s.range - cur.range) < 1e-9 && s.variance < cur.variance - 1e-9)) {
              if (!best || s.range < best.s.range - 1e-9 || (Math.abs(s.range - best.s.range) < 1e-9 && s.variance < best.s.variance - 1e-9)) best = { a, b, i, j, s };
            }
          }
        }
      }
    }
    if (!best) break;
    [teams[best.a][best.i], teams[best.b][best.j]] = [teams[best.b][best.j], teams[best.a][best.i]];
    cur = best.s;
  }
  return teams;
}

// sorteio simples (o professor pediu "🎲 Sortear"): rng() de 0 a 1
function shuffle(players, formato, rng) {
  const { teams: k } = plan(players.length, formato);
  const ids = players.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const teams = Array.from({ length: k }, () => []);
  ids.forEach((id, i) => teams[i % k].push(id));
  return teams;
}

// quem chega depois: índice da equipe com menos gente (empate: menor força média)
function lateTeam(teams, st) {
  let best = 0;
  teams.forEach((t, i) => {
    const b = teams[best];
    if (t.length < b.length || (t.length === b.length && (t.length ? avg(t, st) : 0) < (b.length ? avg(b, st) : 0))) best = i;
  });
  return best;
}

module.exports = { FORMATOS, NEWCOMER_LEVELS, BalanceError, strengths, plan, form, shuffle, lateTeam, spread };
