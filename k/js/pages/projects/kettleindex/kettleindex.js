import { useEffect } from '../../../framework.js';

// ── Research-grounded constants ──────────────────────────────────────
// Weighted average across deployment landscape (2B–300B+ models,
// A100/H100 mix, typical production batch sizes).
// Sources: arxiv 2512.03024, LLM Tracker, DitchCarbon, Epoch AI.
const AVG_J_PER_TOKEN = 4.0;          // Joules per token (blended average)
const KETTLE_WH_PER_LITRE = 100;      // Standard kettle ~100 Wh to boil 1 L
const CO2_G_PER_KWH = 445;            // Global average grid intensity
const PHONE_CHARGE_WH = 15;           // Full smartphone charge
const LED_WATTS = 9;                  // 60W-equiv LED bulb actual draw
const MICROWAVE_WH_PER_MIN = 16.67;   // 1 kW microwave
const STREAMING_WH_PER_HR = 150;      // 4K Netflix (incl. datacenter + router)

const fmt = (v, d = 2) => Number(v).toLocaleString(undefined, {
    maximumFractionDigits: d, minimumFractionDigits: 0
});

function estimateTokens(text) {
    const s = String(text || '').trim();
    return s ? Math.ceil(s.length / 4) : 0;
}

function formatDuration(seconds) {
    if (seconds < 0.001) return '0 s';
    if (seconds < 1)     return `${fmt(seconds * 1000, 1)} ms`;
    if (seconds < 60)    return `${fmt(seconds, 1)} s`;
    if (seconds < 3600)  return `${fmt(seconds / 60, 1)} min`;
    return `${fmt(seconds / 3600, 1)} hr`;
}

let _animFrame = null;
let _displayed = { kettlePct: 0 };

// SVG water gauge bounds (in SVG viewBox coords 0–512)
const WATER_BOTTOM = 392;
const WATER_TOP    = 110;
const WATER_RANGE  = WATER_BOTTOM - WATER_TOP;

function animateTo(targetPct) {
    if (_animFrame) cancelAnimationFrame(_animFrame);
    const start = _displayed.kettlePct;
    const diff = targetPct - start;
    const duration = 600;
    const t0 = performance.now();
    function step(now) {
        const p = Math.min((now - t0) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);          
        _displayed.kettlePct = start + diff * ease;

        const clipRect = document.getElementById('ki-clip-rect');
        const pctLabel = document.getElementById('ki-pct');
        if (clipRect) {
            const h = (_displayed.kettlePct / 100) * WATER_RANGE;
            clipRect.setAttribute('y', String(WATER_BOTTOM - h));
            clipRect.setAttribute('height', String(h));
        }
        if (pctLabel) pctLabel.textContent = `${fmt(_displayed.kettlePct, 1)}%`;
        if (p < 1) _animFrame = requestAnimationFrame(step);
    }
    _animFrame = requestAnimationFrame(step);
}

function recalc() {
    const el = id => document.getElementById(id);
    const num = id => Math.max(0, Number(el(id)?.value || 0));
    const set = (id, v) => { const e = el(id); if (e) e.textContent = v; };

    const totalTokens = num('ki-in') + num('ki-out');
    const totalJ  = totalTokens * AVG_J_PER_TOKEN;
    const totalWh = totalJ / 3600;
    const co2g    = (totalWh / 1000) * CO2_G_PER_KWH;
    const kettles = totalWh / KETTLE_WH_PER_LITRE;
    const mlBoiled = kettles * 1000;

    animateTo(Math.min(kettles * 100, 100));

    const steam = el('ki-steam');
    if (steam) steam.style.opacity = kettles > 0.001 ? Math.min(kettles * 8, 1) : 0;

    const svg = el('ki-kettle-svg');
    if (svg) svg.classList.toggle('ki-hot', kettles > 0.05);

    // Stats
    set('ki-ml',       `${fmt(mlBoiled, 1)} ml`);
    set('ki-kettles',  kettles >= 1 ? `${fmt(kettles, 2)} kettles` : `${fmt(kettles * 100, 2)}% of a kettle`);
    set('ki-joules',   `${fmt(totalJ, 0)} J`); // Match screenshot precision
    set('ki-wh',       `${fmt(totalWh, 3)} Wh`);
    set('ki-co2',      `${fmt(co2g, 3)} g`);
    set('ki-phone',    `${fmt((totalWh / PHONE_CHARGE_WH) * 100, 2)}%`);
    set('ki-led',      formatDuration((totalWh / LED_WATTS) * 3600));
    set('ki-micro',    formatDuration((totalWh / MICROWAVE_WH_PER_MIN) * 60));
    set('ki-stream',   formatDuration((totalWh / STREAMING_WH_PER_HR) * 3600));
    set('ki-tokens',   totalTokens.toLocaleString());
}

