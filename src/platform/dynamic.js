// src/platform/dynamic.js
// 🔀 Modo Dinâmico (PLANO_MODO_DINAMICO.md): com ele ligado, ao concluir uma
// fase (≥ 1 ⭐) a criança é levada a uma fase de OUTRO jogo, de dificuldade
// parecida e que ela ainda não jogou (no modo livre, na Maratona ou aqui).
// O "intervalo" diz de quantas em quantas fases concluídas no mesmo jogo ele
// troca. A configuração fica no servidor, por educando, numa linha de
// game_progress com game_id '_dinamico' (nenhum jogo tem esse id: o painel,
// os pontos e a área do professor não a enxergam).
//
// Configuração guardada:
//   { on, games: [ids], interval,            o que a criança escolheu
//     streak, current, last, recent }        o andamento (quantas fases
//                                            seguidas no jogo atual, a última
//                                            fase contada, os últimos jogos)

const progress = require('./progress');
const points = require('./points');

const KEY = '_dinamico';
const INTERVAL = { min: 1, max: 10, default: 1 };
const RECENT = 3; // jogos recentes que perdem a vez quando há outro

// Os jogos que podem entrar: individuais, ativos e com fases (levels.js).
function catalog(registry) {
  return registry.games
    .filter((g) => g.mode === 'solo' && g.status === 'active' && points.levelsOf(g.id))
    .map((g) => ({
      id: g.id, name: g.name, icon: g.icon, subject: g.subject, color: g.color,
      requiresKeyboard: Boolean(g.requiresKeyboard), levels: points.levelsOf(g.id).LEVELS.length,
    }));
}

const defaults = (registry) => ({
  on: false, games: catalog(registry).map((g) => g.id), interval: INTERVAL.default,
  streak: 0, current: null, last: null, recent: [],
});

function getSettings(registry, studentId) {
  const saved = progress.getProgress(studentId, KEY) || {};
  const ids = new Set(catalog(registry).map((g) => g.id));
  const out = { ...defaults(registry), ...saved };
  // um jogo que saiu do registro some da escolha
  out.games = (Array.isArray(out.games) ? out.games : []).filter((id) => ids.has(id));
  out.recent = (Array.isArray(out.recent) ? out.recent : []).filter((id) => ids.has(id)).slice(0, RECENT);
  return out;
}

// Só o que a criança escolhe (o andamento fica no servidor).
const publicSettings = ({ on, games, interval }) => ({ on, games, interval });

function saveSettings(registry, studentId, body = {}) {
  const ids = new Set(catalog(registry).map((g) => g.id));
  const old = getSettings(registry, studentId);
  const on = body.on == null ? old.on : body.on;
  if (typeof on !== 'boolean') throw new progress.GameError('CONFIG_INVALIDA', 'Configuração inválida.');
  let games = old.games;
  if (body.games != null) {
    if (!Array.isArray(body.games) || body.games.some((id) => typeof id !== 'string' || !ids.has(id))) {
      throw new progress.GameError('JOGO_INVALIDO', 'Algum desses jogos não pode entrar no Modo Dinâmico.');
    }
    games = [...new Set(body.games)];
  }
  if (on && games.length < 2) throw new progress.GameError('POUCOS_JOGOS', 'Escolha pelo menos 2 jogos.');
  let interval = old.interval;
  if (body.interval != null) {
    interval = Number(body.interval);
    if (!Number.isInteger(interval) || interval < INTERVAL.min || interval > INTERVAL.max) {
      throw new progress.GameError('INTERVALO_INVALIDO', `O intervalo vai de ${INTERVAL.min} a ${INTERVAL.max}.`);
    }
  }
  const next = { ...old, on, games, interval };
  progress.saveProgress(studentId, KEY, next);
  return next;
}

// ---------------- a escolha da próxima fase ----------------

