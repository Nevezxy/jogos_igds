// public/js/shared/puzzleshell.js
// As telas de fora dos jogos de raciocínio (Memória, Hanói, Labirinto, e
// depois os outros), iguais para todos: mapa de fases → antes da fase →
// jogando → resultado, com estrelas, recorde e o envio do resultado ao
// servidor. Cada jogo só cuida da área de jogo:
//   PuzzleShell.create(container, ctx, {
//     id, title, icon, Levels,
//     record: { key: 'bestMoves', label: 'jogadas', lower: true },   recorde da fase
//     rules(level) -> [textos]                                       "como jogar" antes da fase
//     play(level, area, api) -> { destroy(), onKey?(ev) }           monta a fase
//   })
// api (para o jogo): stats(html) mostra os números no cabeçalho;
//   finish({ body, stars, stats: [{ value, label }], msg, record }) termina a
//   fase (body vai para POST /progress/<id>/results); seed: semente da rodada.

(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function template(cfg) {
    return `
    <div class="pz">
      <section class="pz-screen" data-pz="map">
        <div class="pz-map-head">
          <div data-mascot class="pz-mascot"></div>
          <p class="speech" data-pz-speech aria-live="polite"></p>
          <div class="pz-stars-total" title="Estrelas conquistadas">⭐ <strong data-pz-stars>0</strong><span class="pz-stars-max">/${cfg.Levels.MAX_STARS}</span></div>
        </div>
        <div class="pz-toolbar"><button type="button" class="btn btn-primary btn-lg" data-pz-continue>▶ Continuar</button></div>
        <div data-pz-worlds></div>
      </section>

      <section class="pz-screen" data-pz="intro" hidden>
        <div class="pz-card">
          <p class="pz-intro-world" data-pz-intro-world></p>
          <h3 class="pz-intro-title" data-pz-intro-title></h3>
          <p class="pz-intro-text" data-pz-intro-text></p>
          <p class="pz-intro-tip" data-pz-intro-tip></p>
          <p class="cad-record" data-pz-intro-record hidden></p>
          <ul class="pz-intro-rules" data-pz-intro-rules></ul>
          <div class="pz-actions">
            <button type="button" class="btn btn-ghost" data-pz-go-map>← Mapa</button>
            <button type="button" class="btn btn-success btn-lg" data-pz-start>Começar!</button>
          </div>
        </div>
      </section>

      <section class="pz-screen" data-pz="play" hidden>
        <div class="pz-play-head">
          <button type="button" class="btn-mini" data-pz-quit>✕ Sair</button>
          <strong class="pz-play-title" data-pz-play-title></strong>
          <div class="pz-stats" data-pz-stats></div>
          <button type="button" class="btn-mini" data-pz-restart title="Recomeçar a fase">↺ Recomeçar</button>
        </div>
        <div class="pz-area" data-pz-area></div>
      </section>

      <section class="pz-screen" data-pz="result" hidden>
        <div class="pz-card">
          <div class="pz-result-stars" aria-hidden="true"><span>★</span><span>★</span><span>★</span></div>
          <h3 class="pz-result-title" data-pz-result-title></h3>
          <p class="pz-result-msg" data-pz-result-msg></p>
          <p class="cad-record" data-pz-record></p>
          <div class="pz-result-stats" data-pz-result-stats></div>
          <div class="pz-actions">
            <button type="button" class="btn btn-ghost" data-pz-go-map>🗺️ Mapa</button>
            <button type="button" class="btn btn-violet" data-pz-retry>🔁 Jogar de novo</button>
            <button type="button" class="btn btn-success" data-pz-next>Próxima fase ▶</button>
          </div>
        </div>
      </section>
    </div>`;
  }

  function create(container, ctx, cfg) {
    const { sound, fx, ui } = ctx;
    container.insertAdjacentHTML('beforeend', template(cfg));
    const root = container.querySelector('.pz');
    const $ = (sel) => root.querySelector(sel);
    const $$ = (sel) => [...root.querySelectorAll(sel)];
    const screens = $$('[data-pz]');
    const { Levels } = cfg;

    let progress = { levels: {} };
    let screen = 'map';
    let current = null;
    let run = null; // { level, ctrl, ended }
    let destroyed = false;

    function show(name) {
      screen = name;
      screens.forEach((el) => { el.hidden = el.dataset.pz !== name; });
      window.scrollTo({ top: 0 });
    }
    const levelData = (id) => (progress.levels && progress.levels[id]) || {};
    const bestOf = (id) => (cfg.record ? levelData(id)[cfg.record.key] : null);

    function renderMap() {
      const total = Levels.totalStars(progress);
      $('[data-pz-stars]').textContent = total;
      const next = Levels.nextLevel(progress);
      const first = ctx.student ? ctx.student.firstName : '';
      $('[data-pz-speech]').textContent = total === 0
        ? `Oi, ${first}! ${cfg.hello || 'Vamos pensar juntos?'} ${cfg.icon}`
        : next ? `Você já tem ${total} ⭐! A próxima fase está piscando em amarelo 💪` : `Uau, ${first}! Você fez todas as fases! 🏆`;
      const cont = $('[data-pz-continue]');
      cont.textContent = next ? `▶ Continuar: ${next.title}` : '🏆 Jogar de novo a primeira fase';
      cont.dataset.level = next ? next.id : Levels.LEVELS[0].id;
      window.LevelMap.render($('[data-pz-worlds]'), {
        worlds: Levels.WORLDS,
        storageKey: `pz_map_${cfg.id}`,
        nextId: next ? next.id : null,
        stateOf: (level) => ({ stars: levelData(level.id).stars || 0, plays: levelData(level.id).plays || 0 }),
        onPick: (level) => { sound.play('pop'); openIntro(level); },
      });
    }

    function openIntro(level) {
      current = level;
      const world = Levels.getWorld(level.world);
      $('[data-pz-intro-world]').textContent = `${world.icon} ${world.name} · fase ${level.indexInWorld + 1} de ${world.levels.length}`;
      $('[data-pz-intro-title]').textContent = level.title;
      $('[data-pz-intro-text]').textContent = level.indexInWorld === 0 ? world.intro : '';
      $('[data-pz-intro-tip]').textContent = level.tip ? `💡 ${level.tip}` : '';
      $('[data-pz-intro-tip]').hidden = !level.tip;
      const best = bestOf(level.id);
      $('[data-pz-intro-record]').hidden = !best;
      $('[data-pz-intro-record]').textContent = best ? `🏆 Seu recorde: ${best} ${cfg.record.label}. Consegue ${cfg.record.lower ? 'fazer com menos' : 'bater'}?` : '';
      $('[data-pz-intro-rules]').innerHTML = (cfg.rules ? cfg.rules(level) : []).map((t) => `<li>${esc(t)}</li>`).join('');
      show('intro');
      setTimeout(() => $('[data-pz-start]').focus(), 60);
    }

    function start(level) {
      stop();
      current = level;
      const world = Levels.getWorld(level.world);
      $('[data-pz-play-title]').textContent = `${world.icon} ${level.title}`;
      $('[data-pz-stats]').innerHTML = '';
      const area = $('[data-pz-area]');
      area.innerHTML = '';
      area.className = `pz-area pz-area-${cfg.id}`;
      show('play');
      const seed = window.SeededRng.randomSeed();
      const r = { level, seed, ended: false, startedAt: Date.now() };
      run = r;
      r.ctrl = cfg.play(level, area, {
        seed,
        sound,
        fx,
        ui,
        student: ctx.student,
        stats(html) { if (run === r) $('[data-pz-stats]').innerHTML = html; },
        finish(res) { if (run === r && !r.ended) finish(r, res); },
        elapsed: () => Date.now() - r.startedAt,
      }) || {};
    }

    function stop() {
      if (run && run.ctrl && run.ctrl.destroy) run.ctrl.destroy();
      run = null;
    }

    async function finish(r, res) {
      r.ended = true;
      const prevBest = bestOf(r.level.id);
      setTimeout(() => { if (run === r) showResult(r, res, prevBest); }, res.delay != null ? res.delay : 700);
      try {
        const out = await ctx.api.post(`/progress/${cfg.id}/results`, { levelId: r.level.id, seed: r.seed, durationMs: Date.now() - r.startedAt, ...res.body });
        progress = out.progress;
      } catch (e) {
        if (e.queued) ui.toast(e.message, 'info', 6000);
        else ui.toast('Não consegui salvar o seu resultado 😵 Confira a internet.', 'error', 5000);
      }
    }

    function showResult(r, res, prevBest) {
      show('result');
      const stars = res.stars || 0;
      const starEls = $$('.pz-result-stars span');
      starEls.forEach((el) => el.classList.remove('is-on'));
      starEls.forEach((el, i) => { if (i < stars) setTimeout(() => { el.classList.add('is-on'); sound.play('ding'); }, 300 + i * 360); });
      $('[data-pz-result-title]').textContent = res.title || ['Quase lá!', 'Muito bem!', 'Excelente!', 'Perfeito!'][stars];
      $('[data-pz-result-msg]').textContent = res.msg || '';
      $('[data-pz-result-stats]').innerHTML = (res.stats || []).map((s) => `<div><b>${esc(s.value)}</b><small>${esc(s.label)}</small></div>`).join('');
      const rec = $('[data-pz-record]');
      const value = res.record;
      const beat = cfg.record && value != null && stars >= 1 && (!prevBest || (cfg.record.lower ? value < prevBest : value > prevBest));
      rec.classList.toggle('is-new', Boolean(beat));
      rec.textContent = !cfg.record || value == null ? '' : beat
        ? (prevBest ? `🏆 Novo recorde: ${value} ${cfg.record.label} (antes: ${prevBest})` : '🏆 Primeiro recorde desta fase!')
        : prevBest ? `Seu recorde nesta fase: ${prevBest} ${cfg.record.label}` : '';
      const next = Levels.LEVELS[r.level.index + 1];
      $('[data-pz-next]').hidden = !next;
      if (stars >= 1) { fx.confetti({ amount: 40 + stars * 50 }); sound.play(stars === 3 ? 'fanfare' : 'tada'); }
      setTimeout(() => $(stars >= 1 && next ? '[data-pz-next]' : '[data-pz-retry]').focus(), 80);
    }

    async function quit() {
      if (run && !run.ended && Date.now() - run.startedAt > 3000) {
        const ok = await ui.confirmModal('Sair da fase?', 'O que você fez nesta fase não vai contar.', 'Sair');
        if (!ok) return;
      }
      stop();
      show('map');
      renderMap();
    }

    $('[data-pz-continue]').addEventListener('click', () => { sound.play('pop'); openIntro(Levels.getLevel($('[data-pz-continue]').dataset.level)); });
    $('[data-pz-start]').addEventListener('click', () => start(current));
    $('[data-pz-quit]').addEventListener('click', quit);
    $('[data-pz-restart]').addEventListener('click', () => { if (current) { sound.play('whoosh'); start(current); } });
    $('[data-pz-retry]').addEventListener('click', () => start(current));
    $('[data-pz-next]').addEventListener('click', () => {
      const next = Levels.LEVELS[current.index + 1];
      if (next) openIntro(next);
    });
    $$('[data-pz-go-map]').forEach((b) => b.addEventListener('click', () => { stop(); show('map'); renderMap(); }));

    function onKeydown(ev) {
      if (screen === 'intro' && ev.key === 'Enter' && !ev.target.closest('button')) { ev.preventDefault(); start(current); return; }
      if (screen === 'play' && run && !run.ended && run.ctrl.onKey) run.ctrl.onKey(ev);
    }
    document.addEventListener('keydown', onKeydown);

    async function load() {
      try {
        const res = await ctx.api.get(`/progress/${cfg.id}`);
        progress = res.progress || { levels: {} };
      } catch (e) {
        ui.toast('Não consegui carregar o seu progresso 😵', 'error');
      }
      if (destroyed) return;
      show('map');
      renderMap();
    }

    function destroy() {
      destroyed = true;
      stop();
      document.removeEventListener('keydown', onKeydown);
    }

    return { load, destroy };
  }

  window.PuzzleShell = { create };
})();
