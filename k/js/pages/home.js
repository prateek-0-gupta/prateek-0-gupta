import { useEffect } from '../framework.js';
import { Footer } from '../components/Footer.js';
import { POSTERS } from '../poster-manifest.js';

let _jigsawCleanup = null;

export default function Home() {

    useEffect(() => {
        if (_jigsawCleanup) { _jigsawCleanup(); _jigsawCleanup = null; }
        _jigsawCleanup = initJigsawTypography();
        initBentoGrid();
    }, []);

    return `
    <style>
        .hero-page {
            position: relative; width: 100%; min-height: 100vh;
            background: #0a0a0a; overflow: hidden;
            display: flex; flex-direction: column; justify-content: center;
            align-items: center;
            padding: 2.5rem;
            box-sizing: border-box;
        }

        /* Top-left social row */
        .hero-social-row {
            position: absolute; top: 2.5rem; left: 2.5rem; z-index: 20;
            display: flex; gap: 1.5rem;
        }
        .hero-social-row a {
            font-family: 'Inter', sans-serif;
            font-size: 0.85rem;
            color: rgba(255,255,255,0.5);
            text-decoration: none;
            transition: color 0.3s;
            letter-spacing: 0.02em;
        }
        .hero-social-row a:hover { color: #fff; }

        /* Right-side links card */
        .hero-links-card {
            position: absolute; top: 4rem; left: .5rem; z-index: 20;
            padding: 2rem 2.2rem;
            min-width: 240px;
        }
        .hero-links-card h3 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.6rem;
            font-weight: 600;
            color: rgba(255,255,255,0.85);
            margin: 0 0 1.4rem 0;
            letter-spacing: -0.01em;
        }
        .hero-link-item {
            margin-bottom: 1.2rem;
        }
        .hero-link-item a {
            font-family: 'Outfit', sans-serif;
            font-size: 1.15rem;
            font-weight: 500;
            color: rgba(255,255,255,0.75);
            text-decoration: none;
            transition: color 0.3s;
            display: block;
        }
        .hero-link-item a:hover { color: #fff; }
        .hero-link-item .link-desc {
            font-family: 'Inter', sans-serif;
            font-size: 0.7rem;
            color: rgba(255,255,255,0.3);
            letter-spacing: 0.04em;
            margin-top: 0.15rem;
        }

        /* Bottom identity area */
        .hero-intro {
            position: relative; z-index: 20;
            text-align: center;
        }
        .hero-greeting {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.3rem;
            margin-bottom: 0.6rem;
            flex-wrap: wrap;
        }
        .hero-greeting .text-part {
            font-family: 'Outfit', sans-serif;
            font-size: clamp(2.4rem, 5.5vw, 5rem);
            font-weight: 600;
            color: rgba(255,255,255,0.85);
            white-space: nowrap;
        }
        .jigsaw-inline {
            position: relative;
            width: clamp(200px, 28vw, 420px);
            height: clamp(55px, 7.5vw, 100px);
            display: inline-block;
            vertical-align: middle;
        }
        .jigsaw-inline canvas {
            display: block;
            width: 100%; height: 100%;
            cursor: pointer;
        }
        .hero-subtitle {
            font-family: 'Inter', sans-serif;
            font-size: clamp(0.85rem, 1.4vw, 1.05rem);
            color: rgba(255,255,255,0.35);
            max-width: 550px;
            margin: 0.8rem auto 0.6rem;
            line-height: 1.6;
        }
        .hero-meta {
            font-family: 'Inter', sans-serif;
            font-size: 0.72rem;
            color: rgba(255,255,255,0.22);
            letter-spacing: 0.08em;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.6rem;
        }
        .hero-meta .dot { opacity: 0.4; }

        @media (max-width: 768px) {
            .hero-page { padding: 1.5rem; }
            .hero-social-row { top: 1.5rem; left: 1.5rem; gap: 1rem; }
            .hero-social-row a { font-size: 0.75rem; }
            .hero-links-card {
                position: relative; top: auto; right: auto;
                margin-top: 5rem; margin-bottom: 2rem;
                min-width: unset; width: 100%;
                border-left: none;
                border-top: 1px solid rgba(255,255,255,0.08);
                padding: 1.5rem 0 0 0;
                background: transparent;
            }
            .hero-links-card h3 { font-size: 1.2rem; margin-bottom: 1rem; }
            .hero-link-item a { font-size: 1rem; }
            .jigsaw-inline {
                width: clamp(150px, 45vw, 260px);
                height: clamp(42px, 12vw, 70px);
            }
            .hero-greeting .text-part { font-size: clamp(1.6rem, 7vw, 2.4rem); }
            .hero-intro { padding-bottom: 1rem; }
        }

        /* ── Bento Grid ── */
        #bento-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            grid-auto-rows: minmax(260px, auto);
            gap: 2px;
            width: 100%;
            background: #0a0a0a;
        }
        #image-masonry {
            columns: 4;
            column-gap: 2px;
            width: 100%;
            background: #0a0a0a;
            margin-top: 2px;
        }
        @media (max-width: 1024px) { #image-masonry { columns: 3; } }
        @media (max-width: 600px)  { #image-masonry { columns: 2; } }
        .bento-cell {
            position: relative;
            overflow: hidden;
            background: #111;
        }
        /* non-image tiles keep a floor height */
        .bento-project, .bento-video, .bento-label, .bento-stat {
            min-height: 260px;
        }
        /* Project tiles */
        .bento-project {
            cursor: pointer;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: 1.8rem 2rem;
            text-decoration: none;
            transition: filter 0.3s;
        }
        .bento-project::before {
            content: '';
            position: absolute; inset: 0;
            background: inherit;
            transition: transform 0.5s cubic-bezier(0.16,1,0.3,1);
            z-index: 0;
        }
        .bento-project:hover::before { transform: scale(1.04); }
        .bento-project .bc-tag {
            font-family: 'Inter', sans-serif;
            font-size: 0.62rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.35);
            margin-bottom: 0.6rem;
            position: relative; z-index: 1;
        }
        .bento-project .bc-title {
            font-family: 'Outfit', sans-serif;
            font-size: clamp(1.4rem, 3vw, 2.4rem);
            font-weight: 700;
            color: rgba(255,255,255,0.92);
            line-height: 1.1;
            position: relative; z-index: 1;
        }
        .bento-project .bc-desc {
            font-family: 'Inter', sans-serif;
            font-size: 0.78rem;
            color: rgba(255,255,255,0.4);
            margin-top: 0.5rem;
            position: relative; z-index: 1;
        }
        .bento-project .bc-arrow {
            position: absolute; top: 1.4rem; right: 1.6rem; z-index: 1;
            font-size: 1rem;
            color: rgba(255,255,255,0.2);
            transition: color 0.3s, transform 0.3s;
        }
        .bento-project:hover .bc-arrow {
            color: rgba(255,255,255,0.7);
            transform: translate(3px, -3px);
        }
        /* Image tiles */
        .bento-image {
            break-inside: avoid;
            margin-bottom: 2px;
            overflow: hidden;
        }
        .bento-image img {
            width: 100%;
            height: auto;          /* natural aspect ratio — no cropping */
            display: block;
            transition: transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease;
            opacity: 0;
        }
        .bento-image img.loaded { opacity: 1; }
        .bento-image:hover img { transform: scale(1.03); }
        .bento-image .bc-img-overlay {
            position: absolute; inset: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%);
            opacity: 0;
            transition: opacity 0.3s;
            display: flex; align-items: flex-end; padding: 1rem;
        }
        .bento-image:hover .bc-img-overlay { opacity: 1; }
        .bento-image .bc-img-overlay span {
            font-family: 'Inter', sans-serif;
            font-size: 0.68rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.7);
        }
        /* Video tiles */
        .bento-video {
            padding: 0;
            background: #000;
        }
        .bento-video iframe {
            width: 100%; height: 100%;
            border: none;
            display: block;
        }
        /* Label tiles */
        .bento-label {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            padding: 1.8rem 2rem;
        }
        .bento-label .bc-lbl-main {
            font-family: 'Outfit', sans-serif;
            font-size: clamp(1rem, 2.5vw, 1.8rem);
            font-weight: 600;
            color: rgba(255,255,255,0.88);
            line-height: 1.2;
        }
        .bento-label .bc-lbl-sub {
            font-family: 'Inter', sans-serif;
            font-size: 0.7rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.3);
            margin-top: 0.5rem;
        }
        /* Stat tiles */
        .bento-stat {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            padding: 1.8rem 2rem;
        }
        .bento-stat .bc-stat-num {
            font-family: 'Outfit', sans-serif;
            font-size: clamp(2.5rem, 6vw, 5rem);
            font-weight: 700;
            color: rgba(255,255,255,0.85);
            line-height: 1;
        }
        .bento-stat .bc-stat-label {
            font-family: 'Inter', sans-serif;
            font-size: 0.72rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.3);
            margin-top: 0.5rem;
        }
        @media (max-width: 1024px) {
            #bento-grid { grid-template-columns: repeat(6, 1fr); }
        }
        @media (max-width: 600px) {
            #bento-grid { grid-template-columns: repeat(4, 1fr); }
            .bento-project, .bento-video, .bento-label, .bento-stat { min-height: 180px; }
        }
    </style>

    <div class="hero-page">
        <div class="hero-social-row">
            <a href="https://www.instagram.com/chai.and.photoshop" target="_blank">Instagram</a>
            <a href="https://www.linkedin.com/in/prateek-gupta08" target="_blank">linkedin</a>
            <a href="mailto:prateekgupta1198@gmail.com">e-mail</a>
        </div>
        <div class="hero-intro">
            <div class="hero-greeting">
                <span class="text-part">Hi, I am</span>
                <div class="jigsaw-inline">
                    <canvas id="typeCanvas"></canvas>
                </div>
            </div>
            <div class="hero-subtitle">i am a software engineer and a creative future media practitioner</div>
            <div class="hero-meta">
                <span>I am based in Manchester, UK</span>
                <span class="dot">-</span>
                <span> and I work at Sum Vivas Ltd</span>
            </div>
        </div>
         <div class="hero-links-card">
            <h3></h3>
            <div class="hero-link-item">
                <a href="/snake" data-link>Nagmani</a>
                <div class="link-desc">an Indian gothic snake game</div>
            </div>
            <div class="hero-link-item">
                <a href="/baoli" data-link>Baoli</a>
                <div class="link-desc">a three js based experience</div>
            </div>
            <div class="hero-link-item">
                <a href="https://avatar.sumvivas.com" target="_blank">Digital Human</a>
                <div class="link-desc">three.js based AI-driven Digital Human </div>
            </div>
            <div class="hero-link-item">
                <a href="https://youtu.be/xPZ85jpZTsw" target="_blank">Digital Doppelgänger</a>
                <div class="link-desc">A Short Film</div>
            </div>
            
        </div>
        <div style="position: absolute; bottom: 1.5rem; font-family: 'Inter', sans-serif; font-size: 0.75rem; color: rgba(255,255,255,0.3); z-index: 20; letter-spacing: 0.08em;">
            scroll ↓
        </div>
    </div>

    <div id="bento-grid"></div>
    <div id="image-masonry"></div>
    `;
}


