// Home: a retro desktop. Every page on the site is an icon; the tools open
// as windows on top of the desktop, articles open as rich-text documents,
// pictures open in an image viewer, the short film opens as an embed, and
// the About window doubles as the old landing page.

import { useEffect, navigate } from '../framework.js';
import { ARTICLES } from './articles/articles-data.js';
import { POSTERS } from '../poster-manifest.js';
import { initJigsawTypography } from '../components/jigsaw.js';
import { ICONS } from '../components/desktop-icons.js';
import { createSfx } from '../components/sfx.js';
import { ARROW, BUSY } from '../components/cursors.js';

// ── Content ──────────────────────────────────────────────────────────

const POSTER_DIR = 'js/pages/projects/posters/assets';
const STORE_KEY = 'prateek-desktop-icons-v1';
const BIN_KEY = 'prateek-desktop-bin-v1';
const WALL_KEY = 'prateek-desktop-wall-v1';
const SOUND_KEY = 'prateek-desktop-sound-v1';
const BOOT_KEY = 'prateek-desktop-booted';     // sessionStorage: once per visit

const BOOT_LINES = [
    'prat.ee BIOS v2.6  (c) 2026 Prateek Kumar Gupta',
    'CPU: two cores, overclocked by enthusiasm',
    'Memory Test: 8192MB ........ OK',
    'Detecting drives',
    '  C: prat.ee/k',
    '  D: side projects (some deceased)',
    'Loading desktop ...',
];

const TOOLS = [
    { id: 'about',   label: 'About Me',                 icon: 'computer', kind: 'about', desc: 'prat.ee/k — Manchester, UK' },
    { id: 'snake',   label: 'Nagmani',                  icon: 'snake',    kind: 'app',   href: '/snake',            desc: 'an Indian gothic snake game' },
    { id: 'p2pchat', label: 'p2p chat',                 icon: 'chat',     kind: 'app',   href: '/p2pchat',          desc: 'a serverless p2p chat' },
    { id: 'bvh',     label: 'BVH Viewer',               icon: 'mocap',    kind: 'app',   href: '/bvhviewer',        desc: 'a BVH motion-capture file viewer' },
    { id: 'think',   label: 'I Think Therefore I Am',   icon: 'bulb',     kind: 'app',   href: '/ithinkthereforiam', desc: 'an infinite thought canvas' },
    { id: 'human',   label: 'Digital Human',            icon: 'human',    kind: 'link',  href: 'https://avatar.sumvivas.com', desc: 'three.js based AI-driven Digital Human' },
    { id: 'film',    label: 'Digital Doppelgänger',     icon: 'film',     kind: 'video', video: 'xPZ85jpZTsw',      desc: 'a short film' },
    { id: 'posters', label: 'Posters',                  icon: 'folder',   kind: 'folder', desc: 'poster art, a hundred-odd of them' },
    { id: 'music',   label: 'Monsoon Protocol',         icon: 'music',    kind: 'audio', track: 'https://soundcloud.com/prateek-gupta-505317056/2026-09-07t16_31_11-216z', desc: 'a song, on SoundCloud' },
];

const SOCIALS = [
    { id: 'instagram', label: 'Instagram', icon: 'camera',   kind: 'link', href: 'https://www.instagram.com/chai.and.photoshop', desc: 'drawings and photographs' },
    { id: 'linkedin',  label: 'LinkedIn',  icon: 'linkedin', kind: 'link', href: 'https://www.linkedin.com/in/prateek-gupta08', desc: 'the professional one' },
    { id: 'mail',      label: 'E-mail',    icon: 'mail',     kind: 'link', href: 'mailto:prateekgupta1198@gmail.com', desc: 'say hello' },
];

// these land at random spots on the desktop, like files someone saved in a hurry
const LINKS = [
    { id: 'hf-movies', label: 'allaimovies',   icon: 'dataset', kind: 'link', href: 'https://huggingface.co/datasets/prateek-0-gupta/allaimovies',               desc: 'dataset: 3,090 films with an AI in them, coded and counted' },
    { id: 'hf-chars',  label: 'ai characters', icon: 'dataset', kind: 'link', href: 'https://huggingface.co/datasets/prateek-0-gupta/allaimovies-ai-characters', desc: 'dataset: 3,263 AI characters from 1,884 films' },
    { id: 'companyhouse', label: 'companyhouse', icon: 'repo', kind: 'link', href: 'https://github.com/prateek-0-gupta/companyhouse',                          desc: 'UK Companies House reports and a director interlock graph' },
    { id: 'aitoy',     label: 'aitoy',         icon: 'robot',   kind: 'link', href: 'https://github.com/prateek-0-gupta/aitoy',                                desc: 'a £20 ESP32-S3 board turned into a push-to-talk voice assistant' },
];

const BIN = { id: 'bin', label: 'Recycle Bin', icon: 'bin', kind: 'bin', desc: 'contains anything you dragged onto it' };

const WALLS = [
    { id: 'aero',   label: 'Aero' },
    { id: 'sunset', label: 'Sunset' },
    { id: 'night',  label: 'Night' },
    { id: 'teal',   label: 'Classic' },
];

const KIND_NAMES = {
    app: 'Application', doc: 'Rich Text Document', link: 'Internet Shortcut', folder: 'File Folder',
    video: 'Video Clip', audio: 'Audio Track', about: 'System', bin: 'System Folder',
};

function writingItems() {
    return ARTICLES.map(a => ({
        id: 'art-' + a.slug,
        label: a.title,
        icon: 'doc',
        kind: 'doc',
        href: `/articles/${a.slug}`,
        desc: a.blurb,
        article: a,
    }));
}

// ── Markup ───────────────────────────────────────────────────────────

function iconEl(item) {
    return `
    <button class="dt-icon" type="button" data-item="${item.id}" data-tip="${escapeAttr(item.desc || item.label)}">
        <span class="dt-icon-img">${ICONS[item.icon]}</span>
        <span class="dt-icon-label">${escapeHtml(item.label)}</span>
    </button>`;
}

function menuItem(item) {
    return `<button class="dt-menu-item" type="button" data-item="${item.id}">
        <span class="dt-menu-ico">${ICONS[item.icon]}</span><span class="dt-menu-text">${escapeHtml(item.label)}</span>
    </button>`;
}

function menuAction(action, icon, label) {
    return `<button class="dt-menu-item" type="button" data-menu="${action}">
        <span class="dt-menu-ico">${ICONS[icon]}</span><span class="dt-menu-text">${label}</span>
    </button>`;
}

function aboutHtml() {
    return `
    <div class="dt-about">
        <div class="dt-banner"><div class="dt-banner-paper"><canvas id="typeCanvas"></canvas></div></div>
        <fieldset class="dt-group">
            <legend>Profile</legend>
            <table class="dt-kv">
                <tr><th>name</th><td>Prateek Kumar Gupta</td></tr>
                <tr><th>does</th><td>software engineer &amp; creative future media practitioner</td></tr>
                <tr><th>now</th><td>AI &amp; Development at Sum Vivas</td></tr>
                <tr><th>where</th><td>Manchester, UK</td></tr>
                <tr><th>builds</th><td>digital humans, small web tools, the occasional cursed snake</td></tr>
            </table>
        </fieldset>
        <fieldset class="dt-group">
            <legend>Links</legend>
            <p class="dt-links">
                <a href="https://www.instagram.com/chai.and.photoshop" target="_blank" rel="noopener">instagram</a> ·
                <a href="https://www.linkedin.com/in/prateek-gupta08" target="_blank" rel="noopener">linkedin</a> ·
                <a href="mailto:prateekgupta1198@gmail.com">e-mail</a> ·
                <a href="https://github.com/prateek-0-gupta" target="_blank" rel="noopener">github</a> ·
                <a href="https://huggingface.co/prateek-0-gupta" target="_blank" rel="noopener">hugging face</a> ·
                <a href="https://soundcloud.com/prateek-gupta-505317056" target="_blank" rel="noopener">soundcloud</a>
            </p>
        </fieldset>
        <p class="dt-fine">double-click an icon to open it. drag icons wherever you like; they stay put. right-click for more.</p>
        <p class="dt-fine">“The best way out is always through.” — Robert Frost</p>
    </div>`;
}

