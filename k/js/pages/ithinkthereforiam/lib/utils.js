// Shared utilities

export function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(line) {
    return escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function renderMarkdown(text) {
    if (!text) return '';
    return text.split('\n').map((line, i) => {
        const chk = line.match(/^- \[( |x)\] ?(.*)$/);
        if (chk) {
            const done = chk[1] === 'x';
            return `<div class="chk ${done ? 'done' : ''}" data-li="${i}"><span class="chk-box" contenteditable="false">${done ? '&#10003;' : ''}</span><span>${inlineMd(chk[2])}</span></div>`;
        }
        const bullet = line.match(/^- (.*)$/);
        if (bullet) return `<div>&bull; ${inlineMd(bullet[1])}</div>`;
        return `<div>${inlineMd(line) || '<br>'}</div>`;
    }).join('');
}

export function showToast(msg) {
    const toast = document.getElementById('undo-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1200);
}

export function placeCaretEnd(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}