const BENTO_ITEMS = [
  
    {
        type: 'video',
        title: 'Digital Doppelgänger',
        videoId: 'xPZ85jpZTsw',
    },
    ...POSTERS.map(p => ({
        type: 'image',
        src: `js/pages/projects/posters/assets/${p.file}`,
        title: p.title || p.file,
    })),
];

const SPAN_POOLS = {
    project:  [ [4,2],[4,2],[4,3],[6,2],[3,2],[3,3] ],
    video:    [ [6,2],[6,3],[4,2],[4,3] ],
    image:    [ [3,2],[3,3],[4,2],[2,2],[2,3],[4,3],[5,2],[6,3] ],
    label:    [ [3,1],[2,1],[3,2],[2,2],[4,1] ],
    stat:     [ [2,1],[2,2],[3,1] ],
};

function bentoSpan(item) {
    const pool = SPAN_POOLS[item.type] || [[3,2]];
    return pool[Math.floor(Math.random() * pool.length)];
}

function renderBentoCell(item) {
    switch (item.type) {
        case 'project': {
            const tag = item.internal ? 'project' : 'external';
            const arrow = item.internal ? '↗' : '↗';
            return `
                <a class="bento-cell bento-project"
                   style="background:${item.bg};"
                   ${item.internal ? `href="${item.href}" data-link` : `href="${item.href}" target="_blank" rel="noopener"`}>
                    <span class="bc-arrow">${arrow}</span>
                    <span class="bc-tag">${tag}</span>
                    <div class="bc-title">${item.title}</div>
                    <div class="bc-desc">${item.desc}</div>
                </a>`;
        }
        case 'image': {
            return `
                <div class="bento-cell bento-image">
                    <img data-src="${item.src}" alt="${item.title}"
                         onerror="this.closest('.bento-cell').style.display='none'">
                    <div class="bc-img-overlay"><span>${item.title}</span></div>
                </div>`;
        }
        case 'video': {
            return `
                <div class="bento-cell bento-video">
                    <iframe
                        src="https://www.youtube.com/embed/${item.videoId}?rel=0&modestbranding=1"
                        title="${item.title}"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        loading="lazy">
                    </iframe>
                </div>`;
        }
        case 'label': {
            const lines = item.main.split('\n').join('<br>');
            return `
                <div class="bento-cell bento-label" style="background:${item.bg};">
                    <div class="bc-lbl-main">${lines}</div>
                    <div class="bc-lbl-sub">${item.sub}</div>
                </div>`;
        }
        case 'stat': {
            return `
                <div class="bento-cell bento-stat" style="background:${item.bg};">
                    <div class="bc-stat-num">${item.num}</div>
                    <div class="bc-stat-label">${item.label}</div>
                </div>`;
        }
        default: return '';
    }
}

