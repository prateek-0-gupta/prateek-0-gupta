// A very small figure that gestures while you read. A few strokes and three
// dots in an SVG, driven by springs. Nothing on the page says so, but it
// behaves the way Cassell's embodied agents do:
//
//   • the four gesture types: beats on stressed words, deictics at the thing
//     you are reading, iconics that draw it, metaphorics that shape the idea
//   • every gesture has phases: a slow preparation, a fast stroke that lands
//     just as you reach the word, a hold, then an unhurried retraction
//   • gaze leads the hand, and the body follows the head
//   • it turns to what it talks about, and back to you when it is done
//   • posture shifts at topic boundaries, nods as backchannel when you pause
//   • between gestures the hands wait in gesture space before dropping
//   • it blinks, breathes, shifts its weight, glances about, gets bored,
//     and eventually falls asleep if you leave it alone
//
// No dependencies and nothing site-specific:
//   const fig = createGestureFigure(svgEl);   hand it an <svg>
//   fig.point(el, gesture?, data?)            attend to an element
//   fig.release(el)                           let go of it
//   fig.beat()                                one beat, now
//   fig.nod()                                 mm-hm
//   fig.shift()                               shift weight (new topic)
//   fig.wave()  fig.bye(el)  fig.do(name, s)  greetings and party tricks
//   fig.look(x, y)  fig.scroll(dy)            where you are, how fast you read
//   fig.sleep()  fig.wake()  fig.destroy()
// and bindPage(fig, root?, opts?) wires all of that to a normal page.
//
// Angles are in screen space (y down, radians from +x). An arm is a shoulder
// angle a1 and an elbow bend a2 relative to it, so the hand is
//   shoulder + UPPER·dir(a1) + FORE·dir(a1 + a2)
// The screen-right arm lives around 0 and the screen-left arm around π, so
// neither ever has to wrap through ±π.

const NS = 'http://www.w3.org/2000/svg';
const PI = Math.PI;

// skeleton, in viewBox units; the box is VB_W × VB_H, the figure faces you
export const VB_W = 60, VB_H = 120;
const HIP = { x: 30, y: 82 };
const TORSO = 30, SHOULDER_DROP = 4, HEAD_GAP = 6, HEAD_R = 3.4;
const UPPER = 15, FORE = 14, HAND_R = 1.25;
const FEET = [{ x: 23, y: 116 }, { x: 37, y: 116 }];

// rest: arms hang a little away from the body, elbows soft, weight centred
// hs is the head's vertical squash, 1 is round; blinks squeeze it
const REST = { lean: 0, bob: 0, hipx: 0, hx: 0, hy: 0, hs: 1, ra1: 1.12, ra2: 0.22, la1: PI - 1.12, la2: -0.22 };
const REST_SHOULDER_Y = HIP.y - TORSO + SHOULDER_DROP;
const KEYS = Object.keys(REST);
const ARM_KEYS = ['ra1', 'ra2', 'la1', 'la2'];

// how stiffly each channel follows its target, as a multiple of the gesture's
// k. The head is quickest (gaze leads), the torso lags (body follows), the hips
// are slowest of all, and a blink is a snap.
const STIFF = { lean: 0.55, bob: 1, hipx: 0.3, hx: 1.7, hy: 1.7, hs: 12, ra1: 1, ra2: 1, la1: 1, la2: 1 };

// the open-palm "presenting" pose, elbow at the side and forearm out: where
// hands wait between beats, as speakers' do
const PRESENT_R = { ra1: 1.25, ra2: -1.55 };
const PRESENT_L = { la1: PI - 1.25, la2: 1.55 };

