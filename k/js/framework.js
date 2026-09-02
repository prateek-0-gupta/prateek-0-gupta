// bas: a small SPA runtime in one file. Routes, hooks, delegated events,
// DOM morphing. "Bas" is Hindi for "enough", which is the design goal.
//
// A page is a function that returns an HTML string. It is called with
// { params, query, path, hash } and may be async. Hooks work by call order,
// like React. Effects run after the DOM is patched and may return a cleanup,
// which runs before the effect re-runs and when the page is left.

let hooks = [];              // hook slots for the current page
let hookIndex = 0;
let pageGen = 0;             // bumps on every route change; stale closures check it
let pendingEffects = [];     // collected during render, flushed after the DOM patch
let eventHandlers = {};      // data-action name -> handler, cleared on route change
let app = null;              // the Framework instance, for navigate()

// ── Hooks ────────────────────────────────────────────────────────────

export function useState(initialValue) {
    const i = hookIndex++;
    if (!(i in hooks)) {
        hooks[i] = { value: typeof initialValue === 'function' ? initialValue() : initialValue };
    }
    const slot = hooks[i];
    const gen = pageGen;
    const setState = (next) => {
        if (gen !== pageGen) return;     // the page that owned this state is gone
        const value = typeof next === 'function' ? next(slot.value) : next;
        if (Object.is(slot.value, value)) return;
        slot.value = value;
        if (app) app.scheduleRender();
    };
    return [slot.value, setState];
}

function depsChanged(prev, next) {
    if (!prev || !next) return true;                 // no deps: run every render
    if (prev.length !== next.length) return true;
    return next.some((d, k) => !Object.is(d, prev[k]));
}

export function useEffect(callback, dependencies) {
    const i = hookIndex++;
    const slot = hooks[i] || (hooks[i] = { deps: undefined, cleanup: null, ran: false, dead: false });
    if (slot.ran && !depsChanged(slot.deps, dependencies)) return;
    slot.ran = true;
    slot.deps = dependencies;
    pendingEffects.push(() => {
        runCleanup(slot);
        const result = callback();
        if (typeof result === 'function') {
            slot.cleanup = result;
        } else if (result && typeof result.then === 'function') {
            // async effect: the resolved value may be a cleanup. If the page is
            // already gone by then, run it straight away.
            result.then(c => {
                if (typeof c !== 'function') return;
                if (slot.dead) c(); else slot.cleanup = c;
            });
        }
    });
}

function runCleanup(slot) {
    const c = slot.cleanup;
    slot.cleanup = null;
    if (typeof c === 'function') {
        try { c(); } catch (err) { console.error('[framework] effect cleanup failed', err); }
    }
}

function unmountPage() {
    hooks.forEach(slot => { if (slot && 'cleanup' in slot) { runCleanup(slot); slot.dead = true; } });
    hooks = [];
    pendingEffects = [];
    eventHandlers = {};
    pageGen++;
}

function flushEffects() {
    const fx = pendingEffects;
    pendingEffects = [];
    fx.forEach(f => {
        try { f(); } catch (err) { console.error('[framework] effect failed', err); }
    });
}

// ── Events ───────────────────────────────────────────────────────────

/**
 * Register a handler by name for elements with data-action="name".
 * Handlers persist across re-renders of a page and are cleared when the
 * route changes, so a page can register them at module level or inside its
 * render function; the latter simply overwrites each time.
 */
export function registerHandler(name, fn) {
    eventHandlers[name] = fn;
}

/** Navigate from code. Same rules as a data-link click. */
export function navigate(url, options = {}) {
    if (app) app.navigateTo(url, options);
}

// ── DOM morphing ─────────────────────────────────────────────────────
// Patches the existing DOM in place instead of replacing innerHTML, so
// focus, scroll position and CSS transitions survive a re-render. A subtree
// marked data-morph-ignore is left alone entirely; use it for regions a page
// manages by hand (canvases, third-party widgets).

