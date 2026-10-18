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
}).listen(8792);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const kind = process.argv[2];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
let errs = 0; page.on('pageerror', e => { if (errs++ < 2) console.log('pageerror:', e.stack.split(String.fromCharCode(10)).slice(0, 4).join(' / ')); });
await page.addInitScript(() => {
  window.__said = [];
  const f = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
    const full = (window.__p1 || '') + t; window.__p1 = t;
    const l = window.__said;
    if (/[!.?~]$/.test(full) && full.length > 2 && !l.slice(-3).includes(full) && !l.slice(-3).some(x => x.endsWith(full))) l.push(full);
    return f.call(this, t, ...a);
  };
});
await page.goto(`http://localhost:8792/k/?pet=${kind}`);
await page.waitForSelector('body > canvas', { state: 'attached' });
const body = () => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), g = c.getContext('2d'), d = devicePixelRatio;
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) { const i = (y * width + x) * 4; if (data[i + 3] > 200 && data[i] < 60 && data[i + 1] > 110 && data[i + 2] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: (x0 + x1) / 2 / d, y: (y0 + y1) / 2 / d };
});
let n = 0;
const snap = async label => {
  const b = await body(); if (!b) return;
  await page.screenshot({ path: `p-${kind}-${String(n++).padStart(2, '0')}.png`, clip: { x: Math.max(0, b.x - 80), y: Math.max(0, b.y - 70), width: 200, height: 130 } });
  const said = await page.evaluate(() => window.__said.splice(0));
  console.log(`${n - 1} ${label}:`, said.join(' | '));
};
const mx = await page.evaluate(() => { const r = document.querySelector('.gp-margin').getBoundingClientRect(); return r.left + r.width / 2; });
await page.mouse.move(1200, 780); await page.waitForTimeout(1500); await snap('arrival');
// a slow pointer nearby: pup play-bows, cat stalks
let b = await body();
for (let i = 0; i < 30; i++) { await page.mouse.move(b.x + 220 + i * 3, b.y - 40 + i); await page.waitForTimeout(40); }
await page.waitForTimeout(600); await snap('slow pointer near');
await page.waitForTimeout(900); await snap('pounce?');
// pointer stops near: pup head tilt, cat slow blink
await page.waitForTimeout(1500); await snap('pointer resting near');
// hover links: cat may ignore
for (const t of ['Nagmani', 'p2p chat', 'History of AI']) { await page.locator('.gp a', { hasText: t }).hover(); await page.waitForTimeout(700); await snap('hover ' + t); }
// pet it for 4 s
await page.mouse.move(1200, 780); await page.waitForTimeout(1500);
b = await body();
for (let i = 0; i < 40; i++) { await page.mouse.move(b.x + Math.sin(i / 3) * 4, b.y + 4); await page.waitForTimeout(100); }
await snap('petted 4s');
await page.mouse.move(1200, 780); await page.waitForTimeout(1200); await snap('after petting');
// feed far from the margin
await page.mouse.click(1150, 560); console.log("dropped on:", await page.evaluate(() => document.elementFromPoint(1150, 560).className)); await page.mouse.move(1200, 780);
for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); await snap('feeding ' + i); }
await page.waitForTimeout(2500); await snap('after meal');
// startle it: rush the pointer at it
b = await body();
await page.mouse.move(b.x + 250, b.y); await page.waitForTimeout(100);
await page.mouse.move(b.x + 10, b.y, { steps: 3 });
await page.mouse.move(1200, 780);
await page.waitForTimeout(1300); await snap('after fright');
// leave it idle a while
await page.waitForTimeout(9000); await snap('idle 9s');
await page.waitForTimeout(6000); await snap('idle 15s');
await browser.close(); srv.close();
