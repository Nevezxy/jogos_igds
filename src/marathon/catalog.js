// src/marathon/catalog.js
// 🏃 Modo Maratona: o catálogo de jogos e fases que podem cair numa rodada,
// montado a partir do registro (nada escrito à mão aqui). Um jogo entra na
// Maratona quando o módulo de servidor dele tem `marathon` (o adaptador):
//   marathon: {
//     trust:   'forte' | 'media' | 'fraca'  o quanto o servidor confere a rodada
//     off?:    true                         desligado por padrão na configuração
//     estMs(level)                          quanto tempo a fase leva (estimativa)
//     exclude?(level) -> motivo | null      fases que não servem para disputa
//     quality?(result, level) -> 0..1       qualidade do resultado validado
//                                           (padrão: result.accuracy / 100)
//     duels?: [{ variant, title, tier, estMs, capped? }]  duelos pela rede
//   }
// Dois tipos de confronto (PLANO_MARATONA.md, 3.3):
//   'corrida'  os dois lados jogam a mesma fase, com a mesma semente
//   'duelo'    um contra o outro pela rede (jogos de tabuleiro)
// Cada fase tem uma dificuldade (`tier`, 1 a 4, a mesma dos pontos globais)
// e o nível da maratona escolhe quais dificuldades valem (NIVEIS).

const points = require('../platform/points');

// nível da maratona (1 a 4) -> dificuldades aceitas
const NIVEIS = { 1: [1], 2: [1, 2], 3: [1, 2, 3], 4: [1, 2, 3, 4] }; // cada nível inclui os de baixo
const ROUND_MS = { min: 2 * 60 * 1000, max: 10 * 60 * 1000, default: 5 * 60 * 1000 };

const clamp01 = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

// Tudo o que a Maratona sabe de um jogo (cacheado: as fases não mudam com o servidor ligado).
const cache = new Map();
function describe(game) {
  if (cache.has(game.id)) return cache.get(game.id);
  const m = game.server && game.server.marathon;
  const Levels = points.levelsOf(game.id);
  let out = null;
  if (m && Levels && game.status === 'active') {
    const topicOf = (level) => level.world;
    const entries = Levels.LEVELS.map((level) => {
      const excluded = m.exclude ? m.exclude(level) : null;
      return {
        key: level.id,
        kind: 'corrida',
        levelId: level.id,
        title: level.fullTitle || level.title,
        topic: topicOf(level),
        tier: points.tierOf(Levels, level),
        estMs: excluded || !m.estMs ? null : Math.round(m.estMs(level)),
        excluded,
      };
    });
    for (const d of m.duels || []) {
      entries.push({
        key: `duelo:${d.variant}`, kind: 'duelo', variant: d.variant, title: d.title, topic: null,
        tier: d.tier, estMs: d.estMs, capped: Boolean(d.capped), excluded: null,
      });
    }
    out = {
      id: game.id,
      name: game.name,
      icon: game.icon,
      requiresKeyboard: Boolean(game.requiresKeyboard),
      trust: m.trust || 'forte',
      off: Boolean(m.off),
      // assuntos = os mundos do jogo (o professor pode escolher alguns, decisão D2)
      topics: Levels.WORLDS.length > 1
        ? Levels.WORLDS.map((w) => ({ id: w.id, name: w.name, icon: w.icon || '' }))
        : [],
      entries,
    };
  }
  cache.set(game.id, out);
  return out;
}

// Os jogos que podem entrar numa maratona (com todas as fases e o motivo das que ficam de fora).
function catalog(registry) {
  return registry.games.map(describe).filter(Boolean);
}

// As fases que podem cair de um jogo, com estas configurações:
//   nivel   1 a 4
//   topics  ids dos mundos escolhidos (vazio = todos)
//   roundMs tempo máximo da rodada (a fase tem que caber; o duelo
//           `capped` acaba no prazo e é decidido pela regra 8.5)
function eligible(info, { nivel, topics = [], roundMs = ROUND_MS.default }) {
  const tiers = NIVEIS[nivel] || NIVEIS[4];
  const chosen = new Set(topics || []);
  return info.entries.filter((e) => !e.excluded
    && tiers.includes(e.tier)
    && (e.kind === 'duelo' || !chosen.size || chosen.has(e.topic))
    && (e.kind === 'duelo' ? (e.capped || e.estMs <= roundMs) : e.estMs <= roundMs));
}

// Situação de cada jogo para a tela de configuração: quantas fases podem
// cair e, quando nenhuma, o motivo (o jogo aparece desabilitado).
function status(registry, { nivel, topics = {}, roundMs = ROUND_MS.default } = {}) {
  return catalog(registry).map((info) => {
    const list = eligible(info, { nivel, topics: topics[info.id], roundMs });
    let reason = null;
    if (!list.length) {
      const anyTier = info.entries.some((e) => !e.excluded && (NIVEIS[nivel] || []).includes(e.tier));
      reason = !anyTier ? `não tem fases no nível ${nivel}`
        : (topics[info.id] || []).length ? 'nenhuma fase desses assuntos neste nível'
          : 'as fases deste nível não cabem no tempo da rodada';
    }
    const byTopic = {};
    for (const e of list) if (e.topic) byTopic[e.topic] = (byTopic[e.topic] || 0) + 1;
    // fases de cada assunto neste nível, sem o filtro de assuntos (para o professor escolher)
    const byTopicAll = {};
    for (const e of eligible(info, { nivel, roundMs })) if (e.topic) byTopicAll[e.topic] = (byTopicAll[e.topic] || 0) + 1;
    return {
      id: info.id, name: info.name, icon: info.icon, requiresKeyboard: info.requiresKeyboard,
      trust: info.trust, off: info.off, topics: info.topics,
      count: list.length, corridas: list.filter((e) => e.kind === 'corrida').length, duelos: list.filter((e) => e.kind === 'duelo').length,
      byTopic, byTopicAll, reason,
    };
  });
}

// Desempenho de uma corrida (PLANO_MARATONA.md, 3.4), a partir do resultado
// JÁ VALIDADO pelo jogo (o mesmo validateResult do modo livre):
//   nota = 100 + 100 × estrelas + 99 × qualidade   (0 = não concluiu)
function perf(game, result, level) {
  const m = game.server.marathon;
  const stars = Math.max(0, Math.min(3, Math.floor(Number(result.stars) || 0)));
  const quality = clamp01(m.quality ? m.quality(result, level) : (Number(result.accuracy) || 0) / 100);
  return { concluiu: true, estrelas: stars, qualidade: Math.round(quality * 1000) / 1000, nota: 100 + 100 * stars + Math.round(99 * quality) };
}
const NAO_CONCLUIU = Object.freeze({ concluiu: false, estrelas: 0, qualidade: 0, nota: 0 });

module.exports = { NIVEIS, ROUND_MS, catalog, describe, eligible, status, perf, NAO_CONCLUIU };
