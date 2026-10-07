// src/games/bingo/server.js
// Ponto de entrada do bingo para a plataforma (ver src/games/registry.js):
// o bingo é um jogo em tempo real (eventos de socket). Cada BINGO feito por
// uma criança logada entra no progresso dela (socketHandlers grava).

const { registerSocketHandlers } = require('./socketHandlers');

function mergeProgress(old, result) {
  const p = { wins: 0, ...(old || {}) };
  p.wins += 1;
  p.lastWinAt = Date.now();
  p.lastPattern = result.levelId;
  return p;
}

function summary(progress) {
  const wins = progress && progress.wins;
  if (!wins) return null;
  return `🏆 ${wins} ${wins === 1 ? 'bingo' : 'bingos'}`;
}

function teacherSummary(progress) {
  return { wins: (progress && progress.wins) || 0 };
}

function mergeAccounts(a, b) {
  if (!a || !b) return a || b;
  return { ...a, wins: (a.wins || 0) + (b.wins || 0), lastWinAt: Math.max(a.lastWinAt || 0, b.lastWinAt || 0) };
}

module.exports = {
  registerSockets: registerSocketHandlers,
  mergeProgress,
  summary,
  teacherSummary,
  mergeAccounts,
};
