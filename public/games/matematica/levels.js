// public/games/matematica/levels.js
// Mundos e fases do 🔢 Conta Comigo. Fonte única das fases: o navegador usa
// para montar o mapa e gerar as contas (problems.js), e o servidor
// (src/games/matematica/server.js) usa o mesmo arquivo para refazer as contas
// e calcular as estrelas. Nova fase = nova entrada aqui.
//
// Campos de uma fase:
//   id, title, tip   nome e dica
//   section          abre uma etapa no mapa ("Dezena", "Centena"...)
//   gen              gerador da conta (tipos em problems.js)
//   choice           (mundo das figurinhas) dá para responder escolhendo
//                    entre 3 opções
//   target           segundos por conta para a 3ª estrela (padrão do mundo)
//   count            contas na rodada (padrão 10)
// Campos de um mundo: minus (o teclado tem a tecla −), target, maxAbs
// (nenhum número da conta passa disso), emoji (as
// contas viram figurinhas: só no mundo das figurinhas, onde os números são
// pequenos o bastante para contar).

(function (root) {
  const ALL = '+-*/'.split('');
  // Centena e milhar só no mundo de Adição e Subtração: nos outros mundos,
  // nenhum número da conta (nem o resultado) passa de 100.
  const SMALL = 100;
  // geradores usados de novo nas revisões
  const g = {
    add20: { t: 'add', a: [0, 20], b: [0, 20], max: 20 },
    add2: { t: 'add', a: [11, 89], b: [11, 89], carry: 'yes' },
    add3: { t: 'add', a: [101, 899], b: [101, 899], carry: 'yes' },
    addMiss: { t: 'add', a: [10, 60], b: [5, 39], hide: 'any' },
    sub20: { t: 'sub', a: [0, 20], b: [0, 20] },
    sub2: { t: 'sub', a: [21, 99], b: [11, 89], borrow: 'yes' },
    sub3: { t: 'sub', a: [200, 999], b: [101, 899], borrow: 'yes' },
    subMiss: { t: 'sub', a: [20, 99], b: [5, 60], hide: 'any' },
    tab: { t: 'mul', a: [2, 10], b: [2, 10] },
    mul2: { t: 'mul', a: [12, 49], b: [2, 8], carry: 'yes', swap: true, max: 100 },
    add2s: { t: 'add', a: [11, 89], b: [11, 89], carry: 'yes', max: 99 },
    mulMiss: { t: 'mul', a: [2, 10], b: [2, 10], hide: 'any' },
    divTab: { t: 'div', d: [2, 10], q: [1, 10], amax: 99 },
    div2: { t: 'div', d: [2, 9], q: [11, 30], amax: 99 },
    divMiss: { t: 'div', d: [2, 10], q: [1, 10], amax: 99, hide: 'any' },
    small: { t: 'pick', of: [{ t: 'add', a: [0, 10], b: [0, 10], max: 10 }, { t: 'sub', a: [0, 10], b: [0, 10] }] },
  };
  const table = (n) => ({ t: 'mul', a: n, b: [0, 10], swap: true });
  const divBy = (n) => ({ t: 'div', d: n, q: [0, 10], amax: 99 });

  const WORLDS = [
    {
      id: 'fg', maxAbs: SMALL, icon: '🍎', name: 'Contando com figurinhas', color: 'pink', target: 10, emoji: true,
      intro: 'Neste mundo os números viram figurinhas! Conte, junte, tire, faça grupos e reparta. As contas são pequenas, para dar para contar uma por uma.',
      levels: [
        { id: 'fg1', section: 'Juntar', title: 'Juntar até 5', gen: { t: 'add', a: [0, 5], b: [0, 5], max: 5 }, choice: true, tip: 'Conte todas as figurinhas juntas.' },
        { id: 'fg2', title: 'Juntar até 10', gen: { t: 'add', a: [0, 10], b: [0, 10], max: 10 }, choice: true, tip: 'Conte o primeiro grupo e continue contando o segundo.' },
        { id: 'fg3', title: 'Mais 1 e mais 2', gen: { t: 'add', a: [1, 12], b: [1, 2], swap: true }, choice: true, tip: 'Mais 1 é o número que vem depois.' },
        { id: 'fg4', title: 'Dobros', gen: { t: 'add', a: [1, 6], same: true }, choice: true, tip: 'Os dois grupos são iguais!' },
        { id: 'fg5', title: 'Amigos do 10', gen: { t: 'add', a: [1, 9], b: [1, 9], min: 10, max: 10, hide: 'b' }, choice: true, tip: 'Quantas faltam para completar 10?' },
        { id: 'fg6', title: 'Juntar até 20', gen: { t: 'add', a: [2, 12], b: [2, 9], min: 11, max: 20 }, tip: 'Use as fileiras de 5 para contar mais rápido.' },
        { id: 'fg7', section: 'Tirar', title: 'Tirar até 5', gen: { t: 'sub', a: [1, 5], b: [0, 5] }, choice: true, tip: 'As riscadas saíram. Conte as que sobraram.' },
        { id: 'fg8', title: 'Tirar até 10', gen: { t: 'sub', a: [2, 10], b: [1, 10] }, choice: true, tip: 'Conte só as que não estão riscadas.' },
        { id: 'fg9', title: 'Tirar até 20', gen: { t: 'sub', a: [11, 20], b: [1, 10] }, tip: 'Conte as fileiras de 5 que ficaram inteiras.' },
        { id: 'fg10', title: 'Quantas saíram?', gen: { t: 'sub', a: [3, 10], b: [1, 9], hide: 'b' }, choice: true, tip: 'Compare os dois grupos: quantas a menos?' },
        { id: 'fg11', title: 'Juntar ou tirar', gen: { t: 'pick', of: [{ t: 'add', a: [0, 10], b: [0, 10], max: 10 }, { t: 'sub', a: [2, 10], b: [1, 10] }] }, choice: true, tip: 'Olhe o sinal: + junta, e as riscadas saem.' },
        { id: 'fg12', section: 'Grupos e repartir', title: 'Grupos de 2', gen: { t: 'mul', a: 2, b: [1, 5] }, choice: true, tip: 'Duas cestas iguais: conte tudo.' },
        { id: 'fg13', title: 'Grupos iguais', gen: { t: 'mul', a: [2, 5], b: [2, 5] }, tip: 'Conte uma cesta e some as outras iguais.' },
        { id: 'fg14', title: 'Repartir em 2', gen: { t: 'div', d: 2, q: [1, 5] }, choice: true, tip: 'Dê uma para cada criança, até acabar.' },
        { id: 'fg15', title: 'Repartir igualmente', gen: { t: 'div', d: [2, 5], q: [1, 5] }, tip: 'Cada criança ganha a mesma quantidade.' },
        { id: 'fg16', title: 'Repartir com sobra', gen: { t: 'rem', d: [2, 4], q: [1, 5] }, tip: 'Quando não dá para dar mais uma para todo mundo, o que fica é a sobra (o resto).' },
        { id: 'fg17', section: 'Material dourado', title: 'Barras e cubinhos', gen: { t: 'add', a: [10, 40], b: [1, 9], max: 49 }, tip: 'Cada barra vale 10 e cada cubinho vale 1.' },
        { id: 'fg18', title: 'Juntar dezenas', gen: { t: 'add', a: [10, 40], b: [10, 30], max: 60 }, tip: 'Junte as barras com as barras e os cubinhos com os cubinhos.' },
        { id: 'fg19', title: 'Tirar dezenas', gen: { t: 'sub', a: [20, 60], b: [10, 30], borrow: 'no' }, tip: 'Tire as barras e os cubinhos do segundo número.' },
        { id: 'fg20', section: 'Revisão', title: 'Revisão das figurinhas', gen: { t: 'pick', of: [{ t: 'add', a: [0, 10], b: [0, 10], max: 15 }, { t: 'sub', a: [2, 15], b: [1, 10] }, { t: 'mul', a: [2, 4], b: [2, 5] }, { t: 'div', d: [2, 4], q: [1, 5] }] }, tip: 'Um pouco de tudo, com figurinhas.' },
      ],
    },
    {
      id: 'as', icon: '➕', name: 'Adição e Subtração', color: 'green', target: 8,
      intro: 'Somar é juntar; subtrair é tirar ou descobrir quanto falta. As fases vão crescendo: unidade, dezena, centena e milhar.',
      levels: [
        { id: 'ad1', section: 'Unidade: até 10', title: 'Somas até 5', gen: { t: 'add', a: [0, 5], b: [0, 5], max: 5 }, target: 5, tip: 'Conte nos dedos: comece no primeiro número e conte mais.' },
        { id: 'sb1', title: 'Tirar até 5', gen: { t: 'sub', a: [1, 5], b: [0, 5] }, target: 5, tip: 'Comece no número maior e volte nos dedos.' },
        { id: 'ad2', title: 'Somas até 10', gen: { t: 'add', a: [0, 10], b: [0, 10], max: 10 }, target: 5, tip: 'Comece pelo número maior e conte o menor nos dedos.' },
        { id: 'sb2', title: 'Tirar até 10', gen: { t: 'sub', a: [2, 10], b: [0, 10] }, target: 5, tip: 'Comece no número maior e volte o menor.' },
        { id: 'ad3', title: 'Mais 1 e mais 2', gen: { t: 'add', a: [1, 18], b: [1, 2], swap: true }, target: 4, tip: 'Mais 1 é o número que vem depois. Mais 2 pula um.' },
        { id: 'sb3', title: 'Menos 1 e menos 2', gen: { t: 'sub', a: [3, 20], b: [1, 2] }, target: 4, tip: 'Menos 1 é o número que vem antes.' },
        { id: 'ad4', title: 'Dobros', gen: { t: 'add', a: [1, 10], same: true }, target: 5, tip: 'Dobro é o mesmo número duas vezes: 4 + 4.' },
        { id: 'sb4', title: 'Tudo ou nada', gen: { t: 'pick', of: [{ t: 'sub', a: [1, 30], same: true }, { t: 'sub', a: [1, 30], b: 0 }] }, target: 4, tip: 'Tirar tudo dá 0. Tirar 0 não muda nada.' },
        { id: 'ad5', title: 'Amigos do 10', gen: { t: 'add', a: [0, 10], b: [0, 10], min: 10, max: 10, hide: 'b' }, target: 5, tip: 'Que número junta com este para dar 10? 7 e 3, 6 e 4...' },
        { id: 'sb5', title: 'Quanto falta para 10', gen: { t: 'sub', a: 10, b: [0, 10] }, target: 5, tip: 'Lembre dos amigos do 10: 10 − 7 = 3.' },
        { id: 'ad6', section: 'Unidade: até 20', title: 'Passando do 10', gen: { t: 'add', a: [2, 9], b: [2, 9], min: 11 }, target: 6, tip: 'Complete o 10 primeiro e depois some o que sobrou: 8 + 5 = 10 + 3.' },
        { id: 'sb6', title: 'Voltando do 20', gen: { t: 'sub', a: [11, 18], b: [2, 9], borrow: 'yes' }, target: 7, tip: 'Volte até o 10 primeiro e depois o resto: 13 − 5 = 13 − 3 − 2.' },
        { id: 'ad7', title: 'Somas até 20', gen: g.add20, target: 6, tip: 'Tudo que você aprendeu até agora, até o 20.' },
        { id: 'sb7', title: 'Subtração até 20', gen: g.sub20, target: 6, tip: 'Tudo que você aprendeu até agora, até o 20.' },
        { id: 'ad8', title: 'Três números', gen: { t: 'expr', tpl: ['a+b+c'], n: [1, 9] }, target: 8, tip: 'Some dois primeiro e depois o terceiro. Dica: procure os amigos do 10!' },
        { id: 'ad9', section: 'Dezena', title: 'Somar dezenas inteiras', gen: { t: 'add', a: [10, 90, 10], b: [10, 90, 10], max: 100 }, target: 5, tip: '30 + 40 é como 3 + 4, com um zero no fim.' },
        { id: 'sb8', title: 'Tirar dezenas inteiras', gen: { t: 'sub', a: [20, 100, 10], b: [10, 90, 10] }, target: 5, tip: '70 − 30 é como 7 − 3, com um zero no fim.' },
        { id: 'ad10', title: 'Dezena + unidade', gen: { t: 'add', a: [10, 89], b: [1, 9], carry: 'no', swap: true }, target: 6, tip: 'Some só as unidades. A dezena fica igual.' },
        { id: 'sb9', title: 'Dezena − unidade', gen: { t: 'sub', a: [11, 99], b: [1, 9], borrow: 'no' }, target: 6, tip: 'Tire só das unidades. A dezena fica igual.' },
        { id: 'ad11', title: 'Dezena + unidade com vai-um', gen: { t: 'add', a: [11, 89], b: [2, 9], carry: 'yes', swap: true }, target: 8, tip: 'As unidades passaram de 9? Vai 1 para a dezena.' },
        { id: 'sb10', title: 'Dezena − unidade com empréstimo', gen: { t: 'sub', a: [11, 99], b: [2, 9], borrow: 'yes' }, target: 8, tip: 'Não dá para tirar? Peça 1 dezena emprestada: ela vira 10 unidades.' },
        { id: 'ad12', title: 'Dezena + dezena', gen: { t: 'add', a: [10, 88], b: [10, 88], carry: 'no', max: 99 }, target: 8, tip: 'Unidade com unidade, dezena com dezena.' },
        { id: 'sb11', title: 'Dezena − dezena', gen: { t: 'sub', a: [20, 99], b: [10, 89], borrow: 'no' }, target: 8, tip: 'Unidade com unidade, dezena com dezena.' },
        { id: 'ad13', title: 'Dezena + dezena com vai-um', gen: g.add2, target: 10, tip: 'Some as unidades. Se passar de 9, vai 1 para as dezenas.' },
        { id: 'sb12', title: 'Dezena − dezena com empréstimo', gen: g.sub2, target: 10, tip: 'Se a unidade de cima for menor, peça emprestado à dezena.' },
        { id: 'ad14', section: 'Centena', title: 'Somar centenas inteiras', gen: { t: 'add', a: [100, 900, 100], b: [100, 900, 100], max: 1000 }, target: 6, tip: '300 + 400 é como 3 + 4, com dois zeros no fim.' },
        { id: 'sb13', title: 'Tirar centenas inteiras', gen: { t: 'sub', a: [200, 1000, 100], b: [100, 900, 100] }, target: 6, tip: '700 − 300 é como 7 − 3, com dois zeros no fim.' },
        { id: 'ad15', title: 'Centena sem vai-um', gen: { t: 'add', a: [100, 888], b: [100, 888], carry: 'no', max: 999 }, target: 10, tip: 'Cada casa no seu lugar: unidades, dezenas e centenas.' },
        { id: 'sb14', title: 'Centena sem empréstimo', gen: { t: 'sub', a: [200, 999], b: [100, 899], borrow: 'no' }, target: 10, tip: 'Cada casa no seu lugar: unidades, dezenas e centenas.' },
        { id: 'ad16', title: 'Centena com vai-um', gen: g.add3, target: 15, tip: 'Pode ter vai-um nas unidades e nas dezenas. Vá da direita para a esquerda.' },
        { id: 'sb15', title: 'Centena com empréstimo', gen: g.sub3, target: 15, tip: 'Pode precisar pedir emprestado mais de uma vez. Vá da direita para a esquerda.' },
        { id: 'ad17', section: 'Milhar', title: 'Somar no milhar', gen: { t: 'add', a: [1000, 8999], b: [1000, 8999], max: 9999 }, target: 20, tip: 'Números de quatro algarismos. Com calma, casa por casa.' },
        { id: 'sb16', title: 'Tirar no milhar', gen: { t: 'sub', a: [2000, 9999], b: [1000, 8999] }, target: 20, tip: 'Números de quatro algarismos. Com calma, casa por casa.' },
        { id: 'ad18', section: 'Número que falta e revisão', title: 'Número que falta na soma', gen: g.addMiss, target: 12, tip: 'Quanto falta para chegar ao resultado? Dá para fazer com uma subtração.' },
        { id: 'sb17', title: 'Número que falta na subtração', gen: g.subMiss, target: 12, tip: 'Use a operação inversa: a adição desfaz a subtração.' },
        { id: 'ad19', title: 'Revisão da adição', gen: { t: 'pick', of: [g.add20, g.add2, g.add3, g.addMiss] }, target: 12, tip: 'Um pouco de tudo do mundo da adição.' },
        { id: 'sb18', title: 'Revisão da subtração', gen: { t: 'pick', of: [g.sub20, g.sub2, g.sub3, g.subMiss] }, target: 12, tip: 'Um pouco de tudo do mundo da subtração.' },
      ],
    },
    {
      id: 'mu', maxAbs: SMALL, icon: '✖️', name: 'Multiplicação', color: 'orange', target: 6,
      intro: 'Multiplicar é somar grupos iguais. A tabuada vem aos pouquinhos, da mais fácil para a mais difícil.',
      levels: [
        { id: 'mu1', section: 'Tabuadas', title: 'Grupos de 2', gen: { t: 'mul', a: 2, b: [1, 5] }, target: 6, tip: '2 × 3 são 2 grupos de 3: 3 + 3.' },
        { id: 'mu2', title: 'Dobro (×2)', gen: table(2), target: 5, tip: 'Vezes 2 é o dobro: o número somado com ele mesmo.' },
        { id: 'mu3', title: 'Tabuada do 10', gen: table(10), target: 4, tip: 'Vezes 10: coloque um zero no fim do número.' },
        { id: 'mu4', title: 'Tabuada do 5', gen: table(5), target: 5, tip: 'A tabuada do 5 sempre termina em 0 ou 5.' },
        { id: 'mu5', title: '×1 e ×0', gen: { t: 'mul', a: { list: [0, 1] }, b: [0, 20], swap: true }, target: 4, tip: 'Vezes 1 dá o próprio número. Vezes 0 dá sempre 0.' },
        { id: 'mu6', title: 'Tabuada do 3', gen: table(3), target: 6, tip: '3 × 4 é 4 + 4 + 4.' },
        { id: 'mu7', title: 'Tabuada do 4', gen: table(4), target: 6, tip: 'Vezes 4 é o dobro do dobro.' },
        { id: 'mu8', title: 'Tabuadas do 2 ao 5', gen: { t: 'mul', a: { list: [2, 3, 4, 5] }, b: [0, 10], swap: true }, target: 6, tip: 'As tabuadas que você já sabe, misturadas.' },
        { id: 'mu9', title: 'Tabuada do 6', gen: table(6), target: 6, tip: 'Vezes 6 é o dobro da tabuada do 3.' },
        { id: 'mu10', title: 'Tabuada do 7', gen: table(7), target: 7, tip: 'A do 7 é difícil: use a do 5 e some mais 2 grupos.' },
        { id: 'mu11', title: 'Tabuada do 8', gen: table(8), target: 7, tip: 'Vezes 8 é o dobro da tabuada do 4.' },
        { id: 'mu12', title: 'Tabuada do 9', gen: table(9), target: 7, tip: 'Truque do 9: faça vezes 10 e tire o número uma vez.' },
        { id: 'mu13', title: 'Tabuadas do 6 ao 9', gen: { t: 'mul', a: { list: [6, 7, 8, 9] }, b: [0, 10], swap: true }, target: 7, tip: 'As tabuadas mais difíceis, misturadas.' },
        { id: 'mu14', title: 'Tabuada completa', gen: g.tab, target: 6, tip: 'Todas as tabuadas do 2 ao 10.' },
        { id: 'mu15', title: 'Fator que falta', gen: g.mulMiss, target: 8, tip: 'Que número da tabuada dá esse resultado? 6 × ? = 42.' },
        { id: 'mu16', section: 'Números maiores', title: 'Dezenas inteiras × unidade', gen: { t: 'mul', a: [10, 50, 10], b: [2, 9], swap: true, max: 100 }, target: 6, tip: '20 × 4 é como 2 × 4, com um zero no fim: 80.' },
        { id: 'mu17', title: 'Dezena × unidade', gen: { t: 'mul', a: [11, 44], b: [2, 9], carry: 'no', swap: true, max: 99 }, target: 10, tip: 'Multiplique as unidades e depois as dezenas: 21 × 3 = 63.' },
        { id: 'mu18', title: 'Dezena × unidade com vai-um', gen: g.mul2, target: 14, tip: 'Multiplique as unidades primeiro. Se passar de 9, vai para a dezena.' },
        { id: 'mu20', title: 'Dobro e triplo de dezenas', gen: { t: 'mul', a: { list: [2, 3] }, b: [11, 33], swap: true, max: 99 }, target: 10, tip: 'Dobro é ×2 e triplo é ×3: 24 × 3 = 24 + 24 + 24.' },
        { id: 'mu21', section: 'Revisão', title: 'Revisão da multiplicação', gen: { t: 'pick', of: [g.tab, g.mulMiss, g.mul2] }, target: 12, tip: 'Um pouco de tudo do mundo da multiplicação.' },
      ],
    },
    {
      id: 'dv', maxAbs: SMALL, icon: '➗', name: 'Divisão', color: 'violet', target: 7,
      intro: 'Dividir é repartir em partes iguais. Quem sabe a tabuada já sabe dividir: é a tabuada ao contrário!',
      levels: [
        { id: 'dv1', section: 'Tabuada ao contrário', title: 'Repartir em 2', gen: { t: 'div', d: 2, q: [1, 5] }, target: 6, tip: 'Reparta entre 2 amigos: cada um fica com quanto?' },
        { id: 'dv2', title: 'Metade (÷2)', gen: divBy(2), target: 5, tip: 'Dividir por 2 é achar a metade.' },
        { id: 'dv3', title: 'Dividir por 10', gen: divBy(10), target: 4, tip: 'Dividir por 10: tire um zero do fim do número.' },
        { id: 'dv4', title: 'Dividir por 5', gen: divBy(5), target: 5, tip: 'Pense na tabuada do 5: 5 × ? = o número.' },
        { id: 'dv5', title: '÷1 e ÷ ele mesmo', gen: { t: 'pick', of: [{ t: 'div', d: 1, q: [0, 30] }, { t: 'div', d: [1, 30], q: 1 }] }, target: 4, tip: 'Dividir por 1 não muda nada. Um número dividido por ele mesmo dá 1.' },
        { id: 'dv6', title: 'Dividir por 3', gen: divBy(3), target: 6, tip: 'Pense na tabuada do 3.' },
        { id: 'dv7', title: 'Dividir por 4', gen: divBy(4), target: 6, tip: 'Dividir por 4 é achar a metade da metade.' },
        { id: 'dv8', title: 'Dividir por 6', gen: divBy(6), target: 7, tip: 'Pense na tabuada do 6.' },
        { id: 'dv9', title: 'Dividir por 7', gen: divBy(7), target: 7, tip: 'Pense na tabuada do 7.' },
        { id: 'dv10', title: 'Dividir por 8', gen: divBy(8), target: 7, tip: 'Pense na tabuada do 8.' },
        { id: 'dv11', title: 'Dividir por 9', gen: divBy(9), target: 7, tip: 'Pense na tabuada do 9.' },
        { id: 'dv12', title: 'Tabuada ao contrário', gen: g.divTab, target: 7, tip: 'Todas as divisões da tabuada, misturadas.' },
        { id: 'dv13', title: 'Número que falta', gen: g.divMiss, target: 9, tip: 'Use a multiplicação: ela desfaz a divisão.' },
        { id: 'dv14', section: 'Números maiores', title: 'Dezena ÷ unidade', gen: g.div2, target: 14, tip: 'Separe o número em partes fáceis: 48 ÷ 4 = 40 ÷ 4 + 8 ÷ 4.' },
        { id: 'dv16', title: 'Dezenas inteiras ÷ unidade', gen: { t: 'div', d: [2, 9], q: [10, 40, 10], amax: 90 }, target: 7, tip: '80 ÷ 4 é como 8 ÷ 4, com um zero no fim: 20.' },
        { id: 'dv17', section: 'Divisão com resto', title: 'Divisão com resto', gen: { t: 'rem', d: [2, 5], q: [1, 9] }, target: 12, tip: 'Quando não dá certinho, sobra um resto. O resto é sempre menor que o divisor.' },
        { id: 'dv18', title: 'Resto com divisor maior', gen: { t: 'rem', d: [6, 9], q: [2, 10] }, target: 15, tip: 'Ache o maior número da tabuada que cabe e veja quanto sobra.' },
        { id: 'dv19', section: 'Revisão', title: 'Revisão da divisão', gen: { t: 'pick', of: [g.divTab, g.divMiss, g.div2, { t: 'rem', d: [2, 9], q: [1, 9] }] }, target: 12, tip: 'Um pouco de tudo do mundo da divisão.' },
      ],
    },
    {
      id: 'mx', maxAbs: SMALL, icon: '🎲', name: 'Misturadas', color: 'pink', target: 8,
      intro: 'Agora as quatro operações juntas. Olhe bem o sinal antes de responder!',
      levels: [
        { id: 'mx1', title: 'Mais ou menos até 10', gen: g.small, target: 5, tip: 'É + ou −? Olhe o sinal antes de contar.' },
        { id: 'mx2', title: 'Mais ou menos até 20', gen: { t: 'pick', of: [g.add20, g.sub20] }, target: 6, tip: 'Somar e tirar, até o 20.' },
        { id: 'mx3', title: 'Qual é o sinal? + ou −', gen: { t: 'sign', ops: ['+', '-'], n: [1, 20] }, target: 8, tip: 'O resultado ficou maior ou menor?' },
        { id: 'mx4', title: 'Qual é o sinal? × ou ÷', gen: { t: 'sign', ops: ['*', '/'], n: [2, 10] }, target: 8, tip: 'O resultado cresceu muito (×) ou diminuiu (÷)?' },
        { id: 'mx5', title: 'Qual é o sinal? Todos', gen: { t: 'sign', ops: ALL, n: [2, 12] }, target: 9, tip: 'Teste os quatro sinais na cabeça.' },
        { id: 'mx6', title: 'Dobro e metade', gen: { t: 'pick', of: [{ t: 'mul', a: 2, b: [2, 50], swap: true }, { t: 'div', d: 2, q: [2, 50] }] }, target: 7, tip: 'Dobro é ×2. Metade é ÷2.' },
        { id: 'mx7', title: 'Quatro operações: unidades', gen: { t: 'pick', of: [g.small, g.tab, g.divTab] }, target: 6, tip: 'As quatro operações com números pequenos.' },
        { id: 'mx8', title: 'Quatro operações: dezenas', gen: { t: 'pick', of: [g.add2s, g.sub2, g.mul2, g.div2] }, target: 12, tip: 'As quatro operações com dezenas.' },
        { id: 'mx9', title: 'Dez a mais, dez a menos', gen: { t: 'pick', of: [{ t: 'add', a: [0, 89], b: 10, swap: true }, { t: 'sub', a: [10, 99], b: 10 }, { t: 'mul', a: 10, b: [1, 10], swap: true }, { t: 'div', d: 10, q: [1, 10] }] }, target: 6, tip: '+10 e −10 mudam a dezena. ×10 põe um zero no fim; ÷10 tira.' },
        { id: 'mx10', title: 'Contas em sequência', gen: { t: 'expr', tpl: ['a+b-c', 'a-b+c', 'a+b+c', 'a-b-c'], n: [1, 30] }, target: 10, tip: 'Só + e −: faça da esquerda para a direita.' },
        { id: 'mx11', title: 'Número que falta: todas', gen: { t: 'pick', of: [g.addMiss, g.subMiss, g.mulMiss, g.divMiss] }, target: 10, tip: 'Use a operação inversa para achar o número.' },
        { id: 'mx12', title: 'Desafio misturado', gen: { t: 'pick', of: [g.add2s, g.sub2, g.mul2, g.div2, g.mulMiss, { t: 'sign', ops: ALL, n: [2, 12] }] }, target: 14, tip: 'Um pouco de tudo. Você consegue!' },
      ],
    },
    {
      id: 'ng', maxAbs: SMALL, icon: '🌡️', name: 'Números negativos', color: 'sky', target: 8, minus: true,
      intro: 'Abaixo do zero também tem números: os negativos! Pense num termômetro: subir é +, descer é −.',
      levels: [
        { id: 'ng1', title: 'Subindo do negativo', gen: { t: 'int', op: '+', a: [-9, -1], b: [1, 9] }, target: 7, tip: 'Comece abaixo do zero e suba: −5 + 3 = −2.' },
        { id: 'ng2', title: 'Descendo abaixo do zero', gen: { t: 'int', op: '-', a: [0, 9], b: [1, 15], need: 'neg-res' }, target: 7, tip: 'Desça além do zero: 2 − 5 = −3.' },
        { id: 'ng3', title: 'Negativo + positivo', gen: { t: 'int', op: '+', a: [-20, -1], b: [1, 20], swap: true }, target: 8, tip: 'Sinais diferentes: tire o menor do maior e fique com o sinal do maior.' },
        { id: 'ng4', title: 'Dois negativos', gen: { t: 'int', op: '+', a: [-15, -1], b: [-15, -1] }, target: 8, tip: 'Negativo mais negativo: some e o resultado fica negativo.' },
        { id: 'ng5', title: 'Negativo menos positivo', gen: { t: 'int', op: '-', a: [-15, -1], b: [1, 15] }, target: 8, tip: 'Já está abaixo do zero e desce mais: −3 − 4 = −7.' },
        { id: 'ng6', title: 'Menos com menos', gen: { t: 'int', op: '-', a: [-15, 15], b: [-15, -1] }, target: 9, tip: 'Tirar um negativo é somar: 5 − (−3) = 5 + 3.' },
        { id: 'ng7', title: '+ e − até 20', gen: { t: 'int', ops: ['+', '-'], a: [-20, 20], b: [-20, 20] }, target: 9, tip: 'Somas e subtrações com negativos, até o 20.' },
        { id: 'ng8', title: '+ e − até 100', gen: { t: 'int', ops: ['+', '-'], a: [-99, 99], b: [-99, 99] }, target: 12, tip: 'Os mesmos truques com números maiores.' },
        { id: 'ng9', title: 'Vezes com sinais diferentes', gen: { t: 'int', op: '*', a: [-10, 10], b: [-10, 10], need: 'one-neg' }, target: 8, tip: 'Sinais diferentes: o resultado é negativo.' },
        { id: 'ng10', title: 'Menos vezes menos', gen: { t: 'int', op: '*', a: [-10, -1], b: [-10, -1] }, target: 8, tip: 'Sinais iguais: o resultado é positivo! −3 × −4 = 12.' },
        { id: 'ng11', title: 'Dividir com sinais', gen: { t: 'int', op: '/', b: [-10, 10], q: [-10, 10] }, target: 9, tip: 'Na divisão vale a mesma regra: sinais iguais +, diferentes −.' },
        { id: 'ng12', title: 'Vezes e dividir com sinais', gen: { t: 'int', ops: ['*', '/'], a: [-12, 12], b: [-12, 12], q: [-12, 12] }, target: 9, tip: 'Primeiro o sinal, depois a conta.' },
        { id: 'ng13', title: 'Número que falta', gen: { t: 'int', ops: ['+', '-'], a: [-20, 20], b: [-20, 20], hide: 'any' }, target: 12, tip: 'Use a operação inversa, com cuidado nos sinais.' },
        { id: 'ng14', title: 'Revisão dos negativos', gen: { t: 'int', ops: ALL, a: [-30, 30], b: [-12, 12], q: [-12, 12] }, target: 10, tip: 'As quatro operações com negativos.' },
      ],
    },
    {
      id: 'pw', maxAbs: SMALL, icon: '🚀', name: 'Potências', color: 'red', target: 8, minus: true,
      intro: 'Potência é uma multiplicação repetida: 2³ = 2 × 2 × 2. O número pequeno lá em cima diz quantas vezes.',
      levels: [
        { id: 'pw1', title: 'Quadrados até 5²', gen: { t: 'pow', base: [1, 5], exp: 2 }, target: 5, tip: 'Ao quadrado é o número vezes ele mesmo: 4² = 4 × 4.' },
        { id: 'pw2', title: 'Quadrados até 10²', gen: { t: 'pow', base: [1, 10], exp: 2 }, target: 6, tip: 'Os quadrados perfeitos: 1, 4, 9, 16, 25...' },
        { id: 'pw3', title: 'Quadrados de 6 a 10', gen: { t: 'pow', base: [6, 10], exp: 2 }, target: 7, tip: '6² = 36, 7² = 49, 8² = 64, 9² = 81, 10² = 100.' },
        { id: 'pw4', title: 'Cubos até 4³', gen: { t: 'pow', base: [1, 4], exp: 3 }, target: 9, tip: 'Ao cubo é três vezes: 3³ = 3 × 3 × 3 = 27.' },
        { id: 'pw5', title: 'Potências de 2', gen: { t: 'pow', base: 2, exp: [0, 6] }, target: 8, tip: 'Cada vez dobra: 1, 2, 4, 8, 16, 32, 64.' },
        { id: 'pw6', title: 'Potências de 3', gen: { t: 'pow', base: 3, exp: [0, 4] }, target: 8, tip: 'Cada vez triplica: 1, 3, 9, 27, 81.' },
        { id: 'pw7', title: 'Expoente 0 e 1', gen: { t: 'pow', base: [1, 99], exp: { list: [0, 1] } }, target: 4, tip: 'Elevado a 1 é o próprio número. Elevado a 0 dá 1.' },
        { id: 'pw8', title: 'Potências de 4, 5 e 10', gen: { t: 'pow', base: { list: [4, 5, 10] }, exp: [0, 3], max: 100 }, target: 8, tip: '4³ = 64, 5² = 25, 10² = 100.' },
        { id: 'pw9', title: 'Base negativa, expoente par', gen: { t: 'pow', base: [-10, -1], exp: { list: [2, 4] }, max: 100 }, target: 9, tip: 'Negativo vezes negativo dá positivo: (−3)² = 9.' },
        { id: 'pw10', title: 'Base negativa, expoente ímpar', gen: { t: 'pow', base: [-4, -1], exp: { list: [1, 3, 5] }, max: 100 }, target: 10, tip: 'Com expoente ímpar, o sinal negativo fica: (−2)³ = −8.' },
        { id: 'pw11', title: 'Expoente que falta', gen: { t: 'pow', base: { list: [2, 3, 4, 10] }, exp: [2, 6], max: 100, hide: 'b' }, target: 10, tip: 'Quantas vezes multiplicar para chegar no resultado?' },
        { id: 'pw12', title: 'Base que falta', gen: { t: 'pow', base: [2, 10], exp: 2, hide: 'a' }, target: 8, tip: 'Que número vezes ele mesmo dá esse resultado?' },
        { id: 'pw13', title: 'Contas com potências', gen: { t: 'expr', tpl: ['a^2+b^2', 'a^2-b', 'a^3+b', 'a^2*b'], n: [1, 7] }, target: 14, tip: 'Resolva as potências primeiro e depois o resto.' },
        { id: 'pw14', title: 'Revisão das potências', gen: { t: 'pick', of: [{ t: 'pow', base: [1, 10], exp: 2 }, { t: 'pow', base: [1, 4], exp: 3 }, { t: 'pow', base: [-4, -1], exp: [2, 3] }, { t: 'pow', base: 2, exp: [0, 6] }] }, target: 10, tip: 'Um pouco de tudo das potências.' },
      ],
    },
    {
      id: 'rz', maxAbs: SMALL, icon: '🌱', name: 'Raízes', color: 'green', target: 8, minus: true,
      intro: 'A raiz é o contrário da potência: √49 pergunta "que número vezes ele mesmo dá 49?". A resposta é 7.',
      levels: [
        { id: 'rz1', title: 'Raízes até √25', gen: { t: 'root', n: 2, r: [0, 5] }, target: 6, tip: 'Que número vezes ele mesmo dá esse? √16 = 4, porque 4 × 4 = 16.' },
        { id: 'rz2', title: 'Raízes até √100', gen: { t: 'root', n: 2, r: [1, 10] }, target: 6, tip: 'Lembre dos quadrados: 36, 49, 64, 81, 100.' },
        { id: 'rz3', title: 'Raízes de 36 a 100', gen: { t: 'root', n: 2, r: [6, 10] }, target: 7, tip: '√36 = 6, √49 = 7, √64 = 8, √81 = 9, √100 = 10.' },
        { id: 'rz4', title: 'Raiz ou quadrado?', gen: { t: 'pick', of: [{ t: 'root', n: 2, r: [1, 10] }, { t: 'pow', base: [1, 10], exp: 2 }] }, target: 7, tip: 'O quadrado multiplica (7² = 49); a raiz desfaz (√49 = 7).' },
        { id: 'rz5', title: 'Raiz mais número', gen: { t: 'expr', tpl: ['r(A)+b', 'r(A)-b', 'b+r(A)'], n: [1, 20], sq: [1, 10] }, target: 8, tip: 'Tire a raiz e depois some ou subtraia.' },
        { id: 'rz6', title: 'Raiz cúbica até ∛64', gen: { t: 'root', n: 3, r: [1, 4] }, target: 9, tip: 'Que número, três vezes, dá esse? ∛27 = 3, porque 3 × 3 × 3 = 27.' },
        { id: 'rz7', title: 'Raiz quadrada ou cúbica', gen: { t: 'pick', of: [{ t: 'root', n: 2, r: [1, 10] }, { t: 'root', n: 3, r: [1, 4] }] }, target: 9, tip: 'Olhe o número pequeno da raiz: sem número é quadrada, com 3 é cúbica.' },
        { id: 'rz8', title: 'Número dentro da raiz', gen: { t: 'root', n: 2, r: [2, 10], hide: 'a' }, target: 8, tip: '√? = 7: faça 7 × 7.' },
        { id: 'rz9', title: 'Soma de raízes', gen: { t: 'expr', tpl: ['r(A)+r(B)', 'r(A)-r(B)'], sq: [1, 10] }, target: 10, tip: 'Tire cada raiz e depois faça a conta.' },
        { id: 'rz10', title: 'Raiz vezes número', gen: { t: 'expr', tpl: ['a*r(B)', 'r(A)*b', 'r(A)*r(B)'], n: [2, 9], sq: [1, 10] }, target: 10, tip: 'Tire a raiz primeiro e depois multiplique.' },
        { id: 'rz11', title: 'Raiz e potência', gen: { t: 'expr', tpl: ['r(a^2)', '(r(A))^2', 'r(A)+b^2'], n: [1, 9], sq: [1, 10] }, target: 8, tip: 'Raiz e potência ao quadrado se desfazem: √(5²) = 5.' },
        { id: 'rz12', title: 'Raiz de uma conta', gen: { t: 'expr', tpl: ['r(a+b)', 'r(a-b)', 'r(a*b)'], n: [1, 50] }, target: 12, tip: 'Faça a conta de dentro da raiz primeiro: √(16 + 9) = √25.' },
        { id: 'rz13', title: 'Revisão das raízes', gen: { t: 'pick', of: [{ t: 'root', n: 2, r: [1, 10] }, { t: 'root', n: 3, r: [1, 4] }, { t: 'root', n: 2, r: [2, 10], hide: 'a' }, { t: 'expr', tpl: ['r(A)+r(B)', 'a*r(B)'], n: [2, 9], sq: [1, 10] }] }, target: 10, tip: 'Um pouco de tudo das raízes.' },
      ],
    },
    {
      id: 'ex', maxAbs: SMALL, icon: '🧠', name: 'Expressões', color: 'yellow', target: 15, minus: true,
      intro: 'Numa expressão, a ordem importa: primeiro ( ) e [ ], depois potências e raízes, depois × e ÷, e por último + e −.',
      levels: [
        { id: 'ex1', title: 'Vezes antes do mais', gen: { t: 'expr', tpl: ['a+b*c', 'a*b+c'] }, target: 10, tip: 'Faça o × primeiro e depois o +: 2 + 3 × 4 = 2 + 12.' },
        { id: 'ex2', title: 'Vezes antes do menos', gen: { t: 'expr', tpl: ['a-b*c', 'a*b-c'], n: [1, 20] }, target: 10, tip: 'O × vem antes do −.' },
        { id: 'ex3', title: 'Dividir antes de somar', gen: { t: 'expr', tpl: ['a+b/c', 'a/b+c', 'a/b-c'], n: [1, 30] }, target: 12, tip: 'O ÷ vem antes do + e do −.' },
        { id: 'ex4', title: 'Parênteses primeiro', gen: { t: 'expr', tpl: ['(a+b)*c', 'a*(b+c)', '(a-b)*c'] }, target: 10, tip: 'O que está nos parênteses vem antes de tudo.' },
        { id: 'ex5', title: 'Parênteses e divisão', gen: { t: 'expr', tpl: ['(a+b)/c', '(a-b)/c', 'a/(b+c)'], n: [1, 40] }, target: 12, tip: 'Resolva os parênteses e depois divida.' },
        { id: 'ex6', title: 'Duas multiplicações', gen: { t: 'expr', tpl: ['a*b+c*d', 'a*b-c*d'] }, target: 14, tip: 'Faça as duas multiplicações e depois junte.' },
        { id: 'ex7', title: 'Colchetes', gen: { t: 'expr', tpl: ['a*[b+(c-d)]', '[a+(b*c)]-d', '[(a+b)*c]/d'] }, target: 18, tip: 'De dentro para fora: primeiro ( ), depois [ ].' },
        { id: 'ex8', title: 'Potência na expressão', gen: { t: 'expr', tpl: ['a^2+b*c', '(a+b)^2', 'a^2-b^2', 'a*b^2'] }, target: 15, tip: 'A potência vem antes do × e do +.' },
        { id: 'ex9', title: 'Raiz na expressão', gen: { t: 'expr', tpl: ['r(A)+b*c', '(r(A)+b)*c', 'a*r(B)-c'], sq: [1, 10] }, target: 15, tip: 'Resolva a raiz como se fosse um número entre parênteses.' },
        { id: 'ex10', title: 'Expressões com negativos', gen: { t: 'expr', tpl: ['a-b*c', '-a+b*c', '(a-b)*c', 'a*(b-c)'], neg: true }, target: 15, tip: 'A ordem é a mesma. Cuidado com o sinal do resultado.' },
        { id: 'ex11', title: 'Atenção ao sinal', gen: { t: 'expr', tpl: ['(-a)^2', '-a^2', '-(a-b)', '-a*(-b)'], neg: true }, target: 10, tip: '(−3)² = 9, mas −3² = −9: sem parênteses, o expoente vale só para o 3.' },
        { id: 'ex12', title: 'Grande desafio', gen: { t: 'expr', tpl: ['a+b*c-d', '(a+b)*(c-d)', 'a^2-b*c', 'r(A)*b+c', '[a*(b+c)]-d^2', '-a+(b-c)*d'], neg: true, sq: [1, 10] }, target: 20, tip: 'Tudo junto: parênteses, potências, raízes, sinais. Com calma!' },
      ],
    },
  ];

  // Estrelas da rodada (10 contas): acertou de primeira vale 1, na segunda
  // tentativa vale ½. 3 ⭐ também pede o tempo médio dentro do alvo.
  const STAR_RULES = [{ stars: 3, score: 9 }, { stars: 2, score: 8 }, { stars: 1, score: 6 }];

  const LEVELS = [];
  WORLDS.forEach((world, w) => {
    world.levels.forEach((level, l) => {
      level.world = world.id;
      level.worldIndex = w;
      level.indexInWorld = l;
      level.index = LEVELS.length;
      level.target = level.target || world.target;
      if (world.maxAbs) level.maxAbs = world.maxAbs;
      LEVELS.push(level);
    });
  });
  const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
  const getLevel = (id) => BY_ID[id] || null;
  const getWorld = (id) => WORLDS.find((w) => w.id === id) || null;

  // `score` sobre 10 (proporcional se a rodada tiver outro tamanho). No
  // mundo das figurinhas o tempo não conta: contar figurinhas leva tempo.
  function starsFor(levelId, { score, count = 10, avgSec }) {
    const level = getLevel(levelId);
    if (!level) return 0;
    const emoji = Boolean(getWorld(level.world).emoji);
    const s = (score / count) * 10;
    for (const rule of STAR_RULES) {
      if (s >= rule.score - 1e-9 && (rule.stars < 3 || emoji || avgSec <= level.target)) return rule.stars;
    }
    return 0;
  }

  // Todas as fases abertas (a próxima recomendada fica em destaque).
  const ALL_UNLOCKED = true;
  function isUnlocked(progress, levelId) {
    return Boolean(getLevel(levelId)) && (ALL_UNLOCKED || Boolean(progress && progress.unlockedAll));
  }
  const starsOf = (progress, id) => (progress && progress.levels && progress.levels[id] ? progress.levels[id].stars || 0 : 0);
  function nextLevel(progress) {
    return LEVELS.find((l) => starsOf(progress, l.id) === 0) || null;
  }
  function totalStars(progress) {
    return LEVELS.reduce((n, l) => n + starsOf(progress, l.id), 0);
  }

  const api = {
    WORLDS, LEVELS, MAX_STARS: LEVELS.length * 3, ALL_UNLOCKED,
    getLevel, getWorld, starsFor, isUnlocked, nextLevel, totalStars,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ContaLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
