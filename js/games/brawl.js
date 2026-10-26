// Blip Brawl: survive a swarm, level up, pick upgrades. Auto-aims for you.
import { makeCanvas, loop, Keys, Joystick, Particles, Floaters, Shake, loadImage, drawBlob, drawCoin, drawHeart, rand, clamp, dist } from './kit.js';
import { h } from '../ui.js';

const ICON = (inner, bg) => `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="${bg}"/>${inner}</svg>`;
const UPGRADES = [
  { id: 'rapid', name: 'Rapid Fire', desc: 'Shoot 25% faster', max: 5, icon: ICON('<path d="M26 8L14 27h9l-2 13 12-19h-9z" fill="#fff"/>', '#ff8a3d'), apply: s => (s.cd *= 0.75) },
  { id: 'multi', name: 'Multishot', desc: '+1 projectile per shot', max: 4, icon: ICON('<circle cx="16" cy="24" r="5" fill="#fff"/><circle cx="28" cy="16" r="5" fill="#fff"/><circle cx="28" cy="32" r="5" fill="#fff"/>', '#4d8bff'), apply: s => s.shots++ },
  { id: 'power', name: 'Power Up', desc: '+1 damage on every hit', max: 5, icon: ICON('<path d="M24 10l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#fff"/>', '#ff4d6d'), apply: s => s.dmg++ },
  { id: 'pierce', name: 'Piercing', desc: 'Shots pass through +1 enemy', max: 3, icon: ICON('<path d="M8 24h26M28 16l8 8-8 8" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>', '#b05cff'), apply: s => s.pierce++ },
  { id: 'orbit', name: 'Orbiters', desc: '+1 spinning orb that smacks enemies', max: 4, icon: ICON('<circle cx="24" cy="24" r="12" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 4"/><circle cx="36" cy="24" r="5" fill="#fff"/>', '#2ed3b7'), apply: s => s.orbits++ },
  { id: 'swift', name: 'Swift Feet', desc: 'Move 15% faster', max: 3, icon: ICON('<path d="M12 30l10-14 6 8 8-6" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', '#2fcf6f'), apply: s => (s.speed *= 1.15) },
  { id: 'magnet', name: 'Magnet', desc: 'Grab pickups from way farther', max: 3, icon: ICON('<path d="M14 12v12a10 10 0 0 0 20 0V12h-7v12a3 3 0 0 1-6 0V12z" fill="#fff"/>', '#ffc93c'), apply: s => (s.magnet *= 1.7) },
  { id: 'nova', name: 'Shockwave', desc: 'Blast everything near you every few seconds', max: 3, icon: ICON('<circle cx="24" cy="24" r="6" fill="#fff"/><circle cx="24" cy="24" r="14" fill="none" stroke="#fff" stroke-width="3"/>', '#5c3bd6'), apply: s => s.nova++ },
  { id: 'heal', name: 'Snack Break', desc: '+1 max heart and heal fully', max: 3, icon: ICON('<path d="M24 36C10 27 9 19 13 15c3-3 8-3 11 2 3-5 8-5 11-2 4 4 3 12-11 21z" fill="#fff"/>', '#ff5da2'), apply: (s, p) => { p.maxHp++; p.hp = p.maxHp; } },
];

const TYPES = {
  gloop: { r: 15, hp: 2, speed: 62, color: '#9c6bff', units: 0.12, xp: 1 },
  zipper: { r: 11, hp: 1, speed: 135, color: '#ff4d6d', units: 0.12, xp: 1 },
  brute: { r: 26, hp: 9, speed: 42, color: '#ff8a3d', units: 0.45, xp: 4, angry: true },
  spitter: { r: 16, hp: 4, speed: 55, color: '#2fcf6f', units: 0.3, xp: 2 },
  boss: { r: 50, hp: 140, speed: 48, color: '#5c3bd6', units: 6, xp: 20, angry: true },
};

