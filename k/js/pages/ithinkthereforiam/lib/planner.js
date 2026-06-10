// Day planner

import { SLOTS } from './constants.js';
import { escapeHtml } from './utils.js';

export function renderDayPlanner(ctx) {
    const wrap = document.getElementById('planner-slots');
    if (!wrap) return;
    wrap.innerHTML = SLOTS.map(slot => {
        const slotCards = ctx.state.cards.filter(c => c.timeSlot === slot.id);
        const capLabel = slot.cap ? ` ${slotCards.length}/${slot.cap}` : '';
        return `
        <div class="time-slot ${slot.id === 'top3' ? 'slot-top3' : ''}" data-slot="${slot.id}">
            <span class="slot-title">${slot.title}${capLabel}</span>
            ${slotCards.map(c => `
                <div class="slot-card">
                    <span>${escapeHtml((c.text || 'untitled').split('\n')[0].slice(0, 48))}</span>
                    <button data-unslot="${c.id}" title="remove from plan">&times;</button>
                </div>`).join('')}
        </div>`;
    }).join('');
}

export function slotAtScreenPoint(ctx, sx, sy) {
    if (!ctx.dom.dayPlanner.classList.contains('open')) return null;
    const els = document.elementsFromPoint(sx, sy);
    const slotEl = els.find(el => el.classList && el.classList.contains('time-slot'));
    return slotEl ? slotEl.dataset.slot : null;
}
