// src/games/bingo/bingoTypes.js
// Arquitetura extensível: cada "tipo de bingo" é uma estratégia que sabe
// gerar um POOL de itens possíveis a partir da config do Mestre.
// Para adicionar um novo tipo no futuro, basta registrar uma nova função
// em BINGO_TYPES com a mesma assinatura (config) => string[].

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function poolNumbers(config) {
  const max = Math.max(config.maxNumber || 75, (config.gridSize * config.gridSize) + 5);
  const min = config.minNumber || 1;
  const pool = [];
  for (let n = min; n <= max; n++) pool.push(String(n));
  return pool;
}

function poolWords(config) {
  const words = (config.words || []).map((w) => String(w).trim()).filter(Boolean);
  return Array.from(new Set(words));
}

const DEFAULT_EMOJIS = [
  '🎉', '🎈', '🎓', '📚', '✏️', '🧠', '🔬', '🎨', '🎮', '⚽', '🎵', '🌟',
  '🚀', '🌈', '🍎', '🐢', '🐝', '🌻', '☀️', '🌙', '⭐', '🔥', '💡', '🧩',
  '🏆', '🎯', '📐', '🖍️', '🧪', '🌎', '🎭', '🎲', '📖', '🖊️', '🧮', '🎤',
];

function poolEmojis(config) {
  if (config.emojis && config.emojis.length) {
    return Array.from(new Set(config.emojis));
  }
  return DEFAULT_EMOJIS;
}

function poolCustom(config) {
  const items = (config.items || []).map((w) => String(w).trim()).filter(Boolean);
  return Array.from(new Set(items));
}

const BINGO_TYPES = {
  numbers: { label: 'Números', pool: poolNumbers },
  words: { label: 'Palavras', pool: poolWords },
  emojis: { label: 'Emojis', pool: poolEmojis },
  custom: { label: 'Personalizado', pool: poolCustom },
};

function getPoolForConfig(config) {
  const strategy = BINGO_TYPES[config.bingoType];
  if (!strategy) throw new Error(`Tipo de bingo desconhecido: ${config.bingoType}`);
  const pool = strategy.pool(config);
  return pool;
}

function validateConfig(config) {
  const errors = [];
  const size = config.gridSize;
  if (![3, 4, 5, 6].includes(size)) errors.push('Tamanho de cartela inválido.');

  const pool = getPoolForConfig(config);
  const totalCells = size * size - (config.freeSpace && size % 2 === 1 ? 1 : 0);
  if (pool.length < totalCells) {
    errors.push(
      `Itens insuficientes para gerar a cartela: são necessários pelo menos ${totalCells} itens únicos, ` +
      `mas apenas ${pool.length} foram fornecidos/gerados.`
    );
  }
  if ((config.bingoType === 'words' || config.bingoType === 'custom') && pool.length === 0) {
    errors.push('É necessário cadastrar ao menos uma lista de itens/palavras.');
  }
  return errors;
}

// Gera uma cartela NxN a partir de um pool "mestre" da sala.
// Garante que, sempre que possível, cartelas de jogadores diferentes
// variem entre si (amostragem aleatória sem reposição por cartela).
function generateCard(pool, size, freeSpace) {
  const hasFree = !!freeSpace && size % 2 === 1;
  const totalCells = size * size - (hasFree ? 1 : 0);
  if (pool.length < totalCells) {
    throw new Error('Pool de itens insuficiente para gerar cartela.');
  }
  const chosen = shuffle(pool).slice(0, totalCells);

  const cells = [];
  let idx = 0;
  const center = Math.floor(size / 2);
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      if (hasFree && r === center && c === center) {
        row.push({ value: 'FREE', isFree: true, marked: true });
      } else {
        row.push({ value: chosen[idx], isFree: false, marked: false });
        idx++;
      }
    }
    cells.push(row);
  }
  return { size, freeSpace: hasFree, cells };
}

module.exports = {
  BINGO_TYPES,
  getPoolForConfig,
  validateConfig,
  generateCard,
  shuffle,
};
