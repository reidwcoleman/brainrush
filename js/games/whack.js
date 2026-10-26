import { h, pick, sleep } from '../ui.js';
import { centerOf } from '../fx.js';
import { AVATARS } from '../avatars.js';

const FRIENDS = AVATARS.filter(a => a.rarity === 'common').map(a => a.id);

export default {
  id: 'whack',
  name: 'Bonk-a-Blip',
  hint: 'Bonk the Blips as they pop up. Never bonk the red Imps!',
  color: 'green',
  async run(stage, api) {
    const holes = Array.from({ length: 9 }, () => {
      const mole = h('button', { class: 'mole', type: 'button' });
      const hole = h('div', { class: 'hole' }, h('div', { class: 'hole-pit' }), mole);
      return { hole, mole, busy: false, bad: false, timer: 0 };
    });
    stage.append(h('div', { class: 'whack-grid' }, holes.map(x => x.hole)));
    const start = performance.now();
    let alive = true;

    const hide = slot => {
      slot.mole.classList.remove('up');
      clearTimeout(slot.timer);
      setTimeout(() => { slot.busy = false; slot.mole.classList.remove('bonked'); }, 160);
    };

    holes.forEach(slot => slot.mole.addEventListener('pointerdown', () => {
      if (!slot.mole.classList.contains('up') || slot.mole.classList.contains('bonked')) return;
      slot.mole.classList.add('bonked');
      const [x, y] = centerOf(slot.mole);
      if (slot.bad) { api.sfx('bad'); api.add(-1.5, x, y - 30); stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 300); }
      else { api.sfx('bonk'); api.add(0.6, x, y - 30); }
      setTimeout(() => hide(slot), 120);
    }));

    const popOne = () => {
      if (!alive) return;
      const t = performance.now() - start;
      const free = holes.filter(x => !x.busy);
      if (free.length) {
        const slot = pick(free);
        slot.busy = true;
        slot.bad = Math.random() < 0.2;
        slot.mole.innerHTML = api.avatarSVG(slot.bad ? 'imp' : pick(FRIENDS), 80);
        slot.mole.classList.toggle('bad', slot.bad);
        slot.mole.classList.add('up');
        slot.timer = setTimeout(() => hide(slot), Math.max(520, 1000 - t / 12));
      }
      setTimeout(popOne, Math.max(260, 560 - t / 20));
    };
    popOne();
    api.onCleanup(() => { alive = false; holes.forEach(s => clearTimeout(s.timer)); });
    await api.timer(8);
    alive = false;
    await sleep(200);
  },
};
