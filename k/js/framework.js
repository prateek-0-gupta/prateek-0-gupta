let hooks = [];
let hookIndex = 0;
let currentComponent = null; 
let renderRequest = null; 

export function useState(initialValue) {
    const _idx = hookIndex; 
    
    if (hooks[_idx] === undefined) {
        hooks[_idx] = initialValue;
    }

    const setState = (newValue) => {
        const value = typeof newValue === "function" ? newValue(hooks[_idx]) : newValue;
        
        if (hooks[_idx] !== value) {
            hooks[_idx] = value;
            if (renderRequest) renderRequest();
        }
    };

    hookIndex++; 
    return [hooks[_idx], setState];
}

export function useEffect(callback, dependencies) {
    const _idx = hookIndex;
    const oldDeps = hooks[_idx];
    let hasChanged = true;

    if (oldDeps) {
        hasChanged = dependencies.some((dep, i) => !Object.is(dep, oldDeps[i]));
    }

    if (hasChanged) {
        setTimeout(callback, 0); 
        hooks[_idx] = dependencies;
    }

    hookIndex++;
}

export default class Framework {
    constructor(routes, basePath = '') {
        this.routes = routes;
        this.basePath = basePath; //'/k'
        this.root = document.getElementById('app');
        this.currentPath = null;
        
        renderRequest = () => this.update();
        
        this.init();
    }

    init() {
        window.addEventListener('popstate', () => this.handleRoute());
        
        document.body.addEventListener('click', e => {
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                const href = link.getAttribute('href');
                this.navigateTo(href);
            }
        });

        this.handleRoute();
    }

    navigateTo(url) {
        let fullPath = url;
        if (url.startsWith('/') && this.basePath && !url.startsWith(this.basePath)) {
            fullPath = this.basePath + url;
        }

        history.pushState(null, null, fullPath);
        this.handleRoute();
    }

    async handleRoute() {
        let path = window.location.pathname;
        let mappedPath = path;
        if (this.basePath && path.startsWith(this.basePath)) {
            mappedPath = path.slice(this.basePath.length);
             if (mappedPath === '') mappedPath = '/';
        }
        let match = this.routes[mappedPath]; 
        if (!match) {
             if (mappedPath.endsWith('/')) match = this.routes[mappedPath.slice(0, -1)];
             else match = this.routes[mappedPath + '/'];
        }

        if (!match && mappedPath === '/') {
             match = this.routes['/'];
        }

        if (!match) {
            this.root.innerHTML = '<h1>404 - Not Found</h1><p>The requested path ' + mappedPath + ' does not exist.</p>';
            return;
        }

        if (this.currentPath !== mappedPath) {
            hooks = []; 
            this.currentPath = mappedPath;
        }

        currentComponent = match;
        this.update();
    }

    async update() {
        hookIndex = 0;
        const viewHtml = await currentComponent();
        this.root.innerHTML = viewHtml;
        this.afterRender();
    }

    afterRender() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }
}
