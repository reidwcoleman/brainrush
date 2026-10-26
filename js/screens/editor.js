import { h, icon, toast, uid, confirmBox } from '../ui.js';
import { getSet, upsertSet, normalizeSet } from '../store.js';
import { parseBulk, parseImport } from '../parse.js';
import { go } from '../router.js';
import { topbar } from './topbar.js';

const COLORS = ['purple', 'blue', 'green', 'orange', 'red', 'pink', 'teal'];

export default function editor(app, { id } = {}) {
  const existing = id && getSet(id);
  const set = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: uid(), title: '', desc: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], cards: [] };
  if (!set.cards.length) set.cards.push(blank(), blank(), blank());
  let dirty = false;
  const touch = () => (dirty = true);

  const title = h('input', { class: 'input title-input', placeholder: 'Quiz title, e.g. "Unit 4: Photosynthesis"', value: set.title, maxlength: 80, oninput: e => { set.title = e.target.value; touch(); } });
  const desc = h('input', { class: 'input', placeholder: 'Short description (optional)', value: set.desc, maxlength: 200, oninput: e => { set.desc = e.target.value; touch(); } });
  const swatches = h('div', { class: 'swatches' });
  const renderSwatches = () => swatches.replaceChildren(...COLORS.map(c => h('button', {
    class: `swatch c-${c} ${set.color === c ? 'on' : ''}`, 'aria-label': c, type: 'button',
    onclick: () => { set.color = c; touch(); renderSwatches(); },
  })));
  renderSwatches();

  const list = h('div', { class: 'card-list' });
  const count = h('span', { class: 'muted' });
  const renderList = () => {
    list.replaceChildren(...set.cards.map((c, i) => cardRow(c, i)));
    count.textContent = `${set.cards.filter(c => c.q.trim() && c.a.trim()).length} questions`;
  };

  function cardRow(c, i) {
    const extrasOpen = !!(c.wrong.some(Boolean) || c.explain);
    const extras = h('div', { class: `extras ${extrasOpen ? 'open' : ''}` },
      h('label', { class: 'label sm' }, 'Wrong choices (optional, otherwise we borrow other answers)'),
      h('div', { class: 'wrong-grid' }, [0, 1, 2].map(k => h('input', {
        class: 'input sm', placeholder: `Wrong answer ${k + 1}`, value: c.wrong[k] || '',
        oninput: e => { c.wrong[k] = e.target.value; touch(); },
      }))),
      h('label', { class: 'label sm' }, 'Why is this the answer? (shown when someone gets it wrong)'),
      h('textarea', { class: 'input sm', rows: 2, placeholder: 'A one-line explanation helps you understand, not just memorize.', value: c.explain || '', oninput: e => { c.explain = e.target.value; touch(); } }));
    return h('div', { class: 'card-row' },
      h('div', { class: 'card-row-head' },
        h('span', { class: 'card-num' }, i + 1),
        h('button', { class: 'link-btn', type: 'button', onclick: e => { extras.classList.toggle('open'); e.currentTarget.textContent = extras.classList.contains('open') ? 'Hide extras' : 'Add wrong choices + explanation'; } },
          extrasOpen ? 'Hide extras' : 'Add wrong choices + explanation'),
        h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'Delete question', onclick: () => { set.cards.splice(i, 1); touch(); renderList(); } }, icon('trash'))),
      h('div', { class: 'qa-grid' },
        h('div', {},
          h('label', { class: 'label sm' }, 'Question or term'),
          h('textarea', { class: 'input', rows: 2, placeholder: 'What is the powerhouse of the cell?', value: c.q, oninput: e => { c.q = e.target.value; touch(); count.textContent = `${set.cards.filter(x => x.q.trim() && x.a.trim()).length} questions`; } })),
        h('div', {},
          h('label', { class: 'label sm' }, 'Answer'),
          h('textarea', { class: 'input', rows: 2, placeholder: 'Mitochondria', value: c.a, oninput: e => { c.a = e.target.value; touch(); count.textContent = `${set.cards.filter(x => x.q.trim() && x.a.trim()).length} questions`; } }))),
      extras);
  }

  // Paste-a-list panel
  const bulk = h('textarea', { class: 'input mono', rows: 10, placeholder: 'Mitochondria - makes ATP for the cell\nNucleus - stores the DNA\nRibosome - builds proteins\n\nor with choices:\nCapital of Australia? | Canberra | Sydney | Melbourne | Perth | Built as a compromise city' });
  const found = h('span', { class: 'muted' }, 'Paste something above');
  const parsePasted = text => (/^\s*[[{]/.test(text) ? parseImport(text).flatMap(x => x.cards) : parseBulk(text));
  bulk.addEventListener('input', () => {
    const n = parsePasted(bulk.value).length;
    found.textContent = n ? `${n} question${n === 1 ? '' : 's'} found` : 'No questions found yet';
  });
  const pastePanel = h('div', { class: 'paste-panel hidden' },
    h('p', { class: 'muted' }, 'One question per line. Copy straight out of Quizlet (export), Google Sheets, or your notes.'),
    h('ul', { class: 'formats' },
      h('li', {}, h('code', {}, 'term - definition'), ' or ', h('code', {}, 'term: definition'), ' or tab-separated'),
      h('li', {}, h('code', {}, 'question | answer | wrong 1 | wrong 2 | wrong 3 | explanation')),
      h('li', {}, 'or paste quiz JSON (from ChatGPT, a download, etc.)')),
    bulk,
    h('div', { class: 'row between' }, found,
      h('button', { class: 'btn blue', type: 'button', onclick: () => {
        const cards = parsePasted(bulk.value);
        if (!cards.length) return toast('No questions found. Use one per line like "term - definition".', 'bad');
        set.cards = set.cards.filter(c => c.q.trim() || c.a.trim()).concat(cards.map(c => ({ id: uid(), ...c })));
        bulk.value = '';
        found.textContent = '';
        touch();
        renderList();
        showTab('cards');
        toast(`Added ${cards.length} questions`);
      } }, icon('plus'), 'Add them')));

  const cardsPanel = h('div', {}, list,
    h('button', { class: 'btn ghost add-card', type: 'button', onclick: () => {
      set.cards.push(blank());
      touch();
      renderList();
      list.lastChild.querySelector('textarea').focus();
    } }, icon('plus'), 'Add question'));

  const tabBtns = { cards: h('button', { class: 'tab on', type: 'button', onclick: () => showTab('cards') }, 'Questions'), paste: h('button', { class: 'tab', type: 'button', onclick: () => showTab('paste') }, 'Paste a list') };
  function showTab(t) {
    tabBtns.cards.classList.toggle('on', t === 'cards');
    tabBtns.paste.classList.toggle('on', t === 'paste');
    cardsPanel.classList.toggle('hidden', t !== 'cards');
    pastePanel.classList.toggle('hidden', t !== 'paste');
  }

  const leave = async () => {
    if (dirty && !(await confirmBox('Leave without saving?', 'Your changes to this quiz will be lost.', 'Leave'))) return;
    go('home');
  };

  const saveSet = () => {
    const clean = normalizeSet({ ...set, title: set.title.trim() || 'Untitled quiz' });
    if (!clean.cards.length) return toast('Add at least one question with an answer', 'bad');
    const noChoices = clean.cards.length < 4 && clean.cards.some(c => c.wrong.length < 3);
    upsertSet(clean);
    dirty = false;
    toast(noChoices ? 'Saved. Tip: add more questions or wrong choices for better multiple choice.' : 'Saved!');
    go('home');
  };

  app.append(
    topbar({ back: leave }),
    h('main', { class: 'wrap narrow editor' },
      h('h1', { class: 'page-title' }, existing ? 'Edit quiz' : 'New quiz'),
      title, desc,
      h('div', { class: 'row between wrap-row' }, h('div', { class: 'row gap' }, h('span', { class: 'label inline' }, 'Color'), swatches), count),
      h('div', { class: 'tabs' }, tabBtns.cards, tabBtns.paste),
      cardsPanel,
      pastePanel),
    h('div', { class: 'save-bar' },
      h('div', { class: 'save-bar-inner' },
        h('button', { class: 'btn ghost', onclick: leave }, 'Cancel'),
        h('button', { class: 'btn green big', onclick: saveSet }, icon('check'), 'Save quiz'))));
  renderList();
  if (!existing) {
    if (set.cards.every(c => !c.q)) showTab('cards');
    setTimeout(() => title.focus(), 50);
  }
}

function blank() {
  return { id: uid(), q: '', a: '', wrong: [], explain: '' };
}
