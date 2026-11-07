import { useEffect, registerHandler } from '../../../framework.js';
import createSoundtrack from './soundtrack.js';
import { buildCity } from './city.js';

let _cleanup = null;
let _loreShown = false;
let _game = null;            // the running game's public hooks, for data-action handlers
const soundtrack = createSoundtrack();

const ASSET_BASE = 'js/pages/projects/snake/snake_assets/';

// ═══════════════════════════════════════════════════════════════════
// PERSISTENT SAVE (memories survive runs; the hunt is longer than one life)
// ═══════════════════════════════════════════════════════════════════
const SAVE_KEY = 'nagmani.save.v1';
function loadSave() {
    const base = { memories: [], best: 0, runs: 0, endings: 0, trueEnding: false };
    try { return Object.assign(base, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
    catch (_) { return base; }
}
function writeSave(s) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (_) { /* private mode */ }
}

// ═══════════════════════════════════════════════════════════════════
// STORY DATA
// ═══════════════════════════════════════════════════════════════════
const ACTS = [
    { at: 0,  num: 'I',   title: 'The Sunken Gardens',     epigraph: 'Where the diyas burnt out.',                                   fogInner: 260, fogOuter: 640 },
    { at: 7,  num: 'II',  title: 'The Brass Quarter',       epigraph: 'Kalash\u2019s men do not sleep. They were never allowed to.', fogInner: 240, fogOuter: 600 },
    { at: 14, num: 'III', title: 'The Drowned Sanctum',     epigraph: 'The water remembers what the stone forgot.',                 fogInner: 220, fogOuter: 560 },
    { at: 21, num: 'IV',  title: 'The Bridge',              epigraph: 'The river keeps what it is owed.',                            fogInner: 190, fogOuter: 500 },
];

// The nine Memories of Amrita, found in order. Together they are the story
// the lore screen only hints at; apart they are the reason the ending is hollow.
const MEMORIES = [
    {
        title: 'The Lotus Pool',
        text: 'I wore a man’s shape that morning, because the pool was shallow and I was vain. She was kneeling at the ghat with a brass pot, and she did not startle when the water went dark with my shadow. She looked at the ripples, then at me, and said, “You are standing on my reflection.” I stepped aside. I have been stepping aside for her ever since.',
    },
    {
        title: 'Her Name',
        text: 'Amrita. Nectar. The word the gods churned the ocean for. Her mother named her that in a village where children die of thirst, and she laughed when I told her it was a dangerous name to carry near a king. “Names are only dangerous to the people who want them,” she said. She did not know yet how many people would want hers.',
    },
    {
        title: 'The Seven Hoods',
        text: 'I showed her what I was on the night of the dark moon. Seven hoods rising behind me, the Nagmani burning in my brow like a second heart. I expected her to run. She reached up and put her palm flat against the stone of it and said it was warm, like a sleeping animal. Nobody had touched it in a thousand years. Nobody had wanted to.',
    },
    {
        title: 'The Brass Envoy',
        text: 'The envoy came in a palanquin of beaten brass with bells on every corner so the dying could hear him approach. Maharaja Kalash, he said, was old, and had heard that the Naga kept a stone that would not let a man die. He asked for a splinter of it. A splinter. I had a thousand pieces in my brow and I told him the Nagmani was not a thing that was divided. Amrita said, afterwards, that I had sounded exactly like a king. She did not mean it kindly.',
    },
    {
        title: 'The Bargain',
        text: 'Kalash himself came down the last time, carried, because his legs had already turned to metal. He offered me his kingdom for the Nagmani, and then, when I laughed, he offered to take it and leave the city standing. One stone for ten thousand people. Amrita stood behind me and said nothing, because she had already said it. I told him immortality is not a thing you own. It is a thing that owns you. He smiled with a mouth that was already brass and said, \u201CThen it owns you, Serpent King.\u201D He was right.',
    },
    {
        title: 'The Bells That Did Not Ring',
        text: 'Every shrine in Patala has a bell, and every bell is sworn to ring when a mortal crosses the seal. The night they came, not one of them sounded. The priests had been paid in the only coin that works on the devout: a promise that their gods would notice them. I woke to silence. I have hated silence since. Ring the bells for me, if you find them. Ring them all.',
    },
    {
        title: 'The Shattering',
        text: 'They came down every street at once. I could have given it to him at the gate and they would have gone home. I stood in the Gardens with the stone in my brow and let the city burn around me to keep it, and when he reached me he could not take it, so he broke it there. A brass mace into the heart of the world. A thousand pieces went up like sparks from a fire kicked over. Twenty-seven of them went through her. I remember the sound. I do not remember anything after it for a very long time.',
    },
    {
        title: 'Her Last Word',
        text: 'She said my name. Not the title. Not Naagraj, not Serpent King, not any of the words carved over doorways. The small one, the one from before, that I have not heard in anyone else’s mouth since and will not write here. Then the void took her by the shard in her chest and pulled, and she went into the dark the way she went into water: without startling.',
    },
    {
        title: 'The Curse',
        text: 'This is the part I have been avoiding. Kalash did not curse me. I did. I swore on the broken stone that I would not rest until every piece of her was back in my coils, and the stone, which was mine and which I had killed a city to keep, heard me and kept me. I cannot die. I can only fall and get up longer. Every shard of it I swallow lengthens me; I swallow them anyway, because I am what I am. Amrita, when I have all of you, I will carry you to the bridge and lay the stone down on the far side, and we will see whether a river can take a king.',
    },
];

const QUOTES = {
    ambient: [
        'The stone is cold. I cannot feel your warmth anymore.',
        'Patala is silent, save for the echo of my own scales.',
        'I will find every piece of you, Amrita. Even if it takes eternity.',
        'The diyas have all burnt out. Only the dark remains.',
        'They broke the seal. They brought mortal rot into our sanctuary.',
        'Where did they scatter your soul, my lotus?',
        'The banyan roots drink from a dry, dead earth.',
        'I slept while they took everything from me. Forgive me.',
        'A shattered Nagmani... a shattered heart.',
        'Even the gods have abandoned this sunken temple.',
        'The Asuras watch me from the fog. They know my burden.',
        'The Nagmani pulses like a dying heartbeat in the abyss.',
        'The dark is closing in, but your golden light guides my fangs.',
    ],
    act: [
        [
            'These were the gardens. I can still find the paths under the dust.',
            'A thousand diyas lined this walk once. I will light what I can.',
            'The trees have grown through the places where we sat.',
        ],
        [
            'Brass. I smell brass on the air. His men are closer here.',
            'They hunt in the dark because they cannot bear to be seen as they are.',
            'Kalash wanted to live forever. He gave his soldiers the same gift without asking.',
            'Shed your skin when they close in. They cannot hold what is already gone.',
        ],
        [
            'The sanctum flooded when the seal broke. The priests are still in the water.',
            'Do not trust the puddles. Something has learned to wait in them.',
            'The water here is black and remembers every face that drowned in it.',
            'They weep under the surface. They were paid to be silent and now they cannot stop.',
        ],
        [
            'I can feel the void from here. It is pulling at the shards in my body.',
            'The fog is thickest at the threshold. It does not want me to see what is left.',
            'His Sentinels still guard a door that no longer leads anywhere.',
            'Almost, Amrita. Almost. Hold on to the dark a little longer.',
        ],
    ],
    eat: [
        'Each memory of you I consume makes me heavier.',
        'My body stretches into the dark. I am becoming a prisoner of my own sorrow.',
        'Another shard. Another echo of your laugh in my mind.',
        'The Prana burns going down, but it is all I have left of you.',
        'I am growing too large for these cursed halls.',
        'I drag my past behind me like a chain of black iron.',
        'How can a soul made of light weigh so much?',
        'Your essence binds my flesh, elongating my suffering.',
        'To remember you is a burden I gladly bear, no matter the agony.',
        'I coil endlessly around the empty spaces where you used to walk.',
        'Just one more shard... just one more memory...',
    ],
    enemy: [
        'The ghosts of the Brass King still wander my halls.',
        'Tarnished armor. Hollow souls. I will crush them all.',
        'Maharaja Kalash sought immortality. Now his men are dust in the wind.',
        'They guard the ruins of the paradise they destroyed.',
        'Their red eyes mock my failure from the fog.',
        'Do not block my path, shadow. You have already taken enough.',
        'They smell of old blood, rusted greed, and burnt offerings.',
        'Even in death, the King’s men cannot escape Patala’s judgment.',
        'I will not let their corrupted ash touch your pure light.',
    ],
    hunter: [
        'A Hunter. It has my scent. Good. Let it come to me.',
        'They run on brass legs that never tire. Mine do not tire either.',
        'It smells the Nagmani in me. Everything that was his wants it back.',
    ],
    drowned: [
        'A priest. Still wearing the beads he sold us for.',
        'It rose from the puddle like it had been waiting a thousand years. It had.',
        'The Drowned lunge once and rest. Grief has made them slow learners.',
    ],
    sentinel: [
        'A Sentinel. Kalash made them headless so they could not question him.',
        'Brass and bone and a mace the size of a doorway. It will not stop. Neither will I.',
        'It cannot be unmade. It can only be outlasted.',
    ],
    spirit: [
        'The innocent souls flee from me... Have I become a monster?',
        'Do not run, little spirit. I only need your spark.',
        'I must consume them to sustain my hunt. Forgive my hunger.',
        'They weep as they run, just as you wept when the blade fell.',
        'Their fear is a bitter nectar, but it fuels my descent.',
        'I am the lord of this underworld! Why do you hide?',
        'Come back into the dark. Give me her memory.',
        'A fleeting wisp of life in a graveyard of stone.',
        'Am I the villain of their story now? So be it, if it brings you back.',
        'Rest now in my coils, wandering soul. Your terror is over.',
    ],
    growth: [
        'There is so much of you to carry. I am suffocating in our past.',
        'I am an endless labyrinth of flesh and grief.',
        'It is so hard to turn, so hard to move. I am trapped by my own immense size.',
        'Amrita... are you watching me become this abomination?',
        'I cannot even see my own tail. I am an ouroboros of despair.',
        'If I must swallow the entire underworld to find you, I will.',
    ],
    shrine: [
        'One diya lit. The dark is one flame smaller.',
        'A small light for you, Amrita. Follow it if you can.',
        'The shrine remembers me. The flame took at once.',
        'If I fall, I will wake here, beside the flame. Let that be enough.',
    ],
    bell: [
        'Ring. RING. Let them hear what the priests would not sound.',
        'The bell still knows its duty, even if the men who kept it did not.',
        'They scatter from the toll like ash from a slammed door.',
        'A thousand years late, the warning finally rings.',
    ],
    shed: [
        'I leave my skin behind and for a breath I am nothing they can hold.',
        'Shed the weight. Shed the grief. Keep the hunger.',
        'The curse says I may not rest. It said nothing about becoming smaller.',
        'My old skin lies in the dust. Let them chase that instead.',
    ],
    banish: [
        'Unmade. Go and tell your king what a serpent is.',
        'Brass to ash. He promised them forever. I give them an end.',
        'Nothing of Kalash will stand between me and her.',
    ],
    memory: [
        'A memory. Her memory. I had forgotten I had forgotten it.',
        'It comes back like a blade pulled out slowly.',
        'Hold still, Amrita. I have found another piece of you.',
    ],
    greed: [
        'More of the stone. It is always more of the stone. This is how it started.',
        'I can feel them turning their heads. They smell it on me, the way he did.',
        'Longer. Brighter. Hungrier. Nothing in me has learned anything.',
        'The whole city burned for this taste, and I still want it.',
    ],
    piece: [
        'There. A piece of you, cold as river stone. I have you.',
        'I know this one. This is the part of you that laughed at kings.',
        'Twenty-seven pieces. I am counting. I have never counted anything for anyone.',
        'Come here, my lotus. Come back into the dark with me a while longer.',
        'Each piece of you is lighter than the stone. Each one weighs more.',
    ],
    bite: [
        'The stone\u2019s own venom. This is what it was for. Not to keep.',
        'Unmade. One of his soldiers for a mouthful of what I hoarded.',
        'My fangs still work. Everything else of me has rusted.',
    ],
    empty: [
        'Dry. Give it a moment, or feed it the stone.',
        'No venom yet. Fangs, then, if they come close.',
    ],
    hurt: [
        'Brass in my side. I have had worse from myself.',
        'They bite back. Good. Let them.',
        'The stone knits me. It always does. That is the curse.',
    ],
    drop: [
        'No. NO. She fell from me. Go back. Go back for her.',
        'I felt her slip as I went down. She is lying where I fell.',
        'I have dropped her in the street like a thief drops what he stole. Get up. Go back.',
    ],
    recover: [
        'I have you again. I will not fall with you again. I will.',
        'Forgive me. The dark had you for a moment. It will not keep you.',
    ],
    gate: [
        'The bridge will not hold a king who leaves his queen behind. I know. I built it that way.',
        'Not yet. She is still in the streets. All of her comes, or none of me goes.',
        'The river asks what I carry. Not enough. Not yet.',
    ],
    death: [
        'Consumed by the Void. You collapsed under the weight of your own sorrow.',
        'The coils tightened. The memories suffocated you.',
        'Amrita, I have failed. The dark reclaims us both.',
        'A serpent choked by its own endless tail.',
        'Your grief was too great a labyrinth to escape.',
        'Brass and bone. The Brass King’s dead take one more.',
    ],
};

const VICTORY = {
    trueEnding: {
        title: 'ASCENSION',
        text: 'He carries all twenty-seven pieces of her onto the bridge and the bridge holds. On the far side he lays the Nagmani down in the road, the whole hoard of it, the thing he burned a city to keep, and the river takes it without a sound.<br><br>'
            + 'She comes together in his coils the way water finds its level. She does not startle. She looks at the long dark length of him, at the brass dust on his fangs, at the {deaths} times he fell for her written in his scales, and she says the small name, the one from before, and he remembers every morning that led here.<br><br>'
            + 'He remembers how to be a man. He remembers how to be small. The Serpent King is done repenting; there is nothing left in him to repent with. They go up together, and behind them the city of Patala goes dark for the last time, and is at peace.',
    },
    hollow: {
        title: 'ACROSS THE RIVER',
        text: 'He carries all twenty-seven pieces of her onto the bridge and the bridge holds. On the far side he lays the Nagmani down in the road, the whole hoard of it, and the river takes it without a sound.<br><br>'
            + 'She comes together in his coils the way water finds its level. She looks at him. He does not remember the morning at the lotus pool, or her name, or the small word she said at the end; <strong>{missing} of the nine Memories</strong> are still waiting in the city behind him. She remembers all of it. She takes his hand anyway.<br><br>'
            + 'He fell {deaths} times on the way here and swallowed {greed} shards of the thing that did this. It does not matter now. They go up together, and the city goes dark behind them, and this time it is only the dark.',
    },
};

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
        if (_game) _game.begin();
    });

    registerHandler('playAgainVictory', () => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        _cleanup = initGothicSnakeRPG();
    });

    registerHandler('closeMemory', () => { if (_game) _game.closeMemory(); });
    registerHandler('togglePause', () => { if (_game) _game.togglePause(); });
    registerHandler('shedSkin',    () => { if (_game) _game.shed(); });
    registerHandler('bite',        () => { if (_game) _game.bite(); });
    registerHandler('openCodex',   () => { if (_game) _game.openCodex(); });
    registerHandler('closeCodex',  () => { if (_game) _game.closeCodex(); });
    registerHandler('resetRun',    () => { if (_game) _game.resetRun(); });

    useEffect(() => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        _cleanup = initGothicSnakeRPG();
        // the game must stop when the page is left: its timers hold on to
        // elements the framework will recycle for the next page
        return () => { if (_cleanup) { _cleanup(); _cleanup = null; } };
    }, []);

    return `
    <div id="gs-root">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap');

            #gs-root {
                --brass: #c0a060; --brass-hi: #e6cf8f; --ash: #9c8a66; --dim: #5a4d3a; --line: rgba(192,160,96,0.32);
                --verm: #8a1c1c; --soul: #b48ede; --mem: #f0c89a; --flame: #ffb347;
                --bg: #0a0709; --panel: rgba(9, 6, 8, 0.86);
                --serif: 'Cormorant Garamond', Georgia, serif; --display: 'Cinzel', serif;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body, html { width: 100%; height: 100%; overflow: hidden; background-color: #0a0709; }
            canvas { display: block; }

            /* ═══ shared pieces ═══ */
            .gs-frame {
                background: var(--panel); background-clip: padding-box;
                border: 1px solid var(--line);
                border-image: url('${ASSET_BASE}ui/ui_frame.png') 190 / 26px / 0 round;
                box-shadow: 0 24px 60px rgba(0,0,0,0.6);
                position: relative;
            }
            .gs-frame.tight { border-image-width: 14px; }
            .gs-frame > :first-child { position: relative; }
            .gs-divider { height: 26px; margin: 4px auto; width: min(100%, 420px); background: url('${ASSET_BASE}ui/ui_divider.png') center / contain no-repeat; }
            .gs-kicker { font-family: var(--display); font-size: 0.62rem; letter-spacing: 0.34em; color: var(--verm); text-transform: uppercase; }
            .gs-rule { display: flex; align-items: center; gap: 12px; color: var(--brass); font-size: 0.7rem; letter-spacing: 0.3em; }
            .gs-rule::before, .gs-rule::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--line)); }
            .gs-rule::after { background: linear-gradient(90deg, var(--line), transparent); }
            /* buttons are cast plates: the cobra-hood ends are kept whole by the nine-slice, only the plain middle stretches */
            .gs-btn {
                font-family: var(--display); font-size: clamp(0.78rem, 2vw, 0.9rem); letter-spacing: 0.22em; text-transform: uppercase;
                height: 56px; min-width: 240px; padding: 0 48px; cursor: pointer; transition: filter 0.25s, color 0.25s;
                background: transparent;
                border: 1px solid transparent;
                border-image: url('${ASSET_BASE}ui/ui_button.png') 0 160 fill / 0 27px / 0 stretch;
                color: #f0dca6; text-shadow: 0 1px 2px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7);
                filter: drop-shadow(0 8px 14px rgba(0,0,0,0.55));
            }
            .gs-btn:hover { filter: brightness(1.18) drop-shadow(0 8px 14px rgba(0,0,0,0.55)); color: #fff3cc; }
            .gs-btn:not(.ghost) { filter: brightness(1.32) saturate(1.12) drop-shadow(0 8px 14px rgba(0,0,0,0.55)); color: #fff0c0; }
            .gs-btn:not(.ghost):hover { filter: brightness(1.5) saturate(1.15) drop-shadow(0 8px 14px rgba(0,0,0,0.55)); }
            .gs-btn.ghost { border-image-source: url('${ASSET_BASE}ui/ui_button_iron.png'); color: var(--brass); background: transparent; }
            .gs-btn.ghost:hover { color: var(--brass-hi); }
            .gs-btn-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
            .gs-overlay {
                position: absolute; inset: 0; display: none; flex-direction: column; justify-content: center; align-items: center;
                font-family: var(--serif); color: var(--brass); text-align: center;
                padding: clamp(16px, 4vw, 40px); overflow-y: auto; -webkit-overflow-scrolling: touch;
            }
            .gs-overlay h1 { font-family: var(--display); font-weight: 600; }
            .gs-overlay p { font-size: clamp(1rem, 2.3vw, 1.2rem); line-height: 1.65; }

            /* ═══ HUD ═══ */
            #gs-ui { position: absolute; top: 14px; left: 14px; z-index: 10; pointer-events: none; }
            #gs-hud-stats { padding: 18px 22px 16px 20px; display: grid; gap: 7px; min-width: 300px; }
            .gs-row { display: grid; grid-template-columns: 16px 92px 1fr 78px; align-items: center; gap: 8px; font-family: var(--display); font-size: 0.64rem; letter-spacing: 0.16em; color: var(--ash); text-transform: uppercase; }
            .gs-row .gs-ico { color: var(--brass); font-size: 0.75rem; text-align: center; display: flex; align-items: center; justify-content: center; }
            .gs-row .gs-ico img { width: 24px; height: 24px; margin: -4px; object-fit: contain; filter: brightness(1.35) saturate(1.1) drop-shadow(0 0 4px rgba(0,0,0,0.9)); }
            .gs-row.soul .gs-ico, .gs-row.soul .gs-val { color: var(--soul); }
            .gs-row.mem .gs-ico, .gs-row.mem .gs-val { color: var(--mem); }
            .gs-row .gs-val { font-weight: 700; color: var(--brass-hi); letter-spacing: 0.08em; font-size: 0.72rem; text-align: right; font-variant-numeric: tabular-nums; }
            .gs-row .gs-val small { color: var(--dim); font-weight: 400; margin-left: 3px; }
            .gs-bar { height: 3px; background: rgba(192,160,96,0.14); position: relative; overflow: hidden; }
            .gs-bar i { position: absolute; inset: 0 auto 0 0; width: 0%; background: linear-gradient(90deg, #8a6a2e, var(--brass-hi)); transition: width 0.4s ease; }
            .gs-row.soul .gs-bar i { background: linear-gradient(90deg, #4a2f6e, var(--soul)); }
            .gs-row.prana .gs-ico { color: var(--flame); }
            .gs-row.prana .gs-bar { height: 5px; }
            .gs-row.prana .gs-bar i { background: linear-gradient(90deg, #7a1a16, #e0552e, #ffb347); transition: width 0.25s ease; }
            .gs-pips { display: flex; gap: 4px; }
            .gs-pips b { width: 7px; height: 7px; transform: rotate(45deg); border: 1px solid rgba(240,200,154,0.4); background: transparent; }
            .gs-pips b.on { background: var(--mem); border-color: var(--mem); box-shadow: 0 0 6px rgba(240,200,154,0.6); }
            .gs-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 3px; padding-top: 8px; border-top: 1px solid rgba(192,160,96,0.14); }
            #gs-fallen { display: flex; align-items: center; gap: 8px; font-family: var(--display); font-size: 0.6rem; letter-spacing: 0.22em; color: var(--dim); text-transform: uppercase; }
            #gs-fallen b { color: var(--ash); font-weight: 700; margin-left: 2px; }
            .gs-note { grid-column: 3 / 4; font-family: var(--serif); font-style: italic; font-size: 0.78rem; letter-spacing: 0; text-transform: none; color: #ff8aa0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            #gs-map { display: block; width: 300px; height: 300px; margin: 0 auto 4px; opacity: 0.95; }
            .gs-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: center; margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(192,160,96,0.14); font-family: var(--display); font-size: 0.5rem; letter-spacing: 0.14em; color: var(--dim); text-transform: uppercase; }
            .gs-legend .l-you { color: #e8e2d0; } .gs-legend .l-piece { color: var(--soul); } .gs-legend .l-mem { color: var(--mem); } .gs-legend .l-shrine { color: var(--flame); } .gs-legend .l-dead { color: #d0603a; } .gs-legend .l-gate { color: var(--brass-hi); }
            @media (max-height: 760px) { #gs-map { width: 200px; height: 200px; } .gs-legend { display: none; } }
            @media (max-height: 600px) { #gs-map { display: none; } }
            #gs-lives { display: flex; gap: 7px; align-items: flex-end; height: 18px; }
            .gs-flame.img { width: 16px; height: 20px; border-radius: 0; background: url('${ASSET_BASE}ui/ui_icon_flame.png') center / contain no-repeat; box-shadow: none; }
            .gs-flame.img.out { filter: grayscale(1) brightness(0.35); opacity: 0.6; animation: none; }
            .gs-flame {
                width: 10px; height: 15px; display: inline-block;
                border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
                background: radial-gradient(ellipse at 50% 70%, #fff1c9 0%, #ffb347 35%, #c0282e 80%);
                box-shadow: 0 0 8px rgba(255,160,70,0.7); animation: gsFlicker 1.6s ease-in-out infinite;
            }
            .gs-flame:nth-child(2) { animation-delay: -0.5s; } .gs-flame:nth-child(3) { animation-delay: -1.1s; }
            .gs-flame.out { background: radial-gradient(ellipse at 50% 70%, #2a2020, #120c0c); box-shadow: none; animation: none; opacity: 0.6; }
            @keyframes gsFlicker { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.88) translateY(1px); } }
            #gs-shed { display: flex; align-items: center; gap: 8px; font-family: var(--display); font-size: 0.6rem; letter-spacing: 0.22em; color: var(--dim); text-transform: uppercase; --p: 1; }
            #gs-shed em { width: 22px; height: 22px; display: inline-block; background: url('${ASSET_BASE}ui/ui_icon_shed.png') center / contain no-repeat; margin-right: -4px; filter: brightness(1.3); }
            #gs-shed i {
                width: 18px; height: 18px; border-radius: 50%; display: inline-block;
                background: conic-gradient(var(--brass) calc(var(--p) * 100%), rgba(192,160,96,0.14) 0);
                -webkit-mask: radial-gradient(circle, transparent 54%, #000 56%); mask: radial-gradient(circle, transparent 54%, #000 56%);
            }
            #gs-bite { display: flex; align-items: center; gap: 7px; font-family: var(--display); font-size: 0.6rem; letter-spacing: 0.22em; color: var(--dim); text-transform: uppercase; --p: 1; }
            #gs-bite small { font-size: 0.5rem; letter-spacing: 0.1em; color: var(--dim); margin-left: 4px; }
            #gs-bite i { width: 18px; height: 18px; border-radius: 50%; display: inline-block; background: conic-gradient(#9fcf4a calc(var(--p) * 100%), rgba(120,160,60,0.18) 0); -webkit-mask: radial-gradient(circle, transparent 54%, #000 56%); mask: radial-gradient(circle, transparent 54%, #000 56%); }
            #gs-bite.ready { color: #b9e06a; } #gs-bite.ready i { box-shadow: 0 0 8px rgba(159,207,74,0.5); }
            #gs-bite.empty { color: var(--dim); } #gs-bite.empty i { background: rgba(138,28,28,0.18); }
            #gs-shed.ready { color: var(--brass); } #gs-shed.ready i { box-shadow: 0 0 8px rgba(192,160,96,0.5); }
            #gs-shed.active { color: var(--brass-hi); } #gs-shed.active i { background: var(--brass-hi); box-shadow: 0 0 12px rgba(230,207,143,0.8); }

            #gs-act-banner {
                position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 10; pointer-events: none;
                text-align: center; font-family: var(--display); white-space: nowrap;
            }
            #gs-act-banner .gs-kicker { font-size: 0.56rem; margin-bottom: 3px; }
            #gs-act-banner .gs-rule { font-size: 0.68rem; letter-spacing: 0.26em; color: var(--brass); min-width: 260px; }
            #gs-act-banner .gs-rule span { padding: 0 2px; }

            #gs-controls { position: absolute; top: 14px; right: 14px; z-index: 15; display: flex; gap: 6px; }
            #gs-controls button {
                width: 34px; height: 34px; cursor: pointer; pointer-events: all;
                background: var(--panel); border: 1px solid var(--line); color: var(--brass);
                font-family: var(--display); font-size: 0.8rem; display: flex; align-items: center; justify-content: center;
            }
            #gs-controls button:hover { border-color: var(--brass); color: var(--brass-hi); }

            #gs-quote { display: none !important; }
            #gs-quote-old {
                position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%); z-index: 15; pointer-events: none;
                font-family: var(--serif); font-style: italic; font-size: clamp(1.05rem, 2.4vw, 1.35rem); color: var(--brass-hi);
                text-align: center; max-width: 640px; width: calc(100% - 40px); padding: 10px 24px;
                border-top: 1px solid rgba(192,160,96,0.22); border-bottom: 1px solid rgba(192,160,96,0.22);
                background: rgba(9,6,8,0.55); text-shadow: 0 1px 2px rgba(0,0,0,0.9);
                opacity: 0; transition: opacity 0.9s ease;
            }
            #gs-quote.visible { opacity: 1; } #gs-quote.fading { opacity: 0; }

            #gs-act-card {
                position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%); z-index: 16; pointer-events: none;
                text-align: center; width: calc(100% - 32px); max-width: 720px; opacity: 0; transition: opacity 1.2s ease;
            }
            #gs-act-card.show { opacity: 1; }
            #gs-act-card .gs-kicker { margin-bottom: 10px; }
            #gs-act-card .act-title { font-family: var(--display); font-weight: 600; font-size: clamp(1.5rem, 5vw, 2.6rem); letter-spacing: 0.16em; color: var(--brass-hi); text-shadow: 0 2px 14px rgba(0,0,0,0.9); margin-bottom: 12px; }
            #gs-act-card .act-epi { font-family: var(--serif); font-style: italic; font-size: clamp(1rem, 2.4vw, 1.3rem); color: var(--ash); text-shadow: 0 1px 8px rgba(0,0,0,0.9); }

            #gs-shed-btn {
                position: absolute; right: 22px; bottom: 26px; z-index: 15; width: 70px; height: 70px; border-radius: 50%;
                background: var(--panel); border: 1px solid var(--line); color: var(--brass);
                font-family: var(--display); font-size: 0.58rem; letter-spacing: 0.18em;
                display: none; align-items: center; justify-content: center; pointer-events: all; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
            }
            #gs-shed-btn.cooling { opacity: 0.4; }
            #gs-bite-btn {
                position: absolute; right: 108px; bottom: 26px; z-index: 15; width: 70px; height: 70px; border-radius: 50%;
                background: var(--panel); border: 1px solid rgba(159,207,74,0.5); color: #b9e06a;
                font-family: var(--display); font-size: 0.58rem; letter-spacing: 0.18em;
                display: none; align-items: center; justify-content: center; pointer-events: all; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
            }
            #gs-bite-btn.cooling { opacity: 0.4; }
            @media (pointer: coarse) { #gs-shed-btn, #gs-bite-btn { display: flex; } }

            /* ═══ loading ═══ */
            #loadingOverlay { background: #060305; display: flex; z-index: 50; }
            #loadingOverlay .gs-kicker { color: var(--ash); }
            #loadingOverlay .load-logo { width: clamp(90px, 22vw, 150px); height: auto; margin-bottom: 26px; animation: loadPulse 2.4s ease-in-out infinite; }
            @keyframes loadPulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
            #loadingOverlay .load-title { font-family: var(--display); font-size: clamp(1.4rem, 4vw, 2rem); letter-spacing: 0.34em; color: var(--brass-hi); margin-bottom: 8px; }
            #loadingOverlay .load-bar-wrap { width: clamp(180px, 40vw, 300px); height: 2px; background: rgba(192,160,96,0.15); margin: 28px 0 14px; }
            #loadingOverlay .load-bar { height: 100%; width: 0%; background: var(--brass); transition: width 0.3s ease; }
            #loadingOverlay .load-hint { font-style: italic; color: var(--dim); font-size: 1rem; }

            /* ═══ title screen ═══ */
            #loreOverlay { background: #060305; z-index: 30; padding: 0; overflow: hidden; justify-content: center; }
            #loreOverlay .lore-bg {
                position: absolute; inset: 0; background: url('${ASSET_BASE}ui/ui_backdrop.png') center / cover no-repeat; opacity: 0.55;
                -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.25), #000 60%); mask-image: linear-gradient(90deg, rgba(0,0,0,0.25), #000 60%);
            }
            #loreOverlay .lore-bg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6,3,5,0.5), rgba(6,3,5,0.15) 40%, rgba(6,3,5,0.85)); }
            #loreOverlay .lore-edge { position: absolute; inset: 12px; border: 1px solid rgba(192,160,96,0.22); pointer-events: none; border-image: url('${ASSET_BASE}ui/ui_frame.png') 190 / 34px / 0 round; }
            #loreOverlay .lore-portrait {
                position: absolute; right: clamp(40px, 7vw, 140px); bottom: 0; height: min(84vh, 760px); width: auto;
                -webkit-mask-image: radial-gradient(ellipse at 50% 42%, #000 42%, transparent 70%); mask-image: radial-gradient(ellipse at 50% 42%, #000 42%, transparent 70%);
                pointer-events: none;
            }
            #loreOverlay .lore-inner {
                position: relative; width: 100%; height: 100%;
                display: flex; flex-direction: column; justify-content: center; align-items: flex-start; text-align: left;
                padding: clamp(48px, 7vh, 80px) clamp(56px, 7vw, 120px) clamp(44px, 6vh, 64px); gap: clamp(8px, 1.5vh, 14px);
            }
            #loreOverlay .lore-col { max-width: min(640px, 56%); }
            #loreOverlay .lore-divider { width: 240px; height: 22px; margin: 2px 0 0; background: url('${ASSET_BASE}ui/ui_divider.png') left center / contain no-repeat; opacity: 0.85; }
            #loreOverlay .lore-logo { height: clamp(28px, 5vh, 44px); width: auto; display: block; margin-bottom: clamp(4px, 1vh, 10px); opacity: 0.9; }
            #loreOverlay h1 { font-size: clamp(2rem, 7.5vh, 3.8rem); letter-spacing: 0.3em; color: var(--brass-hi); line-height: 1; margin-left: -0.04em; }
            #loreOverlay h2 { font-family: var(--display); font-weight: 400; font-size: clamp(0.62rem, 1.5vh, 0.8rem); letter-spacing: 0.4em; color: var(--ash); text-transform: uppercase; margin-top: 6px; }
            #loreOverlay .lore-text { font-size: clamp(0.92rem, 1.95vh, 1.05rem); line-height: 1.42; color: #c9b58a; }
            #loreOverlay .lore-text strong { color: var(--brass-hi); font-weight: 500; }
            #loreOverlay .lore-rites { width: 100%; padding: clamp(16px, 2.4vh, 22px) clamp(18px, 2.4vw, 26px) clamp(12px, 1.6vh, 16px); }
            #loreOverlay .lore-rites h3 { font-family: var(--display); font-size: 0.58rem; letter-spacing: 0.34em; color: var(--verm); margin-bottom: 4px; }
            #loreOverlay .lore-rites li { list-style: none; display: grid; grid-template-columns: 16px 1fr; gap: 10px; padding: clamp(2px, 0.5vh, 4px) 0; font-size: clamp(0.84rem, 1.75vh, 0.95rem); line-height: 1.32; color: #b9a67d; border-top: 1px solid rgba(192,160,96,0.08); }
            #loreOverlay .lore-rites li:first-of-type { border-top: 0; }
            #loreOverlay .lore-rites li i { font-style: normal; text-align: center; color: var(--brass); }
            #loreOverlay .lore-rites li.soul i { color: var(--soul); } #loreOverlay .lore-rites li.mem i { color: var(--mem); } #loreOverlay .lore-rites li.fire i { color: var(--flame); }
            #loreOverlay .lore-rites li strong { color: var(--brass-hi); font-weight: 500; }
            #loreOverlay .lore-stats { font-family: var(--display); font-size: 0.6rem; letter-spacing: 0.2em; color: var(--dim); text-transform: uppercase; }
            #loreOverlay .lore-stats span { color: var(--ash); }
            #loreOverlay .gs-btn-row { justify-content: flex-start; flex-wrap: nowrap; gap: 12px; }
            #loreOverlay .gs-btn { min-width: 0; height: 52px; padding: 0 clamp(22px, 2.4vw, 38px); font-size: clamp(0.7rem, 1.7vh, 0.82rem); white-space: nowrap; border-image-width: 0 25px; }
            #loreOverlay .lore-stats { margin-top: 2px; }
            #loreOverlay .lore-controls { margin-top: 2px; }
            #loreOverlay .lore-controls { font-size: clamp(0.82rem, 1.7vh, 0.95rem); color: var(--dim); line-height: 1.7; }
            #loreOverlay .lore-controls kbd { font-family: var(--display); font-size: 0.64rem; letter-spacing: 0.1em; border: 1px solid rgba(192,160,96,0.3); padding: 1px 6px; color: var(--ash); }
            #loreOverlay .lore-controls b { color: var(--ash); font-weight: 500; }
            @media (max-width: 820px) {
                #loreOverlay { overflow-y: auto; justify-content: flex-start; }
                #loreOverlay .lore-inner { height: auto; min-height: 100%; }
                #loreOverlay .gs-btn-row { flex-wrap: wrap; gap: 8px; }
                #loreOverlay .gs-btn { height: 42px; padding: 0 22px; font-size: 0.66rem; border-image-width: 0 20px; }
                #loreOverlay .lore-portrait { right: -10%; height: 60vh; opacity: 0.5; }
                #loreOverlay .lore-col { max-width: 100%; }
                #loreOverlay .lore-inner { padding: 3vh 40px; }
                #loreOverlay .lore-edge { border-image-width: 16px; inset: 8px; }
                #loreOverlay h1 { font-size: clamp(1.8rem, 6vh, 2.6rem); }
                #loreOverlay .lore-text { font-size: clamp(0.86rem, 1.8vh, 0.98rem); line-height: 1.4; }
                #loreOverlay .lore-rites li { font-size: clamp(0.8rem, 1.7vh, 0.92rem); line-height: 1.3; }
                #loreOverlay .lore-controls { display: none; } /* touch players steer by dragging; the keys are moot */
                .gs-btn { height: 46px; min-width: 0; padding: 0 34px; border-image-width: 0 22px; font-size: 0.72rem; }
            }
            @media (max-height: 720px) {
                .gs-btn { height: 46px; padding: 0 38px; border-image-width: 0 22px; }
                #loreOverlay .lore-inner { gap: clamp(6px, 1.2vh, 12px); }
                #gs-hud-stats { min-width: 0; padding: 12px 14px; gap: 5px; }
                .gs-row { grid-template-columns: 14px 70px 1fr 64px; font-size: 0.56rem; }
                #gs-act-banner { display: none; }
            }
            @media (max-height: 560px) {
                #loreOverlay { overflow-y: auto; justify-content: flex-start; }
                #loreOverlay .lore-portrait { display: none; }
                #loreOverlay .lore-inner { height: auto; }
            }

            /* ═══ panels: memory, pause, codex, death, victory ═══ */
            #memoryOverlay { background: rgba(4, 2, 4, 0.9); z-index: 28; }
            .mem-panel { display: grid; grid-template-columns: clamp(110px, 22vw, 190px) 1fr; gap: clamp(16px, 3vw, 32px); align-items: start; width: 100%; max-width: 780px; text-align: left; padding: clamp(28px, 4vw, 44px); }
            .pause-panel, .victory-panel, .death-panel, .codex-inner { padding-top: clamp(30px, 4vw, 46px) !important; padding-bottom: clamp(30px, 4vw, 46px) !important; }
            .mem-panel .mem-portrait { width: 100%; height: auto; -webkit-mask-image: linear-gradient(180deg, #000 70%, transparent); mask-image: linear-gradient(180deg, #000 70%, transparent); }
            .mem-panel h2 { font-family: var(--display); font-weight: 600; font-size: clamp(1.2rem, 3.4vw, 1.8rem); letter-spacing: 0.12em; color: var(--brass-hi); margin: 8px 0 14px; }
            .mem-panel p { color: #c9b58a; margin-bottom: 16px; }
            .mem-panel .mem-reward { font-family: var(--display); font-size: 0.62rem; letter-spacing: 0.2em; color: var(--soul); text-transform: uppercase; margin-bottom: 18px; }
            @media (max-width: 560px) { .mem-panel { grid-template-columns: 1fr; text-align: center; } .mem-panel .mem-portrait { max-width: 160px; margin: 0 auto; } }

            #codexOverlay { background: rgba(4, 2, 4, 0.94); z-index: 32; justify-content: flex-start; }
            #codexOverlay .codex-inner { width: 100%; max-width: 760px; text-align: left; padding: clamp(18px, 3vw, 34px); margin: clamp(12px, 3vh, 30px) 0; }
            #codexOverlay h1 { font-size: clamp(1.3rem, 4vw, 2rem); letter-spacing: 0.26em; color: var(--brass-hi); text-align: center; margin-bottom: 6px; }
            #codexOverlay .codex-sub { text-align: center; margin-bottom: 22px; }
            #codexOverlay .codex-entry { border-left: 1px solid rgba(192,160,96,0.35); padding: 4px 0 4px 16px; margin-bottom: 20px; }
            #codexOverlay .codex-entry h3 { font-family: var(--display); font-weight: 600; font-size: clamp(0.9rem, 2.4vw, 1.1rem); color: var(--brass-hi); letter-spacing: 0.12em; margin-bottom: 6px; }
            #codexOverlay .codex-entry h3 small { color: var(--verm); font-size: 0.68em; margin-right: 10px; letter-spacing: 0.3em; }
            #codexOverlay .codex-entry p { color: #b9a67d; font-size: clamp(0.98rem, 2vw, 1.12rem); }
            #codexOverlay .codex-entry.locked { border-left-color: rgba(90,77,58,0.4); }
            #codexOverlay .codex-entry.locked h3 { color: #3a3028; } #codexOverlay .codex-entry.locked p { color: #3a3028; font-style: italic; }
            #codexOverlay .codex-close { text-align: center; margin-top: 10px; }

            #pauseOverlay { background: rgba(4, 2, 4, 0.72); z-index: 27; }
            #pauseOverlay .pause-panel { padding: clamp(24px, 4vw, 40px) clamp(28px, 5vw, 56px); }
            #pauseOverlay h1 { font-size: clamp(1.3rem, 4vw, 2rem); letter-spacing: 0.4em; color: var(--brass-hi); margin: 8px 0 8px; }
            #pauseOverlay p { font-style: italic; color: var(--ash); margin-bottom: 24px; }

            #victoryOverlay { background: rgba(6, 3, 5, 0.95); z-index: 25; }
            #victoryOverlay .victory-panel { padding: clamp(24px, 4vw, 44px) clamp(24px, 5vw, 56px); max-width: 720px; width: 100%; }
            #victoryOverlay .victory-portrait { width: clamp(120px, 24vw, 220px); height: auto; margin: 0 auto 6px; display: block; -webkit-mask-image: linear-gradient(180deg, #000 70%, transparent); mask-image: linear-gradient(180deg, #000 70%, transparent); }
            #victoryOverlay.hollow .victory-portrait { filter: grayscale(1) brightness(0.55); }
            #victoryOverlay h1 { font-size: clamp(1.6rem, 5vw, 3rem); letter-spacing: 0.3em; color: var(--brass-hi); margin: 10px 0 18px; }
            #victoryOverlay.hollow h1 { color: var(--verm); }
            #victoryOverlay .victory-text { color: #c9b58a; margin-bottom: 28px; text-align: left; }
            #victoryOverlay .victory-text strong { color: var(--brass-hi); font-weight: 500; }

            #gameOverlay { background: rgba(9, 6, 8, 0.86); z-index: 20; }
            #gameOverlay .death-panel { padding: clamp(24px, 4vw, 44px) clamp(24px, 5vw, 56px); max-width: 640px; width: 100%; }
            #gameOverlay h1 { font-size: clamp(1.6rem, 5vw, 2.8rem); letter-spacing: 0.22em; color: var(--verm); margin: 10px 0 16px; }
            #gameOverlay .death-quote { font-style: italic; color: #c9b58a; margin-bottom: 18px; }
            #gameOverlay .death-stats { font-family: var(--display); font-size: 0.62rem; letter-spacing: 0.2em; color: var(--dim); text-transform: uppercase; margin-bottom: 26px; line-height: 2; }
            #gameOverlay .death-stats span { color: var(--ash); }
        </style>

        <div id="gs-ui">
            <div id="gs-hud-stats" class="gs-frame tight">
                <canvas id="gs-map" width="320" height="320"></canvas>
                <div class="gs-legend"><span class="l-you">\u25CF you</span><span class="l-piece">\u25CF piece of her</span><span class="l-mem">\u25CB memory</span><span class="l-shrine">\u25CF diya</span><span class="l-dead">\u25CF the dead</span><span class="l-gate">\u25C6 bridge</span></div>
                <div class="gs-row prana">
                    <span class="gs-ico"><img src="${ASSET_BASE}ui/ui_icon_flame.png" alt="" onerror="this.replaceWith('\u25C9')"></span><span>Prana</span>
                    <span class="gs-bar"><i id="hpBar" style="width:100%"></i></span>
                    <span class="gs-val"><span id="hpLabel">\u00A0</span></span>
                </div>
                <div class="gs-row soul">
                    <span class="gs-ico"><img src="${ASSET_BASE}ui/ui_icon_soul.png" alt="" onerror="this.replaceWith('\u2726')"></span><span>Amrita</span>
                    <span class="gs-bar"><i id="soulBar"></i></span>
                    <span class="gs-val"><span id="soulVal">0</span><small>/ 27</small></span>
                </div>
                <div class="gs-row mem">
                    <span class="gs-ico"><img src="${ASSET_BASE}ui/ui_icon_lotus.png" alt="" onerror="this.replaceWith('\u2740')"></span><span>Memories</span>
                    <span class="gs-pips" id="memPips"></span>
                    <span class="gs-val"><span id="memVal">0</span><small>/ 9</small></span>
                </div>
                <div class="gs-row">
                    <span class="gs-ico"><img src="${ASSET_BASE}ui/ui_icon_shard.png" alt="" onerror="this.replaceWith('\u25C8')"></span><span>Greed</span>
                    <span class="gs-note" id="gs-dropped" style="display:none">\u25C6 a piece of her lies where you fell</span>
                    <span class="gs-val"><span id="scoreVal">0</span><small>shards</small></span>
                </div>
                <div class="gs-foot">
                    <div id="gs-fallen"><span class="gs-flame"></span><span>Fallen <b id="deathVal">0</b></span></div>
                    <div id="gs-bite" class="ready"><i></i><span>Venom \u00B7 F</span></div>
                    <div id="gs-shed" class="ready"><em></em><i></i><span id="gs-shed-label">Shed \u00B7 space</span></div>
                </div>

            </div>
        </div>
        <div id="gs-act-banner">
            <div class="gs-kicker" id="gs-act">ACT I</div>
            <div class="gs-rule"><span id="gs-act-title">The Graveyard of Memory</span></div>
        </div>
        <div id="gs-controls">
            <button data-action="togglePause" title="Pause">II</button>
            <button id="gs-sound-toggle" data-action="toggleSound" title="Toggle Music">\u266B</button>
        </div>

        <div id="gs-quote"></div>
        <div id="gs-act-card">
            <div class="gs-kicker" id="actNum"></div>
            <div class="act-title" id="actTitle"></div>
            <div class="act-epi" id="actEpi"></div>
        </div>

        <div id="loadingOverlay" class="gs-overlay">
            <img class="load-logo" src="${ASSET_BASE}logo.png" alt="" />
            <div class="load-title">AMRITA</div>
            <div class="gs-kicker">The Naga\u2019s Requiem</div>
            <div class="load-bar-wrap"><div class="load-bar" id="loadBar"></div></div>
            <div class="load-hint">Awakening the forgotten ruins\u2026</div>
        </div>

        <div id="loreOverlay" class="gs-overlay">
            <div class="lore-bg"></div>
            <div class="lore-edge"></div>
            <img class="lore-portrait" src="${ASSET_BASE}naagraj.png" alt="" onerror="this.style.display='none'" />
            <div class="lore-inner">
                <div class="lore-col">
                    <img class="lore-logo" src="${ASSET_BASE}logo.png" alt="" />
                    <h1>AMRITA</h1>
                    <h2>The Naga\u2019s Requiem</h2>
                    <div class="lore-divider"></div>
                </div>
                <p class="lore-text lore-col">
                    You are <strong>Naagraj</strong>, Serpent King of Patala. The <strong>Nagmani</strong> was yours and you would not share it. When the Brass King came for it you chose the stone over the city, and the city burned, and your queen <strong>Amrita</strong> was broken into twenty-seven pieces and scattered through its streets. Now you crawl the ruin you made, gathering her. When she is whole, carry her over the bridge and leave this place with her. There is no other way out.
                </p>
                <div class="lore-rites gs-frame tight lore-col">
                    <h3>The Rites</h3>
                    <ul>
                        <li class="soul"><i>\u2726</i><span>Gather the <strong>27 pieces of Amrita</strong> from the precincts off the streets. The thread of her light shows the nearest.</span></li>
                        <li class="mem"><i>\u2740</i><span>Nine <strong>Memories</strong> wait at the city\u2019s landmarks. They are the story. She will know if you skipped them.</span></li>
                        <li><i>\u25C8</i><span><strong>Nagmani shards</strong> lie in the streets. Each makes you longer and brighter, and the dead smell it on you. That hunger is what did this.</span></li>
                        <li><i>\u27E1</i><span>The city only stops you; only the dead wear down your <strong>prana</strong>. Fall, and you drop her last piece where you lay and wake longer. <strong>Strike</strong> with F: fangs up close, homing venom at range. <strong>Bells</strong> scatter them, <strong>shed</strong> slips through.</span></li>
                        <li class="fire"><i>\u25C9</i><span>Leave by the <strong>Victoria Bridge</strong> in the north-west, over the river. It will not take you without her.</span></li>
                    </ul>
                </div>
                <p class="lore-stats lore-col" id="loreStats"></p>
                <div class="gs-btn-row">
                    <button class="gs-btn" data-action="beginDescent" id="loreBeginBtn">Begin Descent</button>
                    <button class="gs-btn ghost" data-action="resetRun" id="loreResetBtn">Start Over</button>
                    <button class="gs-btn ghost" data-action="openCodex" id="loreCodexBtn">Read the Memories</button>
                </div>
                <p class="lore-controls lore-col">
                    <kbd>WASD</kbd> <kbd>Arrows</kbd> <b>move</b> \u00B7 <kbd>F</kbd> <b>strike</b> \u00B7 <kbd>Space</kbd> <b>shed</b> \u00B7 <kbd>P</kbd> <b>pause</b>
                </p>
            </div>
        </div>

        <div id="memoryOverlay" class="gs-overlay">
            <div class="mem-panel gs-frame">
                <img class="mem-portrait" src="${ASSET_BASE}amrita.png" alt="" onerror="this.style.display='none'" />
                <div class="mem-body">
                    <div class="gs-kicker" id="memKicker">Memory I of IX</div>
                    <h2 id="memTitle"></h2>
                    <p id="memText"></p>
                    <div class="mem-reward">Her memory tethers her \u00B7 +5 soul shards</div>
                    <button class="gs-btn" data-action="closeMemory">Carry It</button>
                </div>
            </div>
        </div>

        <div id="codexOverlay" class="gs-overlay">
            <div class="codex-inner gs-frame">
                <h1>The Nine Memories</h1>
                <div class="codex-sub gs-kicker" id="codexSub"></div>
                <div class="gs-divider"></div>
                <div id="codexList"></div>
                <div class="codex-close"><button class="gs-btn ghost" data-action="closeCodex">Close</button></div>
            </div>
        </div>

        <div id="pauseOverlay" class="gs-overlay">
            <div class="pause-panel gs-frame">
                <div class="gs-kicker">Patala holds its breath</div>
                <h1>STILL</h1>
                <p>The curse says you may not rest. It is not watching.</p>
                <div class="gs-btn-row">
                    <button class="gs-btn" data-action="togglePause">Resume</button>
                    <button class="gs-btn ghost" data-action="openCodex">Read the Memories</button>
                </div>
            </div>
        </div>

        <div id="victoryOverlay" class="gs-overlay">
            <div class="victory-panel gs-frame">
                <img class="victory-portrait" src="${ASSET_BASE}amrita.png" alt="" onerror="this.style.display='none'" />
                <div class="gs-kicker">She is whole</div>
                <h1 id="victoryTitle">AMRITA REBORN</h1>
                <div class="gs-divider"></div>
                <p class="victory-text" id="victoryText"></p>
                <button class="gs-btn" data-action="playAgainVictory">Descend Once More</button>
            </div>
        </div>

        <div id="gameOverlay" class="gs-overlay">
            <div class="death-panel gs-frame">
                <div class="gs-kicker">The coil goes slack</div>
                <h1>The Abyss Claims You</h1>
                <div class="gs-divider"></div>
                <p class="death-quote" id="deathQuote"></p>
                <p class="death-stats" id="deathStats"></p>
                <button class="gs-btn" data-action="restartGame">Awaken To Suffer</button>
            </div>
        </div>

        <button id="gs-shed-btn" data-action="shedSkin">SHED</button>
        <button id="gs-bite-btn">STRIKE</button>
        <canvas id="gameCanvas"></canvas>
    </div>
    `;
}

