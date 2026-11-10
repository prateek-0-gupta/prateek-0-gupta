// Nagmani: the game. A roguelite of one verb.
//
// THE COIL. His body is the weapon: lead the dead, circle them, cross your own length, and the closed
// loop crushes everything inside it. The body is also a wall the dead cannot walk through, the purse the
// Yaksha is paid from, and the thing every shard of the stone makes longer. Fangs, venom and the shed skin
// are there to set the coil up or to get out of one that failed.
//
// A descent is three wards and the bridge. Each ward is dealt fresh (ward.js): sealed chambers, a champion,
// a shrine, a landmark holding one Memory, a Yaksha, and a guardian behind a seal that only pieces of her
// will break. He cannot die; when he falls he wakes in the Gardens and the city has moved. Only the
// Memories stay with him, and each one changes him.

import { buildWard, CELL, T } from './ward.js';
import * as LORE from './lore.js';
import { ASSET_BASE, WARDS, MEMORIES, QUOTES, VICTORY, BOONS, ASPECTS, MEMORY_PERKS, YAKSHA, HINTS, PIECES_TOTAL, WARD_PIECES } from './lore.js';

const NAKSHATRAS = LORE.NAKSHATRAS || [];     // each piece of her has a name, if the lore gives one

const SAVE_KEY = 'nagmani.save.v2';
function loadSave() {
    const base = { memories: [], runs: 0, wins: 0, trueEnding: false, bestWard: 0, hints: {}, run: null };
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) return Object.assign(base, JSON.parse(raw));
        // the Memories read before the city learned to move are still his
        const old = JSON.parse(localStorage.getItem('nagmani.save.v1') || '{}');
        if (Array.isArray(old.memories)) base.memories = old.memories.slice(0, MEMORIES.length);
    } catch (_) { /* private mode */ }
    return base;
}
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (_) { /* private mode */ } }

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const pickOf = arr => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

// The dead. hp and dmg grow with the ward. shards: what they drop.
const E = {
    wraith:   { hp: 4,  r: 20, speed: 1.65, size: 96,  dmg: 12, shards: 1, sheet: 'wraithWalk',   aura: '120,150,255' },
    preta:    { hp: 2,  r: 18, speed: 1.75, size: 84,  dmg: 9,  shards: 1, sheet: 'pretaWalk', alt: 'wraithWalk', aura: '150,240,230', tint: ['#9fdcd6', 0.6, 'color'], ghost: true },
    hunter:   { hp: 6,  r: 20, speed: 1.95, size: 112, dmg: 20, shards: 1, sheet: 'hunterWalk',   aura: '255,70,50' },
    mantrik:  { hp: 4,  r: 20, speed: 1.25, size: 100, dmg: 14, shards: 1, sheet: 'mantrikWalk', alt: 'drownedWalk', aura: '200,120,255', tint: ['#9068c8', 0.5, 'color'] },
    drowned:  { hp: 5,  r: 22, speed: 0,    size: 104, dmg: 22, shards: 1, sheet: 'drownedWalk',  aura: '90,220,220' },
    sentinel: { hp: 14, r: 34, speed: 0.95, size: 176, dmg: 30, shards: 3, sheet: 'sentinelWalk', aura: '255,170,70' },
};

// What each guardian does, by phase (the fight turns at two thirds and at one third of its health).
// Every attack is one of a few telegraphed shapes, so a pattern learned on Vrika still reads on Kalash.
const KIT = {
    vrika:  [['charge', 'slam', 'summon'],           ['combo', 'blades', 'slam', 'summon'],            ['combo', 'blades', 'quake', 'summon']],
    loha:   [['slam', 'quake', 'summon'],            ['quake', 'pools', 'rings', 'charge'],            ['pools', 'quake', 'rings', 'slam', 'summon']],
    mahant: [['dive', 'orbs', 'summon'],             ['dive', 'barrage', 'rings', 'orbs'],             ['barrage', 'dive', 'rings', 'orbs', 'summon']],
    kalash: [['slam', 'charge', 'orbs', 'summon'],   ['sweep', 'barrage', 'quake', 'rings', 'charge'], ['sweep', 'barrage', 'pools', 'rings', 'combo', 'orbs', 'summon']],
};
const PHASE_LINES = ['THE BRASS CRACKS', 'IT WILL NOT GO QUIETLY'];

