import { useEffect, registerHandler } from '../../../framework.js';

let _cleanup = null;
let _gameInstance = null;

export default function BaoliPage() {

    registerHandler('startBaoli', () => {
        const overlay = document.getElementById('baoli-start-overlay');
        if (overlay) overlay.style.display = 'none';
        if (_gameInstance && _gameInstance.start) _gameInstance.start();
    });

    useEffect(() => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        
        const init = async () => {
            const container = document.getElementById('baoli-container');
            if (!container) return;

            const { createGame } = await import('./engine.js');
            const result = createGame(container);
            _gameInstance = result;
            _cleanup = result.destroy;
        };

        init();

        return () => {
            if (_cleanup) { _cleanup(); _cleanup = null; }
        };
    }, []);

    return `
    <div id="baoli-root">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Noto+Serif+Devanagari:wght@400;700&display=swap');

            #baoli-root {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #0a0101; overflow: hidden; cursor: none;
                font-family: 'Cinzel', serif;
            }

            #baoli-container {
                width: 100%; height: 100%;
            }

            #baoli-container canvas {
                display: block; width: 100%; height: 100%;
            }

            #baoli-start-overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: radial-gradient(ellipse at center, #1a0505 0%, #0a0101 60%, #3d0202 100%);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                z-index: 100; cursor: default;
            }

            #baoli-start-overlay h1 {
                font-family: 'Cinzel', serif; font-weight: 900;
                font-size: clamp(2rem, 6vw, 5rem);
                color: #ff0055;
                text-shadow: 0 0 40px rgba(255, 0, 85, 0.4), 0 0 80px rgba(255, 0, 85, 0.15);
                letter-spacing: 0.3em;
                margin-bottom: 0.5em;
                animation: baoli-title-pulse 4s ease-in-out infinite;
            }

            #baoli-start-overlay .subtitle {
                font-family: 'Noto Serif Devanagari', serif;
                font-size: clamp(0.9rem, 2vw, 1.4rem);
                color: #ff66a3;
                letter-spacing: 0.15em;
                margin-bottom: 2em;
                opacity: 0.7;
            }

            #baoli-start-overlay .start-btn {
                font-family: 'Cinzel', serif; font-weight: 700;
                font-size: 1.1rem; letter-spacing: 0.2em;
                color: #ff0055; background: transparent;
                border: 1px solid rgba(255, 0, 85, 0.3);
                padding: 14px 50px; cursor: pointer;
                transition: all 0.6s ease;
                text-transform: uppercase;
            }

            #baoli-start-overlay .start-btn:hover {
                background: rgba(255, 0, 85, 0.1);
                border-color: rgba(255, 0, 85, 0.7);
                box-shadow: 0 0 30px rgba(255, 0, 85, 0.25);
            }

            #baoli-start-overlay .warning {
                position: absolute; bottom: 30px;
                font-size: 0.7rem; color: #4d001f; letter-spacing: 0.1em;
                opacity: 0.8;
            }

            @keyframes baoli-title-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            /* HUD */
            #baoli-hud {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none; z-index: 10;
            }

            #baoli-crosshair {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 4px; height: 4px;
                border-radius: 50%;
                background: rgba(255, 0, 85, 0.5);
                box-shadow: 0 0 6px rgba(255, 0, 85, 0.4);
            }

            #baoli-interact-prompt {
                position: absolute; top: 55%; left: 50%;
                transform: translateX(-50%);
                font-family: 'Cinzel', serif;
                font-size: 0.8rem; color: #ff0055;
                letter-spacing: 0.15em; opacity: 0;
                transition: opacity 0.3s ease;
                text-shadow: 0 0 10px rgba(255, 0, 85, 0.5);
            }

            #baoli-narrative-text {
                position: absolute; bottom: 15%; left: 50%;
                transform: translateX(-50%);
                font-family: 'Cinzel', serif;
                font-size: clamp(0.9rem, 1.8vw, 1.3rem);
                color: #ff66a3;
                letter-spacing: 0.12em;
                text-align: center;
                opacity: 0;
                transition: opacity 1.5s ease;
                max-width: 70%;
                line-height: 1.8;
                text-shadow: 0 0 20px rgba(255, 0, 85, 0.3);
            }

            #baoli-phase-text {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                font-family: 'Cinzel', serif;
                font-size: clamp(1.2rem, 3vw, 2.5rem);
                font-weight: 700;
                color: #ff0055;
                letter-spacing: 0.3em;
                opacity: 0;
                transition: opacity 2s ease;
                text-shadow: 0 0 40px rgba(255, 0, 85, 0.4);
                pointer-events: none;
            }

            /* Ending screen */
            #baoli-ending {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: #000; display: none;
                flex-direction: column; align-items: center; justify-content: center;
                z-index: 200;
            }

            #baoli-ending .ending-text {
                font-family: 'Cinzel', serif;
                font-size: clamp(1rem, 2.5vw, 1.8rem);
                color: #ff0055;
                letter-spacing: 0.15em;
                text-align: center;
                max-width: 60%;
                line-height: 2;
                opacity: 0;
                animation: baoli-fade-in 4s ease 2s forwards;
            }

            #baoli-ending .ending-subtext {
                font-family: 'Noto Serif Devanagari', serif;
                font-size: clamp(0.8rem, 1.5vw, 1.1rem);
                color: #ff66a3;
                letter-spacing: 0.1em;
                margin-top: 2em;
                opacity: 0;
                animation: baoli-fade-in 3s ease 6s forwards;
            }

            @keyframes baoli-fade-in {
                to { opacity: 1; }
            }

            /* Vignette */
            #baoli-vignette {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none; z-index: 5;
                background: radial-gradient(ellipse at center, transparent 30%, rgba(10,1,1,0.8) 100%);
            }
        </style>

        <div id="baoli-container"></div>

        <div id="baoli-vignette"></div>

        <div id="baoli-hud">
            <div id="baoli-crosshair"></div>
            <div id="baoli-interact-prompt">Click to light the Diya</div>
            <div id="baoli-narrative-text"></div>
            <div id="baoli-phase-text"></div>
        </div>

        <div id="baoli-ending">
            <div class="ending-text">"Only when the cup is empty, can it finally be filled."</div>
            <div class="ending-subtext">तृष्णा से मुक्ति</div>
        </div>

        <div id="baoli-start-overlay">
            <h1>बावली</h1>
            <button class="start-btn" data-action="startBaoli">Start</button>
        </div>
    </div>
    `;
}