function initGothicSnakeRPG() {
    let loadTimer = null;      // loading-overlay fade
    let ambientKick = null;    // first ambient quote
    let actCardTimer = null;
    const save = loadSave();
    save.runs++;
    writeSave(save);

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const $ = id => document.getElementById(id);
    const scoreUI = $('scoreVal');
    const soulUI = $('soulVal');
    const memUI = $('memVal');
    const shedUI = $('gs-shed');
    const shedBtn = $('gs-shed-btn');
    const overlay = $('gameOverlay');
    const victoryOvl = $('victoryOverlay');
    const loreOvl = $('loreOverlay');
    const loadingOvl = $('loadingOverlay');
    const loadBar = $('loadBar');
    const memoryOvl = $('memoryOverlay');
    const codexOvl = $('codexOverlay');
    const pauseOvl = $('pauseOverlay');
    const actCard = $('gs-act-card');

    overlay.style.display = 'none';
    if (victoryOvl) victoryOvl.style.display = 'none';
    if (memoryOvl) memoryOvl.style.display = 'none';
    if (codexOvl) codexOvl.style.display = 'none';
    if (pauseOvl) pauseOvl.style.display = 'none';
    if (loreOvl) loreOvl.style.display = 'none';          // loading screen takes priority
    if (loadingOvl) { loadingOvl.style.display = _loreShown ? 'none' : 'flex'; loadingOvl.style.opacity = '1'; }
    if ($('gs-act')) $('gs-act').textContent = 'ACT I';
    const loreStats = $('loreStats');
    const runSaved = save.run;
    if (loreStats) {
        loreStats.innerHTML = runSaved
            ? `Pieces carried <span>${(runSaved.pieces || []).length} / 27</span> \u00B7 Memories <span>${save.memories.length} / 9</span> \u00B7 Fallen <span>${runSaved.deaths || 0}</span> \u00B7 Shards swallowed <span>${runSaved.greed || 0}</span>`
            : `Memories recovered <span>${save.memories.length} / 9</span> \u00B7 Ascensions <span>${save.endings}</span>` + (save.trueEnding ? ' \u00B7 <span>She remembers you.</span>' : '');
    }
    const loreCodexBtn = $('loreCodexBtn');
    if (loreCodexBtn) loreCodexBtn.style.display = save.memories.length ? '' : 'none';
    const loreResetBtn = $('loreResetBtn');
    if (loreResetBtn) loreResetBtn.style.display = runSaved ? '' : 'none';
    const loreBeginBtn = $('loreBeginBtn');
    if (loreBeginBtn) loreBeginBtn.textContent = runSaved ? 'Continue the Descent' : 'Begin Descent';

    // The canvas renders at a capped internal resolution and is stretched to the window by CSS:
    // every frame repaints the whole screen several times over (floor, fog, glows), so the pixel
    // count is what the frame time is made of. The painterly art hides the upscale.
    let quality = 2;             // 2 full, 1 fewer motes, 0 no small glows: set from the measured frame time
    let W, H, viewScale = 1;
    const PIXEL_BUDGET = [0.9e6, 1.3e6, 1.75e6]; // by quality level
    function resize() {
        const cw = window.innerWidth, ch = window.innerHeight;
        viewScale = Math.min(1, Math.sqrt(PIXEL_BUDGET[quality] / (cw * ch)));
        canvas.width = Math.round(cw * viewScale);
        canvas.height = Math.round(ch * viewScale);
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        W = canvas.width; H = canvas.height;
        if (fogCanvas) buildFog();
    }
    window.addEventListener('resize', resize);

    // ═══ FOG OF WAR (tightens with each act, loosens briefly when a bell rings) ═══
    let actIdx = 0;
    const fogCanvas = document.createElement('canvas');
    const fogCtx = fogCanvas.getContext('2d');
    let fogBoost = 0; // 0..1, set by bells, decays
    function buildFog() {
        const act = ACTS[actIdx];
        fogCanvas.width = W;
        fogCanvas.height = H;
        fogCtx.clearRect(0, 0, W, H);
        const g = fogCtx.createRadialGradient(W / 2, H / 2, act.fogInner, W / 2, H / 2, act.fogOuter);
        g.addColorStop(0, 'rgba(8, 5, 7, 0)');
        g.addColorStop(0.5, 'rgba(8, 5, 7, 0.18)');
        g.addColorStop(0.8, 'rgba(8, 5, 7, 0.6)');
        g.addColorStop(1, 'rgba(8, 5, 7, 0.9)');
        fogCtx.fillStyle = g;
        fogCtx.fillRect(0, 0, W, H);
        if (assets.fog.complete && assets.fog.naturalWidth) stampFogTexture();
    }
    function stampFogTexture() {
        const fogPat = fogCtx.createPattern(assets.fog, 'repeat');
        fogCtx.globalAlpha = 0.08;
        fogCtx.globalCompositeOperation = 'lighter';
        fogCtx.fillStyle = fogPat;
        fogCtx.fillRect(0, 0, W, H);
        fogCtx.globalAlpha = 1;
        fogCtx.globalCompositeOperation = 'source-over';
    }

    // ═══ ASSETS ═══
    const floorImg = new Image();  // old floor, fetched only if the v2 floor is missing
    const puddleImg = new Image(); // old puddle, likewise

    const assets = {};
    const ASSET_FILES = {
        pillar: 'pillar.png', bell: 'bell.png', shrine: 'shrine.png', shrine2: 'shrine_2.png',
        food: 'food.png', enemy: 'enemy.png', tree1: 'tree1.png', tree2: 'tree2.png', tree3: 'tree3.png',
        fog: 'fog.png', snakeHead: 'snake_head.png', snakeBody: 'snake_body.png', snakeTail: 'snake_tail.png',
        fallenStatue: 'fallen_statue.png', fallenStatue1: 'fallen_statue_1.png', soulShard: 'soul_shard.png',
        hunter: 'enemy_hunter.png', drowned: 'enemy_drowned.png', sentinel: 'enemy_sentinel.png',
        memoryLotus: 'memory_lotus.png', diya: 'diya.png',
    };
    const V1_FALLBACK_OF = { // v2 key -> v1 key, loaded only if the v2 file is missing
        shrineA: 'shrine', shrineB: 'shrine2', pillar: 'pillar', pillarBroken: 'pillar', bell: 'bell',
        treeA: 'tree1', treeB: 'tree2', treeC: 'tree3', statueA: 'fallenStatue', statueB: 'fallenStatue1', diya: 'diya',
        shard: 'food', soul: 'soulShard', lotus: 'memoryLotus',
        wraithWalk: 'enemy', hunterWalk: 'hunter', drownedWalk: 'drowned', sentinelWalk: 'sentinel',
    };
    for (const k of Object.keys(ASSET_FILES)) assets[k] = new Image();
    for (const k of ['fog', 'snakeHead', 'snakeBody', 'snakeTail']) assets[k].src = ASSET_BASE + ASSET_FILES[k]; // the snake keeps its original art
    const loadV1 = k => { if (assets[k] && !assets[k].src) assets[k].src = ASSET_BASE + ASSET_FILES[k]; };
    // the coherent world set (one camera, one light), generated by tools/gen_snake_assets.mjs --set world.
    // Anything missing falls back to the old sprite of the same role, then to procedural drawing.
    const V2 = {};
    const V2_FILES = {
        floorStone: 'floor_stone.png', floorRoots: 'floor_stone_roots.png', floorWet: 'floor_stone_wet.png', floorAsh: 'floor_stone_ash.png',
        decalPuddle: 'decal_puddle.png', decalRubble: 'decal_rubble.png', decalRoots: 'decal_roots.png',
        floorRoad: 'floor_road.png', roadBroken: 'decal_road_broken.png', pileA: 'decal_snake_pile_a.png', pileB: 'decal_snake_pile_b.png',
        bloodA: 'decal_blood_a.png', bloodB: 'decal_blood_b.png', smoke: 'fx_smoke.png',
        floorRuin: 'floor_ruin.png', floorWater: 'floor_water.png', gate: 'gate.png', warA: 'decal_war_a.png', warB: 'decal_war_b.png',
        fxBolt: 'fx_venom_bolt.png', fxVenom: 'fx_venom_burst.png', fxBlood: 'fx_blood_burst.png', fxSigil: 'fx_sigil.png', fxSlash: 'fx_slash.png',
        shrineA: 'shrine_a.png', shrineB: 'shrine_b.png', pillar: 'pillar.png', pillarBroken: 'pillar_broken.png', bell: 'bell_fallen.png',
        treeA: 'tree_a.png', treeB: 'tree_b.png', treeC: 'tree_c.png', statueA: 'statue_a.png', statueB: 'statue_b.png', diya: 'diya.png',
        shard: 'pickup_shard.png', soul: 'pickup_soul.png', lotus: 'pickup_lotus.png',
        wraithWalk: 'wraith_walk.png', hunterWalk: 'hunter_walk.png', drownedWalk: 'drowned_walk.png', sentinelWalk: 'sentinel_walk.png',
    };
    for (const [k, f] of Object.entries(V2_FILES)) {
        V2[k] = new Image();
        if (V1_FALLBACK_OF[k]) V2[k].addEventListener('error', () => loadV1(V1_FALLBACK_OF[k]), { once: true });
        if (k === 'floorStone') V2[k].addEventListener('error', () => { floorImg.src = ASSET_BASE + 'floor-tile.png'; }, { once: true });
        if (k === 'decalPuddle') V2[k].addEventListener('error', () => { puddleImg.src = ASSET_BASE + 'floor-tile-puddle.png'; }, { once: true });
        V2[k].src = ASSET_BASE + 'v2/' + f;
    }
    const pick = (...imgs) => { for (const i of imgs) if (i && i.complete && i.naturalWidth > 0) return i; return null; };
    const ready = img => img.complete && img.naturalWidth > 0;

    resize(); // fog vars exist now

    // ═══ LOADING SCREEN ═══
    const allImages = [assets.fog, assets.snakeHead, assets.snakeBody, assets.snakeTail, ...Object.values(V2)];
    let loadedCount = 0;
    function onAssetLoaded() {
        loadedCount++;
        if (loadBar) loadBar.style.width = Math.round((loadedCount / allImages.length) * 100) + '%';
        if (loadedCount >= allImages.length) onAllAssetsReady();
    }
    function onAllAssetsReady() {
        if (loadingOvl && !_loreShown) {
            loadingOvl.style.transition = 'opacity 0.6s ease';
            loadingOvl.style.opacity = '0';
            loadTimer = setTimeout(() => {
                loadingOvl.style.display = 'none';
                if (loreOvl && !_loreShown) loreOvl.style.display = 'flex';
            }, 600);
        } else if (loreOvl && !_loreShown) {
            loreOvl.style.display = 'flex';
        }
    }
    allImages.forEach(img => {
        if (ready(img)) onAssetLoaded();
        else {
            img.addEventListener('load', onAssetLoaded, { once: true });
            img.addEventListener('error', onAssetLoaded, { once: true });
        }
    });
    if (ready(assets.fog)) stampFogTexture();
    else assets.fog.addEventListener('load', stampFogTexture, { once: true });

    // ═══════════════════════════════════════════════════════════════════
    // DIALOGUE / QUOTE SYSTEM
    // ═══════════════════════════════════════════════════════════════════
    const quoteEl = $('gs-quote');
    const deathQuoteEl = $('deathQuote');
    let quoteTimer = null;
    const lastQuoteIdx = {};

    function pickFrom(arr, key) {
        if (!arr || arr.length === 0) return '';
        let idx;
        do { idx = Math.floor(Math.random() * arr.length); }
        while (idx === lastQuoteIdx[key] && arr.length > 1);
        lastQuoteIdx[key] = idx;
        return arr[idx];
    }
    function pickQuote(category) {
        if (category === 'act') return pickFrom(QUOTES.act[actIdx], 'act' + actIdx);
        return pickFrom(QUOTES[category], category);
    }
    // the line is drawn on the canvas above his head, where the player is already looking
    let speech = null; // { lines, start, until }
    let lastSpoke = -1e9;
    const URGENT = new Set(['drop', 'recover', 'gate', 'piece', 'memory', 'act', 'empty']);
    const QUIET_MS = 9000; // the least silence between two lines that are not urgent
    function showQuote(category, duration) {
        duration = duration || 4500;
        const now = performance.now();
        if (!URGENT.has(category) && (speech || now - lastSpoke < QUIET_MS)) return;
        const text = pickQuote(category);
        if (!text) return;
        lastSpoke = now;
        speech = { text: '“' + text + '”', lines: null, start: now, until: now + duration + 900 };
    }
    function drawSpeech() {
        if (!speech) return;
        const now = performance.now();
        if (now > speech.until) { speech = null; return; }
        const a = Math.min(1, (now - speech.start) / 350) * Math.min(1, (speech.until - now) / 900);
        const size = Math.max(15, Math.min(21, W / 64));
        ctx.font = `italic ${size}px 'Cormorant Garamond', Georgia, serif`;
        if (!speech.lines) {
            // wrap to a readable width
            const maxW = Math.min(W * 0.6, 440);
            const words = speech.text.split(' '), lines = [];
            let line = '';
            for (const w of words) {
                const t = line ? line + ' ' + w : w;
                if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
            }
            if (line) lines.push(line);
            speech.lines = lines;
        }
        const lh = size * 1.35;
        const widest = Math.max(...speech.lines.map(l => ctx.measureText(l).width));
        const x = W / 2, top = H / 2 - 86 - speech.lines.length * lh, bh = speech.lines.length * lh;
        ctx.save();
        ctx.globalAlpha = a;
        // a soft dark breath behind the words, not a box
        const g = ctx.createRadialGradient(x, top + bh / 2, 0, x, top + bh / 2, widest * 0.75 + 60);
        g.addColorStop(0, 'rgba(6,3,5,0.78)'); g.addColorStop(0.7, 'rgba(6,3,5,0.45)'); g.addColorStop(1, 'rgba(6,3,5,0)');
        ctx.fillStyle = g; ctx.fillRect(x - widest - 80, top - 50, widest * 2 + 160, bh + 110);
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#eadbb0';
        ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 8;
        speech.lines.forEach((l, i) => ctx.fillText(l, x, top + i * lh));
        ctx.shadowBlur = 0;
        // the rule beneath, tapering out, with a diamond at its centre
        const ry = top + bh + 10, hw = widest / 2 + 10;
        const lg = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
        lg.addColorStop(0, 'rgba(192,160,96,0)'); lg.addColorStop(0.5, 'rgba(192,160,96,0.7)'); lg.addColorStop(1, 'rgba(192,160,96,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - hw, ry, hw * 2, 1);
        ctx.fillStyle = '#c0a060';
        ctx.save(); ctx.translate(x, ry + 0.5); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
        ctx.restore();
    }

    let ambientInterval = null;
    function startAmbientQuotes() {
        ambientKick = setTimeout(() => { if (_loreShown) showQuote('act', 5000); }, 3000);
        ambientInterval = setInterval(() => {
            if (isDead || paused || !_loreShown) return;
            const roll = Math.random();
            if (roll < 0.35) showQuote('act', 5000);
            else if (roll < 0.6) showQuote('ambient', 5000);
            else if (roll < 0.75) showQuote('spirit', 5000);
            else if (roll < 0.88) showQuote('enemy', 5000);
            else showQuote('growth', 5000);
        }, 30000 + Math.random() * 20000);
    }
    startAmbientQuotes();

    // ═══════════════════════════════════════════════════════════════════
    // CORE STATE
    // ═══════════════════════════════════════════════════════════════════
    const CW = 800;          // chunk size in px (16 city cells)
    const SS = 30;           // snake segment size
    const SG = 8;            // trail samples between segments
    const SPEED = 3.4;
    const TURN_SPEED = 0.09;
    const LEN_MAX = 320;     // the coil's ceiling, for the frame rate's sake and his
    const PIECES_TOTAL = 27; // the pieces of Amrita's soul
    const city = buildCity();
    const CELL = city.CELL;
    const DEBUG_ENEMIES = new URLSearchParams(location.search).get('debug') === 'enemies';
    const debugLen = parseInt(new URLSearchParams(location.search).get('len') || '', 10);
    const debugAct = parseInt(new URLSearchParams(location.search).get('act') || '', 10);

    let isDead = false;          // the run is over: he has left the city
    let paused = false;
    let memoryOpen = false;
    let greed = 0;               // Nagmani shards swallowed
    const HP_MAX = 100;
    let hp = HP_MAX;             // prana: what the dead take from him before he falls
    let hurtCd = 0;              // frames of immunity after a wound
    let hurtFlash = 0;           // the screen's red answer to a wound
    const DAMAGE = { wraith: 22, hunter: 30, drowned: 34, sentinel: 45 };
    let deaths = 0;
    let grace = 0;               // frames of invulnerability after waking
    let checkpoint = null;       // { x, y, angle } at the last lit shrine
    let shrinesLit = 0;
    let bellsRung = 0;
    let banished = 0;
    let gateWarnedAt = -1e9;
    let bumpCooldown = 0;
    const piecesFound = [];      // ids of the pieces of Amrita he carries
    const landmarksTaken = [];   // landmark indices whose Memory has been lifted
    let dropped = null;          // { id, x, y } : the piece that fell from him when he last fell
    const memoriesFound = save.memories.slice(); // persisted across everything
    const shed = { active: 0, cd: 0 };
    const bite = { active: 0, cd: 0 };   // the King's fangs: a short snap at what is within reach
    const BITE_FRAMES = 6, BITE_CD = 18, BITE_SPEED = 1.6, BITE_REACH = 100;
    // venom: spat as a homing bolt at anything ahead; refills with time and with the stone
    const VENOM_MAX = 100, SPIT_COST = 20, VENOM_REGEN = 0.14;
    let venom = VENOM_MAX;
    const bolts = [];
    const fx = [];
    // kind: sprite key; light: additive blend; size0 -> size1 over life; spin per frame; rot: facing
    function spawnFx(kind, x, y, { size0 = 40, size1 = 120, life = 22, spin = 0, rot = 0, light = true, alpha = 1, delay = 0 } = {}) {
        fx.push({ kind, x, y, size0, size1, life, maxLife: life, spin, rot, light, alpha, delay });
    }
    function updateFx() {
        for (let i = fx.length - 1; i >= 0; i--) {
            const f = fx[i];
            if (f.delay > 0) { f.delay--; continue; }
            f.rot += f.spin;
            if (--f.life <= 0) fx.splice(i, 1);
        }
    }
    function renderFx() {
        for (const f of fx) {
            if (f.delay > 0) continue;
            const img = pick(V2[f.kind]);
            const t = 1 - f.life / f.maxLife;
            const size = f.size0 + (f.size1 - f.size0) * t;
            const a = f.alpha * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
            ctx.save();
            ctx.globalAlpha = Math.max(0, a);
            ctx.globalCompositeOperation = f.light ? 'lighter' : 'multiply'; // blood darkens the ground; light adds to it
            ctx.translate(f.x, f.y); ctx.rotate(f.rot);
            if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
            else { ctx.strokeStyle = f.light ? '#e6cf8f' : '#5a1a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.stroke(); }
            ctx.restore();
        }
    }
    const ENEMY_HP = { wraith: 1, hunter: 2, drowned: 1, sentinel: 4 };
    const SHED_COST = 3, SHED_FRAMES = 48, SHED_CD = 240, SHED_MIN_LEN = 9, SHED_SPEED = 1.9;
    const bellRings = [];        // transient toll rings for rendering
    let shake = 0;               // camera shake from Sentinel footfalls
    let frameMs = 16;            // smoothed frame time
    const motes = [];            // ash motes drifting in screen space
    let time = 0;

    const sn = { x: city.spawn.x, y: city.spawn.y, angle: Math.PI / 2, targetAngle: Math.PI / 2, len: 10 };
    // the body's position history: a ring buffer, because the coil grows to thousands of segments
    const trail = {
        cap: 4096, n: 0, head: 0,
        x: new Float32Array(4096), y: new Float32Array(4096), a: new Float32Array(4096),
        push(x, y, a) { this.head = (this.head + 1) % this.cap; this.x[this.head] = x; this.y[this.head] = y; this.a[this.head] = a; if (this.n < this.cap) this.n++; },
        get(i) { if (i >= this.n) return null; const k = (this.head - i + this.cap) % this.cap; return { x: this.x[k], y: this.y[k], a: this.a[k] }; },
        clear() { this.n = 0; },
        trim(max) { if (this.n > max) this.n = max; },
    };
    const keys = { w: false, a: false, s: false, d: false, fire: false };
    const explored = new Uint8Array(city.GRID * city.GRID); // what the minimap may show

    // ── the run persists: this is one long search, not a score attack ──
    function packExplored() {
        const bytes = new Uint8Array(Math.ceil(explored.length / 8));
        for (let i = 0; i < explored.length; i++) if (explored[i]) bytes[i >> 3] |= 1 << (i & 7);
        let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin);
    }
    function unpackExplored(str) {
        try { const bin = atob(str); for (let i = 0; i < explored.length; i++) explored[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1; } catch (_) { /* a fresh map then */ }
    }
    function saveRun() {
        save.run = { pieces: piecesFound.slice(), landmarks: landmarksTaken.slice(), greed, deaths, dropped, checkpoint, len: sn.len, shrinesLit, hp, explored: packExplored() };
        writeSave(save);
    }
    function loadRun() {
        const r = save.run;
        if (!r) return false;
        piecesFound.push(...(r.pieces || []));
        landmarksTaken.push(...(r.landmarks || []));
        greed = r.greed || 0; deaths = r.deaths || 0; dropped = r.dropped || null; checkpoint = r.checkpoint || null;
        sn.len = Math.min(LEN_MAX, Math.max(10, r.len || 10)); shrinesLit = r.shrinesLit || 0; hp = Math.min(HP_MAX, Math.max(20, r.hp ?? HP_MAX));
        if (r.explored) unpackExplored(r.explored);
        if (checkpoint) { sn.x = checkpoint.x; sn.y = checkpoint.y; sn.angle = sn.targetAngle = checkpoint.angle; }
        return true;
    }
    const resumed = loadRun();
    if (debugAct >= 1 && debugAct < ACTS.length) for (let i = 0; i < ACTS[debugAct].at; i++) piecesFound.push(city.pieces[i].piece);
    if (debugLen > 10) sn.len = debugLen;
    const debugGreed = parseInt(new URLSearchParams(location.search).get('greed') || '', 10);
    if (debugGreed > 0) greed = debugGreed;

    // ═══════════════════════════════════════════════════════════════════
    // PARTICLES
    // ═══════════════════════════════════════════════════════════════════
    const particles = [];
    function spawnParticles(x, y, count, opts = {}) {
        const {
            color = '#ffdf73', minSize = 2, maxSize = 6, speed = 2, lifetime = 60,
            spread = Math.PI * 2, baseAngle = -Math.PI / 2, gravity = 0, fadeOut = true,
            text = null, font = null, drag = 0.98,
        } = opts;
        for (let i = 0; i < count; i++) {
            const angle = baseAngle - spread / 2 + Math.random() * spread;
            const spd = (0.5 + Math.random()) * speed;
            particles.push({
                x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
                size: minSize + Math.random() * (maxSize - minSize),
                life: lifetime + Math.random() * 20, maxLife: lifetime + 20,
                color, gravity, fadeOut, drag,
                text: text ? text[Math.floor(Math.random() * text.length)] : null,
                font: font || null,
            });
        }
    }
    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
            p.vx *= p.drag; p.vy *= p.drag;
            if (--p.life <= 0) particles.splice(i, 1);
        }
    }
    function renderParticles() {
        let lastFont = null;
        for (const p of particles) {
            const alpha = p.fadeOut ? Math.max(0, p.life / p.maxLife) : 1;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            if (p.text) {
                const f = p.font || `${Math.round(p.size)}px serif`;
                if (f !== lastFont) { ctx.font = f; lastFont = f; }
                ctx.fillText(p.text, p.x, p.y);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    const SANSKRIT_RUNES = ['ॐ', 'अ', 'न्न', 'खा', 'द', 'पु', 'ष्टि', 'र', 'स'];
    const SOUL_RUNES = ['आ', 'त्म', 'जी', 'व', 'प्रा', 'खं', 'हं', 'ॐ'];
    const MEMORY_RUNES = ['अमृत', 'स्मृ', 'ति', 'पद्म', 'ॐ'];

    const emitSanskritRunes = (x, y) => {
        spawnParticles(x, y, 5, { color: '#d4af37', text: SANSKRIT_RUNES, font: 'bold 22px serif', minSize: 22, maxSize: 28, speed: 1.5, lifetime: 80, spread: Math.PI * 1.2, gravity: -0.02 });
        spawnParticles(x, y, 12, { color: '#ffdf73', minSize: 1, maxSize: 4, speed: 3, lifetime: 40, gravity: 0.02 });
    };
    const emitSoulShardParticles = (x, y) => {
        spawnParticles(x, y, 5, { color: '#b48ede', text: SOUL_RUNES, font: 'bold 20px serif', minSize: 20, maxSize: 26, speed: 1.5, lifetime: 70, spread: Math.PI * 1.2, gravity: -0.02 });
        spawnParticles(x, y, 10, { color: '#d4a5ff', minSize: 1, maxSize: 4, speed: 2.5, lifetime: 35, gravity: 0.01 });
    };
    const emitMemoryParticles = (x, y) => {
        spawnParticles(x, y, 7, { color: '#ffc89a', text: MEMORY_RUNES, font: 'bold 24px serif', minSize: 22, maxSize: 30, speed: 1.2, lifetime: 110, spread: Math.PI * 2, gravity: -0.03 });
        spawnParticles(x, y, 30, { color: '#fff1c9', minSize: 1, maxSize: 5, speed: 3.5, lifetime: 70, gravity: -0.01 });
    };
    const emitDeathParticles = (x, y) => {
        spawnParticles(x, y, 30, { color: '#8a1c1c', minSize: 2, maxSize: 8, speed: 4, lifetime: 50, gravity: 0.05 });
        spawnParticles(x, y, 8, { color: '#4a2860', minSize: 3, maxSize: 10, speed: 2, lifetime: 70 });
    };
    const emitShrineParticles = (x, y) => {
        spawnParticles(x, y, 18, { color: '#ffb347', minSize: 1, maxSize: 4, speed: 1.6, lifetime: 80, spread: Math.PI * 0.9, baseAngle: -Math.PI / 2, gravity: -0.03 });
        spawnParticles(x, y, 6, { color: '#fff1c9', minSize: 2, maxSize: 5, speed: 0.8, lifetime: 60, gravity: -0.04 });
    };
    const emitBanishParticles = (x, y) => {
        spawnParticles(x, y, 22, { color: '#5a4a30', minSize: 2, maxSize: 7, speed: 3.5, lifetime: 55, gravity: 0.04 });
        spawnParticles(x, y, 10, { color: '#c0a060', minSize: 1, maxSize: 3, speed: 4, lifetime: 35 });
        spawnParticles(x, y, 6, { color: '#ff3b3b', minSize: 2, maxSize: 4, speed: 2, lifetime: 30 });
    };
    const emitShedFlakes = (x, y, angle) => {
        spawnParticles(x, y, 2, { color: '#6b5a48', minSize: 2, maxSize: 5, speed: 1.2, lifetime: 45, spread: Math.PI * 0.8, baseAngle: angle + Math.PI, gravity: 0.03, drag: 0.95 });
    };

    // ═══════════════════════════════════════════════════════════════════
    // WORLD GENERATION (difficulty follows the act the chunk is born in)
    // ═══════════════════════════════════════════════════════════════════
    const world = {};
    const getChunkKey = (cx, cy) => `${cx},${cy}`;

    function makeEnemy(type, x, y, chunk) {
        const base = {
            type, x, y, homeX: x, homeY: y, ox: chunk.ox, oy: chunk.oy,
            vx: 0, vy: 0, stun: 0, timer: 0, state: 'wander', chasing: false,
            lungeAngle: 0, alive: true, face: Math.PI / 2, phase: Math.random() * 4, steerHold: 0, steerAngle: 0,
        };
        if (type === 'wraith')   return Object.assign(base, { r: 20, speed: 0.75 + Math.random() * 0.4 });
        if (type === 'hunter')   return Object.assign(base, { r: 20, speed: 0.9, chase: 1.3 + actIdx * 0.2, sense: 420 });
        if (type === 'drowned')  return Object.assign(base, { r: 22, speed: 0, state: 'lurk', sense: 240, lunge: 7 });
        if (type === 'sentinel') return Object.assign(base, { r: 34, speed: 0.9 + actIdx * 0.05, sense: 760 });
        return base;
    }

    // ═══════════════════════════════════════════════════════════════════
    // THE CITY PLAN
    // Patala is a drowned city, not a scatter of props. Every third row and column
    // of chunks is a processional avenue lined with colonnades; where avenues cross
    // there is a plaza. The blocks between are precincts with a role: a temple
    // courtyard, an overgrown garden, a ruined quarter or a flooded hall. Roles come
    // from the coordinates, so the plan is the same wherever you re-enter it.
    // ═══════════════════════════════════════════════════════════════════
    const mod = (n, m) => ((n % m) + m) % m;
    function hash(n) { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); }
    const PILLAR_R = 34, STUMP_R = 24;
    const CT = city.T;

    // which rooms have their centre in which chunk
    const roomsByChunk = new Map();
    function fileRoom(room) {
        const key = getChunkKey(Math.floor(room.x / CW), Math.floor(room.y / CW));
        if (!roomsByChunk.has(key)) roomsByChunk.set(key, []);
        roomsByChunk.get(key).push(room);
    }
    for (const r of city.rooms) fileRoom(r);
    for (const l of city.landmarks) fileRoom(Object.assign(l, { kind: 'landmark' }));
    fileRoom({ x: city.spawn.x, y: city.spawn.y, r: 350, kind: 'gardens' });
    fileRoom({ x: city.gate.x, y: city.gate.y, r: 250, kind: 'gate' });

    function genChunk(cx, cy) {
        const key = getChunkKey(cx, cy);
        if (world[key]) return;

        const chunk = {
            ox: cx * CW, oy: cy * CW, seed: Math.random() * 1e6, act: actIdx,
            obs: [], food: [], enemies: [], pieces: [], memories: [],
            shrines: [], bells: [], walls: [], trees: [], statues: [], puddles: [], rubble: [], roots: [],
            broken: [], piles: [], blood: [], smoke: [], war: [], gate: null,
            floorCanvas: null, floorStamp: -1,
        };
        const placed = [];
        function overlaps(x, y, r, margin = 10) {
            for (const p of placed) if (Math.hypot(x - p.x, y - p.y) < r + p.r + margin) return true;
            return false;
        }
        const jitter = n => (Math.random() - 0.5) * n;
        const side = d => (Math.random() < 0.5 ? -d : d);
        const walk = (x, y) => city.walkable(x, y);
        const focal = []; // pickups that must stay in clear ground
        const nearFocal = (x, y, r) => focal.some(f => Math.hypot(f.x - x, f.y - y) < r);
        // the war is thickest where he stood: dressing thins toward the fringes of the city
        const ruinScale = Math.max(0.55, 1.5 - Math.hypot(chunk.ox + CW / 2 - city.spawn.x, chunk.oy + CW / 2 - city.spawn.y) / 3200);
        // a spot on open ground inside a circle, clear of other things
        function openSpot(x0, y0, radius, r, tries = 24) {
            for (let t = 0; t < tries; t++) {
                const a = Math.random() * Math.PI * 2, d = Math.random() * radius;
                const x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d;
                if (!walk(x, y) || !walk(x - r, y) || !walk(x + r, y) || !walk(x, y - r) || !walk(x, y + r)) continue;
                if (overlaps(x, y, r, 14)) continue;
                return { x, y };
            }
            return null;
        }
        const pillar = (x, y) => { chunk.obs.push({ x, y, r: PILLAR_R, kind: 'pillar' }); placed.push({ x, y, r: PILLAR_R + 6 }); };
        const stump  = (x, y) => { chunk.obs.push({ x, y, r: STUMP_R, kind: 'stump' }); placed.push({ x, y, r: STUMP_R + 6 }); };
        const bell   = (x, y) => { chunk.bells.push({ x, y, r: 20, cd: 0 }); placed.push({ x, y, r: 30 }); };
        const tree   = (x, y, size) => { if (nearFocal(x, y, 170)) return; chunk.trees.push({ x, y, size: size || 220 + Math.random() * 80, variant: Math.floor(Math.random() * 3) + 1, sway: Math.random() * 10 }); placed.push({ x, y, r: 40 }); };
        const roots  = (x, y, size) => chunk.roots.push({ x, y, size: size || 180 + Math.random() * 80, rot: Math.random() * Math.PI * 2 });
        const puddle = (x, y, size, alpha) => chunk.puddles.push({ x, y, size, alpha: alpha || 0.6 + Math.random() * 0.3, rot: Math.random() * Math.PI * 2 });
        const rubble = (x, y, size) => chunk.rubble.push({ x, y, size: size || 100 + Math.random() * 70, rot: Math.random() * Math.PI * 2, alpha: 0.75 + Math.random() * 0.25 });
        const statue = (x, y, size, rot) => { if (nearFocal(x, y, 150 + size * 0.3)) return; chunk.statues.push({ x, y, size, variant: Math.random() > 0.5 ? 1 : 0, rot: rot ?? jitter(0.3), alpha: 0.9 }); placed.push({ x, y, r: size * 0.22 }); };
        const pile   = (x, y, size) => { if (nearFocal(x, y, 120)) return; chunk.piles.push({ x, y, size: size || 170 + Math.random() * 60, rot: Math.random() * Math.PI * 2, variant: Math.random() < 0.5 ? 0 : 1 }); placed.push({ x, y, r: 40 }); };
        const blood  = (x, y, size) => chunk.blood.push({ x, y, size: size || 120 + Math.random() * 90, rot: Math.random() * Math.PI * 2, variant: Math.random() < 0.5 ? 0 : 1, alpha: 0.75 + Math.random() * 0.25 });
        const broken = (x, y, size) => chunk.broken.push({ x, y, size: size || 200 + Math.random() * 80, rot: Math.random() < 0.5 ? 0 : Math.PI });
        const smoke  = (x, y) => { if (nearFocal(x, y, 160)) return; chunk.smoke.push({ x, y, seed: Math.random() * 100 }); };
        const war    = (x, y, size) => { if (nearFocal(x, y, 120)) return; chunk.war.push({ x, y, size: size || 180 + Math.random() * 80, rot: Math.random() * Math.PI * 2, variant: Math.random() < 0.5 ? 0 : 1 }); };
        const shrine = (x, y) => {
            chunk.shrines.push({ x, y, r: 60, variant: Math.random() > 0.5 ? 2 : 1, lit: false, flicker: Math.random() * 10 });
            chunk.obs.push({ x, y, r: 60, kind: 'shrine' });
            placed.push({ x, y, r: 90 });
        };
        const food = (x, y) => { if (walk(x, y) && !overlaps(x, y, 10, 14)) chunk.food.push({ x, y, r: 10, offset: Math.random() * 100 }); };

        // ── read the city grid for this chunk ──
        const gx0 = Math.floor(chunk.ox / CELL), gy0 = Math.floor(chunk.oy / CELL), N = CW / CELL;
        const roadCells = [], edgeCells = [], majorEdge = [];
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const gx = gx0 + i, gy = gy0 + j;
            if (!city.inside(gx, gy)) continue;
            const t = city.grid[city.idx(gx, gy)];
            const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL;
            if (t === CT.ROAD || t === CT.BRIDGE) roadCells.push({ x, y, gx, gy, major: city.major[city.idx(gx, gy)] === 1 });
            else if (t === CT.SOLID) {
                // a rubble cell with a street beside it: the street's wall
                let touches = false, nearMajor = false, dir = null;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = gx + dx, ny = gy + dy;
                    if (!city.inside(nx, ny)) continue;
                    const nt = city.grid[city.idx(nx, ny)];
                    if (nt === CT.ROAD || nt === CT.ROOM || nt === CT.BRIDGE) { touches = true; dir = [dx, dy]; if (city.major[city.idx(nx, ny)]) nearMajor = true; }
                }
                if (touches) { edgeCells.push({ x, y, gx, gy, dir }); if (nearMajor) majorEdge.push({ x, y, gx, gy, dir }); }
            }
        }

        // ── colonnades: the great streets are lined with pillars, standing just inside the rubble ──
        for (const c of majorEdge) {
            if ((c.gx + c.gy) % 3 !== 0) continue;
            if (hash(c.gx * 3.1 + c.gy * 7.7) < 0.2) { stump(c.x, c.y); rubble(c.x + jitter(50), c.y + jitter(50), 90); }
            else pillar(c.x, c.y);
        }
        // ── the rubble's edge: the war is everywhere ──
        for (const c of edgeCells) {
            const h = hash(c.gx * 1.7 + c.gy * 2.3 + chunk.seed) / ruinScale;
            if (h < 0.035) tree(c.x - c.dir[0] * 40, c.y - c.dir[1] * 40);
            else if (h < 0.042) statue(c.x - c.dir[0] * 120, c.y - c.dir[1] * 120, 420 + Math.random() * 120);
            else if (h < 0.052) smoke(c.x - c.dir[0] * 60, c.y - c.dir[1] * 60);
            else if (h < 0.068) war(c.x + c.dir[0] * 30, c.y + c.dir[1] * 30);
            else if (h < 0.09) rubble(c.x + c.dir[0] * 20, c.y + c.dir[1] * 20);
            else if (h < 0.10) pile(c.x + c.dir[0] * 60, c.y + c.dir[1] * 60);
        }
        // ── the streets themselves ──
        for (const c of roadCells) {
            const h0 = hash(c.gx * 5.3 + c.gy * 9.1 + chunk.seed * 0.01);
            if (h0 < 0.06) { food(c.x + jitter(30), c.y + jitter(30)); continue; }
            const h = 0.06 + (h0 - 0.06) / ruinScale; // the rest of the street's dressing follows the war's gradient
            if (h < 0.085) puddle(c.x, c.y, 90 + Math.random() * 70, 0.55);
            else if (h < 0.105) blood(c.x, c.y);
            else if (h < 0.115) pile(c.x, c.y);
            else if (h < 0.125) war(c.x, c.y);
            else if (h < 0.131) broken(c.x, c.y, 180);
            else if (h < 0.137 && !overlaps(c.x, c.y, 20, 30)) bell(c.x, c.y);
            else if (h < 0.147) roots(c.x, c.y, 150);
        }

        // ── the precincts: pockets off the streets, each with a purpose ──
        for (const room of roomsByChunk.get(key) || []) {
            const { x: mx, y: my, r } = room;
            if (room.kind === 'gardens') {
                // the Sunken Gardens, where he wakes: a shrine to teach the diya, two bells to teach the toll, and his dead
                shrine(mx, my - 220);
                bell(mx - 150, my + 130); bell(mx + 150, my + 130);
                pile(mx + 230, my - 100, 190); blood(mx + 170, my - 40, 170);
                war(mx - 240, my + 20);
                for (let i = 0; i < 5; i++) food(mx + Math.cos(i * 1.26 + 0.4) * 200, my + Math.sin(i * 1.26 + 0.4) * 200);
                if (DEBUG_ENEMIES) {
                    [['wraith', -260, 150], ['hunter', 260, -60], ['drowned', 230, -60], ['sentinel', 320, 220]].forEach(([t, dx, dy]) => chunk.enemies.push(makeEnemy(t, mx + dx, my + dy, chunk)));
                    puddle(mx + 230, my - 60, 110, 0.8); smoke(mx - 180, my + 40);
                    window.__nagmaniMove = (nx, ny) => { sn.x = nx * city.MAP; sn.y = ny * city.MAP; trail.clear(); grace = 200; };
                    // generate the whole city and hand it over for measurement
                    window.__nagmaniWorld = () => { for (let i = 0; i < city.GRID * CELL / CW; i++) for (let j = 0; j < city.GRID * CELL / CW; j++) genChunk(i, j); return { world, city: { rooms: city.rooms, pieces: city.pieces, landmarks: city.landmarks, spawn: city.spawn, gate: city.gate, CELL, GRID: city.GRID, grid: Array.from(city.grid) }, CW, SS, PILLAR_R }; };
                    window.__nagmani = () => ({ gateChunk: Object.values(world).some(c => c.gate), gateImg: ready(V2.gate), gateAt: city.gate, samples: soundtrack.loadedCount(), viewScale: +viewScale.toFixed(2), frameMs: +frameMs.toFixed(1), updateMs: +perf.update.toFixed(2), renderMs: +perf.render.toFixed(2), quality, segments: sn.len, canvas: [W, H], pieces: piecesFound.length, greed, deaths, snake: { x: sn.x, y: sn.y }, enemies: chunk.enemies.map(e => ({ type: e.type, x: Math.round(e.x), y: Math.round(e.y), phase: +e.phase.toFixed(2), face: +e.face.toFixed(2), state: e.state, stun: e.stun, chasing: e.chasing })) });
                }
            } else if (room.kind === 'gate') {
                // the Victoria Bridge: the gateway stands at the far end, bells hung silent in its lintel
                chunk.gate = { x: mx - 40, y: my };
                blood(mx + 120, my + 60, 140); pile(mx + 160, my - 90, 160);
                for (let i = 0; i < 3; i++) war(mx + 60 + i * 90, my + side(140), 150);
            } else if (room.kind === 'landmark') {
                // a landmark: a shrine, and the Memory that waits before it
                focal.push({ x: mx, y: my + r * 0.3 }); placed.push({ x: mx, y: my + r * 0.3, r: 60 });
                shrine(mx, my - r * 0.35);
                if (!landmarksTaken.includes(room.index) && memoriesFound.length + (PIECES_TOTAL - PIECES_TOTAL) < MEMORIES.length) {
                    chunk.memories.push({ x: mx, y: my + r * 0.3, r: 16, offset: Math.random() * 100, landmark: room.index });
                }
                bell(mx - r * 0.55, my + r * 0.1); bell(mx + r * 0.55, my + r * 0.1);
                blood(mx + side(r * 0.4), my + r * 0.5, 130); pile(mx + side(r * 0.5), my - r * 0.6 + 40, 150);
                for (let i = 0; i < 2; i++) { const q = openSpot(mx, my, r * 0.8, 10); if (q) food(q.x, q.y); }
            } else {
                // a precinct holding a piece of her, or just a place where people lived
                const holdsPiece = room.piece !== undefined && !piecesFound.includes(room.piece) && !(dropped && dropped.id === room.piece);
                if (holdsPiece) {
                    chunk.pieces.push({ x: mx, y: my, r: 16, offset: Math.random() * 100, id: room.piece });
                }
                if (room.piece !== undefined) { focal.push({ x: mx, y: my }); placed.push({ x: mx, y: my, r: 70 }); }
                if (room.kind === 'courtyard') {
                    shrine(mx, my - r * 0.4);
                    bell(mx - r * 0.5, my + r * 0.05); bell(mx + r * 0.5, my + r * 0.05);
                    puddle(mx - r * 0.55, my + r * 0.45, 130, 0.6);
                    if (Math.random() < 0.6) pile(mx + side(r * 0.3), my + r * 0.55);
                    blood(mx + side(r * 0.4), my + r * 0.2, 130);
                } else if (room.kind === 'garden') {
                    puddle(mx, my + r * 0.3, r * 0.9, 0.8); roots(mx + 40, my + r * 0.3, r * 1.1);
                    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.6; tree(mx + Math.cos(a) * (r + 90), my + Math.sin(a) * (r + 90), 200 + Math.random() * 60); }
                    if (Math.random() < 0.3) pile(mx + side(r * 0.5), my - r * 0.5, 150);
                } else if (room.kind === 'ruin') {
                    statue(mx + side(r * 0.6), my - r * 0.75, 420 + Math.random() * 80);
                    for (let i = 0; i < 2; i++) { const q = openSpot(mx, my, r * 0.7, STUMP_R); if (q) stump(q.x, q.y); }
                    pile(mx + side(r * 0.5), my + r * 0.4); blood(mx + jitter(r), my + jitter(r)); war(mx + side(r * 0.4), my - r * 0.2);
                    smoke(mx + jitter(r), my + jitter(r));
                } else if (room.kind === 'flooded') {
                    puddle(mx, my, r * 1.5, 0.9); puddle(mx + side(r * 0.6), my + side(r * 0.6), 160, 0.8);
                    for (let i = 0; i < 2; i++) { const q = openSpot(mx, my, r * 0.75, PILLAR_R); if (q) pillar(q.x, q.y); }
                    if (Math.random() < 0.4) pile(mx + side(r * 0.5), my + side(r * 0.5), 150);
                    smoke(mx + jitter(r * 0.5), my + jitter(r * 0.5));
                }
                for (let i = 0; i < 2; i++) { const q = openSpot(mx, my, r * 0.8, 10); if (q) food(q.x, q.y); }
                if (holdsPiece && !(DEBUG_ENEMIES && Math.hypot(mx - city.spawn.x, my - city.spawn.y) < 900)) {
                    const guards = actIdx >= 2 ? 2 : 1;
                    for (let g = 0; g < guards; g++) {
                        let type = 'wraith';
                        if (room.kind === 'flooded' && actIdx >= 1) type = 'drowned';
                        else if (actIdx >= 1 && (room.kind === 'courtyard' || room.kind === 'ruin' || g === 1)) type = 'hunter';
                        if (actIdx >= 3 && room.kind === 'ruin' && g === 0) type = 'sentinel';
                        const a = Math.random() * Math.PI * 2, d = r * 0.6;
                        const gx = mx + Math.cos(a) * d, gy = my + Math.sin(a) * d;
                        if (type === 'drowned') { const pud = chunk.puddles.find(pp => Math.hypot(pp.x - mx, pp.y - my) < r) || { x: gx, y: gy }; chunk.enemies.push(makeEnemy(type, pud.x, pud.y, chunk)); continue; }
                        if (walk(gx, gy)) chunk.enemies.push(makeEnemy(type, gx, gy, chunk));
                    }
                }
            }
        }

        // ── the Brass King's dead: more of them the deeper he goes and the more of the stone he has swallowed ──
        const onRoad = roadCells.length;
        if (onRoad > 6 && !(DEBUG_ENEMIES && roomsByChunk.get(key)?.some(r => r.kind === 'gardens'))) {
            const nearGardens = Math.hypot(chunk.ox + CW / 2 - city.spawn.x, chunk.oy + CW / 2 - city.spawn.y) < 900;
            let budget = [0.45, 0.9, 1.3, 1.7][actIdx] + Math.min(1, greed / 180) * 0.9;
            if (nearGardens) budget *= 0.4;
            const roster = [];
            while (budget > 0) { if (Math.random() < Math.min(1, budget)) roster.push('x'); budget -= 1; }
            for (let i = 0; i < roster.length; i++) {
                const roll = Math.random();
                let type = 'wraith';
                if (actIdx >= 1 && roll < 0.45) type = 'hunter';
                if (actIdx >= 2 && chunk.puddles.length && roll > 0.7) type = 'drowned';
                if (actIdx >= 3 && roll > 0.88 && roadCells.some(c => c.major)) type = 'sentinel';
                if (greed > 120 && roll < 0.6) type = 'hunter';
                if (type === 'drowned') {
                    const pud = chunk.puddles[Math.floor(Math.random() * chunk.puddles.length)];
                    if (pud && walk(pud.x, pud.y)) chunk.enemies.push(makeEnemy(type, pud.x, pud.y, chunk));
                    continue;
                }
                const c = roadCells[Math.floor(Math.random() * roadCells.length)];
                if (Math.hypot(c.x - sn.x, c.y - sn.y) < 420) continue; // never in his face
                chunk.enemies.push(makeEnemy(type, c.x + jitter(20), c.y + jitter(20), chunk));
            }
        }

        world[key] = chunk;
    }


    // ═══════════════════════════════════════════════════════════════════
    // ENEMY BEHAVIOUR (the streets are walls to them as well)
    // ═══════════════════════════════════════════════════════════════════
    // the streets steer the dead as they steer him: the nearest open heading to the one wanted,
    // held for a while so a corner does not make them shiver between two walls
    function clearFor(e, x, y) {
        const r = e.r * 0.55;
        return city.walkable(x, y) && city.walkable(x + r, y) && city.walkable(x - r, y) && city.walkable(x, y + r) && city.walkable(x, y - r);
    }
    function stepToward(e, want, speed) {
        if (e.steerHold > 0) { e.steerHold--; want = e.steerAngle; }
        const offsets = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.1, -2.1, Math.PI];
        for (const off of offsets) {
            const a = want + off;
            const nx = e.x + Math.cos(a) * speed, ny = e.y + Math.sin(a) * speed;
            if (!clearFor(e, nx, ny)) continue;
            e.x = nx; e.y = ny;
            if (off !== 0 && e.steerHold <= 0) { e.steerAngle = a; e.steerHold = 18; } // commit to the detour for a few steps
            return true;
        }
        return false;
    }
    function wander(e) {
        if (--e.timer <= 0) {
            e.heading = Math.random() * Math.PI * 2;
            e.timer = 90 + Math.random() * 120;
        }
        if (e.heading === undefined) e.heading = Math.random() * Math.PI * 2;
        if (!stepToward(e, e.heading, e.speed)) { e.heading = Math.random() * Math.PI * 2; e.timer = 60 + Math.random() * 60; }
    }
    function seek(e, speed) {
        const a = Math.atan2(sn.y - e.y, sn.x - e.x);
        stepToward(e, a, speed);
    }
    function updateEnemy(e) {
        if (e.stun > 0) { e.stun--; return; }
        const px = e.x, py = e.y;
        stepEnemy(e);
        const moved = Math.hypot(e.x - px, e.y - py);
        if (moved > 0.05) {
            const target = Math.atan2(e.y - py, e.x - px);
            let d = target - e.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
            e.face += d * 0.25;
            const stride = e.type === 'sentinel' ? 26 : e.type === 'hunter' ? 11 : 16;
            const before = Math.floor(e.phase);
            e.phase += moved / stride;
            if (e.type === 'sentinel' && Math.floor(e.phase) !== before) {
                const d = Math.hypot(sn.x - e.x, sn.y - e.y);
                if (d < 600) { shake = Math.max(shake, 5 * (1 - d / 600)); soundtrack.sfxStomp(1 - d / 600); }
            }
        }
    }
    function stepEnemy(e) {
        const d = Math.hypot(sn.x - e.x, sn.y - e.y);
        const canSense = grace <= 0 && !shed.active;
        const senseBoost = 1 + Math.min(0.5, greed / 300); // the stone on him carries
        switch (e.type) {
            case 'wraith':
                wander(e);
                break;
            case 'hunter': {
                const wasChasing = e.chasing;
                e.chasing = canSense && d < e.sense * senseBoost;
                if (e.chasing) {
                    seek(e, e.chase);
                    if (!wasChasing && Math.random() < 0.15) showQuote('hunter', 3500);
                } else wander(e);
                break;
            }
            case 'drowned':
                if (e.state === 'lurk') {
                    if (canSense && d < e.sense) { e.state = 'wind'; e.timer = 28; }
                } else if (e.state === 'wind') {
                    e.lungeAngle = Math.atan2(sn.y - e.y, sn.x - e.x);
                    if (--e.timer <= 0) { e.state = 'lunge'; e.timer = 30; soundtrack.sfxLunge(); if (Math.random() < 0.3) showQuote('drowned', 3500); }
                } else if (e.state === 'lunge') {
                    if (!stepToward(e, e.lungeAngle, e.lunge)) e.timer = 0;
                    if (--e.timer <= 0) { e.state = 'rest'; e.timer = 110; }
                } else if (e.state === 'rest') {
                    if (--e.timer <= 0) { e.state = 'lurk'; e.homeX = e.x; e.homeY = e.y; }
                }
                break;
            case 'sentinel':
                e.chasing = canSense && d < e.sense * senseBoost;
                if (e.chasing) {
                    seek(e, e.speed);
                    if (!e.announced) { e.announced = true; showQuote('sentinel', 4000); }
                }
                break;
        }
    }
    function enemyIsHarmless(e) { return e.stun > 0 || (e.type === 'drowned' && (e.state === 'lurk' || e.state === 'wind')); }


    // ═══════════════════════════════════════════════════════════════════
    // INPUT
    // ═══════════════════════════════════════════════════════════════════
    let musicStarted = false;
    function startMusicOnce() {
        if (musicStarted || !_loreShown) return;
        musicStarted = true;
        if (!soundtrack.isPlaying()) soundtrack.start();
        soundtrack.sfxGameStart();
    }
    const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
    function onKeyDown(e) {
        const k = e.key.toLowerCase();
        if (MOVE_KEYS.has(k)) { startMusicOnce(); setKey(k, true); e.preventDefault(); return; }
        if (k === ' ') { e.preventDefault(); tryShed(); return; }
        if (k === 'f' || k === 'e' || k === 'shift' || k === 'enter') { e.preventDefault(); keys.fire = true; return; }
        if (k === 'p' || k === 'escape') {
            if (memoryOpen) { closeMemory(); return; }
            if (codexOvl && codexOvl.style.display === 'flex') { closeCodex(); return; }
            if (_loreShown && !isDead) togglePause();
        }
    }
    function onKeyUp(e) { const k = e.key.toLowerCase(); if (k === 'f' || k === 'e' || k === 'shift' || k === 'enter') keys.fire = false; setKey(k, false); }
    function setKey(k, state) {
        if (k === 'w' || k === 'arrowup') keys.w = state;
        if (k === 's' || k === 'arrowdown') keys.s = state;
        if (k === 'a' || k === 'arrowleft') keys.a = state;
        if (k === 'd' || k === 'arrowright') keys.d = state;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // touch: drag to steer, double tap to shed
    let touchActive = false;
    let touchStartX = 0, touchStartY = 0, touchCurrentX = 0, touchCurrentY = 0, touchAngle = 0;
    let lastTap = 0;
    const TOUCH_DEADZONE = 15;
    function onTouchStart(e) {
        if (e.target !== canvas) return;
        e.preventDefault();
        const t = e.touches[0];
        touchStartX = touchCurrentX = t.clientX * viewScale;
        touchStartY = touchCurrentY = t.clientY * viewScale;
        touchActive = true;
        startMusicOnce();
        const now = performance.now();
        if (now - lastTap < 300) tryShed();
        lastTap = now;
    }
    function onTouchMove(e) {
        e.preventDefault();
        if (!touchActive) return;
        const t = e.touches[0];
        touchCurrentX = t.clientX * viewScale; touchCurrentY = t.clientY * viewScale;
        const dx = touchCurrentX - touchStartX, dy = touchCurrentY - touchStartY;
        if (Math.hypot(dx, dy) > TOUCH_DEADZONE) { touchAngle = Math.atan2(dy, dx); sn.targetAngle = touchAngle; }
    }
    function onTouchEnd(e) { e.preventDefault(); touchActive = false; }
    // the touch attack button fires while held
    const biteBtn = $('gs-bite-btn');
    if (biteBtn) {
        biteBtn.addEventListener('touchstart', e => { e.preventDefault(); keys.fire = true; startMusicOnce(); }, { passive: false });
        biteBtn.addEventListener('touchend', e => { e.preventDefault(); keys.fire = false; }, { passive: false });
        biteBtn.addEventListener('touchcancel', () => { keys.fire = false; });
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // ═══════════════════════════════════════════════════════════════════
    // MECHANICS
    // ═══════════════════════════════════════════════════════════════════
    function setBiteUI() {
        const el = $('gs-bite');
        if (!el) return;
        el.className = venom >= SPIT_COST ? 'ready' : 'empty';
        el.style.setProperty('--p', (venom / VENOM_MAX).toFixed(2));
        const bb = $('gs-bite-btn'); if (bb) bb.classList.toggle('cooling', venom < SPIT_COST);
    }
    function setShedUI(state) {
        if (shedUI) {
            shedUI.className = state;
            shedUI.style.setProperty('--p', state === 'ready' ? 1 : 0);
            const label = $('gs-shed-label');
            if (label) label.textContent = state === 'active' ? 'Shedding' : state === 'ready' ? 'Shed · space' : 'Regrowing';
        }
        if (shedBtn) shedBtn.classList.toggle('cooling', state !== 'ready');
    }
    function tryShed() {
        if (isDead || paused || !_loreShown || shed.active > 0 || shed.cd > 0) return;
        if (sn.len < SHED_MIN_LEN) { showQuote('growth', 2500); return; }
        startMusicOnce();
        sn.len -= SHED_COST;
        shed.active = SHED_FRAMES;
        shed.cd = SHED_CD;
        soundtrack.sfxShed();
        // the old skin lies where it was left
        for (let i = 0; i < trail.n; i += SG * 2) { const t = trail.get(i); spawnParticles(t.x, t.y, 1, { color: '#7a6a55', minSize: 3, maxSize: 6, speed: 0.4, lifetime: 70, gravity: 0.02 }); }
        if (Math.random() < 0.5) showQuote('shed', 3500);
        setShedUI('active');
    }

    function hurt(amount, e) {
        if (hurtCd > 0 || grace > 0 || shed.active > 0 || bite.active > 0) return;
        hp -= amount;
        hurtCd = 50;
        hurtFlash = 1;
        soundtrack.sfxLunge();
        spawnParticles(sn.x, sn.y, 12, { color: '#8a1c1c', minSize: 2, maxSize: 5, speed: 3, lifetime: 30 });
        // thrown back from what struck him, if there is room
        if (e) {
            const a = Math.atan2(sn.y - e.y, sn.x - e.x);
            for (let d = 46; d > 0; d -= 8) { const x = sn.x + Math.cos(a) * d, y = sn.y + Math.sin(a) * d; if (city.walkable(x, y)) { sn.x = x; sn.y = y; break; } }
        }
        if (hp <= 0) { hp = 0; die('enemy'); return; }
        if (Math.random() < 0.12) showQuote('hurt', 3000);
        refreshHUD();
    }

    // nearest Asura to a point, within a radius and (optionally) a cone about an angle
    function nearestEnemy(x, y, radius, angle = null, cone = Math.PI) {
        const cx = Math.floor(x / CW), cy = Math.floor(y / CW);
        let best = null, bd = Infinity;
        for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
            const ch = world[getChunkKey(i, j)];
            if (!ch) continue;
            for (const e of ch.enemies) {
                if (e.type === 'drowned' && e.state === 'lurk') continue;
                const d = Math.hypot(e.x - x, e.y - y);
                if (d > radius + e.r || d >= bd) continue;
                if (angle !== null) {
                    let da = Math.atan2(e.y - y, e.x - x) - angle;
                    while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
                    if (Math.abs(da) > cone) continue;
                }
                best = { e, chunk: ch }; bd = d;
            }
        }
        return best;
    }
    function wound(e, chunk, amount = 1) {
        e.hp = (e.hp ?? ENEMY_HP[e.type] ?? 1) - amount;
        if (e.hp <= 0) { banish(e, chunk); return true; }
        e.stun = Math.max(e.stun, 14);
        e.hurt = 10;
        spawnFx('fxBlood', e.x, e.y, { size0: 40, size1: 90, life: 18, spin: 0.02, rot: Math.random() * 6.28, light: false, alpha: 0.85 });
        soundtrack.sfxStomp(0.5);
        return false;
    }
    // F, held or tapped: the fangs if anything is within reach, otherwise a bolt of venom at what is ahead
    function tryBite() {
        if (isDead || paused || !_loreShown || bite.cd > 0 || shed.active > 0) return;
        startMusicOnce();
        const near = nearestEnemy(sn.x, sn.y, BITE_REACH);
        if (near) {
            bite.active = BITE_FRAMES; bite.cd = BITE_CD;
            // a snap toward it
            sn.angle = sn.targetAngle = Math.atan2(near.e.y - sn.y, near.e.x - sn.x);
            soundtrack.sfxBite();
            spawnFx('fxSlash', near.e.x, near.e.y, { size0: 70, size1: 130, life: 14, rot: sn.angle + (Math.random() - 0.5) * 0.6, alpha: 1 });
            spawnFx('fxSigil', sn.x + Math.cos(sn.angle) * 40, sn.y + Math.sin(sn.angle) * 40, { size0: 30, size1: 120, life: 18, spin: -0.1, alpha: 0.7 });
            if (wound(near.e, near.chunk, 1) && Math.random() < 0.15) showQuote('bite', 3000);
            return;
        }
        if (venom < SPIT_COST) { if (bumpCooldown <= 0) { bumpCooldown = 30; showQuote('empty', 2200); } return; }
        venom -= SPIT_COST;
        bite.cd = BITE_CD;
        const aim = nearestEnemy(sn.x, sn.y, 560, sn.angle, 1.15);
        const a = aim ? Math.atan2(aim.e.y - sn.y, aim.e.x - sn.x) : sn.angle;
        bolts.push({ x: sn.x + Math.cos(a) * 26, y: sn.y + Math.sin(a) * 26, a, speed: 11, life: 60, target: aim ? aim.e : null });
        soundtrack.sfxBite();
        setBiteUI();
    }
    function updateBolts() {
        for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            // it follows what it was spat at
            if (b.target && b.target.hp !== 0) {
                let da = Math.atan2(b.target.y - b.y, b.target.x - b.x) - b.a;
                while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
                b.a += Math.max(-0.14, Math.min(0.14, da));
            }
            b.x += Math.cos(b.a) * b.speed; b.y += Math.sin(b.a) * b.speed;
            spawnParticles(b.x, b.y, 1, { color: '#b9e06a', minSize: 1, maxSize: 3, speed: 0.4, lifetime: 16 });
            let gone = --b.life <= 0 || !city.walkable(b.x, b.y);
            if (!gone) {
                const hit = nearestEnemy(b.x, b.y, 14);
                if (hit) {
                    wound(hit.e, hit.chunk, 1);
                    spawnFx('fxSigil', hit.e.x, hit.e.y, { size0: 40, size1: 150, life: 26, spin: 0.08, alpha: 0.9 });
                    gone = true;
                }
            }
            if (gone) { spawnFx('fxVenom', b.x, b.y, { size0: 30, size1: 110, life: 20, spin: 0.05, rot: Math.random() * 6.28 }); bolts.splice(i, 1); }
        }
    }

    function banish(e, chunk) {
        const i = chunk.enemies.indexOf(e);
        if (i >= 0) chunk.enemies.splice(i, 1);
        emitBanishParticles(e.x, e.y);
        spawnFx('fxBlood', e.x, e.y, { size0: 60, size1: 190, life: 26, spin: 0.03, rot: Math.random() * 6.28, light: false, alpha: 0.95 });
        spawnFx('fxSigil', e.x, e.y, { size0: 60, size1: 230, life: 32, spin: 0.06, alpha: 0.8, delay: 2 });
        soundtrack.sfxBanish();
        banished++;
        if (Math.random() < 0.15) showQuote('banish', 3000);
    }

    function ringBell(b) {
        b.cd = 600;
        bellsRung++;
        soundtrack.sfxBell();
        bellRings.push({ x: b.x, y: b.y, t: 0 });
        fogBoost = 1;
        const cx = Math.floor(sn.x / CW), cy = Math.floor(sn.y / CW);
        for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
            const ch = world[getChunkKey(i, j)];
            if (!ch) continue;
            for (const e of ch.enemies) {
                if (Math.hypot(e.x - b.x, e.y - b.y) < 520) {
                    e.stun = e.type === 'sentinel' ? 100 : 320;
                    e.chasing = false;
                    if (e.type === 'drowned') { e.state = 'rest'; e.timer = 120; }
                    spawnParticles(e.x, e.y, 6, { color: '#c0a060', minSize: 1, maxSize: 3, speed: 2, lifetime: 30 });
                }
            }
        }
        showQuote('bell', 3500);
    }

    function lightShrine(s, chunk) {
        s.lit = true;
        shrinesLit++;
        hp = HP_MAX;
        soundtrack.sfxShrine();
        emitShrineParticles(s.x, s.y + 95);
        // where he will wake: open ground beside the shrine
        let best = null;
        for (let k = 0; k < 12 && !best; k++) {
            const a = Math.PI / 2 + (k * Math.PI / 6);
            const px = s.x + Math.cos(a) * 175, py = s.y + Math.sin(a) * 175;
            const blocked = !city.walkable(px, py) || !city.walkable(px + 40, py) || !city.walkable(px - 40, py) || !city.walkable(px, py + 40) || !city.walkable(px, py - 40)
                || chunk.obs.some(o => Math.hypot(px - o.x, py - o.y) < o.r + 60);
            if (!blocked) best = { x: px, y: py, angle: a };
        }
        checkpoint = best || { x: s.x, y: s.y + 175, angle: Math.PI / 2 };
        showQuote('shrine', 3500);
        saveRun();
    }

    function collectPiece(p) {
        piecesFound.push(p.id);
        emitMemoryParticles(p.x, p.y);
        soundtrack.sfxMemory();
        showQuote('piece', 4000);
        const newAct = ACTS.reduce((acc, a, i) => (piecesFound.length >= a.at ? i : acc), 0);
        if (newAct !== actIdx) enterAct(newAct);
        refreshHUD();
        saveRun();
    }

    function recoverDropped() {
        if (!dropped) return;
        piecesFound.push(dropped.id);
        emitMemoryParticles(dropped.x, dropped.y);
        soundtrack.sfxMemory();
        dropped = null;
        showQuote('recover', 4000);
        refreshHUD();
        saveRun();
    }

    function openMemory(landmark) {
        const idx = MEMORIES.findIndex((_, i) => !memoriesFound.includes(i));
        if (idx < 0) return;
        memoriesFound.push(idx);
        if (landmark !== undefined && !landmarksTaken.includes(landmark)) landmarksTaken.push(landmark);
        save.memories = memoriesFound.slice();
        saveRun();
        soundtrack.sfxMemory();
        const m = MEMORIES[idx];
        const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
        if ($('memKicker')) $('memKicker').textContent = `MEMORY ${roman[idx]} OF IX`;
        if ($('memTitle')) $('memTitle').textContent = m.title;
        if ($('memText')) $('memText').textContent = m.text;
        memoryOpen = true;
        if (memoryOvl) memoryOvl.style.display = 'flex';
        if (quoteEl) quoteEl.className = 'fading';
        refreshHUD();
    }
    function closeMemory() {
        memoryOpen = false;
        if (memoryOvl) memoryOvl.style.display = 'none';
        grace = Math.max(grace, 60);
        showQuote('memory', 3500);
    }

    function togglePause() {
        if (isDead || !_loreShown || memoryOpen) return;
        paused = !paused;
        if (pauseOvl) pauseOvl.style.display = paused ? 'flex' : 'none';
    }
    function openCodex() {
        if (!codexOvl) return;
        const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
        const list = $('codexList');
        if (list) {
            list.innerHTML = MEMORIES.map((m, i) => memoriesFound.includes(i)
                ? `<div class="codex-entry"><h3><small>${roman[i]}</small>${m.title}</h3><p>${m.text}</p></div>`
                : `<div class="codex-entry locked"><h3><small>${roman[i]}</small>—</h3><p>Still waiting somewhere in the city.</p></div>`
            ).join('');
        }
        if ($('codexSub')) $('codexSub').textContent = `${memoriesFound.length} of 9 recovered`;
        codexOvl.style.display = 'flex';
    }
    function closeCodex() { if (codexOvl) codexOvl.style.display = 'none'; }

    // greed: every shard of the stone makes him longer, brighter, and easier to smell
    function addGreed() {
        greed++;
        sn.len = Math.min(LEN_MAX, sn.len + 2);
        hp = Math.min(HP_MAX, hp + 5);
        venom = Math.min(VENOM_MAX, venom + 12);
        if (greed % 10 === 0) { buildFog(); saveRun(); }
        setBiteUI();
        if (greed === 30 || greed === 100 || greed === 200) showQuote('greed', 4500);
        else if (Math.random() < 0.06) showQuote('eat', 3500);
        refreshHUD();
    }
    const greedLight = () => Math.min(150, greed * 1.1);

    function enterAct(i) {
        actIdx = i;
        const act = ACTS[i];
        buildFog();
        const actLabel = $('gs-act'), actTitle = $('gs-act-title');
        if (actLabel) actLabel.textContent = 'ACT ' + act.num;
        if (actTitle) actTitle.textContent = act.title;
        if (actCard) {
            $('actNum').textContent = 'ACT ' + act.num;
            $('actTitle').textContent = act.title;
            $('actEpi').textContent = act.epigraph;
            actCard.classList.add('show');
            if (actCardTimer) clearTimeout(actCardTimer);
            actCardTimer = setTimeout(() => actCard.classList.remove('show'), 5000);
        }
        soundtrack.sfxAct();
        grace = Math.max(grace, 90);
    }

    function respawn() {
        // a fall is a setback, not a restart: he wakes at the diya he lit if it is near, otherwise where he fell
        const fell = { x: sn.x, y: sn.y };
        let cp = checkpoint && Math.hypot(checkpoint.x - fell.x, checkpoint.y - fell.y) < 1400 ? checkpoint : null;
        if (!cp) {
            // open ground near the fall, a little way back along the way he came
            let best = null;
            for (let k = 0; k < 24 && !best; k++) {
                const a = sn.angle + Math.PI + (k % 2 ? 1 : -1) * Math.floor(k / 2) * 0.5, d = 90 + Math.floor(k / 8) * 60;
                const x = fell.x + Math.cos(a) * d, y = fell.y + Math.sin(a) * d;
                if (city.walkable(x, y) && city.walkable(x + 30, y) && city.walkable(x - 30, y) && city.walkable(x, y + 30) && city.walkable(x, y - 30)) best = { x, y, angle: a };
            }
            cp = best || checkpoint || { x: city.spawn.x, y: city.spawn.y, angle: Math.PI / 2 };
        }
        sn.x = cp.x; sn.y = cp.y;
        sn.angle = sn.targetAngle = cp.angle;
        trail.clear();
        shed.active = 0;
        hp = HP_MAX;
        hurtCd = 0;
        grace = 170;
        // the fall itself tolls: whatever killed him is held for a moment
        const cx = Math.floor(sn.x / CW), cy = Math.floor(sn.y / CW);
        for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
            const ch = world[getChunkKey(i, j)];
            if (ch) for (const e of ch.enemies) if (Math.hypot(e.x - sn.x, e.y - sn.y) < 420) { e.stun = Math.max(e.stun, 200); e.chasing = false; }
        }
        soundtrack.sfxRespawn();
    }

    // He cannot die. What happens instead: the piece of her he carried last falls where he fell,
    // the void adds its weight to him, and he wakes at the last diya he lit.
    function die(cause) {
        if (grace > 0) return;
        if (shed.active > 0 || bite.active > 0) return;
        emitDeathParticles(sn.x, sn.y);
        soundtrack.sfxDie();
        deaths++;
        sn.len = Math.min(LEN_MAX, sn.len + 4);
        if (!dropped && piecesFound.length) {
            const id = piecesFound.pop();
            dropped = { id, x: sn.x, y: sn.y };
            showQuote('drop', 4500);
        } else {
            showQuote('death', 3500);
        }
        respawn();
        refreshHUD();
        saveRun();
    }

    // the only way out is across the Irwell, and the bridge knows what he carries
    function checkGate() {
        const d = Math.hypot(sn.x - city.gate.x, sn.y - city.gate.y);
        if (d > 170) return;
        if (piecesFound.length >= PIECES_TOTAL) { ascend(); return; }
        // turned back
        const a = Math.atan2(sn.y - city.gate.y, sn.x - city.gate.x);
        sn.angle = sn.targetAngle = a;
        sn.x = city.gate.x + Math.cos(a) * 175; sn.y = city.gate.y + Math.sin(a) * 175;
        grace = Math.max(grace, 40);
        if (time - gateWarnedAt > 6) { gateWarnedAt = time; showQuote('gate', 5000); soundtrack.sfxBell(); }
    }

    function ascend() {
        isDead = true;
        const complete = memoriesFound.length >= MEMORIES.length;
        save.endings++;
        if (complete) save.trueEnding = true;
        save.run = null;
        writeSave(save);
        soundtrack.sfxVictory(complete);
        const v = complete ? VICTORY.trueEnding : VICTORY.hollow;
        if ($('victoryTitle')) $('victoryTitle').textContent = v.title;
        if ($('victoryText')) $('victoryText').innerHTML = v.text.replace('{missing}', String(MEMORIES.length - memoriesFound.length)).replace('{deaths}', String(deaths)).replace('{greed}', String(greed));
        if (victoryOvl) { victoryOvl.classList.toggle('hollow', !complete); victoryOvl.style.display = 'flex'; }
        if (quoteEl) quoteEl.className = 'fading';
    }

    function refreshHUD() {
        if (soulUI) soulUI.innerText = piecesFound.length;
        if (memUI) memUI.innerText = String(memoriesFound.length);
        if (scoreUI) scoreUI.innerText = greed;
        const dv = $('deathVal'); if (dv) dv.innerText = deaths;
        const ob = $('soulBar'), pips = $('memPips');
        if (ob) ob.style.width = Math.min(100, piecesFound.length / PIECES_TOTAL * 100) + '%';
        if (pips) {
            let html = '';
            for (let i = 0; i < MEMORIES.length; i++) html += `<b class="${memoriesFound.includes(i) ? 'on' : ''}"></b>`;
            pips.innerHTML = html;
        }
        const dr = $('gs-dropped'); if (dr) dr.style.display = dropped ? '' : 'none';
        const hb = $('hpBar'); if (hb) hb.style.width = (hp / HP_MAX * 100).toFixed(1) + '%';
        setBiteUI();
    }

    // ═══════════════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════════════
    function update() {
        if (isDead || paused || memoryOpen || !_loreShown) return;
        time += 0.05;
        if (grace > 0) grace--;
        if (hurtCd > 0) hurtCd--; else if (hp < HP_MAX && (time * 20 | 0) % 3 === 0) hp = Math.min(HP_MAX, hp + 0.06);
        if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - 0.04);
        if ((time * 20 | 0) % 10 === 0) { const hb = $('hpBar'); if (hb) hb.style.width = (hp / HP_MAX * 100).toFixed(1) + '%'; }
        if (fogBoost > 0) fogBoost = Math.max(0, fogBoost - 1 / 300);
        if (shed.active > 0 && --shed.active === 0) setShedUI('cooling');
        if (shed.cd > 0 && --shed.cd === 0) setShedUI('ready');
        else if (shed.cd > 0 && shed.cd % 8 === 0 && shedUI) shedUI.style.setProperty('--p', (1 - shed.cd / SHED_CD).toFixed(2));
        if (bite.active > 0) bite.active--;
        if (bite.cd > 0) bite.cd--;
        if (keys.fire) tryBite();
        if (venom < VENOM_MAX) { venom = Math.min(VENOM_MAX, venom + VENOM_REGEN); if ((time * 20 | 0) % 6 === 0) setBiteUI(); }
        updateBolts();
        updateFx();

        // steering
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        if (dx !== 0 || dy !== 0) sn.targetAngle = Math.atan2(dy, dx);
        let diff = sn.targetAngle - sn.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        sn.angle += diff * TURN_SPEED;

        const speed = bite.active > 0 ? SPEED * BITE_SPEED : shed.active > 0 ? SPEED * SHED_SPEED : SPEED;
        const vx = Math.cos(sn.angle) * speed, vy = Math.sin(sn.angle) * speed;
        // the city's walls stop him and he slides along them; they are not what kills him
        const R = SS * 0.42;
        // pillars and shrines near him count as wall for steering
        const nearObs = [];
        {
            const ccx = Math.floor(sn.x / CW), ccy = Math.floor(sn.y / CW);
            for (let i = ccx - 1; i <= ccx + 1; i++) for (let j = ccy - 1; j <= ccy + 1; j++) {
                const ch = world[getChunkKey(i, j)];
                if (ch) for (const o of ch.obs) if (Math.hypot(o.x - sn.x, o.y - sn.y) < o.r + 160) nearObs.push(o);
            }
        }
        const clear = (x, y) => {
            if (!city.walkable(x, y)) return false;
            for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; if (!city.walkable(x + Math.cos(a) * R, y + Math.sin(a) * R)) return false; }
            for (const o of nearObs) if (Math.hypot(x - o.x, y - o.y) < o.r + SS / 2) return false;
            return true;
        };
        let moved = false;
        const steering = dx !== 0 || dy !== 0 || touchActive;
        if (clear(sn.x + vx, sn.y + vy)) { sn.x += vx; sn.y += vy; moved = true; }
        else {
            // the street turns him: the nearest open heading to the one he wanted, and he follows it
            for (const off of [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5]) {
                const a2 = sn.angle + off;
                const nx = sn.x + Math.cos(a2) * speed, ny = sn.y + Math.sin(a2) * speed;
                if (!clear(nx, ny)) continue;
                sn.x = nx; sn.y = ny; moved = true;
                sn.angle = a2;
                if (!steering) sn.targetAngle = a2; // left alone, he keeps to the street
                break;
            }
        }
        if (!moved && !clear(sn.x, sn.y)) {
            // pushed into the stone (a bell, a respawn, a bad frame): ease him back to open ground
            for (let k = 1; k <= 8 && !clear(sn.x, sn.y); k++) for (let a = 0; a < Math.PI * 2 && !clear(sn.x, sn.y); a += Math.PI / 4) {
                const tx = sn.x + Math.cos(a) * k * 8, ty = sn.y + Math.sin(a) * k * 8;
                if (clear(tx, ty)) { sn.x = tx; sn.y = ty; }
            }
        }
        if (!moved && bumpCooldown <= 0) { bumpCooldown = 20; spawnParticles(sn.x + vx * 3, sn.y + vy * 3, 4, { color: '#6b5a48', minSize: 1, maxSize: 3, speed: 1.2, lifetime: 25 }); }
        if (moved) {
            // a moving head always lays down history, so the body keeps following the actual path
        }
        if (bumpCooldown > 0) bumpCooldown--;
        if (shed.active > 0 && moved) emitShedFlakes(sn.x, sn.y, sn.angle);

        if (moved) {
            trail.push(sn.x, sn.y, sn.angle);
            trail.trim(sn.len * SG + 1);
        }

        const cx = Math.floor(sn.x / CW), cy = Math.floor(sn.y / CW);
        for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) genChunk(i, j);

        // what the minimap may show: the streets he has walked
        if ((time * 20 | 0) % 6 === 0) {
            const gx = Math.floor(sn.x / CELL), gy = Math.floor(sn.y / CELL), R = 9;
            for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
                if (i * i + j * j > R * R) continue;
                if (city.inside(gx + i, gy + j)) explored[city.idx(gx + i, gy + j)] = 1;
            }
        }

        for (let i = cx - 1; i <= cx + 1; i++) {
            for (let j = cy - 1; j <= cy + 1; j++) {
                const chunk = world[getChunkKey(i, j)];
                if (!chunk) continue;

                // the stone's shards: his greed
                for (let f = chunk.food.length - 1; f >= 0; f--) {
                    const food = chunk.food[f];
                    if (Math.hypot(sn.x - food.x, sn.y - food.y) < SS + food.r) {
                        emitSanskritRunes(food.x, food.y);
                        soundtrack.sfxEat();
                        chunk.food.splice(f, 1);
                        addGreed();
                    }
                }
                // the pieces of her
                for (let s = chunk.pieces.length - 1; s >= 0; s--) {
                    const p = chunk.pieces[s];
                    if (Math.hypot(sn.x - p.x, sn.y - p.y) < SS + p.r + 6) { chunk.pieces.splice(s, 1); collectPiece(p); }
                }
                // the Memories, at the landmarks
                for (let m = chunk.memories.length - 1; m >= 0; m--) {
                    const mem = chunk.memories[m];
                    if (Math.hypot(sn.x - mem.x, sn.y - mem.y) < SS + mem.r) {
                        emitMemoryParticles(mem.x, mem.y);
                        chunk.memories.splice(m, 1);
                        openMemory(mem.landmark);
                        return; // the world stops while she speaks
                    }
                }
                for (const s of chunk.shrines) {
                    if (!s.lit && Math.hypot(sn.x - s.x, sn.y - s.y) < s.r + 115) lightShrine(s, chunk);
                }
                for (const b of chunk.bells) {
                    if (b.cd > 0) b.cd--;
                    else if (Math.hypot(sn.x - b.x, sn.y - b.y) < SS + b.r + 6) ringBell(b);
                }
                for (const o of chunk.obs) {
                    const d = Math.hypot(sn.x - o.x, sn.y - o.y), min = (SS / 2) + o.r;
                    if (d < min) {
                        // pushed out along the normal, and the step that led here is not remembered
                        const a = Math.atan2(sn.y - o.y, sn.x - o.x);
                        sn.x = o.x + Math.cos(a) * (min + 1); sn.y = o.y + Math.sin(a) * (min + 1);
                        if (moved) { trail.head = (trail.head - 1 + trail.cap) % trail.cap; trail.n = Math.max(0, trail.n - 1); moved = false; }
                        if (bumpCooldown <= 0) { bumpCooldown = 20; spawnParticles(sn.x, sn.y, 4, { color: '#6b5a48', minSize: 1, maxSize: 3, speed: 1.2, lifetime: 25 }); }
                    }
                }
                for (let k = chunk.enemies.length - 1; k >= 0; k--) {
                    const e = chunk.enemies[k];
                    updateEnemy(e);
                    const dist = Math.hypot(sn.x - e.x, sn.y - e.y);
                    if (dist < (SS / 2) + e.r) {
                        if (shed.active > 0) { if (e.type !== 'sentinel') banish(e, chunk); }
                        else if (bite.active > 0) { wound(e, chunk, 1); }
                        else if (!enemyIsHarmless(e)) hurt(DAMAGE[e.type] || 25, e);
                    }
                }
            }
        }

        // the piece that fell from him
        if (dropped && Math.hypot(sn.x - dropped.x, sn.y - dropped.y) < SS + 22) recoverDropped();

        // the bridge
        checkGate();

        // he may slither over his own coil: the body is what he carries, not what kills him

        for (let i = bellRings.length - 1; i >= 0; i--) if (++bellRings[i].t > 60) bellRings.splice(i, 1);
        if (shake > 0) shake = Math.max(0, shake - 0.3);
        updateParticles();
        updateMotes();
    }

    // ═══════════════════════════════════════════════════════════════════
    // RENDER
    // One camera for everything: the world set is drawn from a 65° high angle, so
    // every prop stands on its base and the scene is painted back to front by base y.
    // ═══════════════════════════════════════════════════════════════════
    function drawSprite(img, x, y, size, alpha) {
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        if (alpha !== undefined) ctx.globalAlpha = 1;
    }
    function drawStanding(img, x, baseY, size, alpha) {
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        const w = size, h = size * (img.naturalHeight / img.naturalWidth);
        ctx.drawImage(img, x - w / 2, baseY - h + size * 0.08, w, h);
        if (alpha !== undefined) ctx.globalAlpha = 1;
    }
    function drawShadow(x, y, rx, ry, alpha = 0.45) {
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    const glowSprites = new Map();
    let smokeTinted = null;
    function smokeSprite() {
        const src = pick(V2.smoke);
        if (!src) return null;
        if (!smokeTinted) {
            smokeTinted = document.createElement('canvas'); smokeTinted.width = smokeTinted.height = 256;
            const c = smokeTinted.getContext('2d');
            c.drawImage(src, 0, 0, 256, 256);
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = 'rgba(118,110,112,0.7)'; c.fillRect(0, 0, 256, 256);
        }
        return smokeTinted;
    }
    function glow(x, y, r, rgb, a) {
        if (quality === 0 && r < 100) return;
        let spr = glowSprites.get(rgb);
        if (!spr) {
            spr = document.createElement('canvas'); spr.width = spr.height = 128;
            const c = spr.getContext('2d');
            const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.5, `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
            c.fillStyle = g; c.fillRect(0, 0, 128, 128);
            glowSprites.set(rgb, spr);
        }
        ctx.globalAlpha = a; ctx.drawImage(spr, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
    }

    // ── floor: each chunk composes its ground once from the city grid ──
    const floorCache = [];
    const FLOOR_CACHE_MAX = 16;
    const softCanvas = document.createElement('canvas');
    function floorStamp() { return [V2.floorStone, V2.floorRoots, V2.floorWet, V2.floorAsh, V2.floorRuin, V2.floorWater, V2.decalPuddle, V2.decalRubble, V2.decalRoots, V2.roadBroken, V2.pileA, V2.pileB, V2.bloodA, V2.bloodB, V2.warA, V2.warB, floorImg, puddleImg].filter(i => ready(i)).length; }
    const patterns = new Map();
    function pattern(c, img, scalePx, ox, oy) {
        // a repeating tile, aligned to world space so neighbouring chunks line up
        const key = img.src + '|' + scalePx;
        let p = patterns.get(key);
        if (!p) { p = c.createPattern(img, 'repeat'); patterns.set(key, p); }
        const k = scalePx / img.naturalWidth;
        p.setTransform(new DOMMatrix().translate(-((ox % scalePx) + scalePx) % scalePx, -((oy % scalePx) + scalePx) % scalePx).scale(k, k));
        return p;
    }
    function chunkFloor(chunk) {
        const stamp = floorStamp();
        if (chunk.floorCanvas && chunk.floorStamp === stamp) return chunk.floorCanvas;
        if (!chunk.floorCanvas) {
            chunk.floorCanvas = document.createElement('canvas');
            chunk.floorCanvas.width = chunk.floorCanvas.height = CW;
            floorCache.push(chunk);
            if (floorCache.length > FLOOR_CACHE_MAX) { const old = floorCache.shift(); old.floorCanvas = null; old.floorStamp = -1; }
        }
        chunk.floorStamp = stamp;
        const c = chunk.floorCanvas.getContext('2d');
        c.clearRect(0, 0, CW, CW);
        const stone = pick(V2.floorStone, floorImg), ruin = pick(V2.floorRuin, V2.floorAsh, stone), water = pick(V2.floorWater, V2.floorWet, stone);
        const variants = [pick(V2.floorRoots), pick(V2.floorAsh), pick(V2.floorWet)];
        // 1. everything is rubble
        if (ruin) { c.fillStyle = pattern(c, ruin, 400, chunk.ox, chunk.oy); c.fillRect(0, 0, CW, CW); c.fillStyle = 'rgba(2,1,2,0.6)'; c.fillRect(0, 0, CW, CW); }
        else { c.fillStyle = '#0a0709'; c.fillRect(0, 0, CW, CW); }
        // 2. the streets and precincts are paved; the river is water
        const gx0 = Math.floor(chunk.ox / CELL), gy0 = Math.floor(chunk.oy / CELL), N = CW / CELL;
        const cellType = (i, j) => (city.inside(gx0 + i, gy0 + j) ? city.grid[city.idx(gx0 + i, gy0 + j)] : CT.SOLID);
        const open = t => t === CT.ROAD || t === CT.ROOM || t === CT.BRIDGE || t === CT.GATE;
        if (stone) {
            c.fillStyle = pattern(c, stone, 400, chunk.ox, chunk.oy);
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (open(cellType(i, j))) c.fillRect(i * CELL, j * CELL, CELL, CELL);
            // a worn variant now and then, so the paving is not one unbroken sheet (ash only: roots and water read as rubble)
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
                if (!open(cellType(i, j))) continue;
                const h = hash((gx0 + i) * 3.3 + (gy0 + j) * 1.9);
                if (h < 0.1 && variants[1]) { c.fillStyle = pattern(c, variants[1], 400, chunk.ox, chunk.oy); c.fillRect(i * CELL, j * CELL, CELL, CELL); }
            }
            // and the paving is lifted, so the open ground is the light in this picture
            c.fillStyle = 'rgba(214,190,150,0.07)';
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (open(cellType(i, j))) c.fillRect(i * CELL, j * CELL, CELL, CELL);
        }
        if (water) {
            c.fillStyle = pattern(c, water, 400, chunk.ox, chunk.oy);
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (cellType(i, j) === CT.WATER) c.fillRect(i * CELL, j * CELL, CELL, CELL);
        }
        // the bridge: planks of stone, a shade lighter
        c.fillStyle = 'rgba(192,160,96,0.08)';
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (cellType(i, j) === CT.BRIDGE) c.fillRect(i * CELL, j * CELL, CELL, CELL);
        // 3. the walls have height: a shadow falls from the rubble onto the paving beside it, and the banks onto the water
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const t = cellType(i, j);
            if (!open(t) && t !== CT.WATER) continue;
            const x = i * CELL, y = j * CELL, D = 22;
            const edges = [[0, -1, 0, 0, 0, D], [0, 1, 0, CELL, 0, CELL - D], [-1, 0, 0, 0, D, 0], [1, 0, CELL, 0, CELL - D, 0]];
            for (const [dx, dy, x0, y0, x1, y1] of edges) {
                if (cellType(i + dx, j + dy) !== CT.SOLID) continue;
                const g = c.createLinearGradient(x + x0, y + y0, x + x1, y + y1);
                g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = g;
                if (dy) c.fillRect(x, dy < 0 ? y : y + CELL - D, CELL, D); else c.fillRect(dx < 0 ? x : x + CELL - D, y, D, CELL);
                // the wall's footing: a pale line of stone where the rubble meets the road
                c.fillStyle = 'rgba(196,176,136,0.5)';
                if (dy) c.fillRect(x, dy < 0 ? y : y + CELL - 3, CELL, 3); else c.fillRect(dx < 0 ? x : x + CELL - 3, y, 3, CELL);
            }
        }
        // 4. what lies on the ground
        const decal = (img, d, alpha, mode) => {
            if (!img) return;
            c.save(); c.globalAlpha = alpha; c.translate(d.x - chunk.ox, d.y - chunk.oy); c.rotate(d.rot || 0);
            if (mode) c.globalCompositeOperation = mode;
            c.drawImage(img, -d.size / 2, -d.size / 2, d.size, d.size); c.restore();
        };
        const soft = (img, d, alpha, mode) => {
            if (!img) return;
            const S = 256, t = softCanvas; t.width = t.height = S;
            const tc = t.getContext('2d');
            tc.clearRect(0, 0, S, S);
            tc.drawImage(img, 0, 0, S, S);
            tc.globalCompositeOperation = 'destination-in';
            const g = tc.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.5);
            g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            tc.fillStyle = g; tc.fillRect(0, 0, S, S);
            tc.globalCompositeOperation = 'source-over';
            decal(t, d, alpha, mode);
        };
        for (const r of chunk.roots) decal(pick(V2.decalRoots), r, 0.9);
        for (const b of chunk.broken) decal(pick(V2.roadBroken), b, 1);
        for (const p of chunk.puddles) decal(pick(V2.decalPuddle, puddleImg), p, p.alpha);
        for (const r of chunk.rubble) decal(pick(V2.decalRubble), r, r.alpha);
        for (const w of chunk.war) decal(pick(w.variant === 0 ? V2.warA : V2.warB, V2.warA, V2.warB), w, 1);
        for (const b of chunk.blood) soft(pick(b.variant === 0 ? V2.bloodA : V2.bloodB, V2.bloodA, V2.bloodB), b, b.alpha, 'multiply');
        for (const p of chunk.piles) decal(pick(p.variant === 0 ? V2.pileA : V2.pileB, V2.pileA, V2.pileB), p, 1);
        return chunk.floorCanvas;
    }

    // ── animated enemies ──
    const SHEETS = { wraith: () => pick(V2.wraithWalk), hunter: () => pick(V2.hunterWalk), drowned: () => pick(V2.drownedWalk), sentinel: () => pick(V2.sentinelWalk) };
    const STILLS = { wraith: () => pick(assets.enemy), hunter: () => pick(assets.hunter, assets.enemy), drowned: () => pick(assets.drowned), sentinel: () => pick(assets.sentinel) };
    const ENEMY_SIZE = { wraith: 96, hunter: 112, drowned: 104, sentinel: 176 };
    function drawEnemy(e) {
        const dim = e.stun > 0 ? 0.4 : 1;
        const size = ENEMY_SIZE[e.type];
        if (e.hurt > 0) { e.hurt--; glow(e.x, e.y, e.r * 1.6, '255,230,160', 0.35); }
        let alpha = dim, lift = 0, scaleY = 1;
        if (e.type === 'drowned') {
            const rising = e.state === 'wind' ? 1 - e.timer / 28 : (e.state === 'lunge' || e.state === 'rest') ? 1 : 0;
            alpha = (0.3 + rising * 0.7) * dim;
            lift = -rising * 10;
            if (e.state === 'wind') {
                ctx.strokeStyle = `rgba(90, 220, 220, ${0.55 * rising})`; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.4 + rising * 16, 0, Math.PI * 2); ctx.stroke();
            }
        } else if (e.type === 'wraith') {
            lift = Math.sin(time * 2 + e.phase) * 4 - 6;
        } else if (e.type === 'hunter' && e.chasing && e.stun <= 0) {
            glow(e.x, e.y, e.r * 2.4, '255,40,40', 0.26);
        } else if (e.type === 'sentinel') {
            scaleY = 1 + Math.abs(Math.sin(e.phase * Math.PI)) * 0.03;
        }
        if (e.stun > 0) {
            ctx.strokeStyle = `rgba(212,175,55,${0.25 + 0.2 * Math.sin(time * 6)})`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.5, 0, Math.PI * 2); ctx.stroke();
        }
        const sheet = SHEETS[e.type]();
        ctx.save();
        ctx.translate(e.x, e.y + lift);
        ctx.globalAlpha = alpha;
        if (sheet) {
            const frames = Math.max(1, Math.round(sheet.naturalWidth / sheet.naturalHeight));
            const cell = sheet.naturalWidth / frames;
            let frame = Math.floor(e.phase) % frames;
            if (e.type === 'drowned' && e.state === 'lurk') frame = 0;
            if (e.type === 'drowned' && e.state === 'lunge') frame = Math.floor(time * 12) % frames;
            const dirX = Math.cos(e.face), dirY = Math.sin(e.face);
            if (Math.abs(dirX) > 0.35) e.flip = dirX < 0;
            ctx.rotate(dirX * 0.14 + (e.type === 'hunter' && e.chasing ? dirX * 0.1 : 0));
            ctx.scale(e.flip ? -1 : 1, scaleY * (1 - Math.max(0, -dirY) * 0.06));
            const bob = e.type === 'sentinel' ? 0 : Math.sin(e.phase * Math.PI * 2) * 1.5;
            ctx.drawImage(sheet, frame * cell, 0, cell, sheet.naturalHeight, -size / 2, -size / 2 + bob, size, size);
        } else {
            const still = STILLS[e.type]();
            if (still) ctx.drawImage(still, -size / 2, -size / 2, size, size);
            else {
                ctx.fillStyle = e.type === 'drowned' ? '#0e2a2a' : e.type === 'sentinel' ? '#2a2418' : '#120808';
                ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = e.type === 'drowned' ? '#5ae0e0' : '#ff2020';
                ctx.fillRect(-8, -4, 4, 4); ctx.fillRect(4, -4, 4, 4);
            }
        }
        ctx.restore();
    }

    function drawFlame(x, y, size, flicker) {
        const f = 0.85 + Math.sin(flicker * 7) * 0.08 + Math.sin(flicker * 13) * 0.07;
        glow(x, y, size * 2.6, '255,170,80', 0.42 * f);
        const diya = pick(V2.diya, assets.diya);
        if (diya) drawStanding(diya, x, y + size * 0.6, size * 2.2);
        else {
            ctx.fillStyle = '#3a2a20';
            ctx.beginPath(); ctx.ellipse(x, y + size * 0.3, size * 0.6, size * 0.25, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255, 210, 120, ${f})`;
            ctx.beginPath(); ctx.ellipse(x, y - size * 0.15, size * 0.14, size * 0.4 * f, 0, 0, Math.PI * 2); ctx.fill();
        }
    }
    function drawLotusFallback(x, y, r, g) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = `rgba(255, 200, 154, ${0.5 + g * 0.5})`;
        for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, -r * 0.8, r * 0.35, r * 0.9, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#fff1c9'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    function drawPiece(x, y, offset, lost) {
        const g = 0.5 + Math.sin(time * 2 + offset) * 0.5;
        glow(x, y, 70 + g * 16, lost ? '140,40,70' : '180,140,240', 0.3 + g * 0.1);
        const bob = Math.sin(time * 1.3 + offset) * 4;
        const img = pick(V2.soul, assets.soulShard);
        if (img) drawSprite(img, x, y + bob - 6, 60 + g * 6, lost ? 0.75 : 1);
        else { ctx.fillStyle = '#b48ede'; ctx.beginPath(); ctx.arc(x, y, 14 + g * 3, 0, Math.PI * 2); ctx.fill(); }
    }

    // ── ash motes in screen space ──
    function updateMotes() {
        const want = quality === 2 ? 36 : quality === 1 ? 14 : 0;
        if (motes.length > want) motes.length = want;
        while (motes.length < want) motes.push({ x: Math.random() * W, y: Math.random() * H, vx: 0.15 + Math.random() * 0.25, vy: -0.1 - Math.random() * 0.2, s: 0.8 + Math.random() * 1.6, a: 0.08 + Math.random() * 0.18, t: Math.random() * 100 });
        for (const m of motes) {
            m.t += 0.02;
            m.x += m.vx + Math.sin(m.t) * 0.2; m.y += m.vy;
            if (m.x > W + 10) m.x = -10; if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
        }
    }

    // ── the minimap: the city as he has walked it ──
    const mapCanvas = $('gs-map');
    const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;
    function drawMinimap() {
        if (!mapCtx) return;
        const S = mapCanvas.width, k = S / city.GRID, g = city.grid, Tt = city.T;
        mapCtx.clearRect(0, 0, S, S);
        mapCtx.fillStyle = 'rgba(9,6,8,0.7)'; mapCtx.fillRect(0, 0, S, S);
        // he built this city: its plan is faintly his already. Where he has walked, it is bright.
        for (let y = 0; y < city.GRID; y++) for (let x = 0; x < city.GRID; x++) {
            const i = y * city.GRID + x;
            const t = g[i];
            if (t === Tt.SOLID) continue;
            const known = explored[i];
            if (t === Tt.WATER) mapCtx.fillStyle = known ? 'rgba(46,82,96,0.95)' : 'rgba(30,50,60,0.6)';
            else if (t === Tt.ROOM) mapCtx.fillStyle = known ? 'rgba(205,172,108,0.78)' : 'rgba(120,100,66,0.22)';
            else if (t === Tt.GATE) mapCtx.fillStyle = 'rgba(230,207,143,0.85)';
            else mapCtx.fillStyle = known ? 'rgba(176,150,98,0.62)' : 'rgba(110,94,64,0.2)';
            mapCtx.fillRect(x * k, y * k, k + 0.5, k + 0.5);
        }
        const seen = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return city.inside(cx, cy) && explored[city.idx(cx, cy)]; };
        const dot = (x, y, r, color) => { mapCtx.fillStyle = color; mapCtx.beginPath(); mapCtx.arc(x / city.MAP * S, y / city.MAP * S, r, 0, Math.PI * 2); mapCtx.fill(); };
        const ring = (x, y, r, color) => { mapCtx.strokeStyle = color; mapCtx.lineWidth = 1.4; mapCtx.beginPath(); mapCtx.arc(x / city.MAP * S, y / city.MAP * S, r, 0, Math.PI * 2); mapCtx.stroke(); };
        // the pieces of her show once he has been near them; the landmarks he knows
        // the pieces of her: he feels every one of them; the ones he has been near burn brighter
        const pulse = 0.5 + Math.sin(time * 3) * 0.5;
        for (const room of city.pieces) {
            if (piecesFound.includes(room.piece) || (dropped && dropped.id === room.piece)) continue;
            const near = seen(room.x, room.y);
            const px = room.x / city.MAP * S, py = room.y / city.MAP * S;
            const halo = mapCtx.createRadialGradient(px, py, 0, px, py, 11 + pulse * 3);
            halo.addColorStop(0, near ? 'rgba(200,160,255,0.55)' : 'rgba(180,142,222,0.3)'); halo.addColorStop(1, 'rgba(180,142,222,0)');
            mapCtx.fillStyle = halo; mapCtx.beginPath(); mapCtx.arc(px, py, 11 + pulse * 3, 0, Math.PI * 2); mapCtx.fill();
            dot(room.x, room.y, near ? 4.5 + pulse : 3.5, near ? '#dcc6ff' : '#b48ede');
        }
        for (const l of city.landmarks) if (!landmarksTaken.includes(l.index) && memoriesFound.length < MEMORIES.length) ring(l.x, l.y, 4, '#f0c89a');
        if (dropped) dot(dropped.x, dropped.y, 4 + Math.sin(time * 4) * 1.5, '#ff6a8a');
        if (checkpoint) dot(checkpoint.x, checkpoint.y, 3, '#ffb347');
        // the dead near him
        const cxm = Math.floor(sn.x / CW), cym = Math.floor(sn.y / CW);
        for (let i = cxm - 1; i <= cxm + 1; i++) for (let j = cym - 1; j <= cym + 1; j++) {
            const ch = world[getChunkKey(i, j)];
            if (ch) for (const e of ch.enemies) if (Math.hypot(e.x - sn.x, e.y - sn.y) < 900 && !(e.type === 'drowned' && e.state === 'lurk')) dot(e.x, e.y, e.type === 'sentinel' ? 3.2 : 2.2, e.stun > 0 ? 'rgba(208,96,58,0.45)' : '#d0603a');
        }
        // the bridge: always known, lit when she is whole
        const gx = city.gate.x / city.MAP * S, gy = city.gate.y / city.MAP * S;
        mapCtx.save(); mapCtx.translate(gx, gy); mapCtx.rotate(Math.PI / 4);
        mapCtx.fillStyle = piecesFound.length >= PIECES_TOTAL ? '#ffffff' : 'rgba(230,207,143,0.8)'; mapCtx.fillRect(-4, -4, 8, 8); mapCtx.restore();
        dot(sn.x, sn.y, 3.6, '#ffffff');
        mapCtx.strokeStyle = 'rgba(192,160,96,0.35)'; mapCtx.lineWidth = 1; mapCtx.strokeRect(0.5, 0.5, S - 1, S - 1);
    }

    // where her light pulls him: the dropped piece first, then the nearest piece, then the bridge
    // a breadth-first distance field over the walkable cells, from wherever her light is
    let flow = null, flowKey = '';
    function flowField(target) {
        const G = city.GRID, dist = new Int32Array(G * G).fill(-1);
        const ok = t => t === CT.ROAD || t === CT.ROOM || t === CT.BRIDGE || t === CT.GATE;
        const tx = Math.floor(target.x / CELL), ty = Math.floor(target.y / CELL);
        if (!city.inside(tx, ty)) return dist;
        const q = [tx, ty]; dist[ty * G + tx] = 0;
        let head = 0;
        while (head < q.length) {
            const x = q[head++], y = q[head++], d = dist[y * G + x];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (!city.inside(nx, ny)) continue;
                const k = ny * G + nx;
                if (dist[k] >= 0 || !ok(city.grid[k])) continue;
                dist[k] = d + 1; q.push(nx, ny);
            }
        }
        return dist;
    }
    function threadDirection(target) {
        const key = Math.round(target.x) + ',' + Math.round(target.y);
        if (flowKey !== key) { flow = flowField(target); flowKey = key; }
        const G = city.GRID, cx = Math.floor(sn.x / CELL), cy = Math.floor(sn.y / CELL);
        if (!city.inside(cx, cy) || flow[cy * G + cx] < 0) return Math.atan2(target.y - sn.y, target.x - sn.x);
        // look two cells ahead along the descent so the thread anticipates the turn
        let x = cx, y = cy;
        for (let step = 0; step < 3; step++) {
            let best = null, bd = flow[y * G + x];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (!city.inside(nx, ny)) continue;
                const d = flow[ny * G + nx];
                if (d >= 0 && d < bd) { bd = d; best = [nx, ny]; }
            }
            if (!best) break;
            x = best[0]; y = best[1];
        }
        if (x === cx && y === cy) return Math.atan2(target.y - sn.y, target.x - sn.x);
        return Math.atan2((y + 0.5) * CELL - sn.y, (x + 0.5) * CELL - sn.x);
    }
    function threadTarget() {
        if (dropped) return dropped;
        if (piecesFound.length >= PIECES_TOTAL) return city.gate;
        let best = null, bd = Infinity;
        for (const room of city.pieces) {
            if (piecesFound.includes(room.piece)) continue;
            const d = Math.hypot(room.x - sn.x, room.y - sn.y);
            if (d < bd) { bd = d; best = room; }
        }
        return best;
    }

    function render() {
        ctx.fillStyle = '#070406';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
        ctx.translate(W / 2 - sn.x + sx, H / 2 - sn.y + sy);
        const cx = Math.floor(sn.x / CW), cy = Math.floor(sn.y / CW);
        const visible = [];
        for (let i = cx - 2; i <= cx + 2; i++) for (let j = cy - 2; j <= cy + 2; j++) {
            const chunk = world[getChunkKey(i, j)];
            if (!chunk) continue;
            if (chunk.ox + CW < sn.x - W / 2 - 300 || chunk.ox > sn.x + W / 2 + 300 || chunk.oy + CW < sn.y - H / 2 - 300 || chunk.oy > sn.y + H / 2 + 300) continue;
            visible.push(chunk);
        }

        // 1. ground
        for (const chunk of visible) ctx.drawImage(chunkFloor(chunk), chunk.ox, chunk.oy);

        // 2. flat on the ground: statues, bells, pickups, light pools
        const standing = [];
        for (const chunk of visible) {
            for (const st of chunk.statues) {
                const img = pick(st.variant === 1 ? V2.statueB : V2.statueA, st.variant === 1 ? assets.fallenStatue1 : assets.fallenStatue);
                if (!img) continue;
                ctx.save(); ctx.globalAlpha = st.alpha; ctx.translate(st.x, st.y); ctx.rotate(st.rot);
                const s = st.size * 0.85; ctx.drawImage(img, -s / 2, -s / 2, s, s); ctx.restore();
            }
            for (const b of chunk.bells) {
                const img = pick(V2.bell, assets.bell);
                const size = 92;
                const wobble = b.cd > 540 ? Math.sin((600 - b.cd) * 0.6) * (b.cd - 540) / 60 * 0.2 : 0;
                ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(wobble);
                if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
                else { ctx.fillStyle = '#8a7430'; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
                if (b.cd > 0) {
                    ctx.strokeStyle = `rgba(192,160,96,${0.08 + 0.12 * (b.cd / 600)})`; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.cd / 600)); ctx.stroke();
                }
            }
            for (const f of chunk.food) {
                const pulse = Math.sin(time + f.offset);
                glow(f.x, f.y, 34 + pulse * 4, '255,200,90', 0.16);
                const img = pick(V2.shard, assets.food);
                if (img) drawSprite(img, f.x, f.y - 4 - pulse * 2, 40 + pulse * 2);
                else { ctx.fillStyle = '#ffdf73'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + pulse * 1.5, 0, Math.PI * 2); ctx.fill(); }
            }
            for (const p of chunk.pieces) drawPiece(p.x, p.y, p.offset, false);
            for (const m of chunk.memories) {
                const g = 0.5 + Math.sin(time * 1.5 + m.offset) * 0.5;
                glow(m.x, m.y, 90 + g * 20, '255,220,160', 0.24 + g * 0.12);
                const bob = Math.sin(time * 1.2 + m.offset) * 4;
                const img = pick(V2.lotus, assets.memoryLotus);
                if (img) drawSprite(img, m.x, m.y + bob - 6, 78 + g * 8);
                else drawLotusFallback(m.x, m.y + bob, m.r, g);
            }
            for (const s of chunk.shrines) if (s.lit) glow(s.x, s.y + 95, 170, '255,160,70', 0.22 + Math.sin(time * 5 + s.flicker) * 0.03);
            for (const e of chunk.enemies) {
                if (e.type === 'drowned' && e.state === 'lurk') continue;
                drawShadow(e.x, e.y + e.r * 0.75, e.r * 0.8, e.r * 0.26, 0.28);
            }

            // 3. standing things, painted later by base y
            for (const s of chunk.shrines) standing.push({ y: s.y + 40, draw: () => {
                const img = pick(s.variant === 2 ? V2.shrineB : V2.shrineA, s.variant === 2 ? assets.shrine2 : assets.shrine);
                if (img) drawStanding(img, s.x, s.y + 50, 340);
                else { ctx.fillStyle = '#1a0e1e'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
                if (s.lit) drawFlame(s.x, s.y + 92, 20, time + s.flicker);
            } });
            for (const o of chunk.obs) {
                if (o.kind === 'shrine') continue;
                standing.push({ y: o.y + 12, draw: () => {
                    const broken = o.kind === 'stump';
                    const img = pick(broken ? V2.pillarBroken : V2.pillar, assets.pillar);
                    if (img) drawStanding(img, o.x, o.y + 20, broken ? 110 : 200);
                    else { ctx.fillStyle = '#1c151a'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); }
                } });
            }
            for (const t of chunk.trees) standing.push({ y: t.y + 24, draw: () => {
                const img = pick(t.variant === 1 ? V2.treeA : t.variant === 2 ? V2.treeB : V2.treeC, t.variant === 1 ? assets.tree1 : t.variant === 2 ? assets.tree2 : assets.tree3);
                if (!img) return;
                ctx.save(); ctx.translate(t.x, t.y + 30);
                ctx.rotate(Math.sin(time * 0.4 + t.sway) * 0.008);
                const h = t.size * (img.naturalHeight / img.naturalWidth);
                ctx.drawImage(img, -t.size / 2, -h + t.size * 0.1, t.size, h); ctx.restore();
            } });
            if (chunk.gate) standing.push({ y: chunk.gate.y + 60, draw: () => {
                const img = pick(V2.gate);
                const ready_ = piecesFound.length >= PIECES_TOTAL;
                if (ready_) glow(chunk.gate.x, chunk.gate.y, 260, '230,207,143', 0.18 + Math.sin(time * 2) * 0.05);
                if (img) drawStanding(img, chunk.gate.x, chunk.gate.y + 80, 460);
                else { ctx.strokeStyle = '#c0a060'; ctx.lineWidth = 6; ctx.strokeRect(chunk.gate.x - 120, chunk.gate.y - 200, 240, 260); }
            } });
            for (const e of chunk.enemies) standing.push({ y: e.y + e.r * 0.7, draw: () => drawEnemy(e) });
        }
        if (dropped) drawPiece(dropped.x, dropped.y, 0, true);
        for (const b of bolts) {
            const img = pick(V2.fxBolt);
            glow(b.x, b.y, 30, '160,220,90', 0.45);
            if (img) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.drawImage(img, -52, -26, 72, 52); ctx.restore(); }
            else { ctx.fillStyle = '#e8ffb0'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); }
        }
        renderFx();
        standing.push({ y: sn.y, draw: drawSnake });
        standing.sort((a, b) => a.y - b.y);
        for (const s of standing) s.draw();

        // 4. ground smoke
        if (quality > 0) {
            const puff = smokeSprite();
            for (const chunk of visible) for (const v of chunk.smoke) {
                for (let k = 0; k < 3; k++) {
                    const t = time * 0.32 + v.seed + k * 2.07;
                    const ph = (t % 6.2) / 6.2;
                    const x = v.x + Math.sin(t * 0.6 + k) * 28 + ph * 46, y = v.y - ph * 54 + Math.cos(t * 0.4) * 10;
                    const size = 120 + ph * 150;
                    const a = 0.26 * (1 - ph) * Math.min(1, ph * 5);
                    if (puff) { ctx.globalAlpha = a; ctx.drawImage(puff, x - size / 2, y - size / 2, size, size); ctx.globalAlpha = 1; }
                    else glow(x, y, size / 2, '120,110,105', a * 0.8);
                }
            }
        }

        // 5. her thread: a faint line of light from his head toward where she waits
        const target = threadTarget();
        if (target && !isDead) {
            const a = threadDirection(target);
            const d = Math.hypot(target.x - sn.x, target.y - sn.y);
            if (d > 90) {
                const pulse = 0.5 + Math.sin(time * 3) * 0.5;
                ctx.save();
                ctx.strokeStyle = `rgba(212,175,55,${0.14 + pulse * 0.12})`; ctx.lineWidth = 1.2; ctx.setLineDash([3, 9]); ctx.lineDashOffset = -time * 20;
                ctx.beginPath(); ctx.moveTo(sn.x + Math.cos(a) * 40, sn.y + Math.sin(a) * 40); ctx.lineTo(sn.x + Math.cos(a) * 130, sn.y + Math.sin(a) * 130); ctx.stroke();
                ctx.restore();
            }
        }

        // 6. tolls, particles
        for (const r of bellRings) {
            const k = r.t / 60;
            ctx.strokeStyle = `rgba(212, 175, 55, ${(1 - k) * 0.5})`; ctx.lineWidth = 3 - k * 2;
            ctx.beginPath(); ctx.arc(r.x, r.y, 30 + k * 520, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(212, 175, 55, ${(1 - k) * 0.25})`;
            ctx.beginPath(); ctx.arc(r.x, r.y, 10 + k * 380, 0, Math.PI * 2); ctx.stroke();
        }
        renderParticles();
        ctx.restore();

        // 7. fog
        if (fogBoost > 0) {
            const k = 1 + 0.75 * Math.sin(fogBoost * Math.PI / 2);
            ctx.drawImage(fogCanvas, -W * (k - 1) / 2, -H * (k - 1) / 2, W * k, H * k);
        } else {
            ctx.drawImage(fogCanvas, 0, 0);
        }
        for (const m of motes) {
            ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.t * 3));
            ctx.fillStyle = '#d8c090';
            ctx.beginPath(); ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (hurtFlash > 0) { ctx.fillStyle = `rgba(110,10,16,${(hurtFlash * 0.32).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
        // the wound on the edges of sight
        if (hp < 40) { const k = (1 - hp / 40) * (0.25 + 0.1 * Math.sin(time * 4)); const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75); g.addColorStop(0, 'rgba(90,0,10,0)'); g.addColorStop(1, `rgba(90,0,10,${k.toFixed(3)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

        drawSpeech();

        // 8. touch joystick
        if (touchActive) {
            const jDist = Math.min(Math.hypot(touchCurrentX - touchStartX, touchCurrentY - touchStartY), 45);
            const jx = touchStartX + Math.cos(touchAngle) * jDist, jy = touchStartY + Math.sin(touchAngle) * jDist;
            ctx.strokeStyle = 'rgba(192, 160, 96, 0.25)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(touchStartX, touchStartY, 50, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = 'rgba(192, 160, 96, 0.15)';
            ctx.beginPath(); ctx.moveTo(touchStartX, touchStartY); ctx.lineTo(jx, jy); ctx.stroke();
            ctx.fillStyle = 'rgba(192, 160, 96, 0.35)';
            ctx.beginPath(); ctx.arc(jx, jy, 18, 0, Math.PI * 2); ctx.fill();
        }

        if ((time * 20 | 0) % 12 === 0) drawMinimap();
    }

    // The body is the original sprite chain: head, scaled segments, tail. Only on-screen segments
    // are drawn, and each is placed with a single transform rather than save/translate/rotate/restore.
    function drawSnake() {
        const blink = grace > 0 && Math.floor(grace / 6) % 2 === 0;
        ctx.globalAlpha = blink ? 0.35 : 1;
        if (shed.active > 0) glow(sn.x, sn.y, 70, '240,216,144', 0.35);
        const headImg = pick(assets.snakeHead), bodyImg = pick(assets.snakeBody), tailImg = pick(assets.snakeTail);
        const vx0 = sn.x - W / 2 - 60, vx1 = sn.x + W / 2 + 60, vy0 = sn.y - H / 2 - 60, vy1 = sn.y + H / 2 + 60;
        const base = ctx.getTransform(); // the camera
        for (let s = sn.len - 1; s >= 0; s--) {
            const p = trail.get(Math.min(s * SG, trail.n - 1));
            if (!p) continue;
            if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
            const isHead = s === 0, isTail = s === sn.len - 1;
            let a = p.a;
            if (isTail) {
                const prev = trail.get(Math.min((s - 1) * SG, trail.n - 1));
                a = prev ? Math.atan2(p.y - prev.y, p.x - prev.x) : p.a + Math.PI;
            }
            const c = Math.cos(a), sn_ = Math.sin(a);
            ctx.setTransform(base.a * c + base.c * sn_, base.b * c + base.d * sn_, -base.a * sn_ + base.c * c, -base.b * sn_ + base.d * c, base.a * p.x + base.c * p.y + base.e, base.b * p.x + base.d * p.y + base.f);
            const img = isHead ? headImg : isTail ? tailImg : bodyImg;
            if (img) {
                const sizeShrink = isHead ? 0 : (s / sn.len) * (SS * 0.4);
                const drawSize = SS * 1.7 - sizeShrink;
                const h = drawSize * (img.naturalHeight / img.naturalWidth);
                ctx.drawImage(img, -drawSize / 2, -h / 2, drawSize, h);
            } else if (isHead) {
                ctx.fillStyle = '#5c1010'; ctx.beginPath(); ctx.ellipse(0, 0, SS / 1.2, SS / 1.5, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffdf73'; ctx.fillRect(SS / 4, -SS / 2.5, 5, 5); ctx.fillRect(SS / 4, SS / 2.5 - 5, 5, 5);
            } else {
                const currentSize = (SS / 1.5) - (s / sn.len) * (SS / 2);
                ctx.fillStyle = '#2b0606'; ctx.strokeStyle = '#5c1010'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0, 0, currentSize, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            }
        }
        ctx.setTransform(base);
        ctx.globalAlpha = 1;
        // his own light, wider the more of the stone he carries
        glow(sn.x, sn.y, 240 + greedLight(), '212,175,55', 0.06 + Math.min(0.05, greed / 2000));
    }

    // ═══════════════════════════════════════════════════════════════════
    // LOOP (fixed timestep logic, free-running render)
    // ═══════════════════════════════════════════════════════════════════
    let raf;
    let lastTime = 0, accumulator = 0;
    const FIXED_DT = 1000 / 60;
    function tick(timestamp) {
        raf = requestAnimationFrame(tick);
        if (!lastTime) { lastTime = timestamp; return; }
        const dt = Math.min(timestamp - lastTime, 100);
        accumulator += dt;
        lastTime = timestamp;
        frameMs += (dt - frameMs) * 0.05;
        if (frameMs > 26 && quality > 0) { quality--; frameMs = 16; resize(); }
        else if (frameMs < 15 && quality < 2 && timestamp > (tick.lastUp || 0) + 8000) { quality++; tick.lastUp = timestamp; resize(); }
        const t0 = performance.now();
        while (accumulator >= FIXED_DT) { update(); accumulator -= FIXED_DT; }
        const t1 = performance.now();
        render();
        const t2 = performance.now();
        perf.update += (t1 - t0 - perf.update) * 0.05;
        perf.render += (t2 - t1 - perf.render) * 0.05;
    }
    const perf = { update: 0, render: 0 };
    raf = requestAnimationFrame(tick);

    setShedUI('ready');
    actIdx = ACTS.reduce((acc, a, i) => (piecesFound.length >= a.at ? i : acc), 0);
    buildFog();
    _game = {
        begin() { enterAct(actIdx); },
        closeMemory, togglePause, shed: tryShed, bite: tryBite, openCodex, closeCodex,
        resetRun() {
            if (!confirm('Start the descent over? The pieces you carry and the diyas you lit are lost. The Memories stay.')) return;
            save.run = null; writeSave(save);
            if (_cleanup) { _cleanup(); _cleanup = null; }
            _cleanup = initGothicSnakeRPG();
        },
    };
    if (_loreShown) enterAct(actIdx); // coming back in after an ascension: straight in, with the act card

    return function cleanup() {
        _game = null;
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        canvas.removeEventListener('touchcancel', onTouchEnd);
        if (raf) cancelAnimationFrame(raf);
        if (ambientKick) clearTimeout(ambientKick);
        if (loadTimer) clearTimeout(loadTimer);
        if (actCardTimer) clearTimeout(actCardTimer);
        if (ambientInterval) clearInterval(ambientInterval);
        if (actCard) actCard.classList.remove('show');
        soundtrack.stop();
    };
}
