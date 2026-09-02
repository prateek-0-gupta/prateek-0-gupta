// Multi-selection: rubber-band (marquee) selection of cards and strokes,
// shift-click to add or remove, and moving the whole lot together.
//
// Single selections (ctx.selectedCardId, ctx.sketch.selectedId) stay as they
// are for handles, spools and focus mode. This module owns the case of more
// than one thing being selected at once.

import { w2s, screenToCanvas } from './viewport.js';
import { pushUndo, saveState } from './state.js';
import { renderCards } from './cards.js';
import { renderThreads, pruneThreads } from './threads.js';
import { strokeBBox, translateStroke, redrawSketch, updateSketchHint, drawHalo } from './sketch.js';

export function initSelectState() {
    return {
        cards: new Set(),
        strokes: new Set(),
        marquee: null,      // { start, end } in world coords while rubber-banding
        drag: null,         // { last, moved } while moving the group
    };
}

export function selCount(ctx) {
    return ctx.sel.cards.size + ctx.sel.strokes.size;
}

export function selHasCard(ctx, id) { return ctx.sel.cards.has(id); }
export function selHasStroke(ctx, id) { return ctx.sel.strokes.has(id); }

/* ── Boxes ────────────────────────────────────────────────────────── */

// World-space box of a card, from its DOM size (the surface is scaled by a
// transform, so offsetWidth is already in world units).
export function cardBox(ctx, id) {
    const card = ctx.state.cards.find(c => c.id === id);
    if (!card) return null;
    const el = ctx.dom.surface.querySelector(`.canvas-card[data-id="${id}"]`);
    const w = el ? el.offsetWidth : 180, h = el ? el.offsetHeight : 60;
    return { x1: card.x, y1: card.y, x2: card.x + w, y2: card.y + h };
}

function boxesIntersect(a, b) {
    return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function unionBox(boxes) {
    if (!boxes.length) return null;
    return boxes.reduce((u, b) => ({
        x1: Math.min(u.x1, b.x1), y1: Math.min(u.y1, b.y1),
        x2: Math.max(u.x2, b.x2), y2: Math.max(u.y2, b.y2),
    }));
}

function selectionBoxes(ctx) {
    const boxes = [];
    ctx.sel.cards.forEach(id => { const b = cardBox(ctx, id); if (b) boxes.push(b); });
    ctx.sel.strokes.forEach(id => {
        const s = ctx.state.strokes.find(x => x.id === id);
        if (s) boxes.push(strokeBBox(s));
    });
    return boxes;
}

/* ── Selection changes ────────────────────────────────────────────── */

function paintCards(ctx) {
    ctx.dom.surface.querySelectorAll('.canvas-card').forEach(el =>
        el.classList.toggle('selected', ctx.sel.cards.has(el.dataset.id) || el.dataset.id === ctx.selectedCardId));
}

function refresh(ctx) {
    paintCards(ctx);
    updateSketchHint(ctx);
    redrawSketch(ctx);
}

export function clearSelection(ctx) {
    if (!selCount(ctx)) return false;
    ctx.sel.cards.clear();
    ctx.sel.strokes.clear();
    refresh(ctx);
    return true;
}

// Drop the single selections; a group takes over from here.
function absorbSingles(ctx) {
    if (ctx.selectedCardId) { ctx.sel.cards.add(ctx.selectedCardId); ctx.selectedCardId = null; }
    if (ctx.sketch.selectedId) { ctx.sel.strokes.add(ctx.sketch.selectedId); ctx.sketch.selectedId = null; }
}

// Shift-click: add to or remove from the group.
export function toggleInSelection(ctx, kind, id) {
    absorbSingles(ctx);
    const set = kind === 'card' ? ctx.sel.cards : ctx.sel.strokes;
    if (set.has(id)) set.delete(id); else set.add(id);
    settle(ctx);
}

export function selectAll(ctx) {
    ctx.selectedCardId = null;
    ctx.sketch.selectedId = null;
    ctx.sel.cards = new Set(ctx.state.cards.map(c => c.id));
    ctx.sel.strokes = new Set((ctx.state.strokes || []).map(s => s.id));
    settle(ctx);
}

// A group of exactly one collapses back into a normal single selection, so
// handles and the spool come back.
function settle(ctx) {
    if (selCount(ctx) === 1) {
        if (ctx.sel.cards.size) ctx.selectedCardId = [...ctx.sel.cards][0];
        else ctx.sketch.selectedId = [...ctx.sel.strokes][0];
        ctx.sel.cards.clear();
        ctx.sel.strokes.clear();
    }
    refresh(ctx);
}

/* ── Marquee ──────────────────────────────────────────────────────── */

export function startMarquee(ctx, e) {
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);
    ctx.sel.marquee = { start: pos, end: pos, additive: e.shiftKey && selCount(ctx) > 0 };
    if (!ctx.sel.marquee.additive) {
        ctx.sel.cards.clear();
        ctx.sel.strokes.clear();
    } else {
        absorbSingles(ctx);
    }
    ctx.sel.keep = { cards: new Set(ctx.sel.cards), strokes: new Set(ctx.sel.strokes) };
    ctx.selectedCardId = null;
    ctx.sketch.selectedId = null;
    ctx.dom.root.classList.add('marquee');
    refresh(ctx);
}

function marqueeBox(m) {
    return {
        x1: Math.min(m.start.x, m.end.x), y1: Math.min(m.start.y, m.end.y),
        x2: Math.max(m.start.x, m.end.x), y2: Math.max(m.start.y, m.end.y),
    };
}

