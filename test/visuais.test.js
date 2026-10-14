// test/visuais.test.js
// Jogos visuais (etapa D): Carrinhos (o mínimo de cada fase confere com a
// busca, as jogadas valem), Pixel Art (desenhos certos, pincel, balde e
// contas), Encontre a Diferença (toda cena tem as diferenças pedidas, sem
// uma em cima da outra) e Quebra-cabeça (os encaixes de peças vizinhas se
// completam, as fotos existem); e o servidor conferindo e dando as estrelas.

const fs = require('fs');
const path = require('path');
const CarLevels = require('../public/games/carrinhos/levels.js');
const T = require('../public/games/carrinhos/traffic.js');
const PixLevels = require('../public/games/pixel/levels.js');
const R = require('../public/games/pixel/pixel.js');
const DifLevels = require('../public/games/diferencas/levels.js');
const S = require('../public/games/diferencas/scene.js');
const QcLevels = require('../public/games/quebracabeca/levels.js');
const J = require('../public/games/quebracabeca/jigsaw.js');
const Rng = require('../public/js/shared/rng.js');
const { startTestServer } = require('./helpers');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

// pinta tudo certo: o balde nas regiões e o pincel no resto
function paintAll(pic) {
  const painted = new Array(pic.target.length).fill(0);
  const actions = [];
  pic.target.forEach((t, i) => {
    if (!t || painted[i] === t) return;
    R.paint(pic, painted, [i, t, 1]);
    actions.push([i, t, 1]);
  });
  return actions;
}
// toca no centro de cada diferença
const tapAll = (scene) => scene.diffs.map((d) => [d.circles[0][0], d.circles[0][1]]);

