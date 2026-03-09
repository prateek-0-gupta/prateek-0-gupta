

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js';

const STEP_W = 8;
const STEP_D = 1.0;
const STEP_H = 0.30;
const STEPS_PER_FLIGHT = 16;
const LANDING_D = 6;
const FLIGHTS = 12;        
const WALL_H = 40;          
const WALL_T = 2.5;
const PLAYER_H = 1.65;
const SPEED = 4.0;
const GRAV = -20;
const INTERACT_RANGE = 4.0;
const PILLAR_EVERY = 2;   

const SKY        = 0x3d0202;   
const FOG_COL    = 0x730909;   
const FLOOR_COL  = 0x0a0101;   
const STEP_COL   = 0x1f0505;   
const PINK       = 0xff0055;   
const PINK_LIGHT = 0xff66a3;  
const PINK_DARK  = 0x4d001f;  


function makeCanvas(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function floorTexture() {
    return makeCanvas(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 20000; i++) {
            const v = Math.random() * 40;
            ctx.fillStyle = `rgba(${v + 20},${v},${v},${Math.random() * 0.2})`; 
            ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random()*3, 1 + Math.random()*3);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < w; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + (Math.random()*10-5), h); ctx.stroke(); }
    });
}

function pinkTexture() {
    return makeCanvas(512, 512, (ctx, w, h) => {
        const grd = ctx.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, '#1a0508'); 
        grd.addColorStop(1, '#0a0102');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 200; i++) {
            ctx.fillStyle = `rgba(15, 2, 5, ${0.1 + Math.random() * 0.4})`;
            ctx.fillRect(Math.random() * w, 0, 2 + Math.random() * 10, h);
        }
    });
}

function waterTexture() {
    return makeCanvas(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#0a0101';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 300; i++) {
            ctx.fillStyle = `rgba(50,10,15,${Math.random() * 0.15})`; 
            ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 50, 1);
        }
    });
}

const matOutline = new THREE.LineBasicMaterial({ color: 0x000000 });
function addOutline(mesh, threshold = 15) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
    const line = new THREE.LineSegments(edges, matOutline);
    mesh.add(line);
    return line;
}


const NARRATIVE =[
    { at: 10,  text: "The drought lasted seven years. The city begged for water." },
    { at: 30,  text: "I ordered the builders to dig deeper. No matter the cost." },
    { at: 55,  text: "They warned me of the bleeding stone. I did not listen." },
    { at: 75,  text: "When the water finally sprang forth... it was warm." },
    { at: 100, text: "I told my people it was a gift from the gods." },
    { at: 125, text: "The thirst drove them mad. The well claimed them all." },
    { at: 155, text: "I built this stepwell as a monument to my glory." },
    { at: 180, text: "Now, I must descend to pay the toll." },
];


class Audio {
    constructor(actx) {
        this.ctx = actx;
        this.out = actx.createGain();
        this.out.gain.value = 0.50;
        this.out.connect(actx.destination);
        this.running = false;
        this._srcs =[];
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
    
    start() { this.running = true; this.resume(); this._wind(); }
    stop()  { this.running = false; this._srcs.forEach(s => { try { s.stop(); } catch(_){} }); this._srcs =[]; }

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
    lightFX() {
        const n = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, n); g.gain.exponentialRampToValueAtTime(0.001, n + 1.2);
        o.connect(g); g.connect(this.out); o.start(n); o.stop(n + 1.3);
    }
    purifyFX() {
        const n = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'triangle'; 
        o.frequency.setValueAtTime(220, n); o.frequency.exponentialRampToValueAtTime(880, n + 4);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0, n); g.gain.linearRampToValueAtTime(0.1, n + 2); g.gain.exponentialRampToValueAtTime(0.001, n + 5);
        o.connect(g); g.connect(this.out); o.start(n); o.stop(n + 5);
    }
}


