// p2p drop: send files browser to browser, share with a code.
// Same plumbing as p2p chat: Trystero finds the other side through public
// BitTorrent WebSocket trackers, then the bytes go over a direct WebRTC data
// channel. The sender reads each file in CHUNK slices, so a big file is never
// all in the sender's memory at once; the receiver collects the slices and
// hands them to the browser as one Blob to save. The code doubles as the room
// password, so the signalling is encrypted with it too.

import { useState, useEffect, registerHandler } from '../../../framework.js';
import { ensureMooli } from '../../../components/mooli.js';

const APP_ID = 'prateek-p2p-drop-v1';
const CHUNK = 256 * 1024;
const CODE_LEN = 6;
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L
const TRACKERS = [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.dev',
    'wss://tracker.files.fm:7073/announce',
];
const ICE = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
];

let room = null;
let actions = null;
let mode = 'idle';          // idle | send | receive
let code = '';
let status = 'idle';        // idle | connecting | waiting | connected | error
let notice = '';
let dragging = false;
let _dragTimer = null;
let _joinTimer = null;
let _noticeTimer = null;
let _rerender = null;
let _renderQueued = false;

// sender
let outgoing = [];          // [{ id, file }]
let receivers = {};         // peerId -> { queue, gens, current, done: Set }

// receiver
let manifest = [];          // [{ id, name, size, type }]
let incoming = {};          // id -> { name, size, type, total, parts, got, state, url, startedAt, startBytes }
let senderId = null;

// ── helpers ─────────────────────────────────────────────────────────

function newCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
    return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

