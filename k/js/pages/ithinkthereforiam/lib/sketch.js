// Sketch/drawing tools

import { uid } from './utils.js';
import { w2s, screenToCanvas } from './viewport.js';
import { pushUndo, saveState, saveStateDebounced } from './state.js';

export function initSketchState() {
    return {
        tool: null,         // null | select | pen | line | arrow | rect | tri | eraser
        isDrawing: false,
        currentStroke: [],
        shapeStart: null,
        selectedId: null,   // selected stroke (select tool)
        dragSel: null,      // { id, last:{x,y}, moved } while moving a stroke
        ink: '#1A1A1A',
    };
}

export function setSketchTool(ctx, tool) {
    ctx.sketch.tool = (ctx.sketch.tool === tool) ? null : tool;
    if (ctx.sketch.tool !== 'select') ctx.sketch.selectedId = null;
    const palette = document.getElementById('sketch-palette');
    palette.classList.toggle('open', ctx.sketch.tool !== null || palette.classList.contains('open'));
    palette.querySelectorAll('[data-tool]').forEach(b =>
        b.classList.toggle('active', b.dataset.tool === ctx.sketch.tool));
    ctx.dom.sketchCanvas.classList.toggle('active', ctx.sketch.tool !== null);
    ctx.dom.sketchCanvas.classList.toggle('tool-select', ctx.sketch.tool === 'select');
    ctx.dom.sketchCanvas.style.cursor = '';
    document.getElementById('btn-sketch').classList.toggle('active', ctx.sketch.tool !== null);
    redrawSketch(ctx);
}

export function toggleSketchPalette(ctx) {
    const palette = document.getElementById('sketch-palette');
    const opening = !palette.classList.contains('open');
    palette.classList.toggle('open', opening);
    if (opening && !ctx.sketch.tool) setSketchTool(ctx, 'pen');
    if (!opening) {
        ctx.sketch.tool = null;
        ctx.sketch.selectedId = null;
        ctx.dom.sketchCanvas.classList.remove('active', 'tool-select');
        document.getElementById('btn-sketch').classList.remove('active');
        redrawSketch(ctx);
    }
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

export function strokeBBox(s) {
    let xs = [], ys = [];
    if (s.type === 'pen') { xs = s.points.map(p => p.x); ys = s.points.map(p => p.y); }
    else { xs = [s.from.x, s.to.x]; ys = [s.from.y, s.to.y]; }
    return {
        x1: Math.min(...xs), y1: Math.min(...ys),
        x2: Math.max(...xs), y2: Math.max(...ys),
    };
}

function strokeAnchor(s) {
    const b = strokeBBox(s);
    return { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
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
    if (!s.from || !s.to) return false;
    if (s.type === 'arrow' || s.type === 'line') return segDist(wx, wy, s.from, s.to) < r;
    if (s.type === 'rect') {
        const b = strokeBBox(s);
        if (fill) return wx > b.x1 - r && wx < b.x2 + r && wy > b.y1 - r && wy < b.y2 + r;
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

export function strokeAt(ctx, wx, wy, r = null) {
    const rad = r ?? 12 / ctx.viewport.zoom;
    const strokes = ctx.state.strokes || [];
    for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        if (strokeHit(s, wx, wy, rad, true)) return s;
        // the label counts as part of the stroke too
        if (s.text) {
            const a = strokeAnchor(s);
            if (Math.abs(wx - a.x) < 8 + s.text.length * 4 && Math.abs(wy - a.y) < 14) return s;
        }
    }
    return null;
}

function translateStroke(s, dx, dy) {
    if (s.type === 'pen') s.points.forEach(p => { p.x += dx; p.y += dy; });
    else { s.from.x += dx; s.from.y += dy; s.to.x += dx; s.to.y += dy; }
}

/* ── Drawing ──────────────────────────────────────────────────────── */

export function drawStroke(ctx, s) {
    const sketchCtx = ctx.sketchCtx;
    const selected = s.id && s.id === ctx.sketch.selectedId;
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
        sketchCtx.font = `${Math.max(11, 17 * ctx.viewport.zoom)}px Caveat, cursive`;
        sketchCtx.textAlign = 'center';
        sketchCtx.textBaseline = 'middle';
        sketchCtx.fillStyle = ctx.sketch.ink;
        sketchCtx.fillText(s.text, a.x, a.y);
    }

    // selection halo: dashed bounding box
    if (selected) {
        const bb = strokeBBox(s);
        const a = w2s(ctx, { x: bb.x1, y: bb.y1 }), b = w2s(ctx, { x: bb.x2, y: bb.y2 });
        sketchCtx.save();
        sketchCtx.strokeStyle = 'rgba(191,64,52,0.8)';
        sketchCtx.lineWidth = 1.2;
        sketchCtx.setLineDash([5, 4]);
        sketchCtx.strokeRect(a.x - 8, a.y - 8, (b.x - a.x) + 16, (b.y - a.y) + 16);
        sketchCtx.restore();
    }
}

export function redrawSketch(ctx) {
    ctx.sketch.ink = getComputedStyle(ctx.dom.root).getPropertyValue('--text').trim() || '#1A1A1A';
    ctx.sketchCtx.clearRect(0, 0, ctx.dom.sketchCanvas.width, ctx.dom.sketchCanvas.height);
    (ctx.state.strokes || []).forEach(s => drawStroke(ctx, s));
}

/* ── Erase / delete ───────────────────────────────────────────────── */

export function eraseAt(ctx, wx, wy) {
    const r = 14 / ctx.viewport.zoom;
    const before = ctx.state.strokes.length;
    ctx.state.strokes = ctx.state.strokes.filter(s => !strokeHit(s, wx, wy, r));
    if (ctx.state.strokes.length !== before) {
        if (!ctx.state.strokes.some(s => s.id === ctx.sketch.selectedId)) ctx.sketch.selectedId = null;
        redrawSketch(ctx);
        saveStateDebounced(ctx);
    }
}

export function deleteSelectedStroke(ctx) {
    if (!ctx.sketch.selectedId) return false;
    pushUndo(ctx);
    ctx.state.strokes = ctx.state.strokes.filter(s => s.id !== ctx.sketch.selectedId);
    ctx.sketch.selectedId = null;
    redrawSketch(ctx);
    saveState(ctx);
    return true;
}

/* ── Label editing ────────────────────────────────────────────────── */

export function openLabelEditor(ctx, stroke) {
    document.querySelector('.sketch-label-input')?.remove();
    const a = w2s(ctx, strokeAnchor(stroke));
    const input = document.createElement('input');
    input.className = 'sketch-label-input';
    input.value = stroke.text || '';
    input.placeholder = 'label…';
    input.style.left = a.x + 'px';
    input.style.top = a.y + 'px';
    ctx.dom.root.appendChild(input);
    input.focus();
    input.select();

    let done = false;
    const commit = (cancel) => {
        if (done) return; done = true;
        if (!cancel) {
            const v = input.value.trim();
            if (v !== (stroke.text || '')) {
                pushUndo(ctx);
                if (v) stroke.text = v; else delete stroke.text;
                saveState(ctx);
            }
        }
        input.remove();
        redrawSketch(ctx);
    };
    input.addEventListener('blur', () => commit(false));
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commit(false);
        if (e.key === 'Escape') commit(true);
    });
}

