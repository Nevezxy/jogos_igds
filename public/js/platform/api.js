// public/js/platform/api.js
// Chamadas HTTP à API da plataforma. Envia o token do educando logado
// (X-Student-Token) e transforma respostas { ok: false } em erros com
// `code` e `message`, como o emitAsync do socket faz.
//
// Internet fraca: um resultado de rodada (POST /progress/<jogo>/results)
// que não chega ao servidor fica guardado no navegador (caixa de saída) e é
// reenviado sozinho quando a conexão volta; o jogo recebe um erro com
// `queued: true` e avisa que o resultado foi guardado. Um selo no canto
// mostra quando está sem internet ou com resultados esperando. Também
// registra o service worker (/sw.js), que guarda o app no navegador.

(function () {
  let token = null;
  const TIMEOUT_MS = 20000; // conexão muito lenta: desiste e guarda para depois
  const OUTBOX_KEY = 'igds_outbox_v1';
  const MAX_OUTBOX = 60;
  const QUEUEABLE = /^\/progress\/[a-z0-9_-]+\/results$/;

  function offlineError() {
    const err = new Error('Sem conexão com o servidor.');
    err.code = 'SEM_CONEXAO';
    return err;
  }

  async function send(method, route, body, withToken) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (withToken) headers['X-Student-Token'] = withToken;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    let res;
    try {
      res = await fetch(`/api${route}`, {
        method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (e) {
      throw offlineError();
    } finally {
      clearTimeout(timer);
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

  // ---------------- caixa de saída ----------------
  function readOutbox() {
    try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeOutbox(list) {
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list.slice(-MAX_OUTBOX))); } catch (e) { /* cheio ou bloqueado */ }
    renderStatus();
  }
  function enqueue(route, body) {
    const list = readOutbox();
    list.push({ route, body, token, at: Date.now() });
    writeOutbox(list);
  }

  let flushing = false;
  // Reenvia o que está guardado, do mais antigo ao mais novo. Sem internet,
  // para e tenta de novo mais tarde; recusado pelo servidor (resultado
  // inválido, sessão que acabou), descarta.
  async function flush() {
    if (flushing) return 0;
    flushing = true;
    let sent = 0;
    try {
      let list = readOutbox();
      while (list.length) {
        const item = list[0];
        try {
          await send('POST', item.route, item.body, item.token);
          sent++;
        } catch (e) {
          if (e.code === 'SEM_CONEXAO' || (e.status && e.status >= 500)) break;
        }
        list = readOutbox().slice(1);
        writeOutbox(list);
      }
    } finally {
      flushing = false;
      renderStatus();
    }
    if (sent && window.BingoUI) {
      window.BingoUI.toast(`📶 A internet voltou: ${sent === 1 ? '1 resultado guardado foi enviado' : `${sent} resultados guardados foram enviados`} ✅`, 'success', 4000);
    }
    if (sent) window.dispatchEvent(new CustomEvent('plataforma:sincronizou', { detail: { sent } }));
    return sent;
  }

  // Identificação da rodada: criada antes do primeiro envio e guardada junto
  // na caixa de saída, para o servidor reconhecer um reenvio e não gravar o
  // mesmo resultado duas vezes.
  function newAttemptId() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* ignore */ }
    let s = '';
    try { crypto.getRandomValues(new Uint8Array(16)).forEach((b) => { s += b.toString(16).padStart(2, '0'); }); } catch (e) { s = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`; }
    return s;
  }

  async function request(method, route, body) {
    if (method === 'POST' && QUEUEABLE.test(route) && body && typeof body === 'object' && !body.attemptId) {
      body = { ...body, attemptId: newAttemptId() };
    }
    try {
      return await send(method, route, body, token);
    } catch (e) {
      if (e.code === 'SEM_CONEXAO' && method === 'POST' && QUEUEABLE.test(route) && token) {
        enqueue(route, body);
        const err = new Error('📶 Sem internet agora: o resultado ficou guardado e vai ser enviado sozinho quando a conexão voltar.');
        err.code = 'GUARDADO_OFFLINE';
        err.queued = true;
        throw err;
      }
      throw e;
    }
  }

  // ---------------- selo de conexão ----------------
  let pill = null;
  function renderStatus() {
    if (typeof document === 'undefined' || !document.body) return;
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'net-status';
      pill.setAttribute('role', 'status');
      pill.addEventListener('click', () => flush());
      document.body.appendChild(pill);
    }
    const waiting = readOutbox().length;
    const offline = navigator.onLine === false;
    pill.hidden = !offline && !waiting;
    pill.classList.toggle('is-offline', offline);
    pill.textContent = offline
      ? `📶 Sem internet${waiting ? ` · ${waiting} resultado${waiting === 1 ? '' : 's'} guardado${waiting === 1 ? '' : 's'}` : ': dá para continuar jogando'}`
      : `⏳ ${waiting} resultado${waiting === 1 ? '' : 's'} esperando para enviar (toque para tentar)`;
  }

  window.addEventListener('online', () => { renderStatus(); flush(); });
  window.addEventListener('offline', renderStatus);
  setInterval(() => { if (readOutbox().length) flush(); }, 30000);
  const boot = () => {
    renderStatus();
    flush();
    // guarda o app no navegador (precisa de https ou localhost)
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* segue sem o modo offline */ });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);

  window.PlataformaApi = {
    setToken(value) { token = value || null; },
    get: (route) => request('GET', route),
    post: (route, body = {}) => request('POST', route, body),
    flush,
    pending: () => readOutbox().length,
  };
})();
