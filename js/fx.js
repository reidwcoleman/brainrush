// Confetti and floating score text on a full-screen canvas.
import { h } from './ui.js';

const cv = document.getElementById('fx');
const g = cv.getContext('2d');
let parts = [];
let running = false;
const COLORS = ['#ffc93c', '#ff5da2', '#2ed3b7', '#4d8bff', '#ff8a3d', '#b05cff'];

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

function loop() {
  g.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.vy += 0.32;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.r += p.vr;
    p.life--;
    g.save();
    g.globalAlpha = Math.min(1, p.life / 30);
    g.translate(p.x, p.y);
    g.rotate(p.r);
    g.fillStyle = p.c;
    if (p.round) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 7); g.fill(); }
    else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    g.restore();
  }
  if (parts.length) requestAnimationFrame(loop);
  else running = false;
}

export function confetti(x = innerWidth / 2, y = innerHeight / 3, n = 80, spread = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (4 + Math.random() * 9) * spread;
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      s: 7 + Math.random() * 7, c: COLORS[i % COLORS.length],
      life: 70 + Math.random() * 50, round: Math.random() < 0.3,
    });
  }
  if (!running) { running = true; requestAnimationFrame(loop); }
}

export function floatText(text, x, y, cls = '') {
  const el = h('div', { class: `float-text ${cls}`, style: { left: x + 'px', top: y + 'px' } }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 1100);
}

export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}
