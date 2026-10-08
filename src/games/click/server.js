// src/games/click/server.js
// 🖱️ Click no servidor. O navegador manda a semente da rodada, quais alvos
// sumiram sem acerto, as ações erradas e o tempo; o servidor refaz a lista
// de alvos pela semente (mesmo levels.js e targets.js), confere se o
// resultado é possível e calcula as estrelas. Guarda a % de acerto de cada
// ação (mover, clique, duplo clique, segurar, arrastar) para o professor.

const Levels = require('../../../public/games/click/levels.js');
const Targets = require('../../../public/games/click/targets.js');
const { GameError } = require('../../platform/progress');

// tempo mínimo de cada ação certa (ninguém faz mais rápido que isso)
const MIN_MS = { hover: 30, click: 80, double: 150, drag: 250 };
const WRONG_KEYS = [...Levels.KINDS, 'empty'];

const invalid = () => new GameError('RESULTADO_INVALIDO', 'Resultado inválido.');

function int(value, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw invalid();
  return n;
}

function cleanWrongBy(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of WRONG_KEYS) {
    const n = Math.floor(Number(raw[key]));
    if (Number.isFinite(n) && n > 0) out[key] = Math.min(n, 1000);
  }
  return out;
}

function validateResult(body) {
  const level = Levels.getLevel(String(body.levelId || ''));
  if (!level) throw new GameError('FASE_INVALIDA', 'Essa fase não existe.');
  const seed = int(body.seed, 0, 0xFFFFFFFF);
  const items = Targets.makeTargets(level, seed);

  // alvos que sumiram: índices da rodada, sem repetir
  const lost = Array.isArray(body.lost) ? body.lost.map((i) => int(i, 0, items.length - 1)) : null;
  if (!lost || new Set(lost).size !== lost.length) throw invalid();
  const lostSet = new Set(lost);
  const hitItems = items.filter((_, i) => !lostSet.has(i));

  const wrong = int(body.wrong || 0, 0, 100000);
  const durationMs = int(Math.floor(Number(body.durationMs)), 0, 2 * 60 * 60 * 1000);
  const minMs = hitItems.reduce((n, it) => n + (it.kind === 'hold' ? level.holdMs : MIN_MS[it.kind]), 0);
  if (durationMs < minMs) throw invalid();

  // pontos (com combo e especiais): só para o recorde; teto folgado
  const score = int(Math.floor(Number(body.score) || 0), 0, items.length * 2000);
  const bestStreak = Math.min(hitItems.length, Math.max(0, Math.floor(Number(body.bestStreak) || 0)));
  const hits = hitItems.length;
  const accuracy = hits + wrong ? Math.round((hits / (hits + wrong)) * 1000) / 10 : 0;
  const stars = Levels.starsFor(level.id, { hits, count: items.length, accuracy });

  const byKind = {};
  items.forEach((it, i) => {
    const k = byKind[it.kind] || (byKind[it.kind] = { ok: 0, total: 0, wrong: 0 });
    k.total++;
    if (!lostSet.has(i)) k.ok++;
  });
  const wrongBy = cleanWrongBy(body.wrongBy);
  for (const [kind, n] of Object.entries(wrongBy)) if (byKind[kind]) byKind[kind].wrong += n;

  return {
    levelId: level.id,
    stars,
    accuracy,
    speed: Math.round((hits / items.length) * 100),
    durationMs,
    count: items.length,
    hits,
    wrong,
    score: stars,
    points: score,
    bestStreak,
    byKind,
    details: { hits, count: items.length, wrong, byKind },
  };
}

function addByKind(a = {}, b = {}) {
  const out = { ...a };
  for (const [kind, v] of Object.entries(b)) {
    const o = out[kind] || { ok: 0, total: 0, wrong: 0 };
    out[kind] = { ok: o.ok + v.ok, total: o.total + v.total, wrong: (o.wrong || 0) + (v.wrong || 0) };
  }
  return out;
}

function mergeProgress(old, r) {
  const p = {
    levels: {}, byKind: {}, targets: 0, hits: 0, totalTimeMs: 0, plays: 0, ...(old || {}),
  };
  p.levels = { ...p.levels };
  const prev = p.levels[r.levelId] || { stars: 0, plays: 0 };
  p.levels[r.levelId] = {
    stars: Math.max(prev.stars || 0, r.stars),
    bestHits: Math.max(prev.bestHits || 0, Math.round((r.hits / r.count) * 100)),
    bestAccuracy: Math.max(prev.bestAccuracy || 0, r.accuracy),
    bestScore: Math.max(prev.bestScore || 0, r.points),
    bestStreak: Math.max(prev.bestStreak || 0, r.bestStreak),
    plays: (prev.plays || 0) + 1,
    lastPlayedAt: Date.now(),
  };
  p.byKind = addByKind(p.byKind, r.byKind);
  p.targets += r.count;
  p.hits += r.hits;
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

// Área do professor: onde está, estrelas e a % de acerto de cada ação.
function teacherSummary(progress) {
  const p = progress || { levels: {} };
  const next = Levels.nextLevel(p);
  const done = Object.values(p.levels || {}).filter((l) => l.stars >= 1).length;
  const byKind = Levels.KINDS
    .filter((k) => p.byKind && p.byKind[k] && p.byKind[k].total)
    .map((k) => ({
      kind: k,
      icon: Levels.KIND_INFO[k].icon,
      name: Levels.KIND_INFO[k].name,
      pct: Math.round((p.byKind[k].ok / p.byKind[k].total) * 100),
    }));
  const tough = byKind.filter((k) => p.byKind[k.kind].total >= 5).sort((a, b) => a.pct - b.pct)[0];
  return {
    current: next ? `${Levels.getWorld(next.world).icon} ${next.fullTitle}` : '🏆 completo',
    levelsDone: done,
    totalLevels: Levels.LEVELS.length,
    stars: Levels.totalStars(p),
    maxStars: Levels.MAX_STARS,
    hitPct: p.targets ? Math.round((p.hits / p.targets) * 100) : null,
    targets: p.targets || 0,
    byKind,
    toughest: tough && tough.pct < 80 ? tough.name : null,
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
      bestHits: Math.max(la.bestHits || 0, lb.bestHits || 0),
      bestAccuracy: Math.max(la.bestAccuracy || 0, lb.bestAccuracy || 0),
      bestScore: Math.max(la.bestScore || 0, lb.bestScore || 0),
      bestStreak: Math.max(la.bestStreak || 0, lb.bestStreak || 0),
      plays: (la.plays || 0) + (lb.plays || 0),
      lastPlayedAt: Math.max(la.lastPlayedAt || 0, lb.lastPlayedAt || 0),
    };
  }
  return {
    ...a,
    levels,
    byKind: addByKind(a.byKind, b.byKind),
    targets: (a.targets || 0) + (b.targets || 0),
    hits: (a.hits || 0) + (b.hits || 0),
    totalTimeMs: (a.totalTimeMs || 0) + (b.totalTimeMs || 0),
    plays: (a.plays || 0) + (b.plays || 0),
  };
}

module.exports = { validateResult, mergeProgress, summary, teacherSummary, mergeAccounts };
