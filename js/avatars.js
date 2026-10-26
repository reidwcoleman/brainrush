// Collectible "Blips": little creatures drawn entirely in SVG, no image files.

const SHAPES = {
  round: 'M50 16C74 16 88 34 88 58C88 80 72 92 50 92C28 92 12 80 12 58C12 34 26 16 50 16Z',
  tall: 'M50 10C70 10 80 28 80 52L80 80C80 89 72 92 50 92C28 92 20 89 20 80L20 52C20 28 30 10 50 10Z',
  square: 'M30 20H70C81 20 86 26 86 37V78C86 88 80 92 70 92H30C20 92 14 88 14 78V37C14 26 19 20 30 20Z',
  ghost: 'M50 14C72 14 84 32 84 54V90L74 83L64 90L55 83L45 90L36 83L26 90L16 83V54C16 32 28 14 50 14Z',
  drop: 'M50 8C62 28 86 44 86 64C86 82 70 92 50 92C30 92 14 82 14 64C14 44 38 28 50 8Z',
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}

const INK = '#231044';

function ears(kind, col) {
  const d = shade(col, -0.18);
  if (kind === 'cat') return `<path d="M18 40L20 8L44 24Z M82 40L80 8L56 24Z" fill="${col}"/><path d="M23 30L24 16L35 24Z M77 30L76 16L65 24Z" fill="${shade(col, 0.4)}"/>`;
  if (kind === 'bear') return `<circle cx="24" cy="26" r="12" fill="${col}"/><circle cx="76" cy="26" r="12" fill="${col}"/><circle cx="24" cy="26" r="6" fill="${d}"/><circle cx="76" cy="26" r="6" fill="${d}"/>`;
  if (kind === 'bunny') return `<ellipse cx="34" cy="16" rx="8" ry="18" fill="${col}"/><ellipse cx="66" cy="16" rx="8" ry="18" fill="${col}"/><ellipse cx="34" cy="17" rx="4" ry="12" fill="${shade(col, 0.45)}"/><ellipse cx="66" cy="17" rx="4" ry="12" fill="${shade(col, 0.45)}"/>`;
  return '';
}

function eyes(kind) {
  const L = 38, R = 62, Y = 52;
  const big = (x, look = 1.5) => `<circle cx="${x}" cy="${Y}" r="9" fill="#fff"/><circle cx="${x + look}" cy="${Y + 1}" r="5.2" fill="${INK}"/><circle cx="${x + look + 2}" cy="${Y - 1.5}" r="1.9" fill="#fff"/>`;
  const arc = x => `<path d="M${x - 6} ${Y + 2}Q${x} ${Y - 6} ${x + 6} ${Y + 2}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  switch (kind) {
    case 'dot': return `<circle cx="${L}" cy="${Y}" r="5" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="5" fill="${INK}"/><circle cx="${L + 1.5}" cy="${Y - 1.5}" r="1.5" fill="#fff"/><circle cx="${R + 1.5}" cy="${Y - 1.5}" r="1.5" fill="#fff"/>`;
    case 'happy': return arc(L) + arc(R);
    case 'sleepy': return `<path d="M${L - 6} ${Y}Q${L} ${Y + 5} ${L + 6} ${Y} M${R - 6} ${Y}Q${R} ${Y + 5} ${R + 6} ${Y}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case 'wink': return big(L) + arc(R);
    case 'cool': return `<path d="M26 46H74V50C74 58 68 60 63 60C57 60 54 56 52 52H48C46 56 43 60 37 60C32 60 26 58 26 50Z" fill="${INK}"/><path d="M31 49H41" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`;
    case 'angry': return big(L, 0) + big(R, 0) + `<path d="M28 40L45 45 M72 40L55 45" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    case 'star': return [L, R].map(x => `<path transform="translate(${x} ${Y}) scale(.55)" d="M0 -14L4 -4.5L14 -4.3L6 2.5L9 13L0 7L-9 13L-6 2.5L-14 -4.3L-4 -4.5Z" fill="${INK}"/>`).join('');
    case 'cyclops': return `<circle cx="50" cy="${Y - 2}" r="13" fill="#fff"/><circle cx="51" cy="${Y - 1}" r="7.5" fill="${INK}"/><circle cx="54" cy="${Y - 4}" r="2.6" fill="#fff"/>`;
    default: return big(L) + big(R);
  }
}

function mouth(kind) {
  switch (kind) {
    case 'open': return `<path d="M41 66Q50 80 59 66Z" fill="${INK}"/><path d="M45 72Q50 69 55 72Q50 78 45 72Z" fill="#ff7a9a"/>`;
    case 'cat': return `<path d="M42 67Q46 72 50 67Q54 72 58 67" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    case 'o': return `<ellipse cx="50" cy="69" rx="4" ry="5" fill="${INK}"/>`;
    case 'fang': return `<path d="M41 66Q50 74 59 66" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M45 68.5L47 74L49 69.6Z" fill="#fff"/>`;
    case 'flat': return `<path d="M44 68H56" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    case 'grin': return `<path d="M38 64Q50 80 62 64Z" fill="${INK}"/><path d="M40 65H60L59 68H41Z" fill="#fff"/>`;
    default: return `<path d="M42 66Q50 74 58 66" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  }
}

