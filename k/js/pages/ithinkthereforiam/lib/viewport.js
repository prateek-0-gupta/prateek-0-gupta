// Viewport transforms and navigation

export function applyViewport(ctx) {
    ctx.dom.surface.style.transform =
        `translate(${ctx.viewport.x}px, ${ctx.viewport.y}px) scale(${ctx.viewport.zoom})`;
}

export function screenToCanvas(ctx, sx, sy) {
    return {
        x: (sx - ctx.viewport.x) / ctx.viewport.zoom,
        y: (sy - ctx.viewport.y) / ctx.viewport.zoom
    };
}

// World-to-screen coordinate transform
export function w2s(ctx, p) {
    return {
        x: p.x * ctx.viewport.zoom + ctx.viewport.x,
        y: p.y * ctx.viewport.zoom + ctx.viewport.y
    };
}

// Backing store scaled to the device pixel ratio so strokes stay crisp on
// retina screens; drawing code keeps working in CSS pixels via the transform.
export function resizeSketch(ctx) {
    const dpr = window.devicePixelRatio || 1;
    const c = ctx.dom.sketchCanvas;
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
    c.style.width = window.innerWidth + 'px';
    c.style.height = window.innerHeight + 'px';
    ctx.sketchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
