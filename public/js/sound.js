// public/js/sound.js
// Sons do jogo, sintetizados na hora com a Web Audio API (sem arquivos de
// áudio: leve e funciona sem internet), e a voz que anuncia o sorteio
// (speechSynthesis, pt-BR). Preferências de som e voz ficam no localStorage.
//
// Os navegadores só liberam áudio depois do primeiro toque do usuário,
// então o AudioContext é criado/retomado no primeiro pointerdown.

(function () {
  const PREFS_KEY = 'bingo_virtual_sound_v1';
  const prefs = { muted: false, voice: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch (e) { /* ignore */ }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  let ctx = null;
  let master = null;

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  document.addEventListener('pointerdown', () => audio(), { capture: true });

  // ---------- blocos de som ----------

  // Uma nota com envelope rápido. `to` faz a frequência deslizar (efeito "boing").
  function tone({ freq, to, type = 'sine', start = 0, dur = 0.15, vol = 1 }) {
    const ac = audio();
    if (!ac || prefs.muted) return;
    const t = ac.currentTime + start;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Ruído filtrado com varredura de frequência: o "vuuush" da bola rolando.
  function whoosh({ start = 0, dur = 0.45, from = 300, to = 2200, vol = 0.6 } = {}) {
    const ac = audio();
    if (!ac || prefs.muted) return;
    const t = ac.currentTime + start;
    const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
  }

  const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G4: 392 };

  // ---------- catálogo de sons do jogo ----------

  const SOUNDS = {
    click: () => tone({ freq: 620, to: 520, type: 'triangle', dur: 0.05, vol: 0.5 }),
    pop: () => tone({ freq: 380, to: 980, dur: 0.09, vol: 0.8 }),
    join: () => {
      tone({ freq: 500, to: 1100, dur: 0.08, vol: 0.7 });
      tone({ freq: 800, to: 1500, dur: 0.08, start: 0.07, vol: 0.5 });
    },
    // carimbo na casa: sobe e quica
    boing: () => {
      tone({ freq: 200, to: 640, type: 'sine', dur: 0.12, vol: 0.9 });
      tone({ freq: 640, to: 420, type: 'sine', dur: 0.12, start: 0.11, vol: 0.6 });
    },
    // toque numa casa que ainda não saiu: "bonk" curto e grave, nada assustador
    bonk: () => tone({ freq: 190, to: 120, type: 'square', dur: 0.14, vol: 0.25 }),
    whoosh: () => whoosh(),
    ding: () => {
      tone({ freq: NOTE.A5, dur: 0.7, vol: 0.6 });
      tone({ freq: NOTE.E6, dur: 0.5, start: 0.02, vol: 0.3 });
    },
    start: () => {
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.16, start: i * 0.1, vol: 0.7 }));
    },
    pause: () => {
      tone({ freq: NOTE.G5, type: 'triangle', dur: 0.18, vol: 0.6 });
      tone({ freq: NOTE.C5, type: 'triangle', dur: 0.3, start: 0.16, vol: 0.6 });
    },
    // alguém (outra pessoa) fez bingo: comemoração curtinha
    tada: () => {
      tone({ freq: NOTE.G5, type: 'triangle', dur: 0.14, vol: 0.7 });
      tone({ freq: NOTE.C6, type: 'triangle', dur: 0.4, start: 0.12, vol: 0.7 });
    },
    // EU fiz bingo: fanfarra
    fanfare: () => {
      const seq = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6];
      seq.forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.15, start: i * 0.11, vol: 0.75 }));
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f) =>
        tone({ freq: f, type: 'triangle', dur: 0.9, start: seq.length * 0.11, vol: 0.4 }));
    },
  };

  function play(name) {
    const fn = SOUNDS[name];
    if (fn) fn();
  }

  // ---------- voz ----------

  function pickVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    return voices.find((v) => v.lang === 'pt-BR') || voices.find((v) => v.lang && v.lang.startsWith('pt')) || null;
  }

  // Lê o item sorteado. Em itens como "🐶 Cachorro" o emoji é removido para
  // a voz não descrever a figura antes da palavra.
  function speak(text) {
    if (prefs.muted || !prefs.voice || !window.speechSynthesis) return;
    const raw = String(text);
    const cleaned = raw.replace(/[\p{Extended_Pictographic}️‍]/gu, '').trim();
    const spoken = /^\d+$/.test(cleaned) ? `Número ${cleaned}` : (cleaned || raw);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = 'pt-BR';
    u.rate = 0.95;
    u.pitch = 1.1;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  // ---------- preferências ----------

  const listeners = new Set();
  function notify() { listeners.forEach((fn) => fn(prefs)); }

  function setMuted(muted) {
    prefs.muted = !!muted;
    if (prefs.muted && window.speechSynthesis) speechSynthesis.cancel();
    savePrefs();
    notify();
  }

  function setVoice(on) {
    prefs.voice = !!on;
    if (!prefs.voice && window.speechSynthesis) speechSynthesis.cancel();
    savePrefs();
    notify();
  }

  window.BingoSound = {
    play,
    speak,
    setMuted,
    setVoice,
    isMuted: () => prefs.muted,
    voiceOn: () => prefs.voice,
    onChange: (fn) => listeners.add(fn),
  };
})();
