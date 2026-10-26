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
      if (c.wrong.length || c.explain) row.push(c.wrong);
      if (c.explain) row.push(c.explain);
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
    cards: (slim.k || []).map(([q, a, wrong = [], explain = '']) => ({ q, a, wrong, explain })),
  };
}

export async function shareLink(set) {
  const base = location.href.split('#')[0];
  return `${base}#set=${await encodeSet(set)}`;
}
