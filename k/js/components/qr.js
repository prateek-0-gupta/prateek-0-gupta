// QR code encoder, self-contained. Byte mode (UTF-8), versions 1 to 40, the
// four error-correction levels, automatic mask choice by the standard
// penalty rules. The tables and structure follow Nayuki's QR Code generator
// (MIT), cut down to what a web page needs. No dependencies.
//
//   const qr = encode('https://prat.ee/k', { ecl: 'M' });
//   qr.size            // modules per side
//   qr.get(x, y)       // true = dark
//   toSvg(qr, { scale: 8, margin: 4, fg: '#000', bg: '#fff' })
//   drawCanvas(canvas, qr, { scale: 8 })

const LEVELS = { L: { fmt: 1, row: 0 }, M: { fmt: 0, row: 1 }, Q: { fmt: 3, row: 2 }, H: { fmt: 2, row: 3 } };
const ORDER = ['L', 'M', 'Q', 'H'];

// index = version (0 unused), rows = L, M, Q, H
const ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

function rawDataModules(ver) {
    let n = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const align = Math.floor(ver / 7) + 2;
        n -= (25 * align - 10) * align - 55;
        if (ver >= 7) n -= 36;
    }
    return n;
}
function dataCodewords(ver, ecl) {
    const r = LEVELS[ecl].row;
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[r][ver] * BLOCKS[r][ver];
}
export function capacityBytes(ver, ecl) {
    return dataCodewords(ver, ecl) - (ver <= 9 ? 2 : 3);   // mode + count fields, in whole bytes
}

// ── Galois field and Reed–Solomon ──────────────────────────────────────

function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11D);    // the bit about to overflow, taken before the shift
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}
function rsGenerator(degree) {
    const g = new Uint8Array(degree);
    g[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) g[j] = gfMul(g[j], root) ^ (j + 1 < degree ? g[j + 1] : 0);
        root = gfMul(root, 2);
    }
    return g;
}
function rsRemainder(data, gen) {
    const r = new Uint8Array(gen.length);
    for (const b of data) {
        const factor = b ^ r[0];
        r.copyWithin(0, 1);
        r[r.length - 1] = 0;
        for (let i = 0; i < gen.length; i++) r[i] ^= gfMul(gen[i], factor);
    }
    return r;
}

// ── Encoding ───────────────────────────────────────────────────────────

export function encode(text, opts = {}) {
    let ecl = (opts.ecl || 'M').toUpperCase();
    if (!LEVELS[ecl]) throw new Error('error correction level must be L, M, Q or H');
    const bytes = new TextEncoder().encode(String(text));
    const minVer = Math.max(1, opts.minVersion || 1);

    // smallest version that fits
    let ver = minVer, needed = 0;
    for (;; ver++) {
        if (ver > 40) throw new Error('too much data for a QR code');
        needed = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
        if (needed <= dataCodewords(ver, ecl) * 8) break;
    }
    // use spare room for stronger error correction, unless told not to
    if (opts.boost !== false) {
        for (const l of ORDER.slice(ORDER.indexOf(ecl) + 1)) if (needed <= dataCodewords(ver, l) * 8) ecl = l;
    }

    // data bits: mode, count, bytes, terminator, padding
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    for (const b of bytes) push(b, 8);
    const cap = dataCodewords(ver, ecl) * 8;
    push(0, Math.min(4, cap - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
    const data = new Uint8Array(bits.length / 8);
    bits.forEach((b, i) => { data[i >>> 3] |= b << (7 - (i & 7)); });

    const codewords = interleave(data, ver, ecl);
    const size = ver * 4 + 17;
    const modules = new Uint8Array(size * size);     // 1 = dark
    const func = new Uint8Array(size * size);        // 1 = function pattern, not maskable
    const q = { version: ver, ecl, size, modules, func };

    drawFunctionPatterns(q);
    drawCodewords(q, codewords);

    let mask = opts.mask;
    if (mask == null) {
        let best = Infinity;
        for (let m = 0; m < 8; m++) {
            applyMask(q, m);
            drawFormatBits(q, m);
            const p = penalty(q);
            if (p < best) { best = p; mask = m; }
            applyMask(q, m);       // xor twice = undo
        }
    }
    applyMask(q, mask);
    drawFormatBits(q, mask);

    return {
        version: ver, ecl, size, mask,
        bytes: bytes.length,
        get: (x, y) => x >= 0 && y >= 0 && x < size && y < size && modules[y * size + x] === 1,
        modules,
    };
}

function interleave(data, ver, ecl) {
    const r = LEVELS[ecl].row;
    const numBlocks = BLOCKS[r][ver], eccLen = ECC_PER_BLOCK[r][ver];
    const rawCodewords = Math.floor(rawDataModules(ver) / 8);
    const numShort = numBlocks - rawCodewords % numBlocks;
    const shortLen = Math.floor(rawCodewords / numBlocks);
    const gen = rsGenerator(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
        const datLen = shortLen - eccLen + (i < numShort ? 0 : 1);
        const dat = data.slice(k, k + datLen);
        k += datLen;
        const ecc = rsRemainder(dat, gen);
        const block = new Uint8Array(shortLen + 1);
        block.set(dat, 0);
        block.set(ecc, shortLen + 1 - eccLen);
        blocks.push(block);
    }
    const out = new Uint8Array(rawCodewords);
    let n = 0;
    for (let i = 0; i < shortLen + 1; i++) {
        for (let j = 0; j < numBlocks; j++) {
            if (i !== shortLen - eccLen || j >= numShort) out[n++] = blocks[j][i];
        }
    }
    return out;
}

// ── Matrix ─────────────────────────────────────────────────────────────

function setFunc(q, x, y, dark) {
    q.modules[y * q.size + x] = dark ? 1 : 0;
    q.func[y * q.size + x] = 1;
}

function drawFunctionPatterns(q) {
    const { size, version } = q;
    for (let i = 0; i < size; i++) { setFunc(q, 6, i, i % 2 === 0); setFunc(q, i, 6, i % 2 === 0); }
    drawFinder(q, 3, 3); drawFinder(q, size - 4, 3); drawFinder(q, 3, size - 4);
    const pos = alignmentPositions(version);
    const n = pos.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        drawAlignment(q, pos[i], pos[j]);
    }
    drawFormatBits(q, 0);
    drawVersion(q);
}
function drawFinder(q, cx, cy) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < q.size && y < q.size) setFunc(q, x, y, d !== 2 && d !== 4);
    }
}
function drawAlignment(q, cx, cy) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        setFunc(q, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
}
function alignmentPositions(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const size = ver * 4 + 17;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const out = [6];
    for (let p = size - 7; out.length < n; p -= step) out.splice(1, 0, p);
    return out;
}
function drawFormatBits(q, mask) {
    const data = LEVELS[q.ecl].fmt << 3 | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (data << 10 | rem) ^ 0x5412;
    const bit = i => ((bits >>> i) & 1) === 1;
    const s = q.size;
    for (let i = 0; i <= 5; i++) setFunc(q, 8, i, bit(i));
    setFunc(q, 8, 7, bit(6)); setFunc(q, 8, 8, bit(7)); setFunc(q, 7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFunc(q, 14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFunc(q, s - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFunc(q, 8, s - 15 + i, bit(i));
    setFunc(q, 8, s - 8, true);
}
function drawVersion(q) {
    if (q.version < 7) return;
    let rem = q.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = q.version << 12 | rem;
    for (let i = 0; i < 18; i++) {
        const b = ((bits >>> i) & 1) === 1;
        const a = q.size - 11 + i % 3, c = Math.floor(i / 3);
        setFunc(q, a, c, b);
        setFunc(q, c, a, b);
    }
}
function drawCodewords(q, data) {
    const { size, modules, func } = q;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const upward = ((right + 1) & 2) === 0;
                const y = upward ? size - 1 - vert : vert;
                const k = y * size + x;
                if (!func[k] && i < data.length * 8) {
                    modules[k] = (data[i >>> 3] >>> (7 - (i & 7))) & 1;
                    i++;
                }
            }
        }
    }
}
const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0,
];
function applyMask(q, m) {
    const { size, modules, func } = q, f = MASKS[m];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const k = y * size + x;
        if (!func[k] && f(x, y)) modules[k] ^= 1;
    }
}