function morphChildren(oldParent, newParent) {
    const newNodes = Array.from(newParent.childNodes);

    for (let i = 0; i < newNodes.length; i++) {
        const oldNode = oldParent.childNodes[i];
        const newNode = newNodes[i];
        if (!oldNode) oldParent.appendChild(newNode.cloneNode(true));
        else morphNode(oldParent, oldNode, newNode);
    }
    while (oldParent.childNodes.length > newNodes.length) {
        oldParent.removeChild(oldParent.lastChild);
    }
}

function morphNode(parent, oldNode, newNode) {
    if (oldNode.nodeType !== newNode.nodeType) {
        parent.replaceChild(newNode.cloneNode(true), oldNode);
        return;
    }
    if (oldNode.nodeType === Node.TEXT_NODE || oldNode.nodeType === Node.COMMENT_NODE) {
        if (oldNode.textContent !== newNode.textContent) oldNode.textContent = newNode.textContent;
        return;
    }
    if (oldNode.nodeType === Node.ELEMENT_NODE) {
        if (oldNode.tagName !== newNode.tagName) {
            parent.replaceChild(newNode.cloneNode(true), oldNode);
            return;
        }
        if (oldNode.hasAttribute('data-morph-ignore')) return;
        morphAttributes(oldNode, newNode);
        morphChildren(oldNode, newNode);
    }
}

function morphAttributes(oldEl, newEl) {
    for (const attr of Array.from(oldEl.attributes)) {
        if (!newEl.hasAttribute(attr.name)) oldEl.removeAttribute(attr.name);
    }
    for (const attr of Array.from(newEl.attributes)) {
        if (oldEl.getAttribute(attr.name) !== attr.value) oldEl.setAttribute(attr.name, attr.value);
    }
}

// ── Routing ──────────────────────────────────────────────────────────

/** Strip a trailing slash, keep a leading one. */
function normalizePath(p) {
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p || '/';
}

// Routes are exact paths, or patterns with :name segments. '*' is the
// not-found page.
function compileRoutes(routes) {
    const exact = new Map();
    const patterns = [];
    let notFound = null;
    for (const [key, component] of Object.entries(routes)) {
        if (key === '*') { notFound = component; continue; }
        const path = normalizePath(key);
        if (!path.includes(':')) { exact.set(path, component); continue; }
        const keys = [];
        const source = path.split('/').map(seg => {
            if (!seg.startsWith(':')) return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            keys.push(seg.slice(1));
            return '([^/]+)';
        }).join('/');
        patterns.push({ regex: new RegExp('^' + source + '$'), keys, component });
    }
    return { exact, patterns, notFound };
}

export default class Framework {
    constructor(routes, basePath = '') {
        this.routes = compileRoutes(routes);
        this.basePath = basePath;           // e.g. '/k'
        this.root = document.getElementById('app');
        this.current = null;                // { path, component, params }
        this._renderId = 0;
        this._scheduled = false;
        this._observer = null;

        app = this;
        this.init();
    }

    isInBasePath(path) {
        if (!this.basePath) return false;
        return path === this.basePath || path.startsWith(this.basePath + '/');
    }

    /** A route-relative path ('/snake') as a real URL path ('/k/snake'). */
    withBase(path) {
        if (!this.basePath || this.isInBasePath(path)) return path;
        return this.basePath + path;
    }

    init() {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.addEventListener('popstate', () => this.handleRoute('pop'));

        document.body.addEventListener('click', e => {
            const link = e.target.closest('[data-link]');
            if (link) {
                // leave new-tab, download and modified clicks to the browser
                if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                if (link.getAttribute('target') === '_blank' || link.hasAttribute('download')) return;
                e.preventDefault();
                this.navigateTo(link.getAttribute('href'));
                return;
            }
            const actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                const fn = eventHandlers[actionEl.getAttribute('data-action')];
                if (fn) fn(e);
            }
        });

