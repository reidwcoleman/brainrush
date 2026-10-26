import { h, coin, sleep, modal, toast } from '../ui.js';
import { S, save } from '../store.js';
import { AVATARS, BOXES, RARITY, DUPE_REFUND, avatarSVG, rollBox, avatarById } from '../avatars.js';
import { confetti } from '../fx.js';
import { sfx } from '../sound.js';
import { go } from '../router.js';
import { topbar } from './topbar.js';

const BOX_ART = color => {
  const c = { blue: ['#4d8bff', '#2f62d6'], purple: ['#b05cff', '#7a34d6'], gold: ['#ffc93c', '#e39a10'] }[color];
  return `<svg viewBox="0 0 100 100"><path d="M14 38L50 22L86 38V76L50 92L14 76Z" fill="${c[1]}"/><path d="M14 38L50 54L86 38L50 22Z" fill="${c[0]}"/><path d="M50 54V92" stroke="rgba(0,0,0,.2)" stroke-width="3"/><path d="M32 30L68 46V58L62 55V48L26 32Z" fill="#fff" opacity=".85"/><text x="50" y="80" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="22" fill="#fff" opacity=".9">?</text></svg>`;
};

export default function shop(app) {
  const render = () => {
    app.replaceChildren(
      topbar({ back: () => go('home') }),
      h('main', { class: 'wrap shop' },
        h('h1', { class: 'page-title' }, 'Blip Shop'),
        h('p', { class: 'muted' }, 'Earn tokens by answering questions, playing mini-games and learning cards. Spend them on mystery boxes to collect Blips.'),
        h('div', { class: 'box-row' }, BOXES.map(b => {
          const can = S.tokens >= b.cost;
          return h('div', { class: `box-card tone-${b.color}` },
            h('div', { class: 'box-art', html: BOX_ART(b.color) }),
            h('h3', {}, b.name),
            h('ul', { class: 'odds' }, Object.entries(b.odds).filter(([, w]) => w > 0).map(([k, w]) =>
              h('li', {}, h('i', { style: { background: RARITY[k].color } }), RARITY[k].label, h('span', {}, `${w}%`)))),
            h('button', { class: `btn ${can ? 'green' : 'locked'} full`, disabled: !can, onclick: () => openBox(b, render) }, coin(), b.cost));
        })),
        h('div', { class: 'section-head' },
          h('h2', {}, 'Your collection'),
          h('span', { class: 'muted' }, `${S.owned.length}/${AVATARS.length} found · tap one to wear it`)),
        h('div', { class: 'collection' }, AVATARS.map(a => {
          const owned = S.owned.includes(a.id);
          return h('button', {
            class: `col-item r-${a.rarity} ${owned ? '' : 'locked'} ${S.avatar === a.id ? 'on' : ''}`,
            disabled: !owned,
            onclick: () => { S.avatar = a.id; save(); sfx('tap'); render(); },
          },
            h('div', { class: 'col-art', html: avatarSVG(a.id, { size: 72, silhouette: !owned }) }),
            h('div', { class: 'col-name' }, owned ? a.name : '???'),
            h('div', { class: 'col-rarity', style: { color: RARITY[a.rarity].color } }, RARITY[a.rarity].label));
        }))));
  };
  render();
}

async function openBox(box, rerender) {
  if (S.tokens < box.cost) return;
  S.tokens -= box.cost;
  const got = rollBox(box);
  const dupe = S.owned.includes(got.id);
  if (dupe) S.tokens += DUPE_REFUND[got.rarity];
  else S.owned.push(got.id);
  save();

  const art = h('div', { class: 'open-box', html: BOX_ART(box.color) });
  const stage = h('div', { class: 'open-stage' }, art, h('div', { class: 'open-tip' }, 'Opening...'));
  const m = modal(stage, { locked: true });
  m.el.classList.add('open-modal');
  for (let i = 0; i < 6; i++) { art.classList.remove('wiggle'); void art.offsetWidth; art.classList.add('wiggle'); sfx('shake'); await sleep(170 + i * 25); }
  sfx('open');
  const a = avatarById(got.id);
  const rar = RARITY[a.rarity];
  stage.replaceChildren(
    h('div', { class: `reveal r-${a.rarity}`, style: { '--rc': rar.color } },
      h('div', { class: 'reveal-burst' }),
      h('div', { class: 'reveal-art', html: avatarSVG(a.id, { size: 160 }) }),
      h('div', { class: 'reveal-rarity' }, rar.label),
      h('div', { class: 'reveal-name' }, a.name),
      h('div', { class: 'reveal-note' }, dupe ? ['Already have it. Refunded ', coin(), ` ${DUPE_REFUND[a.rarity]}`] : 'New Blip unlocked!'),
      h('div', { class: 'row gap center' },
        dupe ? null : h('button', { class: 'btn yellow', onclick: () => { S.avatar = a.id; save(); m.close(); rerender(); toast(`You're now ${a.name}`); } }, 'Wear it'),
        h('button', { class: 'btn ghost-light', onclick: () => { m.close(); rerender(); } }, 'Nice!'))));
  confetti(innerWidth / 2, innerHeight / 2.4, a.rarity === 'legendary' ? 220 : a.rarity === 'epic' ? 140 : 70);
  if (a.rarity === 'legendary' || a.rarity === 'epic') setTimeout(() => sfx('win'), 300);
  rerender();
}
