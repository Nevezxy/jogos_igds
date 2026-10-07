// public/games/bingo/join.js
// Entrada da criança em 3 passos, um de cada vez:
//   1) código da sala em 5 caixinhas (pulado quando o link/QR traz ?sala=)
//   2) nome
//   3) bichinho (avatar)
// O código é conferido no servidor já no passo 1, e os erros aparecem na
// fala do mascote, em linguagem de criança, no passo em que dá para corrigir.

(function () {
  const { emitAsync } = window.BingoSocket;
  const { showScreen } = window.BingoUI;
  const { play } = window.BingoSound;
  const { shake, sparkleAt } = window.BingoFx;

  const CODE_LENGTH = 5;
  // mesmo alfabeto do servidor (sem 0, O, 1 e I, que confundem)
  const CODE_CHARS = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;

  const card = document.querySelector('.join-card');
  const speech = document.getElementById('join-speech');
  const mascot = document.getElementById('join-mascot');
  const errorEl = document.getElementById('join-error');
  const codeWrap = document.getElementById('code-boxes');
  const codeInput = document.getElementById('input-room-code');
  const nameInput = document.getElementById('input-player-name');
  const avatarGrid = document.getElementById('avatar-grid');

  let step = 1;
  let chosenAvatar = null;
  let codeFromLink = false;

  const SPEECH = {
    1: 'Qual é o código da sala? 🤔',
    2: 'Como você se chama? 😊',
    3: 'Escolha seu bichinho! 🐾',
  };

  // Mensagens do servidor traduzidas para criança, e o passo onde corrigir.
  const FRIENDLY_ERRORS = {
    SALA_NAO_ENCONTRADA: [1, 'Hmm, não achei essa sala 🤔 Confere o código com o(a) professor(a)!'],
    SALA_ENCERRADA: [1, 'Essa sala já fechou 🌙 Peça o código novo!'],
    SALA_BLOQUEADA: [1, 'A sala está trancada 🔒 Peça ao professor(a) para abrir!'],
    SALA_LOTADA: [1, 'A sala está cheia! 😮 Fale com o(a) professor(a).'],
    NOME_DUPLICADO: [2, 'Já tem alguém com esse nome! Que tal colocar a inicial do sobrenome?'],
    NOME_INVALIDO: [2, 'Seu nome precisa ter de 2 a 30 letras ✏️'],
    NOME_IMPROPRIO: [2, 'Esse nome não pode 🙅 Escolha outro, por favor!'],
  };

  // ---------------- passos ----------------

  function goToStep(n) {
    step = n;
    card.querySelectorAll('.join-step').forEach((el) => { el.hidden = Number(el.dataset.step) !== n; });
    card.querySelectorAll('.step-dot').forEach((dot) => {
      const s = Number(dot.dataset.step);
      dot.classList.toggle('is-done', s < n);
      dot.classList.toggle('is-current', s === n);
      dot.textContent = s < n ? '⭐' : String(s);
    });
    speech.textContent = SPEECH[n];
    window.BingoMascot.setMood('idle', mascot);
    errorEl.textContent = '';
    const focusTarget = n === 1 ? firstEmptyBox() : n === 2 ? nameInput : avatarGrid.querySelector('[aria-checked="true"]');
    setTimeout(() => focusTarget && focusTarget.focus(), 60);
  }

  function showError(message, atStep) {
    if (atStep && atStep !== step) goToStep(atStep);
    speech.textContent = message;
    window.BingoMascot.setMood('wow', mascot);
    play('bonk');
    shake(card.querySelector(`.join-step[data-step="${step}"]`));
  }

  // ---------------- passo 1: caixinhas do código ----------------

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
      if (readCode().length === CODE_LENGTH) checkCode();
    });
    box.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].value = '';
        boxes[i - 1].classList.remove('is-filled');
        boxes[i - 1].focus();
        ev.preventDefault();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        checkCode();
      }
    });
    box.addEventListener('paste', (ev) => {
      ev.preventDefault();
      const next = fillFrom(i, (ev.clipboardData || window.clipboardData).getData('text'));
      if (next < CODE_LENGTH) boxes[next].focus();
      if (readCode().length === CODE_LENGTH) checkCode();
    });
  });

  let checking = false;
  async function checkCode() {
    if (checking) return;
    const code = readCode();
    if (code.length < CODE_LENGTH) {
      showError(`O código tem ${CODE_LENGTH} letras 🔤`);
      return;
    }
    checking = true;
    try {
      const res = await emitAsync('check_room', { roomCode: code });
      codeInput.value = res.code;
      play('pop');
      goToStep(2);
    } catch (e) {
      const [, message] = FRIENDLY_ERRORS[e.code] || [1, e.message || 'Não consegui achar essa sala.'];
      showError(message, 1);
    } finally {
      checking = false;
    }
  }

  document.getElementById('join-next-1').addEventListener('click', checkCode);

  // ---------------- passo 2: nome ----------------

  function checkName() {
    const name = nameInput.value.trim();
    if (name.length < 2) {
      showError(FRIENDLY_ERRORS.NOME_INVALIDO[1]);
      return;
    }
    play('pop');
    goToStep(3);
  }

  document.getElementById('join-next-2').addEventListener('click', checkName);
  nameInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); checkName(); }
  });

  // ---------------- passo 3: bichinho ----------------

  function selectAvatar(btn) {
    avatarGrid.querySelectorAll('.avatar-option').forEach((b) => b.setAttribute('aria-checked', 'false'));
    btn.setAttribute('aria-checked', 'true');
    chosenAvatar = btn.dataset.avatar;
  }

  window.BingoAvatars.forEach((emoji, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-option';
    btn.dataset.avatar = emoji;
    btn.textContent = emoji;
    btn.style.setProperty('--i', i);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.addEventListener('click', () => {
      selectAvatar(btn);
      play('boing');
      sparkleAt(btn, 8);
    });
    avatarGrid.appendChild(btn);
  });

  // ---------------- enviar ----------------

  document.getElementById('form-join').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (step !== 3) return;
    if (!chosenAvatar) {
      showError('Toque num bichinho para escolher 👆');
      return;
    }
    const submitBtn = document.getElementById('join-submit');
    submitBtn.disabled = true;
    const code = codeInput.value;
    const name = nameInput.value.trim();
    try {
      const res = await emitAsync('join_room', { roomCode: code, name, avatar: chosenAvatar });
      window.BingoApp.setPlayerSession(code, res.playerId, res.playerToken, name, res.state.you.avatar);
      play('start');
      window.BingoPlayer.render(res.state);
    } catch (e) {
      const [atStep, message] = FRIENDLY_ERRORS[e.code] || [3, e.message || 'Não deu para entrar na sala.'];
      showError(message, atStep);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---------------- navegação ----------------

  document.getElementById('join-back').addEventListener('click', () => {
    const firstStep = codeFromLink ? 2 : 1;
    if (step > firstStep) goToStep(step - 1);
    else showScreen('screen-home');
  });

  // Abre a entrada do zero (botão JOGAR) ou já com o código (link/QR Code).
  function open(code) {
    boxes.forEach((b) => { b.value = ''; b.classList.remove('is-filled'); });
    codeInput.value = '';
    codeFromLink = false;
    if (!chosenAvatar) {
      // um bichinho sorteado já vem escolhido; a criança pode trocar
      const options = avatarGrid.querySelectorAll('.avatar-option');
      selectAvatar(options[Math.floor(Math.random() * options.length)]);
    }
    showScreen('screen-join');
    if (code) {
      fillFrom(0, code);
      codeFromLink = true;
      goToStep(1);
      checkCode();
    } else {
      goToStep(1);
    }
  }

  // Código vindo do link (?sala=ABCDE), usado pelo QR Code do professor.
  function codeFromUrl() {
    const code = new URLSearchParams(location.search).get('sala');
    return code ? code.trim().toUpperCase() : null;
  }

  document.querySelectorAll('[data-go="screen-join"]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopImmediatePropagation(); // substitui a navegação simples do app.js
      play('click');
      open();
    });
  });

  window.BingoJoin = { open, codeFromUrl };
})();
