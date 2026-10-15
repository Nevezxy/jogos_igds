// src/games/boardgame.js
// O lado do servidor dos jogos de tabuleiro (Velha, Ligue 4, e depois Dama
// e Xadrez), igual para todos: cada jogo passa as suas regras e fases.
//   • partida contra o robô: o navegador manda a fase (nível do robô), de
//     que lado a criança jogou, todos os lances e quantas vezes desfez; o
//     servidor refaz a partida lance a lance com as mesmas regras, confere
//     que tudo é válido e que a partida acabou, e calcula as estrelas
//   • partida contra um amigo (pela rede, src/platform/match.js): o servidor
//     já foi o juiz de cada lance e só grava o resultado (sem estrela)
//   • progresso: estrelas, vitórias, empates e derrotas por fase e o placar
//     contra amigos; resumo para o painel e para o professor

const { GameError } = require('../platform/progress');

const MAX_MOVES = 1000;
const MIN_MS_PER_MOVE = 120; // ninguém joga uma partida inteira mais rápido que isso

function createBoardServer({ Rules, Levels }) {
  const invalid = () => new GameError('RESULTADO_INVALIDO', 'Resultado inválido.');

  // refaz a partida; devolve o estado final (ou erro se algum lance não vale)
  function replay(variant, moves) {
    if (!Array.isArray(moves) || moves.length > MAX_MOVES) throw invalid();
    let state = Rules.initial(variant);
    for (const m of moves) {
      if (!Rules.isLegal(state, m)) throw invalid();
      state = Rules.play(state, m);
    }
    return state;
  }

  function outcomeFor(state, seat) {
    const w = state.result.winner;
    return w === null || w === undefined ? 'draw' : w === seat ? 'win' : 'loss';
  }

  function validateResult(body) {
    const level = Levels.getLevel(String(body.levelId || ''));
    if (!level) throw new GameError('FASE_INVALIDA', 'Essa fase não existe.');
    const seat = Number(body.seat);
    if (seat !== 0 && seat !== 1) throw invalid();
    const undos = Math.floor(Number(body.undos) || 0);
    if (undos < 0 || undos > MAX_MOVES || (undos && !level.undo)) throw invalid();
    const moves = body.moves;
    let state;
    try { state = replay(level.variant, moves); } catch (e) { throw invalid(); }
    // desistiu no meio: vale como derrota; senão a partida tem que ter acabado
    const resigned = body.resigned === true;
    if (!state.result && !resigned) throw invalid();
    const durationMs = Math.floor(Number(body.durationMs) || 0);
    if (durationMs < 0 || durationMs > 6 * 60 * 60 * 1000) throw invalid();
    if (state.result && durationMs < Math.ceil(moves.length / 2) * MIN_MS_PER_MOVE) throw invalid();
    const outcome = state.result ? outcomeFor(state, seat) : 'loss';
    // lances da criança (quem começa joga os lances pares)
    const first = Rules.initial(level.variant).turn;
    const myMoves = moves.filter((_, i) => (i % 2 === 0 ? first : 1 - first) === seat).length;
    if (level.seat != null && seat !== level.seat) throw invalid();
    const stars = Levels.starsFor(level.id, outcome, undos, myMoves);
    return {
      levelId: level.id,
      outcome,
      stars,
      undos,
      moves: moves.length,
      durationMs,
      score: stars,
      details: { outcome, undos, moves: moves.length, seat, resigned },
    };
  }

  function blankRecord() { return { wins: 0, draws: 0, losses: 0 }; }
  function addOutcome(rec, outcome) {
    const r = { ...blankRecord(), ...rec };
    if (outcome === 'win') r.wins++;
    else if (outcome === 'draw') r.draws++;
    else r.losses++;
    return r;
  }

  function mergeProgress(old, r) {
    const p = { levels: {}, friend: blankRecord(), plays: 0, totalTimeMs: 0, ...(old || {}) };
    p.levels = { ...p.levels };
    if (r.friend) {
      p.friend = addOutcome(p.friend, r.outcome);
    } else {
      const prev = p.levels[r.levelId] || { stars: 0, plays: 0, ...blankRecord() };
      p.levels[r.levelId] = {
        ...addOutcome(prev, r.outcome),
        stars: Math.max(prev.stars || 0, r.stars),
        plays: (prev.plays || 0) + 1,
        lastPlayedAt: Date.now(),
      };
      p.lastLevel = r.levelId;
    }
    p.plays += 1;
    p.totalTimeMs += r.durationMs || 0;
    return p;
  }

  // resultado de uma partida pela rede (o servidor já conferiu os lances)
  function friendResult({ outcome, moves, durationMs, variant, reason }) {
    return {
      levelId: `amigo-${variant}`,
      friend: true,
      outcome,
      stars: 0,
      score: outcome === 'win' ? 1 : 0,
      durationMs,
      details: { outcome, moves, variant, reason },
    };
  }

  const totals = (p) => Object.values(p.levels || {}).reduce((t, l) => ({
    wins: t.wins + (l.wins || 0), draws: t.draws + (l.draws || 0), losses: t.losses + (l.losses || 0),
  }), blankRecord());

  // Cartão do painel: "Robô Atento · ⭐ 7".
  function summary(progress) {
    if (!progress || !progress.plays) return null;
    const next = Levels.nextLevel(progress);
    const stars = Levels.totalStars(progress);
    const f = progress.friend || blankRecord();
    const friend = f.wins + f.draws + f.losses ? ` · 👫 ${f.wins}V` : '';
    return next ? `${next.fullTitle} · ⭐ ${stars}${friend}` : `🏆 Venceu todos os robôs · ⭐ ${stars}${friend}`;
  }

  // Área do professor: o robô mais forte que já venceu e o placar.
  function teacherSummary(progress) {
    const p = progress || { levels: {} };
    const beaten = Levels.LEVELS.filter((l) => Levels.starsOf(p, l.id) >= 2);
    const best = beaten[beaten.length - 1];
    const next = Levels.nextLevel(p);
    return {
      current: next ? next.fullTitle : '🏆 venceu todos',
      best: best ? best.fullTitle : null,
      levelsDone: beaten.length,
      totalLevels: Levels.LEVELS.length,
      stars: Levels.totalStars(p),
      maxStars: Levels.MAX_STARS,
      vsBot: totals(p),
      friend: { ...blankRecord(), ...(p.friend || {}) },
      plays: p.plays || 0,
    };
  }

  // Duas contas da mesma criança viram uma.
  function mergeAccounts(a, b) {
    if (!a) return b;
    if (!b) return a;
    const levels = { ...a.levels };
    for (const [id, lb] of Object.entries(b.levels || {})) {
      const la = levels[id];
      levels[id] = !la ? lb : {
        stars: Math.max(la.stars || 0, lb.stars || 0),
        wins: (la.wins || 0) + (lb.wins || 0),
        draws: (la.draws || 0) + (lb.draws || 0),
        losses: (la.losses || 0) + (lb.losses || 0),
        plays: (la.plays || 0) + (lb.plays || 0),
        lastPlayedAt: Math.max(la.lastPlayedAt || 0, lb.lastPlayedAt || 0),
      };
    }
    const fa = { ...blankRecord(), ...(a.friend || {}) };
    const fb = { ...blankRecord(), ...(b.friend || {}) };
    return {
      ...a,
      levels,
      friend: { wins: fa.wins + fb.wins, draws: fa.draws + fb.draws, losses: fa.losses + fb.losses },
      plays: (a.plays || 0) + (b.plays || 0),
      totalTimeMs: (a.totalTimeMs || 0) + (b.totalTimeMs || 0),
    };
  }

  return {
    Rules, Levels, board: true,
    validateResult, mergeProgress, summary, teacherSummary, mergeAccounts, friendResult, replay,
  };
}

module.exports = { createBoardServer };
