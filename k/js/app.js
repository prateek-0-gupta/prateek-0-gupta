import Framework from './framework.js';
import Home from './pages/home.js';
import Test from './pages/test.js';
import P2PChat from './pages/projects/p2pchat/p2pchat.js';
import Snake from './pages/projects/snake/snake.js';
import Baoli from './pages/projects/baoli/baoli.js';
import KettleIndex from './pages/projects/kettleindex/kettleindex.js';
import BVHViewer from './pages/projects/bvhviewer/bvhviewer.js';

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
};

const app = new Framework(routes, '/k');
