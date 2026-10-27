// The learning engine: spaced repetition inside a session plus answer checking.
//
// Every card sits in a Leitner "box" 0..5. Getting it right moves it up a box and
// pushes it further into the future; missing it drops it two boxes and brings it
// back after a couple of other questions, so mistakes get fixed while they're fresh.
// New cards are fed in a few at a time instead of all at once.
import { MASTERED_BOX } from './store.js';
import { shuffle, pick } from './ui.js';

const GAP = [2, 3, 5, 8, 13, 21];     // turns until a card comes back, by box
const WORKING_SET = 4;                // how many shaky cards we juggle before adding new ones
const MAX_TYPED_LEN = 40;             // longer answers stay multiple choice

export class Session {
  constructor(set, progress, opts) {
    this.set = set;
    this.progress = progress;
    this.opts = opts;               // { mode: 'mc'|'mixed'|'type', both: bool }
    this.turn = 0;
    this.lastId = null;
    this.state = new Map();         // cardId -> { due, introduced, seenRight }
    this.missed = new Map();        // cardId -> times missed this session
    this.newlyMastered = new Set();
    const order = shuffle(set.cards);
    order.forEach((c, i) => {
      const p = progress[c.id];
      const known = p && (p.right || p.wrong);
      this.state.set(c.id, {
        introduced: !!known,
        due: known ? (p.box || 0) * 2 + Math.floor(Math.random() * 3) : Infinity,
        order: i,
        seenRight: !!(p && p.right),
      });
    });
  }

  box(card) { return this.progress[card.id]?.box || 0; }

  allMastered() { return this.set.cards.every(c => this.box(c) >= MASTERED_BOX); }

  pickCard() {
    const cards = this.set.cards;
    const st = id => this.state.get(id);
    const pool = cards.length > 1 ? cards.filter(c => c.id !== this.lastId) : cards;
    const introduced = pool.filter(c => st(c.id).introduced);
    const fresh = cards.filter(c => !st(c.id).introduced).sort((a, b) => st(a.id).order - st(b.id).order);
    const shaky = cards.filter(c => st(c.id).introduced && this.box(c) < 2).length;

    if (fresh.length && (shaky < WORKING_SET || !introduced.length)) {
      const c = fresh[0];
      st(c.id).introduced = true;
      return c;
    }
    const due = introduced.filter(c => st(c.id).due <= this.turn);
    const list = due.length ? due : (fresh.length ? [] : introduced);
    if (!list.length) {
      const c = fresh[0];
      st(c.id).introduced = true;
      return c;
    }
    const min = Math.min(...list.map(c => st(c.id).due));
    return pick(list.filter(c => st(c.id).due === min));
  }

  next() {
    const card = this.pickCard();
    this.lastId = card.id;
    this.turn++;
    const box = this.box(card);
    const st = this.state.get(card.id);

    const canReverse = this.opts.both && !card.img && !/\?\s*$/.test(card.q) && card.q.length <= 80;
    const reversed = canReverse && box >= 1 && Math.random() < 0.4;
    const prompt = reversed ? card.a : card.q;
    const answer = reversed ? card.q : card.a;

    let kind = 'mc';
    const typeable = answer.length <= MAX_TYPED_LEN;
    if (typeable && this.opts.mode === 'type' && st.seenRight) kind = 'type';
    if (typeable && this.opts.mode === 'mixed' && box >= 2 && Math.random() < 0.6) kind = 'type';

    let choices = null;
    if (kind === 'mc') {
      choices = this.choicesFor(card, reversed);
      if (choices.length < 2) kind = 'type';
    }
    return { card, prompt, answer, reversed, kind, choices, isNew: !st.seenRight && !this.progress[card.id] };
  }

  choicesFor(card, reversed) {
    const answer = reversed ? card.q : card.a;
    const norm = s => s.trim().toLowerCase();
    const picked = [];
    const seen = new Set([norm(answer)]);
    const add = s => { if (s && !seen.has(norm(s))) { seen.add(norm(s)); picked.push(s); } };
    if (!reversed) shuffle(card.wrong).forEach(add);
    if (picked.length < 3) {
      // Borrow other cards' answers, preferring ones that look like this answer.
      const others = this.set.cards.filter(c => c.id !== card.id).map(c => (reversed ? c.q : c.a));
      const isNum = /^-?[\d.,\s%$]+$/.test(answer);
      const scored = shuffle(others).map(o => ({
        o,
        s: Math.abs(o.length - answer.length) / Math.max(answer.length, 1) + (isNum === /^-?[\d.,\s%$]+$/.test(o) ? 0 : 2),
      })).sort((a, b) => a.s - b.s);
      for (const { o } of scored.slice(0, 6).sort(() => Math.random() - 0.5)) { if (picked.length >= 3) break; add(o); }
      for (const { o } of scored) { if (picked.length >= 3) break; add(o); }
    }
    return shuffle([answer, ...picked.slice(0, 3)]);
  }

  // Records the result and returns what the UI needs to react.
  grade(q, response) {
    const res = q.kind === 'type' ? checkTyped(response, q.answer) : { correct: response === q.answer, typo: false };
    const p = (this.progress[q.card.id] ||= { box: 0, right: 0, wrong: 0 });
    const st = this.state.get(q.card.id);
    const before = p.box;
    if (res.correct) {
      p.right++;
      // A first-try success on a new card skips ahead: you clearly already knew it.
      p.box = Math.min(5, p.box + (q.isNew ? 2 : 1));
      st.seenRight = true;
      st.due = this.turn + GAP[p.box] + Math.floor(Math.random() * 2);
    } else {
      p.wrong++;
      p.box = Math.max(0, p.box - 2);
      st.due = this.turn + 2;
      this.missed.set(q.card.id, (this.missed.get(q.card.id) || 0) + 1);
    }
    if (before < MASTERED_BOX && p.box >= MASTERED_BOX) this.newlyMastered.add(q.card.id);
    if (p.box < MASTERED_BOX) this.newlyMastered.delete(q.card.id);
    return { ...res, box: p.box, mastered: p.box >= MASTERED_BOX && before < MASTERED_BOX };
  }
}

// ---------- typed answer checking ----------

function normalize(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s.%-]/gu, ' ')
    .replace(/^(the|a|an|to|el|la|los|las|le|les|un|una)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function checkTyped(input, answer) {
  const raw = input.trim();
  if (!raw) return { correct: false, typo: false };
  const alts = answer.split(/\s+\/\s+|\s*;\s*|\s+or\s+/i).concat(answer, answer.replace(/\s*\(.*?\)\s*/g, ' ')).map(s => s.trim()).filter(Boolean);
  const got = normalize(raw);
  for (const alt of alts) {
    const want = normalize(alt);
    if (!want) continue;
    const num = s => Number(s.replace(/[,\s$%]/g, ''));
    if (/^-?[\d.,\s$%]+$/.test(alt) && !isNaN(num(alt))) {
      if (num(got) === num(alt)) return { correct: true, typo: false };
      continue;
    }
    if (got === want) {
      // Matched once accents/case were ignored. Nudge if the accents were off.
      const accentsOff = raw.toLowerCase().trim() !== alt.toLowerCase().trim() && /[^\x00-\x7f]/.test(alt);
      return { correct: true, typo: accentsOff, note: accentsOff ? `Watch the accents: ${alt}` : '' };
    }
    const tol = want.length <= 3 ? 0 : want.length <= 7 ? 1 : 2;
    if (lev(got, want) <= tol) return { correct: true, typo: true, note: `Close! It's spelled: ${alt}` };
  }
  return { correct: false, typo: false };
}
