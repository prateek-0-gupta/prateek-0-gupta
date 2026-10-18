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
}).listen(8796);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
let errs = 0; page.on('pageerror', e => { if (errs++ < 3) console.log('pageerror:', e.stack.split(String.fromCharCode(10)).slice(0, 3).join(' / ')); });
await page.addInitScript(() => {
  window.__said = [];
  const f = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
    const full = (window.__p1 || '') + t; window.__p1 = t;
    const l = window.__said;
    if (/[!.?~]$/.test(full) && full.length > 2 && !l.slice(-3).some(x => x === full || x.endsWith(full))) l.push(full);
    return f.call(this, t, ...a);
  };
});
await page.goto('http://localhost:8796/k/');   // no ?pet: the bunny is the default now
await page.waitForSelector('body > canvas', { state: 'attached' });
const body = () => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), g = c.getContext('2d'), d = devicePixelRatio;
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) { const i = (y * width + x) * 4; if (data[i + 3] > 200 && data[i] < 60 && data[i + 1] > 110 && data[i + 2] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: (x0 + x1) / 2 / d, y: (y0 + y1) / 2 / d, top: y0 / d, bottom: y1 / d };
});
const said = async () => (await page.evaluate(() => window.__said.splice(0))).join(' | ');
const film = async (name, frames, every, at) => {
  for (let f = 0; f < frames; f++) {
    const b = at || await body();
    if (b) await page.screenshot({ path: `rb-${name}-${String(f).padStart(2, '0')}.png`, clip: { x: Math.max(0, b.x - 70), y: Math.max(0, b.y - 75), width: 150, height: 130 } });
    await page.waitForTimeout(every);
  }
};
await page.mouse.move(1200, 780); await page.waitForTimeout(3000);
console.log('arrival (default, no ?pet):', await said());

// 1. startle: rush the pointer at it -> freeze, thump, bolt
let b = await body();
await page.mouse.move(b.x + 400, b.y, { steps: 10 }); await page.waitForTimeout(30);
for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + 400 - i * 48, b.y);   // a quick rush at it, many events
const at = await body();
await page.mouse.move(1200, 780);
await film('startle', 12, 80, at);
console.log('startle:', await said());
await page.waitForTimeout(4500);

// 2. hold it for 2 s -> trance; let go -> thump and bolt
b = await body();
await page.mouse.move(b.x, b.y + 4); await page.waitForTimeout(300);
await page.mouse.down(); await page.mouse.move(b.x + 3, b.y + 6);
await page.waitForTimeout(500); await film('held-early', 1, 0);
await page.waitForTimeout(1500); await film('held-trance', 1, 0);
await page.mouse.up(); await page.mouse.move(1200, 780);
await film('released', 8, 90);
console.log('hold and release:', await said());
await page.waitForTimeout(4500);

// 3. the pointer leaves the window -> periscope
await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent('mouseleave')));
await page.waitForTimeout(500); await film('periscope', 3, 300);
console.log('pointer left:', await said());
await page.waitForTimeout(2000);

// 4. a link it hasn't met -> chin it
await page.locator('.gp a', { hasText: 'Nagmani' }).hover();
await page.waitForTimeout(1100); await film('chin', 3, 150);
console.log('new link:', await said());
await page.mouse.move(1200, 780); await page.waitForTimeout(1500);
await page.locator('.gp a', { hasText: 'Nagmani' }).hover();
await page.waitForTimeout(1300);
console.log('same link again (should not chin):', await said());
await browser.close(); srv.close();
