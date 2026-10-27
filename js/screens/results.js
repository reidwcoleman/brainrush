import { h, icon, coin, fmt, sleep, cardImg } from '../ui.js';
import { S, getSet, levelInfo, mastery, dayStreak } from '../store.js';
import { avatarSVG } from '../avatars.js';
import { confetti } from '../fx.js';
import { sfx } from '../sound.js';
import { go } from '../router.js';
import { topbar } from './topbar.js';

export default function results(app, r) {
  const set = getSet(r.setId);
  if (!set) return go('home');
  const acc = r.answered ? Math.round((r.correct / r.answered) * 100) : 0;
  const newBest = r.gold > r.prevBest && r.prevBest > 0;
  const lv = levelInfo();
  const leveled = lv.level > r.levelBefore;
  const m = mastery(set);
  const byId = id => set.cards.find(c => c.id === id);

  const tile = (label, value, ic) => h('div', { class: 'stat' }, h('div', { class: 'stat-ic' }, icon(ic)), h('div', { class: 'stat-v' }, value), h('div', { class: 'stat-l' }, label));

  const goldNum = h('span', {}, '0');
  app.append(
    topbar(),
    h('main', { class: 'wrap narrow results' },
      h('section', { class: 'res-hero' },
        h('div', { class: 'res-av', html: avatarSVG(S.avatar, { size: 120 }) }),
        h('div', { class: 'res-kicker' }, newBest ? 'New personal best!' : r.answered ? 'Session complete' : 'Session ended'),
        h('div', { class: 'res-gold' }, coin('xl'), goldNum),
        h('div', { class: 'muted' }, set.title, r.prevBest && !newBest ? ` · Best ${fmt(r.prevBest)}` : '')),
      h('div', { class: 'stats' },
        tile('Accuracy', acc + '%', 'target'),
        tile('Answered', r.answered, 'check'),
        tile('Best streak', r.bestStreak, 'flame'),
        tile('Games played', r.games, 'game')),
      h('section', { class: 'rewards' },
        h('div', { class: 'reward' }, coin('lg'), h('b', {}, `+${r.tokens}`), ' tokens'),
        h('div', { class: 'reward' }, icon('star'), h('b', {}, `+${r.xp}`), ' XP'),
        r.newDay ? h('div', { class: 'reward' }, icon('flame'), h('b', {}, dayStreak()), ` day streak`) : null,
        h('div', { class: 'res-level' },
          h('span', {}, `Level ${lv.level}`),
          h('div', { class: 'bar' }, h('i', { style: { width: (lv.into / lv.need) * 100 + '%' } })),
          h('span', { class: 'muted' }, `${lv.into}/${lv.need}`)),
        leveled ? h('div', { class: 'level-up' }, `LEVEL UP! You're now level ${lv.level}`) : null),
      h('section', { class: 'res-progress' },
        h('div', { class: 'row between' }, h('h3', {}, 'Quiz progress'), h('b', {}, `${m.pct}%`)),
        h('div', { class: 'bar big' }, h('i', { style: { width: m.pct + '%' } })),
        h('p', { class: 'muted' }, `${m.mastered} of ${set.cards.length} questions fully learned.`,
          r.mastered.length ? ` You locked in ${r.mastered.length} this session.` : '')),
      r.missed.length ? h('section', { class: 'review' },
        h('h3', {}, 'Worth another look'),
        h('p', { class: 'muted' }, 'You missed these this round. Read them once more now: it helps them stick.'),
        r.missed.slice(0, 12).map(([id, n]) => {
          const c = byId(id);
          if (!c) return null;
          return h('div', { class: 'review-item' },
            h('div', { class: 'review-q' }, c.q, n > 1 ? h('span', { class: 'tag' }, `missed ${n}x`) : null),
            cardImg(c.img, 'review-img'),
            h('div', { class: 'review-a' }, icon('check'), c.a),
            c.explain ? h('div', { class: 'review-x' }, c.explain) : null);
        })) : null,
      h('div', { class: 'res-actions' },
        h('button', { class: 'btn big green', onclick: () => go('play', { id: set.id, opts: r.opts }) }, icon('play'), 'Play again'),
        h('button', { class: 'btn big yellow', onclick: () => go('shop') }, icon('box'), S.tokens >= 40 ? 'Open a box' : 'Shop'),
        h('button', { class: 'btn big ghost-light', onclick: () => go('home') }, 'Home'))));

  (async () => {
    await sleep(250);
    sfx('win');
    confetti(innerWidth / 2, innerHeight / 3, newBest || leveled ? 160 : 90);
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 900);
      goldNum.textContent = fmt(r.gold * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })();
}
