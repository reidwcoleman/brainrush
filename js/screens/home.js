import { h, icon, toast, modal, confirmBox, segmented, fmt } from '../ui.js';
import { S, save, mastery, deleteSet, upsertSet, normalizeSet } from '../store.js';
import { shareLink, decodeSet, parseImport } from '../parse.js';
import { go } from '../router.js';
import { sfx } from '../sound.js';
import { topbar } from './topbar.js';

export default function home(app) {
  const sets = S.sets;
  app.append(
    topbar(),
    h('main', { class: 'wrap' },
      h('section', { class: 'hero' },
        h('div', { class: 'hero-copy' },
          h('h1', {}, 'Study like it\'s a ', h('span', { class: 'hl' }, 'game'), '.'),
          h('p', {}, 'Make or paste any quiz. Every 10 right answers unlocks a game: Slice Frenzy, Quick Draw or Snake Arena. Get one wrong and it keeps coming back until you actually know it.')),
        h('div', { class: 'hero-actions' },
          h('button', { class: 'btn big yellow', onclick: () => go('editor') }, icon('plus'), 'Create a quiz'),
          h('button', { class: 'btn big ghost-light', onclick: openImport }, icon('upload'), 'Import'))),
      h('div', { class: 'section-head' },
        h('h2', {}, 'Your quizzes'),
        h('span', { class: 'muted' }, `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`)),
      sets.length
        ? h('div', { class: 'set-grid' }, sets.map(setCard))
        : h('div', { class: 'empty' }, h('p', {}, 'No quizzes yet.'), h('button', { class: 'btn yellow', onclick: () => go('editor') }, 'Make your first one')),
      howItWorks()));
}

function setCard(set) {
  const m = mastery(set);
  const best = S.best[set.id];
  const more = h('button', { class: 'icon-btn sm', 'aria-label': 'More options', onclick: e => { e.stopPropagation(); openMore(set); } }, icon('dots'));
  return h('article', { class: `set-card c-${set.color}` },
    h('div', { class: 'set-top' },
      h('div', { class: 'set-count' }, `${set.cards.length} Qs`),
      more),
    h('h3', { class: 'set-title' }, set.title),
    set.desc ? h('p', { class: 'set-desc' }, set.desc) : null,
    h('div', { class: 'set-mastery' },
      h('div', { class: 'bar' }, h('i', { style: { width: m.pct + '%' } })),
      h('div', { class: 'set-mastery-row' },
        h('span', {}, `${m.pct}% learned`),
        h('span', {}, best ? [icon('trophy'), ' ', fmt(best)] : 'Not played yet'))),
    h('div', { class: 'set-actions' },
      h('button', { class: 'btn green grow', onclick: () => openPlaySetup(set), disabled: !set.cards.length }, icon('play'), 'Play'),
      h('button', { class: 'icon-btn', 'aria-label': 'Edit', title: 'Edit', onclick: () => go('editor', { id: set.id }) }, icon('edit')),
      h('button', { class: 'icon-btn', 'aria-label': 'Share', title: 'Share link', onclick: () => share(set) }, icon('share'))));
}

async function share(set) {
  const url = await shareLink(set);
  const input = h('input', { class: 'input', value: url, readonly: true, onfocus: e => e.target.select() });
  const m = modal(h('div', {},
    h('h2', { class: 'modal-title' }, 'Share this quiz'),
    h('p', { class: 'muted' }, 'Anyone who opens this link gets a copy of the quiz. Nothing is uploaded: the whole quiz is packed into the link.'),
    input,
    h('div', { class: 'row end gap' },
      h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Close'),
      h('button', { class: 'btn blue', onclick: async () => {
        try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { input.select(); toast('Press Ctrl/Cmd+C to copy'); }
      } }, icon('link'), 'Copy link'))));
}

