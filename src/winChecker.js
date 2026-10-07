// src/winChecker.js
// Verifica condições de vitória em uma cartela, dado o conjunto de
// condições habilitadas pelo Mestre. Roda SEMPRE no servidor.

function checkRows(cells) {
  const wins = [];
  cells.forEach((row, i) => {
    if (row.every((cell) => cell.marked)) wins.push(`linha-${i + 1}`);
  });
  return wins;
}

function checkColumns(cells) {
  const size = cells.length;
  const wins = [];
  for (let c = 0; c < size; c++) {
    let complete = true;
    for (let r = 0; r < size; r++) {
      if (!cells[r][c].marked) { complete = false; break; }
    }
    if (complete) wins.push(`coluna-${c + 1}`);
  }
  return wins;
}

function checkDiagonals(cells) {
  const size = cells.length;
  const wins = [];
  let mainOk = true;
  let antiOk = true;
  for (let i = 0; i < size; i++) {
    if (!cells[i][i].marked) mainOk = false;
    if (!cells[i][size - 1 - i].marked) antiOk = false;
  }
  if (mainOk) wins.push('diagonal-principal');
  if (antiOk) wins.push('diagonal-secundaria');
  return wins;
}

function checkFullCard(cells) {
  const complete = cells.every((row) => row.every((cell) => cell.marked));
  return complete ? ['cartela-completa'] : [];
}

// enabledPatterns: { row: bool, column: bool, diagonal: bool, fullCard: bool }
function getWinningPatterns(card, enabledPatterns) {
  const { cells } = card;
  let patterns = [];
  if (enabledPatterns.row) patterns = patterns.concat(checkRows(cells));
  if (enabledPatterns.column) patterns = patterns.concat(checkColumns(cells));
  if (enabledPatterns.diagonal) patterns = patterns.concat(checkDiagonals(cells));
  if (enabledPatterns.fullCard) patterns = patterns.concat(checkFullCard(cells));
  return patterns;
}

function hasWon(card, enabledPatterns) {
  return getWinningPatterns(card, enabledPatterns).length > 0;
}

module.exports = { getWinningPatterns, hasWon };