const recOf = (prog, id) => (prog && prog.levels && prog.levels[id]) || null;
const played = (prog, id) => { const r = recOf(prog, id); return Boolean(r && ((r.plays || 0) > 0 || (r.stars || 0) > 0)); };
const starsOf = (prog, id) => { const r = recOf(prog, id); return r ? r.stars || 0 : 0; };
const unlocked = (Levels, prog, id) => (typeof Levels.isUnlocked === 'function' ? Levels.isUnlocked(prog, id) : true);
const clampTier = (t) => Math.max(1, Math.min(4, t));

// Faixas de dificuldade, da melhor para a pior: o mesmo tier, depois ± 1
// (1 ⭐ prefere o de baixo, 3 ⭐ o de cima), depois qualquer um.
function tierBands(tier, stars) {
  const up = clampTier(tier + 1);
  const down = clampTier(tier - 1);
  const near = stars >= 3 ? [up, down] : [down, up];
  return [[tier], ...[...new Set(near)].filter((t) => t !== tier).map((t) => [t]), [1, 2, 3, 4]];
}

function describe(game, Levels, level, reason) {
  const world = Levels.getWorld ? Levels.getWorld(level.world) : null;
  return {
    gameId: game.id, gameName: game.name, gameIcon: game.icon,
    levelId: level.id, title: level.title, number: level.index + 1,
    worldName: world ? world.name : null, worldIcon: world ? world.icon || null : null,
    tier: points.tierOf(Levels, level), reason,
  };
}

// A primeira fase de cada jogo (na ordem dele) que passa no filtro, nesta
// faixa de tier. Devolve [{ game, Levels, level, pos }].
function candidates(games, progressAll, ok, band) {
  const out = [];
  for (const game of games) {
    const Levels = points.levelsOf(game.id);
    const prog = progressAll[game.id] || null;
    const level = Levels.LEVELS.find((l) => band.includes(points.tierOf(Levels, l))
      && unlocked(Levels, prog, l.id) && ok(prog, l));
    if (level) out.push({ game, Levels, level, pos: level.index / Math.max(1, Levels.LEVELS.length - 1) });
  }
  return out;
}

