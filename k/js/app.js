import Framework from './framework.js';
import Home from './pages/home.js';
import Test from './pages/test.js';
import P2PChat from './pages/projects/p2pchat/p2pchat.js';
import Snake from './pages/projects/snake/snake.js';
import BVHViewer from './pages/projects/bvhviewer/bvhviewer.js';
import IThinkThereforeIAm from './pages/ithinkthereforiam/ithinkthereforeiam.js';
import { ArticlesIndex, ArticlePage } from './pages/articles/articles.js';
import { ARTICLES } from './pages/articles/articles-data.js';

function NotFound({ path }) {
    return `
    <div class="articles-page">
        <div class="art-nav"><a href="/" data-link>&larr; prateek</a></div>
        <h1>Nothing here</h1>
        <p class="articles-index-sub">${path} does not exist. Some things never did.</p>
    </div>`;
}

const routes = {
    '/': Home,
    '/k/': Home, 
    '/k': Home,
    '/test': Test,
    '/p2pchat': P2PChat,
    '/snake': Snake,
    '/bvhviewer': BVHViewer,
    '/ithinkthereforeiam': IThinkThereforeIAm,
    '/ithinkthereforiam': IThinkThereforeIAm,
    '/articles': ArticlesIndex,
    '/articles/:slug': ArticlePage,
    '*': NotFound,
};

// A tool opened in a window on the desktop loads this shell as /k/?app=/route,
// so any static server can serve it. Swap in the real route before routing.
const embedded = new URLSearchParams(location.search).get('app');
if (embedded && /^\/[\w-]+$/.test(embedded)) history.replaceState(null, '', '/k' + embedded);

const app = new Framework(routes, '/k');

// ── Per-route <head>: title, description, canonical and the social tags ──
// The static shells written by tools/build_routes.py carry the same values
// for crawlers; this keeps them right during client-side navigation.
const SITE = 'https://prat.ee';
const DEFAULT_META = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
};
const PAGE_META = {
    '/articles':          { title: 'Writing — Prateek Gupta', description: 'Long-form pieces on AI in cinema, a corpus study of 2,015 AI films, and a reverse-engineered £20 ESP32 voice board.' },
    '/snake':             { title: 'Nagmani — Prateek Gupta', description: 'An Indian gothic snake game. The snake is cursed. So are you if you keep playing.' },
    '/p2pchat':           { title: 'p2p chat — Prateek Gupta', description: 'A serverless chat over WebRTC. Your messages go from your browser to theirs and nowhere else.' },
    '/bvhviewer':         { title: 'BVH Viewer — Prateek Gupta', description: 'Drop a .bvh motion-capture file in and watch a skeleton do whatever the actor did that day.' },
    '/ithinkthereforiam': { title: 'I Think Therefore I Am — Prateek Gupta', description: 'An infinite canvas for dumping thoughts. Everything stays in your browser.' },
};

function setMeta(sel, attr, value) {
    const el = document.head.querySelector(sel);
    if (el) el.setAttribute(attr, value);
}

app.onRender = (match) => {
    let meta = PAGE_META[match.path] || (match.path === '/' ? DEFAULT_META : null);
    if (!meta && match.params?.slug) {
        const a = ARTICLES.find(x => x.slug === match.params.slug);
        if (a) meta = { title: `${a.title} — Prateek Gupta`, description: a.blurb.charAt(0).toUpperCase() + a.blurb.slice(1) };
    }
    if (!meta) meta = match.notFound ? { title: 'Nothing here — Prateek Gupta', description: DEFAULT_META.description } : DEFAULT_META;
    const url = SITE + '/k' + (match.path === '/' ? '/' : match.path);
    document.title = meta.title;
    setMeta('meta[name="description"]', 'content', meta.description);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:title"]', 'content', meta.title);
    setMeta('meta[property="og:description"]', 'content', meta.description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:type"]', 'content', match.params?.slug ? 'article' : 'website');
    setMeta('meta[name="twitter:title"]', 'content', meta.title);
    setMeta('meta[name="twitter:description"]', 'content', meta.description);
    setMeta('meta[name="robots"]', 'content', match.notFound ? 'noindex, follow' : 'index, follow, max-image-preview:large');
};
