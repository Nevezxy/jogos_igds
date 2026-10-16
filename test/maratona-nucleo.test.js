// test/maratona-nucleo.test.js
// 🏃 Modo Maratona, fase 4: o núcleo no servidor, sem interface.
//   • regras puras: equipes equilibradas, pareamentos (todos contra todos,
//     suíço, descanso), rotação (saco, votação), pontuação e classificação
//   • o gerenciador com relógio de mentira: criar, entrar, montar equipes,
//     começar, rodadas de corrida (resultado validado, nota, vitória,
//     prazo), votação, duelo de tabuleiro pela rede, quem entra depois,
//     dispensar, permissões, configuração travada, fim com o pódio salvo e a
//     retomada depois de "reiniciar o servidor" (outro gerenciador no mesmo banco)

const os = require('os');
const path = require('path');
const fs = require('fs');

const DB = path.join(os.tmpdir(), `igds-nucleo-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILE = DB;

const registry = require('../src/games/registry');
const accounts = require('../src/platform/accounts');
const { db } = require('../src/platform/db');
const { createMatchManager } = require('../src/platform/match');
const B = require('../src/marathon/balance');
const PR = require('../src/marathon/pairing');
const RO = require('../src/marathon/rotation');
const SC = require('../src/marathon/scoring');
const store = require('../src/marathon/store');
const { createMarathonManager, PREP_MS } = require('../src/marathon/manager');
const { rng } = require('../public/js/shared/rng.js');
const T = require('../public/games/carrinhos/traffic.js');
const H = require('../public/games/hanoi/hanoi.js');
const L = (id) => require(`../public/games/${id}/levels.js`);

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const throwsCode = (fn) => { try { fn(); return null; } catch (e) { return e.code || e.message; } };

// ---------------- regras puras ----------------
function checkBalance() {
  const ex = B.form([{ id: 'A', name: 'A', strength: 950 }, { id: 'B', name: 'B', strength: 820 }, { id: 'C', name: 'C', strength: 600 }, { id: 'D', name: 'D', strength: 450 }], 'dupla');
  assert(JSON.stringify(ex.map((t) => t.sort())) === JSON.stringify([['A', 'D'], ['B', 'C']]), 'equipes: A + D contra B + C (o exemplo do plano)');
  const P = [95, 90, 80, 60, 55, 40, 20].map((s, i) => ({ id: `p${i}`, name: `n${i}`, strength: s }));
  const st = Object.fromEntries(P.map((p) => [p.id, p.strength]));
  const two = B.form(P, 'duas');
  assert(two.length === 2 && Math.abs(two[0].length - two[1].length) === 1 && B.spread(two, st).range < 1, `Duas Equipes com 7: 4 e 3, médias quase iguais (diferença ${B.spread(two, st).range.toFixed(2)})`);
  const many = Array.from({ length: 11 }, (_, i) => ({ id: `q${i}`, name: `q${i}`, strength: (i * 37) % 100 }));
  const trios = B.form(many, 'trio');
  assert(trios.length === 3 && trios.every((t) => t.length === 3 || t.length === 4), 'Trio com 11: 3 equipes de 3 ou 4');
  assert(JSON.stringify(B.form(many, 'trio')) === JSON.stringify(trios), 'equipes: mesma entrada, mesmas equipes');
  assert(throwsCode(() => B.form(many.slice(0, 5), 'trio')) === 'POUCOS_EDUCANDOS', 'Trio com 5 educandos: aviso de poucos educandos');
  const s = B.strengths([{ id: 1, points: 100, levelsDone: 9 }, { id: 2, points: 900, levelsDone: 9 }, { id: 3, points: 0, levelsDone: 0 }, { id: 4, points: 500, levelsDone: 9 }]);
  assert(s[1] === 0 && s[2] === 100 && s[4] === 50 && s[3] === 50, 'força: percentil na sala; quem não jogou fica na mediana (50)');
  assert(B.lateTeam([['a', 'b'], ['c'], ['d', 'e']], { a: 1, b: 1, c: 1, d: 1, e: 1 }) === 1, 'quem chega depois vai para a equipe com menos gente');
}

function checkPairing() {
  let ok = true;
  for (let n = 2; n <= 8; n++) {
    const sides = Array.from({ length: n }, (_, i) => `t${i}`);
    const seen = new Set();
    const games = {};
    for (let r = 0; r < (n % 2 ? n : n - 1); r++) {
      for (const [a, b] of PR.roundRobin(sides, r)) {
        if (!b) continue;
        if (seen.has(PR.key(a, b))) ok = false;
        seen.add(PR.key(a, b));
        games[a] = (games[a] || 0) + 1; games[b] = (games[b] || 0) + 1;
      }
    }
    if (seen.size !== (n * (n - 1)) / 2 || new Set(Object.values(games)).size !== 1) ok = false;
  }
  assert(ok, 'todos contra todos (2 a 8 lados): ninguém repete adversário e todos jogam o mesmo número de vezes');
  const byes = new Set();
  for (let r = 0; r < 5; r++) { const bye = PR.roundRobin(['a', 'b', 'c', 'd', 'e'], r).find((p) => !p[1]); byes.add(bye[0]); }
  assert(byes.size === 5, 'com 5 lados, cada um descansa uma vez em 5 rodadas');
  const st = Array.from({ length: 11 }, (_, i) => `s${i}`);
  const played = new Set();
  const gotBye = new Set();
  let rematch = 0;
  for (let r = 0; r < 6; r++) {
    for (const [a, b] of PR.swiss(st, played, gotBye)) {
      if (!b) { assert(!gotBye.has(a) || r >= 11, `suíço: descanso da rodada ${r + 1} para quem ainda não descansou`); gotBye.add(a); continue; }
      if (played.has(PR.key(a, b))) rematch++;
      played.add(PR.key(a, b));
    }
  }
  assert(rematch === 0, 'suíço (11 lados, 6 rodadas): sem revanche');
  assert(JSON.stringify(PR.pairRound(3, { formato: 'duas', order: ['x', 'y'] })) === '[["x","y"]]', 'Duas Equipes: sempre A × B');
}

function checkRotation() {
  const r = rng(42);
  const games = ['a', 'b', 'c', 'd'];
  const hist = [];
  for (let i = 0; i < 24; i++) hist.push(RO.nextGame({ modo: 'aleatorio', games, history: hist, rng: r }));
  const bagsOk = [0, 4, 8, 12, 16, 20].every((i) => new Set(hist.slice(i, i + 4)).size === 4);
  assert(bagsOk && hist.every((g, i) => i === 0 || g !== hist[i - 1]), 'aleatório: cada jogo sai uma vez antes de repetir, nunca duas seguidas');
  assert(['a', 'b', 'c', 'a'].every((g, i) => RO.nextGame({ modo: 'sequencial', games: ['a', 'b', 'c'], history: Array(i).fill('x'), rng: r }) === g), 'sequencial: em ciclo');
  assert(RO.nextGame({ modo: 'ordem', games, ordem: ['c', 'c', 'a'], history: ['c', 'c'], rng: r }) === 'a', 'ordem definida: segue a lista do professor');
  const opts = RO.voteOptions({ games, history: ['b'], rng: r });
  assert(opts.length === 3 && !opts.includes('b'), 'votação: 3 opções, sem o jogo da rodada anterior');
  const t1 = RO.tally({ u1: 'a', u2: 'a', u3: 'c' }, ['a', 'c', 'd'], r);
  const t2 = RO.tally({ u1: 'a', u2: 'c' }, ['a', 'c', 'd'], r);
  const t3 = RO.tally({}, ['a', 'c', 'd'], r);
  assert(t1.winner === 'a' && !t1.tie && t2.tie && ['a', 'c'].includes(t2.winner) && ['a', 'c', 'd'].includes(t3.winner), 'votação: maioria vence; empate e sem votos = sorteio');
  const entries = [{ key: 'x' }, { key: 'y' }, { key: 'z' }];
  const lv = RO.nextLevel(entries, ['x', 'y'], r);
  assert(lv.key === 'z' && ['x', 'y', 'z'].includes(RO.nextLevel(entries, ['x', 'y', 'z'], r).key), 'fase: a que ainda não saiu; acabou o saco, volta a menos usada');
}

function checkScoring() {
  const E = (score, timeMs, status = 'concluida', stars = 3) => ({ status, score, timeMs, stars });
  assert(SC.decideRace([E(450, 60000)], [E(440, 30000)]).outcome === 'a', 'corrida: nota maior por 4 ou mais vence (mesmo sendo mais lento)');
  assert(SC.decideRace([E(450, 60000)], [E(448, 30000)]).outcome === 'b', 'corrida: notas quase iguais, vence o mais rápido (mais de 10%)');
  assert(SC.decideRace([E(450, 31000)], [E(448, 30000)]).outcome === 'empate', 'corrida: notas e tempos parecidos = empate');
  assert(SC.decideRace([E(400, 10000), E(0, null, 'tempo_esgotado')], [E(205, 10000), E(195, 10000)]).outcome === 'empate', 'equipe: média dos integrantes (quem não terminou conta 0)');
  assert(SC.decideRace([E(400, 1), E(0, null, 'dispensado')], [E(390, 1), E(380, 1)]).a.nota === 400, 'dispensado fica fora da média');
  assert(SC.decideRace([E(0, null, 'ausente')], [E(100, 1000)]).outcome === 'wo_b' && SC.decideRace([E(0, null, 'ausente')], [E(0, null, 'ausente')]).outcome === 'nulo', 'lado todo ausente: W.O.; os dois ausentes: nulo');
  assert(SC.decideDuels([{ winner: 'a' }, { winner: 'b' }, { winner: 'a' }]).outcome === 'a' && SC.decideDuels([{ winner: 'a' }, { winner: 'b' }]).outcome === 'empate', 'duelos por equipe: mais vitórias vence');
  const teams = ['A', 'B', 'C', 'D'].map((id) => ({ id }));
  const ms = [
    { sideA: 'A', sideB: 'B', outcome: 'a', scoreA: 400, scoreB: 300 },
    { sideA: 'C', sideB: 'D', outcome: 'empate', scoreA: 300, scoreB: 300 },
    { sideA: 'C', sideB: 'A', outcome: 'a', scoreA: 450, scoreB: 300 },
    { sideA: 'B', sideB: 'D', outcome: 'wo_a', scoreA: 100, scoreB: 0 },
    { sideA: 'D', sideB: null, outcome: 'descanso' },
  ];
  const table = SC.standings(teams, ms, { A: 3, B: 2, C: 1, D: 0 });
  const pts = Object.fromEntries(table.map((r) => [r.id, r.pontos]));
  assert(pts.A === 3 && pts.B === 3 && pts.C === 4 && pts.D === 2, `pontos: vitória 3, empate 1, W.O. 3, descanso 1 (${JSON.stringify(pts)})`);
  assert(table[0].id === 'C' && table[1].id === 'B' && table[2].id === 'A', 'classificação: pontos, depois saldo de nota (B à frente de A, os dois com 3)');
  const tie = SC.standings([{ id: 'X' }, { id: 'Y' }], [{ sideA: 'X', sideB: 'Y', outcome: 'empate', scoreA: 1, scoreB: 1 }], { X: 1, Y: 0 });
  assert(tie[0].id === 'Y', 'empate em tudo: decide o sorteio gravado');
  assert(SC.pointsFor('a', { a: 1 }).a === 4, 'bônus de perfeição soma 1');
}

// ---------------- o gerenciador ----------------
const solveCar = (lv) => T.solve(T.parse(lv.board));
function bodyFor(round, { hint = false } = {}) {
  const lv = L(round.gameId).getLevel(round.levelId);
  if (round.gameId === 'carrinhos') return { moves: solveCar(lv), hints: hint ? 1 : 0, durationMs: 60000 };
  if (round.gameId === 'hanoi') {
    const g = H.setup(lv, round.seed);
    let pos = g.start.slice();
    const moves = hint ? [[0, 1], [1, 0]] : [];
    if (hint) { pos = H.apply(H.apply(pos, [0, 1]), [1, 0]); }
    while (!H.same(pos, g.goal)) { const m = H.hint(pos, g.goal, g.pegs); moves.push(m); pos = H.apply(pos, m); }
    return { moves, hints: 0, durationMs: 90000 };
  }
  throw new Error(`sem jogada para ${round.gameId}`);
}

async function checkManager() {
  let t = 1_000_000_000;
  const now = () => t;
  const online = new Set();
  const changes = [];
  const kids = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu'].map((n) => {
    const r = accounts.register(`${n} Maratona`, '🐶');
    return accounts.authenticate(r.token);
  });
  const mm = createMatchManager(registry, { now });
  const mk = () => createMarathonManager(registry, { matchManager: mm, now, onChange: (m) => changes.push(m.code), isOnline: (id) => online.has(id) });
  let M = mk();

  // configuração inválida
  assert(throwsCode(() => M.create({ games: [] })) === 'SEM_JOGOS', 'criar sem jogos: recusado');
  assert(throwsCode(() => M.create({ games: ['carrinhos'], nivel: 1, tempoMin: 2, topics: { carrinhos: ['nada'] } })) === 'JOGO_SEM_FASES', 'jogo sem fase com esses assuntos: recusado');
  assert(throwsCode(() => M.create({ games: ['bingo'] })) === 'JOGO_INVALIDO', 'Bingo não entra na Maratona');

  // corrida em duplas, 2 rodadas, sequencial
  const { code, masterToken } = M.create({ games: ['carrinhos', 'hanoi'], formato: 'dupla', nivel: 1, rotacao: 'sequencial', rodadas: 2, tempoMin: 5 }, { name: 'Maratona da 5A' });
  assert(/^[A-Z]{4}$/.test(code) && changes.includes(code), 'maratona criada com código de 4 letras e gravada');
  for (const k of kids.slice(0, 4)) M.join(code, k);
  assert(throwsCode(() => M.start(code, 'token-errado')) === 'NAO_AUTORIZADO', 'só o dono (masterToken) começa');
  M.teams(code, masterToken, 'equilibrar');
  let v = M.viewOf(code, { role: 'professor' });
  assert(v.teams.length === 2 && v.teams.every((x) => x.members.length === 2), 'professor monta 2 duplas');
  M.start(code, masterToken);
  v = M.viewOf(code, { role: 'professor' });
  assert(v.status === 'preparando' && v.round.number === 1 && v.round.gameId === 'carrinhos' && v.round.kind === 'corrida' && v.round.matches.length === 1, 'começou: rodada 1 de Carrinhos, 1 confronto');
  assert(throwsCode(() => M.updateConfig(code, masterToken, { formato: 'trio' })) === 'CONFIG_TRAVADA', 'depois de começar, o formato fica travado');
  M.updateConfig(code, masterToken, { rodadas: 3 });
  assert(M.get(code).config.rodadas === 3, 'depois de começar, dá para aumentar as rodadas');
  M.updateConfig(code, masterToken, { rodadas: 2 });

  // largada
  t += PREP_MS + 1;
  M.checkTimers();
  v = M.viewOf(code, { role: 'professor' });
  assert(v.status === 'disputa', 'a contagem acaba e a disputa começa');
  const round = M.get(code).rounds[0];
  const teamA = v.teams[0];
  const teamB = v.teams[1];
  // a equipe A joga perfeito; a B usa dica (2 ⭐)
  t += 20000;
  for (const p of teamA.members) M.submit(code, p.studentId, bodyFor(round));
  const dup = M.submit(code, teamA.members[0].studentId, bodyFor(round));
  assert(dup.duplicate === true, 'resultado repetido: reconhecido, sem contar de novo');
  assert(throwsCode(() => M.submit(code, kids[4].id, bodyFor(round))) === 'NAO_ESCALADO', 'quem não está na rodada não manda resultado');
  assert(throwsCode(() => M.submit(code, teamB.members[0].studentId, { moves: [[0, 4]], durationMs: 60000 })) === 'RESULTADO_INVALIDO', 'jogada impossível: recusada pela validação do jogo');
  for (const p of teamB.members) M.submit(code, p.studentId, bodyFor(round, { hint: true }));
  v = M.viewOf(code, { role: 'professor' });
  const x1 = v.round.matches[0];
  const aWon = (x1.sideA === teamA.id && x1.outcome === 'a') || (x1.sideB === teamA.id && x1.outcome === 'b');
  assert(v.status === 'entre_rodadas' && v.round.status === 'apurada' && aWon, 'todos terminaram: apura na hora e a dupla perfeita vence');
  const pts1 = Object.fromEntries(v.standings.map((r) => [r.id, r.pontos]));
  assert(pts1[teamA.id] === 3 && pts1[teamB.id] === 0, 'classificação: 3 pontos para quem venceu');
  const gr = db.prepare("SELECT COUNT(*) AS n FROM game_results WHERE source = 'maratona' AND game_id = 'carrinhos'").get().n;
  assert(gr === 4, 'cada corrida também vai para o progresso normal, marcada como "maratona" (sem duplicar)');

  // rodada 2: Hanói; ninguém termina da equipe B; prazo
  M.nextRound(code, masterToken);
  t += PREP_MS + 1;
  M.checkTimers();
  const r2 = M.get(code).rounds[1];
  assert(r2.gameId === 'hanoi' && Boolean(L('hanoi').getLevel(r2.levelId)), 'rodada 2: o próximo jogo da sequência (Hanói)');
  online.add(teamB.members[0].studentId);
  M.seen(code, teamB.members[0].studentId);
  for (const p of teamA.members) M.submit(code, p.studentId, bodyFor(r2));
  assert(M.get(code).status === 'disputa', 'a rodada espera os outros');
  t = r2.deadlineAt + 1;
  M.checkTimers();
  const final = M.load(code);
  assert(final.status === 'encerrada', 'prazo da última rodada: apura e encerra');
  const es = final.entries.filter((e) => e.roundId === r2.id && e.teamId === teamB.id).map((e) => e.status).sort();
  assert(JSON.stringify(es) === JSON.stringify(['ausente', 'tempo_esgotado']), `prazo: quem apareceu e não terminou = tempo esgotado; quem nunca apareceu = ausente (${es.join(', ')})`);
  assert(final.state.final && final.state.final.standings[0].id === teamA.id && final.state.final.standings[0].pontos === 6, 'fim: classificação final salva (6 pontos para quem venceu as 2)');
  assert(final.teams.find((x) => x.id === teamA.id).position === 1, 'a posição final fica gravada na equipe');
  assert(throwsCode(() => M.nextRound(code, masterToken)) === 'MARATONA_ENCERRADA', 'maratona encerrada não volta');
  assert(M.viewOf(code, {}).final.highlights.estrelas, 'os destaques individuais ficam salvos');
  assert(store.events(final.id).some((e) => e.type === 'apurada') && store.history(5).some((h) => h.code === code), 'histórico de eventos e lista de maratonas anteriores');

  // ---------- votação + quem entra depois + dispensar + reiniciar ----------
  const vote = M.create({ games: ['carrinhos', 'hanoi', 'memoria'], formato: 'solo', nivel: 1, rotacao: 'votacao', rodadas: 3, votoSeg: 20 });
  for (const k of kids.slice(0, 3)) M.join(vote.code, k);
  M.start(vote.code, vote.masterToken);
  v = M.viewOf(vote.code, { role: 'educando', studentId: kids[0].id });
  assert(v.status === 'votacao' && v.round.vote.options.length === 3, 'votação: 3 opções para os educandos');
  const opt = v.round.vote.options;
  M.vote(vote.code, kids[0].id, opt[1]);
  M.vote(vote.code, kids[1].id, opt[1]);
  M.vote(vote.code, kids[2].id, opt[0]);
  M.vote(vote.code, kids[2].id, opt[1]); // trocou o voto
  assert(throwsCode(() => M.vote(vote.code, kids[3].id, opt[0])) === 'NAO_PARTICIPA', 'quem não está na maratona não vota');
  t += 20001;
  M.checkTimers();
  v = M.viewOf(vote.code, { role: 'professor' });
  assert(v.round.gameId === opt[1] && v.round.vote.result.counts[opt[1]] === 3, 'a votação fecha no tempo e vence a maioria (com voto trocado)');
  assert(v.round.matches.length === 2 && v.round.matches.some((x) => !x.sideB), 'Solo com 3: 1 confronto e 1 descanso');
  // quem chega depois vira um lado novo (Solo) e joga a partir da próxima rodada
  M.join(vote.code, kids[3]);
  v = M.viewOf(vote.code, { role: 'professor' });
  assert(v.teams.length === 4 && !v.round.matches.some((x) => x.entries.some((e) => e.studentId === kids[3].id)), 'quem entrou depois ganha um lado e não entra na rodada em andamento');
  // dispensar
  const playing = v.round.matches.find((x) => x.sideB);
  const dispensed = playing.entries[0].studentId;
  M.excuse(vote.code, vote.masterToken, dispensed);
  assert(M.get(vote.code).entries.find((e) => e.studentId === dispensed && e.roundId === M.get(vote.code).rounds[0].id).status === 'dispensado', 'dispensar: a entrada sai da conta');
  // "reinicia o servidor" no meio da rodada
  const before = M.viewOf(vote.code, { role: 'professor' });
  M = mk();
  t += 10 * 60 * 1000; // o servidor ficou 10 minutos fora
  const n = M.restore();
  const after = M.viewOf(vote.code, { role: 'professor' });
  assert(n >= 1 && after.round.number === before.round.number && after.round.gameId === before.round.gameId && after.teams.length === 4, 'reinício: a maratona volta do banco do jeito que estava');
  assert(after.round.deadlineAt >= t + 59000, 'reinício: o prazo vencido ganha 1 minuto de tolerância');
  t = after.round.deadlineAt + 1;
  M.checkTimers();
  assert(M.get(vote.code).status === 'entre_rodadas', 'depois do reinício, o prazo segue e a rodada é apurada');
  assert(throwsCode(() => M.pause(vote.code, 'x')) === 'NAO_AUTORIZADO', 'pausar: só o dono');
  M.pause(vote.code, vote.masterToken);
  assert(throwsCode(() => M.nextRound(vote.code, vote.masterToken)) === 'PAUSADA', 'pausada: não passa de rodada');
  M.resume(vote.code, vote.masterToken);
  M.end(vote.code, vote.masterToken);
  assert(M.load(vote.code).status === 'encerrada', 'o professor encerra antes do fim');

  // ---------- professor resolve, passagem automática, troca manual ----------
  const auto = M.create({ games: ['carrinhos'], formato: 'dupla', nivel: 1, rotacao: 'sequencial', rodadas: 2, auto: true, balancear: false });
  for (const k of kids.slice(0, 4)) M.join(auto.code, k);
  M.teams(auto.code, auto.masterToken, 'sortear');
  let av = M.viewOf(auto.code, { role: 'professor' });
  const mover = av.teams[0].members[0].studentId;
  M.moveStudent(auto.code, auto.masterToken, mover, av.teams[1].id);
  av = M.viewOf(auto.code, { role: 'professor' });
  assert(av.teams[1].members.some((p) => p.studentId === mover) && av.teams[0].members.length === 1, 'o professor troca um educando de equipe antes de começar');
  M.moveStudent(auto.code, auto.masterToken, mover, av.teams[0].id);
  M.start(auto.code, auto.masterToken);
  t += PREP_MS + 1;
  M.checkTimers();
  av = M.viewOf(auto.code, { role: 'professor' });
  assert(throwsCode(() => M.resolveMatch(auto.code, auto.masterToken, av.round.matches[0].id, 'x')) === 'RESULTADO_INVALIDO', 'resolver com resultado inválido: recusado');
  M.resolveMatch(auto.code, auto.masterToken, av.round.matches[0].id, 'wo_a', 'a outra dupla foi para a enfermaria');
  av = M.viewOf(auto.code, { role: 'professor' });
  assert(av.status === 'entre_rodadas' && av.round.matches[0].outcome === 'wo_a' && av.autoAt, 'o professor resolve o confronto (W.O.) e a rodada é apurada');
  assert(store.events(M.get(auto.code).id).some((e) => e.type === 'professor_resolveu' && e.payload.motivo.includes('enfermaria')), 'a decisão do professor fica no histórico com o motivo');
  t = av.autoAt + 1;
  M.checkTimers();
  av = M.viewOf(auto.code, { role: 'professor' });
  assert(av.round.number === 2 && av.status === 'preparando', 'passagem automática: a rodada 2 abre sozinha depois de 20 s');
  M.end(auto.code, auto.masterToken, { anular: true });
  const ended = M.load(auto.code);
  assert(ended.status === 'encerrada' && ended.rounds[1].status === 'anulada' && ended.state.final.standings[0].pontos === 3, 'encerrar anulando a rodada em andamento: vale só o que foi apurado');

  // ---------- duelo entre equipes (Velha 3 × 3 em duplas: 2 tabuleiros) ----------
  const teamDuel = M.create({ games: ['velha'], formato: 'dupla', nivel: 1, rotacao: 'sequencial', rodadas: 1 });
  for (const k of kids.slice(0, 5)) M.join(teamDuel.code, k);
  M.start(teamDuel.code, teamDuel.masterToken);
  const td = M.get(teamDuel.code);
  const boards = new Set(td.entries.filter((e) => e.bgMatchId).map((e) => e.bgMatchId));
  const rest = td.entries.filter((e) => e.status === 'descanso');
  assert(boards.size === 2 && rest.length === 1, 'duelo em duplas com 5: 2 tabuleiros e quem sobra descansa');
  t += PREP_MS + 1;
  M.checkTimers();
  t = td.rounds[0].deadlineAt + 1;
  M.checkTimers();
  const tdEnd = M.load(teamDuel.code);
  assert(tdEnd.status === 'encerrada' && tdEnd.matches[0].outcome === 'nulo', 'ninguém apareceu nos duelos: confronto nulo (0 a 0)');

  // ---------- duelo de tabuleiro (Velha, Solo) ----------
  const duel = M.create({ games: ['velha'], formato: 'solo', nivel: 1, rotacao: 'sequencial', rodadas: 1 });
  M.join(duel.code, kids[0]);
  M.join(duel.code, kids[1]);
  M.start(duel.code, duel.masterToken);
  v = M.viewOf(duel.code, { role: 'educando', studentId: kids[0].id });
  assert(v.round.kind === 'duelo' && v.round.variant === '3x3' && v.play && v.play.matchId, 'duelo: a partida pela rede já existe e o educando recebe o id');
  const bg = mm.matches.get(v.play.matchId);
  const tok = (k) => accounts.login(k.name).token;
  const sock = (id) => ({ id, join() {} });
  M.seen(duel.code, kids[0].id);
  M.seen(duel.code, kids[1].id);
  mm.actions.rejoin(sock('d0'), { matchId: bg.id, studentToken: tok(kids[0]) });
  mm.actions.rejoin(sock('d1'), { matchId: bg.id, studentToken: tok(kids[1]) });
  const seat0 = bg.players[0].studentId;
  const first = seat0 === kids[0].id ? 'd0' : 'd1';
  const second = first === 'd0' ? 'd1' : 'd0';
  for (const [who, move] of [[first, 0], [second, 3], [first, 1], [second, 4], [first, 2]]) mm.actions.move(sock(who), { matchId: bg.id, move });
  const dd = M.load(duel.code);
  const winnerTeam = dd.teams.find((x) => dd.participants.find((p) => p.teamId === x.id).studentId === seat0);
  assert(dd.status === 'encerrada' && dd.state.final.standings[0].id === winnerTeam.id && dd.state.final.standings[0].pontos === 3, 'duelo: quem fez 3 em linha vence o confronto e a maratona');
}

(async () => {
  try {
    checkBalance();
    checkPairing();
    checkRotation();
    checkScoring();
    await checkManager();
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    errors.push(String(e && e.stack || e));
  }
  try { db.close(); } catch (e) { /* ignore */ }
  for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(DB + suffix, { force: true }); } catch (e) { /* ignore */ } }
  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((x) => console.log(' -', x));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
})();
