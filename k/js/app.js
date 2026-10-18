import Framework from './framework.js';
import { routes, options } from './routes.js';
import { mooliFor } from './components/mooli.js';

// Routes, and the <head> each one gets, live in routes.js. bas keeps the
// title, description, canonical and social tags right during client-side
// navigation; the static shells written by tools/build_routes.mjs carry the
// same values, and the article text, for crawlers.
// Mooli, the creature in the margin, follows you from page to page except
// onto the tools and games (routes marked mooli: false).
const app = new Framework(routes, options);
app.onRender = match => mooliFor(match);
