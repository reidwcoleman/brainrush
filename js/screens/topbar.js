import { h, icon, coin, fmt } from '../ui.js';
import { S, levelInfo, dayStreak } from '../store.js';
import { avatarSVG } from '../avatars.js';
import { toggleSound, sfx } from '../sound.js';
import { go } from '../router.js';

export function topbar({ back } = {}) {
  const lv = levelInfo();
  const soundBtn = h('button', { class: 'icon-btn', title: 'Sound', 'aria-label': 'Toggle sound' }, icon(S.sound ? 'sound' : 'mute'));
  soundBtn.addEventListener('click', () => {
    const on = toggleSound();
    soundBtn.replaceChildren(icon(on ? 'sound' : 'mute'));
    if (on) sfx('tap');
  });
  const streak = dayStreak();
  return h('header', { class: 'topbar' },
    back
      ? h('button', { class: 'icon-btn', onclick: back, 'aria-label': 'Back' }, icon('back'))
      : h('button', { class: 'logo', onclick: () => go('home') }, h('span', { class: 'logo-mark' }, icon('bolt')), 'Brainrush'),
    h('div', { class: 'topbar-right' },
      h('div', { class: `pill ${streak ? 'streak-on' : 'streak-off'}`, title: 'Days in a row' }, icon('flame'), streak),
      h('button', { class: 'pill tokens', onclick: () => go('shop'), title: 'Tokens: spend them in the shop' }, coin(), h('span', { class: 'tokens-num' }, fmt(S.tokens))),
      h('button', { class: 'pill level', onclick: () => go('shop'), title: `Level ${lv.level}: ${lv.into}/${lv.need} XP` },
        h('span', { class: 'level-av', html: avatarSVG(S.avatar, { size: 30 }) }),
        h('span', { class: 'level-text' }, `Lv ${lv.level}`),
        h('span', { class: 'level-bar' }, h('i', { style: { width: (lv.into / lv.need) * 100 + '%' } }))),
      soundBtn));
}
