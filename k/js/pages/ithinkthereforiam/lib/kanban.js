// Kanban board logic

import { COLUMNS, KB_COL_W, KB_H } from './constants.js';
import { applyViewport } from './viewport.js';
import { saveState } from './state.js';

export function renderKanbanBoard(ctx) {
    const { kanbanBoard } = ctx.dom;
    kanbanBoard.style.left = ctx.state.boardOrigin.x + 'px';
    kanbanBoard.style.top = ctx.state.boardOrigin.y + 'px';
    kanbanBoard.classList.toggle('visible', ctx.state.boardVisible);
    kanbanBoard.innerHTML = COLUMNS.map(col => `
        <div class="kb-col" data-col="${col}">
            <div class="kb-header">${col === 'Done' ? 'things I did' : col} <span class="count">0</span></div>
        </div>
    `).join('');
    updateKanbanCounts(ctx);
}

export function updateKanbanCounts(ctx) {
    ctx.dom.kanbanBoard.querySelectorAll('.kb-col').forEach(colEl => {
        const count = ctx.state.cards.filter(c => c.column === colEl.dataset.col).length;
        const span = colEl.querySelector('.count');
        if (span) span.textContent = count;
    });
}

export function columnAtCanvasPoint(ctx, x, y) {
    if (!ctx.state.boardVisible) return null;
    const bx = ctx.state.boardOrigin.x, by = ctx.state.boardOrigin.y;
    if (y < by || y > by + KB_H) return null;
    const idx = Math.floor((x - bx) / KB_COL_W);
    if (idx < 0 || idx > 3) return null;
    if (x - bx - idx * KB_COL_W > 260) return null;
    return COLUMNS[idx];
}

export function stackPositionFor(ctx, col) {
    const idx = COLUMNS.indexOf(col);
    const n = ctx.state.cards.filter(c => c.column === col).length;
    return {
        x: ctx.state.boardOrigin.x + idx * KB_COL_W + 24,
        y: ctx.state.boardOrigin.y + 64 + n * 52
    };
}

export function toggleBoard(ctx, redrawSketch) {
    ctx.state.boardVisible = !ctx.state.boardVisible;
    if (ctx.state.boardVisible) {
        const sx = ctx.state.boardOrigin.x * ctx.viewport.zoom + ctx.viewport.x;
        const sy = ctx.state.boardOrigin.y * ctx.viewport.zoom + ctx.viewport.y;
        if (sx < 0 || sy < 0 || sx > window.innerWidth - 200 || sy > window.innerHeight - 200) {
            ctx.viewport.x = -(ctx.state.boardOrigin.x - 80) * ctx.viewport.zoom;
            ctx.viewport.y = -(ctx.state.boardOrigin.y - 80) * ctx.viewport.zoom;
            applyViewport(ctx);
            redrawSketch(ctx);
        }
    }
    renderKanbanBoard(ctx);
    saveState(ctx);
}

export function assignColumn(ctx, card, col) {
    const wasDone = card.column === 'Done';
    card.column = col;
    if (col === 'Done' && !wasDone) celebrateDone(ctx, card);
    updateKanbanCounts(ctx);
}

export function celebrateDone(ctx, card) {
    const spark = document.createElement('div');
    spark.className = 'done-spark';
    spark.textContent = '\u2728';
    spark.style.left = (card.x + 70) + 'px';
    spark.style.top = (card.y - 18) + 'px';
    ctx.dom.surface.appendChild(spark);
    setTimeout(() => spark.remove(), 700);
}