function openMore(set) {
  const m = modal(h('div', { class: 'menu' },
    h('h2', { class: 'modal-title' }, set.title),
    h('button', { class: 'menu-item', onclick: () => { m.close(); go('editor', { id: set.id }); } }, icon('edit'), 'Edit questions'),
    h('button', { class: 'menu-item', onclick: () => { m.close(); share(set); } }, icon('share'), 'Share link'),
    h('button', { class: 'menu-item', onclick: () => { m.close(); exportSet(set); } }, icon('download'), 'Download as file'),
    h('button', { class: 'menu-item', onclick: () => {
      m.close();
      const copy = normalizeSet({ ...JSON.parse(JSON.stringify(set)), id: null, title: set.title + ' (copy)' });
      copy.cards.forEach(c => (c.id = null));
      upsertSet(normalizeSet(copy));
      go('home');
    } }, icon('plus'), 'Duplicate'),
    h('button', { class: 'menu-item', onclick: async () => {
      m.close();
      if (await confirmBox('Reset progress?', `Your learned progress on "${set.title}" goes back to zero.`, 'Reset')) {
        delete S.progress[set.id]; delete S.best[set.id]; save(); go('home');
      }
    } }, icon('clock'), 'Reset progress'),
    h('button', { class: 'menu-item danger', onclick: async () => {
      m.close();
      if (await confirmBox('Delete this quiz?', `"${set.title}" and its progress will be gone for good.`)) { deleteSet(set.id); go('home'); }
    } }, icon('trash'), 'Delete')));
}

function exportSet(set) {
  const data = JSON.stringify({ brainrush: 1, title: set.title, desc: set.desc, color: set.color, cards: set.cards.map(({ q, a, wrong, explain }) => ({ q, a, wrong, explain })) }, null, 2);
  const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: set.title.replace(/[^\w\- ]+/g, '').trim() + '.brainrush.json' });
  document.body.append(a);
  a.click();
  a.remove();
}

function openImport() {
  const linkInput = h('input', { class: 'input', placeholder: 'Paste a Brainrush share link' });
  const file = h('input', { type: 'file', accept: '.json,.txt,.csv,.tsv,application/json,text/plain,text/csv', multiple: true, class: 'hidden' });
  const pasted = h('textarea', { class: 'input mono', rows: 5, placeholder: 'Or paste quiz JSON (or a CSV / term list) here' });
  const m = modal(h('div', {},
    h('h2', { class: 'modal-title' }, 'Import a quiz'),
    h('p', { class: 'muted' }, 'Bring in a share link, a quiz file (.json, .csv or .txt), or paste JSON from anywhere, including quizzes made by ChatGPT, Kahoot-style files and term lists.'),
    h('label', { class: 'label' }, 'Share link'),
    h('div', { class: 'row gap' }, linkInput, h('button', { class: 'btn blue', onclick: async () => {
      const i = linkInput.value.indexOf('#set=');
      if (i < 0) return toast('That doesn\'t look like a Brainrush link', 'bad');
      m.close();
      await importCode(linkInput.value.slice(i + 5));
    } }, 'Import')),
    h('label', { class: 'label' }, 'Quiz file'),
    h('button', { class: 'btn ghost', onclick: () => file.click() }, icon('upload'), 'Choose file'),
    file,
    h('label', { class: 'label' }, 'Paste'),
    pasted,
    h('div', { class: 'row end' }, h('button', { class: 'btn green', onclick: () => {
      if (addImported(parseImport(pasted.value, 'Imported quiz'))) m.close();
    } }, icon('plus'), 'Import pasted text'))));
  file.addEventListener('change', async () => {
    const sets = [];
    for (const f of file.files) {
      try { sets.push(...parseImport(await f.text(), f.name.replace(/\.(brainrush\.)?(json|txt|csv|tsv)$/i, '') || 'Imported quiz')); }
      catch { /* skip unreadable files */ }
    }
    file.value = '';
    if (addImported(sets)) m.close();
  });
}

// Saves parsed sets and reports what happened. Returns true if anything was added.
function addImported(sets) {
  if (!sets.length) {
    toast('Couldn\'t find any questions in that. It needs a question and an answer for each item.', 'bad');
    return false;
  }
  sets.forEach(s => upsertSet(normalizeSet({ ...s, id: null })));
  const n = sets.reduce((t, s) => t + s.cards.length, 0);
  toast(sets.length === 1 ? `Imported "${sets[0].title}" (${n} questions)` : `Imported ${sets.length} quizzes (${n} questions)`);
  go('home');
  return true;
}

