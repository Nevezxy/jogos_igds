// Contas dos educandos e API da plataforma. Sobe um servidor próprio, numa
// porta separada e com banco temporário, para não sujar o banco de verdade.

const { startTestServer } = require('./helpers');

async function main() {
  const errors = [];
  const assert = (cond, msg) => { if (!cond) errors.push(msg); else console.log('OK:', msg); };
  const server = await startTestServer(3101);
  const { api } = server;

  try {
    // ---- validação do nome ----
    let r = await api('POST', '/api/auth/lookup', { name: 'Maria' });
    assert(r.status === 400 && r.code === 'NOME_SEM_SOBRENOME', 'nome sem sobrenome é recusado');
    r = await api('POST', '/api/auth/lookup', { name: 'Maria 123' });
    assert(r.status === 400 && r.code === 'NOME_INVALIDO', 'nome com números é recusado');
    r = await api('POST', '/api/auth/lookup', { name: 'Burro Silva' });
    assert(r.code === 'NOME_IMPROPRIO', 'nome impróprio é recusado');
    r = await api('POST', '/api/auth/lookup', { name: '  joão   DA silva ' });
    assert(r.ok && r.exists === false && r.name === 'João da Silva', 'conta nova: lookup diz que não existe e formata o nome');

    // ---- cadastro ----
    r = await api('POST', '/api/auth/register', { name: 'joão da silva', avatar: '🐼' });
    assert(r.ok && r.token && r.student.name === 'João da Silva' && r.student.avatar === '🐼', 'cadastro cria a conta com o bichinho');
    assert(r.student.firstName === 'João', 'primeiro nome vem separado');
    const token1 = r.token;
    const studentId = r.student.id;

    r = await api('POST', '/api/auth/register', { name: 'JOAO DA SILVA', avatar: '🐶' });
    assert(r.status === 409 && r.code === 'CONTA_JA_EXISTE', 'não cria conta repetida (maiúsculas e sem acento)');

    // ---- login sem diferenciar maiúsculas, acentos e espaços ----
    for (const variant of ['JOÃO DA SILVA', 'joao da silva', '  João   da   Silva  ', 'Joäo Da Sílva']) {
      r = await api('POST', '/api/auth/lookup', { name: variant });
      assert(r.ok && r.exists && r.avatar === '🐼', `lookup acha a conta com "${variant}"`);
      r = await api('POST', '/api/auth/login', { name: variant });
      assert(r.ok && r.student.id === studentId, `login entra na mesma conta com "${variant}"`);
    }
    r = await api('POST', '/api/auth/login', { name: 'Ninguém Aqui' });
    assert(r.status === 404 && r.code === 'CONTA_NAO_ENCONTRADA', 'login de conta inexistente dá 404');

    // ---- sessão ----
    r = await api('GET', '/api/auth/me', null, token1);
    assert(r.ok && r.student.id === studentId, '/me devolve o educando do token');
    r = await api('GET', '/api/auth/me', null, 'token-falso');
    assert(r.status === 401 && r.code === 'SESSAO_INVALIDA', 'token inválido dá 401');
    r = await api('GET', '/api/auth/me');
    assert(r.status === 401, 'sem token dá 401');

    // ---- bichinho ----
    r = await api('POST', '/api/auth/avatar', { avatar: '🦊' }, token1);
    assert(r.ok && r.student.avatar === '🦊', 'troca o bichinho');
    r = await api('POST', '/api/auth/avatar', { avatar: '💩' }, token1);
    assert(r.code === 'AVATAR_INVALIDO', 'recusa bichinho fora da lista');
    r = await api('POST', '/api/auth/avatar', { avatar: '🐶' });
    assert(r.status === 401, 'trocar bichinho exige sessão');

    // ---- sair ----
    r = await api('POST', '/api/auth/logout', null, token1);
    assert(r.ok, 'logout responde ok');
    r = await api('GET', '/api/auth/me', null, token1);
    assert(r.status === 401, 'depois do logout o token não vale mais');

    // ---- progresso nos jogos ----
    const kid = await server.student('Rita Moura', '🐢');
    r = await api('GET', '/api/progress/digitacao', null, kid);
    assert(r.ok && r.progress === null, 'conta nova começa sem progresso');
    r = await api('GET', '/api/progress/digitacao');
    assert(r.status === 401, 'progresso exige sessão');
    const round = { levelId: 'm1f1', chars: 50, durationMs: 60000, accuracy: 96, wpm: 10, wrongPresses: 2, errorsByChar: { f: 2 } };
    r = await api('POST', '/api/progress/digitacao/results', round, kid);
    assert(r.ok && r.result.stars === 2 && r.progress.levels.m1f1.stars === 2, 'resultado gravado com as estrelas do servidor');
    r = await api('POST', '/api/progress/digitacao/results', { ...round, levelId: 'm1f3' }, kid);
    assert(r.status === 403 && r.code === 'FASE_BLOQUEADA', 'não grava fase ainda bloqueada');
    r = await api('POST', '/api/progress/digitacao/results', { ...round, levelId: 'm1f2', wpm: 120 }, kid);
    assert(r.code === 'RESULTADO_INVALIDO', 'recusa velocidade impossível');
    r = await api('POST', '/api/progress/digitacao/results', { ...round, levelId: 'm1f2', accuracy: 80 }, kid);
    assert(r.ok && r.result.stars === 0, 'rodada sem estrela também é gravada');
    r = await api('GET', '/api/progress/digitacao', null, kid);
    assert(r.progress.levels.m1f1.stars === 2 && r.progress.levels.m1f2.stars === 0 && r.progress.plays === 2, 'progresso guardado no servidor');
    r = await api('GET', '/api/progress', null, kid);
    assert(r.summaries.digitacao === 'Fase 2 · ⭐ 2' && !r.summaries.bingo, `resumo para o painel: "${r.summaries.digitacao}"`);
    r = await api('POST', '/api/progress/bingo/results', round, kid);
    assert(r.code === 'SEM_RESULTADOS', 'jogo sem validateResult não aceita resultados por HTTP');
    r = await api('GET', '/api/progress/xyz', null, kid);
    assert(r.status === 404 && r.code === 'JOGO_NAO_ENCONTRADO', 'jogo inexistente dá 404');

    // ---- catálogo de jogos ----
    r = await api('GET', '/api/games');
    assert(Array.isArray(r.games) && r.games.some((g) => g.id === 'bingo') && r.games.some((g) => g.id === 'digitacao' && g.client)
      && !r.games.some((g) => 'server' in g),
      '/api/games lista os jogos sem expor o módulo do servidor');
    r = await api('GET', '/api/nao-existe');
    assert(r.status === 404, 'rota /api desconhecida dá 404');
  } finally {
    await server.stop();
  }

  console.log('\n----------------------------------------');
  if (errors.length) {
    console.log('❌ FALHAS:');
    errors.forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log('✅ TODOS OS TESTES PASSARAM');
}

main().catch((e) => { console.error(e); process.exit(1); });
