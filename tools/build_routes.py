#!/usr/bin/env python3
"""
Writes a real HTML shell for every route, so deep links on GitHub Pages return
200 with the right title, description and canonical baked in, instead of the
404.html fallback (which Google will not index). Also writes 404.html itself,
sitemap.xml and robots.txt.

k/index.html is the template. Run this after adding an article or a route:

    python tools/build_routes.py

No dependencies. Idempotent.
"""
import re
import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
K = ROOT / 'k'
SITE = 'https://prat.ee'
TEMPLATE = (K / 'index.html').read_text(encoding='utf-8')

# ── routes ──────────────────────────────────────────────────────────────

def read_articles():
    """slug/title/blurb of every article, straight from the JS sources."""
    out = []
    for js in [K / 'js/pages/articles/articles-data.js',
               K / 'js/pages/articles/ai-in-cinema/ai-in-cinema.js',
               K / 'js/pages/articles/aitoy/aitoy.js']:
        text = js.read_text(encoding='utf-8')
        for m in re.finditer(r"slug:\s*'([^']+)',\s*title:\s*'((?:[^'\\]|\\.)*)',\s*blurb:\s*'((?:[^'\\]|\\.)*)'", text):
            out.append({'slug': m.group(1), 'title': m.group(2).replace("\\'", "'"), 'blurb': m.group(3).replace("\\'", "'")})
    return out

ARTICLES = read_articles()

ROUTES = [
    {'path': '/articles', 'title': 'Writing — Prateek Gupta',
     'description': 'Long-form pieces on AI in cinema, a corpus study of 2,015 AI films, and a reverse-engineered £20 ESP32 voice board.', 'type': 'website'},
    {'path': '/snake', 'title': 'Nagmani — Prateek Gupta',
     'description': 'An Indian gothic snake game. The snake is cursed. So are you if you keep playing.', 'type': 'website'},
    {'path': '/p2pchat', 'title': 'p2p chat — Prateek Gupta',
     'description': 'A serverless chat over WebRTC. Your messages go from your browser to theirs and nowhere else.', 'type': 'website'},
    {'path': '/bvhviewer', 'title': 'BVH Viewer — Prateek Gupta',
     'description': 'Drop a .bvh motion-capture file in and watch a skeleton do whatever the actor did that day.', 'type': 'website'},
    {'path': '/ithinkthereforiam', 'title': 'I Think Therefore I Am — Prateek Gupta',
     'description': 'An infinite canvas for dumping thoughts: sticky notes, a kanban board, red string between ideas. Everything stays in your browser.', 'type': 'website'},
]
for a in ARTICLES:
    ROUTES.append({'path': f"/articles/{a['slug']}", 'title': f"{a['title']} — Prateek Gupta",
                   'description': a['blurb'][0].upper() + a['blurb'][1:], 'type': 'article', 'article': a})

# ── templating ──────────────────────────────────────────────────────────

def esc(s):
    return s.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')

def sub(html, pattern, replacement):
    new, n = re.subn(pattern, replacement, html, count=1, flags=re.S)
    assert n == 1, pattern
    return new

def shell(route, noindex=False):
    url = f"{SITE}/k{route['path']}"
    html = TEMPLATE
    html = sub(html, r'<title>.*?</title>', f'<title>{esc(route["title"])}</title>')
    html = sub(html, r'(<meta name="description" content=")[^"]*(")', rf'\g<1>{esc(route["description"])}\2')
    html = sub(html, r'(<link rel="canonical" href=")[^"]*(")', rf'\g<1>{url}\2')
    html = sub(html, r'(<meta property="og:title" content=")[^"]*(")', rf'\g<1>{esc(route["title"])}\2')
    html = sub(html, r'(<meta property="og:description" content=")[^"]*(")', rf'\g<1>{esc(route["description"])}\2')
    html = sub(html, r'(<meta property="og:url" content=")[^"]*(")', rf'\g<1>{url}\2')
    html = sub(html, r'(<meta property="og:type" content=")[^"]*(")', rf'\g<1>{route["type"]}\2')
    html = sub(html, r'(<meta name="twitter:title" content=")[^"]*(")', rf'\g<1>{esc(route["title"])}\2')
    html = sub(html, r'(<meta name="twitter:description" content=")[^"]*(")', rf'\g<1>{esc(route["description"])}\2')
    if noindex:
        html = sub(html, r'(<meta name="robots" content=")[^"]*(")', r'\g<1>noindex, follow\2')
    if route.get('article'):
        a = route['article']
        ld = ('<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article",'
              f'"headline":{jsons(a["title"])},"description":{jsons(route["description"])},"url":"{url}",'
              '"author":{"@type":"Person","name":"Prateek Kumar Gupta","url":"https://prat.ee/k/"},'
              f'"image":"{SITE}/k/media/og.jpg","inLanguage":"en-GB"}}</script>')
        html = sub(html, r'(\n\s*<!-- route-schema -->)', '\n    ' + ld)
    return html

def jsons(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

# ── outputs ─────────────────────────────────────────────────────────────

written = []
for route in ROUTES:
    out = K / route['path'].lstrip('/') / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(shell(route), encoding='utf-8', newline='\n')
    written.append(out.relative_to(ROOT).as_posix())

# 404.html: the home shell, marked noindex; it only exists so unknown URLs still boot the app
home = {'path': '/', 'title': re.search(r'<title>(.*?)</title>', TEMPLATE, re.S).group(1),
        'description': re.search(r'<meta name="description" content="([^"]*)"', TEMPLATE).group(1), 'type': 'website'}
notfound = shell(home, noindex=True)
notfound = sub(notfound, r'(<link rel="canonical" href=")[^"]*(")', rf'\g<1>{SITE}/k/\2')
(ROOT / '404.html').write_text(notfound, encoding='utf-8', newline='\n')
written.append('404.html')

today = datetime.date.today().isoformat()
urls = [f'{SITE}/k/'] + [f"{SITE}/k{r['path']}" for r in ROUTES]
sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u in urls:
    pri = '1.0' if u.endswith('/k/') else ('0.8' if '/articles/' in u else '0.6')
    sitemap.append(f'  <url><loc>{u}</loc><lastmod>{today}</lastmod><priority>{pri}</priority></url>')
sitemap.append('</urlset>')
(ROOT / 'sitemap.xml').write_text('\n'.join(sitemap) + '\n', encoding='utf-8', newline='\n')
(ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /k/test\n\nSitemap: {SITE}/sitemap.xml\n', encoding='utf-8', newline='\n')
written += ['sitemap.xml', 'robots.txt']

print(f'{len(ARTICLES)} articles, {len(ROUTES)} routes')
for w in written:
    print('  wrote', w)
