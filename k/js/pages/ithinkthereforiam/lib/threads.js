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

// World-space box of either kind of end: a card from its DOM size, a stroke
// from its geometry. Null when the end is gone (a card in the trash).
function itemBox(ctx, id) {
    const card = ctx.state.cards.find(c => c.id === id);
    if (card) {
        const el = ctx.dom.surface.querySelector(`.canvas-card[data-id="${id}"]`);
        const w = el ? el.offsetWidth : 180, h = el ? el.offsetHeight : 60;
        return { x1: card.x, y1: card.y, x2: card.x + w, y2: card.y + h };
    }
    return strokeBox(ctx, id);
}

function center(b) { return { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }; }

// Anchor points: three per side, a quarter of the way in from each corner and
// one in the middle. A string leaves from the side that faces the other end,
// at whichever of the three points is nearest to it, so two things side by
// side connect edge to edge and things stacked connect top to bottom.
const SIDE_NORMAL = { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 }, e: { x: 1, y: 0 } };
const PAD = 4;      // the knot sits just off the edge

function sidePoints(b, side) {
    const w = b.x2 - b.x1, h = b.y2 - b.y1;
    const xs = [b.x1 + w * 0.25, b.x1 + w * 0.5, b.x1 + w * 0.75];
    const ys = [b.y1 + h * 0.25, b.y1 + h * 0.5, b.y1 + h * 0.75];
    if (side === 'n') return xs.map(x => ({ x, y: b.y1 - PAD }));
    if (side === 's') return xs.map(x => ({ x, y: b.y2 + PAD }));
    if (side === 'w') return ys.map(y => ({ x: b.x1 - PAD, y }));
    return ys.map(y => ({ x: b.x2 + PAD, y }));
}

function pickAnchor(b, toward) {
    const c = center(b);
    const dx = toward.x - c.x, dy = toward.y - c.y;
    // compare in units of the box so a wide card still prefers its top or
    // bottom when the other end is clearly above or below it
    const w = Math.max(1, b.x2 - b.x1), h = Math.max(1, b.y2 - b.y1);
    const side = Math.abs(dx) / w > Math.abs(dy) / h ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n');
    const pts = sidePoints(b, side);
    let best = pts[0], bestD = Infinity;
    for (const p of pts) {
        const d = Math.hypot(toward.x - p.x, toward.y - p.y);
        if (d < bestD) { bestD = d; best = p; }
    }
    return { x: best.x, y: best.y, n: SIDE_NORMAL[side] };
}

// A thread leaves each side at a right angle, then bends toward the other end
// with a little sag, like string that was pinned rather than pulled tight.
function threadPath(a, b) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const reach = Math.min(160, Math.max(24, dist * 0.4));
    const sag = Math.min(30, dist * 0.08);
    const c1 = { x: a.x + (a.n ? a.n.x : 0) * reach, y: a.y + (a.n ? a.n.y : 0) * reach + sag };
    const c2 = { x: b.x + (b.n ? b.n.x : 0) * reach, y: b.y + (b.n ? b.n.y : 0) * reach + sag };
    return `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
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
        const ba = itemBox(ctx, t.from), bb = itemBox(ctx, t.to);
        if (!ba || !bb) continue;   // an end lives in the trash: the thread waits, unseen
        const a = pickAnchor(ba, center(bb)), b = pickAnchor(bb, center(ba));
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
    const box = itemBox(ctx, fromId);
    if (!box) return;
    const a = pickAnchor(box, b);
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
