import { ARTICLES, loadArticle } from './articles-data.js';

export function ArticlesIndex() {
    return `
    <div class="articles-page">
        <div class="art-nav">
            <a href="/" data-link>&larr; prateek</a>
        </div>
        <div class="articles-index">
            <h1>Writings</h1>
            <p class="articles-index-sub">articles on AI, media &amp; cinema from my uni days at MMU</p>
            ${ARTICLES.map(a => `
                <div class="articles-index-item">
                    <a href="/articles/${a.slug}" data-link>${a.title}</a>
                    <div class="articles-index-blurb">${a.blurb}</div>
                </div>
            `).join('')}
        </div>
    </div>
    `;
}

// Routed as /articles/:slug. The slug arrives in params. Async because the
// body is its own module: bas keeps the previous page up until it resolves,
// and on a deep link the text is already in the HTML (tools/build_routes.mjs
// bakes it in), so there is nothing to wait for on screen either way.
export async function ArticlePage({ params }) {
    const article = await loadArticle(params.slug);
    if (!article) {
        return `<div class="articles-page"><div class="art-nav"><a href="/articles" data-link>&larr; writings</a></div><h1>Article not found</h1></div>`;
    }
    return `
        <div class="articles-page">
            <div class="art-nav">
                <a href="/articles" data-link>&larr; writings</a>
            </div>
            <article class="art-body">
                ${article.html}
            </article>
            <div class="art-footer">
                <a href="/articles" data-link>&larr; all writings</a>
            </div>
        </div>
        `;
}

// Kept for anyone who still builds one route per article.
export function Article(slug) {
    return () => ArticlePage({ params: { slug } });
}
