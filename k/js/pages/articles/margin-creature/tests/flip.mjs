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
}).listen(8791);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('http://localhost:8791/k/');
await page.waitForSelector('body > canvas', { state: 'attached' });
await page.mouse.move(1250, 790);
await page.waitForTimeout(4000);
const body = () => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), g = c.getContext('2d'), d = devicePixelRatio;
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) { const i = (y * width + x) * 4; if (data[i + 3] > 200 && data[i] < 60 && data[i + 1] > 110 && data[i + 2] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { x: (x0 + x1) / 2 / d, y: (y0 + y1) / 2 / d };
});
const b = await body();
// aim at the body's middle (the box centre includes the sprout above it)
const at = { x: b.x, y: b.y + 6 };
await page.mouse.move(at.x, at.y); await page.waitForTimeout(150);
await page.mouse.click(at.x, at.y, { clickCount: 1 });
await page.mouse.click(at.x, at.y, { clickCount: 2 });
await page.mouse.click(at.x, at.y, { clickCount: 3 });
await page.mouse.move(1250, 790);
console.log('selected after clicks:', JSON.stringify(await page.evaluate(() => getSelection().toString())));
const clip = { x: at.x - 70, y: at.y - 95, width: 140, height: 140 };
for (let f = 0; f < 18; f++) { await page.screenshot({ path: `fl-${String(f).padStart(2, '0')}.png`, clip }); await page.waitForTimeout(70); }
await browser.close(); srv.close();
