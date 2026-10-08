// src/games/letras/server.js
// 🔤 Letras Cadentes no servidor. O navegador manda a semente da rodada,
// quais peças caíram no chão, os erros de digitação e o tempo; o servidor
// refaz a lista de peças pela semente (mesmo levels.js e items.js), confere
// se o resultado é possível e calcula as estrelas.

const Levels = require('../../../public/games/letras/levels.js');
const Items = require('../../../public/games/letras/items.js');
const { GameError } = require('../../platform/progress');

const MIN_MS_PER_CHAR = 60; // ninguém digita mais que ~16 teclas por segundo
const MAX_KEYS = 40; // letras/peças guardadas para o professor

const invalid = () => new GameError('RESULTADO_INVALIDO', 'Resultado inválido.');

function int(value, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw invalid();
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

function validateResult(body) {
  const level = Levels.getLevel(String(body.levelId || ''));
  if (!level) throw new GameError('FASE_INVALIDA', 'Essa fase não existe.');
  const seed = int(body.seed, 0, 0xFFFFFFFF);
  const items = Items.makeItems(level, seed);

  // peças que caíram: índices da rodada, sem repetir
  const lost = Array.isArray(body.lost) ? body.lost.map((i) => int(i, 0, items.length - 1)) : null;
  if (!lost || new Set(lost).size !== lost.length) throw invalid();
  const lostSet = new Set(lost);
  const caughtItems = items.filter((_, i) => !lostSet.has(i));
  const typedChars = caughtItems.reduce((n, it) => n + [...it].length, 0);

  const wrong = int(body.wrong || 0, 0, 100000);
  const durationMs = int(Math.floor(Number(body.durationMs)), 0, 2 * 60 * 60 * 1000);
  if (durationMs < typedChars * MIN_MS_PER_CHAR) throw invalid();

  const accuracy = typedChars + wrong ? Math.round((typedChars / (typedChars + wrong)) * 1000) / 10 : 0;
  const stars = Levels.starsFor(level.id, { caught: caughtItems.length, count: items.length, accuracy });
  const lostItems = lost.map((i) => items[i]);
  return {
    levelId: level.id,
    stars,
    score: stars,
    accuracy,
    speed: Math.round((caughtItems.length / items.length) * 100),
    durationMs,
    count: items.length,
    caught: caughtItems.length,
    wrong,
    lostItems,
    errorsByChar: cleanErrors(body.errorsByChar),
    details: { caught: caughtItems.length, count: items.length, wrong, lost: lostItems.slice(0, 30) },
  };
}

function trim(map, max) {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, max));
}

function mergeProgress(old, r) {
  const p = {
    levels: {}, trouble: {}, pieces: 0, caught: 0, totalTimeMs: 0, plays: 0, ...(old || {}),
  };
  p.levels = { ...p.levels };
  const prev = p.levels[r.levelId] || { stars: 0, bestCaught: 0, plays: 0 };
  p.levels[r.levelId] = {
    stars: Math.max(prev.stars || 0, r.stars),
    bestCaught: Math.max(prev.bestCaught || 0, Math.round((r.caught / r.count) * 100)),
    bestAccuracy: Math.max(prev.bestAccuracy || 0, r.accuracy),
    plays: (prev.plays || 0) + 1,
    lastPlayedAt: Date.now(),
  };
  // o que dá mais trabalho: peças que caíram e letras erradas
  p.trouble = { ...p.trouble };
  for (const it of r.lostItems) p.trouble[it] = (p.trouble[it] || 0) + 1;
  for (const [ch, n] of Object.entries(r.errorsByChar)) p.trouble[ch] = (p.trouble[ch] || 0) + n;
  p.trouble = trim(p.trouble, MAX_KEYS);
  p.pieces += r.count;
  p.caught += r.caught;
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
  return next ? `Fase ${next.index + 1} · ⭐ ${stars}` : `🏆 Tudo completo · ⭐ ${stars}`;
}

// Área do professor: onde está, estrelas, quanto pega e o que mais cai.
function teacherSummary(progress) {
  const p = progress || { levels: {} };
  const next = Levels.nextLevel(p);
  const done = Object.values(p.levels || {}).filter((l) => l.stars >= 1).length;
  return {
    current: next ? `${Levels.getWorld(next.world).icon} ${next.fullTitle}` : '🏆 completo',
    levelsDone: done,
    totalLevels: Levels.LEVELS.length,
    stars: Levels.totalStars(p),
    maxStars: Levels.MAX_STARS,
    caughtPct: p.pieces ? Math.round((p.caught / p.pieces) * 100) : null,
    pieces: p.pieces || 0,
    toughest: Object.entries(p.trouble || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k),
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
      bestCaught: Math.max(la.bestCaught || 0, lb.bestCaught || 0),
      bestAccuracy: Math.max(la.bestAccuracy || 0, lb.bestAccuracy || 0),
      plays: (la.plays || 0) + (lb.plays || 0),
      lastPlayedAt: Math.max(la.lastPlayedAt || 0, lb.lastPlayedAt || 0),
    };
  }
  const trouble = { ...a.trouble };
  for (const [k, n] of Object.entries(b.trouble || {})) trouble[k] = (trouble[k] || 0) + n;
  return {
    ...a,
    levels,
    trouble: trim(trouble, MAX_KEYS),
    pieces: (a.pieces || 0) + (b.pieces || 0),
    caught: (a.caught || 0) + (b.caught || 0),
    totalTimeMs: (a.totalTimeMs || 0) + (b.totalTimeMs || 0),
    plays: (a.plays || 0) + (b.plays || 0),
  };
}

module.exports = { validateResult, mergeProgress, summary, teacherSummary, mergeAccounts };
