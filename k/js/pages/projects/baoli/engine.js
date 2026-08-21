
import * as THREE from 'three';
import { loadStepwellAssets } from './stepwell-assets/three/stepwellAssets.js';

THREE.Cache.enabled = true;   // dedupe repeated texture fetches
const ASSET_BASE = new URL('./stepwell-assets/', import.meta.url).href;

/* ══════════════════════════════════════════════════════════════════════
   THE WELL OF NAMES
   A Chand Baori-style inverted pyramid: seven terraced tiers of zigzag
   stairs around a central void, a palace face of galleries and chambers
   on the north wall, black water at the bottom.  Three rites — flame,
   bell, names — and then the water parts.
   ══════════════════════════════════════════════════════════════════════ */

const TIERS   = 7;          // terraced tiers
const TH      = 4.2;        // height of one tier
const R0      = 28;         // half-size of the well mouth
const INSET   = 2.5;        // how far each tier steps inward (= terrace width)
const RISE    = TH / 14;    // stair step rise (14 steps per flight)
const RUN     = 0.46;       // stair step run
const APRON   = 6;          // walkable rim around the mouth
const PLAYER_H = 1.65;
const SPEED   = 4.2;
const GRAV    = -20;
const INTERACT_RANGE = 4.5;

const rAt = t => R0 - t * INSET;   // outer radius of the terrace at tier t
const yAt = t => -t * TH;          // floor height of the terrace at tier t

const TOTAL_DEPTH = TIERS * TH;
const WATER_Y     = yAt(TIERS) - 1.3;
const WATER_DROP  = 1.2;           // how far the water recedes after the rites

const SKY        = 0x3d0202;
const SKY_FLASH  = 0x8a1622;
const FOG_COL    = 0x730909;
const FOG_DEEP   = 0x2a0404;
const PINK_LIGHT = 0xff66a3;

const TOTAL_DIYAS = 7;
const TOTAL_ECHOES = 6;

const matOutline = new THREE.LineBasicMaterial({ color: 0x000000 });
function addOutline(mesh, threshold = 15) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
    const line = new THREE.LineSegments(edges, matOutline);
    mesh.add(line);
    return line;
}

/* ── Story ─────────────────────────────────────────────────────────── */

// The king's confession — unreliable, keyed to fractions of total descent.
// Read against the echoes' testimony, it does not hold together.
const NARRATIVE = [
    { frac: 0.04, text: "Seven years of drought. That much of the story is true." },
    { frac: 0.13, text: "I gave them a well. Remember that, whatever the stones tell you." },
    { frac: 0.25, text: "The priests called this ground forbidden. Priests call everything forbidden." },
    { frac: 0.40, text: "A thousand workers. I counted every wage. No one counted the workers." },
    { frac: 0.55, text: "The water came warm. The engineers had... explanations." },
    { frac: 0.72, text: "The sickness was not my doing. The sealing of the lower galleries — that was." },
    { frac: 0.88, text: "They were still singing when the masons closed the arch. I have told no one this." },
];

// The drowned. Witnesses. Each speaks a name — hearing all six is the Rite of
// Names, and together their testimony is the case against the king.
const ECHO_LINES = [
    "I am Ishvari, first of the masons. He says we dug too deep. We dug where he pointed. Remember me.",
    "I am Bhadra, the water-carrier. The spring ran warm on the first day and red by the seventh. They told us to keep pouring. Remember me.",
    "I am Kanha, the bell-maker's son. Father cast the Mother Bell to warn the city. The king hung it down here, where no one would hear it. Remember me.",
    "I am Meera. I lit the evening lamps. The night they sealed the galleries, I saw torchlight below the waterline. Remember me.",
    "I am Devan, keeper of names. He had me strike forty names from the ledger. A well that drowned no one needs no mourning. Remember me.",
    "I am the priest who warned him. He did not misread the omens. He read them perfectly. Remember me.",
];

const BELL_CLUE = "The inscription reads: “The Mother wakes. The Child answers. The Elder carries them to sleep.”";
const BELL_ORDER = ['mother', 'child', 'elder'];

/* ── Audio ─────────────────────────────────────────────────────────── */

class Audio {
    constructor(actx) {
        this.ctx = actx;
        this.out = actx.createGain();
        this.out.gain.value = 0.50;
        this.out.connect(actx.destination);
        this.running = false;
        this._srcs = [];
    }
    resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }

    _wind() {
        const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.012;
        const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 250;
        const g = this.ctx.createGain(); g.gain.value = 0.14;
        s.connect(f); f.connect(g); g.connect(this.out); s.start();
        this._srcs.push(s);
    }
    _drone() {
        for (const [freq, vol] of [[55, 0.030], [55 * 2.01, 0.014]]) {
            const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
            const g = this.ctx.createGain(); g.gain.value = vol;
            const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.06 + Math.random() * 0.05;
            const lg = this.ctx.createGain(); lg.gain.value = vol * 0.5;
            lfo.connect(lg); lg.connect(g.gain);
            o.connect(g); g.connect(this.out);
            o.start(); lfo.start();
            this._srcs.push(o, lfo);
        }
    }
    start() { this.running = true; this.resume(); this._wind(); this._drone(); }
    stop()  { this.running = false; this._srcs.forEach(s => { try { s.stop(); } catch(_){} }); this._srcs = []; }

    drip() {
        const n = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(400 + Math.random() * 800, n);
        o.frequency.exponentialRampToValueAtTime(150, n + 0.2);
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.05, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.35);
        o.connect(f); f.connect(g); g.connect(this.out);
        o.start(n); o.stop(n + 0.35);
    }
    whisper() {
        const n = this.ctx.currentTime, dur = 1.4 + Math.random() * 1.8;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
            const t = i / this.ctx.sampleRate;
            d[i] = (Math.random() * 2 - 1) * 0.02 * Math.sin(Math.PI * t / dur) * (1 + 0.25 * Math.sin(t * 180));
        }
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 1;
        const g = this.ctx.createGain(); g.gain.value = 0.08;
        s.connect(f); f.connect(g); g.connect(this.out); s.start(n); s.stop(n + dur);
    }
    stress() {
        const n = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 60 + Math.random() * 40;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.04, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.8);
        o.connect(g); g.connect(this.out); o.start(n); o.stop(n + 0.8);
    }
    dissonance() {
        const n = this.ctx.currentTime;
        for (const freq of [92, 97, 63]) {
            const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.03, n); g.gain.exponentialRampToValueAtTime(0.001, n + 1.4);
            o.connect(g); g.connect(this.out); o.start(n); o.stop(n + 1.4);
        }
    }
    lightFX() {
        const n = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, n); g.gain.exponentialRampToValueAtTime(0.001, n + 1.2);
        o.connect(g); g.connect(this.out); o.start(n); o.stop(n + 1.3);
    }
    riteFX() {
        const n = this.ctx.currentTime;
        [440, 550, 660].forEach((freq, i) => {
            const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0, n + i * 0.18);
            g.gain.linearRampToValueAtTime(0.06, n + i * 0.18 + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, n + i * 0.18 + 2.2);
            o.connect(g); g.connect(this.out); o.start(n + i * 0.18); o.stop(n + i * 0.18 + 2.3);
        });
    }
    purifyFX() {
        const n = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(220, n); o.frequency.exponentialRampToValueAtTime(880, n + 4);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0, n); g.gain.linearRampToValueAtTime(0.1, n + 2); g.gain.exponentialRampToValueAtTime(0.001, n + 5);
        o.connect(g); g.connect(this.out); o.start(n); o.stop(n + 5);
    }
    thunder(delay = 0.35) {
        const n = this.ctx.currentTime + delay, dur = 2.5;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(140, n); f.frequency.exponentialRampToValueAtTime(60, n + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.28, n); g.gain.exponentialRampToValueAtTime(0.001, n + dur);
        s.connect(f); f.connect(g); g.connect(this.out);
        s.start(n); s.stop(n + dur);
    }
    bellToll(strength = 1.0, pitch = 1.0) {
        const n = this.ctx.currentTime;
        const partials = [ [180, 0.10], [271, 0.055], [361, 0.035], [542, 0.02], [724, 0.01] ];
        for (const [freq, vol] of partials) {
            const o = this.ctx.createOscillator(); o.type = 'sine';
            o.frequency.value = freq * pitch * (1 + (Math.random() - 0.5) * 0.004);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(vol * strength, n);
            g.gain.exponentialRampToValueAtTime(0.0005, n + 5.5);
            o.connect(g); g.connect(this.out);
            o.start(n); o.stop(n + 5.5);
        }
    }
}

