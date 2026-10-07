// public/games/digitacao/hands.js
// As duas mãos vistas de cima, em SVG, com cada dedo na cor das teclas que
// ele aperta. O dedo da vez acende (e o mindinho do Shift, quando precisa).
// Ids dos dedos iguais aos do layout: e5 e4 e3 e2 (mão esquerda, do
// mindinho ao indicador), d2 d3 d4 d5 (mão direita) e p (polegares).

(function () {
  const W = 520;
  // dedos da mão esquerda: [id, x, y, largura, altura]
  const LEFT = [
    ['e5', 58, 52, 26, 72],
    ['e4', 89, 30, 28, 94],
    ['e3', 122, 18, 28, 106],
    ['e2', 155, 32, 28, 92],
  ];
  const NAMES = {
    e5: 'mindinho esquerdo', e4: 'anelar esquerdo', e3: 'dedo médio esquerdo', e2: 'indicador esquerdo',
    d2: 'indicador direito', d3: 'dedo médio direito', d4: 'anelar direito', d5: 'mindinho direito',
    p: 'polegar',
  };
  const mirror = (id) => id.replace('e', 'd');

  function fingerRect(id, x, y, w, h) {
    return `<rect class="hand-finger finger-${id}" data-finger="${id}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}"/>`;
  }

  function svg() {
    const parts = [];
    // palmas
    parts.push('<rect class="hand-palm" x="54" y="96" width="134" height="78" rx="34"/>');
    parts.push(`<rect class="hand-palm" x="${W - 54 - 134}" y="96" width="134" height="78" rx="34"/>`);
    for (const [id, x, y, w, h] of LEFT) {
      parts.push(fingerRect(id, x, y, w, h));
      parts.push(fingerRect(mirror(id), W - x - w, y, w, h));
    }
    // polegares, inclinados para o espaço
    parts.push(`<g transform="rotate(-38 196 150)">${fingerRect('p', 184, 98, 26, 64)}</g>`);
    parts.push(`<g transform="rotate(38 ${W - 196} 150)">${fingerRect('p', W - 184 - 26, 98, 26, 64)}</g>`);
    parts.push(`<text class="hand-label" x="121" y="196">mão esquerda</text>`);
    parts.push(`<text class="hand-label" x="${W - 121}" y="196">mão direita</text>`);
    return `<svg viewBox="0 0 ${W} 204" role="img" aria-label="Mãos no teclado">${parts.join('')}</svg>`;
  }

  function createHands(container) {
    container.innerHTML = svg();
    container.classList.add('hands');

    function highlight(fingerIds = []) {
      container.querySelectorAll('.hand-finger').forEach((el) => {
        el.classList.toggle('is-active', fingerIds.includes(el.dataset.finger));
      });
      container.classList.toggle('has-active', fingerIds.length > 0);
    }

    return { highlight };
  }

  window.DigitacaoHands = { createHands, fingerName: (id) => NAMES[id] || id };
})();
