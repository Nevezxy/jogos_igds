// public/games/dinheiro/game.js
// 💰 Dinheiro e Troco: a mesa (o que contar ou o que comprar), o balcão
// (o dinheiro que a criança entrega) e a carteira (toque numa nota ou moeda
// para pôr no balcão; toque no balcão para tirar). Cada fase é uma rodada de
// tarefas; errou, ganha uma dica e mais uma tentativa. As telas de fora são
// as de todos os jogos de raciocínio (js/shared/puzzleshell.js).

(function () {
  const Levels = window.DinheiroLevels;
  const Money = window.DinheiroMoney;
  const { fmt, MONEY } = Money;

  function pieceHtml(cents, extra = '') {
    const m = MONEY[cents];
    if (m.kind === 'coin') return `<span class="dn-coin is-${m.color}" title="${m.name}" ${extra}><b>${m.label}</b></span>`;
    return `<span class="dn-note" style="--note:${m.color}" title="${m.name}" ${extra}><i>${m.animal}</i><b>${m.label}</b></span>`;
  }

  function play(level, area, api) {
    const tasks = Money.makeRound(level, api.seed);
    const answers = []; // por tarefa: [tentativa 1, tentativa 2?]
    let i = 0;
    let given = [];
    let tries = [];
    let score = 0;
    let waiting = false;
    let ended = false;

    area.innerHTML = `
      <div class="dn">
        <div class="dn-dots" aria-label="Tarefas da rodada">${tasks.map(() => '<span class="dn-dot"></span>').join('')}</div>
        <div class="dn-task"></div>
        <div class="dn-counter-wrap">
          <div class="dn-counter-head"><strong data-counter-title>🧾 Balcão</strong><span data-counter-total></span></div>
          <div class="dn-counter" data-counter aria-live="polite"></div>
        </div>
        <div class="dn-wallet" data-wallet></div>
        <p class="dn-feedback" data-feedback aria-live="assertive"></p>
        <div class="dn-actions">
          <button type="button" class="btn btn-ghost" data-clear>🧹 Limpar</button>
          <button type="button" class="btn btn-success btn-lg" data-ok>Pagar ✓</button>
          <button type="button" class="btn btn-primary" data-next hidden>Continuar ▶</button>
        </div>
      </div>`;
    const $ = (s) => area.querySelector(s);
    const dots = [...area.querySelectorAll('.dn-dot')];

    // a carteira: as notas e moedas da fase (quantas quiser)
    $('[data-wallet]').innerHTML = level.money.slice().sort((a, b) => b - a)
      .map((c) => `<button type="button" class="dn-pick" data-cents="${c}" aria-label="Pôr ${MONEY[c].name}">${pieceHtml(c)}</button>`).join('');
    $('[data-wallet]').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-cents]');
      if (!b || waiting || ended || tasks[i].type === 'count') return;
      if (given.length >= 40) return;
      given.push(Number(b.dataset.cents));
      api.sound.play('click');
      renderCounter(true);
    });
    $('[data-counter]').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-idx]');
      if (!b || waiting || ended) return;
      given.splice(Number(b.dataset.idx), 1);
      api.sound.play('pop');
      renderCounter();
    });
    $('[data-clear]').addEventListener('click', () => { if (!waiting) { given = []; renderCounter(); } });
    $('[data-ok]').addEventListener('click', () => submit(given.slice()));
    $('[data-next]').addEventListener('click', () => next());

    function renderCounter(bump) {
      const t = tasks[i];
      const sorted = given.map((c, idx) => ({ c, idx })).sort((a, b) => b.c - a.c);
      $('[data-counter]').innerHTML = sorted.length
        ? sorted.map(({ c, idx }) => `<button type="button" class="dn-given" data-idx="${idx}" aria-label="Tirar ${MONEY[c].name}">${pieceHtml(c)}</button>`).join('')
        : '<span class="dn-empty">Toque nas notas e moedas lá embaixo para colocar aqui.</span>';
      if (bump) { const last = $('[data-counter]').querySelector(`[data-idx="${given.length - 1}"]`); if (last) last.classList.add('is-new'); }
      const showTotal = !t.hideTotal;
      $('[data-counter-total]').textContent = showTotal ? `${t.type === 'change' ? 'troco' : 'no balcão'}: ${fmt(Money.sum(given))}${given.length ? ` · ${given.length} ${given.length === 1 ? 'peça' : 'peças'}` : ''}` : `${given.length} ${given.length === 1 ? 'peça' : 'peças'}`;
    }

    function itemsHtml(t) {
      return `<div class="dn-items">${t.items.map((it) => `<div class="dn-item"><span class="dn-item-emoji">${it.emoji}</span><span>${it.name}</span><b class="dn-tag">${fmt(it.price)}</b></div>`).join('')}</div>`;
    }

    function show() {
      const t = tasks[i];
      given = [];
      tries = [];
      waiting = false;
      dots.forEach((d, k) => d.classList.toggle('is-current', k === i));
      $('[data-feedback]').textContent = '';
      $('[data-feedback]').className = 'dn-feedback';
      $('[data-next]').hidden = true;
      const many = t.items && t.items.length > 1;
      let html;
      if (t.type === 'count') {
        html = `<h3>Quanto dinheiro tem aqui?</h3>
          <div class="dn-table">${t.pieces.map((c) => pieceHtml(c)).join('')}</div>
          <div class="dn-options">${t.options.map((v) => `<button type="button" class="dn-option" data-value="${v}">${fmt(v)}</button>`).join('')}</div>`;
      } else if (t.type === 'change') {
        html = `<h3>${many ? 'Some a compra e devolva o troco' : 'Devolva o troco'}</h3>${itemsHtml(t)}
          <p class="dn-paid">O cliente pagou com ${pieceHtml(t.paid)}</p>`;
      } else {
        html = `<h3>${t.type === 'fewest' ? 'Pague com o menor número de notas e moedas' : many ? 'Some as compras e pague o valor exato' : 'Pague o valor exato'}</h3>${itemsHtml(t)}
          ${many ? '' : `<p class="dn-price">Preço: <b>${fmt(t.price)}</b></p>`}`;
      }
      $('.dn-task').innerHTML = html;
      $('.dn-task').querySelectorAll('[data-value]').forEach((b) => b.addEventListener('click', () => submit(Number(b.dataset.value))));
      const isCount = t.type === 'count';
      $('.dn-counter-wrap').hidden = isCount;
      $('[data-wallet]').hidden = isCount;
      $('[data-clear]').hidden = isCount;
      $('[data-ok]').hidden = isCount;
      $('[data-ok]').textContent = t.type === 'change' ? 'Dar o troco ✓' : 'Pagar ✓';
      $('[data-counter-title]').textContent = t.type === 'change' ? '🧾 Troco' : '🧾 Balcão';
      if (!isCount) renderCounter();
      api.stats(`<span title="Tarefa">📋 <b>${i + 1}/${tasks.length}</b></span><span title="Pontos">⭐ <b>${score}</b></span>`);
    }

    const HINT = {
      more: 'Passou! Tire um pouco de dinheiro.',
      less: 'Ainda falta dinheiro.',
      many: 'O valor está certo, mas dá para usar menos notas e moedas. Troque as pequenas por uma maior!',
    };

    function submit(answer) {
      if (waiting || ended) return;
      const t = tasks[i];
      if (t.type !== 'count' && !answer.length) { window.BingoFx.shake($('[data-counter]')); return; }
      tries.push(answer);
      const res = Money.check(t, answer, level.money);
      if (res.ok) {
        const first = tries.length === 1;
        score += first ? 1 : 0.5;
        dots[i].classList.add(first ? 'is-right' : 'is-second');
        api.sound.play('ding');
        const box = $('.dn-task').getBoundingClientRect();
        api.fx.confetti({ amount: 26, origin: { x: box.left + box.width / 2, y: box.top + 40 }, power: 0.5 });
        $('[data-feedback]').textContent = first ? 'Certinho! 🎉' : 'Isso! Na segunda tentativa 👍';
        $('[data-feedback]').className = 'dn-feedback is-right';
        waiting = true;
        answers.push(tries);
        setTimeout(() => { if (!ended) next(); }, 900);
        return;
      }
      api.sound.play('bonk');
      window.BingoFx.shake(t.type === 'count' ? $('.dn-options') : $('[data-counter]'));
      if (tries.length === 1) {
        const total = t.type === 'count' ? null : Money.sum(answer);
        $('[data-feedback]').textContent = t.type === 'count'
          ? '💡 Conte de novo: comece pela nota (ou moeda) maior e vá somando.'
          : `💡 ${HINT[res.why] || 'Confira de novo.'}${total !== null && !t.hideTotal ? ` Você deu ${fmt(total)}.` : ''}`;
        $('[data-feedback]').className = 'dn-feedback is-hint';
        if (t.type === 'count') $('.dn-task').querySelector(`[data-value="${answer}"]`)?.setAttribute('disabled', '');
        return;
      }
      // 2º erro: mostra um jeito certo e espera "Continuar"
      dots[i].classList.add('is-wrong');
      answers.push(tries);
      waiting = true;
      const want = t.type === 'count' ? t.total : t.type === 'change' ? t.change : t.price;
      const way = t.type === 'count' ? '' : ` Um jeito: ${Money.fewest(want, level.money).map((c) => MONEY[c].label).join(' + ')}.`;
      $('[data-feedback]').textContent = `A resposta certa é ${fmt(want)}.${way}`;
      $('[data-feedback]').className = 'dn-feedback is-solution';
      $('[data-next]').hidden = false;
      $('[data-ok]').hidden = true;
    }

    function next() {
      i++;
      if (i >= tasks.length) { end(); return; }
      show();
    }

    function end() {
      ended = true;
      const stars = Levels.starsFor(level, { score, count: tasks.length });
      const first = answers.filter((a) => a.length === 1).length;
      api.finish({
        body: { answers },
        stars,
        record: null,
        msg: stars === 3 ? 'Você é fera com dinheiro! 💰' : stars >= 1 ? 'Muito bem! Repita para ganhar mais estrelas.' : 'Vamos tentar de novo? Conte com calma, nota por nota.',
        stats: [{ value: `${first}/${tasks.length}`, label: '✅ de primeira' }, { value: score, label: '⭐ pontos' }, { value: `${Math.round(api.elapsed() / 1000)} s`, label: '⏱ tempo' }],
      });
    }

    show();
    return {
      onKey(ev) {
        if (ev.key === 'Enter' && !waiting && tasks[i].type !== 'count') { ev.preventDefault(); submit(given.slice()); }
        else if (ev.key === 'Enter' && !$('[data-next]').hidden) { ev.preventDefault(); next(); }
      },
      destroy() { ended = true; },
    };
  }

  let shell = null;
  window.Plataforma.registerGame('dinheiro', {
    async mount(container, ctx) {
      shell = window.PuzzleShell.create(container, ctx, {
        id: 'dinheiro',
        title: 'Dinheiro e Troco',
        icon: '💰',
        hello: 'Vamos às compras? Conte o dinheiro, pague certinho e dê o troco!',
        Levels,
        rules: (level) => [
          level.task === 'count' ? '🪙 Conte o dinheiro da mesa e toque no valor certo.' : '👆 Toque numa nota ou moeda para pôr no balcão. Toque no balcão para tirar.',
          ...(level.task === 'fewest' ? ['🧮 Use o menor número de notas e moedas.'] : []),
          ...(level.task === 'change' ? ['💸 Devolva a diferença entre o que o cliente pagou e o preço.'] : []),
          ...(level.items > 1 ? ['🧾 Some os preços de tudo antes de pagar.'] : []),
          ...(level.hideTotal ? ['🙈 O balcão não mostra o total: faça a conta de cabeça.'] : []),
          '✅ Errou? Ganha uma dica e mais uma tentativa.',
        ],
        play,
      });
      ctx.mascot.mount(container);
      await shell.load();
    },
    unmount() { if (shell) shell.destroy(); shell = null; },
  });
})();