/* ── Mouse handlers ───────────────────────────────────────────────── */

export function onSketchMouseDown(ctx, e) {
    if (!ctx.sketch.tool) return;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);

    if (ctx.sketch.tool === 'select') {
        const s = strokeAt(ctx, pos.x, pos.y);
        ctx.sketch.selectedId = s ? s.id : null;
        if (s) {
            pushUndo(ctx);
            ctx.sketch.dragSel = { id: s.id, last: pos, moved: false };
        }
        redrawSketch(ctx);
        return;
    }

    if (ctx.sketch.tool === 'eraser') {
        ctx.sketch.isDrawing = true;
        eraseAt(ctx, pos.x, pos.y);
        return;
    }
    ctx.sketch.isDrawing = true;
    if (ctx.sketch.tool === 'pen') ctx.sketch.currentStroke = [pos];
    else ctx.sketch.shapeStart = pos;
}

export function onSketchMouseMove(ctx, e) {
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);

    if (ctx.sketch.tool === 'select' && ctx.sketch.dragSel) {
        const s = ctx.state.strokes.find(x => x.id === ctx.sketch.dragSel.id);
        if (s) {
            translateStroke(s, pos.x - ctx.sketch.dragSel.last.x, pos.y - ctx.sketch.dragSel.last.y);
            ctx.sketch.dragSel.last = pos;
            ctx.sketch.dragSel.moved = true;
            redrawSketch(ctx);
        }
        return;
    }

    // hover feedback for the select tool
    if (ctx.sketch.tool === 'select') {
        ctx.dom.sketchCanvas.style.cursor = strokeAt(ctx, pos.x, pos.y) ? 'move' : 'default';
        return;
    }

    if (!ctx.sketch.isDrawing) return;
    if (ctx.sketch.tool === 'eraser') { eraseAt(ctx, pos.x, pos.y); return; }
    if (ctx.sketch.tool === 'pen') {
        ctx.sketch.currentStroke.push(pos);
        redrawSketch(ctx);
        drawStroke(ctx, { type: 'pen', points: ctx.sketch.currentStroke });
    } else if (ctx.sketch.shapeStart) {
        redrawSketch(ctx);
        drawStroke(ctx, { type: ctx.sketch.tool, from: ctx.sketch.shapeStart, to: pos });
    }
}

export function onSketchMouseUp(ctx, e) {
    if (ctx.sketch.tool === 'select' && ctx.sketch.dragSel) {
        if (ctx.sketch.dragSel.moved) saveState(ctx);
        else ctx.undoStack.pop();   // selection click without movement: discard the snapshot
        ctx.sketch.dragSel = null;
        return;
    }

    if (!ctx.sketch.isDrawing) return;
    ctx.sketch.isDrawing = false;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);
    const SHAPES = ['arrow', 'line', 'rect', 'tri'];
    if (ctx.sketch.tool === 'pen' && ctx.sketch.currentStroke.length > 1) {
        pushUndo(ctx);
        ctx.state.strokes.push({ id: uid(), type: 'pen', points: ctx.sketch.currentStroke });
        saveState(ctx);
    } else if (SHAPES.includes(ctx.sketch.tool) && ctx.sketch.shapeStart) {
        if (Math.hypot(pos.x - ctx.sketch.shapeStart.x, pos.y - ctx.sketch.shapeStart.y) > 6) {
            pushUndo(ctx);
            ctx.state.strokes.push({ id: uid(), type: ctx.sketch.tool, from: ctx.sketch.shapeStart, to: pos });
            saveState(ctx);
        }
    }
    ctx.sketch.currentStroke = [];
    ctx.sketch.shapeStart = null;
    redrawSketch(ctx);
}

export function onSketchDblClick(ctx, e) {
    if (ctx.sketch.tool !== 'select') return;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);
    const s = strokeAt(ctx, pos.x, pos.y);
    if (s) {
        ctx.sketch.selectedId = s.id;
        redrawSketch(ctx);
        openLabelEditor(ctx, s);
    }
}
