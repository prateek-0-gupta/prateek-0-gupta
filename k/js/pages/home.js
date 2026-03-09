import { useEffect } from '../framework.js';
import { Footer } from '../components/Footer.js';

let _jigsawCleanup = null;

export default function Home() {

    useEffect(() => {
        if (_jigsawCleanup) { _jigsawCleanup(); _jigsawCleanup = null; }
        _jigsawCleanup = initJigsawTypography();
    }, []);

    return `
    <style>
        .jigsaw-hero {
            position: relative; width: 100%; height: 100vh;
            overflow: hidden; background: #0a0a0a;
        }
        .jigsaw-hero canvas {
            display: block; width: 100%; height: 100%; cursor: pointer;
        }

        /* Top-left social + projects */
        .hero-sidebar {
            position: absolute; top: 2rem; left: 2rem; z-index: 20;
            display: flex; flex-direction: row; gap: 1.4rem;
        }
        .hero-social {
            display: flex; flex-direction: column; gap: 0.75rem;
        }
        .hero-social a {
            display: flex; align-items: center; justify-content: center;
            width: 36px; height: 36px;
            color: rgba(255,255,255,0.45);
            transition: color 0.3s;
            text-decoration: none;
        }
        .hero-social a:hover { color: #fff; }
        .hero-social a svg { width: 20px; height: 20px; }

        .hero-projects {
            display: flex; flex-direction: column; gap: 0.5rem;
            padding-top: 0.6rem;
            border-top: 1px solid rgba(255,255,255,0.08);
        }
        .hero-projects-label {
            font-family: 'Inter', sans-serif;
            font-size: 0.6rem;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: rgba(255,255,255,0.25);
        }
        .hero-projects a {
            color: rgba(255,255,255,0.5);
            font-family: 'Outfit', sans-serif;
            font-size: 0.8rem;
            letter-spacing: 0.04em;
            text-decoration: none;
            transition: color 0.3s;
        }
        .hero-projects a:hover { color: #fff; }

        /* Bottom-left identity */
        .hero-identity {
            position: absolute; bottom: 2.5rem; left: 2rem; z-index: 20;
            pointer-events: none;
        }
        .hero-identity .subtitle {
            font-family: 'Outfit', sans-serif;
            font-size: clamp(0.7rem, 1.4vw, 0.9rem);
            color: rgba(255,255,255,0.45);
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 0.35rem;
        }
        .hero-identity .location {
            font-family: 'Inter', sans-serif;
            font-size: 0.65rem;
            color: rgba(255,255,255,0.28);
            letter-spacing: 0.12em;
            text-transform: uppercase;
            display: flex; align-items: center; gap: 0.35rem;
        }

        /* Below-hero */
        .home-below { background: var(--bg); position: relative; z-index: 1; }

        @media (max-width: 600px) {
            .hero-sidebar { top: 1.2rem; left: 1.2rem; }
            .hero-identity { bottom: 1.2rem; left: 1.2rem; }
        }
    </style>

    <div class="jigsaw-hero">
        <canvas id="typeCanvas"></canvas>

        <div class="hero-sidebar">
            <div class="hero-social">
                <a href="mailto:prateekgupta1198@gmail.com" title="Email" aria-label="Email">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </a>
                <a href="https://www.linkedin.com/in/prateek-gupta08" target="_blank" title="LinkedIn" aria-label="LinkedIn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                </a>
                <a href="https://www.instagram.com/chai.and.photoshop" target="_blank" title="Instagram" aria-label="Instagram">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </a>
            </div>
            <div class="hero-projects">
                <span class="hero-projects-label">Projects</span>
                <a href="/snake" data-link>NaagMani - a snake game</a>
            </div>
        </div>

        <div class="hero-identity">
            <div class="subtitle">Hi, I am Prateek, i am a software engineer and a creative future media practitioner</div>
            <div class="location">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Manchester, UK
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Sum Vivas Ltd
            </div>
        
        </div>
    </div>

   
    `;
}

/* ═══════════════════════════════════════════════════════════════════
   JIGSAW TYPOGRAPHY ENGINE
   ═══════════════════════════════════════════════════════════════════ */

