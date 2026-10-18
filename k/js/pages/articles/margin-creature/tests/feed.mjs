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
}).listen(8785);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3 });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.addInitScript(() => {
  window.__said = []; const f = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
    window.__p2 = window.__p1; window.__p1 = t;
    const full = (window.__p2 || '') + t;
    if (/[!.?~]$/.test(t) && window.__said[window.__said.length - 1] !== full && !window.__said.includes(full + '#')) window.__said.push(full);
    return f.call(this, t, ...a);
  };
});
await page.goto('http://localhost:8785/k/');
await page.waitForSelector('body > canvas', { state: 'attached' });
await page.mouse.move(1250, 790);
await page.waitForTimeout(4500);
const mx = await page.evaluate(() => { const r = document.querySelector('.gp-margin').getBoundingClientRect(); return r.left + r.width / 2; });
const box = () => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), g = c.getContext('2d'), d = devicePixelRatio;
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 3) for (let x = 0; x < width; x += 3) if (data[(y * width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x: x0 / d, y: y0 / d, w: (x1 - x0) / d, h: (y1 - y0) / d };
});
const said = async () => (await page.evaluate(() => window.__said.splice(0))).filter(t => t.length > 3);
console.log('arrival:', (await said()).join(' | '));
for (let i = 1; i <= 5; i++) {
  await page.mouse.click(mx + 25, 330);
  await page.mouse.move(1250, 790);
  if (i === 1) {
    // film the first meal
    const b = await box();
    const clip = { x: mx - 70, y: 230, width: 200, height: 160 };
    for (let f = 0; f < 18; f++) { await page.screenshot({ path: `f-${String(f).padStart(2, '0')}.png`, clip }); await page.waitForTimeout(110); }
  }
  await page.waitForTimeout(i < 4 ? 3600 : 5200);
  console.log(`radish ${i}:`, (await said()).join(' | '));
  if (i === 4) await page.screenshot({ path: 'f-fat.png', clip: { x: mx - 50, y: 270, width: 150, height: 110 } });
}
await browser.close(); srv.close();
