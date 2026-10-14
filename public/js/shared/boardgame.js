// public/js/shared/boardgame.js
// A parte de fora dos jogos de tabuleiro (Velha, Ligue 4, e depois Dama e
// Xadrez), igual para todos. Cada jogo só entrega as regras, as fases e o
// desenho do tabuleiro:
//   BoardGame.create(container, ctx, {
//     id, title, Rules, rulesName, rulesUrl, Levels,
//     seats: [{ name: 'Vermelho', icon: '🔴' }, { ... }],
//     makeBoard(el, variant) -> { render(state, { canPlay, onMove, mySeat, hints }), destroy() },
//     hints?(state, seat) -> o que destacar (ex.: ameaças do adversário)
//   })
// Telas: mapa (robôs por variante + "contra um amigo") → espera (procurando
// adversário, ou o código da sala com QR Code) → partida → resultado.
//   🤖 contra o robô: o robô pensa num Web Worker (bot-worker.js); quem
//      começa alterna a cada partida; desfazer só nos níveis fáceis; no fim
//      o resultado vai para o servidor, que refaz a partida e dá as estrelas
//   👫 contra um amigo: pela rede (src/platform/match.js), com código de sala
//      ou pareamento automático; o servidor confere cada lance; se a conexão
//      cair, a partida é retomada sozinha (até 60 s)

