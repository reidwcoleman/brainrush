// Slice Frenzy: swipe through flying fruit, chain combos, never touch the bombs.
import { makeCanvas, loop, Particles, Floaters, Shake, rand, clamp, segHitsCircle, drawHeart } from './kit.js';

const FRUITS = [
  { name: 'melon', r: 36, outer: '#2f9e44', inner: '#ff5d6d', seed: '#231044', stripe: '#1f7a34' },
  { name: 'orange', r: 27, outer: '#ff8a3d', inner: '#ffc078' },
  { name: 'apple', r: 25, outer: '#ff3b54', inner: '#fff2d6', leaf: true },
  { name: 'lemon', r: 24, outer: '#ffd43b', inner: '#fff3a8' },
  { name: 'plum', r: 22, outer: '#9c36b5', inner: '#ffb3e6' },
  { name: 'kiwi', r: 23, outer: '#8c6239', inner: '#82c91e', seed: '#231044' },
];
const SPECIAL = {
  gold: { r: 26, outer: '#ffc93c', inner: '#fff3b0', label: 'GOLDEN FRUIT' },
  ice: { r: 26, outer: '#74c0fc', inner: '#e7f5ff', label: 'FREEZE!' },
  frenzy: { r: 26, outer: '#ff5da2', inner: '#ffe0f0', label: 'FRENZY!' },
};

