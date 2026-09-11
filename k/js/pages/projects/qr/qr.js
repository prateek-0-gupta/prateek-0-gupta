// QR Maker. Text, links, Wi-Fi logins, contacts and e-mails as QR codes,
// drawn in the browser by components/qr.js. Nothing leaves the page.

import { useEffect, registerHandler } from '../../../framework.js';
import { encode, toSvg, drawCanvas } from '../../../components/qr.js';

const EMBEDDED = window.self !== window.top;      // opened as a window on the desktop
let _cleanup = null;

const TABS = [['text', 'Text / URL'], ['wifi', 'Wi-Fi'], ['contact', 'Contact'], ['email', 'E-mail']];

const field = (id, label, attrs = '', tag = 'input') => `
    <label class="tool-field"><span>${label}</span>${tag === 'textarea'
        ? `<textarea id="${id}" ${attrs}></textarea>`
        : `<input id="${id}" ${attrs}>`}</label>`;

export default function QRMaker() {
    useEffect(() => {
        if (_cleanup) _cleanup();
        _cleanup = init();
        return () => { if (_cleanup) { _cleanup(); _cleanup = null; } };
    }, []);

    registerHandler('qr-png', () => exportPng());
    registerHandler('qr-svg', () => exportSvg());
    registerHandler('qr-copy-image', () => copyImage());
    registerHandler('qr-copy-text', () => copyText());

    return `
    <div class="tool-page${EMBEDDED ? ' is-embedded' : ''}" id="qr-root">
        <div class="tool-win">
            <div class="tool-title">
                <img class="tool-title-ico" src="media/svg/32/23-qr.svg" alt="">
                <span>QR Maker</span>
                <a href="/" data-link class="tool-home">&larr; prateek</a>
            </div>
            <div class="tool-body">
                <div class="tool-tabs" id="qr-tabs" role="tablist">
                    ${TABS.map(([id, label], i) => `<button type="button" role="tab" data-tab="${id}" class="${i === 0 ? 'is-on' : ''}">${label}</button>`).join('')}
                </div>
                <div class="tool-cols">
                    <div class="tool-col">
                        <fieldset class="tool-group" data-pane="text">
                            <legend>Content</legend>
                            ${field('qr-text', 'Text or link', 'rows="5" placeholder="https://" spellcheck="false"', 'textarea')}
                        </fieldset>
                        <fieldset class="tool-group" data-pane="wifi" hidden>
                            <legend>Wi-Fi login</legend>
                            ${field('qr-wifi-ssid', 'Network name', 'autocomplete="off" spellcheck="false"')}
                            ${field('qr-wifi-pass', 'Password', 'autocomplete="off" spellcheck="false"')}
                            <label class="tool-field"><span>Security</span>
                                <select id="qr-wifi-sec"><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">None (open)</option></select>
                            </label>
                            <label class="tool-check"><input type="checkbox" id="qr-wifi-hidden"> Hidden network</label>
                            <p class="tool-fine">Phones join the network straight from the camera. The password is inside the code, so print it for people you trust.</p>
                        </fieldset>
                        <fieldset class="tool-group" data-pane="contact" hidden>
                            <legend>Contact card</legend>
                            ${field('qr-c-name', 'Name', 'autocomplete="name"')}
                            ${field('qr-c-phone', 'Phone', 'type="tel" autocomplete="tel"')}
                            ${field('qr-c-email', 'E-mail', 'type="email" autocomplete="email"')}
                            ${field('qr-c-org', 'Organisation', 'autocomplete="organization"')}
                            ${field('qr-c-url', 'Website', 'type="url" placeholder="https://"')}
                        </fieldset>
                        <fieldset class="tool-group" data-pane="email" hidden>
                            <legend>E-mail</legend>
                            ${field('qr-e-to', 'To', 'type="email"')}
                            ${field('qr-e-subject', 'Subject', '')}
                            ${field('qr-e-body', 'Message', 'rows="3"', 'textarea')}
                        </fieldset>

                        <fieldset class="tool-group">
                            <legend>Looks</legend>
                            <div class="tool-row">
                                <label class="tool-field"><span>Error correction</span>
                                    <select id="qr-ecl"><option value="L">L, 7% (smallest)</option><option value="M" selected>M, 15%</option><option value="Q">Q, 25%</option><option value="H">H, 30% (sturdiest)</option></select>
                                </label>
                                <label class="tool-field"><span>Style</span>
                                    <select id="qr-style"><option value="square">Squares</option><option value="dots">Dots</option></select>
                                </label>
                            </div>
                            <div class="tool-row">
                                <label class="tool-field"><span>Module size <output id="qr-scale-out">8</output>px</span><input type="range" id="qr-scale" min="3" max="16" value="8"></label>
                                <label class="tool-field"><span>Quiet zone <output id="qr-margin-out">4</output></span><input type="range" id="qr-margin" min="0" max="8" value="4"></label>
                            </div>
                            <div class="tool-row">
                                <label class="tool-field tool-colour"><span>Ink</span><input type="color" id="qr-fg" value="#0b2340"></label>
                                <label class="tool-field tool-colour"><span>Paper</span><input type="color" id="qr-bg" value="#ffffff"></label>
                            </div>
                        </fieldset>
                    </div>

                    <div class="tool-col tool-preview">
                        <div class="qr-stage" id="qr-stage">
                            <canvas id="qr-canvas" aria-label="QR code preview"></canvas>
                            <div class="qr-error" id="qr-error" hidden></div>
                        </div>
                        <div class="qr-stats" id="qr-stats"></div>
                        <div class="tool-actions">
                            <button type="button" class="tool-btn is-default" data-action="qr-png">Download PNG</button>
                            <button type="button" class="tool-btn" data-action="qr-svg">Download SVG</button>
                            <button type="button" class="tool-btn" data-action="qr-copy-image">Copy image</button>
                            <button type="button" class="tool-btn" data-action="qr-copy-text">Copy text</button>
                        </div>
                        <details class="tool-details"><summary>What the code says</summary><pre id="qr-payload" class="tool-pre"></pre></details>
                        <p class="tool-fine">Made entirely in your browser. Nothing you type here is sent anywhere.</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="tool-toast" id="qr-toast" hidden></div>
    </div>`;
}