(function () {
  const MIN_THINK_MS = 450; // o robô "pensa" pelo menos isso (fica mais natural)
  const MATCH_KEY = 'bg_partida_v1';

  // ---------------- o robô (Web Worker, com plano B sem worker) ----------------
  let worker = null;
  let workerFailed = false;
  let seq = 0;
  const pending = new Map();
  function getWorker() {
    if (worker || workerFailed || typeof Worker === 'undefined') return worker;
    try {
      worker = new Worker('/js/shared/bot-worker.js');
      worker.onmessage = (ev) => {
        const p = pending.get(ev.data.id);
        if (!p) return;
        pending.delete(ev.data.id);
        if (ev.data.error) p.reject(new Error(ev.data.error)); else p.resolve(ev.data.move);
      };
      worker.onerror = () => { workerFailed = true; worker = null; pending.forEach((p) => p.reject(new Error('worker'))); pending.clear(); };
    } catch (e) {
      workerFailed = true;
    }
    return worker;
  }
  function loadBotScript() {
    if (window.BoardBot) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/js/shared/bot.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function think(cfg, state, level) {
    const started = Date.now();
    let move;
    const w = getWorker();
    try {
      if (!w) throw new Error('sem worker');
      move = await new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        w.postMessage({ id, rulesUrl: cfg.rulesUrl, rulesName: cfg.rulesName, state, level });
      });
    } catch (e) {
      // sem Web Worker: pensa aqui mesmo, com um tempo menor
      await loadBotScript();
      move = window.BoardBot.search(cfg.Rules, state, { ...level, maxMs: Math.min(level.maxMs || 1500, 800) }).move;
    }
    const wait = MIN_THINK_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return move;
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function template(cfg) {
    return `
    <div class="bgm">
      <section class="bgm-screen" data-bgm="map">
        <div class="bgm-map-head">
          <div data-mascot class="bgm-mascot"></div>
          <p class="speech" data-bgm-speech aria-live="polite"></p>
          <div class="bgm-stars-total" title="Estrelas conquistadas">⭐ <strong data-bgm-stars>0</strong><span class="bgm-stars-max">/${cfg.Levels.MAX_STARS}</span></div>
        </div>
        <div class="bgm-friend">
          <h3>👫 Jogar com um amigo</h3>
          <p class="muted">Cada um no seu aparelho, pela internet da escola.</p>
          <div class="bgm-friend-row">
            ${cfg.Levels.variants().length > 1 ? `<label class="bgm-variant">Tabuleiro:
              <select data-bgm-variant>${cfg.Levels.variants().map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('')}</select></label>` : ''}
            <button type="button" class="btn btn-primary" data-bgm-queue>🎲 Procurar adversário</button>
            <button type="button" class="btn btn-violet" data-bgm-create>🔑 Criar sala com código</button>
          </div>
          <form class="bgm-join" data-bgm-join>
            <label>Tem um código? <input type="text" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" data-bgm-code aria-label="Código da sala" /></label>
            <button type="submit" class="btn btn-success">Entrar ▶</button>
          </form>
        </div>
        <h3 class="bgm-bot-title">🤖 Contra o computador</h3>
        <div data-bgm-worlds></div>
      </section>

      <section class="bgm-screen" data-bgm="wait" hidden>
        <div class="bgm-card">
          <div data-bgm-wait-search>
            <div class="bgm-spinner" aria-hidden="true"></div>
            <h3>Procurando adversário...</h3>
            <p class="muted">Assim que outra pessoa procurar partida neste jogo, vocês começam. Primeiro a gente procura alguém da sua turma.</p>
          </div>
          <div data-bgm-wait-code hidden>
            <h3>🔑 Código da sala</h3>
            <p class="bgm-code" data-bgm-code-text>----</p>
            <img class="bgm-qr" data-bgm-qr alt="QR Code da sala" width="160" height="160" />
            <p class="muted">Passe o código para o seu amigo digitar em "Tem um código?", ou ele aponta a câmera para o QR Code. Esperando ele entrar...</p>
          </div>
          <button type="button" class="btn btn-ghost" data-bgm-cancel>✕ Cancelar</button>
        </div>
      </section>

      <section class="bgm-screen" data-bgm="play" hidden>
        <div class="bgm-play-head">
          <button type="button" class="btn-mini" data-bgm-quit>✕ Sair</button>
          <strong class="bgm-play-title" data-bgm-play-title></strong>
        </div>
        <div class="bgm-players">
          <div class="bgm-player" data-seat="0"></div>
          <span class="bgm-vs">×</span>
          <div class="bgm-player" data-seat="1"></div>
        </div>
        <p class="bgm-status" data-bgm-status aria-live="polite"></p>
        <div class="bgm-draw-offer" data-bgm-offer hidden>
          <span>🤝 O adversário propôs empate.</span>
          <button type="button" class="btn-mini" data-bgm-offer-yes>Aceitar</button>
          <button type="button" class="btn-mini" data-bgm-offer-no>Recusar</button>
        </div>
        <div class="bgm-board-wrap"><div class="bgm-board" data-bgm-board></div>
          <div class="bgm-result" data-bgm-result hidden>
            <div class="bgm-result-card">
              <div class="bgm-result-icon" data-bgm-result-icon></div>
              <h3 data-bgm-result-title></h3>
              <div class="bgm-result-stars" data-bgm-result-stars aria-hidden="true"><span>★</span><span>★</span><span>★</span></div>
              <p data-bgm-result-msg></p>
              <div class="bgm-result-actions">
                <button type="button" class="btn btn-ghost" data-bgm-go-map>🗺️ Mapa</button>
                <button type="button" class="btn btn-violet" data-bgm-again>🔁 Jogar de novo</button>
                <button type="button" class="btn btn-success" data-bgm-next>Próximo robô ▶</button>
              </div>
            </div>
          </div>
        </div>
        <div class="bgm-actions">
          <button type="button" class="btn-mini" data-bgm-undo>↶ Desfazer</button>
          ${cfg.hintLabel ? `<label class="bgm-hint-toggle"><input type="checkbox" data-bgm-hints /> ${esc(cfg.hintLabel)}</label>` : ''}
          <button type="button" class="btn-mini" data-bgm-draw>🤝 Propor empate</button>
          <button type="button" class="btn-mini" data-bgm-resign>🏳️ Desistir</button>
        </div>
      </section>
    </div>`;
  }

  function create(container, ctx, cfg) {
    const { sound, fx, ui } = ctx;
    container.insertAdjacentHTML('beforeend', template(cfg));
    const root = container.querySelector('.bgm');
    const $ = (sel) => root.querySelector(sel);
    const screens = [...root.querySelectorAll('[data-bgm]')];
    const { Rules, Levels } = cfg;
    const socketApi = window.BingoSocket;

    let progress = { levels: {} };
    let screen = 'map';
    let destroyed = false;
    let board = null; // desenho do tabuleiro (do jogo)
    let game = null; // partida atual
    let gamesStarted = 0;
    let hintsOn = false;
    try { hintsOn = localStorage.getItem(`bg_hints_${cfg.id}`) === '1'; } catch (e) { /* ignore */ }

    function show(name) {
      screen = name;
      screens.forEach((el) => { el.hidden = el.dataset.bgm !== name; });
      window.scrollTo({ top: 0 });
    }
    const levelData = (id) => (progress.levels && progress.levels[id]) || {};
    const me = () => ctx.student || { firstName: 'Você', avatar: '🙂', name: 'Você' };

    // ---------------- mapa ----------------
    function renderMap() {
      const total = Levels.totalStars(progress);
      $('[data-bgm-stars]').textContent = total;
      const next = Levels.nextLevel(progress);
      const f = progress.friend || { wins: 0, draws: 0, losses: 0 };
      const played = f.wins + f.draws + f.losses;
      $('[data-bgm-speech]').textContent = total === 0
        ? `Oi, ${me().firstName}! Desafie os robôs, um mais esperto que o outro, ou jogue com um amigo! ${cfg.icon}`
        : next ? `Você já tem ${total} ⭐!${played ? ` Contra amigos: ${f.wins} vitória(s), ${f.draws} empate(s), ${f.losses} derrota(s).` : ''} O próximo robô está piscando em amarelo 💪`
          : `Uau! Você venceu todos os robôs! 🏆 Agora desafie os seus amigos.`;
      window.LevelMap.render($('[data-bgm-worlds]'), {
        worlds: Levels.WORLDS,
        storageKey: `bg_map_${cfg.id}`,
        nextId: next ? next.id : null,
        worldLabel: (w) => w.name,
        stateOf: (level) => ({ stars: levelData(level.id).stars || 0, plays: levelData(level.id).plays || 0 }),
        onPick: (level) => { sound.play('pop'); startBot(level); },
      });
    }

    // ---------------- partida (comum aos dois modos) ----------------
    function setupBoard(variant) {
      if (board) board.destroy();
      const el = $('[data-bgm-board]');
      el.innerHTML = '';
      board = cfg.makeBoard(el, variant);
    }

    function renderPlayers() {
      const g = game;
      [0, 1].forEach((seat) => {
        const el = root.querySelector(`.bgm-player[data-seat="${seat}"]`);
        const p = g.players[seat] || {};
        el.innerHTML = `<span class="bgm-piece">${esc(cfg.seats[seat].icon)}</span>
          <span class="bgm-avatar">${esc(p.avatar || '')}</span>
          <span class="bgm-name">${esc(p.name || '')}${p.connected === false ? ' <small>(saiu)</small>' : ''}</span>`;
        el.classList.toggle('is-turn', !g.state.result && g.state.turn === seat);
        el.classList.toggle('is-me', seat === g.mySeat);
      });
    }

    function render() {
      const g = game;
      if (!g) return;
      renderPlayers();
      const myTurn = !g.state.result && g.state.turn === g.mySeat && !g.thinking && !g.ended;
      board.render(g.state, {
        canPlay: myTurn,
        mySeat: g.mySeat,
        onMove: (m) => humanMove(m),
        hints: hintsOn && cfg.hints && myTurn ? cfg.hints(g.state, 1 - g.mySeat) : null,
      });
      const other = g.players[1 - g.mySeat] || {};
      let status;
      if (g.state.result || g.ended) status = '';
      else if (g.mode === 'friend' && other.connected === false) status = `⚠️ ${other.firstName || 'O adversário'} caiu da conexão. Esperando voltar (até 1 minuto)...`;
      else if (myTurn) status = `Sua vez! Você joga com ${cfg.seats[g.mySeat].icon}`;
      else if (g.mode === 'bot') status = '🤖 O robô está pensando...';
      else status = `Vez de ${other.firstName || 'seu amigo'}...`;
      $('[data-bgm-status]').textContent = status;
      $('[data-bgm-undo]').hidden = !(g.mode === 'bot' && g.level.undo);
      $('[data-bgm-undo]').disabled = !myTurn || !g.moves.length;
      $('[data-bgm-draw]').hidden = g.mode !== 'friend';
      $('[data-bgm-draw]').disabled = g.ended || g.drawOffer === g.mySeat;
      $('[data-bgm-resign]').disabled = g.ended;
      root.querySelector('.bgm-actions').classList.toggle('is-ended', Boolean(g.ended || g.state.result));
      $('[data-bgm-offer]').hidden = !(g.mode === 'friend' && !g.ended && g.drawOffer !== null && g.drawOffer !== undefined && g.drawOffer !== g.mySeat);
    }

    // ---------------- 🤖 contra o robô ----------------
    function startBot(level) {
      setupBoard(level.variant);
      const mySeat = level.seat != null ? level.seat : gamesStarted++ % 2; // quem começa alterna
      game = {
        mode: 'bot', level, mySeat, state: Rules.initial(level.variant), moves: [], undos: 0,
        startedAt: Date.now(), thinking: false, ended: false, token: Math.random(),
        players: [],
      };
      const bot = { name: level.title, firstName: 'O robô', avatar: '🤖' };
      const human = { name: me().firstName, firstName: me().firstName, avatar: me().avatar };
      game.players[mySeat] = human;
      game.players[1 - mySeat] = bot;
      $('[data-bgm-play-title]').textContent = `${cfg.icon} ${level.fullTitle}`;
      $('[data-bgm-result]').hidden = true;
      show('play');
      ui.toast(mySeat === 0 ? `Você começa! ${level.tip}` : `O robô começa. ${level.tip}`, 'info', 3500);
      render();
      if (game.state.turn !== mySeat) botMove();
    }

    async function botMove() {
      const g = game;
      g.thinking = true;
      render();
      let move;
      try {
        move = await think(cfg, g.state, g.level.bot);
      } catch (e) {
        const list = Rules.moves(g.state);
        move = list[Math.floor(Math.random() * list.length)];
      }
      if (game !== g || g.ended || destroyed) return;
      g.thinking = false;
      apply(move);
    }

    function apply(move) {
      const g = game;
      g.state = Rules.play(g.state, move);
      g.moves.push(move);
      sound.play('pop');
      render();
      if (g.state.result) { finishBot(); return; }
      if (g.mode === 'bot' && g.state.turn !== g.mySeat) botMove();
    }

    function humanMove(move) {
      const g = game;
      if (!g || g.ended || g.thinking || g.state.result || g.state.turn !== g.mySeat) return;
      if (!Rules.isLegal(g.state, move)) { sound.play('bonk'); return; }
      if (g.mode === 'friend') { sendMove(move); return; }
      apply(move);
    }

    function undo() {
      const g = game;
      if (!g || g.mode !== 'bot' || !g.level.undo || g.thinking || g.ended) return;
      // volta até a última vez que era a vez da criança
      let n = g.moves.length;
      do { n--; } while (n > 0 && replayTo(n).turn !== g.mySeat);
      if (n < 0 || replayTo(Math.max(n, 0)).turn !== g.mySeat) return;
      g.moves = g.moves.slice(0, n);
      g.state = replayTo(n);
      g.undos++;
      sound.play('whoosh');
      render();
    }
    function replayTo(n) {
      let s = Rules.initial(game.level.variant);
      for (let i = 0; i < n; i++) s = Rules.play(s, game.moves[i]);
      return s;
    }

    async function finishBot(resigned = false) {
      const g = game;
      if (g.ended) return;
      g.ended = true;
      const w = g.state.result ? g.state.result.winner : 1 - g.mySeat;
      const outcome = resigned ? 'loss' : w === null ? 'draw' : w === g.mySeat ? 'win' : 'loss';
      const myMoves = g.moves.filter((_, i) => i % 2 === (g.mySeat === Rules.initial(g.level.variant).turn ? 0 : 1)).length;
      const stars = Levels.starsFor(g.level.id, outcome, g.undos, myMoves);
      render();
      setTimeout(() => showResult({ outcome, stars, resigned }), g.state.result && g.state.result.line && g.state.result.line.length ? 900 : 300);
      try {
        const res = await ctx.api.post(`/progress/${cfg.id}/results`, {
          levelId: g.level.id, seat: g.mySeat, moves: g.moves, undos: g.undos, durationMs: Date.now() - g.startedAt, resigned,
        });
        progress = res.progress;
      } catch (e) {
        if (e.queued) ui.toast(e.message, 'info', 6000);
        else ui.toast('Não consegui salvar o resultado 😵 Confira a internet.', 'error', 5000);
      }
    }

    // ---------------- 👫 contra um amigo (pela rede) ----------------
    const variantChosen = () => {
      const sel = $('[data-bgm-variant]');
      return sel ? sel.value : Levels.variants()[0].id;
    };
    function friendError(e) {
      sound.play('bonk');
      ui.toast((e && e.message) || 'Não consegui falar com o servidor.', 'error', 4000);
    }
    function needLogin() {
      const token = window.PlataformaAuth && window.PlataformaAuth.token();
      if (!token) ui.toast('Entre com o seu nome para jogar com um amigo.', 'error');
      return token;
    }
    async function queueUp() {
      const studentToken = needLogin();
      if (!studentToken || !socketApi) return;
      try {
        await socketApi.emitAsync('bg:queue', { game: cfg.id, variant: variantChosen(), studentToken });
        if (!game || game.mode !== 'friend') showWait('search');
      } catch (e) { friendError(e); }
    }
    async function createRoom() {
      const studentToken = needLogin();
      if (!studentToken || !socketApi) return;
      try {
        const res = await socketApi.emitAsync('bg:create', { game: cfg.id, variant: variantChosen(), studentToken });
        showWait('code', res.code);
      } catch (e) { friendError(e); }
    }
    async function joinRoom(code) {
      const studentToken = needLogin();
      if (!studentToken || !socketApi) return;
      try {
        await socketApi.emitAsync('bg:join', { code, studentToken });
      } catch (e) { friendError(e); }
    }
    function showWait(kind, code) {
      $('[data-bgm-wait-search]').hidden = kind !== 'search';
      $('[data-bgm-wait-code]').hidden = kind !== 'code';
      if (code) {
        $('[data-bgm-code-text]').textContent = code;
        const url = `${location.origin}/jogos/${cfg.id}?sala=${code}`;
        $('[data-bgm-qr]').src = `/qr.svg?data=${encodeURIComponent(url)}`;
      }
      show('wait');
    }
    async function cancelWait() {
      try { if (socketApi) await socketApi.emitAsync('bg:cancel', {}); } catch (e) { /* ignore */ }
      show('map');
      renderMap();
    }

    // estado que o servidor manda
    function onServerState(view) {
      if (destroyed || view.game !== cfg.id) return;
      if (view.status === 'waiting') return;
      try { sessionStorage.setItem(MATCH_KEY, JSON.stringify({ game: cfg.id, matchId: view.matchId })); } catch (e) { /* ignore */ }
      const fresh = !game || game.mode !== 'friend' || game.matchId !== view.matchId;
      if (fresh) {
        setupBoard(view.variant);
        game = { mode: 'friend', matchId: view.matchId, variant: view.variant, startedAt: Date.now(), ended: false, thinking: false };
        $('[data-bgm-play-title]').textContent = `${cfg.icon} ${cfg.title} com um amigo · ${(Levels.variants().find((v) => v.id === view.variant) || {}).label || ''}`;
        $('[data-bgm-result]').hidden = true;
        show('play');
        sound.play('start');
        ui.toast(view.you === 0 ? 'Partida começando: você começa!' : 'Partida começando: o seu amigo começa.', 'info', 3000);
      }
      const before = game.moves ? game.moves.length : 0;
      Object.assign(game, { mySeat: view.you, state: view.state, moves: view.moves, players: view.players, drawOffer: view.drawOffer });
      if (view.moves.length > before && !fresh) sound.play('pop');
      if (view.status === 'ended' && !game.ended) {
        game.ended = true;
        try { sessionStorage.removeItem(MATCH_KEY); } catch (e) { /* ignore */ }
        const w = view.result.winner;
        const outcome = w === null ? 'draw' : w === view.you ? 'win' : 'loss';
        render();
        setTimeout(() => showResult({ outcome, stars: null, reason: view.result.reason }), 700);
        ctx.api.get(`/progress/${cfg.id}`).then((r) => { progress = r.progress || progress; }).catch(() => {});
        return;
      }
      render();
    }
    async function sendMove(move) {
      try {
        await socketApi.emitAsync('bg:move', { matchId: game.matchId, move });
      } catch (e) { friendError(e); }
    }
    function onReconnect() {
      // a conexão voltou: retoma a partida (o servidor guarda por 1 minuto)
      if (game && game.mode === 'friend' && !game.ended) rejoin(game.matchId);
    }
    async function rejoin(matchId) {
      const studentToken = window.PlataformaAuth && window.PlataformaAuth.token();
      if (!studentToken || !socketApi) return;
      try { await socketApi.emitAsync('bg:rejoin', { matchId, studentToken }); } catch (e) {
        try { sessionStorage.removeItem(MATCH_KEY); } catch (er) { /* ignore */ }
      }
    }
    if (socketApi) {
      socketApi.socket.on('bg:state', onServerState);
      socketApi.socket.on('connect', onReconnect);
    }

    // ---------------- resultado ----------------
    const REASONS = { desistiu: 'por desistência', abandono: 'porque o outro saiu da partida', acordo: 'combinado entre os dois' };
    function showResult({ outcome, stars, resigned, reason }) {
      const g = game;
      if (!g) return;
      const box = $('[data-bgm-result]');
      box.hidden = false;
      const drawWin = outcome === 'draw' && g.mode === 'bot' && g.level.drawIsWin;
      const icon = outcome === 'win' || drawWin ? '🏆' : outcome === 'draw' ? '🤝' : '💪';
      $('[data-bgm-result-icon]').textContent = icon;
      $('[data-bgm-result-title]').textContent = outcome === 'win' ? 'Você venceu!' : outcome === 'draw' ? (drawWin ? 'Empate contra o imbatível!' : 'Empate!') : 'Não foi dessa vez!';
      const starsBox = $('[data-bgm-result-stars]');
      starsBox.hidden = stars === null;
      [...starsBox.children].forEach((el, i) => el.classList.toggle('is-on', stars !== null && i < stars));
      let msg = '';
      if (reason && REASONS[reason]) msg = `${outcome === 'win' ? 'Vitória' : outcome === 'draw' ? 'Empate' : 'Derrota'} ${REASONS[reason]}.`;
      else if (g.mode === 'bot') {
        if (resigned) msg = 'Desistir também faz parte. Tente de novo!';
        else if (stars === 3) msg = 'Sem desfazer nenhuma jogada. Que fera! 🎉';
        else if (stars === 2) msg = g.level.par && !g.undos ? `Venceu! Para a 3ª estrela, vença em até ${g.level.par} lance${g.level.par === 1 ? '' : 's'}.` : 'Venceu! Para a 3ª estrela, vença sem desfazer.';
        else if (stars === 1) msg = 'Empatar já vale 1 estrela. Para mais, é preciso vencer!';
        else msg = 'Olhe as jogadas do robô e tente outra estratégia.';
      } else msg = outcome === 'win' ? 'Mandou bem! 🎉' : outcome === 'draw' ? 'Ninguém ganhou desta vez.' : 'Peça uma revanche!';
      $('[data-bgm-result-msg]').textContent = msg;
      const next = g.mode === 'bot' ? Levels.LEVELS[g.level.index + 1] : null;
      $('[data-bgm-next]').hidden = !(next && stars >= 2);
      $('[data-bgm-again]').textContent = g.mode === 'bot' ? '🔁 Jogar de novo' : '👫 Nova partida';
      if (outcome === 'win' || drawWin) { fx.confetti({ amount: 120 }); sound.play('fanfare'); } else if (outcome === 'draw') sound.play('tada'); else sound.play('bonk');
    }

    // ---------------- botões ----------------
    $('[data-bgm-queue]').addEventListener('click', () => { sound.play('pop'); queueUp(); });
    $('[data-bgm-create]').addEventListener('click', () => { sound.play('pop'); createRoom(); });
    $('[data-bgm-join]').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const code = $('[data-bgm-code]').value.trim().toUpperCase();
      if (code.length !== 4) { ui.toast('O código tem 4 letras.', 'error'); return; }
      joinRoom(code);
    });
    $('[data-bgm-cancel]').addEventListener('click', cancelWait);
    $('[data-bgm-undo]').addEventListener('click', undo);
    const hintBox = $('[data-bgm-hints]');
    if (hintBox) {
      hintBox.checked = hintsOn;
      hintBox.addEventListener('change', () => {
        hintsOn = hintBox.checked;
        try { localStorage.setItem(`bg_hints_${cfg.id}`, hintsOn ? '1' : '0'); } catch (e) { /* ignore */ }
        render();
      });
    }
    $('[data-bgm-draw]').addEventListener('click', async () => {
      try { await socketApi.emitAsync('bg:draw_offer', { matchId: game.matchId }); ui.toast('Proposta de empate enviada 🤝', 'info'); } catch (e) { friendError(e); }
    });
    const answer = (accept) => async () => {
      try { await socketApi.emitAsync('bg:draw_answer', { matchId: game.matchId, accept }); } catch (e) { friendError(e); }
    };
    $('[data-bgm-offer-yes]').addEventListener('click', answer(true));
    $('[data-bgm-offer-no]').addEventListener('click', answer(false));
    $('[data-bgm-resign]').addEventListener('click', async () => {
      if (!game || game.ended) return;
      const ok = await ui.confirmModal('Desistir da partida?', 'A partida conta como derrota.', 'Desistir');
      if (!ok || !game || game.ended) return;
      if (game.mode === 'friend') { try { await socketApi.emitAsync('bg:resign', { matchId: game.matchId }); } catch (e) { friendError(e); } } else finishBot(true);
    });
    async function leave() {
      if (game && !game.ended && game.moves.length) {
        const ok = await ui.confirmModal('Sair da partida?', game.mode === 'friend' ? 'Sair conta como desistência.' : 'Esta partida não vai contar.', 'Sair');
        if (!ok) return;
        if (game.mode === 'friend' && !game.ended) { try { await socketApi.emitAsync('bg:resign', { matchId: game.matchId }); } catch (e) { /* ignore */ } }
      }
      game = null;
      show('map');
      renderMap();
    }
    $('[data-bgm-quit]').addEventListener('click', leave);
    $('[data-bgm-go-map]').addEventListener('click', () => { game = null; show('map'); renderMap(); });
    $('[data-bgm-again]').addEventListener('click', () => {
      if (game && game.mode === 'bot') startBot(game.level);
      else { game = null; show('map'); renderMap(); $('.bgm-friend').scrollIntoView({ behavior: 'smooth' }); }
    });
    $('[data-bgm-next]').addEventListener('click', () => {
      const next = Levels.LEVELS[game.level.index + 1];
      if (next) startBot(next);
    });

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
      // veio pelo QR Code (/jogos/<id>?sala=ABCD) ou recarregou no meio de uma partida
      const sala = new URLSearchParams(location.search).get('sala');
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(MATCH_KEY) || 'null'); } catch (e) { /* ignore */ }
      if (sala) {
        history.replaceState(null, '', location.pathname);
        joinRoom(sala.toUpperCase());
      } else if (saved && saved.game === cfg.id) {
        rejoin(saved.matchId);
      }
    }

    function destroy() {
      destroyed = true;
      if (socketApi) {
        socketApi.socket.off('bg:state', onServerState);
        socketApi.socket.off('connect', onReconnect);
        if (screen === 'wait') socketApi.emitAsync('bg:cancel', {}).catch(() => {});
      }
      if (board) board.destroy();
    }

    return { load, destroy };
  }

  window.BoardGame = { create, think };
})();
