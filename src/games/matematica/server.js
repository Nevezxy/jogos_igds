// src/games/matematica/server.js
// 🔢 Conta Comigo no servidor. O navegador manda a semente da rodada, as
// contas de revisão e as tentativas de cada conta; o servidor refaz as
// mesmas contas (mesmo levels.js e problems.js), confere cada resposta e
// calcula as estrelas. Também guarda as contas que a criança mais erra,
// que voltam nas próximas rodadas daquela fase.

const Levels = require('../../../public/games/matematica/levels.js');
const Problems = require('../../../public/games/matematica/problems.js');
const { GameError } = require('../../platform/progress');

const MIN_MS_PER_PROBLEM = 700; // menos que isso não dá para ler a conta
const MAX_REVIEW_PER_LEVEL = 30; // contas para revisar guardadas por fase
const MAX_FACTS = 200; // "contas que mais erra", no geral

const invalid = () => new GameError('RESULTADO_INVALIDO', 'Resultado inválido.');

// Uma tentativa: número, sinal (+ - * /) ou [quociente, resto].
function cleanAttempt(value) {
  if (Array.isArray(value)) {
    if (value.length !== 2) throw invalid();
    return value.map((v) => {
      const n = Problems.parseAnswer(v);
      if (typeof n !== 'number') throw invalid();
      return n;
    });
  }
  const parsed = Problems.parseAnswer(value);
  if (parsed === null) throw invalid();
  return parsed;
}

function validateResult(body, progress) {
  const level = Levels.getLevel(String(body.levelId || ''));
  if (!level) throw new GameError('FASE_INVALIDA', 'Essa fase não existe.');
  if (!Levels.isUnlocked(progress, level.id)) {
    throw new GameError('FASE_BLOQUEADA', 'Essa fase ainda está bloqueada.', 403);
  }
  const seed = Number(body.seed);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw invalid();

  // contas de revisão: só valem as que o servidor guardou para esta fase
  const review = Array.isArray(body.review) ? body.review.map(String) : [];
  const saved = (progress && progress.levels && progress.levels[level.id] && progress.levels[level.id].review) || {};
  if (review.length > 3 || review.some((k) => !(k in saved))) throw invalid();

  const problems = Problems.makeRound(level, seed, review);
  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (answers.length !== problems.length) throw invalid();

  const durationMs = Math.floor(Number(body.durationMs));
  if (!Number.isFinite(durationMs) || durationMs < problems.length * MIN_MS_PER_PROBLEM || durationMs > 2 * 60 * 60 * 1000) {
    throw invalid();
  }

  let firstTry = 0;
  let secondTry = 0;
  let streak = 0;
  let bestStreak = 0; // contas certas de primeira, seguidas
  const missed = [];
  const right = [];
  problems.forEach((p, i) => {
    const tries = answers[i] && Array.isArray(answers[i].tries) ? answers[i].tries : null;
    if (!tries || tries.length < 1 || tries.length > 2) throw invalid();
    const values = tries.map(cleanAttempt);
    if (Problems.isCorrect(p, values[0])) {
      firstTry++;
      right.push(p.key);
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
      if (values[1] !== undefined && Problems.isCorrect(p, values[1])) secondTry++;
      missed.push(p.key);
    }
  });

  const score = firstTry + secondTry * 0.5;
  const avgSec = durationMs / 1000 / problems.length;
  const emoji = Boolean(Levels.getWorld(level.world).emoji);
  const stars = Levels.starsFor(level.id, { score, count: problems.length, avgSec });
  const accuracy = Math.round((firstTry / problems.length) * 100);
  return {
    levelId: level.id,
    stars,
    score: stars,
    accuracy,
    speed: Math.round(avgSec * 10) / 10,
    durationMs,
    firstTry,
    secondTry,
    bestStreak,
    count: problems.length,
    emoji,
    missed,
    right,
    details: { firstTry, secondTry, count: problems.length, emoji, missed: missed.map(Problems.describe) },
  };
}

// Mantém só as `max` maiores contagens.
function trim(map, max) {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, max));
}

