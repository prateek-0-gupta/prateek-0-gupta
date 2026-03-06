let hooks = [];
let hookIndex = 0;
let currentComponent = null; 
let renderRequest = null;
let eventHandlers = {};

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

/**
 * Register an event handler by name. Use with data-action="name" in templates.
 * Replaces window.* global function assignments.
 */
export function registerHandler(name, fn) {
    eventHandlers[name] = fn;
}

// ── DOM Morphing ─────────────────────────────────────────────────────
// Lightweight morph that patches the existing DOM in-place instead of
// replacing innerHTML, preserving focus, scroll position, and CSS state.

function morphChildren(oldParent, newParent) {
    const newNodes = Array.from(newParent.childNodes);

    for (let i = 0; i < newNodes.length; i++) {
        const oldNode = oldParent.childNodes[i];
        const newNode = newNodes[i];

        if (!oldNode) {
            oldParent.appendChild(newNode.cloneNode(true));
        } else {
            morphNode(oldParent, oldNode, newNode);
        }
    }

    // Remove excess old nodes from the end
    while (oldParent.childNodes.length > newNodes.length) {
        oldParent.removeChild(oldParent.lastChild);
    }
}

function morphNode(parent, oldNode, newNode) {
    // Different node types → replace
    if (oldNode.nodeType !== newNode.nodeType) {
        parent.replaceChild(newNode.cloneNode(true), oldNode);
        return;
    }

    // Text / comment nodes
    if (oldNode.nodeType === Node.TEXT_NODE || oldNode.nodeType === Node.COMMENT_NODE) {
        if (oldNode.textContent !== newNode.textContent) {
            oldNode.textContent = newNode.textContent;
        }
        return;
    }

    // Element nodes
    if (oldNode.nodeType === Node.ELEMENT_NODE) {
        // Different tag → full replace
        if (oldNode.tagName !== newNode.tagName) {
            parent.replaceChild(newNode.cloneNode(true), oldNode);
            return;
        }

        morphAttributes(oldNode, newNode);
        morphChildren(oldNode, newNode);
    }
}

function morphAttributes(oldEl, newEl) {
    // Remove attributes no longer present
    for (const attr of Array.from(oldEl.attributes)) {
        if (!newEl.hasAttribute(attr.name)) {
            oldEl.removeAttribute(attr.name);
        }
    }
    // Set new / changed attributes
    for (const attr of Array.from(newEl.attributes)) {
        if (oldEl.getAttribute(attr.name) !== attr.value) {
            oldEl.setAttribute(attr.name, attr.value);
        }
    }
}

// ── Framework ────────────────────────────────────────────────────────

export default class Framework {
    constructor(routes, basePath = '') {
        this.routes = routes;
        this.basePath = basePath; // e.g. '/k'
        this.root = document.getElementById('app');
        this.currentPath = null;
        
        renderRequest = () => this.update();
        
        this.init();
    }

    init() {
        window.addEventListener('popstate', () => this.handleRoute());
        
        document.body.addEventListener('click', e => {
            // data-link navigation
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                this.navigateTo(link.getAttribute('href'));
                return;
            }

            // data-action event delegation (replaces onclick="window.*")
            const actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                const name = actionEl.getAttribute('data-action');
                if (eventHandlers[name]) {
                    eventHandlers[name](e);
                }
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

    /** Normalize a path: collapse trailing slashes, ensure leading slash. */
    normalizePath(p) {
        if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
        return p || '/';
    }

    async handleRoute() {
        const path = window.location.pathname;
        let mappedPath = path;

        if (this.basePath && path.startsWith(this.basePath)) {
            mappedPath = path.slice(this.basePath.length);
        }
        mappedPath = this.normalizePath(mappedPath);

        let match = this.routes[mappedPath];

        // Fallback: try alternate slash form
        if (!match) {
            const alt = mappedPath === '/' ? '' : mappedPath + '/';
            match = this.routes[alt];
        }

        if (!match) {
            this.root.innerHTML =
                '<h1>404 - Not Found</h1><p>The requested path ' + mappedPath + ' does not exist.</p>';
            return;
        }

        if (this.currentPath !== mappedPath) {
            hooks = [];
            eventHandlers = {};
            this.currentPath = mappedPath;
        }

        currentComponent = match;
        this.update();
    }

    async update() {
        hookIndex = 0;
        eventHandlers = {}; // handlers are re-registered on each render cycle

        const viewHtml = await currentComponent();

        // Save scroll & focus before patching
        const activeId = document.activeElement?.id;
        const scrollY = window.scrollY;

        if (!this.root.hasChildNodes()) {
            // First render – fast innerHTML path
            this.root.innerHTML = viewHtml;
        } else {
            // Subsequent renders – morph DOM in-place
            const temp = document.createElement('div');
            temp.innerHTML = viewHtml;
            morphChildren(this.root, temp);
        }

        // Restore focus & scroll
        if (activeId) {
            const el = document.getElementById(activeId);
            if (el && typeof el.focus === 'function') el.focus();
        }
        window.scrollTo(0, scrollY);

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
