// src/marathon/manager.js
// 🏃 Modo Maratona: o gerenciador (a máquina de estados). Não sabe nada de
// sockets: recebe as ações (criar, entrar, montar equipes, começar, votar,
// mandar resultado, passar de rodada...) e devolve o estado. Cada mudança
// é gravada no banco (store.js) numa transação; a memória só guarda a
// cópia da maratona e os relógios. Ao subir, restore() recarrega as
// maratonas em andamento e os prazos continuam (com 60 s de tolerância se
// passaram com o servidor desligado).
//
// Estados da maratona: sala_de_espera → (votacao →) preparando → disputa →
// entre_rodadas → ... → encerrada (e pausada / cancelada).
// Rodada: votacao → preparando → disputa → apurada (ou anulada).
// Confronto (match): aberto → resolvido (ou anulado). Entrada (entry, um
// educando num confronto): escalado → concluida | tempo_esgotado | ausente
// | dispensado | descanso.
//
// Relógios: checkTimers(agora) faz o que venceu (fechar a votação, largar a
// rodada, encerrar no prazo, passar sozinho de rodada); em produção um
// setInterval chama a cada segundo (startClock).

const crypto = require('crypto');
const { generateId, generateToken } = require('../platform/idGenerator');
const progress = require('../platform/progress');
const points = require('../platform/points');
const catalog = require('./catalog');
const competitive = require('./competitive');
const balance = require('./balance');
const pairing = require('./pairing');
const rotation = require('./rotation');
const scoring = require('./scoring');
const store = require('./store');
const { rng: seededRng } = require('../../public/js/shared/rng.js');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_PLAYERS = 40;
const MAX_ROUNDS = 20;
const PREP_MS = 8000; // contagem antes da largada
const GRACE_MS = 5000; // resultado que chega logo depois do prazo ainda vale
const RESTART_GRACE_MS = 60000; // prazo que venceu com o servidor desligado
const AUTO_NEXT_MS = 20000; // passagem automática de rodada (opção)
const VOTE_MS = { min: 15000, max: 60000, default: 30000 };
const ACTIVE = new Set(['sala_de_espera', 'votacao', 'preparando', 'disputa', 'entre_rodadas', 'pausada']);
const TEAM_LOOKS = [
  ['Girassóis', '🌻', 'yellow'], ['Foguetes', '🚀', 'red'], ['Tubarões', '🦈', 'sky'], ['Corujas', '🦉', 'violet'],
  ['Dragões', '🐉', 'green'], ['Abelhas', '🐝', 'orange'], ['Pandas', '🐼', 'pink'], ['Raios', '⚡', 'yellow'],
  ['Cometas', '☄️', 'orange'], ['Golfinhos', '🐬', 'sky'], ['Tigres', '🐯', 'orange'], ['Joaninhas', '🐞', 'red'],
  ['Unicórnios', '🦄', 'pink'], ['Polvos', '🐙', 'violet'], ['Cactos', '🌵', 'green'], ['Estrelas', '⭐', 'yellow'],
  ['Pinguins', '🐧', 'sky'], ['Leões', '🦁', 'orange'], ['Sapos', '🐸', 'green'], ['Baleias', '🐋', 'sky'],
];

class MarathonError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const fail = (code, message) => { throw new MarathonError(code, message); };
const hash = (t) => crypto.createHash('sha256').update(String(t || '')).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const clean = (s, max) => String(s == null ? '' : s).normalize('NFC').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const int = (v, lo, hi, def) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };

function createMarathonManager(registry, { matchManager = null, now = () => Date.now(), onChange = () => {}, isOnline = () => true } = {}) {
  const live = new Map(); // id -> maratona (cópia em memória)
  const byCode = new Map(); // código -> id
  const game = (id) => registry.games.find((g) => g.id === id) || null;

  // ---------------- configuração ----------------
  function checkConfig(raw, base = {}) {
    const c = { ...base, ...(raw || {}) };
    const out = {
      games: Array.isArray(c.games) ? [...new Set(c.games.map(String))] : [],
      topics: {},
      formato: String(c.formato || 'solo'),
      nivel: int(c.nivel, 1, 4, 1),
      rotacao: String(c.rotacao || 'aleatorio'),
      ordem: Array.isArray(c.ordem) ? c.ordem.map(String).slice(0, MAX_ROUNDS) : [],
      rodadas: int(c.rodadas, 1, MAX_ROUNDS, 5),
      balancear: c.balancear !== false,
      tempoMin: int(c.tempoMin, 2, 10, 5),
      votoSeg: int(c.votoSeg, VOTE_MS.min / 1000, VOTE_MS.max / 1000, VOTE_MS.default / 1000),
      auto: Boolean(c.auto),
      bonus: Boolean(c.bonus),
    };
    if (!balance.FORMATOS[out.formato]) fail('FORMATO_INVALIDO', 'Formato desconhecido.');
    if (!rotation.MODOS.includes(out.rotacao)) fail('ROTACAO_INVALIDA', 'Rotação desconhecida.');
    if (c.topics && typeof c.topics === 'object') {
      for (const [g, list] of Object.entries(c.topics)) if (Array.isArray(list)) out.topics[g] = list.map(String).slice(0, 20);
    }
    if (!out.games.length) fail('SEM_JOGOS', 'Escolha pelo menos um jogo.');
    const st = catalog.status(registry, { nivel: out.nivel, topics: out.topics, roundMs: out.tempoMin * 60000 });
    for (const id of out.games) {
      const s = st.find((x) => x.id === id);
      if (!s) fail('JOGO_INVALIDO', `O jogo "${id}" não entra na Maratona.`);
      if (!s.count) fail('JOGO_SEM_FASES', `${s.icon} ${s.name}: ${s.reason}.`);
    }
    if (out.rotacao === 'ordem') {
      out.ordem = out.ordem.filter((g) => out.games.includes(g));
      if (!out.ordem.length) out.ordem = out.games.slice();
    }
    return out;
  }

  // ---------------- memória e gravação ----------------
  function remember(m) {
    live.set(m.id, m);
    byCode.set(m.code, m.id);
    return m;
  }
  function get(code) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
    const id = byCode.get(c) || store.idByCode(c);
    let m = id && live.get(id);
    if (!m && id) {
      // não está na memória: vem do banco (a encerrada fica só para consulta)
      m = store.load(id);
      if (m && ACTIVE.has(m.status)) remember(m);
    }
    if (!m) fail('MARATONA_NAO_ENCONTRADA', 'Não achei essa maratona. Confira o código.');
    return m;
  }
  // grava a maratona e o que mudou, numa transação só; avisa quem escuta
  function commit(m, changed = {}) {
    m.version++;
    store.transaction(() => {
      store.saveMarathon(m);
      for (const t of changed.teams || []) store.saveTeam(m, t);
      for (const p of changed.participants || []) store.saveParticipant(m, p);
      for (const r of changed.rounds || []) store.saveRound(m, r);
      for (const x of changed.matches || []) store.saveMatch(m, x);
      for (const e of changed.entries || []) store.saveEntry(m, e);
    })();
    try { onChange(m); } catch (e) { console.error('[maratona] onChange', e); }
    return m;
  }
  function master(code, token, version) {
    const m = get(code);
    if (!sameHash(hash(token), m.masterHash)) fail('NAO_AUTORIZADO', 'Você não é o dono desta maratona.');
    if (version != null && Number(version) !== m.version) fail('ESTADO_MUDOU', 'A maratona mudou enquanto você clicava. Confira e tente de novo.');
    return m;
  }
  const rngFor = (m, salt) => seededRng((m.seed ^ Math.imul(salt + 1, 0x9E3779B1)) >>> 0);
  const currentRound = (m) => m.rounds.find((r) => r.number === m.currentRound) || null;
  const teamOf = (m, id) => m.teams.find((t) => t.id === id);
  const members = (m, teamId) => m.participants.filter((p) => p.teamId === teamId && p.status !== 'saiu');

  // ---------------- criar e entrar ----------------
  function create(config, { name } = {}) {
    const cfg = checkConfig(config);
    let code;
    do { code = Array.from(crypto.randomBytes(4), (b) => CODE_CHARS[b % CODE_CHARS.length]).join(''); } while (store.idByCode(code) || byCode.has(code));
    const token = generateToken();
    const m = {
      id: generateId('mt_'), code, name: clean(name, 60) || 'Maratona', status: 'sala_de_espera', config: cfg, masterHash: hash(token),
      version: 0, currentRound: 0, seed: crypto.randomInt(0, 0xFFFFFFFF), state: {}, createdAt: now(), startedAt: null, endedAt: null,
      teams: [], participants: [], rounds: [], matches: [], entries: [],
    };
    remember(m);
    commit(m);
    store.event(m, 'criada', 'professor', { config: cfg });
    return { code, masterToken: token, marathon: m };
  }

  function updateConfig(code, token, raw, { name } = {}) {
    const m = master(code, token);
    if (!ACTIVE.has(m.status)) fail('MARATONA_ENCERRADA', 'A maratona já acabou.');
    if (name != null) m.name = clean(name, 60) || m.name;
    if (m.status === 'sala_de_espera') {
      m.config = checkConfig(raw, m.config);
    } else if (raw) {
      // depois de começar: só o que não muda o que já foi disputado
      const c = m.config;
      if (raw.rodadas != null) c.rodadas = int(raw.rodadas, Math.max(1, m.currentRound), MAX_ROUNDS, c.rodadas);
      if (raw.tempoMin != null) c.tempoMin = int(raw.tempoMin, 2, 10, c.tempoMin);
      if (raw.votoSeg != null) c.votoSeg = int(raw.votoSeg, 15, 60, c.votoSeg);
      if (raw.auto != null) c.auto = Boolean(raw.auto);
      if (raw.bonus != null) c.bonus = Boolean(raw.bonus);
      for (const k of ['games', 'topics', 'formato', 'nivel', 'rotacao', 'ordem', 'balancear']) {
        if (raw[k] != null && JSON.stringify(raw[k]) !== JSON.stringify(c[k])) fail('CONFIG_TRAVADA', 'Depois de começar, só dá para mudar o nome, as rodadas, o tempo, a votação, a passagem automática e o bônus.');
      }
    }
    store.event(m, 'config', 'professor', { config: m.config });
    return commit(m);
  }

  // student: { id, name, avatar, className }
  function join(code, student) {
    const m = get(code);
    if (!ACTIVE.has(m.status)) fail('MARATONA_ENCERRADA', 'Essa maratona já acabou.');
    let p = m.participants.find((x) => x.studentId === student.id);
    if (p) {
      if (p.status === 'saiu') { p.status = 'ativo'; commit(m, { participants: [p] }); }
      return p;
    }
    if (m.participants.filter((x) => x.status !== 'saiu').length >= MAX_PLAYERS) fail('MARATONA_LOTADA', 'A maratona está cheia.');
    p = {
      studentId: student.id, name: student.name, avatar: student.avatar, className: student.className || null,
      teamId: null, status: 'ativo', strength: null, joinedAt: now(),
    };
    m.participants.push(p);
    const changed = { participants: [p] };
    // depois de começar: entra na equipe com menos gente (ou vira um lado no Solo)
    if (m.status !== 'sala_de_espera') {
      p.strength = strengthsOf([p])[p.studentId];
      if (m.config.formato === 'solo') {
        const t = newTeam(m, m.teams.length, p);
        m.teams.push(t);
        m.state.order = [...(m.state.order || []), t.id];
        changed.teams = [t];
      } else {
        const ids = m.teams.map((t) => members(m, t.id).map((x) => x.studentId));
        const st = Object.fromEntries(m.participants.map((x) => [x.studentId, x.strength ?? 50]));
        p.teamId = m.teams[balance.lateTeam(ids, st)].id;
      }
      store.event(m, 'entrou_depois', p.studentId, { teamId: p.teamId });
    }
    commit(m, changed);
    return p;
  }

  // sair da sala de espera (depois de começar, continua na equipe como ausente)
  function leave(code, studentId) {
    const m = get(code);
    const p = m.participants.find((x) => x.studentId === studentId);
    if (!p) return m;
    if (m.status === 'sala_de_espera') {
      m.participants = m.participants.filter((x) => x !== p);
      store.deleteParticipant(m, studentId);
      return commit(m);
    }
    return m;
  }

  // ---------------- equipes ----------------
  function strengthsOf(list) {
    return balance.strengths(list.map((p) => { const s = points.byStudent(p.studentId); return { id: p.studentId, points: s.total, levelsDone: s.levelsDone }; }));
  }
  function newTeam(m, i, soloStudent) {
    if (soloStudent) return { id: generateId('mtt_'), name: soloStudent.name, icon: soloStudent.avatar, color: TEAM_LOOKS[i % TEAM_LOOKS.length][2], position: null, solo: soloStudent.studentId };
    const [name, icon, color] = TEAM_LOOKS[i % TEAM_LOOKS.length];
    return { id: generateId('mtt_'), name: i < TEAM_LOOKS.length ? name : `${name} ${Math.floor(i / TEAM_LOOKS.length) + 1}`, icon, color, position: null };
  }
  // monta as equipes: equilibradas (força) ou sorteadas
  function makeTeams(m, how) {
    const players = m.participants.filter((p) => p.status !== 'saiu');
    const st = strengthsOf(players);
    players.forEach((p) => { p.strength = st[p.studentId]; });
    let groups;
    try {
      groups = how === 'sortear'
        ? balance.shuffle(players.map((p) => ({ id: p.studentId })), m.config.formato, seededRng(crypto.randomInt(0, 0xFFFFFFFF)))
        : balance.form(players.map((p) => ({ id: p.studentId, name: p.name, strength: p.strength })), m.config.formato);
    } catch (e) {
      if (e instanceof balance.BalanceError) fail(e.code, e.message);
      throw e;
    }
    store.deleteTeams(m);
    m.teams = groups.map((ids, i) => {
      const solo = m.config.formato === 'solo' ? players.find((p) => p.studentId === ids[0]) : null;
      const t = newTeam(m, i, solo);
      ids.forEach((sid) => { players.find((p) => p.studentId === sid).teamId = t.id; });
      return t;
    });
    m.state.teamsBy = how;
    store.event(m, 'equipes', 'professor', { how, teams: m.teams.map((t) => ({ id: t.id, members: members(m, t.id).map((p) => p.studentId) })) });
    return { teams: m.teams, participants: players };
  }
  function teams(code, token, how = 'equilibrar') {
    const m = master(code, token);
    if (m.status !== 'sala_de_espera') fail('JA_COMECOU', 'As equipes só mudam antes de começar.');
    return commit(m, makeTeams(m, how === 'sortear' ? 'sortear' : 'equilibrar'));
  }
  // o professor troca alguém de equipe (antes de começar)
  function moveStudent(code, token, studentId, teamId) {
    const m = master(code, token);
    if (m.status !== 'sala_de_espera') fail('JA_COMECOU', 'As equipes só mudam antes de começar.');
    const p = m.participants.find((x) => x.studentId === studentId);
    if (!p || !teamOf(m, teamId) || m.config.formato === 'solo') fail('TROCA_INVALIDA', 'Não dá para fazer essa troca.');
    p.teamId = teamId;
    m.state.teamsBy = 'professor';
    store.event(m, 'troca', 'professor', { studentId, teamId });
    return commit(m, { participants: [p] });
  }

  // ---------------- começar ----------------
  function start(code, token, { gameId = null } = {}) {
    const m = master(code, token);
    if (m.status !== 'sala_de_espera') fail('JA_COMECOU', 'A maratona já começou.');
    if (m.config.rotacao === 'professor' && !m.config.games.includes(gameId)) fail('ESCOLHA_O_JOGO', 'Escolha o jogo da primeira rodada.');
    const changed = { participants: [], teams: [] };
    // equipes: as que o professor montou, senão equilibradas (ou sorteadas)
    const loose = m.participants.filter((p) => p.status !== 'saiu' && !p.teamId);
    if (!m.teams.length || loose.length || m.config.formato === 'solo') {
      const made = makeTeams(m, m.config.balancear ? 'equilibrar' : 'sortear');
      changed.teams = made.teams;
      changed.participants = made.participants;
    }
    const sides = m.teams.filter((t) => members(m, t.id).length);
    if (sides.length < 2) fail('POUCOS_LADOS', 'São precisos pelo menos 2 lados para começar.');
    // ordem fixa dos lados (pareamento) e o sorteio de desempate, gravados
    const r = rngFor(m, 999);
    m.state.order = r.shuffle(sides.map((t) => t.id));
    m.state.tiebreak = Object.fromEntries(r.shuffle(sides.map((t) => t.id)).map((id, i) => [id, i]));
    m.startedAt = now();
    store.event(m, 'comecou', 'professor', { order: m.state.order, tiebreak: m.state.tiebreak });
    commit(m, { teams: m.teams, participants: m.participants });
    return openRound(m, gameId, 'professor');
  }

  // ---------------- rodadas ----------------
  function nextRound(code, token, { gameId = null } = {}) {
    const m = master(code, token);
    if (m.status === 'pausada') fail('PAUSADA', 'A maratona está pausada.');
    if (!m.startedAt) fail('NAO_COMECOU', 'A maratona ainda não começou.');
    if (!ACTIVE.has(m.status)) fail('MARATONA_ENCERRADA', 'A maratona já acabou.');
    const cur = currentRound(m);
    if (cur && !['apurada', 'anulada'].includes(cur.status)) fail('RODADA_EM_ANDAMENTO', 'A rodada atual ainda não acabou.');
    if (m.currentRound >= m.config.rodadas) return finish(m, 'professor');
    return openRound(m, gameId, 'professor');
  }

  function openRound(m, gameId, actor) {
    const number = m.currentRound + 1;
    const history = m.rounds.filter((r) => r.gameId && r.status !== 'anulada').map((r) => r.gameId);
    const r = rngFor(m, number);
    if (m.config.rotacao === 'professor' && !m.config.games.includes(gameId)) fail('ESCOLHA_O_JOGO', 'Escolha o jogo desta rodada.');
    const round = { id: generateId('mtr_'), number, status: 'votacao', vote: {}, gameId: null };
    m.currentRound = number;
    m.rounds.push(round);
    delete m.state.autoAt;
    const { rotacao, games } = m.config;
    if (rotacao === 'professor') {
      return prepareRound(m, round, gameId, 'professor', actor);
    }
    if (rotacao === 'votacao' && games.length > 1) {
      round.vote = { options: rotation.voteOptions({ games, history, rng: r }), votes: {}, until: now() + m.config.votoSeg * 1000 };
      round.deadlineAt = round.vote.until;
      m.status = 'votacao';
      store.event(m, 'votacao', actor, { options: round.vote.options }, round.id);
      return commit(m, { rounds: [round] });
    }
    const g = rotacao === 'votacao' ? games[0] : rotation.nextGame({ modo: rotacao, games, ordem: m.config.ordem, history, rng: r });
    return prepareRound(m, round, g, rotacao, actor);
  }

  function vote(code, studentId, gameId) {
    const m = get(code);
    const round = currentRound(m);
    if (m.status !== 'votacao' || !round || round.status !== 'votacao') fail('SEM_VOTACAO', 'Não tem votação agora.');
    if (!m.participants.some((p) => p.studentId === studentId && p.status !== 'saiu')) fail('NAO_PARTICIPA', 'Você não está nesta maratona.');
    if (!round.vote.options.includes(gameId)) fail('VOTO_INVALIDO', 'Esse jogo não está na votação.');
    round.vote.votes[studentId] = gameId; // pode trocar até o fim
    return commit(m, { rounds: [round] });
  }
  function closeVote(m, round, actor = 'sistema') {
    const t = rotation.tally(round.vote.votes, round.vote.options, rngFor(m, round.number * 7 + 3));
    round.vote.result = t;
    store.event(m, 'votou', actor, t, round.id);
    return prepareRound(m, round, t.winner, 'votacao', actor);
  }
  // o professor encerra a votação antes do tempo
  function endVote(code, token) {
    const m = master(code, token);
    const round = currentRound(m);
    if (m.status !== 'votacao' || !round) fail('SEM_VOTACAO', 'Não tem votação agora.');
    return closeVote(m, round, 'professor');
  }

  function prepareRound(m, round, gameId, chosenBy, actor) {
    const g = game(gameId);
    const info = g && catalog.describe(g);
    const roundMsMax = m.config.tempoMin * 60000;
    const eligible = info ? catalog.eligible(info, { nivel: m.config.nivel, topics: m.config.topics[gameId], roundMs: roundMsMax }) : [];
    if (!eligible.length) fail('JOGO_SEM_FASES', 'Esse jogo não tem fases para esta configuração.');
    const used = m.rounds.filter((r) => r.gameId === gameId && r.entryKey && r.status !== 'anulada').map((r) => r.entryKey);
    const r = rngFor(m, round.number * 13 + 5);
    const entry = rotation.nextLevel(eligible, used, r);
    Object.assign(round, {
      gameId, entryKey: entry.key, levelId: entry.levelId || null, variant: entry.variant || null, kind: entry.kind,
      title: `${info.icon} ${info.name} · ${entry.title}`, seed: r.int(1, 0xFFFFFFF0), chosenBy, status: 'preparando',
    });
    const roundMs = entry.kind === 'duelo' && entry.capped ? roundMsMax : Math.max(120000, Math.min(roundMsMax, Math.round((entry.estMs || roundMsMax) * 1.5)));
    round.startsAt = now() + PREP_MS;
    round.deadlineAt = round.startsAt + roundMs;
    m.status = 'preparando';
    const made = pairUp(m, round, g);
    store.event(m, 'rodada', actor, { number: round.number, gameId, entry: entry.key, seed: round.seed, chosenBy, matches: made.matches.map((x) => [x.sideA, x.sideB]) }, round.id);
    commit(m, { rounds: [round], matches: made.matches, entries: made.entries });
    // duelos: as partidas pela rede já ficam prontas para os dois entrarem
    for (const e of made.duels) startDuel(m, round, e);
    if (made.duels.length) commit(m, { entries: made.duels.flat() });
    return m;
  }

  // confrontos e entradas da rodada
  function pairUp(m, round, g) {
    const active = (teamId) => members(m, teamId).filter((p) => p.status === 'ativo' || p.status === 'dispensado');
    const order = (m.state.order || []).filter((id) => active(id).length);
    const prev = m.matches.filter((x) => x.status === 'resolvido' && x.outcome !== 'anulado');
    const played = new Set(prev.filter((x) => x.sideB).map((x) => pairing.key(x.sideA, x.sideB)));
    const byes = new Set(prev.filter((x) => !x.sideB).map((x) => x.sideA));
    const table = scoring.standings(m.teams.filter((t) => order.includes(t.id)), prev, m.state.tiebreak);
    const pairs = pairing.pairRound(round.number - 1, { formato: m.config.formato, order, standings: table.map((x) => x.id), played, byes });
    const matches = [];
    const entries = [];
    const duels = [];
    const entryFor = (match, p, extra = {}) => ({
      id: generateId('mte_'), roundId: round.id, matchId: match.id, studentId: p.studentId, teamId: p.teamId, opponentId: null,
      bgMatchId: null, status: p.status === 'dispensado' ? 'dispensado' : 'escalado', seen: false, ...extra,
    });
    for (const [a, b] of pairs) {
      const match = { id: generateId('mtm_'), roundId: round.id, sideA: a, sideB: b, kind: round.kind, status: 'aberto', detail: {} };
      matches.push(match);
      if (!b) { // descanso
        Object.assign(match, { status: 'resolvido', outcome: 'descanso', resolvedBy: 'auto', resolvedAt: now() });
        continue;
      }
      if (round.kind === 'corrida') {
        for (const p of [...active(a), ...active(b)]) entries.push(entryFor(match, p));
      } else {
        // duelo: cada um contra um do outro lado, pela força; quem sobra descansa
        const byStrength = (list) => list.slice().sort((x, y) => (y.strength ?? 50) - (x.strength ?? 50) || x.name.localeCompare(y.name, 'pt-BR'));
        const A = byStrength(active(a).filter((p) => p.status === 'ativo'));
        const B = byStrength(active(b).filter((p) => p.status === 'ativo'));
        const n = Math.min(A.length, B.length);
        for (let i = 0; i < n; i++) {
          const ea = entryFor(match, A[i], { opponentId: B[i].studentId, board: i });
          const eb = entryFor(match, B[i], { opponentId: A[i].studentId, board: i });
          entries.push(ea, eb);
          duels.push([ea, eb]);
        }
        for (const p of [...A.slice(n), ...B.slice(n), ...active(a).filter((x) => x.status === 'dispensado'), ...active(b).filter((x) => x.status === 'dispensado')]) {
          entries.push(entryFor(match, p, { status: p.status === 'dispensado' ? 'dispensado' : 'descanso' }));
        }
      }
    }
    m.matches.push(...matches);
    m.entries.push(...entries);
    return { matches, entries, duels };
  }

  function startDuel(m, round, [ea, eb]) {
    if (!matchManager) return;
    const sa = m.participants.find((p) => p.studentId === ea.studentId);
    const sb = m.participants.find((p) => p.studentId === eb.studentId);
    const asStudent = (p) => ({ id: p.studentId, name: p.name, avatar: p.avatar, className: p.className });
    const id = matchManager.createDuel(round.gameId, round.variant, [asStudent(sa), asStudent(sb)], {
      onEnd: (res) => duelEnded(m.id, ea.id, eb.id, res),
    });
    ea.bgMatchId = id;
    eb.bgMatchId = id;
  }

  function duelEnded(marathonId, ida, idb, res) {
    const m = live.get(marathonId);
    if (!m) return;
    const ea = m.entries.find((e) => e.id === ida);
    const eb = m.entries.find((e) => e.id === idb);
    if (!ea || !eb || ea.status === 'concluida') return;
    const t = now();
    const round = m.rounds.find((r) => r.id === ea.roundId);
    for (const [e, seat] of [[ea, 0], [eb, 1]]) {
      e.status = 'concluida';
      e.stars = 0;
      e.score = res.winner === seat ? 1 : res.winner === null ? 0.5 : 0;
      e.timeMs = round && round.startsAt ? Math.max(0, t - round.startsAt) : null;
      e.result = { winner: res.winner, reason: res.reason, moves: res.moves };
      e.submittedAt = t;
      // quem nunca apareceu e perdeu por abandono/prazo conta como ausente
      if (!e.seen && res.reason !== 'fim' && e.score < 1) e.status = 'ausente';
    }
    commit(m, { entries: [ea, eb] });
    maybeResolve(m, 'auto');
  }

  // a criança abriu a maratona durante a rodada (o socket avisa)
  function seen(code, studentId) {
    const m = get(code);
    const round = currentRound(m);
    if (!round) return m;
    const mine = m.entries.filter((e) => e.roundId === round.id && e.studentId === studentId && !e.seen);
    if (!mine.length) return m;
    mine.forEach((e) => { e.seen = true; });
    return commit(m, { entries: mine });
  }

  // ---------------- resultados ----------------
  // o resultado de uma corrida que a criança mandou (o corpo do jogo)
  function submit(code, studentId, body) {
    const m = get(code);
    const round = currentRound(m);
    if (!round || round.kind !== 'corrida') fail('SEM_CORRIDA', 'Não tem corrida agora.');
    const e = m.entries.find((x) => x.roundId === round.id && x.studentId === studentId);
    if (!e) fail('NAO_ESCALADO', 'Você não está nesta rodada.');
    if (e.status === 'concluida') return { entry: e, duplicate: true }; // reenvio: o mesmo de antes
    if (e.status !== 'escalado') fail('ENTRADA_FECHADA', 'Sua participação nesta rodada já foi encerrada.');
    const t = now();
    if (m.status !== 'disputa' && m.status !== 'preparando') fail('FORA_DO_TEMPO', 'A rodada não está aberta.');
    if (t > round.deadlineAt + GRACE_MS) fail('FORA_DO_TEMPO', 'O tempo da rodada acabou.');
    const g = game(round.gameId);
    let out;
    try {
      out = competitive.validate(g, { levelId: round.levelId, seed: round.seed }, body);
    } catch (err) {
      if (err && err.code) fail(err.code, err.message || 'Resultado inválido.');
      throw err;
    }
    Object.assign(e, {
      status: 'concluida', seen: true, stars: out.perf.estrelas, quality: out.perf.qualidade, score: out.perf.nota,
      timeMs: Math.max(0, t - (round.startsAt || t)), submittedAt: t,
      result: { stars: out.result.stars, accuracy: out.result.accuracy ?? null, details: out.result.details || {} },
    });
    // também vai para o progresso normal (estrelas e pontos globais), sem duplicar
    try { progress.recordResult(studentId, g, out.result, { attemptId: `mt:${e.id}`, source: 'maratona' }); } catch (err) { console.error('[maratona] progresso', err); }
    commit(m, { entries: [e] });
    maybeResolve(m, 'auto');
    return { entry: e, duplicate: false };
  }

  // todas as entradas da rodada decididas? então apura
  function maybeResolve(m, by) {
    const round = currentRound(m);
    if (!round || !['preparando', 'disputa'].includes(round.status)) return;
    const pending = m.entries.some((e) => e.roundId === round.id && e.status === 'escalado');
    if (!pending) resolveRound(m, by);
  }

  // prazo da rodada: quem não terminou fica com 0; duelos pela regra do jogo
  function timeUp(m, round) {
    const changed = [];
    for (const e of m.entries.filter((x) => x.roundId === round.id && x.status === 'escalado')) {
      if (round.kind === 'duelo' && e.bgMatchId && matchManager) continue; // decidido abaixo
      e.status = e.seen || isOnline(e.studentId) ? 'tempo_esgotado' : 'ausente';
      changed.push(e);
    }
    if (changed.length) commit(m, { entries: changed });
    if (round.kind === 'duelo' && matchManager) {
      const ids = [...new Set(m.entries.filter((x) => x.roundId === round.id && x.status === 'escalado' && x.bgMatchId).map((x) => x.bgMatchId))];
      for (const id of ids) matchManager.timeUp(id); // chama duelEnded
    }
    resolveRound(m, 'prazo');
  }

  function resolveRound(m, by) {
    const round = currentRound(m);
    if (!round || round.status === 'apurada' || round.status === 'anulada') return m;
    const t = now();
    const changed = [];
    for (const x of m.matches.filter((mm) => mm.roundId === round.id && mm.status === 'aberto')) {
      decide(m, round, x, by, t);
      changed.push(x);
    }
    round.status = 'apurada';
    round.endedAt = t;
    const last = round.number >= m.config.rodadas;
    store.event(m, 'apurada', by, { number: round.number, matches: changed.map((x) => ({ id: x.id, outcome: x.outcome, a: x.scoreA, b: x.scoreB })) }, round.id);
    if (last) return finish(m, by, { rounds: [round], matches: changed });
    m.status = 'entre_rodadas';
    if (m.config.auto) m.state.autoAt = t + AUTO_NEXT_MS;
    return commit(m, { rounds: [round], matches: changed });
  }

  function decide(m, round, x, by, t) {
    const es = m.entries.filter((e) => e.matchId === x.id);
    const side = (teamId) => es.filter((e) => e.teamId === teamId).map((e) => ({ ...e, timeMs: e.timeMs ?? Infinity }));
    if (x.kind === 'corrida') {
      const d = scoring.decideRace(side(x.sideA), side(x.sideB));
      Object.assign(x, { outcome: d.outcome, scoreA: d.a.nota, scoreB: d.b.nota, timeA: d.a.tempo, timeB: d.b.tempo });
      x.detail = { estrelasA: d.a.estrelas, estrelasB: d.b.estrelas };
      if (m.config.bonus) { x.bonusA = d.a.estrelas >= 3 ? 1 : 0; x.bonusB = d.b.estrelas >= 3 ? 1 : 0; }
    } else {
      const boards = {};
      for (const e of es.filter((y) => y.opponentId)) {
        const k = e.bgMatchId || e.id;
        boards[k] = boards[k] || { winner: null, absentA: false, absentB: false };
        const isA = e.teamId === x.sideA;
        if (e.score === 1) boards[k].winner = isA ? 'a' : 'b';
        if (e.status === 'ausente') boards[k][isA ? 'absentA' : 'absentB'] = true;
      }
      const d = scoring.decideDuels(Object.values(boards));
      Object.assign(x, { outcome: d.outcome, scoreA: d.a.vitorias, scoreB: d.b.vitorias });
      x.detail = { boards: Object.keys(boards).length };
    }
    Object.assign(x, { status: 'resolvido', resolvedBy: by, resolvedAt: t });
  }

  // ---------------- ações do professor ----------------
  function resolveMatch(code, token, matchId, outcome, motivo = '') {
    const m = master(code, token);
    const x = m.matches.find((mm) => mm.id === matchId);
    const round = x && m.rounds.find((r) => r.id === x.roundId);
    if (!x || !round || round.number !== m.currentRound) fail('CONFRONTO_INVALIDO', 'Só dá para resolver os confrontos da rodada atual.');
    if (!['a', 'b', 'empate', 'wo_a', 'wo_b', 'nulo'].includes(outcome) || !x.sideB) fail('RESULTADO_INVALIDO', 'Resultado inválido.');
    // as entradas abertas desse confronto encerram
    const open = m.entries.filter((e) => e.matchId === x.id && e.status === 'escalado');
    open.forEach((e) => { e.status = 'tempo_esgotado'; });
    Object.assign(x, { outcome, status: 'resolvido', resolvedBy: 'professor', resolvedAt: now() });
    x.detail = { ...(x.detail || {}), motivo: clean(motivo, 120) };
    store.event(m, 'professor_resolveu', 'professor', { matchId, outcome, motivo: x.detail.motivo }, round.id);
    commit(m, { matches: [x], entries: open });
    if (['preparando', 'disputa'].includes(round.status) && m.matches.filter((mm) => mm.roundId === round.id).every((mm) => mm.status !== 'aberto')) {
      round.status = 'disputa';
      resolveRound(m, 'professor');
    }
    return m;
  }

  // dispensar quem faltou por motivo justo: sai da média da equipe
  function excuse(code, token, studentId) {
    const m = master(code, token);
    const p = m.participants.find((x) => x.studentId === studentId);
    if (!p) fail('NAO_PARTICIPA', 'Esse educando não está na maratona.');
    p.status = 'dispensado';
    const round = currentRound(m);
    const open = round ? m.entries.filter((e) => e.roundId === round.id && e.studentId === studentId && e.status === 'escalado' && !e.bgMatchId) : [];
    open.forEach((e) => { e.status = 'dispensado'; });
    store.event(m, 'dispensou', 'professor', { studentId });
    commit(m, { participants: [p], entries: open });
    maybeResolve(m, 'auto');
    return m;
  }
  function readmit(code, token, studentId) {
    const m = master(code, token);
    const p = m.participants.find((x) => x.studentId === studentId);
    if (!p) fail('NAO_PARTICIPA', 'Esse educando não está na maratona.');
    p.status = 'ativo';
    return commit(m, { participants: [p] });
  }

  function pause(code, token) {
    const m = master(code, token);
    if (!['entre_rodadas', 'sala_de_espera'].includes(m.status)) fail('NAO_DA_PARA_PAUSAR', 'Dá para pausar entre as rodadas.');
    m.state.pausedFrom = m.status;
    m.status = 'pausada';
    delete m.state.autoAt;
    store.event(m, 'pausou', 'professor');
    return commit(m);
  }
  function resume(code, token) {
    const m = master(code, token);
    if (m.status !== 'pausada') fail('NAO_PAUSADA', 'A maratona não está pausada.');
    m.status = m.state.pausedFrom || 'entre_rodadas';
    delete m.state.pausedFrom;
    store.event(m, 'retomou', 'professor');
    return commit(m);
  }

  // encerrar: a rodada em andamento é apurada como está (ou anulada)
  function end(code, token, { anular = false } = {}) {
    const m = master(code, token);
    if (!ACTIVE.has(m.status)) fail('MARATONA_ENCERRADA', 'A maratona já acabou.');
    const round = currentRound(m);
    if (round && ['votacao', 'preparando', 'disputa'].includes(round.status)) {
      if (anular || round.status === 'votacao') {
        round.status = 'anulada';
        const xs = m.matches.filter((x) => x.roundId === round.id);
        xs.forEach((x) => { x.status = 'anulado'; x.outcome = 'anulado'; });
        for (const e of m.entries.filter((x) => x.roundId === round.id && x.bgMatchId && x.status === 'escalado')) if (matchManager) matchManager.timeUp(e.bgMatchId);
        store.event(m, 'anulou', 'professor', { number: round.number }, round.id);
        commit(m, { rounds: [round], matches: xs });
      } else {
        timeUp(m, round);
        if (m.status === 'encerrada') return m;
      }
    }
    return finish(m, 'professor');
  }

  function finish(m, by, changed = {}) {
    if (m.status === 'encerrada') return m;
    m.status = 'encerrada';
    m.endedAt = now();
    delete m.state.autoAt;
    const table = standingsOf(m);
    table.forEach((row) => { const t = teamOf(m, row.id); if (t) t.position = row.posicao; });
    m.state.final = { standings: table, highlights: highlights(m), at: m.endedAt };
    store.event(m, 'encerrada', by, { standings: table });
    commit(m, { ...changed, teams: m.teams });
    live.delete(m.id); // fica no banco (resultado salvo); sai da memória
    byCode.delete(m.code);
    return m;
  }

  // ---------------- leitura ----------------
  function standingsOf(m) {
    const teamsIn = m.teams.filter((t) => (m.state.order || []).includes(t.id) || members(m, t.id).length);
    return scoring.standings(teamsIn, m.matches.filter((x) => x.status === 'resolvido'), m.state.tiebreak || {});
  }

  // destaques individuais (PLANO, 10.1)
  function highlights(m) {
    const done = m.entries.filter((e) => e.status === 'concluida' && e.stars != null && !e.opponentId);
    const by = {};
    for (const e of done) {
      const s = by[e.studentId] || (by[e.studentId] = { estrelas: 0, tempo: 0, n: 0, qualidade: 0 });
      s.estrelas += e.stars; s.tempo += e.timeMs || 0; s.qualidade += e.quality || 0; s.n++;
    }
    const list = Object.entries(by).map(([id, s]) => ({ id, ...s, tempoMedio: s.tempo / s.n, qualidadeMedia: s.qualidade / s.n }));
    const top = (fn, cmp) => { const l = list.slice().sort(cmp); return l.length ? fn(l[0]) : null; };
    const who = (id) => { const p = m.participants.find((x) => x.studentId === id); return p ? { studentId: id, name: p.name, avatar: p.avatar } : null; };
    return {
      estrelas: top((x) => ({ ...who(x.id), valor: x.estrelas }), (a, b) => b.estrelas - a.estrelas),
      rapido: top((x) => ({ ...who(x.id), valor: Math.round(x.tempoMedio / 1000) }), (a, b) => a.tempoMedio - b.tempoMedio),
      preciso: top((x) => ({ ...who(x.id), valor: Math.round(x.qualidadeMedia * 100) }), (a, b) => b.qualidadeMedia - a.qualidadeMedia),
    };
  }

  // o que cada um vê (sem tokens): role 'professor' | 'educando' | 'telao'
  function view(m, { role = 'telao', studentId = null } = {}) {
    const round = currentRound(m);
    const teamView = (t) => ({
      id: t.id, name: t.name, icon: t.icon, color: t.color, position: t.position,
      members: members(m, t.id).map((p) => ({ studentId: p.studentId, name: p.name, avatar: p.avatar, status: p.status, online: isOnline(p.studentId), ...(role === 'professor' ? { strength: p.strength } : {}) })),
    });
    const me = studentId ? m.participants.find((p) => p.studentId === studentId) : null;
    const roundView = round && {
      number: round.number, status: round.status, gameId: round.gameId, levelId: round.levelId, variant: round.variant,
      kind: round.kind, title: round.title, startsAt: round.startsAt, deadlineAt: round.deadlineAt, chosenBy: round.chosenBy,
      vote: round.vote && round.vote.options ? {
        options: round.vote.options, until: round.vote.until, counts: Object.fromEntries(round.vote.options.map((g) => [g, Object.values(round.vote.votes || {}).filter((v) => v === g).length])),
        mine: studentId ? (round.vote.votes || {})[studentId] || null : null, result: round.vote.result || null,
      } : null,
      matches: m.matches.filter((x) => x.roundId === round.id).map((x) => ({
        id: x.id, sideA: x.sideA, sideB: x.sideB, status: x.status, outcome: x.outcome, scoreA: x.scoreA, scoreB: x.scoreB,
        entries: m.entries.filter((e) => e.matchId === x.id).map((e) => ({
          studentId: e.studentId, teamId: e.teamId, opponentId: e.opponentId, status: e.status, stars: e.stars,
          ...(round.status === 'apurada' || role === 'professor' ? { score: e.score } : {}),
          ...(e.studentId === studentId || role === 'professor' ? { bgMatchId: e.bgMatchId } : {}),
        })),
      })),
    };
    // a competição que o navegador do educando monta (fase e semente só para quem joga)
    let play = null;
    if (me && round && ['preparando', 'disputa'].includes(round.status)) {
      const e = m.entries.find((x) => x.roundId === round.id && x.studentId === studentId);
      if (e) play = { entryStatus: e.status, gameId: round.gameId, kind: round.kind, levelId: round.levelId, seed: round.seed, matchId: e.bgMatchId || null, opponentId: e.opponentId || null };
    }
    return {
      code: m.code, name: m.name, status: m.status, version: m.version,
      config: { ...m.config },
      teams: m.teams.map(teamView),
      waiting: m.participants.filter((p) => !p.teamId && p.status !== 'saiu').map((p) => ({ studentId: p.studentId, name: p.name, avatar: p.avatar, online: isOnline(p.studentId) })),
      round: roundView, play,
      me: me ? { studentId: me.studentId, teamId: me.teamId, status: me.status } : null,
      standings: m.status === 'sala_de_espera' ? [] : standingsOf(m),
      history: m.rounds.filter((r) => r.status === 'apurada').map((r) => ({
        number: r.number, title: r.title, gameId: r.gameId,
        matches: m.matches.filter((x) => x.roundId === r.id).map((x) => ({ sideA: x.sideA, sideB: x.sideB, outcome: x.outcome, scoreA: x.scoreA, scoreB: x.scoreB })),
      })),
      final: m.state.final || null,
      autoAt: m.state.autoAt || null,
      serverNow: now(),
    };
  }
  const viewOf = (code, who) => view(get(code), who);

  // ---------------- relógios e retomada ----------------
  function checkTimers(t = now()) {
    for (const m of [...live.values()]) {
      // vários passos no mesmo instante (ex.: a largada e o prazo já passaram)
      for (let step = 0; step < 4; step++) {
        const v0 = m.version;
        tick(m, t);
        if (m.version === v0 || !ACTIVE.has(m.status)) break;
      }
    }
  }
  function tick(m, t) {
    try {
      const round = currentRound(m);
      if (m.status === 'votacao' && round && round.vote && t >= round.vote.until) closeVote(m, round);
      else if (m.status === 'preparando' && round && t >= round.startsAt) {
        m.status = 'disputa';
        round.status = 'disputa';
        commit(m, { rounds: [round] });
      } else if (m.status === 'disputa' && round && t >= round.deadlineAt) timeUp(m, round);
      else if (m.status === 'entre_rodadas' && m.state.autoAt && t >= m.state.autoAt) {
        delete m.state.autoAt;
        if (m.currentRound >= m.config.rodadas) finish(m, 'sistema');
        else openRound(m, null, 'sistema');
      }
    } catch (e) {
      console.error('[maratona] relógio', m.code, e);
    }
  }
  let clock = null;
  function startClock(ms = 1000) {
    if (clock) return;
    clock = setInterval(() => checkTimers(), ms);
    if (clock.unref) clock.unref();
  }

  function restore() {
    const t = now();
    for (const id of store.activeIds()) {
      const m = store.load(id);
      if (!m) continue;
      const round = m.rounds.find((r) => r.number === m.currentRound);
      // prazos que venceram com o servidor desligado ganham uma tolerância
      if (round && ['preparando', 'disputa'].includes(round.status) && round.deadlineAt && round.deadlineAt < t + RESTART_GRACE_MS) {
        round.deadlineAt = t + RESTART_GRACE_MS;
        store.saveRound(m, round);
      }
      if (round && round.vote && round.status === 'votacao' && round.vote.until < t) round.vote.until = t + 10000;
      // duelos de tabuleiro que estavam na memória se perderam: viram empate no prazo
      if (round && round.kind === 'duelo') {
        for (const e of m.entries.filter((x) => x.roundId === round.id && x.status === 'escalado' && x.bgMatchId)) {
          if (!matchManager || !matchManager.matches.has(e.bgMatchId)) e.bgMatchId = null;
        }
      }
      remember(m);
      store.event(m, 'retomada', 'sistema', { status: m.status });
    }
    return live.size;
  }

  const history = (limit) => store.history(limit);
  const load = (code) => { const id = store.idByCode(code); return id ? store.load(id) : null; };

  return {
    create, updateConfig, join, leave, teams, moveStudent, start, nextRound, vote, endVote, seen, submit,
    resolveMatch, excuse, readmit, pause, resume, end, view, viewOf, get, checkTimers, startClock, restore,
    history, load, standingsOf, MarathonError, live,
  };
}

module.exports = { createMarathonManager, MarathonError, MAX_PLAYERS, MAX_ROUNDS, PREP_MS, GRACE_MS, AUTO_NEXT_MS };
