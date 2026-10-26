// Shared toolkit for the arcade games: canvas, input, particles, shake, loop.
import { h } from '../ui.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const isTouch = () => matchMedia('(pointer: coarse)').matches;

export function makeCanvas(stage) {
  const cv = h('canvas', { class: 'mg-canvas' });
  stage.append(cv);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = stage.getBoundingClientRect();
  const w = Math.round(r.width), hgt = Math.round(r.height);
  cv.width = w * dpr;
  cv.height = hgt * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const local = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  return { cv, g, w, h: hgt, dpr, local };
}

// rAF loop with a clamped delta; returns a stop function.
export function loop(fn) {
  let raf, last = performance.now(), alive = true;
  const step = now => {
    if (!alive) return;
    const dt = Math.min(0.034, (now - last) / 1000);
    last = now;
    fn(dt, now);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { alive = false; cancelAnimationFrame(raf); };
}

export class Keys {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.kd = e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this.ku = e => this.down.delete(e.code);
    addEventListener('keydown', this.kd);
    addEventListener('keyup', this.ku);
  }
  has(...codes) { return codes.some(c => this.down.has(c)); }
  // True once per key press; call once per frame.
  hit(...codes) { const r = codes.some(c => this.pressed.has(c)); return r; }
  endFrame() { this.pressed.clear(); }
  axis() {
    return {
      x: (this.has('ArrowRight', 'KeyD') ? 1 : 0) - (this.has('ArrowLeft', 'KeyA') ? 1 : 0),
      y: (this.has('ArrowDown', 'KeyS') ? 1 : 0) - (this.has('ArrowUp', 'KeyW') ? 1 : 0),
    };
  }
  dispose() { removeEventListener('keydown', this.kd); removeEventListener('keyup', this.ku); }
}

// Touch / mouse drag joystick: press anywhere, drag to steer.
export class Joystick {
  constructor(cv, local) {
    this.active = false;
    this.ox = this.oy = this.x = this.y = 0;
    this.vx = this.vy = 0;
    const R = 56;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      [this.ox, this.oy] = local(e);
      this.x = this.ox; this.y = this.oy;
      this.active = true;
      this.vx = this.vy = 0;
    });
    cv.addEventListener('pointermove', e => {
      if (!this.active) return;
      [this.x, this.y] = local(e);
      let dx = this.x - this.ox, dy = this.y - this.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { this.ox = this.x - (dx / d) * R; this.oy = this.y - (dy / d) * R; dx = this.x - this.ox; dy = this.y - this.oy; }
      this.vx = dx / R; this.vy = dy / R;
    });
    const end = () => { this.active = false; this.vx = this.vy = 0; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }
  draw(g) {
    if (!this.active) return;
    g.save();
    g.globalAlpha = 0.35;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(this.ox, this.oy, 56, 0, 7); g.fill();
    g.globalAlpha = 0.7;
    g.beginPath(); g.arc(this.ox + this.vx * 56, this.oy + this.vy * 56, 24, 0, 7); g.fill();
    g.restore();
  }
}

export class Particles {
  constructor() { this.list = []; }
  burst(x, y, { n = 12, color = '#fff', speed = 220, life = 0.6, size = 5, gravity = 0, colors = null, shape = 'sq' } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: size * (0.6 + Math.random() * 0.7), color: colors ? colors[i % colors.length] : color, gravity, shape });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.vy += p.gravity * dt;
      p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(g) {
    for (const p of this.list) {
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * (p.life / p.max));
      if (p.shape === 'circle') { g.beginPath(); g.arc(p.x, p.y, s / 2, 0, 7); g.fill(); }
      else g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }
}

// Floating text drawn on the canvas ("+5", "COMBO x3").
export class Floaters {
  constructor() { this.list = []; }
  add(text, x, y, { color = '#ffd34e', size = 22, life = 0.9, vy = -60 } = {}) { this.list.push({ text, x, y, color, size, life, max: life, vy }); }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(g) {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of this.list) {
      const t = 1 - f.life / f.max;
      const sc = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15));
      g.globalAlpha = Math.min(1, f.life / (f.max * 0.4));
      g.font = `700 ${f.size * sc}px Fredoka, Nunito, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(20,8,50,.8)';
      g.strokeText(f.text, f.x, f.y);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
  }
}

export class Shake {
  constructor() { this.t = 0; this.mag = 0; }
  add(mag, t = 0.25) { this.mag = Math.max(this.mag, mag); this.t = Math.max(this.t, t); }
  update(dt) { this.t -= dt; if (this.t <= 0) this.mag = 0; }
  apply(g) { if (this.mag > 0) g.translate(rand(-this.mag, this.mag), rand(-this.mag, this.mag)); }
}

export function loadImage(svg) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(img);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}

// Does the segment (x1,y1)-(x2,y2) pass within r of (cx,cy)?
export function segHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((cx - x1) * dx + (cy - y1) * dy) / len2, 0, 1);
  return dist(x1 + dx * t, y1 + dy * t, cx, cy) <= r;
}

// A cute blob enemy with eyes, used by several games.
export function drawBlob(g, x, y, r, color, { flash = 0, angry = false, look = 0, squish = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.scale(1 + squish, 1 - squish);
  g.fillStyle = flash > 0 ? '#ffffff' : color;
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.beginPath(); g.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.17, -0.6, 0, 7); g.fill();
  const ex = r * 0.34, ey = -r * 0.08, er = r * 0.24;
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(-ex, ey, er, 0, 7); g.arc(ex, ey, er, 0, 7); g.fill();
  g.fillStyle = '#231044';
  const lx = Math.cos(look) * er * 0.35, ly = Math.sin(look) * er * 0.35;
  g.beginPath(); g.arc(-ex + lx, ey + ly, er * 0.55, 0, 7); g.arc(ex + lx, ey + ly, er * 0.55, 0, 7); g.fill();
  if (angry) {
    g.strokeStyle = '#231044';
    g.lineWidth = Math.max(2, r * 0.1);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-ex - er, ey - er * 1.3); g.lineTo(-ex + er * 0.6, ey - er * 0.7);
    g.moveTo(ex + er, ey - er * 1.3); g.lineTo(ex - er * 0.6, ey - er * 0.7);
    g.stroke();
  }
  g.restore();
}

export function drawCoin(g, x, y, r, spin = 0) {
  const sx = Math.abs(Math.cos(spin)) * 0.8 + 0.2;
  g.save();
  g.translate(x, y);
  g.scale(sx, 1);
  g.fillStyle = '#e8951c'; g.beginPath(); g.arc(0, r * 0.12, r, 0, 7); g.fill();
  g.fillStyle = '#ffd34e'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.strokeStyle = '#e8951c'; g.lineWidth = r * 0.18; g.beginPath(); g.arc(0, 0, r * 0.6, 0, 7); g.stroke();
  g.restore();
}

export function drawHeart(g, x, y, s, color = '#ff4d6d') {
  g.save();
  g.translate(x, y);
  g.scale(s / 20, s / 20);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, 7);
  g.bezierCurveTo(-12, -2, -8, -12, 0, -5);
  g.bezierCurveTo(8, -12, 12, -2, 0, 7);
  g.fill();
  g.restore();
}
