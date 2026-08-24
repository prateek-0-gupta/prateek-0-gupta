// State management and persistence

import { uid } from './utils.js';

// Selection, dragging and deletion all match on id. An item without one makes
// those comparisons undefined === undefined, which silently targets the first
// id-less item instead of the clicked one, so backfill before anything runs.
function ensureIds(state) {
    ['cards', 'strokes', 'trash', 'threads'].forEach(key => {
        (state[key] || []).forEach(item => { if (!item.id) item.id = uid(); });
    });
    return state;
}

export function blankState() {
    return {
        cards: [], strokes: [], trash: [], threads: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        boardVisible: false,
        boardOrigin: { x: 120, y: 120 },
        colorCursor: 0,
        seeded: false
    };
}

export function loadState() {
    try {
        const raw = localStorage.getItem('ithink_canvas_v2');
        if (raw) return ensureIds(Object.assign(blankState(), JSON.parse(raw)));
        // migrate from v1 if present
        const old = localStorage.getItem('ithink_canvas');
        if (old) {
            const o = JSON.parse(old);
            const s = blankState();
            s.cards = (o.cards || []).map(c => ({
                id: c.id || uid(), x: c.x, y: c.y,
                text: c.text || '', color: c.color || 'card-yellow',
                column: c.column || null, timeSlot: null,
                created: c.created || Date.now()
            }));
            s.strokes = (o.lines || []).map(l => ({
                id: l.id || uid(), type: 'pen', points: l.points || []
            }));
            s.viewport = o.viewport || s.viewport;
            s.seeded = true;
            return s;
        }
        return blankState();
    } catch (e) {
        return blankState();
    }
}

export function saveState(ctx) {
    ctx.state.viewport = ctx.viewport;
    ctx.state.colorCursor = ctx.colorCursor;
    try {
        localStorage.setItem('ithink_canvas_v2', JSON.stringify(ctx.state));
    } catch (e) { /* storage full, fail silently */ }
}

export function saveStateDebounced(ctx) {
    clearTimeout(ctx.saveTimer);
    ctx.saveTimer = setTimeout(() => saveState(ctx), 300);
}

export function pushUndo(ctx) {
    ctx.undoStack.push(JSON.stringify(ctx.state));
    if (ctx.undoStack.length > 50) ctx.undoStack.shift();
}

export function undoState(ctx) {
    if (ctx.undoStack.length === 0) return false;
    ctx.state = ensureIds(Object.assign(blankState(), JSON.parse(ctx.undoStack.pop())));
    ctx.viewport = ctx.state.viewport || { x: 0, y: 0, zoom: 1 };
    saveState(ctx);
    return true;
}
