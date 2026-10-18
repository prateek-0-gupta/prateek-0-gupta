import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';
const ROOT = 'E:/prateek';
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const srv = http.createServer(async (req, res) => {
  let p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); } catch {}
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(8783);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3, colorScheme: scheme });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.addInitScript(() => {
    window.__said = []; const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__prev = window.__last; window.__last = t; return f.call(this, t, ...a); };
  });
  await page.goto('http://localhost:8783/k/');
  await page.waitForSelector('body > canvas', { state: 'attached' });
  await page.waitForTimeout(4500);
  const phrases = scheme === 'light'
    ? ["I'm a software engineer", 'Manchester', 'digital humans', 'film', 'an Indian gothic snake game', '3,090 films', 'the complete evolution of AI', 'Prateek Gupta', 'a chat with no server', 'an infinite thought canvas', 'coded and counted']
    : ["I'm a software engineer"];
  for (const ph of phrases) {
    await page.evaluate(ph => {
      const walker = document.createTreeWalker(document.querySelector('.gp'), NodeFilter.SHOW_TEXT);
      let n; while ((n = walker.nextNode())) { const i = n.data.indexOf(ph); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + ph.length); getSelection().removeAllRanges(); getSelection().addRange(r); return; } }
      throw new Error('not found: ' + ph);
    }, ph);
    await page.waitForTimeout(1900);
    console.log(scheme, JSON.stringify(ph), '->', JSON.stringify(await page.evaluate(() => (window.__prev || "") + window.__last)));
    if (ph === "I'm a software engineer") await page.screenshot({ path: `w-${scheme}.png`, clip: { x: 230, y: 140, width: 560, height: 170 } });
    await page.evaluate(() => getSelection().removeAllRanges());
    await page.waitForTimeout(600);
  }
  await page.close();
}
await browser.close(); srv.close();
