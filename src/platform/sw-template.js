// src/platform/sw-template.js
// Service worker da plataforma (servido em /sw.js por src/platform/offline.js,
// que preenche a versão e a lista de arquivos). Serve para a escola com internet fraca:
//   • guarda o app inteiro no navegador (telas, scripts, estilos e os jogos):
//     abre rápido e funciona mesmo se a conexão cair no meio da aula
//   • arquivos guardados vêm do cache na hora; uma versão nova do servidor
//     muda a versão, e o navegador baixa tudo de novo uma vez
//   • páginas: tenta a internet por alguns segundos e, se não vier, usa a
//     guardada
//   • API: o painel, o login e o progresso (só leitura) vêm da internet e,
//     sem ela, da última resposta guardada daquela mesma conta (a chave do
//     cache leva o token, para uma criança nunca ver o progresso de outra);
//     o resto da API (salvar, professor) vai sempre direto à internet
//   • fotos do Click e fontes: guardadas na primeira vez que aparecem

/* eslint-disable no-restricted-globals */
const VERSION = '__VERSION__';
const FILES = __FILES__;
const STATIC = `igds-static-${VERSION}`;
const RUNTIME = 'igds-runtime-v1'; // fotos e fontes (não mudam de versão)
const API = 'igds-api-v1';
const PAGE_TIMEOUT_MS = 4000;
const API_TIMEOUT_MS = 6000;
const API_CACHED = [/^\/api\/games$/, /^\/api\/auth\/me$/, /^\/api\/progress(\/[a-z0-9_-]+)?$/];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC);
    // um arquivo que falhar não impede os outros
    await Promise.all(FILES.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC, RUNTIME, API]);
    for (const key of await caches.keys()) if (key.startsWith('igds-') && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const offlineJson = () => new Response(JSON.stringify({ ok: false, code: 'SEM_CONEXAO', message: 'Sem conexão com o servidor.' }), {
  status: 503, headers: { 'Content-Type': 'application/json' },
});

// leitura da API: internet primeiro; sem ela, a última resposta desta conta
async function apiRead(request) {
  const token = request.headers.get('x-student-token') || '';
  const key = `${request.url}${request.url.includes('?') ? '&' : '?'}__conta=${await hash(token)}`;
  const cache = await caches.open(API);
  try {
    const res = await withTimeout(fetch(request), API_TIMEOUT_MS);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(key)) || offlineJson();
  }
}

// páginas (o app é uma página só): internet primeiro, com prazo curto
async function page(request) {
  const cache = await caches.open(STATIC);
  try {
    const res = await withTimeout(fetch(request), PAGE_TIMEOUT_MS);
    if (res.ok) await cache.put('/', res.clone());
    return res;
  } catch (e) {
    return (await cache.match('/')) || (await cache.match('/index.html')) || Response.error();
  }
}

// arquivos do app: do cache na hora (a versão nova troca o cache inteiro)
async function asset(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch: cacheName === STATIC });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok || res.type === 'opaque') await cache.put(request, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // salvar resultado etc.: direto à internet
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // fontes do Google: guardadas na primeira vez
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(asset(request, RUNTIME));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    if (API_CACHED.some((re) => re.test(url.pathname))) event.respondWith(apiRead(request));
    return;
  }
  if (url.pathname === '/socket.io/socket.io.js') { event.respondWith(asset(request, STATIC)); return; }
  if (url.pathname.startsWith('/socket.io') || url.pathname === '/sw.js' || url.pathname === '/qr.svg') return;
  if (request.mode === 'navigate') { event.respondWith(page(request)); return; }
  event.respondWith(asset(request, url.pathname.startsWith('/games/click/img/') ? RUNTIME : STATIC));
});