/* ── Reusable meshes ───────────────────────────────────────────────── */

function diyaMesh() {
    const g = new THREE.Group();
    const pts = [
        new THREE.Vector2(0, 0), new THREE.Vector2(0.15, 0),
        new THREE.Vector2(0.21, 0.02), new THREE.Vector2(0.23, 0.06),
        new THREE.Vector2(0.19, 0.10), new THREE.Vector2(0.12, 0.12),
        new THREE.Vector2(0.08, 0.115),
    ];
    g.add(new THREE.Mesh(
        new THREE.LatheGeometry(pts, 16),
        new THREE.MeshStandardMaterial({ color: 0x883322, roughness: 0.9 })
    ));
    const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.04, 5),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    wick.position.set(0.1, 0.12, 0);
    g.add(wick);
    return g;
}

function spawnPillar(scene, pos, idx, mat) {
    const g = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), mat);
    pillar.position.y = 0.9; pillar.castShadow = true; pillar.receiveShadow = true;
    addOutline(pillar); g.add(pillar);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.8), mat);
    cap.position.y = 1.85; cap.castShadow = true;
    addOutline(cap); g.add(cap);

    const d = diyaMesh(); d.position.y = 1.95; d.scale.setScalar(1.5);
    g.add(d);
    g.position.copy(pos);

    const light = new THREE.PointLight(0xffaa55, 0, 16, 2);
    light.position.set(pos.x, pos.y + 2.15, pos.z);
    scene.add(light);

    g.userData = { isDiyaPillar: true, lit: false, light, index: idx };
    scene.add(g);
    return g;
}

function figureGeometryParts() {
    const robe = new THREE.LatheGeometry([
        new THREE.Vector2(0.0, 0),
        new THREE.Vector2(0.44, 0),
        new THREE.Vector2(0.38, 0.35),
        new THREE.Vector2(0.28, 1.05),
        new THREE.Vector2(0.32, 1.3),
        new THREE.Vector2(0.17, 1.5),
        new THREE.Vector2(0.21, 1.62),
        new THREE.Vector2(0.13, 1.78),
        new THREE.Vector2(0.0, 1.84),
    ], 10);
    const hood = new THREE.SphereGeometry(0.185, 8, 6);
    return { robe, hood };
}

function figureMesh(parts, mat) {
    const g = new THREE.Group();
    const robe = new THREE.Mesh(parts.robe, mat);
    const hood = new THREE.Mesh(parts.hood, mat);
    hood.position.y = 1.72; hood.scale.set(1, 1.15, 1.05);
    g.add(robe); g.add(hood);
    return g;
}

function bellMesh(mat, scale = 1) {
    const profile = [
        new THREE.Vector2(0.0, 0),
        new THREE.Vector2(0.52, 0),
        new THREE.Vector2(0.5, 0.12),
        new THREE.Vector2(0.36, 0.5),
        new THREE.Vector2(0.3, 0.78),
        new THREE.Vector2(0.13, 0.88),
        new THREE.Vector2(0.11, 1.0),
        new THREE.Vector2(0.0, 1.02),
    ];
    const geo = new THREE.LatheGeometry(profile, 14);
    geo.translate(0, -1.05, 0);
    geo.scale(scale, scale, scale);
    const bell = new THREE.Mesh(geo, mat);
    bell.castShadow = true;
    return bell;
}

class ShiftingMonolith {
    constructor(scene, x, z, baseY, height, mat) {
        this.parts = []; this.baseY = baseY; this.seed = Math.random() * 100;
        const segments = 5 + Math.floor(Math.random() * 4);
        const segH = height / segments;
        let py = baseY;
        for (let i = 0; i < segments; i++) {
            const w = 3 + Math.random() * 12, d = 3 + Math.random() * 8;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, segH, d), mat);
            mesh.position.set(x, py + segH / 2, z);
            mesh.castShadow = true; mesh.receiveShadow = true;
            addOutline(mesh); scene.add(mesh);
            this.parts.push({
                mesh, origX: x, origZ: z,
                phaseX: Math.random() * Math.PI * 2, phaseS: Math.random() * Math.PI * 2,
                speedX: 0.15 + Math.random() * 0.25, speedS: 0.08 + Math.random() * 0.15,
                ampX: 1.0 + Math.random() * 3.0, ampS: 0.15 + Math.random() * 0.3,
            });
            py += segH;
        }
    }
    update(t, agitationMult = 1.0) {
        for (const p of this.parts) {
            const sx = p.speedX * agitationMult;
            const ss = p.speedS * agitationMult;
            p.mesh.position.x = p.origX + Math.sin(t * sx + p.phaseX + this.seed) * p.ampX * agitationMult;
            p.mesh.scale.x = 1 + Math.sin(t * ss + p.phaseS + this.seed) * p.ampS * agitationMult;
        }
    }
}

class Embers {
    constructor(scene, count = 260, material = null) {
        this.count = count;
        const pos = new Float32Array(count * 3);
        this.vel = [];
        for (let i = 0; i < count; i++) {
            pos[i*3]   = (Math.random() - 0.5) * 36;
            pos[i*3+1] = (Math.random() - 0.5) * 26;
            pos[i*3+2] = (Math.random() - 0.5) * 36;
            this.vel.push({
                x: (Math.random() - 0.5) * 0.25,
                y: 0.25 + Math.random() * 0.5,
                z: (Math.random() - 0.5) * 0.25,
            });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.points = new THREE.Points(geo, material ?? new THREE.PointsMaterial({
            color: 0xff5577, size: 0.07, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        }));
        this.points.frustumCulled = false;
        scene.add(this.points);
    }
    update(dt, center) {
        const a = this.points.geometry.attributes.position.array;
        for (let i = 0; i < this.count; i++) {
            const v = this.vel[i];
            a[i*3] += v.x * dt; a[i*3+1] += v.y * dt; a[i*3+2] += v.z * dt;
            if (Math.abs(a[i*3] - center.x) > 20 || a[i*3+1] - center.y > 14 ||
                center.y - a[i*3+1] > 16 || Math.abs(a[i*3+2] - center.z) > 20) {
                a[i*3]   = center.x + (Math.random() - 0.5) * 30;
                a[i*3+1] = center.y - 8 + Math.random() * 6;
                a[i*3+2] = center.z + (Math.random() - 0.5) * 30;
            }
        }
        this.points.geometry.attributes.position.needsUpdate = true;
    }
}

/* ══════════════════════════════════════════════════════════════════ */

export async function createGame(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.FogExp2(FOG_COL, 0.022);
    const baseSky = new THREE.Color(SKY), flashSky = new THREE.Color(SKY_FLASH);
    const baseFog = new THREE.Color(FOG_COL), deepFog = new THREE.Color(FOG_DEEP);

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.08, 500);
    camera.position.set(0.5, PLAYER_H, -(R0 + 2));
    camera.rotation.set(0, Math.PI, 0);   // facing into the well

