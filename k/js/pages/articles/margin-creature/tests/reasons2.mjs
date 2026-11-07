// Second round: the things round one couldn't see, plus close-ups of the new poses.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';
const ROOT = 'E:/prateek', PORT = 8793;
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
const srv = http.createServer(async (req, res) => {
  let p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  let isDir = false; try { isDir = (await stat(p)).isDirectory(); } catch {}
  if (isDir) p = join(p, 'index.html');
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { const b = await readFile(join(ROOT, 'k/index.html')); res.writeHead(200, { 'content-type': 'text/html' }); res.end(b); }
}).listen(PORT);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'] });
const errors = [];
async function open(path = '/k/', { viewport = { width: 1280, height: 800 }, scale = 1, ctx = null } = {}) {
  ctx = ctx || await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(path + ': ' + e.message));
  await page.addInitScript(() => {
    window.__log = []; const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__log.push([performance.now()/1000, String(t)]); return f.call(this, t, ...a); };
  });
  await page.goto(`http://localhost:${PORT}${path}`);
  await page.waitForSelector('body > canvas', { state: 'attached' });
  return page;
}
const mood = page => page.evaluate(async () => (await import('/k/js/components/mooli.js')).getMooli()?.mood);
const hovered = page => page.evaluate(async () => (await import('/k/js/components/mooli.js')).getMooli()?.hovered);
const where = page => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), w = c.width, h = c.height, s = devicePixelRatio, d = c.getContext('2d').getImageData(0,0,w,h).data;
  let sx=0, sy=0, n=0; for (let y=0;y<h;y+=3) for (let x=0;x<w;x+=3) { const i=(y*w+x)*4; if (d[i+3]>200 && d[i+1]>d[i]+40 && d[i+2]>d[i]+30) { sx+=x; sy+=y; n++; } }
  return n ? { x:sx/n/s, y:sy/n/s } : null;
});
const utterances = async page => {
  const log = await page.evaluate(() => window.__log), out = [];
  for (const [t, s] of log) { if (s === 'z' || s.length < 2 || /^(POW|BONK|THMP|ZAP)/.test(s)) continue;
    const last = out[out.length-1];
    if (last && (s.startsWith(last.text.slice(0,3)) || last.text.startsWith(s.slice(0,3))) && t - last.t < 5) { if (s.length > last.text.length) last.text = s; }
    else out.push({ t, text: s }); }
  return out.map(x => x.text);
};
const runs = seq => { const o=[]; for (const m of seq) if (o[o.length-1]!==m) o.push(m); return o; };
const catchIt = async page => { for (let i=0;i<30;i++){ const q=await where(page); await page.mouse.move(q.x,q.y,{steps:2}); await page.waitForTimeout(120); if (await hovered(page)) return q; } throw new Error('never got the pointer on it'); };

