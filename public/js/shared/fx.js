// public/js/shared/fx.js
// Efeitos visuais de recompensa, sem dependências:
//   confetti()  — chuva de confete em <canvas> por cima da tela
//   sparkle()   — estrelinhas saindo de um ponto (ao marcar uma casa)
//   shake()     — faz um elemento tremer (toque errado)
// Com prefers-reduced-motion, confete e estrelinhas não aparecem.

(function () {
  const COLORS = ['#FFD23F', '#FF4FA3', '#3DDC84', '#2EC4FF', '#FF8A3D', '#8B5CF6', '#FFFFFF'];
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- confete ----------

  let canvas = null;
  let ctx2d = null;
  let particles = [];
  let running = false;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx2d = canvas.getContext('2d');
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
  }

  // amount: quantidade de pedaços. origin: 'top' (chuva) ou {x, y} (explosão).
  // power: força da explosão (1 = normal; 0,5 = um estourinho pequeno).
  function confetti({ amount = 160, origin = 'top', power = 1 } = {}) {
    if (reducedMotion()) return;
    ensureCanvas();
    for (let i = 0; i < amount; i++) {
      const fromTop = origin === 'top';
      const angle = Math.random() * Math.PI * 2;
      const speed = (4 + Math.random() * 7) * power;
      particles.push({
        x: fromTop ? Math.random() * innerWidth : origin.x,
        y: fromTop ? -20 - Math.random() * innerHeight * 0.3 : origin.y,
        vx: fromTop ? (Math.random() - 0.5) * 3 : Math.cos(angle) * speed,
        vy: fromTop ? 2 + Math.random() * 3 : Math.sin(angle) * speed - 4 * power,
        size: (7 + Math.random() * 7) * (power < 1 ? 0.75 : 1),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        round: Math.random() < 0.3,
        life: 0,
        ttl: 160 + Math.random() * 90,
      });
    }
    if (!running) {
      running = true;
      requestAnimationFrame(step);
    }
  }

  function step() {
    ctx2d.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter((p) => p.life < p.ttl && p.y < innerHeight + 40);
    for (const p of particles) {
      p.life++;
      p.vy += 0.12; // gravidade
      p.vx *= 0.99; // resistência do ar
      p.x += p.vx + Math.sin(p.life / 9) * 0.6; // balançar caindo
      p.y += p.vy;
      p.rot += p.vrot;
      const fade = Math.min(1, (p.ttl - p.life) / 30);
      ctx2d.save();
      ctx2d.globalAlpha = fade;
      ctx2d.translate(p.x, p.y);
      ctx2d.rotate(p.rot);
      ctx2d.fillStyle = p.color;
      if (p.round) {
        ctx2d.beginPath();
        ctx2d.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        ctx2d.fill();
      } else {
        // "papel" girando: a largura oscila para parecer 3D
        ctx2d.fillRect(-p.size / 2, -p.size / 4, p.size * Math.abs(Math.cos(p.life / 6)) + 2, p.size / 2);
      }
      ctx2d.restore();
    }
    if (particles.length) {
      requestAnimationFrame(step);
    } else {
      running = false;
      ctx2d.clearRect(0, 0, innerWidth, innerHeight);
    }
  }

  // ---------- estrelinhas ----------

  // Coordenadas de tela (clientX/clientY). As estrelinhas ficam numa camada
  // fixa própria, então sobrevivem mesmo se a cartela for redesenhada.
  function sparkle(x, y, count = 8) {
    if (reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'fx-sparkle';
      s.textContent = i % 3 === 0 ? '✦' : '★';
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 34 + Math.random() * 26;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.color = COLORS[i % (COLORS.length - 1)];
      s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
  }

  function sparkleAt(el, count) {
    const r = el.getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height / 2, count);
  }

  // ---------- tremida ----------

  function shake(el) {
    if (!el) return;
    el.classList.remove('fx-shake');
    void el.offsetWidth; // reinicia a animação se já estava tremendo
    el.classList.add('fx-shake');
    setTimeout(() => el.classList.remove('fx-shake'), 450);
  }

  window.BingoFx = { confetti, sparkle, sparkleAt, shake };
})();
