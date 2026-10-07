// public/js/platform/api.js
// Chamadas HTTP à API da plataforma. Envia o token do educando logado
// (X-Student-Token) e transforma respostas { ok: false } em erros com
// `code` e `message`, como o emitAsync do socket faz.

(function () {
  let token = null;

  async function request(method, route, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['X-Student-Token'] = token;
    let res;
    try {
      res = await fetch(`/api${route}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      const err = new Error('Sem conexão com o servidor.');
      err.code = 'SEM_CONEXAO';
      throw err;
    }
    const data = await res.json().catch(() => ({ ok: false, message: 'Resposta inválida do servidor.' }));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.message || 'Algo deu errado.');
      err.code = data.code || `HTTP_${res.status}`;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.PlataformaApi = {
    setToken(value) { token = value || null; },
    get: (route) => request('GET', route),
    post: (route, body = {}) => request('POST', route, body),
  };
})();
