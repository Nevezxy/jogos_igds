// public/games/bingo/join.js
// Entrada da criança na sala: só o código, em 5 caixinhas. Nome e bichinho
// vêm da conta da plataforma (a criança já fez login). Quando o link/QR traz
// ?sala=, a entrada acontece sozinha. Os erros aparecem na fala do mascote,
// em linguagem de criança.

(function () {
  const { emitAsync } = window.BingoSocket;
  const { showScreen } = window.BingoUI;
  const { play } = window.BingoSound;
  const { shake } = window.BingoFx;

  const CODE_LENGTH = 5;
  // mesmo alfabeto do servidor (sem 0, O, 1 e I, que confundem)
  const CODE_CHARS = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;

  const speech = document.getElementById('join-speech');
  const mascot = document.getElementById('join-mascot');
  const codeWrap = document.getElementById('code-boxes');
  const submitBtn = document.getElementById('join-submit');

  const SPEECH = 'Qual é o código da sala? 🤔';

  // Mensagens do servidor traduzidas para criança.
  const FRIENDLY_ERRORS = {
    SALA_NAO_ENCONTRADA: 'Hmm, não achei essa sala 🤔 Confere o código com o(a) professor(a)!',
    SALA_ENCERRADA: 'Essa sala já fechou 🌙 Peça o código novo!',
    SALA_BLOQUEADA: 'A sala está trancada 🔒 Peça ao professor(a) para abrir!',
    SALA_LOTADA: 'A sala está cheia! 😮 Fale com o(a) professor(a).',
    EXPULSO: 'Você saiu dessa sala 😕 Fale com o(a) professor(a).',
  };

  function reset(message = SPEECH) {
    speech.textContent = message;
    window.BingoMascot.setMood('idle', mascot);
    setTimeout(() => firstEmptyBox().focus(), 60);
  }

  function showError(message) {
    speech.textContent = message;
    window.BingoMascot.setMood('wow', mascot);
    play('bonk');
    shake(codeWrap);
  }

  // ---------------- caixinhas do código ----------------

  const boxes = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    const box = document.createElement('input');
    box.type = 'text';
    box.className = 'code-box';
    // sem maxLength: teclados com sugestão (e colar) inserem várias letras de
    // uma vez, e o evento 'input' abaixo as distribui pelas caixas seguintes
    box.inputMode = 'text';
    box.autocapitalize = 'characters';
    box.spellcheck = false;
    box.setAttribute('aria-label', `Letra ${i + 1} do código`);
    codeWrap.appendChild(box);
    boxes.push(box);
  }

  function readCode() {
    return boxes.map((b) => b.value).join('');
  }

  function firstEmptyBox() {
    return boxes.find((b) => !b.value) || boxes[CODE_LENGTH - 1];
  }

  function clearBoxes() {
    boxes.forEach((b) => { b.value = ''; b.classList.remove('is-filled'); });
  }

  // Escreve a partir da caixa `start`, aceitando colar o código inteiro.
  function fillFrom(start, text) {
    const chars = [...text.toUpperCase()].filter((ch) => CODE_CHARS.test(ch));
    let i = start;
    for (const ch of chars) {
      if (i >= CODE_LENGTH) break;
      boxes[i].value = ch;
      boxes[i].classList.add('is-filled');
      i++;
    }
    return i;
  }

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      const typed = box.value;
      box.value = '';
      box.classList.remove('is-filled');
      const next = fillFrom(i, typed);
      if (next > i) play('click');
      if (next < CODE_LENGTH) boxes[next].focus();
      else boxes[CODE_LENGTH - 1].blur();
      if (readCode().length === CODE_LENGTH) join();
    });
    box.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].value = '';
        boxes[i - 1].classList.remove('is-filled');
        boxes[i - 1].focus();
        ev.preventDefault();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        join();
      }
    });
    box.addEventListener('paste', (ev) => {
      ev.preventDefault();
      const next = fillFrom(i, (ev.clipboardData || window.clipboardData).getData('text'));
      if (next < CODE_LENGTH) boxes[next].focus();
      if (readCode().length === CODE_LENGTH) join();
    });
  });

  // ---------------- entrar ----------------

  let joining = false;
  async function join() {
    if (joining) return;
    const code = readCode();
    if (code.length < CODE_LENGTH) {
      showError(`O código tem ${CODE_LENGTH} letras 🔤`);
      return;
    }
    joining = true;
    submitBtn.disabled = true;
    speech.textContent = 'Entrando na sala... 🚀';
    try {
      const res = await emitAsync('join_room', { roomCode: code, studentToken: window.PlataformaAuth.token() });
      const { you } = res.state;
      window.BingoApp.setPlayerSession(res.state.code, res.playerId, res.playerToken, you.name, you.avatar);
      play('start');
      window.BingoPlayer.render(res.state);
    } catch (e) {
      if (e.code === 'SESSAO_INVALIDA' || e.code === 'CONTA_OBRIGATORIA' || e.code === 'CONTA_DESATIVADA') {
        // a conta saiu deste aparelho (ou foi desativada): entra de novo
        window.BingoUI.toast('Entre de novo com o seu nome 😊', 'info');
        window.PlataformaAuth.logout();
        return;
      }
      showError(FRIENDLY_ERRORS[e.code] || e.message || 'Não deu para entrar na sala.');
      if (e.code === 'SALA_NAO_ENCONTRADA' || e.code === 'SALA_ENCERRADA') {
        clearBoxes();
        setTimeout(() => boxes[0].focus(), 60);
      }
    } finally {
      joining = false;
      submitBtn.disabled = false;
    }
  }

  document.getElementById('form-join').addEventListener('submit', (ev) => {
    ev.preventDefault();
    join();
  });

  document.getElementById('join-back').addEventListener('click', () => window.PlataformaAuth.goHome());

  // Abre a entrada do zero (cartão do bingo) ou já com o código (link/QR Code).
  function open(code) {
    clearBoxes();
    showScreen('screen-join');
    reset();
    if (code) {
      fillFrom(0, code);
      join();
    }
  }

  // Código vindo do link (?sala=ABCDE), usado pelo QR Code do professor.
  function codeFromUrl() {
    const code = new URLSearchParams(location.search).get('sala');
    return code ? code.trim().toUpperCase() : null;
  }

  window.BingoJoin = { open, codeFromUrl };
})();
