// public/js/platform/app.js
// Comportamentos que valem para a plataforma inteira, em qualquer jogo:
// navegação simples entre telas (data-go), botão de som, "clique de
// brinquedo" nos botões e a surpresinha de tocar no mascote.

(function () {
  const { showScreen } = window.BingoUI;
  const { play } = window.BingoSound;

  // ---------------- navegação simples ----------------

  document.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.dataset.go));
  });

  // ---------------- som ----------------

  // Botão 🔊/🔇 fixo no canto (vale para este aparelho).
  const soundBtn = document.getElementById('btn-sound');
  function renderSoundButton() {
    const muted = window.BingoSound.isMuted();
    soundBtn.textContent = muted ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-pressed', String(muted));
    soundBtn.setAttribute('aria-label', muted ? 'Ligar o som' : 'Desligar o som');
  }
  soundBtn.addEventListener('click', () => {
    window.BingoSound.setMuted(!window.BingoSound.isMuted());
    play('pop');
  });
  window.BingoSound.onChange(renderSoundButton);
  renderSoundButton();

  // "Clique de brinquedo" nos botões comuns. Casas da cartela e o botão de
  // sortear têm sons próprios.
  document.addEventListener('click', (ev) => {
    // (o clique no rótulo de um chip gera um segundo clique no checkbox; ignora esse)
    if (ev.target.matches('.pack-chip input')) return;
    const target = ev.target.closest('.btn, .btn-mini, .btn-back, .pack-chip');
    if (target && !target.matches('.btn-draw') && !target.disabled) play('click');
  });

  // Tocar no mascote faz ele comemorar (surpresinha para as crianças).
  document.addEventListener('click', (ev) => {
    const mascot = ev.target.closest('.mascot');
    if (!mascot) return;
    window.BingoMascot.setMood('party', mascot, 1200);
    play('boing');
    window.BingoFx.sparkleAt(mascot, 10);
  });
})();
