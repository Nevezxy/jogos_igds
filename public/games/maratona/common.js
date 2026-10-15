// public/games/maratona/common.js
// 🏃 Peças das três telas da Maratona (criança, professor e telão):
// relógio acertado com o do servidor, nomes dos jogos, das equipes e dos
// formatos, a classificação, o resultado de cada confronto e os textos.

(function () {
  const { escapeHtml: esc } = window.BingoUI;

  // diferença entre o relógio do servidor e o deste aparelho
  let offset = 0;
  const syncClock = (serverNow) => { if (serverNow) offset = serverNow - Date.now(); };
  const now = () => Date.now() + offset;
  function formatTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // jogos (nome e ícone) vindos do registro
  let games = {};
  async function loadGames() {
    try { (await window.Plataforma.listGames()).forEach((g) => { games[g.id] = g; }); } catch (e) { /* ignore */ }
    return games;
  }
  const gameOf = (id) => games[id] || { id, name: id, icon: '🎮' };

  const FORMATOS = { solo: '👤 Solo', dupla: '👥 Duplas', trio: '👨‍👩‍👦 Trios', quarteto: '🧑‍🤝‍🧑 Quartetos', duas: '⚔️ Duas equipes' };
  const ROTACAO = { aleatorio: '🎲 Sorteio', sequencial: '🔁 Em sequência', votacao: '🗳️ Votação', ordem: '📋 Ordem do professor', professor: '🧑‍🏫 Professor escolhe' };
  const STATUS = {
    sala_de_espera: 'sala de espera', votacao: 'votação', preparando: 'preparando a rodada', disputa: 'rodada em andamento',
    entre_rodadas: 'entre rodadas', pausada: 'pausada', encerrada: 'encerrada', cancelada: 'cancelada',
  };
  const ENTRY = {
    escalado: '🎮 jogando', concluida: '✅ terminou', tempo_esgotado: '⏰ não terminou', ausente: '🚫 ausente',
    dispensado: '🙏 dispensado', descanso: '😴 descansa',
  };

  const teamById = (state, id) => (state.teams || []).find((t) => t.id === id) || null;
  function teamLabel(state, id, { short = false } = {}) {
    const t = teamById(state, id);
    if (!t) return '—';
    return `${t.icon} ${esc(short ? t.name.split(' ')[0] : t.name)}`;
  }
  const myTeam = (state) => (state.me && state.me.teamId ? teamById(state, state.me.teamId) : null);

  // o confronto da criança na rodada
  function myMatch(state) {
    if (!state.round || !state.me) return null;
    return (state.round.matches || []).find((x) => x.sideA === state.me.teamId || x.sideB === state.me.teamId) || null;
  }

  // "Girassóis venceram" / "Empate" / "W.O."
  function outcomeText(state, x) {
    if (!x || !x.outcome) return 'em andamento';
    const A = teamLabel(state, x.sideA);
    const B = x.sideB ? teamLabel(state, x.sideB) : '';
    return {
      a: `🏆 ${A} venceu`, b: `🏆 ${B} venceu`, empate: '🤝 Empate', wo_a: `🏆 ${A} (W.O.)`, wo_b: `🏆 ${B} (W.O.)`,
      nulo: '— ninguém jogou', descanso: `😴 ${A} descansou`, anulado: '✖ anulado',
    }[x.outcome] || x.outcome;
  }
  // para a criança: ganhou, empatou, perdeu
  function myOutcome(state, x) {
    if (!x || !state.me) return null;
    const mineA = x.sideA === state.me.teamId;
    const o = x.outcome;
    if (o === 'descanso') return { kind: 'descanso', text: '😴 Você descansou nesta rodada (vale 1 ponto).' };
    if (o === 'empate' || o === 'nulo') return { kind: 'empate', text: o === 'nulo' ? 'Ninguém jogou este confronto.' : '🤝 Empate!' };
    const won = (mineA && (o === 'a' || o === 'wo_a')) || (!mineA && (o === 'b' || o === 'wo_b'));
    return won ? { kind: 'vitoria', text: '🏆 Vitória!' } : { kind: 'derrota', text: '💪 Não foi dessa vez!' };
  }

  // classificação: <li> com posição, equipe, pontos e V/E/D
  function renderStandings(el, state, { highlight = null } = {}) {
    const rows = state.standings || [];
    el.innerHTML = rows.map((r, i) => {
      const t = teamById(state, r.id);
      if (!t) return '';
      const medal = ['🥇', '🥈', '🥉'][r.posicao - 1] || `${r.posicao}º`;
      return `<li class="mt-st-row${r.id === highlight ? ' is-me' : ''}" style="--i:${Math.min(i, 20)};--team:var(--${t.color || 'violet'})">
        <span class="mt-st-pos">${medal}</span>
        <span class="mt-st-team">${esc(t.icon)} ${esc(t.name)}</span>
        <span class="mt-st-wdl" title="vitórias, empates, derrotas">${r.vitorias}V ${r.empates}E ${r.derrotas}D</span>
        <span class="mt-st-pts"><b>${r.pontos}</b><small>pts</small></span>
      </li>`;
    }).join('');
  }

  // cartões das equipes (com os integrantes)
  function renderTeams(el, state, { meId = null, extra = null } = {}) {
    el.innerHTML = (state.teams || []).map((t) => `
      <div class="mt-team" style="--team:var(--${t.color || 'violet'})" data-team="${esc(t.id)}">
        <div class="mt-team-head"><span class="mt-team-icon">${esc(t.icon)}</span><strong>${esc(t.name)}</strong></div>
        <ul class="mt-members">${t.members.map((p) => `
          <li class="${p.studentId === meId ? 'is-me ' : ''}${p.online ? '' : 'is-off '}${p.status !== 'ativo' ? `is-${esc(p.status)}` : ''}" data-student="${esc(p.studentId)}">
            <span class="avatar-badge">${esc(p.avatar)}</span><span class="mt-mname">${esc(p.name)}</span>
            ${p.status === 'dispensado' ? '<small>🙏 dispensado</small>' : !p.online ? '<small>📴</small>' : ''}
            ${extra ? extra(t, p) : ''}
          </li>`).join('')}</ul>
      </div>`).join('');
  }

  function configText(cfg) {
    if (!cfg) return '';
    const names = (cfg.games || []).map((g) => `${gameOf(g).icon} ${gameOf(g).name}`).join(', ');
    return `${FORMATOS[cfg.formato] || cfg.formato} · nível ${cfg.nivel} · ${cfg.rodadas} rodada${cfg.rodadas === 1 ? '' : 's'} · ${ROTACAO[cfg.rotacao] || ''} · ${names}`;
  }

  function joinUrl(code) { return `${location.origin}/jogos/maratona?sala=${encodeURIComponent(code)}`; }

  // contagem regressiva que se atualiza sozinha; devolve "parar"
  function ticker(fn, ms = 250) {
    fn();
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }

  window.MaratonaCommon = {
    esc, syncClock, now, formatTime, loadGames, gameOf, FORMATOS, ROTACAO, STATUS, ENTRY,
    teamById, teamLabel, myTeam, myMatch, outcomeText, myOutcome, renderStandings, renderTeams, configText, joinUrl, ticker,
  };
})();
