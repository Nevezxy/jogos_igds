// public/js/shared/ui.js
// Utilitários de interface compartilhados entre as telas: alternância
// de "screens" (SPA simples sem framework), toasts de feedback e um
// modal de confirmação genérico (usado, por ex., para reiniciar partida).

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo({ top: 0 });
}

function toast(message, type = 'info', duration = 3800) {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s ease';
    setTimeout(() => el.remove(), 260);
  }, duration);
}

function confirmModal(title, message, confirmLabel = 'Confirmar') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    okBtn.textContent = confirmLabel;
    overlay.hidden = false;

    function cleanup(result) {
      overlay.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

const STATUS_LABELS = {
  waiting: 'esperando',
  playing: 'valendo!',
  paused: 'pausado',
  ended: 'acabou',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

// Ajusta o tamanho da letra para o texto caber numa bola/caixa: a palavra
// mais longa limita pela largura e o número de palavras (uma por linha no
// pior caso) limita pela altura. `area` é a fração da caixa usada pelo
// texto (a "janela" branca da bola é menor que a bola inteira).
function fitText(el, text, { area = 1, max = Infinity, min = 9 } = {}) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const longest = Math.max(2, ...words.map((w) => [...w].length));
  const w = el.clientWidth * area;
  const h = el.clientHeight * area;
  const size = Math.min(max, (w * 1.7) / longest, (h * 0.8) / Math.max(1, words.length));
  el.style.fontSize = `${Math.max(min, size)}px`;
}

// Quadro com todos os itens possíveis da partida; os sorteados acendem e o
// último pisca. Usado no painel do professor e no telão.
function renderNumberBoard(el, pool, drawnItems) {
  const drawn = new Set(drawnItems);
  const last = drawnItems[drawnItems.length - 1];
  const key = pool.join('|');
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.innerHTML = '';
    el.classList.toggle('is-long', pool.some((item) => [...String(item)].length > 4));
    pool.forEach((item) => {
      const cell = document.createElement('span');
      cell.className = 'board-cell';
      cell.textContent = item;
      cell.dataset.value = item;
      el.appendChild(cell);
    });
  }
  el.querySelectorAll('.board-cell').forEach((cell) => {
    cell.classList.toggle('is-drawn', drawn.has(cell.dataset.value));
    cell.classList.toggle('is-last', cell.dataset.value === last);
  });
}

// Links que a turma usa para entrar (com ?sala=CODE). Se a página foi aberta
// por "localhost", usa os endereços de rede que o servidor informa — senão,
// o próprio endereço da página já serve para os alunos.
let joinInfoPromise = null;
function getJoinUrls(code) {
  if (!joinInfoPromise) {
    joinInfoPromise = fetch('/api/join-info').then((r) => r.json()).catch(() => ({ urls: [] }));
  }
  return joinInfoPromise.then((info) => {
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const bases = isLocal ? [...info.urls] : [location.origin, ...info.urls.filter((u) => u !== location.origin)];
    if (!bases.length) bases.push(location.origin);
    return bases.map((base) => `${base}/?sala=${encodeURIComponent(code)}`);
  });
}

function qrUrl(data) {
  return `/qr.svg?data=${encodeURIComponent(data)}`;
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

window.BingoUI = {
  showScreen, toast, confirmModal, statusLabel, escapeHtml, fitText, renderNumberBoard, getJoinUrls, qrUrl,
};
