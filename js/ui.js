// Tiny DOM helpers shared by every screen.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z M14 6l4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
  share: '<path d="M12 15V3 M7 8l5-5 5 5 M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  trash: '<path d="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<path d="M12 5v14 M5 12h14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  x: '<path d="M6 6l12 12 M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  game: '<path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.5 2.5 0 0 1-4.3 1.2L14.5 16h-5l-2.3 2.2a2.5 2.5 0 0 1-4.3-1.2l-.8-4A5 5 0 0 1 7 7z" fill="currentColor"/><path d="M7 10v4 M5 12h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="11" r="1.2" fill="#fff"/><circle cx="18" cy="13.4" r="1.2" fill="#fff"/>',
  flame: '<path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3-.5-3 0-6.5 1-9.5z" fill="currentColor"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7 M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5 M21.5 9.5l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  upload: '<path d="M12 16V4 M7 9l5-5 5 5 M4 20h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  download: '<path d="M12 4v12 M7 11l5 5 5-5 M4 20h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z M7 6H4v1a3 3 0 0 0 3 3 M17 6h3v1a3 3 0 0 1-3 3 M12 14v4 M8 21h8 M9 18h6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8z" fill="currentColor"/>',
  box: '<path d="M3 8l9-4 9 4v9l-9 4-9-4V8z M3 8l9 4 9-4 M12 12v9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  dots: '<circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/>',
  bulb: '<path d="M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  target: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
};

export function icon(name, cls = '') {
  return h('span', { class: `ic ${cls}`, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>` });
}

// The chunky gold coin used for every currency number in the app.
export function coin(cls = '') {
  return h('span', { class: `coin ${cls}`, 'aria-hidden': 'true', html:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f5a524"/><circle cx="12" cy="11" r="9" fill="#ffd34e"/><circle cx="12" cy="11" r="6" fill="none" stroke="#e8951c" stroke-width="1.6"/><path d="M10.5 8h2.5v6.5" stroke="#e8951c" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
}

export function fmt(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

export function toast(msg, kind = '') {
  const t = h('div', { class: `toast ${kind}` }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('out'), 2400);
  setTimeout(() => t.remove(), 2800);
}

export function modal(content, { onClose, wide = false, locked = false } = {}) {
  const card = h('div', { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog' }, content);
  const back = h('div', { class: 'modal-back' }, card);
  const close = () => {
    back.classList.add('out');
    setTimeout(() => back.remove(), 180);
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = e => { if (e.key === 'Escape' && !locked) close(); };
  if (!locked) back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  return { close, el: card };
}

export function confirmBox(title, body, okLabel = 'Delete') {
  return new Promise(res => {
    let done = false;
    const finish = v => { if (!done) { done = true; res(v); m.close(); } };
    const m = modal(h('div', {},
      h('h2', { class: 'modal-title' }, title),
      h('p', { class: 'muted' }, body),
      h('div', { class: 'row end gap' },
        h('button', { class: 'btn ghost', onclick: () => finish(false) }, 'Cancel'),
        h('button', { class: 'btn red', onclick: () => finish(true) }, okLabel))),
      { onClose: () => { if (!done) { done = true; res(false); } } });
  });
}

export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg' });
  const render = () => {
    wrap.replaceChildren(...options.map(o => h('button', {
      class: `seg-btn ${o.value === value ? 'on' : ''}`, type: 'button',
      onclick: () => { value = o.value; render(); onChange(o.value); },
    }, o.label)));
  };
  render();
  return wrap;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Cards can carry a picture: an image link, a data: URL, or raw SVG code.
// SVG is shown through <img>, so any scripts inside a shared quiz never run.
export function imgSrc(img) {
  const s = String(img || '').trim();
  if (/^<svg[\s>]/i.test(s) || /^<\?xml/i.test(s)) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  if (/^(https?:\/\/|data:image\/)/i.test(s)) return s;
  return '';
}

// Tap a picture to see it full screen.
export function cardImg(img, cls = 'q-img') {
  const src = imgSrc(img);
  if (!src) return null;
  return h('img', { class: cls, src, alt: 'Diagram for this question', loading: 'lazy', onclick: e => {
    e.stopPropagation();
    const m = modal(h('img', { class: 'img-zoom', src, alt: 'Diagram, enlarged', onclick: () => m.close() }), { wide: true });
  } });
}

export const uid = () => Math.random().toString(36).slice(2, 9);