const ALPHABET = {
  A:{o:[0.615,0.024,0.36,0.024,0.054,0.957,0.309,0.957,0.329,0.704,0.628,0.696,0.639,0.943,0.954,0.957,0.615,0.024],h:[[0.398,0.414,0.449,0.15,0.529,0.152,0.578,0.414,0.398,0.414]]},
  B:{o:[0.956,0.609,0.698,0.5,0.948,0.414,0.969,0.035,0.032,0.035,0.032,0.97,0.956,0.957,0.956,0.609],h:[[0.733,0.095,0.733,0.337,0.268,0.424,0.268,0.127,0.733,0.095],[0.733,0.859,0.268,0.859,0.268,0.632,0.733,0.662,0.733,0.859]]},
  C:{o:[0.952,0.035,0.036,0.035,0.036,0.97,0.952,0.957,0.819,0.746,0.37,0.694,0.365,0.291,0.864,0.199,0.952,0.035]},
  D:{o:[0.035,0.035,0.035,0.97,0.954,0.84,0.954,0.212,0.035,0.035],h:[[0.702,0.693,0.382,0.757,0.375,0.254,0.704,0.395,0.702,0.693]]},
  E:{o:[0.045,0.035,0.045,0.97,0.958,0.97,0.795,0.699,0.303,0.726,0.388,0.56,0.795,0.516,0.798,0.443,0.398,0.404,0.287,0.247,0.795,0.213,0.958,0.035,0.045,0.035]},
  F:{o:[0.962,0.035,0.033,0.035,0.033,0.97,0.29,0.888,0.293,0.617,0.632,0.606,0.709,0.461,0.307,0.465,0.3,0.234,0.862,0.234,0.962,0.035]},
  G:{o:[0.954,0.04,0.025,0.04,0.025,0.964,0.954,0.964,0.843,0.5,0.468,0.48,0.488,0.692,0.666,0.695,0.663,0.756,0.212,0.811,0.261,0.263,0.805,0.363,0.954,0.04]},
  H:{o:[0.032,0.04,0.032,0.964,0.311,0.895,0.239,0.649,0.733,0.621,0.666,0.89,0.969,0.964,0.969,0.04,0.656,0.153,0.733,0.466,0.239,0.5,0.304,0.167,0.032,0.04]},
  I:{o:[0.036,0.04,0.151,0.268,0.409,0.374,0.409,0.673,0.121,0.792,0.036,0.964,0.952,0.964,0.903,0.79,0.585,0.662,0.592,0.369,0.88,0.241,0.952,0.04,0.036,0.04]},
  J:{o:[0.035,0.04,0.954,0.04,0.896,0.204,0.591,0.204,0.654,0.946,0.32,0.946,0.293,0.463,0.402,0.463,0.412,0.757,0.524,0.771,0.459,0.217,0.178,0.339,0.035,0.04]},
  K:{o:[0.045,0.044,0.045,0.974,0.447,0.974,0.447,0.643,0.958,0.946,0.958,0.59,0.482,0.475,0.958,0.396,0.958,0.04,0.444,0.352,0.45,0.044,0.045,0.044]},
  L:{o:[0.045,0.04,0.045,0.974,0.962,0.962,0.845,0.772,0.378,0.759,0.365,0.11,0.045,0.04]},
  M:{o:[0.025,0.049,0.025,0.962,0.284,0.878,0.282,0.421,0.412,0.705,0.54,0.541,0.561,0.895,0.954,0.962,0.954,0.071,0.444,0.385,0.025,0.049]},
  N:{o:[0.032,0.049,0.093,0.962,0.271,0.498,0.862,0.962,0.969,0.085,0.747,0.663,0.032,0.049]},
  O:{o:[0.036,0.049,0.127,0.962,0.921,0.887,0.952,0.107,0.036,0.049],h:[[0.632,0.647,0.365,0.647,0.365,0.349,0.632,0.349,0.632,0.647]]},
  P:{o:[0.954,0.049,0.35,0.061,0.035,0.061,0.035,0.966,0.313,0.966,0.31,0.817,0.306,0.665,0.303,0.566,0.619,0.48,0.837,0.42,0.944,0.208,0.954,0.049],h:[[0.273,0.42,0.273,0.244,0.375,0.241,0.5,0.237,0.515,0.275,0.537,0.329,0.425,0.368,0.273,0.42]]},
  Q:{o:[0.722,0.817,0.958,0.06,0.631,0.077,0.045,0.077,0.064,0.962,0.595,0.891,0.958,0.962,0.958,0.859,0.722,0.817],h:[[0.557,0.62,0.286,0.705,0.252,0.275,0.585,0.275,0.557,0.62]]},
  R:{o:[0.962,0.133,0.045,0.049,0.045,0.962,0.337,0.962,0.353,0.777,0.724,0.962,0.962,0.755,0.622,0.553,0.962,0.133],h:[[0.278,0.539,0.257,0.25,0.639,0.207,0.278,0.539]]},
  S:{o:[0.954,0.074,0.025,0.38,0.5,0.733,0.025,0.966,0.954,0.966,0.476,0.402,0.733,0.497,0.954,0.074]},
  T:{o:[0.044,0.049,0.158,0.372,0.475,0.285,0.36,0.966,0.705,0.966,0.571,0.286,0.907,0.357,0.969,0.049,0.044,0.049]},
  U:{o:[0.066,0.049,0.066,0.966,0.952,0.932,0.938,0.049,0.658,0.223,0.748,0.729,0.3,0.743,0.378,0.231,0.066,0.049]},
  V:{o:[0.035,0.049,0.577,0.966,0.954,0.032,0.569,0.175,0.569,0.637,0.246,0.049,0.035,0.049]},
  W:{o:[0.045,0.032,0.213,0.94,0.501,0.713,0.81,0.929,0.936,0.017,0.045,0.032]},
  X:{o:[0.675,0.426,0.918,0.577,0.774,0.94,0.523,0.628,0.289,0.94,0.132,0.738,0.379,0.449,0.045,0.032,0.495,0.313,0.726,0.043,0.962,0.043,0.675,0.426]},
  Y:{o:[0.514,0.491,0.797,0.926,0.687,0.975,0.025,0.225,0.221,0.042,0.471,0.425,0.656,0.07,0.863,0.268,0.514,0.491]},
  Z:{o:[0.063,0.042,0.131,0.449,0.591,0.206,0.084,0.975,0.934,0.975,0.956,0.298,0.385,0.759,0.956,0.03,0.063,0.042]}
};

