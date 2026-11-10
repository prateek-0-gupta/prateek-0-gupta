// A ward of Patala, dealt fresh each time he wakes.
//
// The plan is a lattice of slots. A self-avoiding walk through it is the way down: the diya where he
// wakes, chambers held by the dead, a champion, and the ward's guardian behind a seal. Side rooms hang
// off that spine: a shrine, a landmark with a Memory, a Yaksha with his scales. Rooms are carved into
// a cell grid and joined by passages; every doorway remembers its cells so the chamber can be barred.
//
// The fourth ward is the bridge: the same plan laid in one line, with the river where the walls would be.

export const CELL = 50;                 // px per grid cell
export const T = { SOLID: 0, FLOOR: 1, HALL: 2, WATER: 3, BARS: 4 };
const SLOT = 30;                        // cells per lattice slot

function mulberry32(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function buildWard(index, seed, { memory = true } = {}) {
    const rnd = mulberry32(seed);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    const bridge = index === 3;
    const cols = bridge ? 5 : 4, rows = bridge ? 1 : 3;
    const GW = cols * SLOT, GH = rows * SLOT;
    const bg = bridge ? T.WATER : T.SOLID;
    const grid = new Uint8Array(GW * GH).fill(bg);
    const roomId = new Int8Array(GW * GH).fill(-1);
    const idx = (cx, cy) => cy * GW + cx;
    const inside = (cx, cy) => cx >= 0 && cy >= 0 && cx < GW && cy < GH;

    // ── the plan ──
    let nodes = null;
    if (bridge) {
        nodes = ['start', 'combat', 'shrine', 'elite', 'boss'].map((kind, i) => ({ sx: i, sy: 0, kind, parent: i - 1, depth: i, main: true }));
    } else {
        const sideKinds = ['shrine', memory ? 'memory' : 'reliquary', 'trader'];
        for (let attempt = 0; attempt < 400 && !nodes; attempt++) {
            const want = index === 0 ? 6 : ri(6, 7);
            const taken = new Set();
            const key = (x, y) => x + ',' + y;
            const path = [{ sx: rnd() < 0.5 ? 0 : cols - 1, sy: ri(0, rows - 1) }];
            taken.add(key(path[0].sx, path[0].sy));
            const free = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && !taken.has(key(x, y));
            const around = n => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [n.sx + dx, n.sy + dy]).filter(([x, y]) => free(x, y));
            while (path.length < want) {
                const opts = around(path[path.length - 1]);
                if (!opts.length) break;
                const [x, y] = opts[Math.floor(rnd() * opts.length)];
                path.push({ sx: x, sy: y }); taken.add(key(x, y));
            }
            if (path.length < want) continue;
            const L = path.length;
            const list = path.map((p, i) => ({ ...p, parent: i - 1, depth: i, main: true, kind: i === 0 ? 'start' : i === L - 1 ? 'boss' : i === L - 2 ? 'elite' : 'combat' }));
            // side rooms: the shrine wants the middle of the ward, the others take what is left
            let ok = true;
            for (const kind of sideKinds) {
                let hosts = list.filter((n, i) => n.main && i < L - 1 && around(n).length);
                if (kind === 'shrine') { const mid = hosts.filter(n => n.depth >= 2 && n.depth <= L - 2); if (mid.length) hosts = mid; }
                if (!hosts.length) { ok = kind === 'trader'; break; }   // a ward may lack a trader, never a shrine
                const host = hosts[Math.floor(rnd() * hosts.length)];
                const [x, y] = shuffle(around(host))[0];
                list.push({ sx: x, sy: y, parent: list.indexOf(host), depth: host.depth + 0.5, main: false, kind }); taken.add(key(x, y));
            }
            if (ok) nodes = list;
        }
        if (!nodes) throw new Error('ward: no plan found');
    }

    // pieces of her: two with the guardian, two with the champion, five among the chambers
    const combats = nodes.filter(n => n.kind === 'combat');
    nodes.forEach(n => { n.pieces = 0; });
    if (!bridge) {
        nodes.find(n => n.kind === 'boss').pieces = 2;
        nodes.find(n => n.kind === 'elite').pieces = 2;
        for (let i = 0; i < 5; i++) combats[i % combats.length].pieces++;
    }

    // ── rooms ──
    function shapeFor(kind) {
        if (bridge) {
            if (kind === 'boss') return { shape: 'round', hw: 12, hh: 12 };
            if (kind === 'start' || kind === 'shrine') return { shape: 'oct', hw: 7, hh: 7 };
            return { shape: 'rect', hw: 11, hh: 9 };
        }
        if (kind === 'boss') return { shape: 'round', hw: 12, hh: 12 };
        if (kind === 'elite') return { shape: 'oct', hw: 11, hh: 11 };
        if (kind === 'start') return { shape: 'round', hw: 6, hh: 6 };
        if (kind !== 'combat') return { shape: rnd() < 0.5 ? 'round' : 'oct', hw: 6, hh: 6 };
        const roll = rnd();
        if (roll < 0.34) return { shape: 'rect', hw: ri(9, 11), hh: ri(7, 9) };
        if (roll < 0.6) { const r = ri(9, 10); return { shape: 'round', hw: r, hh: r }; }
        if (roll < 0.82) { const r = ri(9, 11); return { shape: 'oct', hw: r, hh: r }; }
        return { shape: 'cross', hw: 11, hh: 11, arm: 5 };
    }
    function within(room, dx, dy) {
        const { shape, hw, hh } = room, ax = Math.abs(dx), ay = Math.abs(dy);
        if (shape === 'round') return (dx * dx) / ((hw + 0.3) ** 2) + (dy * dy) / ((hh + 0.3) ** 2) <= 1;
        if (shape === 'rect') return ax <= hw && ay <= hh;
        if (shape === 'oct') return ax <= hw && ay <= hh && ax + ay <= (hw + hh) * 0.72;
        return (ax <= hw && ay <= room.arm) || (ax <= room.arm && ay <= hh);   // cross
    }
    const rooms = nodes.map((n, id) => {
        const jit = bridge ? 0 : 1;
        const room = {
            id, kind: n.kind, main: n.main, depth: n.depth, pieces: n.pieces, parent: n.parent,
            cx: n.sx * SLOT + SLOT / 2 + ri(-jit, jit), cy: n.sy * SLOT + SLOT / 2 + ri(-jit, jit),
            doors: [], links: [], cells: [], ...shapeFor(n.kind),
        };
        room.x = (room.cx + 0.5) * CELL; room.y = (room.cy + 0.5) * CELL;
        room.r = Math.min(room.hw, room.hh) * CELL;
        for (let dy = -room.hh; dy <= room.hh; dy++) for (let dx = -room.hw; dx <= room.hw; dx++) {
            if (!within(room, dx, dy)) continue;
            const k = idx(room.cx + dx, room.cy + dy);
            grid[k] = T.FLOOR; roomId[k] = id;
        }
        return room;
    });

    // the Sanctum is flooded: tanks in the quarters of its larger halls
    if (index === 2) {
        for (const room of rooms) {
            if (room.kind !== 'combat' && room.kind !== 'elite' && room.kind !== 'boss') continue;
            const qx = Math.round(room.hw * 0.52), qy = Math.round(room.hh * 0.52);
            let made = 0;
            for (const [sx, sy] of shuffle([[1, 1], [-1, 1], [1, -1], [-1, -1]])) {
                if (room.kind !== 'boss' && made >= 2 && rnd() < 0.5) continue;
                const pr = 1.5 + rnd() * 0.8, px = room.cx + sx * qx, py = room.cy + sy * qy;
                for (let y = Math.floor(py - pr); y <= Math.ceil(py + pr); y++) for (let x = Math.floor(px - pr); x <= Math.ceil(px + pr); x++) {
                    if (!inside(x, y) || roomId[idx(x, y)] !== room.id) continue;
                    if (Math.hypot(x - px, y - py) <= pr) grid[idx(x, y)] = T.WATER;
                }
                made++;
            }
        }
    }

    // ── passages and doorways ──
    const HW = bridge ? 6 : 4;
    function passage(A, B) {
        const horizFirst = Math.abs(B.cx - A.cx) >= Math.abs(B.cy - A.cy);
        const path = [];
        let x = A.cx, y = A.cy;
        const run = (tx, ty, h) => { while (x !== tx || y !== ty) { x += Math.sign(tx - x); y += Math.sign(ty - y); path.push({ x, y, h }); } };
        path.push({ x, y, h: horizFirst });
        if (horizFirst) { run(B.cx, A.cy, true); run(B.cx, B.cy, false); } else { run(A.cx, B.cy, false); run(B.cx, B.cy, true); }
        const lo = -Math.floor(HW / 2), hi = Math.ceil(HW / 2) - 1;
        for (const c of path) for (let a = lo; a <= hi; a++) for (let b = lo; b <= hi; b++) {
            // a square brush keeps the corners of the L open
            const px = c.x + a, py = c.y + b;
            if (inside(px, py) && grid[idx(px, py)] === bg) grid[idx(px, py)] = T.HALL;
        }
        const outA = path.findIndex(c => roomId[idx(c.x, c.y)] !== A.id);
        let outB = path.length - 1; while (outB > 0 && roomId[idx(path[outB].x, path[outB].y)] === B.id) outB--;
        const door = (c, to) => {
            const cells = [];
            for (let o = lo - 1; o <= hi + 1; o++) {
                const px = c.h ? c.x : c.x + o, py = c.h ? c.y + o : c.y;
                if (inside(px, py) && grid[idx(px, py)] === T.HALL) cells.push(idx(px, py));
            }
            return { x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL, h: c.h, cells, to, barred: false };
        };
        A.doors.push(door(path[Math.min(outA + 1, outB)], B.id));
        B.doors.push(door(path[Math.max(outB - 1, outA)], A.id));
        A.links.push(B.id); B.links.push(A.id);
    }
    for (const room of rooms) if (room.parent >= 0) passage(rooms[room.parent], room);

    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
        const k = idx(cx, cy);
        if (roomId[k] >= 0 && grid[k] === T.FLOOR) rooms[roomId[k]].cells.push(k);
    }

    const at = (x, y) => {
        const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
        return inside(cx, cy) ? grid[idx(cx, cy)] : bg;
    };
    const walkable = (x, y) => { const t = at(x, y); return t === T.FLOOR || t === T.HALL; };
    const roomAt = (x, y) => {
        const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
        if (!inside(cx, cy)) return null;
        const id = roomId[idx(cx, cy)];
        return id >= 0 ? rooms[id] : null;
    };

    return { index, seed, bridge, bg, GW, GH, W: GW * CELL, H: GH * CELL, grid, roomId, rooms, start: rooms[0], idx, inside, at, walkable, roomAt, rnd };
}
