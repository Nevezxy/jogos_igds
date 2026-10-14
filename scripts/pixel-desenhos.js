// scripts/pixel-desenhos.js
// Gera os desenhos do 🎨 Pixel Art (public/games/pixel/designs.js). Os
// pequenos são escritos linha a linha; os grandes, com formas (retângulo,
// elipse, polígono), para ficarem redondinhos. Também grava uma folha com
// todos os desenhos em PNG para conferir (o caminho vai no 1º argumento).
//   node scripts/pixel-desenhos.js [folha.png]
// Em cada linha: '.' é fundo (não se pinta) e 1..9, a = cor 1..10 da paleta.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- ferramentas de desenho ----------
function canvas(w, h, fill = '.') { return { w, h, g: Array.from({ length: h }, () => new Array(w).fill(fill)) }; }
const set = (c, x, y, v) => { if (x >= 0 && y >= 0 && x < c.w && y < c.h) c.g[y][x] = v; };
function rect(c, x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(c, x, y, v); }
function ellipse(c, cx, cy, rx, ry, v) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) set(c, x, y, v);
  }
}
function poly(c, pts, v) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) set(c, x, y, v);
  }
}
function ring(c, cx, cy, r0, r1, v, half = false) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d >= r0 && d < r1 && (!half || y + 0.5 <= cy)) set(c, x, y, v);
  }
}
const rows = (c) => c.g.map((r) => r.join(''));
// espelha a metade esquerda na direita (desenhos simétricos)
function mirror(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w / 2; x++) c.g[y][c.w - 1 - x] = c.g[y][x]; }

// ---------- as cores ----------
const C = {
  vermelho: '#E53935', vermelhoEsc: '#9E1B1B', rosa: '#F06292', rosaClaro: '#F8BBD0', laranja: '#FB8C00', amarelo: '#FDD835',
  amareloClaro: '#FFF59D', verde: '#43A047', verdeClaro: '#9CCC65', verdeEsc: '#1B5E20', azul: '#1E88E5', azulClaro: '#81D4FA',
  azulEsc: '#0D47A1', roxo: '#8E24AA', lilas: '#CE93D8', marrom: '#795548', marromEsc: '#4E342E', bege: '#D7B98E', creme: '#FFF3D6',
  branco: '#FFFFFF', cinza: '#9E9E9E', cinzaClaro: '#CFD8DC', cinzaEsc: '#546E7A', preto: '#263238', pele: '#FFCC80', terracota: '#BF6B3F',
};

const D = [];
const add = (id, name, palette, r) => { D.push({ id, name, palette: palette.map((k) => C[k] || k), rows: r }); };

// ---------- 8 × 8 ----------
add('coracao', 'Coração', ['vermelho', 'rosaClaro'], [
  '.11..11.',
  '12211111',
  '12111111',
  '11111111',
  '.111111.',
  '..1111..',
  '...11...',
  '........',
]);
add('sorriso', 'Carinha feliz', ['amarelo', 'preto'], [
  '..1111..',
  '.111111.',
  '11211211',
  '11111111',
  '12111121',
  '11222211',
  '.111111.',
  '..1111..',
]);
add('maca', 'Maçã', ['vermelho', 'verde', 'marrom'], [
  '....3.22',
  '....322.',
  '.111311.',
  '11111111',
  '11111111',
  '11111111',
  '.111111.',
  '..11.11.',
]);
add('cogumelo', 'Cogumelo', ['vermelho', 'creme', 'preto'], [
  '..1111..',
  '.112211.',
  '11111221',
  '12211111',
  '11111111',
  '..2222..',
  '..3223..',
  '..2222..',
]);
add('barco', 'Barquinho', ['azul', 'vermelho', 'creme'], [
  '...3....',
  '...33...',
  '...333..',
  '...3333.',
  '...2....',
  '22222222',
  '.222222.',
  '11111111',
]);
add('peixe', 'Peixinho', ['laranja', 'preto', 'amarelo'], [
  '........',
  '.1131...',
  '111311.1',
  '12131111',
  '11131111',
  '111311.1',
  '.1131...',
  '........',
]);

