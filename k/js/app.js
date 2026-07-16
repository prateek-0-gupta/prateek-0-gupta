import Framework from './framework.js';
import Home from './pages/home.js';
import Test from './pages/test.js';
import P2PChat from './pages/projects/p2pchat/p2pchat.js';
import Snake from './pages/projects/snake/snake.js';
import Baoli from './pages/projects/baoli/baoli.js';
import KettleIndex from './pages/projects/kettleindex/kettleindex.js';
import BVHViewer from './pages/projects/bvhviewer/bvhviewer.js';
import IThinkThereforeIAm from './pages/ithinkthereforiam/ithinkthereforeiam.js';
import { ArticlesIndex, Article } from './pages/articles/articles.js';

const routes = {
    '/': Home,
    '/k/': Home, 
    '/k': Home,
    '/test': Test,
    '/p2pchat': P2PChat,
    '/snake': Snake,
    '/baoli': Baoli,
    '/kettleindex': KettleIndex,
    '/bvhviewer': BVHViewer,
    '/ithinkthereforeiam': IThinkThereforeIAm,
    '/ithinkthereforiam': IThinkThereforeIAm,
    '/articles': ArticlesIndex,
    '/articles/evolution-of-ai-in-media': Article('evolution-of-ai-in-media'),
    '/articles/top-10-ai-movies': Article('top-10-ai-movies'),
    '/articles/myth-of-ai': Article('myth-of-ai'),
    '/articles/history-of-ai': Article('history-of-ai'),
};

const app = new Framework(routes, '/k');
