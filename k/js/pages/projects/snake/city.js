// Patala, the drowned city: a fixed maze of streets traced from the centre of Manchester.
// Deansgate runs north to south, Market Street and Piccadilly cross it, the Mosley and Portland
// diagonals, Oxford Road curving away south, Whitworth Street, Great Ancoats, the Northern
// Quarter lanes, the Mancunian Way ring; the Irwell is the western barrier, the Rochdale and
// Ashton canals cut across. Everything between the streets is rubble, with precinct pockets
// carved off the roads. One way out: the bridge over the Irwell in the north west.
//
// buildCity() returns a cell grid the game uses for collision, rendering and the minimap.

export const CELL = 50;                 // px per grid cell (16 to a chunk)
export const GRID = 144;                // cells per side
export const MAP = CELL * GRID;         // 7200 px square
export const T = { SOLID: 0, ROAD: 1, ROOM: 2, WATER: 3, BRIDGE: 4, GATE: 5 };

// normalised coordinates, y down, north up
const ROADS = [
    { name: 'Deansgate',        w: 210, pts: [[0.325, 0.08], [0.315, 0.30], [0.305, 0.52], [0.295, 0.78]] },
    { name: 'Market Street',    w: 160, pts: [[0.33, 0.30], [0.45, 0.27], [0.55, 0.25]] },
    { name: 'Piccadilly',       w: 160, pts: [[0.55, 0.25], [0.63, 0.29], [0.70, 0.34]] },
    { name: 'Mosley Street',    w: 150, pts: [[0.58, 0.29], [0.50, 0.37], [0.44, 0.45]] },
    { name: 'Portland Street',  w: 150, pts: [[0.64, 0.34], [0.56, 0.44], [0.49, 0.53]] },
    { name: 'Princess Street',  w: 150, pts: [[0.46, 0.32], [0.50, 0.44], [0.55, 0.60], [0.57, 0.66]] },
    { name: 'Oxford Road',      w: 200, pts: [[0.44, 0.45], [0.50, 0.56], [0.57, 0.70], [0.59, 0.84], [0.60, 0.98]] },
    { name: 'Whitworth Street', w: 150, pts: [[0.36, 0.57], [0.50, 0.54], [0.66, 0.50]] },
    { name: 'Peter Street',     w: 120, pts: [[0.31, 0.43], [0.44, 0.45]] },
    { name: 'Quay Street',      w: 120, pts: [[0.23, 0.46], [0.31, 0.45]] },
    { name: 'Liverpool Road',   w: 120, pts: [[0.23, 0.55], [0.30, 0.52]] },
    { name: 'Great Ancoats',    w: 200, pts: [[0.60, 0.10], [0.70, 0.24], [0.78, 0.40]] },
    { name: 'Shudehill',        w: 150, pts: [[0.47, 0.24], [0.54, 0.17], [0.62, 0.06]] },
    { name: 'Corporation St',   w: 150, pts: [[0.40, 0.27], [0.43, 0.17], [0.45, 0.08]] },
    { name: 'Cheetham Hill',    w: 120, pts: [[0.45, 0.08], [0.46, 0.00]] },
    { name: 'Oldham Street',    w: 120, pts: [[0.56, 0.26], [0.62, 0.16]] },
    { name: 'Tib Street',       w: 110, pts: [[0.53, 0.25], [0.59, 0.15]] },
    { name: 'Thomas Street',    w: 110, pts: [[0.51, 0.20], [0.60, 0.22]] },
    { name: 'Mancunian Way',    w: 200, pts: [[0.22, 0.72], [0.33, 0.80], [0.48, 0.84], [0.62, 0.82], [0.74, 0.72], [0.80, 0.58]] },
    { name: 'London Road',      w: 150, pts: [[0.63, 0.29], [0.70, 0.40], [0.74, 0.50]] },
    { name: 'Victoria Bridge',  w: 150, pts: [[0.34, 0.14], [0.26, 0.13], [0.17, 0.12]] },
    { name: 'Blackfriars',      w: 120, pts: [[0.33, 0.22], [0.26, 0.22]] },
    { name: 'Bridge Street',    w: 120, pts: [[0.31, 0.35], [0.25, 0.34]] },
    { name: 'Cateaton Street',  w: 110, pts: [[0.35, 0.18], [0.40, 0.22]] },
    { name: 'Lever Street',     w: 110, pts: [[0.58, 0.28], [0.65, 0.18]] },
    { name: 'Sackville Street', w: 110, pts: [[0.57, 0.44], [0.60, 0.56]] },
    { name: 'Cross Street',     w: 120, pts: [[0.42, 0.27], [0.41, 0.40]] },
    { name: 'Cambridge Street', w: 110, pts: [[0.46, 0.60], [0.48, 0.80]] },
    { name: 'Chester Road',     w: 130, pts: [[0.295, 0.78], [0.24, 0.90]] },
    { name: 'Ducie Street',     w: 110, pts: [[0.70, 0.34], [0.76, 0.30]] },
    { name: 'Pollard Street',   w: 120, pts: [[0.78, 0.40], [0.90, 0.42]] },
    { name: 'Rochdale Road',    w: 130, pts: [[0.62, 0.06], [0.64, 0.00]] },
    { name: 'Hyde Road',        w: 120, pts: [[0.74, 0.50], [0.86, 0.60]] },
];
const WATER = [
    { name: 'Irwell',         w: 170, pts: [[0.27, 0.00], [0.25, 0.10], [0.23, 0.20], [0.22, 0.33], [0.20, 0.45], [0.19, 0.56], [0.16, 0.68], [0.12, 0.82], [0.08, 1.00]] },
    { name: 'Rochdale Canal', w: 70,  pts: [[0.72, 0.40], [0.62, 0.48], [0.52, 0.58], [0.42, 0.66], [0.30, 0.74], [0.24, 0.70]] },
    { name: 'Ashton Canal',   w: 60,  pts: [[0.72, 0.40], [0.82, 0.30], [0.95, 0.26]] },
];