// ── Penalty score, the four standard rules ─────────────────────────────

function penalty(q) {
    const { size, modules } = q;
    const at = (x, y) => modules[y * size + x] === 1;
    let result = 0;
    const hist = new Array(7);
    const addRun = run => { if (hist[0] === 0) run += size; hist.copyWithin(1, 0, 6); hist[0] = run; };
    const countPatterns = () => {
        const n = hist[1];
        const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
        return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0) + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
    };
    const terminate = (color, run) => { if (color) { addRun(run); run = 0; } addRun(run + size); return countPatterns(); };

    for (let y = 0; y < size; y++) {
        let color = false, run = 0; hist.fill(0);
        for (let x = 0; x < size; x++) {
            if (at(x, y) === color) { run++; if (run === 5) result += 3; else if (run > 5) result++; }
            else { addRun(run); if (!color) result += countPatterns() * 40; color = at(x, y); run = 1; }
        }
        result += terminate(color, run) * 40;
    }
    for (let x = 0; x < size; x++) {
        let color = false, run = 0; hist.fill(0);
        for (let y = 0; y < size; y++) {
            if (at(x, y) === color) { run++; if (run === 5) result += 3; else if (run > 5) result++; }
            else { addRun(run); if (!color) result += countPatterns() * 40; color = at(x, y); run = 1; }
        }
        result += terminate(color, run) * 40;
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        const c = at(x, y);
        if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) result += 3;
    }
    let dark = 0;
    for (let i = 0; i < modules.length; i++) dark += modules[i];
    const total = size * size;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
}

// ── Rendering ──────────────────────────────────────────────────────────

/** SVG string. `dots: true` draws round modules. */
export function toSvg(qr, { scale = 8, margin = 4, fg = '#000000', bg = '#ffffff', dots = false } = {}) {
    const n = qr.size + margin * 2, px = n * scale;
    let path = '';
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
        if (!qr.get(x, y)) continue;
        const X = (x + margin) * scale, Y = (y + margin) * scale;
        path += dots
            ? `M${X + scale / 2} ${Y}a${scale / 2} ${scale / 2} 0 1 0 0.01 0z`
            : `M${X} ${Y}h${scale}v${scale}h-${scale}z`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" shape-rendering="crispEdges">` +
        `<rect width="${px}" height="${px}" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
}

/** Draw onto a canvas, sized to fit. Returns the canvas. */
export function drawCanvas(canvas, qr, { scale = 8, margin = 4, fg = '#000000', bg = '#ffffff', dots = false } = {}) {
    const n = qr.size + margin * 2, px = n * scale;
    const dpr = arguments[2]?.dpr ?? Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = px * dpr; canvas.height = px * dpr;
    canvas.style.width = px + 'px'; canvas.style.height = px + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = fg;
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
        if (!qr.get(x, y)) continue;
        const X = (x + margin) * scale, Y = (y + margin) * scale;
        if (dots) { ctx.beginPath(); ctx.arc(X + scale / 2, Y + scale / 2, scale / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(X, Y, scale, scale);
    }
    return canvas;
}