async function presence() {   // someone is here for 4 minutes, mouse off in the text, not touching it
  const page = await open(); const s=[]; let m; const counts={};
  const t0=Date.now(); let i=0; while (Date.now()-t0<245000) { if (i++%8===0) await page.mouse.move(900+Math.random()*200,120+Math.random()*80); m=await mood(page); s.push(m.mode); await page.waitForTimeout(250); }
  for (const x of s) counts[x]=(counts[x]||0)+1;
  const pct = Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,Math.round(100*v/s.length)]));
  const said = await utterances(page);
  return { name:'someone here for 4 min, not touching it', sharePct:pct, habits:runs(s).length, timeline:runs(s).join(' > '), said, spokenPerMin:+(said.length/4).toFixed(1), end:m };
}
async function aloneThenCloseups() {  // alone: nod off, sleep; grab a close-up of each new pose as it appears
  const page = await open('/k/', { scale: 3 }); const s=[]; const shot=new Set();
  const snap = async (name) => { if (shot.has(name)) return; shot.add(name); const q=await where(page); if (!q) return; await page.screenshot({ path:`pose-${name}.png`, clip:{ x:Math.max(0,q.x-70), y:Math.max(0,q.y-70), width:150, height:130 } }); };
  const t0=Date.now(); let m, drowseShot=false; while (Date.now()-t0<130000) { m=await mood(page); s.push(m.mode); if (['periscope','sniff','loaf','flop','groom','beg','sleep'].includes(m.mode)) await snap(m.mode); const e=(Date.now()-t0)/1000; if (m.mode==='home'&&e>45&&!drowseShot&&m.energy>0){drowseShot=true; await snap('nodding');} await page.waitForTimeout(200); }
  return { name:'alone 130s', timeline:runs(s).join(' > '), poses:[...shot], said:await utterances(page), end:m };
}
async function reread() {
  const page = await open('/articles/the-page-that-gestures-back'); await page.waitForTimeout(3500); const s=[];
  for (let i=0;i<6;i++){ await page.evaluate(()=>window.scrollBy(0,160)); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);
  for (let i=0;i<4;i++){ await page.evaluate(()=>window.scrollBy(0,-90)); await page.waitForTimeout(60); s.push((await mood(page)).mode); }
  for (let i=0;i<10;i++){ await page.waitForTimeout(120); s.push((await mood(page)).mode); }
  return { name:'scrolling back up', modes:runs(s).join(' > ') };
}
async function musing() {   // settle on paragraphs for a while each; does it think about them? does it sit level with them?
  const page = await open('/articles/the-page-that-gestures-back'); await page.waitForTimeout(3000); const level=[]; const gz={};
  for (let i=0;i<5;i++){
    await page.evaluate(()=>window.scrollBy(0,620)); await page.waitForTimeout(8200);
    const q=await where(page), m=await mood(page); gz[m.gaze]=(gz[m.gaze]||0)+1; level.push({ y:q?Math.round(q.y):null, mode:m.mode });
  }
  return { name:'settling on parts of an article', level, gazeAtEnd:gz, said:await utterances(page) };
}
async function trustTest() {
  const ctx = await browser.newContext({ viewport:{width:1280,height:800} });
  let page = await open('/k/', { ctx }); await page.waitForTimeout(2500); const m0=await mood(page);
  const q=await catchIt(page); await page.mouse.down(); await page.waitForTimeout(60);
  await page.mouse.move(q.x+150,q.y-40); await page.mouse.move(q.x+380,q.y-120); await page.mouse.move(q.x+620,q.y-200); await page.mouse.up();
  await page.waitForTimeout(80); const thrown=await mood(page); await page.mouse.move(1200,760); await page.waitForTimeout(2500); const m1=await mood(page);
  await page.waitForTimeout(16000); const later=await mood(page);
  await page.close(); await new Promise(r=>setTimeout(r,300));
  const page2 = await open('/k/', { ctx }); await page2.waitForTimeout(1500); const m2=await mood(page2);
  return { name:'throwing it', before:m0.trust, modeJustAfter:thrown.mode, after:m1.trust, valenceAfter:m1.valence, after16s:{valence:later.valence,mode:later.mode}, afterReload:{trust:m2.trust,visit:m2.visit} };
}
async function regress() {
  const page = await open(); await page.waitForTimeout(2500); const r={};
  const seen=[]; const watch=async ms=>{const t=Date.now(); while(Date.now()-t<ms){seen.push((await mood(page)).mode); await page.waitForTimeout(100);}};
  let q=await catchIt(page); for(let i=0;i<14;i++){await page.mouse.move(q.x-2+i%3,q.y+i%2); await page.waitForTimeout(90);} await watch(400); r.pet=runs(seen.splice(0)).join('>');
  await page.mouse.move(1200,700); await page.waitForTimeout(1500); seen.length=0;
  q=await catchIt(page); await page.mouse.dblclick(q.x,q.y); await watch(1000); r.flip=runs(seen.splice(0)).join('>');
  await page.mouse.move(1200,700); await page.waitForTimeout(1500);
  const before=(await mood(page)).asleep;
  await page.evaluate(async()=>{(await import('/k/js/components/mooli.js')).getMooli().sleep()}); await page.waitForTimeout(500);
  q=await where(page); await page.mouse.move(q.x+150,q.y); await page.mouse.move(q.x+60,q.y+4,{steps:14}); await page.waitForTimeout(300); r.wokenByPointerCloseBy=!(await mood(page)).asleep;
  await page.mouse.move(1200,700); await page.waitForTimeout(800);
  await page.evaluate(async()=>{(await import('/k/js/components/mooli.js')).getMooli().sleep()}); await page.waitForTimeout(300);
  await page.mouse.click(90,640); await watch(5500); r.radishWakesIt=runs(seen.splice(0)).join('>');
  return { name:'regressions', ...r };
}
async function others() {
  const out={};
  for (const pet of ['pup','cat']) { const page=await open(`/k/?pet=${pet}`); const s=[]; const t0=Date.now(); while(Date.now()-t0<50000){ const i=(Date.now()-t0)/1000; await page.mouse.move(800+200*Math.sin(i/2),200+100*Math.cos(i/3)); await page.waitForTimeout(200); s.push((await mood(page)).mode);} out[pet]=runs(s).join('>'); }
  return { name:'other personalities', ...out };
}
const which = process.argv.slice(2);
const all = { presence, aloneThenCloseups, reread, musing, trustTest, regress, others };
const results = await Promise.all((which.length ? which : Object.keys(all)).map(k => all[k]().catch(e => ({ name:k, FAILED:e.message }))));
console.log(JSON.stringify(results, null, 1));
console.log('PAGE ERRORS:', JSON.stringify([...new Set(errors)]));
await browser.close(); srv.close();