// ── State and rendering ──────────────────────────────────────────────

let current = null;     // { qr, payload, opts }

const $ = id => document.getElementById(id);

function escapeWifi(s) { return String(s).replace(/[\\;,":]/g, c => '\\' + c); }

function payloadFor(tab) {
    switch (tab) {
        case 'wifi': {
            const ssid = $('qr-wifi-ssid').value.trim(), pass = $('qr-wifi-pass').value, sec = $('qr-wifi-sec').value;
            if (!ssid) return '';
            return `WIFI:T:${sec};S:${escapeWifi(ssid)};${sec === 'nopass' ? '' : `P:${escapeWifi(pass)};`}${$('qr-wifi-hidden').checked ? 'H:true;' : ''};`;
        }
        case 'contact': {
            const name = $('qr-c-name').value.trim();
            const parts = name.split(/\s+/).filter(Boolean);
            const last = parts.length > 1 ? parts.pop() : '';
            const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
            if (name) { lines.push(`N:${last};${parts.join(' ')};;;`, `FN:${name}`); }
            const org = $('qr-c-org').value.trim(), tel = $('qr-c-phone').value.trim(), mail = $('qr-c-email').value.trim(), url = $('qr-c-url').value.trim();
            if (org) lines.push(`ORG:${org}`);
            if (tel) lines.push(`TEL;TYPE=CELL:${tel}`);
            if (mail) lines.push(`EMAIL:${mail}`);
            if (url) lines.push(`URL:${url}`);
            lines.push('END:VCARD');
            return lines.length > 3 ? lines.join('\n') : '';
        }
        case 'email': {
            const to = $('qr-e-to').value.trim();
            if (!to) return '';
            const q = [];
            if ($('qr-e-subject').value) q.push('subject=' + encodeURIComponent($('qr-e-subject').value));
            if ($('qr-e-body').value) q.push('body=' + encodeURIComponent($('qr-e-body').value));
            return `mailto:${to}${q.length ? '?' + q.join('&') : ''}`;
        }
        default:
            return $('qr-text').value;
    }
}

function options() {
    return {
        ecl: $('qr-ecl').value,
        scale: +$('qr-scale').value,
        margin: +$('qr-margin').value,
        fg: $('qr-fg').value,
        bg: $('qr-bg').value,
        dots: $('qr-style').value === 'dots',
    };
}

function update() {
    const tab = document.querySelector('#qr-tabs .is-on')?.dataset.tab || 'text';
    const payload = payloadFor(tab);
    const opts = options();
    $('qr-scale-out').value = opts.scale;
    $('qr-margin-out').value = opts.margin;
    $('qr-payload').textContent = payload;
    const err = $('qr-error'), canvas = $('qr-canvas');
    if (!payload) {
        current = null;
        err.hidden = false; err.textContent = 'Type something and the code appears here.';
        canvas.hidden = true; $('qr-stats').textContent = '';
        return;
    }
    try {
        const qr = encode(payload, { ecl: opts.ecl });
        current = { qr, payload, opts };
        drawCanvas(canvas, qr, opts);
        canvas.hidden = false; err.hidden = true;
        $('qr-stats').textContent = `version ${qr.version} · ${qr.size}×${qr.size} modules · ${qr.bytes} bytes · level ${qr.ecl}`;
    } catch (e) {
        current = null;
        canvas.hidden = true; err.hidden = false;
        err.textContent = /too much/.test(e.message) ? 'Too much for one QR code. Shorten it, or drop the error correction to L.' : e.message;
        $('qr-stats').textContent = '';
    }
}

function init() {
    const root = $('qr-root');
    if (!root) return () => {};
    const onInput = () => update();
    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    const tabs = $('qr-tabs');
    const onTab = e => {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        tabs.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('is-on', t === b));
        root.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tab; });
        update();
        root.querySelector(`[data-pane="${b.dataset.tab}"] input, [data-pane="${b.dataset.tab}"] textarea`)?.focus();
    };
    tabs.addEventListener('click', onTab);
    update();
    return () => { root.removeEventListener('input', onInput); root.removeEventListener('change', onInput); tabs.removeEventListener('click', onTab); };
}