const normalise = s => (s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const pretty = c => c.slice(0, 3) + '-' + c.slice(3);
const shareLink = () => `${location.origin}/k/p2pdrop#${code}`;
const genId = () => Math.random().toString(36).slice(2, 10);

function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
    return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

function speed(bytes, startedAt) {
    const secs = (performance.now() - startedAt) / 1000;
    return secs > 0.5 ? `${formatBytes(bytes / secs)}/s` : '';
}

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function rerender() {
    if (_rerender) _rerender(Date.now());
}

// progress fires once per chunk; a few repaints a second is plenty
function queueRender() {
    if (_renderQueued) return;
    _renderQueued = true;
    setTimeout(() => { _renderQueued = false; rerender(); }, 120);
}

function setStatus(s) {
    status = s;
    rerender();
}

function say(text, ms = 0) {
    notice = text;
    if (_noticeTimer) clearTimeout(_noticeTimer);
    if (ms) _noticeTimer = setTimeout(() => { notice = ''; rerender(); }, ms);
    rerender();
}

// ── Mooli, the courier ──────────────────────────────────────────────
// The creature runs a parcel from one PC on the page to the other for as long
// as bytes are moving. It reads everything it needs through the job's
// functions, so nothing here has to tell it when things change; the page only
// tells it about moments: files arriving to pack, a file delivered.

const FAST = 4 * 1024 * 1024;   // bytes a second at which it is flat out
const mooli = () => ensureMooli();
let _job = null;

function hire() {
    _job = courierJob();
    mooli().courier(_job);
}

// a new page makes it forget what it was doing, and on a shared link the
// receive starts before the site has told it the page is new; so after every
// render, give it the job back if it lost it
function rehire() {
    if (_job && mooli().courierJob !== _job) mooli().courier(_job);
}
const pcRect = id => () => document.getElementById(id)?.getBoundingClientRect() ?? null;

function courierJob() {
    const sending = mode === 'send';
    return {
        from: pcRect(sending ? 'drop-pc-you' : 'drop-pc-them'),
        to: pcRect(sending ? 'drop-pc-them' : 'drop-pc-you'),
        mine: sending ? 'from' : 'to',
        state: courierState,
        pace: courierPace,
        onDrop: () => blink(sending ? 'drop-pc-them' : 'drop-pc-you'),
    };
}

// A closed tab does not always say goodbye, and WebRTC can take half a minute
// to notice, so it goes by whether bytes are actually landing: a transfer with
// nothing for a few seconds is stuck, whatever the connection claims.
const STALL = 2500;
const flowing = at => performance.now() - at < STALL;

function courierState() {
    if (mode === 'send') {
        const rs = Object.values(receivers);
        const moving = rs.filter(r => r.current);
        if (moving.length) return moving.some(r => flowing(r.current.lastAt)) ? 'go' : 'stuck';
        if (rs.length && rs.every(r => r.done.size >= outgoing.length)) return 'idle';
        return 'wait';
    }
    const incs = Object.values(incoming);
    if (incs.some(i => i.state === 'paused')) return 'stuck';
    const getting = incs.filter(i => i.state === 'getting');
    if (getting.length) return senderId && getting.some(i => flowing(i.lastAt)) ? 'go' : 'stuck';
    if (!senderId) return manifest.length ? 'idle' : 'wait';
    return 'idle';
}

function courierPace() {
    const now = performance.now();
    const rate = (bytes, at) => bytes / Math.max(0.5, (now - at) / 1000);
    let total = 0;
    if (mode === 'send') {
        for (const r of Object.values(receivers)) if (r.current) total += rate(r.current.sent - r.current.startBytes, r.current.startedAt);
    } else {
        for (const i of Object.values(incoming)) if (i.state === 'getting') total += rate(i.got - i.startBytes, i.startedAt);
    }
    return Math.min(1, total / FAST);
}

// the screen it tossed a parcel into lights up
function blink(id) {
    document.querySelector(`#${id} .drop-pc-screen`)?.animate(
        [{ filter: 'brightness(2.4)', transform: 'scale(1.08)' }, { filter: 'brightness(1)', transform: 'scale(1)' }],
        { duration: 380, easing: 'ease-out' });
}

const dropZoneRect = () => document.querySelector('.drop-zone')?.getBoundingClientRect() ?? null;

// ── room ────────────────────────────────────────────────────────────

async function join(c) {
    try {
        setStatus('connecting');
        const { joinRoom } = await import('https://esm.sh/trystero@0.20.0/torrent');
        if (mode === 'idle') return; // left while the library loaded

        room = joinRoom({
            appId: APP_ID,
            password: c,
            trackerUrls: TRACKERS,
            rtcConfig: { iceServers: ICE },
        }, 'drop-' + c);

        const [sendManifest, onManifest] = room.makeAction('manifest');
        const [sendWant, onWant] = room.makeAction('want');
        const [sendChunk, onChunk] = room.makeAction('chunk');
        const [sendDone, onDone] = room.makeAction('done');
        actions = { sendManifest, sendWant, sendChunk, sendDone };

        if (mode === 'send') {
            room.onPeerJoin(peerId => {
                receivers[peerId] = { queue: Promise.resolve(), gens: {}, current: null, done: new Set() };
                sendManifest(manifestOf(), peerId);
                mooli().say('hello');
                if (_joinTimer) { clearTimeout(_joinTimer); _joinTimer = null; }
                setStatus('connected');
            });
            room.onPeerLeave(peerId => {
                delete receivers[peerId];
                if (!Object.keys(receivers).length) setStatus('waiting');
                else rerender();
            });
            onWant(({ id, from }, peerId) => serve(peerId, id, from || 0));
            onDone(({ id }, peerId) => {
                receivers[peerId]?.done.add(id);
                mooli().delivered();
                rerender();
            });
        } else {
            onManifest((list, peerId) => {
                if (!manifest.length) mooli().say('hello');
                senderId = peerId;
                if (_joinTimer) { clearTimeout(_joinTimer); _joinTimer = null; }
                manifest = list;
                for (const f of list) {
                    incoming[f.id] ||= {
                        ...f, total: Math.ceil(f.size / CHUNK), parts: [], got: 0,
                        state: 'idle', url: null, startedAt: 0, startBytes: 0,
                    };
                }
                // a dropped connection that came back: pick up where we were
                Object.values(incoming).forEach(inc => { if (inc.state === 'paused') request(inc.id); });
                setStatus('connected');
            });
            onChunk((data, peerId, meta) => {
                const inc = incoming[meta?.id];
                if (!inc || inc.state !== 'getting' || meta.i !== inc.parts.length) return;
                inc.parts.push(data);
                inc.got += data.byteLength;
                inc.lastAt = performance.now();
                if (inc.parts.length === inc.total) finish(inc);
                queueRender();
            });
            room.onPeerLeave(peerId => {
                if (peerId !== senderId) return;
                senderId = null;
                Object.values(incoming).forEach(inc => { if (inc.state === 'getting') inc.state = 'paused'; });
                say('The sender dropped off. Anything half-received carries on if they reconnect.');
                setStatus('waiting');
            });
        }

        setStatus('waiting');
        if (_joinTimer) clearTimeout(_joinTimer);
        _joinTimer = setTimeout(() => {
            if (status !== 'waiting' || !room) return;
            say(mode === 'send'
                ? 'Still waiting. Peer discovery through the trackers can take up to a minute.'
                : 'Nobody with that code yet. Check it, and make sure the sender still has their tab open.');
        }, 20_000);
    } catch (err) {
        console.error('[drop] join failed:', err);
        setStatus('error');
        say(`Connection error: ${err.message}`);
    }
}

function leave() {
    [_joinTimer, _noticeTimer, _dragTimer].forEach(t => t && clearTimeout(t));
    _joinTimer = _noticeTimer = _dragTimer = null;
    if (room) room.leave();
    _job = null;
    mooli().courier(null);
    mooli().expect(null);
    Object.values(incoming).forEach(inc => inc.url && URL.revokeObjectURL(inc.url));
    room = null;
    actions = null;
    mode = 'idle';
    code = '';
    status = 'idle';
    notice = '';
    dragging = false;
    outgoing = [];
    receivers = {};
    manifest = [];
    incoming = {};
    senderId = null;
}

// ── sending ─────────────────────────────────────────────────────────

const manifestOf = () => outgoing.map(({ id, file }) => ({ id, name: file.name, size: file.size, type: file.type }));

function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    files.forEach(file => outgoing.push({ id: genId(), file }));
    mooli().expect(null);
    mooli().pack();
    if (mode === 'idle') {
        mode = 'send';
        code = newCode();
        hire();
        join(code);
    } else if (actions) {
        actions.sendManifest(manifestOf()); // everyone already here sees the new files
    }
    rerender();
}

