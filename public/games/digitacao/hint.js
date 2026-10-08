// public/games/digitacao/hint.js
// A dica da próxima tecla, usada pelo Teclado Mágico e pelo Desafio de
// digitação: qual tecla destacar (e o Shift do lado oposto), quais dedos
// acender e o texto ("Segure o Shift direito... e aperte F com o indicador
// esquerdo."). Entende os acentos em dois passos e o Caps Lock ligado.

(function () {
  const SHIFT_FINGER = { ShiftLeft: 'e5', ShiftRight: 'd5' };

  // Nome da tecla para a dica: letras em maiúscula, espaço por extenso.
  function keyName(layout, code) {
    const key = layout.keys[code];
    if (code === 'Space') return 'ESPAÇO';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    if (/^Key/.test(code) || code === 'Semicolon') return key.shift;
    return key.base;
  }

  // `deadArmed`: o acento já foi apertado (falta a letra).
  // `capsOn`: Caps Lock ligado (letra maiúscula sai sem Shift).
  // Devolve null se o caractere não existe no teclado.
  function describe(layout, ch, { deadArmed = false, capsOn = false, fingerName = (id) => id } = {}) {
    const strokes = ch ? layout.strokesFor(ch) : null;
    if (!strokes) return null;
    const step = deadArmed && strokes[0].dead && strokes.length > 1 ? 1 : 0;
    let stroke = strokes[step];
    const key = layout.keys[stroke.code];
    const isLetterKey = /^Key/.test(stroke.code) || stroke.code === 'Semicolon';
    const byCaps = capsOn && stroke.shift && isLetterKey;
    if (byCaps) stroke = { ...stroke, shift: false, shiftCode: null };

    const fingers = [key.fingerId];
    if (stroke.shiftCode) fingers.push(SHIFT_FINGER[stroke.shiftCode]);

    const finger = fingerName(key.fingerId);
    const side = stroke.shiftCode === 'ShiftLeft' ? 'esquerdo' : 'direito';
    const shiftPart = stroke.shiftCode ? `Segure o Shift ${side} (mindinho ${side}) e ` : '';
    let text;
    if (strokes[0].dead && step === 0) {
      const accent = layout.accentName(ch) || 'acento';
      const letter = strokes.length > 1 ? keyName(layout, strokes[1].code) : '';
      const then = strokes[1] && strokes[1].code === 'Space' ? 'Depois aperte o ESPAÇO.' : `Depois aperte ${letter}.`;
      const symbol = stroke.shift ? key.shift : key.base;
      text = `✨ ${accent[0].toUpperCase() + accent.slice(1)}: ${shiftPart ? shiftPart.toLowerCase() : ''}aperte a tecla ${symbol} com o ${finger} e solte. ${then}`;
    } else if (stroke.code === 'Space') {
      text = 'Aperte o ESPAÇO com o polegar.';
    } else {
      text = `${shiftPart}${shiftPart ? 'a' : 'A'}perte ${keyName(layout, stroke.code)} com o ${finger}.`;
    }
    if (byCaps) text = `⇪ Caps Lock ligado: ${text[0].toLowerCase()}${text.slice(1)}`;
    if (layout.tips[stroke.code]) text += ` (${layout.tips[stroke.code]})`;
    return { stroke, fingers, text };
  }

  window.DigitacaoHint = { describe, keyName };
})();
