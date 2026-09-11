// Sealed Note. Encrypts a note in the browser and folds the result into a
// link. The ciphertext and the key ride in the URL fragment (the part after
// #), which browsers never send to a server, so prat.ee sees nothing and
// stores nothing. Whoever opens the link gets the note decrypted on their
// own machine. With a passphrase set, the link alone is not enough.
//
//   link format:  /k/share#<mode>.<iv>.<ciphertext>.<key or salt>
//   mode:         k = key in the link, p = passphrase; 1 = raw, 2 = deflated

import { useEffect, registerHandler } from '../../../framework.js';
import { encode, drawCanvas } from '../../../components/qr.js';

const EMBEDDED = window.self !== window.top;
let _cleanup = null;

// The route shell stashes the fragment in window.__sealed before anything
// else runs and clears it from the address bar. If we got here another way,
// do the same now, before the router or any analytics can look at the URL.
let INCOMING = typeof window.__sealed === 'string' ? window.__sealed : '';
if (window.__sealed !== undefined) { try { delete window.__sealed; } catch { window.__sealed = undefined; } }
if (!INCOMING && location.hash.length > 1 && /\/share\/?$/.test(location.pathname)) {
    INCOMING = location.hash.slice(1);
    history.replaceState(null, '', location.pathname + location.search);
}

// ── Crypto ───────────────────────────────────────────────────────────

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = {
    enc(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(s) {
        const t = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4);
        return Uint8Array.from(atob(t), c => c.charCodeAt(0));
    },
};
async function deflate(bytes) {
    if (typeof CompressionStream === 'undefined') return null;
    const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
}
async function inflate(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
}
const PBKDF2_ITERATIONS = 310000;
async function passphraseKey(passphrase, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const rawKey = bytes => crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

/** Encrypt a note; returns the fragment. */
export async function seal({ title = '', body, passphrase = '' }) {
    const plain = enc.encode(JSON.stringify({ t: title, b: body, c: Date.now() }));
    let packed = plain, z = '1';
    const d = await deflate(plain).catch(() => null);
    if (d && d.length < plain.length) { packed = d; z = '2'; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    let key, tail;
    if (passphrase) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        key = await passphraseKey(passphrase, salt);
        tail = salt;
    } else {
        tail = crypto.getRandomValues(new Uint8Array(32));
        key = await rawKey(tail);
    }
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed));
    return `${passphrase ? 'p' : 'k'}${z}.${b64.enc(iv)}.${b64.enc(ct)}.${b64.enc(tail)}`;
}

/** Split a fragment into its parts, or null if it is not one of ours. */
export function parse(fragment) {
    const [mode, iv, ct, tail] = String(fragment || '').split('.');
    if (!/^[kp][12]$/.test(mode || '') || !iv || !ct || !tail) return null;
    try { return { needsPassphrase: mode[0] === 'p', compressed: mode[1] === '2', iv: b64.dec(iv), ct: b64.dec(ct), tail: b64.dec(tail) }; }
    catch { return null; }
}

/** Decrypt; throws if the key or passphrase is wrong. */
export async function unseal(parsed, passphrase = '') {
    const key = parsed.needsPassphrase ? await passphraseKey(passphrase, parsed.tail) : await rawKey(parsed.tail);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: parsed.iv }, key, parsed.ct));
    return JSON.parse(dec.decode(parsed.compressed ? await inflate(plain) : plain));
}

