// Behaviour checks for Mooli after the "reasons" pass. Same method as the article's tests/.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';
const ROOT = 'E:/prateek', PORT = 8792;
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.mjs':'text/javascript' };
const srv = http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let p = join(ROOT, url);
  let isDir = false; try { isDir = (await stat(p)).isDirectory(); } catch {}
  if (isDir) p = join(p, 'index.html');
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { const b = await readFile(join(ROOT, 'k/index.html')); res.writeHead(200, { 'content-type': 'text/html' }); res.end(b); }
}).listen(PORT);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'] });
const errors = [];
async function open(path = '/k/', { viewport = { width: 1280, height: 800 }, ctx = null, reduced = false } = {}) {
  ctx = ctx || await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
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
const petDo = (page, fn, ...args) => page.evaluate(async ([src, args]) => { const pet = (await import('/k/js/components/mooli.js')).getMooli(); return (new Function('pet', 'args', src))(pet, args); }, [fn, args]);
const where = page => page.evaluate(() => {
  const c = document.querySelector('body > canvas'), w = c.width, h = c.height, d = c.getContext('2d').getImageData(0,0,w,h).data;
  let sx=0, sy=0, n=0; for (let y=0;y<h;y+=2) for (let x=0;x<w;x+=2) { const i=(y*w+x)*4; if (d[i+3]>200 && d[i+1]>d[i]+40 && d[i+2]>d[i]+30) { sx+=x; sy+=y; n++; } }
  return n ? { x:sx/n, y:sy/n } : null;
});
const utterances = async page => {
  const log = await page.evaluate(() => window.__log);
  const out = [];
  for (const [t, s] of log) { if (s === 'z' || s.length < 2 || /^(POW|BONK|THMP|ZAP)/.test(s)) continue;
    const last = out[out.length-1];
    if (last && (s.startsWith(last.text.slice(0,3)) || last.text.startsWith(s.slice(0,3))) && t - last.t < 5) { if (s.length > last.text.length) last.text = s; }
    else out.push({ t, text: s }); }
  return out.map(x => x.text);
};
const pearson = (a, b) => { const n=a.length, ma=a.reduce((s,v)=>s+v,0)/n, mb=b.reduce((s,v)=>s+v,0)/n; let x=0,y=0,z=0; for(let i=0;i<n;i++){x+=(a[i]-ma)*(b[i]-mb);y+=(a[i]-ma)**2;z+=(b[i]-mb)**2;} return x/Math.sqrt(y*z||1); };
const runs = seq => { const o=[]; for (const m of seq) if (o[o.length-1]!==m) o.push(m); return o; };

async function idle() {
  const page = await open(); const modes=[]; const pts=[]; let m;
  const t0=Date.now(); while (Date.now()-t0<140000) { m=await mood(page); if (m) modes.push(m.mode); const q=await where(page); if(q) pts.push(q); await page.waitForTimeout(250); }
  let d=0; for (let i=1;i<pts.length;i++) d+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
  return { name:'idle 140s (leave it alone)', pathPx:Math.round(d), timeline:runs(modes).join(' > '), said:await utterances(page), end:m };
}
async function track() {
  const page = await open(); await page.waitForTimeout(4000); const py=[], my=[]; let dist=0, prev=null; const gazes={};
  const t0=Date.now(); while (Date.now()-t0<40000) {
    const e=(Date.now()-t0)/1000, y=400+250*Math.sin(e*2*Math.PI/9), x=720+60*Math.sin(e*1.3);
    await page.mouse.move(x,y); const q=await where(page); const m=await mood(page); gazes[m.gaze]=(gazes[m.gaze]||0)+1;
    if (q) { py.push(y); my.push(q.y); if (prev) dist+=Math.abs(q.y-prev.y); prev=q; }
    await page.waitForTimeout(120);
  }
  return { name:'pointer strolling 40s', corrPointerY:+pearson(py,my).toFixed(2), verticalTravelPx:Math.round(dist), gazes, said:await utterances(page) };
}
async function settle() {   // the pointer stops somewhere else: it should come, eventually
  const page = await open(); await page.waitForTimeout(3000); const a=await where(page);
  const t0=Date.now(); let arrived=null;
  while (Date.now()-t0<9000) { await page.mouse.move(700+Math.sin(Date.now()/200)*6, 700); const q=await where(page); if (!arrived && q && Math.abs(q.y-700)<90) arrived=(Date.now()-t0)/1000; await page.waitForTimeout(150); }
  return { name:'pointer settles low on page', startY:Math.round(a.y), reachedPointerHeightAfterS:arrived };
}
async function sleep() {
  const page = await open(); await page.mouse.move(1200,100); await page.waitForTimeout(3000);
  await petDo(page, 'pet.sleep()'); await page.waitForTimeout(3000); await page.evaluate(()=>{window.__log.length=0});
  await page.mouse.move(1203,102); await page.waitForTimeout(1000); const tiny=await mood(page);
  for (let i=0;i<4;i++){ await page.mouse.move(i%2?1200:900,100+i*10,{steps:8}); await page.waitForTimeout(80);} const sweep=await mood(page);
  await page.waitForTimeout(5000); const settled=await mood(page);
  const box=await where(page); await page.mouse.move(box.x+40,box.y,{steps:6}); await page.mouse.move(box.x+30,box.y+10,{steps:6}); await page.waitForTimeout(500); const near=await mood(page);
  return { name:'sleep depth', afterTinyMove:{asleep:tiny.asleep,rouse:tiny.rouse}, afterFarSweeps:{asleep:sweep.asleep,rouse:sweep.rouse}, after5sMore:{asleep:settled.asleep,rouse:settled.rouse}, pointerCloseBy:{asleep:near.asleep}, said:await utterances(page) };
}
async function article() {
  const page = await open('/articles/the-page-that-gestures-back'); await page.waitForTimeout(3500); const modes=[]; const gazes={}; const log=[];
  const H = await page.evaluate(()=>document.documentElement.scrollHeight);
  const steps = 16, step = (H-800)/steps;
  for (let i=1;i<=steps;i++) {
    await page.evaluate(d=>window.scrollBy(0,d), step);
    for (let k=0;k<7;k++){ await page.waitForTimeout(500); const m=await mood(page); modes.push(m.mode); gazes[m.gaze]=(gazes[m.gaze]||0)+1; }
    if (i===5) { await page.evaluate(()=>window.scrollBy(0,-500)); await page.waitForTimeout(1000); log.push('reread: '+(await mood(page)).mode); await page.evaluate(()=>window.scrollBy(0,500)); }
  }
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight)); await page.waitForTimeout(1500); await page.screenshot({path:'article-end.png'});
  return { name:'reading an article to the end', docH:H, timeline:runs(modes).join(' > '), gazes, log, said:await utterances(page) };
}
async function memory() {
  const ctx = await browser.newContext({ viewport:{width:1280,height:800} });
  let page = await open('/k/', { ctx }); await page.waitForTimeout(2500); const first=await utterances(page);
  // throw it about
  let q=await where(page); await page.mouse.move(q.x,q.y); await page.waitForTimeout(350); await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.move(600,300,{steps:3}); await page.mouse.up();
  await page.waitForTimeout(2200); const thrown=await mood(page);
  // feed it twice
  for (const [x,y] of [[60,500],[70,300]]) { await page.mouse.click(x,y); await page.waitForTimeout(5200); }
  const fed=await mood(page);
  await page.close(); // pagehide saves
  await new Promise(r=>setTimeout(r,200));
  page = await open('/k/', { ctx }); await page.waitForTimeout(2500); const reload={said:await utterances(page), m:await mood(page)};
  const saved=await page.evaluate(()=>localStorage.getItem('mooli'));
  await page.evaluate(()=>{const o=JSON.parse(localStorage.getItem('mooli')); o.lastSeen=Date.now()-3600*1000*3; o.trust=.7; localStorage.setItem('mooli',JSON.stringify(o)); window.addEventListener('pagehide',e=>e.stopImmediatePropagation(),true);});
  // stop the page saving over our edit on the way out: the creature's own listener is on window, so swap storage last
  await page.close({runBeforeUnload:false});
  let p2 = await ctx.newPage(); await p2.goto('about:blank');
  await p2.close();
  return { name:'memory', firstVisitSaid:first, afterThrow:{trust:thrown.trust,valence:thrown.valence}, afterTwoRadishes:{trust:fed.trust,valence:fed.valence,full:fed.full}, reload, saved };
}
async function greetings() {
  const out = {};
  for (const [label, o] of [['3 hours later, trusted', { visits:3, lastSeen:Date.now()-3*3600e3, trust:.7, fed:4, full:.1 }], ['a fortnight later', { visits:9, lastSeen:Date.now()-14*86400e3, trust:.5, fed:4, full:.5 }]]) {
    const ctx = await browser.newContext({ viewport:{width:1280,height:800} });
    await ctx.addInitScript(o => { if (!sessionStorage.seeded) { localStorage.setItem('mooli', JSON.stringify(o)); sessionStorage.seeded = '1'; } }, o);
    const page = await open('/k/', { ctx }); await page.waitForTimeout(3200);
    out[label] = { said: await utterances(page), m: await mood(page) };
  }
  return { name:'greetings by memory', ...out };
}
async function regress() {
  const page = await open(); await page.waitForTimeout(2500); const r={};
  const seen=[]; const watch=async ms=>{const t=Date.now(); while(Date.now()-t<ms){seen.push((await mood(page)).mode); await page.waitForTimeout(100);}};
  // link hover with a gesture, then look back at you
  const link=page.locator('a[data-gesture="tpose"]'); await link.hover(); await watch(1600); r.tposeHover=runs(seen.splice(0)).join('>');
  await page.mouse.move(1200,700); await watch(800); seen.length=0;
  // quick pass over a whole list: it shouldn't charge up and down
  const list=await page.locator('.gp-group a').all(); const y0=(await where(page)).y; let moved=0, prev=y0;
  for (const a of list.slice(0,8)) { await a.hover(); await page.waitForTimeout(40); const q=await where(page); moved+=Math.abs(q.y-prev); prev=q.y; }
  r.quickPassTravelPx=Math.round(moved);
  await page.mouse.move(1200,700); await watch(600); seen.length=0;
  // selection
  await page.evaluate(()=>{const w=document.createTreeWalker(document.querySelector('.gp'),NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const i=n.data.indexOf('digital humans');if(i>=0){const g=document.createRange();g.setStart(n,i);g.setEnd(n,i+14);getSelection().removeAllRanges();getSelection().addRange(g);return;}}});
  await watch(2000); r.selection=runs(seen.splice(0)).join('>'); await page.evaluate(()=>getSelection().removeAllRanges());
  await page.mouse.move(1200,700); await watch(800); seen.length=0;
  // pet
  let q=await where(page); await page.mouse.move(q.x-4,q.y,{steps:4}); for(let i=0;i<14;i++){await page.mouse.move(q.x-2+i%3,q.y+i%2); await page.waitForTimeout(100);} await watch(600); r.pet=runs(seen.splice(0)).join('>');
  await page.mouse.move(1200,700); await watch(600); seen.length=0;
  // feed
  await page.mouse.click(90,620); await watch(5500); r.meal=runs(seen.splice(0)).join('>');
  // hold too long
  q=await where(page); await page.mouse.move(q.x,q.y,{steps:3}); await page.waitForTimeout(300); await page.mouse.down(); await watch(1600); await page.mouse.up(); await watch(1500); r.heldTooLong=runs(seen.splice(0)).join('>');
  await page.mouse.move(1200,700); await page.waitForTimeout(5000); seen.length=0;
  // carrot
  await petDo(page,'pet.germ(500,300+scrollY,540,280+scrollY)'); await watch(4500); r.germ=runs(seen.splice(0)).join('>');
  // dblclick flip
  q=await where(page); await page.mouse.move(q.x,q.y,{steps:3}); await page.waitForTimeout(300); await page.mouse.dblclick(q.x,q.y); await watch(900); r.flip=runs(seen.splice(0)).join('>');
  r.said=await utterances(page);
  return { name:'regressions, home', ...r };
}
async function others() {
  const out={};
  for (const pet of ['pup','cat']) { const page=await open(`/k/?pet=${pet}`); const s=[]; for(let i=0;i<100;i++){ await page.mouse.move(600+200*Math.sin(i/6),300+100*Math.cos(i/4)); await page.waitForTimeout(200); s.push((await mood(page)).mode);} out[pet]=runs(s).join('>'); }
  const phone=await open('/k/',{viewport:{width:390,height:844}}); await phone.waitForTimeout(6000); out.phone={m:await mood(phone), at:await where(phone)}; await phone.screenshot({path:'phone.png'});
  const still=await open('/k/',{reduced:true}); await still.waitForTimeout(1500); out.reducedMotion={said:await utterances(still), drawn:!!(await where(still))};
  const none=await open('/k/?pet=none'); await none.waitForTimeout(4000); out.noPersonality=(await mood(none)).mode;
  const drop=await open('/p2pdrop'); await drop.waitForTimeout(2500);
  await petDo(drop,`const r=()=>({left:100,top:300,right:200,bottom:400,width:100,height:100}),q=()=>({left:900,top:300,right:1000,bottom:400,width:100,height:100}); pet.pack(); pet.courier({from:r,to:q,mine:'from',state:()=>'go',pace:()=>.5,onDrop:()=>{window.__drops=(window.__drops||0)+1}});`);
  const s=[]; for(let i=0;i<40;i++){await drop.waitForTimeout(200); s.push((await mood(drop)).mode);} out.courier={modes:runs(s).join('>'),drops:await drop.evaluate(()=>window.__drops||0)};
  await petDo(drop,'pet.courier(null)');
  return { name:'personalities, phone, reduced motion, courier', ...out };
}
const which = process.argv.slice(2);
const all = { idle, track, settle, sleep, article, memory, greetings, regress, others };
const results = await Promise.all((which.length ? which : Object.keys(all)).map(k => all[k]().catch(e => ({ name:k, FAILED:e.message }))));
console.log(JSON.stringify(results, null, 1));
console.log('PAGE ERRORS:', JSON.stringify([...new Set(errors)]));
await browser.close(); srv.close();
