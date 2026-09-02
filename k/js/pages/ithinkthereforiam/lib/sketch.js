// Sketch/drawing tools

import { uid } from './utils.js';
import { w2s, screenToCanvas, applyViewport } from './viewport.js';
import { pushUndo, saveState, saveStateDebounced } from './state.js';
import { renderThreads, strokeHasThread, pruneThreads } from './threads.js';

export const SHAPE_TOOLS = ['line', 'arrow', 'rect', 'tri'];

// Hotkeys while the palette is open. Digits follow palette order.
export const TOOL_KEYS = {
    v: 'select', p: 'pen', l: 'line', a: 'arrow', r: 'rect', t: 'text', e: 'eraser',
    1: 'select', 2: 'pen', 3: 'line', 4: 'arrow', 5: 'rect', 6: 'tri', 7: 'text', 8: 'eraser',
};

const LABEL_SIZE = 17;          // world px for shape labels and default text
const HALO_PAD = 8;             // screen px between a shape and its selection box
const HANDLE_HIT = 9;           // screen px: how close a click has to be to grab a handle
const ERASER_R = 14;            // screen px

const HINTS = {
    selectEmpty: 'click a shape to select it · drag empty space to pan · double-click empty space to write',
    selectSel: 'drag to move · handles resize · pull the red spool to thread it · double-click to label · ⌫ delete',
    pen: 'draw freely · Esc when done, then grab anything you drew straight off the canvas',
    shape: 'drag to draw · it is selected the moment you let go',
    text: 'click anywhere to write · click existing text to edit it',
    eraser: 'drag across strokes to erase them',
};

export function initSketchState() {
    return {
        tool: null,         // null | select | pen | line | arrow | rect | tri | text | eraser
        isDrawing: false,
        currentStroke: [],
        shapeStart: null,
        selectedId: null,   // selected stroke (select tool)
        hoverId: null,      // stroke under the cursor (select tool)
        dragSel: null,      // { id, last:{x,y}, moved } while moving a stroke
        resizeSel: null,    // see startResize()
        pan: null,          // { x, y } while panning with the select tool
        pointer: null,      // last screen position, for the eraser ring
        ink: '#1A1A1A',
        thread: '#BF4034',
    };
}

/* ── Tool + palette state ─────────────────────────────────────────── */

function paletteEl() { return document.getElementById('sketch-palette'); }
function hintEl() { return document.getElementById('sketch-hint'); }

export function updateSketchHint(ctx) {
    const el = hintEl();
    if (!el) return;
    const t = ctx.sketch.tool;
    let text = '';
    if (t === 'select') text = ctx.sketch.selectedId ? HINTS.selectSel : HINTS.selectEmpty;
    else if (t === null && ctx.sketch.selectedId) text = HINTS.selectSel;
    else if (t === 'pen') text = HINTS.pen;
    else if (SHAPE_TOOLS.includes(t)) text = HINTS.shape;
    else if (t === 'text') text = HINTS.text;
    else if (t === 'eraser') text = HINTS.eraser;
    el.textContent = text;
    el.classList.toggle('open', !!text);
}

// Sets the tool outright (null turns sketching off but leaves the palette as is).
export function setSketchTool(ctx, tool) {
    const sk = ctx.sketch;
    sk.tool = tool || null;
    if (sk.tool !== 'select') sk.selectedId = null;
    sk.hoverId = null;
    sk.dragSel = sk.resizeSel = sk.pan = null;
    sk.isDrawing = false;
    sk.currentStroke = [];
    sk.shapeStart = null;
    sk.pointer = null;

    const palette = paletteEl();
    if (sk.tool) palette.classList.add('open');
    palette.querySelectorAll('[data-tool]').forEach(b =>
        b.classList.toggle('active', b.dataset.tool === sk.tool));

    const cv = ctx.dom.sketchCanvas;
    cv.classList.toggle('active', sk.tool !== null);
    cv.classList.toggle('tool-select', sk.tool === 'select');
    cv.classList.toggle('tool-text', sk.tool === 'text');
    cv.classList.toggle('tool-eraser', sk.tool === 'eraser');
    cv.style.cursor = '';
    document.getElementById('btn-sketch').classList.toggle('active', sk.tool !== null);
    updateSketchHint(ctx);
    redrawSketch(ctx);
}

