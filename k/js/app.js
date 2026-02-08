import Framework from './framework.js';
import Home from './pages/home.js';
import Test from './pages/test.js';

const routes = {
    '/': Home,
    '/k/': Home, 
    '/k': Home,
    '/test': Test
};

const app = new Framework(routes, '/k');
