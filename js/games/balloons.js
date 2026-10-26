import { makeCanvas } from './index.js';
import { rand } from '../ui.js';

const HUES = ['#ff5d8f', '#4d8bff', '#2ed3b7', '#ff8a3d', '#b05cff', '#7bd36b'];

export default {
  id: 'balloons',
  name: 'Balloon Pop',
  hint: 'Pop balloons! Gold ones are worth a lot. Don\'t pop the bombs.',
  color: 'pink',
  async run(stage, api) {
    const { cv, g, w, h, local, toScreen } = makeCanvas(stage);
    const balloons = [];
    const bits = [];
    const start = performance.now();
    let spawnAt = 0;
    let shake = 0;
    let raf;

    const spawn = t => {
      const r = rand(24, 32) * Math.min(1, w / 420 + 0.3);
      const roll = Math.random();
      const kind = roll < 0.09 ? 'gold' : roll < 0.21 ? 'bomb' : 'plain';
      balloons.push({
        x: rand(r + 6, w - r - 6), y: h + r * 2, r, kind,
        vy: rand(1.4, 2.6) * (h / 480) * (1 + (t / 8000) * 0.6) * (kind === 'gold' ? 1.35 : 1),
        c: kind === 'gold' ? '#ffc93c' : kind === 'bomb' ? '#2b2440' : HUES[Math.floor(Math.random() * HUES.length)],
        ph: Math.random() * 6,
      });
    };

    const draw = b => {
      const sway = Math.sin(b.ph) * 4;
      g.save();
      g.translate(b.x + sway, b.y);
      g.strokeStyle = 'rgba(255,255,255,.7)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, b.r * 1.15);
      g.quadraticCurveTo(-6, b.r * 1.6, 2, b.r * 2.1);
      g.stroke();
      g.fillStyle = b.c;
      g.beginPath();
      g.ellipse(0, 0, b.r * 0.9, b.r * 1.1, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-5, b.r * 1.08); g.lineTo(5, b.r * 1.08); g.lineTo(0, b.r * 1.2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.45)';
      g.beginPath();
      g.ellipse(-b.r * 0.35, -b.r * 0.45, b.r * 0.18, b.r * 0.3, -0.5, 0, Math.PI * 2);
      g.fill();
      if (b.kind === 'bomb') {
        g.fillStyle = '#ff4d6d';
        g.font = `900 ${b.r}px Nunito, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('!', 0, 2);
      }
      if (b.kind === 'gold') {
        g.fillStyle = '#fff';
        g.font = `900 ${b.r * 0.7}px Nunito, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('x3', 0, 2);
      }
      g.restore();
    };

    const frame = now => {
      const t = now - start;
      if (t > spawnAt) { spawn(t); spawnAt = t + Math.max(170, 330 - t / 40); }
      g.clearRect(0, 0, w, h);
      g.save();
      if (shake > 0) { g.translate(rand(-6, 6), rand(-6, 6)); shake--; }
      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i];
        b.y -= b.vy;
        b.ph += 0.04;
        if (b.y < -b.r * 3) balloons.splice(i, 1);
      }
      balloons.forEach(draw);
      for (let i = bits.length - 1; i >= 0; i--) {
        const p = bits[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life--;
        g.globalAlpha = Math.max(0, p.life / 25);
        g.fillStyle = p.c;
        g.fillRect(p.x, p.y, 5, 5);
        if (p.life <= 0) bits.splice(i, 1);
      }
      g.globalAlpha = 1;
      g.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onDown = e => {
      const [x, y] = local(e);
      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i];
        if (Math.hypot(x - b.x, y - b.y) < b.r * 1.25) {
          balloons.splice(i, 1);
          for (let k = 0; k < 14; k++) bits.push({ x: b.x, y: b.y, vx: rand(-4, 4), vy: rand(-5, 2), c: b.c, life: 25 });
          const [sx, sy] = toScreen(b.x, b.y);
          if (b.kind === 'bomb') { api.sfx('bad'); shake = 14; api.add(-1.5, sx, sy); }
          else { api.sfx(b.kind === 'gold' ? 'coin' : 'pop'); api.add(b.kind === 'gold' ? 1.5 : 0.45, sx, sy); }
          return;
        }
      }
    };
    cv.addEventListener('pointerdown', onDown);
    api.onCleanup(() => cancelAnimationFrame(raf));
    await api.timer(8);
  },
};
