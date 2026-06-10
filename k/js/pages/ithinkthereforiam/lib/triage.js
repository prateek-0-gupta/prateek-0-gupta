// Triage workflow — one thought at a time

import { renderMarkdown, showToast } from './utils.js';
import { pushUndo, saveState } from './state.js';
import { softDelete, renderCards } from './cards.js';
import { renderKanbanBoard, stackPositionFor, assignColumn } from './kanban.js';

export function openTriage(ctx) {
    ctx.triageQueue = ctx.state.cards
        .filter(c => !c.column && !c.timeSlot)
        .sort((a, b) => a.created - b.created)
        .map(c => c.id);
    if (ctx.triageQueue.length === 0) {
        showToast('nothing to sort. all thoughts have a home');
        return;
    }
    ctx.dom.triageEl.classList.add('open');
    showTriageCard(ctx);
}

export function closeTriage(ctx) {
    ctx.dom.triageEl.classList.remove('open');
    ctx.triageQueue = [];
}

export function showTriageCard(ctx) {
    const id = ctx.triageQueue[0];
    const card = ctx.state.cards.find(c => c.id === id);
    if (!card) { closeTriage(ctx); return; }
    const cardEl = document.getElementById('triage-card-el');
    cardEl.className = `triage-card ${card.color}`;
    cardEl.innerHTML = renderMarkdown(card.text || 'untitled thought');
    document.getElementById('triage-progress').textContent =
        `${ctx.triageQueue.length} thought${ctx.triageQueue.length === 1 ? '' : 's'} left to sort`;
}

export function triageAction(ctx, action) {
    const id = ctx.triageQueue.shift();
    const card = ctx.state.cards.find(c => c.id === id);
    if (card) {
        if (action === 'trash') {
            softDelete(ctx, id);
        } else if (action !== 'skip') {
            pushUndo(ctx);
            if (!ctx.state.boardVisible) {
                ctx.state.boardVisible = true;
                renderKanbanBoard(ctx);
            }
            const pos = stackPositionFor(ctx, action);
            card.x = pos.x; card.y = pos.y;
            assignColumn(ctx, card, action);
            renderCards(ctx);
            saveState(ctx);
        }
    }
    if (ctx.triageQueue.length === 0) {
        showToast('all sorted \u2713');
        closeTriage(ctx);
        renderCards(ctx);
    } else {
        showTriageCard(ctx);
    }
}