export default {
  id: 'slice',
  name: 'Slice Frenzy',
  tagline: 'Swipe fruit, dodge bombs',
  goal: 'Swipe through fruit before it falls. Slice 3 or more in one swipe for a combo. Golden fruit pays big, ice slows time, pink starts a frenzy. Bombs cost a life!',
  controls: { desktop: 'Click and drag to slice', touch: 'Swipe to slice' },
  color: 'pink',
  scoreLabel: 'fruit',
  art: `<svg viewBox="0 0 120 90"><rect width="120" height="90" rx="10" fill="#3b2a1a"/><circle cx="38" cy="44" r="18" fill="#2f9e44"/><circle cx="80" cy="30" r="13" fill="#ff8a3d"/><circle cx="86" cy="64" r="11" fill="#231044"/><path d="M90 54l4-6" stroke="#ffc93c" stroke-width="3"/><path d="M14 74L106 16" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/><circle cx="58" cy="70" r="10" fill="#ff3b54"/></svg>`,

  async run(stage, api) {
    const { cv, g, w, h: H, local } = makeCanvas(stage);
    const parts = new Particles(), floats = new Floaters(), shake = new Shake();
    const sc = clamp(Math.min(w / 700, H / 600), 0.65, 1.25);
    const GRAV = 820 * sc;
    const items = [], halves = [], splats = [], trail = [];
    let lives = 3, sliced = 0, t = 0, throwT = 0.1, freezeT = 0, frenzyT = 0, flash = 0;
    let down = false, last = null, swipeCount = 0, swipeT = 0;
    let over = false, title = 'Time\'s up!';

    const toss = (kind) => {
      const x = rand(w * 0.15, w * 0.85);
      const peak = rand(H * 0.25, H * 0.7);
      const vy = -Math.sqrt(2 * GRAV * (H + 40 - peak));
      const vx = (w / 2 - x) * rand(0.3, 0.9) / 1.6 + rand(-40, 40);
      let it;
      if (kind === 'bomb') it = { kind, r: 26 * sc };
      else if (SPECIAL[kind]) it = { kind, ...SPECIAL[kind], r: SPECIAL[kind].r * sc };
      else { const f = FRUITS[Math.floor(Math.random() * FRUITS.length)]; it = { kind: 'fruit', ...f, r: f.r * sc }; }
      Object.assign(it, { x, y: H + 40, vx, vy, rot: rand(0, 6), vr: rand(-3, 3) });
      items.push(it);
      api.sfx('whoosh');
    };

    const wave = () => {
      const n = frenzyT > 0 ? 3 : 2 + Math.floor(Math.random() * Math.min(4, 1.5 + t / 8));
      const bombChance = frenzyT > 0 ? 0 : Math.min(0.28, 0.1 + t / 140);
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        setTimeout(() => {
          if (over) return;
          if (r < bombChance) toss('bomb');
          else if (r < bombChance + 0.04) toss('gold');
          else if (r < bombChance + 0.07) toss('ice');
          else if (r < bombChance + 0.095) toss('frenzy');
          else toss('fruit');
        }, i * rand(60, 180));
      }
    };

    const sliceItem = (it, ax, ay, bx, by) => {
      const ang = Math.atan2(by - ay, bx - ax);
      if (it.kind === 'bomb') {
        lives--;
        flash = 0.25;
        shake.add(16, 0.45);
        api.sfx('bad');
        api.add(-1);
        parts.burst(it.x, it.y, { n: 40, colors: ['#ff8a3d', '#ffd34e', '#fff', '#555'], speed: 520, life: 0.7, size: 10 });
        floats.add('BOOM!', it.x, it.y, { color: '#ff4d6d', size: 44 });
        if (lives <= 0) { over = true; title = 'Too many bombs!'; timer.stop(); endRes(); }
        return;
      }
      sliced++;
      swipeCount++;
      const value = it.kind === 'gold' ? 2 : 0.22;
      api.add(value);
      api.sfx(it.kind === 'gold' ? 'coin' : 'pop');
      for (const side of [-1, 1]) {
        halves.push({ ...it, side, ang, vx: it.vx + Math.cos(ang + Math.PI / 2) * side * 90, vy: it.vy - 80, vr: side * rand(2, 5), rot: ang, life: 1.5 });
      }
      parts.burst(it.x, it.y, { n: 16, color: it.inner, speed: 260, life: 0.5, size: 6, gravity: 600, shape: 'circle' });
      splats.push({ x: it.x, y: it.y, r: it.r * 1.4, color: it.inner, life: 2.5 });
      if (it.kind === 'gold') floats.add('+' + api.gold(value), it.x, it.y - 20, { color: '#ffd34e', size: 30 });
      if (it.kind === 'ice') { freezeT = 4; floats.add('FREEZE!', w / 2, H * 0.3, { color: '#a5d8ff', size: 42, life: 1.2 }); api.sfx('ready'); }
      if (it.kind === 'frenzy') { frenzyT = 4; floats.add('FRENZY!', w / 2, H * 0.3, { color: '#ff5da2', size: 42, life: 1.2 }); api.sfx('ready'); }
    };

    const endSwipe = () => {
      if (swipeCount >= 3) {
        const bonus = 0.35 * swipeCount;
        api.add(bonus);
        floats.add(`${swipeCount} FRUIT COMBO! +${api.gold(bonus)}`, w / 2, H * 0.42, { color: '#ffc93c', size: 32, life: 1.2 });
        api.sfx('streak');
      }
      swipeCount = 0;
    };

    cv.addEventListener('pointerdown', e => { down = true; last = local(e); trail.length = 0; cv.setPointerCapture(e.pointerId); swipeT = 0; });
    cv.addEventListener('pointermove', e => {
      if (!down) return;
      const p = local(e);
      trail.push({ x: p[0], y: p[1], life: 0.16 });
      if (last) {
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (segHitsCircle(last[0], last[1], p[0], p[1], it.x, it.y, it.r)) { items.splice(i, 1); sliceItem(it, last[0], last[1], p[0], p[1]); }
        }
      }
      last = p;
    });
    const up = () => { down = false; last = null; endSwipe(); };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    const timer = api.timer(40);
    let endRes;
    const ended = new Promise(r => (endRes = r));
    timer.done.then(() => { if (!over) { over = true; endRes(); } });

    const step = rdt => {
      const dt = rdt * (freezeT > 0 ? 0.45 : 1);
      t += rdt;
      freezeT -= rdt; frenzyT -= rdt; flash -= rdt;
      throwT -= rdt;
      if (throwT <= 0) { wave(); throwT = frenzyT > 0 ? 0.35 : rand(0.9, 1.4) - Math.min(0.4, t / 60); }
      if (down) { swipeT += rdt; if (swipeT > 0.6) { endSwipe(); swipeT = 0.4; } }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.vy += GRAV * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
        if (it.kind === 'bomb') parts.burst(it.x + Math.cos(it.rot - 1) * it.r, it.y + Math.sin(it.rot - 1) * it.r, { n: 1, colors: ['#ffd34e', '#ff8a3d'], speed: 60, life: 0.25, size: 4 });
        if (it.y > H + 80 && it.vy > 0) items.splice(i, 1);
      }
      for (let i = halves.length - 1; i >= 0; i--) {
        const hf = halves[i];
        hf.vy += GRAV * dt; hf.x += hf.vx * dt; hf.y += hf.vy * dt; hf.rot += hf.vr * dt; hf.life -= dt;
        if (hf.life <= 0 || hf.y > H + 80) halves.splice(i, 1);
      }
      for (let i = splats.length - 1; i >= 0; i--) { splats[i].life -= rdt; if (splats[i].life <= 0) splats.splice(i, 1); }
      for (let i = trail.length - 1; i >= 0; i--) { trail[i].life -= rdt; if (trail[i].life <= 0) trail.splice(i, 1); }
      api.setInfo(`${sliced} sliced`);
      parts.update(dt); floats.update(rdt); shake.update(rdt);
      draw();
    };

    const drawFruit = (it, half = 0) => {
      g.save();
      g.translate(it.x, it.y);
      g.rotate(it.rot);
      if (half) { g.beginPath(); g.rect(-it.r - 2, half < 0 ? -it.r - 2 : 0, it.r * 2 + 4, it.r + 2); g.clip(); }
      g.fillStyle = it.outer;
      g.beginPath(); g.arc(0, 0, it.r, 0, 7); g.fill();
      if (it.stripe && !half) { g.strokeStyle = it.stripe; g.lineWidth = 3; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(k * it.r * 0.32, 0, it.r * 0.12, it.r * 0.95, 0, 0, 7); g.stroke(); } }
      if (half) {
        g.fillStyle = it.inner;
        g.beginPath(); g.ellipse(0, 0, it.r * 0.86, it.r * 0.86, 0, 0, 7); g.fill();
        if (it.seed) { g.fillStyle = it.seed; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(Math.cos(k) * it.r * 0.5, Math.sin(k * 1.7) * it.r * 0.4, 2.2, 0, 7); g.fill(); } }
      } else {
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath(); g.ellipse(-it.r * 0.35, -it.r * 0.4, it.r * 0.3, it.r * 0.18, -0.6, 0, 7); g.fill();
        if (it.leaf) { g.fillStyle = '#51cf66'; g.beginPath(); g.ellipse(it.r * 0.25, -it.r * 1.05, it.r * 0.3, it.r * 0.14, -0.5, 0, 7); g.fill(); }
        if (it.kind === 'gold' || it.kind === 'ice' || it.kind === 'frenzy') { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, it.r + 5, 0, 7); g.stroke(); }
      }
      g.restore();
    };

    function draw() {
      g.save();
      shake.apply(g);
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#5a3a22'); grd.addColorStop(1, '#3b2414');
      g.fillStyle = grd; g.fillRect(-20, -20, w + 40, H + 40);
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
      for (let y = 40; y < H; y += 70) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.6, y - 10, w, y + 4); g.stroke(); }
      for (const s of splats) { g.globalAlpha = Math.min(0.5, s.life / 3); g.fillStyle = s.color; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      for (const hf of halves) drawFruit(hf, hf.side);
      for (const it of items) {
        if (it.kind === 'bomb') {
          g.save(); g.translate(it.x, it.y); g.rotate(it.rot);
          g.fillStyle = '#231a2e'; g.beginPath(); g.arc(0, 0, it.r, 0, 7); g.fill();
          g.fillStyle = '#ff4d6d'; g.font = `700 ${it.r}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 2);
          g.strokeStyle = '#8a7a6a'; g.lineWidth = 4; g.beginPath(); g.moveTo(Math.cos(-1) * it.r * 0.8, Math.sin(-1) * it.r * 0.8); g.lineTo(Math.cos(-1) * it.r * 1.25, Math.sin(-1) * it.r * 1.25); g.stroke();
          g.restore();
        } else drawFruit(it);
      }
      if (trail.length > 1) {
        g.lineCap = 'round'; g.lineJoin = 'round';
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1], b = trail[i];
          g.strokeStyle = `rgba(255,255,255,${b.life / 0.16})`;
          g.lineWidth = 2 + (i / trail.length) * 9;
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        }
      }
      parts.draw(g); floats.draw(g);
      g.restore();
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 2.5})`; g.fillRect(0, 0, w, H); }
      if (freezeT > 0) { g.fillStyle = 'rgba(116,192,252,.15)'; g.fillRect(0, 0, w, H); }
      for (let i = 0; i < 3; i++) drawHeart(g, 20 + i * 26, 22, 24, i < lives ? '#ff4d6d' : 'rgba(255,255,255,.2)');
    }

    const stop = loop(step);
    api.onCleanup(stop);
    await ended;
    await new Promise(r => setTimeout(r, 800));
    stop();
    return { score: sliced, title };
  },
};
