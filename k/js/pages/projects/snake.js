import { useEffect, registerHandler } from '../../framework.js';
import createSoundtrack from './soundtrack.js';

let _cleanup = null;
let _loreShown = false;
const soundtrack = createSoundtrack();

export default function SnakePage() {
    registerHandler('restartGame', () => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        _cleanup = initGothicSnakeRPG();
    });

    registerHandler('toggleSound', () => {
        const playing = soundtrack.toggle();
        const btn = document.getElementById('gs-sound-toggle');
        if (btn) btn.textContent = playing ? '♫' : '♪';
        if (btn) btn.style.opacity = playing ? '1' : '0.5';
    });

    registerHandler('beginDescent', () => {
        _loreShown = true;
        const lore = document.getElementById('loreOverlay');
        if (lore) lore.style.display = 'none';
    });

    registerHandler('playAgainVictory', () => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        _cleanup = initGothicSnakeRPG();
    });

    useEffect(() => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        _cleanup = initGothicSnakeRPG();
    },[]);

    return `
    <div id="gs-root">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body, html { width: 100%; height: 100%; overflow: hidden; background-color: #0a0709; }
            
            #gs-ui {
                position: absolute; top: 0; left: 0; width: 100%;
                font-family: 'Cinzel', serif; color: #c0a060;
                z-index: 10; pointer-events: none;
                display: flex; align-items: center;
                padding: 12px 24px;
                background: linear-gradient(180deg, rgba(8,5,7,0.85) 0%, rgba(8,5,7,0.5) 70%, transparent 100%);
            }
            #gs-logo {
                width: 56px; height: auto;
                filter: drop-shadow(0 0 8px rgba(138,28,28,0.8));
                margin-right: 16px;
            }
            #gs-hud-stats {
                display: flex; flex-direction: column; gap: 4px; flex: 1;
            }
            #gs-score {
                font-size: 1rem; letter-spacing: 0.12em;
                color: #d4af37;
                text-shadow: 0 0 6px rgba(212,175,55,0.5);
                display: flex; flex-direction: column; gap: 2px;
            }
            #gs-lives {
                display: flex; gap: 4px;
            }
            .gs-heart {
                width: 18px; height: 18px;
                display: inline-block;
                background: radial-gradient(circle at 50% 40%, #c0282e, #6b0f0f);
                clip-path: path('M9 16.5C9 16.5 1.5 11 1.5 6.3C1.5 3.5 3.7 1.5 6 1.5C7.5 1.5 8.6 2.3 9 3C9.4 2.3 10.5 1.5 12 1.5C14.3 1.5 16.5 3.5 16.5 6.3C16.5 11 9 16.5 9 16.5Z');
                filter: drop-shadow(0 0 4px rgba(180,30,30,0.7));
            }
            .gs-heart.empty {
                background: radial-gradient(circle at 50% 40%, #2a1a1a, #110a0a);
                filter: none; opacity: 0.4;
            }

            #gs-quote {
                position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%);
                font-family: 'Cinzel', serif; color: #c0a060;
                font-size: 1.1rem; font-style: italic; text-align: center;
                max-width: 600px; padding: 12px 24px;
                background: linear-gradient(90deg, transparent, rgba(10,7,9,0.7) 15%, rgba(10,7,9,0.7) 85%, transparent);
                border-top: 1px solid rgba(138,28,28,0.3); border-bottom: 1px solid rgba(138,28,28,0.3);
                z-index: 15; pointer-events: none;
                opacity: 0; transition: opacity 1s ease;
                text-shadow: 0 0 12px rgba(0,0,0,0.9), 0 0 4px rgba(192,160,96,0.3);
                letter-spacing: 0.05em;
            }
            #gs-quote.visible { opacity: 1; }
            #gs-quote.fading { opacity: 0; }

            #gameOverlay .death-quote {
                font-size: 1.2rem; color: #c0a060; font-style: italic;
                max-width: 500px; text-align: center; margin-bottom: 25px;
                text-shadow: 0 0 10px rgba(192,160,96,0.4);
                letter-spacing: 0.04em;
            }
            
            #gameOverlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(10, 7, 9, 0.8); display: none;
                flex-direction: column; justify-content: center; align-items: center;
                z-index: 20; font-family: 'Cinzel', serif; color: #8a1c1c;
            }
            #gameOverlay h1 { font-size: 4rem; margin-bottom: 20px; text-shadow: 0 0 20px red; }
            #gameOverlay button {
                padding: 10px 30px; font-size: 1.5rem; background: #120d10; color: #c0a060;
                border: 1px solid #c0a060; cursor: pointer; font-family: 'Cinzel', serif;
                transition: 0.3s;
            }
            #gameOverlay button:hover { background: #c0a060; color: #120d10; }

            canvas { display: block; }

            #gs-sound-toggle {
                position: absolute; top: 20px; right: 24px;
                z-index: 15; pointer-events: all; cursor: pointer;
                width: 36px; height: 36px;
                background: rgba(0,0,0,0.5); border: 1px solid #3a2860;
                border-radius: 4px; color: #c0a060;
                font-size: 1.2rem; display: flex; align-items: center; justify-content: center;
                font-family: 'Cinzel', serif;
                transition: background 0.3s, border-color 0.3s;
            }
            #gs-sound-toggle:hover { background: rgba(60,40,96,0.4); border-color: #c0a060; }

            .gs-counter { display: block; font-size: 0.85rem; letter-spacing: 0.08em; color: #d4af37; }
            .gs-counter .gs-val { color: #ffdf73; font-weight: 700; }
            .gs-counter.soul { color: #b48ede; }
            .gs-counter.soul .gs-val { color: #d4a5ff; }

            #loreOverlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(6, 3, 5, 0.95);
                display: none; flex-direction: column; justify-content: center; align-items: center;
                z-index: 30; font-family: 'Cinzel', serif; color: #c0a060;
                padding: 40px; text-align: center; overflow-y: auto;
            }
            #loreOverlay h1 {
                font-size: 3rem; letter-spacing: 0.15em; color: #8a1c1c;
                text-shadow: 0 0 30px rgba(138,28,28,0.6); margin-bottom: 4px;
            }
            #loreOverlay h2 {
                font-size: 1.3rem; letter-spacing: 0.2em; color: #c0a060;
                margin-bottom: 30px; font-weight: 400;
            }
            #loreOverlay .lore-text {
                max-width: 600px; font-size: 0.95rem; line-height: 1.7;
                color: #a08850; margin-bottom: 24px;
                text-shadow: 0 0 6px rgba(0,0,0,0.8);
            }
            #loreOverlay .lore-objectives {
                max-width: 500px; text-align: left; margin-bottom: 24px;
                border: 1px solid rgba(138,28,28,0.3); padding: 16px 24px;
                background: rgba(10,7,9,0.6);
            }
            #loreOverlay .lore-objectives h3 {
                font-size: 0.9rem; color: #8a1c1c; margin-bottom: 10px; letter-spacing: 0.1em;
            }
            #loreOverlay .lore-objectives li {
                list-style: none; padding: 4px 0; font-size: 0.85rem; color: #a08850;
            }
            #loreOverlay .lore-objectives li::before { content: '◈ '; color: #d4af37; }
            #loreOverlay .lore-objectives li.soul::before { content: '◈ '; color: #b48ede; }
            #loreOverlay .lore-controls {
                font-size: 0.8rem; color: #665533; margin-bottom: 30px; letter-spacing: 0.05em;
            }
            #loreOverlay button {
                padding: 12px 40px; font-size: 1.3rem; background: #120d10; color: #c0a060;
                border: 1px solid #8a1c1c; cursor: pointer; font-family: 'Cinzel', serif;
                transition: 0.3s; letter-spacing: 0.1em;
            }
            #loreOverlay button:hover { background: #8a1c1c; color: #f0d890; }

            #victoryOverlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(6, 3, 5, 0.92);
                display: none; flex-direction: column; justify-content: center; align-items: center;
                z-index: 25; font-family: 'Cinzel', serif; color: #d4af37;
                padding: 40px; text-align: center;
            }
            #victoryOverlay h1 {
                font-size: 3.5rem; color: #d4af37;
                text-shadow: 0 0 40px rgba(212,175,55,0.6), 0 0 80px rgba(212,175,55,0.3);
                margin-bottom: 20px;
            }
            #victoryOverlay .victory-text {
                max-width: 550px; font-size: 1.1rem; line-height: 1.8;
                color: #c0a060; margin-bottom: 30px;
            }
            #victoryOverlay button {
                padding: 12px 40px; font-size: 1.3rem; background: #120d10; color: #d4af37;
                border: 1px solid #d4af37; cursor: pointer; font-family: 'Cinzel', serif;
                transition: 0.3s;
            }
            #victoryOverlay button:hover { background: #d4af37; color: #120d10; }
        </style>

        <div id="gs-ui">
            <img id="gs-logo" src="js/pages/projects/logo.png" alt="Nagmani" />
            <div id="gs-hud-stats">
                <div id="gs-score">
                    <span class="gs-counter">Naagmani: <span class="gs-val" id="scoreVal">0</span> / 1000</span>
                    <span class="gs-counter soul">Soul Shards: <span class="gs-val" id="soulVal">0</span> / 100</span>
                </div>
                <div id="gs-lives">
                    <span class="gs-heart"></span>
                    <span class="gs-heart"></span>
                    <span class="gs-heart"></span>
                </div>
            </div>
        </div>

        <div id="gs-quote"></div>

        <div id="loreOverlay">
            <h1>PATALA'S DESCENT</h1>
            <h2>The Naga's Requiem</h2>
            <p class="lore-text">
                You are <strong>Naagraj</strong> \u2014 the Serpent King of Patala, the sunken underworld.
                An age ago, the Brass King Kalash invaded your sanctuary, shattered the sacred Nagmani,
                and scattered the soul of your beloved wife <strong>Amrita</strong> into the void.
                Now you slither through the ruins of your own kingdom, gathering what was lost.
            </p>
            <div class="lore-objectives">
                <h3>YOUR QUEST</h3>
                <ul>
                    <li>Collect <strong>1,000 Naagmani Shards</strong> to restore the sacred gem</li>
                    <li class="soul">Gather <strong>100 Soul Shards</strong> to channel Amrita's spirit</li>
                    <li>Soul Shards can <strong>revive you</strong> when death comes (10 shards per revival)</li>
                    <li>Fulfill both tasks to <strong>revive Amrita</strong> from the eternal dark</li>
                </ul>
            </div>
            <p class="lore-controls">WASD or Arrow Keys to move \u00B7 Beware the fog and the Brass King's soldiers</p>
            <button data-action="beginDescent">Begin Descent</button>
        </div>

        <div id="victoryOverlay">
            <h1>AMRITA REBORN</h1>
            <p class="victory-text">
                The Nagmani pulses with golden fire. A thousand shards reunited, a hundred soul fragments
                woven back into light. The void trembles and parts \u2014 and from the silence,
                she steps forward. Amrita. Your lotus. Your eternity.<br><br>
                The Serpent King's requiem is over. Patala breathes again.
            </p>
            <button data-action="playAgainVictory">Descend Once More</button>
        </div>

        <div id="gameOverlay">
            <h1>Consumed By The Void</h1>
            <p class="death-quote" id="deathQuote"></p>
            <button data-action="restartGame">Awaken Again</button>
        </div>

       <button id="gs-sound-toggle" data-action="toggleSound" title="Toggle Music">♫</button>
       <canvas id="gameCanvas"></canvas>
    </div>
    `;
}