// Entre os jogos com candidata, sorteia: os recentes perdem a vez (se houver
// outro) e a posição relativa mais perto da atual pesa mais.
function choose(list, { recent, pos, rng }) {
  const fresh = list.filter((c) => !recent.includes(c.game.id));
  const pool = fresh.length ? fresh : list;
  const weights = pool.map((c) => 1 / (1 + 4 * Math.abs(c.pos - pos)));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function search(games, progressAll, ok, { tier, stars, recent, pos, rng }) {
  for (const band of tierBands(tier, stars)) {
    const list = candidates(games, progressAll, ok, band);
    if (list.length) return choose(list, { recent, pos, rng });
  }
  return null;
}

// Função pura: a próxima fase depois de concluir `from` e o andamento novo.
//   settings     getSettings(...)
//   gamesById    { id: entrada do registro } (os jogos do catálogo)
//   progressAll  progress.allProgress(educando)
//   from         { gameId, levelId, stars, noKeyboard }  noKeyboard: aparelho sem
//                teclado de verdade (tablet): não sugere jogos que precisam dele
// Devolve { next, reason, state } — reason:
//   'DESLIGADO' | 'NAO_CONCLUIU'   nada muda
//   'MESMO_JOGO'     ainda não deu o intervalo: fase seguinte do mesmo jogo
//   'TROCA'          fase nova de outro jogo
//   'SO_ESTE_JOGO'   só sobrou fase nova no jogo atual
//   'MELHORAR'       tudo jogado: uma fase com menos de 3 ⭐
//   'TUDO_COMPLETO'  next = null
function pickNext({ settings, gamesById, progressAll, from, rng = Math.random }) {
  const state = { streak: settings.streak || 0, current: settings.current || null, last: settings.last || null, recent: [...(settings.recent || [])] };
  const same = { next: null, state };
  if (!settings.on) return { ...same, reason: 'DESLIGADO' };
  const game = gamesById[from.gameId];
  const Levels = game && points.levelsOf(game.id);
  const level = Levels && Levels.getLevel(String(from.levelId || ''));
  if (!level) throw new progress.GameError('FASE_INVALIDA', 'Essa fase não existe.');
  // concluída = o progresso guardado tem pelo menos 1 ⭐ nesta fase
  if (starsOf(progressAll[game.id], level.id) < 1) return { ...same, reason: 'NAO_CONCLUIU' };
  const stars = Math.max(1, Math.min(3, Math.floor(Number(from.stars) || starsOf(progressAll[game.id], level.id))));

  // a mesma fase de novo seguida ("jogar de novo" ou um pedido repetido) não
  // conta outra vez: devolve a mesma sugestão, se ela ainda for nova
  const last = state.last;
  if (last && last.gameId === game.id && last.levelId === level.id) {
    const n = last.next;
    const NL = n && gamesById[n.gameId] && points.levelsOf(n.gameId);
    if (n && NL && NL.getLevel(n.levelId) && !played(progressAll[n.gameId], n.levelId)) return { next: n, reason: n.reason, state };
  } else {
    if (state.current !== game.id) { state.current = game.id; state.streak = 0; }
    state.streak += 1;
  }
  const remember = (out) => { state.last = { gameId: game.id, levelId: level.id, next: out.next }; return out; };

  const chosen = settings.games.filter((id) => gamesById[id]);
  const fits = (id) => !(from.noKeyboard && gamesById[id].requiresKeyboard);
  const others = chosen.filter((id) => id !== game.id && fits(id)).map((id) => gamesById[id]);
  const tier = points.tierOf(Levels, level);
  const pos = level.index / Math.max(1, Levels.LEVELS.length - 1);
  const opts = { tier, stars, recent: state.recent, pos, rng };
  const isNew = (prog, l) => !played(prog, l.id);

  // ainda não deu o intervalo (e o jogo está na escolha): a próxima fase nova deste jogo
  if (chosen.includes(game.id) && state.streak < settings.interval) {
    const prog = progressAll[game.id] || null;
    const after = Levels.LEVELS.slice(level.index + 1).find((l) => unlocked(Levels, prog, l.id) && isNew(prog, l));
    if (after) return remember({ next: describe(game, Levels, after, 'MESMO_JOGO'), reason: 'MESMO_JOGO', state });
  }

  const switchTo = (c, reason) => {
    if (c.game.id !== game.id) {
      state.recent = [game.id, ...state.recent.filter((id) => id !== game.id)].slice(0, RECENT);
      state.current = c.game.id;
      state.streak = 0;
    }
    return remember({ next: describe(c.game, c.Levels, c.level, reason), reason, state });
  };
  let c = search(others, progressAll, isNew, opts);
  if (c) return switchTo(c, 'TROCA');
  if (chosen.includes(game.id)) {
    c = search([game], progressAll, isNew, opts);
    if (c) return switchTo(c, 'SO_ESTE_JOGO');
  }
  const toImprove = (prog, l) => starsOf(prog, l.id) < 3;
  c = search(others, progressAll, toImprove, opts)
    || (chosen.includes(game.id) ? search([game], progressAll, (prog, l) => toImprove(prog, l) && l.id !== level.id, opts) : null);
  if (c) return switchTo(c, 'MELHORAR');
  return remember({ next: null, reason: 'TUDO_COMPLETO', state });
}

// O pedido da tela de resultado: escolhe e guarda o andamento.
function next(registry, studentId, from, rng) {
  const settings = getSettings(registry, studentId);
  const gamesById = Object.fromEntries(catalog(registry).map((g) => [g.id, registry.games.find((x) => x.id === g.id)]));
  const out = pickNext({ settings, gamesById, progressAll: progress.allProgress(studentId), from: from || {}, rng });
  if (!['DESLIGADO', 'NAO_CONCLUIU'].includes(out.reason)) progress.saveProgress(studentId, KEY, { ...settings, ...out.state });
  return { next: out.next, reason: out.reason };
}

module.exports = { KEY, INTERVAL, catalog, getSettings, publicSettings, saveSettings, pickNext, next, tierBands };
