// public/js/shared/mascot.js
// "Bingolino", o mascote: uma bolinha de bingo com carinha, em SVG inline
// (sem arquivos externos). Qualquer elemento com [data-mascot] recebe o
// desenho. O humor é trocado via atributo data-mood, e o CSS
// (components.css) liga/desliga olhos e boca de cada expressão:
//   idle (padrão) · wow (surpreso) · party (comemorando) · sleep (dormindo)

(function () {
  const SVG = `
<svg viewBox="0 0 120 130" aria-hidden="true">
  <ellipse cx="60" cy="122" rx="34" ry="6" fill="rgba(30,18,64,.25)"/>
  <g class="m-body">
    <circle cx="60" cy="64" r="48" fill="#FFD23F" stroke="#1E1240" stroke-width="5"/>
    <path d="M24 84 Q60 112 96 84" fill="none" stroke="#E0A800" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    <ellipse cx="40" cy="36" rx="13" ry="7" fill="#fff" opacity=".7" transform="rotate(-32 40 36)"/>
    <polygon points="92,14 95,23 104,23 97,29 100,38 92,32 84,38 87,29 80,23 89,23" fill="#FF4FA3" stroke="#1E1240" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="33" cy="76" rx="8" ry="5" fill="#FF4FA3" opacity=".6"/>
    <ellipse cx="87" cy="76" rx="8" ry="5" fill="#FF4FA3" opacity=".6"/>

    <g class="m-eyes-open">
      <ellipse cx="46" cy="56" rx="6.5" ry="9.5" fill="#1E1240"/>
      <ellipse cx="74" cy="56" rx="6.5" ry="9.5" fill="#1E1240"/>
      <circle cx="48.5" cy="52" r="2.6" fill="#fff"/>
      <circle cx="76.5" cy="52" r="2.6" fill="#fff"/>
    </g>
    <g class="m-eyes-happy" fill="none" stroke="#1E1240" stroke-width="5" stroke-linecap="round">
      <path d="M38 59 Q46 46 54 59"/>
      <path d="M66 59 Q74 46 82 59"/>
    </g>
    <g class="m-eyes-closed" fill="none" stroke="#1E1240" stroke-width="4.5" stroke-linecap="round">
      <path d="M38 56 Q46 63 54 56"/>
      <path d="M66 56 Q74 63 82 56"/>
    </g>

    <path class="m-mouth-smile" d="M47 77 Q60 91 73 77" fill="none" stroke="#1E1240" stroke-width="5" stroke-linecap="round"/>
    <g class="m-mouth-big">
      <path d="M43 74 Q60 104 77 74 Z" fill="#1E1240" stroke="#1E1240" stroke-width="3" stroke-linejoin="round"/>
      <path d="M51 88 Q60 82 69 88 Q60 98 51 88 Z" fill="#FF4FA3"/>
    </g>
    <ellipse class="m-mouth-o" cx="60" cy="82" rx="6.5" ry="7.5" fill="#1E1240"/>
  </g>
  <g class="m-zzz" font-family="Baloo 2, sans-serif" font-weight="800" fill="#fff" stroke="#1E1240" stroke-width="1.5">
    <text x="92" y="30" font-size="16">z</text>
    <text x="100" y="18" font-size="20">z</text>
    <text x="108" y="6" font-size="24">Z</text>
  </g>
</svg>`;

  function mount(root = document) {
    root.querySelectorAll('[data-mascot]:not([data-mounted])').forEach((el) => {
      el.classList.add('mascot');
      el.innerHTML = SVG;
      el.dataset.mounted = '1';
      if (!el.dataset.mood) el.dataset.mood = 'idle';
    });
  }

  // Troca o humor de um mascote (ou de todos, se nenhum elemento for passado).
  // Com `duration`, o humor é temporário e depois volta ao humor "fixo".
  function setMood(mood, el, duration) {
    const targets = el ? [el] : document.querySelectorAll('.mascot');
    targets.forEach((m) => {
      clearTimeout(m._moodTimer);
      m.dataset.mood = mood;
      if (duration) {
        m._moodTimer = setTimeout(() => { m.dataset.mood = m.dataset.baseMood || 'idle'; }, duration);
      } else {
        m.dataset.baseMood = mood;
      }
    });
  }

  mount();
  window.BingoMascot = { mount, setMood };
})();
