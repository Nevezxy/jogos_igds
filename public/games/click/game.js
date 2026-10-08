// public/games/click/game.js
// 🖱️ Click — treino do mouse: passar por cima, clicar, clicar duas vezes,
// segurar e arrastar. Telas: mapa → antes da fase → jogando → resultado. O
// progresso fica no servidor (/api/progress/click).
//
// Os alvos aparecem na área de jogo, cada um com um anel que mostra quanto
// tempo falta; acertou, estoura e revela um pedaço da figura escondida no
// fundo. A rodada acelera: os alvos ficam menores, mais rápidos e mais
// numerosos até o último. Sem "game over": vai até o último alvo.
//
// Tudo com pointer events: funciona igual com mouse, dedo e caneta. As
// ações são reconhecidas por actions.js (testado à parte).

(function () {
  const Levels = window.ClickLevels;
  const Targets = window.ClickTargets;
  const Actions = window.ClickActions;
  const Kit = window.CadentesKit;

  const BASE_POINTS = { hover: 10, click: 10, double: 15, hold: 15, drag: 20 };
  const ICONS = { hover: '', click: '👆', double: '✌️', hold: '✊', drag: '' };
  const WRONG_TEXT = {
    one: '✌️ Dois cliques, rapidinho!',
    early: '✊ Segure até encher!',
    left: '✊ Não saia de cima!',
    outside: '🤏 Solte lá dentro!',
    place: '🤏 Não é esse lugar!',
    still: '🤏 Segure e arraste!',
  };
  const MIN_HIT_RADIUS = 24; // dedo e mouse tremido: alvo pequeno ganha uma folguinha
  const SPAWN_EMPTY_MS = 250; // tela vazia: o próximo alvo não demora

  function randomSeed() {
    try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 0xFFFFFFFF); }
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // recorde da fase: no resultado e antes de começar
  function showRecord(el, score, best) {
    if (score > best && score > 0) {
      el.textContent = best ? `🏆 Novo recorde! (antes: ${best} pontos)` : '🏆 Primeiro recorde desta fase!';
      el.classList.add('is-new');
    } else {
      el.textContent = best ? `Seu recorde nesta fase: ${best} pontos` : '';
      el.classList.remove('is-new');
    }
  }

  function createGame(container, ctx) {
    const { sound, fx, ui } = ctx;
    const $ = (sel) => container.querySelector(sel);
    const screens = [...container.querySelectorAll('[data-ck]')];
    const arena = $('#ck-arena');
    const layer = $('#ck-layer');

    let progress = { levels: {} };
    let screen = 'map';
    let destroyed = false;
    let current = null;
    let round = null;
    let size = { w: 800, h: 500, scale: 1 };

    function show(name) {
      screen = name;
      screens.forEach((el) => { el.hidden = el.dataset.ck !== name; });
      window.scrollTo({ top: 0 });
    }

    // ---------------- mapa ----------------
    const levelData = (id) => (progress.levels && progress.levels[id]) || {};
    function renderMap() {
      const total = Levels.totalStars(progress);
      $('#ck-total-stars').textContent = total;
      $('#ck-max-stars').textContent = Levels.MAX_STARS;
      const next = Levels.nextLevel(progress);
      const first = ctx.student ? ctx.student.firstName : '';
      $('#ck-map-speech').textContent = total === 0
        ? `Oi, ${first}! Vamos treinar o mouse: estourar bolhas, clicar, segurar e arrastar! 🖱️`
        : next ? `Você já tem ${total} ⭐! A próxima fase está piscando em amarelo 💪` : `Uau, ${first}! Você fez todas as fases! 🏆`;
      const cont = $('#ck-continue');
      cont.textContent = next ? `▶ Continuar: ${next.fullTitle}` : '🏆 Jogar de novo a primeira fase';
      cont.dataset.level = next ? next.id : Levels.LEVELS[0].id;
      window.LevelMap.render($('#ck-worlds'), {
        worlds: Levels.WORLDS,
        storageKey: 'ck_map_filter',
        nextId: next ? next.id : null,
        stateOf: (level) => ({ stars: levelData(level.id).stars || 0, plays: levelData(level.id).plays || 0 }),
        onPick: (level) => { sound.play('pop'); openIntro(level); },
      });
    }

    // ---------------- antes da fase ----------------
    function openIntro(level) {
      current = level;
      const world = Levels.getWorld(level.world);
      $('#ck-intro-world').textContent = `${world.icon} ${world.name} · fase ${level.indexInWorld + 1} de ${world.levels.length}`;
      $('#ck-intro-title').textContent = level.fullTitle;
      $('#ck-intro-world-text').textContent = level.indexInWorld === 0 ? world.intro : '';
      $('#ck-intro-tip').textContent = `💡 ${level.tip}`;
      const best = levelData(level.id).bestScore || 0;
      $('#ck-intro-record').hidden = !best;
      $('#ck-intro-record').textContent = best ? `🏆 Seu recorde: ${best} pontos. Consegue bater?` : '';
      const list = $('#ck-intro-kinds');
      list.innerHTML = '';
      level.kinds.forEach((kind) => {
        const info = Levels.KIND_INFO[kind];
        const li = document.createElement('li');
        li.innerHTML = `<span class="ck-target is-${kind} is-sample"><span class="ck-ico">${kind === 'drag' ? '🍎' : ICONS[kind]}</span></span><span><b>${info.name}</b><br>${info.verb}${kind === 'hover' ? ' (ou o dedo)' : ''}</span>`;
        list.appendChild(li);
      });
      show('intro');
      setTimeout(() => $('#ck-start').focus(), 60);
    }

    // ---------------- área de jogo ----------------
    function measure() {
      const r = arena.getBoundingClientRect();
      size = { w: r.width, h: r.height, scale: Math.max(0.6, Math.min(1, Math.min(r.width, r.height * 1.5) / 900)) };
    }
    function fitArena() {
      const top = arena.getBoundingClientRect().top;
      arena.style.height = `${Math.max(320, Math.floor(window.innerHeight - top - 14))}px`;
      measure();
    }
    function local(ev) {
      const r = arena.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    // figura escondida: um quadriculado que vai sumindo a cada acerto
    function buildPicture(level, picture) {
      $('#ck-picture').textContent = picture.emoji;
      const tiles = $('#ck-tiles');
      tiles.innerHTML = '';
      const cols = Math.ceil(Math.sqrt(level.count * 1.6));
      const rows = Math.ceil(level.count / cols);
      tiles.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      tiles.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      const els = [];
      for (let i = 0; i < cols * rows; i++) {
        const t = document.createElement('i');
        t.style.setProperty('--h', `${(i * 47) % 360}`);
        tiles.appendChild(t);
        els.push(t);
      }
      for (let i = els.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [els[i], els[j]] = [els[j], els[i]];
      }
      return els;
    }
    function reveal() {
      const r = round;
      const want = Math.round((r.hits * r.tiles.length) / r.items.length);
      while (r.revealed < want && r.revealed < r.tiles.length) r.tiles[r.revealed++].classList.add('is-off');
    }

    // destinos do arrastar
    function makeDest(kind, id, html, x, y, w, h, extra = {}) {
      const el = document.createElement('div');
      el.className = `ck-dest is-${kind}`;
      el.innerHTML = html;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      layer.appendChild(el);
      return { id, el, x, y, w, h, vx: 0, ...extra };
    }
    function placeDest(d) { d.el.style.transform = `translate(${d.x - d.w / 2}px, ${d.y - d.h / 2}px)`; }
    function colorDests(level) {
      const colors = Targets.COLORS.slice(0, level.drag.colors || 3);
      const s = Math.round(level.drag.size * size.scale);
      return colors.map((c, k) => {
        const d = makeDest('color', c.id, `<span class="ck-dest-label">caixa ${c.name}</span>`,
          ((k + 1) / (colors.length + 1)) * size.w, size.h - s / 2 - 14, s, s);
        d.el.style.setProperty('--c', c.css);
        return d;
      });
    }
    function destsFor(t, level) {
      const drag = level.drag || { mode: 'basket', size: 160 };
      const s = Math.round((drag.size || 160) * size.scale);
      if (drag.mode === 'color') return { list: round.colorDests, own: false, wanted: t.item.color };
      if (drag.mode === 'shadow') {
        const list = t.item.shadows.map((emoji, k) => makeDest('shadow', emoji, `<span>${emoji}</span>`,
          ((k + 1) / 4) * size.w, size.h - s / 2 - 14, s, s));
        return { list, own: true, wanted: t.item.emoji };
      }
      const half = s / 2 + 8;
      const d = makeDest('basket', 'basket', '<span>🧺</span>',
        Math.max(half, Math.min(size.w - half, t.item.bx * size.w)), Math.max(half, Math.min(size.h - half, t.item.by * size.h)), s, s);
      if (drag.moving) d.vx = 70 * size.scale * (t.item.angle > Math.PI ? 1 : -1);
      return { list: [d], own: true, wanted: 'basket' };
    }

    // ---------------- alvos ----------------
    function spawn() {
      const r = round;
      const i = r.next++;
      const item = r.items[i];
      const pace = Levels.paceAt(r.level, i);
      const radius = Math.round((pace.size * size.scale) / 2);
      const x = radius + item.x * Math.max(1, size.w - 2 * radius);
      const yMax = item.kind === 'drag' ? size.h * 0.55 : size.h;
      const y = radius + item.y * Math.max(1, yMax - 2 * radius);
      const el = document.createElement('div');
      el.className = `ck-target is-${item.kind}`;
      el.style.width = `${radius * 2}px`;
      el.style.height = `${radius * 2}px`;
      el.innerHTML = `<span class="ck-fill"></span><span class="ck-ico">${item.kind === 'drag' ? item.emoji : ICONS[item.kind]}</span>`;
      Kit.decorate(el, r.specials[i]);
      layer.appendChild(el);
      const moving = r.level.motion !== 'none' && item.kind !== 'drag';
      const speed = moving ? pace.speed * size.scale : 0;
      const t = {
        index: i, item, kind: item.kind, el, x, y, r: radius, homeX: x, homeY: y,
        vx: Math.cos(item.angle) * speed, vy: Math.sin(item.angle) * speed, speed,
        life: pace.lifeMs, left: pace.lifeMs, turnIn: 600 + Math.random() * 900,
        gesture: Actions.createGesture(item.kind, { dblMs: r.level.dblMs, holdMs: r.level.holdMs }),
      };
      if (item.kind === 'drag') t.dests = destsFor(t, r.level);
      r.alive.push(t);
      r.lastSpawn = r.elapsed;
      if (r.level.path && r.lastStep) {
        // trilha: uma linha pontilhada até a próxima bolinha
        drawStep(r.lastStep, t);
      }
      render(t);
    }

    function drawStep(from, to) {
      const line = document.createElement('div');
      line.className = 'ck-trail';
      const len = dist(from, to);
      line.style.width = `${len}px`;
      line.style.transform = `translate(${from.x}px, ${from.y}px) rotate(${Math.atan2(to.y - from.y, to.x - from.x)}rad)`;
      layer.insertBefore(line, layer.firstChild);
      setTimeout(() => line.remove(), 2600);
    }

    function render(t) {
      t.el.style.transform = `translate(${t.x - t.r}px, ${t.y - t.r}px)`;
      const life = Math.max(0, t.left / t.life);
      t.el.style.setProperty('--life', life.toFixed(3));
      t.el.style.setProperty('--ring', life < 0.25 ? 'var(--red)' : life < 0.5 ? 'var(--orange)' : 'var(--green)');
    }

    function removeTarget(t, cls) {
      const r = round;
      r.alive = r.alive.filter((o) => o !== t);
      if (r.holdT === t) r.holdT = null;
      if (r.drag && r.drag.t === t) r.drag = null;
      t.gesture.reset();
      t.el.classList.add(cls);
      setTimeout(() => t.el.remove(), 450);
      if (t.dests && t.dests.own) t.dests.list.forEach((d) => { d.el.classList.add('is-gone'); setTimeout(() => d.el.remove(), 350); });
    }

    function burst(t) {
      const a = arena.getBoundingClientRect();
      fx.confetti({ amount: 22, origin: { x: a.left + t.x, y: a.top + t.y }, power: 0.5 });
    }

    function success(t, { chain = false } = {}) {
      const r = round;
      if (!r.alive.includes(t)) return;
      const special = r.specials[t.index];
      const points = r.board.hit(BASE_POINTS[t.kind], { gold: special === 'gold' });
      r.hits++;
      r.hitsBy[t.kind] = (r.hitsBy[t.kind] || 0) + 1;
      burst(t);
      Kit.floatText(arena, t.el, `+${points}`, special === 'gold' ? 'is-big' : '');
      sound.play(t.kind === 'hover' ? 'pop' : 'ding');
      if (r.level.path) r.lastStep = { x: t.x, y: t.y };
      removeTarget(t, 'is-hit');
      reveal();
      updateStats();
      if (chain) return;
      if (special === 'ice') {
        r.frozenUntil = r.elapsed + Kit.FREEZE_MS;
        arena.classList.add('is-frozen-sky');
        setTimeout(() => arena.classList.remove('is-frozen-sky'), Kit.FREEZE_MS);
        Kit.floatText(arena, t.el, '🧊 Congelou!', 'is-big');
        sound.play('whoosh');
      } else if (special === 'bomb') {
        Kit.floatText(arena, t.el, '💥 BUM!', 'is-big');
        sound.play('fanfare');
        r.alive.slice().forEach((o) => success(o, { chain: true }));
      }
    }

    function wrong(t, reason, point) {
      const r = round;
      r.wrong++;
      const kind = t ? t.kind : 'empty';
      r.wrongBy[kind] = (r.wrongBy[kind] || 0) + 1;
      r.board.miss();
      sound.play('bonk');
      if (t) {
        t.el.classList.remove('is-armed', 'is-holding', 'is-wrong');
        void t.el.offsetWidth;
        t.el.classList.add('is-wrong');
        t.el.style.setProperty('--hold', 0);
        if (WRONG_TEXT[reason]) Kit.floatText(arena, t.el, WRONG_TEXT[reason], 'is-hint');
      } else if (point) {
        const x = document.createElement('div');
        x.className = 'ck-miss';
        x.style.transform = `translate(${point.x}px, ${point.y}px)`;
        layer.appendChild(x);
        setTimeout(() => x.remove(), 500);
      }
    }

    function expire(t) {
      const r = round;
      r.lost.push(t.index);
      r.board.miss();
      sound.play('whoosh');
      removeTarget(t, 'is-gone');
      updateStats();
    }

    // o que o reconhecedor de ações respondeu
    function handle(t, res) {
      if (!res || !round.alive.includes(t)) return;
      if (res === 'ok') success(t);
      else if (res === 'wait') { if (t.kind === 'double') t.el.classList.add('is-armed'); }
      else if (typeof res === 'string' && res.startsWith('wrong:')) wrong(t, res.slice(6));
      else if (res.progress != null) t.el.style.setProperty('--hold', res.progress.toFixed(3));
    }

    function hitTest(p, filter = () => true) {
      for (let i = round.alive.length - 1; i >= 0; i--) {
        const t = round.alive[i];
        if (filter(t) && dist(p, t) <= Math.max(t.r * 1.08, MIN_HIT_RADIUS)) return t;
      }
      return null;
    }

    // ---------------- ponteiro ----------------
    function onDown(ev) {
      if (!round || !round.started || round.ended) return;
      if (!$('#ck-pause').hidden) return;
      if (!round.running) return;
      ev.preventDefault();
      const p = local(ev);
      round.pointer = p;
      const t = hitTest(p);
      if (!t) {
        // nos mundos de passar por cima, clicar no vazio não é erro
        if (!round.level.kinds.every((k) => k === 'hover')) wrong(null, 'empty', p);
        return;
      }
      try { arena.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura */ }
      const now = performance.now();
      if (t.kind === 'drag') {
        round.drag = { t, dx: t.x - p.x, dy: t.y - p.y, sx: p.x, sy: p.y, moved: false };
        t.el.classList.add('is-dragging');
        sound.play('click');
        return;
      }
      if (t.kind === 'hold') { round.holdT = t; t.el.classList.add('is-holding'); }
      handle(t, t.gesture.down(now));
    }

    function onMove(ev) {
      if (!round || !round.running) return;
      const p = local(ev);
      round.pointer = p;
      const d = round.drag;
      if (d) {
        d.t.x = p.x + d.dx;
        d.t.y = p.y + d.dy;
        if (Math.hypot(p.x - d.sx, p.y - d.sy) > 10) d.moved = true;
        d.t.dests.list.forEach((dest) => {
          const over = Math.abs(p.x - dest.x) <= dest.w / 2 && Math.abs(p.y - dest.y) <= dest.h / 2;
          dest.el.classList.toggle('is-over', over);
        });
        render(d.t);
        return;
      }
      // bolhas: estouram só de passar por cima
      let t;
      while ((t = hitTest(p, (o) => o.kind === 'hover'))) success(t);
    }

    function onUp(ev) {
      if (!round || !round.running) return;
      const p = local(ev);
      const now = performance.now();
      if (round.holdT) {
        const t = round.holdT;
        round.holdT = null;
        t.el.classList.remove('is-holding');
        handle(t, t.gesture.up(now));
      }
      const d = round.drag;
      if (d) {
        round.drag = null;
        const t = d.t;
        t.el.classList.remove('is-dragging');
        d.t.dests.list.forEach((dest) => dest.el.classList.remove('is-over'));
        const rects = t.dests.list.map((dest) => ({
          id: dest.id, left: dest.x - dest.w / 2, right: dest.x + dest.w / 2, top: dest.y - dest.h / 2, bottom: dest.y + dest.h / 2,
        }));
        const res = Actions.dropResult(p, rects, t.dests.wanted);
        if (res === 'ok') {
          const dest = t.dests.list.find((o) => o.id === t.dests.wanted);
          dest.el.classList.remove('is-yum');
          void dest.el.offsetWidth;
          dest.el.classList.add('is-yum');
          success(t);
          return;
        }
        wrong(t, d.moved ? res.slice(6) : 'still');
        // volta para o lugar
        t.x = t.homeX;
        t.y = t.homeY;
        t.el.classList.add('is-back');
        setTimeout(() => t.el.classList.remove('is-back'), 300);
        render(t);
      }
    }
    arena.addEventListener('pointerdown', onDown);
    arena.addEventListener('pointermove', onMove);
    arena.addEventListener('pointerup', onUp);
    arena.addEventListener('pointercancel', onUp);
    arena.addEventListener('contextmenu', (ev) => ev.preventDefault());

    // ---------------- o laço do jogo ----------------
    function loop(now) {
      const r = round;
      if (!r || r.ended || destroyed) return;
      const dt = Math.min(50, now - (r.lastT || now));
      r.lastT = now;
      if (r.running) step(dt, performance.now());
      r.raf = requestAnimationFrame(loop);
    }

    function step(dt, now) {
      const r = round;
      r.elapsed += dt;
      const frozen = r.elapsed < r.frozenUntil;
      const pace = Levels.paceAt(r.level, Math.min(r.next, r.items.length - 1));
      const since = r.elapsed - r.lastSpawn;
      if (r.next < r.items.length && r.alive.length < pace.maxOnScreen
        && (since >= pace.intervalMs || (r.alive.length === 0 && since >= SPAWN_EMPTY_MS))) spawn();

      for (const t of r.alive.slice()) {
        if (!r.alive.includes(t)) continue;
        handle(t, t.gesture.tick(now));
        if (!r.alive.includes(t)) continue;
        const held = r.holdT === t || (r.drag && r.drag.t === t);
        // segurando um alvo que anda: a setinha tem que ir junto
        if (r.holdT === t && r.pointer && dist(r.pointer, t) > Math.max(t.r * 1.3, MIN_HIT_RADIUS + 6)) {
          r.holdT = null;
          t.el.classList.remove('is-holding');
          handle(t, t.gesture.leave());
          if (!r.alive.includes(t)) continue;
        }
        if (!frozen && !held) t.left -= dt;
        if (!frozen && t.speed && !(r.drag && r.drag.t === t)) move(t, dt);
        if (t.left <= 0) { expire(t); continue; }
        render(t);
      }
      // cestas que andam
      if (!frozen) {
        r.alive.forEach((t) => (t.dests && t.dests.own ? t.dests.list : []).forEach((d) => {
          if (!d.vx) return;
          d.x += (d.vx * dt) / 1000;
          if (d.x < d.w / 2 + 6 || d.x > size.w - d.w / 2 - 6) { d.vx = -d.vx; d.x = Math.max(d.w / 2 + 6, Math.min(size.w - d.w / 2 - 6, d.x)); }
        }));
      }
      r.alive.forEach((t) => t.dests && t.dests.list.forEach(placeDest));
      if (r.colorDests) r.colorDests.forEach(placeDest);
      if (r.next >= r.items.length && r.alive.length === 0) finish();
    }

    function move(t, dt) {
      if (round.level.motion === 'bounce') {
        // muda de direção de vez em quando, como um peixinho
        t.turnIn -= dt;
        if (t.turnIn <= 0) {
          const a = Math.atan2(t.vy, t.vx) + (Math.random() - 0.5) * 2.2;
          t.vx = Math.cos(a) * t.speed;
          t.vy = Math.sin(a) * t.speed;
          t.turnIn = 600 + Math.random() * 900;
        }
      }
      t.x += (t.vx * dt) / 1000;
      t.y += (t.vy * dt) / 1000;
      if (t.x < t.r) { t.x = t.r; t.vx = Math.abs(t.vx); }
      if (t.x > size.w - t.r) { t.x = size.w - t.r; t.vx = -Math.abs(t.vx); }
      if (t.y < t.r) { t.y = t.r; t.vy = Math.abs(t.vy); }
      if (t.y > size.h - t.r) { t.y = size.h - t.r; t.vy = -Math.abs(t.vy); }
    }

    // ---------------- jogando ----------------
    function cleanupRound() {
      if (!round) return;
      cancelAnimationFrame(round.raf);
      round.ended = true;
      if (round.board) round.board.destroy();
    }

    function start(level) {
      cleanupRound();
      const seed = randomSeed();
      const items = Targets.makeTargets(level, seed);
      layer.innerHTML = '';
      arena.classList.remove('is-revealed', 'is-frozen-sky');
      show('play');
      fitArena();
      const picture = Targets.pictureFor(seed);
      round = {
        level, seed, items, picture,
        tiles: buildPicture(level, picture), revealed: 0,
        specials: Kit.pickSpecials(items.length),
        board: Kit.createBoard(arena, { best: levelData(level.id).bestScore || 0, onMultiplier: () => sound.play('tada') }),
        alive: [], next: 0, lastSpawn: -1e9, elapsed: 0, frozenUntil: 0,
        hits: 0, hitsBy: {}, lost: [], wrong: 0, wrongBy: {},
        holdT: null, drag: null, pointer: null, lastStep: null,
        started: false, running: false, ended: false, raf: 0, lastT: 0,
      };
      round.colorDests = level.drag && level.drag.mode === 'color' && level.kinds.includes('drag') ? colorDests(level) : null;
      if (round.colorDests) round.colorDests.forEach(placeDest);
      $('#ck-play-title').textContent = `${Levels.getWorld(level.world).icon} ${level.fullTitle}`;
      $('#ck-pause').hidden = true;
      updateStats();
      countdown(() => {
        round.started = true;
        round.running = true;
        round.lastT = 0;
        round.raf = requestAnimationFrame(loop);
      });
    }

    function countdown(done) {
      const box = $('#ck-countdown');
      const n = $('#ck-countdown-n');
      const r = round;
      let k = 3;
      box.hidden = false;
      n.textContent = k;
      sound.play('tick');
      const t = setInterval(() => {
        if (destroyed || round !== r) { clearInterval(t); return; }
        k--;
        if (k === 0) {
          clearInterval(t);
          box.hidden = true;
          sound.play('start');
          done();
          return;
        }
        n.textContent = k;
        sound.play('tick');
      }, 700);
    }

    function updateStats() {
      if (!round) return;
      const total = round.items.length;
      const left = total - round.hits - round.lost.length;
      $('#ck-stat-hits').textContent = round.hits;
      $('#ck-stat-lost').textContent = round.lost.length;
      $('#ck-stat-left').textContent = left;
      $('#ck-progress-bar').style.width = `${((total - left) / total) * 100}%`;
    }

    function onResize() {
      if (screen !== 'play') return;
      fitArena();
      if (round && round.colorDests) {
        const fresh = colorDests(round.level);
        round.colorDests.forEach((d, k) => { d.el.remove(); Object.assign(d, { ...fresh[k], el: fresh[k].el }); });
      }
    }
    window.addEventListener('resize', onResize);

    // ---------------- pausa ----------------
    function pause() {
      if (!round || !round.started || round.ended || !round.running) return;
      round.running = false;
      // o que estava pela metade (segurando, arrastando, 1º clique) recomeça
      round.alive.forEach((t) => {
        t.gesture.reset();
        t.el.classList.remove('is-armed', 'is-holding', 'is-dragging');
        t.el.style.setProperty('--hold', 0);
        if (round.drag && round.drag.t === t) { t.x = t.homeX; t.y = t.homeY; render(t); }
      });
      round.holdT = null;
      round.drag = null;
      $('#ck-pause').hidden = false;
    }
    function resume() {
      if (!round || round.ended) return;
      $('#ck-pause').hidden = true;
      round.running = true;
    }
    $('#ck-pause').addEventListener('click', resume);
    $('#ck-pause-btn').addEventListener('click', () => (round && !round.running ? resume() : pause()));
    function onKeydown(ev) {
      if (screen === 'intro' && ev.key === 'Enter' && document.activeElement?.id !== 'ck-start') { ev.preventDefault(); $('#ck-start').click(); return; }
      if (screen !== 'play' || !round) return;
      if (ev.key === 'Escape') { ev.preventDefault(); if ($('#ck-pause').hidden) pause(); else resume(); }
    }
    document.addEventListener('keydown', onKeydown);
    function onVisibility() { if (document.hidden) pause(); }
    function onBlur() { if (screen === 'play') pause(); }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);

    async function quit() {
      if (round && round.started && !round.ended) {
        pause();
        const ok = await ui.confirmModal('Sair da fase?', 'O que você fez nesta rodada não vai contar.', 'Sair');
        if (!ok) { resume(); return; }
      }
      cleanupRound();
      round = null;
      show('map');
      renderMap();
    }
    $('#ck-quit').addEventListener('click', quit);

    // ---------------- resultado ----------------
    async function finish() {
      const r = round;
      cancelAnimationFrame(r.raf);
      r.ended = true;
      r.running = false;
      const durationMs = Math.round(r.elapsed);
      const accuracy = r.hits + r.wrong ? Math.round((r.hits / (r.hits + r.wrong)) * 1000) / 10 : 0;
      const stars = Levels.starsFor(r.level.id, { hits: r.hits, count: r.items.length, accuracy });
      const best = levelData(r.level.id).bestScore || 0;
      // a figura inteira aparece
      r.tiles.forEach((t) => t.classList.add('is-off'));
      arena.classList.add('is-revealed');
      sound.play('fanfare');
      const b = document.createElement('div');
      b.className = 'cad-banner is-streak';
      b.textContent = `${r.picture.emoji} Você revelou ${r.picture.name}!`;
      arena.appendChild(b);
      setTimeout(() => b.remove(), 1300);
      setTimeout(() => { if (round === r && !destroyed) showResult({ stars, accuracy, best }); }, 1500);
      try {
        const res = await ctx.api.post('/progress/click/results', {
          levelId: r.level.id, seed: r.seed, lost: r.lost, wrong: r.wrong, wrongBy: r.wrongBy,
          durationMs, score: r.board.score, bestStreak: r.board.bestStreak,
        });
        progress = res.progress;
      } catch (e) {
        ui.toast('Não consegui salvar o seu resultado 😵 Confira a internet.', 'error', 5000);
      }
    }

    function showResult({ stars, accuracy, best }) {
      const r = round;
      show('result');
      $('#ck-result-picture').textContent = r.picture.emoji;
      showRecord($('#ck-record'), r.board.score, best);
      $('#ck-res-score').textContent = r.board.score;
      $('#ck-res-hits').textContent = `${r.hits}/${r.items.length}`;
      $('#ck-res-acc').textContent = `${Math.round(accuracy)}%`;
      $('#ck-res-streak').textContent = r.board.bestStreak;
      const starEls = [...container.querySelectorAll('.ck-star')];
      starEls.forEach((el) => el.classList.remove('is-on'));
      starEls.forEach((el, i) => {
        if (i < stars) setTimeout(() => { el.classList.add('is-on'); sound.play('ding'); }, 350 + i * 380);
      });
      const titles = ['Quase lá!', 'Muito bem!', 'Excelente!', 'Perfeito!'];
      $('#ck-result-title').textContent = titles[stars];
      const ratio = r.hits / r.items.length;
      let msg;
      if (stars === 0) msg = 'Para ganhar estrela, acerte mais da metade dos alvos. Vá com calma 🙂';
      else if (stars < 3 && ratio >= 0.95) msg = 'Para a 3ª estrela, faça menos ações erradas (cliques fora e ações trocadas).';
      else if (stars < 3) msg = 'Repita para conquistar mais estrelas! ⭐';
      else msg = `Você revelou ${r.picture.name} sem deixar quase nada escapar! 🎉`;
      $('#ck-result-msg').textContent = msg;
      // misturado: como foi em cada ação
      const kinds = r.level.kinds;
      const byKind = $('#ck-by-kind');
      byKind.hidden = kinds.length < 2;
      byKind.innerHTML = '';
      if (kinds.length > 1) {
        kinds.forEach((kind) => {
          const total = r.items.filter((it) => it.kind === kind).length;
          const ok = r.hitsBy[kind] || 0;
          const li = document.createElement('li');
          li.className = ok / total >= 0.8 ? 'is-good' : ok / total >= 0.5 ? '' : 'is-bad';
          li.innerHTML = `<span>${Levels.KIND_INFO[kind].icon} ${Levels.KIND_INFO[kind].name}</span><b>${ok}/${total}</b>`;
          byKind.appendChild(li);
        });
      }
      const next = Levels.LEVELS[r.level.index + 1];
      $('#ck-next').hidden = !next;
      if (stars >= 1) { fx.confetti({ amount: 40 + stars * 50 }); sound.play(stars === 3 ? 'fanfare' : 'tada'); }
      setTimeout(() => $(stars >= 1 && next ? '#ck-next' : '#ck-retry').focus(), 80);
    }

    $('#ck-retry').addEventListener('click', () => start(round.level));
    $('#ck-next').addEventListener('click', () => {
      const next = Levels.LEVELS[round.level.index + 1];
      if (next) openIntro(next);
    });
    $('#ck-start').addEventListener('click', () => start(current));
    $('#ck-continue').addEventListener('click', () => {
      sound.play('pop');
      openIntro(Levels.getLevel($('#ck-continue').dataset.level));
    });
    container.querySelectorAll('[data-ck-go="map"]').forEach((btn) => btn.addEventListener('click', () => {
      cleanupRound();
      round = null;
      show('map');
      renderMap();
    }));

    async function load() {
      try {
        const res = await ctx.api.get('/progress/click');
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
      cleanupRound();
      round = null;
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
    }

    return { load, destroy };
  }

  let game = null;
  window.Plataforma.registerGame('click', {
    async mount(container, ctx) {
      // a área de jogo usa toda a largura da tela
      container.classList.add('is-wide');
      ctx.mascot.mount(container);
      game = createGame(container, ctx);
      await game.load();
    },
    unmount() {
      if (game) game.destroy();
      game = null;
      document.getElementById('game-root').classList.remove('is-wide');
    },
  });
})();
