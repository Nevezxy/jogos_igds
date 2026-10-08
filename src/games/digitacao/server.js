// src/games/digitacao/server.js
// Teclado Mágico no servidor: confere os resultados enviados pelo navegador,
// calcula as estrelas (o servidor é quem decide) e guarda o progresso.
// As fases vêm do mesmo arquivo que o navegador usa.

const Levels = require('../../../public/games/digitacao/levels.js');
const { GameError } = require('../../platform/progress');

function num(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new GameError('RESULTADO_INVALIDO', 'Resultado inválido.');
  }
  return n;
}

// Erros por caractere: no máximo 80 caracteres diferentes, contagens inteiras.
function cleanErrors(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [char, count] of Object.entries(raw).slice(0, 80)) {
    if ([...char].length !== 1) continue;
    const n = Math.floor(Number(count));
    if (Number.isFinite(n) && n > 0) out[char] = Math.min(n, 1000);
  }
  return out;
}

function validateResult(body, progress) {
  const level = Levels.getLevel(String(body.levelId || ''));
  if (!level) throw new GameError('FASE_INVALIDA', 'Essa fase não existe.');
  if (!Levels.isUnlocked(progress, level.id)) {
    throw new GameError('FASE_BLOQUEADA', 'Essa fase ainda está bloqueada.', 403);
  }
  const chars = Math.floor(num(body.chars, 1, 5000));
  const durationMs = Math.floor(num(body.durationMs, 300, 60 * 60 * 1000));
  const accuracy = num(body.accuracy, 0, 100);
  const wpm = num(body.wpm, 0, 250);
  const wrongPresses = Math.floor(num(body.wrongPresses || 0, 0, 100000));
  // a velocidade informada tem que bater com caracteres e tempo
  const realWpm = chars / 5 / (durationMs / 60000);
  if (Math.abs(realWpm - wpm) > Math.max(3, realWpm * 0.25)) {
    throw new GameError('RESULTADO_INVALIDO', 'Resultado inválido.');
  }
  const stars = Levels.starsFor(level.id, accuracy, wpm);
  return {
    levelId: level.id,
    chars,
    durationMs,
    accuracy,
    wpm,
    wrongPresses,
    stars,
    score: stars,
    errorsByChar: cleanErrors(body.errorsByChar),
    details: { chars, wrongPresses },
  };
}

function mergeProgress(old, r) {
  const p = {
    levels: {}, keyErrors: {}, totalChars: 0, totalTimeMs: 0, plays: 0, ...(old || {}),
  };
  p.levels = { ...p.levels };
  const prev = p.levels[r.levelId] || { stars: 0, bestWpm: 0, bestAccuracy: 0, plays: 0 };
  p.levels[r.levelId] = {
    stars: Math.max(prev.stars || 0, r.stars),
    bestWpm: Math.max(prev.bestWpm || 0, r.wpm),
    bestAccuracy: Math.max(prev.bestAccuracy || 0, r.accuracy),
    plays: (prev.plays || 0) + 1,
    lastPlayedAt: Date.now(),
  };
  p.keyErrors = { ...p.keyErrors };
  for (const [char, n] of Object.entries(r.errorsByChar)) p.keyErrors[char] = (p.keyErrors[char] || 0) + n;
  p.totalChars += r.chars;
  p.totalTimeMs += r.durationMs;
  p.plays += 1;
  p.lastLevel = r.levelId;
  return p;
}

// Resumo no cartão do painel: "Fase 7 · ⭐ 18".
function summary(progress) {
  if (!progress || !progress.levels || !Object.keys(progress.levels).length) return null;
  const next = Levels.nextLevel(progress);
  const stars = Levels.totalStars(progress);
  return next ? `Fase ${next.index + 1} · ⭐ ${stars}` : `🏆 Tudo completo · ⭐ ${stars}`;
}

// Para a área do professor: em que ponto o educando está.
function teacherSummary(progress) {
  const p = progress || { levels: {} };
  const next = Levels.nextLevel(p);
  const levels = Object.values(p.levels || {});
  const done = levels.filter((l) => l.stars >= 1).length;
  const avgWpm = levels.length ? Math.round(levels.reduce((n, l) => n + (l.bestWpm || 0), 0) / levels.length) : 0;
  const toughest = Object.entries(p.keyErrors || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  return {
    current: next ? `${Levels.getWorld(next.world).icon} Mundo ${next.worldIndex + 1} · ${next.title}` : '🏆 completo',
    levelsDone: done,
    totalLevels: Levels.LEVELS.length,
    stars: Levels.totalStars(p),
    maxStars: Levels.MAX_STARS,
    avgWpm,
    toughest,
    unlockedAll: Boolean(p.unlockedAll),
    // com todas as fases abertas não há o que liberar
    lockable: !Levels.ALL_UNLOCKED,
  };
}

// O professor libera (ou volta a bloquear) todas as fases de um educando.
function setUnlockedAll(old, value) {
  return { levels: {}, ...(old || {}), unlockedAll: Boolean(value) };
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
      bestWpm: Math.max(la.bestWpm || 0, lb.bestWpm || 0),
      bestAccuracy: Math.max(la.bestAccuracy || 0, lb.bestAccuracy || 0),
      plays: (la.plays || 0) + (lb.plays || 0),
      lastPlayedAt: Math.max(la.lastPlayedAt || 0, lb.lastPlayedAt || 0),
    };
  }
  const keyErrors = { ...a.keyErrors };
  for (const [c, n] of Object.entries(b.keyErrors || {})) keyErrors[c] = (keyErrors[c] || 0) + n;
  return {
    ...a,
    levels,
    keyErrors,
    totalChars: (a.totalChars || 0) + (b.totalChars || 0),
    totalTimeMs: (a.totalTimeMs || 0) + (b.totalTimeMs || 0),
    plays: (a.plays || 0) + (b.plays || 0),
    unlockedAll: Boolean(a.unlockedAll || b.unlockedAll),
  };
}

module.exports = { validateResult, mergeProgress, summary, teacherSummary, setUnlockedAll, mergeAccounts };
