const routes = {};
let cleanup = null;

export function register(name, fn) { routes[name] = fn; }

// Screens may return a cleanup function, which runs when we leave them.
export function go(name, params = {}) {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  const app = document.getElementById('app');
  app.replaceChildren();
  app.className = `screen-${name}`;
  window.scrollTo(0, 0);
  cleanup = routes[name](app, params) || null;
}