// one file at a time per receiver; asking again for a file restarts it from `from`
function serve(peerId, id, from) {
    const entry = outgoing.find(o => o.id === id);
    const r = receivers[peerId];
    if (!entry || !r) return;
    const gen = r.gens[id] = (r.gens[id] || 0) + 1;
    r.queue = r.queue
        .then(() => pump(peerId, r, entry, from, gen))
        .catch(err => console.error('[drop] send failed:', err));
}

async function pump(peerId, r, { id, file }, from, gen) {
    const total = Math.ceil(file.size / CHUNK);
    const start = Math.min(file.size, from * CHUNK);
    r.current = { name: file.name, size: file.size, sent: start, startBytes: start, startedAt: performance.now(), lastAt: performance.now() };
    for (let i = from; i < total; i++) {
        if (receivers[peerId] !== r || r.gens[id] !== gen || !actions) break;
        const buf = await file.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer();
        await actions.sendChunk(buf, peerId, { id, i });
        r.current.sent = Math.min(file.size, (i + 1) * CHUNK);
        r.current.lastAt = performance.now();
        queueRender();
    }
    r.current = null;
    rerender();
}

// ── receiving ───────────────────────────────────────────────────────

function request(id) {
    const inc = incoming[id];
    if (!inc || inc.state === 'done' || inc.state === 'getting') return;
    if (inc.total === 0) { finish(inc); return; } // empty file, nothing to send
    if (!senderId || !actions) { inc.state = 'paused'; rerender(); return; }
    inc.state = 'getting';
    inc.startedAt = performance.now();
    inc.startBytes = inc.got;
    inc.lastAt = performance.now();
    actions.sendWant({ id, from: inc.parts.length }, senderId);
    rerender();
}

function finish(inc) {
    const blob = new Blob(inc.parts, { type: inc.type || 'application/octet-stream' });
    inc.parts = null;
    inc.url = URL.createObjectURL(blob);
    inc.state = 'done';
    if (senderId && actions) actions.sendDone({ id: inc.id }, senderId);
    mooli().delivered();
    save(inc);
    rerender();
}