function initJigsawTypography() {
    const canvas = document.getElementById('typeCanvas');
    if (!canvas) return () => {};
    const ctx = canvas.getContext('2d');

    const TEXT = 'PRATEEK';
    const DISTORTION = 0.4;
    const GAP = 0.04;
    const SHADOW_DEPTH = 12;
    const SPEED_MS = 2500;

    function resizeCanvas() {
        const hero = canvas.parentElement;
        canvas.width = hero.clientWidth;
        canvas.height = hero.clientHeight;
        generate(true);
    }
    window.addEventListener('resize', resizeCanvas);

    let autoTimer = null;
    function restartTimer() {
        if (autoTimer) clearInterval(autoTimer);
        autoTimer = setInterval(() => generate(true), SPEED_MS);
    }

    function random(min, max) { return Math.random() * (max - min) + min; }

    let currentPalette = null;

    function randomMonoPalette() {
        const bgL = 2 + Math.random() * 6;
        const fgL = 82 + Math.random() * 18;
        const shL = 18 + Math.random() * 27;
        return {
            bg: `hsl(0, 0%, ${bgL.toFixed(1)}%)`,
            fg: `hsl(0, 0%, ${fgL.toFixed(1)}%)`,
            shadow: `hsl(0, 0%, ${shL.toFixed(1)}%)`
        };
    }

    let currentBoundaries = [];

    function mapPoint(u, v, boundsLeft, boundsRight, gap) {
        u = gap + u * (1 - 2 * gap);
        v = gap + v * (1 - 2 * gap);
        const segmentsY = boundsLeft.length - 1;
        let segmentFloat = v * segmentsY;
        let idx = Math.floor(segmentFloat);
        if (idx >= segmentsY) idx = segmentsY - 1;
        let localV = segmentFloat - idx;
        let xL = boundsLeft[idx].x + (boundsLeft[idx+1].x - boundsLeft[idx].x) * localV;
        let yL = boundsLeft[idx].y + (boundsLeft[idx+1].y - boundsLeft[idx].y) * localV;
        let xR = boundsRight[idx].x + (boundsRight[idx+1].x - boundsRight[idx].x) * localV;
        let yR = boundsRight[idx].y + (boundsRight[idx+1].y - boundsRight[idx].y) * localV;
        return { x: xL + (xR - xL) * u, y: yL + (yR - yL) * u };
    }

    function generateBoundaries(numLetters, width, height, padding, distortion) {
        const bounds = [];
        const segmentsY = 4;
        const cellWidth = (width - padding * 2) / numLetters;
        const segH = (height - padding * 2) / segmentsY;
        for (let i = 0; i <= numLetters; i++) {
            let columnLine = [];
            for (let j = 0; j <= segmentsY; j++) {
                let x = padding + i * cellWidth;
                let y = padding + j * segH;
                if (i > 0 && i < numLetters) x += random(-cellWidth * distortion, cellWidth * distortion);
                y += random(-15, 15);
                columnLine.push({ x, y });
            }
            bounds.push(columnLine);
        }
        const minGap = cellWidth * 0.08;
        for (let j = 0; j <= segmentsY; j++) {
            for (let i = 1; i <= numLetters; i++) {
                const lo = bounds[i - 1][j].x + minGap;
                if (bounds[i][j].x < lo) bounds[i][j].x = lo;
            }
            for (let i = numLetters - 1; i >= 0; i--) {
                const hi = bounds[i + 1][j].x - minGap;
                if (bounds[i][j].x > hi) bounds[i][j].x = hi;
            }
        }
        return bounds;
    }

    function generate(regenerateGrid = true) {
        if (regenerateGrid || !currentPalette) {
            currentPalette = randomMonoPalette();
            const hero = canvas.parentElement;
            if (hero) hero.style.backgroundColor = currentPalette.bg;
        }

        const text = TEXT;
        const fillColor = currentPalette.fg;
        const shadowCol = currentPalette.shadow;
        const PADDING = Math.min(canvas.width, canvas.height) * 0.06;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (regenerateGrid || currentBoundaries.length !== text.length + 1) {
            currentBoundaries = generateBoundaries(text.length, canvas.width, canvas.height, PADDING, DISTORTION);
        }

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const letterData = ALPHABET[char];
            if (!letterData || !letterData.o || letterData.o.length === 0) continue;

            const bL = currentBoundaries[i];
            const bR = currentBoundaries[i + 1];

            ctx.beginPath();
            for (let j = 0; j < letterData.o.length; j += 2) {
                let pt = mapPoint(letterData.o[j], letterData.o[j+1], bL, bR, GAP);
                if (j === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            }
            ctx.closePath();

            if (letterData.h) {
                for (let h = 0; h < letterData.h.length; h++) {
                    const hole = letterData.h[h];
                    for (let j = 0; j < hole.length; j += 2) {
                        let pt = mapPoint(hole[j], hole[j+1], bL, bR, GAP);
                        if (j === 0) ctx.moveTo(pt.x, pt.y);
                        else ctx.lineTo(pt.x, pt.y);
                    }
                    ctx.closePath();
                }
            }

            ctx.fillStyle = fillColor;
            ctx.shadowColor = shadowCol;
            ctx.shadowOffsetX = SHADOW_DEPTH;
            ctx.shadowOffsetY = SHADOW_DEPTH;
            ctx.shadowBlur = 0;
            ctx.fill('evenodd');

            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = shadowCol;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
    }

    canvas.addEventListener('click', () => generate(true));

    // Boot
    resizeCanvas();
    restartTimer();

    return function cleanup() {
        window.removeEventListener('resize', resizeCanvas);
        if (autoTimer) clearInterval(autoTimer);
    };
}
