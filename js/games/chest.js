import { h, sleep, fmt, coin } from '../ui.js';
import { centerOf, confetti } from '../fx.js';

const TABLE = [
  { units: 3, w: 30 },
  { units: 5, w: 26 },
  { units: 8, w: 16 },
  { units: 15, w: 6, label: 'JACKPOT' },
  { pct: 0.15, w: 12, label: '+15% gold' },
  { units: 1, w: 10, label: 'Just dust' },
];

function roll() {
  let r = Math.random() * TABLE.reduce((s, t) => s + t.w, 0);
  for (const t of TABLE) if ((r -= t.w) <= 0) return t;
  return TABLE[0];
}

const CHEST = `<svg viewBox="0 0 120 100">
  <g class="lid"><path d="M10 40C10 18 30 8 60 8C90 8 110 18 110 40Z" fill="#c9732d"/><path d="M10 40C10 18 30 8 60 8C90 8 110 18 110 40" fill="none" stroke="#8a4a17" stroke-width="5"/><rect x="52" y="8" width="16" height="32" fill="#ffc93c"/></g>
  <rect x="10" y="40" width="100" height="52" rx="6" fill="#b5601f"/><rect x="10" y="40" width="100" height="10" fill="#8a4a17"/>
  <rect x="52" y="40" width="16" height="52" fill="#ffc93c"/><rect x="50" y="46" width="20" height="18" rx="4" fill="#ffe08a" stroke="#c98a10" stroke-width="3"/>
</svg>`;

export default {
  id: 'chest',
  name: 'Treasure Pick',
  hint: 'Three chests. One is loaded. Pick fast!',
  color: 'gold',
  async run(stage, api) {
    const outcomes = [roll(), roll(), roll()];
    const valueOf = o => (o.pct ? Math.max(3, (api.sessionGold * o.pct) / api.unit) : o.units);
    let picked = -1;
    let done;
    const chosen = new Promise(r => (done = r));
    const chests = outcomes.map((o, i) => {
      const prize = h('div', { class: 'chest-prize' },
        o.label ? h('small', {}, o.label) : null,
        h('span', {}, coin(), '+' + fmt(valueOf(o) * api.unit)));
      const btn = h('button', { class: 'chest', html: CHEST, onclick: () => { if (picked < 0) { picked = i; done(); } } }, prize);
      btn.style.animationDelay = `${i * 0.12}s`;
      return btn;
    });
    stage.append(h('div', { class: 'chest-row' }, chests));
    const t = api.timer(6);
    await Promise.race([chosen, t]);
    t.stop();
    api.hideTimer();
    if (picked < 0) picked = Math.floor(Math.random() * 3);

    const el = chests[picked];
    el.classList.add('shake');
    api.sfx('shake');
    await sleep(500);
    el.classList.remove('shake');
    el.classList.add('open', 'picked');
    api.sfx('open');
    const [x, y] = centerOf(el);
    const v = valueOf(outcomes[picked]);
    api.add(v, x, y - 40);
    if (v >= 8) confetti(x, y, 60);
    await sleep(700);
    chests.forEach((c, i) => { if (i !== picked) c.classList.add('open', 'missed'); });
    await sleep(1200);
  },
};
