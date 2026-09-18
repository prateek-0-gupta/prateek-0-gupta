// The index of everything under Writing. Slug, title and blurb only, so the
// desktop, the route table and tools/build_routes.mjs can list the articles
// without loading a word of them. A body is a module whose default export is
// an HTML string, and it is fetched the first time someone opens the article.
//
// To add one: write the body module, add a line here, run the build script.
// Newest first. Media paths inside a body resolve against <base href="/k/">.

export const ARTICLES = [
    {
        slug: 'reverse-engineering-esp32',
        title: 'Reverse-Engineering a No-Name ESP32 Board',
        blurb: 'a £20 "ai voice module" from amazon, no schematic, and an afternoon of finding out which pin does what',
        load: () => import('./aitoy/aitoy.js'),
    },
    {
        slug: 'ai-in-cinema',
        title: 'The Machine on Screen',
        blurb: 'i tested five things i had written about AI in cinema against 2,015 films. three were wrong',
        load: () => import('./ai-in-cinema/ai-in-cinema.js'),
    },
    // uni writings (Future Media Production @ MMU), migrated from pr4t33k.cargo.site
    {
        slug: 'evolution-of-ai-in-media',
        title: 'The Evolution of AI in Media, Cinema, and Literature',
        blurb: 'how fiction shaped our perception of AI technology',
        load: () => import('./uni/evolution-of-ai-in-media.js'),
    },
    {
        slug: 'top-10-ai-movies',
        title: 'Top 10 “AI” Movies',
        blurb: 'a ranked list, with honorable mentions',
        load: () => import('./uni/top-10-ai-movies.js'),
    },
    {
        slug: 'myth-of-ai',
        title: 'Myth of AI',
        blurb: 'how Hollywood created a fantasy we all believe in',
        load: () => import('./uni/myth-of-ai.js'),
    },
    {
        slug: 'history-of-ai',
        title: 'History of AI',
        blurb: 'the complete evolution of AI, 1950–2025',
        load: () => import('./uni/history-of-ai.js'),
    },
];

export function getArticle(slug) {
    return ARTICLES.find(a => a.slug === slug);
}

/** The article with its body, { slug, title, blurb, html }, or null. The module loader caches the body. */
export async function loadArticle(slug) {
    const article = getArticle(slug);
    if (!article) return null;
    return { ...article, html: (await article.load()).default };
}
