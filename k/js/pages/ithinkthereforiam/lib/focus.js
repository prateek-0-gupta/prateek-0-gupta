// Focus mode

import { showToast } from './utils.js';
import { renderCards } from './cards.js';

export function enterFocus(ctx) {
    if (!ctx.selectedCardId) {
        showToast('click a thought first, then press F');
        return;
    }
    ctx.focusMode = true;
    ctx.dom.focusOverlay.classList.add('active');
    renderCards(ctx);
}

export function exitFocus(ctx) {
    ctx.focusMode = false;
    ctx.dom.focusOverlay.classList.remove('active');
    renderCards(ctx);
}
