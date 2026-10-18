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
}).listen(8774);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__said = []; const f = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { const l = window.__said; if (l[l.length - 1] !== t && t.length > 1) l.push(t); return f.call(this, t, ...a); };
});
await page.goto('http://localhost:8774/k/');
await page.waitForSelector('body > canvas', { state: 'attached' });
await page.waitForTimeout(4500);
const log = async label => console.log(label, JSON.stringify(await page.evaluate(() => window.__said.splice(0))));
await log('arrival:');
for (const t of ['BVH Viewer', 'Digital Doppel', 'Nagmani', 'p2p chat']) {
  await page.locator('.gp a', { hasText: t }).hover(); await page.waitForTimeout(900); await log(t + ':');
  await page.mouse.move(900, 780); await page.waitForTimeout(1400);
}
await browser.close(); srv.close();