// ---------- 10 × 10 a 12 × 12 ----------
add('gato', 'Gatinho', ['laranja', 'preto', 'rosa'], [
  '.1......1.',
  '.11....11.',
  '.13111131.',
  '.11111111.',
  '1121111211',
  '1111331111',
  '1111111111',
  '.11122111.',
  '..111111..',
  '...1111...',
]);
add('flor', 'Flor', ['rosa', 'amarelo', 'verde'], [
  '..11..11..',
  '.11111111.',
  '.11122111.',
  '..122221..',
  '.11122111.',
  '.11111111.',
  '..11331 1..'.replace(' ', '').slice(0, 10),
  '33..33....',
  '.3333.....',
  '....33....',
]);
add('sorvete', 'Sorvete', ['rosa', 'creme', 'bege', 'vermelho'], [
  '....44....',
  '...1111...',
  '..111111..',
  '..121121..',
  '.22222222.',
  '.22222222.',
  '..333333..',
  '...3333...',
  '...3333...',
  '....33....',
  '....33....',
]);
add('casinha', 'Casinha', ['vermelho', 'bege', 'marrom', 'azulClaro', 'verde'], [
  '.....11.....',
  '....1111....',
  '...111111...',
  '..11111111..',
  '.1111111111.',
  '..22222222..',
  '..24422442..'.replace(/4/g, '4'),
  '..24422442..',
  '..22233222..',
  '..22233222..',
  '..22233222..',
  '555555555555',
]);
add('arvore', 'Árvore', ['verde', 'verdeEsc', 'marrom', 'vermelho'], [
  '...1111...',
  '..111211..',
  '.11411121.',
  '.12111141.',
  '1111411121',
  '1211111111',
  '.11411211.',
  '..111111..',
  '....33....',
  '....33....',
  '...3333...',
]);
add('foguete', 'Foguete', ['cinzaClaro', 'vermelho', 'azulClaro', 'laranja', 'amarelo'], [
  '.....22.....',
  '....2222....',
  '....1111....',
  '...111111...',
  '...113311...',
  '...113311...',
  '...111111...',
  '..21111112..',
  '.2211111122.',
  '.22.1111.22.',
  '....4554....',
  '.....44.....',
]);