// ── Page ─────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function SealedNote() {
    useEffect(() => {
        if (_cleanup) _cleanup();
        _cleanup = init();
        return () => { if (_cleanup) { _cleanup(); _cleanup = null; } };
    }, []);

    registerHandler('sn-seal', () => doSeal());
    registerHandler('sn-copy-link', () => copy($('sn-link').value, 'Link copied'));
    registerHandler('sn-share', () => shareLink());
    registerHandler('sn-qr', () => toggleQr());
    registerHandler('sn-again', () => showCompose(true));
    registerHandler('sn-unlock', () => doUnseal());
    registerHandler('sn-copy-all', () => copy(opened?.b || '', 'Note copied'));
    registerHandler('sn-copy-line', e => copy(e.target.closest('[data-line]').dataset.line, 'Copied'));
    registerHandler('sn-keep-link', () => copy(originalLink, 'Link copied'));
    registerHandler('sn-random', () => { $('sn-pass').value = randomPassphrase(); $('sn-pass').type = 'text'; });
    registerHandler('sn-peek', () => { const p = $('sn-pass'); p.type = p.type === 'password' ? 'text' : 'password'; });

    return `
    <div class="tool-page${EMBEDDED ? ' is-embedded' : ''}" id="sn-root">
        <div class="tool-win tool-win-narrow">
            <div class="tool-title">
                <img class="tool-title-ico" src="media/svg/32/24-seal.svg" alt="">
                <span>Sealed Note</span>
                <a href="/" data-link class="tool-home">&larr; prateek</a>
            </div>
            <div class="tool-body">

                <section id="sn-compose">
                    <p class="tool-lede">Write a note, seal it into a link, send the link. The note is encrypted in your browser and travels inside the link itself. This site never sees it.</p>
                    <fieldset class="tool-group">
                        <legend>Your note</legend>
                        <label class="tool-field"><span>Title <em>optional</em></span><input id="sn-title" maxlength="80" placeholder="Wi-Fi at the studio"></label>
                        <label class="tool-field"><span>Note</span><textarea id="sn-body" rows="6" spellcheck="false" placeholder="network: studio-5g
password: correct horse battery staple"></textarea></label>
                        <label class="tool-field"><span>Passphrase <em>optional, makes the link useless on its own</em></span>
                            <span class="tool-inline">
                                <input id="sn-pass" type="password" autocomplete="off" spellcheck="false" placeholder="tell them this some other way">
                                <button type="button" class="tool-btn tool-btn-sm" data-action="sn-peek" title="Show or hide">👁</button>
                                <button type="button" class="tool-btn tool-btn-sm" data-action="sn-random" title="Make one up">Random</button>
                            </span>
                        </label>
                    </fieldset>
                    <div class="tool-actions">
                        <button type="button" class="tool-btn is-default" data-action="sn-seal">Seal it</button>
                        <span class="tool-fine" id="sn-status"></span>
                    </div>

                    <div id="sn-result" hidden>
                        <fieldset class="tool-group tool-group-result">
                            <legend>Sealed</legend>
                            <label class="tool-field"><span>Link</span><textarea id="sn-link" rows="3" readonly spellcheck="false"></textarea></label>
                            <div class="tool-actions">
                                <button type="button" class="tool-btn is-default" data-action="sn-copy-link">Copy link</button>
                                <button type="button" class="tool-btn" data-action="sn-share" id="sn-share-btn">Share…</button>
                                <button type="button" class="tool-btn" data-action="sn-qr">Show QR</button>
                                <a class="tool-btn" id="sn-open" href="#" target="_blank" rel="noopener">Open it</a>
                            </div>
                            <div class="sn-qr" id="sn-qr" hidden><canvas id="sn-qr-canvas"></canvas><p class="tool-fine">Point a phone at it to move the note across without typing.</p></div>
                            <p class="tool-fine" id="sn-length"></p>
                        </fieldset>
                        <ul class="tool-notes">
                            <li>Anyone with the link can read the note, so send it somewhere you trust. With a passphrase, they need that too.</li>
                            <li>There is no expiry and no self-destruct. Nothing is stored anywhere, so there is nothing to expire; ask the other side to delete the message once they have it.</li>
                            <li>The link opens on prat.ee, but the part after the <code>#</code> stays in the browser. Server logs never see it.</li>
                        </ul>
                    </div>
                </section>

                <section id="sn-read" hidden>
                    <div id="sn-locked" hidden>
                        <p class="tool-lede">Someone sent you a sealed note. It needs the passphrase they gave you.</p>
                        <fieldset class="tool-group">
                            <legend>Unlock</legend>
                            <label class="tool-field"><span>Passphrase</span><input id="sn-unlock-pass" type="password" autocomplete="off" autofocus></label>
                        </fieldset>
                        <div class="tool-actions">
                            <button type="button" class="tool-btn is-default" data-action="sn-unlock">Open the note</button>
                            <span class="tool-fine" id="sn-unlock-status"></span>
                        </div>
                    </div>
                    <div id="sn-opened" hidden>
                        <fieldset class="tool-group tool-group-result">
                            <legend id="sn-opened-title">Sealed note</legend>
                            <div class="sn-lines" id="sn-lines"></div>
                            <div class="tool-actions">
                                <button type="button" class="tool-btn is-default" data-action="sn-copy-all">Copy the note</button>
                                <button type="button" class="tool-btn" data-action="sn-keep-link">Copy the link again</button>
                                <button type="button" class="tool-btn" data-action="sn-again">Write one back</button>
                            </div>
                            <p class="tool-fine" id="sn-opened-meta"></p>
                        </fieldset>
                        <p class="tool-fine">This note was decrypted here, in your browser. The link has been cleared from the address bar; if you reload, it is gone, so copy what you need now.</p>
                    </div>
                    <div id="sn-broken" hidden>
                        <p class="tool-lede">That link is not a sealed note, or it was cut short on the way. Ask for it again, ideally as a QR code or in one piece.</p>
                        <div class="tool-actions"><button type="button" class="tool-btn" data-action="sn-again">Write a note instead</button></div>
                    </div>
                </section>

            </div>
        </div>
        <div class="tool-toast" id="sn-toast" hidden></div>
    </div>`;
}

// ── Behaviour ────────────────────────────────────────────────────────

let opened = null;          // the decrypted note
let originalLink = '';      // the link as received, for "copy the link again"
let parsedIncoming = null;