// Palette closed, tool off, selection dropped.
export function closeSketch(ctx) {
    paletteEl().classList.remove('open');
    setSketchTool(ctx, null);
}

export function toggleSketchPalette(ctx) {
    if (paletteEl().classList.contains('open')) closeSketch(ctx);
    else setSketchTool(ctx, 'pen');
}

// Escape: drop the selection first, then leave sketching. True when handled.
export function sketchEscape(ctx) {
    if (ctx.sketch.selectedId) { deselectStroke(ctx); return true; }
    if (!ctx.sketch.tool) return false;
    closeSketch(ctx);
    return true;
}

function selectStroke(ctx, id) {
    ctx.sketch.selectedId = id || null;
    updateSketchHint(ctx);
}

export function deselectStroke(ctx) {
    if (!ctx.sketch.selectedId) return;
    selectStroke(ctx, null);
    redrawSketch(ctx);
}

// Things that sit over the canvas and own their own clicks.
const UI_SELECTOR = '.canvas-card, #canvas-toolbar, #day-planner, #disclaimer-bar, #trash-tray, #sketch-palette, #sketch-hint, #triage, #settings-panel, .thread-hit, .sketch-label-input';
function overUi(e) {
    return !!(e.target && e.target.closest && e.target.closest(UI_SELECTOR));
}

/* ── Geometry helpers ─────────────────────────────────────────────── */

// Triangle from a drag rectangle: apex top-centre, base along the bottom.
function triPoints(s) {
    const x1 = Math.min(s.from.x, s.to.x), x2 = Math.max(s.from.x, s.to.x);
    const y1 = Math.min(s.from.y, s.to.y), y2 = Math.max(s.from.y, s.to.y);
    return [ { x: (x1 + x2) / 2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 } ];
}

function segDist(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(a.x + t * dx - px, a.y + t * dy - py);
}

function inBox(b, x, y, r = 0) {
    return x > b.x1 - r && x < b.x2 + r && y > b.y1 - r && y < b.y2 + r;
}

// Text is measured with the real font so labels hit and halo where they draw.
let _measure = null;
function textWidth(text, size) {
    if (!_measure) _measure = document.createElement('canvas').getContext('2d');
    _measure.font = `${size}px Caveat, cursive`;
    return _measure.measureText(text || '').width;
}

function labelSize(s) { return s.type === 'text' ? (s.size || LABEL_SIZE) : LABEL_SIZE; }

