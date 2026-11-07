// Behaviour metrics for Mooli: same method as tests/ in the article folder.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';
const ROOT = 'E:/prateek', PORT = 8791;
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
const srv = http.createServer(async (req, res) => {
  let p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); } catch {}
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(PORT);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'] });
const errors = [];
async function open(path = '/k/') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__log = []; const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__log.push([performance.now()/1000, String(t)]); return f.call(this, t, ...a); };
  });
  await page.goto(`http://localhost:${PORT}${path}`);
  await page.waitForSelector('body > canvas', { state: 'attached' });
  return page;
}
const where = page => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), w = c.width, h = c.height, d = c.getContext('2d').getImageData(0,0,w,h).data;
  let sx=0, sy=0, n=0; for (let y=0;y<h;y+=2) for (let x=0;x<w;x+=2) { const i=(y*w+x)*4; if (d[i+3]>200 && d[i+1]>d[i]+40 && d[i+2]>d[i]+30) { sx+=x; sy+=y; n++; } }
  return n ? { x:sx/n, y:sy/n } : null;
});
const utterances = async page => {
  const log = await page.evaluate(() => window.__log);
  const out = []; let cur = '', typed = '';
  for (const [t, s] of log) { if (s === 'z' || s.length === 0) continue;
    if (s.length > 1 && s !== cur) { if (!out.length || out[out.length-1].text !== s && !s.startsWith(out[out.length-1].text.slice(0,4))) out.push({ t, text: s }); else if (s.length > out[out.length-1].text.length) out[out.length-1].text = s; cur = s; } }
  return out;
};
const pearson = (a, b) => { const n=a.length, ma=a.reduce((s,v)=>s+v,0)/n, mb=b.reduce((s,v)=>s+v,0)/n; let x=0,y=0,z=0; for(let i=0;i<n;i++){x+=(a[i]-ma)*(b[i]-mb);y+=(a[i]-ma)**2;z+=(b[i]-mb)**2;} return x/Math.sqrt(y*z||1); };

async function idle() {        // leave it entirely alone
  const page = await open(); const pts = [];
  const t0 = Date.now(); while (Date.now()-t0 < 70000) { const q = await where(page); if (q) pts.push(q); await page.waitForTimeout(250); }
  let dist=0, moves=0, runs=[]; for (let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); dist+=d; if(d>2) moves++; }
  const u = await utterances(page);
  return { name:'idle 70s', pathPx:Math.round(dist), movingPct:Math.round(100*moves/pts.length), spoken:u.length, lines:u.map(x=>x.text) };
}
async function track() {       // pointer strolling up and down over the text column
  const page = await open(); await page.waitForTimeout(4000); const py=[], my=[]; let dist=0, prev=null;
  const t0 = Date.now(); while (Date.now()-t0 < 40000) {
    const e=(Date.now()-t0)/1000, y=400+250*Math.sin(e*2*Math.PI/9), x=720+60*Math.sin(e*1.3);
    await page.mouse.move(x,y); const q=await where(page);
    if (q) { py.push(y); my.push(q.y); if (prev) dist+=Math.abs(q.y-prev.y); prev=q; }
    await page.waitForTimeout(120);
  }
  const u = await utterances(page);
  return { name:'pointer strolling 40s', corrPointerY:+pearson(py,my).toFixed(2), verticalTravelPx:Math.round(dist), spoken:u.length, lines:u.map(x=>x.text) };
}
async function wake() {        // asleep; a small nudge of the mouse on the far side of the screen
  const page = await open(); await page.mouse.move(1200, 100); await page.waitForTimeout(3000);
  await page.evaluate(async () => { (await import('/k/js/components/mooli.js')).getMooli().sleep(); });
  await page.waitForTimeout(3000); await page.evaluate(() => { window.__log.length = 0; });
  await page.mouse.move(1203, 102); await page.waitForTimeout(1500);
  const u = await utterances(page);
  return { name:'asleep, tiny far mouse move', spoken:u.map(x=>x.text), zStillComing: (await page.evaluate(()=>window.__log.some(l=>l[1]==='z'))) };
}
const out = await Promise.all([idle(), track(), wake()]);
console.log(JSON.stringify(out, null, 1)); if (errors.length) console.log('PAGE ERRORS', [...new Set(errors)]);
await browser.close(); srv.close();