export function initGame(soundtrack, session, restart) {
    const $ = id => document.getElementById(id);
    const canvas = $('gameCanvas');
    const ctx = canvas.getContext('2d');
    const save = loadSave();
    const params = new URLSearchParams(location.search);
    const DEBUG = params.has('debug');
    const perk = n => save.memories.includes(n - 1);      // has Memory n (1-based) been read
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const show = (id, on, mode = 'flex') => { const el = $(id); if (el) el.style.display = on ? mode : 'none'; };
    const text = (id, v) => { const el = $(id); if (el) el.textContent = v; };

    for (const id of ['gameOverlay', 'victoryOverlay', 'memoryOverlay', 'codexOverlay', 'pauseOverlay', 'choiceOverlay', 'loreOverlay', 'gs-boss']) show(id, false);
    const loadingOvl = $('loadingOverlay'), loreOvl = $('loreOverlay'), loadBar = $('loadBar');
    if (loadingOvl) { loadingOvl.style.display = session.started ? 'none' : 'flex'; loadingOvl.style.opacity = '1'; }
    {
        const r = save.run, stats = $('loreStats');
        if (stats) stats.innerHTML = r
            ? `Ward <span>${WARDS[r.ward].num}</span> · Pieces carried <span>${r.pieces} / ${PIECES_TOTAL}</span> · Memories <span>${save.memories.length} / 9</span>`
            : `Descents <span>${save.runs}</span> · Memories <span>${save.memories.length} / 9</span> · Deepest <span>${save.runs ? WARDS[save.bestWard].title : '—'}</span>` + (save.trueEnding ? ' · <span>She remembers you.</span>' : save.wins ? ` · Crossings <span>${save.wins}</span>` : '');
        show('loreCodexBtn', save.memories.length > 0, '');
        show('loreResetBtn', !!r, '');
        text('loreBeginBtn', r ? 'Continue the Descent' : save.runs ? 'Wake Again' : 'Begin Descent');
    }

    // ═══════════════════════════════════════════════════════════════════
    // CANVAS. Rendered at a capped internal resolution and stretched by CSS: the frame
    // repaints the whole screen several times over, so the pixel count is the frame time.
    // ═══════════════════════════════════════════════════════════════════
    let quality = 2, W = 0, H = 0, viewScale = 1;
    const PIXEL_BUDGET = [0.9e6, 1.3e6, 1.75e6];
    const LS = 0.25;                                   // the light map is a quarter of the frame
    const AMBIENT = 0.82;                              // how much of each ward's dark is let through: low, so the lit things carry the picture
    const lightCanvas = document.createElement('canvas'), lctx = lightCanvas.getContext('2d');
    const vignette = document.createElement('canvas'), vctx = vignette.getContext('2d');
    function resize() {
        const cw = window.innerWidth, ch = window.innerHeight;
        viewScale = Math.min(1, Math.sqrt(PIXEL_BUDGET[quality] / (cw * ch)));
        canvas.width = Math.round(cw * viewScale); canvas.height = Math.round(ch * viewScale);
        canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
        W = canvas.width; H = canvas.height;
        lightCanvas.width = Math.ceil(W * LS); lightCanvas.height = Math.ceil(H * LS);
        buildVignette();
    }
    function buildVignette() {
        vignette.width = W; vignette.height = H;
        vctx.clearRect(0, 0, W, H);
        const g = vctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.26, W / 2, H / 2, Math.hypot(W, H) * 0.54);
        g.addColorStop(0, 'rgba(4,2,5,0)'); g.addColorStop(0.5, 'rgba(4,2,5,0.42)'); g.addColorStop(1, 'rgba(4,2,5,0.96)');
        vctx.fillStyle = g; vctx.fillRect(0, 0, W, H);
        if (ok(IMG.fog)) {
            vctx.globalAlpha = 0.07; vctx.globalCompositeOperation = 'lighter';
            vctx.fillStyle = vctx.createPattern(IMG.fog, 'repeat'); vctx.fillRect(0, 0, W, H);
            vctx.globalAlpha = 1; vctx.globalCompositeOperation = 'source-over';
        }
    }
    window.addEventListener('resize', resize);

    // ═══ ASSETS ═══
    const FILES = {
        fog: 'fog.png', snakeHead: 'snake_head.png', snakeBody: 'snake_body.png', snakeTail: 'snake_tail.png',
        floorStone: 'v2/floor_stone.png', floorRoots: 'v2/floor_stone_roots.png', floorWet: 'v2/floor_stone_wet.png', floorAsh: 'v2/floor_stone_ash.png',
        floorRuin: 'v2/floor_ruin.png', floorWater: 'v2/floor_water.png',
        puddle: 'v2/decal_puddle.png', rubble: 'v2/decal_rubble.png', roots: 'v2/decal_roots.png', broken: 'v2/decal_road_broken.png',
        pileA: 'v2/decal_snake_pile_a.png', pileB: 'v2/decal_snake_pile_b.png', bloodA: 'v2/decal_blood_a.png', bloodB: 'v2/decal_blood_b.png',
        warA: 'v2/decal_war_a.png', warB: 'v2/decal_war_b.png', smoke: 'v2/fx_smoke.png', gate: 'v2/gate.png',
        fxBolt: 'v2/fx_venom_bolt.png', fxVenom: 'v2/fx_venom_burst.png', fxBlood: 'v2/fx_blood_burst.png', fxSigil: 'v2/fx_sigil.png', fxSlash: 'v2/fx_slash.png',
        shrineA: 'v2/shrine_a.png', shrineB: 'v2/shrine_b.png', pillar: 'v2/pillar.png', pillarBroken: 'v2/pillar_broken.png', bell: 'v2/bell_fallen.png',
        treeA: 'v2/tree_a.png', treeB: 'v2/tree_b.png', treeC: 'v2/tree_c.png', statueA: 'v2/statue_a.png', statueB: 'v2/statue_b.png', diya: 'v2/diya.png',
        shard: 'v2/pickup_shard.png', soul: 'v2/pickup_soul.png', lotus: 'v2/pickup_lotus.png',
        wraithWalk: 'v2/wraith_walk.png', hunterWalk: 'v2/hunter_walk.png', drownedWalk: 'v2/drowned_walk.png', sentinelWalk: 'v2/sentinel_walk.png',
        // the roguelite set: anything missing here falls back to a recolour of the older art
        pretaWalk: 'v2/preta_walk.png', mantrikWalk: 'v2/mantrik_walk.png',
        vrikaWalk: 'v2/vrika_walk.png', lohaWalk: 'v2/loha_walk.png', mahantWalk: 'v2/mahant_walk.png', kalashWalk: 'v2/kalash_walk.png',
        yaksha: 'v2/yaksha.png', stairwell: 'v2/stairwell.png', wallFrieze: 'v2/wall_frieze.png', barsFront: 'v2/bars_front.png', gateSlab: 'v2/gate_slab.png',
        // what the dead do to him: hot orange and red, never his own gold and green
        fxShock: 'v2/fx_shock.png', fxFire: 'v2/fx_fire.png', fxPool: 'v2/fx_pool.png', fxOrb: 'v2/fx_orb.png', fxClaw: 'v2/fx_claw.png',
        fxSplash: 'v2/fx_splash.png', fxBlade: 'v2/fx_blade.png', fxCoil: 'v2/fx_coil.png',
        floorW0: 'v2/floor_gardens.png', floorW1: 'v2/floor_brass.png', floorW2: 'v2/floor_sanctum.png', floorW3: 'v2/floor_bridge.png',
    };
    const IMG = {};
    const ok = img => !!img && img.complete && img.naturalWidth > 0;
    let loaded = 0;
    const total = Object.keys(FILES).length;
    function onAsset() {
        loaded++;
        if (loadBar) loadBar.style.width = Math.round(loaded / total * 100) + '%';
        if (loaded < total) return;
        buildVignette();
        if (session.started) return;
        if (loadingOvl) { loadingOvl.style.transition = 'opacity 0.6s ease'; loadingOvl.style.opacity = '0'; }
        later(() => { if (loadingOvl) loadingOvl.style.display = 'none'; if (loreOvl && !session.started) loreOvl.style.display = 'flex'; }, 600);
    }
    for (const [k, f] of Object.entries(FILES)) {
        const img = IMG[k] = new Image();
        img.addEventListener('load', onAsset, { once: true });
        img.addEventListener('error', onAsset, { once: true });
        img.src = ASSET_BASE + f;
    }
    resize();

    // a recoloured copy of a sprite: 'source-atop' washes it, 'color' swaps its hue and keeps the drawing
    const tintCache = new Map();
    function tinted(key, tint) {
        const src = IMG[key];
        if (!ok(src)) return null;
        if (!tint) return src;
        const id = key + tint.join('|');
        let c = tintCache.get(id);
        if (!c) {
            const [color, alpha, mode = 'source-atop'] = tint;
            c = document.createElement('canvas'); c.width = src.naturalWidth; c.height = src.naturalHeight;
            const g = c.getContext('2d');
            g.drawImage(src, 0, 0);
            g.globalCompositeOperation = mode; g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
            g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
            tintCache.set(id, c);
        }
        return c;
    }

    // ═══════════════════════════════════════════════════════════════════
    // HIS VOICE (drawn above his head) AND THE GAME'S (a line at the foot of the screen)
    // ═══════════════════════════════════════════════════════════════════
    const lastIdx = {};
    function pickQuote(cat) {
        const arr = cat === 'act' ? QUOTES.act[run.ward] : QUOTES[cat];
        if (!arr || !arr.length) return '';
        let i; do { i = Math.floor(Math.random() * arr.length); } while (i === lastIdx[cat] && arr.length > 1);
        lastIdx[cat] = i;
        return arr[i];
    }
    let speech = null, lastSpoke = -1e9, cardUntil = 0;
    const URGENT = new Set(['sealed', 'unsealed', 'memory', 'wake', 'descend', 'lastword', 'empty']);
    const QUIET_MS = 16000;
    function say(line, duration = 4500) {
        if (!line) return;
        const now = performance.now();
        lastSpoke = now;
        const start = Math.max(now, cardUntil);      // never over the ward's title card
        speech = { text: '“' + line + '”', lines: null, start, until: start + duration + 900 };
    }
    function showQuote(cat, duration, chance = 1) {
        const now = performance.now();
        if (!URGENT.has(cat) && (speech || now - lastSpoke < QUIET_MS || Math.random() > chance)) return;
        say(pickQuote(cat), duration);
    }
    function drawSpeech() {
        if (!speech) return;
        const now = performance.now();
        if (now > speech.until) { speech = null; return; }
        if (now < speech.start) return;
        const a = Math.min(1, (now - speech.start) / 350) * Math.min(1, (speech.until - now) / 900);
        const size = Math.max(15, Math.min(21, W / 64));
        ctx.font = `italic ${size}px 'Cormorant Garamond', Georgia, serif`;
        if (!speech.lines) {
            const maxW = Math.min(W * 0.6, 460), words = speech.text.split(' '), lines = [];
            let line = '';
            for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
            if (line) lines.push(line);
            speech.lines = lines;
        }
        const lh = size * 1.35, widest = Math.max(...speech.lines.map(l => ctx.measureText(l).width));
        const x = W / 2, bh = speech.lines.length * lh, top = H / 2 - 92 - bh;
        ctx.save();
        ctx.globalAlpha = a;
        // a soft dark breath behind the words, not a box: one round gradient, flattened to the block of text
        const rx = widest * 0.75 + 70, ry0 = bh * 0.5 + 62;
        ctx.save(); ctx.translate(x, top + bh / 2); ctx.scale(1, ry0 / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, 'rgba(6,3,5,0.82)'); g.addColorStop(0.6, 'rgba(6,3,5,0.5)'); g.addColorStop(1, 'rgba(6,3,5,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#eadbb0';
        ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 8;
        speech.lines.forEach((l, i) => ctx.fillText(l, x, top + i * lh));
        ctx.shadowBlur = 0;
        const ry = top + bh + 10, hw = widest / 2 + 10;
        const lg = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
        lg.addColorStop(0, 'rgba(192,160,96,0)'); lg.addColorStop(0.5, 'rgba(192,160,96,0.7)'); lg.addColorStop(1, 'rgba(192,160,96,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - hw, ry, hw * 2, 1);
        ctx.fillStyle = '#c0a060'; ctx.translate(x, ry + 0.5); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5);
        ctx.restore();
    }
    let hintTimer = null;
    function hint(key, force) {
        if (!force && save.hints[key]) return;
        const el = $('gs-hint');
        if (!el || (el.classList.contains('show') && !force)) return;
        save.hints[key] = 1; writeSave(save);
        el.textContent = HINTS[key]; el.classList.add('show');
        if (hintTimer) { clearTimeout(hintTimer); timers.delete(hintTimer); }
        hintTimer = later(() => el.classList.remove('show'), 7500);
    }
    const ambient = setInterval(() => {
        if (over || paused || modal || !session.started || (room && room.state === 'active')) return;
        showQuote(pickOf(['act', 'act', 'ambient', 'enemy', 'growth']), 5000);
    }, 70000);

    // ═══════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════
    const CW = 800, SS = 30, SG = 8, SPEED = 3.4, TURN = 0.09, LEN_MAX = 110, LEN_MIN = 10;
    const BITE_REACH = 105, SPIT_COST = 25, SHED_FRAMES = 40;
    const run = {
        ward: 0, seed: (Math.random() * 1e9) | 0, boons: {}, pieces: 0, wardPieces: 0, shards: 0, kills: 0, coils: 0, bestCoil: 0,
        frames: 0, lastWord: false, secondUsed: false, hurts: 0,
    };
    let hpMax = 100 + (perk(1) ? 10 : 0), hp = hpMax, venom = 100;
    let ward = null, theme = WARDS[0], room = null, boss = null, flow = null;
    let over = false, paused = false, modal = null;         // modal: 'memory' | 'choice' | null
    let time = 0, frames = 0, freeze = 0, shake = 0, hurtCd = 0, bodyCd = 0, grace = 0, hurtFlash = 0, coilCd = 0, bumpCd = 0;
    let frameMs = 16;
    const shed = { active: 0, cd: 0 }, bite = { active: 0, cd: 0 };
    const sn = { x: 0, y: 0, angle: 0, targetAngle: 0, len: 24 + (perk(3) ? 4 : 0) };      // long enough from the first step to close a coil around a knot of them
    const trail = {
        cap: 2048, n: 0, head: 0, x: new Float32Array(2048), y: new Float32Array(2048), a: new Float32Array(2048),
        push(x, y, a) { this.head = (this.head + 1) % this.cap; this.x[this.head] = x; this.y[this.head] = y; this.a[this.head] = a; if (this.n < this.cap) this.n++; },
        at(i) { return (this.head - i + this.cap) % this.cap; },     // slot of the i-th newest sample
        clear() { this.n = 0; },
        trim(max) { if (this.n > max) this.n = max; },
    };
    const keys = { w: false, a: false, s: false, d: false, fire: false };
    // everything standing or lying in the ward
    let obs = [], decals = [], trees = [], statues = [], bells = [], shrines = [], diyas = [], smokes = [], pickups = [];
    let enemies = [], spawns = [], shots = [], zones = [], rings = [], bolts = [], decoys = [], loops = [], labels = [], pools = [], beams = [];
    let splash = null, flash = 0, slowmo = 0, slowTick = false;      // a title across the screen, a white flash, half-speed time
    let explored = new Uint8Array(1), chunks = new Map();
    const fx = [], particles = [], motes = [], lights = [];

    const has = id => run.boons[id] || 0;
    const biteDmg = () => 2 + 2 * has('vajra');
    const crushDmg = () => 6 + 4 * has('crush') + (perk(7) ? 2 : 0);
    const venomMax = () => 100 + 40 * has('deep');
    const venomRegen = () => 0.1 * (1 + 0.6 * has('deep'));
    const shedCd = () => Math.round(240 * (has('molt') ? 0.55 : 1));
    const shedCost = () => (has('molt') ? 0 : 2);
    const scale = () => 1 + 0.15 * run.ward;                // how much harder the dead hit down here
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    // ═══ FX ═══
    function spawnFx(kind, x, y, { size0 = 40, size1 = 120, life = 22, spin = 0, rot = 0, light = true, alpha = 1, delay = 0 } = {}) {
        fx.push({ kind, x, y, size0, size1, life, maxLife: life, spin, rot, light, alpha, delay });
    }
    function spawnParticles(x, y, count, o = {}) {
        const { color = '#ffdf73', minSize = 2, maxSize = 6, speed = 2, lifetime = 60, spread = TAU, baseAngle = -Math.PI / 2, gravity = 0, drag = 0.98, text: glyphs = null, font = null } = o;
        for (let i = 0; i < count; i++) {
            const a = baseAngle - spread / 2 + Math.random() * spread, s = (0.5 + Math.random()) * speed;
            particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: rand(minSize, maxSize), life: lifetime + Math.random() * 20, maxLife: lifetime + 20, color, gravity, drag, text: glyphs ? pickOf(glyphs) : null, font });
        }
    }
    const label = (txt, x, y, color = '#e6cf8f', size = 18) => labels.push({ txt, x, y, color, size, t: 0 });
    const RUNES = ['ॐ', 'अ', 'न्न', 'द', 'र', 'स'];
    const SOUL_RUNES = ['आ', 'त्म', 'जी', 'व', 'प्रा', 'ॐ'];
    const burst = {
        shard: (x, y) => spawnParticles(x, y, 8, { color: '#ffdf73', minSize: 1, maxSize: 3, speed: 2.4, lifetime: 30 }),
        piece: (x, y) => { spawnParticles(x, y, 6, { color: '#d4a5ff', text: SOUL_RUNES, font: 'bold 22px serif', speed: 1.4, lifetime: 90, spread: Math.PI * 1.4, gravity: -0.02 }); spawnParticles(x, y, 24, { color: '#e8d4ff', minSize: 1, maxSize: 4, speed: 3.2, lifetime: 60 }); },
        gold: (x, y) => { spawnParticles(x, y, 5, { color: '#d4af37', text: RUNES, font: 'bold 22px serif', speed: 1.4, lifetime: 80, spread: Math.PI * 1.2, gravity: -0.02 }); spawnParticles(x, y, 26, { color: '#fff1c9', minSize: 1, maxSize: 4, speed: 3.4, lifetime: 60, gravity: -0.01 }); },
        flame: (x, y) => spawnParticles(x, y, 14, { color: '#ffb347', minSize: 1, maxSize: 4, speed: 1.6, lifetime: 70, spread: Math.PI * 0.9, gravity: -0.03 }),
        ash: (x, y) => { spawnParticles(x, y, 20, { color: '#5a4a30', minSize: 2, maxSize: 7, speed: 3.5, lifetime: 50, gravity: 0.04 }); spawnParticles(x, y, 9, { color: '#c0a060', minSize: 1, maxSize: 3, speed: 4, lifetime: 32 }); },
        blood: (x, y) => spawnParticles(x, y, 12, { color: '#8a1c1c', minSize: 2, maxSize: 5, speed: 3, lifetime: 30 }),
        spark: (x, y) => spawnParticles(x, y, 7, { color: '#cfd2d8', minSize: 1, maxSize: 2.5, speed: 4, lifetime: 16 }),
    };

    // ═══════════════════════════════════════════════════════════════════
    // THE WARD: build it, dress it, walk into it
    // ═══════════════════════════════════════════════════════════════════
    const PILLAR_R = 34, STUMP_R = 24;
    function setBars(door, on) {
        for (const k of door.cells) ward.grid[k] = on ? T.BARS : T.HALL;
        door.barred = on; door.t = frames;
    }
    function free(x, y, r) {
        return ward.walkable(x, y) && ward.walkable(x + r, y) && ward.walkable(x - r, y) && ward.walkable(x, y + r) && ward.walkable(x, y - r);
    }
    // open ground in a room, clear of what stands there and not on top of him
    function spotIn(rm, pad = 30, away = 0, tries = 50) {
        for (let t = 0; t < tries; t++) {
            const k = rm.cells[Math.floor(Math.random() * rm.cells.length)];
            const x = (k % ward.GW + 0.5) * CELL + rand(-18, 18), y = (Math.floor(k / ward.GW) + 0.5) * CELL + rand(-18, 18);
            if (!free(x, y, pad)) continue;
            if (away && Math.hypot(x - sn.x, y - sn.y) < away) continue;
            if (obs.some(o => Math.hypot(x - o.x, y - o.y) < o.r + pad)) continue;
            return { x, y };
        }
        return { x: rm.x, y: rm.y };
    }

    function dress() {
        const R = ward.rnd, w = run.ward;
        const jit = n => (R() - 0.5) * n;
        const decal = (kind, x, y, size, o = {}) => decals.push({ kind, x, y, size, rot: o.rot ?? R() * TAU, alpha: o.alpha ?? 0.9, mode: o.mode || null, soft: !!o.soft });
        const scatter = [
            ['roots', 'roots', 'puddle', 'rubble', 'bloodA', 'pileB'],
            ['warA', 'warB', 'rubble', 'bloodB', 'broken', 'pileA'],
            ['puddle', 'puddle', 'pileA', 'pileB', 'bloodA', 'roots'],
            ['warB', 'bloodA', 'bloodB', 'rubble', 'warA', 'pileB'],
        ][w];
        const litter = (x, y, size) => {
            const kind = scatter[Math.floor(R() * scatter.length)];
            const blood = kind.startsWith('blood');
            decal(kind, x, y, size || 120 + R() * 90, blood ? { mode: 'multiply', soft: true } : kind === 'puddle' ? { alpha: 0.7 } : {});
        };
        // the outermost open ground along a ray from the room's heart
        const rim = (rm, a, inset) => {
            let d = 40;
            while (d < 900 && ward.roomAt(rm.x + Math.cos(a) * d, rm.y + Math.sin(a) * d) === rm && ward.walkable(rm.x + Math.cos(a) * d, rm.y + Math.sin(a) * d)) d += 12;
            d -= inset;
            return { x: rm.x + Math.cos(a) * d, y: rm.y + Math.sin(a) * d, d };
        };
        const pillar = (rm, x, y, brokenChance = 0.2) => {
            if (!free(x, y, 46) || ward.roomAt(x, y) !== rm) return;
            const broken = R() < brokenChance;
            obs.push({ x, y, r: broken ? STUMP_R : PILLAR_R, kind: broken ? 'stump' : 'pillar', room: rm.id });
            if (broken) decal('rubble', x + jit(40), y + 26 + jit(20), 96);
        };
        const shrineAt = (rm, x, y, variant, lit) => {
            const s = { x, y, r: 44, variant, lit, room: rm, flicker: R() * 10 };
            shrines.push(s); obs.push({ x, y, r: 44, kind: 'shrine', room: rm.id });
            return s;
        };

        for (const rm of ward.rooms) {
            const combat = rm.kind === 'combat' || rm.kind === 'elite' || rm.kind === 'boss';
            // a ring of diyas at the wall: dark until the chamber is his again
            const n = combat ? (rm.kind === 'boss' ? 16 : 10) : 6;
            for (let i = 0; i < n; i++) {
                const p = rim(rm, (i + 0.5) / n * TAU, 46);
                if (p.d > 90) diyas.push({ x: p.x, y: p.y, room: rm, lit: !combat && rm.kind !== 'shrine', flicker: R() * 10, at: 0 });
            }
            if (rm.kind === 'start') {
                shrineAt(rm, rm.x, rm.y - 70, 1, true);
                for (let i = 0; i < 4; i++) pickups.push({ kind: 'shard', x: rm.x + Math.cos(i * 1.57 + 0.8) * 150, y: rm.y + 70 + Math.sin(i * 1.57 + 0.8) * 80, off: R() * 9 });
                decal('fxSigil', rm.x, rm.y + 10, 380, { alpha: 0.16, mode: 'lighter', rot: 0 });
            } else if (rm.kind === 'shrine') {
                shrineAt(rm, rm.x, rm.y - 50, R() < 0.5 ? 1 : 2, false);
                decal('fxSigil', rm.x, rm.y + 10, 380, { alpha: 0.2, mode: 'lighter', rot: 0 });
            } else if (rm.kind === 'memory' || rm.kind === 'reliquary') {
                shrineAt(rm, rm.x, rm.y - 90, 2, true).keep = true;
                pickups.push({ kind: rm.kind === 'memory' ? 'memory' : 'boon', x: rm.x, y: rm.y + 60, off: R() * 9, room: rm });
                decal('pileA', rm.x - 160, rm.y + 60, 170); decal('bloodA', rm.x + 150, rm.y + 90, 150, { mode: 'multiply', soft: true });
                decal('fxSigil', rm.x, rm.y + 30, 260, { alpha: 0.18, mode: 'lighter', rot: 0 });
            } else if (rm.kind === 'trader') {
                obs.push({ x: rm.x, y: rm.y - 60, r: 50, kind: 'stall', room: rm.id });
                rm.stall = { x: rm.x, y: rm.y - 60 };
                for (let i = 0; i < 3; i++) pickups.push({ kind: 'shard', x: rm.x - 70 + i * 70, y: rm.y + 80, off: R() * 9 });
            } else {
                // the fighting ground: pillars to break a line of sight and wind a coil around, a bell, the war's leavings at the edges
                const hw = rm.hw * CELL, hh = rm.hh * CELL;
                if (rm.kind === 'boss') {
                    decal('fxSigil', rm.x, rm.y, rm.r * 1.5, { alpha: 0.2, mode: 'lighter', rot: 0 });
                    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.52; pillar(rm, rm.x + Math.cos(a) * rm.r * 0.7, rm.y + Math.sin(a) * rm.r * 0.7, 0.3); }
                } else if (rm.shape === 'rect') {
                    for (const sx of [-1, 1]) for (const sy of [-1, 1]) pillar(rm, rm.x + sx * hw * 0.52, rm.y + sy * hh * 0.5);
                    if (rm.hw >= 10) for (const sy of [-1, 1]) pillar(rm, rm.x, rm.y + sy * hh * 0.62, 0.5);
                } else if (rm.shape === 'cross') {
                    for (const sx of [-1, 1]) for (const sy of [-1, 1]) pillar(rm, rm.x + sx * rm.arm * CELL * 0.72, rm.y + sy * rm.arm * CELL * 0.72, 0.35);
                } else {
                    const k = 4 + Math.floor(R() * 3), a0 = R() * TAU;
                    for (let i = 0; i < k; i++) pillar(rm, rm.x + Math.cos(a0 + i / k * TAU) * rm.r * 0.56, rm.y + Math.sin(a0 + i / k * TAU) * rm.r * 0.56);
                }
                const nb = rm.kind === 'combat' ? 1 : 2;
                for (let i = 0; i < nb; i++) { const p = spotIn(rm, 50); if (dist(p, rm) > 60) bells.push({ x: p.x, y: p.y, r: 20, cd: 0, room: rm }); }
                for (let i = 0; i < 5; i++) { const p = rim(rm, R() * TAU, 70 + R() * 60); if (p.d > 150) litter(p.x, p.y); }
                if (w === 1 || w === 3) for (let i = 0; i < 2; i++) { const p = rim(rm, R() * TAU, 60); smokes.push({ x: p.x, y: p.y, seed: R() * 100 }); }
            }
        }

        // the passages: shards of the stone, and what the war left
        const G = ward.grid, GW = ward.GW, GH = ward.GH;
        const open = t => t === T.FLOOR || t === T.HALL || t === T.BARS;
        for (let cy = 1; cy < GH - 1; cy++) for (let cx = 1; cx < GW - 1; cx++) {
            const k = cy * GW + cx, x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL, h = R();
            if (G[k] === T.HALL) {
                if (h < 0.02) pickups.push({ kind: 'shard', x: x + jit(20), y: y + jit(20), off: R() * 9 });
                else if (h < 0.06) litter(x, y, 100 + R() * 70);
            } else if (G[k] === T.SOLID) {
                // Colossi lie deep in the rubble. Trees grow out of the ruined blocks in groves, set back from every
                // edge: a canopy rises a good 200px above its roots, so nothing open may lie within two cells of the
                // trunk or within five cells above it, or the tree would hang over a wall face or over the fight.
                const openNear = (r, up) => { for (let dy = -up; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && open(G[ny * GW + nx])) return true; } return false; };
                if (openNear(2, 5)) continue;
                if (!openNear(5, 8)) { if (h < 0.004) statues.push({ x, y, size: 380 + R() * 140, variant: R() < 0.5 ? 0 : 1, rot: jit(1.2) }); continue; }
                const grove = hash(Math.floor(cx / 5) * 12.9898 + Math.floor(cy / 5) * 78.233 + w) < (w === 0 ? 0.6 : w === 2 ? 0.12 : 0.22);
                if (grove && h < (w === 0 ? 0.3 : 0.14) && !trees.some(t => Math.abs(t.x - x) < 130 && Math.abs(t.y - y) < 100)) trees.push({ x: x + jit(24), y: y + jit(16), size: 200 + R() * 80, variant: 1 + Math.floor(R() * 3), sway: R() * 10 });
                else if (h > 0.985 && (w === 1 || w === 3)) smokes.push({ x, y, seed: R() * 100 });
            }
        }
    }

    function enterWard(i) {
        run.ward = i; theme = WARDS[i];
        run.wardPieces = 0; run.secondUsed = false;
        const unread = MEMORIES.some((_, k) => !save.memories.includes(k));
        ward = buildWard(i, run.seed + i * 977, { memory: unread });
        obs = []; decals = []; trees = []; statues = []; bells = []; shrines = []; diyas = []; smokes = []; pickups = [];
        enemies = []; spawns = []; shots = []; zones = []; rings = []; bolts = []; decoys = []; loops = []; labels = []; pools = []; beams = [];
        chunks = new Map(); explored = new Uint8Array(ward.GW * ward.GH); flow = new Int16Array(ward.GW * ward.GH);
        boss = null; room = null; show('gs-boss', false);
        const names = theme.rooms.slice().sort(() => ward.rnd() - 0.5);
        for (const rm of ward.rooms) {
            rm.state = rm.kind === 'combat' || rm.kind === 'elite' || rm.kind === 'boss' ? 'idle' : 'safe';
            rm.visited = false; rm.seen = !!has('sight');
            rm.name = rm.kind === 'start' ? 'The Waking Diya' : rm.kind === 'shrine' ? 'A Shrine Gone Dark' : rm.kind === 'memory' ? theme.landmark
                : rm.kind === 'reliquary' ? 'A Reliquary' : rm.kind === 'trader' ? 'The Yaksha’s Scales' : rm.kind === 'boss' ? theme.boss.name : names.pop() || 'A Nameless Court';
        }
        dress();
        ward.seal = theme.need > 0 ? ward.rooms.find(r => r.kind === 'boss').doors[0] : null;
        if (ward.seal) setBars(ward.seal, true);
        const start = ward.start, door = start.doors[0];
        sn.x = start.x; sn.y = start.y + 40;
        sn.angle = sn.targetAngle = Math.atan2(door.y - sn.y, door.x - sn.x);
        trail.clear(); for (let k = 0; k < 4; k++) trail.push(sn.x, sn.y, sn.angle);
        grace = 90; hurtCd = 0;
        const mc = $('gs-map');
        if (mc) { mc.width = 300; mc.height = Math.round(300 * ward.GH / ward.GW); }
        text('gs-act', 'WARD ' + theme.num); text('gs-act-title', theme.title);
        text('actNum', 'WARD ' + theme.num); text('actTitle', theme.title); text('actEpi', theme.epigraph);
        const card = $('gs-act-card');
        if (card) { card.classList.add('show'); cardUntil = performance.now() + 5600; later(() => card.classList.remove('show'), 4600); }
        soundtrack.sfxAct();
        save.bestWard = Math.max(save.bestWard, i);
        save.run = { ward: i, seed: run.seed, hp, hpMax, len: sn.len, boons: run.boons, pieces: run.pieces, shards: run.shards, kills: run.kills, coils: run.coils, bestCoil: run.bestCoil, frames: run.frames, lastWord: run.lastWord };
        writeSave(save);
        refreshHUD(); refreshBoons();
    }

    // ═══════════════════════════════════════════════════════════════════
    // BOONS, THE YAKSHA, MEMORIES
    // ═══════════════════════════════════════════════════════════════════
    function grant(b, quiet) {
        run.boons[b.id] = has(b.id) + 1;
        if (b.id === 'lotus') { hpMax += 25; hp = hpMax; }
        if (b.id === 'hoard') sn.len = Math.min(LEN_MAX, sn.len + 8);
        if (b.id === 'deep') venom = venomMax();
        if (b.id === 'sight' && ward) ward.rooms.forEach(r => { r.seen = true; });
        if (!quiet) { label(b.name, sn.x, sn.y - 70, ASPECTS[b.aspect].color, 22); burst.gold(sn.x, sn.y); soundtrack.sfxShrine(); showQuote('boon', 4000, 0.35); }
        refreshHUD(); refreshBoons();
    }
    function rollBoons(n) {
        const pool = BOONS.filter(b => has(b.id) < (b.stack || 1)).sort(() => Math.random() - 0.5);
        // not three of one aspect if it can be helped: a choice should be between ways of fighting
        const out = [];
        for (const b of pool) { if (out.length < n && out.filter(o => o.aspect === b.aspect).length < 2) out.push(b); }
        for (const b of pool) if (out.length < n && !out.includes(b)) out.push(b);
        return out;
    }
    let choice = null;
    function openChoice(kind) {
        const yak = kind === 'yaksha';
        const cut = perk(4) ? 0.75 : 1;
        const items = yak ? YAKSHA.map(y => ({ ...y, cost: Math.max(1, Math.round(y.cost * cut)), aspect: 'coil', sold: false })) : rollBoons(3 + (perk(2) ? 1 : 0));
        if (!items.length) return;
        choice = { kind, items };
        modal = 'choice';
        text('choiceKicker', yak ? 'The Yaksha weighs you' : 'Vardaan');
        text('choiceTitle', yak ? 'Paid in Length' : 'Choose a Boon');
        text('choiceSub', yak ? `You are ${sn.len} segments long. He will not take you below ${LEN_MIN}.` : 'One. The others go back into the dark.');
        show('choiceSkip', yak, '');
        renderChoice();
        show('choiceOverlay', true);
    }
    function renderChoice() {
        const box = $('choiceCards');
        if (!box || !choice) return;
        box.innerHTML = choice.items.map((b, i) => {
            const a = ASPECTS[b.aspect] || ASPECTS.coil;
            const owned = choice.kind === 'boon' && has(b.id) ? `<div class="card-cost">held ×${has(b.id)}</div>` : '';
            const cost = choice.kind === 'yaksha' ? `<div class="card-cost">${b.sold ? 'taken' : b.cost + ' length'}</div>` : owned;
            return `<button class="gs-card${b.sold ? ' sold' : ''}" data-i="${i}" style="--aspect:${a.color}"><span class="card-key">${i + 1}</span><div class="card-skt">${choice.kind === 'yaksha' ? b.skt : a.label + ' · ' + b.skt}</div><h3>${b.name}</h3><p>${b.text}</p>${cost}</button>`;
        }).join('');
        if (choice.kind === 'yaksha') text('choiceSub', `You are ${sn.len} segments long. He will not take you below ${LEN_MIN}.`);
    }
    function pickChoice(i) {
        if (!choice || !choice.items[i]) return;
        const b = choice.items[i];
        if (choice.kind === 'boon') { closeChoice(); grant(b); return; }
        if (b.sold) return;
        if (sn.len - b.cost < LEN_MIN) { text('choiceSub', 'Too short. He shakes his head.'); return; }
        sn.len -= b.cost; trail.trim(sn.len * SG + 1); b.sold = true;
        if (b.id === 'heal') hp = Math.min(hpMax, hp + 45);
        if (b.id === 'heart') { hpMax += 15; hp += 15; }
        if (b.id === 'boon') { const r = rollBoons(1)[0]; if (r) { grant(r, true); label(r.name, sn.x, sn.y - 70, ASPECTS[r.aspect].color, 22); } }
        soundtrack.sfxShrine();
        renderChoice(); refreshHUD();
    }
    function closeChoice() {
        choice = null; modal = null; show('choiceOverlay', false); grace = Math.max(grace, 40);
    }
    const onCard = e => { const b = e.target.closest('[data-i]'); if (b) pickChoice(+b.dataset.i); };
    const cardBox = $('choiceCards');
    if (cardBox) cardBox.addEventListener('click', onCard);

    function openMemory() {
        const idx = MEMORIES.findIndex((_, i) => !save.memories.includes(i));
        if (idx < 0) return;
        save.memories.push(idx); writeSave(save);
        if (idx === 0) { hpMax += 10; hp += 10; }
        if (idx === 2) sn.len = Math.min(LEN_MAX, sn.len + 4);
        hp = Math.min(hpMax, hp + 20);
        soundtrack.sfxMemory();
        text('memKicker', `MEMORY ${ROMAN[idx]} OF IX`); text('memTitle', MEMORIES[idx].title); text('memText', MEMORIES[idx].text);
        text('memReward', MEMORY_PERKS[idx]);
        modal = 'memory'; show('memoryOverlay', true);
        refreshHUD();
    }
    function closeMemory() {
        if (modal !== 'memory') return;
        modal = null; show('memoryOverlay', false); grace = Math.max(grace, 60);
        showQuote('memory', 3500);
    }
    function openCodex() {
        const list = $('codexList');
        if (list) list.innerHTML = MEMORIES.map((m, i) => save.memories.includes(i)
            ? `<div class="codex-entry"><h3><small>${ROMAN[i]}</small>${m.title}</h3><p>${m.text}</p><p class="codex-perk">${MEMORY_PERKS[i]}</p></div>`
            : `<div class="codex-entry locked"><h3><small>${ROMAN[i]}</small>—</h3><p>Still waiting somewhere in the city.</p></div>`).join('');
        text('codexSub', `${save.memories.length} of 9 recovered`);
        show('codexOverlay', true);
    }
    const closeCodex = () => show('codexOverlay', false);
    function togglePause() {
        if (over || !session.started || modal) return;
        paused = !paused;
        show('pauseOverlay', paused);
    }

    // ═══════════════════════════════════════════════════════════════════
    // HUD
    // ═══════════════════════════════════════════════════════════════════
    function refreshHUD() {
        const set = (id, p) => { const el = $(id); if (el) el.style.width = Math.max(0, Math.min(100, p * 100)).toFixed(1) + '%'; };
        set('hpBar', hp / hpMax); text('hpLabel', Math.ceil(Math.max(0, hp)) + ' / ' + hpMax);
        set('lenBar', sn.len / LEN_MAX); text('lenVal', String(sn.len));
        text('soulVal', String(run.pieces)); text('memVal', String(save.memories.length));
        const pp = $('piecePips');
        if (pp) {
            let h = '';
            const need = theme.need;
            if (!need) h = '<em>she is with you</em>';
            else for (let i = 0; i < WARD_PIECES; i++) h += `<b class="${i < run.wardPieces ? 'on' : ''}${i === need - 1 ? ' seal' : ''}"></b>`;
            pp.innerHTML = h;
        }
        const mp = $('memPips');
        if (mp) mp.innerHTML = MEMORIES.map((_, i) => `<b class="${save.memories.includes(i) ? 'on' : ''}"></b>`).join('');
        setBiteUI(); setShedUI();
    }
    function refreshBoons() {
        const html = BOONS.filter(b => has(b.id)).map(b => `<li style="--aspect:${ASPECTS[b.aspect].color}"><b>${b.name}${has(b.id) > 1 ? ' ×' + has(b.id) : ''}</b><span>${b.text}</span></li>`).join('');
        const side = $('gs-boons'), pause = $('pauseBoons');
        if (side) side.innerHTML = BOONS.filter(b => has(b.id)).map(b => `<li style="--aspect:${ASPECTS[b.aspect].color}">${b.name}${has(b.id) > 1 ? ' ×' + has(b.id) : ''}</li>`).join('');
        if (pause) pause.innerHTML = html || '<li class="none"><span>No boons yet. The shrines are dark until you reach them.</span></li>';
    }
    function setBiteUI() {
        const el = $('gs-bite');
        if (el) { el.className = venom >= SPIT_COST ? 'ready' : 'empty'; el.style.setProperty('--p', (venom / venomMax()).toFixed(2)); }
        const bb = $('gs-bite-btn'); if (bb) bb.classList.toggle('cooling', venom < SPIT_COST);
    }
    function setShedUI() {
        const state = shed.active > 0 ? 'active' : shed.cd > 0 ? 'cooling' : 'ready';
        const el = $('gs-shed');
        if (el) { el.className = state; el.style.setProperty('--p', state === 'cooling' ? (1 - shed.cd / shedCd()).toFixed(2) : state === 'ready' ? 1 : 0); }
        text('gs-shed-label', state === 'active' ? 'Shedding' : state === 'ready' ? 'Shed · space' : 'Regrowing');
        const sb = $('gs-shed-btn'); if (sb) sb.classList.toggle('cooling', state !== 'ready');
    }
    function bossBar() {
        if (!boss) return;
        const el = $('bossBar'); if (el) el.style.width = Math.max(0, boss.hp / boss.maxHp * 100).toFixed(1) + '%';
        const box = $('gs-boss'); if (box) box.classList.toggle('bound', boss.bound > 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // INPUT
    // ═══════════════════════════════════════════════════════════════════
    let musicStarted = false;
    function startMusicOnce() {
        if (musicStarted || !session.started) return;
        musicStarted = true;
        if (!soundtrack.isPlaying()) soundtrack.start();
        soundtrack.sfxGameStart();
    }
    const MOVE = { w: 'w', arrowup: 'w', s: 's', arrowdown: 's', a: 'a', arrowleft: 'a', d: 'd', arrowright: 'd' };
    const FIRE = new Set(['f', 'e', 'j', 'shift', 'enter']);
    function onKeyDown(e) {
        const k = e.key.toLowerCase();
        if (modal === 'choice') {
            if (k >= '1' && k <= '4') pickChoice(+k - 1);
            else if (k === 'escape' && choice && choice.kind === 'yaksha') closeChoice();
            e.preventDefault(); return;
        }
        if (modal === 'memory') { if (k === 'enter' || k === 'escape' || k === ' ') { closeMemory(); e.preventDefault(); } return; }
        if (MOVE[k]) { startMusicOnce(); keys[MOVE[k]] = true; mouse.on = false; e.preventDefault(); return; }
        if (k === ' ') { e.preventDefault(); tryShed(); return; }
        if (FIRE.has(k)) { e.preventDefault(); keys.fire = true; return; }
        if (k === 'p' || k === 'escape') {
            const codex = $('codexOverlay');
            if (codex && codex.style.display === 'flex') { closeCodex(); return; }
            togglePause();
        }
    }
    function onKeyUp(e) {
        const k = e.key.toLowerCase();
        if (FIRE.has(k)) keys.fire = false;
        if (MOVE[k]) keys[MOVE[k]] = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // mouse: the head follows the cursor (the easiest way to draw a circle), click strikes, right click sheds
    const mouse = { x: 0, y: 0, on: false };
    function onMouseMove(e) { mouse.x = e.clientX * viewScale; mouse.y = e.clientY * viewScale; mouse.on = true; }
    function onMouseDown(e) {
        if (e.target !== canvas) return;
        startMusicOnce(); onMouseMove(e);
        if (e.button === 2) tryShed(); else if (e.button === 0) keys.fire = true;
    }
    function onMouseUp(e) { if (e.button === 0) keys.fire = false; }
    const noMenu = e => e.preventDefault();
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', noMenu);

    // touch: drag to steer, double tap to shed, hold STRIKE
    let touchActive = false, tsx = 0, tsy = 0, tcx = 0, tcy = 0, touchAngle = 0, lastTap = 0;
    function onTouchStart(e) {
        if (e.target !== canvas) return;
        e.preventDefault();
        const t = e.touches[0];
        tsx = tcx = t.clientX * viewScale; tsy = tcy = t.clientY * viewScale;
        touchActive = true; startMusicOnce();
        const now = performance.now();
        if (now - lastTap < 300) tryShed();
        lastTap = now;
    }
    function onTouchMove(e) {
        e.preventDefault();
        if (!touchActive) return;
        const t = e.touches[0];
        tcx = t.clientX * viewScale; tcy = t.clientY * viewScale;
        if (Math.hypot(tcx - tsx, tcy - tsy) > 15) { touchAngle = Math.atan2(tcy - tsy, tcx - tsx); sn.targetAngle = touchAngle; }
    }
    function onTouchEnd(e) { e.preventDefault(); touchActive = false; }
    const biteBtn = $('gs-bite-btn');
    const fireOn = e => { e.preventDefault(); keys.fire = true; startMusicOnce(); };
    const fireOff = e => { e.preventDefault(); keys.fire = false; };
    if (biteBtn) {
        biteBtn.addEventListener('touchstart', fireOn, { passive: false });
        biteBtn.addEventListener('touchend', fireOff, { passive: false });
        biteBtn.addEventListener('touchcancel', fireOff, { passive: false });
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // ═══════════════════════════════════════════════════════════════════
    // HARM: his, then theirs
    // ═══════════════════════════════════════════════════════════════════
    function stunAll(x, y, radius, dur) {
        for (const e of enemies) {
            if (e.dead || Math.hypot(e.x - x, e.y - y) > radius) continue;
            e.stun = Math.max(e.stun, e.type === 'boss' || e.type === 'sentinel' ? Math.round(dur * 0.4) : dur);
        }
    }
    function hurt(amount, src) {
        if (hurtCd > 0 || grace > 0 || shed.active > 0 || over) return false;
        hp -= Math.round(amount * scale());
        hurtCd = 50; hurtFlash = 1; shake = Math.max(shake, 6); run.hurts++;
        soundtrack.sfxLunge(); burst.blood(sn.x, sn.y);
        spawnFx('fxClaw', sn.x, sn.y, { size0: 60, size1: 130, life: 14, rot: rand(TAU), alpha: 0.9 });
        if (src) {
            const a = Math.atan2(sn.y - src.y, sn.x - src.x);
            for (let d = 46; d > 0; d -= 8) { const x = sn.x + Math.cos(a) * d, y = sn.y + Math.sin(a) * d; if (free(x, y, 12)) { sn.x = x; sn.y = y; break; } }
        }
        if (hp <= 0) fall(); else showQuote('hurt', 3000, 0.1);
        refreshHUD();
        return true;
    }
    // the coil is exposed: what gnaws it wounds him, less than a blow to the head and without throwing him
    function bodyHurt(amount, x, y) {
        if (has('scales') || bodyCd > 0 || grace > 0 || shed.active > 0 || over) return;
        hp -= Math.round(amount * scale());
        bodyCd = 36; hurtFlash = Math.max(hurtFlash, 0.45);
        burst.blood(x, y); soundtrack.sfxStomp(0.4);
        if (hp <= 0) fall();
        refreshHUD();
    }
    function fall() {
        if (has('second') && !run.secondUsed) {
            run.secondUsed = true; hp = Math.round(hpMax * 0.3); grace = 100;
            tryShed(true); stunAll(sn.x, sn.y, 420, 120); label('SECOND SKIN', sn.x, sn.y - 60, '#c9b58a', 22);
            return;
        }
        if (perk(8) && !run.lastWord) {
            run.lastWord = true; hp = 1; grace = 150;
            stunAll(sn.x, sn.y, 600, 200); spawnFx('fxSigil', sn.x, sn.y, { size0: 80, size1: 700, life: 46, spin: 0.03 });
            soundtrack.sfxBell(); showQuote('lastword', 5000);
            return;
        }
        hp = 0;
        endRun(false);
    }

    function nearestEnemy(x, y, radius, angle = null, cone = Math.PI) {
        let best = null, bd = Infinity;
        for (const e of enemies) {
            if (e.dead || e.hidden || (e.type === 'drowned' && e.state === 'lurk')) continue;
            const d = Math.hypot(e.x - x, e.y - y);
            if (d > radius + e.r || d >= bd) continue;
            if (angle !== null && Math.abs(angDiff(Math.atan2(e.y - y, e.x - x), angle)) > cone) continue;
            best = e; bd = d;
        }
        return best;
    }
    // kind: fang | venom | coil | bell | burn
    function wound(e, amount, kind) {
        if (e.dead || e.hidden || e.dying || e.shield) return false;
        if (e.type === 'boss') {
            if (kind === 'coil') {
                amount *= 3;        // the coil is what unmakes a guardian; the fangs only finish what it opens
                // brass does not bend. It can be bound.
                if (e.bound <= 0) { e.stun = 80; e.state = 'rest'; e.timer = 20; e.leap = false; label('BOUND', e.x, e.y - e.size * 0.45, '#ffd070', 26); }
                e.bound = Math.max(e.bound, 300); e.armor = false;
            } else if (e.armor) { amount *= 0.35; burst.spark(e.x, e.y - 10); hint('armour'); }
            else amount *= 2;
        }
        if (e.type === 'hunter' && e.state === 'recover') amount *= 2;
        if (kind === 'fang' && has('garuda') && (e.stun > 0 || e.bound > 0)) amount *= 3;
        e.hp -= amount; e.hurtT = 10;
        if (kind === 'venom' && has('halahala')) e.burn = 180;
        if (e === boss) bossBar();
        if (e.hp <= 0) {
            if (e.type === 'boss') { startFinale(e); return false; }
            banish(e, kind); return true;
        }
        if (e.type === 'boss') {
            const want = e.hp < e.maxHp * 0.33 ? 2 : e.hp < e.maxHp * 0.66 ? 1 : 0;
            if (want > e.phaseN) bossRoar(e, want);
        }
        if (kind !== 'burn') {
            if (e.type !== 'boss') e.stun = Math.max(e.stun, kind === 'coil' ? 50 : e.type === 'sentinel' ? 4 : 10);
            spawnFx('fxBlood', e.x, e.y, { size0: 40, size1: 90, life: 18, spin: 0.02, rot: rand(TAU), light: false, alpha: 0.85 });
            soundtrack.sfxStomp(0.5);
        }
        return false;
    }
    function banish(e, kind) {
        e.dead = true; run.kills++;
        burst.ash(e.x, e.y);
        spawnFx('fxBlood', e.x, e.y, { size0: 60, size1: 190, life: 26, spin: 0.03, rot: rand(TAU), light: false, alpha: 0.95 });
        spawnFx('fxSigil', e.x, e.y, { size0: 60, size1: 230, life: 32, spin: 0.06, alpha: 0.8, delay: 2 });
        soundtrack.sfxBanish();
        if (kind === 'fang' && has('rakta')) hp = Math.min(hpMax, hp + 5);
        if (e.type === 'boss') { bossDown(e); return; }
        if (kind === 'silent') return;
        const n = (E[e.type].shards || 1) + (e.elite ? 3 : 0);
        for (let i = 0; i < n; i++) { const a = rand(TAU), s = rand(2, 5); pickups.push({ kind: 'shard', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, off: rand(9) }); }
        showQuote('banish', 3000, 0.06);
    }

    function tryShed(gift) {
        if (over || paused || modal || !session.started || shed.active > 0) return;
        if (gift !== true) {
            if (shed.cd > 0) return;
            if (sn.len - shedCost() < LEN_MIN) { label('too short to shed', sn.x, sn.y - 50, '#9c8a66', 15); return; }
            sn.len -= shedCost(); shed.cd = shedCd();
        }
        startMusicOnce();
        // the old skin lies where it was left, and for a while they cannot tell it from him
        const pts = [];
        for (let s = 0; s < sn.len; s++) { const i = s * SG; if (i >= trail.n) break; const k = trail.at(i); pts.push({ x: trail.x[k], y: trail.y[k], a: trail.a[k] }); }
        decoys.push({ pts, x: sn.x, y: sn.y, t: 200 });
        shed.active = SHED_FRAMES;
        soundtrack.sfxShed();
        showQuote('shed', 3500, 0.15);
        setShedUI(); refreshHUD();
    }

    // F, held or tapped: the fangs if anything is within reach, otherwise a bolt of venom at what is ahead
    function tryBite() {
        if (over || paused || modal || !session.started || bite.cd > 0 || shed.active > 0) return;
        startMusicOnce();
        const near = nearestEnemy(sn.x, sn.y, BITE_REACH);
        // the snap also swats what was thrown at him
        let swatted = false;
        for (let i = shots.length - 1; i >= 0; i--) if (dist(shots[i], sn) < 92) { burst.spark(shots[i].x, shots[i].y); shots.splice(i, 1); swatted = true; }
        if (near || swatted) {
            bite.active = 6; bite.cd = 22;
            soundtrack.sfxBite();
            if (near) {
                sn.angle = sn.targetAngle = Math.atan2(near.y - sn.y, near.x - sn.x);
                spawnFx('fxSlash', near.x, near.y, { size0: 70, size1: 130, life: 14, rot: sn.angle + rand(-0.3, 0.3) });
                if (wound(near, biteDmg(), 'fang')) showQuote('bite', 3000, 0.08);
            }
            spawnFx('fxSigil', sn.x + Math.cos(sn.angle) * 40, sn.y + Math.sin(sn.angle) * 40, { size0: 30, size1: 120, life: 18, spin: -0.1, alpha: 0.7 });
            return;
        }
        if (venom < SPIT_COST) { if (bumpCd <= 0) { bumpCd = 60; showQuote('empty', 2200); } return; }
        venom -= SPIT_COST; bite.cd = 22;
        const aim = nearestEnemy(sn.x, sn.y, 620, sn.angle, 1.2);
        const a = aim ? Math.atan2(aim.y - sn.y, aim.x - sn.x) : sn.angle;
        const n = has('twin') ? 2 : 1;
        for (let i = 0; i < n; i++) {
            const b = n === 2 ? a + (i ? 0.17 : -0.17) : a;
            bolts.push({ x: sn.x + Math.cos(b) * 26, y: sn.y + Math.sin(b) * 26, a: b, speed: 11, life: 62, target: aim, pierce: has('pierce') ? 2 : 0, hit: [] });
        }
        soundtrack.sfxBite();
        setBiteUI();
    }
    const flies = (x, y) => { const t = ward.at(x, y); return t !== T.SOLID && t !== T.BARS; };   // what a thrown thing may cross: water, not walls
    function updateBolts() {
        for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            if (b.target && !b.target.dead && !b.target.hidden) b.a += Math.max(-0.14, Math.min(0.14, angDiff(Math.atan2(b.target.y - b.y, b.target.x - b.x), b.a)));
            b.x += Math.cos(b.a) * b.speed; b.y += Math.sin(b.a) * b.speed;
            spawnParticles(b.x, b.y, 1, { color: '#b9e06a', minSize: 1, maxSize: 3, speed: 0.4, lifetime: 16 });
            let gone = --b.life <= 0 || !flies(b.x, b.y);
            if (!gone) for (const e of enemies) {
                if (e.dead || e.hidden || b.hit.includes(e) || (e.type === 'drowned' && e.state === 'lurk')) continue;
                if (Math.hypot(e.x - b.x, e.y - b.y) > e.r + 12) continue;
                // a Sentinel's front is a shield wall: only its back and its stunned body take venom
                if (e.type === 'sentinel' && e.stun <= 0 && e.state !== 'rest' && Math.abs(angDiff(Math.atan2(b.y - e.y, b.x - e.x), e.face)) < 1.05) {
                    burst.spark(b.x, b.y); soundtrack.sfxStomp(0.3); gone = true; break;
                }
                wound(e, 2, 'venom');
                spawnFx('fxSigil', e.x, e.y, { size0: 40, size1: 150, life: 26, spin: 0.08, alpha: 0.9 });
                if (b.pierce > 0) { b.pierce--; b.hit.push(e); b.target = null; } else { gone = true; break; }
            }
            if (gone) { spawnFx('fxVenom', b.x, b.y, { size0: 30, size1: 110, life: 20, spin: 0.05, rot: rand(TAU) }); bolts.splice(i, 1); }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // THE COIL
    // The head's newest step is tested against the body's path. Where they cross, the stretch of trail
    // between is a closed loop: everything standing inside it is crushed, more for every one caught together.
    // ═══════════════════════════════════════════════════════════════════
    function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
        const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
        const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
        return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
    }
    function inPoly(x, y, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const a = pts[i], b = pts[j];
            if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }
    function checkCoil() {
        if (coilCd > 0 || trail.n < 60) return;
        const k0 = trail.at(0), k1 = trail.at(1);
        const ax = trail.x[k1], ay = trail.y[k1], bx = trail.x[k0], by = trail.y[k0];
        const max = Math.min(trail.n - 2, sn.len * SG);
        for (let i = 40; i < max; i++) {
            const c = trail.at(i), d = trail.at(i + 1);
            if (segHit(ax, ay, bx, by, trail.x[c], trail.y[c], trail.x[d], trail.y[d])) { closeCoil(i); return; }
        }
    }
    function closeCoil(upTo) {
        const pts = [];
        let area = 0, cx = 0, cy = 0;
        for (let i = 0; i <= upTo; i += 3) { const k = trail.at(i); pts.push({ x: trail.x[k], y: trail.y[k] }); }
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { area += pts[j].x * pts[i].y - pts[i].x * pts[j].y; cx += pts[i].x; cy += pts[i].y; }
        area = Math.abs(area) / 2; cx /= pts.length; cy /= pts.length;
        coilCd = 12;
        if (area < 5200) return;
        const caught = enemies.filter(e => !e.dead && !e.hidden && inPoly(e.x, e.y, pts));
        const n = caught.length;
        loops.push({ pts, t: 0, hit: n > 0, cx, cy });
        // whatever lies inside comes to him: shards, pieces of her
        for (const p of pickups) if ((p.kind === 'shard' || p.kind === 'piece') && inPoly(p.x, p.y, pts)) p.magnet = true;
        for (let i = shots.length - 1; i >= 0; i--) if (inPoly(shots[i].x, shots[i].y, pts)) { burst.spark(shots[i].x, shots[i].y); shots.splice(i, 1); }
        if (!n) return;
        const dmg = crushDmg() + 2 * (n - 1);
        let killed = 0;
        for (const e of caught) if (wound(e, dmg, 'coil')) killed++;
        run.coils++; run.bestCoil = Math.max(run.bestCoil, n);
        freeze = 3 + Math.min(4, n); shake = Math.max(shake, 6 + n * 2); coilCd = 20;
        spawnFx('fxSigil', cx, cy, { size0: 80, size1: Math.sqrt(area) * 1.6, life: 34, spin: 0.05 });
        spawnFx('fxCoil', cx, cy, { size0: Math.sqrt(area) * 2.3, size1: Math.sqrt(area) * 0.8, life: 24, spin: 0.09, rot: rand(TAU) });      // the ouroboros, tightening
        soundtrack.sfxStomp(1); soundtrack.sfxBell();
        if (n >= 2) label('KUNDALI ×' + n, cx, cy - 30, '#ffd070', 20 + Math.min(14, n * 3));
        if (has('ouro')) hp = Math.min(hpMax, hp + 4 * n);
        if (has('mandala')) { stunAll(cx, cy, 260, 110); spawnFx('fxSigil', cx, cy, { size0: 120, size1: 520, life: 30, spin: -0.04, alpha: 0.6 }); }
        if (killed) showQuote('coil', 3500, 0.12);
        save.hints.coiled = 1;
        refreshHUD();
    }
    function bodyNear(x, y, r) {
        for (let s = 2; s < sn.len; s += 2) {
            const i = s * SG; if (i >= trail.n) break;
            const k = trail.at(i);
            if (Math.hypot(trail.x[k] - x, trail.y[k] - y) < r) return { x: trail.x[k], y: trail.y[k] };
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CHAMBERS
    // ═══════════════════════════════════════════════════════════════════
    let fight = null;       // the chamber that is sealed around him now
    function planWaves(rm) {
        if (rm.kind === 'boss') return [];
        if (run.ward === 0 && rm.depth === 1 && !save.hints.coiled) return [['wraith', 'wraith', 'wraith']];   // the first lesson
        let budget = theme.budget * (run.ward === 0 ? 1.5 : 1.15) + rm.depth * 0.9 + Math.min(4, Math.max(0, sn.len - 24) / 14);                            // the stone on him carries: greed draws them
        if (rm.kind === 'elite') budget *= 1.15;
        const count = run.ward === 0 && rm.depth <= 1 ? 1 : rm.kind === 'elite' || run.ward >= 2 ? 3 : 2;
        const roster = run.ward === 0 && rm.depth >= 3 ? theme.roster.concat([['preta', 1, 1]]) : theme.roster;      // the Gardens' last chambers are haunted too
        const waves = [];
        for (let w = 0; w < count; w++) {
            let b = budget * (count === 1 ? 1 : count === 2 ? (w === 0 ? 0.55 : 0.65) : 0.44);
            const list = [];
            let heavy = 0;
            while (b >= 1 && list.length < 9) {
                const opts = roster.filter(([t, cost]) => cost <= b + 0.5 && !(t === 'sentinel' && heavy >= (run.ward === 3 ? 2 : 1)) && !(run.ward === 0 && t === 'hunter' && rm.depth < 2));
                if (!opts.length) break;
                let roll = rand(opts.reduce((s, o) => s + o[2], 0)), pickd = opts[0];
                for (const o of opts) { roll -= o[2]; if (roll <= 0) { pickd = o; break; } }
                list.push(pickd[0]); b -= pickd[1];
                if (pickd[0] === 'sentinel') heavy++;
            }
            waves.push(list);
        }
        if (rm.kind === 'elite') waves[0].unshift('*' + ['hunter', 'sentinel', 'mantrik', 'sentinel'][run.ward]);
        return waves;
    }
    function spawnWave(rm) {
        for (const t of rm.waves[rm.wave]) {
            const elite = t[0] === '*', p = spotIn(rm, 34, 230);
            spawns.push({ type: elite ? t.slice(1) : t, x: p.x, y: p.y, t: 0, T: 44 + Math.floor(rand(24)), room: rm, elite });
        }
        rm.wave++;
    }
    function makeEnemy(type, x, y, rm, elite) {
        const d = E[type];
        const e = {
            type, x, y, room: rm, r: d.r, size: d.size, speed: d.speed, dmg: d.dmg, hp: Math.ceil(d.hp * (1 + 0.4 * run.ward)),
            state: type === 'hunter' ? 'stalk' : type === 'mantrik' ? 'range' : type === 'drowned' ? 'lurk' : 'chase',
            timer: type === 'hunter' ? rand(40, 120) : type === 'mantrik' ? rand(60, 150) : 0,
            stun: 0, face: Math.PI / 2, phase: rand(4), flip: false, cd: 0, side: Math.random() < 0.5 ? -1 : 1, burn: 0, hurtT: 0, blocked: 0, rise: 30, elite: !!elite,
        };
        if (elite) { e.hp = Math.ceil(e.hp * 2.6); e.size *= 1.3; e.r *= 1.25; e.speed *= 1.12; e.dmg *= 1.2; }
        e.maxHp = e.hp;
        return e;
    }
    function startEncounter(rm) {
        rm.state = 'active'; fight = rm;
        for (const d of rm.doors) setBars(d, true);
        soundtrack.sfxBell(); shake = Math.max(shake, 7);
        if (rm.kind === 'boss') {
            const b = theme.boss;
            boss = { type: 'boss', boss: b, x: rm.x, y: rm.y - 60, room: rm, r: b.r, size: b.size, speed: b.speed, dmg: 14, hp: Math.round(b.hp * 1.15), maxHp: Math.round(b.hp * 1.15), phaseN: 0, state: 'intro', timer: 110, stun: 0, face: Math.PI / 2, phase: 0, flip: false, side: 1, burn: 0, hurtT: 0, blocked: 0, armor: true, bound: 0, last: null };
            if (dist(boss, sn) < 300) boss.y = rm.y + (sn.y < rm.y ? 160 : -160);
            enemies.push(boss);
            text('bossName', b.name); text('bossTitle', b.title); show('gs-boss', true, 'block'); bossBar();
            spawnFx('fxSigil', boss.x, boss.y, { size0: 500, size1: 120, life: 60, spin: 0.05, alpha: 0.9 });
            splash = { title: b.name.toUpperCase(), sub: b.title, t: 0, T: 170, color: '230,207,143' };
            spawnFx('fxShock', boss.x, boss.y, { size0: 60, size1: 700, life: 46, alpha: 0.8, delay: 60 });
            say(b.line, 5600);
        } else {
            rm.waves = planWaves(rm); rm.wave = 0;
            spawnWave(rm);
            showQuote('seal', 3500, 0.25);
            if (!save.hints.coiled) hint('coil', true); else hint(run.kills > 2 ? 'shed' : 'strike');
        }
    }
    function clearRoom(rm) {
        rm.state = 'cleared'; fight = null;
        for (const d of rm.doors) setBars(d, false);
        let i = 0;
        for (const d of diyas) if (d.room === rm) d.at = frames + (i++) * 5;
        for (let p = 0; p < rm.pieces; p++) {
            const a = p / Math.max(1, rm.pieces) * TAU + 0.6;
            pickups.push({ kind: 'piece', x: rm.x, y: rm.y, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, off: rand(9) });
        }
        if (rm.kind === 'elite' || rm.kind === 'boss') pickups.push({ kind: 'boon', x: rm.x, y: rm.y - 70, off: rand(9), room: rm });
        if (run.ward === 3 && rm.kind !== 'boss') pickups.push({ kind: 'heal', x: rm.x, y: rm.y, off: rand(9) });
        if (has('diya')) hp = Math.min(hpMax, hp + 10);
        spawnFx('fxSigil', rm.x, rm.y, { size0: 100, size1: rm.r * 2, life: 50, spin: 0.02, alpha: 0.7 });
        soundtrack.sfxShrine();
        showQuote('cleared', 3800, 0.3);
        if (rm.pieces) hint('seal');
        refreshHUD();
    }
    // Two thirds, one third: the guardian throws him off, cannot be hurt for a breath, and comes back with more.
    function bossRoar(e, phase) {
        e.phaseN = phase; e.state = 'roar'; e.timer = 70; e.shield = true; e.leap = false; e.hidden = false; e.bound = 0; e.armor = true; e.stun = 0; e.combo = 0;
        shots = []; zones = []; rings = []; beams = [];
        spawnFx('fxShock', e.x, e.y, { size0: 90, size1: 1000, life: 44, alpha: 0.95 });
        spawnFx('fxFire', e.x, e.y - 20, { size0: 120, size1: 460, life: 30, rot: rand(TAU) });
        shake = 15; freeze = 7; flash = 0.45; soundtrack.sfxBell(); soundtrack.sfxStomp(1);
        splash = { title: PHASE_LINES[phase - 1] || PHASE_LINES[0], sub: e.boss.name, t: 0, T: 120, color: '255,130,80' };
        // thrown clear, not hurt, and something to drink before the next round
        const a = Math.atan2(sn.y - e.y, sn.x - e.x);
        for (let d = 190; d > 0; d -= 20) { const x = sn.x + Math.cos(a) * d, y = sn.y + Math.sin(a) * d; if (ward.roomAt(x, y) === e.room && free(x, y, 14)) { sn.x = x; sn.y = y; break; } }
        grace = Math.max(grace, 80);
        const p = spotIn(e.room, 40, 160);
        pickups.push({ kind: 'heal', x: p.x, y: p.y, off: rand(9) });
        bossBar();
    }
    // Its health is gone: time slows, the brass comes apart piece by piece, and only then is it unmade.
    function startFinale(e) {
        e.dying = 150; e.hp = 0; e.stun = 0; e.state = 'dying'; e.leap = false; e.hidden = false; e.bound = 0; e.shield = false;
        for (const f of enemies) if (f !== e && !f.dead) banish(f, 'silent');
        spawns = []; shots = []; zones = []; rings = []; pools = []; beams = [];
        grace = Math.max(grace, 420); slowmo = 110; shake = 14; flash = 0.35;
        splash = { title: 'UNMADE', sub: e.boss.name, t: 0, T: 200, color: '255,214,130' };
        bossBar(); soundtrack.sfxBell();
    }
    function bossDown(e) {
        const rm = e.room;
        for (const f of enemies) if (f !== e && !f.dead) banish(f, 'silent');
        spawns = []; shots = []; zones = []; rings = []; pools = []; beams = [];
        shake = 16; freeze = 12;
        for (let i = 0; i < 8; i++) { const a = rand(TAU), s = rand(2, 7); pickups.push({ kind: 'shard', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, off: rand(9) }); }
        burst.gold(e.x, e.y);
        show('gs-boss', false);
        const last = run.ward === WARDS.length - 1;
        clearRoom(rm);
        boss = null;
        if (last) { grace = 9999; later(() => endRun(true), 2600); }
        else pickups.push({ kind: 'exit', x: rm.x, y: rm.y + 90, off: 0 });
    }
    function unseal() {
        setBars(ward.seal, false);
        const rm = ward.rooms.find(r => r.kind === 'boss'); rm.seen = true;
        label('THE SEAL BREAKS', sn.x, sn.y - 90, '#ffd070', 24);
        soundtrack.sfxBell(); shake = Math.max(shake, 8);
        showQuote('unsealed', 5000);
    }
    function lightShrine(s) {
        s.lit = true;
        hp = Math.min(hpMax, hp + Math.round(hpMax * 0.4));
        let i = 0;
        for (const d of diyas) if (d.room === s.room) d.at = frames + (i++) * 5;
        soundtrack.sfxShrine(); burst.flame(s.x, s.y + 40);
        showQuote('shrine', 3500, 0.5);
        refreshHUD();
        later(() => { if (!over && !modal) openChoice('boon'); }, 520);
    }
    function ringBell(b) {
        b.cd = perk(6) ? 300 : 600; b.max = b.cd;
        soundtrack.sfxBell();
        loops.push({ toll: true, x: b.x, y: b.y, t: 0 });
        stunAll(b.x, b.y, 520, has('bell') ? 400 : 200);
        if (has('bell')) for (const e of enemies) if (!e.dead && dist(e, b) < 520) wound(e, 4, 'bell');
        for (let i = shots.length - 1; i >= 0; i--) if (dist(shots[i], b) < 520) { burst.spark(shots[i].x, shots[i].y); shots.splice(i, 1); }
        for (const e of enemies) if (e.type === 'drowned' && e.state !== 'lurk' && dist(e, b) < 520) { e.state = 'rest'; e.timer = 120; }
        showQuote('bell', 3500, 0.3);
        hint('bell');
    }
    function collect(p) {
        if (p.kind === 'shard') {
            // two shards of the stone to a segment of him (one, for a hoarder)
            run.shards++;
            if (has('hoard') || run.shards % 2 === 0) sn.len = Math.min(LEN_MAX, sn.len + 1); venom = Math.min(venomMax(), venom + 8);
            soundtrack.sfxEat(); burst.shard(p.x, p.y);
            if (run.shards === 8) hint('body');
            if (run.shards === 40 || run.shards === 90) showQuote('greed', 4500);
        } else if (p.kind === 'piece') {
            // the pieces are the 27 nakshatras, nine to a ward, in their order
            const star = NAKSHATRAS[run.ward * WARD_PIECES + run.wardPieces];
            run.pieces++; run.wardPieces++; hpMax += 2; hp = Math.min(hpMax, hp + 8);
            soundtrack.sfxMemory(); burst.piece(p.x, p.y);
            if (star) { label(star.name, p.x, p.y - 46, '#dcc6ff', 20); if (!speech) say(star.line, 4800); }
            else showQuote('piece', 4000, 0.25);
            if (ward.seal && ward.seal.barred && !boss && run.wardPieces >= theme.need) unseal();
        } else if (p.kind === 'heal') {
            hp = Math.min(hpMax, hp + 25); burst.flame(p.x, p.y); soundtrack.sfxShrine();
        } else if (p.kind === 'memory') {
            burst.gold(p.x, p.y); openMemory();
        } else if (p.kind === 'boon') {
            burst.gold(p.x, p.y); openChoice('boon');
        } else if (p.kind === 'exit') {
            hp = Math.min(hpMax, hp + Math.round(hpMax * 0.25));
            enterWard(run.ward + 1);
            showQuote('descend', 4500);
            return false;      // the ward it lay in is gone
        }
        refreshHUD();
        return true;
    }
    function trackRoom() {
        const rm = ward.roomAt(sn.x, sn.y);
        if (rm !== room) {
            room = rm;
            if (rm) {
                if (!rm.visited) { rm.visited = true; rm.seen = true; for (const id of rm.links) ward.rooms[id].seen = true; }
                text('gs-room', rm.name);
            }
        }
        if (rm && rm.state === 'idle' && rm.doors.every(d => Math.hypot(d.x - sn.x, d.y - sn.y) > 150)) startEncounter(rm);
        if (ward.seal && ward.seal.barred && !fight && dist(ward.seal, sn) < 190 && frames - (ward.warned || -999) > 480) {
            ward.warned = frames; showQuote('sealed', 4500); hint('seal', true); soundtrack.sfxBell();
        }
        for (const s of shrines) if (!s.lit && dist(s, sn) < 150) lightShrine(s);
        if (rm && rm.stall) {
            const d = dist(rm.stall, sn);
            if (d < 150 && !rm.shop) { rm.shop = true; openChoice('yaksha'); showQuote('yaksha', 4000, 0.6); hint('yaksha'); }
            else if (d > 290) rm.shop = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // THE DEAD THINK
    // They path through the ward by a flow field poured from his head, go around his coil rather than
    // press on it, take turns to leap, keep their range, and will chase a shed skin if it is nearer.
    // ═══════════════════════════════════════════════════════════════════
    let flowQ = new Int32Array(1);
    function computeFlow() {
        const GW = ward.GW, GH = ward.GH, G = ward.grid;
        if (flowQ.length < GW * GH) flowQ = new Int32Array(GW * GH);
        flow.fill(-1);
        const sx = Math.floor(sn.x / CELL), sy = Math.floor(sn.y / CELL);
        if (!ward.inside(sx, sy)) return;
        let head = 0, tail = 0;
        flowQ[tail++] = sy * GW + sx; flow[sy * GW + sx] = 0;
        while (head < tail) {
            const k = flowQ[head++], d = flow[k];
            if (d >= 46) continue;
            const x = k % GW, y = (k - x) / GW;
            if (x > 0) { const n = k - 1; if (flow[n] < 0 && (G[n] === T.FLOOR || G[n] === T.HALL)) { flow[n] = d + 1; flowQ[tail++] = n; } }
            if (x < GW - 1) { const n = k + 1; if (flow[n] < 0 && (G[n] === T.FLOOR || G[n] === T.HALL)) { flow[n] = d + 1; flowQ[tail++] = n; } }
            if (y > 0) { const n = k - GW; if (flow[n] < 0 && (G[n] === T.FLOOR || G[n] === T.HALL)) { flow[n] = d + 1; flowQ[tail++] = n; } }
            if (y < GH - 1) { const n = k + GW; if (flow[n] < 0 && (G[n] === T.FLOOR || G[n] === T.HALL)) { flow[n] = d + 1; flowQ[tail++] = n; } }
        }
    }
    function los(ax, ay, bx, by, test = ward.walkable) {
        const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 24);
        for (let i = 1; i < n; i++) { const t = i / n; if (!test(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
        return true;
    }
    function targetOf(e) {
        const d = decoys[0];
        if (d && e.type !== 'boss' && Math.hypot(d.x - e.x, d.y - e.y) < 520 && dist(e, sn) > 110) return d;
        return sn;
    }
    function pathAngle(e, t) {
        const direct = Math.atan2(t.y - e.y, t.x - e.x);
        if (t !== sn || los(e.x, e.y, t.x, t.y)) return direct;
        const GW = ward.GW, cx = Math.floor(e.x / CELL), cy = Math.floor(e.y / CELL);
        let bd = flow[cy * GW + cx], bx = -1, by = -1;
        if (bd < 0) bd = 1e9;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = cx + dx, ny = cy + dy;
            if (!ward.inside(nx, ny)) continue;
            const d = flow[ny * GW + nx];
            if (d >= 0 && d < bd) { bd = d; bx = nx; by = ny; }
        }
        return bx < 0 ? direct : Math.atan2((by + 0.5) * CELL - e.y, (bx + 0.5) * CELL - e.x);
    }
    function stepE(e, a, spd) {
        const r = e.r * 0.55, nx = e.x + Math.cos(a) * spd, ny = e.y + Math.sin(a) * spd;
        if (free(nx, ny, r)) { e.x = nx; e.y = ny; return true; }
        if (free(nx, e.y, r)) { e.x = nx; return true; }
        if (free(e.x, ny, r)) { e.y = ny; return true; }
        return false;
    }
    // after it has moved: pillars, his body, each other
    function settle(e) {
        const ghost = E[e.type] && E[e.type].ghost;
        if (!ghost) {
            for (const o of obs) {
                if (o.room !== e.room.id) continue;
                const d = Math.hypot(e.x - o.x, e.y - o.y), min = o.r + e.r * 0.5;
                if (d < min && d > 0.01) { e.x = o.x + (e.x - o.x) / d * min; e.y = o.y + (e.y - o.y) / d * min; }
            }
            if (!e.leap && !e.hidden && !(e.type === 'drowned' && e.state === 'lurk')) {
                // his body is a wall
                const rr = e.r * 0.6 + 12;
                for (let s = 2; s < sn.len; s++) {
                    const i = s * SG; if (i >= trail.n) break;
                    const k = trail.at(i), dx = e.x - trail.x[k], dy = e.y - trail.y[k], d = Math.hypot(dx, dy);
                    if (d < rr && d > 0.01) {
                        const nx = trail.x[k] + dx / d * rr, ny = trail.y[k] + dy / d * rr;
                        if (ward.walkable(nx, ny)) { e.x = nx; e.y = ny; }
                        e.blocked = 10;
                    }
                }
            }
        }
        if (e.type === 'boss') return;
        for (const f of enemies) {
            if (f === e || f.dead || f.hidden) continue;
            const d = Math.hypot(e.x - f.x, e.y - f.y), min = (e.r + f.r) * 0.8;
            if (d < min && d > 0.01) {
                const nx = e.x + (e.x - f.x) / d * (min - d) * 0.5, ny = e.y + (e.y - f.y) / d * (min - d) * 0.5;
                if (ward.walkable(nx, ny)) { e.x = nx; e.y = ny; }
            }
        }
    }
    function relocate(e) {
        // it goes under, and rises where he is heading
        for (let t = 0; t < 16; t++) {
            const a = sn.angle + rand(-0.9, 0.9), d = rand(170, 310), x = sn.x + Math.cos(a) * d, y = sn.y + Math.sin(a) * d;
            if (ward.roomAt(x, y) !== e.room || !free(x, y, 26) || obs.some(o => Math.hypot(x - o.x, y - o.y) < o.r + 30)) continue;
            spawnParticles(e.x, e.y, 8, { color: '#5ae0e0', minSize: 1, maxSize: 3, speed: 1.5, lifetime: 30 });
            e.x = x; e.y = y;
            break;
        }
        e.state = 'lurk'; e.wait = 0; e.rise = 46;
    }
    function think(e) {
        if (e.type === 'boss') { thinkBoss(e); return; }
        const t = targetOf(e), d = Math.hypot(t.x - e.x, t.y - e.y), toT = Math.atan2(t.y - e.y, t.x - e.x), real = t === sn;
        const around = a => (e.blocked > 0 ? a + e.side * 1.25 : a);     // blocked by the coil: go round it
        switch (e.type) {
            case 'wraith':
                // a soldier still: closes, draws back (the tell), then lunges a body-length along the line it chose
                if (e.state === 'chase') {
                    stepE(e, around(pathAngle(e, t)), e.speed);
                    if (d < 100 && e.blocked <= 0) { e.state = 'wind'; e.timer = 22; e.aim = toT; }
                } else if (e.state === 'wind') {
                    if (e.timer > 8) e.aim = toT;         // it commits a moment before it goes
                    if (--e.timer <= 0) { e.state = 'lunge'; e.timer = 11; spawnFx('fxClaw', e.x + Math.cos(e.aim) * 44, e.y + Math.sin(e.aim) * 44, { size0: 60, size1: 130, life: 14, rot: e.aim, alpha: 0.95 }); }
                } else if (e.state === 'lunge') {
                    stepE(e, e.aim, 6);
                    if (real && dist(e, sn) < e.r + 18) hurt(e.dmg, e);
                    if (--e.timer <= 0) { e.state = 'rest'; e.timer = 26; }
                } else if (--e.timer <= 0) e.state = 'chase';
                break;
            case 'preta': {
                // a hungry ghost has no armour for the coil to stop: it drifts through him and feeds on the nearest part
                let tx = t.x, ty = t.y, bd = d, onBody = false;
                if (real) for (let s = 3; s < sn.len; s += 3) {
                    const i = s * SG; if (i >= trail.n) break;
                    const k = trail.at(i), dd = Math.hypot(trail.x[k] - e.x, trail.y[k] - e.y);
                    if (dd < bd) { bd = dd; tx = trail.x[k]; ty = trail.y[k]; onBody = true; }
                }
                stepE(e, Math.atan2(ty - e.y, tx - e.x) + Math.sin(time * 3 + e.phase) * 0.55, e.speed);
                if (e.cd > 0) e.cd--;
                else if (real && bd < e.r + 14) { if (onBody) bodyHurt(6, tx, ty); else hurt(e.dmg, e); e.cd = 60; }
                break;
            }
            case 'hunter':
                if (e.state === 'stalk') {
                    const see = los(e.x, e.y, t.x, t.y);
                    if (d > 290 || !see) stepE(e, around(pathAngle(e, t)), e.speed);
                    else if (d < 150) stepE(e, toT + Math.PI, e.speed * 0.8);          // make room for the leap
                    else stepE(e, toT + e.side * 1.45, e.speed * 0.75);                 // circle him
                    if (--e.timer <= 0) {
                        const busy = enemies.filter(f => f.type === 'hunter' && !f.dead && (f.state === 'wind' || f.state === 'pounce')).length;
                        if (d < 430 && busy < 2 && see) {
                            // lead him: aim where the head will be when the leap lands
                            const lead = real ? 15 * SPEED : 0;
                            e.aim = Math.atan2(t.y + Math.sin(sn.angle) * lead - e.y, t.x + Math.cos(sn.angle) * lead - e.x);
                            e.state = 'wind'; e.timer = 26;
                        } else e.timer = rand(20, 50);
                    }
                } else if (e.state === 'wind') {
                    if (--e.timer <= 0) { e.state = 'pounce'; e.timer = 22; e.leap = true; soundtrack.sfxLunge(); spawnFx('fxClaw', e.x + Math.cos(e.aim) * 50, e.y + Math.sin(e.aim) * 50, { size0: 70, size1: 150, life: 16, rot: e.aim }); }
                } else if (e.state === 'pounce') {
                    const moved = stepE(e, e.aim, 8.5);
                    spawnParticles(e.x, e.y, 1, { color: '#ff5a3a', minSize: 2, maxSize: 4, speed: 0.6, lifetime: 14 });
                    if (real && dist(e, sn) < e.r + 16) hurt(e.dmg, e);
                    if (--e.timer <= 0 || !moved) { e.state = 'recover'; e.timer = 48; e.leap = false; if (Math.random() < 0.5) e.side = -e.side; }
                } else if (--e.timer <= 0) { e.state = 'stalk'; e.timer = rand(50, 120); }
                break;
            case 'mantrik': {
                if (e.state === 'cast') {
                    if (--e.timer <= 0) {
                        shots.push({ x: e.x, y: e.y - 8, a: toT, speed: 2.7, homing: 0.028, life: 300, r: 10, dmg: e.dmg });
                        e.state = 'range'; e.timer = rand(120, 190); soundtrack.sfxLunge();
                    }
                    break;
                }
                const see = los(e.x, e.y, t.x, t.y, flies);
                if (d < 250) { if (!stepE(e, toT + Math.PI + e.side * 0.5, e.speed * 1.15)) stepE(e, toT + e.side * 1.6, e.speed); }
                else if (d > 470 || !see) stepE(e, around(pathAngle(e, t)), e.speed);
                else stepE(e, toT + e.side * 1.57, e.speed * 0.5);
                if (--e.timer <= 0) { if (see && d < 580 && real) { e.state = 'cast'; e.timer = 36; } else e.timer = 30; }
                break;
            }
            case 'drowned':
                if (e.state === 'lurk') {
                    e.wait = (e.wait || 0) + 1;
                    if (e.rise > 0) e.rise--;
                    else if (real && d < 230 && grace <= 0) { e.state = 'wind'; e.timer = 26; }
                    else if (e.wait > 240 && d > 300) relocate(e);
                } else if (e.state === 'wind') {
                    e.aim = toT;
                    if (--e.timer <= 0) { e.state = 'lunge'; e.timer = 30; soundtrack.sfxLunge(); spawnFx('fxSplash', e.x, e.y, { size0: 50, size1: 190, life: 22 }); }
                } else if (e.state === 'lunge') {
                    const moved = stepE(e, e.aim, 7);
                    if (real && dist(e, sn) < e.r + 16) hurt(e.dmg, e);
                    if (--e.timer <= 0 || !moved) { e.state = 'rest'; e.timer = 90; }
                } else if (--e.timer <= 0) relocate(e);
                break;
            case 'sentinel':
                if (e.state === 'chase') {
                    stepE(e, around(pathAngle(e, t)), e.speed);
                    if (d < 128) { e.state = 'wind'; e.timer = 44; zones.push({ kind: 'circle', x: e.x, y: e.y, r: 150, t: 0, T: 44, dmg: e.dmg, body: 12, src: e, fx: 'shock' }); }
                    else if (real && dist(e, sn) < e.r + 12) hurt(16, e);
                } else if (e.state === 'wind') {
                    if (--e.timer <= 0) { e.state = 'rest'; e.timer = 64; }
                } else if (--e.timer <= 0) e.state = 'chase';
                break;
        }
    }
    function thinkBoss(e) {
        if (e.dying) {
            if (e.dying % 9 === 0) {
                const a = rand(TAU), dd = rand(e.r * 1.3);
                spawnFx('fxFire', e.x + Math.cos(a) * dd, e.y - 30 + Math.sin(a) * dd, { size0: 40, size1: 200, life: 22, rot: rand(TAU) });
                burst.ash(e.x + Math.cos(a) * dd, e.y - 30 + Math.sin(a) * dd);
                shake = Math.max(shake, 8); soundtrack.sfxStomp(0.8);
            }
            if (--e.dying <= 0) {
                flash = 0.95; e.dying = 0;
                spawnFx('fxShock', e.x, e.y, { size0: 120, size1: 1500, life: 54 });
                banish(e, 'coil');
            }
            return;
        }
        const b = e.boss, d = dist(e, sn), ph = e.phaseN || 0, rage = ph > 0;
        if (e.bound > 0 && --e.bound === 0) { e.armor = true; bossBar(); }
        // only a charge hurts on a graze; otherwise he must be well inside its reach, so a coil can be drawn close
        if (!e.hidden && e.state !== 'intro' && e.state !== 'roar' && d < (e.state === 'charge' ? e.r + 14 : e.r * 0.8)) hurt(e.state === 'charge' ? 22 : e.dmg, e);
        switch (e.state) {
            case 'intro': if (--e.timer <= 0) { e.state = 'idle'; e.timer = 50; } break;
            case 'roar': if (--e.timer <= 0) { e.shield = false; e.state = 'idle'; e.timer = 36; } break;
            case 'sweep': if (--e.timer <= 0) { e.state = 'rest'; e.timer = 50; } break;
            case 'idle':
                if (d > 170) stepE(e, e.blocked > 0 ? pathAngle(e, sn) + e.side * 1.25 : pathAngle(e, sn), e.speed * (rage ? 1.25 : 1));
                if (--e.timer <= 0) bossAttack(e, ph);
                break;
            case 'charge-wind':
                if (--e.timer <= 0) { e.state = 'charge'; e.timer = 44; e.leap = true; soundtrack.sfxLunge(); }
                break;
            case 'charge': {
                const moved = stepE(e, e.aim, 10.5);
                const hit = bodyNear(e.x, e.y, e.r); if (hit) bodyHurt(10, hit.x, hit.y);
                if (frames % 2 === 0) spawnParticles(e.x, e.y, 2, { color: '#ff7a3a', minSize: 2, maxSize: 5, speed: 1, lifetime: 20 });
                if (--e.timer <= 0 || !moved) {
                    e.leap = false; shake = Math.max(shake, 9); soundtrack.sfxStomp(1);
                    spawnFx('fxShock', e.x, e.y, { size0: 60, size1: 300, life: 18, alpha: 0.8 });
                    if (e.combo > 0) {
                        // again, before he has straightened out
                        e.combo--; e.aim = Math.atan2(sn.y - e.y, sn.x - e.x); e.state = 'charge-wind'; e.timer = 20;
                        zones.push({ kind: 'line', x: e.x, y: e.y, a: e.aim, len: 620, w: e.r * 2.1, t: 0, T: 20, dmg: 0 });
                    } else { e.state = 'rest'; e.timer = rage ? 40 : 58; }
                }
                break;
            }
            case 'cast': if (--e.timer <= 0) { e.cast(); e.state = 'rest'; e.timer = rage ? 26 : 40; } break;
            case 'dive':
                if (--e.timer <= 0) {
                    let p = null;
                    for (let t = 0; t < 14 && !p; t++) { const a = sn.angle + rand(-1.2, 1.2), dd = rand(70, 170), x = sn.x + Math.cos(a) * dd, y = sn.y + Math.sin(a) * dd; if (ward.roomAt(x, y) === e.room && free(x, y, 40)) p = { x, y }; }
                    p = p || { x: e.room.x, y: e.room.y };
                    e.x = p.x; e.y = p.y;
                    zones.push({ kind: 'circle', x: e.x, y: e.y, r: 175, t: 0, T: 50, dmg: 20, body: 8, fx: 'splash' });
                    e.state = 'emerge'; e.timer = 50;
                }
                break;
            case 'emerge': if (--e.timer <= 0) { e.hidden = false; e.state = 'rest'; e.timer = 70; soundtrack.sfxStomp(1); } break;
            default: if (--e.timer <= 0) { e.state = 'idle'; e.timer = ph === 2 ? rand(44, 66) : ph === 1 ? rand(60, 90) : rand(84, 124); }
        }
    }
    function bossAttack(e, ph) {
        const b = e.boss, rm = e.room, kit = (KIT[b.id] || [b.attacks])[Math.min(ph, 2)] || b.attacks;
        const adds = enemies.filter(f => f !== e && !f.dead).length + spawns.length;
        let pool = kit.filter(a => a !== e.last && !(a === 'summon' && adds >= 3));
        if (!pool.length) pool = kit.filter(a => a !== 'summon');
        const a = e.last = pickOf(pool);
        const cast = (wait, fn) => { e.state = 'cast'; e.timer = wait; e.cast = fn; };
        const inRoom = (x, y) => ward.roomAt(x, y) === rm && ward.walkable(x, y);
        if (a === 'charge' || a === 'combo') {
            // one line, or three in a row for the ones that have learned to chain them
            e.combo = a === 'combo' ? 2 : 0;
            e.aim = Math.atan2(sn.y - e.y, sn.x - e.x);
            e.state = 'charge-wind'; e.timer = ph ? 34 : 44;
            zones.push({ kind: 'line', x: e.x, y: e.y, a: e.aim, len: 620, w: e.r * 2.1, t: 0, T: e.timer, dmg: 0 });
        } else if (a === 'slam') {
            for (let k = 0; k <= ph; k++) zones.push({ kind: 'circle', x: sn.x, y: sn.y, r: 135, t: 0, T: 50, dmg: 20, body: 8, delay: 1 + k * 32, aim: true, fx: 'shock' });
            cast(30, () => {});
        } else if (a === 'quake') {
            // the ground breaks open along a line toward him, one burst after another
            cast(30, () => {
                const base = Math.atan2(sn.y - e.y, sn.x - e.x);
                for (const off of (ph === 2 ? [-0.4, 0, 0.4] : [0])) for (let k = 0; k < 7 + ph; k++) {
                    const x = e.x + Math.cos(base + off) * (120 + k * 88), y = e.y + Math.sin(base + off) * (120 + k * 88);
                    if (!inRoom(x, y)) break;
                    zones.push({ kind: 'circle', x, y, r: 62, t: 0, T: 32, dmg: 18, body: 6, delay: 1 + k * 7, fx: 'fire' });
                }
                soundtrack.sfxStomp(1);
            });
        } else if (a === 'pools') {
            // molten brass, thrown: where it lands it stays, and burns
            cast(30, () => {
                for (let k = 0; k < 2 + ph; k++) {
                    const ang = rand(TAU), dd = k ? rand(110, 260) : 0, x = sn.x + Math.cos(ang) * dd, y = sn.y + Math.sin(ang) * dd;
                    if (inRoom(x, y)) zones.push({ kind: 'circle', x, y, r: 84, t: 0, T: 54, dmg: 16, delay: 1 + k * 12, fx: 'fire', pool: 280 });
                }
            });
        } else if (a === 'barrage') {
            // bells from the roof, or shards of the stone: a scatter of small circles, the first one on his head
            cast(28, () => {
                for (let k = 0; k < 7 + ph * 3; k++) {
                    const ang = rand(TAU), dd = k ? rand(70, 340) : 0, x = sn.x + Math.cos(ang) * dd, y = sn.y + Math.sin(ang) * dd;
                    if (inRoom(x, y)) zones.push({ kind: 'circle', x, y, r: 74, t: 0, T: 50, dmg: 18, body: 6, delay: 1 + k * 8, fx: b.id === 'mahant' ? 'bell' : 'shard' });
                }
            });
        } else if (a === 'sweep') {
            // a beam of the stone's light turned through most of a circle: stay ahead of it, or shed through it
            const dir = Math.random() < 0.5 ? 1 : -1, T = 150;
            beams.push({ src: e, a: Math.atan2(sn.y - e.y, sn.x - e.x) - dir * 1.0, da: dir * (ph === 2 ? 0.033 : 0.026), len: 660, t: 0, warm: 46, T, dmg: 20 });
            e.state = 'sweep'; e.timer = T + 46;
        } else if (a === 'blades') {
            // thrown blades that go out and come back to his hand
            cast(26, () => {
                const base = Math.atan2(sn.y - e.y, sn.x - e.x), n = 2 + ph;
                for (let k = 0; k < n; k++) shots.push({ x: e.x, y: e.y - 10, a: base + (k - (n - 1) / 2) * 0.55, speed: 7.2, homing: 0, life: 210, r: 16, dmg: 14, kind: 'blade', boom: 0, src: e });
                soundtrack.sfxLunge();
            });
        } else if (a === 'rings') {
            cast(34, () => { for (let k = 0; k < 2 + ph; k++) rings.push({ x: e.x, y: e.y, r: e.r, speed: 4.2, max: 780, gap: rand(TAU), gapW: 1.4, dmg: 15, delay: k * 32, hit: false }); soundtrack.sfxBell(); });
        } else if (a === 'orbs') {
            cast(30, () => {
                const base = Math.atan2(sn.y - e.y, sn.x - e.x), n = ph === 2 ? 10 : ph === 1 ? 7 : 5;
                for (let k = 0; k < n; k++) { const ang = ph === 2 ? base + k / n * TAU : base + (k - (n - 1) / 2) * 0.3; shots.push({ x: e.x, y: e.y, a: ang, speed: 3.3, homing: 0, life: 230, r: 11, dmg: 12 }); }
                soundtrack.sfxLunge();
            });
        } else if (a === 'summon') {
            cast(34, () => {
                for (let k = 0; k < (ph ? 3 : 2); k++) {
                    let type = pickOf(b.adds);
                    if (type === 'sentinel' && enemies.some(f => f.type === 'sentinel' && !f.dead)) type = b.adds[1];
                    const p = spotIn(rm, 34, 220);
                    spawns.push({ type, x: p.x, y: p.y, t: 0, T: 50, room: rm, elite: false });
                }
            });
        } else if (a === 'dive') {
            e.state = 'dive'; e.timer = 64; e.hidden = true;
            spawnFx('fxSplash', e.x, e.y, { size0: 80, size1: 320, life: 30 });
            spawnParticles(e.x, e.y, 24, { color: '#5ae0e0', minSize: 1, maxSize: 4, speed: 3, lifetime: 40 });
        }
    }
    // what a telegraphed circle does when it lands
    function impact(z) {
        const kind = z.fx || 'shock';
        spawnFx('fxShock', z.x, z.y, { size0: z.r * 0.7, size1: z.r * 2.7, life: 18, alpha: 0.9 });
        if (kind === 'fire' || kind === 'shard') spawnFx('fxFire', z.x, z.y, { size0: z.r * 0.8, size1: z.r * 2.5, life: 24, rot: rand(TAU) });
        else if (kind === 'splash') spawnFx('fxSplash', z.x, z.y, { size0: z.r, size1: z.r * 2.8, life: 26 });
        else if (kind === 'bell') { loops.push({ toll: true, x: z.x, y: z.y, t: 30 }); soundtrack.sfxBell(); }
        spawnParticles(z.x, z.y, 14, { color: kind === 'splash' ? '#5ae0e0' : '#ff9a4a', minSize: 2, maxSize: 5, speed: 5, lifetime: 26 });
        shake = Math.max(shake, z.r > 100 ? 9 : 5); soundtrack.sfxStomp(z.r > 100 ? 1 : 0.6);
        if (z.pool) pools.push({ x: z.x, y: z.y, r: z.r * 0.92, life: z.pool, max: z.pool, dmg: 10, rot: rand(TAU) });
    }

    // ═══════════════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════════════
    function update() {
        if (!session.started || !ward || over || paused || modal) return;
        if (freeze > 0) { freeze--; return; }      // the held breath after a coil closes
        if (slowmo > 0) { slowmo--; slowTick = !slowTick; if (slowTick) return; }      // a guardian's last moments run at half speed
        time += 0.05; frames++; run.frames++;
        if (grace > 0) grace--;
        if (hurtCd > 0) hurtCd--;
        if (bodyCd > 0) bodyCd--;
        if (coilCd > 0) coilCd--;
        if (bumpCd > 0) bumpCd--;
        if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - 0.04);
        if (shake > 0) shake = Math.max(0, shake - 0.35);
        if (shed.active > 0 && --shed.active === 0) setShedUI();
        if (shed.cd > 0 && (--shed.cd === 0 || shed.cd % 8 === 0)) setShedUI();
        if (bite.active > 0) bite.active--;
        if (bite.cd > 0) bite.cd--;
        if (keys.fire) tryBite();
        if (venom < venomMax()) { venom = Math.min(venomMax(), venom + venomRegen()); if (frames % 6 === 0) setBiteUI(); }

        // ── steering: he never stops; the walls turn him rather than kill him ──
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1; if (keys.s) dy += 1; if (keys.a) dx -= 1; if (keys.d) dx += 1;
        if (dx || dy) sn.targetAngle = Math.atan2(dy, dx);
        else if (mouse.on && !touchActive && Math.hypot(mouse.x - W / 2, mouse.y - H / 2) > 28) sn.targetAngle = Math.atan2(mouse.y - H / 2, mouse.x - W / 2);
        sn.angle += angDiff(sn.targetAngle, sn.angle) * TURN;
        const speed = bite.active > 0 ? SPEED * 1.6 : shed.active > 0 ? SPEED * 1.9 : SPEED;
        const vx = Math.cos(sn.angle) * speed, vy = Math.sin(sn.angle) * speed, R = SS * 0.42;
        const nearObs = obs.filter(o => Math.abs(o.x - sn.x) < 220 && Math.abs(o.y - sn.y) < 220);
        const clear = (x, y) => {
            if (!ward.walkable(x, y)) return false;
            for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; if (!ward.walkable(x + Math.cos(a) * R, y + Math.sin(a) * R)) return false; }
            for (const o of nearObs) if (Math.hypot(x - o.x, y - o.y) < o.r + SS / 2) return false;
            return true;
        };
        let moved = false;
        const steering = dx !== 0 || dy !== 0 || touchActive || mouse.on;
        if (clear(sn.x + vx, sn.y + vy)) { sn.x += vx; sn.y += vy; moved = true; }
        else for (const off of [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5, 1.9, -1.9]) {
            const a2 = sn.angle + off, nx = sn.x + Math.cos(a2) * speed, ny = sn.y + Math.sin(a2) * speed;
            if (!clear(nx, ny)) continue;
            sn.x = nx; sn.y = ny; moved = true; sn.angle = a2;
            if (!steering) sn.targetAngle = a2;
            break;
        }
        if (!moved && !clear(sn.x, sn.y)) {
            // caught in the stone (a closing door, a knock-back): ease him to open ground
            for (let k = 1; k <= 10 && !clear(sn.x, sn.y); k++) for (let a = 0; a < TAU && !clear(sn.x, sn.y); a += Math.PI / 4) {
                const tx = sn.x + Math.cos(a) * k * 10, ty = sn.y + Math.sin(a) * k * 10;
                if (clear(tx, ty)) { sn.x = tx; sn.y = ty; }
            }
        }
        if (!moved && !steering) sn.targetAngle = sn.angle + 2.4;      // a dead end: turn about
        if (shed.active > 0 && moved && frames % 2 === 0) spawnParticles(sn.x, sn.y, 1, { color: '#6b5a48', minSize: 2, maxSize: 5, speed: 1.2, lifetime: 40, spread: 2.4, baseAngle: sn.angle + Math.PI, gravity: 0.03, drag: 0.95 });
        if (moved) {
            trail.push(sn.x, sn.y, sn.angle);
            trail.trim(sn.len * SG + 1);
            checkCoil();
        }

        if (frames % 6 === 0) {
            const gx = Math.floor(sn.x / CELL), gy = Math.floor(sn.y / CELL), RR = 8;
            for (let j = -RR; j <= RR; j++) for (let i = -RR; i <= RR; i++) if (i * i + j * j <= RR * RR && ward.inside(gx + i, gy + j)) explored[ward.idx(gx + i, gy + j)] = 1;
        }
        trackRoom();
        if (!ward || over) return;
        if (frames % 10 === 0) computeFlow();

        // ── things to pick up ──
        for (let i = pickups.length - 1; i >= 0; i--) {
            const p = pickups[i];
            if (p.vx !== undefined && (p.vx || p.vy)) {
                p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9;
                if (!ward.walkable(p.x, p.y)) { p.x -= p.vx; p.y -= p.vy; p.vx = p.vy = 0; }
                if (Math.abs(p.vx) + Math.abs(p.vy) < 0.3) p.vx = p.vy = 0;
                continue;
            }
            const d = dist(p, sn);
            if ((p.magnet || (p.kind === 'shard' && d < 135)) && d > 1) { const s = p.magnet ? 10 : 4.6; p.x += (sn.x - p.x) / d * s; p.y += (sn.y - p.y) / d * s; }
            if (d < SS + 16) {
                const wardWas = ward;
                const gone = collect(p);
                if (ward !== wardWas) return;        // he has gone down a ward
                if (gone) pickups.splice(i, 1);
                if (modal) return;
            }
        }
        for (const b of bells) { if (b.cd > 0) b.cd--; else if (dist(b, sn) < SS + b.r + 6) ringBell(b); }

        // ── the dead ──
        for (let i = spawns.length - 1; i >= 0; i--) {
            const s = spawns[i];
            if (++s.t >= s.T) {
                enemies.push(makeEnemy(s.type, s.x, s.y, s.room, s.elite));
                spawnParticles(s.x, s.y, 10, { color: '#8a6a9a', minSize: 2, maxSize: 5, speed: 2, lifetime: 30 });
                spawns.splice(i, 1);
            }
        }
        for (const e of enemies) {
            if (e.dead) continue;
            if (e.blocked > 0) e.blocked--;
            if (e.burn > 0 && --e.burn % 60 === 0) { wound(e, 1, 'burn'); if (e.dead) continue; }
            const px = e.x, py = e.y;
            if (e.stun > 0) e.stun--; else think(e);
            if (e.dead || over) continue;
            settle(e);
            const mv = Math.hypot(e.x - px, e.y - py);
            if (mv > 0.05) {
                e.face += angDiff(Math.atan2(e.y - py, e.x - px), e.face) * 0.25;
                const stride = e.type === 'sentinel' || e.type === 'boss' ? 26 : e.type === 'hunter' ? 11 : 16;
                const before = Math.floor(e.phase);
                e.phase += Math.min(mv, 4) / stride;
                if ((e.type === 'sentinel' || e.type === 'boss') && Math.floor(e.phase) !== before && !e.hidden) {
                    const dd = dist(e, sn);
                    if (dd < 600) { shake = Math.max(shake, 4 * (1 - dd / 600)); soundtrack.sfxStomp(1 - dd / 600); }
                }
            } else if (e.state === 'wind' || e.state === 'cast' || e.state === 'charge-wind') {
                e.face += angDiff(Math.atan2(sn.y - e.y, sn.x - e.x), e.face) * 0.2;
            }
        }
        if (over) return;
        if (enemies.some(e => e.dead)) enemies = enemies.filter(e => !e.dead);

        // ── telegraphed ground, tolls, thrown curses ──
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            if (z.delay > 0) { if (--z.delay === 0 && z.aim) { z.x = sn.x; z.y = sn.y; } continue; }
            if (z.src && (z.src.dead || z.src.stun > 0)) { zones.splice(i, 1); continue; }
            if (++z.t < z.T) continue;
            zones.splice(i, 1);
            if (z.kind !== 'circle') continue;
            impact(z);
            if (dist(z, sn) < z.r) hurt(z.dmg, z);
            else if (z.body) { const hit = bodyNear(z.x, z.y, z.r); if (hit) bodyHurt(z.body, hit.x, hit.y); }
        }
        for (let i = pools.length - 1; i >= 0; i--) {
            const p = pools[i];
            if (--p.life <= 0) { pools.splice(i, 1); continue; }
            if (p.life > p.max - 12) continue;       // a moment to get off it
            if (dist(p, sn) < p.r) hurt(p.dmg, null);
            else if (frames % 30 === 0) { const hit = bodyNear(p.x, p.y, p.r * 0.8); if (hit) bodyHurt(4, hit.x, hit.y); }
        }
        for (let i = beams.length - 1; i >= 0; i--) {
            const b = beams[i];
            if (b.src.dead || b.src.dying || b.src.state !== 'sweep' || ++b.t > b.T + b.warm) { beams.splice(i, 1); continue; }
            if (b.t <= b.warm) continue;
            b.a += b.da;
            const dd = dist(b.src, sn);
            if (dd < b.len && dd > b.src.r * 0.6 && Math.abs(angDiff(Math.atan2(sn.y - b.src.y, sn.x - b.src.x), b.a)) < Math.atan2(26, dd)) hurt(b.dmg, null);
        }
        for (let i = rings.length - 1; i >= 0; i--) {
            const r = rings[i];
            if (r.delay > 0) { r.delay--; continue; }
            r.r += r.speed;
            if (r.r > r.max) { rings.splice(i, 1); continue; }
            if (!r.hit && Math.abs(dist(r, sn) - r.r) < 15 && Math.abs(angDiff(Math.atan2(sn.y - r.y, sn.x - r.x), r.gap)) > r.gapW / 2) { if (hurt(r.dmg, null)) r.hit = true; }
        }
        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i];
            if (s.homing) s.a += Math.max(-s.homing, Math.min(s.homing, angDiff(Math.atan2(sn.y - s.y, sn.x - s.x), s.a)));
            if (s.kind === 'blade') {
                // out, then back to the hand that threw it
                if (++s.boom > 30) { s.a += Math.max(-0.17, Math.min(0.17, angDiff(Math.atan2(s.src.y - s.y, s.src.x - s.x), s.a))); if (s.boom > 46 && dist(s, s.src) < 50) s.life = 0; }
                if (s.src.dead || s.src.dying) s.life = 0;
            }
            s.x += Math.cos(s.a) * s.speed; s.y += Math.sin(s.a) * s.speed;
            let gone = --s.life <= 0 || !flies(s.x, s.y);
            if (!gone && dist(s, sn) < s.r + 14) { hurt(s.dmg, s); gone = true; }
            if (!gone && shed.active <= 0 && s.kind !== 'blade') { const hit = bodyNear(s.x, s.y, s.r + 11); if (hit) { bodyHurt(5, hit.x, hit.y); gone = true; } }
            if (gone) { spawnParticles(s.x, s.y, 8, { color: '#c090ff', minSize: 1, maxSize: 3, speed: 2.5, lifetime: 22 }); shots.splice(i, 1); }
        }
        if (over) return;
        updateBolts();
        for (let i = decoys.length - 1; i >= 0; i--) {
            const d = decoys[i];
            if (--d.t > 0) continue;
            if (has('slough')) {
                for (let k = 0; k < d.pts.length; k += 3) spawnFx('fxVenom', d.pts[k].x, d.pts[k].y, { size0: 30, size1: 120, life: 22, spin: 0.05, rot: rand(TAU) });
                for (const e of enemies) if (!e.dead && d.pts.some(p => Math.hypot(p.x - e.x, p.y - e.y) < e.r + 46)) wound(e, 6, 'venom');
            }
            decoys.splice(i, 1);
        }
        for (let i = loops.length - 1; i >= 0; i--) if (++loops[i].t > (loops[i].toll ? 60 : 30)) loops.splice(i, 1);
        for (let i = labels.length - 1; i >= 0; i--) { labels[i].y -= 0.5; if (++labels[i].t > 80) labels.splice(i, 1); }
        for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; if (f.delay > 0) { f.delay--; continue; } f.rot += f.spin; if (--f.life <= 0) fx.splice(i, 1); }
        for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= p.drag; p.vy *= p.drag; if (--p.life <= 0) particles.splice(i, 1); }

        // ── is the chamber his again? ──
        if (fight && fight.kind !== 'boss' && !spawns.length && !enemies.some(e => e.room === fight)) {
            if (fight.wave < fight.waves.length) spawnWave(fight); else clearRoom(fight);
        }
        if (frames % 10 === 0) { const hb = $('hpBar'); if (hb) hb.style.width = (hp / hpMax * 100).toFixed(1) + '%'; }
    }

    // ═══════════════════════════════════════════════════════════════════
    // RENDER
    // One camera for everything: the art is drawn from a high three-quarter angle, so walls show their
    // south faces, props stand on their bases and the scene is painted back to front by base y. Then the
    // dark is laid over it: a light map, multiplied in, that only his own glow, the diyas he has relit,
    // and the things that mean him harm or good can lift.
    // ═══════════════════════════════════════════════════════════════════
    const glowSprites = new Map();
    function glowSprite(rgb, wide) {
        const key = rgb + (wide ? 'w' : '');
        let spr = glowSprites.get(key);
        if (!spr) {
            spr = document.createElement('canvas'); spr.width = spr.height = 128;
            const c = spr.getContext('2d'), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(wide ? 0.42 : 0.5, `rgba(${rgb},${wide ? 0.6 : 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
            c.fillStyle = g; c.fillRect(0, 0, 128, 128);
            glowSprites.set(key, spr);
        }
        return spr;
    }
    const light = (x, y, r, rgb = '255,240,214', a = 1) => { lights.push(x, y, r, rgb, a); };
    function glow(x, y, r, rgb, a, lit = true) {
        if (lit) light(x, y, r * 1.5, rgb, Math.min(1, a * 2.2));
        if (quality === 0 && r < 60) return;
        ctx.globalAlpha = a; ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
    }
    function drawSprite(img, x, y, size, alpha = 1) { ctx.globalAlpha = alpha; ctx.drawImage(img, x - size / 2, y - size / 2, size, size); ctx.globalAlpha = 1; }
    function drawStanding(img, x, baseY, size) {
        const h = size * (img.naturalHeight / img.naturalWidth);
        ctx.drawImage(img, x - size / 2, baseY - h + size * 0.08, size, h);
    }
    function hash(n) { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); }

    // ── the ground: each 800px chunk is composed once from the ward's grid ──
    const patterns = new Map();
    function pattern(c, img, px, ox, oy) {
        let p = patterns.get(img);
        if (!p) { p = c.createPattern(img, 'repeat'); patterns.set(img, p); }
        const k = px / img.naturalWidth;
        p.setTransform(new DOMMatrix().translate(-(((ox % px) + px) % px), -(((oy % px) + px) % px)).scale(k, k));
        return p;
    }
    const FLOOR_KEYS = ['floorW0', 'floorW1', 'floorW2', 'floorW3', 'wallFrieze', 'floorStone', 'floorRoots', 'floorWet', 'floorAsh', 'floorRuin', 'floorWater', 'puddle', 'rubble', 'roots', 'broken', 'pileA', 'pileB', 'bloodA', 'bloodB', 'warA', 'warB', 'fxSigil'];
    const floorStamp = () => FLOOR_KEYS.reduce((n, k) => n + (ok(IMG[k]) ? 1 : 0), 0);
    const softCanvas = document.createElement('canvas');
    function chunkFloor(cx, cy) {
        const key = cx + ',' + cy, stamp = floorStamp();
        let ch = chunks.get(key);
        if (ch && ch.stamp === stamp) return ch.canvas;
        if (!ch) {
            ch = { canvas: document.createElement('canvas'), stamp: -1 };
            ch.canvas.width = ch.canvas.height = CW;
            chunks.set(key, ch);
            if (chunks.size > 18) chunks.delete(chunks.keys().next().value);
        }
        ch.stamp = stamp;
        const c = ch.canvas.getContext('2d'), ox = cx * CW, oy = cy * CW, N = CW / CELL, gx0 = ox / CELL, gy0 = oy / CELL, w = run.ward;
        const im = k => (ok(IMG[k]) ? IMG[k] : null);
        const plain = im('floorStone'), stone = im('floorW' + w) || plain, ruin = im('floorRuin') || im('floorAsh') || stone, water = im('floorWater') || im('floorWet') || stone;
        const relief = im('floorWet') || stone, frieze = im('wallFrieze'), ash = im('floorAsh'), rooty = im('floorRoots');
        const tAt = (i, j) => (ward.inside(gx0 + i, gy0 + j) ? ward.grid[ward.idx(gx0 + i, gy0 + j)] : ward.bg);
        const open = t => t === T.FLOOR || t === T.HALL || t === T.BARS;
        const each = fn => { for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) fn(i, j, tAt(i, j), i * CELL, j * CELL); };
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        c.clearRect(0, 0, CW, CW);
        // 1. the wall tops: burnt rubble, nearly black
        if (ruin) { c.fillStyle = pattern(c, ruin, 400, ox, oy); c.fillRect(0, 0, CW, CW); c.fillStyle = 'rgba(3,2,4,0.74)'; c.fillRect(0, 0, CW, CW); }
        else { c.fillStyle = '#0a0709'; c.fillRect(0, 0, CW, CW); }
        // 2. water: the river under the bridge, the tanks of the Sanctum
        if (water) { c.fillStyle = pattern(c, water, 400, ox, oy); each((i, j, t, x, y) => { if (t === T.WATER) c.fillRect(x, y, CELL, CELL); }); }
        c.fillStyle = w === 3 ? 'rgba(30,14,60,0.34)' : 'rgba(10,50,60,0.25)';
        each((i, j, t, x, y) => { if (t === T.WATER) c.fillRect(x, y, CELL, CELL); });
        // 3. paving, with the ward's own wear
        if (stone) {
            c.fillStyle = pattern(c, stone, 400, ox, oy);
            each((i, j, t, x, y) => { if (open(t)) c.fillRect(x, y, CELL, CELL); });
            each((i, j, t, x, y) => {
                if (!open(t)) return;
                const h = hash((gx0 + i) * 3.3 + (gy0 + j) * 1.9 + w * 7.1);
                const v = h < 0.08 ? ash : h < 0.2 ? plain : (w === 0 && h < 0.3) ? rooty : null;      // a little of the old city's stone under each ward's own
                if (v) { c.fillStyle = pattern(c, v, 400, ox, oy); c.fillRect(x, y, CELL, CELL); }
            });
            // open ground is the light in this picture; the chambers a shade lighter than the passages
            each((i, j, t, x, y) => { if (open(t)) { c.fillStyle = t === T.FLOOR ? 'rgba(226,204,164,0.17)' : 'rgba(214,190,150,0.09)'; c.fillRect(x, y, CELL, CELL); } });
        }
        // 4. walls have height: a carved south face, a lit ledge, a shadow thrown on the paving
        each((i, j, t, x, y) => {
            if (t === T.SOLID) {
                if (open(tAt(i, j + 1)) || tAt(i, j + 1) === T.WATER) {
                    // one carved course of the frieze to a wall face, four cells to a repeat
                    if (frieze) { const q = frieze.naturalWidth / 4; c.drawImage(frieze, (((gx0 + i) % 4) + 4) % 4 * q, frieze.naturalHeight * 0.36, q, q, x, y, CELL, CELL); }
                    else if (relief) { c.fillStyle = pattern(c, relief, 300, ox, oy); c.fillRect(x, y, CELL, CELL); }
                    const g = c.createLinearGradient(0, y, 0, y + CELL);
                    g.addColorStop(0, 'rgba(236,214,172,0.3)'); g.addColorStop(0.45, 'rgba(120,100,70,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
                    c.fillStyle = g; c.fillRect(x, y, CELL, CELL);
                    c.fillStyle = 'rgba(214,194,150,0.62)'; c.fillRect(x, y, CELL, 4);
                    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x, y + 4, CELL, 3);
                    if (hash((gx0 + i) * 9.7 + (gy0 + j) * 4.3) < 0.3) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 22, y + 7, 3, CELL - 7); }   // a joint between blocks
                } else {
                    c.fillStyle = 'rgba(196,176,136,0.38)';
                    if (open(tAt(i, j - 1))) c.fillRect(x, y, CELL, 3);
                    if (open(tAt(i - 1, j))) c.fillRect(x, y, 3, CELL);
                    if (open(tAt(i + 1, j))) c.fillRect(x + CELL - 3, y, 3, CELL);
                }
                return;
            }
            const D = t === T.WATER ? 18 : 26;
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const nt = tAt(i + dx, j + dy);
                const wall = nt === T.SOLID, bank = t === T.WATER && open(nt), kerb = open(t) && nt === T.WATER;
                if (wall || bank) {
                    const depth = wall && dy < 0 ? D + 10 : D;       // the face above throws the longest shadow
                    const g = dy ? c.createLinearGradient(0, dy < 0 ? y : y + CELL, 0, dy < 0 ? y + depth : y + CELL - depth) : c.createLinearGradient(dx < 0 ? x : x + CELL, 0, dx < 0 ? x + depth : x + CELL - depth, 0);
                    g.addColorStop(0, `rgba(0,0,0,${bank ? 0.6 : 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
                    c.fillStyle = g;
                    if (dy) c.fillRect(x, dy < 0 ? y : y + CELL - depth, CELL, depth); else c.fillRect(dx < 0 ? x : x + CELL - depth, y, depth, CELL);
                }
                if (kerb) {
                    c.fillStyle = 'rgba(206,188,150,0.45)';
                    if (dy) c.fillRect(x, dy < 0 ? y : y + CELL - 4, CELL, 4); else c.fillRect(dx < 0 ? x : x + CELL - 4, y, 4, CELL);
                }
            }
        });
        // 5. the ward's colour
        c.globalCompositeOperation = 'multiply'; c.fillStyle = theme.tint; c.fillRect(0, 0, CW, CW); c.globalCompositeOperation = 'source-over';
        // 6. what lies on the ground
        for (const d of decals) {
            const img = im(d.kind), h = d.size / 2 + 20;
            if (!img || d.x + h < ox || d.x - h > ox + CW || d.y + h < oy || d.y - h > oy + CW) continue;
            let src = img;
            if (d.soft) {
                const S = 256, tc = softCanvas.getContext('2d'); softCanvas.width = softCanvas.height = S;
                tc.drawImage(img, 0, 0, S, S); tc.globalCompositeOperation = 'destination-in';
                const g = tc.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.5);
                g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                tc.fillStyle = g; tc.fillRect(0, 0, S, S);
                src = softCanvas;
            }
            c.save(); c.globalAlpha = d.alpha; c.translate(d.x - ox, d.y - oy); c.rotate(d.rot);
            if (d.mode) c.globalCompositeOperation = d.mode;
            c.drawImage(src, -d.size / 2, -d.size / 2, d.size, d.size); c.restore();
        }
        return ch.canvas;
    }

    // ── the dead ──
    function drawEnemy(e) {
        const isBoss = e.type === 'boss', def = isBoss ? null : E[e.type];
        // its own sheet if there is one; otherwise a recolour of the nearest older one (drawn larger: those leave a wide margin)
        const own = isBoss ? IMG[e.boss.id + 'Walk'] : def.alt ? IMG[def.sheet] : null;
        const sheet = ok(own) ? own : isBoss ? tinted(e.boss.sheet + 'Walk', e.boss.tint) : tinted(def.alt || def.sheet, def.tint);
        const aura = isBoss ? e.boss.aura : def.aura, size = e.size * (isBoss && !ok(own) ? 1.5 : 1), stunned = e.stun > 0;
        let alpha = stunned ? 0.55 : 1, lift = 0, sY = 1;
        if (e.hidden) {
            const k = e.state === 'emerge' ? 1 - e.timer / 46 : 0.3;
            ctx.strokeStyle = `rgba(90,220,220,${0.3 + k * 0.5})`; ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(e.x, e.y, 30 + i * 26 + Math.sin(time * 3 + i) * 5, (30 + i * 26) * 0.5, 0, 0, TAU); ctx.stroke(); }
            return;
        }
        // every one of them carries its own light: its colour is what it is
        light(e.x, e.y - 10, e.r * (isBoss ? 6 : e.elite ? 5.4 : 4.8), aura, stunned ? 0.4 : 0.85);      // in a dark this deep, this is how a threat is read
        if (e.elite) glow(e.x, e.y, e.r * 2.6, '255,210,90', 0.2 + Math.sin(time * 4) * 0.06, false);
        if (e.hurtT > 0) { e.hurtT--; glow(e.x, e.y, e.r * 1.8, '255,236,180', 0.45, false); }
        if (e.type === 'drowned') {
            const rising = e.state === 'wind' ? 1 - e.timer / 26 : e.state === 'lurk' ? 0 : 1;
            alpha *= 0.22 + rising * 0.78; lift = -rising * 10;
            const pud = IMG.puddle;
            if (ok(pud) && rising < 1) drawSprite(pud, e.x, e.y + 8, 120, 0.75 * (1 - rising));
            ctx.strokeStyle = `rgba(90,220,220,${e.state === 'lurk' ? 0.14 + 0.1 * Math.sin(time * 3 + e.phase) : 0.55 * rising})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, e.r * 1.4 + rising * 16, (e.r * 1.4 + rising * 16) * 0.55, 0, 0, TAU); ctx.stroke();
        } else if (e.type === 'wraith' || e.type === 'preta') {
            lift = Math.sin(time * 2 + e.phase) * 4 - 6;
            if (e.type === 'preta') alpha *= 0.85;
            if (e.state === 'wind') glow(e.x, e.y, e.r * 2.4, '255,90,60', 0.4 * (1 - e.timer / 22), false);
        } else if (e.type === 'hunter') {
            if (e.state === 'wind') {
                // the line of the leap, drawn before it is made
                const k = 1 - e.timer / 26;
                ctx.strokeStyle = `rgba(255,70,50,${0.25 + k * 0.5})`; ctx.lineWidth = 2 + k * 3; ctx.setLineDash([10, 8]);
                ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.aim) * 190, e.y + Math.sin(e.aim) * 190); ctx.stroke(); ctx.setLineDash([]);
                sY = 1 - k * 0.14;
            } else if (e.state === 'pounce') glow(e.x, e.y, e.r * 2.4, '255,40,40', 0.3, false);
            else if (e.state === 'recover') alpha *= 0.7;
        } else if (e.type === 'mantrik') {
            lift = Math.sin(time * 1.6 + e.phase) * 3 - 4;
            if (e.state === 'cast') { const k = 1 - e.timer / 36; glow(e.x, e.y - 30, 14 + k * 26, '200,120,255', 0.5 + k * 0.4); }
        } else if (e.type === 'sentinel' || isBoss) {
            sY = 1 + Math.abs(Math.sin(e.phase * Math.PI)) * 0.03;
        }
        if (isBoss) {
            if (e.bound > 0) {
                // bound: his own coil's mark stays on the brass while it is soft
                ctx.strokeStyle = `rgba(255,208,112,${0.45 + 0.25 * Math.sin(time * 8)})`; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -time * 30;
                ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.3, e.r * 1.5, e.r * 0.8, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
            } else if (e.state !== 'intro') glow(e.x, e.y - e.r * 0.4, e.r * 2.6, '190,200,220', 0.07 + 0.03 * Math.sin(time * 2), false);
            if (e.state === 'intro') alpha *= 1 - e.timer / 110;
            if (e.shield) glow(e.x, e.y - e.r * 0.3, e.r * 3.4, '255,140,80', 0.3 + 0.12 * Math.sin(time * 9), false);
            if (e.dying) { alpha *= 0.55 + 0.45 * Math.sin(time * 22); glow(e.x, e.y - e.r * 0.3, e.r * (3 + (150 - e.dying) / 40), '255,220,150', 0.3, false); }
            if (e.state === 'cast' || e.state === 'charge-wind') glow(e.x, e.y, e.r * 3, aura, 0.22, false);
        }
        if (stunned) {
            ctx.strokeStyle = `rgba(212,175,55,${0.3 + 0.2 * Math.sin(time * 6)})`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.5, 0, TAU); ctx.stroke();
        }
        ctx.save();
        ctx.translate(e.x, e.y + lift);
        ctx.globalAlpha = Math.max(0, alpha);
        if (sheet) {
            const sw = sheet.naturalWidth || sheet.width, sh = sheet.naturalHeight || sheet.height;
            const n = Math.max(1, Math.round(sw / sh)), cell = sw / n;
            let frame = Math.floor(e.phase) % n;
            if (e.type === 'drowned' && e.state === 'lurk') frame = 0;
            if (e.state === 'lunge' || e.state === 'pounce' || e.state === 'charge') frame = Math.floor(time * 12) % n;
            const dirX = Math.cos(e.face), dirY = Math.sin(e.face);
            if (Math.abs(dirX) > 0.35) e.flip = dirX < 0;
            ctx.rotate(dirX * 0.14);
            ctx.scale(e.flip ? -1 : 1, sY * (1 - Math.max(0, -dirY) * 0.06));
            const bob = e.type === 'sentinel' || isBoss ? 0 : Math.sin(e.phase * TAU) * 1.5;
            ctx.drawImage(sheet, frame * cell, 0, cell, sh, -size / 2, -size * 0.62 + bob, size, size);
        } else {
            ctx.fillStyle = '#1a1014'; ctx.beginPath(); ctx.arc(0, -e.r * 0.4, e.r, 0, TAU); ctx.fill();
            ctx.fillStyle = `rgb(${aura})`; ctx.fillRect(-8, -e.r * 0.5, 4, 4); ctx.fillRect(4, -e.r * 0.5, 4, 4);
        }
        ctx.restore();
        // what is left of it, once it has been hurt
        if (!isBoss && e.hp < e.maxHp) {
            const bw = Math.max(30, e.r * 1.8), bx = e.x - bw / 2, by = e.y - size * 0.62 - 6 + lift;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
            ctx.fillStyle = e.burn > 0 ? '#9fcf4a' : `rgb(${aura})`; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
        }
    }

    // The body is the original sprite chain: head, scaled segments, tail, one transform per segment.
    function drawSnake() {
        const blink = (grace > 0 || hurtCd > 0) && Math.floor(frames / 5) % 2 === 0;
        ctx.globalAlpha = blink ? 0.4 : 1;
        if (shed.active > 0) glow(sn.x, sn.y, 70, '240,216,144', 0.35, false);
        const headImg = ok(IMG.snakeHead) ? IMG.snakeHead : null, bodyImg = ok(IMG.snakeBody) ? IMG.snakeBody : null, tailImg = ok(IMG.snakeTail) ? IMG.snakeTail : null;
        const base = ctx.getTransform();
        const vx0 = sn.x - W / 2 - 60, vx1 = sn.x + W / 2 + 60, vy0 = sn.y - H / 2 - 60, vy1 = sn.y + H / 2 + 60;
        for (let s = sn.len - 1; s >= 0; s--) {
            const k = trail.at(Math.min(s * SG, trail.n - 1));
            if (trail.n === 0) break;
            const px = trail.x[k], py = trail.y[k];
            if (px < vx0 || px > vx1 || py < vy0 || py > vy1) continue;
            const isHead = s === 0, isTail = s === sn.len - 1;
            let a = trail.a[k];
            if (isTail && s > 0) { const q = trail.at(Math.min((s - 1) * SG, trail.n - 1)); a = Math.atan2(py - trail.y[q], px - trail.x[q]); if (px === trail.x[q] && py === trail.y[q]) a = trail.a[k] + Math.PI; }
            const c = Math.cos(a), sn_ = Math.sin(a);
            ctx.setTransform(base.a * c + base.c * sn_, base.b * c + base.d * sn_, -base.a * sn_ + base.c * c, -base.b * sn_ + base.d * c, base.a * px + base.c * py + base.e, base.b * px + base.d * py + base.f);
            const img = isHead ? headImg : isTail ? tailImg : bodyImg;
            if (img) {
                const drawSize = SS * 1.7 - (isHead ? 0 : (s / sn.len) * (SS * 0.4)), h = drawSize * (img.naturalHeight / img.naturalWidth);
                ctx.drawImage(img, -drawSize / 2, -h / 2, drawSize, h);
            } else {
                ctx.fillStyle = isHead ? '#5c1010' : '#2b0606'; ctx.beginPath(); ctx.arc(0, 0, isHead ? SS / 1.4 : SS / 1.8, 0, TAU); ctx.fill();
            }
            if (!isHead && s % 5 === 0) lights.push(px, py, 105, '255,200,130', 0.26);
        }
        ctx.setTransform(base);
        ctx.globalAlpha = 1;
        // his own light: a lantern, not a floodlight. Warm, close, and it breathes.
        const breath = 1 + Math.sin(time * 1.7) * 0.025 + Math.sin(time * 4.3) * 0.012;
        light(sn.x, sn.y, (400 + sn.len * 1.5) * breath, '255,222,176', 0.9);
        light(sn.x, sn.y, 150, '255,244,224', 0.5);
    }
    function drawDecoy(d) {
        const img = ok(IMG.snakeBody) ? IMG.snakeBody : null;
        const a = Math.min(1, d.t / 40) * 0.42;
        for (let i = d.pts.length - 1; i >= 0; i--) {
            const p = d.pts[i];
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = a;
            if (img) { const s = SS * 1.5, h = s * (img.naturalHeight / img.naturalWidth); ctx.filter = 'none'; ctx.drawImage(img, -s / 2, -h / 2, s, h); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.5; ctx.drawImage(img, -s / 2, -h / 2, s, h); }
            else { ctx.fillStyle = '#b9a67d'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); }
            ctx.restore();
        }
        light(d.x, d.y, 150, '240,220,170', 0.4);
    }
    // The slab was painted with a vanishing point; this world has none. Each row of the sprite is stretched to one
    // width (edges fitted as straight lines, so the spikes keep their outline), once, into a cached canvas.
    let slabCache = null;
    function slabSprite() {
        if (slabCache || !ok(IMG.gateSlab)) return slabCache;
        const src = IMG.gateSlab, W0 = src.naturalWidth, H0 = src.naturalHeight;
        const t = document.createElement('canvas'); t.width = W0; t.height = H0;
        const tc = t.getContext('2d'); tc.drawImage(src, 0, 0);
        const d = tc.getImageData(0, 0, W0, H0).data;
        const ext = y => { let l = -1, r = -1; for (let x = 0; x < W0; x++) if (d[(y * W0 + x) * 4 + 3] > 90) { if (l < 0) l = x; r = x; } return [l, r]; };
        let top = 0; while (top < H0 - 1 && ext(top)[0] < 0) top++;
        let bot = H0 - 1; while (bot > top && ext(bot)[0] < 0) bot--;
        let wide = top, ww = 0;
        for (let y = top; y <= bot; y++) { const [l, r] = ext(y); if (r - l > ww) { ww = r - l; wide = y; } }
        const far = top + Math.round((wide - top) * 0.08), [fl, fr] = ext(far), [nl, nr] = ext(wide);
        const c = document.createElement('canvas'); c.width = 160; c.height = bot - top + 1;
        const g = c.getContext('2d');
        for (let y = top; y <= bot; y++) {
            const k = Math.min(1, (y - far) / Math.max(1, wide - far));
            const l = fl + (nl - fl) * k - 3, r = fr + (nr - fr) * k + 3;
            g.drawImage(src, l, y, r - l, 1, 0, y - top, c.width, 1);
        }
        slabCache = { c, split: wide - top + 4 };
        return slabCache;
    }
    function drawBars(door) {
        // brass posts across the passage, a chain between them; the ward's seal burns
        const seal = door === ward.seal && !fight;
        const xs = door.cells.map(k => (k % ward.GW + 0.5) * CELL), ys = door.cells.map(k => (Math.floor(k / ward.GW) + 0.5) * CELL);
        const rise = Math.min(1, (frames - door.t) / 14);
        const front = ok(IMG.barsFront) ? IMG.barsFront : null, slab = slabSprite();
        if (door.h ? slab : front) {
            ctx.save(); ctx.globalAlpha = rise;
            if (door.h) {
                // The passage runs east-west, so its barrier runs away from the camera, where a flat gate would be a
                // sliver. Here the passage is shut by a slab as thick as a wall: its long spiked top fills the passage
                // from wall to wall, and its end face stands at the near side.
                const y0 = Math.min(...ys) - 25, y1 = Math.max(...ys) + 25, WD = 76, FACE = 56, LIFT = 34;
                const topH = (y1 - FACE + 6) - (y0 - LIFT), c = slab.c;
                const sh = ctx.createLinearGradient(door.x + WD / 2 - 4, 0, door.x + WD / 2 + 30, 0);       // what it throws on the paving
                sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = sh; ctx.fillRect(door.x + WD / 2 - 4, y0 + 4, 34, y1 - y0);
                ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(door.x - WD / 2 - 4, y0 + 4, 6, y1 - y0);
                ctx.drawImage(c, 0, 0, c.width, slab.split, door.x - WD / 2, y0 - LIFT, WD, topH);
                ctx.drawImage(c, 0, slab.split, c.width, c.height - slab.split, door.x - WD / 2, y1 - FACE + 6, WD, FACE);
            } else {
                const x0 = Math.min(...xs) - 25, x1 = Math.max(...xs) + 25, wd = (x1 - x0) + 44, h = wd * front.naturalHeight / front.naturalWidth;
                ctx.drawImage(front, (x0 + x1) / 2 - wd / 2, door.y + 26 - h * rise, wd, h * rise);
            }
            ctx.restore();
            if (seal) {
                const sig = IMG.fxSigil, p = 0.6 + 0.3 * Math.sin(time * 2.5);
                if (ok(sig)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = p; ctx.translate(door.x, door.y - 20); ctx.rotate(time * 0.3); ctx.drawImage(sig, -55, -55, 110, 110); ctx.restore(); }
                light(door.x, door.y, 280, '255,150,80', 0.8 * p);
            } else light(door.x, door.y - 20, 240, '255,206,130', 0.8);
            return;
        }
        for (let i = 0; i < xs.length; i++) for (const o of [-17, 0, 17]) {
            const x = xs[i] + (door.h ? 0 : o), y = ys[i] + (door.h ? o : 0) + 14, h = 66 * rise;
            const g = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
            g.addColorStop(0, '#3a2c16'); g.addColorStop(0.45, seal ? '#e0a050' : '#c8a860'); g.addColorStop(1, '#2a1f10');
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, 8, 3.5, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = g; ctx.fillRect(x - 4, y - h, 8, h);
            ctx.fillStyle = seal ? '#ffb060' : '#e6cf8f'; ctx.beginPath(); ctx.arc(x, y - h, 5.5, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(120,96,50,0.9)'; ctx.lineWidth = 2;
        for (const lift of [22, 48]) { ctx.beginPath(); ctx.moveTo(xs[0], ys[0] + 14 - lift * rise); for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i] + 14 - lift * rise); ctx.stroke(); }
        if (seal) {
            const sig = IMG.fxSigil, p = 0.6 + 0.3 * Math.sin(time * 2.5);
            if (ok(sig)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = p; ctx.translate(door.x, door.y - 14); ctx.rotate(time * 0.3); ctx.drawImage(sig, -60, -60, 120, 120); ctx.restore(); }
            light(door.x, door.y, 260, '255,150,80', 0.7 * p);
        } else light(door.x, door.y - 20, 210, '255,206,130', 0.75);
    }

    // ── motes: the air of each ward, in screen space ──
    function updateMotes() {
        const kind = theme.mote, want = quality === 2 ? (kind === 'mist' ? 12 : 44) : quality === 1 ? (kind === 'mist' ? 6 : 18) : 0;
        if (motes.kind !== kind) { motes.length = 0; motes.kind = kind; }
        if (motes.length > want) motes.length = want;
        while (motes.length < want) motes.push({ x: rand(W), y: rand(H), p: rand(100), t: rand(100), s: rand(0.8, 2.2), v: rand(0.5, 1) });
        for (const m of motes) {
            m.t += 0.02;
            if (kind === 'firefly') { m.x += Math.cos(m.t * 0.7 + m.p) * 0.45; m.y += Math.sin(m.t * 0.9 + m.p * 1.3) * 0.35; }
            else if (kind === 'ember') { m.x += Math.sin(m.t * 2 + m.p) * 0.5 + 0.15; m.y -= 0.5 + m.v * 0.9; }
            else if (kind === 'mist') { m.x += 0.22 * m.v; m.y += Math.sin(m.t + m.p) * 0.1; }
            else { m.x += Math.sin(m.t + m.p) * 0.2; m.y -= 0.2 + m.v * 0.25; }
            if (m.x > W + 140) m.x = -130; if (m.x < -140) m.x = W + 130;
            if (m.y < -40) { m.y = H + 30; m.x = rand(W); } if (m.y > H + 40) m.y = -30;
        }
    }
    function drawMotes() {
        const kind = theme.mote;
        for (const m of motes) {
            if (kind === 'mist') { ctx.globalAlpha = 0.05 + 0.02 * Math.sin(m.t + m.p); const r = 110 + m.s * 50; ctx.drawImage(glowSprite('170,214,232'), m.x - r, m.y - r * 0.5, r * 2, r); continue; }
            const tw = kind === 'firefly' ? Math.max(0, Math.sin(m.t * 2.2 + m.p)) : 0.6 + 0.4 * Math.sin(m.t * 3 + m.p);
            const rgb = kind === 'firefly' ? '206,236,120' : kind === 'ember' ? '255,150,60' : '196,160,255';
            ctx.globalAlpha = (kind === 'ember' ? 0.5 : 0.42) * tw;
            ctx.drawImage(glowSprite(rgb), m.x - m.s * 3.2, m.y - m.s * 3.2, m.s * 6.4, m.s * 6.4);
        }
        ctx.globalAlpha = 1;
    }

    // ── the minimap: the ward as he has walked it ──
    const mapCanvas = $('gs-map'), mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;
    function drawMinimap() {
        if (!mapCtx) return;
        const S = mapCanvas.width, Hh = mapCanvas.height, k = S / ward.GW, G = ward.grid, GW = ward.GW;
        mapCtx.clearRect(0, 0, S, Hh);
        mapCtx.fillStyle = 'rgba(9,6,8,0.7)'; mapCtx.fillRect(0, 0, S, Hh);
        for (let y = 0; y < ward.GH; y++) for (let x = 0; x < GW; x++) {
            const i = y * GW + x, t = G[i];
            if (t === ward.bg) continue;
            const rid = ward.roomId[i], known = explored[i];
            if (!known && !(rid >= 0 && ward.rooms[rid].seen)) continue;
            if (t === T.WATER) mapCtx.fillStyle = known ? 'rgba(52,96,110,0.95)' : 'rgba(34,60,70,0.5)';
            else if (t === T.BARS) mapCtx.fillStyle = '#d0603a';
            else if (t === T.FLOOR) mapCtx.fillStyle = known ? 'rgba(205,172,108,0.74)' : 'rgba(120,100,66,0.24)';
            else mapCtx.fillStyle = 'rgba(150,128,84,0.5)';
            mapCtx.fillRect(x * k, y * k, k + 0.5, k + 0.5);
        }
        const P = v => v / CELL * k;
        const dot = (x, y, r, col) => { mapCtx.fillStyle = col; mapCtx.beginPath(); mapCtx.arc(P(x), P(y), r, 0, TAU); mapCtx.fill(); };
        const ring = (x, y, r, col) => { mapCtx.strokeStyle = col; mapCtx.lineWidth = 1.5; mapCtx.beginPath(); mapCtx.arc(P(x), P(y), r, 0, TAU); mapCtx.stroke(); };
        const diamond = (x, y, r, col) => { mapCtx.save(); mapCtx.translate(P(x), P(y)); mapCtx.rotate(Math.PI / 4); mapCtx.fillStyle = col; mapCtx.fillRect(-r, -r, r * 2, r * 2); mapCtx.restore(); };
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        for (const rm of ward.rooms) {
            if (!rm.seen) continue;
            if (rm.kind === 'combat') { if (rm.state === 'cleared') dot(rm.x, rm.y, 2.5, 'rgba(255,190,110,0.8)'); else ring(rm.x, rm.y, 4, '#d0603a'); }
            else if (rm.kind === 'elite') diamond(rm.x, rm.y, 3.5, rm.state === 'cleared' ? 'rgba(255,190,110,0.8)' : '#ff5a3a');
            else if (rm.kind === 'boss') diamond(rm.x, rm.y, 5.5 + (ward.seal && !ward.seal.barred ? pulse : 0), rm.state === 'cleared' ? 'rgba(255,190,110,0.8)' : ward.seal && ward.seal.barred ? '#7a2a20' : '#ffd070');
            else if (rm.kind === 'shrine') dot(rm.x, rm.y, 4, shrines.some(s => s.room === rm && !s.lit) ? '#ffb347' : 'rgba(255,179,71,0.4)');
            else if (rm.kind === 'memory' || rm.kind === 'reliquary') { if (pickups.some(p => p.room === rm)) ring(rm.x, rm.y, 4.5, '#f0c89a'); }
            else if (rm.kind === 'trader') { mapCtx.fillStyle = '#e6cf8f'; mapCtx.fillRect(P(rm.x) - 3.5, P(rm.y) - 3.5, 7, 7); }
        }
        for (const p of pickups) if (p.kind === 'piece') dot(p.x, p.y, 2.6 + pulse, '#dcc6ff'); else if (p.kind === 'exit') diamond(p.x, p.y, 4 + pulse, '#ffffff');
        for (const e of enemies) if (!e.hidden) dot(e.x, e.y, e.type === 'boss' ? 4 : 2, '#d0603a');
        dot(sn.x, sn.y, 3.4, '#ffffff');
        mapCtx.strokeStyle = 'rgba(192,160,96,0.35)'; mapCtx.lineWidth = 1; mapCtx.strokeRect(0.5, 0.5, S - 1, Hh - 1);
    }

    function render() {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#060406'; ctx.fillRect(0, 0, W, H);
        if (!ward || !session.started) return;
        lights.length = 0;
        const camX = sn.x - W / 2 + (shake > 0 ? rand(-shake, shake) * 0.5 : 0), camY = sn.y - H / 2 + (shake > 0 ? rand(-shake, shake) * 0.5 : 0);
        const x0 = camX - 220, x1 = camX + W + 220, y0 = camY - 220, y1 = camY + H + 360;
        const vis = o => o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1;
        const im = k => (ok(IMG[k]) ? IMG[k] : null);
        ctx.save();
        ctx.translate(-camX, -camY);

        // 1. ground
        for (let cy = Math.floor(camY / CW); cy <= Math.floor((camY + H) / CW); cy++) for (let cx = Math.floor(camX / CW); cx <= Math.floor((camX + W) / CW); cx++) {
            if (cx < -1 || cy < -1 || cx * CW > ward.W + CW || cy * CW > ward.H + CW) continue;
            ctx.drawImage(chunkFloor(cx, cy), cx * CW, cy * CW);
        }

        // 2. flat on the ground
        for (const st of statues) {
            if (!vis(st)) continue;
            const img = im(st.variant ? 'statueB' : 'statueA'); if (!img) continue;
            ctx.save(); ctx.globalAlpha = 0.8; ctx.translate(st.x, st.y); ctx.rotate(st.rot); ctx.drawImage(img, -st.size * 0.42, -st.size * 0.42, st.size * 0.84, st.size * 0.84); ctx.restore();
        }
        for (const l of loops) {
            if (l.toll) {
                const k = l.t / 60;
                ctx.strokeStyle = `rgba(212,175,55,${(1 - k) * 0.5})`; ctx.lineWidth = 3 - k * 2;
                ctx.beginPath(); ctx.arc(l.x, l.y, 30 + k * 520, 0, TAU); ctx.stroke();
                ctx.strokeStyle = `rgba(212,175,55,${(1 - k) * 0.25})`; ctx.beginPath(); ctx.arc(l.x, l.y, 10 + k * 380, 0, TAU); ctx.stroke();
                light(l.x, l.y, 500, '255,220,150', (1 - k) * 0.5);
                continue;
            }
            // the closed coil: a breath of gold over everything it held
            const k = l.t / 30, a = (1 - k) * (l.hit ? 0.5 : 0.1);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath(); ctx.moveTo(l.pts[0].x, l.pts[0].y); for (let i = 1; i < l.pts.length; i++) ctx.lineTo(l.pts[i].x, l.pts[i].y); ctx.closePath();
            ctx.fillStyle = `rgba(255,196,96,${a})`; ctx.fill();
            ctx.strokeStyle = `rgba(255,232,170,${(1 - k) * (l.hit ? 0.9 : 0.3)})`; ctx.lineWidth = l.hit ? 5 - k * 3 : 2; ctx.stroke();
            ctx.restore();
            if (l.hit) light(l.cx, l.cy, 420, '255,220,150', 1 - k);
        }
        for (const z of zones) {
            if (z.delay > 0) continue;
            const k = z.t / z.T;
            ctx.save();
            if (z.kind === 'circle') {
                ctx.fillStyle = `rgba(200,40,30,${0.08 + k * 0.2})`; ctx.strokeStyle = `rgba(255,120,70,${0.5 + k * 0.4})`; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, TAU); ctx.stroke();
                light(z.x, z.y, z.r * 1.6, '255,90,60', 0.3 + k * 0.4);
                if (z.fx === 'bell' || z.fx === 'shard') {
                    // the thing itself, falling out of the dark above
                    const img = im(z.fx === 'bell' ? 'bell' : 'shard'), size = (z.fx === 'bell' ? 120 : 64) * (2.1 - 1.1 * k);
                    if (img) { ctx.globalAlpha = Math.min(1, k * 2); ctx.drawImage(img, z.x - size / 2, z.y - size / 2 - (1 - k) * (1 - k) * 420, size, size); ctx.globalAlpha = 1; }
                }
            } else {
                ctx.translate(z.x, z.y); ctx.rotate(z.a);
                ctx.fillStyle = `rgba(200,40,30,${0.08 + k * 0.2})`; ctx.fillRect(0, -z.w / 2, z.len, z.w);
                ctx.fillStyle = `rgba(255,120,70,${0.3 + k * 0.4})`; ctx.fillRect(0, -z.w / 2, z.len * k, 3); ctx.fillRect(0, z.w / 2 - 3, z.len * k, 3);
            }
            ctx.restore();
        }
        for (const p of pools) {
            const img = im('fxPool'), a = Math.min(1, (p.max - p.life) / 14) * Math.min(1, p.life / 40), size = p.r * 2.5 * (1 + 0.03 * Math.sin(time * 4 + p.rot));
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot + time * 0.05);
            if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size); else { ctx.fillStyle = 'rgba(255,140,50,0.5)'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); }
            ctx.restore();
            light(p.x, p.y, p.r * 2.4, '255,150,70', 0.8 * a);
        }
        for (const b of beams) {
            const x = b.src.x, y = b.src.y - 10, r0 = b.src.r * 0.7;
            ctx.save(); ctx.translate(x, y); ctx.rotate(b.a);
            if (b.t <= b.warm) {
                const k = b.t / b.warm;
                ctx.strokeStyle = `rgba(255,120,70,${0.2 + k * 0.5})`; ctx.lineWidth = 2 + k * 3; ctx.setLineDash([14, 10]);
                ctx.beginPath(); ctx.moveTo(r0, 0); ctx.lineTo(b.len, 0); ctx.stroke(); ctx.setLineDash([]);
            } else {
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createLinearGradient(0, -30, 0, 30), fl = 0.8 + 0.2 * Math.sin(time * 30);
                g.addColorStop(0, 'rgba(255,120,50,0)'); g.addColorStop(0.5, `rgba(255,200,120,${0.85 * fl})`); g.addColorStop(1, 'rgba(255,120,50,0)');
                ctx.fillStyle = g; ctx.fillRect(r0, -30, b.len - r0, 60);
                ctx.fillStyle = `rgba(255,250,230,${0.9 * fl})`; ctx.fillRect(r0, -4, b.len - r0, 8);
            }
            ctx.restore();
            if (b.t > b.warm) for (let q = 1; q <= 4; q++) light(x + Math.cos(b.a) * b.len * q / 4.4, y + Math.sin(b.a) * b.len * q / 4.4, 190, '255,170,90', 0.75);
        }
        for (const d of decoys) drawDecoy(d);
        for (const b of bells) {
            if (!vis(b)) continue;
            const img = im('bell'), max = b.max || 600, wob = b.cd > max - 60 ? Math.sin((max - b.cd) * 0.6) * (b.cd - max + 60) / 60 * 0.2 : 0;
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(wob);
            if (img) ctx.drawImage(img, -46, -46, 92, 92); else { ctx.fillStyle = '#8a7430'; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill(); }
            ctx.restore();
            if (b.cd > 0) { ctx.strokeStyle = 'rgba(192,160,96,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 12, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - b.cd / max)); ctx.stroke(); }
            else light(b.x, b.y, 130, '255,214,140', 0.4);
        }
        for (const p of pickups) {
            if (!vis(p)) continue;
            const pulse = Math.sin(time * 1.6 + p.off), g = 0.5 + pulse * 0.5;
            if (p.kind === 'shard') {
                glow(p.x, p.y, 30 + pulse * 3, '255,200,90', 0.18);
                const img = im('shard'); if (img) drawSprite(img, p.x, p.y - 4 - pulse * 2, 38); else { ctx.fillStyle = '#ffdf73'; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, TAU); ctx.fill(); }
            } else if (p.kind === 'piece') {
                glow(p.x, p.y, 72 + g * 16, '190,150,250', 0.32 + g * 0.1);
                const img = im('soul'); if (img) drawSprite(img, p.x, p.y - 6 + pulse * 4, 62 + g * 6); else { ctx.fillStyle = '#b48ede'; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, TAU); ctx.fill(); }
            } else if (p.kind === 'memory') {
                glow(p.x, p.y, 96 + g * 20, '255,220,160', 0.26 + g * 0.12);
                const img = im('lotus'); if (img) drawSprite(img, p.x, p.y - 6 + pulse * 4, 80 + g * 8);
            } else if (p.kind === 'heal') {
                glow(p.x, p.y, 60 + g * 10, '255,150,110', 0.3);
                const img = im('diya'); if (img) drawSprite(img, p.x, p.y - 6 + pulse * 3, 54);
            } else {
                // a boon waiting to be taken, or the way down
                const exit = p.kind === 'exit', rgb = exit ? '230,220,255' : '255,206,120', img = im('fxSigil'), size = exit ? 190 : 120;
                glow(p.x, p.y, size * 0.8 + g * 14, rgb, 0.3 + g * 0.12);
                const well = exit && im('stairwell');
                if (well) drawSprite(well, p.x, p.y, 210);
                if (img) { ctx.save(); if (well) ctx.globalAlpha = 0.45; ctx.globalCompositeOperation = 'lighter'; ctx.translate(p.x, p.y); ctx.rotate(time * (exit ? -0.5 : 0.8)); ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.restore(); }
                if (!exit) { const l = im('lotus'); if (l) drawSprite(l, p.x, p.y - 8 + pulse * 4, 56); }
                ctx.font = "600 12px 'Cinzel', serif"; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(${rgb},0.85)`;
                ctx.fillText(exit ? 'DESCEND' : 'VARDAAN', p.x, p.y + size * 0.5 + 16);
            }
        }
        for (const s of spawns) {
            // where one of them is about to stand
            const k = s.t / s.T, img = im('fxSigil'), size = 150 - k * 90;
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + k * 0.6; ctx.translate(s.x, s.y); ctx.rotate(k * 4);
            if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size); else { ctx.strokeStyle = '#c090ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, TAU); ctx.stroke(); }
            ctx.restore();
            light(s.x, s.y, 130, s.elite ? '255,200,90' : '200,140,255', 0.3 + k * 0.4);
        }
        for (const e of enemies) {
            if (e.hidden || (e.type === 'drowned' && e.state === 'lurk')) continue;
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.5, e.r * 0.85, e.r * 0.28, 0, 0, TAU); ctx.fill();
        }

        // 3. standing things, painted by base y
        const standing = [];
        for (const s of shrines) if (vis(s)) standing.push({ y: s.y + 40, draw: () => {
            const img = im(s.variant === 2 ? 'shrineB' : 'shrineA');
            // a wayside shrine, a little taller than a pillar: it must not outgrow the room it stands in
            if (img) drawStanding(img, s.x, s.y + 36, 230); else { ctx.fillStyle = '#1a0e1e'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
            if (s.lit) {
                const f = 0.85 + Math.sin((time + s.flicker) * 7) * 0.08 + Math.sin((time + s.flicker) * 13) * 0.07;
                glow(s.x, s.y + 62, 40, '255,170,80', 0.42 * f, false); light(s.x, s.y + 40, 320, theme.diya, 0.95 * f);
                const d = im('diya'); if (d) drawStanding(d, s.x, s.y + 72, 34);
            } else light(s.x, s.y + 40, 150, '255,200,140', 0.22 + 0.1 * Math.sin(time * 2));       // it can still be found in the dark
        } });
        for (const o of obs) {
            if (!vis(o) || o.kind === 'shrine') continue;
            if (o.kind === 'stall') standing.push({ y: o.y + 40, draw: () => {
                const img = im('yaksha') || im('shrineB'), sh = im('shard');
                if (img) drawStanding(img, o.x, o.y + 44, 240);
                light(o.x, o.y + 20, 320, '255,214,130', 0.9);
                if (sh && !im('yaksha')) for (let i = 0; i < 3; i++) drawSprite(sh, o.x + (i - 1) * 42, o.y - 96 + Math.sin(time * 1.4 + i * 2) * 6, 30, 0.95);
                ctx.font = "600 12px 'Cinzel', serif"; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,207,143,0.85)'; ctx.fillText('THE YAKSHA', o.x, o.y + 78);
            } });
            else standing.push({ y: o.y + 12, draw: () => {
                const broken = o.kind === 'stump', img = im(broken ? 'pillarBroken' : 'pillar');
                if (img) drawStanding(img, o.x, o.y + 20, broken ? 110 : 200); else { ctx.fillStyle = '#1c151a'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
            } });
        }
        for (const t of trees) if (vis(t)) standing.push({ y: t.y + 24, draw: () => {
            const img = im(t.variant === 1 ? 'treeA' : t.variant === 2 ? 'treeB' : 'treeC'); if (!img) return;
            ctx.save(); ctx.translate(t.x, t.y + 30); ctx.rotate(Math.sin(time * 0.4 + t.sway) * 0.008);
            const h = t.size * (img.naturalHeight / img.naturalWidth);
            ctx.drawImage(img, -t.size / 2, -h + t.size * 0.1, t.size, h); ctx.restore();
        } });
        for (const d of diyas) {
            if (!vis(d)) continue;
            if (d.at && frames >= d.at) { d.lit = true; d.at = 0; burst.flame(d.x, d.y - 6); }
            standing.push({ y: d.y, draw: () => {
                const img = im('diya');
                if (d.lit) {
                    const f = 0.85 + Math.sin((time + d.flicker) * 7) * 0.08 + Math.sin((time + d.flicker) * 13) * 0.07;
                    light(d.x, d.y - 4, 230 * (0.94 + 0.06 * f), theme.diya, 0.85 * f);
                    glow(d.x, d.y - 12, 26, '255,180,90', 0.5 * f, false);
                    if (img) drawStanding(img, d.x, d.y + 6, 40);
                } else if (img) { ctx.globalAlpha = 0.5; drawStanding(img, d.x, d.y + 6, 36); ctx.globalAlpha = 1; }
            } });
        }
        for (const rm of ward.rooms) for (const d of rm.doors) if (d.barred && vis(d)) standing.push({ y: d.y + (d.h ? 120 : 20), draw: () => drawBars(d) });
        for (const e of enemies) if (vis(e)) standing.push({ y: e.y + e.r * 0.5, draw: () => drawEnemy(e) });
        standing.push({ y: sn.y, draw: drawSnake });
        standing.sort((a, b) => a.y - b.y);
        for (const s of standing) s.draw();

        // 4. what flies, burns and is said
        for (const b of bolts) {
            const img = im('fxBolt');
            glow(b.x, b.y, 30, '160,220,90', 0.45);
            if (img) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.drawImage(img, -52, -26, 72, 52); ctx.restore(); }
        }
        for (const s of shots) {
            const blade = s.kind === 'blade', img = im(blade ? 'fxBlade' : 'fxOrb');
            glow(s.x, s.y, s.r * 3, blade ? '255,80,50' : '170,120,255', 0.55);
            if (img) {
                const size = blade ? 92 : s.r * 9;
                ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(blade ? time * 9 : time * 2);
                if (!blade) ctx.globalCompositeOperation = 'lighter';
                ctx.drawImage(img, -size / 2, -size / 2, size, size);
                if (!blade) ctx.drawImage(img, -size / 2, -size / 2, size, size);      // twice: the orb was painted dim
                ctx.restore();
            } else { ctx.fillStyle = '#f0dcff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.55, 0, TAU); ctx.fill(); }
        }
        for (const r of rings) {
            if (r.delay > 0) continue;
            const a = 1 - r.r / r.max;
            ctx.strokeStyle = `rgba(255,150,80,${0.35 + a * 0.6})`; ctx.lineWidth = 9; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, r.gap + r.gapW / 2, r.gap - r.gapW / 2 + TAU); ctx.stroke();
            ctx.strokeStyle = `rgba(255,236,190,${0.4 + a * 0.5})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, r.gap + r.gapW / 2, r.gap - r.gapW / 2 + TAU); ctx.stroke();
            ctx.lineCap = 'butt';
        }
        if (quality > 0) for (const v of smokes) {
            if (!vis(v)) continue;
            const puff = im('smoke');
            for (let k = 0; k < 3; k++) {
                const t = time * 0.32 + v.seed + k * 2.07, ph = (t % 6.2) / 6.2, size = 120 + ph * 150;
                const x = v.x + Math.sin(t * 0.6 + k) * 28 + ph * 46, y = v.y - ph * 54 + Math.cos(t * 0.4) * 10;
                ctx.globalAlpha = 0.24 * (1 - ph) * Math.min(1, ph * 5);
                if (puff) ctx.drawImage(puff, x - size / 2, y - size / 2, size, size);
            }
            ctx.globalAlpha = 1;
        }
        for (const f of fx) {
            if (f.delay > 0) continue;
            const img = im(f.kind), t = 1 - f.life / f.maxLife, size = f.size0 + (f.size1 - f.size0) * t;
            const a = f.alpha * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
            ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.globalCompositeOperation = f.light ? 'lighter' : 'multiply';
            ctx.translate(f.x, f.y); ctx.rotate(f.rot);
            if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
            ctx.restore();
            if (f.light) light(f.x, f.y, size * 0.9, '255,230,170', Math.max(0, a) * 0.6);
        }
        let lastFont = null;
        ctx.textAlign = 'center';
        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color;
            if (p.text) { const f = p.font || '20px serif'; if (f !== lastFont) { ctx.font = f; lastFont = f; } ctx.fillText(p.text, p.x, p.y); }
            else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * ctx.globalAlpha, 0, TAU); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // 5. the dark, and what lifts it
        const amb = theme.ambient, lw = lightCanvas.width, lh = lightCanvas.height;
        lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
        // the dark is cold and the lights are warm: each ward's ambient is pulled toward blue-black
        lctx.fillStyle = `rgb(${Math.round(amb[0] * AMBIENT * 0.82)},${Math.round(amb[1] * AMBIENT * 0.9)},${Math.round(amb[2] * AMBIENT * 1.12)})`; lctx.fillRect(0, 0, lw, lh);
        lctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < lights.length; i += 5) {
            const r = lights[i + 2] * LS, x = (lights[i] - camX) * LS, y = (lights[i + 1] - camY) * LS;
            if (x + r < 0 || y + r < 0 || x - r > lw || y - r > lh) continue;
            lctx.globalAlpha = Math.max(0, Math.min(1, lights[i + 4]));
            lctx.drawImage(glowSprite(lights[i + 3], true), x - r, y - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lightCanvas, 0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.08; ctx.drawImage(lightCanvas, 0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

        // 6. words in the world, above the dark so they can be read
        ctx.save(); ctx.translate(-camX, -camY); ctx.textAlign = 'center';
        for (const l of labels) {
            const a = l.t < 8 ? l.t / 8 : Math.max(0, 1 - (l.t - 40) / 40);
            ctx.globalAlpha = Math.min(1, a); ctx.font = `600 ${l.size}px 'Cinzel', serif`;
            ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6; ctx.fillStyle = l.color; ctx.fillText(l.txt, l.x, l.y);
        }
        ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        // 7. the air, the edges of sight, the wound
        updateMotes(); drawMotes();
        ctx.drawImage(vignette, 0, 0);
        if (hurtFlash > 0) { ctx.fillStyle = `rgba(120,10,16,${(hurtFlash * 0.32).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
        if (hp < hpMax * 0.35 && !over) {
            const k = (1 - hp / (hpMax * 0.35)) * (0.3 + 0.12 * Math.sin(time * 4));
            const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
            g.addColorStop(0, 'rgba(110,0,10,0)'); g.addColorStop(1, `rgba(110,0,10,${k.toFixed(3)})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
        if (splash) {
            // a name across the screen: a guardian arriving, turning, ending
            const k = splash.t++ / splash.T;
            if (k >= 1) splash = null;
            else {
                const a = Math.min(1, k * 7) * Math.min(1, (1 - k) * 4), cy = H * 0.2, big = Math.round(Math.max(26, Math.min(62, W / 17)));
                ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const band = ctx.createLinearGradient(0, cy - big * 1.5, 0, cy + big * 1.9);
                band.addColorStop(0, 'rgba(4,2,5,0)'); band.addColorStop(0.5, 'rgba(4,2,5,0.72)'); band.addColorStop(1, 'rgba(4,2,5,0)');
                ctx.fillStyle = band; ctx.fillRect(0, cy - big * 1.5, W, big * 3.4);
                ctx.font = `600 ${big}px 'Cinzel', serif`; ctx.shadowColor = `rgba(${splash.color},0.55)`; ctx.shadowBlur = 24;
                ctx.fillStyle = `rgb(${splash.color})`; ctx.fillText(splash.title.split('').join('\u200A'), W / 2 + (1 - Math.min(1, k * 5)) * 30, cy);
                ctx.shadowBlur = 0; ctx.font = `italic ${Math.round(big * 0.36)}px 'Cormorant Garamond', Georgia, serif`; ctx.fillStyle = '#c9b58a';
                ctx.fillText(splash.sub, W / 2, cy + big * 0.86);
                const lw2 = Math.min(W * 0.36, 420) * Math.min(1, k * 5), lg = ctx.createLinearGradient(W / 2 - lw2, 0, W / 2 + lw2, 0);
                lg.addColorStop(0, `rgba(${splash.color},0)`); lg.addColorStop(0.5, `rgba(${splash.color},0.8)`); lg.addColorStop(1, `rgba(${splash.color},0)`);
                ctx.fillStyle = lg; ctx.fillRect(W / 2 - lw2, cy - big * 0.74, lw2 * 2, 1.5);
                ctx.restore();
            }
        }
        if (flash > 0) { ctx.fillStyle = `rgba(255,240,214,${flash.toFixed(3)})`; ctx.fillRect(0, 0, W, H); flash = Math.max(0, flash - 0.025); }
        drawSpeech();
        if (touchActive) {
            const jd = Math.min(Math.hypot(tcx - tsx, tcy - tsy), 45), jx = tsx + Math.cos(touchAngle) * jd, jy = tsy + Math.sin(touchAngle) * jd;
            ctx.strokeStyle = 'rgba(192,160,96,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tsx, tsy, 50, 0, TAU); ctx.stroke();
            ctx.fillStyle = 'rgba(192,160,96,0.35)'; ctx.beginPath(); ctx.arc(jx, jy, 18, 0, TAU); ctx.fill();
        }
        if (frames % 12 === 0 || paused) drawMinimap();
    }

    // ═══════════════════════════════════════════════════════════════════
    // THE END OF A DESCENT, AND THE START OF ONE
    // ═══════════════════════════════════════════════════════════════════
    function endRun(won) {
        if (over) return;
        over = true; save.run = null;
        const secs = Math.round(run.frames / 60), clock = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
        if (won) {
            const whole = run.pieces >= PIECES_TOTAL, all = save.memories.length >= MEMORIES.length;
            const v = !whole ? VICTORY.incomplete : all ? VICTORY.trueEnding : VICTORY.hollow;
            save.wins++; if (whole && all) save.trueEnding = true;
            text('victoryKicker', whole ? 'She is whole' : 'She is not whole'); text('victoryTitle', v.title);
            const vt = $('victoryText');
            if (vt) vt.innerHTML = v.text.replace('{missing}', String(MEMORIES.length - save.memories.length)).replace('{deaths}', String(Math.max(0, save.runs - 1))).replace('{greed}', String(run.shards)).replace('{pieces}', String(run.pieces));
            const ov = $('victoryOverlay'); if (ov) ov.classList.toggle('hollow', !(whole && all));
            soundtrack.sfxVictory(whole && all);
            show('victoryOverlay', true);
        } else {
            burst.blood(sn.x, sn.y); spawnParticles(sn.x, sn.y, 30, { color: '#4a2860', minSize: 3, maxSize: 9, speed: 3, lifetime: 70 });
            soundtrack.sfxDie(); later(() => soundtrack.sfxGameOver(), 700);
            text('deathQuote', pickQuote('death'));
            const ds = $('deathStats');
            if (ds) ds.innerHTML = `Fell in <span>${theme.title}</span> · <span>${clock}</span><br>Pieces of her <span>${run.pieces} / ${PIECES_TOTAL}</span> · Unmade <span>${run.kills}</span><br>Coils closed <span>${run.coils}</span> · Most in one coil <span>${run.bestCoil}</span> · Shards <span>${run.shards}</span>`;
            text('deathKept', save.memories.length ? `He keeps ${save.memories.length} of the nine Memories, and what they made of him. Everything else, the city takes back.` : 'He keeps nothing. Find the landmark in each ward: a Memory is the only thing the city cannot take back.');
            later(() => show('gameOverlay', true), 1100);
        }
        writeSave(save);
    }
    function begin() {
        session.started = true;
        const r = save.run;
        if (r) {
            run.ward = r.ward; run.seed = r.seed; run.boons = r.boons || {}; run.pieces = r.pieces || 0; run.shards = r.shards || 0;
            run.kills = r.kills || 0; run.coils = r.coils || 0; run.bestCoil = r.bestCoil || 0; run.frames = r.frames || 0; run.lastWord = !!r.lastWord;
            hpMax = r.hpMax || hpMax; hp = Math.max(1, Math.min(hpMax, r.hp || hpMax)); sn.len = Math.max(LEN_MIN, Math.min(LEN_MAX, r.len || sn.len));
        } else {
            save.runs++; writeSave(save);
            if (perk(5)) { const b = rollBoons(1)[0]; if (b) grant(b, true); }
        }
        const dw = parseInt(params.get('ward') || '', 10);
        if (DEBUG && dw >= 1 && dw <= WARDS.length) { run.ward = dw - 1; run.pieces = (dw - 1) * WARD_PIECES; sn.len = Math.max(sn.len, 24 + (dw - 1) * 14); }
        enterWard(Math.min(run.ward, WARDS.length - 1));
        later(() => { if (!fight) showQuote(!r && save.runs > 1 ? 'wake' : 'act', 5000); }, 6400);
        later(() => hint('move'), 1200);
    }

    // ═══ LOOP: fixed-step logic, free-running render ═══
    let raf = 0, lastTime = 0, acc = 0;
    const STEP = 1000 / 60, perf = { update: 0, render: 0 };
    function tick(ts) {
        raf = requestAnimationFrame(tick);
        if (!lastTime) { lastTime = ts; return; }
        const dt = Math.min(ts - lastTime, 100);
        acc += dt; lastTime = ts;
        frameMs += (dt - frameMs) * 0.05;
        if (frameMs > 26 && quality > 0) { quality--; frameMs = 16; resize(); }
        else if (frameMs < 15 && quality < 2 && ts > (tick.up || 0) + 8000) { quality++; tick.up = ts; resize(); }
        const t0 = performance.now();
        while (acc >= STEP) { update(); acc -= STEP; }
        const t1 = performance.now();
        render();
        perf.update += (t1 - t0 - perf.update) * 0.05; perf.render += (performance.now() - t1 - perf.render) * 0.05;
    }
    raf = requestAnimationFrame(tick);

    if (DEBUG) window.__nag = {
        state: () => ({ ward: run.ward, room: room && room.kind, roomState: room && room.state, fight: !!fight, hp, hpMax, len: sn.len, pieces: run.pieces, wardPieces: run.wardPieces, kills: run.kills, coils: run.coils, boons: run.boons, enemies: enemies.map(e => e.type + ':' + e.state + ':' + Math.round(e.hp)), spawns: spawns.length, over, modal, x: Math.round(sn.x), y: Math.round(sn.y), frameMs: +frameMs.toFixed(1), updateMs: +perf.update.toFixed(2), renderMs: +perf.render.toFixed(2), quality, canvas: [W, H] }),
        rooms: () => ward.rooms.map(r => ({ id: r.id, kind: r.kind, state: r.state, x: r.x, y: r.y, pieces: r.pieces })),
        tp: id => { const r = ward.rooms[id]; sn.x = r.x; sn.y = r.y + 30; trail.clear(); grace = 60; },
        kill: () => { for (const e of enemies.slice()) if (!e.dead) wound(e, 9999, 'venom'); },
        boon: id => grant(BOONS.find(b => b.id === id)),
        set: o => { if (o.hp) hp = o.hp; if (o.len) sn.len = o.len; if (o.god) grace = 1e9; refreshHUD(); },
        keys, sn, choose: pickChoice, closeChoice, closeMemory, mouse,
        step: n => { for (let i = 0; i < n; i++) update(); },
        fall: () => endRun(false),
        bossHit: frac => { if (boss && !boss.dying) wound(boss, boss.maxHp * frac / (boss.armor ? 0.35 : 2), 'venom'); },
        live: () => ({ ward, enemies, pickups, shrines, zones, rings, shots, fight, boss, modal, over, hp, hpMax, run }),
    };

    if (session.started) begin();      // waking after a fall: straight back into the Gardens

    function cleanup() {
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('mousemove', onMouseMove); canvas.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp); canvas.removeEventListener('contextmenu', noMenu);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        canvas.removeEventListener('touchcancel', onTouchEnd);
        if (biteBtn) { biteBtn.removeEventListener('touchstart', fireOn); biteBtn.removeEventListener('touchend', fireOff); biteBtn.removeEventListener('touchcancel', fireOff); }
        if (cardBox) cardBox.removeEventListener('click', onCard);
        if (raf) cancelAnimationFrame(raf);
        for (const t of timers) clearTimeout(t);
        clearInterval(ambient);
        const card = $('gs-act-card'); if (card) card.classList.remove('show');
        const h = $('gs-hint'); if (h) h.classList.remove('show');
        soundtrack.stop();
    }
    return {
        cleanup, begin, closeMemory, togglePause, shed: tryShed, openCodex, closeCodex, skipChoice: closeChoice,
        resetRun() {
            if (!confirm('Abandon this descent? The boons and the pieces you carry are lost. The Memories stay.')) return;
            save.run = null; writeSave(save);
            restart();
        },
    };
}
