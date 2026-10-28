// Mooli, the creature in the margin, on every page of the site except the
// tools and games (but p2p drop, where it carries the files across). This is the site-specific glue; the creature itself is in
// margin-creature.js and knows nothing about this site.
//
// There is one Mooli per visit. It is created the first time a page wants it
// and lives across client-side navigation, so it stays fed, full or sleepy as
// you move between pages. A route can opt out with `mooli: false` in
// routes.js; on those it is hidden and paused, not destroyed.
//
//   app.onRender = match => mooliFor(match);   after every render (app.js)
//   const pet = ensureMooli();                  a page that wants it directly (home.js)

import { createCreature, bindPage } from './margin-creature.js';

let pet = null, unbind = null, shown = false, greeted = false, lastPath = null;

const PERSONALITIES = ['pup', 'cat'];

// a bunny unless the address says otherwise: ?pet=pup, ?pet=cat, ?pet=none
function personality() {
    const k = new URLSearchParams(location.search).get('pet');
    return k === 'none' ? null : PERSONALITIES.includes(k) ? k : 'bunny';
}

// It lives just left of the page's text column. On the home page that is the
// empty margin column; elsewhere, a little left of the first text block.
function marginFor() {
    const col = document.querySelector('.gp-margin');
    if (col) {
        const m = col.getBoundingClientRect();
        return Math.max(innerWidth <= 720 ? 14 : 24, m.left + m.width / 2);
    }
    // in order of preference: one querySelector over a list would return whichever comes first in the page
    // a page whose content sits in a column inside a full-width root marks the column with data-mooli-column
    const text = ['[data-mooli-column]', '.art-body', '.articles-index', '.art-nav', '#app > *'].map(q => document.querySelector(q)).find(Boolean);
    const left = text ? text.getBoundingClientRect().left : 80;
    return left < 70 ? 14 : Math.max(24, left - 46);
}

// it speaks in the page's voice: the home page's serif, or whatever the page uses
const fontFor = () => document.querySelector('.gp') ? "'Fraunces', Georgia, serif" : null;

export function ensureMooli() {
    if (pet) return pet;
    const root = document.getElementById('app');
    pet = createCreature({
        radius: innerWidth <= 720 ? 11 : 17,
        margin: marginFor(),
        links: () => root.querySelectorAll('a[href]'),
        font: fontFor(),
        personality: personality(),
    });
    // keyboard focus attends like hover does, on every page
    root.addEventListener('focusin', e => { const a = e.target.closest?.('a[href]'); if (a && shown) pet.attend(a, a.dataset.gesture); });
    root.addEventListener('focusout', e => { const a = e.target.closest?.('a[href]'); if (a) pet.release(a); });
    addEventListener('resize', () => { if (shown) pet.setMargin(marginFor()); });
    return pet;
}

export function mooliFor(match) {
    const wanted = match?.route && match.route.mooli !== false;
    if (!wanted) {
        if (pet && shown) { unbind?.(); unbind = null; pet.setActive(false); shown = false; }
        lastPath = match?.path ?? null;
        return;
    }
    ensureMooli();
    if (match.path !== lastPath) pet.newPage();
    lastPath = match.path;
    pet.setMargin(marginFor());
    pet.setFont(fontFor());
    if (!shown) {
        pet.setActive(true);
        unbind = bindPage(pet, document.getElementById('app'), { greetOnLoad: !greeted });
        greeted = true;
        shown = true;
    }
}

export const getMooli = () => pet;