// Bounding box of the drawn geometry alone (a text stroke is just its anchor point).
function geomBBox(s) {
    let xs, ys;
    if (s.type === 'pen') { xs = s.points.map(p => p.x); ys = s.points.map(p => p.y); }
    else if (s.type === 'text') { xs = [s.at.x]; ys = [s.at.y]; }
    else { xs = [s.from.x, s.to.x]; ys = [s.from.y, s.to.y]; }
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

// Where a label sits: on the text's own anchor, or centred on a shape.
function strokeAnchor(s) {
    if (s.type === 'text') return { x: s.at.x, y: s.at.y };
    const b = geomBBox(s);
    return { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
}

// World-space box around a stroke's label, if it has one.
function labelBox(s) {
    if (!s.text) return null;
    const a = strokeAnchor(s), size = labelSize(s);
    const hw = textWidth(s.text, size) / 2 + 4, hh = size * 0.62;
    return { x1: a.x - hw, y1: a.y - hh, x2: a.x + hw, y2: a.y + hh };
}

export function strokeBBox(s) {
    if (s.type === 'text') return labelBox(s) || geomBBox(s);
    return geomBBox(s);
}

// World box of a stroke by id, for the thread layer.
export function strokeBox(ctx, id) {
    const s = strokeById(ctx, id);
    return s ? strokeBBox(s) : null;
}

export function strokeAtScreen(ctx, sx, sy) {
    const pos = screenToCanvas(ctx, sx, sy);
    return strokeAt(ctx, pos.x, pos.y);
}

function pointInTri(p, a, b, c) {
    const sign = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
    const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(neg && pos);
}

// fill=true (select tool): closed shapes hit anywhere inside.
// fill=false (eraser): edges only, so you can erase things drawn inside a box.
function strokeHit(s, wx, wy, r, fill = false) {
    if (s.type === 'pen') {
        return (s.points || []).some((p, i) =>
            i > 0 ? segDist(wx, wy, s.points[i - 1], p) < r : Math.hypot(p.x - wx, p.y - wy) < r);
    }
    if (s.type === 'text') return inBox(strokeBBox(s), wx, wy, r);
    if (!s.from || !s.to) return false;
    if (s.type === 'arrow' || s.type === 'line') return segDist(wx, wy, s.from, s.to) < r;
    if (s.type === 'rect') {
        const b = geomBBox(s);
        if (fill) return inBox(b, wx, wy, r);
        const c = [
            [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y1 }], [{ x: b.x2, y: b.y1 }, { x: b.x2, y: b.y2 }],
            [{ x: b.x2, y: b.y2 }, { x: b.x1, y: b.y2 }], [{ x: b.x1, y: b.y2 }, { x: b.x1, y: b.y1 }],
        ];
        return c.some(([a, d]) => segDist(wx, wy, a, d) < r);
    }
    if (s.type === 'tri') {
        const [a, b2, c] = triPoints(s);
        if (fill && pointInTri({ x: wx, y: wy }, a, b2, c)) return true;
        return segDist(wx, wy, a, b2) < r || segDist(wx, wy, b2, c) < r || segDist(wx, wy, c, a) < r;
    }
    return false;
}

// Never match on a falsy id: that would resolve to the first id-less stroke.
function strokeById(ctx, id) {
    return id ? (ctx.state.strokes || []).find(s => s.id === id) || null : null;
}

// Topmost stroke under a world point. Exact hits (edges, insides, labels) win;
// the loose interior of a scribble is a fallback so a drawn circle can be
// grabbed by its middle without stealing clicks from things drawn inside it.
export function strokeAt(ctx, wx, wy) {
    const rad = 12 / ctx.viewport.zoom;
    const strokes = ctx.state.strokes || [];
    for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        if (strokeHit(s, wx, wy, rad, true)) return s;
        const lb = labelBox(s);
        if (lb && inBox(lb, wx, wy)) return s;
    }
    for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        if (s.type !== 'pen') continue;
        const b = geomBBox(s);
        if ((b.x2 - b.x1) * ctx.viewport.zoom > 24 && (b.y2 - b.y1) * ctx.viewport.zoom > 24 && inBox(b, wx, wy)) return s;
    }
    return null;
}

function translateStroke(s, dx, dy) {
    if (s.type === 'pen') s.points.forEach(p => { p.x += dx; p.y += dy; });
    else if (s.type === 'text') { s.at.x += dx; s.at.y += dy; }
    else { s.from.x += dx; s.from.y += dy; s.to.x += dx; s.to.y += dy; }
}

export function nudgeSelectedStroke(ctx, dx, dy) {
    const s = strokeById(ctx, ctx.sketch.selectedId);
    if (!s) return false;
    pushUndo(ctx);
    translateStroke(s, dx / ctx.viewport.zoom, dy / ctx.viewport.zoom);
    redrawSketch(ctx);
    if (strokeHasThread(ctx, s.id)) renderThreads(ctx);
    saveStateDebounced(ctx);
    return true;
}

/* ── Resize ───────────────────────────────────────────────────────── */

// Screen-space handles for a selected stroke. Lines get their two endpoints;
// everything else gets a box with corners (and edge midpoints for shapes).
function handlesFor(ctx, s) {
    if (s.type === 'line' || s.type === 'arrow') {
        const a = w2s(ctx, s.from), b = w2s(ctx, s.to);
        return [ { x: a.x, y: a.y, kind: 'from' }, { x: b.x, y: b.y, kind: 'to' } ];
    }
    const box = haloBox(ctx, s);
    const mx = (box.x1 + box.x2) / 2, my = (box.y1 + box.y2) / 2;
    const hs = [
        { x: box.x1, y: box.y1, kind: 'nw' }, { x: box.x2, y: box.y1, kind: 'ne' },
        { x: box.x1, y: box.y2, kind: 'sw' }, { x: box.x2, y: box.y2, kind: 'se' },
    ];
    if (s.type !== 'text') {
        hs.push({ x: mx, y: box.y1, kind: 'n' }, { x: mx, y: box.y2, kind: 's' },
                { x: box.x1, y: my, kind: 'w' }, { x: box.x2, y: my, kind: 'e' });
    }
    return hs;
}

