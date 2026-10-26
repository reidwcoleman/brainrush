import { h, sleep } from '../ui.js';
import { confetti, centerOf } from '../fx.js';

const SYM = {
  seven: '<svg viewBox="0 0 60 60"><text x="30" y="49" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="52" fill="#ff4d6d" stroke="#a3142f" stroke-width="2.5">7</text></svg>',
  gem: '<svg viewBox="0 0 60 60"><path d="M14 22L22 10H38L46 22L30 50Z" fill="#4dc3ff"/><path d="M14 22H46L30 50Z" fill="#2a8fe0"/><path d="M22 10L26 22L30 10L34 22L38 10" fill="none" stroke="#bfe9ff" stroke-width="2"/></svg>',
  star: '<svg viewBox="0 0 60 60"><path d="M30 6L37 21L53 23L41 34L44 50L30 42L16 50L19 34L7 23L23 21Z" fill="#ffc93c" stroke="#e39a10" stroke-width="2.5" stroke-linejoin="round"/></svg>',
  heart: '<svg viewBox="0 0 60 60"><path d="M30 50C10 36 6 26 10 18C14 10 25 9 30 18C35 9 46 10 50 18C54 26 50 36 30 50Z" fill="#ff5da2"/></svg>',
  coin: '<svg viewBox="0 0 60 60"><circle cx="30" cy="31" r="22" fill="#f5a524"/><circle cx="30" cy="29" r="20" fill="#ffd34e"/><circle cx="30" cy="29" r="13" fill="none" stroke="#e8951c" stroke-width="3"/></svg>',
};
const KEYS = Object.keys(SYM);

export default {
  id: 'slots',
  name: 'Lucky Reels',
  hint: 'Tap STOP to freeze each reel. Match symbols. Three 7s is huge.',
  color: 'red',
  async run(stage, api) {
    const SH = 84; // symbol height in px
    const reels = [0, 1, 2].map(i => {
      const order = KEYS.slice().sort(() => Math.random() - 0.5);
      const strip = h('div', { class: 'reel-strip' });
      // Repeat the strip so it can scroll seamlessly.
      for (let k = 0; k < 4; k++) order.forEach(s => strip.append(h('div', { class: 'reel-sym', html: SYM[s] })));
      return { el: h('div', { class: 'reel' }, strip, h('div', { class: 'reel-shade' })), strip, order, pos: Math.random() * order.length * SH, speed: 12 + i * 2.2, stopped: false, result: null };
    });
    const btn = h('button', { class: 'btn big red slot-stop', type: 'button' }, 'STOP');
    stage.append(h('div', { class: 'slots' }, h('div', { class: 'reels' }, reels.map(r => r.el), h('div', { class: 'payline' })), btn,
      h('div', { class: 'slot-pay' }, 'Three of a kind = big win. Two = small win.')));

    const loopLen = SH * KEYS.length;
    let raf;
    const frame = () => {
      for (const r of reels) {
        if (!r.stopped) r.pos = (r.pos + r.speed) % loopLen;
        // Center the current symbol in the middle of the window (window shows ~1.6 symbols).
        r.strip.style.transform = `translateY(${-(r.pos + loopLen) + SH * 0.3}px)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    api.onCleanup(() => cancelAnimationFrame(raf));

    let next = 0;
    let finish;
    const allStopped = new Promise(r => (finish = r));
    const stopNext = () => {
      if (next > 2) return;
      const r = reels[next++];
      const idx = Math.round(r.pos / SH) % KEYS.length;
      r.pos = idx * SH;
      r.stopped = true;
      r.result = r.order[idx];
      r.el.classList.add('stopped');
      api.sfx('place');
      if (next > 2) finish();
    };
    btn.addEventListener('pointerdown', stopNext);
    const onKey = e => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); stopNext(); } };
    addEventListener('keydown', onKey);
    api.onCleanup(() => removeEventListener('keydown', onKey));

    const t = api.timer(7);
    await Promise.race([allStopped, t.then(async () => { while (next <= 2) { stopNext(); await sleep(250); } })]);
    t.stop();
    api.hideTimer();
    btn.disabled = true;
    await sleep(350);

    const res = reels.map(r => r.result);
    const counts = {};
    res.forEach(s => (counts[s] = (counts[s] || 0) + 1));
    const best = Math.max(...Object.values(counts));
    const [x, y] = centerOf(stage.querySelector('.reels'));
    let units = 1.5, label = 'No match';
    if (best === 3) { units = res[0] === 'seven' ? 25 : 12; label = res[0] === 'seven' ? 'TRIPLE 7!' : 'Three of a kind!'; confetti(x, y, 120); api.sfx('win'); }
    else if (best === 2) { units = 4; label = 'A pair!'; api.sfx('coin'); }
    stage.querySelector('.slot-pay').textContent = label;
    stage.querySelector('.slot-pay').classList.add('hit');
    api.add(units, x, y - 60);
    await sleep(1300);
  },
};
