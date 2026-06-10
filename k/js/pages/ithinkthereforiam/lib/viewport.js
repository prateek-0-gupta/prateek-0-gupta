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

export function resizeSketch(ctx) {
    ctx.dom.sketchCanvas.width = window.innerWidth;
    ctx.dom.sketchCanvas.height = window.innerHeight;
}