// Screen-space rectangle of the selection halo.
function haloBox(ctx, s) {
    const bb = strokeBBox(s);
    const a = w2s(ctx, { x: bb.x1, y: bb.y1 }), b = w2s(ctx, { x: bb.x2, y: bb.y2 });
    return { x1: a.x - HALO_PAD, y1: a.y - HALO_PAD, x2: b.x + HALO_PAD, y2: b.y + HALO_PAD };
}

function handleNear(ctx, s, sx, sy) {
    return handlesFor(ctx, s).find(h => Math.abs(sx - h.x) < HANDLE_HIT && Math.abs(sy - h.y) < HANDLE_HIT) || null;
}

// The little spool a thread is pulled from: off the right edge of the halo,
// or beside the middle of a line.
const SPOOL_R = 6;
function spoolPoint(ctx, s) {
    if (s.type === 'line' || s.type === 'arrow') {
        const a = w2s(ctx, s.from), b = w2s(ctx, s.to);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        return { x: (a.x + b.x) / 2 + nx * 16, y: (a.y + b.y) / 2 + ny * 16 };
    }
    const box = haloBox(ctx, s);
    return { x: box.x2 + 14, y: (box.y1 + box.y2) / 2 };
}

// Id of the selected stroke when the press lands on its spool, else null.
export function spoolAt(ctx, e) {
    const sel = strokeById(ctx, ctx.sketch.selectedId);
    if (!sel || overUi(e)) return null;
    const p = spoolPoint(ctx, sel);
    return Math.hypot(e.clientX - p.x, e.clientY - p.y) <= SPOOL_R + 4 ? sel.id : null;
}

const HANDLE_CURSOR = {
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
    from: 'crosshair', to: 'crosshair',
};

function snapshotGeom(s) {
    if (s.type === 'pen') return { points: s.points.map(p => ({ ...p })) };
    if (s.type === 'text') return { at: { ...s.at }, size: s.size || LABEL_SIZE };
    return { from: { ...s.from }, to: { ...s.to } };
}

function startResize(s, kind, pos) {
    const rs = { id: s.id, kind, grab: { x: pos.x, y: pos.y }, orig: snapshotGeom(s), moved: false };
    if (kind === 'from' || kind === 'to') return rs;
    const bb = strokeBBox(s);
    const hasW = kind.includes('w'), hasE = kind.includes('e');
    const hasN = kind.includes('n'), hasS = kind.includes('s');
    // the side opposite the grabbed handle stays put; the grabbed corner follows the mouse
    rs.anchor = { x: hasW ? bb.x2 : bb.x1, y: hasN ? bb.y2 : bb.y1 };
    rs.corner = { x: hasW ? bb.x1 : bb.x2, y: hasN ? bb.y1 : bb.y2 };
    rs.axes = { x: hasW || hasE, y: hasN || hasS };
    return rs;
}

function applyResize(s, rs, pos) {
    const { orig, grab } = rs;
    const dx = pos.x - grab.x, dy = pos.y - grab.y;

    if (rs.kind === 'from' || rs.kind === 'to') {
        s[rs.kind] = { x: orig[rs.kind].x + dx, y: orig[rs.kind].y + dy };
        return;
    }

    const { anchor, corner, axes } = rs;
    const w0 = corner.x - anchor.x, h0 = corner.y - anchor.y;

    if (s.type === 'text') {
        // uniform scale from the corner's distance so the font stays proportional
        const d0 = Math.hypot(w0, h0);
        let k = d0 < 1e-6 ? 1 : Math.hypot(w0 + dx, h0 + dy) / d0;
        s.size = Math.min(200, Math.max(9, orig.size * k));
        k = s.size / orig.size;
        s.at = { x: anchor.x + (orig.at.x - anchor.x) * k, y: anchor.y + (orig.at.y - anchor.y) * k };
        return;
    }

    const sx = axes.x && Math.abs(w0) > 1e-6 ? (w0 + dx) / w0 : 1;
    const sy = axes.y && Math.abs(h0) > 1e-6 ? (h0 + dy) / h0 : 1;
    const scale = p => ({ x: anchor.x + (p.x - anchor.x) * sx, y: anchor.y + (p.y - anchor.y) * sy });
    if (s.type === 'pen') s.points = orig.points.map(scale);
    else { s.from = scale(orig.from); s.to = scale(orig.to); }
}

/* ── Drawing ──────────────────────────────────────────────────────── */

