import Framework from './framework.js';
import Home from './pages/home.js';
import Test from './pages/test.js';
import P2PChat from './pages/projects/p2pchat/p2pchat.js';
import Snake from './pages/projects/snake/snake.js';
import BVHViewer from './pages/projects/bvhviewer/bvhviewer.js';
import IThinkThereforeIAm from './pages/ithinkthereforiam/ithinkthereforeiam.js';
import { ArticlesIndex, ArticlePage } from './pages/articles/articles.js';

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

const app = new Framework(routes, '/k');
