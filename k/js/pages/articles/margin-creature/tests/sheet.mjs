import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const frames = process.argv.slice(3).map(f => 'data:image/png;base64,' + readFileSync(f).toString('base64'));
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 1200, height: 600 } });
await p.setContent(`<body style="margin:0;background:#ddd;display:grid;grid-template-columns:repeat(6,1fr);gap:4px">${frames.map((f, i) => `<div style="position:relative"><img src="${f}" style="width:100%;display:block"><span style="position:absolute;left:4px;top:2px;font:12px sans-serif">${i}</span></div>`).join('')}</body>`);
await p.screenshot({ path: process.argv[2], fullPage: true }); await b.close();