function drawHalo(ctx, s, strong) {
    const c = ctx.sketchCtx;
    c.save();
    c.strokeStyle = strong ? 'rgba(191,64,52,0.85)' : 'rgba(191,64,52,0.35)';
    c.lineWidth = 1.2;
    if (s.type === 'line' || s.type === 'arrow') {
        if (!strong) {
            // a faint echo of the line itself, since a box around a diagonal says little
            const a = w2s(ctx, s.from), b = w2s(ctx, s.to);
            c.lineWidth = 6; c.lineCap = 'round';
            c.strokeStyle = 'rgba(191,64,52,0.18)';
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
    } else {
        const box = haloBox(ctx, s);
        c.setLineDash([5, 4]);
        c.strokeRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);
        c.setLineDash([]);
    }
    if (strong) {
        const sp = spoolPoint(ctx, s);
        c.fillStyle = '#fff';
        c.strokeStyle = ctx.sketch.thread;
        c.lineWidth = 2;
        c.beginPath(); c.arc(sp.x, sp.y, SPOOL_R, 0, Math.PI * 2); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(191,64,52,0.85)';
        c.lineWidth = 1.2;
        handlesFor(ctx, s).forEach(h => {
            if (h.kind === 'from' || h.kind === 'to') {
                c.beginPath(); c.arc(h.x, h.y, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
            } else {
                c.fillRect(h.x - 3.5, h.y - 3.5, 7, 7);
                c.strokeRect(h.x - 3.5, h.y - 3.5, 7, 7);
            }
        });
    }
    c.restore();
}

export function drawStroke(ctx, s) {
    const sketchCtx = ctx.sketchCtx;
    sketchCtx.strokeStyle = ctx.sketch.ink;
    sketchCtx.lineWidth = Math.max(1, 2 * ctx.viewport.zoom);
    sketchCtx.lineCap = 'round';
    sketchCtx.lineJoin = 'round';

    if (s.type === 'pen' && s.points && s.points.length > 1) {
        sketchCtx.beginPath();
        const p0 = w2s(ctx, s.points[0]);
        sketchCtx.moveTo(p0.x, p0.y);
        for (let i = 1; i < s.points.length; i++) {
            const p = w2s(ctx, s.points[i]);
            sketchCtx.lineTo(p.x, p.y);
        }
        sketchCtx.stroke();
    } else if ((s.type === 'arrow' || s.type === 'line') && s.from && s.to) {
        const a = w2s(ctx, s.from), b = w2s(ctx, s.to);
        sketchCtx.beginPath();
        sketchCtx.moveTo(a.x, a.y);
        sketchCtx.lineTo(b.x, b.y);
        sketchCtx.stroke();
        if (s.type === 'arrow') {
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            const len = 10 * Math.max(0.6, ctx.viewport.zoom);
            sketchCtx.beginPath();
            sketchCtx.moveTo(b.x, b.y);
            sketchCtx.lineTo(b.x - len * Math.cos(ang - 0.45), b.y - len * Math.sin(ang - 0.45));
            sketchCtx.moveTo(b.x, b.y);
            sketchCtx.lineTo(b.x - len * Math.cos(ang + 0.45), b.y - len * Math.sin(ang + 0.45));
            sketchCtx.stroke();
        }
    } else if (s.type === 'rect' && s.from && s.to) {
        const a = w2s(ctx, s.from), b = w2s(ctx, s.to);
        sketchCtx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else if (s.type === 'tri' && s.from && s.to) {
        const pts = triPoints(s).map(p => w2s(ctx, p));
        sketchCtx.beginPath();
        sketchCtx.moveTo(pts[0].x, pts[0].y);
        sketchCtx.lineTo(pts[1].x, pts[1].y);
        sketchCtx.lineTo(pts[2].x, pts[2].y);
        sketchCtx.closePath();
        sketchCtx.stroke();
    }

    // label
    if (s.text) {
        const a = w2s(ctx, strokeAnchor(s));
        sketchCtx.font = `${labelSize(s) * ctx.viewport.zoom}px Caveat, cursive`;
        sketchCtx.textAlign = 'center';
        sketchCtx.textBaseline = 'middle';
        sketchCtx.fillStyle = ctx.sketch.ink;
        sketchCtx.fillText(s.text, a.x, a.y);
    }

    if (s.id && s.id === ctx.sketch.selectedId) drawHalo(ctx, s, true);
    else if (s.id && s.id === ctx.sketch.hoverId) drawHalo(ctx, s, false);
}

function drawEraserRing(ctx) {
    const p = ctx.sketch.pointer;
    if (!p) return;
    const c = ctx.sketchCtx;
    c.save();
    c.strokeStyle = 'rgba(191,64,52,0.7)';
    c.fillStyle = 'rgba(191,64,52,0.08)';
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(p.x, p.y, ERASER_R, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
}

export function redrawSketch(ctx) {
    const css = getComputedStyle(ctx.dom.root);
    ctx.sketch.ink = css.getPropertyValue('--text').trim() || '#1A1A1A';
    ctx.sketch.thread = css.getPropertyValue('--thread').trim() || '#BF4034';
    const dpr = window.devicePixelRatio || 1;
    ctx.sketchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.sketchCtx.clearRect(0, 0, ctx.dom.sketchCanvas.width / dpr, ctx.dom.sketchCanvas.height / dpr);
    (ctx.state.strokes || []).forEach(s => drawStroke(ctx, s));
    if (ctx.sketch.tool === 'eraser') drawEraserRing(ctx);
}

/* ── Erase / delete ───────────────────────────────────────────────── */

export function eraseAt(ctx, wx, wy) {
    const r = ERASER_R / ctx.viewport.zoom;
    const before = ctx.state.strokes.length;
    const gone = ctx.state.strokes.filter(s => strokeHit(s, wx, wy, r));
    ctx.state.strokes = ctx.state.strokes.filter(s => !strokeHit(s, wx, wy, r));
    if (ctx.state.strokes.length !== before) {
        gone.forEach(s => pruneThreads(ctx, s.id));
        if (!ctx.state.strokes.some(s => s.id === ctx.sketch.selectedId)) ctx.sketch.selectedId = null;
        redrawSketch(ctx);
        saveStateDebounced(ctx);
    }
}

export function deleteSelectedStroke(ctx) {
    if (!ctx.sketch.selectedId) return false;
    pushUndo(ctx);
    ctx.state.strokes = ctx.state.strokes.filter(s => s.id !== ctx.sketch.selectedId);
    pruneThreads(ctx, ctx.sketch.selectedId);
    selectStroke(ctx, null);
    redrawSketch(ctx);
    saveState(ctx);
    return true;
}

/* ── Label editing ────────────────────────────────────────────────── */

// Shared floating input. onCommit receives the trimmed value, or null on cancel.
function spawnTextInput(ctx, screen, value, placeholder, fontPx, onCommit) {
    const prev = document.querySelector('.sketch-label-input');
    if (prev) prev._commit ? prev._commit(false) : prev.remove();

    const input = document.createElement('input');
    input.className = 'sketch-label-input';
    input.value = value;
    input.placeholder = placeholder;
    input.style.left = screen.x + 'px';
    input.style.top = screen.y + 'px';
    input.style.fontSize = Math.max(12, fontPx) + 'px';
    ctx.dom.root.appendChild(input);
    input.focus();
    // editing existing text continues from its end; a fresh one is just empty
    input.setSelectionRange(input.value.length, input.value.length);

    let done = false;
    const commit = (cancel) => {
        if (done) return; done = true;
        const value = input.value.trim();
        input.disabled = true;      // no further input; stays in the DOM until the key event is over
        input.style.display = 'none';
        setTimeout(() => input.remove(), 0);
        onCommit(cancel ? null : value);
        redrawSketch(ctx);
    };
    input._commit = commit;
    input.addEventListener('blur', () => commit(false));
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            commit(e.key === 'Escape');
        }
    });
}

