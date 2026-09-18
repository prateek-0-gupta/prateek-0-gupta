// The route table, and what each route puts in <head>. Both app.js and
// tools/build_routes.mjs read it, so this file must stay importable outside
// a browser: every page is a lazy import, nothing here touches the DOM, and
// the only thing pulled in eagerly is the article index (titles, no bodies).
// Lazy pages also mean the desktop does not download the snake game, and a
// tool opened in a window downloads only itself.

import { ARTICLES, getArticle } from './pages/articles/articles-data.js';

// one description everywhere, by request
const DESCRIPTION = 'Hi, I am Prateek, a transdisciplinary multimedia artist. I study AI and blend future media with traditional media tools, and I work as a Software Engineer at Sum Vivas Ltd.';
const by = title => `${title} — Prateek Gupta`;
const nothing = { title: by('Nothing here'), noindex: true };

export const options = {
    base: '/k',
    origin: 'https://prat.ee',
    head: {
        // the home page's own title; keep it in step with k/index.html (the build script checks)
        title: 'Prateek Gupta — software engineer, digital humans, small web tools',
        description: DESCRIPTION,
        type: 'website',
        robots: 'index, follow, max-image-preview:large',
    },
};

const articles = () => import('./pages/articles/articles.js');
const thinking = () => import('./pages/ithinkthereforiam/ithinkthereforeiam.js');

export const routes = {
    '/': { load: () => import('./pages/home.js') },
    '/snake': { load: () => import('./pages/projects/snake/snake.js'), head: { title: by('Nagmani') } },
    '/p2pchat': { load: () => import('./pages/projects/p2pchat/p2pchat.js'), head: { title: by('p2p chat') } },
    '/bvhviewer': { load: () => import('./pages/projects/bvhviewer/bvhviewer.js'), head: { title: by('BVH Viewer') } },
    '/ithinkthereforiam': { load: thinking, head: { title: by('I Think Therefore I Am') } },

    // the writing is plain HTML strings, so the build script bakes it into the static shells
    '/articles': {
        load: () => articles().then(m => m.ArticlesIndex),
        head: { title: by('Writing') },
        prerender: true,
    },
    '/articles/:slug': {
        load: () => articles().then(m => m.ArticlePage),
        head: ({ params }) => {
            const a = getArticle(params.slug);
            return a ? { title: by(a.title), type: 'article' } : nothing;
        },
        prerender: true,
        paths: () => ARTICLES.map(a => `/articles/${a.slug}`),
    },

    // routed, but not pages of their own: no static shell, not in the sitemap
    '/ithinkthereforeiam': { load: thinking, head: { title: by('I Think Therefore I Am') }, paths: () => [] },
    '/test': { load: () => import('./pages/test.js'), head: { noindex: true }, paths: () => [] },

    '*': { page: NotFound, head: nothing },
};

function NotFound({ path }) {
    return `
    <div class="articles-page">
        <div class="art-nav"><a href="/" data-link>&larr; prateek</a></div>
        <h1>Nothing here</h1>
        <p class="articles-index-sub">${path} does not exist. Some things never did.</p>
    </div>`;
}
