#!/usr/bin/env node
// Makes the black outside a painted plate transparent: flood-fills near-black pixels from the
// four corners of a PNG, so the fill stops at the plate's lighter border and never reaches a
// dark interior. Plain node, no dependencies.
//
//   node tools/knockout_corners.mjs file.png [more.png ...]
// Only the outer fifth of the width and tenth of the height can be cleared.

import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function decode(buf) {
    let pos = 8, w, h, ctype, pal, trns; const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ctype = data[9]; }
        else if (type === 'PLTE') pal = data; else if (type === 'tRNS') trns = data; else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
        pos += 12 + len;
    }
    const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype], raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(stride * h);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.subarray(y * stride, (y + 1) * stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0; let v = line[i];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            cur[i] = v & 255;
        }
        prev = cur;
    }
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        let r, g, b, a = 255;
        if (ctype === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
        else if (ctype === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3]; }
        else if (ctype === 0) r = g = b = px[i];
        else if (ctype === 4) { r = g = b = px[i * 2]; a = px[i * 2 + 1]; }
        else { const k = px[i]; r = pal[k * 3]; g = pal[k * 3 + 1]; b = pal[k * 3 + 2]; a = trns && k < trns.length ? trns[k] : 255; }
        rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
    }
    return { w, h, rgba };
}
function encode(w, h, rgba) {
    const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const file of process.argv.slice(2)) {
    const { w, h, rgba } = decode(readFileSync(file));
    const lum = i => 0.3 * rgba[i * 4] + 0.59 * rgba[i * 4 + 1] + 0.11 * rgba[i * 4 + 2];
    const LIM = 34; // what counts as the black outside
    const out = new Uint8Array(w * h); // 1 = knocked out
    const stack = [0, w - 1, (h - 1) * w, h * w - 1];
    for (const s of stack) if (lum(s) < LIM) out[s] = 1;
    while (stack.length) {
        const i = stack.pop();
        if (!out[i]) continue;
        const x = i % w, y = (i - x) / w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            // only the outer bands: the plate's dark interior is never reachable from here
            const band = nx < w * 0.2 || nx > w * 0.8 || ny < h * 0.1 || ny > h * 0.9;
            if (!band || out[j] || lum(j) >= LIM) continue;
            out[j] = 1; stack.push(j);
        }
    }
    // soften the cut by one pixel: a knocked-out pixel next to a kept one keeps a little alpha by its brightness
    let n = 0;
    for (let i = 0; i < w * h; i++) {
        if (!out[i]) continue;
        n++;
        const x = i % w, y = (i - x) / w;
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !out[ny * w + nx]) { edge = true; break; } }
        rgba[i * 4 + 3] = edge ? Math.round(Math.min(255, lum(i) / LIM * 255)) : 0;
    }
    writeFileSync(file, encode(w, h, rgba));
    console.log(`${file}: knocked out ${(100 * n / (w * h)).toFixed(1)}% of the image`);
}
