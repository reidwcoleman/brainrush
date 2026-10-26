import { h, sleep, rand } from '../ui.js';
import { centerOf } from '../fx.js';

export default {
  id: 'quickdraw',
  name: 'Quick Draw',
  hint: 'Wait for GREEN, then tap as fast as you can. Three rounds.',
  color: 'orange',
  async run(stage, api) {
    api.hideTimer();
    const label = h('div', { class: 'qd-label' }, 'Wait...');
    const sub = h('div', { class: 'qd-sub' }, 'Round 1 of 3');
    const pad = h('button', { class: 'qd-pad wait', type: 'button' }, label, sub);
    const dots = h('div', { class: 'qd-dots' }, [0, 1, 2].map(() => h('span')));
    stage.append(h('div', { class: 'qd' }, pad, dots));

    let tapped = null;
    const onTap = () => { tapped ||= performance.now(); };
    pad.addEventListener('pointerdown', onTap);
    const onKey = e => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); onTap(); } };
    addEventListener('keydown', onKey);
    api.onCleanup(() => removeEventListener('keydown', onKey));

    for (let round = 0; round < 3; round++) {
      tapped = null;
      pad.className = 'qd-pad wait';
      label.textContent = 'Wait for green...';
      sub.textContent = `Round ${round + 1} of 3`;
      const waitMs = rand(900, 2300);
      const t0 = performance.now();
      while (performance.now() - t0 < waitMs && !tapped) await sleep(16);
      const dot = dots.children[round];
      if (tapped) {
        pad.className = 'qd-pad early';
        label.textContent = 'Too soon!';
        sub.textContent = 'Wait for the green';
        api.sfx('wrong');
        dot.className = 'miss';
        await sleep(900);
        continue;
      }
      pad.className = 'qd-pad go';
      label.textContent = 'TAP!';
      sub.textContent = '';
      const go = performance.now();
      while (!tapped && performance.now() - go < 1500) await sleep(4);
      const ms = tapped ? Math.round(tapped - go) : null;
      const units = ms == null ? 0 : ms < 260 ? 4 : ms < 360 ? 3 : ms < 500 ? 2 : 1;
      pad.className = 'qd-pad done';
      label.textContent = ms == null ? 'Too slow!' : `${ms} ms`;
      sub.textContent = ms == null ? '' : ms < 260 ? 'Lightning!' : ms < 360 ? 'Fast!' : ms < 500 ? 'Nice' : 'Okay';
      dot.className = units >= 3 ? 'great' : units ? 'ok' : 'miss';
      if (units) { const [x, y] = centerOf(pad); api.sfx(units >= 3 ? 'perfect' : 'coin'); api.add(units, x, y - 60); }
      await sleep(900);
    }
  },
};
