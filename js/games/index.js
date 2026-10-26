// Mini-game runner: intro card -> the game -> payout card.
// Games earn "units"; one unit is worth whatever a correct answer is worth right now,
// so the mini-games keep up as you upgrade.
import { h, sleep, fmt, coin } from '../ui.js';
import { sfx } from '../sound.js';
import { confetti, floatText } from '../fx.js';
import { avatarSVG } from '../avatars.js';
import chest from './chest.js';
import balloons from './balloons.js';
import stack from './stack.js';
import whack from './whack.js';
import slots from './slots.js';
import catcher from './catcher.js';
import quickdraw from './quickdraw.js';

export const GAMES = [chest, balloons, stack, whack, slots, catcher, quickdraw];
let recent = [];

function pickGame() {
  const pool = GAMES.filter(g => !recent.includes(g.id));
  const game = pool[Math.floor(Math.random() * pool.length)];
  recent = [game.id, ...recent].slice(0, 3);
  return game;
}

export async function playMinigame({ unit, sessionGold, avatar, forceId }) {
  const game = (forceId && GAMES.find(g => g.id === forceId)) || pickGame();
  let units = 0;
  const cleanups = [];

  const total = h('span', { class: 'mg-total-num' }, '0');
  const bar = h('div', { class: 'mg-timer-fill' });
  const stage = h('div', { class: 'mg-stage' });
  const hud = h('div', { class: 'mg-hud' },
    h('div', { class: 'mg-name' }, game.name),
    h('div', { class: 'mg-timer' }, bar),
    h('div', { class: 'mg-total' }, coin(), total));
  const panel = h('div', { class: `mg-panel tone-${game.color}` }, hud, stage);
  const overlay = h('div', { class: 'mg-overlay' }, panel);
  document.body.append(overlay);

  // Intro card
  const intro = h('div', { class: 'mg-intro' },
    h('div', { class: 'mg-intro-tag' }, 'Mini-game!'),
    h('div', { class: 'mg-intro-title' }, game.name),
    h('div', { class: 'mg-intro-hint' }, game.hint),
    h('div', { class: 'mg-intro-go' }, 'Get ready...'));
  stage.append(intro);
  sfx('ready');
  await sleep(1500);
  intro.querySelector('.mg-intro-go').textContent = 'GO!';
  await sleep(350);
  intro.remove();

  let timerRaf = 0;
  const api = {
    unit, sessionGold, avatar, sfx,
    get units() { return units; },
    add(n, x, y) {
      units += n;
      total.textContent = fmt(Math.max(0, units) * unit);
      total.parentElement.classList.remove('bump');
      void total.offsetWidth;
      total.parentElement.classList.add('bump');
      if (x != null) floatText(`${n >= 0 ? '+' : '-'}${fmt(Math.abs(n) * unit)}`, x, y, n >= 0 ? 'good' : 'bad');
    },
    // Resolves after `secs`; the HUD bar drains meanwhile. stop() ends it early.
    timer(secs) {
      const start = performance.now();
      let stopFn;
      const p = new Promise(res => {
        stopFn = res;
        const step = now => {
          const left = 1 - (now - start) / (secs * 1000);
          bar.style.transform = `scaleX(${Math.max(0, left)})`;
          bar.classList.toggle('low', left < 0.25);
          if (left <= 0) return res();
          timerRaf = requestAnimationFrame(step);
        };
        timerRaf = requestAnimationFrame(step);
      });
      p.stop = () => { cancelAnimationFrame(timerRaf); stopFn(); };
      return p;
    },
    hideTimer() { bar.parentElement.style.visibility = 'hidden'; },
    onCleanup(fn) { cleanups.push(fn); },
    avatarSVG: (id, size) => avatarSVG(id, { size }),
  };

  try {
    await game.run(stage, api);
  } finally {
    cancelAnimationFrame(timerRaf);
    cleanups.forEach(fn => { try { fn(); } catch { /* ignore */ } });
  }

  units = Math.max(0, units);
  const gold = Math.round(units * unit);
  stage.replaceChildren(h('div', { class: 'mg-result' },
    h('div', { class: 'mg-result-label' }, gold > 0 ? 'You earned' : 'No luck this time'),
    h('div', { class: 'mg-result-gold' }, coin('lg'), `+${fmt(gold)}`),
    h('div', { class: 'mg-result-avatar', html: avatarSVG(avatar, { size: 84 }) }),
    h('div', { class: 'mg-result-next' }, 'Back to the questions...')));
  if (gold > 0) { sfx('win'); confetti(innerWidth / 2, innerHeight / 2.5, 70); }
  await sleep(1700);
  overlay.classList.add('out');
  await sleep(220);
  overlay.remove();
  return { gold, game: game.id };
}

// Shared canvas setup for the canvas-drawn games.
export function makeCanvas(stage) {
  const cv = h('canvas', { class: 'mg-canvas' });
  stage.append(cv);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = stage.getBoundingClientRect();
  const w = r.width, hgt = r.height;
  cv.width = w * dpr;
  cv.height = hgt * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const toScreen = (x, y) => { const b = cv.getBoundingClientRect(); return [b.left + x, b.top + y]; };
  const local = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  return { cv, g, w, h: hgt, toScreen, local };
}

export function svgImage(svg) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  return img;
}
