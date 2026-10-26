// Everything persists to localStorage under one key.
import { SAMPLE_SETS } from './data.js';
import { uid } from './ui.js';

const KEY = 'brainrush.v1';
const COLORS = ['purple', 'blue', 'green', 'orange', 'red', 'pink', 'teal'];

function fresh() {
  return {
    sets: SAMPLE_SETS.map(s => normalizeSet(s)),
    progress: {},       // setId -> cardId -> { box, right, wrong }
    best: {},           // setId -> best session gold
    tokens: 120,
    xp: 0,
    owned: ['sunny'],
    avatar: 'sunny',
    sound: true,
    lastOpts: null,
    day: { last: '', streak: 0 },
    stats: { answered: 0, correct: 0, games: 0, sessions: 0 },
  };
}

export function normalizeSet(s) {
  return {
    id: s.id || uid(),
    title: String(s.title || 'Untitled set').slice(0, 80),
    desc: String(s.desc || '').slice(0, 200),
    color: COLORS.includes(s.color) ? s.color : COLORS[Math.floor(Math.random() * COLORS.length)],
    created: s.created || Date.now(),
    cards: (s.cards || [])
      .filter(c => c && String(c.q || '').trim() && String(c.a || '').trim())
      .map(c => ({
        id: c.id || uid(),
        q: String(c.q).trim(),
        a: String(c.a).trim(),
        wrong: (c.wrong || []).map(w => String(w).trim()).filter(Boolean).slice(0, 3),
        explain: String(c.explain || '').trim(),
      })),
  };
}

let state;
try {
  state = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {});
} catch {
  state = fresh();
}

export const S = state;
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: play without saving */ }
}

export const getSet = id => state.sets.find(s => s.id === id);
export function upsertSet(set) {
  const i = state.sets.findIndex(s => s.id === set.id);
  if (i >= 0) state.sets[i] = set; else state.sets.unshift(set);
  save();
}
export function deleteSet(id) {
  state.sets = state.sets.filter(s => s.id !== id);
  delete state.progress[id];
  delete state.best[id];
  save();
}

export function cardProgress(setId) {
  return (state.progress[setId] ||= {});
}

export const MASTERED_BOX = 4;
export function mastery(set) {
  const p = state.progress[set.id] || {};
  if (!set.cards.length) return { pct: 0, mastered: 0 };
  let sum = 0, mastered = 0;
  for (const c of set.cards) {
    const box = p[c.id]?.box || 0;
    sum += Math.min(box, MASTERED_BOX);
    if (box >= MASTERED_BOX) mastered++;
  }
  return { pct: Math.round((sum / (set.cards.length * MASTERED_BOX)) * 100), mastered };
}

// Levels: each one needs a little more XP than the last.
export function levelInfo(xp = state.xp) {
  let level = 1, need = 120;
  while (xp >= need) { xp -= need; level++; need = 120 + (level - 1) * 60; }
  return { level, into: xp, need };
}

export function touchDay() {
  const today = new Date().toDateString();
  if (state.day.last === today) return false;
  const y = new Date(Date.now() - 864e5).toDateString();
  state.day.streak = state.day.last === y ? state.day.streak + 1 : 1;
  state.day.last = today;
  return true;
}

// A streak only counts as alive if you played today or yesterday.
export function dayStreak() {
  const today = new Date().toDateString();
  const y = new Date(Date.now() - 864e5).toDateString();
  return state.day.last === today || state.day.last === y ? state.day.streak : 0;
}
