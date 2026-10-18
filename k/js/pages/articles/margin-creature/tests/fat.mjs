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
}).listen(8788);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 4 });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('http://localhost:8788/k/');
await page.waitForSelector('body > canvas', { state: 'attached' });
await page.mouse.move(1250, 790);
// teal pixels only, so bubbles and radishes don't count
const body = () => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), g = c.getContext('2d'), d = devicePixelRatio;
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) { const i = (y * width + x) * 4; if (data[i + 3] > 200 && data[i] < 60 && data[i + 1] > 110 && data[i + 2] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { x: (x0 + x1) / 2 / d, y: (y0 + y1) / 2 / d, w: (x1 - x0) / d, h: (y1 - y0) / d };
});
const portrait = async name => {
  await page.mouse.move(1250, 790); await page.waitForTimeout(2600);
  const b = await body();
  console.log(name, 'teal box', Math.round(b.w), 'x', Math.round(b.h));
  await page.screenshot({ path: `fat-${name}.png`, clip: { x: b.x - 50, y: b.y - 45, width: 100, height: 100 } });
};
await page.waitForTimeout(3000);
await portrait('before');
const mx = await page.evaluate(() => { const r = document.querySelector('.gp-margin').getBoundingClientRect(); return r.left + r.width / 2; });
for (let i = 0; i < 4; i++) { await page.mouse.click(mx + 25, 330); await page.mouse.move(1250, 790); await page.waitForTimeout(3300); }
await portrait('after');
await browser.close(); srv.close();
