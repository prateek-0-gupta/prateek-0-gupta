# prat.ee/k

This is my website. It is also the place where my side projects go to live, and occasionally to die.

Live at [prat.ee/k](https://prat.ee/k). No framework, no build step, no `node_modules`. Just HTML, CSS and ES modules served by GitHub Pages. Clone it, open it, it works. 

## What's in here

**Projects**

- **Nagmani** (`/snake`): an Indian gothic snake game. The snake is cursed. So are you if you keep playing.
- **p2p chat** (`/p2pchat`): a serverless chat over WebRTC. Your messages go from your browser to theirs and nowhere else. Like most conversations, they leave no trace.
- **BVH Viewer** (`/bvhviewer`): drop a `.bvh` motion-capture file in and watch a skeleton do whatever the actor did that day.
- **I Think Therefore I Am** (`/ithinkthereforiam`): an infinite canvas for dumping thoughts. Sticky notes, a kanban board, red string between ideas like a detective who has lost the plot, a sketch layer with shapes and text you can move, resize and link. Everything stays in your browser. Nothing touches a server. Nothing lasts anyway, but this at least survives a refresh.
- **Digital Human** and **Digital Doppelgänger** are external links, one to work at [Sum Vivas](https://avatar.sumvivas.com) and one to a short film.

**Writing**

i love cinema and as a media student I wrote some long-form pieces on how cinema taught us to fear and love machines, a ranked list of AI films, and a history of AI from 1950 to now. They live in `k/js/pages/articles/articles-data.js` as plain HTML strings. 

**Art**

I also draw and photograph things. That lives on Instagram at [@chai.and.photoshop](https://www.instagram.com/chai.and.photoshop). Go there if you prefer pictures to code.

## How it works

```
index.html            redirects to /k/
404.html              same shell as k/index.html, so deep links work on GitHub Pages
k/index.html          the app shell. Sets <base href="/k/">
k/js/app.js           the route table
k/js/framework.js     bas, the whole framework, about 360 lines
k/js/pages/           one folder per page or project
k/css/style.css       site styles. Project pages ship their own CSS
```

`framework.js` is a small SPA runtime I wrote so I would stop rewriting one. It is called **bas**, which is Hindi for "enough", and that is the whole design brief. A page is a function that returns a template string. It gets `useState` and `useEffect`, a `data-link` attribute for client-side navigation, `data-action` for delegated click handlers, and a DOM morph on re-render so focus and scroll do not jump. That's the entire API. Read it in ten minutes, and if you find a bug, congratulations, it is now your framework too.

Routing is path-based with `/k` as the base path. GitHub Pages does not know about client-side routes, so `404.html` is a copy of the app shell. Any unknown URL loads the app, which then renders the right page. Old trick, still works.

### bas, in slightly more detail

Everything starts in `k/js/app.js`. Routes are a plain object from path to page function, and the second argument is the base path the whole site lives under:

```js
import Framework from './framework.js';
import Home from './pages/home.js';
import Snake from './pages/projects/snake/snake.js';

new Framework({
    '/': Home,
    '/snake': Snake,
}, '/k');
```

On load, and on every back or forward press, the router reads `location.pathname`, strips the base path, drops any trailing slash, and matches it against the table. Exact paths win. A segment starting with a colon is a parameter, and `'*'` is the page shown when nothing matches:

```js
'/articles': ArticlesIndex,
'/articles/:slug': ArticlePage,
'*': NotFound,
```

**A page** is a function that returns an HTML string. It receives one argument with `params`, `query` (a `URLSearchParams`), `path` and `hash`, and it may be `async` if it needs to fetch something first. It can load its own stylesheet by putting a `<link>` in the template, which is how the project pages keep their CSS out of the main file.

```js
import { useState, useEffect, registerHandler, navigate } from '../framework.js';

export default function Counter({ params, query }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setCount(c => c + 1), 1000);
        return () => clearInterval(id);     // runs when you leave, or before the effect re-runs
    }, []);

    registerHandler('bump', () => setCount(c => c + 1));
    registerHandler('leave', () => navigate('/'));

    return `
        <p>${count} for ${params.name ?? 'nobody'}</p>
        <button data-action="bump">more</button>
        <button data-action="leave">enough</button>
        <a href="/" data-link>home</a>
    `;
}
```

**Navigation** is any anchor with a `data-link` attribute. On a plain left click the router prefixes the base path if needed, pushes a history entry, renders, and scrolls to the top or to the `#hash` if there is one. Cmd, ctrl, shift and middle clicks are left to the browser so open-in-new-tab works, and so are links with `target="_blank"` or `download`. After every render the router also rewrites `data-link` hrefs to their full path, so hovering or copying a link gives a real URL, and marks the link for the current page with `aria-current="page"` if you want to style it. Going back restores the scroll position you left at. From code, `navigate('/snake')` does the same thing, and `navigate(url, { replace: true })` swaps the current entry instead of pushing one.

**Events** use delegation. One click listener sits on `document.body`; an element with `data-action="name"` fires whatever was registered under that name with `registerHandler`. Handlers survive re-renders and are cleared when the route changes, so you can register them inside the page function or at module level, whichever reads better.

**State and effects** work the way you would guess, with a few things worth knowing:

- Hooks are matched by call order, same as React. Do not put them inside conditions.
- Hook storage is reset when the route changes, so state does not leak between pages, and a `setState` fired late by some old timer after you have left a page is ignored.
- Several `setState` calls in one tick produce one render. The new HTML is morphed onto the existing DOM instead of replacing it, so an input you are typing in keeps its value and focus. A subtree marked `data-morph-ignore` is skipped entirely, for things like canvases that a page draws into by hand.
- `useEffect` runs after the DOM has been patched, in order. Dependencies are compared with `Object.is`; pass `[]` to run once per visit, omit them to run every render. Return a function to clean up; it runs before the effect re-runs and when the page is left. An `async` effect may resolve to a cleanup function too.
- If a page is `async` and you navigate away before it resolves, its output is discarded rather than painted over the new page.

**Everything it does**, in one list, so you can decide in a minute whether it is enough for you:

- Routes as a plain object. Exact paths, `:param` segments, and `'*'` for not found.
- Pages are functions returning HTML strings. Sync or async. They receive `params`, `query`, `path` and `hash`.
- `useState` and `useEffect` with React's call-order rules. Effects run after the DOM is patched, return a cleanup, and may be async.
- One render per tick no matter how many `setState` calls, and late renders from pages you have left are dropped.
- DOM morphing instead of `innerHTML`, so inputs keep their value and focus. `data-morph-ignore` fences off anything you draw by hand.
- `data-link` navigation that respects modifier clicks, new-tab links and downloads. Hrefs are rewritten to full URLs and the current page's link gets `aria-current`.
- Scroll handling: top or hash on navigation, previous position on back.
- Delegated `data-action` click handlers that survive re-renders and clear on route change.
- `navigate(url, { replace })` for navigating from code.
- A base path option for sites that live in a subfolder, like this one under `/k`.
- Zero dependencies, one file, no build step. Read it in the time it takes to make tea.

That is the whole thing. If you outgrow it, you will know, and the migration is copying template strings into whatever you pick next.

### Use bas in your own project

It is one file with no imports. Copy `k/js/framework.js` next to your HTML, rename it if `framework.js` feels grand, and you are done installing. The smallest complete site looks like this:

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>mine</title></head>
<body>
  <div id="app"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

```js
// app.js
import Framework, { useState, registerHandler } from './framework.js';

function Home() {
    const [n, setN] = useState(0);
    registerHandler('more', () => setN(n + 1));
    return `<h1>${n}</h1><button data-action="more">more</button><a href="/about/me" data-link>about</a>`;
}

function About({ params }) {
    return `<h1>about ${params.who}</h1><a href="/" data-link>back</a>`;
}

new Framework({
    '/': Home,
    '/about/:who': About,
    '*': () => '<h1>nothing here</h1>',
});
```

The second argument to `new Framework()` is the base path. Leave it out when the site is served from the root of a domain. Pass `'/k'` or similar when it lives in a subfolder, and add `<base href="/k/">` to the HTML so relative asset paths follow.

Two rules keep nested routes working. First, reference scripts and assets with absolute paths (`/app.js`, not `app.js`) or set a `<base href="/">`, otherwise a refresh on `/about/me` asks for `/about/app.js` and gets nonsense. Second, the host has to serve the shell for paths that are not files, so that same refresh does not 404. How that is spelled depends on where you deploy:

- **GitHub Pages**: copy your `index.html` to `404.html`. Pages serves it for any unknown path and the router takes over. This repo does exactly that.
- **nginx**: `try_files $uri $uri/ /index.html;` inside the `location /` block. The `nginx.conf` in this repo is a working example.
- **Netlify**: a `_redirects` file containing `/*  /index.html  200`.
- **Vercel**: a `vercel.json` with a rewrite of `/(.*)` to `/index.html`.
- **Any local static server**: navigate from the home page, or use the Docker image below, which handles it.

No lock-in either. Pages are template strings, so the day you outgrow bas you paste them into whatever comes next and delete one file.

## Run it locally

Any static server from the repo root will do:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/k/`. Navigate from the home page rather than typing deep links, because a plain static server has no idea what `/k/snake` means and will not fall back to the shell the way Pages does.

**Or with Docker**, which serves it the way production does, deep links included:

```
docker build -t prat .
docker run --rm -p 8080:80 prat
```

Then open `http://localhost:8080/k/`. The image is nginx with the site copied in and a small `nginx.conf` that falls back to the app shell for unknown paths under `/k/`, and to `404.html` everywhere else, which is precisely what GitHub Pages does. Nothing runs at build time because there is nothing to build.

## Fork it and make it yours

The whole point of keeping this dependency-free is that forking should take less time than reading this section.

1. Fork the repo. If you want a user site, name it `yourname.github.io`.
2. Delete `CNAME`, or replace `prat.ee` with your own domain. Leaving my domain in there will not make you me. I have tried.
3. In the repo settings, turn on GitHub Pages from the `main` branch, root folder.
4. Edit `k/js/pages/home.js`. The `PROJECTS` array and the `SOCIALS` block near the top are the only things most people need to change.
5. Swap the title and meta tags in `k/index.html` and `404.html`. Both files, they are twins.
6. Add a page by creating a folder under `k/js/pages/`, exporting a function that returns HTML, and adding a route in `k/js/app.js`. Delete the projects you do not want the same way.


## Things worth stealing

Everything is public, so take what helps.

- `k/js/framework.js`: bas, a working SPA runtime with routing, hooks and DOM morphing in one file. Good for a weekend project that will not justify React. Instructions above.
- The typography engine at the bottom of `k/js/pages/home.js`: every capital letter as a hand-traced polygon, drawn to a canvas as jigsaw pieces. Useful if you want your name to look like it was cut out with kitchen scissors.
- `k/js/pages/ithinkthereforiam/lib/`: a self-contained infinite canvas. Pan and zoom, sticky notes, undo stack, localStorage persistence, a sketch layer with hit-testing, selection handles and resize, and a threads module that draws string between any two things. Each file does one job.
- `k/js/pages/projects/bvhviewer/`: a BVH motion-capture player in three.js, if you ever need to look at mocap without opening Blender.
- `k/js/pages/projects/p2pchat/`: WebRTC chat that finds peers through public BitTorrent trackers via Trystero, so there is no server of mine anywhere in the loop. Discovery takes a minute. Patience is a feature.

There is no license file yet. Use the code freely, a credit is nice but I will not enforce it. The writing, photos and art are mine, ask before you reuse those.

## Why

Nothing we make outlasts the heat death of the universe, which is oddly freeing. It means the only reason to build anything is that you wanted to. 

Prateek Kumar Gupta, Manchester, UK. AI & Development at Sum Vivas. [LinkedIn](https://www.linkedin.com/in/prateek-gupta08), [Instagram](https://www.instagram.com/chai.and.photoshop), [e-mail](mailto:prateekgupta1198@gmail.com).