function init() {
    const root = $('sn-root');
    if (!root) return () => {};
    if (!window.isSecureContext || !crypto?.subtle) {
        $('sn-status').textContent = 'This needs a secure (https) page to encrypt anything.';
        root.querySelectorAll('.tool-btn').forEach(b => { b.disabled = true; });
    }
    if (INCOMING) {
        originalLink = shareUrl(INCOMING);
        parsedIncoming = parse(INCOMING);
        INCOMING = '';
        showRead();
    } else {
        showCompose(false);
    }
    const onKey = e => {
        if (e.key === 'Enter' && e.target.id === 'sn-unlock-pass') doUnseal();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'sn-body') doSeal();
    };
    root.addEventListener('keydown', onKey);
    // select it all for a quick copy, but keep the start of the link in view
    const onFocus = e => { if (e.target.id === 'sn-link') { e.target.select(); e.target.scrollTop = 0; } };
    root.addEventListener('focusin', onFocus);
    return () => { root.removeEventListener('keydown', onKey); root.removeEventListener('focusin', onFocus); };
}

function shareUrl(fragment) {
    // the trailing slash matches the folder GitHub Pages serves, so the link
    // opens without a redirect first
    return new URL('share/', document.baseURI).href + '#' + fragment;
}

function showCompose(reset) {
    $('sn-read').hidden = true;
    $('sn-compose').hidden = false;
    if (reset) { $('sn-title').value = ''; $('sn-body').value = ''; $('sn-pass').value = ''; $('sn-result').hidden = true; $('sn-status').textContent = ''; }
    if (typeof navigator.share !== 'function') $('sn-share-btn').hidden = true;
    $('sn-body').focus();
}

async function showRead() {
    $('sn-compose').hidden = true;
    $('sn-read').hidden = false;
    if (!parsedIncoming) { $('sn-broken').hidden = false; return; }
    if (parsedIncoming.needsPassphrase) { $('sn-locked').hidden = false; $('sn-unlock-pass').focus(); return; }
    try { present(await unseal(parsedIncoming)); }
    catch { $('sn-broken').hidden = false; }
}

async function doUnseal() {
    const pass = $('sn-unlock-pass').value;
    const status = $('sn-unlock-status');
    if (!pass) { status.textContent = 'Type the passphrase first.'; return; }
    status.textContent = 'Opening…';
    try {
        present(await unseal(parsedIncoming, pass));
        $('sn-locked').hidden = true;
    } catch {
        status.textContent = 'That passphrase did not open it.';
        $('sn-unlock-pass').select();
    }
}

function present(note) {
    opened = note;
    $('sn-opened').hidden = false;
    $('sn-opened-title').textContent = note.t || 'Sealed note';
    const lines = String(note.b).split('\n');
    $('sn-lines').innerHTML = lines.map(line => `
        <div class="sn-line">
            <code>${esc(line) || '&nbsp;'}</code>
            ${line.trim() ? `<button type="button" class="tool-btn tool-btn-sm" data-action="sn-copy-line" data-line="${esc(line)}" title="Copy this line">Copy</button>` : ''}
        </div>`).join('');
    const when = note.c ? new Date(note.c) : null;
    $('sn-opened-meta').textContent = when ? `Sealed ${when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.` : '';
}

async function doSeal() {
    const body = $('sn-body').value;
    const status = $('sn-status');
    if (!body.trim()) { status.textContent = 'Write something first.'; $('sn-body').focus(); return; }
    status.textContent = 'Sealing…';
    try {
        const fragment = await seal({ title: $('sn-title').value.trim(), body, passphrase: $('sn-pass').value });
        const link = shareUrl(fragment);
        $('sn-link').value = link;
        $('sn-open').href = link;
        $('sn-result').hidden = false;
        $('sn-qr').hidden = true;
        status.textContent = '';
        const n = link.length;
        $('sn-length').textContent = n > 1900
            ? `${n} characters. Some chat apps cut long links short; the QR code or an e-mail carries it whole.`
            : `${n} characters, ${$('sn-pass').value ? 'passphrase needed to open' : 'opens for anyone with the link'}.`;
        $('sn-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        $('sn-link').focus();
    } catch (e) {
        status.textContent = 'Could not seal it: ' + e.message;
    }
}

function toggleQr() {
    const box = $('sn-qr');
    box.hidden = !box.hidden;
    if (box.hidden) return;
    try { drawCanvas($('sn-qr-canvas'), encode($('sn-link').value, { ecl: 'L' }), { scale: 5, margin: 3, fg: '#0b2340' }); }
    catch { box.querySelector('p').textContent = 'Too long for a QR code. Copy the link instead.'; }
}

async function shareLink() {
    try { await navigator.share({ title: 'A sealed note', url: $('sn-link').value }); }
    catch { /* dismissed */ }
}

let toastTimer = null;
function toast(msg) {
    const t = $('sn-toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1400);
}
async function copy(text, msg) {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast('Could not copy'); }
}

const WORDS = ['amber', 'basil', 'cedar', 'delta', 'ember', 'fjord', 'ginger', 'harbor', 'indigo', 'juniper', 'kelp', 'lumen', 'meadow', 'nectar', 'orbit', 'pebble', 'quartz', 'river', 'saffron', 'tundra', 'umber', 'velvet', 'willow', 'yarrow', 'zephyr', 'monsoon', 'lantern', 'copper', 'marble', 'thistle'];
function randomPassphrase() {
    const r = crypto.getRandomValues(new Uint32Array(4));
    return Array.from(r, v => WORDS[v % WORDS.length]).join('-');
}
