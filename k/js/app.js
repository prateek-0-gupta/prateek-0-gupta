import Framework from './framework.js';
import { routes, options } from './routes.js';

// Routes, and the <head> each one gets, live in routes.js. bas keeps the
// title, description, canonical and social tags right during client-side
// navigation; the static shells written by tools/build_routes.mjs carry the
// same values, and the article text, for crawlers.
new Framework(routes, options);