function mergeProgress(old, r) {
  const p = {
    levels: {}, facts: {}, problems: 0, firstTry: 0, totalTimeMs: 0, plays: 0, ...(old || {}),
  };
  p.levels = { ...p.levels };
  const prev = p.levels[r.levelId] || { stars: 0, bestAccuracy: 0, plays: 0, review: {} };
  // revisão da fase: errou sobe (até 9), acertou de primeira desce; zerou, sai
  const review = { ...(prev.review || {}) };
  for (const k of r.missed) review[k] = Math.min(9, (review[k] || 0) + 3);
  for (const k of r.right) {
    if (k in review) {
      review[k] -= 1;
      if (review[k] <= 0) delete review[k];
    }
  }
  p.levels[r.levelId] = {
    stars: Math.max(prev.stars || 0, r.stars),
    bestAccuracy: Math.max(prev.bestAccuracy || 0, r.accuracy),
    bestStreak: Math.max(prev.bestStreak || 0, r.bestStreak),
    plays: (prev.plays || 0) + 1,
    lastPlayedAt: Date.now(),
    review: trim(review, MAX_REVIEW_PER_LEVEL),
  };
  p.facts = { ...p.facts };
  for (const k of r.missed) p.facts[k] = (p.facts[k] || 0) + 1;
  p.facts = trim(p.facts, MAX_FACTS);
  p.problems += r.count;
  p.firstTry += r.firstTry;
  p.totalTimeMs += r.durationMs;
  p.plays += 1;
  p.lastLevel = r.levelId;
  return p;
}

// Cartão do painel: "Fase 7 · ⭐ 18".
function summary(progress) {
  if (!progress || !progress.levels || !Object.keys(progress.levels).length) return null;
  const next = Levels.nextLevel(progress);
  const stars = Levels.totalStars(progress);
  return next ? `${Levels.getWorld(next.world).icon} Fase ${next.index + 1} · ⭐ ${stars}` : `🏆 Tudo completo · ⭐ ${stars}`;
}

// Área do professor: onde está, estrelas, acertos e as contas que mais erra.
function teacherSummary(progress) {
  const p = progress || { levels: {} };
  const next = Levels.nextLevel(p);
  const done = Object.values(p.levels || {}).filter((l) => l.stars >= 1).length;
  const toughest = Object.entries(p.facts || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k]) => Problems.describe(k)).filter(Boolean);
  return {
    current: next ? `${Levels.getWorld(next.world).icon} ${Levels.getWorld(next.world).name} · ${next.title}` : '🏆 completo',
    levelsDone: done,
    totalLevels: Levels.LEVELS.length,
    stars: Levels.totalStars(p),
    maxStars: Levels.MAX_STARS,
    accuracy: p.problems ? Math.round((p.firstTry / p.problems) * 100) : null,
    problems: p.problems || 0,
    toughest,
  };
}

// Duas contas da mesma criança viram uma: fica o melhor de cada fase.
function mergeAccounts(a, b) {
  if (!a) return b;
  if (!b) return a;
  const levels = { ...a.levels };
  for (const [id, lb] of Object.entries(b.levels || {})) {
    const la = levels[id];
    levels[id] = !la ? lb : {
      stars: Math.max(la.stars || 0, lb.stars || 0),
      bestAccuracy: Math.max(la.bestAccuracy || 0, lb.bestAccuracy || 0),
      bestStreak: Math.max(la.bestStreak || 0, lb.bestStreak || 0),
      plays: (la.plays || 0) + (lb.plays || 0),
      lastPlayedAt: Math.max(la.lastPlayedAt || 0, lb.lastPlayedAt || 0),
      review: trim({ ...(lb.review || {}), ...(la.review || {}) }, MAX_REVIEW_PER_LEVEL),
    };
  }
  const facts = { ...a.facts };
  for (const [k, n] of Object.entries(b.facts || {})) facts[k] = (facts[k] || 0) + n;
  return {
    ...a,
    levels,
    facts: trim(facts, MAX_FACTS),
    problems: (a.problems || 0) + (b.problems || 0),
    firstTry: (a.firstTry || 0) + (b.firstTry || 0),
    totalTimeMs: (a.totalTimeMs || 0) + (b.totalTimeMs || 0),
    plays: (a.plays || 0) + (b.plays || 0),
  };
}

module.exports = { validateResult, mergeProgress, summary, teacherSummary, mergeAccounts };

// 🏃 Modo Maratona (src/marathon/catalog.js): quanto tempo a fase leva
// (estMs), o que fica de fora, a qualidade do resultado já validado (0 a 1,
// desempata entre quem tem as mesmas estrelas) e a força da validação.
module.exports.marathon = {
  trust: 'forte',
  // 10 contas no tempo da 3ª estrela, com folga
  estMs: (level) => (level.count || 10) * level.target * 1500 + 10000,
  quality: (r) => r.accuracy / 100, // contas certas de primeira
};
