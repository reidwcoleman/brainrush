// Quick Draw: a reaction-time gauntlet. Green lights, pop-up targets, fake-outs, triple targets.
import { makeCanvas, loop, Keys, Particles, Floaters, Shake, rand, clamp, dist } from './kit.js';

const RATING = ms => (ms < 230 ? ['LIGHTNING!', '#ffd34e', 1.6] : ms < 300 ? ['SUPER FAST!', '#2ed3b7', 1.25] : ms < 400 ? ['FAST', '#4dc3ff', 0.9] : ms < 550 ? ['NICE', '#ffffff', 0.6] : ['SLOW', '#c8b8ff', 0.3]);
const BG = { wait: '#c92a42', fake: '#2f62d6', go: '#1fbf5b', dark: '#1b1240', early: '#5e5487' };

export default {
  id: 'quickdraw',
  name: 'Quick Draw',
  tagline: 'How fast are your reflexes?',
  goal: 'Wait for GREEN, then tap as fast as you can. Some rounds pop up targets to hit instead. Blue means DON\'T tap. Fast streaks multiply your points!',
  controls: { desktop: 'Click (or Space on green lights)', touch: 'Tap' },
  color: 'orange',
  scoreLabel: 'pts',
  art: `<svg viewBox="0 0 120 90"><rect width="120" height="90" rx="10" fill="#1fbf5b"/><text x="60" y="42" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="26" fill="#fff">TAP!</text><text x="60" y="66" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="16" fill="#ffd34e">212 ms</text><circle cx="98" cy="20" r="10" fill="none" stroke="#fff" stroke-width="3"/><circle cx="98" cy="20" r="4" fill="#ff4d6d"/></svg>`,

  async run(stage, api) {
    const { cv, g, w, h: H, local } = makeCanvas(stage);
    const keys = new Keys();
    const parts = new Particles(), floats = new Floaters(), shake = new Shake();
    const sc = clamp(Math.min(w, H) / 600, 0.65, 1.3);

    let round = 0, type = 'light', phase = 'wait', phaseT = 0, waitFor = 1.5, fakeAt = -1, fakeDone = false;
    let goAt = 0, targets = [], hitTimes = [], resultText = '', resultColor = '#fff', resultSub = '';
    let points = 0, streak = 0, bg = BG.wait, bgFlash = 0;
    const history = [];
    const ripples = [];
    let now = 0;
    let over = false;

    const newTarget = () => {
      const m = 70 * sc;
      return { x: rand(m, w - m), y: rand(m + 40, H - m - 60), r: 48 * sc, born: now, life: 1.5 - Math.min(0.5, round * 0.02) };
    };

    const startRound = () => {
      round++;
      const r = Math.random();
      type = round <= 2 ? 'light' : r < 0.32 ? 'light' : r < 0.58 ? 'target' : r < 0.8 ? 'fake' : 'triple';
      phase = 'wait';
      phaseT = 0;
      waitFor = rand(0.8, 2.2) * (1 - Math.min(0.35, round * 0.015));
      fakeAt = type === 'fake' ? waitFor * rand(0.25, 0.55) : -1;
      if (type === 'fake') waitFor += 0.6;
      fakeDone = false;
      targets = [];
      hitTimes = [];
      bg = type === 'target' || type === 'triple' ? BG.dark : BG.wait;
    };

    const finishRound = (ms, label) => {
      phase = 'result';
      phaseT = 0;
      if (ms == null) {
        streak = 0;
        resultText = label;
        resultColor = '#ffb3c1';
        resultSub = '';
        api.sfx('wrong');
        return;
      }
      const [rate, color, units] = RATING(ms);
      streak = ms < 350 ? streak + 1 : 0;
      const mult = 1 + Math.min(streak - 1, 4) * 0.25 * (streak > 1 ? 1 : 0);
      const pts = Math.round(Math.max(50, 1000 - ms) * mult);
      points += pts;
      api.add(units * mult);
      history.push(ms);
      resultText = `${ms} ms`;
      resultColor = color;
      resultSub = rate + (mult > 1 ? `  x${+mult.toFixed(2)} STREAK` : '');
      floats.add(`+${pts}`, w / 2, H * 0.62, { color, size: 30 });
      api.sfx(ms < 300 ? 'perfect' : 'coin');
      if (ms < 230) { shake.add(5, 0.15); parts.burst(w / 2, H * 0.42, { n: 40, colors: ['#ffd34e', '#fff', '#2ed3b7'], speed: 420, life: 0.7, size: 8 }); }
      const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
      api.setInfo(`Avg ${avg} ms`);
    };

    const tooSoon = () => {
      api.add(-0.4);
      bg = BG.early;
      shake.add(8, 0.25);
      finishRound(null, 'TOO SOON!');
    };

    const onTap = (x, y, isKey) => {
      if (over) return;
      ripples.push({ x, y, r: 0, life: 0.4 });
      if (phase === 'wait') {
        if (fakeAt >= 0 && phaseT >= fakeAt && phaseT < fakeAt + 0.6) { api.add(-0.6); bg = BG.early; shake.add(10, 0.3); finishRound(null, 'IT WAS BLUE!'); return; }
        tooSoon();
        return;
      }
      if (phase !== 'go') return;
      if (type === 'light' || type === 'fake') { finishRound(Math.round(performance.now() - goAt)); return; }
      if (isKey) return;
      const t = targets.find(tg => !tg.hit && dist(x, y, tg.x, tg.y) < tg.r * 1.15);
      if (!t) { ripples[ripples.length - 1].miss = true; return; }
      t.hit = true;
      parts.burst(t.x, t.y, { n: 18, colors: ['#ff4d6d', '#fff', '#ffd34e'], speed: 300, life: 0.5, size: 7 });
      hitTimes.push(performance.now() - (t.shownAt ?? goAt));
      api.sfx('pop');
      if (type === 'target' || hitTimes.length >= 3) {
        const ms = Math.round(hitTimes.reduce((a, b) => a + b, 0) / hitTimes.length);
        finishRound(ms);
      } else {
        const nt = newTarget();
        nt.shownAt = now;
        targets.push(nt);
      }
    };
    cv.addEventListener('pointerdown', e => { const [x, y] = local(e); onTap(x, y, false); });

    const timer = api.timer(40);
    let endRes;
    const ended = new Promise(r => (endRes = r));
    timer.done.then(() => { over = true; endRes(); });
    startRound();

    const step = (dt, t) => {
      now = t;
      phaseT += dt;
      if (keys.hit('Space', 'Enter')) onTap(w / 2, H / 2, true);
      if (phase === 'wait') {
        if (type === 'fake' && !fakeDone && phaseT >= fakeAt) { bg = BG.fake; api.sfx('tick'); fakeDone = true; }
        if (type === 'fake' && fakeDone && phaseT >= fakeAt + 0.6 && bg === BG.fake) bg = BG.wait;
        if (phaseT >= waitFor) {
          phase = 'go';
          phaseT = 0;
          goAt = t;
          bgFlash = 1;
          if (type === 'light' || type === 'fake') { bg = BG.go; api.sfx('ready'); }
          else { const nt = newTarget(); nt.shownAt = t; targets.push(nt); api.sfx('tick'); }
        }
      } else if (phase === 'go') {
        const limit = type === 'triple' ? 4 : 1.6;
        if (phaseT > limit) finishRound(null, 'TOO SLOW!');
        for (const tg of targets) if (!tg.hit && (t - tg.shownAt) / 1000 > tg.life && phase === 'go') finishRound(null, 'TOO SLOW!');
      } else if (phase === 'result' && phaseT > 0.95) startRound();
      bgFlash = Math.max(0, bgFlash - dt * 4);
      for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.life -= dt; r.r += 300 * dt; if (r.life <= 0) ripples.splice(i, 1); }
      parts.update(dt); floats.update(dt); shake.update(dt);
      keys.endFrame();
      draw();
    };

    const text = (s, x, y, size, color = '#fff') => {
      g.font = `700 ${size}px Fredoka, Nunito, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = Math.max(4, size / 8); g.strokeStyle = 'rgba(20,8,50,.35)';
      g.strokeText(s, x, y);
      g.fillStyle = color; g.fillText(s, x, y);
    };

    function draw() {
      g.save();
      shake.apply(g);
      g.fillStyle = bg; g.fillRect(-20, -20, w + 40, H + 40);
      if (bgFlash > 0) { g.fillStyle = `rgba(255,255,255,${bgFlash * 0.5})`; g.fillRect(-20, -20, w + 40, H + 40); }
      const cy = H * 0.42;
      if (phase === 'wait') {
        if (bg === BG.fake) { text('DON\'T TAP!', w / 2, cy, 64 * sc); text('that\'s blue...', w / 2, cy + 56 * sc, 22 * sc, 'rgba(255,255,255,.85)'); }
        else if (type === 'target' || type === 'triple') {
          text(type === 'triple' ? 'Triple target!' : 'Target round', w / 2, cy - 20 * sc, 46 * sc);
          text(type === 'triple' ? 'Hit 3 targets as fast as you can' : 'Tap the target the instant it appears', w / 2, cy + 30 * sc, 20 * sc, 'rgba(255,255,255,.8)');
        } else {
          const dots = '.'.repeat(1 + (Math.floor(phaseT * 3) % 3));
          text('Wait for green' + dots, w / 2, cy, 50 * sc);
          if (type === 'fake') text('watch out for fakes', w / 2, cy + 50 * sc, 20 * sc, 'rgba(255,255,255,.75)');
        }
      } else if (phase === 'go') {
        if (type === 'light' || type === 'fake') text('TAP!', w / 2, cy, 120 * sc);
        for (const tg of targets) {
          if (tg.hit) continue;
          const age = (now - tg.shownAt) / 1000;
          const k = clamp(1 - age / tg.life, 0, 1);
          const pop = Math.min(1, age * 8);
          const r = tg.r * (0.55 + 0.45 * k) * pop;
          g.fillStyle = '#fff'; g.beginPath(); g.arc(tg.x, tg.y, r, 0, 7); g.fill();
          g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(tg.x, tg.y, r * 0.72, 0, 7); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(tg.x, tg.y, r * 0.44, 0, 7); g.fill();
          g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(tg.x, tg.y, r * 0.18, 0, 7); g.fill();
        }
        if (type === 'triple') text(`${hitTimes.length}/3`, w / 2, 40 * sc, 28 * sc);
      } else {
        text(resultText, w / 2, cy, 84 * sc, resultColor);
        if (resultSub) text(resultSub, w / 2, cy + 64 * sc, 26 * sc, resultColor);
      }
      for (const r of ripples) { g.strokeStyle = r.miss ? `rgba(255,120,140,${r.life / 0.4})` : `rgba(255,255,255,${r.life / 0.4})`; g.lineWidth = 4; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke(); }
      parts.draw(g);
      floats.draw(g);
      g.restore();

      // reaction history bars
      const recent = history.slice(-14);
      const bw = Math.min(26, (w - 40) / 14), base = H - 16, maxH = 70 * sc;
      recent.forEach((ms, i) => {
        const hgt = clamp((700 - ms) / 600, 0.08, 1) * maxH;
        g.fillStyle = RATING(ms)[1];
        g.globalAlpha = 0.85;
        g.beginPath(); g.roundRect(20 + i * (bw + 4), base - hgt, bw, hgt, 4); g.fill();
      });
      g.globalAlpha = 1;
      g.font = '700 18px Fredoka, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.fillText(`${points.toLocaleString()} pts`, 16, 22);
      if (streak >= 2) { g.textAlign = 'right'; g.fillStyle = '#ffd34e'; g.fillText(`STREAK ${streak}`, w - 16, 22); }
    }

    const stop = loop(step);
    api.onCleanup(() => { stop(); keys.dispose(); });
    await ended;
    await new Promise(r => setTimeout(r, 400));
    stop();
    const best = history.length ? Math.min(...history) : null;
    return { score: points, title: best ? `Fastest: ${best} ms` : 'Time\'s up!' };
  },
};
