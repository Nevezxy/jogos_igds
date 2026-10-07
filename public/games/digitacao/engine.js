// public/games/digitacao/engine.js
// Motor de uma rodada de digitação, sem nada de tela: recebe os caracteres
// digitados e diz se estavam certos, onde a criança está no texto e as
// métricas (precisão, PPM, tempo, teclas que mais erraram). Os caracteres
// chegam já montados pelo sistema (ex.: "á" depois de ´ + a) e são
// comparados em Unicode NFC, então "á" composto ou decomposto vale igual.
//
// Precisão = caracteres acertados de primeira ÷ total.
// PPM (palavras por minuto) = (caracteres ÷ 5) ÷ minutos — a medida padrão.

(function (root) {
  class TypingRun {
    // `stopOnError`: no erro, espera a tecla certa (padrão, melhor para
    // crianças); senão, marca o erro e segue para o próximo caractere.
    constructor(text, { stopOnError = true, now = () => Date.now() } = {}) {
      this.chars = [...String(text).normalize('NFC')];
      this.stopOnError = stopOnError;
      this.now = now;
      this.pos = 0;
      this.missed = new Set(); // posições que tiveram erro
      this.wrongPresses = 0;
      this.errorsByChar = {}; // caractere esperado -> quantas vezes errou
      this.startedAt = null;
      this.endedAt = null;
    }

    get done() { return this.pos >= this.chars.length; }
    get expected() { return this.done ? null : this.chars[this.pos]; }

    // Um caractere digitado. Devolve { ok, expected, typed, done }.
    type(typed) {
      if (this.done) return { ok: false, ignored: true, done: true };
      const ch = String(typed).normalize('NFC');
      if (this.startedAt === null) this.startedAt = this.now();
      const expected = this.chars[this.pos];
      const ok = ch === expected;
      if (!ok) {
        this.wrongPresses++;
        if (!this.missed.has(this.pos)) {
          this.missed.add(this.pos);
          this.errorsByChar[expected] = (this.errorsByChar[expected] || 0) + 1;
        }
      }
      if (ok || !this.stopOnError) this.pos++;
      if (this.done) this.endedAt = this.now();
      return { ok, expected, typed: ch, done: this.done, index: this.pos };
    }

    elapsedMs() {
      if (this.startedAt === null) return 0;
      return (this.endedAt ?? this.now()) - this.startedAt;
    }

    accuracy() {
      const total = this.done ? this.chars.length : this.pos;
      if (!total) return 100;
      const missedSoFar = [...this.missed].filter((i) => i < Math.max(total, 1)).length;
      return Math.max(0, Math.round(((total - missedSoFar) / total) * 1000) / 10);
    }

    wpm() {
      const minutes = this.elapsedMs() / 60000;
      if (minutes <= 0) return 0;
      return Math.round((this.pos / 5 / minutes) * 10) / 10;
    }

    // Teclas que mais deram trabalho, da que mais errou para a que menos.
    toughest(limit = 5) {
      return Object.entries(this.errorsByChar)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([char, count]) => ({ char, count }));
    }

    result() {
      return {
        chars: this.chars.length,
        accuracy: this.accuracy(),
        wpm: this.wpm(),
        durationMs: this.elapsedMs(),
        wrongPresses: this.wrongPresses,
        errorsByChar: { ...this.errorsByChar },
      };
    }
  }

  const api = { TypingRun };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DigitacaoEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