// ── Actions ──────────────────────────────────────────────────────────

let toastTimer = null;
function toast(msg) {
    const t = $('qr-toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1400);
}

function fileName(ext) {
    const base = (current?.payload || 'qr').replace(/^[a-z]+:\/\//i, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'qr';
    return `qr-${base}.${ext}`;
}

function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// a crisp export regardless of the preview size or the screen's pixel ratio
function exportBlob() {
    return new Promise(resolve => {
        if (!current) return resolve(null);
        const c = document.createElement('canvas');
        drawCanvas(c, current.qr, { ...current.opts, scale: Math.max(current.opts.scale, 12), dpr: 1 });
        c.toBlob(resolve, 'image/png');
    });
}

async function exportPng() {
    const blob = await exportBlob();
    if (!blob) return toast('Nothing to save yet');
    download(blob, fileName('png'));
}
function exportSvg() {
    if (!current) return toast('Nothing to save yet');
    download(new Blob([toSvg(current.qr, current.opts)], { type: 'image/svg+xml' }), fileName('svg'));
}
async function copyImage() {
    if (!current) return toast('Nothing to copy yet');
    try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': exportBlob() })]);
        toast('Image copied');
    } catch {
        toast('This browser cannot copy images. Download instead.');
    }
}
async function copyText() {
    if (!current) return toast('Nothing to copy yet');
    try { await navigator.clipboard.writeText(current.payload); toast('Copied'); } catch { toast('Could not copy'); }
}
