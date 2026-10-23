// public/js/platform/ranking.js
// 🏅 Ranking (/ranking): os pontos de todo mundo, do maior para o menor.
// Os pontos vêm das estrelas de todos os jogos (cada fase vale estrelas ×
// 10 × dificuldade; repetir só soma se melhorar). Filtros: geral, a minha
// turma (ou outra) e um jogo. Quem está logado vê o próprio cartão (pontos,
// posição e os jogos que mais deram pontos). O professor também vê, pelo
// token da área do professor.

(function () {
  const { showScreen, toast } = window.BingoUI;
  const auth = window.PlataformaAuth;
  const go = (url) => window.PlataformaRouter.go(url);
  const $ = (id) => document.getElementById(id);
  const TEACHER_KEY = 'igds_teacher_v1';
  const MEDALS = ['🥇', '🥈', '🥉'];

  let games = [];
  let filter = { className: '', game: '' };
  let seq = 0;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');

  function teacherToken() {
    try { return localStorage.getItem(TEACHER_KEY); } catch (e) { return null; }
  }

  // educando logado: a API de sempre; professor: o token dele
  async function get(route) {
    if (auth.isLoggedIn()) return window.PlataformaApi.get(route);
    const res = await fetch(`/api${route}`, { headers: { 'X-Teacher-Token': teacherToken() || '' } });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!res.ok || data.ok === false) throw new Error(data.message || 'Não consegui carregar o ranking.');
    return data;
  }

  const canView = () => auth.isLoggedIn() || Boolean(teacherToken());

  function renderMine(me) {
    const box = $('ranking-me');
    if (!me) { box.hidden = true; return; }
    box.hidden = false;
    const top = me.games.slice(0, 3).map((g) => {
      const game = games.find((x) => x.id === g.gameId);
      return `<li><span>${esc(game ? game.icon : '🎮')} ${esc(game ? game.name : g.gameId)}</span><b>${fmt(g.points)}</b></li>`;
    }).join('');
    const student = auth.student();
    box.innerHTML = `
      <div class="ranking-me-head">
        <span class="avatar-badge">${esc(student ? student.avatar : '🙂')}</span>
        <div><strong>${fmt(me.total)} pontos</strong>
          <small>${me.position ? `${me.position}º lugar geral` : 'Ainda sem lugar no ranking'}${me.classPosition ? ` · ${me.classPosition}º na turma` : ''} · ${me.levelsDone} fase${me.levelsDone === 1 ? '' : 's'} com estrela</small></div>
      </div>
      ${top ? `<ul class="ranking-me-games">${top}</ul>` : '<p class="muted">Jogue e ganhe estrelas para somar pontos!</p>'}`;
  }

  function renderList(data) {
    const list = $('ranking-list');
    const myId = auth.isLoggedIn() && auth.student() ? auth.student().id : null;
    if (!data.ranking.length) {
      list.innerHTML = '<p class="muted ranking-empty">Ninguém com pontos aqui ainda. Que tal ser o primeiro? 🚀</p>';
      return;
    }
    list.innerHTML = data.ranking.map((r, i) => `
      <li class="ranking-row${r.id === myId ? ' is-me' : ''}${r.position <= 3 ? ` is-top is-top-${r.position}` : ''}" style="--i:${Math.min(i, 20)}">
        <span class="ranking-pos">${r.position <= 3 ? MEDALS[r.position - 1] : `${r.position}º`}</span>
        <span class="avatar-badge ranking-avatar">${esc(r.avatar)}</span>
        <span class="ranking-name">${esc(r.name)}${r.className && !r.name.endsWith(` ${r.className}`) ? ` <small>${esc(r.className)}</small>` : ''}</span>
        <span class="ranking-points"><b>${fmt(r.points)}</b><small>pontos</small></span>
      </li>`).join('');
  }

  function renderFilters(classes) {
    const cls = $('ranking-class');
    const student = auth.isLoggedIn() ? auth.student() : null;
    cls.innerHTML = `<option value="">🌎 Todos</option>${classes.map((c) => `<option value="${esc(c)}">🏫 ${esc(c)}${student && student.className === c ? ' (minha turma)' : ''}</option>`).join('')}`;
    cls.value = filter.className;
    const gsel = $('ranking-game');
    gsel.innerHTML = `<option value="">🎮 Todos os jogos</option>${games.filter((g) => g.mode !== 'turma').map((g) => `<option value="${esc(g.id)}">${esc(g.icon)} ${esc(g.name)}</option>`).join('')}`;
    gsel.value = filter.game;
  }

  async function load() {
    const my = ++seq;
    $('ranking-list').innerHTML = '<p class="muted ranking-empty">Carregando...</p>';
    const q = new URLSearchParams();
    if (filter.className) q.set('class', filter.className);
    if (filter.game) q.set('game', filter.game);
    try {
      const [data, me] = await Promise.all([
        get(`/ranking?${q}`),
        auth.isLoggedIn() ? window.PlataformaApi.get('/me/points') : Promise.resolve(null),
      ]);
      if (my !== seq) return;
      renderFilters(data.classes || []);
      renderMine(me);
      renderList(data);
    } catch (e) {
      if (my !== seq) return;
      $('ranking-list').innerHTML = '';
      toast(e.message || 'Não consegui carregar o ranking 😵', 'error');
    }
  }

  async function show() {
    if (!canView()) return false;
    showScreen('screen-ranking');
    $('ranking-back').textContent = auth.isLoggedIn() ? '← Jogos' : '← Professor';
    try { games = await window.Plataforma.listGames(); } catch (e) { games = []; }
    // a criança começa vendo a própria turma (se tiver)
    const student = auth.isLoggedIn() ? auth.student() : null;
    if (!show.started) { filter.className = student && student.className ? student.className : ''; show.started = true; }
    await load();
    return true;
  }

  $('ranking-class').addEventListener('change', (ev) => { filter.className = ev.target.value; load(); });
  $('ranking-game').addEventListener('change', (ev) => { filter.game = ev.target.value; load(); });
  $('ranking-back').addEventListener('click', () => go(auth.isLoggedIn() ? '/jogos' : '/professor'));

  // o selo de pontos no painel
  async function refreshBadge() {
    const btn = $('hub-points');
    if (!btn || !auth.isLoggedIn()) return;
    try {
      const me = await window.PlataformaApi.get('/me/points');
      btn.innerHTML = `🏅 <b>${fmt(me.total)}</b>${me.position ? ` <small>${me.position}º</small>` : ''}`;
      btn.title = `${fmt(me.total)} pontos${me.position ? ` · ${me.position}º lugar` : ''}: ver o ranking`;
    } catch (e) { /* sem pontos agora */ }
  }
  $('hub-points').addEventListener('click', () => go('/ranking'));

  window.PlataformaRanking = { show, canView, refreshBadge };
})();
