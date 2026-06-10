// Sketch/drawing tools

import { uid } from './utils.js';
import { w2s, screenToCanvas } from './viewport.js';
import { pushUndo, saveState, saveStateDebounced } from './state.js';

export function initSketchState() {
    return {
        tool: null,         // null | pen | arrow | rect | eraser
        isDrawing: false,
        currentStroke: [],
        shapeStart: null
    };
}

export function setSketchTool(ctx, tool) {
    ctx.sketch.tool = (ctx.sketch.tool === tool) ? null : tool;
    const palette = document.getElementById('sketch-palette');
    palette.classList.toggle('open', ctx.sketch.tool !== null || palette.classList.contains('open'));
    palette.querySelectorAll('[data-tool]').forEach(b =>
        b.classList.toggle('active', b.dataset.tool === ctx.sketch.tool));
    ctx.dom.sketchCanvas.classList.toggle('active', ctx.sketch.tool !== null);
    document.getElementById('btn-sketch').classList.toggle('active', ctx.sketch.tool !== null);
}

export function toggleSketchPalette(ctx) {
    const palette = document.getElementById('sketch-palette');
    const opening = !palette.classList.contains('open');
    palette.classList.toggle('open', opening);
    if (opening && !ctx.sketch.tool) setSketchTool(ctx, 'pen');
    if (!opening) {
        ctx.sketch.tool = null;
        ctx.dom.sketchCanvas.classList.remove('active');
        document.getElementById('btn-sketch').classList.remove('active');
    }
}

export function drawStroke(ctx, s) {
    const sketchCtx = ctx.sketchCtx;
    sketchCtx.strokeStyle = '#1A1A1A';
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
    } else if (s.type === 'arrow' && s.from && s.to) {
        const a = w2s(ctx, s.from), b = w2s(ctx, s.to);
        sketchCtx.beginPath();
        sketchCtx.moveTo(a.x, a.y);
        sketchCtx.lineTo(b.x, b.y);
        sketchCtx.stroke();
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const len = 10 * Math.max(0.6, ctx.viewport.zoom);
        sketchCtx.beginPath();
        sketchCtx.moveTo(b.x, b.y);
        sketchCtx.lineTo(b.x - len * Math.cos(ang - 0.45), b.y - len * Math.sin(ang - 0.45));
        sketchCtx.moveTo(b.x, b.y);
        sketchCtx.lineTo(b.x - len * Math.cos(ang + 0.45), b.y - len * Math.sin(ang + 0.45));
        sketchCtx.stroke();
    } else if (s.type === 'rect' && s.from && s.to) {
        const a = w2s(ctx, s.from), b = w2s(ctx, s.to);
        sketchCtx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    }
}

export function redrawSketch(ctx) {
    ctx.sketchCtx.clearRect(0, 0, ctx.dom.sketchCanvas.width, ctx.dom.sketchCanvas.height);
    (ctx.state.strokes || []).forEach(s => drawStroke(ctx, s));
}

export function eraseAt(ctx, wx, wy) {
    const r = 14 / ctx.viewport.zoom;
    const hit = s => {
        if (s.type === 'pen') return (s.points || []).some(p => Math.hypot(p.x - wx, p.y - wy) < r);
        if (s.from && s.to) {
            const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y;
            const t = Math.max(0, Math.min(1, ((wx - s.from.x) * dx + (wy - s.from.y) * dy) / (dx * dx + dy * dy || 1)));
            const px = s.from.x + t * dx, py = s.from.y + t * dy;
            if (s.type === 'arrow') return Math.hypot(px - wx, py - wy) < r;
            const near = (x, y) => Math.hypot(x - wx, y - wy) < r * 2;
            return Math.hypot(px - wx, py - wy) < r || near(s.from.x, s.to.y) || near(s.to.x, s.from.y);
        }
        return false;
    };
    const before = ctx.state.strokes.length;
    ctx.state.strokes = ctx.state.strokes.filter(s => !hit(s));
    if (ctx.state.strokes.length !== before) {
        redrawSketch(ctx);
        saveStateDebounced(ctx);
    }
}

export function onSketchMouseDown(ctx, e) {
    if (!ctx.sketch.tool) return;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);
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
    if (!ctx.sketch.isDrawing) return;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);
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
    if (!ctx.sketch.isDrawing) return;
    ctx.sketch.isDrawing = false;
    const pos = screenToCanvas(ctx, e.clientX, e.clientY);
    if (ctx.sketch.tool === 'pen' && ctx.sketch.currentStroke.length > 1) {
        pushUndo(ctx);
        ctx.state.strokes.push({ id: uid(), type: 'pen', points: ctx.sketch.currentStroke });
        saveState(ctx);
    } else if ((ctx.sketch.tool === 'arrow' || ctx.sketch.tool === 'rect') && ctx.sketch.shapeStart) {
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