export default {
  id: 'brawl',
  name: 'Blip Brawl',
  tagline: 'Survive the swarm, stack upgrades',
  goal: 'Survive 60 seconds. You shoot automatically. Grab blue gems to level up and pick a power. A boss shows up at the end.',
  controls: { desktop: 'Move: WASD / arrow keys (or drag)', touch: 'Drag anywhere to move' },
  color: 'purple',
  scoreLabel: 'KOs',
  art: `<svg viewBox="0 0 120 90"><circle cx="60" cy="48" r="20" fill="#ffc93c"/><circle cx="53" cy="44" r="4" fill="#231044"/><circle cx="67" cy="44" r="4" fill="#231044"/><circle cx="20" cy="20" r="11" fill="#9c6bff"/><circle cx="102" cy="26" r="9" fill="#ff4d6d"/><circle cx="98" cy="70" r="14" fill="#ff8a3d"/><circle cx="18" cy="70" r="10" fill="#2fcf6f"/><circle cx="36" cy="32" r="4" fill="#fff6c2"/><circle cx="84" cy="34" r="4" fill="#fff6c2"/><circle cx="82" cy="62" r="4" fill="#fff6c2"/><circle cx="60" cy="48" r="32" fill="none" stroke="#2ed3b7" stroke-width="3" stroke-dasharray="5 6"/></svg>`,

  async run(stage, api) {
    const { cv, g, w, h: H, local } = makeCanvas(stage);
    const img = await loadImage(api.avatarSVG(api.avatar, 120));
    const keys = new Keys();
    const joy = new Joystick(cv, local);
    const parts = new Particles(), floats = new Floaters(), shake = new Shake();
    const scale = clamp(Math.min(w, H) / 560, 0.7, 1.2);

    const P = { x: w / 2, y: H / 2, r: 22 * scale, hp: 5, maxHp: 5, inv: 0, face: 0 };
    const S = { cd: 0.5, dmg: 1, shots: 1, pierce: 0, speed: 215 * scale, magnet: 110 * scale, orbits: 0, nova: 0 };
    const taken = {};
    let xp = 0, level = 1, need = 4, kills = 0;
    let fireT = 0, novaT = 0, orbitA = 0, spawnT = 0, t = 0, bossSpawned = false, boss = null;
    const enemies = [], bullets = [], shots = [], drops = [], rings = [];
    let paused = false, over = false, title = 'You survived!';

    const spawn = type => {
      const T = TYPES[type];
      const side = Math.floor(Math.random() * 4);
      const m = T.r + 10;
      const x = side === 0 ? -m : side === 1 ? w + m : rand(0, w);
      const y = side === 2 ? -m : side === 3 ? H + m : rand(0, H);
      const hpScale = 1 + t / 70;
      const e = { type, x, y, r: T.r * scale, hp: T.hp * (type === 'boss' ? 1 : hpScale), max: 0, speed: T.speed * scale * (0.9 + Math.random() * 0.2), color: T.color, flash: 0, vx: 0, vy: 0, shootT: rand(1, 2.5), wob: Math.random() * 6 };
      e.max = e.hp;
      enemies.push(e);
      return e;
    };

    const levelUp = async () => {
      paused = true;
      timer.pause();
      const pool = UPGRADES.filter(u => (taken[u.id] || 0) < u.max).sort(() => Math.random() - 0.5).slice(0, 3);
      const i = await api.choose(`Level ${level}! Pick a power`, pool.map(u => ({ name: u.name + (taken[u.id] ? ` ${taken[u.id] + 1}` : ''), desc: u.desc, icon: u.icon })));
      const u = pool[i];
      taken[u.id] = (taken[u.id] || 0) + 1;
      u.apply(S, P);
      paused = false;
      timer.resume();
    };

    const kill = e => {
      const T = TYPES[e.type];
      kills++;
      api.add(T.units);
      parts.burst(e.x, e.y, { n: e.type === 'boss' ? 60 : 14, color: e.color, speed: e.type === 'boss' ? 420 : 240, life: 0.55, size: 7 });
      drops.push({ x: e.x, y: e.y, kind: 'xp', v: T.xp, t: 0 });
      if (Math.random() < 0.08 || e.type === 'brute') drops.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), kind: 'coin', t: 0 });
      if (Math.random() < 0.015) drops.push({ x: e.x, y: e.y, kind: 'heart', t: 0 });
      if (e.type === 'boss') {
        shake.add(14, 0.6);
        floats.add('BOSS DOWN!', w / 2, H / 2, { size: 46, color: '#ffc93c', life: 1.6, vy: -20 });
        for (let k = 0; k < 10; k++) drops.push({ x: e.x + rand(-50, 50), y: e.y + rand(-50, 50), kind: 'coin', t: 0 });
        api.sfx('win');
        boss = null;
      } else api.sfx('pop');
    };

    const hurt = (e, dmg, kx, ky) => {
      e.hp -= dmg;
      e.flash = 0.08;
      e.vx += kx * (e.type === 'boss' ? 30 : 160);
      e.vy += ky * (e.type === 'boss' ? 30 : 160);
      floats.add(String(Math.round(dmg)), e.x, e.y - e.r, { size: 16, color: '#fff', life: 0.5, vy: -80 });
      if (e.hp <= 0) { kill(e); return true; }
      return false;
    };

    const timer = api.timer(60);
    api.setInfo(h('span', { class: 'mg-lvl' }, 'Lv 1'));
    let endRes;
    const ended = new Promise(r => (endRes = r));
    timer.done.then(() => { if (!over) { over = true; api.add(3); endRes(); } });

    const step = dt => {
      if (paused) { draw(); return; }
      t += dt;
      // ---- spawning ----
      spawnT -= dt;
      if (spawnT <= 0) {
        const rate = Math.max(0.16, 0.85 - t * 0.012);
        spawnT = rate;
        const n = 1 + Math.floor(t / 20);
        for (let i = 0; i < n; i++) {
          const r = Math.random();
          spawn(t > 18 && r < 0.12 ? 'brute' : t > 25 && r < 0.22 ? 'spitter' : t > 7 && r < 0.45 ? 'zipper' : 'gloop');
        }
      }
      if (!bossSpawned && t > 42) {
        bossSpawned = true;
        boss = spawn('boss');
        floats.add('BOSS INCOMING!', w / 2, H * 0.3, { size: 40, color: '#ff4d6d', life: 1.8, vy: -10 });
        shake.add(8, 0.5);
        api.sfx('bad');
      }

      // ---- player ----
      const k = keys.axis();
      let mx = k.x + joy.vx, my = k.y + joy.vy;
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      P.x = clamp(P.x + mx * S.speed * dt, P.r, w - P.r);
      P.y = clamp(P.y + my * S.speed * dt, P.r, H - P.r);
      if (mx) P.face = mx;
      P.inv -= dt;

      // ---- auto fire at nearest ----
      fireT -= dt;
      if (fireT <= 0 && enemies.length) {
        let best = null, bd = Infinity;
        for (const e of enemies) { const d = dist(P.x, P.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
        if (best && bd < Math.max(w, H)) {
          fireT = S.cd;
          const a0 = Math.atan2(best.y - P.y, best.x - P.x);
          for (let i = 0; i < S.shots; i++) {
            const a = a0 + (i - (S.shots - 1) / 2) * 0.16;
            bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 560 * scale, vy: Math.sin(a) * 560 * scale, r: (5 + S.dmg * 0.6) * scale, pierce: S.pierce, life: 1.2, hit: new Set() });
          }
          api.sfx('tick');
        }
      }

      // ---- bullets ----
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        let dead = b.life <= 0 || b.x < -20 || b.x > w + 20 || b.y < -20 || b.y > H + 20;
        if (!dead) for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (b.hit.has(e) || dist(b.x, b.y, e.x, e.y) > e.r + b.r) continue;
          b.hit.add(e);
          const len = Math.hypot(b.vx, b.vy);
          if (hurt(e, S.dmg, b.vx / len, b.vy / len)) enemies.splice(j, 1);
          if (b.pierce-- <= 0) { dead = true; break; }
        }
        if (dead) bullets.splice(i, 1);
      }

      // ---- orbiters ----
      orbitA += dt * 3.2;
      const orbR = 62 * scale;
      for (let o = 0; o < S.orbits; o++) {
        const a = orbitA + (o / S.orbits) * Math.PI * 2;
        const ox = P.x + Math.cos(a) * orbR, oy = P.y + Math.sin(a) * orbR;
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (e.orbCd > 0 || dist(ox, oy, e.x, e.y) > e.r + 11 * scale) continue;
          e.orbCd = 0.35;
          if (hurt(e, 1 + S.dmg * 0.5, Math.cos(a), Math.sin(a))) enemies.splice(j, 1);
        }
      }

      // ---- shockwave ----
      if (S.nova) {
        novaT -= dt;
        if (novaT <= 0) {
          novaT = 3.6 - S.nova * 0.6;
          const R = (110 + S.nova * 30) * scale;
          rings.push({ x: P.x, y: P.y, r: 0, max: R, life: 0.35 });
          api.sfx('whoosh');
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const d = dist(P.x, P.y, e.x, e.y);
            if (d < R + e.r && hurt(e, 2 + S.dmg, (e.x - P.x) / (d || 1), (e.y - P.y) / (d || 1))) enemies.splice(j, 1);
          }
        }
      }

      // ---- enemies ----
      for (const e of enemies) {
        e.flash -= dt;
        e.orbCd = (e.orbCd || 0) - dt;
        e.wob += dt * 8;
        const d = dist(P.x, P.y, e.x, e.y) || 1;
        let sp = e.speed;
        if (e.type === 'spitter' && d < 220 * scale) sp = -e.speed * 0.4;
        e.x += ((P.x - e.x) / d) * sp * dt + e.vx * dt;
        e.y += ((P.y - e.y) / d) * sp * dt + e.vy * dt;
        e.vx *= 0.88; e.vy *= 0.88;
        if (e.type === 'spitter' || e.type === 'boss') {
          e.shootT -= dt;
          if (e.shootT <= 0 && d < 520 * scale) {
            e.shootT = e.type === 'boss' ? 1.1 : 2.4;
            const n = e.type === 'boss' ? 8 : 1;
            const a0 = Math.atan2(P.y - e.y, P.x - e.x);
            for (let i = 0; i < n; i++) {
              const a = e.type === 'boss' ? a0 + (i / n) * Math.PI * 2 : a0;
              shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190 * scale, vy: Math.sin(a) * 190 * scale, r: 7 * scale, life: 4 });
            }
          }
          if (e.type === 'boss' && Math.random() < dt * 0.8) { const m = spawn('zipper'); m.x = e.x; m.y = e.y; }
        }
        if (P.inv <= 0 && d < e.r + P.r * 0.7) damagePlayer();
      }
      // keep the swarm from stacking into one blob
      for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i];
        for (let j = i + 1; j < enemies.length; j++) {
          const b = enemies[j];
          const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < min * min) {
            const d = Math.sqrt(d2), push = (min - d) * 0.5;
            const ab = a.type === 'boss' ? 0.1 : 1, bb = b.type === 'boss' ? 0.1 : 1;
            a.x -= (dx / d) * push * ab; a.y -= (dy / d) * push * ab;
            b.x += (dx / d) * push * bb; b.y += (dy / d) * push * bb;
          }
        }
      }

      // ---- enemy shots ----
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        if (P.inv <= 0 && dist(s.x, s.y, P.x, P.y) < s.r + P.r * 0.6) { shots.splice(i, 1); damagePlayer(); continue; }
        if (s.life <= 0) shots.splice(i, 1);
      }

      // ---- pickups ----
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.t += dt;
        const dd = dist(d.x, d.y, P.x, P.y);
        if (dd < S.magnet) {
          const pull = 520 * dt * (1 - dd / S.magnet + 0.4);
          d.x += ((P.x - d.x) / dd) * pull; d.y += ((P.y - d.y) / dd) * pull;
        }
        if (dd < P.r + 8) {
          drops.splice(i, 1);
          if (d.kind === 'xp') {
            xp += d.v;
            api.sfx('coin');
            if (xp >= need) {
              xp -= need; level++; need = Math.round(3 + level * 3 + level * level * 0.6);
              api.setInfo(h('span', { class: 'mg-lvl' }, `Lv ${level}`));
              parts.burst(P.x, P.y, { n: 30, colors: ['#4dc3ff', '#fff', '#ffc93c'], speed: 300, life: 0.7 });
              levelUp();
            }
          } else if (d.kind === 'coin') { api.add(0.5); api.sfx('coin'); floats.add('+' + api.gold(0.5), d.x, d.y - 10); }
          else { P.hp = Math.min(P.maxHp, P.hp + 1); api.sfx('perfect'); floats.add('+1 heart', d.x, d.y - 10, { color: '#ff7a9a' }); }
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt; r.r = r.max * (1 - r.life / 0.35); if (r.life <= 0) rings.splice(i, 1); }

      parts.update(dt); floats.update(dt); shake.update(dt);
      keys.endFrame();
      draw();
    };

    function damagePlayer() {
      P.hp--;
      P.inv = 1.1;
      shake.add(9, 0.3);
      api.sfx('bad');
      parts.burst(P.x, P.y, { n: 18, color: '#ff4d6d', speed: 260 });
      if (P.hp <= 0 && !over) { over = true; title = 'Knocked out!'; timer.stop(); endRes(); }
    }

    function draw() {
      g.save();
      shake.apply(g);
      g.fillStyle = '#1b1240';
      g.fillRect(-20, -20, w + 40, H + 40);
      g.strokeStyle = 'rgba(255,255,255,.05)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x < w; x += 44) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (let y = 0; y < H; y += 44) { g.moveTo(0, y); g.lineTo(w, y); }
      g.stroke();

      for (const d of drops) {
        const bob = Math.sin(d.t * 6) * 2;
        if (d.kind === 'xp') {
          g.fillStyle = '#4dc3ff';
          g.beginPath(); g.moveTo(d.x, d.y - 7 + bob); g.lineTo(d.x + 5, d.y + bob); g.lineTo(d.x, d.y + 7 + bob); g.lineTo(d.x - 5, d.y + bob); g.fill();
        } else if (d.kind === 'coin') drawCoin(g, d.x, d.y + bob, 8, d.t * 5);
        else drawHeart(g, d.x, d.y + bob, 22);
      }
      for (const r of rings) { g.strokeStyle = `rgba(176,140,255,${r.life / 0.35})`; g.lineWidth = 6; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke(); }
      for (const e of enemies) {
        const look = Math.atan2(P.y - e.y, P.x - e.x);
        drawBlob(g, e.x, e.y, e.r, e.color, { flash: e.flash, angry: TYPES[e.type].angry, look, squish: Math.sin(e.wob) * 0.06 });
        if (e.type === 'boss') {
          g.fillStyle = '#ffc93c';
          g.beginPath(); g.moveTo(e.x - 26, e.y - e.r + 6); g.lineTo(e.x - 22, e.y - e.r - 20); g.lineTo(e.x - 8, e.y - e.r - 6); g.lineTo(e.x, e.y - e.r - 24); g.lineTo(e.x + 8, e.y - e.r - 6); g.lineTo(e.x + 22, e.y - e.r - 20); g.lineTo(e.x + 26, e.y - e.r + 6); g.fill();
        }
      }
      g.fillStyle = '#ff5da2';
      for (const s of shots) { g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
      for (const b of bullets) {
        g.fillStyle = 'rgba(255,220,90,.35)'; g.beginPath(); g.arc(b.x, b.y, b.r * 2, 0, 7); g.fill();
        g.fillStyle = '#fff6c2'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
      }
      for (let o = 0; o < S.orbits; o++) {
        const a = orbitA + (o / S.orbits) * Math.PI * 2;
        const ox = P.x + Math.cos(a) * 62 * scale, oy = P.y + Math.sin(a) * 62 * scale;
        g.fillStyle = 'rgba(46,211,183,.35)'; g.beginPath(); g.arc(ox, oy, 16 * scale, 0, 7); g.fill();
        g.fillStyle = '#2ed3b7'; g.beginPath(); g.arc(ox, oy, 10 * scale, 0, 7); g.fill();
      }
      if (!(P.inv > 0 && Math.floor(P.inv * 12) % 2)) {
        g.save();
        g.translate(P.x, P.y);
        if (P.face < 0) g.scale(-1, 1);
        g.drawImage(img, -P.r * 1.3, -P.r * 1.4, P.r * 2.6, P.r * 2.6);
        g.restore();
      }
      parts.draw(g);
      floats.draw(g);
      g.restore();

      // HUD on canvas: hearts, xp bar, boss bar
      for (let i = 0; i < P.maxHp; i++) drawHeart(g, 20 + i * 26, 22, 24, i < P.hp ? '#ff4d6d' : 'rgba(255,255,255,.18)');
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H - 8, w, 8);
      g.fillStyle = '#4dc3ff'; g.fillRect(0, H - 8, w * (xp / need), 8);
      if (boss) {
        const bw = Math.min(360, w - 40);
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect((w - bw) / 2, 14, bw, 14);
        g.fillStyle = '#ff4d6d'; g.fillRect((w - bw) / 2, 14, bw * Math.max(0, boss.hp / boss.max), 14);
        g.font = '700 13px Fredoka, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('QUIZ BOSS', w / 2, 21);
      }
      joy.draw(g);
    }

    const stop = loop(step);
    api.onCleanup(() => { stop(); keys.dispose(); });
    await ended;
    await new Promise(r => setTimeout(r, 700));
    stop();
    return { score: kills, title };
  },
};
