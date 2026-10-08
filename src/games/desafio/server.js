// src/games/desafio/server.js
// Desafio de digitação na plataforma (ver src/games/registry.js): eventos de
// socket em tempo real e o progresso de cada criança (corridas, vitórias,
// melhor e média de velocidade), usado no painel e na área do professor.

const { registerSocketHandlers } = require('./socketHandlers');

function mergeProgress(old, r) {
  const p = { races: 0, wins: 0, podiums: 0, bestWpm: 0, avgWpm: 0, ...(old || {}) };
  p.avgWpm = Math.round(((p.avgWpm * p.races + r.wpm) / (p.races + 1)) * 10) / 10;
  p.races += 1;
  if (r.position === 1) p.wins += 1;
  if (r.podium) p.podiums += 1;
  p.bestWpm = Math.max(p.bestWpm, r.wpm);
  p.lastAt = Date.now();
  return p;
}

function summary(progress) {
  if (!progress || !progress.races) return null;
  return `🏁 ${progress.races} ${progress.races === 1 ? 'desafio' : 'desafios'} · ${Math.round(progress.bestWpm)} PPM`;
}

function teacherSummary(progress) {
  const p = progress || {};
  return {
    races: p.races || 0,
    wins: p.wins || 0,
    podiums: p.podiums || 0,
    bestWpm: Math.round(p.bestWpm || 0),
    avgWpm: Math.round(p.avgWpm || 0),
  };
}

function mergeAccounts(a, b) {
  if (!a || !b) return a || b;
  const races = (a.races || 0) + (b.races || 0);
  return {
    races,
    wins: (a.wins || 0) + (b.wins || 0),
    podiums: (a.podiums || 0) + (b.podiums || 0),
    bestWpm: Math.max(a.bestWpm || 0, b.bestWpm || 0),
    avgWpm: races ? Math.round((((a.avgWpm || 0) * (a.races || 0) + (b.avgWpm || 0) * (b.races || 0)) / races) * 10) / 10 : 0,
    lastAt: Math.max(a.lastAt || 0, b.lastAt || 0),
  };
}

module.exports = {
  registerSockets: registerSocketHandlers,
  mergeProgress,
  summary,
  teacherSummary,
  mergeAccounts,
};