export function openLabelEditor(ctx, stroke) {
    const fontPx = labelSize(stroke) * ctx.viewport.zoom;
    spawnTextInput(ctx, w2s(ctx, strokeAnchor(stroke)), stroke.text || '', 'label…', fontPx, (v) => {
        if (v === null || v === (stroke.text || '')) return;
        pushUndo(ctx);
        if (v) stroke.text = v;
        else if (stroke.type === 'text') {
            // a text stroke with no text is nothing at all
            ctx.state.strokes = ctx.state.strokes.filter(s => s.id !== stroke.id);
            pruneThreads(ctx, stroke.id);
            if (ctx.sketch.selectedId === stroke.id) selectStroke(ctx, null);
        }
        else delete stroke.text;
        saveState(ctx);
    });
}

export function openTextEditor(ctx, pos) {
    spawnTextInput(ctx, w2s(ctx, pos), '', 'write…', LABEL_SIZE * ctx.viewport.zoom, (v) => {
        if (!v) return;
        pushUndo(ctx);
        const s = { id: uid(), type: 'text', at: { x: pos.x, y: pos.y }, text: v, size: LABEL_SIZE };
        ctx.state.strokes.push(s);
        saveState(ctx);
        // hand the new text straight to the select tool so it can be moved or resized
        setSketchTool(ctx, 'select');
        selectStroke(ctx, s.id);
        redrawSketch(ctx);
    });
}

