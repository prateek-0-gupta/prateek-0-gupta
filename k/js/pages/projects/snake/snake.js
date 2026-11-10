import { useEffect, registerHandler } from '../../../framework.js';
import createSoundtrack from './soundtrack.js';
import { ASSET_BASE } from './lore.js';
import { initGame } from './game.js';

let _cleanup = null;
let _game = null;                       // the running game's public hooks, for data-action handlers
const session = { started: false };     // true once the title screen has been passed
const soundtrack = createSoundtrack();

export default function SnakePage() {
    const start = () => { _game = initGame(soundtrack, session, restart); _cleanup = _game.cleanup; };
    const stop = () => { if (_cleanup) { _cleanup(); _cleanup = null; } _game = null; };
    function restart() { stop(); start(); }

    registerHandler('restartGame', restart);
    registerHandler('toggleSound', () => {
        const playing = soundtrack.toggle();
        const btn = document.getElementById('gs-sound-toggle');
        if (btn) { btn.textContent = playing ? '♫' : '♪'; btn.style.opacity = playing ? '1' : '0.5'; }
    });
    registerHandler('beginDescent', () => {
        const lore = document.getElementById('loreOverlay');
        if (lore) lore.style.display = 'none';
        if (_game) _game.begin();
    });
    registerHandler('closeMemory', () => { if (_game) _game.closeMemory(); });
    registerHandler('togglePause', () => { if (_game) _game.togglePause(); });
    registerHandler('shedSkin',    () => { if (_game) _game.shed(); });
    registerHandler('openCodex',   () => { if (_game) _game.openCodex(); });
    registerHandler('closeCodex',  () => { if (_game) _game.closeCodex(); });
    registerHandler('resetRun',    () => { if (_game) _game.resetRun(); });
    registerHandler('skipChoice',  () => { if (_game) _game.skipChoice(); });

    useEffect(() => {
        stop(); start();
        // the game must stop when the page is left: its timers hold on to
        // elements the framework will recycle for the next page
        return stop;
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
            #gs-map { display: block; width: 300px; height: auto; margin: 0 auto 4px; opacity: 0.95; }
            .gs-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: center; margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(192,160,96,0.14); font-family: var(--display); font-size: 0.5rem; letter-spacing: 0.14em; color: var(--dim); text-transform: uppercase; }
            .gs-legend .l-you { color: #e8e2d0; } .gs-legend .l-piece { color: var(--soul); } .gs-legend .l-mem { color: var(--mem); } .gs-legend .l-shrine { color: var(--flame); } .gs-legend .l-dead { color: #d0603a; } .gs-legend .l-gate { color: var(--brass-hi); }
            @media (max-height: 760px) { #gs-map { width: 220px; } .gs-legend { display: none; } }
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
            /* ═══ roguelite pieces: the coil row, boons, the ward's guardian, hints, the choice of boons ═══ */
            .gs-row.coil .gs-bar i { background: linear-gradient(90deg, #6a4a22, #f0a060); }
            .gs-row.coil .gs-ico img { filter: brightness(1.5) drop-shadow(0 0 4px rgba(0,0,0,0.9)); }
            .gs-pips b.seal { margin-right: 5px; position: relative; }
            .gs-pips b.seal::after { content: ''; position: absolute; right: -6px; top: -3px; width: 1px; height: 12px; background: rgba(230,207,143,0.6); transform: rotate(-45deg); }
            .gs-row.soul .gs-pips b { border-color: rgba(180,142,222,0.45); }
            .gs-row.soul .gs-pips b.on { background: var(--soul); border-color: var(--soul); box-shadow: 0 0 6px rgba(180,142,222,0.7); }
            .gs-pips em { font-family: var(--serif); font-size: 0.74rem; letter-spacing: 0; text-transform: none; color: var(--soul); }
            #gs-boons { list-style: none; margin: 8px 0 0 4px; display: flex; flex-direction: column; gap: 3px; max-width: 300px; }
            #gs-boons li { font-family: var(--display); font-size: 0.56rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--aspect); padding-left: 10px; border-left: 2px solid var(--aspect); text-shadow: 0 1px 3px #000; opacity: 0.9; }
            #gs-room { font-family: var(--serif); font-style: italic; font-size: 0.95rem; color: var(--ash); margin-top: 4px; min-height: 1.2em; text-shadow: 0 1px 4px #000; letter-spacing: 0.02em; }

            #gs-boss { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); z-index: 12; width: min(620px, calc(100% - 40px)); text-align: center; pointer-events: none; display: none; }
            #gs-boss .boss-name { font-family: var(--display); font-weight: 600; font-size: clamp(0.9rem, 2.2vw, 1.15rem); letter-spacing: 0.26em; color: var(--brass-hi); text-transform: uppercase; text-shadow: 0 2px 8px #000; }
            #gs-boss .boss-name small { display: block; font-family: var(--serif); font-style: italic; font-weight: 400; font-size: 0.86rem; letter-spacing: 0.04em; text-transform: none; color: var(--ash); margin: 2px 0 7px; }
            #gs-boss .boss-bar { height: 9px; background: rgba(10,6,8,0.8); border: 1px solid var(--line); position: relative; overflow: hidden; }
            #gs-boss .boss-bar i { position: absolute; inset: 0 auto 0 0; width: 100%; background: linear-gradient(90deg, #5a4a30, #a89468, #d8d2c4); transition: width 0.25s ease, background 0.3s; }
            #gs-boss .boss-bar b { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(9,6,8,0.95); box-shadow: 0 0 0 1px rgba(192,160,96,0.25); }
            #gs-boss.bound .boss-bar i { background: linear-gradient(90deg, #7a1a16, #e0552e, #ffd070); }
            #gs-boss.bound .boss-bar { border-color: #ffd070; box-shadow: 0 0 14px rgba(255,208,112,0.45); }
            #gs-boss .boss-note { font-family: var(--display); font-size: 0.52rem; letter-spacing: 0.3em; color: var(--dim); text-transform: uppercase; margin-top: 6px; }
            #gs-boss.bound .boss-note { visibility: hidden; }

            #gs-hint {
                position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%) translateY(8px); z-index: 14; pointer-events: none;
                font-family: var(--serif); font-size: clamp(1rem, 2.2vw, 1.2rem); color: #f0e2bc; text-align: center; max-width: min(620px, calc(100% - 40px));
                padding: 10px 22px; background: rgba(9,6,8,0.72); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
                opacity: 0; transition: opacity 0.6s ease, transform 0.6s ease;
            }
            #gs-hint.show { opacity: 1; transform: translateX(-50%); }

            #choiceOverlay { background: rgba(4, 2, 4, 0.86); z-index: 29; gap: 6px; }
            #choiceOverlay h1 { font-size: clamp(1.4rem, 4vw, 2.2rem); letter-spacing: 0.28em; color: var(--brass-hi); margin-top: 6px; }
            #choiceOverlay .choice-sub { font-style: italic; color: var(--ash); margin-bottom: 14px; font-size: clamp(0.95rem, 2vw, 1.1rem); }
            .gs-cards { display: flex; gap: clamp(10px, 1.6vw, 20px); flex-wrap: wrap; justify-content: center; margin-bottom: 18px; }
            .gs-card {
                position: relative; width: clamp(180px, 21vw, 240px); min-height: 212px; padding: 34px 20px 20px; cursor: pointer; text-align: center; justify-content: center;
                background: linear-gradient(180deg, rgba(22,15,18,0.96), rgba(9,6,8,0.96)); color: #c9b58a; font-family: var(--serif);
                border: 1px solid var(--line); border-image: url('${ASSET_BASE}ui/ui_frame.png') 190 / 18px / 0 round;
                transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 18px 40px rgba(0,0,0,0.6);
                display: flex; flex-direction: column; align-items: center; gap: 10px;
            }
            .gs-card::before { content: ''; position: absolute; left: 22px; right: 22px; top: 18px; height: 2px; background: linear-gradient(90deg, transparent, var(--aspect), transparent); }
            .gs-card:hover, .gs-card:focus-visible { transform: translateY(-6px); filter: brightness(1.2); box-shadow: 0 24px 50px rgba(0,0,0,0.7), 0 0 26px color-mix(in srgb, var(--aspect) 30%, transparent); outline: none; }
            .gs-card .card-key { position: absolute; top: 24px; left: 22px; font-family: var(--display); font-size: 0.62rem; color: var(--dim); border: 1px solid rgba(192,160,96,0.3); padding: 0 5px; }
            .gs-card .card-skt { font-family: var(--display); font-size: 0.56rem; letter-spacing: 0.26em; text-transform: uppercase; color: var(--aspect); margin-top: 6px; }
            .gs-card h3 { font-family: var(--display); font-weight: 600; font-size: 1.05rem; letter-spacing: 0.1em; color: var(--brass-hi); line-height: 1.25; }
            .gs-card p { font-size: 1.02rem !important; line-height: 1.4 !important; color: #c9b58a; flex: 1; }
            .gs-card .card-cost { font-family: var(--display); font-size: 0.6rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--aspect); border-top: 1px solid rgba(192,160,96,0.18); padding-top: 9px; width: 100%; }
            .gs-card.sold { opacity: 0.35; pointer-events: none; }
            @media (max-width: 640px) { .gs-card { width: calc(50% - 8px); min-height: 200px; padding: 26px 12px 16px; } .gs-card p { font-size: 0.92rem !important; } }

            .mem-panel .mem-reward { display: grid; gap: 4px; }
            .mem-panel .mem-reward span { color: var(--verm); }
            .mem-panel .mem-reward b { font-family: var(--serif); font-weight: 500; font-style: italic; font-size: 1.05rem; letter-spacing: 0; text-transform: none; color: var(--mem); }
            #codexOverlay .codex-entry .codex-perk { font-style: italic; color: var(--mem); font-size: 0.95rem; margin-top: 6px; }
            .pause-boons { list-style: none; text-align: left; margin: 0 auto 22px; max-width: 460px; display: grid; gap: 7px; }
            .pause-boons li { padding-left: 12px; border-left: 2px solid var(--aspect, var(--dim)); }
            .pause-boons li b { display: block; font-family: var(--display); font-weight: 600; font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--aspect); }
            .pause-boons li span { font-size: 0.98rem; color: #b9a67d; }
            #gameOverlay .death-kept { font-style: italic; color: var(--mem); font-size: 1rem; margin-bottom: 24px; }
            #gameOverlay .death-stats { margin-bottom: 14px; }
            #loreOverlay .lore-rites li.coil i { color: #f0a060; }
            /* tall panels must scroll from their top, not be centred off the screen */
            #victoryOverlay, #gameOverlay, #choiceOverlay { justify-content: flex-start; }
            #victoryOverlay .victory-panel, #gameOverlay .death-panel { margin: auto; }
            #choiceOverlay > :first-child { margin-top: auto; } #choiceOverlay > :last-child { margin-bottom: auto; }
            @media (max-height: 760px) { #gs-boons { display: none; } }
        </style>

        <div id="gs-ui">
            <div id="gs-hud-stats" class="gs-frame tight">
                <canvas id="gs-map" width="300" height="225"></canvas>
                <div class="gs-legend"><span class="l-you">● you</span><span class="l-dead">○ the dead</span><span class="l-shrine">● shrine</span><span class="l-mem">○ memory</span><span class="l-gate">■ yaksha</span><span class="l-piece">◆ the seal</span></div>
                <div class="gs-row prana">
                    <span class="gs-ico"><img src="${ASSET_BASE}ui/ui_icon_flame.png" alt="" onerror="this.replaceWith('◉')"></span><span>Prana</span>
                    <span class="gs-bar"><i id="hpBar" style="width:100%"></i></span>
                    <span class="gs-val"><span id="hpLabel"> </span></span>
                </div>
                <div class="gs-row coil">
                    <span class="gs-ico"><img src="${ASSET_BASE}ui/ui_icon_shed.png" alt="" onerror="this.replaceWith('◎')"></span><span>Coil</span>
                    <span class="gs-bar"><i id="lenBar"></i></span>
                    <span class="gs-val"><span id="lenVal">16</span><small>long</small></span>
                </div>
                <div class="gs-row soul">
                    <span class="gs-ico"><img src="${ASSET_BASE}ui/ui_icon_soul.png" alt="" onerror="this.replaceWith('✦')"></span><span>Amrita</span>
                    <span class="gs-pips" id="piecePips"></span>
                    <span class="gs-val"><span id="soulVal">0</span><small>/ 27</small></span>
                </div>
                <div class="gs-row mem">
                    <span class="gs-ico"><img src="${ASSET_BASE}ui/ui_icon_lotus.png" alt="" onerror="this.replaceWith('❀')"></span><span>Memories</span>
                    <span class="gs-pips" id="memPips"></span>
                    <span class="gs-val"><span id="memVal">0</span><small>/ 9</small></span>
                </div>
                <div class="gs-foot">
                    <div id="gs-bite" class="ready"><i></i><span>Venom · F</span></div>
                    <div id="gs-shed" class="ready"><em></em><i></i><span id="gs-shed-label">Shed · space</span></div>
                </div>
            </div>
            <ul id="gs-boons"></ul>
        </div>
        <div id="gs-act-banner">
            <div class="gs-kicker" id="gs-act">WARD I</div>
            <div class="gs-rule"><span id="gs-act-title">The Sunken Gardens</span></div>
            <div id="gs-room"></div>
        </div>
        <div id="gs-controls">
            <button data-action="togglePause" title="Pause">II</button>
            <button id="gs-sound-toggle" data-action="toggleSound" title="Toggle Music">♫</button>
        </div>

        <div id="gs-boss">
            <div class="boss-name"><span id="bossName"></span><small id="bossTitle"></small></div>
            <div class="boss-bar"><i id="bossBar"></i><b style="left:33.3%"></b><b style="left:66.6%"></b></div>
            <div class="boss-note">brass turns the fang · bind him in a coil</div>
        </div>
        <div id="gs-hint"></div>
        <div id="gs-act-card">
            <div class="gs-kicker" id="actNum"></div>
            <div class="act-title" id="actTitle"></div>
            <div class="act-epi" id="actEpi"></div>
        </div>

        <div id="loadingOverlay" class="gs-overlay">
            <img class="load-logo" src="${ASSET_BASE}logo.png" alt="" />
            <div class="load-title">NAGMANI</div>
            <div class="gs-kicker">The Naga’s Requiem</div>
            <div class="load-bar-wrap"><div class="load-bar" id="loadBar"></div></div>
            <div class="load-hint">Awakening the forgotten ruins…</div>
        </div>

        <div id="loreOverlay" class="gs-overlay">
            <div class="lore-bg"></div>
            <div class="lore-edge"></div>
            <img class="lore-portrait" src="${ASSET_BASE}naagraj.png" alt="" onerror="this.style.display='none'" />
            <div class="lore-inner">
                <div class="lore-col">
                    <img class="lore-logo" src="${ASSET_BASE}logo.png" alt="" />
                    <h1>NAGMANI</h1>
                    <h2>The Naga’s Requiem</h2>
                    <div class="lore-divider"></div>
                </div>
                <p class="lore-text lore-col">
                    You are <strong>Naagraj</strong>, Serpent King of Patala. The <strong>Nagmani</strong> was yours and you would not share it. When the Brass King came for it you chose the stone over the city; the city burned, and your queen <strong>Amrita</strong> was broken into twenty-seven pieces. You swore on the broken stone not to rest until she was whole, and it heard you. You cannot die. Each time you fall you wake in the Gardens, and <strong>the city has moved its streets in the night</strong>.
                </p>
                <div class="lore-rites gs-frame tight lore-col">
                    <h3>The Rites</h3>
                    <ul>
                        <li class="coil"><i>◎</i><span><strong>The coil is your weapon.</strong> Lead the dead, circle them, and cross your own body: the closed loop crushes everything inside it. The more you catch at once, the harder it closes.</span></li>
                        <li><i>◈</i><span>Your body is a <strong>wall</strong> the dead cannot walk through, and the only purse you have. <strong>Shards</strong> of the stone lengthen it; the Yaksha is paid in it; a hungry ghost will gnaw it.</span></li>
                        <li class="soul"><i>✦</i><span>Each chamber seals until it is yours again, then gives up a <strong>piece of her</strong>. Enough pieces break the ward’s seal, and what waits behind it is brass: <strong>bind it in a coil</strong> before your fangs will bite.</span></li>
                        <li class="fire"><i>◉</i><span><strong>Shrines</strong> grant boons. They last one descent. Three wards down, then the bridge over the Vaitarani, and the king who broke her.</span></li>
                        <li class="mem"><i>❀</i><span>Every ward hides one <strong>Memory</strong>. A Memory is the only thing the city cannot take back, and each one changes you for good. She will know if you skipped them.</span></li>
                    </ul>
                </div>
                <p class="lore-stats lore-col" id="loreStats"></p>
                <div class="gs-btn-row">
                    <button class="gs-btn" data-action="beginDescent" id="loreBeginBtn">Begin Descent</button>
                    <button class="gs-btn ghost" data-action="resetRun" id="loreResetBtn">Start Over</button>
                    <button class="gs-btn ghost" data-action="openCodex" id="loreCodexBtn">Read the Memories</button>
                </div>
                <p class="lore-controls lore-col">
                    <kbd>Mouse</kbd> <kbd>WASD</kbd> <b>steer</b> · <kbd>Click</kbd> <kbd>F</kbd> <b>fangs / venom</b> · <kbd>Right click</kbd> <kbd>Space</kbd> <b>shed</b> · <kbd>P</kbd> <b>pause</b>
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
                    <div class="mem-reward"><span>What it leaves in you</span><b id="memReward"></b></div>
                    <button class="gs-btn" data-action="closeMemory">Carry It</button>
                </div>
            </div>
        </div>

        <div id="choiceOverlay" class="gs-overlay">
            <div class="gs-kicker" id="choiceKicker">Vardaan</div>
            <h1 id="choiceTitle">Choose a Boon</h1>
            <div class="gs-divider"></div>
            <p class="choice-sub" id="choiceSub"></p>
            <div class="gs-cards" id="choiceCards"></div>
            <button class="gs-btn ghost" data-action="skipChoice" id="choiceSkip">Leave Him to His Scales</button>
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
                <ul class="pause-boons" id="pauseBoons"></ul>
                <div class="gs-btn-row">
                    <button class="gs-btn" data-action="togglePause">Resume</button>
                    <button class="gs-btn ghost" data-action="openCodex">Read the Memories</button>
                </div>
            </div>
        </div>

        <div id="victoryOverlay" class="gs-overlay">
            <div class="victory-panel gs-frame">
                <img class="victory-portrait" src="${ASSET_BASE}amrita.png" alt="" onerror="this.style.display='none'" />
                <div class="gs-kicker" id="victoryKicker">She is whole</div>
                <h1 id="victoryTitle">ASCENSION</h1>
                <div class="gs-divider"></div>
                <p class="victory-text" id="victoryText"></p>
                <button class="gs-btn" data-action="restartGame">Descend Once More</button>
            </div>
        </div>

        <div id="gameOverlay" class="gs-overlay">
            <div class="death-panel gs-frame">
                <div class="gs-kicker">The coil goes slack</div>
                <h1>He Wakes in the Gardens</h1>
                <div class="gs-divider"></div>
                <p class="death-quote" id="deathQuote"></p>
                <p class="death-stats" id="deathStats"></p>
                <p class="death-kept" id="deathKept"></p>
                <button class="gs-btn" data-action="restartGame">Wake Again</button>
            </div>
        </div>

        <button id="gs-shed-btn" data-action="shedSkin">SHED</button>
        <button id="gs-bite-btn">STRIKE</button>
        <canvas id="gameCanvas"></canvas>
    </div>
    `;
}
