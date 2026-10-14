// test/correcoes.test.js
// Os bugs achados na revisão dos jogos (RELATORIO_REVISAO_JOGOS.md), cada
// um com o caso que dava errado: variante inválida na partida pela rede,
// dicas de vai-um, empréstimo e negativos do Conta Comigo, conteúdo da
// Memória, valor mínimo do Dinheiro, en passant nas repetições do xadrez,
// abandono com os dois fora e o bingo contado duas vezes.

const os = require('os');
const path = require('path');
const fs = require('fs');

const DB = path.join(os.tmpdir(), `igds-correcoes-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILE = DB;

const P = require('../public/games/matematica/problems.js');
const Cards = require('../public/games/memoria/cards.js');
const MemLevels = require('../public/games/memoria/levels.js');
const Money = require('../public/games/dinheiro/money.js');
const MoneyLevels = require('../public/games/dinheiro/levels.js');
const Xadrez = require('../public/games/xadrez/rules.js');
const registry = require('../src/games/registry');
const accounts = require('../src/platform/accounts');
const { createMatchManager } = require('../src/platform/match');
const rm = require('../src/games/bingo/roomManager');

const errors = [];
const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
const throws = (fn) => { try { fn(); return null; } catch (e) { return e; } };
const hint = (key) => P.hint(P.build(key));

function variants() {
  for (const id of ['velha', 'ligue4', 'dama', 'xadrez']) {
    const R = require(`../public/games/${id}/rules.js`);
    for (const v of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const e = throws(() => R.initial(v));
      assert(e && e.message === 'variante desconhecida', `${id}: variante "${v}" é recusada`);
    }
  }

  // a partida pela rede: a variante esquisita nem entra na fila
  const real = accounts.authenticate;
  accounts.authenticate = (t) => ({ id: t, name: t, firstName: t, className: `turma-${t}` });
  let t = 0;
  const mm = createMatchManager(registry, { now: () => t });
  const sock = (id) => ({ id });
  const e1 = throws(() => mm.actions.queue(sock('s1'), { game: 'velha', variant: 'constructor', studentToken: 'a' }));
  assert(e1 && e1.code === 'VARIANTE_INVALIDA', 'fila: variante "constructor" é recusada');
  const e2 = throws(() => mm.actions.create(sock('s2'), { game: 'ligue4', variant: 'toString', studentToken: 'b' }));
  assert(e2 && e2.code === 'VARIANTE_INVALIDA', 'sala: variante "toString" é recusada');
  assert(mm.queue.length === 0 && mm.matches.size === 0, 'nada fica na fila nem nas salas');
  // e o pareamento continua funcionando com variante certa
  mm.actions.queue(sock('s3'), { game: 'velha', variant: '3x3', studentToken: 'c' });
  mm.actions.queue(sock('s4'), { game: 'velha', variant: '3x3', studentToken: 'd' });
  t = 9000;
  assert(!throws(() => mm.pairQueue()) && [...mm.matches.values()].some((m) => m.status === 'playing'), 'pareamento normal continua funcionando');

  // os dois caíram: ninguém vence por abandono
  const fast = createMatchManager(registry, { now: () => t, reconnectMs: 5 });
  fast.actions.create(sock('x1'), { game: 'velha', variant: '3x3', studentToken: 'e' });
  const code = [...fast.matches.values()][0].code;
  fast.actions.join(sock('x2'), { code, studentToken: 'f' });
  const m = [...fast.matches.values()][0];
  fast.actions.disconnect(sock('x1'));
  fast.actions.disconnect(sock('x2'));
  accounts.authenticate = real;
  return new Promise((resolve) => setTimeout(() => {
    assert(m.status === 'ended' && m.result.winner === null && m.result.reason === 'abandono', 'os dois caíram: a partida acaba sem vencedor');
    resolve();
  }, 60));
}

function mathHints() {
  // vai-um nas dezenas, não nas unidades
  let h = hint(['bin', '+', 52, 61, 'c']);
  assert(!h.startsWith('Some as unidades: 2 + 1 = 3. Escreva 3 e vai 1') && h.includes('dezenas: 5 + 6 = 11') && h.includes('vai 1 para as centenas'), `52 + 61: vai-um nas dezenas (${h})`);
  h = hint(['bin', '+', 27, 45, 'c']);
  assert(h.includes('7 + 5 = 12') && h.includes('vai 1'), '27 + 45: vai-um nas unidades continua igual');
  // empréstimo nas dezenas
  h = hint(['bin', '-', 125, 43, 'c']);
  assert(!h.includes('5 é menor que 3') && h.includes('2 é menor que 4') && h.includes('centenas'), `125 − 43: empréstimo nas dezenas (${h})`);
  h = hint(['bin', '-', 52, 27, 'c']);
  assert(h.startsWith('2 é menor que 7'), '52 − 27: empréstimo nas unidades continua igual');

  // número que falta com negativos: direção certa e sem entregar a resposta
  for (let a = -20; a <= 20; a++) {
    for (let b = -20; b <= 20; b++) {
      for (const op of ['+', '-']) {
        const c = P.compute(op, a, b);
        if (!(a < 0 || b < 0 || c < 0)) continue;
        for (const hide of ['a', 'b']) {
          const p = P.build(['bin', op, a, b, hide]);
          const text = P.hint(p);
          const m = text.match(/comece no (−?\d+) e ande (\d+) para (cima|baixo)/);
          if (m) {
            const start = Number(m[1].replace('−', '-'));
            const end = start + Number(m[2]) * (m[3] === 'cima' ? 1 : -1);
            if (end !== p.answer) { errors.push(`termômetro errado em ${P.text(p)}: ${text}`); return; }
          }
          // a dica de "?" não pode mostrar o próprio número escondido como passo
          if (hide === 'b' && new RegExp(`ande ${Math.abs(b)} `).test(text)) { errors.push(`a dica entrega a resposta em ${P.text(p)}: ${text}`); return; }
          if (hide === 'b' && /Menos com menos/.test(text)) { errors.push(`"menos com menos" mostra o número escondido em ${P.text(p)}`); return; }
        }
      }
    }
  }
  console.log('OK: dicas de "número que falta" com negativos: direção certa e sem a resposta');
  h = hint(['bin', '+', -5, 3, 'c']);
  assert(h.includes('comece no −5 e ande 3 para cima'), 'termômetro normal (resultado escondido) continua igual');

  // a voz lê colchetes como colchetes
  const s = P.speech(P.build(['expr', 'a*[b+(c-d)]', 2, 3, 4, 1]));
  assert(s.includes('abre colchetes') && s.includes('fecha colchetes') && s.includes('abre parênteses'), 'voz: colchetes e parênteses');
}

function memoria() {
  assert(!Cards.THEMES.frutas.some((e) => ['🥕', '🌽'].includes(e)), 'Memória: cenoura e milho não são frutas');
  assert(new Set(Cards.THEMES.tudo).size === Cards.THEMES.tudo.length, 'Memória: tema "tudo" sem figura repetida');
  const l3c = MemLevels.getLevel('mm3c');
  const l3b = MemLevels.getLevel('mm3b');
  assert(!(l3c.letters.includes('I') && l3c.letters.includes('L')), 'Memória mm3c: sem I e l juntos (iguais na tela)');
  assert(l3b.letters.includes('P') && l3b.letters.includes('Q'), 'Memória mm3b: tem P e Q, como diz a dica');
  for (const id of ['mm3c', 'mm3b']) {
    const deck = Cards.makeDeck(MemLevels.getLevel(id), 7);
    assert(deck.length === MemLevels.getLevel(id).pairs * 2, `Memória ${id}: a mesa continua completa`);
  }
}

function dinheiro() {
  let ok = true;
  for (const level of MoneyLevels.LEVELS.filter((l) => l.task === 'count')) {
    for (let seed = 0; seed < 200; seed++) {
      for (const t of Money.makeRound(level, seed)) {
        if (t.total < level.range[0] || t.total > level.range[1]) { ok = false; errors.push(`Dinheiro ${level.id}: total ${t.total} fora de ${level.range}`); break; }
      }
      if (!ok) break;
    }
  }
  if (ok) console.log('OK: Dinheiro "Quanto tem aqui?": o total respeita o mínimo e o máximo da fase');
}

function xadrez() {
  const playAll = (moves) => moves.reduce((s, m) => Xadrez.play(s, m), Xadrez.initial('classico'));
  let s = playAll(['e2e4']);
  assert(s.ep === -1, 'xadrez: e2e4 sem peão preto do lado não marca en passant');
  s = playAll(['e2e4', 'a7a6', 'e4e5', 'd7d5']);
  assert(s.ep === Xadrez.parseSq('d6') && Xadrez.moves(s).includes('e5d6'), 'xadrez: en passant continua valendo quando dá para capturar');
  // a mesma posição depois de um lance de 2 casas conta na repetição
  s = playAll(['e2e4', 'g8f6', 'g1f3', 'f6g8', 'f3g1', 'g8f6', 'g1f3', 'f6g8', 'f3g1']);
  assert(s.result && s.result.reason === 'repeticao', 'xadrez: 3 repetições contam logo depois de e2e4');
}

function bingo() {
  const room = rm.createRoom({ name: 'Teste' });
  const token = room.masterToken;
  rm.updateConfig(room.code, token, { gridSize: 3, freeSpace: false, bingoType: 'numbers', minNumber: 1, maxNumber: 9, autoPauseOnWin: false });
  const { player } = rm.joinRoom(room.code, { student: { id: 'aluno-bingo', name: 'Teste Bingo', avatar: '🐶' } });
  rm.startGame(room.code, token);
  const markValue = (value) => {
    let out = null;
    player.card.cells.forEach((row, r) => row.forEach((cell, c) => {
      if (cell.value === value) out = rm.markCell(room.code, player.token, r, c);
    }));
    return out;
  };
  // sorteia até o primeiro bingo
  let win = null;
  let last = null;
  while (!win) {
    last = rm.drawItem(room.code, token).value;
    const r = markValue(last);
    if (r && r.newWin) win = r;
  }
  assert(win.firstWin === true, 'bingo: o primeiro bingo conta');
  // o professor desfaz o sorteio e o mesmo número sai de novo
  rm.undoLastDraw(room.code, token);
  assert(!player.hasWon, 'bingo: desfazer o sorteio tira a vitória da tela');
  let again = null;
  for (let guard = 0; guard < 100 && !again; guard++) {
    const v = rm.drawItem(room.code, token).value;
    if (v === last) again = markValue(v);
    else rm.undoLastDraw(room.code, token);
  }
  assert(again && again.newWin && again.firstWin === false, 'bingo: completar de novo depois de desfazer anuncia, mas não conta outra vitória');
}

(async () => {
  try {
    await variants();
    mathHints();
    memoria();
    dinheiro();
    xadrez();
    bingo();
  } catch (e) {
    console.error('ERRO FATAL NO TESTE', e);
    process.exit(1);
  }
  try { require('../src/platform/db').db.close(); } catch (e) { /* ignore */ }
  for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(DB + suffix, { force: true }); } catch (e) { /* ignore */ } }
  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
})();
