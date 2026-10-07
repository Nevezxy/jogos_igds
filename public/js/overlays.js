// public/js/overlays.js
// Camadas de tela cheia usadas pela criança e pelo telão:
//   countdown() — "3, 2, 1, BINGO!" no começo de cada partida
//   drawBall()  — a bola sorteada rola até o meio da tela e some
//   bingo()     — comemoração de BINGO com letras pulando e mascote
// As camadas de contagem e de bola não bloqueiam toques (pointer-events: none).

(function () {
  const { play } = window.BingoSound;
  const { fitText } = window.BingoUI;

  // ---------- contagem 3-2-1 ----------

  let countdownTimers = [];

  function countdown({ steps = ['3', '2', '1', 'BINGO!'], stepMs = 800 } = {}) {
    const overlay = document.getElementById('countdown-overlay');
    const number = document.getElementById('countdown-number');
    countdownTimers.forEach(clearTimeout);
    countdownTimers = [];
    overlay.hidden = false;
    steps.forEach((label, i) => {
      countdownTimers.push(setTimeout(() => {
        number.textContent = label;
        number.classList.toggle('is-final', i === steps.length - 1);
        number.classList.remove('tick');
        void number.offsetWidth; // reinicia a animação a cada número
        number.classList.add('tick');
        play(i === steps.length - 1 ? 'start' : 'tick');
      }, i * stepMs));
    });
    countdownTimers.push(setTimeout(() => { overlay.hidden = true; }, steps.length * stepMs + 250));
  }

  // ---------- bola sorteada ----------

  let drawTimer = null;

  function drawBall(value, { holdMs = 1500 } = {}) {
    const overlay = document.getElementById('draw-overlay');
    const valueEl = document.getElementById('draw-overlay-value');
    const ball = overlay.querySelector('.draw-ball');
    clearTimeout(drawTimer);
    valueEl.textContent = value;
    overlay.hidden = false;
    overlay.classList.remove('is-leaving');
    ball.classList.remove('roll');
    void ball.offsetWidth;
    ball.classList.add('roll');
    fitText(valueEl, value, { area: 0.78, max: valueEl.clientWidth * 0.45 });
    const announcer = document.getElementById('draw-announcer');
    if (announcer) announcer.textContent = `Saiu: ${value}`;
    drawTimer = setTimeout(() => {
      overlay.classList.add('is-leaving');
      drawTimer = setTimeout(() => { overlay.hidden = true; }, 380);
    }, holdMs);
  }

  // ---------- comemoração de BINGO ----------

  let bingoTimer = null;

  function bingo({ text = 'Você fez BINGO!', autoCloseMs = 7000 } = {}) {
    const overlay = document.getElementById('bingo-overlay');
    document.getElementById('bingo-overlay-text').textContent = text;
    overlay.hidden = false;
    overlay.querySelector('.bingo-box').classList.remove('anim-pop-in');
    void overlay.offsetWidth;
    overlay.querySelector('.bingo-box').classList.add('anim-pop-in');
    clearTimeout(bingoTimer);
    if (autoCloseMs) bingoTimer = setTimeout(closeBingo, autoCloseMs);
    document.getElementById('bingo-overlay-close').focus();
  }

  function closeBingo() {
    clearTimeout(bingoTimer);
    document.getElementById('bingo-overlay').hidden = true;
  }

  document.getElementById('bingo-overlay-close').addEventListener('click', closeBingo);

  window.BingoOverlays = { countdown, drawBall, bingo, closeBingo };
})();