function initGothicSnakeRPG() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreUI = document.getElementById('scoreVal');
    const soulUI = document.getElementById('soulVal');
    const overlay = document.getElementById('gameOverlay');
    overlay.style.display = 'none';
    scoreUI.innerText = '0';
    if (soulUI) soulUI.innerText = '0';
    const victoryOvl = document.getElementById('victoryOverlay');
    if (victoryOvl) victoryOvl.style.display = 'none';
    const loreOvl = document.getElementById('loreOverlay');
    if (loreOvl && !_loreShown) loreOvl.style.display = 'flex';
    else if (loreOvl) loreOvl.style.display = 'none';
    const livesUI = document.getElementById('gs-lives');
    if (livesUI) {
        livesUI.innerHTML = '<span class="gs-heart"></span><span class="gs-heart"></span><span class="gs-heart"></span>';
    }

    let W, H;
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        W = canvas.width; H = canvas.height;
        if (fogCanvas) buildFog();
    }
    window.addEventListener('resize', resize);

    // Fog-of-war parameters
    const FOG_INNER = 200;  // fully clear radius around head
    const FOG_OUTER = 500;  // fully dark beyond this radius

    // Pre-bake fog vignette into an offscreen canvas (rebuilt on resize)
    const fogCanvas = document.createElement('canvas');
    const fogCtx = fogCanvas.getContext('2d');
    function buildFog() {
        fogCanvas.width = W;
        fogCanvas.height = H;
        const g = fogCtx.createRadialGradient(
            W / 2, H / 2, FOG_INNER,
            W / 2, H / 2, FOG_OUTER
        );
        g.addColorStop(0, 'rgba(8, 5, 7, 0)');
        g.addColorStop(0.6, 'rgba(8, 5, 7, 0.55)');
        g.addColorStop(1, 'rgba(8, 5, 7, 0.92)');
        fogCtx.fillStyle = g;
        fogCtx.fillRect(0, 0, W, H);
    }

    // Now safe to call resize (fog vars are initialized)
    resize();

    // Floor tile pattern
    const floorImg = new Image();
    floorImg.src = 'js/pages/projects/floor-tile.png';
    let floorPattern = null;
    floorImg.onload = () => {
        floorPattern = ctx.createPattern(floorImg, 'repeat');
    };

    // Sprite assets
    const assets = {
        pillar:  new Image(),
        bell:    new Image(),
        shrine:  new Image(),
        shrine2: new Image(),
        food:    new Image(),
        enemy:   new Image(),
        tree1:   new Image(),
        tree2:   new Image(),
        tree3:   new Image(),
        fog:     new Image(),
        snakeHead: new Image(),
        snakeBody: new Image(),
        snakeTail: new Image(),
    };
    const ASSET_BASE = 'js/pages/projects/';
    assets.pillar.src    = ASSET_BASE + 'pillar.png';
    assets.bell.src      = ASSET_BASE + 'bell.png';
    assets.shrine.src    = ASSET_BASE + 'shrine.png';
    assets.shrine2.src   = ASSET_BASE + 'shrine_2.png';
    assets.food.src      = ASSET_BASE + 'food.png';
    assets.enemy.src     = ASSET_BASE + 'enemy.png';
    assets.tree1.src     = ASSET_BASE + 'tree1.png';
    assets.tree2.src     = ASSET_BASE + 'tree2.png';
    assets.tree3.src     = ASSET_BASE + 'tree3.png';
    assets.fog.src       = ASSET_BASE + 'fog.png';
    assets.snakeHead.src = ASSET_BASE + 'snake_head.png';
    assets.snakeBody.src = ASSET_BASE + 'snake_body.png';
    assets.snakeTail.src = ASSET_BASE + 'snake_tail.png';
    assets.soulShard = new Image();
    assets.soulShard.src = ASSET_BASE + 'soul_shard.png';

    // Once fog texture loads, composite it into the pre-baked vignette
    assets.fog.onload = () => {
        const fogPat = fogCtx.createPattern(assets.fog, 'repeat');
        fogCtx.globalAlpha = 0.15;
        fogCtx.globalCompositeOperation = 'lighter';
        fogCtx.fillStyle = fogPat;
        fogCtx.fillRect(0, 0, W, H);
        fogCtx.globalAlpha = 1;
        fogCtx.globalCompositeOperation = 'source-over';
    };

    // ═══════════════════════════════════════════════════════════════════
    // DIALOGUE / QUOTE SYSTEM
    // ═══════════════════════════════════════════════════════════════════
    const QUOTES = {
        ambient: [
            "The stone is cold. I cannot feel your warmth anymore.",
            "Patala is silent, save for the echo of my own scales.",
            "I will find every piece of you, Amrita. Even if it takes eternity.",
            "The diyas have all burnt out. Only the dark remains.",
            "They broke the seal. They brought mortal rot into our sanctuary.",
            "Where did they scatter your soul, my lotus?",
            "The banyan roots drink from a dry, dead earth.",
            "I slept while they took everything from me. Forgive me.",
            "A shattered Nagmani... a shattered heart.",
            "Even the gods have abandoned this sunken temple.",
            "The Asuras watch me from the fog. They know my burden.",
            "The Nagmani pulses like a dying heartbeat in the abyss.",
            "The dark is closing in, but your golden light guides my fangs.",
        ],
        eat: [
            "Each memory of you I consume makes me heavier.",
            "My body stretches into the dark. I am becoming a prisoner of my own sorrow.",
            "Another shard. Another echo of your laugh in my mind.",
            "The Prana burns going down, but it is all I have left of you.",
            "I am growing too large for these cursed halls.",
            "I drag my past behind me like a chain of black iron.",
            "How can a soul made of light weigh so much?",
            "Your essence binds my flesh, elongating my suffering.",
            "To remember you is a burden I gladly bear, no matter the agony.",
            "I coil endlessly around the empty spaces where you used to walk.",
            "Just one more shard... just one more memory...",
        ],
        enemy: [
            "The ghosts of the Brass King still wander my halls.",
            "Tarnished armor. Hollow souls. I will crush them all.",
            "Maharaja Kalash sought immortality. Now his men are dust in the wind.",
            "They guard the ruins of the paradise they destroyed.",
            "Their red eyes mock my failure from the fog.",
            "A fallen bronze bell... it no longer sings for the gods. Only for the dead.",
            "Do not block my path, shadow. You have already taken enough.",
            "They smell of old blood, rusted greed, and burnt offerings.",
            "Even in death, the King's men cannot escape Patala's judgment.",
            "I will not let their corrupted ash touch your pure light.",
        ],
        spirit: [
            "The innocent souls flee from me... Have I become a monster?",
            "Do not run, little spirit. I only need your spark.",
            "I must consume them to sustain my hunt. Forgive my hunger.",
            "They weep as they run, just as you wept when the blade fell.",
            "Their fear is a bitter nectar, but it fuels my descent.",
            "I am the lord of this underworld! Why do you hide?",
            "Come back into the dark. Give me her memory.",
            "A fleeting wisp of life in a graveyard of stone.",
            "Am I the villain of their story now? So be it, if it brings you back.",
            "Rest now in my coils, wandering soul. Your terror is over.",
        ],
        growth: [
            "There is so much of you to carry. I am suffocating in our past.",
            "I am an endless labyrinth of flesh and grief.",
            "It is so hard to turn, so hard to move. I am trapped by my own immense size.",
            "Amrita... are you watching me become this abomination?",
            "I cannot even see my own tail. I am an ouroboros of despair.",
            "If I must swallow the entire underworld to find you, I will.",
        ],
        death: [
            "Consumed by the Void. You collapsed under the weight of your own sorrow.",
            "The coils tightened. The memories suffocated you.",
            "Amrita, I have failed. The dark reclaims us both.",
            "A serpent choked by its own endless tail.",
            "Your grief was too great a labyrinth to escape.",
        ],
    };

    const quoteEl = document.getElementById('gs-quote');
    const deathQuoteEl = document.getElementById('deathQuote');
    let quoteTimer = null;
    let lastQuoteIdx = {};

    function pickQuote(category) {
        const arr = QUOTES[category];
        if (!arr || arr.length === 0) return '';
        let idx;
        do { idx = Math.floor(Math.random() * arr.length); }
        while (idx === lastQuoteIdx[category] && arr.length > 1);
        lastQuoteIdx[category] = idx;
        return arr[idx];
    }

    function showQuote(category, duration) {
        duration = duration || 4500;
        const text = pickQuote(category);
        if (!text || !quoteEl) return;
        quoteEl.textContent = '\u201C' + text + '\u201D';
        quoteEl.className = 'visible';
        if (quoteTimer) clearTimeout(quoteTimer);
        quoteTimer = setTimeout(() => {
            quoteEl.className = 'fading';
        }, duration);
    }

    // Show ambient quotes periodically (every 15-25 seconds)
    let ambientInterval = null;
    function startAmbientQuotes() {
        setTimeout(() => showQuote('ambient', 5000), 3000);
        ambientInterval = setInterval(() => {
            if (isDead) return;
            const roll = Math.random();
            if (roll < 0.5) showQuote('ambient', 5000);
            else if (roll < 0.7) showQuote('spirit', 5000);
            else if (roll < 0.85) showQuote('enemy', 5000);
            else showQuote('growth', 5000);
        }, 15000 + Math.random() * 10000);
    }
    startAmbientQuotes();

    let foodEatenSinceLastGrowthQuote = 0;

    const CW = 800;          // Chunk width/height in pixels
    const SS = 30;           // Snake segment size
    const SG = 8;            // Spacing gap in history array
    const SPEED = 4.5;       // Movement speed
    const TURN_SPEED = 0.08; // How fast the snake turns

    let isDead = false;
    let score = 0;
    let soulShards = 0;
    let lives = 3;
    const NAAGMANI_GOAL = 1000;
    const SOUL_SHARD_GOAL = 100;
    
    // Snake Entity
    const sn = { 
        x: 0, y: 0, 
        angle: 0,       // Current direction
        targetAngle: 0, // Where the player wants to go
        len: 10,        // Starting length
    };
    let trail =[];     // Position history

    // Input State
    const keys = { w: false, a: false, s: false, d: false };

    // ═══════════════════════════════════════════════════════════════════
    // PARTICLE SYSTEM
    // ═══════════════════════════════════════════════════════════════════
    const particles = [];

    function spawnParticles(x, y, count, opts = {}) {
        const {
            color = '#ffdf73',
            minSize = 2, maxSize = 6,
            speed = 2, lifetime = 60,
            spread = Math.PI * 2,
            baseAngle = -Math.PI / 2,
            gravity = 0,
            fadeOut = true,
            text = null,
            font = null
        } = opts;
        for (let i = 0; i < count; i++) {
            const angle = baseAngle - spread / 2 + Math.random() * spread;
            const spd = (0.5 + Math.random()) * speed;
            particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                size: minSize + Math.random() * (maxSize - minSize),
                life: lifetime + Math.random() * 20,
                maxLife: lifetime + 20,
                color,
                gravity,
                fadeOut,
                text: text ? text[Math.floor(Math.random() * text.length)] : null,
                font: font || null
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function renderParticles(ctx) {
        for (const p of particles) {
            const alpha = p.fadeOut ? Math.max(0, p.life / p.maxLife) : 1;
            ctx.globalAlpha = alpha;
            if (p.text) {
                ctx.font = p.font || `${Math.round(p.size)}px serif`;
                ctx.fillStyle = p.color;
                ctx.fillText(p.text, p.x, p.y);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    // Sanskrit rune characters for food-eat effect
    const SANSKRIT_RUNES = ['ॐ', 'अ', 'श', 'र', 'न', 'म', 'ह', 'क', 'त', 'स', 'द', 'व'];

    function emitSanskritRunes(x, y) {
        spawnParticles(x, y, 5, {
            color: '#d4af37',
            text: SANSKRIT_RUNES,
            font: 'bold 22px serif',
            minSize: 22, maxSize: 28,
            speed: 1.5,
            lifetime: 80,
            spread: Math.PI * 1.2,
            baseAngle: -Math.PI / 2,
            gravity: -0.02,
            fadeOut: true
        });
        // Also emit golden sparkle particles
        spawnParticles(x, y, 12, {
            color: '#ffdf73',
            minSize: 1, maxSize: 4,
            speed: 3,
            lifetime: 40,
            spread: Math.PI * 2,
            gravity: 0.02,
            fadeOut: true
        });
    }

    function emitSoulShardParticles(x, y) {
        spawnParticles(x, y, 5, {
            color: '#b48ede',
            text: ['\u2726', '\u25C8', '\u27E1', '\u25C7', '\u263D'],
            font: 'bold 20px serif',
            minSize: 20, maxSize: 26,
            speed: 1.5,
            lifetime: 70,
            spread: Math.PI * 1.2,
            baseAngle: -Math.PI / 2,
            gravity: -0.02,
            fadeOut: true
        });
        spawnParticles(x, y, 10, {
            color: '#d4a5ff',
            minSize: 1, maxSize: 4,
            speed: 2.5,
            lifetime: 35,
            spread: Math.PI * 2,
            gravity: 0.01,
            fadeOut: true
        });
    }

    function emitDeathParticles(x, y) {
        spawnParticles(x, y, 30, {
            color: '#8a1c1c',
            minSize: 2, maxSize: 8,
            speed: 4,
            lifetime: 50,
            spread: Math.PI * 2,
            gravity: 0.05,
            fadeOut: true
        });
        spawnParticles(x, y, 8, {
            color: '#4a2860',
            minSize: 3, maxSize: 10,
            speed: 2,
            lifetime: 70,
            spread: Math.PI * 2,
            gravity: 0,
            fadeOut: true
        });
    }


    const world = {};

    function getChunkKey(cx, cy) { return `${cx},${cy}`; }

    function genChunk(cx, cy) {
        const key = getChunkKey(cx, cy);
        if (world[key]) return; // Already generated

        const chunk = {
            ox: cx * CW, oy: cy * CW,
            floor:[], obs: [], food: [], enemies:[], soulShards: [],
            shrines: [], bells: [], walls: [], trees: []
        };

        // ── Placement system: collect all placed objects with radii ──
        const placed = []; // { x, y, r } - all items placed so far in this chunk

        function overlaps(x, y, r, margin) {
            margin = margin || 10;
            for (const p of placed) {
                const dist = Math.hypot(x - p.x, y - p.y);
                if (dist < r + p.r + margin) return true;
            }
            return false;
        }

        function tryPlace(r, margin, maxAttempts) {
            margin = margin || 10;
            maxAttempts = maxAttempts || 30;
            for (let a = 0; a < maxAttempts; a++) {
                const x = chunk.ox + r + margin + Math.random() * (CW - 2 * (r + margin));
                const y = chunk.oy + r + margin + Math.random() * (CW - 2 * (r + margin));
                if (!overlaps(x, y, r, margin)) return { x, y };
            }
            return null; // couldn't find a valid spot
        }

        // Generate Floor Pattern (Dark stone tiles)
        for (let i = 0; i < 5; i++) {
            chunk.floor.push({
                x: chunk.ox + Math.random() * CW,
                y: chunk.oy + Math.random() * CW,
                r: 50 + Math.random() * 150,
                c: Math.random() > 0.5 ? '#110c10' : '#171115'
            });
        }

        const isCenter = (cx === 0 && cy === 0);

        if (!isCenter) {
            // 1. Place Shrines first (largest footprint, 0-1 per chunk)
            if (Math.random() > 0.6) {
                const pos = tryPlace(80, 40, 20);
                if (pos) {
                    const variant = Math.random() > 0.5 ? 2 : 1;
                    chunk.shrines.push({ x: pos.x, y: pos.y, r: 60, variant });
                    chunk.obs.push({ x: pos.x, y: pos.y, r: 60 });
                    placed.push({ x: pos.x, y: pos.y, r: 80 });

                    // Bells flanking the shrine (1-2 bells nearby)
                    const numBells = 1 + Math.floor(Math.random() * 2);
                    for (let b = 0; b < numBells; b++) {
                        const angle = (b / numBells) * Math.PI * 2 + Math.random() * 0.5;
                        const dist = 90 + Math.random() * 30;
                        const bx = pos.x + Math.cos(angle) * dist;
                        const by = pos.y + Math.sin(angle) * dist;
                        chunk.bells.push({ x: bx, y: by, r: 20 });
                        chunk.obs.push({ x: bx, y: by, r: 20 });
                        placed.push({ x: bx, y: by, r: 25 });
                    }
                }
            }

            // 2. Place Pillar walls (groups of 3-6)
            if (Math.random() > 0.5) {
                const wallLen = 3 + Math.floor(Math.random() * 4);
                const horizontal = Math.random() > 0.5;
                const spacing = 55;
                const wallExtent = wallLen * spacing;
                // Find start position for the wall
                let wallPlaced = false;
                for (let attempt = 0; attempt < 20; attempt++) {
                    const wx = chunk.ox + 80 + Math.random() * (CW - 160 - (horizontal ? wallExtent : 0));
                    const wy = chunk.oy + 80 + Math.random() * (CW - 160 - (horizontal ? 0 : wallExtent));
                    // Check if all pillar positions are free
                    let allClear = true;
                    const pillars = [];
                    for (let p = 0; p < wallLen; p++) {
                        const px = horizontal ? wx + p * spacing : wx;
                        const py = horizontal ? wy : wy + p * spacing;
                        if (overlaps(px, py, 25, 15)) { allClear = false; break; }
                        pillars.push({ x: px, y: py });
                    }
                    if (allClear) {
                        const wall = [];
                        for (const pillar of pillars) {
                            wall.push({ x: pillar.x, y: pillar.y, r: 25 });
                            chunk.obs.push({ x: pillar.x, y: pillar.y, r: 25 });
                            placed.push({ x: pillar.x, y: pillar.y, r: 30 });
                        }
                        chunk.walls.push(wall);
                        wallPlaced = true;
                        break;
                    }
                }
            }

            // 3. Place standalone pillars (0-2)
            const numObs = Math.floor(Math.random() * 3);
            for (let i = 0; i < numObs; i++) {
                const pos = tryPlace(25, 15, 20);
                if (pos) {
                    chunk.obs.push({ x: pos.x, y: pos.y, r: 25 });
                    placed.push({ x: pos.x, y: pos.y, r: 30 });
                }
            }
        }

        // 4. Place Trees (decorative, no collision, but avoid overlapping with obstacles)
        const numTrees = Math.floor(Math.random() * 4) + 1;
        for (let i = 0; i < numTrees; i++) {
            const variant = Math.floor(Math.random() * 3) + 1;
            const treeR = 50; // visual footprint consideration
            const pos = tryPlace(treeR, 20, 15);
            if (pos) {
                chunk.trees.push({
                    x: pos.x, y: pos.y,
                    size: 180 + Math.random() * 60,
                    variant
                });
                placed.push({ x: pos.x, y: pos.y, r: treeR });
            }
        }

        // 5. Place Food – keep away from obstacles but can be near trees
        const numFood = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numFood; i++) {
            const pos = tryPlace(10, 20, 20);
            if (pos) {
                chunk.food.push({
                    x: pos.x, y: pos.y,
                    r: 10, offset: Math.random() * 100
                });
                // Don't add to placed – food gets eaten & shouldn't block other food
            }
        }

        // 5b. Place Soul Shards (rare — ~20% chance, 1 per chunk)
        if (Math.random() > 0.8) {
            const pos = tryPlace(12, 20, 20);
            if (pos) {
                chunk.soulShards.push({
                    x: pos.x, y: pos.y,
                    r: 12, offset: Math.random() * 100
                });
            }
        }

        // 6. Place Enemies
        if (!isCenter && Math.random() > 0.4) {
            const pos = tryPlace(20, 30, 15);
            if (pos) {
                chunk.enemies.push({
                    x: pos.x, y: pos.y,
                    r: 20, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2
                });
            }
        }

        world[key] = chunk;
    }

    // ═══════════════════════════════════════════════════════════════════
    // INPUT HANDLING
    // ═══════════════════════════════════════════════════════════════════
    function handleKey(e, state) {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'arrowup') keys.w = state;
        if (k === 's' || k === 'arrowdown') keys.s = state;
        if (k === 'a' || k === 'arrowleft') keys.a = state;
        if (k === 'd' || k === 'arrowright') keys.d = state;
    }
    // Start music on first keypress (browser autoplay policy)
    let musicStarted = false;
    function onFirstKey(e) {
        if (!_loreShown) return;
        if (!musicStarted && (e.key === 'w' || e.key === 'a' || e.key === 's' || e.key === 'd'
            || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            musicStarted = true;
            if (!soundtrack.isPlaying()) soundtrack.start();
            soundtrack.sfxGameStart();
        }
    }
    window.addEventListener('keydown', e => { onFirstKey(e); handleKey(e, true); });
    window.addEventListener('keyup', e => handleKey(e, false));

    function die() {
        emitDeathParticles(sn.x, sn.y);
        soundtrack.sfxDie();
        lives--;
        updateLivesUI();
        if (lives <= 0) {
            // Try soul shard revive (costs 10 shards)
            if (soulShards >= 10) {
                soulShards -= 10;
                if (soulUI) soulUI.innerText = soulShards;
                lives = 1;
                updateLivesUI();
                showQuote('death', 3000);
                soundtrack.sfxRespawn();
                sn.x = 0; sn.y = 0;
                sn.angle = 0; sn.targetAngle = 0;
                sn.len = 10;
                trail = [];
            } else {
                isDead = true;
                soundtrack.sfxGameOver();
                if (deathQuoteEl) deathQuoteEl.textContent = '\u201C' + pickQuote('death') + '\u201D';
                overlay.style.display = 'flex';
                if (quoteEl) quoteEl.className = 'fading';
            }
        } else {
            showQuote('death', 3000);
            soundtrack.sfxRespawn();
            // Respawn: reset snake position & trail, keep score
            sn.x = 0; sn.y = 0;
            sn.angle = 0; sn.targetAngle = 0;
            sn.len = 10;
            trail = [];
        }
    }

    function updateLivesUI() {
        const livesEl = document.getElementById('gs-lives');
        if (livesEl) {
            let html = '';
            for (let i = 0; i < 3; i++) {
                html += `<span class="gs-heart${i < lives ? '' : ' empty'}"></span>`;
            }
            livesEl.innerHTML = html;
        }
    }

    function checkWinCondition() {
        if (score >= NAAGMANI_GOAL && soulShards >= SOUL_SHARD_GOAL) {
            isDead = true;
            soundtrack.sfxGameStart();
            if (victoryOvl) victoryOvl.style.display = 'flex';
            if (quoteEl) quoteEl.className = 'fading';
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // UPDATE LOOP
    // ═══════════════════════════════════════════════════════════════════
    let raf;
    let time = 0;

    function update() {
        if (isDead) return;
        if (!_loreShown) return;
        time += 0.05;

        // Steer the snake
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;

        if (dx !== 0 || dy !== 0) {
            sn.targetAngle = Math.atan2(dy, dx);
        }

        // Smooth angle interpolation (handles the -PI to PI wrap around)
        let diff = sn.targetAngle - sn.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        sn.angle += diff * TURN_SPEED;

        // Move head continuously
        sn.x += Math.cos(sn.angle) * SPEED;
        sn.y += Math.sin(sn.angle) * SPEED;

        // Record history for body parts
        trail.unshift({ x: sn.x, y: sn.y, a: sn.angle });
        const maxHistory = sn.len * SG + 1;
        if (trail.length > maxHistory) trail.length = maxHistory;

        // Determine current chunks (Load 3x3 grid around player)
        const cx = Math.floor(sn.x / CW);
        const cy = Math.floor(sn.y / CW);
        for(let i = cx-1; i <= cx+1; i++) {
            for(let j = cy-1; j <= cy+1; j++) {
                genChunk(i, j);
            }
        }

        // Interaction & Collisions
        for(let i = cx-1; i <= cx+1; i++) {
            for(let j = cy-1; j <= cy+1; j++) {
                const chunk = world[getChunkKey(i, j)];
                if (!chunk) continue;

                // Eat Food
                for (let f = chunk.food.length - 1; f >= 0; f--) {
                    let food = chunk.food[f];
                    let dist = Math.hypot(sn.x - food.x, sn.y - food.y);
                    if (dist < SS + food.r) {
                        emitSanskritRunes(food.x, food.y);
                        soundtrack.sfxEat();
                        chunk.food.splice(f, 1); // Remove eaten food
                        sn.len += 3;             // Grow
                        score++;
                        scoreUI.innerText = score;
                        checkWinCondition();
                        // Show eat quote (~40% chance)
                        foodEatenSinceLastGrowthQuote++;
                        if (Math.random() < 0.4) showQuote('eat', 3500);
                        // Growth quotes at milestones
                        if (foodEatenSinceLastGrowthQuote >= 8) {
                            foodEatenSinceLastGrowthQuote = 0;
                            showQuote('growth', 5000);
                        }
                    }
                }

                // Collect Soul Shards
                for (let s = chunk.soulShards.length - 1; s >= 0; s--) {
                    let shard = chunk.soulShards[s];
                    let dist = Math.hypot(sn.x - shard.x, sn.y - shard.y);
                    if (dist < SS + shard.r) {
                        emitSoulShardParticles(shard.x, shard.y);
                        soundtrack.sfxEat();
                        chunk.soulShards.splice(s, 1);
                        if (soulShards < SOUL_SHARD_GOAL) soulShards++;
                        if (soulUI) soulUI.innerText = soulShards;
                        if (Math.random() < 0.6) showQuote('spirit', 3500);
                        checkWinCondition();
                    }
                }

                // Hit Obstacles
                for (let o of chunk.obs) {
                    let dist = Math.hypot(sn.x - o.x, sn.y - o.y);
                    if (dist < (SS/2) + o.r) die();
                }

                // Update & Hit Enemies
                for (let e of chunk.enemies) {
                    e.x += e.vx; e.y += e.vy;
                    let dist = Math.hypot(sn.x - e.x, sn.y - e.y);
                    if (dist < (SS/2) + e.r) die();
                }
            }
        }

        // Self Collision (Don't check the immediate head area)
        for (let i = SG * 5; i < trail.length; i += SG) {
            let p = trail[i];
            let dist = Math.hypot(sn.x - p.x, sn.y - p.y);
            if (dist < SS * 0.8) die();
        }

        // Update particles
        updateParticles();
    }

    // ═══════════════════════════════════════════════════════════════════
    // RENDER LOOP
    // ═══════════════════════════════════════════════════════════════════
    function render() {
        // Clear background with tiled floor or fallback color
        if (floorPattern) {
            const tileScale = 0.2; // shrink tiles (1 = native, lower = smaller)
            ctx.save();
            ctx.translate(W / 2 - sn.x, H / 2 - sn.y);
            ctx.scale(tileScale, tileScale);
            ctx.fillStyle = floorPattern;
            // Compensate the fill rect for the scale factor
            const sx = sn.x / tileScale, sy = sn.y / tileScale;
            const sw = W / tileScale, sh = H / tileScale;
            ctx.fillRect(sx - sw, sy - sh, sw * 2, sh * 2);
            ctx.restore();
        } else {
            ctx.fillStyle = '#080507';
            ctx.fillRect(0, 0, W, H);
        }

        ctx.save();
        // Camera logic: translate context so snake is in center of screen
        ctx.translate(W / 2 - sn.x, H / 2 - sn.y);

        const cx = Math.floor(sn.x / CW);
        const cy = Math.floor(sn.y / CW);

        // 1. Draw World Chunks
        for(let i = cx-2; i <= cx+2; i++) {
            for(let j = cy-2; j <= cy+2; j++) {
                const chunk = world[getChunkKey(i, j)];
                if (!chunk) continue;

                // Draw Trees (background decor, no collision)
                chunk.trees.forEach(t => {
                    const img = t.variant === 1 ? assets.tree1
                              : t.variant === 2 ? assets.tree2
                              : assets.tree3;
                    if (img.complete && img.naturalWidth) {
                        ctx.globalAlpha = 0.85;
                        ctx.drawImage(img, t.x - t.size / 2, t.y - t.size / 2, t.size, t.size);
                        ctx.globalAlpha = 1;
                    }
                });

                // Draw Shrines (large, behind other objects)
                chunk.shrines.forEach(s => {
                    const size = s.r * 5; // big visual footprint
                    const img = s.variant === 2 ? assets.shrine2 : assets.shrine;
                    if (img.complete && img.naturalWidth) {
                        ctx.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
                    } else {
                        ctx.fillStyle = '#1a0e1e';
                        ctx.beginPath();
                        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#4a2860';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }
                });

                // Draw Bells (next to shrines)
                chunk.bells.forEach(b => {
                    const size = b.r * 4.5;
                    if (assets.bell.complete && assets.bell.naturalWidth) {
                        ctx.drawImage(assets.bell, b.x - size / 2, b.y - size / 2, size, size);
                    } else {
                        ctx.fillStyle = '#8a7430';
                        ctx.beginPath();
                        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });

                // Draw Pillar Walls & standalone pillars
                chunk.obs.forEach(o => {
                    // Skip shrines & bells (already drawn above)
                    if (chunk.shrines.some(s => s.x === o.x && s.y === o.y)) return;
                    if (chunk.bells.some(b => b.x === o.x && b.y === o.y)) return;

                    const size = o.r * 4;
                    if (assets.pillar.complete && assets.pillar.naturalWidth) {
                        ctx.drawImage(assets.pillar, o.x - size / 2, o.y - size / 2, size, size);
                    } else {
                        ctx.fillStyle = '#1c151a';
                        ctx.beginPath();
                        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });

                // Draw Food (Sprite with glow pulse)
                chunk.food.forEach(f => {
                    const pulse = Math.sin(time + f.offset) * 3;
                    const size = (f.r + pulse / 2) * 3;

                    if (assets.food.complete && assets.food.naturalWidth) {
                        ctx.drawImage(assets.food, f.x - size / 2, f.y - size / 2, size, size);
                    } else {
                        ctx.fillStyle = '#ffdf73';
                        ctx.beginPath();
                        ctx.arc(f.x, f.y, f.r + pulse / 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });

                // Draw Soul Shards (ethereal purple glow)
                chunk.soulShards.forEach(s => {
                    const pulse = Math.sin(time * 2 + s.offset) * 4;
                    const size = (s.r + pulse / 2) * 3;
                    if (assets.soulShard.complete && assets.soulShard.naturalWidth) {
                        ctx.globalAlpha = 0.8 + Math.sin(time * 3 + s.offset) * 0.2;
                        ctx.drawImage(assets.soulShard, s.x - size / 2, s.y - size / 2, size, size);
                        ctx.globalAlpha = 1;
                    } else {
                        ctx.fillStyle = '#b48ede';
                        ctx.shadowColor = '#8e44ad';
                        ctx.shadowBlur = 10 + pulse;
                        ctx.beginPath();
                        ctx.arc(s.x, s.y, s.r + pulse / 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                });

                // Draw Enemies (Shadow Asuras)
                chunk.enemies.forEach(e => {
                    const size = e.r * 2.5;
                    if (assets.enemy.complete && assets.enemy.naturalWidth) {
                        ctx.drawImage(assets.enemy, e.x - size / 2, e.y - size / 2, size, size);
                    } else {
                        ctx.fillStyle = 'rgba(0,0,0,0.8)';
                        ctx.beginPath();
                        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#ff0000';
                        ctx.fillRect(e.x - 8, e.y - 4, 4, 4);
                        ctx.fillRect(e.x + 4, e.y - 4, 4, 4);
                    }
                });
            }
        }

        // 2. Draw Snake (From tail to head)
        for (let s = sn.len - 1; s >= 0; s--) {
            let index = s * SG;
            if (index >= trail.length) index = trail.length - 1;
            const p = trail[index];
            if (!p) continue;

            ctx.save();
            ctx.translate(p.x, p.y);

            const isHead = (s === 0);
            const isTail = (s === sn.len - 1);

            if (isTail) {
                // Tail faces away from second-to-last segment
                const prevIdx = Math.min((s - 1) * SG, trail.length - 1);
                const prev = trail[prevIdx];
                if (prev) {
                    ctx.rotate(Math.atan2(p.y - prev.y, p.x - prev.x));
                } else {
                    ctx.rotate(p.a + Math.PI);
                }
            } else {
                ctx.rotate(p.a);
            }

            // Pick sprite: head / tail / body
            let img = assets.snakeBody;
            if (isHead) img = assets.snakeHead;
            else if (isTail) img = assets.snakeTail;

            if (img.complete && img.naturalWidth) {
                // Shrink body segments towards the tail
                const sizeShrink = isHead ? 0 : (s / sn.len) * (SS * 0.4);
                const drawSize = SS * 1.6 - sizeShrink;
                ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
            } else {
                // Fallback procedural rendering
                if (isHead) {
                    ctx.fillStyle = '#5c1010';
                    ctx.beginPath();
                    ctx.ellipse(0, 0, SS/1.2, SS/1.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#d4af37';
                    ctx.beginPath();
                    ctx.moveTo(0, -SS/3);
                    ctx.lineTo(SS/2, 0);
                    ctx.lineTo(0, SS/3);
                    ctx.fill();
                    ctx.fillStyle = '#ffdf73';
                    ctx.fillRect(SS/4, -SS/2.5, 5, 5);
                    ctx.fillRect(SS/4, SS/2.5 - 5, 5, 5);
                } else {
                    const sizeShrink = (s / sn.len) * (SS/2);
                    const currentSize = (SS/1.5) - sizeShrink;
                    ctx.fillStyle = '#2b0606';
                    ctx.strokeStyle = '#5c1010';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    if (s % 3 === 0) {
                        ctx.fillStyle = 'rgba(212, 175, 55, 0.4)';
                        ctx.beginPath();
                        ctx.moveTo(-currentSize/2, 0);
                        ctx.lineTo(0, -currentSize/2);
                        ctx.lineTo(currentSize/2, 0);
                        ctx.lineTo(0, currentSize/2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
        }

        // 3. Render Particles (world-space, camera transform is active)
        renderParticles(ctx);

        // 4. Fog-of-War: stamp pre-baked vignette
        ctx.restore(); // back to screen space
        ctx.drawImage(fogCanvas, 0, 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // LOOP TICK
    // ═══════════════════════════════════════════════════════════════════
    function tick() {
        raf = requestAnimationFrame(tick);
        update();
        render();
    }
    raf = requestAnimationFrame(tick);

    // Cleanup when component unmounts
    return function cleanup() {
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', handleKey);
        window.removeEventListener('keyup', handleKey);
        if (raf) cancelAnimationFrame(raf);
        if (quoteTimer) clearTimeout(quoteTimer);
        if (ambientInterval) clearInterval(ambientInterval);
        soundtrack.stop();
    };
}