function diyaMesh() {
    const g = new THREE.Group();
    const pts =[
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
    light.castShadow = true;
    scene.add(light);
    
    g.userData = { isDiyaPillar: true, lit: false, light, index: idx };
    scene.add(g);
    return g;
}

class ShiftingMonolith {
    constructor(scene, x, z, baseY, height, mat) {
        this.parts =[]; this.baseY = baseY; this.seed = Math.random() * 100;
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

export function createGame(container) {
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
    scene.fog = new THREE.FogExp2(FOG_COL, 0.045);

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.08, 500);
    camera.position.set(0, PLAYER_H, -2);

    const listener = new THREE.AudioListener(); camera.add(listener);
    const audio = new Audio(listener.context);

    // Textures & Materials
    const flTex = floorTexture(); flTex.repeat.set(3, 3);
    const pkTex = pinkTexture();  pkTex.repeat.set(1, 2);
    const waTex = waterTexture(); waTex.repeat.set(4, 4);

    const matFloor     = new THREE.MeshStandardMaterial({ map: flTex, color: FLOOR_COL, roughness: 0.8, metalness: 0.05 });
    const matStep      = new THREE.MeshStandardMaterial({ map: flTex, color: STEP_COL, roughness: 0.7, metalness: 0.05 });
    const matPink      = new THREE.MeshStandardMaterial({ map: pkTex, color: PINK, roughness: 0.6, metalness: 0.1 });
    const matPinkLight = new THREE.MeshStandardMaterial({ map: pkTex, color: PINK_LIGHT, roughness: 0.5, metalness: 0.1 });
    const matPinkDark  = new THREE.MeshStandardMaterial({ color: PINK_DARK, roughness: 0.7, metalness: 0.15 });
    const matPillar    = new THREE.MeshStandardMaterial({ color: 0x4a1818, roughness: 0.8 });
    const matWater     = new THREE.MeshStandardMaterial({ map: waTex, color: 0x220202, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.95 });

    // Lights
    const diyaLight = new THREE.PointLight(0xffaa55, 0.8, 18, 2);
    diyaLight.position.set(0.3, -0.3, -0.5); diyaLight.castShadow = true;
    camera.add(diyaLight);
    const diyaFill = new THREE.PointLight(0xffcc88, 0.15, 8, 2);
    diyaFill.position.set(-0.3, -0.2, -0.3);
    camera.add(diyaFill); scene.add(camera);

    const sunLight = new THREE.DirectionalLight(0xff4444, 0.1);
    sunLight.position.set(20, 80, 10); sunLight.castShadow = true;
    scene.add(sunLight); scene.add(sunLight.target);
    scene.add(new THREE.HemisphereLight(0x1a0505, 0x050101, 0.15));

    // World Building
    const world = new THREE.Group(); scene.add(world);
    const topLanding = new THREE.Mesh(new THREE.BoxGeometry(STEP_W + 2, STEP_H, LANDING_D), matFloor);
    topLanding.position.set(0, 0, -LANDING_D / 2 + 0.5); 
    topLanding.receiveShadow = true; topLanding.castShadow = true;
    addOutline(topLanding); world.add(topLanding);

    // Wall behind the spawn to prevent walking backwards into the void
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(STEP_W + WALL_T * 2 + 2, WALL_H, WALL_T), matPinkDark);
    backWall.position.set(0, -WALL_H * 0.3, -LANDING_D + 0.5 - WALL_T / 2);
    backWall.receiveShadow = true; backWall.castShadow = true;
    addOutline(backWall); world.add(backWall);

    // Side walls for the spawn landing to match the rest of the well
    for (const side of[-1, 1]) {
        const topWall = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, LANDING_D), matPinkDark);
        topWall.position.set(side * (STEP_W / 2 + WALL_T / 2 + 0.5), -WALL_H * 0.3, -LANDING_D / 2 + 0.5);
        topWall.receiveShadow = true; topWall.castShadow = true;
        addOutline(topWall); world.add(topWall);
    }

    const pillars = []; const monoliths =[];
    const stepGeo = new THREE.BoxGeometry(STEP_W, STEP_H, STEP_D);
    const stepInst = new THREE.InstancedMesh(stepGeo, matStep, FLIGHTS * STEPS_PER_FLIGHT);
    stepInst.castShadow = true; stepInst.receiveShadow = true;
    
    const _m = new THREE.Object3D();
    let si = 0, cy = 0, cz = 0;
    const pinkMats =[matPink, matPinkLight, matPinkDark];

    for (let f = 0; f < FLIGHTS; f++) {
        const fy = cy, fz = cz;
        // Steps
        for (let s = 0; s < STEPS_PER_FLIGHT; s++) {
            cy -= STEP_H; cz += STEP_D;
            _m.position.set(0, cy, cz); _m.updateMatrix(); stepInst.setMatrixAt(si++, _m.matrix);
        }
        // Landing
        const land = new THREE.Mesh(new THREE.BoxGeometry(STEP_W + 2, STEP_H, LANDING_D), matFloor);
        cy -= STEP_H; cz += LANDING_D * 0.5;
        land.position.set(0, cy, cz); land.castShadow = true; land.receiveShadow = true;
        addOutline(land); world.add(land);
        cz += LANDING_D * 0.5;

        const wallLen = STEPS_PER_FLIGHT * STEP_D + LANDING_D;
        // Giant Walls
        for (const side of [-1, 1]) {
            const wm = pinkMats[(f + (side > 0 ? 1 : 0)) % pinkMats.length];
            const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, wallLen), wm);
            wall.position.set(side * (STEP_W / 2 + WALL_T / 2 + 0.5), fy - WALL_H * 0.3, fz + wallLen / 2);
            wall.castShadow = true; wall.receiveShadow = true; addOutline(wall); world.add(wall);
            
            // Shifting Monoliths outside walls
            if (f % 2 === 0) {
                const mx = side * (STEP_W / 2 + WALL_T + 8 + Math.random() * 15);
                const mz = fz + wallLen * 0.5 + (Math.random() - 0.5) * wallLen * 0.6;
                monoliths.push(new ShiftingMonolith(scene, mx, mz, fy - 10, 30 + Math.random() * 60, wm));
            }
        }
        // Diya Pillar Spawns
        if (f > 0 && f % PILLAR_EVERY === 0) {
            pillars.push(spawnPillar(scene, new THREE.Vector3(-STEP_W / 2 + 1.2, cy + STEP_H, cz - LANDING_D * 0.3), pillars.length, matPillar));
        }
    }
    stepInst.instanceMatrix.needsUpdate = true; world.add(stepInst);

    const totalRise = Math.abs(cy);
    const totalRun  = cz;
    const TOTAL_DIYAS = pillars.length;

    // Background distant monoliths
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2, dist = 60 + Math.random() * 80;
        monoliths.push(new ShiftingMonolith(scene, Math.cos(angle) * dist, totalRun * 0.5 + Math.sin(angle) * dist, -20, 50 + Math.random() * 80, pinkMats[i%3]));
    }

    // Black Water Pool
    const poolY = cy - 6;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), matWater);
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, poolY, cz);
    addOutline(pool); scene.add(pool);

    // Player State
    const st = {
        vel: new THREE.Vector3(), fwd: false, back: false, left: false, right: false,
        locked: false, started: false, ended: false, goodEnding: false,
        descent: 0, phase: 1, narShown: new Set(), diyasLit: 0,
        inWater: false, tDrip: 0, tWhisp: 0, tStress: 0,
    };
    let prevY = camera.position.y;

    // Controls
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const lockEl = renderer.domElement;
    document.addEventListener('mousemove', (e) => {
        if (!st.locked) return;
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= (e.movementX || 0) * 0.002; euler.x -= (e.movementY || 0) * 0.002;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    });
    document.addEventListener('pointerlockchange', () => {
        st.locked = document.pointerLockElement === lockEl;
        container.style.cursor = st.locked ? 'none' : 'default';
    });
    lockEl.addEventListener('click', () => {
        if (!st.started) return;
        if (!st.locked) lockEl.requestPointerLock();
        else tryLight();
    });

    const onKey = (e, isDown) => {
        if (!st.locked && isDown) return;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') st.fwd = isDown;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') st.back = isDown;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') st.left = isDown;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') st.right = isDown;
    };
    document.addEventListener('keydown', e => onKey(e, true));
    document.addEventListener('keyup', e => onKey(e, false));

    // Raycaster for floor & interaction
    const rayDown = new THREE.Raycaster(); const rayInt = new THREE.Raycaster();
    let colls = null;
    function groundYAt(pos) {
        rayDown.set(new THREE.Vector3(pos.x, pos.y + 3, pos.z), new THREE.Vector3(0, -1, 0)); rayDown.far = 8;
        if (!colls) { colls =[]; world.traverse(c => { if (c.isMesh) colls.push(c); }); colls.push(pool); }
        let hits = rayDown.intersectObjects(colls, false);
        if (hits.length) return hits[0].point.y;
        hits = rayDown.intersectObject(stepInst, false);
        if (hits.length) return hits[0].point.y;
        return null;
    }

    // Interaction & UI
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

    function tryLight() {
        rayInt.setFromCamera(new THREE.Vector2(0, 0), camera);
        const targets =[];
        pillars.forEach(p => { if (!p.userData.lit) p.traverse(c => { if (c.isMesh) targets.push(c); }); });
        const hits = rayInt.intersectObjects(targets, false);
        if (hits.length && hits[0].distance < INTERACT_RANGE) {
            let obj = hits[0].object;
            while (obj && !obj.userData.isDiyaPillar) obj = obj.parent;
            if (obj && !obj.userData.lit) {
                obj.userData.lit = true;
                obj.userData.light.intensity = 3.0;
                st.diyasLit++;
                audio.lightFX();
                showText(`Flames ignited: ${st.diyasLit} / ${TOTAL_DIYAS}`, 3000);
            }
        }
    }

    function enforceLoops() {
        if (camera.position.y > 5) {
            camera.position.y -= totalRise * 0.4; camera.position.z += totalRun * 0.4;
            showText('There is no escape. Only descent.'); audio.stress();
        }

        const depth = -camera.position.y;
        
        if (st.phase === 1 && depth > totalRise * 0.4) {
            if (st.diyasLit < 2) {
                loopPlayerBack();
                showText("The darkness is too thick. You must light the way.");
            } else {
                st.phase = 2; showPhase('THE WARM DEPTHS');
            }
        }
        
        if (st.phase === 2 && depth > totalRise * 0.75) {
            if (st.diyasLit < 4) {
                loopPlayerBack();
                showText("The shifting stone blocks your path. More light is needed.");
            } else {
                st.phase = 3; showPhase('THE BLOOD WATER');
            }
        }
    }

    function loopPlayerBack() {
        camera.position.y += 20; 
        camera.position.z -= 30;
        audio.stress();
        scene.fog.density = 0.2; 
        setTimeout(() => scene.fog.density = 0.045, 1000);
    }

    function tickEnding() {
        if (st.ended) return;
        if (camera.position.y <= poolY + 0.6) {
            st.ended = true; st.inWater = true;
            if (document.pointerLockElement) document.exitPointerLock();
            
            st.goodEnding = (st.diyasLit === TOTAL_DIYAS);
            
            const el = document.getElementById('baoli-ending');
            if (el) {
                el.style.display = 'flex'; el.style.opacity = '0';
                el.style.transition = 'opacity 4s ease';
                requestAnimationFrame(() => el.style.opacity = '1');
                
                if (st.goodEnding) {
                    audio.purifyFX();
                    el.innerHTML = "<h1>THE DEBT IS PAID</h1><p>The water clears. The curse is broken.</p>";
                } else {
                    audio.stress();
                    el.innerHTML = "<h1>CONSUMED</h1><p>You drown in the dark. The toll remains unpaid.</p>";
                }
            }
        }
    }

    // Loop
    const clock = new THREE.Clock(); let gt = 0, animId = null;

    function frame() {
        animId = requestAnimationFrame(frame);
        const dt = Math.min(clock.getDelta(), 0.08); gt += dt;

        const agitation = 1.0 - (st.diyasLit / TOTAL_DIYAS) * 0.8;
        for (const m of monoliths) m.update(gt, agitation);

        if (!st.started || (st.ended && !st.goodEnding)) { renderer.render(scene, camera); return; }

        if (st.locked && !st.ended) {
            const dir = new THREE.Vector3(), fwd = new THREE.Vector3();
            camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
            const rt = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
            if (st.fwd) dir.add(fwd); if (st.back) dir.sub(fwd);
            if (st.left) dir.sub(rt); if (st.right) dir.add(rt);
            if (dir.lengthSq() > 0) dir.normalize();
            
            camera.position.addScaledVector(dir, SPEED * dt);
            st.vel.y += GRAV * dt; camera.position.y += st.vel.y * dt;

            const gy = groundYAt(camera.position);
            if (gy !== null && camera.position.y < gy + PLAYER_H) { camera.position.y = gy + PLAYER_H; st.vel.y = 0; }
            if (camera.position.y < poolY - 1.5) { camera.position.y = poolY + PLAYER_H * 0.3; st.vel.y = 0; }
            camera.position.x = THREE.MathUtils.clamp(camera.position.x, -STEP_W / 2 + 0.35, STEP_W / 2 - 0.35);
        }

        const dy = prevY - camera.position.y; if (dy > 0) st.descent += dy;

        const f = 0.8 + Math.sin(gt * 7) * 0.08;
        diyaLight.intensity = f; diyaFill.intensity = f * 0.18;
        pillars.forEach(p => { if (p.userData.lit) p.userData.light.intensity = 3.0 + Math.sin(gt * 5 + p.userData.index) * 0.4; });

        if (!st.ended) {
            enforceLoops();
            tickEnding();
            
            for (let i = 0; i < NARRATIVE.length; i++) {
                if (!st.narShown.has(i) && st.descent > NARRATIVE[i].at) {
                    st.narShown.add(i); showText(NARRATIVE[i].text); audio.whisper(); break;
                }
            }

            if (gt - st.tDrip > 4) { audio.drip(); st.tDrip = gt; }
            if (st.fwd && gt - st.tStress > 6) { audio.stress(); st.tStress = gt; }
            
            const ratio = Math.min(1, st.descent / 200);
            scene.fog.density = 0.045 + ratio * 0.035;
        }

        if (st.ended && st.goodEnding) {
            scene.background.lerp(new THREE.Color(0x050a14), 0.01);
            scene.fog.color.lerp(new THREE.Color(0x02050a), 0.01);
            matWater.color.lerp(new THREE.Color(0x021122), 0.01);
            sunLight.color.lerp(new THREE.Color(0xffffff), 0.01);
            sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, 0.5, 0.01);
        }

        prevY = camera.position.y; renderer.render(scene, camera);
    }
    frame();

    return {
        start() {
            st.started = true; audio.start(); lockEl.requestPointerLock();
            setTimeout(() => showPhase('THE AWAKENING'), 800);
            setTimeout(() => showText('A pale light above. Blood below. The stairs wait.'), 3500);
        },
        destroy() {
            if (animId) cancelAnimationFrame(animId); audio.stop();
        }
    };
}