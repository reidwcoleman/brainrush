import { makeCanvas, svgImage } from './index.js';
import { h, rand } from '../ui.js';
import { avatarSVG } from '../avatars.js';

export default {
  id: 'catcher',
  name: 'Coin Catch',
  hint: 'Slide to catch falling coins and gems. Dodge the rocks!',
  color: 'blue',
  async run(stage, api) {
    const { cv, g, w, h: H, local, toScreen } = makeCanvas(stage);
    const img = svgImage(avatarSVG(api.avatar, { size: 120 }));
    const P = { x: w / 2, tx: w / 2, size: Math.min(84, w / 5), stun: 0 };
    const items = [];
    const keys = {};
    const start = performance.now();
    let spawnAt = 0;
    let raf;

    const spawn = t => {
      const r = Math.random();
      const kind = r < 0.14 ? 'gem' : r < 0.36 ? 'rock' : 'coin';
      items.push({ kind, x: rand(20, w - 20), y: -20, vy: rand(3, 4.6) * (H / 500) * (1 + t / 9000), rot: 0, vr: rand(-0.1, 0.1) });
    };

    const drawItem = it => {
      g.save();
      g.translate(it.x, it.y);
      g.rotate(it.rot);
      if (it.kind === 'coin') {
        g.fillStyle = '#f5a524'; g.beginPath(); g.arc(0, 2, 14, 0, 7); g.fill();
        g.fillStyle = '#ffd34e'; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
        g.strokeStyle = '#e8951c'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke();
      } else if (it.kind === 'gem') {
        g.fillStyle = '#4dc3ff';
        g.beginPath(); g.moveTo(-14, -4); g.lineTo(-8, -13); g.lineTo(8, -13); g.lineTo(14, -4); g.lineTo(0, 16); g.closePath(); g.fill();
        g.fillStyle = '#2a8fe0';
        g.beginPath(); g.moveTo(-14, -4); g.lineTo(14, -4); g.lineTo(0, 16); g.closePath(); g.fill();
      } else {
        g.fillStyle = '#6b6286';
        g.beginPath(); g.moveTo(-16, 4); g.lineTo(-10, -12); g.lineTo(6, -15); g.lineTo(17, -2); g.lineTo(10, 14); g.lineTo(-8, 15); g.closePath(); g.fill();
        g.fillStyle = '#857ba3';
        g.beginPath(); g.moveTo(-10, -8); g.lineTo(4, -11); g.lineTo(0, -2); g.closePath(); g.fill();
      }
      g.restore();
    };

    const frame = now => {
      const t = now - start;
      if (t > spawnAt) { spawn(t); spawnAt = t + Math.max(220, 480 - t / 25); }
      if (keys.ArrowLeft || keys.KeyA) P.tx -= 9;
      if (keys.ArrowRight || keys.KeyD) P.tx += 9;
      P.tx = Math.max(P.size / 2, Math.min(w - P.size / 2, P.tx));
      if (P.stun <= 0) P.x += (P.tx - P.x) * 0.3;
      else P.stun--;
      const py = H - P.size * 0.75;

      g.clearRect(0, 0, w, H);
      g.fillStyle = 'rgba(255,255,255,.1)';
      g.fillRect(0, H - 14, w, 14);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.vy;
        it.rot += it.vr;
        drawItem(it);
        if (Math.abs(it.x - P.x) < P.size * 0.5 && Math.abs(it.y - py) < P.size * 0.45) {
          items.splice(i, 1);
          const [sx, sy] = toScreen(it.x, it.y);
          if (it.kind === 'rock') { P.stun = 24; api.sfx('bad'); api.add(-1, sx, sy); }
          else { api.sfx('coin'); api.add(it.kind === 'gem' ? 1.2 : 0.4, sx, sy); }
        } else if (it.y > H + 30) items.splice(i, 1);
      }
      g.save();
      g.translate(P.x, py);
      if (P.stun > 0) { g.rotate(Math.sin(P.stun) * 0.3); g.globalAlpha = 0.6; }
      if (img.complete) g.drawImage(img, -P.size / 2, -P.size / 2, P.size, P.size);
      g.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const move = e => { P.tx = local(e)[0]; };
    cv.addEventListener('pointerdown', move);
    cv.addEventListener('pointermove', move);
    const kd = e => { keys[e.code] = true; };
    const ku = e => { keys[e.code] = false; };
    addEventListener('keydown', kd);
    addEventListener('keyup', ku);
    api.onCleanup(() => { cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); });
    stage.append(h('div', { class: 'mg-tip' }, 'Drag / arrow keys'));
    await api.timer(9);
  },
};
