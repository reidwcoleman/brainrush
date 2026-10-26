// Lane Rush: three-lane runner in fake 3D. Dodge walls, jump hurdles, grab coins.
import { makeCanvas, loop, Keys, Particles, Floaters, Shake, loadImage, drawCoin, drawHeart, rand, clamp, lerp } from './kit.js';

export default {
  id: 'lanes',
  name: 'Lane Rush',
  tagline: 'Dodge, jump, grab coins',
  goal: 'Run as far as you can. Switch lanes to dodge walls, jump over hurdles, and grab coins. Magnets pull coins in, x2 doubles them.',
  controls: { desktop: 'Left / Right to switch lanes, Up or Space to jump', touch: 'Swipe left / right to switch lanes, swipe up to jump' },
  color: 'orange',
  scoreLabel: 'm',
  art: `<svg viewBox="0 0 120 90"><rect width="120" height="90" rx="10" fill="#5c3bd6"/><circle cx="60" cy="34" r="16" fill="#ffc93c"/><path d="M50 34L0 90H120L70 34Z" fill="#2a1f55"/><path d="M57 34L36 90M63 34L84 90" stroke="#ff8fb8" stroke-width="2" stroke-dasharray="5 5"/><rect x="66" y="46" width="12" height="12" fill="#ff4d6d"/><circle cx="52" cy="58" r="4" fill="#ffd34e"/><circle cx="48" cy="68" r="5" fill="#ffd34e"/><circle cx="60" cy="80" r="8" fill="#ffc93c"/></svg>`,

  async run(stage, api) {
    const { cv, g, w, h: H, local } = makeCanvas(stage);
    const img = await loadImage(api.avatarSVG(api.avatar, 120));
    const keys = new Keys();
    const parts = new Particles(), floats = new Floaters(), shake = new Shake();
    const HOR = H * 0.36, BOT = H - 30, D = 5, ZMAX = 70;
    const roadHalf = Math.min(w * (w < 600 ? 0.5 : 0.34), 340);
    const proj = (laneX, z, y = 0) => {
      const s = D / (D + z);
      return { x: w / 2 + laneX * roadHalf * 0.66 * s, y: HOR + (BOT - HOR) * s - y * s * (BOT - HOR) * 0.35, s };
    };

    let lane = 1, px = 0, jumpY = 0, jumpV = 0;
    let speed = 17, dist = 0, coins = 0, hearts = 3, inv = 0, magnetT = 0, doubleT = 0, spawnZ = 20, t = 0;
    let over = false, title = 'Time\'s up!';
    const objs = [];
    const city = Array.from({ length: 26 }, (_, i) => ({ x: (i / 26) * w + rand(-10, 10), bw: rand(24, 60), bh: rand(20, 90) }));

    const spawnRow = z => {
      const r = Math.random();
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      if (r < 0.7) {
        const nObs = Math.random() < 0.35 + Math.min(0.3, t / 120) ? 2 : 1;
        for (let i = 0; i < nObs; i++) objs.push({ lane: lanes[i], z, type: Math.random() < 0.4 ? 'hurdle' : 'block' });
        const free = lanes[nObs];
        for (let k = 0; k < 5; k++) objs.push({ lane: free, z: z + k * 1.6, type: 'coin', spin: k });
      } else {
        const l = lanes[0];
        for (let k = 0; k < 8; k++) objs.push({ lane: l, z: z + k * 1.4, type: 'coin', spin: k, high: k > 2 && k < 6 });
        if (Math.random() < 0.5) objs.push({ lane: l, z: z + 5.6, type: 'hurdle' });
      }
      if (Math.random() < 0.08) objs.push({ lane: lanes[2], z: z + 8, type: Math.random() < 0.5 ? 'magnet' : 'x2' });
    };

    const move = d => { const nl = clamp(lane + d, 0, 2); if (nl !== lane) { lane = nl; api.sfx('whoosh'); } };
    const jump = () => { if (jumpY <= 0.01) { jumpV = 6.2; api.sfx('place'); } };
    let sx = 0, sy = 0, st = 0;
    cv.addEventListener('pointerdown', e => { [sx, sy] = local(e); st = performance.now(); });
    cv.addEventListener('pointerup', e => {
      const [x, y] = local(e);
      const dx = x - sx, dy = y - sy;
      if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
      else if (dy < -28) jump();
      else if (performance.now() - st < 300) { if (x < w * 0.33) move(-1); else if (x > w * 0.67) move(1); else jump(); }
    });

    const timer = api.timer(45);
    let endRes;
    const ended = new Promise(r => (endRes = r));
    timer.done.then(() => { if (!over) { over = true; endRes(); } });

    const step = dt => {
      t += dt;
      if (keys.hit('ArrowLeft', 'KeyA')) move(-1);
      if (keys.hit('ArrowRight', 'KeyD')) move(1);
      if (keys.hit('ArrowUp', 'KeyW', 'Space')) jump();
      speed = Math.min(36, 17 + t * 0.42);
      const dz = speed * dt;
      dist += dz;
      px = lerp(px, lane - 1, Math.min(1, dt * 14));
      jumpV -= 18 * dt;
      jumpY = Math.max(0, jumpY + jumpV * dt);
      if (jumpY === 0) jumpV = 0;
      inv -= dt; magnetT -= dt; doubleT -= dt;

      spawnZ -= dz;
      while (spawnZ < ZMAX) { spawnRow(spawnZ + 2); spawnZ += rand(11, 15) - Math.min(4, t / 15); }

        for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        o.z -= dz;
        if (o.type === 'coin' && magnetT > 0 && o.z < 9 && o.z > -1) o.lane = lerp(o.lane, px + 1, Math.min(1, dt * 8));
        if (o.z < -2) { objs.splice(i, 1); continue; }
        if (o.z > 0.9 || o.z < -0.6 || o.done) continue;
        const sameLane = Math.abs(o.lane - (px + 1)) < 0.5;
        if (!sameLane) continue;
        if (o.type === 'coin') {
          if (o.high && jumpY < 0.6) continue;
          o.done = true; objs.splice(i, 1);
          coins++;
          const u = 0.2 * (doubleT > 0 ? 2 : 1);
          api.add(u); api.sfx('coin');
          const p = proj(px, 0.4, jumpY);
          parts.burst(p.x, p.y - 40, { n: 5, color: '#ffd34e', speed: 120, life: 0.35 });
        } else if (o.type === 'magnet' || o.type === 'x2') {
          o.done = true; objs.splice(i, 1);
          if (o.type === 'magnet') magnetT = 8; else doubleT = 8;
          api.sfx('ready');
          floats.add(o.type === 'magnet' ? 'COIN MAGNET!' : 'DOUBLE COINS!', w / 2, H * 0.5, { color: '#2ed3b7', size: 32 });
        } else if (inv <= 0) {
          if (o.type === 'hurdle' && jumpY > 0.55) continue;
                    o.done = true;
          hearts--;
          inv = 1.3;
          shake.add(12, 0.35);
          api.sfx('bad');
          const p = proj(px, 0, jumpY);
          parts.burst(p.x, p.y - 40, { n: 26, colors: ['#ff4d6d', '#fff'], speed: 300, life: 0.6 });
          if (hearts <= 0) { over = true; title = 'Wiped out!'; timer.stop(); endRes(); }
        }
      }
      const prevM = Math.floor((dist - dz) / 100), nowM = Math.floor(dist / 100);
      if (nowM > prevM) { api.add(1); floats.add(`${nowM * 100} m!`, w / 2, HOR + 40, { color: '#fff', size: 30 }); api.sfx('streak'); }
      api.setInfo(`${Math.floor(dist)} m`);
      parts.update(dt); floats.update(dt); shake.update(dt);
      keys.endFrame();
      draw();
    };

    function box(cx, cy, bw, bh, front, top) {
      g.fillStyle = top; g.fillRect(cx - bw / 2, cy - bh - bh * 0.12, bw, bh * 0.12);
      g.fillStyle = front; g.fillRect(cx - bw / 2, cy - bh, bw, bh);
    }

    function draw() {
      g.save();
      shake.apply(g);
      const sky = g.createLinearGradient(0, 0, 0, HOR);
      sky.addColorStop(0, '#3a1d94'); sky.addColorStop(0.7, '#ff5da2'); sky.addColorStop(1, '#ff9d5c');
      g.fillStyle = sky; g.fillRect(-20, -20, w + 40, HOR + 20);
      g.fillStyle = '#ffd34e';
      g.beginPath(); g.arc(w / 2, HOR, Math.min(90, w * 0.14), Math.PI, 0); g.fill();
      g.fillStyle = '#ff9d5c';
      for (let k = 0; k < 4; k++) g.fillRect(w / 2 - 100, HOR - 10 - k * 14, 200, 3 + k);
      g.fillStyle = '#2a1458';
      for (const c of city) g.fillRect(c.x, HOR - c.bh, c.bw, c.bh);
      g.fillStyle = 'rgba(255,211,78,.6)';
      for (const c of city) for (let wy = HOR - c.bh + 8; wy < HOR - 6; wy += 12) for (let wx = c.x + 6; wx < c.x + c.bw - 6; wx += 10) if ((wx * 7 + wy * 3) % 5 < 1.2) g.fillRect(wx, wy, 3, 4);
      // ground + road
      g.fillStyle = '#26164f'; g.fillRect(-20, HOR, w + 40, H - HOR + 20);
      const L = proj(-1.5, 0), R = proj(1.5, 0), LF = proj(-1.5, ZMAX), RF = proj(1.5, ZMAX);
      g.fillStyle = '#3b2a75';
      g.beginPath(); g.moveTo(LF.x, LF.y); g.lineTo(RF.x, RF.y); g.lineTo(R.x + 400, H + 200); g.lineTo(L.x - 400, H + 200); g.fill();
      g.strokeStyle = '#ff8fb8'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(LF.x, LF.y); g.lineTo(L.x - (R.x - L.x) * 0.5, H + 120); g.moveTo(RF.x, RF.y); g.lineTo(R.x + (R.x - L.x) * 0.5, H + 120); g.stroke();
      const off = dist % 4;
      g.fillStyle = 'rgba(255,255,255,.5)';
      for (let z = 4 - off; z < ZMAX; z += 4) for (const lx of [-0.5, 0.5]) {
        const a = proj(lx, z), b = proj(lx, z + 1.6);
        g.beginPath(); g.moveTo(a.x - 2 * a.s * 3, a.y); g.lineTo(a.x + 2 * a.s * 3, a.y); g.lineTo(b.x + 2 * b.s * 3, b.y); g.lineTo(b.x - 2 * b.s * 3, b.y); g.fill();
      }

      const sorted = objs.slice().sort((a, b) => b.z - a.z);
      const laneW = roadHalf * 0.6;
      let playerDrawn = false;
      const drawPlayer = () => {
        const p = proj(px, 0, 0);
        const sz = 74 * (H / 640 + 0.25);
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.ellipse(p.x, p.y, sz * 0.36, sz * 0.1, 0, 0, 7); g.fill();
        const jy = jumpY * (BOT - HOR) * 0.35;
        const bob = jumpY ? 0 : Math.abs(Math.sin(t * 16)) * 5;
        if (!(inv > 0 && Math.floor(inv * 12) % 2)) g.drawImage(img, p.x - sz / 2, p.y - sz - jy - bob + 6, sz, sz);
        if (magnetT > 0) { g.strokeStyle = 'rgba(46,211,183,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y - sz / 2 - jy, sz * 0.7, 0, 7); g.stroke(); }
        playerDrawn = true;
      };
      for (const o of sorted) {
        if (!playerDrawn && o.z < 0) drawPlayer();
        if (o.z > ZMAX || o.z < -1.5) continue;
        const p = proj(o.lane - 1, Math.max(o.z, -0.9), o.high ? 1.2 : 0);
        const fade = clamp((ZMAX - o.z) / 12, 0, 1);
        g.globalAlpha = fade;
        if (o.type === 'block') box(p.x, p.y, laneW * 0.86 * p.s, laneW * 0.75 * p.s, '#ff4d6d', '#ff8fa3');
        else if (o.type === 'hurdle') {
          const bw = laneW * 0.86 * p.s, bh = laneW * 0.26 * p.s;
          g.fillStyle = '#ffc93c'; g.fillRect(p.x - bw / 2, p.y - bh, bw, bh * 0.45);
          g.fillStyle = '#231044';
          for (let k = 0; k < 4; k++) g.fillRect(p.x - bw / 2 + (k + 0.25) * bw / 4, p.y - bh, bw / 10, bh * 0.45);
          g.fillStyle = '#9aa5b8'; g.fillRect(p.x - bw / 2, p.y - bh, 4 * p.s, bh); g.fillRect(p.x + bw / 2 - 4 * p.s, p.y - bh, 4 * p.s, bh);
        } else if (o.type === 'coin') drawCoin(g, p.x, p.y - laneW * 0.28 * p.s, laneW * 0.12 * p.s, t * 5 + o.spin);
        else {
          const r = laneW * 0.16 * p.s;
          g.fillStyle = o.type === 'magnet' ? '#2ed3b7' : '#b05cff';
          g.beginPath(); g.arc(p.x, p.y - r * 1.6, r, 0, 7); g.fill();
          g.fillStyle = '#fff'; g.font = `700 ${r}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(o.type === 'magnet' ? 'M' : 'x2', p.x, p.y - r * 1.6 + 1);
        }
        g.globalAlpha = 1;
      }
      if (!playerDrawn) drawPlayer();
      // speed lines
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const yy = ((t * 900 + k * 137) % (H - HOR)) + HOR;
        g.beginPath(); g.moveTo(8 + k * 4, yy); g.lineTo(8 + k * 4, yy + 40); g.moveTo(w - 8 - k * 4, yy); g.lineTo(w - 8 - k * 4, yy + 40); g.stroke();
      }
      parts.draw(g); floats.draw(g);
      g.restore();
      for (let i = 0; i < 3; i++) drawHeart(g, 20 + i * 26, 22, 24, i < hearts ? '#ff4d6d' : 'rgba(255,255,255,.2)');
      g.font = '700 16px Fredoka, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
      let yy = 22;
      if (magnetT > 0) { g.fillStyle = '#2ed3b7'; g.fillText(`MAGNET ${Math.ceil(magnetT)}`, w - 14, yy); yy += 22; }
      if (doubleT > 0) { g.fillStyle = '#e9b8ff'; g.fillText(`x2 COINS ${Math.ceil(doubleT)}`, w - 14, yy); }
    }

    const stop = loop(step);
    api.onCleanup(() => { stop(); keys.dispose(); });
    await ended;
    await new Promise(r => setTimeout(r, 800));
    stop();
    return { score: Math.floor(dist), title };
  },
};