// ---------- 16 × 16 ----------
{
  const c = canvas(20, 14, '1');
  poly(c, [[10, 0.6], [19.4, 7], [10, 13.4], [0.6, 7]], '2');
  ellipse(c, 10, 7, 3.7, 3.7, '3');
  for (const [x, y] of [[6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 7], [12, 7], [13, 7]]) set(c, x, y, '4');
  for (const [x, y] of [[8, 8], [10, 9], [12, 9], [9, 10], [11, 4]]) set(c, x, y, '4');
  add('brasil', 'Bandeira do Brasil', ['verde', 'amarelo', 'azulEsc', 'branco'], rows(c));
}
{
  const c = canvas(16, 16);
  ellipse(c, 4.5, 5, 4.4, 4.6, '1');
  ellipse(c, 5, 11.5, 3.6, 3.4, '2');
  ellipse(c, 4, 4.5, 1.8, 1.8, '3');
  ellipse(c, 4.6, 11.6, 1.4, 1.4, '5');
  set(c, 2, 7, '3'); set(c, 6, 2, '5');
  mirror(c);
  rect(c, 7, 3, 8, 14, '4');
  set(c, 6, 1, '4'); set(c, 9, 1, '4'); set(c, 7, 2, '4'); set(c, 8, 2, '4');
  add('borboleta', 'Borboleta', ['roxo', 'rosa', 'amarelo', 'preto', 'azulClaro'], rows(c));
}
{
  const c = canvas(16, 16);
  ellipse(c, 8, 9, 6, 7, '1');
  ellipse(c, 8, 10.3, 4.2, 5.4, '2');
  ellipse(c, 8, 4.5, 4.5, 3.8, '1');
  ellipse(c, 6, 4.4, 1.5, 1.6, '2'); ellipse(c, 10, 4.4, 1.5, 1.6, '2');
  set(c, 6, 4, '1'); set(c, 9, 4, '1');
  rect(c, 7, 6, 8, 6, '3'); set(c, 7, 7, '3'); set(c, 8, 7, '3');
  for (let x = 0; x < 16; x++) if (c.g[8][x] !== '.') c.g[8][x] = '4';
  set(c, 11, 9, '4'); set(c, 11, 10, '4'); set(c, 12, 9, '4');
  rect(c, 4, 15, 6, 15, '3'); rect(c, 9, 15, 11, 15, '3');
  add('pinguim', 'Pinguim', ['preto', 'creme', 'laranja', 'vermelho'], rows(c));
}
{
  const c = canvas(16, 16);
  ellipse(c, 8, 10.5, 5.4, 5.5, '1');
  for (let y = 5; y < 16; y++) for (let x = 0; x < 16; x++) if (c.g[y][x] === '1' && (x + y) % 3 === 0) c.g[y][x] = '2';
  poly(c, [[8, 0], [10, 4], [13, 1.5], [11.5, 5.4], [4.5, 5.4], [3, 1.5], [6, 4]], '3');
  poly(c, [[8, 0.5], [9, 4.5], [7, 4.5]], '4');
  set(c, 5, 3, '4'); set(c, 11, 3, '4');
  add('abacaxi', 'Abacaxi', ['amarelo', 'laranja', 'verde', 'verdeEsc'], rows(c));
}
{
  const c = canvas(16, 16);
  ellipse(c, 8, 8.5, 6.5, 6.8, '1');
  ellipse(c, 8, 10.5, 3.8, 4.2, '2');
  set(c, 2, 1, '1'); set(c, 3, 2, '1'); set(c, 13, 1, '1'); set(c, 12, 2, '1');
  ellipse(c, 5.2, 6, 2.4, 2.4, '3'); ellipse(c, 10.8, 6, 2.4, 2.4, '3');
  rect(c, 5, 5, 5, 6, '4'); rect(c, 10, 5, 10, 6, '4');
  set(c, 7, 8, '5'); set(c, 8, 8, '5'); set(c, 7, 9, '5'); set(c, 8, 9, '5');
  for (const [x, y] of [[6, 11], [9, 11], [7, 13], [8, 12], [10, 13], [5, 13]]) set(c, x, y, '1');
  rect(c, 0, 15, 15, 15, '6');
  set(c, 5, 14, '5'); set(c, 10, 14, '5');
  add('coruja', 'Coruja', ['marrom', 'bege', 'creme', 'preto', 'laranja', 'marromEsc'], rows(c));
}
{
  const c = canvas(16, 14);
  ellipse(c, 2.2, 8, 2.2, 1.8, '1');
  ellipse(c, 4.5, 12.2, 1.6, 1.6, '1'); ellipse(c, 11.5, 12.2, 1.6, 1.6, '1');
  set(c, 15, 9, '1'); set(c, 14, 9, '1');
  ellipse(c, 8.5, 8, 6, 4.8, '2');
  rect(c, 3, 10, 14, 10, '5');
  for (const [x, y] of [[6, 5], [7, 5], [10, 5], [11, 5], [8, 7], [9, 7], [5, 8], [12, 8], [6, 9], [11, 9], [8, 4], [9, 4]]) set(c, x, y, '3');
  set(c, 1, 7, '4');
  add('tartaruga', 'Tartaruga', ['verdeClaro', 'verdeEsc', 'marrom', 'preto', 'bege'], rows(c));
}