function checkCarrinhos() {
  const bad = [];
  let prev = 0;
  for (const level of CarLevels.LEVELS) {
    const p = T.parse(level.board);
    if (p.vehicles[0].id !== 'A' || !p.vehicles[0].h || p.vehicles[0].line !== T.EXIT_ROW) bad.push(`${level.id}: carro vermelho fora da linha da saída`);
    const sol = T.solve(p);
    if (!sol || sol.length !== level.min) bad.push(`${level.id}: mínimo ${level.min}, busca achou ${sol && sol.length}`);
    if (level.min < prev) bad.push(`${level.id}: mais fácil que a anterior`);
    prev = level.min;
    const r = T.replay(p, sol || []);
    if (!r.ok || !r.done) bad.push(`${level.id}: a solução não sai`);
  }
  assert(bad.length === 0, `carrinhos: as ${CarLevels.LEVELS.length} fases têm o mínimo certo, em ordem de dificuldade${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  assert(CarLevels.LEVELS[0].min <= 2 && CarLevels.LEVELS[CarLevels.LEVELS.length - 1].min >= 30, `carrinhos: de ${CarLevels.LEVELS[0].min} a ${CarLevels.LEVELS[CarLevels.LEVELS.length - 1].min} jogadas`);
  const p = T.parse('......' + '......' + 'AA..B.' + '....B.' + '......' + '......');
  assert(!T.isLegal(p, p.state, [0, 4]) && T.isLegal(p, p.state, [0, 2]) && !T.isLegal(p, p.state, [1, 5]) && T.isLegal(p, p.state, [1, 4]) && T.isLegal(p, p.state, [1, 0]),
    'carrinhos: não passa por cima de outro carro e não sai do estacionamento');
}

function checkPixel() {
  const bad = [];
  for (const level of PixLevels.LEVELS) {
    const d = PixLevels.designOf(level);
    if (!d) { bad.push(`${level.id}: sem desenho`); continue; }
    const pic = R.parse(d);
    if (d.rows.some((r) => r.length !== pic.w)) bad.push(`${level.id}: linhas de tamanhos diferentes`);
    for (let c = 1; c <= pic.colors; c++) if (!pic.target.includes(c)) bad.push(`${level.id}: a cor ${c} não aparece`);
    if (pic.target.some((t) => t > pic.colors)) bad.push(`${level.id}: cor fora da paleta`);
    const r = R.replay(pic, paintAll(pic));
    if (!r.ok || !r.done || r.errors) bad.push(`${level.id}: pintando tudo certo não termina`);
  }
  assert(bad.length === 0, `pixel: os ${PixLevels.LEVELS.length} desenhos estão certos e dá para pintar todos${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  const sizes = PixLevels.LEVELS.map((l) => R.parse(PixLevels.designOf(l)));
  assert(sizes[0].w === 8 && sizes[0].colors === 2 && Math.max(...sizes.map((s) => s.w)) === 24 && Math.max(...sizes.map((s) => s.colors)) === 10, 'pixel: de 8 × 8 com 2 cores a 24 × 24 com 10 cores');
  // as contas dão o número da cor
  const calc = (e) => { const m = e.match(/^(\d+)([+−×÷])(\d+)$/); const [a, b] = [Number(m[1]), Number(m[3])]; return { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[2]]; };
  const rng = Rng.rng(42);
  let wrong = 0;
  for (const op of ['add', 'sub', 'addsub', 'mul', 'div', 'mix']) for (let v = 1; v <= 9; v++) for (let k = 0; k < 20; k++) if (calc(R.expression(v, op, rng)) !== v) wrong++;
  assert(wrong === 0, 'pixel: as contas (+, −, ×, ÷) sempre dão o número da cor');
  // pincel errado conta erro e fica para corrigir; balde errado conta erro e não pinta
  const pic = R.parse(PixLevels.designOf(PixLevels.getLevel('px1c')));
  const painted = new Array(pic.target.length).fill(0);
  const i1 = pic.target.indexOf(1);
  const b = R.paint(pic, painted, [i1, 2, 1]);
  const w = R.paint(pic, painted, [i1, 2, 0]);
  const fix = R.paint(pic, painted, [i1, 1, 0]);
  const again = R.paint(pic, painted, [i1, 1, 0]);
  assert(b.error && !b.cells.length && w.error && !fix.error && painted[i1] === 1 && !again.ok, 'pixel: cor errada conta erro, dá para corrigir e o certo não se pinta de novo');
  assert(!R.paint(pic, painted, [pic.target.indexOf(0), 1, 0]).ok, 'pixel: o fundo não se pinta');
}

function checkDiferencas() {
  const bad = [];
  for (const level of DifLevels.LEVELS) {
    for (let s = 1; s <= 30; s++) {
      let scene;
      try { scene = S.makeScene(level, s * 2654435761 % 0xFFFFFFFF); } catch (e) { bad.push(`${level.id}: ${e.message}`); continue; }
      if (scene.diffs.length !== level.diffs) bad.push(`${level.id}: ${scene.diffs.length} diferenças`);
      if (scene.diffs.some((d) => !level.kinds.includes(d.kind))) bad.push(`${level.id}: tipo de diferença fora da fase`);
      const pts = scene.diffs.flatMap((d, i) => d.circles.map((c) => [i, ...c]));
      for (const a of pts) for (const b of pts) if (a[0] < b[0] && Math.hypot(a[1] - b[1], a[2] - b[2]) < Math.min(a[3], b[3])) bad.push(`${level.id}: diferenças uma em cima da outra`);
      const r = S.replay(scene, tapAll(scene));
      if (!r.ok || !r.done || r.errors) bad.push(`${level.id}: tocando nas diferenças não termina`);
    }
  }
  assert(bad.length === 0, `diferenças: as cenas das ${DifLevels.LEVELS.length} fases têm as diferenças pedidas, separadas${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  const a = S.makeScene(DifLevels.getLevel('df3a'), 99);
  const b = S.makeScene(DifLevels.getLevel('df3a'), 99);
  assert(JSON.stringify(a) === JSON.stringify(b), 'diferenças: a mesma semente dá a mesma cena (o servidor refaz igual)');
  const r = S.replay(a, [[-50, -50], ...tapAll(a)]);
  assert(r.ok && r.done && r.errors === 1, 'diferenças: toque fora das diferenças conta erro');
}

function checkQuebra() {
  const bad = [];
  for (const level of QcLevels.LEVELS) {
    const g = J.cut(level, 777);
    const at = (c, r) => g.pieces[r * g.cols + c];
    if (g.pieces.length !== level.pieces) bad.push(`${level.id}: ${g.pieces.length} peças`);
    for (const p of g.pieces) {
      if ((p.c === 0) !== (p.left === 0) || (p.r === 0) !== (p.top === 0) || (p.c === g.cols - 1) !== (p.right === 0) || (p.r === g.rows - 1) !== (p.bottom === 0)) bad.push(`${level.id}: borda errada`);
      if (p.c < g.cols - 1 && p.right !== -at(p.c + 1, p.r).left) bad.push(`${level.id}: encaixe dos lados não completa`);
      if (p.r < g.rows - 1 && p.bottom !== -at(p.c, p.r + 1).top) bad.push(`${level.id}: encaixe de cima e baixo não completa`);
      if (!level.rotate && p.rot) bad.push(`${level.id}: peça virada sem ser fase de girar`);
      if (level.rotate && !p.rot) bad.push(`${level.id}: peça já certa numa fase de girar`);
    }
    if (!fs.existsSync(path.join(__dirname, '../public', QcLevels.photoUrl(level)))) bad.push(`${level.id}: foto ${level.photo} não existe`);
  }
  assert(bad.length === 0, `quebra-cabeça: os encaixes das ${QcLevels.LEVELS.length} fases se completam e as fotos existem${bad.length ? `: ${bad.slice(0, 3).join(' / ')}` : ''}`);
  const counts = QcLevels.LEVELS.map((l) => l.pieces);
  assert(counts[0] === 4 && Math.max(...counts) === 48, 'quebra-cabeça: de 4 a 48 peças');
  assert(new Set(QcLevels.LEVELS.map((l) => l.photo)).size === QcLevels.LEVELS.length, 'quebra-cabeça: uma foto diferente em cada fase');
  assert(/^M[\d. ]+ L/.test(J.path(J.cut(QcLevels.LEVELS[0], 1).pieces[0], 100)), 'quebra-cabeça: o contorno da peça é um caminho SVG');
}

async function checkServer() {
  const srv = await startTestServer(3114);
  const { api } = srv;
  try {
    const kid = await srv.student('Lia Souza');
    // carrinhos
    const cl = CarLevels.getLevel('cr2c');
    const sol = T.solve(T.parse(cl.board));
    let r = await api('POST', '/api/progress/carrinhos/results', { levelId: cl.id, seed: 1, moves: sol, hints: 0, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 3 && r.progress.levels.cr2c.best === cl.min, 'carrinhos: no mínimo de jogadas = 3 estrelas e recorde');
    r = await api('POST', '/api/progress/carrinhos/results', { levelId: cl.id, seed: 1, moves: sol, hints: 2, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 2, 'carrinhos: com dica, no máximo 2 estrelas');
    r = await api('POST', '/api/progress/carrinhos/results', { levelId: cl.id, seed: 1, moves: sol.slice(0, -1), durationMs: 60000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'carrinhos: sem tirar o carro vermelho é recusado');
    r = await api('POST', '/api/progress/carrinhos/results', { levelId: cl.id, seed: 1, moves: [[0, 4]], durationMs: 60000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'carrinhos: passar por cima de outro carro é recusado');

    // pixel
    const pl = PixLevels.getLevel('px2a');
    const pic = R.parse(PixLevels.designOf(pl));
    const acts = paintAll(pic);
    r = await api('POST', '/api/progress/pixel/results', { levelId: pl.id, seed: 5, actions: acts, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 3 && r.progress.levels.px2a.best === 0, 'pixel: pintou tudo certo = 3 estrelas, recorde de 0 erros');
    const i1 = pic.target.indexOf(1);
    const wrongs = Array.from({ length: 12 }, () => [i1, 2, 0]);
    r = await api('POST', '/api/progress/pixel/results', { levelId: pl.id, seed: 5, actions: [...wrongs, ...acts], durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 1, 'pixel: muitos erros = 1 estrela');
    r = await api('POST', '/api/progress/pixel/results', { levelId: pl.id, seed: 5, actions: acts.slice(1), durationMs: 60000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'pixel: desenho incompleto é recusado');

    // diferenças
    const dl = DifLevels.getLevel('df2b');
    const scene = S.makeScene(dl, 4242);
    r = await api('POST', '/api/progress/diferencas/results', { levelId: dl.id, seed: 4242, clicks: tapAll(scene), hints: 0, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 3, 'diferenças: achou todas sem errar = 3 estrelas');
    r = await api('POST', '/api/progress/diferencas/results', { levelId: dl.id, seed: 4242, clicks: [[1, 1], [2, 2], [3, 3], ...tapAll(scene)], hints: 1, durationMs: 60000 }, kid);
    assert(r.ok && r.result.stars === 2, 'diferenças: 3 toques errados e 1 dica = 2 estrelas');
    r = await api('POST', '/api/progress/diferencas/results', { levelId: dl.id, seed: 4243, clicks: tapAll(scene), durationMs: 60000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'diferenças: toques de outra cena são recusados');

    // quebra-cabeça
    const ql = QcLevels.getLevel('qc1c');
    const all = Array.from({ length: ql.pieces }, (_, i) => i);
    r = await api('POST', '/api/progress/quebracabeca/results', { levelId: ql.id, seed: 3, placed: all, durationMs: 20000 }, kid);
    assert(r.ok && r.result.stars === 3 && r.progress.levels.qc1c.best === 20, 'quebra-cabeça: rápido = 3 estrelas, recorde em segundos');
    r = await api('POST', '/api/progress/quebracabeca/results', { levelId: ql.id, seed: 3, placed: all, durationMs: QcLevels.parSeconds(ql) * 3000 }, kid);
    assert(r.ok && r.result.stars === 1 && r.progress.levels.qc1c.best === 20, 'quebra-cabeça: devagar = 1 estrela (o recorde continua o melhor)');
    r = await api('POST', '/api/progress/quebracabeca/results', { levelId: ql.id, seed: 3, placed: [0, 0, 1, 2, 3, 4, 5, 6, 7], durationMs: 20000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'quebra-cabeça: peça repetida é recusada');
    r = await api('POST', '/api/progress/quebracabeca/results', { levelId: ql.id, seed: 3, placed: all, durationMs: 2000 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'quebra-cabeça: rápido demais é recusado');

    const games = (await api('GET', '/api/games')).games;
    const ids = games.filter((g) => g.subject === 'raciocinio').map((g) => g.id);
    assert(['carrinhos', 'pixel', 'diferencas', 'quebracabeca'].every((id) => ids.includes(id)), 'os 4 jogos novos na seção 🧩 Raciocínio');
  } finally {
    await srv.stop();
  }
}

(async () => {
  try {
    checkCarrinhos();
    checkPixel();
    checkDiferencas();
    checkQuebra();
    await checkServer();
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    process.exit(1);
  }
  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
})();
