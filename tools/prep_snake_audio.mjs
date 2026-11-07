#!/usr/bin/env node
// Prepares Nagmani's sampled instruments from the "Desi Jungle" Strudel/Ableton starter kit.
//
//   node tools/prep_snake_audio.mjs "C:/path/to/ableton-starter"
//
// Reads 16-bit PCM WAVs, mixes to mono, resamples, trims long tails with a fade, and writes
// small 16-bit mono WAVs to k/js/pages/projects/snake/snake_assets/audio/. No dependencies.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'k/js/pages/projects/snake/snake_assets/audio');
const SRC = process.argv[2];
if (!SRC || !existsSync(join(SRC, 'samples'))) { console.error('usage: node tools/prep_snake_audio.mjs <ableton-starter folder>'); process.exit(1); }

// [source, output, { rate, maxSec, fadeSec, gainDb }]
const FILES = [
    ['samples/tabla/36_tabla_dead-ke.wav',     'tabla_ke.wav',        { rate: 32000 }],
    ['samples/tabla/37_tabla_na.wav',          'tabla_na.wav',        { rate: 32000 }],
    ['samples/tabla/38_tabla_tin.wav',         'tabla_tin.wav',       { rate: 32000 }],
    ['samples/tabla/39_tabla_hi-hit.wav',      'tabla_hi.wav',        { rate: 32000 }],
    ['samples/tabla/40_tabla_bayan-ghe.wav',   'tabla_ghe.wav',       { rate: 32000 }],
    ['samples/tabla/41_tabla_bayan-short.wav', 'tabla_ghe_short.wav', { rate: 32000 }],
    ['samples/tabla/extra/tabla_010.wav',      'tabla_fill_a.wav',    { rate: 32000 }],
    ['samples/tabla/extra/tabla_013.wav',      'tabla_fill_b.wav',    { rate: 32000 }],
    ['samples/tabla/extra/tabla_015.wav',      'tabla_fill_c.wav',    { rate: 32000 }],
    ['samples/sitar-strums/41_sitar_Dmin_a.wav', 'sitar_min_a.wav',  { rate: 22050, maxSec: 5.0, fadeSec: 1.2 }],
    ['samples/sitar-strums/42_sitar_Dmin_b.wav', 'sitar_min_b.wav',  { rate: 22050, maxSec: 5.0, fadeSec: 1.2 }],
    ['samples/sitar-strums/43_sitar_Dmin_c.wav', 'sitar_min_c.wav',  { rate: 22050, maxSec: 5.0, fadeSec: 1.2 }],
    ['samples/sitar-strums/37_sitar_Dmaj_b.wav', 'sitar_maj.wav',    { rate: 22050, maxSec: 4.0, fadeSec: 1.0 }],
    ['samples/gm-reference/gm_sitar_root80_G#5.wav', 'sitar_note.wav', { rate: 32000 }],
];

function readWav(buf) {
    if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') throw new Error('not a WAV');
    let p = 12, fmt = null, data = null;
    while (p < buf.length - 8) {
        const id = buf.toString('latin1', p, p + 4), len = buf.readUInt32LE(p + 4);
        if (id === 'fmt ') fmt = { tag: buf.readUInt16LE(p + 8), ch: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
        if (id === 'data') { data = buf.subarray(p + 8, p + 8 + len); break; }
        p += 8 + len + (len & 1);
    }
    if (!fmt || !data) throw new Error('missing chunks');
    if (fmt.tag !== 1 || fmt.bits !== 16) throw new Error(`unsupported format tag ${fmt.tag} / ${fmt.bits} bit`);
    const frames = data.length / (2 * fmt.ch);
    const mono = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.ch; c++) s += data.readInt16LE((i * fmt.ch + c) * 2) / 32768;
        mono[i] = s / fmt.ch;
    }
    return { rate: fmt.rate, samples: mono };
}

function resample(samples, from, to) {
    if (from === to) return samples;
    const n = Math.floor(samples.length * to / from);
    const out = new Float32Array(n);
    const k = from / to;
    // simple averaging low-pass when downsampling, then linear interpolation
    const win = Math.max(1, Math.round(k));
    for (let i = 0; i < n; i++) {
        const x = i * k;
        const x0 = Math.floor(x), t = x - x0;
        let a = 0, b = 0, na = 0, nb = 0;
        for (let w = -win + 1; w < win; w++) {
            const ia = x0 + w, ib = x0 + 1 + w;
            if (ia >= 0 && ia < samples.length) { a += samples[ia]; na++; }
            if (ib >= 0 && ib < samples.length) { b += samples[ib]; nb++; }
        }
        out[i] = (na ? a / na : 0) * (1 - t) + (nb ? b / nb : 0) * t;
    }
    return out;
}

function writeWav(path, samples, rate) {
    // normalise peaks to -1 dBFS so the set sits at one level, then 16-bit
    let peak = 0;
    for (const s of samples) peak = Math.max(peak, Math.abs(s));
    const g = peak > 0 ? 0.891 / peak : 1;
    const data = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * g * 32767))), i * 2);
    const h = Buffer.alloc(44);
    h.write('RIFF', 0, 'latin1'); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8, 'latin1');
    h.write('fmt ', 12, 'latin1'); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36, 'latin1'); h.writeUInt32LE(data.length, 40);
    writeFileSync(path, Buffer.concat([h, data]));
}

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [src, out, opt] of FILES) {
    const { rate, samples } = readWav(readFileSync(join(SRC, src)));
    let s = resample(samples, rate, opt.rate);
    // trim leading silence
    let start = 0;
    while (start < s.length && Math.abs(s[start]) < 0.002) start++;
    s = s.subarray(Math.max(0, start - Math.round(opt.rate * 0.005)));
    if (opt.maxSec && s.length > opt.maxSec * opt.rate) {
        s = s.subarray(0, Math.round(opt.maxSec * opt.rate));
        const fade = Math.round((opt.fadeSec || 0.5) * opt.rate);
        for (let i = 0; i < fade; i++) s[s.length - fade + i] *= 1 - i / fade;
    }
    writeWav(join(OUT, out), s, opt.rate);
    const kb = (s.length * 2 + 44) / 1024;
    total += kb;
    console.log(`${out.padEnd(22)} ${(s.length / opt.rate).toFixed(2)}s @${opt.rate}  ${kb.toFixed(0)} KB`);
}
console.log(`\n${FILES.length} files, ${(total / 1024).toFixed(2)} MB total -> ${OUT}`);
