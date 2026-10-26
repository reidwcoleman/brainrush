// Snake Arena: eat orbs, grow, and make rival snakes crash into you.
import { makeCanvas, loop, Keys, Particles, Floaters, Shake, rand, clamp, dist } from './kit.js';

const RIVALS = [
  { color: '#ff4d6d', name: 'Spike' }, { color: '#4d8bff', name: 'Bolt' }, { color: '#2fcf6f', name: 'Fern' },
  { color: '#ff8a3d', name: 'Mango' }, { color: '#b05cff', name: 'Vex' },
];
const ORB_COLORS = ['#ffd34e', '#2ed3b7', '#ff5da2', '#4dc3ff', '#b8f28a', '#ff8a3d'];

export default {
  id: 'snake',
  name: 'Snake Arena',
  tagline: 'Grow big, trap rivals',
  goal: 'Eat glowing orbs to grow. If a rival runs its head into your body, it pops and you get its orbs. Don\'t hit the walls or another snake\'s body!',
  controls: { desktop: 'Steer with the mouse (or arrows). Hold click / Space to boost', touch: 'Drag to steer. Two fingers to boost' },
  color: 'green',
  scoreLabel: 'length',
  art: `<svg viewBox="0 0 120 90"><rect width="120" height="90" rx="10" fill="#14233a"/>${[0, 1, 2, 3, 4, 5, 6].map(i => `<circle cx="${20 + i * 11}" cy="${50 + Math.sin(i) * 12}" r="8" fill="#ffc93c"/>`).join('')}<circle cx="97" cy="${50 + Math.sin(7) * 12}" r="9" fill="#ffc93c"/><circle cx="100" cy="${47 + Math.sin(7) * 12}" r="2.4" fill="#231044"/>${[0, 1, 2, 3, 4].map(i => `<circle cx="${30 + i * 10}" cy="18" r="6" fill="#ff4d6d"/>`).join('')}<circle cx="80" cy="72" r="3" fill="#2ed3b7"/><circle cx="40" cy="78" r="3" fill="#ff5da2"/><circle cx="100" cy="20" r="3" fill="#4dc3ff"/></svg>`,

  async run(stage, api) {
    const { cv, g, w, h: H, local } = makeCanvas(stage);
    const keys = new Keys();
    const parts = new Particles(), floats = new Floaters(), shake = new Shake();
    const WW = Math.max(1500, w * 2.2), WH = Math.max(1100, H * 2.2);
    const SPACING = 7;
    const orbs = [];
    const addOrb = (x, y, v = 1, color) => orbs.push({ x, y, v, r: 4 + v * 1.6, color: color || ORB_COLORS[Math.floor(Math.random() * ORB_COLORS.length)], t: Math.random() * 6 });
    for (let i = 0; i < 420; i++) addOrb(rand(30, WW - 30), rand(30, WH - 30), Math.random() < 0.1 ? 3 : 1);

    const makeSnake = (x, y, color, isPlayer) => {
      const a = rand(0, Math.PI * 2);
      const s = { x, y, a, color, isPlayer, len: 170, path: [], alive: true, boost: false, inv: isPlayer ? 2 : 0, turnT: 0, target: null };
      for (let i = 0; i < 40; i++) s.path.push({ x: x - Math.cos(a) * i * 3, y: y - Math.sin(a) * i * 3 });
      return s;
    };
    const safeSpot = () => {
      for (let k = 0; k < 40; k++) {
        const x = rand(200, WW - 200), y = rand(200, WH - 200);
        if (snakes.every(s => !s.alive || dist(x, y, s.x, s.y) > 300)) return [x, y];
      }
      return [rand(200, WW - 200), rand(200, WH - 200)];
    };
    const snakes = [];
    const me = makeSnake(WW / 2, WH / 2, '#ffc93c', true);
    snakes.push(me);
    for (const r of RIVALS) { const [x, y] = safeSpot(); const s = makeSnake(x, y, r.color, false); s.name = r.name; s.len = rand(90, 220); snakes.push(s); }

    let aimX = null, aimY = null, pointerBoost = false, touches = 0;
    let lives = 3, kills = 0, eaten = 0, bestLen = me.len;
    let over = false, title = 'Time\'s up!';
    const camera = { x: me.x, y: me.y };
    cv.addEventListener('pointerdown', e => { touches++; [aimX, aimY] = local(e); pointerBoost = e.pointerType === 'mouse' || touches >= 2; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { [aimX, aimY] = local(e); });
    const up = () => { touches = Math.max(0, touches - 1); pointerBoost = touches >= 2; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    const radius = s => 10 + Math.min(12, s.len / 130);
    // Walk the recorded path and return evenly spaced body points.
    const bodyPoints = s => {
      const pts = [];
      let acc = 0, need = 0;
      for (let i = 1; i < s.path.length && acc <= s.len; i++) {
        const a = s.path[i - 1], b = s.path[i];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        while (need <= acc + d && need <= s.len) {
          const t = d ? (need - acc) / d : 0;
          pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          need += SPACING;
        }
        acc += d;
      }
      return pts;
    };

    const killSnake = (s, killer) => {
      s.alive = false;
      const pts = bodyPoints(s);
      for (let i = 0; i < pts.length; i += 2) addOrb(pts[i].x + rand(-6, 6), pts[i].y + rand(-6, 6), 2, s.color);
      parts.burst(s.x, s.y, { n: 30, color: s.color, speed: 300, life: 0.7, size: 8 });
      if (s.isPlayer) {
        lives--;
        shake.add(14, 0.5);
        api.sfx('bad');
        if (lives <= 0) { over = true; title = 'Crashed!'; timer.stop(); endRes(); return; }
        floats.add(`${lives} ${lives === 1 ? 'life' : 'lives'} left`, w / 2, H / 2, { color: '#ff7a9a', size: 34, life: 1.4 });
        setTimeout(() => { if (over) return; const [x, y] = safeSpot(); Object.assign(me, makeSnake(x, y, me.color, true), { len: Math.max(170, me.len * 0.5) }); }, 900);
      } else {
        if (killer === me) {
          kills++;
          api.add(2);
          api.sfx('win');
          floats.add(`${s.name} popped! +${api.gold(2)}`, w / 2, H * 0.3, { color: '#ffc93c', size: 30, life: 1.3 });
        } else api.sfx('pop');
        setTimeout(() => { if (over) return; const [x, y] = safeSpot(); Object.assign(s, makeSnake(x, y, s.color, false), { len: rand(90, 180) }); }, 2500);
      }
    };

    const timer = api.timer(50);
    let endRes;
    const ended = new Promise(r => (endRes = r));
    timer.done.then(() => { if (!over) { over = true; endRes(); } });

    const step = dt => {
      // ---- steering ----
      if (me.alive) {
        const k = keys.axis();
        let target = me.a;
        if (k.x || k.y) target = k.y && !k.x ? Math.atan2(k.y, 0) : k.x && !k.y ? (k.x > 0 ? 0 : Math.PI) : Math.atan2(k.y, k.x);
        else if (aimX != null) target = Math.atan2(aimY - H / 2, aimX - w / 2);
        let da = ((target - me.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        me.a += clamp(da, -5 * dt, 5 * dt);
        me.boost = (keys.has('Space') || pointerBoost) && me.len > 80;
        me.inv -= dt;
      }
      for (const s of snakes) {
        if (!s.alive || s.isPlayer) continue;
        s.turnT -= dt;
        if (s.turnT <= 0 || !s.target) {
          s.turnT = rand(0.4, 1.2);
          let best = null, bd = 380;
          for (const o of orbs) { const d = dist(o.x, o.y, s.x, s.y) - o.v * 30; if (d < bd) { bd = d; best = o; } }
          s.target = best ? { x: best.x, y: best.y } : { x: rand(100, WW - 100), y: rand(100, WH - 100) };
          // the bigger rivals get bold and try to cut you off
          if (me.alive && s.len > me.len && Math.random() < 0.35) s.target = { x: me.x + Math.cos(me.a) * 160, y: me.y + Math.sin(me.a) * 160 };
        }
        let target = Math.atan2(s.target.y - s.y, s.target.x - s.x);
        const m = 120;
        if (s.x < m) target = 0; else if (s.x > WW - m) target = Math.PI; else if (s.y < m) target = Math.PI / 2; else if (s.y > WH - m) target = -Math.PI / 2;
        let da = ((target - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        s.a += clamp(da, -3.4 * dt, 3.4 * dt);
        s.boost = false;
      }

      // ---- move ----
      for (const s of snakes) {
        if (!s.alive) continue;
        const sp = (s.boost ? 300 : 165) * (s.isPlayer ? 1 : 0.92);
        s.x += Math.cos(s.a) * sp * dt;
        s.y += Math.sin(s.a) * sp * dt;
        s.path.unshift({ x: s.x, y: s.y });
        if (s.boost) {
          s.len -= 22 * dt;
          if (Math.random() < dt * 8) { const tail = s.path[Math.min(s.path.length - 1, 30)]; addOrb(tail.x, tail.y, 1, s.color); }
        }
        let acc = 0;
        for (let i = 1; i < s.path.length; i++) {
          acc += Math.hypot(s.path[i].x - s.path[i - 1].x, s.path[i].y - s.path[i - 1].y);
          if (acc > s.len + 20) { s.path.length = i + 1; break; }
        }
        if (s.x < 0 || s.x > WW || s.y < 0 || s.y > WH) { if (!s.isPlayer || s.inv <= 0) killSnake(s, null); else { s.x = clamp(s.x, 1, WW - 1); s.y = clamp(s.y, 1, WH - 1); s.a += Math.PI; } }
      }

      // ---- eat ----
      for (const s of snakes) {
        if (!s.alive) continue;
        const r = radius(s);
        for (let i = orbs.length - 1; i >= 0; i--) {
          const o = orbs[i];
          const d = dist(o.x, o.y, s.x, s.y);
          if (d < r + 70 && d > r) { o.x += ((s.x - o.x) / d) * 160 * dt; o.y += ((s.y - o.y) / d) * 160 * dt; }
          if (d < r + o.r) {
            orbs.splice(i, 1);
            s.len += o.v * 7;
            if (s.isPlayer) { eaten += o.v; api.add(0.05 * o.v); if (Math.random() < 0.5) api.sfx('tick'); }
          }
        }
      }
      while (orbs.length < 380) addOrb(rand(30, WW - 30), rand(30, WH - 30), Math.random() < 0.1 ? 3 : 1);

      // ---- collisions: head into someone else's body ----
      const bodies = snakes.map(s => (s.alive ? bodyPoints(s) : []));
      snakes.forEach((s, si) => {
        if (!s.alive || (s.isPlayer && s.inv > 0)) return;
        const r = radius(s);
        for (let oi = 0; oi < snakes.length; oi++) {
          if (oi === si || !snakes[oi].alive) continue;
          const other = snakes[oi], orad = radius(other);
          const pts = bodies[oi];
          for (let p = 3; p < pts.length; p++) {
            const q = pts[p];
            if (Math.abs(q.x - s.x) < r + orad && Math.abs(q.y - s.y) < r + orad && dist(q.x, q.y, s.x, s.y) < r * 0.8 + orad * 0.8) {
              if (other.isPlayer && other.inv > 0) continue;
              killSnake(s, other);
              return;
            }
          }
        }
      });

      bestLen = Math.max(bestLen, me.len);
      api.setInfo(`Length ${Math.round(me.len / 10)}`);
      camera.x += ((me.alive ? me.x : camera.x) - camera.x) * Math.min(1, dt * 8);
      camera.y += ((me.alive ? me.y : camera.y) - camera.y) * Math.min(1, dt * 8);
      for (const o of orbs) o.t += dt;
      parts.update(dt); floats.update(dt); shake.update(dt);
      keys.endFrame();
      draw(bodies);
    };

    function draw(bodies) {
      g.save();
      shake.apply(g);
      g.fillStyle = '#0d1626'; g.fillRect(-20, -20, w + 40, H + 40);
      g.translate(Math.round(w / 2 - camera.x), Math.round(H / 2 - camera.y));
      g.fillStyle = '#14233a'; g.fillRect(0, 0, WW, WH);
      // hex-ish dot floor
      g.fillStyle = 'rgba(255,255,255,.06)';
      const x0 = Math.max(0, Math.floor((camera.x - w / 2) / 36) * 36), y0 = Math.max(0, Math.floor((camera.y - H / 2) / 36) * 36);
      for (let x = x0; x < Math.min(WW, camera.x + w / 2 + 36); x += 36) for (let y = y0; y < Math.min(WH, camera.y + H / 2 + 36); y += 36) g.fillRect(x + ((y / 36) % 2) * 18, y, 3, 3);
      g.strokeStyle = '#ff4d6d'; g.lineWidth = 6; g.strokeRect(0, 0, WW, WH);
      const vis = (x, y, m = 40) => Math.abs(x - camera.x) < w / 2 + m && Math.abs(y - camera.y) < H / 2 + m;
      for (const o of orbs) {
        if (!vis(o.x, o.y)) continue;
        const pr = o.r * (1 + Math.sin(o.t * 4) * 0.15);
        g.globalAlpha = 0.25; g.fillStyle = o.color; g.beginPath(); g.arc(o.x, o.y, pr * 2.2, 0, 7); g.fill();
        g.globalAlpha = 1; g.beginPath(); g.arc(o.x, o.y, pr, 0, 7); g.fill();
      }
      snakes.forEach((s, si) => {
        if (!s.alive) return;
        const pts = bodies[si] || [];
        const r = radius(s);
        const blink = s.isPlayer && s.inv > 0 && Math.floor(s.inv * 10) % 2;
        g.globalAlpha = blink ? 0.4 : 1;
        for (let i = pts.length - 1; i >= 0; i--) {
          const p = pts[i];
          if (!vis(p.x, p.y)) continue;
          g.fillStyle = i % 4 < 2 ? s.color : shadeHex(s.color);
          g.beginPath(); g.arc(p.x, p.y, r * (1 - (i / pts.length) * 0.35), 0, 7); g.fill();
        }
        // head
        g.fillStyle = s.color; g.beginPath(); g.arc(s.x, s.y, r * 1.12, 0, 7); g.fill();
        for (const side of [-1, 1]) {
          const ex = s.x + Math.cos(s.a) * r * 0.45 + Math.cos(s.a + Math.PI / 2) * side * r * 0.5;
          const ey = s.y + Math.sin(s.a) * r * 0.45 + Math.sin(s.a + Math.PI / 2) * side * r * 0.5;
          g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, r * 0.38, 0, 7); g.fill();
          g.fillStyle = '#231044'; g.beginPath(); g.arc(ex + Math.cos(s.a) * r * 0.12, ey + Math.sin(s.a) * r * 0.12, r * 0.2, 0, 7); g.fill();
        }
        if (s.boost) { g.globalAlpha = 0.3; g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.y, r * 1.8, 0, 7); g.fill(); }
        g.globalAlpha = 1;
        if (!s.isPlayer && vis(s.x, s.y)) { g.font = '700 13px Fredoka, sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)'; g.textAlign = 'center'; g.fillText(s.name, s.x, s.y - r - 12); }
      });
      parts.draw(g);
      g.restore();
      floats.draw(g);
      // minimap
      const mw = 110, mh = mw * (WH / WW), mx = w - mw - 12, my = H - mh - 12;
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(mx, my, mw, mh);
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.strokeRect(mx, my, mw, mh);
      for (const s of snakes) if (s.alive) { g.fillStyle = s.color; g.beginPath(); g.arc(mx + (s.x / WW) * mw, my + (s.y / WH) * mh, s.isPlayer ? 4 : 2.5, 0, 7); g.fill(); }
      // lives
      g.font = '700 18px Fredoka, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.fillText(`Lives ${'●'.repeat(lives)}`, 14, 22);
      g.fillText(`Pops ${kills}`, 14, 46);
    }

    const stop = loop(step);
    api.onCleanup(() => { stop(); keys.dispose(); });
    await ended;
    await new Promise(r => setTimeout(r, 800));
    stop();
    return { score: Math.round(bestLen / 10), title };
  },
};

function shadeHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(c * 0.8);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
