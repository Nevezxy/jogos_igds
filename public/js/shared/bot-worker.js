// public/js/shared/bot-worker.js
// Web Worker do robô: pensa em segundo plano, sem travar a tela.
// Mensagem: { id, rulesUrl, rulesName, state, level } → resposta { id, move }.
// O arquivo de regras de cada jogo (UMD) define self[rulesName].

/* eslint-disable no-restricted-globals */
importScripts('/js/shared/bot.js');
const loaded = new Set();

self.onmessage = (event) => {
  const { id, rulesUrl, rulesName, state, level } = event.data;
  try {
    if (!loaded.has(rulesUrl)) { importScripts(rulesUrl); loaded.add(rulesUrl); }
    const res = self.BoardBot.search(self[rulesName], state, level);
    self.postMessage({ id, move: res.move, depth: res.depth });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.message || e) });
  }
};
