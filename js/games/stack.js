import { makeCanvas } from './index.js';
import { h, sleep } from '../ui.js';

export default {
  id: 'stack',
  name: 'Stack Attack',
  hint: 'Tap to drop each block. Line them up perfectly for bonus gold.',
  color: 'teal',
  async run(stage, api) {
    const { cv, g, w, h: H, toScreen } = makeCanvas(stage);
    const LH = Math.max(22, Math.min(30, H / 16));
    const baseW = Math.min(w * 0.55, 260);
    const tower = [{ x: (w - baseW) / 2, w: baseW }];
    const falling = [];
    let mover = null;
    let cam = 0;
    let over = false;
    let raf;
    let perfectRun = 0;
    const hue = i => `hsl(${(170 + i * 17) % 360} 80% 60%)`;

    const newMover = () => {
      const top = tower[tower.length - 1];
      const n = tower.length;
      mover = { x: n % 2 ? 0 : w - top.w, w: top.w, dir: n % 2 ? 1 : -1, speed: Math.min(2.6 + n * 0.32, 7.5) * (w / 420 + 0.4), born: performance.now() };
    };
    newMover();

    const rowY = i => H - 40 - (i + 1) * LH + cam;
    const block = (x, y, bw, c) => {
      g.fillStyle = c;
      g.beginPath(); g.roundRect(x, y, bw, LH - 3, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)';
      g.fillRect(x + 4, y + 3, Math.max(0, bw - 8), 4);
    };

    const frame = () => {
      const targetCam = Math.max(0, (tower.length - 7) * LH);
      cam += (targetCam - cam) * 0.12;
      g.clearRect(0, 0, w, H);
      g.fillStyle = 'rgba(255,255,255,.08)';
      g.fillRect(0, H - 40 + cam, w, 40);
      tower.forEach((b, i) => block(b.x, rowY(i), b.w, hue(i)));
      if (mover && !over) {
        mover.x += mover.speed * mover.dir;
        if (mover.x + mover.w > w + 10) mover.dir = -1;
        if (mover.x < -10) mover.dir = 1;
        block(mover.x, rowY(tower.length), mover.w, hue(tower.length));
      }
      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i];
        f.vy += 0.5; f.y += f.vy; f.rot += f.vr;
        g.save(); g.translate(f.x + f.w / 2, f.y); g.rotate(f.rot);
        block(-f.w / 2, 0, f.w, f.c);
        g.restore();
        if (f.y > H + 200) falling.splice(i, 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    api.onCleanup(() => cancelAnimationFrame(raf));


    const drop = () => {
      if (over || !mover) return;
      const top = tower[tower.length - 1];
      const i = tower.length;
      const y = rowY(i);
      const left = Math.max(mover.x, top.x);
      const right = Math.min(mover.x + mover.w, top.x + top.w);
      const overlap = right - left;
      if (performance.now() - mover.born < 200) return;
      if (overlap <= 0) {
        // A total miss just loses the block; keep stacking until the timer runs out.
        falling.push({ x: mover.x, y, w: mover.w, c: hue(i), vy: 0, rot: 0, vr: 0.05 });
        api.sfx('bad');
        perfectRun = 0;
        newMover();
        return;
      }
      const [sx, sy] = toScreen(mover.x + mover.w / 2, y);
      if (Math.abs(mover.x - top.x) < 6) {
        tower.push({ x: top.x, w: top.w });
        perfectRun++;
        api.sfx('perfect');
        api.add(0.6 + 0.3 * Math.min(perfectRun, 4), sx, sy - 10);
        // Three perfects in a row grows the block back a little.
        if (perfectRun >= 3) tower[i].w = Math.min(top.w + 8, baseW);
      } else {
        perfectRun = 0;
        const cutX = mover.x < top.x ? mover.x : right;
        falling.push({ x: cutX, y, w: mover.w - overlap, c: hue(i), vy: 0, rot: 0, vr: mover.x < top.x ? -0.06 : 0.06 });
        tower.push({ x: left, w: overlap });
        api.sfx('place');
        api.add(0.6, sx, sy - 10);
      }
      newMover();
    };

    const onKey = e => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); drop(); } };
    cv.addEventListener('pointerdown', drop);
    addEventListener('keydown', onKey);
    api.onCleanup(() => removeEventListener('keydown', onKey));
    stage.append(h('div', { class: 'mg-tip' }, 'Tap / Space'));
    await api.timer(12);
    over = true;
    await sleep(700);
  },
};