// ---------- 20 × 20 a 24 × 24 ----------
{
  const c = canvas(22, 14);
  const bands = ['1', '2', '3', '4', '5', '6'];
  bands.forEach((b, i) => ring(c, 11, 13.2, 10.8 - i * 1.4, 12.2 - i * 1.4, b, true));
  ellipse(c, 3, 12.5, 3, 1.8, '7'); ellipse(c, 5.2, 11.6, 2, 1.8, '7');
  ellipse(c, 19, 12.5, 3, 1.8, '7'); ellipse(c, 16.8, 11.6, 2, 1.8, '7');
  add('arcoiris', 'Arco-íris', ['vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'cinzaClaro'], rows(c));
}
{
  const c = canvas(20, 22);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ellipse(c, 10 + Math.cos(a) * 5.4, 7.5 + Math.sin(a) * 5.4, 2.3, 2.3, k % 2 ? '2' : '1');
  }
  ellipse(c, 10, 7.5, 4.2, 4.2, '3');
  for (let y = 0; y < 22; y++) for (let x = 0; x < 20; x++) if (c.g[y][x] === '3' && (x * 3 + y * 5) % 4 === 0) c.g[y][x] = '4';
  rect(c, 9, 13, 10, 19, '5');
  poly(c, [[10, 16], [15.5, 13.5], [14, 17]], '6');
  poly(c, [[10, 17.5], [4, 15], [6, 19]], '6');
  rect(c, 6, 19, 13, 21, '7');
  rect(c, 5, 19, 14, 19, '7');
  add('girassol', 'Girassol', ['amarelo', 'laranja', 'marrom', 'marromEsc', 'verdeEsc', 'verdeClaro', 'terracota'], rows(c));
}
{
  const c = canvas(20, 22);
  ellipse(c, 10, 6.5, 4.6, 4.8, '1');
  ellipse(c, 10, 13, 5, 6.5, '1');
  poly(c, [[5.2, 9], [9, 12], [8, 20], [4.6, 17]], '4');
  poly(c, [[14.8, 9], [11, 12], [12, 20], [15.4, 17]], '4');
  poly(c, [[8, 19], [12, 19], [13, 22], [7, 22]], '3');
  poly(c, [[9, 19], [11, 19], [10.6, 22], [9.4, 22]], '2');
  ellipse(c, 8.2, 5.2, 1.8, 1.8, '5'); set(c, 8, 5, '6');
  poly(c, [[10.2, 6], [13.5, 6.2], [12.6, 9.6], [10.5, 8.6]], '7');
  rect(c, 12, 8, 12, 8, '6');
  ellipse(c, 10, 12, 2.6, 1.2, '2');
  rect(c, 0, 17, 19, 17, '8');
  for (const x of [7, 8, 11, 12]) set(c, x, 16, '6');
  add('papagaio', 'Papagaio', ['vermelho', 'amarelo', 'azul', 'verde', 'creme', 'preto', 'cinza', 'marrom'], rows(c));
}
{
  const c = canvas(20, 22);
  rect(c, 9, 0, 10, 2, '2'); ellipse(c, 10, 1, 1.4, 1.2, '4');
  rect(c, 4, 3, 15, 10, '1');
  rect(c, 6, 5, 8, 7, '3'); rect(c, 11, 5, 13, 7, '3'); set(c, 7, 6, '7'); set(c, 12, 6, '7');
  rect(c, 7, 9, 12, 9, '7'); set(c, 8, 9, '8'); set(c, 10, 9, '8');
  rect(c, 2, 5, 3, 8, '2'); rect(c, 16, 5, 17, 8, '2');
  rect(c, 8, 11, 11, 11, '2');
  rect(c, 3, 12, 16, 19, '1');
  rect(c, 6, 13, 13, 17, '2');
  set(c, 7, 14, '4'); set(c, 9, 14, '5'); set(c, 11, 14, '6');
  rect(c, 7, 16, 12, 16, '3');
  rect(c, 0, 12, 2, 13, '2'); rect(c, 17, 12, 19, 13, '2'); rect(c, 0, 14, 1, 17, '1'); rect(c, 18, 14, 19, 17, '1');
  rect(c, 5, 20, 7, 21, '2'); rect(c, 12, 20, 14, 21, '2');
  add('robo', 'Robô', ['cinzaClaro', 'cinzaEsc', 'azulClaro', 'vermelho', 'amarelo', 'verde', 'preto', 'branco'], rows(c));
}
{
  const c = canvas(24, 18, '1');
  rect(c, 0, 15, 23, 17, '6');
  for (let x = 0; x < 24; x += 4) set(c, x + 1, 16, '9');
  for (const x0 of [2, 20]) { rect(c, x0, 9, x0, 14, '5'); rect(c, x0 + 1, 6, x0 + 1, 12, '5'); set(c, x0 - 1, 11, '5'); set(c, x0 + 2, 8, '5'); }
  ellipse(c, 17.5, 14.6, 2, 1.6, '8'); set(c, 16, 12, '8'); set(c, 19, 12, '8');
  // o peixe-palhaço: corpo laranja, faixas brancas com borda preta
  ellipse(c, 10.5, 8, 5.5, 3.6, '2');
  poly(c, [[15, 8], [18.5, 4.6], [18.5, 11.4]], '2');
  for (let y = 0; y < 18; y++) for (let x = 0; x < 24; x++) {
    if (c.g[y][x] !== '2') continue;
    if (x === 8 || x === 12) c.g[y][x] = '3';
    else if (x === 9 || x === 13) c.g[y][x] = '4';
  }
  set(c, 6, 7, '4');
  ellipse(c, 6, 2.5, 0.8, 0.8, '7'); ellipse(c, 4.5, 0.8, 0.6, 0.6, '7'); ellipse(c, 15, 2, 0.9, 0.9, '7');
  add('aquario', 'Peixe-palhaço', ['azul', 'laranja', 'branco', 'preto', 'verde', 'bege', 'azulClaro', 'rosa', 'amarelo'], rows(c));
}
{
  const c = canvas(24, 24, '1');
  ellipse(c, 20, 3.5, 2.6, 2.6, '2');
  ellipse(c, 5, 3.5, 2.6, 1.6, '3'); ellipse(c, 7.4, 3, 2, 1.8, '3'); ellipse(c, 9, 4, 1.8, 1.2, '3');
  poly(c, [[12, 5], [21.5, 12.5], [2.5, 12.5]], '4');
  rect(c, 4, 12, 19, 20, '5');
  rect(c, 10, 15, 13, 20, '6'); set(c, 12, 18, '2');
  rect(c, 5, 14, 8, 17, '7'); rect(c, 15, 14, 18, 17, '7');
  rect(c, 6, 14, 6, 17, '3'); rect(c, 5, 15, 8, 15, '3'); rect(c, 16, 14, 16, 17, '3'); rect(c, 15, 15, 18, 15, '3');
  rect(c, 16, 6, 17, 9, '6');
  rect(c, 0, 21, 23, 23, '8');
  for (const x of [1, 3, 20, 22]) { set(c, x, 19, '9'); set(c, x, 20, '8'); }
  for (const x of [2, 21]) { set(c, x, 18, 'a'); set(c, x, 20, '8'); }
  for (const x of [11, 12]) rect(c, x, 21, x, 23, 'a');
  rect(c, 11, 21, 12, 23, '5');
  add('casa', 'Casa com jardim', ['azulClaro', 'amarelo', 'branco', 'vermelho', 'bege', 'marrom', 'azul', 'verde', 'rosa', 'roxo'], rows(c));
}

// ---------- para contas (10 × 10 a 12 × 12) ----------
add('joaninha', 'Joaninha', ['vermelho', 'preto', 'branco'], [
  '...2222...',
  '..232232..',
  '..222222..',
  '.11112111.',
  '1221121221',
  '1221121221',
  '1111121111',
  '1122121221',
  '.12212221.',
  '..111211..',
]);
add('sapo', 'Sapo', ['verde', 'verdeClaro', 'branco', 'preto', 'rosa'], [
  '.111..111.',
  '1431111431',
  '1331111331',
  '1111111111',
  '1155555511',
  '1111111111',
  '.12222221.',
  '1122222211',
  '11.1111.11',
  '111....111',
]);
add('abelha', 'Abelha', ['amarelo', 'preto', 'azulClaro', 'branco'], [
  '..33..33..',
  '.3333333 3.'.replace(' ', '').slice(0, 10),
  '..333333..',
  '..111121..',
  '.21211211.',
  '221211241 '.trim() + '1',
  '.21211211.',
  '..111121..',
  '..2....2..',
  '..........',
]);
add('carro', 'Carro', ['azul', 'azulClaro', 'preto', 'cinza', 'amarelo', 'vermelho'], [
  '............',
  '....1111....',
  '...122221...',
  '..12222221..',
  '.1111111111.',
  '511111111116',
  '111111111111',
  '.1133111331.',
  '..34.....43.'.replace(/4/g, '4'),
  '...3.....3..',
]);
add('picole', 'Picolé', ['rosa', 'rosaClaro', 'marrom', 'bege', 'vermelho'], [
  '...3333...',
  '..311113..',
  '..312213..',
  '..311113..',
  '..311113..',
  '..315513..',
  '..311113..',
  '..311113..',
  '...3333...',
  '....44....',
  '....44....',
  '....44....',
]);
add('polvo', 'Polvo', ['roxo', 'lilas', 'branco', 'preto', 'rosa'], [
  '...1111...',
  '..111111..',
  '.11111111.',
  '.13411341.',
  '.11111111.',
  '.15111151.',
  '.11122111.',
  '1.11..11.1',
  '1.1.11.1.1',
  '.1.1..1.1.',
]);

// ---------- conferir e gravar ----------
const CODE = '123456789a';
for (const d of D) {
  const w = d.rows[0].length;
  d.rows.forEach((r, i) => { if (r.length !== w) throw new Error(`${d.id}: linha ${i} com ${r.length} em vez de ${w}`); });
  const used = new Set(d.rows.join('').replace(/\./g, ''));
  d.palette.forEach((_, i) => { if (!used.has(CODE[i])) throw new Error(`${d.id}: a cor ${i + 1} não aparece`); });
  for (const ch of used) if (CODE.indexOf(ch) < 0 || CODE.indexOf(ch) >= d.palette.length) throw new Error(`${d.id}: cor ${ch} fora da paleta`);
}

const out = `// public/games/pixel/designs.js
// Os desenhos do 🎨 Pixel Art, gerados por scripts/pixel-desenhos.js (não
// edite à mão). Em cada linha: '.' é fundo e 1..9, a = cor 1..10 da paleta.

(function (root) {
  const DESIGNS = {
${D.map((d) => `    ${d.id}: {
      name: ${JSON.stringify(d.name)},
      palette: ${JSON.stringify(d.palette)},
      rows: [
${d.rows.map((r) => `        '${r}',`).join('\n')}
      ],
    },`).join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DESIGNS;
  else root.PixelDesigns = DESIGNS;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(__dirname, '../public/games/pixel/designs.js'), out);
console.log(`${D.length} desenhos gravados.`);

// ---------- a folha de conferência (PNG feito à mão, sem biblioteca) ----------
const sheet = process.argv[2];
if (sheet) {
  const S = 10;
  const COLS = 6;
  const cellW = 26 * S;
  const W = COLS * cellW;
  const H = Math.ceil(D.length / COLS) * cellW;
  const px = Buffer.alloc(W * H * 3, 255);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  D.forEach((d, n) => {
    const ox = (n % COLS) * cellW + 4;
    const oy = Math.floor(n / COLS) * cellW + 4;
    d.rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const rgb = ch === '.' ? [235, 235, 235] : hex(d.palette[CODE.indexOf(ch)]);
      for (let yy = 0; yy < S - 1; yy++) for (let xx = 0; xx < S - 1; xx++) {
        const i = ((oy + y * S + yy) * W + ox + x * S + xx) * 3;
        px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2];
      }
    }));
  });
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(sheet, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('folha gravada em', sheet);
}
