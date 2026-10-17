// Home: one page, one index. The name set in jigsaw type, then everything on
// the site as a numbered list: things I made, things I put out, things I wrote.

import { useEffect } from '../framework.js';
import { ARTICLES } from './articles/articles-data.js';
import { initJigsawTypography } from '../components/jigsaw.js';

const PROJECTS = [
    { title: 'Nagmani',               desc: 'an Indian gothic snake game',              href: '/snake',                        tag: 'game' },
    { title: 'Digital Human',         desc: 'three.js based AI-driven Digital Human',   href: 'https://avatar.sumvivas.com',   tag: 'ai', external: true },
    { title: 'Digital Doppelgänger',  desc: 'a short film',                             href: 'https://youtu.be/xPZ85jpZTsw',  tag: 'film', external: true },
    { title: 'p2p chat',              desc: 'a serverless p2p chat',                    href: '/p2pchat',                      tag: 'web' },
    { title: 'BVH Viewer',            desc: 'a BVH motion-capture file viewer',         href: '/bvhviewer',                    tag: '3d tool' },
    { title: 'I Think Therefore I Am', desc: 'an infinite thought canvas',              href: '/ithinkthereforiam',            tag: 'tool' },
];

// a song and two datasets, all living somewhere else
const RELEASES = [
    { title: 'Monsoon Protocol', desc: 'a song, on SoundCloud',                          href: 'https://soundcloud.com/prateek-gupta-505317056/2026-09-07t16_31_11-216z', tag: 'music', external: true },
    { title: 'allaimovies',      desc: '3,090 films with an AI in them, coded and counted', href: 'https://huggingface.co/datasets/prateek-0-gupta/allaimovies',               tag: 'dataset', external: true },
    { title: 'ai characters',    desc: '3,263 AI characters from 1,884 films',           href: 'https://huggingface.co/datasets/prateek-0-gupta/allaimovies-ai-characters', tag: 'dataset', external: true },
];

const SOCIALS = `
    <a href="https://www.instagram.com/chai.and.photoshop" target="_blank" rel="noopener">Instagram</a>
    <a href="https://www.linkedin.com/in/prateek-gupta08" target="_blank" rel="noopener">LinkedIn</a>
    <a href="mailto:prateekgupta1198@gmail.com">E-mail</a>
`;

function indexRow(item, i) {
    const num = String(i + 1).padStart(2, '0');
    const linkAttrs = item.external
        ? `href="${item.href}" target="_blank" rel="noopener"`
        : `href="${item.href}" data-link`;
    return `
        <a class="ix-row" ${linkAttrs}>
            <span class="ix-num">${num}</span>
            <span class="ix-line">
                <span class="ix-title">${item.title}</span>
                <span class="ix-desc">${item.desc}</span>
            </span>
            <span class="ix-tag">${item.tag}${item.external ? ' ↗' : ''}</span>
        </a>`;
}

export default function Home() {
    // returns its own cleanup, which bas runs when the page is left
    useEffect(() => initJigsawTypography(), []);

    const writings = ARTICLES.map(a => ({
        title: a.title,
        desc: a.blurb,
        href: `/articles/${a.slug}`,
        tag: 'writing',
    }));

    // numbered straight through, with a gap between the groups
    let n = 0;
    const groups = [PROJECTS, RELEASES, writings]
        .map(group => group.map(item => indexRow(item, n++)).join(''))
        .join('<div class="ix-gap"></div>');

    return `
    <div class="index-page">

        <header class="ix-top">
            <span>prat.ee/k — Manchester, UK</span>
        </header>

        <main class="ix-main">
            <section class="ix-intro">
                <span class="ix-hi">Hi, I am</span>
                <div class="jigsaw-inline">
                    <canvas id="typeCanvas"></canvas>
                </div>
                <p class="ix-role">
                    software engineer &amp; creative future media practitioner <br><br>
                    AI &amp; Development at Sum Vivas.
                </p>
                <div class="ix-social">${SOCIALS}</div>
            </section>

            <section class="ix-list">
                ${groups}
            </section>
        </main>

        <footer class="ix-foot">
            <span>© 2026 Prateek Kumar Gupta</span>
            <span class="ix-note">“The best way out is always through.” — Robert Frost</span>
        </footer>

    </div>
    `;
}
