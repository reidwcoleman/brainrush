// Bulk text import + share links.

// Accepts one card per line. Supported shapes:
//   question | answer | wrong 1 | wrong 2 | wrong 3 | explanation
//   term<TAB>definition          (Quizlet / spreadsheet export)
//   term - definition   term: definition   term, definition
export function parseBulk(text) {
  const cards = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.includes('|')) {
      const [q, a, w1, w2, w3, explain] = line.split('|').map(s => s.trim());
      if (q && a) cards.push({ q, a, wrong: [w1, w2, w3].filter(Boolean), explain: explain || '' });
      continue;
    }
    const seps = ['\t', ' - ', ' – ', ' — ', ' = ', ': ', ', '];
    for (const sep of seps) {
      const i = line.indexOf(sep);
      if (i > 0) {
        const q = line.slice(0, i).trim();
        const a = line.slice(i + sep.length).trim();
        if (q && a) cards.push({ q, a, wrong: [], explain: '' });
        break;
      }
    }
  }
  return cards;
}

const b64url = bytes => btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

// Sets travel inside the URL hash, compressed, so sharing needs no server.
export async function encodeSet(set) {
  const slim = {
    t: set.title, d: set.desc, c: set.color,
    k: set.cards.map(c => {
      const row = [c.q, c.a];
      if (c.wrong.length || c.explain || c.img) row.push(c.wrong);
      if (c.explain || c.img) row.push(c.explain || '');
      if (c.img) row.push(c.img);
      return row;
    }),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(slim));
  if ('CompressionStream' in window) return 'z' + b64url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return 'j' + b64url(bytes);
}

export async function decodeSet(code) {
  let bytes = unb64url(code.slice(1));
  if (code[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  const slim = JSON.parse(new TextDecoder().decode(bytes));
  return {
    title: slim.t, desc: slim.d, color: slim.c,
    cards: (slim.k || []).map(([q, a, wrong = [], explain = '', img]) => ({ q, a, wrong, explain, ...(img ? { img } : {}) })),
  };
}

export async function shareLink(set) {
  const base = location.href.split('#')[0];
  return `${base}#set=${await encodeSet(set)}`;
}

// ---------- importing quiz files ----------
// Understands Brainrush exports plus the usual shapes other tools (and AI chatbots)
// produce: arrays of questions, { questions: [...] }, term/definition pairs,
// multiple-choice options with the answer as text, letter or index, and
// Kahoot-style choices with a `correct` flag. An optional `img` (image link or
// SVG code) on a question is kept and shown above it.

const pickKey = (o, keys) => {
  for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase().replace(/[\s_-]/g, ''))) return o[k];
  return undefined;
};
const Q_KEYS = ['q', 'question', 'questiontext', 'term', 'prompt', 'front', 'word', 'text', 'title', 'stem', 'ask', 'clue'];
const A_KEYS = ['a', 'answer', 'answers', 'definition', 'back', 'correct', 'correctanswer', 'correctanswers', 'right', 'rightanswer', 'solution', 'meaning', 'answertext', 'correctoption', 'correctchoice', 'key'];
const OPT_KEYS = ['c', 'options', 'choices', 'answers', 'alternatives', 'possibleanswers', 'answeroptions', 'opts', 'responses'];
const WRONG_KEYS = ['wrong', 'incorrect', 'incorrectanswers', 'wronganswers', 'distractors', 'falseanswers'];
const EXPLAIN_KEYS = ['explain', 'explanation', 'reason', 'why', 'rationale', 'hint', 'feedback', 'note', 'notes'];
const IMG_KEYS = ['img', 'image', 'svg', 'diagram', 'picture', 'pic', 'figure', 'imageurl', 'imagesrc', 'imgurl'];
const LIST_KEYS = ['cards', 'questions', 'items', 'quiz', 'terms', 'flashcards', 'data', 'entries', 'list', 'set', 'deck', 'problems'];
const TITLE_KEYS = ['title', 'name', 'quiztitle', 'setname', 'topic', 'subject'];

const str = v => (v == null ? '' : typeof v === 'object' ? String(v.text ?? v.answer ?? v.value ?? v.label ?? v.option ?? '') : String(v)).trim();

function optionText(o) {
  if (o && typeof o === 'object') return str(o);
  return str(o);
}