async function importCode(code) {
  try {
    const raw = await decodeSet(code);
    const set = normalizeSet(raw);
    if (!set.cards.length) throw new Error('empty');
    const m = modal(h('div', {},
      h('h2', { class: 'modal-title' }, 'Someone shared a quiz!'),
      h('div', { class: `import-preview c-${set.color}` },
        h('h3', {}, set.title),
        h('p', {}, `${set.cards.length} questions`),
        h('ul', {}, set.cards.slice(0, 4).map(c => h('li', {}, c.q)), set.cards.length > 4 ? h('li', { class: 'muted' }, `+ ${set.cards.length - 4} more`) : null)),
      h('div', { class: 'row end gap' },
        h('button', { class: 'btn ghost', onclick: () => m.close() }, 'No thanks'),
        h('button', { class: 'btn green', onclick: () => {
          upsertSet(set);
          m.close();
          toast(`Added "${set.title}"`);
          go('home');
        } }, icon('plus'), 'Add to my quizzes'))));
  } catch {
    toast('That share link is broken or incomplete', 'bad');
  }
}

export function importFromHash() {
  const m = location.hash.match(/^#set=(.+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  importCode(m[1]);
}

export function openPlaySetup(set) {
  const opts = Object.assign({ goal: 300, mode: 'mixed', every: 10, both: false }, S.lastOpts || {});
  if (![5, 10, 15].includes(opts.every)) opts.every = 10;
  const termSet = set.cards.filter(c => !/\?\s*$/.test(c.q)).length > set.cards.length / 2;
  const m = modal(h('div', { class: 'setup' },
    h('div', { class: `setup-head c-${set.color}` }, h('small', {}, 'Get ready'), h('h2', {}, set.title)),
    h('label', { class: 'label' }, 'Session length'),
    segmented([
      { value: 180, label: '3 min' }, { value: 300, label: '5 min' }, { value: 600, label: '10 min' }, { value: 'mastery', label: 'Until learned' },
    ], opts.goal, v => (opts.goal = v)),
    h('label', { class: 'label' }, 'How you answer'),
    segmented([
      { value: 'mc', label: 'Multiple choice' }, { value: 'mixed', label: 'Mixed' }, { value: 'type', label: 'Type it' },
    ], opts.mode, v => (opts.mode = v)),
    h('p', { class: 'hint' }, 'Mixed starts with choices, then makes you type answers once you know them. Typing from memory is what makes it stick.'),
    h('label', { class: 'label' }, 'Game unlocks every'),
    segmented([
      { value: 5, label: '5 right' }, { value: 10, label: '10 right' }, { value: 15, label: '15 right' },
    ], opts.every, v => (opts.every = v)),
    termSet ? h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: opts.both, onchange: e => (opts.both = e.target.checked) }),
      h('span', {}, 'Ask both ways (term to definition and back)')) : null,
    h('button', { class: 'btn big green full', onclick: () => {
      S.lastOpts = opts; save();
      m.close();
      sfx('ready');
      go('play', { id: set.id, opts });
    } }, icon('play'), 'Start!')));
}

function howItWorks() {
  const step = (n, t, d) => h('div', { class: 'how-step' }, h('div', { class: 'how-n' }, n), h('h4', {}, t), h('p', {}, d));
  return h('section', { class: 'how' },
    h('h2', {}, 'How Brainrush helps it stick'),
    h('div', { class: 'how-grid' },
      step(1, 'Answer to unlock games', 'Every 10 right answers unlocks game time. Pick Slice Frenzy, Quick Draw or Snake Arena and play for big gold.'),
      step(2, 'Misses come right back', 'Get one wrong and you see the answer and why, then it returns a couple of questions later until you nail it.'),
      step(3, 'Recall, not recognition', 'Once you know a card, Brainrush stops showing choices and makes you type it from memory.'),
      step(4, 'Spaced out over time', 'Cards you know show up less and less. Cards you struggle with keep showing up.')));
}