function accessory(kind, c) {
  switch (kind) {
    case 'crown': return `<path d="M32 24L34 6L43 16L50 3L57 16L66 6L68 24Z" fill="#ffc93c" stroke="#e39a10" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="16" r="3" fill="#ff4d6d"/><circle cx="40" cy="20" r="2" fill="#4d8bff"/><circle cx="60" cy="20" r="2" fill="#4d8bff"/>`;
    case 'tophat': return `<rect x="34" y="2" width="32" height="18" rx="3" fill="${INK}"/><rect x="34" y="13" width="32" height="5" fill="${c || '#ff4d6d'}"/><rect x="24" y="18" width="52" height="6" rx="3" fill="${INK}"/>`;
    case 'horns': return `<path d="M28 26C20 18 20 8 26 2C28 12 34 16 38 20Z M72 26C80 18 80 8 74 2C72 12 66 16 62 20Z" fill="${c || '#fff3d6'}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'leaf': return `<path d="M50 18C50 12 51 8 53 4" stroke="#2f9e44" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M52 8C58 0 70 2 72 6C66 12 58 12 52 8Z" fill="#51cf66"/><path d="M51 10C45 3 36 5 34 9C40 14 46 14 51 10Z" fill="#40c057"/>`;
    case 'halo': return `<ellipse cx="50" cy="7" rx="20" ry="5" fill="none" stroke="#ffd43b" stroke-width="4"/>`;
    case 'party': return `<path d="M50 0L62 24H38Z" fill="${c || '#4d8bff'}"/><path d="M44 12L58 16 M41 19L60 22" stroke="#fff" stroke-width="3"/><circle cx="50" cy="1" r="4" fill="#ffc93c"/>`;
    case 'antenna': return `<path d="M50 18V6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="5" r="5" fill="${c || '#ff4d6d'}"/>`;
    case 'bow': return `<path d="M64 22L54 14V30Z M64 22L74 14V30Z" fill="${c || '#ff5da2'}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="64" cy="22" r="3.5" fill="${c || '#ff5da2'}" stroke="${INK}" stroke-width="1.6"/>`;
    case 'phones': return `<path d="M16 54C16 26 30 12 50 12C70 12 84 26 84 54" stroke="${INK}" stroke-width="5" fill="none"/><rect x="8" y="48" width="12" height="20" rx="5" fill="${c || '#ff4d6d'}"/><rect x="80" y="48" width="12" height="20" rx="5" fill="${c || '#ff4d6d'}"/>`;
    case 'beanie': return `<path d="M20 34C20 14 34 8 50 8C66 8 80 14 80 34Z" fill="${c || '#2ed3b7'}"/><rect x="18" y="30" width="64" height="9" rx="4.5" fill="${shade(c || '#2ed3b7', -0.2)}"/><circle cx="50" cy="7" r="6" fill="#fff"/>`;
    case 'flame': return `<path d="M50 0C54 8 64 10 64 20C64 26 58 30 50 30C42 30 36 26 36 20C36 14 40 12 42 6C44 12 46 12 48 12C46 8 48 4 50 0Z" fill="#ff8a3d"/><path d="M50 12C52 16 57 18 57 22C57 26 54 28 50 28C46 28 43 26 43 22C43 19 46 18 47 15C48 18 49 18 50 18Z" fill="#ffd43b"/>`;
    case 'flower': return `<g transform="translate(70 22)">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="5" ry="8" transform="rotate(${a}) translate(0 -7)" fill="${c || '#ff8fb8'}"/>`).join('')}<circle r="5" fill="#ffd43b"/></g>`;
    case 'wizard': return `<path d="M28 26L52 -4L72 26Z" fill="${c || '#5c3bd6'}"/><rect x="20" y="22" width="60" height="7" rx="3.5" fill="${shade(c || '#5c3bd6', -0.25)}"/><path d="M50 10L52 14L56 14.5L53 17L54 21L50 19L46 21L47 17L44 14.5L48 14Z" fill="#ffd43b"/>`;
    default: return '';
  }
}

function pattern(kind, col) {
  const d = shade(col, -0.14);
  if (kind === 'spots') return `<circle cx="28" cy="72" r="6" fill="${d}"/><circle cx="74" cy="40" r="5" fill="${d}"/><circle cx="70" cy="78" r="4" fill="${d}"/>`;
  if (kind === 'belly') return `<ellipse cx="50" cy="80" rx="20" ry="11" fill="${shade(col, 0.35)}"/>`;
  if (kind === 'sparkle') return `<path d="M76 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z M22 70l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff" opacity=".9"/>`;
  return '';
}

export const RARITY = {
  common: { label: 'Common', color: '#8fa3c8' },
  rare: { label: 'Rare', color: '#4d8bff' },
  epic: { label: 'Epic', color: '#b05cff' },
  legendary: { label: 'Legendary', color: '#ffb020' },
};

const A = (id, name, rarity, body, o = {}) => ({ id, name, rarity, body, shape: 'round', eyes: 'big', mouth: 'smile', ...o });

export const AVATARS = [
  A('sunny', 'Sunny', 'common', '#ffc93c'),
  A('bubbles', 'Bubbles', 'common', '#5ab8ff', { eyes: 'dot', mouth: 'o' }),
  A('minty', 'Minty', 'common', '#4fd1a5', { mouth: 'cat' }),
  A('peaches', 'Peaches', 'common', '#ff9e7a', { eyes: 'happy', cheeks: true }),
  A('grape', 'Grape', 'common', '#9c6bff', { shape: 'tall', eyes: 'dot' }),
  A('lemon', 'Lemon', 'common', '#f5e663', { shape: 'drop', eyes: 'happy', mouth: 'open' }),
  A('pebble', 'Pebble', 'common', '#9aa5b8', { shape: 'square', eyes: 'sleepy', mouth: 'flat' }),
  A('berry', 'Berry', 'common', '#ff5d8f', { pattern: 'spots', cheeks: true }),
  A('sprout', 'Sprout', 'common', '#7bd36b', { acc: 'leaf', eyes: 'dot' }),
  A('cocoa', 'Cocoa', 'common', '#a8754f', { ears: 'bear', pattern: 'belly', eyes: 'dot', mouth: 'cat' }),
  A('splash', 'Splash', 'common', '#3fc6e0', { shape: 'drop', eyes: 'wink' }),
  A('marsh', 'Marsh', 'common', '#f1e9ff', { shape: 'square', eyes: 'happy', cheeks: true }),
  A('tango', 'Tango', 'common', '#ff8a3d', { ears: 'cat', mouth: 'cat' }),
  A('boo', 'Boo', 'common', '#e9f0ff', { shape: 'ghost', eyes: 'dot', mouth: 'o' }),
  A('ziggy', 'Ziggy', 'rare', '#2ed3b7', { acc: 'antenna', accColor: '#ffc93c', mouth: 'grin' }),
  A('hopper', 'Hopper', 'rare', '#ffd6e7', { ears: 'bunny', eyes: 'dot', mouth: 'cat', cheeks: true }),
  A('dj', 'DJ Blip', 'rare', '#6c8cff', { acc: 'phones', eyes: 'happy', mouth: 'open' }),
  A('chill', 'Chill', 'rare', '#58d68d', { eyes: 'cool', mouth: 'fang' }),
  A('party', 'Confetti', 'rare', '#ff6fb1', { acc: 'party', accColor: '#2ed3b7', mouth: 'open', pattern: 'spots' }),
  A('winter', 'Frost', 'rare', '#bfe3ff', { acc: 'beanie', accColor: '#ff5d8f', eyes: 'happy', cheeks: true }),
  A('tiger', 'Stripe', 'rare', '#ffa53d', { ears: 'cat', eyes: 'angry', mouth: 'fang' }),
  A('daisy', 'Daisy', 'rare', '#b8f28a', { acc: 'flower', eyes: 'wink', cheeks: true }),
  A('cubey', 'Cubey', 'rare', '#ff7b7b', { shape: 'square', eyes: 'cyclops', mouth: 'grin' }),
  A('gent', 'Sir Blip', 'epic', '#7a5cff', { acc: 'tophat', accColor: '#ffc93c', eyes: 'wink', mouth: 'smile' }),
  A('imp', 'Imp', 'epic', '#ff4d6d', { acc: 'horns', eyes: 'angry', mouth: 'fang', shape: 'tall' }),
  A('spook', 'Spook', 'epic', '#c6b8ff', { shape: 'ghost', eyes: 'cyclops', mouth: 'open', pattern: 'sparkle' }),
  A('wizard', 'Wizzle', 'epic', '#4fd1c5', { acc: 'wizard', accColor: '#5c3bd6', eyes: 'happy', mouth: 'o', pattern: 'sparkle' }),
  A('starry', 'Starry', 'epic', '#3a2a8c', { eyes: 'star', mouth: 'open', pattern: 'sparkle', cheeks: true }),
  A('king', 'King Blip', 'legendary', '#ffc93c', { acc: 'crown', eyes: 'cool', mouth: 'grin', pattern: 'sparkle' }),
  A('angel', 'Halo', 'legendary', '#ffffff', { acc: 'halo', eyes: 'happy', mouth: 'cat', cheeks: true, pattern: 'sparkle' }),
  A('blaze', 'Blaze', 'legendary', '#ff5a36', { acc: 'flame', eyes: 'angry', mouth: 'grin', shape: 'drop', pattern: 'sparkle' }),
];

export const avatarById = id => AVATARS.find(a => a.id === id) || AVATARS[0];

export function avatarSVG(id, { size = 64, silhouette = false } = {}) {
  const a = typeof id === 'string' ? avatarById(id) : id;
  const body = silhouette ? '#3b2a77' : a.body;
  const inner = silhouette
    ? `${ears(a.ears, body)}<path d="${SHAPES[a.shape]}" fill="${body}"/>${accessory(a.acc, body).replace(/fill="[^"]+"/g, `fill="${body}"`).replace(/stroke="[^"]+"/g, `stroke="${body}"`)}<text x="50" y="66" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="#6e5bb8">?</text>`
    : `${ears(a.ears, body)}
       <path d="${SHAPES[a.shape]}" fill="${body}"/>
       <path d="${SHAPES[a.shape]}" fill="none" stroke="${shade(body, -0.22)}" stroke-width="2.5"/>
       ${pattern(a.pattern, body)}
       <ellipse cx="34" cy="32" rx="9" ry="5" transform="rotate(-25 34 32)" fill="#fff" opacity=".35"/>
       ${a.cheeks ? '<ellipse cx="29" cy="63" rx="6" ry="3.5" fill="#ff6b8b" opacity=".45"/><ellipse cx="71" cy="63" rx="6" ry="3.5" fill="#ff6b8b" opacity=".45"/>' : ''}
       ${eyes(a.eyes)}${mouth(a.mouth)}${accessory(a.acc, a.accColor)}`;
  return `<svg viewBox="0 -4 100 104" width="${size}" height="${size}" aria-hidden="true"><ellipse cx="50" cy="95" rx="28" ry="4.5" fill="rgba(0,0,0,.2)"/>${inner}</svg>`;
}

// Mystery boxes: what you can roll and how likely each rarity is.
export const BOXES = [
  { id: 'basic', name: 'Basic Box', cost: 40, color: 'blue', odds: { common: 72, rare: 24, epic: 3.5, legendary: 0.5 } },
  { id: 'arcade', name: 'Arcade Box', cost: 110, color: 'purple', odds: { common: 35, rare: 45, epic: 16, legendary: 4 } },
  { id: 'mythic', name: 'Mythic Box', cost: 260, color: 'gold', odds: { common: 0, rare: 45, epic: 40, legendary: 15 } },
];

export const DUPE_REFUND = { common: 8, rare: 20, epic: 50, legendary: 120 };

export function rollBox(box) {
  let r = Math.random() * 100;
  let rarity = 'common';
  for (const [k, w] of Object.entries(box.odds)) { if ((r -= w) <= 0) { rarity = k; break; } }
  const pool = AVATARS.filter(a => a.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
