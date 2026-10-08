// test/digitacao.test.js
// Teclado Mágico sem navegador: motor de digitação (comparação, precisão,
// PPM), teclado ABNT2 (como digitar cada caractere, Shift do lado oposto,
// acentos), fases (estrelas, liberação), gerador de exercícios (tudo
// digitável e só com as teclas permitidas) e a validação do servidor.

const path = require('path');
const os = require('os');
const fs = require('fs');

// o módulo do servidor abre o banco: usa um arquivo temporário
const DB_FILE = path.join(os.tmpdir(), `igds-test-digitacao-${process.pid}.sqlite`);
process.env.DB_FILE = DB_FILE;

global.window = global;
const ROOT = path.join(__dirname, '..', 'public', 'games', 'digitacao');
require(path.join(ROOT, 'layouts', 'abnt2.js'));
const Levels = require(path.join(ROOT, 'levels.js'));
require(path.join(ROOT, 'content.js'));
const { TypingRun } = require(path.join(ROOT, 'engine.js'));
const server = require('../src/games/digitacao/server');

const layout = window.DigitacaoLayouts.abnt2;
const Content = window.DigitacaoContent;

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const throwsCode = (fn, code) => { try { fn(); return false; } catch (e) { return e.code === code; } };

// ---------------- motor ----------------
let clock = 0;
const now = () => clock;
let run = new TypingRun('ab c', { now });
run.type('a'); clock = 1000;
let r = run.type('x');
assert(!r.ok && run.pos === 1, 'erro não avança quando espera a tecla certa');
run.type('b'); run.type(' '); clock = 3000;
r = run.type('c');
assert(r.done && run.done, 'termina no último caractere');
assert(run.accuracy() === 75, `precisão conta acerto de primeira (3 de 4 = ${run.accuracy()}%)`);
assert(run.wpm() === 16, `PPM = (4 caracteres ÷ 5) ÷ 0,05 minuto = ${run.wpm()}`);
assert(run.result().errorsByChar.b === 1 && run.toughest()[0].char === 'b', 'guarda a tecla que errou');

run = new TypingRun('ab', { stopOnError: false });
run.type('x');
assert(run.pos === 1 && run.missed.has(0), 'sem esperar a tecla certa, o erro avança');

run = new TypingRun('pão');
run.type('p'); r = run.type('ã'); // "ã" decomposto
assert(r.ok, 'acento decomposto (a + ~ combinante) vale igual ao composto');

// ---------------- teclado ABNT2 ----------------
const s = (ch) => layout.strokesFor(ch);
assert(s('f')[0].code === 'KeyF' && !s('f')[0].shift, 'f é a tecla F sem Shift');
assert(s('A')[0].shift && s('A')[0].shiftCode === 'ShiftRight', 'A (mão esquerda) usa o Shift direito');
assert(s('J')[0].shiftCode === 'ShiftLeft', 'J (mão direita) usa o Shift esquerdo');
assert(s('ç')[0].code === 'Semicolon', 'ç tem tecla própria (à direita do L)');
assert(s('á').length === 2 && s('á')[0].code === 'BracketLeft' && s('á')[0].dead && s('á')[1].code === 'KeyA', 'á = acento agudo (morto) + A');
assert(s('ã')[0].code === 'Quote' && !s('ã')[0].shift, 'ã = til + A');
assert(s('ê')[0].code === 'Quote' && s('ê')[0].shift, 'ê = Shift + til (circunflexo) + E');
assert(s('à')[0].code === 'BracketLeft' && s('à')[0].shift, 'à = Shift + acento (crase) + A');
assert(s('É')[1].shift && s('É')[1].code === 'KeyE', 'É = acento + Shift + E');
assert(s('?')[0].code === 'IntlRo' && s('?')[0].shift && s('?')[0].shiftCode === 'ShiftLeft', '? = Shift + a tecla / do ABNT2');
assert(s(';')[0].code === 'Slash' && s(':')[0].shift, '; e : ficam na tecla ao lado do ponto');
assert(s('"')[0].code === 'Backquote' && s('"')[0].shift, '" = Shift + a tecla à esquerda do 1');
assert(s('@')[0].code === 'Digit2' && s('(')[0].code === 'Digit9', '@ é Shift + 2 e ( é Shift + 9');
assert(s(' ')[0].code === 'Space', 'espaço');
assert(layout.keys.KeyF.fingerId === 'e2' && layout.keys.KeyJ.fingerId === 'd2' && layout.keys.KeyF.home, 'F e J são dos indicadores e marcam a posição inicial');
assert(layout.keys.KeyA.fingerId === 'e5' && layout.keys.Semicolon.fingerId === 'd5', 'A e Ç são dos mindinhos');

// ---------------- fases ----------------
assert(Levels.LEVELS.length >= 50 && Levels.WORLDS.length === 10, `${Levels.WORLDS.length} mundos e ${Levels.LEVELS.length} fases`);
assert(new Set(Levels.LEVELS.map((l) => l.id)).size === Levels.LEVELS.length, 'ids das fases são únicos');
assert(Levels.starsFor('m1f1', 84, 0) === 0, 'menos de 85% de precisão: sem estrela');
assert(Levels.starsFor('m1f1', 90, 0) === 1 && Levels.starsFor('m1f1', 95, 0) === 2, '85% = 1 estrela, 93% = 2 estrelas');
assert(Levels.starsFor('m1f1', 99, 0) === 3, 'nos mundos 1 a 4 a 3ª estrela não exige velocidade');
assert(Levels.starsFor('m10f1', 99, 5) === 2 && Levels.starsFor('m10f1', 99, 15) === 3, 'nos textos a 3ª estrela exige velocidade');
assert(Levels.ALL_UNLOCKED && Levels.LEVELS.every((l) => Levels.isUnlocked(null, l.id)), 'todas as fases começam liberadas');
assert(!Levels.isUnlocked(null, 'nada'), 'fase inexistente não é liberada');
assert(Levels.nextLevel({ levels: { m1f1: { stars: 2 } } }).id === 'm1f2', 'próxima fase é a primeira sem estrela');