export const SPAWN = { x: 0.56, y: 0.28, name: 'Piccadilly Gardens' };   // the Sunken Gardens
export const GATE  = { x: 0.17, y: 0.12, name: 'Victoria Bridge' };      // the way out, across the Irwell
// where the nine Memories wait: the city's landmarks
export const LANDMARKS = [
    { x: 0.37, y: 0.14, name: 'the Cathedral' },
    { x: 0.39, y: 0.25, name: 'the Exchange' },
    { x: 0.44, y: 0.46, name: 'St Peter’s Square' },
    { x: 0.26, y: 0.60, name: 'Castlefield' },
    { x: 0.68, y: 0.12, name: 'Ancoats' },
    { x: 0.73, y: 0.41, name: 'the Station' },
    { x: 0.55, y: 0.60, name: 'Whitworth' },
    { x: 0.59, y: 0.90, name: 'the Southern Road' },
    { x: 0.30, y: 0.81, name: 'the Ring' },
];

function mulberry32(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function buildCity(seed = 20261107) {
    const rnd = mulberry32(seed);
    const grid = new Uint8Array(GRID * GRID);            // T.*
    const roadAng = new Float32Array(GRID * GRID);       // direction of the street through a cell
    const idx = (cx, cy) => cy * GRID + cx;
    const inside = (cx, cy) => cx >= 0 && cy >= 0 && cx < GRID && cy < GRID;
    const toCell = v => Math.floor(v * MAP / CELL);

    // stamp a thick polyline
    function stamp(line, type, over) {
        const r = line.w / 2 / CELL;
        for (let i = 0; i < line.pts.length - 1; i++) {
            const [ax, ay] = line.pts[i], [bx, by] = line.pts[i + 1];
            const x0 = ax * GRID, y0 = ay * GRID, x1 = bx * GRID, y1 = by * GRID;
            const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(len * 2);
            const ang = Math.atan2(y1 - y0, x1 - x0);
            for (let s = 0; s <= steps; s++) {
                const x = x0 + (x1 - x0) * s / steps, y = y0 + (y1 - y0) * s / steps;
                for (let cy = Math.floor(y - r); cy <= Math.ceil(y + r); cy++) for (let cx = Math.floor(x - r); cx <= Math.ceil(x + r); cx++) {
                    if (!inside(cx, cy)) continue;
                    if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) > r) continue;
                    const k = idx(cx, cy);
                    grid[k] = over ? over(grid[k]) : type;
                    if (type === T.ROAD) roadAng[k] = ang;
                }
            }
        }
    }
    for (const w of WATER) stamp(w, T.WATER);
    for (const r of ROADS) stamp(r, T.ROAD, cur => cur === T.WATER ? T.BRIDGE : T.ROAD);
    // only the Victoria Bridge may cross the Irwell: every other road stops at the bank
    for (let cy = 0; cy < GRID; cy++) for (let cx = 0; cx < GRID; cx++) {
        const k = idx(cx, cy);
        if (grid[k] === T.BRIDGE) {
            const nx = cx / GRID, ny = cy / GRID;
            const onVictoria = Math.abs(ny - 0.125) < 0.03 && nx < 0.3 && nx > 0.14;
            const onCanal = ny > 0.25;   // the canals are low: every street bridges them
            if (!onVictoria && !onCanal) grid[k] = T.WATER;
        }
    }

    // carve a round pocket joined to the street by a short neck
    const rooms = [];
    function carve(cx, cy, r, type = T.ROOM) {
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
            if (!inside(x, y)) continue;
            if (Math.hypot(x - cx, y - cy) > r + 0.3) continue;
            const k = idx(x, y);
            if (grid[k] === T.SOLID) grid[k] = type;
        }
    }
    function neck(ax, ay, bx, by) {
        const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2 + 1;
        for (let i = 0; i <= n; i++) {
            const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                if (!inside(x + dx, y + dy)) continue;
                const k = idx(x + dx, y + dy);
                if (grid[k] === T.SOLID) grid[k] = T.ROOM;
            }
        }
    }
    // a pocket beside a street: find a road cell, step away from it into solid ground
    function pocketNear(nx, ny, r, maxTries = 60) {
        for (let t = 0; t < maxTries; t++) {
            const cx = toCell(nx) + Math.round((rnd() - 0.5) * 10), cy = toCell(ny) + Math.round((rnd() - 0.5) * 10);
            if (!inside(cx, cy) || grid[idx(cx, cy)] !== T.ROAD) continue;
            const a = roadAng[idx(cx, cy)] + Math.PI / 2 * (rnd() < 0.5 ? 1 : -1);
            const d = r + 3;
            const rx = Math.round(cx + Math.cos(a) * d), ry = Math.round(cy + Math.sin(a) * d);
            if (!inside(rx - r, ry - r) || !inside(rx + r, ry + r)) continue;
            // the pocket must sit in solid ground, away from water, other pockets, the plaza and the gate
            if (Math.hypot(rx - toCell(SPAWN.x), ry - toCell(SPAWN.y)) < 15 || Math.hypot(rx - toCell(GATE.x), ry - toCell(GATE.y)) < 12) continue;
            let clear = true;
            for (let y = ry - r - 1; y <= ry + r + 1 && clear; y++) for (let x = rx - r - 1; x <= rx + r + 1; x++) {
                const g = grid[idx(x, y)];
                if (g === T.WATER || g === T.ROOM) { clear = false; break; }
            }
            if (!clear) continue;
            carve(rx, ry, r);
            neck(cx, cy, rx, ry);
            return { cx: rx, cy: ry, x: (rx + 0.5) * CELL, y: (ry + 0.5) * CELL, r: r * CELL, entrance: { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL } };
        }
        return null;
    }

    // the Sunken Gardens, where he wakes: an open plaza
    const spawnC = { cx: toCell(SPAWN.x), cy: toCell(SPAWN.y) };
    carve(spawnC.cx, spawnC.cy, 7, T.ROAD);
    const spawn = { x: (spawnC.cx + 0.5) * CELL, y: (spawnC.cy + 0.5) * CELL };

    // the gate: open ground at the far end of the bridge, and the way beyond it sealed
    const gateC = { cx: toCell(GATE.x), cy: toCell(GATE.y) };
    carve(gateC.cx, gateC.cy, 5, T.GATE);
    const gate = { x: (gateC.cx + 0.5) * CELL, y: (gateC.cy + 0.5) * CELL };

    // the nine landmarks: a pocket each, for the Memories
    const landmarks = LANDMARKS.map((l, i) => {
        const room = pocketNear(l.x, l.y, 5) || { x: l.x * MAP, y: l.y * MAP, r: 250, cx: toCell(l.x), cy: toCell(l.y) };
        if (!room.entrance) carve(room.cx, room.cy, 5);
        return Object.assign(room, { name: l.name, index: i });
    });

    // precinct pockets off the streets: many candidates, then 27 of them spread for the pieces of Amrita
    const candidates = [];
    for (let t = 0; t < 6000 && candidates.length < 90; t++) {
        const r = 4 + Math.floor(rnd() * 3);
        const room = pocketNear(rnd(), rnd(), r, 1);
        if (room) { room.kind = ['courtyard', 'garden', 'ruin', 'flooded'][Math.floor(rnd() * 4)]; candidates.push(room); rooms.push(room); }
    }
    // only pockets he can actually reach from the Gardens count
    const reach = new Uint8Array(GRID * GRID);
    {
        const stack = [[spawnC.cx, spawnC.cy]];
        reach[idx(spawnC.cx, spawnC.cy)] = 1;
        const ok = v => v === T.ROAD || v === T.ROOM || v === T.BRIDGE || v === T.GATE;
        while (stack.length) {
            const [x, y] = stack.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (!inside(nx, ny)) continue;
                const k = idx(nx, ny);
                if (reach[k] || !ok(grid[k])) continue;
                reach[k] = 1; stack.push([nx, ny]);
            }
        }
    }
    const reachable = p => reach[idx(p.cx, p.cy)] === 1;
    // farthest-point sampling from the spawn so the pieces cover the whole city
    const pieces = [];
    let pool = candidates.filter(reachable);
    let last = spawn;
    while (pieces.length < 27 && pool.length) {
        let best = 0, bestD = -1;
        for (let i = 0; i < pool.length; i++) {
            let dmin = Math.hypot(pool[i].x - last.x, pool[i].y - last.y);
            for (const p of pieces) dmin = Math.min(dmin, Math.hypot(pool[i].x - p.x, pool[i].y - p.y));
            if (dmin > bestD) { bestD = dmin; best = i; }
        }
        const room = pool.splice(best, 1)[0];
        room.piece = pieces.length;
        pieces.push(room);
        last = room;
    }

    // road cells remember their street for the colonnades: major if wide
    const major = new Uint8Array(GRID * GRID);
    for (const r of ROADS) if (r.w >= 190) stamp(r, T.ROAD, cur => { return cur; }), markMajor(r);
    function markMajor(line) {
        const rr = line.w / 2 / CELL + 0.5;
        for (let i = 0; i < line.pts.length - 1; i++) {
            const [ax, ay] = line.pts[i], [bx, by] = line.pts[i + 1];
            const x0 = ax * GRID, y0 = ay * GRID, x1 = bx * GRID, y1 = by * GRID;
            const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(len * 2);
            for (let s = 0; s <= steps; s++) {
                const x = x0 + (x1 - x0) * s / steps, y = y0 + (y1 - y0) * s / steps;
                for (let cy = Math.floor(y - rr); cy <= Math.ceil(y + rr); cy++) for (let cx = Math.floor(x - rr); cx <= Math.ceil(x + rr); cx++) {
                    if (inside(cx, cy) && Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= rr) major[idx(cx, cy)] = 1;
                }
            }
        }
    }

    const at = (x, y) => {
        const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
        if (!inside(cx, cy)) return T.SOLID;
        return grid[idx(cx, cy)];
    };
    const walkable = (x, y) => { const t = at(x, y); return t === T.ROAD || t === T.ROOM || t === T.BRIDGE || t === T.GATE; };

    return { grid, roadAng, major, rooms, pieces, landmarks, spawn, gate, at, walkable, idx, inside, reach, CELL, GRID, MAP, T };
}
