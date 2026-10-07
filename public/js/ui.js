// public/js/ui.js
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

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

window.BingoUI = { showScreen, toast, confirmModal, statusLabel, escapeHtml };
