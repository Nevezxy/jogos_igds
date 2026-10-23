// public/js/platform/dinamico.js
// 🔀 Modo Dinâmico no painel: o botão no topo (mostra se está ligado) e o
// modal onde a criança liga ou desliga, escolhe os jogos (pelo menos 2) e o
// intervalo (trocar de jogo a cada N fases). Quem guarda e escolhe as fases
// é o servidor (src/platform/dynamic.js); o resto fica em js/shared/dynamic.js.

(function () {
  const { toast } = window.BingoUI;
  const { play } = window.BingoSound;
  const D = window.Dinamico;

  const $ = (id) => document.getElementById(id);
  const btn = $('hub-dynamic');
  const modal = $('dynamic-modal');
  const list = $('dynamic-games');
  const toggle = $('dynamic-on');
  const intervals = $('dynamic-interval');
  const errorEl = $('dynamic-error');
  const INTERVALS = [1, 2, 3, 4, 5];

  let draft = null; // { on, games: Set, interval }
  let catalog = [];

  function paintButton(cfg) {
    const on = Boolean(cfg && cfg.on);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = on ? '🔀 Dinâmico <b>ligado</b>' : '🔀 Modo Dinâmico';
    btn.title = on
      ? `Modo Dinâmico ligado: troca de jogo a cada ${cfg.interval} fase${cfg.interval === 1 ? '' : 's'}`
      : 'Modo Dinâmico: ao terminar uma fase, vá para outro jogo';
  }

  // estado do botão do painel (chamado quando o painel aparece)
  async function refresh() {
    try {
      const cfg = await D.settings();
      paintButton(cfg);
      return cfg;
    } catch (e) {
      return null;
    }
  }

  const plural = (n) => `${n} fase${n === 1 ? '' : 's'}`;

  function paintToggle() {
    toggle.setAttribute('aria-checked', String(draft.on));
    toggle.classList.toggle('is-on', draft.on);
    toggle.querySelector('[data-label]').textContent = draft.on ? 'Ligado' : 'Desligado';
    modal.querySelector('.dyn-box').classList.toggle('is-off', !draft.on);
  }

  function paintIntervals() {
    intervals.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.n) === draft.interval)));
    $('dynamic-interval-text').textContent = draft.interval === 1
      ? 'Troca de jogo a cada fase concluída.'
      : `Joga ${plural(draft.interval)} no mesmo jogo e depois troca.`;
  }

  function paintCount() {
    const n = draft.games.size;
    $('dynamic-count').textContent = `${n} de ${catalog.length} jogos`;
    list.querySelectorAll('[data-section]').forEach((head) => {
      const ids = catalog.filter((g) => sectionOf(g) === head.dataset.section).map((g) => g.id);
      const all = ids.every((id) => draft.games.has(id));
      const b = head.querySelector('button');
      b.textContent = all ? 'Tirar todos' : 'Marcar todos';
      b.dataset.all = String(all);
    });
  }

  const SUBJECTS = () => (window.PlataformaHub && window.PlataformaHub.SUBJECTS) || [];
  const sectionOf = (g) => (SUBJECTS().some((s) => s.id === g.subject) ? g.subject : 'outros');

  function renderGames() {
    list.innerHTML = '';
    for (const subject of SUBJECTS()) {
      const games = catalog.filter((g) => sectionOf(g) === subject.id);
      if (!games.length) continue;
      const head = document.createElement('div');
      head.className = 'dyn-section';
      head.dataset.section = subject.id;
      const title = document.createElement('span');
      title.textContent = subject.label;
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'btn-mini dyn-all';
      all.addEventListener('click', () => {
        const on = all.dataset.all !== 'true';
        games.forEach((g) => { if (on) draft.games.add(g.id); else draft.games.delete(g.id); });
        list.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.checked = draft.games.has(c.value); });
        errorEl.textContent = '';
        paintCount();
      });
      head.append(title, all);
      list.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'dyn-games';
      for (const g of games) {
        const label = document.createElement('label');
        label.className = 'dyn-game';
        label.style.setProperty('--card', `var(--${g.color || 'violet'})`);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = g.id;
        input.checked = draft.games.has(g.id);
        input.addEventListener('change', () => {
          if (input.checked) draft.games.add(g.id); else draft.games.delete(g.id);
          errorEl.textContent = '';
          paintCount();
        });
        const icon = document.createElement('span');
        icon.className = 'dyn-game-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = g.icon;
        const name = document.createElement('span');
        name.className = 'dyn-game-name';
        name.textContent = g.name;
        label.append(input, icon, name);
        if (g.requiresKeyboard) {
          const kb = document.createElement('small');
          kb.className = 'dyn-game-kb';
          kb.textContent = '⌨️';
          kb.title = 'Precisa de teclado';
          label.appendChild(kb);
        }
        grid.appendChild(label);
      }
      list.appendChild(grid);
    }
  }

  async function open() {
    play('pop');
    let cfg;
    try {
      cfg = await D.settings({ fresh: true });
    } catch (e) {
      toast('Não consegui abrir o Modo Dinâmico 😵 Confira a internet.', 'error');
      return;
    }
    catalog = cfg.catalog || [];
    draft = { on: Boolean(cfg.on), games: new Set(cfg.games || []), interval: cfg.interval || 1 };
    errorEl.textContent = '';
    renderGames();
    paintToggle();
    paintIntervals();
    paintCount();
    modal.hidden = false;
    setTimeout(() => toggle.focus(), 60);
  }

  function close() { modal.hidden = true; btn.focus(); }

  async function saveDraft() {
    if (draft.on && draft.games.size < 2) {
      errorEl.textContent = 'Escolha pelo menos 2 jogos para o Modo Dinâmico.';
      return;
    }
    const saveBtn = $('dynamic-save');
    saveBtn.disabled = true;
    try {
      const cfg = await D.save({ on: draft.on, games: [...draft.games], interval: draft.interval });
      paintButton(cfg);
      modal.hidden = true;
      if (cfg.on) {
        play('start');
        window.BingoFx.sparkleAt(btn, 12);
        toast(`🔀 Modo Dinâmico ligado! Ao terminar ${plural(cfg.interval)}, você vai para outro jogo.`, 'success', 5000);
      } else {
        toast('Modo Dinâmico desligado.', 'info');
      }
      if (window.PlataformaHub) window.PlataformaHub.dynamicChanged(cfg);
    } catch (e) {
      errorEl.textContent = e.message || 'Não deu para salvar.';
    } finally {
      saveBtn.disabled = false;
    }
  }

  // intervalo: 1 a 5
  INTERVALS.forEach((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dyn-interval';
    b.dataset.n = String(n);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', plural(n));
    b.textContent = String(n);
    b.addEventListener('click', () => { draft.interval = n; play('pop'); paintIntervals(); });
    intervals.appendChild(b);
  });
  intervals.addEventListener('keydown', (ev) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    ev.preventDefault();
    const i = INTERVALS.indexOf(draft.interval) + (ev.key === 'ArrowRight' ? 1 : -1);
    draft.interval = INTERVALS[Math.max(0, Math.min(INTERVALS.length - 1, i))];
    paintIntervals();
    intervals.querySelector(`[data-n="${draft.interval}"]`).focus();
  });

  toggle.addEventListener('click', () => { draft.on = !draft.on; play('pop'); errorEl.textContent = ''; paintToggle(); });
  btn.addEventListener('click', open);
  $('dynamic-cancel').addEventListener('click', close);
  $('dynamic-save').addEventListener('click', saveDraft);
  modal.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
  modal.addEventListener('click', (ev) => { if (ev.target === modal) close(); });

  window.PlataformaDinamico = { refresh, open };
})();
