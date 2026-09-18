import Framework from './framework.js';
import { routes, options } from './routes.js';

// A tool opened in a window on the desktop loads this shell as /k/?app=/route,
// so any static server can serve it. Swap in the real route before routing.
const embedded = new URLSearchParams(location.search).get('app');
if (embedded && /^\/[\w-]+$/.test(embedded)) history.replaceState(null, '', '/k' + embedded);

// Routes, and the <head> each one gets, live in routes.js. bas keeps the
// title, description, canonical and social tags right during client-side
// navigation; the static shells written by tools/build_routes.mjs carry the
// same values, and the article text, for crawlers.
new Framework(routes, options);