        this.handleRoute('load');
    }

    navigateTo(url, { replace = false } = {}) {
        const target = new URL(url, location.href);
        if (target.origin !== location.origin) { location.href = url; return; }
        if (url.startsWith('/')) target.pathname = this.withBase(target.pathname);
        const next = target.pathname + target.search + target.hash;
        const here = location.pathname + location.search + location.hash;
        if (next === here) { this.scrollAfterNavigation(); return; }

        // remember where we were so the back button can put us back there
        history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, '');
        if (replace) history.replaceState(null, '', next);
        else history.pushState(null, '', next);
        this.handleRoute(replace ? 'replace' : 'push');
    }

    resolve(pathname) {
        let path = pathname;
        if (this.isInBasePath(path)) path = path.slice(this.basePath.length) || '/';
        path = normalizePath(path);

        const exact = this.routes.exact.get(path);
        if (exact) return { path, component: exact, params: {} };
        for (const p of this.routes.patterns) {
            const m = path.match(p.regex);
            if (!m) continue;
            const params = {};
            p.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
            return { path, component: p.component, params };
        }
        return { path, component: this.routes.notFound, params: {}, notFound: true };
    }

    async handleRoute(reason = 'push') {
        const match = this.resolve(location.pathname);
        const changed = !this.current
            || this.current.path !== match.path
            || this.current.component !== match.component;
        if (changed) {
            unmountPage();
            if (this._observer) { this._observer.disconnect(); this._observer = null; }
        }
        this.current = match;
        await this.update();
        if (changed) this.scrollAfterNavigation(reason);
    }

    scrollAfterNavigation(reason = 'push') {
        if (reason === 'pop' && history.state && typeof history.state.scrollY === 'number') {
            window.scrollTo(0, history.state.scrollY);
            return;
        }
        if (location.hash) {
            const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
            if (el) { el.scrollIntoView(); return; }
        }
        if (reason !== 'load') window.scrollTo(0, 0);
    }

    /** Coalesce several setState calls into one render. */
    scheduleRender() {
        if (this._scheduled) return;
        this._scheduled = true;
        queueMicrotask(() => { this._scheduled = false; this.update(); });
    }

    async update() {
        const id = ++this._renderId;
        const gen = pageGen;
        const match = this.current;
        hookIndex = 0;

        let viewHtml;
        if (!match.component) {
            viewHtml = `<h1>404 - Not Found</h1><p>The requested path ${match.path} does not exist.</p>`;
        } else {
            const ctx = {
                params: match.params,
                query: new URLSearchParams(location.search),
                path: match.path,
                hash: location.hash,
            };
            viewHtml = await match.component(ctx);
        }
        // a newer render or a route change overtook this one while it awaited
        if (id !== this._renderId || gen !== pageGen) return;

        const activeId = document.activeElement?.id;
        if (!this.root.hasChildNodes()) {
            this.root.innerHTML = viewHtml;
        } else {
            const temp = document.createElement('div');
            temp.innerHTML = viewHtml;
            morphChildren(this.root, temp);
        }
        if (activeId && document.activeElement?.id !== activeId) {
            const el = document.getElementById(activeId);
            if (el && typeof el.focus === 'function') el.focus();
        }

        this.decorateLinks();
        flushEffects();
        this.afterRender();
    }

    // Give data-links real hrefs (so open-in-new-tab and copy-link work) and
    // mark the one for the current page.
    decorateLinks() {
        const here = normalizePath(location.pathname);
        this.root.querySelectorAll('[data-link]').forEach(a => {
            const href = a.getAttribute('href');
            if (!href || !href.startsWith('/')) return;
            const [, path, rest] = href.match(/^([^?#]*)(.*)$/);
            const full = this.withBase(path);
            if (full !== path) a.setAttribute('href', full + rest);
            if (normalizePath(full) === here) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
    }

    afterRender() {
        if (!this._observer) {
            this._observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        this._observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
        }
        this.root.querySelectorAll('.reveal:not(.visible)').forEach(el => this._observer.observe(el));
    }
}
