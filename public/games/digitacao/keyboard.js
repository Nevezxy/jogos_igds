// public/games/digitacao/keyboard.js
// Desenha o teclado na tela a partir de um layout (layouts/abnt2.js): cada
// tecla tem a cor do dedo que a aperta. Destaca a próxima tecla (e o Shift
// do lado oposto, quando precisa), anima a tecla física apertada e mostra
// acerto/erro.

(function () {
  // Rótulo da tecla: letras em maiúscula (como no teclado de verdade);
  // teclas com dois símbolos mostram o de cima (Shift) e o de baixo.
  function labelFor(key) {
    if (key.label) return { main: key.base, small: key.label };
    if (/^Key/.test(key.code) || key.code === 'Semicolon') return { main: key.shift };
    return { top: key.shift, main: key.base };
  }

  function createKeyboard(container, layout) {
    container.innerHTML = '';
    container.classList.add('kb');
    const els = {};

    layout.rows.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach((key) => {
        const el = document.createElement('div');
        el.className = `kb-key finger-${key.fingerId}`;
        el.style.setProperty('--w', key.width);
        el.dataset.code = key.code;
        if (key.spacer) el.classList.add('kb-enter-tail');
        if (key.label) el.classList.add('kb-wide');
        if (key.home) el.classList.add('kb-home');
        if (key.dead || key.deadShift) el.classList.add('kb-dead');
        const label = labelFor(key);
        if (label.top) {
          const top = document.createElement('span');
          top.className = 'kb-top';
          top.textContent = label.top;
          el.appendChild(top);
        }
        if (label.main) {
          const main = document.createElement('span');
          main.className = 'kb-main';
          main.textContent = label.main;
          el.appendChild(main);
        }
        if (label.small) {
          const small = document.createElement('span');
          small.className = 'kb-small';
          small.textContent = label.small;
          el.appendChild(small);
        }
        rowEl.appendChild(el);
        els[key.code] = el;
      });
      container.appendChild(rowEl);
    });
    // a tecla Enter desenhada em duas fileiras responde pelas duas partes
    const enterParts = [els.Enter, els.Enter2].filter(Boolean);

    function get(code) {
      return code === 'Enter' ? enterParts : els[code] ? [els[code]] : [];
    }

    // Destaca os passos (de layout.strokesFor) da próxima tecla.
    function highlight(stroke) {
      container.querySelectorAll('.is-next, .is-next-shift').forEach((el) => el.classList.remove('is-next', 'is-next-shift'));
      if (!stroke) return;
      get(stroke.code).forEach((el) => el.classList.add('is-next'));
      if (stroke.shiftCode) get(stroke.shiftCode).forEach((el) => el.classList.add('is-next-shift'));
    }

    // Tecla física apertada (pelo event.code): afunda enquanto estiver
    // apertada.
    function press(code, down) {
      get(code).forEach((el) => el.classList.toggle('is-pressed', down));
    }

    function flash(code, ok) {
      get(code).forEach((el) => {
        const cls = ok ? 'is-ok' : 'is-bad';
        el.classList.remove('is-ok', 'is-bad');
        void el.offsetWidth; // reinicia a animação
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), 380);
      });
    }

    function releaseAll() {
      container.querySelectorAll('.is-pressed').forEach((el) => el.classList.remove('is-pressed'));
    }

    return { highlight, press, flash, releaseAll };
  }

  window.DigitacaoKeyboard = { createKeyboard };
})();
