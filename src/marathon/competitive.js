// src/marathon/competitive.js
// 🏃 Modo Maratona: confere o resultado de uma corrida. A fase e a semente
// são as que o SERVIDOR sorteou para a rodada (o navegador não escolhe
// nenhuma das duas): elas substituem o que vier no corpo e o resultado
// passa pelo mesmo validateResult do jogo no modo livre. Devolve o
// resultado validado e o desempenho (nota) para comparar os lados.

const catalog = require('./catalog');
const points = require('../platform/points');

// entry: { levelId, seed } da rodada; body: o que o navegador mandou
function validate(game, entry, body) {
  const info = catalog.describe(game);
  const Levels = points.levelsOf(game.id);
  const level = Levels && Levels.getLevel(entry.levelId);
  if (!info || !level) throw new Error(`fase ${entry.levelId} não existe em ${game.id}`);
  const forced = { ...(body && typeof body === 'object' ? body : {}), levelId: level.id, seed: entry.seed };
  if (game.id === 'matematica') forced.review = []; // sem contas de revisão: as mesmas para os dois lados
  if (level.seat != null) forced.seat = level.seat; // Fim de partida: a criança é sempre as brancas
  const result = game.server.validateResult(forced, null);
  return { result, perf: catalog.perf(game, result, level) };
}

module.exports = { validate };