// ---------------- conteúdo ----------------
const problems = [];
const typable = (where, text) => { for (const ch of text) if (!layout.canType(ch)) problems.push(`${where}: "${ch}"`); };
Content.WORD_BANK.forEach((w) => typable('banco', w));
Object.values(Content.SENTENCES).flat().forEach((t) => typable('frase', t));
Object.values(Content.TEXTS).forEach((t) => typable('texto', t));
for (const level of Levels.LEVELS) {
  for (let i = 0; i < 25; i++) {
    const text = Content.generate(level);
    if (!text || text.length < 10) problems.push(`${level.id}: exercício curto demais`);
    typable(level.id, text);
    const allowed = level.keys || level.letters;
    if (allowed && ['drill', 'words', 'mix'].includes(level.kind)) {
      for (const ch of text) if (ch !== ' ' && !allowed.includes(ch)) problems.push(`${level.id}: "${ch}" fora das teclas da fase`);
    }
  }
}
Content.PRACTICE.forEach((p) => typable('treino ' + p.id, p.make()));

// modo "apenas maiúsculas": o mesmo conteúdo em MAIÚSCULA continua digitável
const upperProblems = [];
const upper = (t) => t.toLocaleUpperCase('pt-BR');
for (const level of Levels.LEVELS) {
  for (let i = 0; i < 10; i++) {
    const text = upper(Content.generate(level));
    for (const ch of text) if (!layout.canType(ch)) upperProblems.push(`${level.id}: "${ch}"`);
    if (/[a-zà-ÿ]/.test(text)) upperProblems.push(`${level.id}: sobrou minúscula`);
  }
}
Content.PRACTICE.forEach((p) => { for (const ch of upper(p.make())) if (!layout.canType(ch)) upperProblems.push(`treino ${p.id}: "${ch}"`); });
assert(upperProblems.length === 0, `em maiúsculas, todo exercício é digitável e não sobra minúscula${upperProblems.length ? ': ' + [...new Set(upperProblems)].slice(0, 5).join(', ') : ''}`);
assert(upper('maçã ação pé avô à') === 'MAÇÃ AÇÃO PÉ AVÔ À', 'maiúsculas mantêm cedilha e acentos');
assert(s('Ç')[0].code === 'Semicolon' && s('Ç')[0].shift && s('Ã').length === 2 && s('Ã')[1].shift, 'Ç e Ã maiúsculos têm o caminho certo no teclado');
assert(problems.length === 0, `todo exercício é digitável no ABNT2 e respeita as teclas da fase${problems.length ? ': ' + [...new Set(problems)].slice(0, 5).join(', ') : ''}`);

// ---------------- validação no servidor ----------------
const good = { levelId: 'm1f1', chars: 50, durationMs: 60000, accuracy: 98, wpm: 10, wrongPresses: 1, errorsByChar: { j: 1, xx: 5 } };
const v = server.validateResult(good, null);
assert(v.stars === 3 && v.levelId === 'm1f1', 'resultado válido ganha as estrelas calculadas pelo servidor');
assert(!('xx' in v.errorsByChar) && v.errorsByChar.j === 1, 'erros por tecla são limpos');
assert(server.validateResult({ ...good, levelId: 'm10f5', durationMs: 60000 }, null).levelId === 'm10f5', 'qualquer fase vale, mesmo sem jogar as anteriores');
assert(throwsCode(() => server.validateResult({ ...good, levelId: 'nada' }, null), 'FASE_INVALIDA'), 'fase inexistente é recusada');
assert(throwsCode(() => server.validateResult({ ...good, wpm: 80 }, null), 'RESULTADO_INVALIDO'), 'velocidade que não bate com o tempo é recusada');
assert(throwsCode(() => server.validateResult({ ...good, accuracy: 150 }, null), 'RESULTADO_INVALIDO'), 'precisão fora de 0–100 é recusada');
let p = server.mergeProgress(null, v);
p = server.mergeProgress(p, { ...v, stars: 1, wpm: 5, accuracy: 86 });
assert(p.levels.m1f1.stars === 3 && p.levels.m1f1.bestWpm === 10 && p.levels.m1f1.plays === 2, 'progresso guarda o melhor resultado de cada fase');
assert(p.keyErrors.j === 2 && p.totalChars === 100, 'progresso soma erros por tecla e caracteres');
assert(server.summary(p) === 'Fase 2 · ⭐ 3', `resumo do cartão: "${server.summary(p)}"`);
assert(server.summary(null) === null, 'sem progresso, sem resumo');

console.log('\n----------------------------------------');
require('../src/platform/db').db.close();
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_FILE + suffix, { force: true });
if (errors.length) {
  console.log(`❌ ${errors.length} FALHA(S):`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('✅ TODOS OS TESTES PASSARAM');