function save(inc) {
    const a = document.createElement('a');
    a.href = inc.url;
    a.download = inc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function startReceive(raw) {
    const c = normalise(raw);
    if (c.length !== CODE_LEN) {
        say(`A code is ${CODE_LEN} letters and numbers, like K7Q-M2X.`, 4000);
        return;
    }
    mode = 'receive';
    code = c;
    hire();
    rerender();
    join(c);
}

async function copy(text, what) {
    try {
        await navigator.clipboard.writeText(text);
        say(`${what} copied.`, 2000);
    } catch {
        say(`Could not reach the clipboard. ${what}: ${text}`, 6000);
    }
}

// ── page ────────────────────────────────────────────────────────────

export default function P2PDrop() {
    const [_tick, setTick] = useState(0);
    _rerender = setTick;

    // after the site's own after-render step, which can clear it (see rehire)
    useEffect(() => { const t = setTimeout(rehire); return () => clearTimeout(t); });

    useEffect(() => {
        const onChange = e => {
            if (e.target.id !== 'drop-file') return;
            addFiles(e.target.files);
            e.target.value = '';
        };
        const onKey = e => {
            if (e.key === 'Enter' && e.target.id === 'drop-code') startReceive(e.target.value);
        };
        const onDragOver = e => {
            if (mode === 'receive' || !e.dataTransfer?.types.includes('Files')) return;
            e.preventDefault();
            if (!dragging) { dragging = true; mooli().expect(dropZoneRect); rerender(); }
            // there is no reliable dragleave for the window; stop highlighting when the overs stop
            if (_dragTimer) clearTimeout(_dragTimer);
            _dragTimer = setTimeout(() => { dragging = false; mooli().expect(null); rerender(); }, 150);
        };
        const onDrop = e => {
            if (mode === 'receive' || !e.dataTransfer?.files.length) return;
            e.preventDefault();
            dragging = false;
            if (_dragTimer) { clearTimeout(_dragTimer); _dragTimer = null; }
            addFiles(e.dataTransfer.files);
        };
        const onUnload = e => {
            if (mode === 'send') { e.preventDefault(); e.returnValue = ''; }
        };
        // nothing re-renders when bytes stop arriving, so look again now and then
        const heartbeat = setInterval(() => { if (mode !== 'idle') rerender(); }, 1000);
        document.addEventListener('change', onChange);
        document.addEventListener('keydown', onKey);
        document.addEventListener('dragover', onDragOver);
        document.addEventListener('drop', onDrop);
        window.addEventListener('beforeunload', onUnload);

        // a shared link carries the code in the hash, which never reaches a server
        const fromLink = normalise(location.hash.slice(1));
        if (mode === 'idle' && fromLink.length === CODE_LEN) startReceive(fromLink);

        return () => {
            clearInterval(heartbeat);
            document.removeEventListener('change', onChange);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('dragover', onDragOver);
            document.removeEventListener('drop', onDrop);
            window.removeEventListener('beforeunload', onUnload);
            leave();
            _rerender = null;
        };
    }, []);

    registerHandler('drop-receive', () => startReceive(document.getElementById('drop-code')?.value));
    registerHandler('drop-leave', () => {
        if (mode === 'send' && Object.keys(receivers).length && !confirm('Stop sending? Anyone still receiving will be cut off.')) return;
        leave();
        if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
        rerender();
    });
    registerHandler('drop-copy-code', () => copy(pretty(code), 'Code'));
    registerHandler('drop-copy-link', () => copy(shareLink(), 'Link'));
    registerHandler('drop-get', e => request(e.target.closest('[data-id]')?.getAttribute('data-id')));
    registerHandler('drop-get-all', () => manifest.forEach(f => request(f.id)));
    registerHandler('drop-save', e => {
        const inc = incoming[e.target.closest('[data-id]')?.getAttribute('data-id')];
        if (inc?.url) save(inc);
    });

    const noticeHtml = notice ? `<div class="drop-notice">${escapeHtml(notice)}</div>` : '';

    if (mode === 'idle') {
        return `
        <div class="p2p-root">
        <div class="p2p-lobby" data-mooli-column>
            <a href="/" data-link class="p2p-back">&larr; Back</a>

            <div class="p2p-logo">&#8645;</div>
            <h1 class="p2p-title">P2P Drop</h1>
            <p class="p2p-subtitle">Send files instantly, share with a code.<br>Browser to browser, no server in between.</p>

            <div class="p2p-form">
                <label for="drop-file" class="drop-zone${dragging ? ' drop-zone-hot' : ''}" data-gesture="exchange">
                    <span class="drop-zone-big">${dragging ? 'Let go to send' : 'Drop files here'}</span>
                    <span class="drop-zone-small">or click to choose</span>
                </label>
                <input id="drop-file" type="file" multiple hidden />

                <div class="p2p-or">or receive with a code</div>

                <label class="p2p-label" for="drop-code">Code</label>
                <input id="drop-code" class="p2p-input drop-code-input" type="text" placeholder="K7Q-M2X" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" />
                <button data-action="drop-receive" class="p2p-btn p2p-btn-secondary" data-gesture="point">Receive</button>
                ${noticeHtml}
            </div>

            <div class="p2p-info">
                <p style="margin-top:0.6rem;">&#9881; <strong>How it works:</strong> Choosing files gives you a code. Whoever types it in finds your browser through public BitTorrent WebSocket trackers, which only introduce the two of you. The files then travel over a direct, encrypted WebRTC connection. Nothing is uploaded anywhere, so the sender has to keep the tab open until it is done.</p>
                <p style="margin-top:0.6rem;">&#128218; This project is built for <strong>academic and educational purposes only</strong>, a demonstration of serverless peer-to-peer file transfer hosted entirely on static GitHub Pages with zero backend infrastructure.</p>
            </div>
        </div>
        </div>`;
    }

    const statusLabel =
        status === 'connecting' ? '⟳ Connecting to trackers…' :
        status === 'waiting'    ? (mode === 'send' ? '⟳ Waiting for someone to enter the code…' : '⟳ Looking for the sender…') :
        status === 'connected'  ? (mode === 'send' ? '● Receiver connected' : '● Connected to sender') :
        status === 'error'      ? '✕ Connection error' : '';

    const statusClass =
        status === 'connected' ? 'p2p-status-ok' :
        status === 'error'     ? 'p2p-status-err' : 'p2p-status-wait';

    const header = (title, sub) => `
        <div class="p2p-header">
            <button data-action="drop-leave" class="p2p-back-btn" title="Leave">&larr;</button>
            <div class="p2p-header-info">
                <span class="p2p-room-name">${title}</span>
                <span class="p2p-peer-count">${sub}</span>
            </div>
            <div class="p2p-my-nick">${pretty(code)}</div>
        </div>
        <div class="p2p-status-bar ${statusClass}">${statusLabel}</div>`;

    const bar = (done, total) => `<div class="drop-bar"><i style="width:${total ? Math.min(100, done / total * 100).toFixed(1) : 100}%"></i></div>`;

    // two little PCs for Mooli to run between: you on the left, them on the
    // right; the one being sent to fills up as the bytes land
    const pc = (id, name, { on = true, fill = 0 } = {}) => `
        <div class="drop-pc${on ? '' : ' drop-pc-off'}">
            <div class="drop-pc-box" id="${id}">
                <div class="drop-pc-screen"><i style="height:${(Math.min(1, fill) * 100).toFixed(1)}%"></i></div>
                <div class="drop-pc-neck"></div><div class="drop-pc-base"></div>
            </div>
            <span class="drop-pc-name">${name}</span>
        </div>`;
    const wire = ({ them, themOn, youFill, themFill, flow }) => `
        <div class="drop-wire${flow ? ` drop-wire-live drop-wire-${flow}` : ''}">
            ${pc('drop-pc-you', 'you', { fill: youFill })}
            <div class="drop-wire-line"></div>
            ${pc('drop-pc-them', escapeHtml(them), { on: themOn, fill: themFill })}
        </div>`;

    if (mode === 'send') {
        const peerIds = Object.keys(receivers);
        const totalSize = outgoing.reduce((a, o) => a + o.file.size, 0);

        const filesHtml = outgoing.map(({ file }) => `
            <li class="drop-file"><div class="drop-file-line">
                <span class="drop-file-name">${escapeHtml(file.name)}</span>
                <span class="drop-file-size">${formatBytes(file.size)}</span>
            </div></li>`).join('');

        const peersHtml = peerIds.length ? peerIds.map(id => {
            const r = receivers[id];
            const c = r.current;
            const line = c
                ? `receiving ${escapeHtml(c.name)} · ${Math.floor(c.size ? c.sent / c.size * 100 : 100)}% ${speed(c.sent - c.startBytes, c.startedAt)}`
                : r.done.size ? `received ${r.done.size} of ${outgoing.length}` : 'looking at the list';
            return `
            <li class="drop-peer">
                <div class="drop-peer-line"><span class="p2p-peer-tag">${id.slice(0, 6)}</span><span class="drop-peer-what">${line}</span></div>
                ${c ? bar(c.sent, c.size) : ''}
            </li>`;
        }).join('') : '<li class="p2p-no-peers">Nobody yet</li>';

        // how much of everything the receivers have between them, for the far screen
        const sizeOf = id => outgoing.find(o => o.id === id)?.file.size || 0;
        const landed = peerIds.reduce((a, id) => {
            const r = receivers[id];
            return a + [...r.done].reduce((b, f) => b + sizeOf(f), 0) + (r.current ? r.current.sent : 0);
        }, 0);
        const themFill = peerIds.length && totalSize ? landed / (totalSize * peerIds.length) : 0;
        const them = peerIds.length > 1 ? `${peerIds.length} of them` : 'them';

        return `
        <div class="p2p-root" data-no-tidy>
        <div class="p2p-chat-container" data-mooli-column>
            ${header('Sending', `${outgoing.length} file${outgoing.length !== 1 ? 's' : ''} · ${formatBytes(totalSize)}`)}
            <div class="drop-body">
                ${wire({ them, themOn: peerIds.length > 0, youFill: 1, themFill, flow: courierState() === 'go' ? 'right' : '' })}
                <div class="drop-code-card">
                    <span class="p2p-label">Your code</span>
                    <div class="drop-code-big">${pretty(code)}</div>
                    <div class="drop-row">
                        <button data-action="drop-copy-code" class="p2p-btn p2p-btn-secondary">Copy code</button>
                        <button data-action="drop-copy-link" class="p2p-btn p2p-btn-primary">Copy link</button>
                    </div>
                    ${noticeHtml}
                    <p class="drop-hint">Keep this tab open until they have everything. Closing it ends the transfer.</p>
                </div>

                <span class="p2p-label">Receivers</span>
                <ul class="drop-list">${peersHtml}</ul>

                <span class="p2p-label">Files</span>
                <ul class="drop-list">${filesHtml}</ul>
                <label for="drop-file" class="drop-zone drop-zone-slim${dragging ? ' drop-zone-hot' : ''}">
                    <span class="drop-zone-small">${dragging ? 'Let go to add' : '+ Add more files'}</span>
                </label>
                <input id="drop-file" type="file" multiple hidden />
            </div>
        </div>
        </div>`;
    }

    // receive
    const pending = manifest.filter(f => incoming[f.id]?.state === 'idle').length;
    const filesHtml = manifest.length ? manifest.map(f => {
        const inc = incoming[f.id];
        const pct = inc.size ? Math.floor(inc.got / inc.size * 100) : 100;
        const right =
            inc.state === 'done'    ? `<button data-action="drop-save" class="drop-mini drop-mini-ok">Save</button>` :
            inc.state === 'getting' ? `<span class="drop-file-size">${flowing(inc.lastAt) ? `${pct}% ${speed(inc.got - inc.startBytes, inc.startedAt)}` : `stalled at ${pct}%`}</span>` :
            inc.state === 'paused'  ? `<span class="drop-file-size">paused at ${pct}%</span>` :
                                      `<button data-action="drop-get" class="drop-mini">Get</button>`;
        return `
        <li class="drop-file" data-id="${f.id}">
            <div class="drop-file-line">
                <span class="drop-file-name">${escapeHtml(f.name)}</span>
                <span class="drop-file-size">${formatBytes(f.size)}</span>
                ${right}
            </div>
            ${inc.state === 'getting' || inc.state === 'paused' ? bar(inc.got, inc.size) : ''}
        </li>`;
    }).join('') : '<li class="p2p-no-peers">The file list appears once the sender is found.</li>';

    const totalSize = manifest.reduce((a, f) => a + f.size, 0);
    const got = manifest.reduce((a, f) => a + (incoming[f.id].state === 'done' ? f.size : incoming[f.id].got), 0);

    return `
    <div class="p2p-root" data-no-tidy>
    <div class="p2p-chat-container" data-mooli-column>
        ${header('Receiving', manifest.length ? `${manifest.length} file${manifest.length !== 1 ? 's' : ''} · ${formatBytes(totalSize)}` : 'waiting for the list')}
        <div class="drop-body">
            ${wire({ them: 'sender', themOn: !!senderId, youFill: totalSize ? got / totalSize : 0, themFill: senderId ? 1 : 0, flow: courierState() === 'go' ? 'left' : '' })}
            ${noticeHtml}
            <ul class="drop-list">${filesHtml}</ul>
            ${pending ? `<button data-action="drop-get-all" class="p2p-btn p2p-btn-primary">Receive ${pending > 1 ? `all ${pending}` : 'it'}</button>` : ''}
            <p class="drop-hint">Files arrive straight from the sender's browser and are held in memory until saved, so very large files depend on how much your device can hold.</p>
        </div>
    </div>
    </div>`;
}
