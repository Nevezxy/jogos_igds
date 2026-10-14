// test/teacher.test.js
// Área do professor: PIN, lista da turma com progresso, cadastro em lote,
// autocadastro ligado/desligado, renomear, juntar contas, liberar fases,
// desativar e criação de sala de bingo só pelo professor.

const { io } = require('socket.io-client');
const { startTestServer } = require('./helpers');

const PIN = '4321';
let srv;

function emitAsync(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function main() {
  srv = await startTestServer(3105, { PROFESSOR_PIN: PIN });
  const { api } = srv;
  const errors = [];
  const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };

  // ---- PIN ----
  let r = await api('GET', '/api/teacher/status');
  assert(r.pinRequired && !r.authenticated, 'com PROFESSOR_PIN a área pede PIN');
  r = await api('POST', '/api/teacher/login', { pin: '0000' });
  assert(r.status === 401 && r.code === 'PIN_INVALIDO', 'PIN errado é recusado');
  r = await api('GET', '/api/teacher/students');
  assert(r.status === 401 && r.code === 'PROFESSOR_NAO_AUTORIZADO', 'lista da turma exige o PIN');
  r = await api('POST', '/api/teacher/login', { pin: PIN });
  assert(r.ok && r.token, 'PIN certo dá acesso');
  const T = { teacher: r.token };
  r = await api('GET', '/api/teacher/status', null, T);
  assert(r.authenticated, 'token do professor vale');

  // ---- cadastro em lote ----
  r = await api('POST', '/api/teacher/students', { names: 'ana souza\nBruno Lima\nMaria\n\nCarla Dias' }, T);
  assert(r.created.length === 3 && r.created.includes('Ana Souza') && r.skipped.length === 1 && r.skipped[0].name === 'Maria',
    'cadastro em lote cria as contas válidas e diz quais pulou');
  r = await api('POST', '/api/teacher/students', { names: 'ANA SOUZA' }, T);
  assert(r.created.length === 0 && r.skipped.length === 1, 'cadastro em lote não repete conta');

  // ---- autocadastro ----
  r = await api('POST', '/api/teacher/settings', { allowSignup: false }, T);
  assert(r.ok && r.settings.allowSignup === false, 'professor desliga o autocadastro');
  r = await api('POST', '/api/auth/lookup', { name: 'Diego Alves' });
  assert(r.ok && !r.exists && r.canRegister === false, 'login avisa que não dá para criar conta');
  r = await api('POST', '/api/auth/register', { name: 'Diego Alves', avatar: '🐶' });
  assert(r.status === 403 && r.code === 'CADASTRO_FECHADO', 'criar conta sozinho é recusado com o autocadastro desligado');
  r = await api('POST', '/api/auth/login', { name: 'ana souza' });
  assert(r.ok, 'quem foi cadastrado pelo professor entra normalmente');
  const ana = r.token;
  await api('POST', '/api/teacher/settings', { allowSignup: true }, T);
  r = await api('POST', '/api/auth/register', { name: 'Ana Sousa', avatar: '🐼' });
  assert(r.ok, 'com o autocadastro ligado, a criança cria conta (aqui, uma duplicada por erro de digitação)');
  const anaDup = r.token;

  // ---- progresso nas duas contas e lista da turma ----
  const round = (levelId, accuracy) => ({ levelId, chars: 50, durationMs: 60000, accuracy, wpm: 10, wrongPresses: 1, errorsByChar: { f: 1 } });
  await api('POST', '/api/progress/digitacao/results', round('m1f1', 90), ana);
  await api('POST', '/api/progress/digitacao/results', round('m1f1', 99), anaDup);
  await api('POST', '/api/progress/digitacao/results', round('m1f2', 95), anaDup);
  r = await api('GET', '/api/teacher/students', null, T);
  const list = r.students;
  const anaRow = list.find((s) => s.name === 'Ana Souza');
  const dupRow = list.find((s) => s.name === 'Ana Sousa');
  assert(list.length === 4 && anaRow && dupRow, 'lista da turma tem todas as contas');
  assert(anaRow.games.digitacao.stars === 1 && anaRow.games.digitacao.levelsDone === 1, 'lista mostra o progresso no Teclado Mágico');
  assert(anaRow.games.bingo.wins === 0, 'lista mostra os bingos');
  assert(dupRow.lastLoginAt > 0, 'lista mostra o último acesso');
  assert(list.find((s) => s.name === 'Carla Dias').lastLoginAt === null, 'quem foi cadastrado e nunca entrou aparece como "nunca"');

  // ---- renomear ----
  r = await api('POST', `/api/teacher/students/${anaRow.id}/rename`, { name: 'bruno lima' }, T);
  assert(r.status === 409 && r.code === 'CONTA_JA_EXISTE', 'não renomeia para um nome que já existe');
  r = await api('POST', `/api/teacher/students/${anaRow.id}/rename`, { name: 'Ana Souza 5A' }, T);
  assert(r.ok && r.student.name === 'Ana Souza 5A', 'nome pode levar a turma junto (5A)');
  r = await api('POST', `/api/teacher/students/${anaRow.id}/rename`, { name: 'Ana 5A' }, T);
  assert(r.code === 'NOME_SEM_SOBRENOME', 'a turma não conta como sobrenome');
  r = await api('POST', `/api/teacher/students/${anaRow.id}/rename`, { name: 'ana souza lima' }, T);
  assert(r.ok && r.student.name === 'Ana Souza Lima', 'renomeia a conta');
  r = await api('POST', '/api/auth/login', { name: 'Ana Souza Lima' });
  assert(r.ok && r.student.id === anaRow.id, 'a criança entra com o nome novo');

  // ---- juntar contas ----
  r = await api('POST', '/api/teacher/students/merge', { fromId: dupRow.id, intoId: dupRow.id }, T);
  assert(r.code === 'MESMA_CONTA', 'não junta uma conta com ela mesma');
  r = await api('POST', '/api/teacher/students/merge', { fromId: dupRow.id, intoId: anaRow.id }, T);
  assert(r.ok, 'junta a conta duplicada na certa');
  r = await api('GET', '/api/progress/digitacao', null, ana);
  assert(r.progress.levels.m1f1.stars === 3 && r.progress.levels.m1f2.stars === 2 && r.progress.levels.m1f1.plays === 2,
    'progresso juntado fica com o melhor de cada fase');
  r = await api('GET', '/api/auth/me', null, anaDup);
  assert(r.status === 401, 'a conta duplicada deixa de existir');
  r = await api('GET', '/api/teacher/students', null, T);
  assert(r.students.length === 3, 'lista da turma sem a duplicada');

  // ---- liberar todas as fases ----
  r = await api('POST', '/api/progress/digitacao/results', round('m5f1', 95), ana);
  assert(r.ok, 'com todas as fases abertas, uma fase lá na frente já vale');
  r = await api('GET', '/api/teacher/students', null, T);
  assert(r.students[0].games.digitacao.lockable === false, 'sem trilha bloqueada, a área do professor não oferece "liberar fases"');
  // ---- evolução das semanas ----
  const evo = r.evolution && r.evolution[anaRow.id];
  assert(r.evolutionWeeks === 6 && evo && evo.all.length === 6 && evo.all[0].rounds >= 3 && evo.all.slice(1).every((w) => w.rounds === 0),
    `evolução: as rodadas desta semana aparecem na semana 0 (${evo && evo.all[0].rounds})`);
  assert(evo.games.digitacao[0].newLevels >= 2 && typeof evo.games.digitacao[0].accuracy === 'number',
    'evolução por jogo: fases novas da semana e precisão média');
  r = await api('POST', `/api/teacher/students/${anaRow.id}/games/bingo/unlock-all`, { unlocked: true }, T);
  assert(r.code === 'SEM_FASES', 'jogo sem fases não tem o que liberar');

  // ---- desativar ----
  const bruno = list.find((s) => s.name === 'Bruno Lima');
  const brunoToken = (await api('POST', '/api/auth/login', { name: 'Bruno Lima' })).token;
  r = await api('POST', `/api/teacher/students/${bruno.id}/active`, { active: false }, T);
  assert(r.ok, 'desativa a conta');
  r = await api('POST', '/api/auth/login', { name: 'Bruno Lima' });
  assert(r.status === 403 && r.code === 'CONTA_DESATIVADA', 'conta desativada não entra');
  r = await api('GET', '/api/auth/me', null, brunoToken);
  assert(r.status === 401, 'quem estava logado na conta desativada sai');
  await api('POST', `/api/teacher/students/${bruno.id}/active`, { active: true }, T);
  r = await api('POST', '/api/auth/login', { name: 'Bruno Lima' });
  assert(r.ok, 'reativada, a conta volta a entrar');

  // ---- bingo: criar sala exige o professor ----
  const sock = io(srv.url, { transports: ['websocket'], forceNew: true });
  await new Promise((res) => sock.on('connect', res));
  r = await emitAsync(sock, 'create_room', { name: 'Sem PIN' });
  assert(!r.ok && r.code === 'PROFESSOR_NAO_AUTORIZADO', 'com PIN, criar sala sem ser professor é recusado');
  r = await emitAsync(sock, 'create_room', { name: 'Com PIN', teacherToken: T.teacher });
  assert(r.ok && r.roomCode, 'professor cria a sala');
  sock.close();

  // ---- turmas ----
  r = await api('POST', '/api/teacher/students', { names: 'Davi Rocha\nElisa Prado', className: ' 5b ' }, T);
  assert(r.created.length === 2, 'cadastro em lote com turma');
  r = await api('POST', '/api/teacher/students', { names: 'Fabio Reis', className: '5B' }, T);
  r = await api('POST', '/api/teacher/students', { names: 'Gil Matos', className: '<script>' }, T);
  assert(r.code === 'TURMA_INVALIDA', 'turma com símbolos é recusada');
  r = await api('POST', '/api/teacher/students', { names: 'Hugo Alves 4C' }, T);
  r = await api('GET', '/api/teacher/students', null, T);
  const byName = (n) => r.students.find((s) => s.name === n);
  assert(byName('Davi Rocha').className === '5B' && byName('Fabio Reis').className === '5B',
    'turma fica em maiúscula (" 5b " -> "5B") e quem escreve igual cai nela');
  assert(byName('Hugo Alves 4C').className === '4C', 'turma no nome ("Hugo Alves 4C") vira a turma da conta');
  assert(byName('Bruno Lima').className === null, 'quem não tem turma fica sem turma');
  assert(JSON.stringify(r.classes) === JSON.stringify(['4C', '5B']), 'lista das turmas, em ordem');
  const ids = [byName('Bruno Lima').id, byName('Davi Rocha').id];
  let c = await api('POST', '/api/teacher/students/class', { ids, className: '4c' }, T);
  assert(c.ok && c.className === '4C', 'muda a turma de vários de uma vez');
  c = await api('POST', '/api/teacher/students/class', { ids: [byName('Elisa Prado').id], className: '' }, T);
  assert(c.ok && c.className === null, 'tira da turma');
  c = await api('POST', '/api/teacher/students/class', { ids: ['nao-existe'], className: '4C' }, T);
  assert(c.status === 404, 'educando inexistente é recusado');
  r = await api('GET', '/api/teacher/students', null, T);
  assert(byName('Bruno Lima').className === '4C' && byName('Davi Rocha').className === '4C' && byName('Elisa Prado').className === null,
    'turmas gravadas');

  await api('POST', '/api/teacher/logout', null, T);
  r = await api('GET', '/api/teacher/students', null, T);
  assert(r.status === 401, 'depois de sair, o token do professor não vale');

  console.log('\n----------------------------------------');
  await srv.stop();
  if (errors.length) {
    console.log(`❌ ${errors.length} FALHA(S):`);
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ERRO FATAL NO TESTE', e);
  if (srv) await srv.stop();
  process.exit(1);
});
