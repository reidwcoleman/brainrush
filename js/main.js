import { register, go } from './router.js';
import home from './screens/home.js';
import editor from './screens/editor.js';
import play from './screens/play.js';
import results from './screens/results.js';
import shop from './screens/shop.js';
import { importFromHash } from './screens/home.js';

register('home', home);
register('editor', editor);
register('play', play);
register('results', results);
register('shop', shop);

go('home');
importFromHash();
addEventListener('hashchange', importFromHash);

// ?mg=<game id> jumps straight into one mini-game (handy for testing them).
const mg = new URLSearchParams(location.search).get('mg');
if (mg) import('./games/index.js').then(m => m.playMinigame({ unit: 10, sessionGold: 500, avatar: 'sunny', forceId: mg }));
