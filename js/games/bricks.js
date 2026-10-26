// Brick Blitz: breakout with TNT bricks, combos and power-ups.
import { makeCanvas, loop, Keys, Particles, Floaters, Shake, clamp, rand, drawHeart } from './kit.js';

const HP_COLORS = ['#4d8bff', '#b05cff', '#ff5da2', '#ff8a3d'];
const POWERS = {
  multi: { label: '3x', color: '#4d8bff', name: 'MULTIBALL' },
  wide: { label: 'W', color: '#2fcf6f', name: 'WIDE PADDLE' },
  fire: { label: 'F', color: '#ff4d6d', name: 'FIREBALL' },
  laser: { label: 'L', color: '#b05cff', name: 'LASERS' },
  slow: { label: 'S', color: '#2ed3b7', name: 'SLOW-MO' },
  life: { label: '+', color: '#ff5da2', name: 'EXTRA LIFE' },
};

export default {
  id: 'bricks',
  name: 'Brick Blitz',
  tagline: 'Smash bricks, chain combos',
  goal: 'Break every brick. TNT blows up its neighbors, gold bricks pay extra, and "?" bricks drop power-ups like multiball and lasers.',
  controls: { desktop: 'Move the mouse (or arrows). Click / Space to launch', touch: 'Drag to move the paddle. Tap to launch' },
  color: 'teal',
  scoreLabel: 'bricks',
  art: `<svg viewBox="0 0 120 90"><rect width="120" height="90" rx="10" fill="#1b1240"/>${[0, 1, 2, 3].map(c => [0, 1, 2].map(r => `<rect x="${10 + c * 26}" y="${10 + r * 13}" width="22" height="10" rx="3" fill="${['#4d8bff', '#b05cff', '#ff5da2'][r]}"/>`).join('')).join('')}<rect x="62" y="23" width="22" height="10" rx="3" fill="#ff4d6d"/><circle cx="70" cy="58" r="5" fill="#fff"/><rect x="44" y="76" width="34" height="7" rx="3.5" fill="#2ed3b7"/></svg>`,

  async run(stage, api) {
    const { cv, g, w, h: H, local } = makeCanvas(stage);
    const keys = new Keys();
    const parts = new Particles(), floats = new Floaters(), shake = new Shake();
    const sc = clamp(Math.min(w / 700, H / 600), 0.6, 1.2);
    const BR = 8 * sc;
    const paddle = { x: w / 2, y: H - 36 * sc, w: 120 * sc, h: 14 * sc, wideT: 0 };
    let balls = [], bricks = [], caps = [], lasers = [];
    let lives = 3, level = 0, broken = 0, combo = 0, fireT = 0, laserT = 0, laserCd = 0, slowT = 0;
    let baseSpeed = 430 * sc;
    let over = false, title = 'Time\'s up!';

    const buildLevel = () => {
      level++;
      bricks = [];
      const cols = clamp(Math.floor(w / (70 * sc)), 6, 12);
      const rows = Math.min(4 + level, 8);
      const pad = 14 * sc, gap = 5 * sc;
      const bw = (w - pad * 2 - gap * (cols - 1)) / cols, bh = 20 * sc;
      const pattern = (level - 1) % 4;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (pattern === 1 && Math.abs(c - (cols - 1) / 2) > r + 0.5) continue;
        if (pattern === 2 && (r + c) % 2) continue;
        if (pattern === 3 && (c === Math.floor(cols / 2) || r === 2)) continue;
        const roll = Math.random();
        const type = roll < 0.07 ? 'tnt' : roll < 0.13 ? 'gold' : roll < 0.24 ? 'power' : 'normal';
        const hp = type === 'normal' ? 1 + Math.floor(Math.random() * Math.min(4, 1 + level * 0.6) * (1 - r / rows * 0.5)) : 1;
        bricks.push({ x: pad + c * (bw + gap), y: 52 * sc + r * (bh + gap), w: bw, h: bh, hp, max: hp, type, hit: 0 });
      }
    };
    const newBall = () => balls.push({ x: paddle.x, y: paddle.y - BR - 2, vx: 0, vy: 0, stuck: true, stuckT: 1.6 });
    const launch = b => {
      const a = -Math.PI / 2 + rand(-0.35, 0.35);
      b.vx = Math.cos(a) * baseSpeed; b.vy = Math.sin(a) * baseSpeed; b.stuck = false;
      api.sfx('place');
    };
    buildLevel();
    newBall();

    cv.addEventListener('pointermove', e => { paddle.x = local(e)[0]; });
    cv.addEventListener('pointerdown', e => { paddle.x = local(e)[0]; balls.forEach(b => b.stuck && launch(b)); });

    const timer = api.timer(60);
    let endRes;
    const ended = new Promise(r => (endRes = r));
    timer.done.then(() => { if (!over) { over = true; endRes(); } });
    const updateInfo = () => api.setInfo(`Lvl ${level}`);
    updateInfo();

    const breakBrick = (br, bx, by) => {
      br.dead = true;
      broken++;
      combo++;
      const units = 0.13 * (1 + Math.min(combo, 20) * 0.08) + (br.type === 'gold' ? 1 : 0);
      api.add(units);
      const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
      parts.burst(cx, cy, { n: 12, color: br.type === 'gold' ? '#ffd34e' : br.type === 'tnt' ? '#ff4d6d' : HP_COLORS[(br.max - 1) % 4], speed: 220, life: 0.5, size: 7, gravity: 500 });
      if (br.type === 'gold') floats.add('+' + api.gold(units), cx, cy, { color: '#ffd34e' });
      if (combo >= 5 && combo % 5 === 0) { floats.add(`COMBO x${combo}!`, w / 2, H * 0.55, { size: 34, color: '#2ed3b7', life: 1 }); api.sfx('streak'); }
      else api.sfx(br.type === 'gold' ? 'coin' : 'pop');
      if (br.type === 'power') {
        const keys = Object.keys(POWERS).filter(k => k !== 'life' || Math.random() < 0.3);
        caps.push({ x: cx, y: cy, kind: keys[Math.floor(Math.random() * keys.length)], vy: 140 * sc });
      }
      if (br.type === 'tnt') {
        shake.add(8, 0.25);
        api.sfx('bad');
        parts.burst(cx, cy, { n: 30, colors: ['#ff8a3d', '#ffd34e', '#ff4d6d'], speed: 380, life: 0.6, size: 9 });
        for (const o of bricks) if (!o.dead && Math.abs(o.x + o.w / 2 - cx) < br.w * 1.6 && Math.abs(o.y + o.h / 2 - cy) < br.h * 2.4) { o.hp = 0; breakBrick(o); }
      }
    };

    const hitBrick = (br, ball) => {
      br.hit = 0.1;
      if (fireT > 0) br.hp = 0; else br.hp--;
      if (br.hp <= 0 && !br.dead) breakBrick(br);
      else if (!br.dead) api.sfx('tick');
    };

    const step = dt => {
      const speedMul = slowT > 0 ? 0.65 : 1;
      const k = keys.axis().x;
      if (k) paddle.x += k * 620 * sc * dt;
      const pw = paddle.wideT > 0 ? paddle.w * 1.6 : paddle.w;
      paddle.x = clamp(paddle.x, pw / 2, w - pw / 2);
      if (keys.hit('Space', 'ArrowUp', 'Enter')) balls.forEach(b => b.stuck && launch(b));
      fireT -= dt; slowT -= dt; paddle.wideT -= dt; laserT -= dt;

      if (laserT > 0) {
        laserCd -= dt;
        if (laserCd <= 0) { laserCd = 0.32; lasers.push({ x: paddle.x - pw / 2 + 6, y: paddle.y }, { x: paddle.x + pw / 2 - 6, y: paddle.y }); api.sfx('tick'); }
      }
      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.y -= 800 * sc * dt;
        const br = bricks.find(b => !b.dead && l.x > b.x && l.x < b.x + b.w && l.y > b.y && l.y < b.y + b.h);
        if (br) { hitBrick(br); lasers.splice(i, 1); } else if (l.y < 0) lasers.splice(i, 1);
      }

      for (let bi = balls.length - 1; bi >= 0; bi--) {
        const b = balls[bi];
        if (b.stuck) {
          b.x = paddle.x; b.y = paddle.y - BR - 2;
          b.stuckT -= dt;
          if (b.stuckT <= 0) launch(b);
          continue;
        }
        const sp = Math.hypot(b.vx, b.vy);
        const steps = Math.ceil((sp * speedMul * dt) / (BR * 0.8));
        for (let s = 0; s < steps; s++) {
          b.x += (b.vx * speedMul * dt) / steps;
          b.y += (b.vy * speedMul * dt) / steps;
          if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); }
          if (b.x > w - BR) { b.x = w - BR; b.vx = -Math.abs(b.vx); }
          if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); }
          // paddle
          if (b.vy > 0 && b.y + BR > paddle.y && b.y < paddle.y + paddle.h && Math.abs(b.x - paddle.x) < pw / 2 + BR) {
            const off = clamp((b.x - paddle.x) / (pw / 2), -1, 1);
            const a = -Math.PI / 2 + off * 1.05;
            const nsp = Math.min(sp * 1.015, 780 * sc);
            b.vx = Math.cos(a) * nsp; b.vy = Math.sin(a) * nsp;
            b.y = paddle.y - BR;
            combo = 0;
            api.sfx('place');
          }
          // bricks
          for (const br of bricks) {
            if (br.dead) continue;
            const nx = clamp(b.x, br.x, br.x + br.w), ny = clamp(b.y, br.y, br.y + br.h);
            const dx = b.x - nx, dy = b.y - ny;
            if (dx * dx + dy * dy > BR * BR) continue;
            if (fireT <= 0) {
              const ox = Math.min(b.x + BR - br.x, br.x + br.w - (b.x - BR));
              const oy = Math.min(b.y + BR - br.y, br.y + br.h - (b.y - BR));
              if (ox < oy) b.vx = b.x < br.x + br.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
              else b.vy = b.y < br.y + br.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
            }
            hitBrick(br, b);
            if (fireT <= 0) break;
          }
        }
        if (fireT > 0) parts.burst(b.x, b.y, { n: 1, colors: ['#ff8a3d', '#ffd34e'], speed: 40, life: 0.3, size: 7 });
        if (b.y > H + 20) balls.splice(bi, 1);
      }
      if (!balls.length && !over) {
        lives--;
        shake.add(10, 0.35);
        api.sfx('wrong');
        combo = 0;
        if (lives <= 0) { over = true; title = 'Out of balls!'; timer.stop(); endRes(); }
        else { newBall(); floats.add(`${lives} ${lives === 1 ? 'ball' : 'balls'} left`, w / 2, H * 0.6, { color: '#ff7a9a', size: 28 }); }
      }

      // capsules
      for (let i = caps.length - 1; i >= 0; i--) {
        const c = caps[i];
        c.y += c.vy * dt;
        if (c.y > paddle.y - 8 && c.y < paddle.y + paddle.h + 8 && Math.abs(c.x - paddle.x) < pw / 2 + 12) {
          caps.splice(i, 1);
          const P = POWERS[c.kind];
          floats.add(P.name + '!', paddle.x, paddle.y - 40, { color: P.color, size: 26 });
          api.sfx('ready');
          if (c.kind === 'multi') {
            const src = balls.find(b => !b.stuck) || balls[0];
            if (src) for (let k2 = 0; k2 < 2; k2++) { const a = Math.atan2(src.vy || -1, src.vx) + (k2 ? 0.4 : -0.4); const sp = Math.max(baseSpeed, Math.hypot(src.vx, src.vy)); balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, stuck: false }); }
          } else if (c.kind === 'wide') paddle.wideT = 12;
          else if (c.kind === 'fire') fireT = 7;
          else if (c.kind === 'laser') laserT = 8;
          else if (c.kind === 'slow') slowT = 8;
          else if (c.kind === 'life') lives = Math.min(5, lives + 1);
        } else if (c.y > H + 20) caps.splice(i, 1);
      }

      if (bricks.every(b => b.dead)) {
        api.add(3);
        floats.add('LEVEL CLEAR!', w / 2, H / 2, { size: 44, color: '#ffc93c', life: 1.5, vy: -20 });
        api.sfx('win');
        baseSpeed *= 1.06;
        buildLevel();
        updateInfo();
        balls = []; caps = []; lasers = [];
        newBall();
      }
      for (const br of bricks) br.hit -= dt;
      parts.update(dt); floats.update(dt); shake.update(dt);
      keys.endFrame();
      draw(pw);
    };

    function draw(pw) {
      g.save();
      shake.apply(g);
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#16304f'); grd.addColorStop(1, '#1b1240');
      g.fillStyle = grd; g.fillRect(-20, -20, w + 40, H + 40);
      for (const br of bricks) {
        if (br.dead) continue;
        let col = HP_COLORS[(br.hp - 1) % 4];
        if (br.type === 'tnt') col = '#ff4d6d';
        if (br.type === 'gold') col = '#ffc93c';
        if (br.type === 'power') col = '#2ed3b7';
        g.fillStyle = br.hit > 0 ? '#fff' : col;
        g.beginPath(); g.roundRect(br.x, br.y, br.w, br.h, 5 * sc); g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(br.x + 4, br.y + 3, br.w - 8, 3);
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(br.x + 3, br.y + br.h - 4, br.w - 6, 3);
        const label = br.type === 'tnt' ? 'TNT' : br.type === 'power' ? '?' : br.type === 'gold' ? '$' : br.hp > 1 ? String(br.hp) : '';
        if (label) { g.font = `700 ${12 * sc + 2}px Fredoka, sans-serif`; g.fillStyle = br.type === 'gold' ? '#8a5200' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, br.x + br.w / 2, br.y + br.h / 2 + 1); }
      }
      for (const c of caps) {
        const P = POWERS[c.kind];
        g.fillStyle = P.color; g.beginPath(); g.roundRect(c.x - 18, c.y - 9, 36, 18, 9); g.fill();
        g.fillStyle = '#fff'; g.font = '700 13px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.label, c.x, c.y + 1);
      }
      g.fillStyle = '#e9b8ff';
      for (const l of lasers) g.fillRect(l.x - 2, l.y - 12, 4, 14);
      // paddle
      g.fillStyle = paddle.wideT > 0 ? '#2fcf6f' : '#2ed3b7';
      g.beginPath(); g.roundRect(paddle.x - pw / 2, paddle.y, pw, paddle.h, paddle.h / 2); g.fill();
      if (laserT > 0) { g.fillStyle = '#b05cff'; g.fillRect(paddle.x - pw / 2 + 2, paddle.y - 6, 8, 8); g.fillRect(paddle.x + pw / 2 - 10, paddle.y - 6, 8, 8); }
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(paddle.x - pw / 2 + 8, paddle.y + 3, pw - 16, 3);
      for (const b of balls) {
        g.fillStyle = fireT > 0 ? 'rgba(255,138,61,.4)' : 'rgba(255,255,255,.2)';
        g.beginPath(); g.arc(b.x, b.y, BR * 1.8, 0, 7); g.fill();
        g.fillStyle = fireT > 0 ? '#ffb36b' : '#fff';
        g.beginPath(); g.arc(b.x, b.y, BR, 0, 7); g.fill();
      }
      if (balls.some(b => b.stuck)) {
        g.font = `700 ${18 * sc + 4}px Fredoka, sans-serif`; g.fillStyle = 'rgba(255,255,255,.8)'; g.textAlign = 'center';
        g.fillText(api.touch ? 'Tap to launch' : 'Click or Space to launch', w / 2, H * 0.68);
      }
      parts.draw(g);
      floats.draw(g);
      g.restore();
      for (let i = 0; i < lives; i++) drawHeart(g, 18 + i * 24, 20, 22);
      if (combo >= 3) {
        g.font = '700 18px Fredoka, sans-serif'; g.fillStyle = '#2ed3b7'; g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillText(`combo x${combo}`, w - 14, 20);
      }
    }

    const stop = loop(step);
    api.onCleanup(() => { stop(); keys.dispose(); });
    await ended;
    await new Promise(r => setTimeout(r, 700));
    stop();
    return { score: broken, title };
  },
};
