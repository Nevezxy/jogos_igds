// public/js/shared/dynamic.js
// 🔀 Modo Dinâmico no navegador (PLANO_MODO_DINAMICO.md). O servidor
// (src/platform/dynamic.js) guarda a configuração e escolhe a próxima fase;
// aqui ficam o que as telas de jogo usam:
//   Dinamico.settings()            a configuração ({ on, games, interval }), guardada em memória
//   Dinamico.save(cfg)             salva (POST /dinamico)
//   Dinamico.levelFromParams(ctx)  a fase pedida no link (/jogos/<id>?fase=<id>): o
//                                  jogo abre direto nela, sem o mapa
//   Dinamico.fromDynamic(ctx)      o jogo foi aberto pelo Modo Dinâmico (&dinamico=1)
//   Dinamico.after(ctx, { gameId, levelId, stars, button, fallback })
//                                  depois do resultado: com o modo ligado e a fase
//                                  concluída, transforma o botão "Próxima fase" em
//                                  "Próximo desafio" (de outro jogo) e devolve a sugestão.
//                                  Sem internet ou desligado: não mexe em nada.
//   Dinamico.go(next)              abre a fase sugerida
//   Dinamico.reset(root)           tira o botão do Modo Dinâmico (nova rodada)
//   Dinamico.markIntro(título, on) selo "🔀 Desafio dinâmico" na tela antes da fase
// Na disputa da Maratona (ctx.competition) nada disso age.

(function () {
  let cache = null; // { studentId, promise }

  const studentId = () => {
    const s = window.PlataformaAuth && window.PlataformaAuth.student();
    return s ? s.id : null;
  };

  function settings({ fresh = false } = {}) {
    const id = studentId();
    if (!id) return Promise.resolve({ on: false, games: [], interval: 1 });
    if (fresh || !cache || cache.studentId !== id) {
      const promise = window.PlataformaApi.get('/dinamico')
        .then((r) => ({ ...r.settings, catalog: r.catalog, limits: r.interval }))
        .catch((e) => { if (cache && cache.promise === promise) cache = null; throw e; });
      cache = { studentId: id, promise };
    }
    return cache.promise;
  }

  async function save(cfg) {
    const r = await window.PlataformaApi.post('/dinamico', cfg);
    const old = cache && cache.studentId === studentId() ? await cache.promise.catch(() => ({})) : {};
    const merged = { ...old, ...r.settings };
    cache = { studentId: studentId(), promise: Promise.resolve(merged) };
    return merged;
  }

  const params = (ctx) => (ctx && ctx.params instanceof URLSearchParams ? ctx.params : new URLSearchParams());
  const levelFromParams = (ctx) => (ctx && ctx.competition ? null : params(ctx).get('fase') || null);
  const fromDynamic = (ctx) => !(ctx && ctx.competition) && params(ctx).get('dinamico') === '1';

  const url = (next) => `/jogos/${encodeURIComponent(next.gameId)}?fase=${encodeURIComponent(next.levelId)}&dinamico=1`;

  function go(next) {
    if (!next) return;
    if (window.BingoSound) window.BingoSound.play('whoosh');
    const changed = window.Plataforma && window.Plataforma.currentGameId() !== next.gameId;
    Promise.resolve(window.PlataformaRouter.go(url(next))).then(() => {
      if (changed && window.BingoUI) window.BingoUI.toast(`🔀 Agora é a vez de ${next.gameIcon} ${next.gameName}!`, 'success', 3500);
    });
  }

  // tablet e celular sem teclado de verdade: o servidor não sugere jogos de digitação
  const touchOnly = () => Boolean(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);

  const label = (next) => (next.reason === 'MESMO_JOGO'
    ? `🔀 Próxima: ${next.title} ▶`
    : `🔀 Próximo desafio: ${next.gameIcon} ${next.gameName} · Fase ${next.number} ▶`);

  // o botão "Próxima fase" vira o do Modo Dinâmico (um botão novo no lugar,
  // para não levar junto os cliques do jogo)
  function decorate(button, next) {
    if (!button) return null;
    const btn = button.cloneNode(false);
    btn.removeAttribute('id');
    btn.hidden = false;
    btn.disabled = false;
    btn.classList.add('dyn-next');
    btn.dataset.dynamic = '1';
    btn.textContent = label(next);
    const world = next.worldName && next.worldName !== next.gameName ? `${next.worldIcon ? `${next.worldIcon} ` : ''}${next.worldName} · ` : '';
    btn.title = `${next.gameName}: ${world}${next.title}`;
    btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); go(next); });
    button.hidden = true;
    button.dataset.dynamicHidden = '1';
    button.insertAdjacentElement('afterend', btn);
    return btn;
  }

  // desfaz o que decorate fez (nova rodada na mesma tela)
  function reset(root) {
    if (!root) return;
    root.querySelectorAll('[data-dynamic="1"]').forEach((el) => el.remove());
    root.querySelectorAll('[data-dynamic-hidden="1"]').forEach((el) => { delete el.dataset.dynamicHidden; });
  }

  // selo "🔀 Desafio dinâmico" em cima do título da tela "antes da fase"
  function markIntro(titleEl, on) {
    if (!titleEl) return;
    let badge = titleEl.parentElement.querySelector(':scope > [data-dyn-badge]');
    if (!badge && !on) return;
    if (!badge) {
      badge = document.createElement('p');
      badge.className = 'dyn-badge';
      badge.dataset.dynBadge = '1';
      badge.textContent = '🔀 Desafio dinâmico';
      titleEl.parentElement.insertBefore(badge, titleEl.parentElement.firstElementChild);
    }
    badge.hidden = !on;
  }

  async function after(ctx, { gameId, levelId, stars, button, message }) {
    if (!ctx || ctx.competition || !(stars >= 1) || !button) return null;
    const onResult = () => button.isConnected && !(button.parentElement && button.parentElement.closest('[hidden]'));
    let cfg;
    try { cfg = await settings(); } catch (e) { return null; }
    if (!cfg || !cfg.on) return null;
    let res;
    try {
      res = await window.PlataformaApi.post('/dinamico/proxima', { gameId, levelId, stars, noKeyboard: touchOnly() });
    } catch (e) {
      return null; // sem internet: fica o "Próxima fase" de sempre
    }
    if (!onResult()) return null; // já saiu da tela de resultado
    if (!res.next) {
      if (res.reason === 'TUDO_COMPLETO' && message) message('🏆 Você completou todos os jogos do Modo Dinâmico!');
      return null;
    }
    const btn = decorate(button, res.next);
    if (res.reason === 'MELHORAR' && message) message('🔀 Você já jogou todas as fases! Que tal conquistar 3 ⭐ nesta?');
    if (btn) setTimeout(() => { if (btn.isConnected && !btn.closest('[hidden]')) btn.focus(); }, 120);
    return res.next;
  }

  window.Dinamico = { settings, save, levelFromParams, fromDynamic, after, go, reset, url, markIntro };
})();
