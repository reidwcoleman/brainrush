// Sky Hop: bounce ever upward. Springs, jetpacks, crumbly platforms, monsters.
import { makeCanvas, loop, Keys, Particles, Floaters, Shake, loadImage, drawBlob, drawCoin, rand, clamp, lerp } from './kit.js';

const SKY = [[0, '#7cc8ff', '#c9ecff'], [2500, '#5a7dff', '#a9b8ff'], [6000, '#5c3bd6', '#ff8fb8'], [10000, '#1b1240', '#4b2a8c'], [16000, '#06030f', '#1b1240']];
function skyAt(hgt) {
  let i = 0;
  while (i < SKY.length - 2 && hgt > SKY[i + 1][0]) i++;
  const [h0, a0, b0] = SKY[i], [h1, a1, b1] = SKY[i + 1];
  const t = clamp((hgt - h0) / (h1 - h0), 0, 1);
  const mix = (c0, c1) => {
    const p = s => [1, 3, 5].map(k => parseInt(s.slice(k, k + 2), 16));
    const x = p(c0), y = p(c1);
    return `rgb(${x.map((v, k) => Math.round(lerp(v, y[k], t))).join(',')})`;
  };
  return [mix(a0, a1), mix(b0, b1)];
}

export default {
  id: 'skyhop',
  name: 'Sky Hop',
  tagline: 'Bounce to space',
  goal: 'Hop as high as you can. Springs launch you, jetpacks fly you, brown platforms crumble. Stomp monsters from above. Don\'t fall!',
  controls: { desktop: 'Steer: arrow keys / A D', touch: 'Hold the left or right side of the screen' },
  color: 'blue',
  scoreLabel: 'm',
  art: `<svg viewBox="0 0 120 90"><rect width="120" height="90" rx="10" fill="#7cc8ff"/><rect x="14" y="70" width="34" height="8" rx="4" fill="#2fcf6f"/><rect x="66" y="48" width="34" height="8" rx="4" fill="#4d8bff"/><rect x="24" y="26" width="34" height="8" rx="4" fill="#2fcf6f"/><path d="M78 48v-6m6 6v-6" stroke="#9aa5b8" stroke-width="3"/><rect x="74" y="38" width="14" height="4" fill="#ff4d6d"/><circle cx="44" cy="54" r="11" fill="#ffc93c"/><circle cx="40" cy="52" r="2.4" fill="#231044"/><circle cx="48" cy="52" r="2.4" fill="#231044"/><circle cx="96" cy="16" r="6" fill="#ffd34e"/></svg>`,

  async run(stage, api) {
    const { cv, g, w, h: H, local } = makeCanvas(stage);
    const img = await loadImage(api.avatarSVG(api.avatar, 120));
    const keys = new Keys();
    const parts = new Particles(), floats = new Floaters(), shake = new Shake();
    const sc = clamp(H / 640, 0.75, 1.25);
    const GRAV = 1550 * sc, JUMP = -760 * sc, SPRING = -1250 * sc;
    const PW = 70 * sc, PH = 14 * sc;

    const P = { x: w / 2, y: H - 120 * sc, vx: 0, vy: JUMP, r: 22 * sc, jet: 0, face: 1 };
    let camY = 0, best = 0, coins = 0, over = false, title = 'Time\'s up!';
    const plats = [], items = [], monsters = [], clouds = [];
    let topY = H - 40 * sc;
    plats.push({ x: 0, y: H - 40 * sc, type: 'ground', vx: 0, w });

    const genUpTo = limit => {
      while (topY > limit) {
        const height = -(topY - H);
        const gap = rand(55, 85 + Math.min(70, height / 120)) * sc;
        topY -= gap;
        const r = Math.random();
        const type = height > 900 && r < 0.18 ? 'moving' : height > 2500 && r < 0.3 ? 'cloud' : 'normal';
        const p = { x: rand(0, w - PW), y: topY, type, vx: type === 'moving' ? rand(60, 120 + height / 60) * sc * (Math.random() < 0.5 ? -1 : 1) : 0 };
        plats.push(p);
        if (Math.random() < 0.09) items.push({ kind: 'spring', plat: p, dx: rand(8, PW - 22) });
        else if (Math.random() < 0.012 && height > 400) items.push({ kind: 'jet', plat: p, dx: PW / 2 - 10 });
        else if (Math.random() < 0.3) items.push({ kind: 'coin', x: p.x + PW / 2, y: p.y - 34 * sc, t: Math.random() * 6 });
        if (height > 600 && Math.random() < 0.16) plats.push({ x: rand(0, w - PW), y: topY - gap / 2, type: 'crumble', vx: 0 });
        if (height > 1800 && Math.random() < 0.06) monsters.push({ x: rand(30, w - 30), y: topY - gap / 2, vx: rand(50, 110) * sc, r: 20 * sc, t: 0 });
      }
    };
    genUpTo(-H);
    for (let i = 0; i < 6; i++) clouds.push({ x: rand(0, w), y: rand(0, H), s: rand(0.6, 1.3), p: rand(0.2, 0.5) });

    let touchDir = 0;
    cv.addEventListener('pointerdown', e => { const [x] = local(e); touchDir = x < w / 2 ? -1 : 1; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (touchDir) { const [x] = local(e); touchDir = x < w / 2 ? -1 : 1; } });
    const up = () => (touchDir = 0);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    const timer = api.timer(60);
    let endRes;
    const ended = new Promise(r => (endRes = r));
    timer.done.then(() => { if (!over) { over = true; endRes(); } });
    const finish = t => { if (over) return; over = true; title = t; timer.stop(); endRes(); };

    const step = dt => {
      const dir = keys.axis().x || touchDir;
      P.vx = lerp(P.vx, dir * 380 * sc, Math.min(1, dt * 10));
      if (dir) P.face = dir;
      if (P.jet > 0) {
        P.jet -= dt;
        P.vy = lerp(P.vy, -1100 * sc, dt * 6);
        parts.burst(P.x, P.y + P.r, { n: 2, colors: ['#ff8a3d', '#ffd34e'], speed: 120, life: 0.4, size: 7 });
      } else P.vy += GRAV * dt;
      const prevY = P.y;
      P.x += P.vx * dt;
      P.y += P.vy * dt;
      if (P.x < -P.r) P.x = w + P.r;
      if (P.x > w + P.r) P.x = -P.r;

      for (const p of plats) {
        if (p.vx) { p.x += p.vx * dt; if (p.x < 0 || p.x > w - PW) p.vx *= -1; }
      }
      // land on platforms only while falling
      if (P.vy > 0 && P.jet <= 0) {
        const feet = P.y + P.r, prevFeet = prevY + P.r;
        for (let i = plats.length - 1; i >= 0; i--) {
          const p = plats[i];
          if (p.dead || prevFeet > p.y + 2 || feet < p.y || P.x < p.x - 8 || P.x > p.x + (p.w || PW) + 8) continue;
          if (p.type === 'crumble') {
            p.dead = true;
            parts.burst(p.x + PW / 2, p.y, { n: 16, color: '#a8754f', speed: 160, gravity: 900, life: 0.7, size: 8 });
            api.sfx('bonk');
            continue;
          }
          const spring = items.find(it => it.kind === 'spring' && it.plat === p && P.x > p.x + it.dx - 10 && P.x < p.x + it.dx + 24);
          P.y = p.y - P.r;
          if (spring) { P.vy = SPRING; spring.boing = 0.25; api.sfx('perfect'); floats.add('BOING!', P.x, P.y - 30, { color: '#fff' }); }
          else { P.vy = JUMP; api.sfx('place'); }
          parts.burst(P.x, p.y, { n: 6, color: 'rgba(255,255,255,.8)', speed: 90, life: 0.3, size: 5 });
          if (p.type === 'cloud') { p.dead = true; parts.burst(p.x + PW / 2, p.y, { n: 14, color: '#fff', speed: 120, life: 0.5, size: 10, shape: 'circle' }); }
          break;
        }
      }

      // items
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.kind === 'coin') {
          it.t += dt;
          if (Math.hypot(P.x - it.x, P.y - it.y) < P.r + 12 * sc) {
            items.splice(i, 1); coins++; api.add(0.4); api.sfx('coin');
            floats.add('+' + api.gold(0.4), it.x, it.y - 10, { size: 18 });
          }
        } else if (it.kind === 'jet') {
          const jx = it.plat.x + it.dx + 10, jy = it.plat.y - 18 * sc;
          if (Math.hypot(P.x - jx, P.y - jy) < P.r + 16 * sc) { items.splice(i, 1); P.jet = 2.6; api.sfx('ready'); floats.add('JETPACK!', P.x, P.y - 40, { color: '#ff8a3d', size: 30 }); }
        } else if (it.boing) it.boing = Math.max(0, it.boing - dt);
      }
      // monsters: stomp from above or get bonked
      for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];
        m.t += dt;
        m.x += m.vx * dt;
        if (m.x < m.r || m.x > w - m.r) m.vx *= -1;
        const d = Math.hypot(P.x - m.x, P.y - m.y);
        if (d < P.r + m.r * 0.85) {
          if (P.vy > 0 && P.y < m.y - m.r * 0.2 || P.jet > 0) {
            monsters.splice(i, 1);
            P.vy = JUMP * 1.15;
            api.add(1.5); api.sfx('bonk'); shake.add(6, 0.2);
            parts.burst(m.x, m.y, { n: 24, color: '#ff4d6d', speed: 260, life: 0.6 });
            floats.add('STOMP! +' + api.gold(1.5), m.x, m.y - 20, { color: '#ffc93c', size: 26 });
          } else {
            shake.add(12, 0.4); api.sfx('bad');
            finish('Bonked by a monster!');
          }
        }
      }

      // camera + height
      const targetCam = Math.min(camY, P.y - H * 0.42);
      camY = targetCam;
      const height = Math.max(0, (H - 120 * sc - P.y) / sc);
      if (height > best) {
        const gained = Math.floor(height / 10) - Math.floor(best / 10);
        best = height;
        if (gained > 0) api.add(gained / 70);
      }
      genUpTo(camY - 40);
      // forget things far below the screen
      for (const arr of [plats, items, monsters]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const y = arr[i].y ?? arr[i].plat?.y;
          if (y > camY + H + 200 || arr[i].dead && arr === plats && y > camY + H) arr.splice(i, 1);
        }
      }
      if (P.y - P.r > camY + H) { api.sfx('wrong'); finish('You fell!'); }
      api.setInfo(`${Math.floor(best / 10)} m`);

      parts.update(dt); floats.update(dt); shake.update(dt);
      keys.endFrame();
      draw();
    };

    function draw() {
      const [top, bot] = skyAt(best);
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, top); grd.addColorStop(1, bot);
      g.fillStyle = grd;
      g.fillRect(0, 0, w, H);
      if (best > 7000) {
        g.fillStyle = `rgba(255,255,255,${clamp((best - 7000) / 4000, 0, 0.9)})`;
        for (let i = 0; i < 60; i++) { const sx = (i * 97.3) % w, sy = ((i * 61.7 - camY * 0.05) % H + H) % H; g.fillRect(sx, sy, 2, 2); }
      }
      g.fillStyle = `rgba(255,255,255,${clamp(0.55 - best / 14000, 0, 0.55)})`;
      for (const c of clouds) {
        const cy = ((c.y - camY * c.p) % (H + 100) + H + 100) % (H + 100) - 50;
        g.beginPath(); g.ellipse(c.x, cy, 50 * c.s, 18 * c.s, 0, 0, 7); g.ellipse(c.x + 30 * c.s, cy - 10 * c.s, 30 * c.s, 18 * c.s, 0, 0, 7); g.fill();
      }

      g.save();
      shake.apply(g);
      g.translate(0, -camY);
      for (const p of plats) {
        if (p.dead && p.type !== 'cloud') continue;
        if (p.dead) continue;
        if (p.type === 'ground') { g.fillStyle = '#2fcf6f'; g.fillRect(0, p.y, w, 600); g.fillStyle = '#1b9e4f'; g.fillRect(0, p.y + 10, w, 600); continue; }
        const col = { normal: ['#2fcf6f', '#1b9e4f'], moving: ['#4d8bff', '#2f62d6'], crumble: ['#c08a5b', '#8a5a33'], cloud: ['#ffffff', '#d7e3ff'] }[p.type];
        g.fillStyle = col[1];
        g.beginPath(); g.roundRect(p.x, p.y + 3, PW, PH, 7); g.fill();
        g.fillStyle = col[0];
        g.beginPath(); g.roundRect(p.x, p.y, PW, PH - 3, 7); g.fill();
        if (p.type === 'crumble') { g.strokeStyle = '#6b4224'; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x + PW * 0.3, p.y); g.lineTo(p.x + PW * 0.4, p.y + PH); g.moveTo(p.x + PW * 0.65, p.y); g.lineTo(p.x + PW * 0.58, p.y + PH); g.stroke(); }
      }
      for (const it of items) {
        if (it.kind === 'coin') drawCoin(g, it.x, it.y + Math.sin(it.t * 4) * 3, 10 * sc, it.t * 4);
        else if (it.kind === 'spring') {
          const x = it.plat.x + it.dx, y = it.plat.y;
          const hgt = (it.boing ? 20 : 11) * sc;
          g.strokeStyle = '#9aa5b8'; g.lineWidth = 3;
          g.beginPath(); for (let k = 0; k <= 4; k++) g.lineTo(x + (k % 2 ? 4 : 10), y - (k / 4) * hgt); g.stroke();
          g.fillStyle = '#ff4d6d'; g.fillRect(x - 2, y - hgt - 4, 18, 5);
        } else if (it.kind === 'jet') {
          const x = it.plat.x + it.dx, y = it.plat.y - 30 * sc;
          g.fillStyle = '#9aa5b8'; g.beginPath(); g.roundRect(x, y, 9, 24 * sc, 4); g.roundRect(x + 11, y, 9, 24 * sc, 4); g.fill();
          g.fillStyle = '#ff8a3d'; g.fillRect(x + 1, y + 24 * sc, 7, 5); g.fillRect(x + 12, y + 24 * sc, 7, 5);
        }
      }
      for (const m of monsters) {
        drawBlob(g, m.x, m.y + Math.sin(m.t * 5) * 4, m.r, '#ff4d6d', { angry: true, look: Math.atan2(P.y - m.y, P.x - m.x) });
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(m.x - m.r * 0.8, m.y - m.r * 0.6); g.lineTo(m.x - m.r * 0.5, m.y - m.r * 1.3); g.lineTo(m.x - m.r * 0.2, m.y - m.r * 0.8); g.moveTo(m.x + m.r * 0.8, m.y - m.r * 0.6); g.lineTo(m.x + m.r * 0.5, m.y - m.r * 1.3); g.lineTo(m.x + m.r * 0.2, m.y - m.r * 0.8); g.fill();
      }
      g.save();
      g.translate(P.x, P.y);
      if (P.face < 0) g.scale(-1, 1);
      const stretch = clamp(-P.vy / 2600, -0.12, 0.18);
      g.scale(1 - stretch * 0.5, 1 + stretch);
      if (P.jet > 0) { g.fillStyle = '#9aa5b8'; g.fillRect(-P.r * 1.1, -P.r * 0.2, 10, P.r * 1.1); }
      g.drawImage(img, -P.r * 1.3, -P.r * 1.4, P.r * 2.6, P.r * 2.6);
      g.restore();
      parts.draw(g);
      floats.draw(g);
      g.restore();
      // height marker
      g.font = `700 ${30 * sc}px Fredoka, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'top';
      g.lineWidth = 5; g.strokeStyle = 'rgba(20,8,50,.5)'; g.strokeText(`${Math.floor(best / 10)} m`, 16, 12);
      g.fillStyle = '#fff'; g.fillText(`${Math.floor(best / 10)} m`, 16, 12);
    }

    const stop = loop(step);
    api.onCleanup(() => { stop(); keys.dispose(); });
    await ended;
    await new Promise(r => setTimeout(r, 900));
    stop();
    return { score: Math.floor(best / 10), title };
  },
};
