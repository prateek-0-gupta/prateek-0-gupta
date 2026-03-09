import Framework from './framework.js';
import Home from './pages/home.js';
import Test from './pages/test.js';
import Snake from './pages/projects/snake/snake.js';
import Baoli from './pages/projects/baoli/baoli.js';

const routes = {
    '/': Home,
    '/k/': Home, 
    '/k': Home,
    '/test': Test,
    '/snake': Snake,
    '/baoli': Baoli,
};

const app = new Framework(routes, '/k');