const PREP = 0.17;   // seconds of preparation before the stroke lands

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// Named gestures. Each takes (t, ctx) and returns the pose targets it cares
// about plus k, the spring stiffness (high is snappy, low is languid). ctx.theta
// is the angle from the shoulder to the attended element, ctx.side which side
// of the figure it is on (1 right, -1 left), ctx.n an index when there is one.
const GESTURES = {
    // deictic: a straight arm at the thing, head turned to it
    point(t, { theta, side }) {
        // the figure walks to the thing, so theta is usually shallow; the clamp
        // keeps it reading as a point while it is still on its way
        const out = { k: 150, lean: 0.04 * side };
        if (side > 0) Object.assign(out, { ra1: clamp(theta, -0.9, 0.95) - 0.04, ra2: 0.06 });
        else Object.assign(out, { la1: clamp(theta, PI - 0.95, PI + 0.9) + 0.04, la2: -0.06 });
        return out;
    },

    // deictic, for a list: each item gets its own spot in the air, left to right
    enumerate(t, { n = 0 }) {
        const slot = n % 3;
        return { k: 260, ra1: PRESENT_R.ra1 - 0.45 + 0.3 * slot, ra2: PRESENT_R.ra2 - 0.35 + 0.3 * slot, hy: 0.3, lean: 0.015 * (slot - 1) };
    },

    // iconic, for a snake game: still pointing, but the arm slithers
    snake(t, ctx) {
        const out = GESTURES.point(t, ctx);
        const s = ctx.side;
        out[s > 0 ? 'ra1' : 'la1'] += 0.14 * Math.sin(t * 5.2 - 1);
        out[s > 0 ? 'ra2' : 'la2'] = 0.5 * Math.sin(t * 5.2);
        out.k = 220;
        return out;
    },

    // metaphoric, for a film: both hands up, framing a shot, easing in and out
    frame(t) {
        const push = 0.07 * Math.sin(t * 1.8);
        return { k: 120, lean: 0, ra1: 0.9 + push, ra2: -2.3, la1: PI - 0.9 - push, la2: 2.3, hy: -0.4 };
    },

    // iconic, for a motion-capture viewer: the calibration pose every mocap take starts with
    tpose() {
        return { k: 320, lean: 0, hx: 0, hy: 0, ra1: 0, ra2: 0, la1: PI, la2: 0, bob: 0 };
    },

    // metaphoric, for a thought canvas: hand to chin, head tipped, a slow sway
    think(t) {
        return { k: 90, ra1: 0.35, ra2: -2.65, hx: 0.9, hy: 0.5, lean: -0.03 + 0.015 * Math.sin(t * 0.9) };
    },

    // metaphoric, for a chat: two hands taking turns, handing something across
    exchange(t) {
        const a = Math.max(0, Math.sin(t * 4)), b = Math.max(0, Math.sin(t * 4 + PI));
        return { k: 200, ra1: PRESENT_R.ra1 - 0.1 * a, ra2: PRESENT_R.ra2 + 0.55 * a, la1: PRESENT_L.la1 + 0.1 * b, la2: PRESENT_L.la2 - 0.55 * b };
    },

    // metaphoric, for something big: the hands measure it out
    big(t) {
        const p = 0.06 * Math.sin(t * 2.2);
        return { k: 140, ra1: 0.15 - p, ra2: -0.1, la1: PI - 0.15 + p, la2: 0.1, hy: -0.3 };
    },

    // metaphoric, for something small or precise: fingertips together, head in close
    small(t) {
        return { k: 180, ra1: 1.0, ra2: -2.55 + 0.04 * Math.sin(t * 6), la1: PI - 1.0, la2: 2.55 - 0.04 * Math.sin(t * 6), hy: 0.8, hx: 0 };
    },

    // emblem, for a digital human: it says hello back
    wave(t) {
        return { k: 200, ra1: -1.05, ra2: -0.55 + 0.5 * Math.sin(t * 9), hx: 0.6, lean: -0.02 };
    },

    // iconic, for a song: conducting two to a bar, the head going with it
    conduct(t) {
        const beat = Math.sin(t * 2 * PI * 1.4);
        return { k: 240, ra1: PRESENT_R.ra1 - 0.15, ra2: PRESENT_R.ra2 + 0.35 * beat, la1: PRESENT_L.la1 + 0.15, la2: PRESENT_L.la2 - 0.35 * beat, hy: 0.5 * beat };
    },

    // emblem: who knows. shoulders up, palms out, head down a touch
    shrug(t) {
        const up = Math.min(1, t * 4);
        return { k: 160, ra1: 0.55, ra2: -2.0, la1: PI - 0.55, la2: 2.0, bob: -1.2 * up, hy: 0.6, hx: 0.3 };
    },

    // emblem: applause
    clap(t) {
        const c = Math.max(0, Math.sin(t * 2 * PI * 3.2));
        return { k: 300, ra1: 0.95, ra2: -2.45 + 0.35 * c, la1: PI - 0.95, la2: 2.45 - 0.35 * c, hy: 0.2 * c };
    },

    // emblem: a small bow
    bow(t) {
        const d = Math.sin(Math.min(PI, t * 2.6));
        return { k: 110, bob: 5 * d, hy: 3.5 * d, hx: 0, ra1: 1.3, ra2: 0.1, la1: PI - 1.3, la2: -0.1, lean: 0 };
    },

    // ── things it does when nobody is looking ──
    scratch(t) {
        return { k: 150, ra1: -1.25, ra2: -2.35 + 0.12 * Math.sin(t * 14), hx: 0.8, hy: 0.2, lean: -0.03 };
    },
    watch(t) {
        return { k: 150, la1: PI - 0.75, la2: 1.9, ra1: 1.0, ra2: -2.55, hy: 1.2, hx: -0.5, lean: 0.02 };
    },
    stretch(t) {
        const up = Math.sin(Math.min(PI, t * 2.2));
        return { k: 90, ra1: -1.45 + 0.1 * (1 - up), ra2: 0, la1: PI + 1.45 - 0.1 * (1 - up), la2: 0, bob: -2.2 * up, hy: -0.6 * up };
    },
    // the pose it takes when the pointer lands right on it: a little startled, pleased
    peek(t) {
        return { k: 220, ra1: 0.6, ra2: -2.4, la1: PI - 0.6, la2: 2.4, hy: -0.9, bob: -0.8, lean: 0.02 * Math.sin(t * 2.5) };
    },
    // and when the pointer is merely nearby: one hand half-raised, a tentative hi
    greet() {
        return { k: 120, ra1: 0.95, ra2: -1.15 };
    },
    sleep(t) {
        return { k: 40, hy: 2.3, hx: 0.7, lean: 0.045, ra2: 0.05, la2: -0.05, bob: 1.2 * Math.sin(t * 0.6) };
    },
};

