// Home: plain text, and Mooli in the margin, gesturing at it.
// It waves when you arrive, beats on the stressed words as if it were saying
// the intro, goes to and points at whatever you hover, and for a few projects
// does something more particular. The page never mentions it.

import { useEffect } from '../framework.js';
import { ARTICLES } from './articles/articles-data.js';
import { ensureMooli } from '../components/mooli.js';

// gesture: what the figure does while this one has its attention (point if unset)
const MADE = [
    { title: 'Nagmani',                desc: 'an Indian gothic snake game',              href: '/snake',                       gesture: 'snake' },
    { title: 'Digital Human',          desc: 'a three.js, AI-driven digital human',      href: 'https://avatar.sumvivas.com',  gesture: 'wave', external: true },
    { title: 'Digital Doppelgänger',   desc: 'a short film',                             href: 'https://youtu.be/xPZ85jpZTsw', gesture: 'frame', external: true },
    { title: 'p2p chat',               desc: 'a chat with no server',                    href: '/p2pchat',                     gesture: 'exchange' },
    { title: 'BVH Viewer',             desc: 'for motion-capture files',                 href: '/bvhviewer',                   gesture: 'tpose' },
    { title: 'I Think Therefore I Am', desc: 'an infinite thought canvas',               href: '/ithinkthereforiam',           gesture: 'think' },
];

const RELEASED = [
    { title: 'Monsoon Protocol', desc: 'a song, on SoundCloud',                             href: 'https://soundcloud.com/prateek-gupta-505317056/2026-09-07t16_31_11-216z', gesture: 'conduct', external: true },
    { title: 'allaimovies',      desc: '3,090 films with an AI in them, coded and counted', href: 'https://huggingface.co/datasets/prateek-0-gupta/allaimovies', external: true },
    { title: 'ai characters',    desc: '3,263 AI characters from 1,884 films',              href: 'https://huggingface.co/datasets/prateek-0-gupta/allaimovies-ai-characters', external: true },
];

const ELSEWHERE = [
    { title: 'Instagram',    href: 'https://www.instagram.com/chai.and.photoshop', external: true },
    { title: 'LinkedIn',     href: 'https://www.linkedin.com/in/prateek-gupta08', external: true },
    { title: 'GitHub',       href: 'https://github.com/prateek-0-gupta', external: true },
    { title: 'Hugging Face', href: 'https://huggingface.co/prateek-0-gupta', external: true },
    { title: 'E-mail',       href: 'mailto:prateekgupta1198@gmail.com' },
];

function item({ title, desc, href, gesture, external }) {
    const attrs = external
        ? `href="${href}"${href.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener"'}`
        : `href="${href}" data-link`;
    const g = gesture ? ` data-gesture="${gesture}"` : '';
    return `<li><a ${attrs}${g}>${title}</a>${desc ? `<span class="gp-desc">${desc}</span>` : ''}</li>`;
}

const list = (label, items) => `
    <section class="gp-group">
        <h2>${label}</h2>
        <ul>${items.map(item).join('')}</ul>
    </section>`;

export default function Home() {
    useEffect(() => startFigure(), []);

    const written = ARTICLES.map(a => ({ title: a.title, desc: a.blurb, href: `/articles/${a.slug}` }));

    return `
    <div class="gp">
        <aside class="gp-margin" aria-hidden="true"></aside>

        <main class="gp-text">
            <h1>Prateek Gupta</h1>
            <p class="gp-intro">
                I'm a software engineer and future media practitioner in Manchester.
                At Sum Vivas I work on AI  and <em>digital humans</em> systems. I also make
                <em>small things</em> for the web, and write, mostly about AI and <em>film</em>.
            </p>

            ${list('made', MADE)}
            ${list('released', RELEASED)}
            ${list('written', written)}
            ${list('elsewhere', ELSEWHERE)}

            <footer class="gp-foot">© 2026 Prateek Kumar Gupta</footer>
        </main>
    </div>`;
}

// The creature is Mooli, shared by every page (components/mooli.js): it does
// the general reading-along, the hello and keyboard focus. The home page adds
// one thing of its own, the intro "said" on arrival. Returns the cleanup bas
// runs on leaving; Mooli itself stays.
function startFigure() {
    const root = document.querySelector('.gp');
    if (!root) return;
    const pet = ensureMooli();

    const timers = new Set();
    const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

    // after the hello, the intro "said" at about 180 words a minute, a beat on
    // each emphasised word as it comes up, and the word answers, barely
    const intro = root.querySelector('.gp-intro');
    let words = 0;
    for (const node of intro.childNodes) {
        if (node.nodeName === 'EM') {
            const em = node;
            later(2400 + words * 330, () => {
                pet.beat();
                em.classList.add('is-beat');
                later(320, () => em.classList.remove('is-beat'));
            });
        }
        words += (node.textContent.match(/\S+/g) || []).length;
    }

    return () => timers.forEach(clearTimeout);
}