/* ── Mouse handlers ───────────────────────────────────────────────── */

function setCursor(ctx, cursor) {
    const el = ctx.sketch.tool ? ctx.dom.sketchCanvas : ctx.dom.root;
    el.style.cursor = cursor || '';
}

// Select-tool behaviour on the bare canvas, with no sketch tool active: a stroke
// (or a handle of the selected one) under the cursor is grabbed directly.
// Returns true when the press was consumed, so the caller skips panning.
export function onIdleMouseDown(ctx, e) {
    const sk = ctx.sketch;
    if (sk.tool || e.button !== 0 || overUi(e)) return false;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);

    const sel = strokeById(ctx, sk.selectedId);
    const h = sel ? handleNear(ctx, sel, e.clientX, e.clientY) : null;
    if (h) {
        pushUndo(ctx);
        sk.resizeSel = startResize(sel, h.kind, pos);
        return true;
    }
    const s = strokeAt(ctx, pos.x, pos.y);
    if (!s) {
        deselectStroke(ctx);
        return false;
    }
    selectStroke(ctx, s.id);
    if (e.detail === 2) {
        e.preventDefault();     // keep focus on the label input
        redrawSketch(ctx);
        openLabelEditor(ctx, s);
        return true;
    }
    pushUndo(ctx);
    sk.dragSel = { id: s.id, last: pos, moved: false };
    redrawSketch(ctx);
    return true;
}

export function onSketchMouseDown(ctx, e) {
    const sk = ctx.sketch;
    if (!sk.tool) return;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);

    if (sk.tool === 'select') {
        if (spoolAt(ctx, e)) return;    // the page's own handler pulls the thread
        // a handle on the current selection wins over picking a new stroke
        const sel = strokeById(ctx, sk.selectedId);
        const h = sel ? handleNear(ctx, sel, e.clientX, e.clientY) : null;
        if (h) {
            pushUndo(ctx);
            sk.resizeSel = startResize(sel, h.kind, pos);
            return;
        }
        const s = strokeAt(ctx, pos.x, pos.y);
        selectStroke(ctx, s ? s.id : null);
        if (s) {
            pushUndo(ctx);
            sk.dragSel = { id: s.id, last: pos, moved: false };
        } else {
            // empty space: pan, the way the bare canvas does
            sk.pan = { x: e.clientX - ctx.viewport.x, y: e.clientY - ctx.viewport.y };
            setCursor(ctx, 'grabbing');
        }
        redrawSketch(ctx);
        return;
    }

    if (sk.tool === 'text') {
        e.preventDefault();     // keep focus on the input we are about to spawn
        const existing = strokeAt(ctx, pos.x, pos.y);
        if (existing && existing.type === 'text') openLabelEditor(ctx, existing);
        else openTextEditor(ctx, pos);
        return;
    }

    if (sk.tool === 'eraser') {
        sk.isDrawing = true;
        eraseAt(ctx, pos.x, pos.y);
        return;
    }
    sk.isDrawing = true;
    if (sk.tool === 'pen') sk.currentStroke = [pos];
    else sk.shapeStart = pos;
}

