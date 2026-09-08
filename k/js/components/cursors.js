// Aero-ish cursors as data-URI SVGs: a white arrow with a dark outline and
// a soft blue shadow, and the spinning blue ring for when something loads.
// Each value is ready for CSS: `url("...") hotspotX hotspotY`.

const enc = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

export const ARROW = enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">` +
    `<defs><filter id="s" x="-30%" y="-30%" width="180%" height="180%"><feDropShadow dx="1" dy="1.5" stdDeviation="1" flood-color="#0b4fa8" flood-opacity="0.45"/></filter>` +
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9e9fb"/></linearGradient></defs>` +
    `<path d="M4 2 L4 19.5 L8.6 15.6 L11.6 22.3 L14.8 20.9 L11.9 14.2 L17.8 14.2 Z" fill="url(#g)" stroke="#12365e" stroke-width="1.3" stroke-linejoin="round" filter="url(#s)"/>` +
    `</svg>`
) + ' 4 2';

// eight frames of a ring with a bright head fading into a tail
export const BUSY = Array.from({ length: 8 }, (_, frame) => {
    const segs = Array.from({ length: 8 }, (_, i) => {
        const a = ((i - frame + 8) % 8);                 // 0 = head
        const alpha = (0.15 + 0.85 * (1 - a / 8)).toFixed(2);
        const angle = i * 45;
        return `<circle cx="16" cy="5" r="3" fill="#1e90d8" fill-opacity="${alpha}" transform="rotate(${angle} 16 16)"/>` +
               `<circle cx="16" cy="5" r="1.4" fill="#bfe6ff" fill-opacity="${alpha}" transform="rotate(${angle} 16 16)"/>`;
    }).join('');
    return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${segs}</svg>`) + ' 16 16';
});
