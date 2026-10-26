// Every sound is synthesized with WebAudio, so there are no audio files to load.
import { S, save } from './store.js';

let ctx;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { at = 0, dur = 0.12, type = 'sine', vol = 0.18, slide = 0 } = {}) {
  const a = ac();
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ at = 0, dur = 0.15, vol = 0.2, hp = 800 } = {}) {
  const a = ac();
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  tap: () => tone(520, { dur: 0.05, type: 'triangle', vol: 0.12 }),
  correct: () => { tone(660, { dur: 0.1, type: 'triangle' }); tone(990, { at: 0.08, dur: 0.16, type: 'triangle' }); },
  streak: () => [660, 830, 990, 1320].forEach((f, i) => tone(f, { at: i * 0.05, dur: 0.12, type: 'square', vol: 0.07 })),
  wrong: () => { tone(220, { dur: 0.22, type: 'sawtooth', vol: 0.09, slide: -80 }); tone(160, { at: 0.12, dur: 0.25, type: 'sawtooth', vol: 0.08, slide: -60 }); },
  coin: () => { tone(1320, { dur: 0.06, type: 'square', vol: 0.06 }); tone(1760, { at: 0.05, dur: 0.12, type: 'square', vol: 0.06 }); },
  pop: () => { tone(900, { dur: 0.07, slide: -600, vol: 0.2 }); noise({ dur: 0.06, vol: 0.12, hp: 2000 }); },
  bonk: () => { tone(300, { dur: 0.1, type: 'square', vol: 0.12, slide: -150 }); noise({ dur: 0.05, vol: 0.1 }); },
  bad: () => { tone(140, { dur: 0.3, type: 'sawtooth', vol: 0.12, slide: -60 }); noise({ dur: 0.2, vol: 0.15, hp: 300 }); },
  place: () => tone(440, { dur: 0.08, type: 'triangle', vol: 0.15, slide: 120 }),
  perfect: () => { tone(880, { dur: 0.08, type: 'triangle' }); tone(1320, { at: 0.06, dur: 0.18, type: 'triangle' }); },
  tick: () => tone(1200, { dur: 0.03, type: 'square', vol: 0.05 }),
  ready: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.14, type: 'triangle', vol: 0.12 })),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.22, type: 'square', vol: 0.07 })),
  whoosh: () => noise({ dur: 0.3, vol: 0.1, hp: 1200 }),
  open: () => { noise({ dur: 0.4, vol: 0.18, hp: 500 }); [784, 988, 1175, 1568].forEach((f, i) => tone(f, { at: 0.15 + i * 0.07, dur: 0.25, type: 'triangle', vol: 0.12 })); },
  shake: () => tone(180 + Math.random() * 60, { dur: 0.06, type: 'square', vol: 0.06 }),
};

export function sfx(name) {
  if (!S.sound) return;
  try { SOUNDS[name]?.(); } catch { /* audio blocked until first gesture */ }
}

export function toggleSound() {
  S.sound = !S.sound;
  save();
  return S.sound;
}