function applyMarquee(ctx) {
    const box = marqueeBox(ctx.sel.marquee);
    ctx.sel.cards = new Set(ctx.sel.keep.cards);
    ctx.sel.strokes = new Set(ctx.sel.keep.strokes);
    ctx.state.cards.forEach(c => {
        const b = cardBox(ctx, c.id);
        if (b && boxesIntersect(b, box)) ctx.sel.cards.add(c.id);
    });
    (ctx.state.strokes || []).forEach(s => {
        if (boxesIntersect(strokeBBox(s), box)) ctx.sel.strokes.add(s.id);
    });
}

/* ── Group drag ───────────────────────────────────────────────────── */

export function startGroupDrag(ctx, e) {
    pushUndo(ctx);
    ctx.sel.drag = { last: screenToCanvas(ctx, e.clientX, e.clientY), moved: false };
    ctx.dom.root.classList.add('group-dragging');
}

function moveGroup(ctx, dx, dy) {
    ctx.sel.cards.forEach(id => {
        const card = ctx.state.cards.find(c => c.id === id);
        if (!card) return;
        card.x += dx; card.y += dy;
        const el = ctx.dom.surface.querySelector(`.canvas-card[data-id="${id}"]`);
        if (el) { el.style.left = card.x + 'px'; el.style.top = card.y + 'px'; }
    });
    ctx.sel.strokes.forEach(id => {
        const s = ctx.state.strokes.find(x => x.id === id);
        if (s) translateStroke(s, dx, dy);
    });
    renderThreads(ctx);
    redrawSketch(ctx);
}

export function nudgeSelection(ctx, dx, dy) {
    if (!selCount(ctx)) return false;
    pushUndo(ctx);
    moveGroup(ctx, dx / ctx.viewport.zoom, dy / ctx.viewport.zoom);
    saveState(ctx);
    return true;
}

/* ── Mouse ────────────────────────────────────────────────────────── */

// Both return true when they consumed the event.
export function onSelectMouseMove(ctx, e) {
    const sel = ctx.sel;
    if (sel.marquee) {
        if (e.buttons === 0) { onSelectMouseUp(ctx, e); return true; }
        sel.marquee.end = screenToCanvas(ctx, e.clientX, e.clientY);
        applyMarquee(ctx);
        refresh(ctx);
        return true;
    }
    if (sel.drag) {
        if (e.buttons === 0) { onSelectMouseUp(ctx, e); return true; }
        const pos = screenToCanvas(ctx, e.clientX, e.clientY);
        moveGroup(ctx, pos.x - sel.drag.last.x, pos.y - sel.drag.last.y);
        sel.drag.last = pos;
        sel.drag.moved = true;
        return true;
    }
    return false;
}

export function onSelectMouseUp(ctx, e) {
    const sel = ctx.sel;
    if (sel.marquee) {
        sel.marquee = null;
        sel.keep = null;
        ctx.dom.root.classList.remove('marquee');
        settle(ctx);
        return true;
    }
    if (sel.drag) {
        const moved = sel.drag.moved;
        sel.drag = null;
        ctx.dom.root.classList.remove('group-dragging');
        if (moved) { saveState(ctx); renderCards(ctx); paintCards(ctx); }
        else ctx.undoStack.pop();
        return true;
    }
    return false;
}

/* ── Delete ───────────────────────────────────────────────────────── */

export function deleteSelection(ctx) {
    if (!selCount(ctx)) return false;
    pushUndo(ctx);
    ctx.sel.cards.forEach(id => {
        const card = ctx.state.cards.find(c => c.id === id);
        if (!card) return;
        ctx.state.cards = ctx.state.cards.filter(c => c.id !== id);
        ctx.state.trash.unshift(card);
    });
    if (ctx.state.trash.length > 100) ctx.state.trash.length = 100;
    ctx.sel.strokes.forEach(id => {
        ctx.state.strokes = ctx.state.strokes.filter(s => s.id !== id);
        pruneThreads(ctx, id);
    });
    ctx.sel.cards.clear();
    ctx.sel.strokes.clear();
    renderCards(ctx);
    refresh(ctx);
    saveState(ctx);
    return true;
}

/* ── Drawing ──────────────────────────────────────────────────────── */

// Called from redrawSketch after the strokes: marquee rectangle, halos on
// grouped strokes, and a dashed box around the whole group.
export function drawSelectionOverlay(ctx) {
    const c = ctx.sketchCtx;
    const sel = ctx.sel;
    if (!sel) return;

    if (sel.strokes.size) {
        (ctx.state.strokes || []).forEach(s => { if (sel.strokes.has(s.id)) drawHalo(ctx, s, false); });
    }

    if (selCount(ctx) > 1) {
        const u = unionBox(selectionBoxes(ctx));
        if (u) {
            const a = w2s(ctx, { x: u.x1, y: u.y1 }), b = w2s(ctx, { x: u.x2, y: u.y2 });
            c.save();
            c.strokeStyle = ctx.sketch.thread;
            c.lineWidth = 1.2;
            c.setLineDash([6, 5]);
            c.strokeRect(a.x - 12, a.y - 12, b.x - a.x + 24, b.y - a.y + 24);
            c.restore();
        }
    }

    if (sel.marquee) {
        const m = marqueeBox(sel.marquee);
        const a = w2s(ctx, { x: m.x1, y: m.y1 }), b = w2s(ctx, { x: m.x2, y: m.y2 });
        c.save();
        c.fillStyle = 'rgba(191,64,52,0.06)';
        c.strokeStyle = ctx.sketch.thread;
        c.lineWidth = 1;
        c.setLineDash([4, 3]);
        c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        c.restore();
    }
}
