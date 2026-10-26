import { register, go } from './router.js';
import home from './screens/home.js';
import editor from './screens/editor.js';
import play from './screens/play.js';
import results from './screens/results.js';
import shop from './screens/shop.js';
import { importFromHash } from './screens/home.js';
import { S } from './store.js';

register('home', home);
register('editor', editor);
register('play', play);
register('results', results);
register('shop', shop);

go('home');
importFromHash();
addEventListener('hashchange', importFromHash);

// ?game=<id> jumps straight into one game (handy for testing); ?game=pick opens the picker.
const gm = new URLSearchParams(location.search).get('game');
if (gm) import('./games/index.js').then(m => m.gameTime({ unit: 10, avatar: S.avatar, forceId: gm === 'pick' ? null : gm }));