export default function KettleIndexPage() {
    useEffect(() => {
        _displayed.kettlePct = 0;['ki-in','ki-out'].forEach(id => {
            const e = document.getElementById(id);
            if (e) e.addEventListener('input', recalc);
        });

        const sync = (tId, nId) => {
            const ta = document.getElementById(tId);
            const tf = document.getElementById(nId);
            if (ta) ta.addEventListener('input', () => {
                if (tf && ta.value.trim()) tf.value = estimateTokens(ta.value);
                recalc();
            });
        };
        sync('ki-prompt', 'ki-in');
        sync('ki-response', 'ki-out');

        // Optional: comment out the initial auto-sync below if you want to hardcode 26/89915 for a demo.
        const promptEl = document.getElementById('ki-prompt');
        const responseEl = document.getElementById('ki-response');
        const inEl = document.getElementById('ki-in');
        const outEl = document.getElementById('ki-out');
        if (promptEl && promptEl.value.trim() && inEl) inEl.value = estimateTokens(promptEl.value);
        if (responseEl && responseEl.value.trim() && outEl) outEl.value = estimateTokens(responseEl.value);

        recalc();
    },[]);

    return `
    <section class="ki">
        <style>
            /* ── Reset & base ── */
            .ki {
                min-height: 100vh;
                background: #111111; /* Matched slightly lighter dark BG */
                color: #e0e0e0;
                font-family: 'Inter', -apple-system, sans-serif;
                padding: clamp(30px, 4vw, 80px);
                overflow-x: hidden;
            }
            .ki *, .ki *::before, .ki *::after { box-sizing: border-box; }

            .ki-inner {
                max-width: 1400px; /* Widened for 5 column stat grid */
                margin: 0 auto;
                display: grid;
                grid-template-columns: 1fr 1.25fr;
                gap: 60px 80px;
                align-items: start;
            }

            .ki-col-left {
                display: flex;
                flex-direction: column;
                gap: 32px;
            }
            .ki-col-right {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100%;
            }

            /* ── Entrance animation ── */
            @keyframes ki-rise {
                from { opacity: 0; transform: translateY(18px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .ki-anim {
                opacity: 0;
                animation: ki-rise 0.6s ease forwards;
            }
            .ki-anim-1 { animation-delay: 0.05s; }
            .ki-anim-2 { animation-delay: 0.12s; }
            .ki-anim-3 { animation-delay: 0.2s; }
            .ki-anim-4 { animation-delay: 0.28s; }
            .ki-anim-5 { animation-delay: 0.36s; }

            /* ── Header ── */
            .ki-title {
                font-family: 'JetBrains Mono', monospace;
                font-size: clamp(2rem, 3.5vw, 2.8rem);
                font-weight: 700;
                color: #fff;
                margin: 0 0 12px;
                letter-spacing: -0.02em;
            }
            .ki-sub {
                font-size: 0.95rem;
                color: rgba(255,255,255,0.45);
                line-height: 1.6;
                max-width: 500px;
                margin: 0;
            }

            /* ── Input area ── */
            .ki-input-area {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            .ki-textarea {
                width: 100%;
                min-height: 80px;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 6px;
                color: #fff;
                padding: 16px;
                font-family: inherit;
                font-size: 0.9rem;
                line-height: 1.5;
                resize: vertical;
                transition: border-color 0.25s;
            }
            .ki-textarea-large {
                min-height: 480px; /* Matched the massive textarea length in screenshot */
            }
            .ki-textarea:focus {
                outline: none;
                border-color: rgba(255,255,255,0.2);
            }
            .ki-textarea::placeholder { color: rgba(255,255,255,0.18); }

            .ki-token-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }
            .ki-num-input {
                width: 100%;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 6px;
                color: #fff;
                padding: 12px 14px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.9rem;
                transition: border-color 0.25s;
            }
            .ki-num-input:focus {
                outline: none;
                border-color: rgba(255,255,255,0.2);
            }
            .ki-label {
                display: block;
                font-size: 0.72rem;
                color: rgba(255,255,255,0.4);
                margin-bottom: 8px;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                font-weight: 500;
            }

            /* ── Kettle hero ── */
            .ki-hero {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100%;
                margin-bottom: 40px;
                position: relative;
            }
            .ki-kettle-wrap {
                position: relative;
                width: 250px;
                height: 250px;
                margin-bottom: 24px;
            }
            .ki-kettle-svg {
                width: 100%;
                height: 100%;
                filter: drop-shadow(0 4px 24px rgba(56, 152, 255, 0.1));
                transition: filter 0.6s ease;
            }
            .ki-kettle-svg.ki-hot {
                filter: drop-shadow(0 4px 32px rgba(56, 152, 255, 0.3));
            }

            /* Steam particles */
            .ki-steam {
                position: absolute;
                top: -30px;
                left: 50%;
                transform: translateX(-60%);
                width: 60px;
                height: 44px;
                opacity: 0;
                transition: opacity 0.8s ease;
                pointer-events: none;
            }
            .ki-steam-p {
                position: absolute;
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                animation: ki-steam-rise 2.2s ease-out infinite;
            }
            .ki-steam-p:nth-child(1) { left: 10px; animation-delay: 0s;   }
            .ki-steam-p:nth-child(2) { left: 22px; animation-delay: 0.45s; }
            .ki-steam-p:nth-child(3) { left: 36px; animation-delay: 0.9s;  }
            .ki-steam-p:nth-child(4) { left: 16px; animation-delay: 0.25s; width: 4px; height: 4px; }
            .ki-steam-p:nth-child(5) { left: 30px; animation-delay: 0.7s;  width: 4px; height: 4px; }
            .ki-steam-p:nth-child(6) { left: 44px; animation-delay: 1.15s; width: 3px; height: 3px; }
            @keyframes ki-steam-rise {
                0%   { transform: translateY(0) scale(1);   opacity: 0.7; }
                40%  { transform: translateY(-14px) scale(1.4); opacity: 0.35; }
                100% { transform: translateY(-38px) scale(0.5); opacity: 0; }
            }

            .ki-hero-stat {
                font-family: 'JetBrains Mono', monospace;
                font-size: clamp(3rem, 6vw, 4rem);
                color: #fff;
                margin-bottom: 8px;
                line-height: 1;
            }
            .ki-hero-unit {
                font-size: 1.05rem;
                color: rgba(255,255,255,0.4);
            }

            /* ── Stats grid ── */
            .ki-stats {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 8px;
                width: 100%;
            }
            .ki-stat {
                background: rgba(255,255,255,0.02);
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 6px;
                padding: 16px;
                transition: background 0.25s;
            }
            .ki-stat:hover { background: rgba(255,255,255,0.04); }
            .ki-stat-val {
                font-family: 'JetBrains Mono', monospace;
                font-size: 1.05rem;
                color: #fff;
                margin-bottom: 6px;
            }
            .ki-stat-label {
                font-size: 0.65rem;
                color: rgba(255,255,255,0.35);
                letter-spacing: 0.05em;
                text-transform: uppercase;
                font-weight: 500;
            }

            /* ── Methodology ── */
            .ki-method {
                align-self: flex-start;
                margin-bottom: 40px;
                width: 100%;
            }
            .ki-method summary {
                font-size: 0.75rem;
                color: rgba(255,255,255,0.4);
                cursor: pointer;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                list-style: none;
                display: flex;
                align-items: center;
                gap: 6px;
                font-weight: 600;
            }
            .ki-method summary::before {
                content: '+';
                font-family: 'JetBrains Mono', monospace;
                font-size: 1rem;
                color: rgba(255,255,255,0.3);
            }
            .ki-method[open] summary::before {
                content: '−';
            }
            .ki-method-body {
                margin-top: 16px;
                font-size: 0.8rem;
                color: rgba(255,255,255,0.4);
                line-height: 1.7;
                background: rgba(255,255,255,0.02);
                border: 1px solid rgba(255,255,255,0.05);
                border-radius: 6px;
                padding: 16px;
            }
            .ki-method-body p { margin: 0 0 10px; }
            .ki-method-body a {
                color: rgba(255,255,255,0.6);
                text-decoration: none;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }

            .ki-formula {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.75rem;
                background: rgba(255,255,255,0.03);
                border-radius: 4px;
                padding: 10px 12px;
                margin: 10px 0;
                color: rgba(255,255,255,0.6);
                line-height: 1.6;
            }

            .ki-sources {
                list-style: none;
                padding: 0;
                margin: 10px 0 0;
            }
            .ki-sources li {
                padding: 4px 0;
                font-size: 0.75rem;
            }

            @media (max-width: 1100px) {
                .ki-inner {
                    grid-template-columns: 1fr;
                    gap: 60px;
                }
                .ki-stats { grid-template-columns: repeat(3, 1fr); }
            }
            @media (max-width: 650px) {
                .ki-stats { grid-template-columns: repeat(2, 1fr); }
                .ki-token-row { grid-template-columns: 1fr; }
            }
        </style>

        <div class="ki-inner">

            <!-- Left column: inputs -->
            <div class="ki-col-left">
                <div class="ki-anim ki-anim-1">
                    <h1 class="ki-title">The Kettle Index</h1>
                    <p class="ki-sub">
                        How much energy does an AI query actually use?
                        Paste a conversation and find out — measured in kettles boiled.
                    </p>
                </div>

                <div class="ki-input-area ki-anim ki-anim-2">
                    <div>
                        <label class="ki-label" for="ki-prompt">Your prompt</label>
                        <textarea class="ki-textarea" id="ki-prompt"
                            placeholder="Paste the prompt you sent to the AI…">help me write an email to openai ceo to request how much energy GPT model use to generate a response.</textarea>
                    </div>
                    <div>
                        <label class="ki-label" for="ki-response">AI response</label>
                        <textarea class="ki-textarea ki-textarea-large" id="ki-response"
                            placeholder="paste the response you recieved">Writing an email to a CEO like Sam Altman requires a balance of being concise, professional, and well-informed. Since Altman has previously commented on this topic (stating in mid-2025 that an average query uses about 0.34 watt-hours), your email will be most effective if it references that figure and asks for more granular or updated data.
Here are two versions of the email: a standard professional version and a more formal/research-oriented version.
Option 1: Standard Professional
Best for general inquiries or if you are a user interested in your own carbon footprint.
Subject: Inquiry regarding OpenAI’s per-query energy metrics for newer models
Dear Sam,
I am writing to you as a frequent user of OpenAI’s tools and an admirer of the mission to ensure AGI benefits all of humanity.
I recently followed your June 2025 update regarding ChatGPT's resource consumption, where you mentioned an average query consumes approximately 0.34 watt-hours. As OpenAI continues to roll out more advanced reasoning models (such as the o1 and o3 series), I am interested in understanding how the energy profile of a response has evolved.
Specifically, I am curious about:
The energy consumption difference between a standard GPT-4o query and a "Reasoning" model response.
How the recent 2026 Energy Strategy initiatives have impacted the carbon intensity of a single user interaction.
Providing these metrics would be a significant step toward transparency for users who wish to use AI responsibly. Thank you for your time and for the incredible work being done at OpenAI.
Best regards,
[Your Name]
[Your Location/Affiliation]
Option 2: Formal / Research-Oriented
Best if you are writing on behalf of an organization, a sustainability group, or for academic purposes.
Subject: Request for granular energy consumption data for OpenAI GPT models
Dear Mr. Altman,
I am writing to request more detailed information regarding the energy consumption of OpenAI’s frontier models during inference.
While your previous disclosure of 0.34 Wh per average query provided a helpful baseline, current independent research suggests that newer reasoning-heavy models may have significantly different power profiles. As part of my [mention your work, e.g., corporate sustainability audit / academic research / environmental reporting], I am seeking more specific data points, particularly:
Model-Specific Benchmarks: Average Wh per 1,000 tokens for GPT-4o vs. the o-series reasoning models.
Infrastructure Impact: The extent to which the January 2026 hardware optimizations have reduced the "energy-per-thought" metric.
Transparency Reporting: Does OpenAI plan to release a 2026 Sustainability Report with a standardized methodology for per-query energy and water usage?
As AI becomes a foundational layer of our economy, having verified, transparent data from the industry leader is essential for responsible integration.[1]
Thank you for your leadership and for considering this request for greater transparency.
Sincerely,[Your Name]
[Your Professional Title/Organization]
Tips for sending:
Where to send it: CEOs rarely manage their own public-facing inboxes. You might have better luck sending this to OpenAI’s press team (press@openai.com) or their sustainability/policy leads.
Be specific: If you are asking for a specific reason (like a school project or a company report), mention it. They are more likely to respond to a concrete use case than a general query.
Context: Note that the "0.34 Wh" figure is roughly equivalent to running a 10-watt LED lightbulb for 2 minutes. Including a comparison like this in your own work can help make the data more relatable.
Sources
help
sify.com</textarea>
                    </div>
                    <div class="ki-token-row">
                        <div>
                            <label class="ki-label" for="ki-in">Input tokens</label>
                            <input class="ki-num-input" id="ki-in" type="number" min="0" value="26" />
                        </div>
                        <div>
                            <label class="ki-label" for="ki-out">Output tokens</label>
                            <input class="ki-num-input" id="ki-out" type="number" min="0" value="89915" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right column: visualization -->
            <div class="ki-col-right">

                <!-- Methodology -->
                <details class="ki-method ki-anim ki-anim-5">
                    <summary>Methodology & sources</summary>
                    <div class="ki-method-body">
                        <p>
                            This calculator uses a <strong>blended average of ~4 J per token</strong>,
                            derived from independent benchmarks across model sizes (2B–300B+),
                            hardware generations (A100, H100, TPU v5e), and deployment conditions.
                            It is not the energy of any single model — it is an order-of-magnitude
                            estimate for a "typical" AI query in 2024–25.
                        </p>

                        <div class="ki-formula">
                            E = tokens × 4 J<br>
                            Wh = E / 3600<br>
                            CO₂ = Wh × 0.445 g/Wh (global avg grid)<br>
                            Kettle index = Wh / 100 Wh (1L boiled)
                        </div>

                        <p>
                            <strong>Why ~4 J?</strong> Small models (2–8B params) use 0.4–1 J/token.
                            Mid-range (13–70B) use 2–3.5 J/token. Frontier models (175B+) use
                            48–120 J/token but serve fewer requests. Weighted by actual traffic
                            distribution and modern hardware efficiency, ~4 J represents the
                            centre of the realistic range.
                        </p>

                        <ul class="ki-sources">
                            <li><a href="https://arxiv.org/html/2512.03024v1" target="_blank" rel="noopener">Per-token benchmarks — Llama, Falcon, Mistral, Qwen (2024)</a></li>
                            <li><a href="https://llm-tracker.info/_TOORG/Power-Usage-and-Energy-Efficiency" target="_blank" rel="noopener">LLM Tracker — Power Usage & Efficiency</a></li>
                        </ul>
                    </div>
                </details>

                <!-- Kettle hero -->
                <div class="ki-hero ki-anim ki-anim-3">
                    <div class="ki-kettle-wrap">
                        <div class="ki-steam" id="ki-steam">
                            <div class="ki-steam-p"></div>
                            <div class="ki-steam-p"></div>
                            <div class="ki-steam-p"></div>
                            <div class="ki-steam-p"></div>
                            <div class="ki-steam-p"></div>
                            <div class="ki-steam-p"></div>
                        </div>
                        <svg class="ki-kettle-svg" id="ki-kettle-svg" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <clipPath id="ki-gauge-clip">
                                    <path d="M240,88c-26.51,0-48,21.49-48,48v208c0,26.51,21.49,48,48,48c26.51,0,48-21.49,48-48V136C288,109.49,266.51,88,240,88z"/>
                                </clipPath>
                            </defs>
                            <path fill="#566E7F" d="M392.001,0h-352c-2.774,0-5.344,1.438-6.805,3.797c-1.461,2.359-1.594,5.305-0.351,7.782l47.156,94.312V480c0,17.673,14.327,32,32,32h248c17.673,0,32-14.327,32-32V0z"/>
                            <path fill="#B1C3D0" d="M80.001,448h312v32c0,17.673-14.327,32-32,32h-248c-17.673,0-32-14.327-32-32V448z"/>
                            <path fill="#ED2C39" d="M420.001,424h-28v-24h28c6.627,0,12,5.373,12,12l0,0C432.001,418.627,426.628,424,420.001,424z"/>
                            <path fill="#E2E4E6" d="M272.001,336c-4.418,0-8-3.582-8-8c0-4.418,3.582-8,8-8h16v-16h-16c-4.418,0-8-3.582-8-8c0-4.418,3.582-8,8-8h16v-16h-16c-4.418,0-8-3.582-8-8c0-4.418,3.582-8,8-8h16v-16h-16c-4.418,0-8-3.582-8-8c0-4.418,3.582-8,8-8h16v-16h-16c-4.418,0-8-3.582-8-8c0-4.418,3.582-8,8-8h16v-24c0-26.51-21.49-48-48-48c-26.51,0-48,21.49-48,48v208c0,26.51,21.49,48,48,48c26.51,0,48-21.49,48-48v-8H272.001z"/>
                            <rect id="ki-clip-rect" x="192" y="392" width="96" height="0" fill="#4C9BD5" clip-path="url(#ki-gauge-clip)"/>
                            <g fill="none" stroke="#E2E4E6" stroke-width="2">
                                <line x1="272" y1="336" x2="288" y2="336"/>
                                <line x1="272" y1="320" x2="288" y2="320"/>
                                <line x1="272" y1="304" x2="288" y2="304"/>
                                <line x1="272" y1="288" x2="288" y2="288"/>
                                <line x1="272" y1="272" x2="288" y2="272"/>
                                <line x1="272" y1="256" x2="288" y2="256"/>
                                <line x1="272" y1="240" x2="288" y2="240"/>
                                <line x1="272" y1="224" x2="288" y2="224"/>
                                <line x1="272" y1="208" x2="288" y2="208"/>
                                <line x1="272" y1="192" x2="288" y2="192"/>
                                <line x1="272" y1="176" x2="288" y2="176"/>
                            </g>
                            <path fill="#8EADBE" d="M376.001,464v16c0,8.837-7.163,16-16,16h-232c-8.837,0-16,7.163-16,16l0,0h144h32h72c17.673,0,32-14.327,32-32v-32l0,0C383.164,448,376.001,455.163,376.001,464z"/>
                            <path fill="#3F556B" d="M440.001,0h-48c-39.765,0-72,32.235-72,72v336c0,13.255-10.745,24-24,24h-200c-8.837,0-16,7.163-16,16h240h16h56V296h48c22.054,0,40-17.946,40-40V40C480.001,17.945,462.055,0,440.001,0z M448.001,256c0,4.414-3.585,8-8,8h-48V32h48c4.415,0,8,3.585,8,8V256z"/>
                        </svg>
                    </div>
                    <div class="ki-hero-stat" id="ki-pct">0%</div>
                    <div class="ki-hero-unit">of boiling one litre of water</div>
                    <div style="margin-top:16px; font-size:1rem; color:rgba(255,255,255,0.4);">
                        <span id="ki-ml">0 ml</span> boiled
                         &bull; <span id="ki-kettles">0% of a kettle</span>
                    </div>
                </div>

                <!-- Stats grid -->
                <div class="ki-stats ki-anim ki-anim-4">
                    <div class="ki-stat">
                        <div class="ki-stat-val" id="ki-tokens">0</div>
                        <div class="ki-stat-label">Total tokens</div>
                    </div>
                    <div class="ki-stat">
                        <div class="ki-stat-val" id="ki-joules">0 J</div>
                        <div class="ki-stat-label">Energy (Joules)</div>
                    </div>
                    <div class="ki-stat">
                        <div class="ki-stat-val" id="ki-wh">0 Wh</div>
                        <div class="ki-stat-label">Energy (Wh)</div>
                    </div>
                    <div class="ki-stat">
                        <div class="ki-stat-val" id="ki-co2">0 g</div>
                        <div class="ki-stat-label">CO₂ emitted</div>
                    </div>
                    <div class="ki-stat">
                        <div class="ki-stat-val" id="ki-phone">0%</div>
                        <div class="ki-stat-label">Phone charge</div>
                    </div>
                    <div class="ki-stat">
                        <div class="ki-stat-val" id="ki-led">0 s</div>
                        <div class="ki-stat-label">LED bulb (9W)</div>
                    </div>
                    <div class="ki-stat">
                        <div class="ki-stat-val" id="ki-micro">0 s</div>
                        <div class="ki-stat-label">Microwave (1kW)</div>
                    </div>
                    <div class="ki-stat">
                        <div class="ki-stat-val" id="ki-stream">0 s</div>
                        <div class="ki-stat-label">4K streaming</div>
                    </div>
                </div>

            </div> <!-- /ki-col-right -->

        </div>
    </section>
    `;
}