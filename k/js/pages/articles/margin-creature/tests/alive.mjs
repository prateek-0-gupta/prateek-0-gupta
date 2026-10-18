import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';
const ROOT = 'E:/prateek';
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
const srv = http.createServer(async (req, res) => {
  let p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); } catch {}
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(8770);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3 });
page.on('pageerror', e => console.log('pageerror:', e.message));
page.on('console', m => m.type() === 'error' && console.log('console:', m.text().slice(0, 200)));
await page.goto('http://localhost:8770/k/');
await page.waitForSelector('body > canvas', { state: 'attached' });
// bounding box of what the canvas has drawn, in CSS px
const where = () => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), g = c.getContext('2d'), d = devicePixelRatio;
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) if (data[(y * width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: (x0 + x1) / 2 / d, y: (y0 + y1) / 2 / d, w: (x1 - x0) / d, h: (y1 - y0) / d };
});
const shot = async (name, pad = 60) => {
  const b = await where(); if (!b) { console.log(name, 'nothing drawn'); return; }
  await page.screenshot({ path: `a-${name}.png`, clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: pad * 2, height: pad * 2 } });
  console.log(name, JSON.stringify(b));
  return b;
};
await page.mouse.move(900, 700);
await page.waitForTimeout(4200); await shot('rest');
// circle it twice, quickly
let b = await where(); const t0 = Date.now();
for (let i = 0; i <= 64; i++) { const a = i / 32 * 2 * Math.PI * 1.25; await page.mouse.move(b.x + Math.cos(a) * 75, b.y + Math.sin(a) * 75); await page.waitForTimeout(22); }
console.log("circling took", Date.now() - t0, "ms"); await page.mouse.move(900, 700);
await page.waitForTimeout(250); await shot("dizzy"); await page.waitForTimeout(500); await shot("dizzy2");
await page.waitForTimeout(3200);
// scrub across it
b = await where();
for (let i = 0; i < 14; i++) { await page.mouse.move(b.x + (i % 2 ? 10 : -10), b.y); await page.waitForTimeout(45); }
await page.waitForTimeout(150); await shot('giggle');
await page.mouse.move(900, 700); await page.waitForTimeout(2000);
// select a sentence of the intro
await page.evaluate(() => { const p = document.querySelector('.gp-intro'), r = document.createRange(); r.setStart(p.firstChild, 60); r.setEnd(p.firstChild, 110); getSelection().removeAllRanges(); getSelection().addRange(r); });
await page.waitForTimeout(1600); await shot('read', 80);
await page.evaluate(() => getSelection().removeAllRanges());
// mid-walk to a link: catch it moving
await page.locator('.gp a', { hasText: 'History of AI' }).hover();
await page.waitForTimeout(180); await shot('walking', 70);
await page.waitForTimeout(1300); await shot('pointing', 70);
await page.locator('.gp a', { hasText: 'BVH Viewer' }).hover();
await page.waitForTimeout(1300); await shot('tpose', 70);
await browser.close(); srv.close();