function videoHtml(id) {
    return `<div class="dt-video">
        <iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0" title="Digital Doppelgänger"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;
}

// the SoundCloud player in a little media-player window
function audioHtml(item) {
    const params = new URLSearchParams({
        url: item.track, color: '#1e90d8', auto_play: 'false', hide_related: 'true',
        show_comments: 'false', show_user: 'true', show_reposts: 'false', show_teaser: 'false', visual: 'true',
    });
    return `<div class="dt-audio">
        <iframe src="https://w.soundcloud.com/player/?${params}" title="${escapeAttr(item.label)}"
            allow="autoplay" scrolling="no" frameborder="0"></iframe>
        <p class="dt-audio-foot"><a href="${item.track}" target="_blank" rel="noopener">open on SoundCloud ↗</a></p>
    </div>`;
}

function appHtml(item) {
    // load the app shell with the route as a query, rather than the deep URL:
    // a plain static server has no idea what /k/snake means, but /k/?app=/snake
    // is just index.html, and app.js swaps in the real route before routing
    const src = './?app=' + encodeURIComponent(item.href);
    return `<iframe class="dt-app" src="${src}" title="${escapeAttr(item.label)}" loading="lazy"></iframe>`;
}

// a WordPad-ish document: menu, toolbar, ruler, then the article on a page
function docHtml(item) {
    return `
    <div class="dt-doc">
        <div class="dt-doc-menu"><span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Help</span></div>
        <div class="dt-doc-tools">
            <span class="dt-doc-combo dt-doc-font">Inter</span>
            <span class="dt-doc-combo dt-doc-size">11</span>
            <span class="dt-doc-sep"></span>
            <b class="dt-doc-btn">B</b><i class="dt-doc-btn">I</i><u class="dt-doc-btn">U</u>
            <span class="dt-doc-sep"></span>
            <span class="dt-doc-btn dt-doc-align is-on">≡</span><span class="dt-doc-btn dt-doc-align">≡</span><span class="dt-doc-btn dt-doc-align">≡</span>
        </div>
        <div class="dt-doc-ruler"></div>
        <div class="dt-doc-page"><article class="art-body">${item.article.html}</article></div>
    </div>`;
}

// an Explorer-style folder of thumbnails
function folderHtml(item, images) {
    const files = images.map((pic, i) => `
        <button class="dt-file" type="button" data-index="${i}" data-tip="${escapeAttr(pic.name)}">
            <span class="dt-file-thumb"><img src="${pic.src}" alt="" loading="lazy" decoding="async"></span>
            <span class="dt-file-name">${escapeHtml(pic.name)}</span>
        </button>`).join('');
    return `
    <div class="dt-folder">
        <div class="dt-folder-bar">
            <span class="dt-folder-nav"><span>◀</span><span>▶</span><span>▲</span></span>
            <span class="dt-folder-addr-label">Address</span>
            <span class="dt-folder-addr">${ICONS.folder}<span>C:\\Prateek\\${escapeHtml(item.label)}</span></span>
        </div>
        <div class="dt-folder-grid">${files}</div>
    </div>`;
}

function viewerHtml() {
    return `
    <div class="dt-viewer">
        <div class="dt-viewer-tools">
            <button type="button" data-v="prev" data-tip="Previous (←)">◀</button>
            <span class="dt-viewer-count"></span>
            <button type="button" data-v="next" data-tip="Next (→)">▶</button>
            <span class="dt-doc-sep"></span>
            <button type="button" data-v="fit" class="is-on" data-tip="Fit to window">Fit</button>
            <button type="button" data-v="actual" data-tip="Actual size">1:1</button>
            <span class="dt-viewer-name"></span>
        </div>
        <div class="dt-viewer-stage"><img alt=""></div>
        <div class="dt-viewer-cap"></div>
    </div>`;
}

function binHtml(binned) {
    if (!binned.length) {
        return `<div class="dt-bin-empty">
            <p>The Recycle Bin is empty.</p>
            <p class="dt-fine">Nothing here. Some things never were. Drag an icon onto the bin to change that.</p>
        </div>`;
    }
    return `<div class="dt-bin">
        <div class="dt-bin-list">${binned.map(it => `
            <div class="dt-bin-row">
                <span class="dt-bin-ico">${ICONS[it.icon]}</span>
                <span class="dt-bin-name">${escapeHtml(it.label)}</span>
                <button type="button" class="dt-btn" data-restore="${it.id}">Restore</button>
            </div>`).join('')}
        </div>
        <div class="dt-bin-foot"><button type="button" class="dt-btn" data-restore="*">Restore all</button></div>
    </div>`;
}

function propsHtml(item, type, where) {
    const link = /^(https?:|mailto:)/.test(where)
        ? `<a href="${escapeAttr(where)}" target="_blank" rel="noopener">${escapeHtml(where)}</a>`
        : escapeHtml(where);
    return `
    <div class="dt-dialog dt-props">
        <div class="dt-dialog-body">
            <div class="dt-props-head">${ICONS[item.icon]}<span class="dt-props-name">${escapeHtml(item.label)}</span></div>
            <table class="dt-kv">
                <tr><th>Type</th><td>${type}</td></tr>
                <tr><th>Location</th><td>${link}</td></tr>
                <tr><th>Description</th><td>${escapeHtml(item.desc || '—')}</td></tr>
            </table>
        </div>
        <div class="dt-dialog-foot"><button type="button" class="dt-btn is-default" data-act="close">OK</button></div>
    </div>`;
}

function displayHtml(current) {
    return `
    <div class="dt-dialog dt-display">
        <div class="dt-monitor"><div class="dt-monitor-screen" data-wall="${current}"></div></div>
        <div class="dt-walls">${WALLS.map(w => `
            <button type="button" class="dt-wall${w.id === current ? ' is-on' : ''}" data-wall="${w.id}" data-tip="${w.label}"><span>${w.label}</span></button>`).join('')}
        </div>
        <div class="dt-dialog-foot"><button type="button" class="dt-btn is-default" data-act="close">OK</button></div>
    </div>`;
}

export default function Home() {
    const writings = writingItems();
    const items = [...TOOLS, ...writings, ...SOCIALS, ...LINKS, BIN];
    let booted = true;
    try { booted = !!sessionStorage.getItem(BOOT_KEY); } catch { /* fine */ }

    useEffect(() => initDesktop(items, writings), []);

    // the whole desktop opts out of DOM morphing: it never re-renders, and
    // a hash change (a link inside a document) must not wipe open windows
    return `
    <div class="desktop${booted ? '' : ' is-booting'}" id="desktop" data-morph-ignore>
        <div class="dt-boot" id="dt-boot"${booted ? ' hidden' : ''}>
            <pre class="dt-boot-post" id="dt-boot-post"></pre>
            <div class="dt-boot-logo" id="dt-boot-logo" hidden>
                <div class="dt-boot-word">prat.ee<span>/k</span></div>
                <div class="dt-boot-bar"><i></i><i></i><i></i></div>
                <div class="dt-boot-hint">click to skip</div>
            </div>
        </div>
        <div class="dt-snap" id="dt-snap" hidden></div>
        <div class="dt-icons" id="dt-icons">${items.map(iconEl).join('')}</div>

        <div class="dt-windows" id="dt-windows"></div>

        <div class="dt-startmenu" id="dt-startmenu" hidden>
            <div class="dt-menu-side"><span>prat.ee/k</span></div>
            <div class="dt-menu-list">
                ${menuItem(TOOLS[0])}
                <hr>
                ${TOOLS.slice(1).map(menuItem).join('')}
                <hr>
                ${writings.map(menuItem).join('')}
                <hr>
                ${LINKS.map(menuItem).join('')}
                ${SOCIALS.map(menuItem).join('')}
                <hr>
                ${menuAction('display', 'display', 'Display Properties…')}
                ${menuAction('arrange', 'pictures', 'Arrange Icons')}
                ${menuAction('shutdown', 'power', 'Shut Down…')}
            </div>
        </div>

        <div class="dt-taskbar">
            <button class="dt-start" type="button" id="dt-start" data-tip="Click here to begin">${ICONS.logo}<span>start</span></button>
            <div class="dt-tasks" id="dt-tasks"></div>
            <div class="dt-tray">
                <span class="dt-tray-note">Manchester, UK</span>
                <button class="dt-tray-btn" type="button" id="dt-sound" data-tip="Sounds are off" aria-pressed="false">${ICONS.speakerOff}</button>
                <button class="dt-clock" type="button" id="dt-clock" data-tip=""></button>
            </div>
        </div>

        <div class="dt-cal" id="dt-cal" hidden>
            <div class="dt-cal-head">
                <button type="button" data-cal="-1" aria-label="Previous month">◀</button>
                <span class="dt-cal-title" id="dt-cal-title"></span>
                <button type="button" data-cal="1" aria-label="Next month">▶</button>
            </div>
            <div class="dt-cal-grid" id="dt-cal-grid"></div>
        </div>

        <div class="dt-ctx" id="dt-ctx" hidden role="menu"></div>
        <div class="dt-tip" id="dt-tip" hidden role="tooltip"></div>

        <div class="dt-off" id="dt-off" hidden>
            <p>It's now safe to turn off your computer.</p>
            <p class="dt-off-hint">(click anywhere to turn it back on)</p>
        </div>
    </div>`;
}

// ── Desktop behaviour ────────────────────────────────────────────────

function initDesktop(items, writings) {
    const desktop = document.getElementById('desktop');
    if (!desktop) return () => {};

    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    const iconsRoot = document.getElementById('dt-icons');
    const winRoot = document.getElementById('dt-windows');
    const tasks = document.getElementById('dt-tasks');
    const startBtn = document.getElementById('dt-start');
    const startMenu = document.getElementById('dt-startmenu');
    const clock = document.getElementById('dt-clock');
    const off = document.getElementById('dt-off');
    const ctx = document.getElementById('dt-ctx');
    const tip = document.getElementById('dt-tip');
    const boot = document.getElementById('dt-boot');
    const snap = document.getElementById('dt-snap');
    const cal = document.getElementById('dt-cal');
    const soundBtn = document.getElementById('dt-sound');

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = () => window.innerWidth < 720;
    const cleanups = [];
    const on = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); cleanups.push(() => el.removeEventListener(ev, fn, opts)); };
    const store = {
        get(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode, fine */ } },
        del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
    };

    const windows = new Map();     // id -> { el, task, item, ... }
    let z = 10;
    let cascade = 0;
    const pointer = { x: 0, y: 0 };
    on(desktop, 'pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });

    // Web Animations helper that respects reduced motion and resolves when done
    function animate(el, frames, ms, easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)') {
        if (reduced || !el.animate) return Promise.resolve();
        return el.animate(frames, { duration: ms, easing }).finished.catch(() => {});
    }

    // ── Sounds: off by default, the speaker in the tray turns them on ──
    const sfx = createSfx();
    let chimed = false;
    function setSound(onNow) {
        sfx.enabled = onNow;
        store.set(SOUND_KEY, onNow);
        soundBtn.innerHTML = onNow ? ICONS.speaker : ICONS.speakerOff;
        soundBtn.dataset.tip = onNow ? 'Sounds are on' : 'Sounds are off';
        soundBtn.setAttribute('aria-pressed', String(onNow));
    }
    setSound(store.get(SOUND_KEY, false));
    on(soundBtn, 'click', () => { setSound(!sfx.enabled); if (sfx.enabled) { sfx.play('chime'); chimed = true; } });
    // the log-on chime waits for the first gesture if the browser had it muted
    const firstGesture = () => { sfx.unlock(); if (sfx.enabled && !chimed && !booting) { chimed = true; sfx.play('chime'); } };
    on(desktop, 'pointerdown', firstGesture, true);
    on(document, 'keydown', firstGesture, true);

    // ── Cursors: the Aero arrow everywhere, the spinning ring while a tool loads ──
    desktop.style.setProperty('--cur-arrow', ARROW);
    let busyCount = 0, busyFrame = 0, busyTimer = null;
    function setBusy(onNow) {
        busyCount = Math.max(0, busyCount + (onNow ? 1 : -1));
        if (busyCount > 0 && !busyTimer) {
            busyTimer = setInterval(() => { busyFrame = (busyFrame + 1) % BUSY.length; desktop.style.cursor = `${BUSY[busyFrame]}, progress`; }, 90);
            desktop.style.cursor = `${BUSY[0]}, progress`;
        } else if (busyCount === 0 && busyTimer) {
            clearInterval(busyTimer); busyTimer = null;
            desktop.style.cursor = '';
        }
    }
    cleanups.push(() => { if (busyTimer) clearInterval(busyTimer); });

    // ── Boot: a POST screen, then the logo and a progress bar, once per visit ──
    let booting = desktop.classList.contains('is-booting');
    const bootTimers = [];
    cleanups.push(() => bootTimers.forEach(clearTimeout));
    function finishBoot() {
        if (!booting) return;
        booting = false;
        bootTimers.forEach(clearTimeout);
        try { sessionStorage.setItem(BOOT_KEY, '1'); } catch { /* fine */ }
        desktop.classList.remove('is-booting');
        animate(boot, [{ opacity: 1 }, { opacity: 0 }], reduced ? 0 : 500, 'ease-in').then(() => { boot.hidden = true; });
        if (sfx.enabled && !chimed) { chimed = true; sfx.play('chime'); }
        bootTimers.push(setTimeout(() => open('about'), 350));
    }
    if (booting) {
        const post = document.getElementById('dt-boot-post');
        const logo = document.getElementById('dt-boot-logo');
        const step = reduced ? 40 : 170;
        BOOT_LINES.forEach((line, i) => bootTimers.push(setTimeout(() => { post.textContent += line + '\n'; }, 120 + i * step)));
        bootTimers.push(setTimeout(() => { post.hidden = true; logo.hidden = false; }, 120 + BOOT_LINES.length * step + 250));
        bootTimers.push(setTimeout(finishBoot, 120 + BOOT_LINES.length * step + (reduced ? 400 : 1500)));
        on(boot, 'click', finishBoot);
        on(document, 'keydown', e => { if (booting && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) finishBoot(); });
    }

    // ── Calendar: click the clock ──
    let calMonth = null;      // Date at the first of the shown month
    function renderCal() {
        const today = new Date();
        const y = calMonth.getFullYear(), m = calMonth.getMonth();
        document.getElementById('dt-cal-title').textContent = calMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
        const first = (new Date(y, m, 1).getDay() + 6) % 7;      // Monday first
        const days = new Date(y, m + 1, 0).getDate();
        const prevDays = new Date(y, m, 0).getDate();
        let html = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<span class="dt-cal-dow">${d}</span>`).join('');
        for (let i = 0; i < 42; i++) {
            const n = i - first + 1;
            if (n < 1) html += `<span class="dt-cal-day is-other">${prevDays + n}</span>`;
            else if (n > days) html += `<span class="dt-cal-day is-other">${n - days}</span>`;
            else {
                const isToday = n === today.getDate() && m === today.getMonth() && y === today.getFullYear();
                html += `<span class="dt-cal-day${isToday ? ' is-today' : ''}${i % 7 >= 5 ? ' is-weekend' : ''}">${n}</span>`;
            }
        }
        document.getElementById('dt-cal-grid').innerHTML = html;
    }
    function openCal() { hideMenu(); closeStart(); calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCal(); cal.hidden = false; }
    function closeCal() { cal.hidden = true; }
    on(clock, 'click', () => (cal.hidden ? openCal() : closeCal()));
    on(cal, 'click', e => {
        const b = e.target.closest('[data-cal]');
        if (b) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + +b.dataset.cal, 1); renderCal(); }
    });

    // ── Keyboard shortcuts ──
    const typing = t => t && (t.matches?.('input, textarea, select, [contenteditable]') || t.closest?.('.win-body'));
    function nearestIcon(from, key) {
        const a = from.getBoundingClientRect();
        const cx = a.left + a.width / 2, cy = a.top + a.height / 2;
        let best = null, bestScore = Infinity;
        Object.values(iconEls).forEach(el => {
            if (el === from || el.classList.contains('is-binned')) return;
            const b = el.getBoundingClientRect();
            const dx = (b.left + b.width / 2) - cx, dy = (b.top + b.height / 2) - cy;
            const along = key === 'ArrowLeft' ? -dx : key === 'ArrowRight' ? dx : key === 'ArrowUp' ? -dy : dy;
            const across = (key === 'ArrowLeft' || key === 'ArrowRight') ? Math.abs(dy) : Math.abs(dx);
            if (along <= 8) return;                                   // not in that direction
            const score = along + across * 2.5;
            if (score < bestScore) { bestScore = score; best = el; }
        });
        return best;
    }
    on(document, 'keydown', e => {
        if (booting) return;
        const t = e.target;
        if (e.key === 'F5' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); refreshDesktop(); return; }
        if ((e.key === 'Escape' && e.ctrlKey) || (e.key === 'Meta' && !e.repeat)) { e.preventDefault(); startMenu.hidden ? openStart() : closeStart(); return; }
        if (e.key === 'Escape') { closeCal(); closeStart(); hideMenu(); const dlg = activeWindow(); if (dlg && dlg.el.classList.contains('is-dialog')) close(dlg); return; }
        if (e.key === 'F4' && e.altKey) { e.preventDefault(); const rec = activeWindow(); if (rec) close(rec); return; }
        if (typing(t)) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            Object.values(iconEls).forEach(el => { if (!el.classList.contains('is-binned')) el.classList.add('is-selected'); });
            return;
        }
        if (e.key.startsWith('Arrow')) {
            const current = t.closest?.('.dt-icon') || desktop.querySelector('.dt-icon.is-selected');
            if (!current) return;
            if (t.closest?.('.win')) return;                         // a window has the keyboard
            e.preventDefault();
            const next = nearestIcon(current, e.key);
            if (next) { selectIcon(next); next.focus({ preventScroll: true }); }
        }
    });
    const activeWindow = () => [...windows.values()].find(r => !r.min && r.el.classList.contains('is-active'));

    // ── Clock ──
    function tick() {
        const d = new Date();
        clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        clock.dataset.tip = d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    tick();
    const clockTimer = setInterval(tick, 10000);
    cleanups.push(() => clearInterval(clockTimer));

    // ── Wallpaper ──
    function setWall(id) {
        if (!WALLS.some(w => w.id === id)) id = 'aero';
        desktop.dataset.wall = id;
        store.set(WALL_KEY, id);
        desktop.querySelectorAll('.dt-monitor-screen').forEach(m => { m.dataset.wall = id; });
        desktop.querySelectorAll('.dt-wall').forEach(b => b.classList.toggle('is-on', b.dataset.wall === id));
    }
    setWall(store.get(WALL_KEY, 'aero'));

    // ── Icon layout: columns for the regulars, random spots for the links, remembered once moved ──
    const ICON_W = 92, ICON_H = 92, COL = 98, ROW = 98;
    const area = () => ({ w: desktop.clientWidth, h: desktop.clientHeight - 34 });
    const iconEls = Object.fromEntries([...desktop.querySelectorAll('.dt-icon')].map(el => [el.dataset.item, el]));

    function defaultLayout() {
        const a = area();
        const pos = {};
        const columns = [TOOLS, writings, SOCIALS];
        columns.forEach((col, c) => col.forEach((it, r) => { pos[it.id] = { x: 12 + c * COL, y: 12 + r * ROW }; }));
        pos[BIN.id] = { x: a.w - ICON_W - 12, y: a.h - ICON_H - 12 };

        // scatter the links across the free space, avoiding each other and
        // the patch where the About window opens
        const taken = Object.values(pos).map(p => ({ ...p }));
        for (let x = (a.w - 560) / 2 - 60; x < (a.w + 560) / 2 - 60; x += COL) {
            for (let y = (a.h - 470) / 2 - 30; y < (a.h + 470) / 2 - 30; y += ROW) taken.push({ x, y });
        }
        const left = 12 + columns.length * COL + 40;
        const right = Math.max(left + 40, a.w - ICON_W - 140);
        const bottom = Math.max(60, a.h - ICON_H - 40);
        LINKS.forEach(it => {
            let p, tries = 0;
            do {
                p = { x: Math.round(left + Math.random() * (right - left)), y: Math.round(12 + Math.random() * (bottom - 12)) };
                tries++;
            } while (tries < 80 && taken.some(t => Math.abs(t.x - p.x) < COL + 8 && Math.abs(t.y - p.y) < ROW + 8));
            pos[it.id] = p;
            taken.push(p);
        });
        return pos;
    }

    function savePositions() { store.set(STORE_KEY, positions); }
    function place(id) {
        const el = iconEls[id], p = positions[id];
        if (!el || !p) return;
        const a = area();
        p.x = clamp(p.x, 0, Math.max(0, a.w - ICON_W));
        p.y = clamp(p.y, 0, Math.max(0, a.h - ICON_H));
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';
    }

    const stored = store.get(STORE_KEY, null);
    let positions = { ...defaultLayout(), ...(stored || {}) };
    Object.keys(iconEls).forEach(place);
    if (!stored) savePositions();          // so the random spots stay where they landed

    function arrangeIcons() {
        store.del(STORE_KEY);
        positions = defaultLayout();
        Object.keys(iconEls).forEach(place);
        savePositions();
        restoreItems('*');
    }

    async function refreshDesktop() {
        // the pointless-but-satisfying F5: everything blinks once
        await animate(iconsRoot, [{ opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }], 220, 'ease-in-out');
    }

    // ── Recycle bin: drag an icon onto it and it goes in; restore from the bin window ──
    const binned = new Set(store.get(BIN_KEY, []).filter(id => byId[id] && id !== BIN.id));
    const binWindowRefresh = () => {
        const rec = windows.get(BIN.id);
        if (rec) rec.el.querySelector('.win-body').innerHTML = binHtml([...binned].map(id => byId[id]));
    };
    function syncBin() {
        store.set(BIN_KEY, [...binned]);
        iconEls[BIN.id].querySelector('.dt-icon-img').innerHTML = binned.size ? ICONS.binFull : ICONS.bin;
        iconEls[BIN.id].dataset.tip = binned.size ? `${binned.size} item${binned.size === 1 ? '' : 's'} inside` : BIN.desc;
        binWindowRefresh();
    }
    binned.forEach(id => iconEls[id].classList.add('is-binned'));
    syncBin();

    async function binItems(ids) {
        ids = ids.filter(id => id !== BIN.id && id !== 'about' && iconEls[id] && !binned.has(id));
        if (!ids.length) return;
        const target = iconEls[BIN.id].getBoundingClientRect();
        await Promise.all(ids.map(id => {
            const el = iconEls[id];
            const from = el.getBoundingClientRect();
            const dx = (target.left + target.width / 2) - (from.left + from.width / 2);
            const dy = (target.top + target.height / 2) - (from.top + from.height / 2);
            return animate(el, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 }], 260, 'cubic-bezier(0.4, 0, 0.6, 1)');
        }));
        ids.forEach(id => { iconEls[id].classList.add('is-binned'); iconEls[id].classList.remove('is-selected'); binned.add(id); });
        animate(iconEls[BIN.id], [{ transform: 'scale(1.15)' }, { transform: 'none' }], 200);
        sfx.play('ding');
        syncBin();
    }
    function restoreItems(ids) {
        const list = ids === '*' ? [...binned] : ids;
        list.forEach(id => {
            binned.delete(id);
            const el = iconEls[id];
            if (!el) return;
            el.classList.remove('is-binned');
            animate(el, [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], 220);
        });
        syncBin();
    }
    const overBin = (x, y) => {
        const r = iconEls[BIN.id].getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    // ── Tooltips: anything with data-tip, after a short hover ──
    let tipTarget = null, tipTimer = null;
    function showTip(text, x, y) {
        tip.textContent = text;
        tip.hidden = false;
        const d = desktop.getBoundingClientRect();
        const w = tip.offsetWidth, h = tip.offsetHeight;
        let left = x - d.left + 12, top = y - d.top + 20;
        if (left + w > d.width - 8) left = d.width - w - 8;
        if (top + h > d.height - 40) top = y - d.top - h - 10;
        tip.style.left = Math.max(4, left) + 'px';
        tip.style.top = Math.max(4, top) + 'px';
    }
    function hideTip() { clearTimeout(tipTimer); tipTimer = null; tipTarget = null; tip.hidden = true; }
    on(desktop, 'pointerover', e => {
        if (e.pointerType === 'touch') return;
        const t = e.target.closest('[data-tip]');
        if (!t || t === tipTarget) return;
        hideTip();
        tipTarget = t;
        tipTimer = setTimeout(() => { if (tipTarget === t && t.isConnected) showTip(t.dataset.tip, pointer.x, pointer.y); }, 550);
    });
    on(desktop, 'pointerout', e => {
        const t = e.target.closest('[data-tip]');
        if (t && t === tipTarget && !(e.relatedTarget && t.contains(e.relatedTarget))) hideTip();
    });
    on(desktop, 'pointerdown', hideTip, true);
    on(desktop, 'wheel', hideTip, { passive: true, capture: true });

    // a one-off floating note, used for "Copied"
    function flash(text) {
        hideTip();
        showTip(text, pointer.x, pointer.y);
        tipTimer = setTimeout(hideTip, 1100);
    }

    // ── Context menu ──
    let ctxEntries = [];
    function showMenu(x, y, entries) {
        closeStart();
        closeCal();
        hideTip();
        sfx.play('menu');
        ctxEntries = entries;
        ctx.innerHTML = entries.map((e, i) => e === '-' ? '<hr>' : `
            <button type="button" class="dt-ctx-item${e.bold ? ' is-bold' : ''}${e.disabled ? ' is-disabled' : ''}" data-i="${i}" role="menuitem">
                <span class="dt-ctx-ico">${e.icon ? ICONS[e.icon] : ''}</span><span>${escapeHtml(e.label)}</span>
            </button>`).join('');
        ctx.hidden = false;
        const d = desktop.getBoundingClientRect();
        let left = x - d.left, top = y - d.top;
        if (left + ctx.offsetWidth > d.width - 4) left = Math.max(4, left - ctx.offsetWidth);
        if (top + ctx.offsetHeight > d.height - 36) top = Math.max(4, top - ctx.offsetHeight);
        ctx.style.left = left + 'px';
        ctx.style.top = top + 'px';
        ctx.querySelector('.dt-ctx-item:not(.is-disabled)')?.focus({ preventScroll: true });
    }
    function hideMenu() { ctx.hidden = true; ctxEntries = []; }
    on(ctx, 'click', e => {
        const b = e.target.closest('[data-i]');
        if (!b || b.classList.contains('is-disabled')) return;
        const entry = ctxEntries[+b.dataset.i];
        hideMenu();
        entry?.run?.();
    });
    on(desktop, 'pointerdown', e => { if (!e.target.closest('.dt-ctx')) hideMenu(); }, true);
    on(window, 'blur', hideMenu);

    const siteUrl = href => /^(https?:|mailto:)/.test(href) ? href : location.origin + '/k' + href;
    const copyText = async text => {
        try { await navigator.clipboard.writeText(text); flash('Copied'); } catch { flash(text); }
    };

    function iconMenu(item) {
        const list = [{ label: 'Open', bold: true, icon: item.icon, run: () => open(item.id) }];
        if (item.kind === 'app' || item.kind === 'doc') list.push({ label: 'Open full page', run: () => navigate(item.href) });
        if (item.href) list.push({ label: 'Copy link', run: () => copyText(siteUrl(item.href)) });
        if (item.track) list.push({ label: 'Copy link', run: () => copyText(item.track) });
        list.push('-');
        if (item.id === BIN.id) {
            list.push({ label: 'Restore all', disabled: !binned.size, run: () => restoreItems('*') });
        } else if (item.id !== 'about') {
            const sel = selectedIds().filter(id => id !== BIN.id && id !== 'about');
            const group = sel.includes(item.id) ? sel : [item.id];
            list.push({ label: group.length > 1 ? `Delete (${group.length} items)` : 'Delete', run: () => binItems(group) });
        }
        list.push('-', { label: 'Properties', run: () => openProps(item) });
        return list;
    }
    function desktopMenu() {
        return [
            { label: 'Arrange Icons', icon: 'pictures', run: arrangeIcons },
            { label: 'Refresh', run: refreshDesktop },
            '-',
            { label: 'Restore from Recycle Bin', disabled: !binned.size, run: () => restoreItems('*') },
            { label: 'Display Properties…', icon: 'display', run: openDisplay },
            '-',
            { label: 'About Me', icon: 'computer', run: () => open('about') },
        ];
    }
    function windowMenu(rec) {
        return [
            { label: 'Restore', disabled: !rec.max && !rec.min, run: () => { if (rec.min) { restore(rec); focus(rec); } else maximise(rec); } },
            { label: 'Minimise', disabled: rec.min, run: () => minimise(rec) },
            { label: 'Maximise', disabled: rec.max, run: () => { restore(rec); if (!rec.max) maximise(rec); focus(rec); } },
            '-',
            { label: 'Close', bold: true, run: () => close(rec) },
        ];
    }
    function taskbarMenu() {
        const open = [...windows.values()];
        return [
            { label: 'Cascade Windows', disabled: !open.length, run: cascadeWindows },
            { label: 'Show the Desktop', disabled: !open.some(r => !r.min), run: () => open.forEach(r => minimise(r)) },
            { label: 'Undo Show the Desktop', disabled: !open.some(r => r.min), run: () => open.forEach(r => { restore(r); }) },
            '-',
            { label: 'Display Properties…', icon: 'display', run: openDisplay },
        ];
    }
    function contextFor(target, x, y) {
        const icon = target.closest('.dt-icon');
        if (icon) { if (!icon.classList.contains('is-selected')) selectIcon(icon); return iconMenu(byId[icon.dataset.item]); }
        const title = target.closest('.win-title');
        if (title) { const rec = windows.get(title.closest('.win').dataset.win); return rec ? windowMenu(rec) : null; }
        const task = target.closest('.dt-task');
        if (task) { const rec = [...windows.values()].find(r => r.task === task); return rec ? windowMenu(rec) : null; }
        if (target.closest('.dt-taskbar')) return taskbarMenu();
        if (target.closest('.win, .dt-startmenu, .dt-ctx')) return null;
        selectIcon(null);
        return desktopMenu();
    }
    on(desktop, 'contextmenu', e => {
        if (e.target.closest('.win-body')) return;          // documents and apps keep the browser's own menu
        const entries = contextFor(e.target, e.clientX, e.clientY);
        if (!entries) return;
        e.preventDefault();
        showMenu(e.clientX, e.clientY, entries);
    });
    // long-press on touch does the same
    let pressTimer = null;
    on(desktop, 'pointerdown', e => {
        if (e.pointerType !== 'touch') return;
        const target = e.target;
        pressTimer = setTimeout(() => {
            const entries = contextFor(target, e.clientX, e.clientY);
            if (entries) { suppressClick = true; showMenu(e.clientX, e.clientY, entries); }
        }, 550);
    });
    const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };
    on(desktop, 'pointerup', cancelPress);
    on(desktop, 'pointercancel', cancelPress);
    on(desktop, 'pointermove', e => { if (pressTimer && e.pointerType === 'touch') cancelPress(); });
    let suppressClick = false;

    // ── Icons: select on click, open on double-click (single tap on touch), drag anywhere ──
    const selectedIds = () => [...desktop.querySelectorAll('.dt-icon.is-selected')].map(el => el.dataset.item);
    function selectIcon(el, add = false) {
        if (!add) desktop.querySelectorAll('.dt-icon.is-selected').forEach(i => { if (i !== el) i.classList.remove('is-selected'); });
        if (el) el.classList.toggle('is-selected', add ? !el.classList.contains('is-selected') : true);
    }

    let lastPointer = coarse ? 'touch' : 'mouse';
    on(desktop, 'pointerdown', e => { lastPointer = e.pointerType || lastPointer; }, true);

    let skipClear = false;                     // set by a marquee so its pointerup click keeps the selection
    on(desktop, 'click', e => {
        if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
        const icon = e.target.closest('.dt-icon');
        if (icon) {
            if (icon.dataset.dragged) { delete icon.dataset.dragged; return; }
            selectIcon(icon, e.ctrlKey || e.metaKey);
            sfx.play('click');
            if (lastPointer === 'touch' || lastPointer === 'pen') open(icon.dataset.item);
            return;
        }
        if (skipClear) { skipClear = false; return; }
        if (!e.target.closest('.win, .dt-taskbar, .dt-startmenu, .dt-ctx')) selectIcon(null);
        if (!e.target.closest('.dt-startmenu, #dt-start')) closeStart();
        if (!e.target.closest('.dt-cal, #dt-clock')) closeCal();
    });
    on(desktop, 'dblclick', e => {
        const icon = e.target.closest('.dt-icon');
        if (icon) open(icon.dataset.item);
    });
    on(desktop, 'keydown', e => {
        if (e.key === 'Escape') { closeStart(); hideMenu(); return; }
        const icon = e.target.closest('.dt-icon');
        if (!icon) return;
        if (e.key === 'Enter') open(icon.dataset.item);
        if (e.key === 'Delete') binItems(selectedIds().length ? selectedIds() : [icon.dataset.item]);
    });

    // dragging one selected icon drags the whole selection; drop on the bin to delete
    Object.entries(iconEls).forEach(([id, icon]) => {
        let group = [], starts = {};
        drag(icon, {
            start() {
                if (small()) return false;
                if (!icon.classList.contains('is-selected')) selectIcon(icon);
                group = selectedIds();
                starts = Object.fromEntries(group.map(g => [g, { ...positions[g] }]));
            },
            move(dx, dy) {
                group.forEach(g => { positions[g] = { x: starts[g].x + dx, y: starts[g].y + dy }; place(g); });
                if (id !== BIN.id) iconEls[BIN.id].classList.toggle('is-drop', overBin(pointer.x, pointer.y));
            },
            end(moved) {
                iconEls[BIN.id].classList.remove('is-drop');
                if (!moved) return;
                icon.dataset.dragged = '1';
                if (id !== BIN.id && overBin(pointer.x, pointer.y)) {
                    group.forEach(g => { positions[g] = starts[g]; place(g); });
                    binItems(group);
                } else {
                    savePositions();
                }
            },
        });
    });

    // rubber-band selection on the empty desktop
    const marquee = document.createElement('div');
    marquee.className = 'dt-marquee';
    marquee.hidden = true;
    iconsRoot.appendChild(marquee);
    {
        let sx = 0, sy = 0, active = false, moved = false;
        const d = () => desktop.getBoundingClientRect();
        on(iconsRoot, 'pointerdown', e => {
            if (e.target !== iconsRoot || e.button !== 0 || small()) return;
            active = true; moved = false; sx = e.clientX; sy = e.clientY;
            iconsRoot.setPointerCapture?.(e.pointerId);
        });
        on(iconsRoot, 'pointermove', e => {
            if (!active) return;
            const x1 = Math.min(sx, e.clientX), y1 = Math.min(sy, e.clientY), x2 = Math.max(sx, e.clientX), y2 = Math.max(sy, e.clientY);
            if (!moved && Math.hypot(x2 - x1, y2 - y1) < 4) return;
            moved = true;
            const b = d();
            marquee.hidden = false;
            Object.assign(marquee.style, { left: x1 - b.left + 'px', top: y1 - b.top + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
            Object.values(iconEls).forEach(el => {
                if (el.classList.contains('is-binned')) return;
                const r = el.getBoundingClientRect();
                el.classList.toggle('is-selected', r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1);
            });
        });
        const stop = e => {
            if (!active) return;
            active = false;
            marquee.hidden = true;
            iconsRoot.releasePointerCapture?.(e.pointerId);
            if (moved) skipClear = true;
        };
        on(iconsRoot, 'pointerup', stop);
        on(iconsRoot, 'pointercancel', stop);
    }

    // ── Start menu ──
    function openStart() { hideMenu(); closeCal(); sfx.play('click'); startMenu.hidden = false; startBtn.classList.add('is-down'); }
    function closeStart() { startMenu.hidden = true; startBtn.classList.remove('is-down'); }
    on(startBtn, 'click', () => (startMenu.hidden ? openStart() : closeStart()));
    on(startMenu, 'click', e => {
        const item = e.target.closest('[data-item]');
        if (item) { closeStart(); open(item.dataset.item); return; }
        const action = e.target.closest('[data-menu]');
        if (!action) return;
        closeStart();
        if (action.dataset.menu === 'shutdown') shutDown();
        if (action.dataset.menu === 'arrange') arrangeIcons();
        if (action.dataset.menu === 'display') openDisplay();
    });

    function shutDown() {
        off.hidden = false;
        const back = () => { off.hidden = true; off.removeEventListener('click', back); };
        off.addEventListener('click', back);
    }

    // ── Opening things ──
    function open(id) {
        const item = byId[id];
        if (!item) return;
        const el = iconEls[id];
        if (el) animate(el.querySelector('.dt-icon-img'), [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], 220);
        switch (item.kind) {
            case 'link':    window.open(item.href, '_blank', 'noopener'); break;
            case 'page':    navigate(item.href); break;
            case 'about':   openWindow(item, { body: aboutHtml(), w: 560, h: 470, jigsaw: true }); break;
            case 'video':   openWindow(item, { body: videoHtml(item.video), w: 800, h: 480, cls: 'is-video' }); break;
            case 'audio':   openWindow(item, { body: audioHtml(item), w: 520, h: 420, cls: 'is-audio' }); break;
            case 'bin':     openBin(); break;
            case 'app':     openWindow(item, { body: appHtml(item), w: 980, h: 640, cls: 'is-app', full: item.href }); break;
            case 'doc':     openDoc(item); break;
            case 'folder':  openFolder(item, POSTERS.map(p => ({ src: `${POSTER_DIR}/${p.file}`, name: p.file }))); break;
        }
    }

    function openBin() {
        if (windows.has(BIN.id)) { openWindow(BIN, {}); return; }
        const rec = openWindow(BIN, { body: binHtml([...binned].map(id => byId[id])), w: 420, h: 300 });
        rec.el.querySelector('.win-body').addEventListener('click', e => {
            const b = e.target.closest('[data-restore]');
            if (b) restoreItems(b.dataset.restore === '*' ? '*' : [b.dataset.restore]);
        });
    }

    function openProps(item) {
        const type = KIND_NAMES[item.kind] || 'File';
        const where = item.href ? siteUrl(item.href) : item.track || `C:\\Prateek\\${item.label}`;
        openWindow({ id: 'props-' + item.id, label: `${item.label} Properties`, icon: item.icon, desc: type },
            { body: propsHtml(item, type, where), w: 400, h: 320, cls: 'is-dialog' });
    }

    function openDisplay() {
        const item = { id: 'display', label: 'Display Properties', icon: 'display', desc: 'pick a wallpaper' };
        if (windows.has(item.id)) { openWindow(item, {}); return; }
        const rec = openWindow(item, { body: displayHtml(desktop.dataset.wall), w: 320, h: 330, cls: 'is-dialog' });
        rec.el.querySelector('.dt-walls').addEventListener('click', e => {
            const b = e.target.closest('[data-wall]');
            if (b) setWall(b.dataset.wall);
        });
    }

    function openDoc(item) {
        if (windows.has(item.id)) { openWindow(item, {}); return; }
        const rec = openWindow(item, { body: docHtml(item), w: 860, h: 640, cls: 'is-doc', full: item.href, icon: 'wordpad' });
        const page = rec.el.querySelector('.dt-doc-page');
        // links inside the document stay inside the desktop: other articles
        // open as documents, contents links scroll the page, pictures open
        // in the viewer. stopPropagation keeps the router's body handler out.
        page.addEventListener('click', e => {
            const a = e.target.closest('a');
            if (a) {
                const href = a.getAttribute('href') || '';
                if (href.startsWith('#')) {
                    e.preventDefault(); e.stopPropagation();
                    const target = page.querySelector(`[id="${CSS.escape(href.slice(1))}"]`);
                    if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
                    return;
                }
                const m = href.match(/^\/articles\/([^/?#]+)/);
                if (m && byId['art-' + m[1]]) {
                    e.preventDefault(); e.stopPropagation();
                    open('art-' + m[1]);
                }
                return;
            }
            const img = e.target.closest('img');
            if (img && !img.closest('a')) {
                const all = [...page.querySelectorAll('img')].filter(i => !i.closest('.art-fig-pending'));
                const list = all.map(i => ({
                    src: i.currentSrc || i.src,
                    name: i.alt || i.src.split('/').pop(),
                    caption: i.closest('figure')?.querySelector('figcaption')?.textContent.trim() || '',
                }));
                openViewer(list, Math.max(0, all.indexOf(img)), item.label);
            }
        });
    }

    // ── Folder: a grid of thumbnails; double-click (tap on touch) opens a picture ──
    function openFolder(item, images) {
        if (windows.has(item.id)) { openWindow(item, {}); return; }
        const rec = openWindow(item, { body: folderHtml(item, images), w: 900, h: 620, cls: 'is-folder', icon: 'folder' });
        const status = rec.el.querySelector('.win-status span');
        status.textContent = `${images.length} objects`;
        const grid = rec.el.querySelector('.dt-folder-grid');
        const select = el => {
            grid.querySelectorAll('.dt-file.is-selected').forEach(f => f.classList.remove('is-selected'));
            if (el) el.classList.add('is-selected');
            status.textContent = el ? `${el.dataset.tip} — ${images.length} objects` : `${images.length} objects`;
        };
        const openAt = el => openViewer(images, +el.dataset.index, item.label);
        grid.addEventListener('click', e => {
            const f = e.target.closest('.dt-file');
            select(f);
            if (f && (lastPointer === 'touch' || lastPointer === 'pen')) openAt(f);
        });
        grid.addEventListener('dblclick', e => { const f = e.target.closest('.dt-file'); if (f) openAt(f); });
        grid.addEventListener('keydown', e => { const f = e.target.closest('.dt-file'); if (f && e.key === 'Enter') openAt(f); });
    }

    // ── Image viewer: a fresh window each time, fed a list of pictures and an index ──
    let viewerCount = 0;
    function openViewer(images, index, source) {
        const item = { id: 'viewer-' + (++viewerCount), label: 'Image Viewer', icon: 'viewer', desc: source };
        const rec = openWindow(item, { body: viewerHtml(), w: 900, h: 640, cls: 'is-viewer' });
        rec.el.querySelector('.dt-viewer-tools').addEventListener('click', e => {
            const b = e.target.closest('[data-v]');
            if (!b) return;
            const v = b.dataset.v;
            if (v === 'prev') step(rec, -1);
            else if (v === 'next') step(rec, 1);
            else setZoom(rec, v === 'actual');
        });
        rec.el.querySelector('.dt-viewer-stage').addEventListener('dblclick', () => setZoom(rec, !rec.actual));
        rec.images = images;
        rec.index = clamp(index, 0, images.length - 1);
        rec.source = source;
        rec.el.querySelector('.win-status span').textContent = source;
        showImage(rec);
    }
    function step(rec, d) {
        if (!rec.images.length) return;
        rec.index = (rec.index + d + rec.images.length) % rec.images.length;
        showImage(rec);
    }
    function setZoom(rec, actual) {
        rec.actual = actual;
        rec.el.querySelector('.dt-viewer-stage').classList.toggle('is-actual', actual);
        rec.el.querySelector('[data-v="fit"]').classList.toggle('is-on', !actual);
        rec.el.querySelector('[data-v="actual"]').classList.toggle('is-on', actual);
    }
    function showImage(rec) {
        const pic = rec.images[rec.index];
        if (!pic) return;
        const img = rec.el.querySelector('.dt-viewer-stage img');
        img.src = pic.src;
        img.alt = pic.name || '';
        animate(img, [{ opacity: 0.4 }, { opacity: 1 }], 160, 'ease-out');
        rec.el.querySelector('.dt-viewer-count').textContent = `${rec.index + 1} / ${rec.images.length}`;
        rec.el.querySelector('.dt-viewer-name').textContent = pic.name || '';
        rec.el.querySelector('.dt-viewer-cap').textContent = pic.caption || '';
        rec.el.querySelector('.win-name').textContent = `${pic.name || 'Image'} — Image Viewer`;
        rec.task.querySelector('span:last-child').textContent = `${pic.name || 'Image'} — Image Viewer`;
        rec.task.dataset.tip = `${pic.name || 'Image'} — Image Viewer`;
        // preload the neighbours so paging feels instant
        [1, -1].forEach(d => { const n = rec.images[(rec.index + d + rec.images.length) % rec.images.length]; if (n) new Image().src = n.src; });
    }
    on(document, 'keydown', e => {
        const rec = [...windows.values()].find(r => r.images && !r.min && r.el.classList.contains('is-active'));
        if (!rec) return;
        if (e.key === 'ArrowLeft') step(rec, -1);
        if (e.key === 'ArrowRight') step(rec, 1);
    });

    // ── Windows ──
    function openWindow(item, opts) {
        const existing = windows.get(item.id);
        if (existing) { restore(existing); focus(existing); return existing; }

        const icon = opts.icon || item.icon;
        const el = document.createElement('section');
        el.className = 'win' + (opts.cls ? ' ' + opts.cls : '');
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', item.label);
        el.dataset.win = item.id;
        el.innerHTML = `
            <header class="win-title">
                <span class="win-ico">${ICONS[icon]}</span>
                <span class="win-name">${escapeHtml(item.label)}</span>
                <span class="win-btns">
                    <button type="button" data-act="min" aria-label="Minimise" data-tip="Minimise">_</button>
                    <button type="button" data-act="max" aria-label="Maximise" data-tip="Maximise">□</button>
                    <button type="button" data-act="close" aria-label="Close" data-tip="Close">✕</button>
                </span>
            </header>
            <div class="win-body">${opts.body}</div>
            <footer class="win-status">
                <span>${escapeHtml(item.desc || item.label)}</span>
                ${opts.full ? `<a href="${opts.full}" data-link data-tip="Leave the desktop and open this on its own page">open full page ↗</a>` : ''}
            </footer>
            <span class="win-resize" aria-hidden="true" data-tip="Drag to resize"></span>`;

        // size and position, cascaded, clamped to the desktop
        const a = area();
        const w = Math.min(opts.w, a.w - 24);
        const h = Math.min(opts.h, a.h - 50);
        const stepPx = 28 * (cascade++ % 6);
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.style.left = Math.max(8, (a.w - w) / 2 + stepPx - 60) + 'px';
        el.style.top = Math.max(8, (a.h - h) / 2 - 30 + stepPx) + 'px';

        const task = document.createElement('button');
        task.type = 'button';
        task.className = 'dt-task';
        task.dataset.tip = item.label;
        task.innerHTML = `<span class="dt-task-ico">${ICONS[icon]}</span><span>${escapeHtml(item.label)}</span>`;
        tasks.appendChild(task);
        animate(task, [{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 160);

        const rec = { el, task, item, jigsaw: null, min: false, max: false, rect: null, saved: null };
        windows.set(item.id, rec);
        winRoot.appendChild(el);
        animate(el, [{ transform: 'scale(0.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], 170);
        sfx.play('open');

        // a tool is an iframe; spin the cursor until it has loaded
        const frame = el.querySelector('iframe.dt-app');
        if (frame) {
            setBusy(true);
            let done = false;
            const started = Date.now();
            // keep the ring up for at least half a second so it reads as a ring, not a flicker
            const finish = () => { if (done) return; done = true; setTimeout(() => setBusy(false), Math.max(0, 500 - (Date.now() - started))); };
            frame.addEventListener('load', finish, { once: true });
            setTimeout(finish, 8000);
        }

        if (small()) maximise(rec, true);

        // title-bar drag, with Aero-style snapping to the top and side edges
        drag(el.querySelector('.win-title'), {
            start(e) {
                focus(rec);
                if (rec.max || rec.snapped) {
                    // pull a maximised or snapped window back to its old size, under the cursor
                    const b = el.getBoundingClientRect();
                    const frac = (e.clientX - b.left) / b.width;
                    const saved = rec.saved || { w: el.offsetWidth, h: el.offsetHeight };
                    rec.max = false; rec.snapped = null;
                    el.classList.remove('is-max');
                    el.style.width = saved.w + 'px';
                    el.style.height = saved.h + 'px';
                    el.style.left = Math.round(e.clientX - desktop.getBoundingClientRect().left - frac * saved.w) + 'px';
                    el.style.top = Math.round(b.top - desktop.getBoundingClientRect().top) + 'px';
                }
                rec.rect = { x: el.offsetLeft, y: el.offsetTop };
            },
            move(dx, dy) {
                const b = area();
                el.style.left = clamp(rec.rect.x + dx, -el.offsetWidth + 80, b.w - 80) + 'px';
                el.style.top = clamp(rec.rect.y + dy, 0, b.h - 40) + 'px';
                showSnap(snapZone());
            },
            end(moved) {
                const zone = moved ? snapZone() : null;
                showSnap(null);
                if (zone) applySnap(rec, zone);
            },
        });
        drag(el.querySelector('.win-resize'), {
            start() { if (rec.max) return false; focus(rec); rec.rect = { w: el.offsetWidth, h: el.offsetHeight }; },
            move(dx, dy) {
                el.style.width = Math.max(260, rec.rect.w + dx) + 'px';
                el.style.height = Math.max(160, rec.rect.h + dy) + 'px';
            },
        });

        el.addEventListener('pointerdown', () => focus(rec));
        el.querySelector('.win-title').addEventListener('dblclick', e => {
            if (!e.target.closest('button')) maximise(rec);
        });
        el.addEventListener('click', e => {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            const act = btn.dataset.act;
            if (act === 'close') close(rec);
            else if (act === 'min') minimise(rec);
            else if (act === 'max') maximise(rec);
        });
        task.addEventListener('click', () => {
            if (rec.min) { restore(rec); focus(rec); }
            else if (rec.el.classList.contains('is-active')) minimise(rec);
            else focus(rec);
        });

        focus(rec);
        if (opts.jigsaw) rec.jigsaw = initJigsawTypography();
        return rec;
    }

    // ── Snapping ──
    function snapZone() {
        if (small()) return null;
        const d = desktop.getBoundingClientRect();
        if (pointer.y <= d.top + 3) return 'top';
        if (pointer.x <= d.left + 3) return 'left';
        if (pointer.x >= d.right - 4) return 'right';
        return null;
    }
    function showSnap(zone) {
        if (!zone) { snap.hidden = true; return; }
        const a = area();
        const box = zone === 'top' ? { l: 0, t: 0, w: a.w, h: a.h } : { l: zone === 'left' ? 0 : a.w / 2, t: 0, w: a.w / 2, h: a.h };
        const was = snap.hidden;
        snap.hidden = false;
        Object.assign(snap.style, { left: box.l + 'px', top: box.t + 'px', width: box.w + 'px', height: box.h + 'px' });
        if (was) animate(snap, [{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], 140);
    }
    function applySnap(rec, zone) {
        rec.saved = { w: rec.el.offsetWidth, h: rec.el.offsetHeight };
        if (zone === 'top') { maximise(rec, true); return; }
        const a = area();
        const before = rec.el.getBoundingClientRect();
        rec.snapped = zone;
        Object.assign(rec.el.style, { left: (zone === 'left' ? 0 : a.w / 2) + 'px', top: '0px', width: a.w / 2 + 'px', height: a.h + 'px' });
        const after = rec.el.getBoundingClientRect();
        animate(rec.el, [
            { transformOrigin: '0 0', transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})` },
            { transformOrigin: '0 0', transform: 'none' },
        ], 180, 'ease-out');
        if (rec.jigsaw) window.dispatchEvent(new Event('resize'));
    }

    function focus(rec) {
        windows.forEach(r => { r.el.classList.remove('is-active'); r.task.classList.remove('is-active'); });
        rec.el.classList.add('is-active');
        rec.task.classList.add('is-active');
        rec.el.style.zIndex = ++z;
    }
    // minimise flies the window into its taskbar button; restore flies it back
    function taskDelta(rec) {
        const from = rec.el.getBoundingClientRect(), to = rec.task.getBoundingClientRect();
        return { dx: (to.left + to.width / 2) - (from.left + from.width / 2), dy: (to.top + to.height / 2) - (from.top + from.height / 2) };
    }
    function minimise(rec) {
        if (rec.min) return;
        rec.min = true;
        rec.el.classList.remove('is-active');
        rec.task.classList.remove('is-active');
        const { dx, dy } = taskDelta(rec);
        animate(rec.el, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.05)`, opacity: 0 }], 230, 'cubic-bezier(0.4, 0, 0.6, 1)')
            .then(() => { if (rec.min) rec.el.classList.add('is-min'); });
        const last = [...windows.values()].filter(r => !r.min).pop();
        if (last) focus(last);
    }
    function restore(rec) {
        if (!rec.min) return;
        rec.min = false;
        rec.el.classList.remove('is-min');
        const { dx, dy } = taskDelta(rec);
        animate(rec.el, [{ transform: `translate(${dx}px, ${dy}px) scale(0.05)`, opacity: 0 }, { transform: 'none', opacity: 1 }], 230);
    }
    function maximise(rec, force) {
        const before = rec.el.getBoundingClientRect();
        if (!rec.max) rec.saved = { w: rec.el.offsetWidth, h: rec.el.offsetHeight };
        rec.snapped = null;
        rec.max = force ? true : !rec.max;
        rec.el.classList.toggle('is-max', rec.max);
        if (!force && !reduced) {
            // FLIP: play the jump from the old box to the new one
            const after = rec.el.getBoundingClientRect();
            const sx = before.width / after.width, sy = before.height / after.height;
            animate(rec.el, [
                { transformOrigin: '0 0', transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${sx}, ${sy})` },
                { transformOrigin: '0 0', transform: 'none' },
            ], 200, 'ease-out');
        }
        if (rec.jigsaw) window.dispatchEvent(new Event('resize'));
    }
    function close(rec) {
        if (rec.jigsaw) rec.jigsaw();
        windows.delete(rec.item.id);
        sfx.play('close');
        rec.el.classList.remove('is-active');
        animate(rec.task, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(6px)', opacity: 0 }], 140).then(() => rec.task.remove());
        animate(rec.el, [{ transform: 'none', opacity: 1 }, { transform: 'scale(0.94)', opacity: 0 }], 140, 'ease-in').then(() => rec.el.remove());
        const last = [...windows.values()].filter(r => !r.min).pop();
        if (last) focus(last);
    }
    function cascadeWindows() {
        let i = 0;
        windows.forEach(rec => {
            restore(rec);
            if (rec.max) maximise(rec);
            const before = rec.el.getBoundingClientRect();
            rec.el.style.left = 24 + 28 * i + 'px';
            rec.el.style.top = 24 + 28 * i + 'px';
            const after = rec.el.getBoundingClientRect();
            animate(rec.el, [{ transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` }, { transform: 'none' }], 220);
            focus(rec);
            i++;
        });
    }

    // ── Pointer drag helper. move() gets deltas; start() may return false to refuse. ──
    function drag(handle, { start, move, end }) {
        let sx = 0, sy = 0, active = false, moved = false;
        const onMove = e => {
            if (!active) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (!moved && Math.hypot(dx, dy) < 4) return;
            moved = true;
            move(dx, dy);
        };
        const onUp = e => {
            if (!active) return;
            active = false;
            desktop.classList.remove('is-dragging');
            handle.releasePointerCapture?.(e.pointerId);
            if (end) end(moved);
        };
        handle.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            const control = e.target.closest('button, a, iframe');
            if (control && control !== handle) return;     // a button inside the handle, not the handle itself
            if (start && start(e) === false) return;
            active = true; moved = false; sx = e.clientX; sy = e.clientY;
            desktop.classList.add('is-dragging');    // iframes stop eating pointer events
            handle.setPointerCapture?.(e.pointerId);
        });
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
    }

    // a phone-sized viewport gets every window full-screen; otherwise keep icons on screen
    on(window, 'resize', () => {
        hideMenu(); hideTip(); closeCal(); showSnap(null);
        if (small()) windows.forEach(r => { if (!r.max) maximise(r, true); });
        else Object.keys(iconEls).forEach(place);
    });

    // open the About window on arrival, like a login greeting (after the boot screen, if there is one)
    const greet = setTimeout(() => { if (!booting) open('about'); }, 150);
    cleanups.push(() => clearTimeout(greet));

    return function cleanup() {
        windows.forEach(r => { if (r.jigsaw) r.jigsaw(); });
        windows.clear();
        clearTimeout(tipTimer);
        clearTimeout(pressTimer);
        cleanups.forEach(fn => fn());
    };
}

// ── Utils ────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