export function onSketchMouseMove(ctx, e) {
    const sk = ctx.sketch;
    if (ctx.linkingFrom) return;    // a thread is being pulled; the page handles that
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);

    // Button released off-window: finish up rather than dragging on without it.
    if (e.buttons === 0 && (sk.dragSel || sk.resizeSel || sk.pan || sk.isDrawing)) {
        onSketchMouseUp(ctx, e);
        return;
    }

    if (sk.tool === 'select' || !sk.tool) {
        if (sk.resizeSel) {
            const s = strokeById(ctx, sk.resizeSel.id);
            if (s) {
                applyResize(s, sk.resizeSel, pos);
                sk.resizeSel.moved = true;
                redrawSketch(ctx);
                if (strokeHasThread(ctx, s.id)) renderThreads(ctx);
            }
            return;
        }
        if (sk.dragSel) {
            const s = strokeById(ctx, sk.dragSel.id);
            if (s) {
                translateStroke(s, pos.x - sk.dragSel.last.x, pos.y - sk.dragSel.last.y);
                sk.dragSel.last = pos;
                sk.dragSel.moved = true;
                redrawSketch(ctx);
                if (strokeHasThread(ctx, s.id)) renderThreads(ctx);
            }
            return;
        }
        if (sk.pan) {
            ctx.viewport.x = e.clientX - sk.pan.x;
            ctx.viewport.y = e.clientY - sk.pan.y;
            applyViewport(ctx);
            redrawSketch(ctx);
            return;
        }
        // hover feedback; on the bare canvas only when nothing else is going on
        if (!sk.tool && (e.buttons !== 0 || overUi(e))) {
            if (sk.hoverId) { sk.hoverId = null; redrawSketch(ctx); }
            setCursor(ctx, '');
            return;
        }
        if (spoolAt(ctx, e)) { setCursor(ctx, 'crosshair'); return; }
        const sel = strokeById(ctx, sk.selectedId);
        const h = sel ? handleNear(ctx, sel, e.clientX, e.clientY) : null;
        const over = h ? null : strokeAt(ctx, pos.x, pos.y);
        const hoverId = over ? over.id : null;
        setCursor(ctx, h ? HANDLE_CURSOR[h.kind] : (over ? 'move' : ''));
        if (hoverId !== sk.hoverId) { sk.hoverId = hoverId; redrawSketch(ctx); }
        return;
    }

    if (sk.tool === 'eraser') {
        sk.pointer = { x: e.clientX, y: e.clientY };
        if (sk.isDrawing) eraseAt(ctx, pos.x, pos.y);
        redrawSketch(ctx);
        return;
    }

    if (!sk.isDrawing) return;
    if (sk.tool === 'pen') {
        sk.currentStroke.push(pos);
        redrawSketch(ctx);
        drawStroke(ctx, { type: 'pen', points: sk.currentStroke });
    } else if (sk.shapeStart) {
        redrawSketch(ctx);
        drawStroke(ctx, { type: sk.tool, from: sk.shapeStart, to: pos });
    }
}

export function onSketchMouseUp(ctx, e) {
    const sk = ctx.sketch;

    if (sk.tool === 'select' || !sk.tool) {
        if (sk.resizeSel) {
            if (sk.resizeSel.moved) saveState(ctx);
            else ctx.undoStack.pop();   // handle click without movement: discard the snapshot
            sk.resizeSel = null;
        } else if (sk.dragSel) {
            if (sk.dragSel.moved) saveState(ctx);
            else ctx.undoStack.pop();   // selection click without movement: discard the snapshot
            sk.dragSel = null;
        } else if (sk.pan) {
            sk.pan = null;
            setCursor(ctx, '');
            saveStateDebounced(ctx);
        }
        return;
    }

    if (!sk.isDrawing) return;
    sk.isDrawing = false;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);
    if (sk.tool === 'pen' && sk.currentStroke.length > 1) {
        pushUndo(ctx);
        ctx.state.strokes.push({ id: uid(), type: 'pen', points: sk.currentStroke });
        saveState(ctx);
    } else if (SHAPE_TOOLS.includes(sk.tool) && sk.shapeStart) {
        if (Math.hypot(pos.x - sk.shapeStart.x, pos.y - sk.shapeStart.y) > 6) {
            pushUndo(ctx);
            const s = { id: uid(), type: sk.tool, from: sk.shapeStart, to: pos };
            ctx.state.strokes.push(s);
            saveState(ctx);
            // a finished shape lands selected, so it can be moved or resized right away
            setSketchTool(ctx, 'select');
            selectStroke(ctx, s.id);
        }
    }
    sk.currentStroke = [];
    sk.shapeStart = null;
    redrawSketch(ctx);
}

export function onSketchDblClick(ctx, e) {
    if (ctx.sketch.tool !== 'select') return;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);
    const s = strokeAt(ctx, pos.x, pos.y);
    if (s) {
        selectStroke(ctx, s.id);
        redrawSketch(ctx);
        openLabelEditor(ctx, s);
    } else {
        ctx.sketch.pan = null;
        setCursor(ctx, '');
        openTextEditor(ctx, pos);
    }
}