    const listener = new THREE.AudioListener(); camera.add(listener);
    const audio = new Audio(listener.context);

    /* ── Asset pack materials ── */
    const A = await loadStepwellAssets(renderer, { base: ASSET_BASE });
    A.applyEnvironment(scene, 'sky/dikhololo_night_1k.hdr', 0.4);

    const fixChannels = (m) => {
        for (const k of ['aoMap', 'metalnessMap', 'lightMap']) if (m[k]) m[k].channel = 0;
        return m;
    };

    const matWallA = fixChannels(A.wallMaterial(4, 2));
    const matWallB = matWallA.clone(); matWallB.color.set(0xd9a0a0);
    const matWallC = matWallA.clone(); matWallC.color.set(0x5a3038);
    const wallMats = [matWallA, matWallB, matWallC];

    const matStep   = fixChannels(A.stepMaterial(3, 2));
    const matFloor  = matStep.clone(); matFloor.color.set(0x8a7a72);
    const matFrieze = fixChannels(A.friezeMaterial(2, 2));
    const matPillar = matFrieze.clone(); matPillar.color.set(0x9a6a5a);
    const matStone  = matWallA.clone(); matStone.color.set(0x6a4048);
    const matBell   = fixChannels(A.bronzeMaterial());
    const matBanner = A.bannerMaterial();
    const matWater  = A.waterMaterial({ color: 0x2a0806 });
    const matShaft  = A.godrayMaterial({ opacity: 0.14, color: 0xff8866 });
    const matGhost  = new THREE.MeshBasicMaterial({ color: PINK_LIGHT, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });

    const emberTex = new THREE.TextureLoader().load(ASSET_BASE + 'sprites/ember_64.png');
    emberTex.colorSpace = THREE.SRGBColorSpace;
    const matFlame = new THREE.MeshBasicMaterial({
        map: emberTex, color: 0xffaa66, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });

    const flameMat = A.flameMaterial({ color: 0xffc080 });
    const addFlame = (pos, scale = 0.55) => {
        const s = new THREE.Sprite(flameMat);
        s.center.set(0.5, 0.05);
        s.scale.set(scale, scale, scale);
        s.position.copy(pos);
        scene.add(s);
        return s;
    };

    /* ── Lights ── */
    const diyaLight = new THREE.PointLight(0xffaa55, 0.8, 18, 2);
    diyaLight.position.set(0.3, -0.3, -0.5); diyaLight.castShadow = true;
    camera.add(diyaLight);
    const diyaFill = new THREE.PointLight(0xffcc88, 0.15, 8, 2);
    diyaFill.position.set(-0.3, -0.2, -0.3);
    camera.add(diyaFill); scene.add(camera);

    const handFlame = new THREE.Sprite(flameMat);
    handFlame.center.set(0.5, 0.05);
    handFlame.scale.set(0.085, 0.085, 0.085);
    handFlame.position.set(0.32, -0.44, -0.6);
    camera.add(handFlame);

