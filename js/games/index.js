// Game time: pick one of three arcade games, play it, cash out.
// Games earn "units"; one unit is worth whatever a correct answer is worth right now,
// so payouts keep up as you buy upgrades.
import { h, sleep, fmt, coin, shuffle } from '../ui.js';
import { S, save } from '../store.js';
import { sfx } from '../sound.js';
import { confetti } from '../fx.js';
import { avatarSVG } from '../avatars.js';
import { isTouch } from './kit.js';
import brawl from './brawl.js';
import skyhop from './skyhop.js';
import bricks from './bricks.js';
import lanes from './lanes.js';
import slice from './slice.js';
import snake from './snake.js';

export const GAMES = [brawl, skyhop, bricks, lanes, slice, snake];
let lastPlayed = null;

export async function gameTime({ unit, avatar, forceId }) {
  const overlay = h('div', { class: 'mg-overlay' });
  document.body.append(overlay);
  sfx('ready');

  const game = forceId ? GAMES.find(g => g.id === forceId) : await pickGame(overlay);
  lastPlayed = game.id;
  const result = await playGame(overlay, game, { unit, avatar });
  overlay.classList.add('out');
  await sleep(220);
  overlay.remove();
  return result;
}

function pickGame(overlay) {
  return new Promise(resolve => {
    const options = shuffle(GAMES.filter(g => g.id !== lastPlayed)).slice(0, 3);
    const best = S.gameBest || {};
    const cards = options.map((g, i) => h('button', {
      class: `pick-card tone-${g.color}`, style: { animationDelay: `${0.15 + i * 0.1}s` },
      onclick: () => { sfx('tap'); wrap.classList.add('out'); setTimeout(() => { wrap.remove(); resolve(g); }, 200); },
    },
      h('div', { class: 'pick-art', html: g.art }),
      h('div', { class: 'pick-name' }, g.name),
      h('div', { class: 'pick-tag' }, g.tagline),
      h('div', { class: 'pick-best' }, best[g.id] ? `Best: ${fmt(best[g.id])} ${g.scoreLabel}` : 'Never played'),
      h('div', { class: 'pick-go' }, 'Play')));
    const wrap = h('div', { class: 'picker' },
      h('div', { class: 'picker-title' }, 'GAME TIME!'),
      h('div', { class: 'picker-sub' }, '10 right answers unlocked a game. Pick one:'),
      h('div', { class: 'pick-row' }, cards));
    overlay.append(wrap);
  });
}

async function playGame(overlay, game, { unit, avatar }) {
  let units = 0;
  const cleanups = [];
  const total = h('span', { class: 'mg-total-num' }, '0');
  const bar = h('div', { class: 'mg-timer-fill' });
  const info = h('div', { class: 'mg-info' });
  const stage = h('div', { class: 'mg-stage' });
  const hud = h('div', { class: 'mg-hud' },
    h('div', { class: 'mg-name' }, game.name),
    h('div', { class: 'mg-timer' }, bar),
    info,
    h('div', { class: 'mg-total' }, coin(), total));
  const panel = h('div', { class: `mg-panel big tone-${game.color}` }, hud, stage);
  overlay.append(panel);
  await sleep(30);

  // Intro: name, how to play, countdown.
  const touch = isTouch();
  const n = h('div', { class: 'mg-intro-go' }, 'Get ready');
  const intro = h('div', { class: 'mg-intro' },
    h('div', { class: 'mg-intro-art', html: game.art }),
    h('div', { class: 'mg-intro-title' }, game.name),
    h('div', { class: 'mg-intro-hint' }, game.goal),
    h('div', { class: 'mg-intro-controls' }, touch ? game.controls.touch : game.controls.desktop),
    n);
  stage.append(intro);
  await sleep(1300);
  for (const s of ['3', '2', '1']) { n.textContent = s; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); sfx('tick'); await sleep(520); }
  n.textContent = 'GO!';
  sfx('ready');
  await sleep(250);
  intro.remove();

  const api = {
    unit, avatar, sfx, touch,
    get units() { return units; },
    add(nu) {
      units += nu;
      total.textContent = fmt(Math.max(0, units) * unit);
      const t = total.parentElement;
      t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump');
    },
    gold: nu => fmt(Math.abs(nu) * unit),
    setInfo(...nodes) { info.replaceChildren(...nodes); },
    // A pausable countdown that drains the HUD bar.
    timer(secs) {
      let left = secs, paused = false, raf, last = performance.now(), res;
      const done = new Promise(r => (res = r));
      const step = now => {
        const dt = (now - last) / 1000; last = now;
        if (!paused) left -= dt;
        bar.style.transform = `scaleX(${Math.max(0, left / secs)})`;
        bar.classList.toggle('low', left < secs * 0.2);
        if (left <= 0) return res();
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      cleanups.push(() => cancelAnimationFrame(raf));
      return { done, pause() { paused = true; }, resume() { paused = false; last = performance.now(); }, stop() { cancelAnimationFrame(raf); res(); }, get left() { return left; } };
    },
    hideTimer() { bar.parentElement.style.visibility = 'hidden'; },
    // Pause-and-pick overlay (used for level-up upgrades).
    choose(title, options) {
      return new Promise(resolve => {
        const box = h('div', { class: 'choose' },
          h('div', { class: 'choose-title' }, title),
          h('div', { class: 'choose-row' }, options.map((o, i) => h('button', {
            class: 'choose-card', style: { animationDelay: `${i * 0.07}s` },
            onclick: () => { sfx('perfect'); box.remove(); resolve(i); },
          }, h('div', { class: 'choose-ic', html: o.icon || '' }), h('div', { class: 'choose-name' }, o.name), h('div', { class: 'choose-desc' }, o.desc)))));
        stage.append(box);
        sfx('win');
      });
    },
    onCleanup(fn) { cleanups.push(fn); },
    avatarSVG: (id, size) => avatarSVG(id, { size }),
  };

  let res;
  try {
    res = await game.run(stage, api);
  } finally {
    cleanups.forEach(fn => { try { fn(); } catch { /* ignore */ } });
  }

  units = Math.max(0, units);
  const gold = Math.round(units * unit);
  S.gameBest ||= {};
  const prev = S.gameBest[game.id] || 0;
  const isBest = res.score > prev;
  if (isBest) S.gameBest[game.id] = res.score;
  save();

  const cont = h('button', { class: 'btn big yellow' }, 'Back to questions');
  stage.replaceChildren(h('div', { class: 'mg-result' },
    h('div', { class: 'mg-result-label' }, res.title || 'Game over'),
    h('div', { class: 'mg-result-score' }, `${fmt(res.score)} ${game.scoreLabel}`,
      isBest ? h('span', { class: 'best-badge' }, 'NEW BEST!') : h('span', { class: 'best-old' }, `Best ${fmt(prev)}`)),
    h('div', { class: 'mg-result-gold' }, coin('lg'), `+${fmt(gold)}`),
    h('div', { class: 'mg-result-avatar', html: avatarSVG(avatar, { size: 84 }) }),
    cont));
  sfx('win');
  confetti(innerWidth / 2, innerHeight / 2.5, isBest ? 160 : 80);
  await new Promise(r => { cont.addEventListener('click', r); setTimeout(() => cont.focus(), 400); });
  return { gold, game: game.id, score: res.score };
}