export function createGestureFigure(svg, { reducedMotion = false, interactive = true, sleepAfter = 75 } = {}) {
    // ── parts ──
    const make = (tag, attrs) => {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        svg.appendChild(el);
        return el;
    };
    svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
    const line = { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' };
    const legs = make('path', line);
    const torso = make('path', line);
    const armR = make('path', line);
    const armL = make('path', line);
    const head = make('ellipse', { rx: HEAD_R, ry: HEAD_R, fill: 'currentColor' });
    const handR = make('circle', { r: HAND_R, fill: 'currentColor' });
    const handL = make('circle', { r: HAND_R, fill: 'currentColor' });

    // ── state ──
    const pos = { ...REST }, vel = Object.fromEntries(KEYS.map(k => [k, 0]));
    const nowS = () => performance.now() / 1000;
    let attended = null;          // { el, gesture, data, since, side, struck, lastOut }
    let released = null;          // { out, at }: post-stroke hold, then retraction
    let doing = null;             // { name, since, until, data }: something it does on its own
    let presentUntil = 0;         // hands stay up in gesture space this long after a beat
    let waveUntil = 0;
    let gaze = null;              // { x, y } in client px, from the pointer
    let wander = null, wanderUntil = 0;   // where it glances when its mind drifts
    let hovered = false, near = false;
    let asleep = false, lastActivity = nowS();
    let nextIdleAt = nowS() + 4, nextBlinkAt = nowS() + 1.5, blinkUntil = 0;
    let weight = 0;               // which foot it stands on: -1, 0, 1
    let lastBeat = -1, beats = 0;
    let wind = 0;                 // the page rushing past as you scroll
    let raf = 0, last = 0, t = 0;
    // the whole figure slides along the margin to stand level with what it
    // attends to; px, on its own slower spring so it travels rather than jumps
    let ty = 0, tyVel = 0, tyTarget = 0;

    // shoulder, in client px, so angles to elements on the page can be measured
    function shoulderOnScreen() {
        const r = svg.getBoundingClientRect();
        const s = r.width / VB_W;
        const sh = joints(pos).shoulder;
        return { x: r.left + sh.x * s, y: r.top + sh.y * s };
    }

    function joints(p) {
        const hip = { x: HIP.x + p.hipx, y: HIP.y };
        const neck = { x: hip.x + Math.sin(p.lean) * TORSO, y: hip.y - Math.cos(p.lean) * TORSO + p.bob };
        const f = SHOULDER_DROP / TORSO;
        const shoulder = { x: neck.x + (hip.x - neck.x) * f, y: neck.y + (hip.y - neck.y) * f };
        const up = HEAD_GAP + HEAD_R;
        const headC = { x: neck.x + Math.sin(p.lean) * up + p.hx, y: neck.y - Math.cos(p.lean) * up + p.hy };
        const arm = (a1, a2) => {
            const e = { x: shoulder.x + UPPER * Math.cos(a1 + p.lean), y: shoulder.y + UPPER * Math.sin(a1 + p.lean) };
            const h = { x: e.x + FORE * Math.cos(a1 + a2 + p.lean), y: e.y + FORE * Math.sin(a1 + a2 + p.lean) };
            return [e, h];
        };
        return { hip, neck, shoulder, headC, r: arm(p.ra1, p.ra2), l: arm(p.la1, p.la2) };
    }

    function draw() {
        const j = joints(pos);
        const f = n => n.toFixed(2);
        legs.setAttribute('d', `M${FEET[0].x} ${FEET[0].y}L${f(j.hip.x)} ${f(j.hip.y)}L${FEET[1].x} ${FEET[1].y}`);
        torso.setAttribute('d', `M${f(j.hip.x)} ${f(j.hip.y)}L${f(j.neck.x)} ${f(j.neck.y)}`);
        const [re, rh] = j.r, [le, lh] = j.l;
        armR.setAttribute('d', `M${f(j.shoulder.x)} ${f(j.shoulder.y)}L${f(re.x)} ${f(re.y)}L${f(rh.x)} ${f(rh.y)}`);
        armL.setAttribute('d', `M${f(j.shoulder.x)} ${f(j.shoulder.y)}L${f(le.x)} ${f(le.y)}L${f(lh.x)} ${f(lh.y)}`);
        head.setAttribute('cx', f(j.headC.x)); head.setAttribute('cy', f(j.headC.y));
        head.setAttribute('ry', f(HEAD_R * clamp(pos.hs, 0.08, 1.15)));
        handR.setAttribute('cx', f(rh.x)); handR.setAttribute('cy', f(rh.y));
        handL.setAttribute('cx', f(lh.x)); handL.setAttribute('cy', f(lh.y));
    }

    // the stroke: a fast push toward the pose the preparation has been
    // approaching, plus a small nod, so the gesture lands rather than arrives
    function strike(out) {
        for (const key of ARM_KEYS) if (key in out) vel[key] += (out[key] - pos[key]) * 7;
        vel.hy += 5;
    }

    const act = (name, dur, data = {}) => ({ name, since: nowS(), until: nowS() + dur, data });

    function shiftWeight() {
        const options = [-1, 0, 1].filter(w => w !== weight);
        weight = options[Math.floor(Math.random() * options.length)];
        vel.bob -= 6;   // the little rise as the weight moves
    }

    function fallAsleep() {
        if (asleep) return;
        asleep = true; attended = null; doing = null; near = false;
    }
    function wake() {
        if (!asleep) return;
        asleep = false;
        vel.hy -= 16; vel.bob -= 22;   // the jolt
        doing = act('stretch', 1.3);
        nextBlinkAt = nowS() + 0.15;
        nextIdleAt = nowS() + 6;
    }

    // ── what the body is trying to do right now ──
    function targets(now) {
        // idle: breathing, a slow weight shift, arms never quite still
        const tg = { ...REST, k: 70 };
        tg.bob = 0.55 * Math.sin(t * 1.55);
        tg.lean = 0.018 * Math.sin(t * 0.37);
        tg.ra1 += 0.025 * Math.sin(t * 0.9);
        tg.la1 -= 0.025 * Math.sin(t * 0.9 + 1.3);
        // standing on one foot or the other: hips go one way, torso leans back the other
        tg.hipx = 1.8 * weight;
        tg.lean += -0.028 * weight;

        let look = now < wanderUntil ? wander : gaze, headFree = true;
        const apply = out => { Object.assign(tg, out); if ('hx' in out || 'hy' in out) headFree = false; };

        // bored, then asleep
        if (!asleep && !attended && !hovered && now > nextIdleAt) {
            const idle = now - lastActivity, r = Math.random();
            if (idle > 1.5) {
                if (r < 0.42) { wander = { x: rnd(0, innerWidth), y: rnd(0, innerHeight) }; wanderUntil = now + rnd(0.9, 2.2); }
                else if (r < 0.68) shiftWeight();
                else if (r < 0.8) doing = act('scratch', 1.7);
                else if (r < 0.9) doing = act('watch', 2.0);
                else if (idle > 25) doing = act('stretch', 1.5);
            }
            nextIdleAt = now + rnd(3, 8);
        }
        if (!asleep && now - lastActivity > sleepAfter) fallAsleep();
        if (asleep) { apply(GESTURES.sleep(t)); look = null; }

        // hands held in gesture space between beats, then dropped
        if (now < presentUntil) Object.assign(tg, PRESENT_R, { k: 160 });

        // the pointer nearby: a tentative hello, a lean toward it
        if (near && gaze && !attended && !hovered && !asleep && !doing) {
            apply(GESTURES.greet());
            tg.lean += gaze.x < shoulderOnScreen().x ? -0.03 : 0.03;
        }

        // its own business, until the reader wants something
        if (doing && now < doing.until && !attended) apply(GESTURES[doing.name](now - doing.since, { side: 1, ...doing.data }));
        else if (doing && (now >= doing.until || attended)) doing = null;

        tyTarget = 0;
        if (attended && attended.el.isConnected) {
            const r = attended.el.getClientRects()[0] || attended.el.getBoundingClientRect();
            const target = { x: r.left - 4, y: r.top + r.height * 0.55 };

            // stand with the shoulder a little above the target, but stay on screen
            const box = svg.getBoundingClientRect();
            const s = box.width / VB_W, home = box.top - ty;
            const want = target.y - 6 * s - (home + REST_SHOULDER_Y * s);
            tyTarget = clamp(want, 12 - home, innerHeight - 12 - box.height - home);

            const sh = shoulderOnScreen();
            attended.side = target.x >= sh.x ? 1 : -1;
            const ctx = { theta: Math.atan2(target.y - sh.y, target.x - sh.x), side: attended.side, ...attended.data };
            const phase = now - attended.since;
            const out = (GESTURES[attended.gesture] || GESTURES.point)(phase, ctx);
            // preparation is slow, the stroke lands at PREP, after that it holds
            if (phase < PREP) out.k *= 0.45;
            else if (!attended.struck) { attended.struck = true; strike(out); }
            apply(out);
            attended.lastOut = out;
            look = target;      // the eyes are already there; gaze leads the hand
        } else if (attended) attended = null;

        // after letting go: a post-stroke hold, then an unhurried retraction,
        // and the gaze comes back to the reader to hand the turn over
        if (!attended && released) {
            const age = now - released.at;
            if (age < 0.22) apply(released.out);
            else if (age < 1.1) tg.k = Math.min(tg.k, 48);
            else released = null;
            if (age >= 0.22 && gaze) look = gaze;
        }

        if (hovered && !asleep) apply(GESTURES.peek(now));
        if (now < waveUntil) apply(GESTURES.wave(t));

        // scrolling: the page is a draught and the arms trail in it
        tg.ra1 -= wind * 2; tg.la1 += wind * 2;
        tg.lean += wind * 0.12;

        // the head turns a little toward whatever has its attention, unless the gesture holds it
        if (look && headFree) {
            const sh = shoulderOnScreen();
            const dx = look.x - sh.x, dy = look.y - sh.y, d = Math.hypot(dx, dy) || 1;
            const amp = near || hovered ? 1.5 : 1.1;
            tg.hx += (dx / d) * amp;
            tg.hy += (dy / d) * amp * 0.75;
        }

        // blinking, occasionally twice
        if (!asleep && now > nextBlinkAt) {
            blinkUntil = now + 0.09;
            nextBlinkAt = now + (Math.random() < 0.18 ? 0.32 : rnd(2, 6.5));
        }
        if (now < blinkUntil) tg.hs = 0.1;
        return tg;
    }

    // critically-ish damped springs, fixed substeps so slow frames don't explode
    function step(dt, tg) {
        for (const key of KEYS) {
            const k = tg.k * STIFF[key], c = 2 * Math.sqrt(k) * (key === 'hs' ? 1 : 0.68);
            const a = k * (tg[key] - pos[key]) - c * vel[key];
            vel[key] += a * dt;
            pos[key] += vel[key] * dt;
        }
    }

    function frame(ms) {
        raf = requestAnimationFrame(frame);
        const now = ms / 1000;
        let dt = last ? Math.min(now - last, 0.1) : 0;
        last = now;
        const tg = targets(now);
        while (dt > 0) {
            const h = Math.min(dt, 1 / 120);
            t += h;
            step(h, tg);
            tyVel += (38 * (tyTarget - ty) - 2 * Math.sqrt(38) * 0.95 * tyVel) * h;
            ty += tyVel * h;
            wind *= Math.exp(-h * 4);
            dt -= h;
        }
        svg.style.translate = `0 ${ty.toFixed(1)}px`;
        draw();
    }

    draw();
    if (!reducedMotion) raf = requestAnimationFrame(frame);

    const touch = () => { lastActivity = nowS(); wake(); };

    // the figure itself is something you can bother
    const own = [];
    if (interactive && !reducedMotion) {
        const on = (ev, fn) => { svg.addEventListener(ev, fn); own.push(() => svg.removeEventListener(ev, fn)); };
        svg.style.cursor = 'pointer';
        on('pointerenter', () => { hovered = true; touch(); });
        on('pointerleave', () => { hovered = false; });
        on('click', () => { touch(); waveUntil = nowS() + 1.5; });
        on('dblclick', () => { touch(); waveUntil = 0; doing = act('bow', 1.3); });
    }

    return {
        point(el, gesture = 'point', data = {}) {
            if (reducedMotion) return;
            touch();
            if (attended?.el === el && attended.gesture === gesture) return;
            attended = { el, gesture, data, since: nowS(), side: 1, struck: false };
            released = null;
        },
        release(el) {
            if (!el || attended?.el === el) {
                if (attended) released = { out: attended.lastOut || {}, at: nowS() };
                attended = null;
            }
        },
        // a beat is an impulse, not a pose: the springs supply the flick and the settle
        beat() {
            if (reducedMotion) return;
            const now = nowS();
            if (now - lastBeat < 0.16) return;   // no faster than a word
            lastBeat = now; beats++;
            touch();
            if (!attended) {
                presentUntil = now + 1.5;         // bring the hand up and keep it there for the next one
                vel.ra2 += 14;                    // forearm flicks down
                if (beats % 3 === 0) vel.la2 -= 9; // every so often the other hand joins in
            } else {
                vel[attended.side < 0 ? 'la1' : 'ra1'] += attended.side < 0 ? -4 : 4;   // mid-gesture: a smaller stroke on top of it
            }
            vel.hy += 9;                          // and a small nod
        },
        // backchannel: mm-hm, go on
        nod() {
            if (reducedMotion || asleep) return;
            vel.hy += 7; vel.hs -= 1.5;
        },
        // a new topic: stand differently
        shift() {
            if (reducedMotion) return;
            touch(); shiftWeight();
        },
        wave(duration = 1.8) {
            if (reducedMotion) return;
            touch(); waveUntil = nowS() + duration;
        },
        // point the way, then wave them off
        bye(el, duration = 1.2) {
            if (reducedMotion) return;
            this.point(el, 'point');
            setTimeout(() => { this.release(el); waveUntil = nowS() + duration; }, 320);
        },
        do(name, duration = 1.5, data = {}) {
            if (reducedMotion || !GESTURES[name]) return;
            touch(); doing = act(name, duration, data);
        },
        look(x, y) {
            if (x == null) { gaze = null; near = false; return; }
            touch();
            gaze = { x, y };
            const r = svg.getBoundingClientRect();
            near = Math.hypot(x - (r.left + r.width / 2), (y - (r.top + r.height / 2)) * 0.6) < r.width * 2.4;
        },
        // dy: px scrolled since the last call. down is positive; the arms lift in the draught
        scroll(dy) {
            if (reducedMotion) return;
            touch();
            wind = clamp(wind + dy * 0.0025, -0.3, 0.3);
        },
        sleep() { fallAsleep(); },
        wake() { touch(); },
        destroy() {
            cancelAnimationFrame(raf);
            for (const off of own) off();
            svg.style.translate = ''; svg.style.cursor = '';
            svg.replaceChildren();
        },
    };
}

// Wires a figure to an ordinary page:
//   • hovering a link (or anything with data-gesture) is pointed at, with the
//     gesture named in data-gesture; list items get an enumerate index
//   • stressed words (strong, em, mark, data-beat) get a beat when you hover
//     them or when they scroll past the reading line, the stroke landing a
//     touch before the word does
//   • headings crossing the reading line shift its weight
//   • it watches the pointer, braces when you scroll, nods when you pause,
//     points the way and waves when you leave through a link, sleeps when the
//     tab is hidden, and says hello when you arrive
// Returns a function that unbinds everything.
export function bindPage(fig, root = document, {
    gestureSelector = 'a, [data-gesture]',
    beatSelector = 'strong, b, em, mark, [data-beat]',
    topicSelector = 'h1, h2, h3, [data-topic]',
    readingLine = 0.42,     // fraction of the viewport height where a line is "being read"
    greetOnLoad = true,
} = {}) {
    const offs = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    const inRoot = el => el && (root === document || root.contains(el));

    // deictics on hover, with a gesture when the element names one
    on(root, 'pointerover', e => {
        const el = e.target.closest?.(gestureSelector);
        if (inRoot(el)) {
            const n = el.dataset.n != null ? Number(el.dataset.n) : Array.prototype.indexOf.call(el.parentNode.children, el);
            fig.point(el, el.dataset.gesture || 'point', { n });
            return;
        }
        if (inRoot(e.target.closest?.(beatSelector))) fig.beat();
    });
    on(root, 'pointerout', e => {
        const el = e.target.closest?.(gestureSelector);
        if (inRoot(el) && !el.contains(e.relatedTarget)) fig.release(el);
    });

    // leaving through a link: point the way, wave
    on(root, 'click', e => {
        const a = e.target.closest?.('a[href]');
        if (inRoot(a) && !a.target) fig.bye(a);
    });

    // the pointer, at frame rate
    let pending = null;
    on(document, 'pointermove', e => {
        if (pending) return;
        pending = requestAnimationFrame(() => { pending = null; fig.look(e.clientX, e.clientY); });
    }, { passive: true });
    on(document.documentElement, 'pointerleave', () => fig.look(null));

    // scrolling: beats as stressed words pass the reading line, a posture
    // shift as a heading does, a draught while it moves, a nod when it stops
    let prevY = scrollY, scrolledSinceStop = 0, stopTimer = 0, scrollRaf = 0;
    const words = () => root.querySelectorAll(beatSelector);
    const topics = () => root.querySelectorAll(topicSelector);
    const crossed = (el, dy, line) => {
        const r = el.getBoundingClientRect();
        if (!r.height) return false;
        const cur = r.top + r.height / 2 - line, prev = cur + dy;
        return prev * cur <= 0 && prev !== cur;
    };
    on(window, 'scroll', () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
            scrollRaf = 0;
            const dy = scrollY - prevY;
            prevY = scrollY;
            if (!dy) return;
            fig.scroll(dy);
            scrolledSinceStop += Math.abs(dy);
            // the stroke should land just before the word, so the line sits a little ahead of the reader
            const ahead = innerHeight * readingLine - Math.sign(dy) * 14;
            for (const el of words()) if (crossed(el, dy, ahead)) { fig.beat(); break; }
            for (const el of topics()) if (crossed(el, dy, innerHeight * readingLine)) { fig.shift(); break; }
            clearTimeout(stopTimer);
            stopTimer = setTimeout(() => { if (scrolledSinceStop > 90) fig.nod(); scrolledSinceStop = 0; }, 380);
        });
    }, { passive: true });

    on(document, 'visibilitychange', () => { document.hidden ? fig.sleep() : fig.wake(); });

    let hello = 0;
    if (greetOnLoad) hello = setTimeout(() => fig.wave(1.6), 600);

    return () => {
        for (const off of offs) off();
        clearTimeout(hello); clearTimeout(stopTimer);
        if (pending) cancelAnimationFrame(pending);
        if (scrollRaf) cancelAnimationFrame(scrollRaf);
    };
}