    const sunLight = new THREE.DirectionalLight(0xff4444, 0.1);
    sunLight.position.set(30, 60, 20); sunLight.castShadow = true;
    sunLight.shadow.camera.left = -40; sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40; sunLight.shadow.camera.bottom = -40;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight); scene.add(sunLight.target);
    const hemiLight = new THREE.HemisphereLight(0x1a0505, 0x050101, 0.22);
    scene.add(hemiLight);

    /* ── World scaffolding ── */
    const world = new THREE.Group(); scene.add(world);   // collidable
    const deco  = new THREE.Group(); scene.add(deco);    // pass-through ornament

    const figParts = figureGeometryParts();
    const _m = new THREE.Object3D();
    const pillars = [], bells = [], echoes = [], monoliths = [], banners = [];
    const stepMatrices = [], colMatrices = [], archMatrices = [], flameMatrices = [];

    // A point on a terrace: tier t, wall N/E/S/W, u = distance along the wall from centre
    const terracePoint = (t, wall, u, inset = 1.2) => {
        const rOut = rAt(t) - inset;
        switch (wall) {
            case 'N': return new THREE.Vector3(u, yAt(t), -rOut);
            case 'S': return new THREE.Vector3(u, yAt(t),  rOut);
            case 'E': return new THREE.Vector3( rOut, yAt(t), u);
            case 'W': return new THREE.Vector3(-rOut, yAt(t), u);
        }
    };

    // Rim apron + parapet
    for (const [w, d, x, z] of [
        [2 * (R0 + APRON), APRON, 0, -(R0 + APRON / 2)],
        [2 * (R0 + APRON), APRON, 0,  (R0 + APRON / 2)],
        [APRON, 2 * R0, -(R0 + APRON / 2), 0],
        [APRON, 2 * R0,  (R0 + APRON / 2), 0],
    ]) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), matFloor);
        slab.position.set(x, -0.275, z);
        slab.receiveShadow = true;
        addOutline(slab); world.add(slab);
    }
    for (const side of [-1, 1]) {
        for (const axis of ['x', 'z']) {
            const len = 2 * (R0 + APRON) + 1;
            const p = new THREE.Mesh(
                axis === 'x' ? new THREE.BoxGeometry(1, 2.2, len) : new THREE.BoxGeometry(len, 2.2, 1),
                matWallC);
            if (axis === 'x') p.position.set(side * (R0 + APRON + 0.5), 1.1, 0);
            else p.position.set(0, 1.1, side * (R0 + APRON + 0.5));
            addOutline(p); world.add(p);
        }
    }

    // Spawn pavilion on the north apron
    {
        const px = 0.5, pz = -(R0 + 2.5);
        for (const [cx, cz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) {
            const c = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.4, 0.45), matFrieze);
            c.position.set(px + cx, 1.7, pz + cz);
            c.castShadow = true; addOutline(c); deco.add(c);
        }
        const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 4.8), matStone);
        roof.position.set(px, 3.55, pz); roof.castShadow = true;
        addOutline(roof); deco.add(roof);
        const crown = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 2.4), matStone);
        crown.position.set(px, 4.2, pz); crown.scale.set(1, 1, 1);
        addOutline(crown); deco.add(crown);
    }

    // Terraces + tier walls + stairs
    const chamberTiers = { 2: { cx: 0, label: 'bells' }, 4: { cx: -5, label: 'names' }, 6: { cx: 5, label: 'shrine' } };

    for (let t = 0; t <= TIERS; t++) {
        const rO = rAt(t), rI = rAt(t + 1);
        // Terrace ring: 4 slabs
        for (const [w, d, x, z] of [
            [2 * rO, INSET, 0, -(rO - INSET / 2)],
            [2 * rO, INSET, 0,  (rO - INSET / 2)],
            [INSET, 2 * rO, -(rO - INSET / 2), 0],
            [INSET, 2 * rO,  (rO - INSET / 2), 0],
        ]) {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), matFloor);
            slab.position.set(x, yAt(t) - 0.275, z);
            slab.receiveShadow = true; slab.castShadow = true;
            addOutline(slab); world.add(slab);
        }

        if (t === TIERS) break;   // no wall/stairs below the poolside ring

        const wm = wallMats[t % wallMats.length];
        const chamber = chamberTiers[t + 1];   // chamber opens onto the terrace below this wall

        // Tier walls (N wall gets an opening if a chamber lives below)
        for (const wall of ['N', 'S', 'E', 'W']) {
            const horizontal = (wall === 'N' || wall === 'S');
            const len = 2 * rI + 1.6;
            if (wall === 'N' && chamber) {
                // two segments flanking an 8-wide opening at chamber.cx
                const oL = chamber.cx - 4, oR = chamber.cx + 4;
                for (const [a, b] of [[-len / 2, oL], [oR, len / 2]]) {
                    const segLen = b - a;
                    if (segLen <= 0.1) continue;
                    const seg = new THREE.Mesh(new THREE.BoxGeometry(segLen, TH, 0.8), wm);
                    seg.position.set((a + b) / 2, yAt(t) - TH / 2, -(rI + 0.4));
                    seg.castShadow = true; seg.receiveShadow = true;
                    addOutline(seg); world.add(seg);
                }
                // lintel above the opening
                const lin = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.9, 0.9), matFrieze);
                lin.position.set(chamber.cx, yAt(t) - 0.45, -(rI + 0.4));
                addOutline(lin); world.add(lin);
            } else {
                const wallMesh = new THREE.Mesh(
                    horizontal ? new THREE.BoxGeometry(len, TH, 0.8) : new THREE.BoxGeometry(0.8, TH, len),
                    wm);
                if (wall === 'N') wallMesh.position.set(0, yAt(t) - TH / 2, -(rI + 0.4));
                if (wall === 'S') wallMesh.position.set(0, yAt(t) - TH / 2,  (rI + 0.4));
                if (wall === 'E') wallMesh.position.set( (rI + 0.4), yAt(t) - TH / 2, 0);
                if (wall === 'W') wallMesh.position.set(-(rI + 0.4), yAt(t) - TH / 2, 0);
                wallMesh.castShadow = true; wallMesh.receiveShadow = true;
                addOutline(wallMesh); world.add(wallMesh);
            }

            // Carved frieze lintel band along each wall top
            const band = new THREE.Mesh(
                horizontal ? new THREE.BoxGeometry(2 * rI, 0.7, 0.14) : new THREE.BoxGeometry(0.14, 0.7, 2 * rI),
                matFrieze);
            const bandR = rI - 0.06;
            if (wall === 'N') band.position.set(0, yAt(t) - 0.55, -bandR);
            if (wall === 'S') band.position.set(0, yAt(t) - 0.55,  bandR);
            if (wall === 'E') band.position.set( bandR, yAt(t) - 0.55, 0);
            if (wall === 'W') band.position.set(-bandR, yAt(t) - 0.55, 0);
            deco.add(band);

            // Votive niches along the wall (eye level from the terrace below)
            const vy = yAt(t + 1) + 1.6;
            for (let u = -rI + 2.5; u < rI - 2.0; u += 3.4) {
                const vr = rI - 0.02;
                if (wall === 'N') { _m.position.set(u, vy, -vr); _m.rotation.set(0, 0, 0); }
                if (wall === 'S') { _m.position.set(u, vy,  vr); _m.rotation.set(0, Math.PI, 0); }
                if (wall === 'E') { _m.position.set( vr, vy, u); _m.rotation.set(0, -Math.PI / 2, 0); }
                if (wall === 'W') { _m.position.set(-vr, vy, u); _m.rotation.set(0,  Math.PI / 2, 0); }
                _m.scale.set(1, 1, 1); _m.updateMatrix();
                flameMatrices.push(_m.matrix.clone());
            }

            // Zigzag stair flights on E / S / W walls
            if (wall !== 'N') {
                const L = 2 * rI;
                const nF = Math.max(2, Math.round(L / 12));
                const spacing = L / nF;
                for (let i = 0; i < nF; i++) {
                    const ci = -L / 2 + (i + 0.5) * spacing;
                    const dir = ((i + t) % 2) * 2 - 1;
                    const u0 = ci - dir * (14 * RUN) / 2;
                    const sr = rI - 0.72;
                    for (let k = 0; k < 14; k++) {
                        const u = u0 + dir * (k + 0.5) * RUN;
                        const y = yAt(t) - (k + 1) * RISE + RISE / 2;
                        if (wall === 'E') { _m.position.set( sr, y, u); _m.rotation.set(0, 0, 0); }
                        if (wall === 'W') { _m.position.set(-sr, y, u); _m.rotation.set(0, 0, 0); }
                        if (wall === 'S') { _m.position.set(u, y,  sr); _m.rotation.set(0, Math.PI / 2, 0); }
                        _m.scale.set(1, 1, 1); _m.updateMatrix();
                        stepMatrices.push(_m.matrix.clone());
                    }
                }
            }

            // North face: colonnade of columns + arches every tier
            if (wall === 'N') {
                const L = 2 * rI;
                const n = Math.floor(L / 5);
                let prev = null;
                for (let c = 0; c <= n; c++) {
                    const x = -L / 2 + c * 5;
                    if (chamber && x > chamber.cx - 4.6 && x < chamber.cx + 4.6) { prev = null; continue; }
                    _m.position.set(x, yAt(t + 1) + TH / 2, -(rI - 0.35));
                    _m.rotation.set(0, 0, 0); _m.scale.set(1, 1, 1);
                    _m.updateMatrix(); colMatrices.push(_m.matrix.clone());
                    if (prev !== null) {
                        _m.position.set((prev + x) / 2, yAt(t + 1) + TH, -(rI - 0.4));
                        _m.updateMatrix(); archMatrices.push(_m.matrix.clone());
                        // the odd torn banner from an arch
                        if (Math.random() < 0.3) {
                            const bg = new THREE.Group();
                            const clothGeo = new THREE.PlaneGeometry(0.7, 2.0 + Math.random() * 1.0, 1, 4);
                            clothGeo.translate(0, -1.2, 0);
                            bg.add(new THREE.Mesh(clothGeo, matBanner));
                            bg.position.set((prev + x) / 2, yAt(t + 1) + TH - 0.4, -(rI - 0.6));
                            deco.add(bg);
                            banners.push({ group: bg, phase: Math.random() * Math.PI * 2, amp: 0.06 + Math.random() * 0.08 });
                        }
                    }
                    prev = x;
                }
            }
        }

        // Weathered statues on the terrace corners of odd tiers
        if (t % 2 === 1) {
            for (const [sx, sz] of [[1, 1], [-1, -1]]) {
                const statue = figureMesh(figParts, matStone);
                const ped = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.0), matStone);
                ped.position.y = -0.2; statue.add(ped);
                statue.position.set(sx * (rO - 1.3), yAt(t) + 0.4, sz * (rO - 1.3));
                statue.lookAt(0, yAt(t), 0);
                statue.scale.setScalar(1.25);
                deco.add(statue);
            }
        }
    }

    // Bake instanced geometry
    const stepInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.35, RISE, RUN + 0.02), matStep, stepMatrices.length);
    stepMatrices.forEach((m, i) => stepInst.setMatrixAt(i, m));
    stepInst.castShadow = true; stepInst.receiveShadow = true;
    world.add(stepInst);

    const colInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, TH, 0.5), matFrieze, colMatrices.length);
    colMatrices.forEach((m, i) => colInst.setMatrixAt(i, m));
    colInst.castShadow = true; deco.add(colInst);

    const archInst = new THREE.InstancedMesh(new THREE.TorusGeometry(2.5, 0.22, 6, 10, Math.PI), matFrieze, archMatrices.length);
    archMatrices.forEach((m, i) => archInst.setMatrixAt(i, m));
    deco.add(archInst);

    const flameInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.2), matFlame, flameMatrices.length);
    flameMatrices.forEach((m, i) => flameInst.setMatrixAt(i, m));
    deco.add(flameInst);

    /* ── Chambers on the palace face ── */
    function buildChamber(tier, cx, build) {
        const rI = rAt(tier);              // chamber opens in the wall standing at rAt(tier)
        const zFace = -(rI + 0.8);
        const D = 7, W = 10, H = 3.6;
        const zc = zFace - D / 2;
        const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, D + 1.5), matFloor);
        floor.position.set(cx, yAt(tier) - 0.25, zc + 0.4);
        floor.receiveShadow = true; addOutline(floor); world.add(floor);
        const ceil = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, D + 1.5), matWallC);
        ceil.position.set(cx, yAt(tier) + H + 0.25, zc + 0.4);
        addOutline(ceil); world.add(ceil);
        const back = new THREE.Mesh(new THREE.BoxGeometry(W, H + 1, 0.5), matWallA);
        back.position.set(cx, yAt(tier) + H / 2, zc - D / 2 - 0.2);
        back.receiveShadow = true; addOutline(back); world.add(back);
        for (const s of [-1, 1]) {
            const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, H + 1, D + 1.5), matWallA);
            side.position.set(cx + s * W / 2, yAt(tier) + H / 2, zc + 0.4);
            side.receiveShadow = true; addOutline(side); world.add(side);
        }
        build({ cx, y: yAt(tier), zc, W, D, H });
    }

    // ── Bell Sanctum (tier 2): Mother, Child, Elder ──
    buildChamber(2, chamberTiers[2].cx, ({ cx, y, zc }) => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.28, 0.28), matStone);
        beam.position.set(cx, y + 3.1, zc);
        addOutline(beam); deco.add(beam);
        const defs = [
            { id: 'mother', name: 'Mother', scale: 1.25, pitch: 0.72, x: -2.4 },
            { id: 'elder',  name: 'Elder',  scale: 0.95, pitch: 1.0,  x: 0 },
            { id: 'child',  name: 'Child',  scale: 0.6,  pitch: 1.6,  x: 2.4 },
        ];
        for (const d of defs) {
            const bell = bellMesh(matBell, d.scale);
            bell.position.set(cx + d.x, y + 3.0, zc);
            bell.userData = { isBell: true, id: d.id, name: d.name, pitch: d.pitch };
            deco.add(bell);
            bells.push({ mesh: bell, ringT: -1, id: d.id, pitch: d.pitch });
        }
        // inscription tablet by the entrance
        const tablet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.16), matFrieze);
        tablet.position.set(cx - 3.9, y + 1.3, zc + 2.6);
        tablet.rotation.y = 0.5;
        tablet.userData = { isTablet: true };
        addOutline(tablet); deco.add(tablet);
    });

    // ── Hall of Names (tier 4): the name-wall + a diya ──
    let nameMarkPos = [];
    buildChamber(4, chamberTiers[4].cx, ({ cx, y, zc, D }) => {
        // carved name-wall at the back; a mark lights for every echo heard
        const wallBand = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 0.2), matFrieze);
        wallBand.position.set(cx, y + 1.7, zc - D / 2 + 0.3);
        addOutline(wallBand); deco.add(wallBand);
        for (let i = 0; i < TOTAL_ECHOES; i++) {
            nameMarkPos.push(new THREE.Vector3(cx - 3 + i * 1.2, y + 1.15, zc - D / 2 + 0.55));
        }
        pillars.push(spawnPillar(scene, new THREE.Vector3(cx + 3.2, y, zc + 1.5), pillars.length, matPillar));
    });

    // ── Shrine antechamber (tier 6): the great statue ──
    buildChamber(6, chamberTiers[6].cx, ({ cx, y, zc }) => {
        const statue = figureMesh(figParts, matStone);
        statue.position.set(cx, y + 0.5, zc - 1.8);
        statue.scale.setScalar(1.9);
        deco.add(statue);
        const ped = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), matStone);
        ped.position.set(cx, y + 0.25, zc - 1.8);
        addOutline(ped); world.add(ped);
    });

    /* ── Diyas scattered across the terraces ── */
    const diyaSpots = [
        terracePoint(1, 'E', -8), terracePoint(2, 'W', 6), terracePoint(3, 'S', -9),
        terracePoint(5, 'E', 4), terracePoint(6, 'W', -5), terracePoint(7, 'N', 6, 1.4),
    ];
    for (const p of diyaSpots) pillars.push(spawnPillar(scene, p, pillars.length, matPillar));
    // (the 7th diya lives in the Hall of Names, added above)

    /* ── Echoes of the drowned ── */
    const echoSpots = [
        { p: terracePoint(1, 'W', 9),  i: 0 },   // Ishvari
        { p: terracePoint(3, 'E', 7),  i: 1 },   // Bhadra
        { p: new THREE.Vector3(chamberTiers[2].cx + 3, yAt(2), -(rAt(2) + 3.4)), i: 2 },  // Kanha, bell sanctum
        { p: terracePoint(5, 'S', 0),  i: 3 },   // Meera
        { p: new THREE.Vector3(chamberTiers[4].cx - 3, yAt(4), -(rAt(4) + 3.0)), i: 4 },  // Devan, hall of names
        { p: new THREE.Vector3(chamberTiers[6].cx, yAt(6), -(rAt(6) - 2.2)), i: 5 },      // the priest, by the shrine
    ];
    for (const e of echoSpots) {
        const eg = figureMesh(figParts, matGhost);
        eg.position.copy(e.p);
        eg.lookAt(new THREE.Vector3(0, e.p.y, 0));
        deco.add(eg);
        echoes.push({ group: eg, line: ECHO_LINES[e.i], idx: e.i, phase: Math.random() * Math.PI * 2, triggered: false, t: 0 });
    }

    /* ── The pool, causeway, island shrine ── */
    const poolHalf = rAt(TIERS + 1);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(poolHalf * 2 + 3, poolHalf * 2 + 3), matWater);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, WATER_Y, 0);
    scene.add(pool);

    // submerged causeway from the north poolside terrace to the island
    for (let i = 0; i < 3; i++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 2.0), matFloor);
        slab.position.set(0, WATER_Y - 0.35, -(poolHalf - 1.2) + i * 2.05);
        addOutline(slab); world.add(slab);
    }
    const island = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 1.4, 10), matStone);
    island.position.set(0, WATER_Y - 0.05, 0.5);
    island.receiveShadow = true;
    addOutline(island); world.add(island);

    const greatDiyaGroup = new THREE.Group();
    const gd = diyaMesh(); gd.scale.setScalar(5);
    greatDiyaGroup.add(gd);
    greatDiyaGroup.position.set(0, WATER_Y + 0.65, 0.5);
    greatDiyaGroup.userData = { isGreatDiya: true };
    scene.add(greatDiyaGroup);

    // drowned giants standing in the water
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.5;
        const statue = figureMesh(figParts, matStone);
        statue.position.set(Math.cos(a) * (poolHalf - 1.5), WATER_Y - 0.7, Math.sin(a) * (poolHalf - 1.5));
        statue.lookAt(0, WATER_Y, 0);
        statue.scale.setScalar(2.4 + Math.random());
        deco.add(statue);
    }

    // The Watcher — a black figure that is never on your terrace, only lower.
    // It vanishes when looked at too long, or approached.
    const matWatcher = new THREE.MeshBasicMaterial({ color: 0x140609 });
    const watcher = figureMesh(figParts, matWatcher);
    watcher.scale.setScalar(1.35);
    watcher.visible = false;
    deco.add(watcher);

    /* ── Sky, shafts, monoliths, embers ── */
    const moon = A.moonSprite(30);
    moon.position.set(6, 34, 8);
    scene.add(moon);

    for (const [sx, sz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) {
        const shaft = new THREE.Mesh(new THREE.PlaneGeometry(3, 34), matShaft);
        shaft.position.set(sx, -6, sz);
        shaft.rotation.y = Math.atan2(sx, sz);
        shaft.rotation.z = 0.12;
        deco.add(shaft);
    }

    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2, dist = R0 + 22 + Math.random() * 60;
        monoliths.push(new ShiftingMonolith(scene,
            Math.cos(angle) * dist, Math.sin(angle) * dist,
            -12, 40 + Math.random() * 70, wallMats[i % 3]));
    }

    const embers = new Embers(scene, 260,
        A.moteMaterial({ sprite: 'ember_64', color: 0xff7788, size: 0.11, opacity: 0.55 }));

    // Grunge decals on tier walls
    for (let t = 0; t < TIERS; t++) {
        for (let i = 0; i < 2; i++) {
            const rI = rAt(t + 1);
            const wall = ['E', 'W', 'S'][Math.floor(Math.random() * 3)];
            const name = A.decalNames[Math.floor(Math.random() * A.decalNames.length)];
            const size = 2 + Math.random() * 1.6;
            const d = new THREE.Mesh(new THREE.PlaneGeometry(size, size), A.decalMaterial(name));
            const u = (Math.random() - 0.5) * rI * 1.4;
            const vy = yAt(t) - TH / 2 + (Math.random() - 0.5) * 1.2;
            if (wall === 'E') { d.position.set(rI - 0.02, vy, u);  d.rotation.y = -Math.PI / 2; }
            if (wall === 'W') { d.position.set(-(rI - 0.02), vy, u); d.rotation.y = Math.PI / 2; }
            if (wall === 'S') { d.position.set(u, vy, rI - 0.02);  d.rotation.y = Math.PI; }
            d.rotation.z = Math.random() * Math.PI * 2;
            d.renderOrder = 1;
            deco.add(d);
        }
    }

    /* ── State ── */
    const st = {
        vel: new THREE.Vector3(), fwd: false, back: false, left: false, right: false,
        locked: false, started: false, ended: false, goodEnding: false,
        descent: 0, narShown: new Set(),
        flames: 0, names: 0, bellsSung: false, bellSeq: [],
        dunks: 0, waterOpen: false, waterTarget: WATER_Y,
        fogSpike: 0, flashT: 0, nextFlash: 7 + Math.random() * 8, nextToll: 30,
        bobPhase: 0, safeT: 0,
        lastSafe: new THREE.Vector3(0.5, PLAYER_H, -(R0 + 2)),
        // thriller beats
        watcherT: 22, watcherGaze: 0, watcherSeen: 0,
        lampsOutT: 0, beatLamps: false, beatToll: false,
    };
    const ritesDone = () => (st.flames >= TOTAL_DIYAS ? 1 : 0) + (st.bellsSung ? 1 : 0) + (st.names >= TOTAL_ECHOES ? 1 : 0);
    let prevY = camera.position.y;

    /* ── Controls ── */
    const euler = new THREE.Euler(0, Math.PI, 0, 'YXZ');
    const lockEl = renderer.domElement;
    const onMouseMove = (e) => {
        if (!st.locked) return;
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= (e.movementX || 0) * 0.002; euler.x -= (e.movementY || 0) * 0.002;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    };
    const onLockChange = () => {
        st.locked = document.pointerLockElement === lockEl;
        container.style.cursor = st.locked ? 'none' : 'default';
    };
    const onCanvasClick = () => {
        if (!st.started) return;
        if (!st.locked) lockEl.requestPointerLock();
        else tryInteract();
    };
    const onKey = (e, isDown) => {
        if (!st.locked && isDown) return;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') st.fwd = isDown;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') st.back = isDown;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') st.left = isDown;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') st.right = isDown;
    };
    const onKeyDown = e => onKey(e, true);
    const onKeyUp = e => onKey(e, false);
    const onResize = () => {
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    lockEl.addEventListener('click', onCanvasClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    /* ── Ground + interaction ── */
    const rayDown = new THREE.Raycaster(); const rayInt = new THREE.Raycaster();
    let colls = null;
    function groundYAt(pos) {
        rayDown.set(new THREE.Vector3(pos.x, pos.y + 3, pos.z), new THREE.Vector3(0, -1, 0)); rayDown.far = 9;
        if (!colls) { colls = []; world.traverse(c => { if (c.isMesh) colls.push(c); }); }
        const hits = rayDown.intersectObjects(colls, false);
        return hits.length ? hits[0].point.y : null;
    }

    function showText(text, duration = 6500) {
        const el = document.getElementById('baoli-narrative-text');
        if (!el) return;
        el.textContent = text; el.style.opacity = '1';
        setTimeout(() => el.style.opacity = '0', duration);
    }
    function showPhase(text) {
        const el = document.getElementById('baoli-phase-text');
        if (!el) return;
        el.textContent = text; el.style.opacity = '1';
        setTimeout(() => el.style.opacity = '0', 4500);
    }
    function setPrompt(text) {
        const el = document.getElementById('baoli-interact-prompt');
        if (!el) return;
        if (text) { el.textContent = text; el.style.opacity = '1'; }
        else el.style.opacity = '0';
    }
    function updateRites() {
        const el = document.getElementById('baoli-rites');
        if (!el) return;
        el.textContent =
            `flames ${st.flames}/${TOTAL_DIYAS}  ·  bells ${st.bellsSung ? 'sung' : 'silent'}  ·  names ${st.names}/${TOTAL_ECHOES}`;
    }

    let interactTargets = null;
    function rebuildInteractTargets() {
        interactTargets = [];
        pillars.forEach(p => { if (!p.userData.lit) p.traverse(c => { if (c.isMesh) interactTargets.push(c); }); });
        bells.forEach(b => interactTargets.push(b.mesh));
        deco.traverse(c => { if (c.userData && c.userData.isTablet) interactTargets.push(c); });
        greatDiyaGroup.traverse(c => { if (c.isMesh) interactTargets.push(c); });
    }
    rebuildInteractTargets();

    function aimedTarget() {
        rayInt.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hits = rayInt.intersectObjects(interactTargets, false);
        if (!hits.length || hits[0].distance > INTERACT_RANGE) return null;
        let obj = hits[0].object;
        while (obj && !obj.userData.isDiyaPillar && !obj.userData.isBell &&
               !obj.userData.isTablet && !obj.userData.isGreatDiya) obj = obj.parent;
        return obj;
    }

    function completeRite(phaseText) {
        showPhase(phaseText);
        audio.riteFX();
        updateRites();
        if (ritesDone() === 3 && !st.waterOpen) {
            st.waterOpen = true;
            st.waterTarget = WATER_Y - WATER_DROP;
            setTimeout(() => { showPhase('THE WATER PARTS'); audio.purifyFX(); }, 4200);
            setTimeout(() => showText('The black water recedes. A path of stone waits below.'), 7200);
        }
    }

    function tryInteract() {
        const obj = aimedTarget();
        if (!obj) return;

        if (obj.userData.isDiyaPillar && !obj.userData.lit) {
            obj.userData.lit = true;
            obj.userData.light.intensity = 3.0;
            addFlame(new THREE.Vector3(obj.position.x, obj.position.y + 2.06, obj.position.z), 0.5);
            st.flames++;
            audio.lightFX();
            rebuildInteractTargets();
            updateRites();
            if (st.flames >= TOTAL_DIYAS) completeRite('THE STAIRS ARE LIT');
            else showText(`Flames ignited: ${st.flames} / ${TOTAL_DIYAS}`, 3000);

        } else if (obj.userData.isBell) {
            const bell = bells.find(b => b.mesh === obj);
            if (bell && bell.ringT < 0) {
                bell.ringT = 0;
                audio.bellToll(1.0, bell.pitch);
                if (!st.bellsSung) {
                    st.bellSeq.push(bell.id);
                    if (st.bellSeq.length === 3) {
                        if (BELL_ORDER.every((id, i) => st.bellSeq[i] === id)) {
                            st.bellsSung = true;
                            setTimeout(() => completeRite('THE BELLS REMEMBER'), 1200);
                        } else {
                            setTimeout(() => { audio.dissonance(); showText('The well refuses the song. Begin again.', 4500); }, 900);
                        }
                        st.bellSeq = [];
                    }
                }
            }

        } else if (obj.userData.isTablet) {
            showText(BELL_CLUE, 9000);
            audio.whisper();

        } else if (obj.userData.isGreatDiya && !st.ended) {
            if (ritesDone() < 3) {
                showText('The water refuses you. Three debts remain unpaid.', 5000);
                audio.stress();
            } else {
                endGame(true);
            }
        }
    }

    /* ── Water & endings ── */
    function rejectFromWater() {
        st.dunks++;
        audio.stress();
        st.fogSpike = 1.4;
        if (st.dunks >= 3) { endGame(false); return; }
        camera.position.copy(st.lastSafe);
        st.vel.set(0, 0, 0);
        showText(st.dunks === 1
            ? 'The water does not know you yet. It gives you back.'
            : 'Twice the water has spared you. It will not a third time.', 5500);
        audio.whisper();
    }

    function endGame(good) {
        st.ended = true; st.goodEnding = good;
        if (document.pointerLockElement) document.exitPointerLock();
        setPrompt(null);
        if (good) addFlame(new THREE.Vector3(0, WATER_Y + 1.35, 0.6), 1.6);

        const el = document.getElementById('baoli-ending');
        if (el) {
            el.style.display = 'flex'; el.style.opacity = '0';
            el.style.transition = 'opacity 4s ease';
            requestAnimationFrame(() => el.style.opacity = '1');
            const stats = `<p class="ending-subtext">flames ${st.flames}/${TOTAL_DIYAS} · bells ${st.bellsSung ? 'sung' : 'silent'} · names ${st.names}/${TOTAL_ECHOES}</p>`;
            if (good) {
                audio.purifyFX();
                el.innerHTML = '<h1>THE TRUTH SURFACES</h1>' +
                    '<p>He knew. The water was never a gift — it was a grave he taught a city to drink from. ' +
                    'Forty names, struck from the ledger, spoken again. The debt is paid.</p>' + stats;
            } else {
                audio.stress();
                el.innerHTML = '<h1>CONSUMED</h1><p>The third time, the water kept you. Like the forty before.</p>' + stats;
            }
        }
    }

    /* ── Main loop ── */
    const clock = new THREE.Clock(); let gt = 0, animId = null;

    function frame() {
        animId = requestAnimationFrame(frame);
        const dt = Math.min(clock.getDelta(), 0.08); gt += dt;

        const agitation = 1.0 - ritesDone() * 0.28;
        for (const m of monoliths) m.update(gt, agitation);
        for (const b of banners) b.group.rotation.x = Math.sin(gt * 1.1 + b.phase) * b.amp;
        for (const b of bells) {
            if (b.ringT >= 0) {
                b.ringT += dt;
                b.mesh.rotation.z = Math.sin(b.ringT * 7) * 0.35 * Math.exp(-b.ringT * 0.8);
                if (b.ringT > 4.5) { b.mesh.rotation.z = 0; b.ringT = -1; }
            }
        }
        // votive flicker — unless the well snuffs them all at once
        if (st.lampsOutT > 0) { st.lampsOutT -= dt; matFlame.opacity = 0.04; }
        else matFlame.opacity = 0.62 + Math.sin(gt * 11) * 0.1 + Math.sin(gt * 23) * 0.05;
        matShaft.opacity = 0.12 + Math.sin(gt * 0.7) * 0.04;
        A.update(dt);
        embers.update(dt, camera.position);

        // the water receding
        if (Math.abs(pool.position.y - st.waterTarget) > 0.005) {
            pool.position.y = THREE.MathUtils.lerp(pool.position.y, st.waterTarget, dt * 0.5);
        }

        // lightning
        st.nextFlash -= dt;
        if (st.nextFlash <= 0) {
            st.flashT = 0.4 + Math.random() * 0.25;
            st.nextFlash = 9 + Math.random() * 16;
            if (st.started && !st.ended) audio.thunder(0.3 + Math.random() * 0.4);
        }
        if (st.flashT > 0) {
            st.flashT = Math.max(0, st.flashT - dt);
            const k = st.flashT * (0.5 + Math.random() * 0.5);
            sunLight.intensity = 0.1 + k * 5;
            hemiLight.intensity = 0.22 + k * 1.2;
            scene.background.copy(baseSky).lerp(flashSky, Math.min(1, k * 2.5));
        } else {
            sunLight.intensity = 0.1;
            hemiLight.intensity = 0.22;
            scene.background.copy(baseSky);
        }

        if (!st.started || (st.ended && !st.goodEnding)) { renderer.render(scene, camera); return; }

        let moving = false;
        if (st.locked && !st.ended) {
            const dir = new THREE.Vector3(), fwd = new THREE.Vector3();
            camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
            const rt = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
            if (st.fwd) dir.add(fwd); if (st.back) dir.sub(fwd);
            if (st.left) dir.sub(rt); if (st.right) dir.add(rt);
            if (dir.lengthSq() > 0) { dir.normalize(); moving = true; }

            camera.position.addScaledVector(dir, SPEED * dt);
            st.vel.y += GRAV * dt; camera.position.y += st.vel.y * dt;

            const gy = groundYAt(camera.position);
            let grounded = false;
            if (gy !== null && camera.position.y < gy + PLAYER_H) {
                camera.position.y = gy + PLAYER_H; st.vel.y = 0; grounded = true;
            }

            // square bounds of the site
            const B = R0 + APRON - 0.6;
            camera.position.x = THREE.MathUtils.clamp(camera.position.x, -B, B);
            camera.position.z = THREE.MathUtils.clamp(camera.position.z, -B, B - 0);

            // black water
            if (camera.position.y < pool.position.y + 1.2 && !st.ended) rejectFromWater();
            if (camera.position.y < WATER_Y - 8) { camera.position.copy(st.lastSafe); st.vel.set(0, 0, 0); }

            // remember the last safe stand
            st.safeT += dt;
            if (grounded && st.safeT > 0.6 && camera.position.y > pool.position.y + 2.2) {
                st.lastSafe.copy(camera.position); st.safeT = 0;
            }

            // strafe roll
            euler.setFromQuaternion(camera.quaternion);
            const targetRoll = (st.left ? 1 : 0) * 0.018 - (st.right ? 1 : 0) * 0.018;
            euler.z += (targetRoll - euler.z) * Math.min(1, dt * 6);
            camera.quaternion.setFromEuler(euler);

            if (moving && grounded) st.bobPhase += dt * 7;
        }

        const dy = prevY - camera.position.y; if (dy > 0) st.descent += dy;

        const f = 1.05 + Math.sin(gt * 7) * 0.1;
        diyaLight.intensity = f; diyaFill.intensity = f * 0.18;
        pillars.forEach(p => { if (p.userData.lit) p.userData.light.intensity = 3.0 + Math.sin(gt * 5 + p.userData.index) * 0.4; });

        // echoes
        for (const e of echoes) {
            if (e.t > 3.2) continue;
            if (!e.triggered) {
                matGhost.opacity = 0.2 + Math.sin(gt * 2.4) * 0.05;
                if (camera.position.distanceTo(e.group.position) < 3.4) {
                    e.triggered = true;
                    st.names++;
                    showText(e.line, 7500);
                    audio.whisper();
                    updateRites();
                    if (nameMarkPos[e.idx]) addFlame(nameMarkPos[e.idx], 0.3);   // a mark lights in the Hall of Names
                    if (st.names >= TOTAL_ECHOES) completeRite('THE NAMES ARE SPOKEN');
                }
            } else {
                e.t += dt;
                e.group.position.y += dt * 0.45;
                e.group.scale.setScalar(Math.max(0.001, 1 - e.t * 0.12));
                if (e.t > 3.2) e.group.visible = false;
            }
        }

        // ── The Watcher ──
        if (!st.ended && st.locked) {
            if (!watcher.visible) {
                st.watcherT -= dt;
                if (st.watcherT <= 0) {
                    // appear on a lower terrace, across the void
                    const pTier = Math.max(0, Math.min(TIERS, Math.round(-camera.position.y / TH)));
                    const wTier = Math.min(TIERS, pTier + 1 + Math.floor(Math.random() * 2));
                    const wall = ['N', 'E', 'S', 'W'][Math.floor(Math.random() * 4)];
                    const u = (Math.random() - 0.5) * rAt(wTier) * 1.4;
                    const pos = terracePoint(wTier, wall, u);
                    if (camera.position.distanceTo(pos) > 11) {
                        watcher.position.copy(pos);
                        watcher.lookAt(camera.position.x, pos.y, camera.position.z);
                        watcher.visible = true;
                        st.watcherGaze = 0;
                    } else st.watcherT = 3;   // bad spot, retry shortly
                }
            } else {
                const toW = watcher.position.clone().sub(camera.position);
                const dist = toW.length(); toW.normalize();
                const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
                if (fwd.dot(toW) > 0.965) st.watcherGaze += dt; else st.watcherGaze = Math.max(0, st.watcherGaze - dt);
                if (st.watcherGaze > 0.9 || dist < 8) {
                    watcher.visible = false;
                    st.watcherT = 28 + Math.random() * 30;
                    st.watcherSeen++;
                    st.fogSpike = Math.max(st.fogSpike, 0.35);
                    audio.whisper();
                    if (st.watcherSeen === 2) showText('It does not use the stairs. It is simply lower, each time you look.', 6000);
                }
            }
        }

        if (!st.ended) {
            // scripted dread
            if (!st.beatLamps && st.flames >= 4) {
                st.beatLamps = true; st.lampsOutT = 2.6;
                audio.stress();
                setTimeout(() => showText('Every votive in the well just guttered. At once.', 5000), 800);
            }
            if (!st.beatToll && st.names >= 3) {
                st.beatToll = true;
                setTimeout(() => { audio.bellToll(0.5, 0.72); showText('The Mother Bell tolls. No hand touched it.', 5500); }, 2000);
            }

            for (let i = 0; i < NARRATIVE.length; i++) {
                if (!st.narShown.has(i) && st.descent > NARRATIVE[i].frac * TOTAL_DEPTH) {
                    st.narShown.add(i); showText(NARRATIVE[i].text); audio.whisper(); break;
                }
            }

            if (gt % 5 < dt) audio.drip();
            st.nextToll -= dt;
            if (st.nextToll <= 0) { audio.bellToll(0.25, 0.9); st.nextToll = 35 + Math.random() * 25; }

            if (st.locked) {
                const target = aimedTarget();
                if (target?.userData.isDiyaPillar) setPrompt('Click — light the diya');
                else if (target?.userData.isBell) setPrompt(`Click — ring the ${target.userData.name} Bell`);
                else if (target?.userData.isTablet) setPrompt('Click — read the inscription');
                else if (target?.userData.isGreatDiya) setPrompt(ritesDone() < 3 ? 'The flame is cold. Debts remain.' : 'Click — pay the toll');
                else setPrompt(null);
            }

            st.fogSpike = Math.max(0, st.fogSpike - dt * 0.8);
            const ratio = Math.min(1, -camera.position.y / TOTAL_DEPTH);
            scene.fog.density = 0.022 + ratio * 0.03 + st.fogSpike * 0.15;
            scene.fog.color.copy(baseFog).lerp(deepFog, ratio * 0.7);
        }

        if (st.ended && st.goodEnding) {
            scene.background.lerp(new THREE.Color(0x050a14), 0.01);
            scene.fog.color.lerp(new THREE.Color(0x02050a), 0.01);
            matWater.color.lerp(new THREE.Color(0x021122), 0.01);
            sunLight.color.lerp(new THREE.Color(0xffffff), 0.01);
            sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, 0.5, 0.01);
        }

        prevY = camera.position.y;

        const bob = (moving && st.vel.y === 0) ? Math.sin(st.bobPhase * 2) * 0.035 : 0;
        camera.position.y += bob;
        renderer.render(scene, camera);
        camera.position.y -= bob;
    }
    frame();

    return {
        start() {
            st.started = true; audio.start(); lockEl.requestPointerLock();
            updateRites();
            setTimeout(() => showPhase('THE WELL OF NAMES'), 800);
            setTimeout(() => showText('Forty names are missing from these stones. The water knows why.'), 3500);
            setTimeout(() => showText('Three debts bind it: flame, song, and name. Pay them all.', 7000), 11000);
        },
        destroy() {
            if (animId) cancelAnimationFrame(animId); audio.stop();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('pointerlockchange', onLockChange);
            lockEl.removeEventListener('click', onCanvasClick);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
        }
    };
}
