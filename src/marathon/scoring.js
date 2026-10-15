// src/marathon/scoring.js
// 🏃 Modo Maratona: quem vence cada confronto e a classificação
// (PLANO_MARATONA.md, 3.4 e 3.5). Puro: a classificação é sempre
// calculada a partir dos confrontos resolvidos (dá para auditar refazendo).
//
// Corrida: a nota de cada lado é a média das notas dos integrantes
// escalados (ausente ou tempo esgotado = 0; dispensado não entra). Vence a
// maior se a diferença for de 4 ou mais; senão, o menor tempo médio (se
// passar de 10%); senão, empate.
// Duelo (tabuleiro): cada integrante joga contra um do outro lado; vence
// quem ganhou mais partidas; empate em vitórias = empate.
// Pontos: vitória 3, empate 1, derrota 0, descanso 1, W.O. 3 (o lado todo
// ausente perde por W.O.; os dois ausentes = 0 para os dois). Bônus opcional
// de perfeição: +1 para o lado da corrida com média de 3 ⭐.

const PONTOS = { vitoria: 3, empate: 1, derrota: 0, descanso: 1, wo: 3 };
const MARGEM_NOTA = 4;
const MARGEM_TEMPO = 0.1;

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

// entries de um lado: [{ status, score, timeMs, stars }]
function sideRace(entries) {
  const counted = entries.filter((e) => e.status !== 'dispensado' && e.status !== 'descanso');
  const done = counted.filter((e) => e.status === 'concluida');
  return {
    nota: Math.round(mean(counted.map((e) => (e.status === 'concluida' ? e.score : 0))) * 10) / 10,
    tempo: done.length ? mean(done.map((e) => e.timeMs)) : null,
    estrelas: counted.length ? mean(counted.map((e) => (e.status === 'concluida' ? e.stars : 0))) : 0,
    presentes: counted.filter((e) => e.status !== 'ausente').length,
    total: counted.length,
  };
}

// resultado de uma corrida: { outcome: 'a' | 'b' | 'empate' | 'wo_a' | 'wo_b' | 'nulo', a, b }
function decideRace(entriesA, entriesB) {
  const a = sideRace(entriesA);
  const b = sideRace(entriesB);
  const absentA = a.total > 0 && a.presentes === 0;
  const absentB = b.total > 0 && b.presentes === 0;
  if (absentA && absentB) return { outcome: 'nulo', a, b };
  if (absentA) return { outcome: 'wo_b', a, b };
  if (absentB) return { outcome: 'wo_a', a, b };
  let outcome = 'empate';
  if (a.nota - b.nota >= MARGEM_NOTA) outcome = 'a';
  else if (b.nota - a.nota >= MARGEM_NOTA) outcome = 'b';
  else if (a.tempo != null && b.tempo != null) {
    if (a.tempo < b.tempo * (1 - MARGEM_TEMPO)) outcome = 'a';
    else if (b.tempo < a.tempo * (1 - MARGEM_TEMPO)) outcome = 'b';
  }
  return { outcome, a, b };
}

// duelos: boards = [{ winner: 'a' | 'b' | null, absentA, absentB }]
function decideDuels(boards) {
  const wa = boards.filter((x) => x.winner === 'a').length;
  const wb = boards.filter((x) => x.winner === 'b').length;
  const allAbsentA = boards.length && boards.every((x) => x.absentA);
  const allAbsentB = boards.length && boards.every((x) => x.absentB);
  if (allAbsentA && allAbsentB) return { outcome: 'nulo', a: { vitorias: 0 }, b: { vitorias: 0 } };
  if (allAbsentA) return { outcome: 'wo_b', a: { vitorias: wa }, b: { vitorias: wb } };
  if (allAbsentB) return { outcome: 'wo_a', a: { vitorias: wa }, b: { vitorias: wb } };
  return { outcome: wa > wb ? 'a' : wb > wa ? 'b' : 'empate', a: { vitorias: wa }, b: { vitorias: wb } };
}

// pontos de cada lado por um confronto resolvido
function pointsFor(outcome, bonus = { a: 0, b: 0 }) {
  const P = PONTOS;
  const table = {
    a: [P.vitoria, P.derrota], b: [P.derrota, P.vitoria], empate: [P.empate, P.empate],
    wo_a: [P.wo, 0], wo_b: [0, P.wo], nulo: [0, 0], descanso: [P.descanso, 0],
  }[outcome] || [0, 0];
  return { a: table[0] + (bonus.a || 0), b: table[1] + (bonus.b || 0) };
}

// Classificação a partir dos confrontos resolvidos.
// teams: [{ id }]; matches: [{ sideA, sideB, outcome, scoreA, scoreB, bonusA, bonusB }]
// tiebreakRank: { teamId: número } do sorteio gravado (último critério)
function standings(teams, matches, tiebreakRank = {}) {
  const row = Object.fromEntries(teams.map((t) => [t.id, { id: t.id, pontos: 0, vitorias: 0, empates: 0, derrotas: 0, jogos: 0, notaPro: 0, notaContra: 0, descansos: 0 }]));
  const direct = {}; // "a|b" -> pontos de a contra b
  for (const m of matches) {
    if (!m.outcome || m.outcome === 'anulado') continue;
    const A = row[m.sideA];
    const B = m.sideB != null ? row[m.sideB] : null;
    if (!A) continue;
    if (m.outcome === 'descanso' || !B) { A.pontos += PONTOS.descanso; A.descansos++; continue; }
    const pts = pointsFor(m.outcome, { a: m.bonusA || 0, b: m.bonusB || 0 });
    A.pontos += pts.a;
    B.pontos += pts.b;
    A.jogos++; B.jogos++;
    const winA = m.outcome === 'a' || m.outcome === 'wo_a';
    const winB = m.outcome === 'b' || m.outcome === 'wo_b';
    if (winA) { A.vitorias++; B.derrotas++; } else if (winB) { B.vitorias++; A.derrotas++; } else if (m.outcome === 'empate') { A.empates++; B.empates++; }
    A.notaPro += m.scoreA || 0; A.notaContra += m.scoreB || 0;
    B.notaPro += m.scoreB || 0; B.notaContra += m.scoreA || 0;
    direct[`${m.sideA}|${m.sideB}`] = (direct[`${m.sideA}|${m.sideB}`] || 0) + pts.a;
    direct[`${m.sideB}|${m.sideA}`] = (direct[`${m.sideB}|${m.sideA}`] || 0) + pts.b;
  }
  const list = Object.values(row);
  list.forEach((r) => { r.saldo = Math.round((r.notaPro - r.notaContra) * 10) / 10; });
  list.sort((x, y) => y.pontos - x.pontos
    || y.saldo - x.saldo
    || (direct[`${y.id}|${x.id}`] || 0) - (direct[`${x.id}|${y.id}`] || 0)
    || y.vitorias - x.vitorias
    || (tiebreakRank[x.id] ?? 0) - (tiebreakRank[y.id] ?? 0));
  // posição (empate total divide a posição só se nem o sorteio separar: não acontece)
  list.forEach((r, i) => { r.posicao = i + 1; });
  return list;
}

module.exports = { PONTOS, MARGEM_NOTA, MARGEM_TEMPO, sideRace, decideRace, decideDuels, pointsFor, standings };
