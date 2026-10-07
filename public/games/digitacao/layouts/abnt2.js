// public/games/digitacao/layouts/abnt2.js
// Teclado brasileiro ABNT2: posição de cada tecla (pelo `event.code` do
// navegador, que é a posição física), o que ela escreve sem e com Shift, e o
// dedo responsável na digitação com os 10 dedos. Também sabe "como digitar"
// cada caractere: quais teclas, em que ordem, com ou sem Shift — inclusive os
// acentos, que usam teclas "mortas" (aperta o acento, solta, depois a letra).
// Para acrescentar outro layout, crie outro arquivo com o mesmo formato.

(function () {
  // Dedos: m = mão (e/d), f = dedo (mindinho, anelar, medio, indicador, polegar)
  const F = {
    e5: { hand: 'e', finger: 'mindinho' },
    e4: { hand: 'e', finger: 'anelar' },
    e3: { hand: 'e', finger: 'medio' },
    e2: { hand: 'e', finger: 'indicador' },
    d2: { hand: 'd', finger: 'indicador' },
    d3: { hand: 'd', finger: 'medio' },
    d4: { hand: 'd', finger: 'anelar' },
    d5: { hand: 'd', finger: 'mindinho' },
    p: { hand: 'd', finger: 'polegar' },
  };

  // [code, sem Shift, com Shift, dedo, largura (em teclas), extra]
  // Teclas mortas (acentos) marcadas com `dead`: o caractere só aparece
  // depois da próxima tecla.
  const ROWS = [
    [
      ['Backquote', "'", '"', 'e5'], ['Digit1', '1', '!', 'e5'], ['Digit2', '2', '@', 'e4'],
      ['Digit3', '3', '#', 'e3'], ['Digit4', '4', '$', 'e2'], ['Digit5', '5', '%', 'e2'],
      ['Digit6', '6', '¨', 'd2', 1, { deadShift: true }], ['Digit7', '7', '&', 'd2'], ['Digit8', '8', '*', 'd3'],
      ['Digit9', '9', '(', 'd4'], ['Digit0', '0', ')', 'd5'], ['Minus', '-', '_', 'd5'],
      ['Equal', '=', '+', 'd5'], ['Backspace', '⌫', '', 'd5', 1.9, { label: 'apagar' }],
    ],
    [
      ['Tab', '↹', '', 'e5', 1.5, { label: 'tab' }],
      ['KeyQ', 'q', 'Q', 'e5'], ['KeyW', 'w', 'W', 'e4'], ['KeyE', 'e', 'E', 'e3'], ['KeyR', 'r', 'R', 'e2'],
      ['KeyT', 't', 'T', 'e2'], ['KeyY', 'y', 'Y', 'd2'], ['KeyU', 'u', 'U', 'd2'], ['KeyI', 'i', 'I', 'd3'],
      ['KeyO', 'o', 'O', 'd4'], ['KeyP', 'p', 'P', 'd5'],
      ['BracketLeft', '´', '`', 'd5', 1, { dead: true, deadShift: true }], ['BracketRight', '[', '{', 'd5'],
      ['Enter', '↵', '', 'd5', 1.4, { label: 'enter' }],
    ],
    [
      ['CapsLock', '⇪', '', 'e5', 1.8, { label: 'caps' }],
      ['KeyA', 'a', 'A', 'e5'], ['KeyS', 's', 'S', 'e4'], ['KeyD', 'd', 'D', 'e3'], ['KeyF', 'f', 'F', 'e2', 1, { home: true }],
      ['KeyG', 'g', 'G', 'e2'], ['KeyH', 'h', 'H', 'd2'], ['KeyJ', 'j', 'J', 'd2', 1, { home: true }], ['KeyK', 'k', 'K', 'd3'],
      ['KeyL', 'l', 'L', 'd4'], ['Semicolon', 'ç', 'Ç', 'd5'],
      ['Quote', '~', '^', 'd5', 1, { dead: true, deadShift: true }], ['Backslash', ']', '}', 'd5'],
      ['Enter2', '', '', 'd5', 1.1, { spacer: true }],
    ],
    [
      ['ShiftLeft', '⇧', '', 'e5', 1.3, { label: 'shift' }], ['IntlBackslash', '\\', '|', 'e5'],
      ['KeyZ', 'z', 'Z', 'e5'], ['KeyX', 'x', 'X', 'e4'], ['KeyC', 'c', 'C', 'e3'], ['KeyV', 'v', 'V', 'e2'],
      ['KeyB', 'b', 'B', 'e2'], ['KeyN', 'n', 'N', 'd2'], ['KeyM', 'm', 'M', 'd2'], ['Comma', ',', '<', 'd3'],
      ['Period', '.', '>', 'd4'], ['Slash', ';', ':', 'd5'], ['IntlRo', '/', '?', 'd5'],
      ['ShiftRight', '⇧', '', 'd5', 1.6, { label: 'shift' }],
    ],
    [
      ['Space', ' ', '', 'p', 7, { label: 'espaço' }],
    ],
  ];

  const keys = {};
  const rows = ROWS.map((row) => row.map(([code, base, shift, finger, width = 1, extra = {}]) => {
    const key = { code, base, shift, width, ...F[finger], fingerId: finger, ...extra };
    keys[code] = key;
    return key;
  }));

  // Caractere -> tecla (+ Shift?)
  const direct = {};
  for (const key of Object.values(keys)) {
    if (key.label || key.spacer) continue;
    if (!key.dead && key.base) direct[key.base] = { code: key.code, shift: false };
    if (!(key.dead || key.deadShift) && key.shift) direct[key.shift] = { code: key.code, shift: true };
  }
  direct[' '] = { code: 'Space', shift: false };

  // Acentos: tecla morta + letra
  const DEAD = {
    '´': { code: 'BracketLeft', shift: false, name: 'acento agudo' },
    '`': { code: 'BracketLeft', shift: true, name: 'crase' },
    '~': { code: 'Quote', shift: false, name: 'til' },
    '^': { code: 'Quote', shift: true, name: 'acento circunflexo' },
    '¨': { code: 'Digit6', shift: true, name: 'trema' },
  };
  const COMPOSED = {};
  const addComposed = (accent, pairs) => {
    for (const [plain, withAccent] of pairs) COMPOSED[withAccent] = { accent, letter: plain };
  };
  addComposed('´', [['a', 'á'], ['e', 'é'], ['i', 'í'], ['o', 'ó'], ['u', 'ú'], ['A', 'Á'], ['E', 'É'], ['I', 'Í'], ['O', 'Ó'], ['U', 'Ú']]);
  addComposed('`', [['a', 'à'], ['A', 'À']]);
  addComposed('~', [['a', 'ã'], ['o', 'õ'], ['n', 'ñ'], ['A', 'Ã'], ['O', 'Õ']]);
  addComposed('^', [['a', 'â'], ['e', 'ê'], ['o', 'ô'], ['A', 'Â'], ['E', 'Ê'], ['O', 'Ô']]);
  addComposed('¨', [['u', 'ü'], ['U', 'Ü']]);
  // o próprio acento sozinho: tecla morta + espaço
  for (const [accent, dead] of Object.entries(DEAD)) {
    COMPOSED[accent] = { accent, letter: ' ', alone: true, name: dead.name };
  }

  // Shift do lado oposto ao da tecla (regra da digitação com 10 dedos).
  function shiftFor(code) {
    return keys[code].hand === 'e' ? 'ShiftRight' : 'ShiftLeft';
  }

  // Passos para digitar `char`: [{ code, shift, shiftCode, dead }]
  function strokesFor(char) {
    if (direct[char]) {
      const { code, shift } = direct[char];
      return [{ code, shift, shiftCode: shift ? shiftFor(code) : null }];
    }
    const comp = COMPOSED[char];
    if (comp) {
      const dead = DEAD[comp.accent];
      const first = { code: dead.code, shift: dead.shift, shiftCode: dead.shift ? shiftFor(dead.code) : null, dead: true };
      const rest = strokesFor(comp.letter);
      return [first, ...rest];
    }
    return null; // caractere que não existe neste teclado
  }

  function accentName(char) {
    const comp = COMPOSED[char];
    return comp ? DEAD[comp.accent].name : null;
  }

  const layout = {
    id: 'abnt2',
    name: 'ABNT2 (padrão brasileiro)',
    rows,
    keys,
    strokesFor,
    accentName,
    canType: (char) => Boolean(strokesFor(char)),
    // teclas que muitos notebooks brasileiros não têm, com a alternativa
    tips: {
      IntlRo: 'Se o seu teclado não tiver essa tecla, use AltGr + Q para / e AltGr + W para ?',
    },
  };

  window.DigitacaoLayouts = window.DigitacaoLayouts || {};
  window.DigitacaoLayouts.abnt2 = layout;
})();
