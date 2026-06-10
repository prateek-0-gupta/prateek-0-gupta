// Card creation, deletion, rendering

import { COLORS, COLOR_HEX, COLOR_NAMES, SLOTS, LONGFORM_AT } from './constants.js';
import { uid, escapeHtml, renderMarkdown, placeCaretEnd } from './utils.js';
import { pushUndo, saveState } from './state.js';
import { screenToCanvas } from './viewport.js';

export function createCard(ctx, x, y, text = '') {
    pushUndo(ctx);
    const card = {
        id: uid(), x, y, text,
        color: COLORS[ctx.colorCursor % COLORS.length],
        column: null, timeSlot: null, created: Date.now()
    };
    ctx.colorCursor++;
    ctx.state.cards.push(card);
    renderCards(ctx);
    saveState(ctx);

    const el = ctx.dom.surface.querySelector(`.canvas-card[data-id="${card.id}"]`);
    if (el) {
        el.classList.add('card-plop');
        el.addEventListener('animationend', () => el.classList.remove('card-plop'), { once: true });
    }
    setTimeout(() => {
        const txt = ctx.dom.surface.querySelector(`.card-text[data-card-id="${card.id}"]`);
        if (txt) {
            txt.textContent = card.text;
            txt.focus();
            placeCaretEnd(txt);
        }
    }, 30);
    return card;
}

export function softDelete(ctx, id) {
    pushUndo(ctx);
    const card = ctx.state.cards.find(c => c.id === id);
    if (!card) return;
    ctx.state.cards = ctx.state.cards.filter(c => c.id !== id);
    ctx.state.trash.unshift(card);
    if (ctx.state.trash.length > 100) ctx.state.trash.pop();
    if (ctx.selectedCardId === id) ctx.selectedCardId = null;
    renderCards(ctx);
    saveState(ctx);
}

export function restoreCard(ctx, id) {
    const card = ctx.state.trash.find(c => c.id === id);
    if (!card) return;
    ctx.state.trash = ctx.state.trash.filter(c => c.id !== id);
    const pos = screenToCanvas(ctx, window.innerWidth / 2, window.innerHeight / 2);
    card.x = pos.x - 90;
    card.y = pos.y - 30;
    ctx.state.cards.push(card);
    renderCards(ctx);
    saveState(ctx);
}

export function renderCards(ctx) {
    const { surface, emptyHint } = ctx.dom;
    surface.querySelectorAll('.canvas-card').forEach(el => el.remove());

    ctx.state.cards.forEach(card => {
        const el = document.createElement('div');
        el.className = `canvas-card ${card.color || 'card-yellow'}`;
        if ((card.text || '').length > LONGFORM_AT) el.classList.add('longform');
        el.dataset.id = card.id;
        el.style.left = card.x + 'px';
        el.style.top = card.y + 'px';

        if (ctx.focusMode && ctx.selectedCardId && card.id !== ctx.selectedCardId) el.classList.add('dimmed');
        if (card.id === ctx.selectedCardId) {
            el.classList.add('selected');
            if (ctx.focusMode) el.classList.add('focus-highlight');
        }

        const slot = SLOTS.find(s => s.id === card.timeSlot);
        el.innerHTML = `
            ${slot ? `<div class="card-slot-badge">${slot.id === 'top3' ? 'top 3' : slot.title}</div>` : ''}
            <button class="card-delete" data-delete="${card.id}" title="let it go">&times;</button>
            <div class="card-text" contenteditable="true" data-card-id="${card.id}">${renderMarkdown(card.text)}</div>
            <div class="card-color-picker">
                ${COLORS.map(c => `<div class="card-color-dot" style="background:${COLOR_HEX[c]}" title="${COLOR_NAMES[c]}" data-color="${c}" data-card="${card.id}"></div>`).join('')}
            </div>
        `;
        surface.appendChild(el);
    });

    emptyHint.classList.toggle('hidden', ctx.state.cards.length > 0);
    renderTrash(ctx);
}

export function renderTrash(ctx) {
    const count = document.getElementById('trash-count');
    const list = document.getElementById('trash-list');
    if (!count || !list) return;
    count.textContent = ctx.state.trash.length;
    list.innerHTML = ctx.state.trash.length === 0
        ? '<div class="trash-empty">nothing here. thoughts you let go land softly</div>'
        : ctx.state.trash.map(c => `
            <div class="trash-item">
                <span>${escapeHtml((c.text || 'untitled').slice(0, 40))}</span>
                <button data-restore="${c.id}">bring back</button>
            </div>`).join('');
}
