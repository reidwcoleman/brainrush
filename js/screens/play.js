import { h, icon, coin, fmt, sleep, confirmBox } from '../ui.js';
import { S, save, getSet, cardProgress, MASTERED_BOX, touchDay, levelInfo } from '../store.js';
import { Session, checkTyped } from '../engine.js';
import { playMinigame } from '../games/index.js';
import { sfx } from '../sound.js';
import { confetti, floatText, centerOf } from '../fx.js';
import { avatarSVG } from '../avatars.js';
import { go } from '../router.js';

// In-session upgrades, Gimkit style: spend gold to earn gold faster.
const UPGRADES = {
  value: { name: 'Answer value', vals: [10, 25, 50, 100, 200, 400, 800, 1600], costs: [60, 220, 650, 1600, 4200, 11000, 28000], show: v => `${fmt(v)}/answer` },
  streak: { name: 'Streak bonus', vals: [0, 3, 8, 20, 50, 120, 300], costs: [90, 320, 1000, 3000, 8000, 22000], show: v => `+${fmt(v)} per streak` },
  mult: { name: 'Multiplier', vals: [1, 1.5, 2, 3, 5], costs: [350, 1800, 7000, 24000], show: v => `x${v}` },
};

export default function play(app, { id, opts }) {
  const set = getSet(id);
  if (!set) return go('home');
  const progress = cardProgress(set.id);
  const goal = opts.goal;
  if (goal === 'mastery' && set.cards.every(c => (progress[c.id]?.box || 0) >= MASTERED_BOX)) {
    // Everything is already learned: knock it down a notch so this becomes a quick review lap.
    set.cards.forEach(c => (progress[c.id].box = MASTERED_BOX - 1));
  }
  const session = new Session(set, progress, opts);
  const lv = { value: 0, streak: 0, mult: 0 };
  const st = { gold: 0, shownGold: 0, streak: 0, bestStreak: 0, answered: 0, correct: 0, games: 0, elapsed: 0, meter: 0, phase: 'question', ready: false, over: false };
  const unit = () => UPGRADES.value.vals[lv.value] * UPGRADES.mult.vals[lv.mult];
  const perAnswer = () => unit() + UPGRADES.streak.vals[lv.streak] * Math.min(st.streak, 10) * UPGRADES.mult.vals[lv.mult];

  // ---------- HUD ----------
  const clock = h('span', { class: 'hud-clock-text' });
  const goldNum = h('span', { class: 'hud-gold-num' }, '0');
  const goldBox = h('div', { class: 'hud-gold' }, coin('lg'), goldNum);
  const streakNum = h('span', { class: 'hud-streak-num' }, '0');
  const streakBox = h('div', { class: 'hud-streak', title: 'Answer streak' }, icon('flame'), streakNum);
  const meterFill = h('div', { class: 'meter-fill' });
  const meterLabel = h('span', { class: 'meter-label' }, 'Game meter');
  const meter = h('div', { class: 'meter' }, h('div', { class: 'meter-track' }, meterFill), h('div', { class: 'meter-icon' }, icon('game')), meterLabel);
  const hud = h('div', { class: 'hud' },
    h('div', { class: 'hud-row' },
      h('button', { class: 'icon-btn', 'aria-label': 'End session', onclick: quit }, icon('x')),
      h('div', { class: 'hud-clock' }, icon(goal === 'mastery' ? 'target' : 'clock'), clock),
      h('div', { class: 'hud-spacer' }),
      streakBox,
      goldBox),
    meter);

  const stageEl = h('div', { class: 'q-stage' });
  const upgradesEl = h('div', { class: 'upgrades' });
  app.append(h('div', { class: 'play' }, hud, h('div', { class: 'play-body' }, stageEl, upgradesEl)));

  function renderUpgrades() {
    upgradesEl.replaceChildren(h('div', { class: 'upg-title' }, 'Upgrades'), ...Object.entries(UPGRADES).map(([k, u]) => {
      const level = lv[k];
      const maxed = level >= u.costs.length;
      const cost = u.costs[level];
      const can = !maxed && st.gold >= cost;
      return h('button', {
        class: `upg ${can ? 'can' : ''} ${maxed ? 'maxed' : ''}`, disabled: !can,
        onclick: e => {
          if (!can) return;
          st.gold -= cost;
          lv[k]++;
          sfx('coin');
          const [x, y] = centerOf(e.currentTarget);
          floatText(`Lv ${lv[k] + 1}!`, x, y - 20, 'good');
          renderUpgrades();
        },
      },
        h('span', { class: 'upg-name' }, u.name, h('em', {}, ` Lv${level + 1}`)),
        h('span', { class: 'upg-next' }, maxed ? 'Maxed out' : `Next: ${u.show(u.vals[level + 1])}`),
        maxed ? null : h('span', { class: 'upg-cost' }, coin(), fmt(cost)));
    }));
  }

  // ---------- main loop: clock, meter, gold ticker ----------
  let raf;
  let last = performance.now();
  const tick = now => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if ((st.phase === 'question' || st.phase === 'feedback') && !document.hidden) {
      st.elapsed += dt;
      st.meter = Math.min(1, st.meter + dt / opts.every);
      if (st.meter >= 1 && !st.ready) {
        st.ready = true;
        meter.classList.add('ready');
        meterLabel.textContent = 'Next right answer = GAME!';
        sfx('ready');
      }
    }
    meterFill.style.transform = `scaleX(${st.meter})`;
    if (goal === 'mastery') {
      const learned = set.cards.filter(c => session.box(c) >= MASTERED_BOX).length;
      clock.textContent = `${learned}/${set.cards.length} learned`;
    } else {
      const left = Math.max(0, goal - st.elapsed);
      clock.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      clock.parentElement.classList.toggle('low', left < 20);
    }
    if (st.shownGold !== st.gold) {
      const d = st.gold - st.shownGold;
      st.shownGold = Math.abs(d) < 1 ? st.gold : st.shownGold + d * 0.18;
      goldNum.textContent = fmt(st.shownGold);
      renderUpgradesThrottled();
    }
    raf = requestAnimationFrame(tick);
  };
  let upgT = 0;
  const renderUpgradesThrottled = () => { const n = performance.now(); if (n - upgT > 150) { upgT = n; renderUpgrades(); } };
  raf = requestAnimationFrame(tick);

  // ---------- question flow ----------
  let keyHandler = null;
  const onKey = e => keyHandler && keyHandler(e);
  addEventListener('keydown', onKey);

  function timeUp() {
    if (goal === 'mastery') return session.allMastered();
    return st.elapsed >= goal;
  }

  async function nextQuestion() {
    if (st.over) return;
    if (timeUp()) return finish();
    st.phase = 'question';
    const q = session.next();
    renderQuestion(q);
  }

  function renderQuestion(q) {
    const len = q.prompt.length;
    const tags = [];
    if (q.isNew) tags.push(h('span', { class: 'tag new' }, 'New'));
    if (q.reversed) tags.push(h('span', { class: 'tag' }, 'Reverse'));
    if (q.kind === 'type') tags.push(h('span', { class: 'tag type' }, 'Type it from memory'));
    const card = h('div', { class: 'q-card' },
      h('div', { class: 'q-top' }, h('div', { class: 'q-tags' }, tags), h('div', { class: 'q-set' }, set.title)),
      h('div', { class: `q-text ${len > 120 ? 'xs' : len > 70 ? 'sm' : len < 20 ? 'lg' : ''}` }, q.prompt));
    let answerArea;
    if (q.kind === 'mc') {
      const btns = q.choices.map((c, i) => h('button', {
        class: `ans a${i + 1} ${c.length > 60 ? 'long' : ''}`, type: 'button',
        onclick: e => submit(q, c, e.currentTarget, btns),
      }, h('span', { class: 'ans-key' }, i + 1), h('span', { class: 'ans-text' }, c)));
      answerArea = h('div', { class: `answers n${btns.length}` }, btns);
      keyHandler = e => { const n = +e.key; if (n >= 1 && n <= btns.length && !e.repeat) btns[n - 1].click(); };
    } else {
      const input = h('input', { class: 'input type-input', placeholder: 'Type your answer...', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const go_ = () => { if (input.value.trim()) submit(q, input.value, input, null); };
      answerArea = h('form', { class: 'type-area', onsubmit: e => { e.preventDefault(); go_(); } },
        input,
        h('div', { class: 'row gap' },
          h('button', { class: 'btn ghost-light', type: 'button', onclick: () => submit(q, '', input, null) }, 'I don\'t know'),
          h('button', { class: 'btn green grow', type: 'submit' }, 'Check')));
      keyHandler = null;
      setTimeout(() => input.focus(), 30);
    }
    stageEl.replaceChildren(h('div', { class: 'q-wrap enter' }, card, answerArea));
  }

  let busy = false;
  async function submit(q, response, el, btns) {
    if (busy || st.over) return;
    busy = true;
    keyHandler = null;
    st.phase = 'feedback';
    const res = session.grade(q, response);
    st.answered++;
    S.stats.answered++;
    if (res.correct) await onCorrect(q, res, el, btns);
    else await onWrong(q, response, el, btns);
    save();
    busy = false;
    if (res.correct && st.ready && !st.over) await runGame();
    nextQuestion();
  }

  async function onCorrect(q, res, el, btns) {
    st.correct++;
    S.stats.correct++;
    st.streak++;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    const earned = perAnswer();
    st.gold += earned;
    el.classList.add('right');
    btns && btns.forEach(b => b !== el && b.classList.add('dim'));
    const [x, y] = centerOf(el);
    floatText(`+${fmt(earned)}`, x, y - 20, 'good');
    goldBox.classList.remove('bump'); void goldBox.offsetWidth; goldBox.classList.add('bump');
    streakNum.textContent = st.streak;
    streakBox.classList.toggle('hot', st.streak >= 3);
    if ([3, 5, 10, 15, 20, 30].includes(st.streak)) {
      sfx('streak');
      floatText(`${st.streak} in a row!`, ...centerOf(streakBox), 'streak');
    } else sfx('correct');
    if (res.mastered) {
      const [cx, cy] = centerOf(stageEl.querySelector('.q-card'));
      confetti(cx, cy, 40, 0.7);
      stageEl.querySelector('.q-tags').append(h('span', { class: 'tag learned' }, icon('star'), 'Learned!'));
    }
    if (res.note) stageEl.querySelector('.q-card').append(h('div', { class: 'q-note' }, res.note));
    await sleep(res.note ? 1500 : res.mastered ? 1000 : 650);
  }

  function onWrong(q, response, el, btns) {
    st.streak = 0;
    streakNum.textContent = '0';
    streakBox.classList.remove('hot');
    sfx('wrong');
    if (btns) {
      el.classList.add('wrong');
      btns.forEach(b => { if (b.querySelector('.ans-text').textContent === q.answer) b.classList.add('right'); else if (b !== el) b.classList.add('dim'); });
    } else el.classList.add('wrong');

    return new Promise(async resolve => {
      // Let the red/green highlight land, then swap the answers for the explanation.
      await sleep(btns ? 700 : 350);
      const typed = q.kind === 'type';
      const retype = h('input', { class: 'input', placeholder: 'Type the answer to lock it in', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const cont = h('button', { class: 'btn big full ' + (typed ? 'ghost-light' : 'yellow'), type: 'button' }, typed ? 'Skip' : 'Got it');
      const done = () => { keyHandler = null; panel.classList.add('out'); setTimeout(resolve, 160); };
      cont.addEventListener('click', done);
      const panel = h('div', { class: 'feedback' },
        h('div', { class: 'fb-head' }, icon('x'), response ? 'Not quite' : 'Here\'s the answer'),
        typed && response ? h('div', { class: 'fb-you' }, 'You said: ', h('s', {}, response)) : null,
        h('div', { class: 'fb-answer' }, h('small', {}, q.reversed ? 'The term is' : 'Correct answer'), q.answer),
        q.card.explain ? h('div', { class: 'fb-explain' }, icon('bulb'), h('span', {}, q.card.explain)) : null,
        h('div', { class: 'fb-later' }, 'This one will come back in a couple of questions.'),
        typed ? h('form', { class: 'fb-retype', onsubmit: e => {
          e.preventDefault();
          if (checkTyped(retype.value, q.answer).correct) { sfx('correct'); done(); }
          else { retype.classList.remove('shake'); void retype.offsetWidth; retype.classList.add('shake'); }
        } }, retype) : null,
        cont);
      const area = stageEl.querySelector('.answers, .type-area');
      if (area) area.replaceWith(panel); else stageEl.append(panel);
      if (typed) setTimeout(() => retype.focus(), 50);
      else {
        setTimeout(() => cont.focus(), 50);
        keyHandler = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); } };
      }
    });
  }

  async function runGame() {
    st.phase = 'game';
    st.games++;
    S.stats.games++;
    const res = await playMinigame({ unit: unit(), sessionGold: st.gold, avatar: S.avatar });
    st.gold += res.gold;
    st.meter = 0;
    st.ready = false;
    meter.classList.remove('ready');
    meterLabel.textContent = 'Game meter';
    last = performance.now();
  }

  async function quit() {
    if (st.over) return;
    const prev = st.phase;
    st.phase = 'paused';
    if (await confirmBox('End this session?', st.answered ? 'You keep everything you earned and learned so far.' : 'You haven\'t answered anything yet.', 'End session')) finish();
    else if (st.phase === 'paused') st.phase = prev;
  }

  function finish() {
    if (st.over) return;
    st.over = true;
    cancelAnimationFrame(raf);
    const mastered = [...session.newlyMastered];
    const tokens = st.correct * 2 + st.games * 3 + mastered.length * 10 + (st.answered >= 10 ? 15 : 0);
    const xp = st.correct * 10 + st.games * 5 + mastered.length * 20;
    const levelBefore = levelInfo().level;
    S.tokens += tokens;
    S.xp += xp;
    S.stats.sessions++;
    const prevBest = S.best[set.id] || 0;
    const gold = Math.round(st.gold);
    if (gold > prevBest) S.best[set.id] = gold;
    const newDay = st.answered > 0 && touchDay();
    save();
    go('results', {
      setId: set.id, gold, prevBest, tokens, xp, levelBefore, newDay,
      answered: st.answered, correct: st.correct, bestStreak: st.bestStreak, games: st.games,
      mastered, missed: [...session.missed.entries()].sort((a, b) => b[1] - a[1]),
      opts,
    });
  }

  renderUpgrades();
  // A short "3-2-1" so the first question doesn't ambush you.
  (async () => {
    st.phase = 'intro';
    const n = h('div', { class: 'countdown-n' }, '3');
    stageEl.append(h('div', { class: 'countdown' }, h('div', { class: 'countdown-av', html: avatarSVG(S.avatar, { size: 110 }) }), n, h('div', { class: 'countdown-set' }, set.title)));
    for (const s of ['3', '2', '1']) { n.textContent = s; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); sfx('tick'); await sleep(600); }
    if (!st.over) nextQuestion();
  })();

  return () => {
    st.over = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
  };
}
