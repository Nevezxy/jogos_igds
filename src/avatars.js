// src/avatars.js
// Bichinhos que a criança pode escolher como avatar e um filtro simples de
// nomes impróprios. A mesma lista de avatares existe em public/js/avatars.js
// (o cliente mostra as opções; o servidor só aceita valores desta lista).

const AVATARS = [
  '🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐧',
  '🦄', '🐙', '🐢', '🐝', '🦖', '🐰', '🐯', '🐨',
];

function normalizeAvatar(avatar) {
  return AVATARS.includes(avatar) ? avatar : AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

// Lista curta de palavrões comuns; a comparação ignora acentos, maiúsculas e
// troca de letras por números (ex.: "b0b0" vira "bobo"). É um filtro de
// cortesia para sala de aula, não uma moderação completa.
const BLOCKED = [
  'merda', 'bosta', 'porra', 'caralho', 'cacete', 'puta', 'puto', 'viado', 'buceta',
  'cu', 'foda', 'fodase', 'piroca', 'idiota', 'burro', 'otario', 'babaca',
  'retardado', 'imbecil', 'vagabundo', 'arrombado', 'corno', 'safado',
];

function normalizeForFilter(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/[^a-z\s]/g, ' ');
}

function isNameAllowed(name) {
  const words = normalizeForFilter(name).split(/\s+/).filter(Boolean);
  const joined = words.join('');
  return !words.some((w) => BLOCKED.includes(w)) && !BLOCKED.some((b) => b.length >= 5 && joined.includes(b));
}

module.exports = { AVATARS, normalizeAvatar, isNameAllowed };
