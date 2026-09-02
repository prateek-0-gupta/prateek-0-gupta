// Threads — red string connecting one thought to another. Either end can be
// a card or a sketch stroke (shape or text); both are addressed by id.
// Rendered as an SVG layer inside #canvas-surface so it inherits pan/zoom.

import { strokeBox } from './sketch.js';

const NS = 'http://www.w3.org/2000/svg';

export function ensureThreadLayer(ctx) {
    let svg = ctx.dom.surface.querySelector('#thread-layer');
    if (!svg) {
        svg = document.createElementNS(NS, 'svg');
        svg.id = 'thread-layer';
        // between the dot grid and the kanban board / cards
        ctx.dom.surface.insertBefore(svg, ctx.dom.kanbanBoard);
    }
    return svg;
}

function cardCenter(ctx, id) {
    const card = ctx.state.cards.find(c => c.id === id);
    if (!card) return null;
    const el = ctx.dom.surface.querySelector(`.canvas-card[data-id="${id}"]`);
    const w = el ? el.offsetWidth : 180;
    const h = el ? el.offsetHeight : 60;
    return { x: card.x + w / 2, y: card.y + h / 2 };
}

// Where a thread meets an end. Cards hide the knot under themselves, so their
// centre will do. A stroke is hollow, so the string stops at the edge of its
// box on the side facing the other end.
function endpoint(ctx, id, toward = null) {
    const c = cardCenter(ctx, id);
    if (c) return c;
    const b = strokeBox(ctx, id);
    if (!b) return null;
    const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
    if (!toward) return { x: cx, y: cy };
    const dx = toward.x - cx, dy = toward.y - cy;
    const hw = (b.x2 - b.x1) / 2 + 6, hh = (b.y2 - b.y1) / 2 + 6;
    if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return { x: cx, y: cy };
    const t = Math.min(Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity,
                       Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity);
    return { x: cx + dx * t, y: cy + dy * t };
}

export function strokeHasThread(ctx, id) {
    return (ctx.state.threads || []).some(t => t.from === id || t.to === id);
}

// A deleted stroke takes its threads with it (unlike a card, it has no trash to come back from).
export function pruneThreads(ctx, id) {
    const before = (ctx.state.threads || []).length;
    ctx.state.threads = (ctx.state.threads || []).filter(t => t.from !== id && t.to !== id);
    if (ctx.state.threads.length !== before) renderThreads(ctx);
}

// A thread is not a straight wire — it sags a little, like string.
function threadPath(a, b) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = Math.min(48, dist * 0.12);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag;
    return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

function mkPath(d, cls) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', cls);
    return p;
}

function mkKnot(pt) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 2.6);
    c.setAttribute('class', 'thread-knot');
    return c;
}

export function renderThreads(ctx) {
    const svg = ensureThreadLayer(ctx);
    svg.querySelectorAll('.thread-g').forEach(g => g.remove());
    for (const t of ctx.state.threads || []) {
        const ca = endpoint(ctx, t.from), cb = endpoint(ctx, t.to);
        if (!ca || !cb) continue;   // an end lives in the trash — thread waits, unseen
        const a = endpoint(ctx, t.from, cb), b = endpoint(ctx, t.to, ca);
        const d = threadPath(a, b);
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'thread-g');
        const hit = mkPath(d, 'thread-hit');
        hit.dataset.id = t.id;
        g.appendChild(hit);
        g.appendChild(mkPath(d, 'thread-path'));
        g.appendChild(mkKnot(a));
        g.appendChild(mkKnot(b));
        svg.appendChild(g);
    }
}

// The dashed preview while a thread is being pulled. Pass b = null to clear.
export function setTempThread(ctx, fromId, b) {
    const svg = ensureThreadLayer(ctx);
    let p = svg.querySelector('#thread-temp');
    if (!b) { if (p) p.remove(); return; }
    const a = endpoint(ctx, fromId, b);
    if (!a) return;
    if (!p) {
        p = mkPath('', 'thread-path thread-temp');
        p.id = 'thread-temp';
        svg.appendChild(p);
    }
    p.setAttribute('d', threadPath(a, b));
}

export function hasThread(ctx, idA, idB) {
    return (ctx.state.threads || []).some(t =>
        (t.from === idA && t.to === idB) || (t.from === idB && t.to === idA));
}