function toCard(raw) {
  if (Array.isArray(raw)) {
    const [q, a, ...rest] = raw.map(str);
    return q && a ? { q, a, wrong: rest.slice(0, 3), explain: '' } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  let q = str(pickKey(raw, Q_KEYS));
  let a = pickKey(raw, A_KEYS);
  let opts = pickKey(raw, OPT_KEYS);
  if (opts && !Array.isArray(opts) && typeof opts === 'object') opts = Object.entries(opts).map(([k, v]) => ({ key: k, text: str(v) }));
  if (!Array.isArray(opts) || (Array.isArray(a) && opts === a)) opts = null;
  let answer = '';
  const optList = opts ? opts.map(o => (o && typeof o === 'object' && 'key' in o ? o.text : optionText(o))) : [];

  if (opts) {
    // Kahoot-style: choices carry a correct flag.
    const flagged = opts.findIndex(o => o && typeof o === 'object' && (o.correct === true || o.isCorrect === true || o.is_correct === true || o.right === true));
    if (flagged >= 0) answer = optList[flagged];
  }
  if (!answer && a != null) {
    if (Array.isArray(a)) a = a[0];
    if (typeof a === 'number' && opts) answer = optList[a] ?? optList[a - 1] ?? '';
    else {
      const s = str(a);
      const letter = s.match(/^\(?([A-Ha-h])[).:]?$/);
      const keyed = opts && opts.find(o => o && typeof o === 'object' && 'key' in o && o.key.toLowerCase() === s.toLowerCase());
      if (keyed) answer = keyed.text;
      else if (letter && optList.length) answer = optList[letter[1].toLowerCase().charCodeAt(0) - 97] || s;
      else if (/^\d+$/.test(s) && optList.length && !optList.includes(s)) answer = optList[+s] ?? optList[+s - 1] ?? s;
      else answer = s;
    }
  }
  // Options sometimes come prefixed like "A) Paris"; strip that for display.
  const clean = t => t.replace(/^\(?[A-Ha-h][).:]\s+/, '').trim();
  answer = clean(answer);
  let wrong = optList.map(clean).filter(t => t && t.toLowerCase() !== answer.toLowerCase());
  const extra = pickKey(raw, WRONG_KEYS);
  if (Array.isArray(extra)) wrong = wrong.concat(extra.map(str));
  if (!q || !answer) return null;
  const card = { q, a: answer, wrong: [...new Set(wrong.filter(Boolean))].slice(0, 3), explain: str(pickKey(raw, EXPLAIN_KEYS)) };
  const img = pickKey(raw, IMG_KEYS);
  if (typeof img === 'string' && img.trim()) card.img = img.trim();
  return card;
}

function toSet(obj, fallbackTitle) {
  let list = Array.isArray(obj) ? obj : pickKey(obj, LIST_KEYS);
  // { "France": "Paris", ... } style dictionaries.
  if (!Array.isArray(list) && obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const vals = Object.entries(obj).filter(([, v]) => typeof v === 'string');
    if (vals.length >= 2 && vals.length === Object.keys(obj).length) list = vals.map(([q, a]) => ({ q, a }));
  }
  if (list && !Array.isArray(list) && typeof list === 'object') return toSet(list, fallbackTitle);
  // Last resort: the first property that holds a list of question objects.
  if (!Array.isArray(list) && obj && typeof obj === 'object') {
    list = Object.values(obj).find(v => Array.isArray(v) && v.length && v.every(x => x && typeof x === 'object'));
  }
  const cards = (list || []).map(toCard).filter(Boolean);
  const title = (!Array.isArray(obj) && str(pickKey(obj, TITLE_KEYS))) || fallbackTitle;
  return { title, desc: Array.isArray(obj) ? '' : str(obj.desc ?? obj.description ?? ''), color: obj.color, cards };
}

export function parseImport(text, fallbackTitle = 'Imported quiz') {
  const trimmed = text.replace(/^﻿/, '').trim();
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    // Not JSON: maybe it's a CSV / text list.
    const cards = parseBulk(trimmed.replace(/^[^\n]*\b(question|term)s?\b[^\n]*\n/i, '').replace(/^"|"$/gm, '').replace(/","/g, '\t'));
    return cards.length ? [{ title: fallbackTitle, cards }] : [];
  }
  // An array of sets vs. an array of questions.
  if (Array.isArray(data) && data.length && data.every(x => x && typeof x === 'object' && !Array.isArray(x) && Array.isArray(pickKey(x, LIST_KEYS)))) {
    return data.map((s, i) => toSet(s, `${fallbackTitle} ${i + 1}`)).filter(s => s.cards.length);
  }
  const set = toSet(data, fallbackTitle);
  return set.cards.length ? [set] : [];
}