function initBentoGrid() {
    const grid    = document.getElementById('bento-grid');
    const masonry = document.getElementById('image-masonry');
    if (!grid || !masonry) return;

    // Shuffle all items
    const all = [...BENTO_ITEMS];
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }

    const primaryItems = all.filter(it => it.type !== 'image');
    const imageItems   = all.filter(it => it.type === 'image');

    // ── Primary bento grid (projects, videos, labels, stats) ────────────
    const fragGrid = document.createDocumentFragment();
    const wrapper  = document.createElement('div');
    primaryItems.forEach(item => {
        const [cs, rs] = bentoSpan(item);
        const html = renderBentoCell(item);
        wrapper.innerHTML = html.trim();
        const el = wrapper.firstChild;
        if (!el) return;
        el.style.gridColumn = `span ${cs}`;
        el.style.gridRow    = `span ${rs}`;
        fragGrid.appendChild(el);
    });
    grid.innerHTML = '';
    grid.appendChild(fragGrid);

    // ── Image masonry (CSS columns — natural aspect ratio, no gaps) ──────
    const fragMasonry = document.createDocumentFragment();
    imageItems.forEach(item => {
        const html = renderBentoCell(item);
        wrapper.innerHTML = html.trim();
        const el = wrapper.firstChild;
        if (!el) return;
        fragMasonry.appendChild(el);
    });
    masonry.innerHTML = '';
    masonry.appendChild(fragMasonry);

    // ── Lazy load via IntersectionObserver ───────────────────────────────
    const lazyObs = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            img.src = img.dataset.src;
            img.onload  = () => img.classList.add('loaded');
            img.onerror = () => img.closest('.bento-cell').style.display = 'none';
            obs.unobserve(img);
        });
    }, { rootMargin: '200px 0px' }); // start loading 200px before entering viewport

    masonry.querySelectorAll('img[data-src]').forEach(img => lazyObs.observe(img));
}

//     TYPOGRAPHY ENGINE

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
    const DISTORTION = 0.2;
    const GAP = 0.04;
    const SHADOW_DEPTH = 4;
    const SPEED_MS = 2000;

    function resizeCanvas() {
        const container = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth;
        const h = container.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
            if (hero) hero.style.backgroundColor = 'transparent';
        }

        const dpr = window.devicePixelRatio || 1;
        const displayW = canvas.width / dpr;
        const displayH = canvas.height / dpr;
        const text = TEXT;
        const fillColor = currentPalette.fg;
        const shadowCol = currentPalette.shadow;
        const PADDING = Math.min(displayW, displayH) * 0.04;

        ctx.clearRect(0, 0, displayW, displayH);

        if (regenerateGrid || currentBoundaries.length !== text.length + 1) {
            currentBoundaries = generateBoundaries(text.length, displayW, displayH, PADDING, DISTORTION);
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
