import { useEffect, registerHandler } from '../../../framework.js';

let _cleanup = null;

export default function BVHViewer() {

    useEffect(() => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        const init = async () => {
            const container = document.getElementById('bvh-canvas-wrap');
            if (!container) return;
            _cleanup = await initBVHScene(container);
        };
        init();
    }, []);

    registerHandler('bvh-upload', () => {
        document.getElementById('bvh-file-input')?.click();
    });

    registerHandler('bvh-toggle-play', () => {
        if (!window._bvhState) return;
        window._bvhState.playing = !window._bvhState.playing;
        const btn = document.querySelector('[data-action="bvh-toggle-play"]');
        if (btn) btn.textContent = window._bvhState.playing ? 'Pause' : 'Play';
    });

    registerHandler('bvh-reset-camera', () => {
        window._bvhState?.resetCamera?.();
    });

    registerHandler('bvh-toggle-grid', () => {
        if (window._bvhState?.grid) window._bvhState.grid.visible = !window._bvhState.grid.visible;
    });

    registerHandler('bvh-toggle-skeleton', () => {
        // Toggle skeleton helper lines on all skeletons
        if (window._bvhState?.skeletons) {
            for (const s of window._bvhState.skeletons) {
                if (s.skeletonHelper) s.skeletonHelper.visible = !s.skeletonHelper.visible;
            }
        }
    });

    registerHandler('bvh-toggle-info', () => {
        const panel = document.getElementById('bvh-skeleton-panel');
        if (panel) panel.classList.toggle('bvh-panel-visible');
    });

    registerHandler('bvh-remove-selected', () => {
        window._bvhState?.removeSelected?.();
    });

    return `
    <div class="bvh-root">
        <div class="bvh-toolbar">
            <a href="/" data-link class="bvh-back">Back</a>
            <span class="bvh-toolbar-title">BVH Viewer</span>
            <div class="bvh-toolbar-actions">
                <button data-action="bvh-upload" class="bvh-tool-btn">Add File</button>
                <button data-action="bvh-remove-selected" class="bvh-tool-btn bvh-btn-danger">Remove</button>
                <button data-action="bvh-toggle-play" class="bvh-tool-btn">Pause</button>
                <button data-action="bvh-reset-camera" class="bvh-tool-btn">Reset View</button>
                <button data-action="bvh-toggle-grid" class="bvh-tool-btn">Grid</button>
                <button data-action="bvh-toggle-skeleton" class="bvh-tool-btn">Lines</button>
                <button data-action="bvh-toggle-info" class="bvh-tool-btn">Info</button>
            </div>
        </div>

        <div class="bvh-viewport">
            <div id="bvh-canvas-wrap" class="bvh-canvas-wrap">
                <div id="bvh-drop-zone" class="bvh-drop-zone">
                    <div class="bvh-drop-icon">/\\/\\</div>
                    <p class="bvh-drop-text">Drag and drop <strong>.bvh</strong> files here</p>
                    <p class="bvh-drop-hint">or use the Add File button above</p>
                    <p class="bvh-drop-format">Load multiple files to compare animations side by side</p>
                </div>
            </div>

            <div id="bvh-skeleton-panel" class="bvh-skeleton-panel">
                <div class="bvh-panel-header">Loaded Skeletons</div>
                <div id="bvh-skeleton-list" class="bvh-panel-content">
                    <p class="bvh-panel-empty">No files loaded</p>
                </div>
                <div class="bvh-panel-header">Selected Info</div>
                <div id="bvh-skeleton-data" class="bvh-panel-content">
                    <p class="bvh-panel-empty">Select a skeleton</p>
                </div>
            </div>
        </div>

        <div class="bvh-status-bar">
            <span id="bvh-status">No file loaded</span>
            <span id="bvh-frame-info"></span>
            <span id="bvh-time-info"></span>
        </div>

        <input type="file" id="bvh-file-input" accept=".bvh" multiple style="display:none" />

        <div class="bvh-footer-note">
            Three.js BVH viewer. Load multiple motion capture files to compare side by side.
        </div>
    </div>`;
}

function buildBoneTree(bone, depth = 0) {
    const indent = '&nbsp;'.repeat(depth * 3);
    const prefix = depth === 0 ? '' : '|-- ';
    let html = `<div class="bvh-bone-row" style="opacity:${Math.max(0.4, 1 - depth * 0.08)}">${indent}${prefix}${bone.name || 'unnamed'}</div>`;
    for (const child of bone.children) {
        if (child.isBone) html += buildBoneTree(child, depth + 1);
    }
    return html;
}

/* ── Skeleton entry colors for distinguishing multiple skeletons ── */
const SKEL_COLORS = [
    { color: 0xff6600, emissive: 0xff4400, joint: 0xff8833, jointEmit: 0xff5500 },
    { color: 0x2299ff, emissive: 0x1177dd, joint: 0x44aaff, jointEmit: 0x2288dd },
    { color: 0x33dd66, emissive: 0x22aa44, joint: 0x55ee77, jointEmit: 0x33bb55 },
    { color: 0xdd44aa, emissive: 0xbb2288, joint: 0xee66bb, jointEmit: 0xcc3399 },
    { color: 0xffcc00, emissive: 0xddaa00, joint: 0xffdd44, jointEmit: 0xddbb22 },
    { color: 0xff4444, emissive: 0xdd2222, joint: 0xff6666, jointEmit: 0xdd3333 },
];

async function initBVHScene(container) {
    const THREE = await import('https://esm.sh/three@0.170.0');
    const { OrbitControls } = await import('https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js');
    const { BVHLoader } = await import('https://esm.sh/three@0.170.0/examples/jsm/loaders/BVHLoader.js');
    const { CSS2DRenderer, CSS2DObject } = await import('https://esm.sh/three@0.170.0/examples/jsm/renderers/CSS2DRenderer.js');

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    camera.position.set(0, 100, 300);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // CSS2D renderer for head labels
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.target.set(0, 80, 0);
    controls.update();

    const grid = new THREE.GridHelper(600, 60, 0x252525, 0x181818);
    scene.add(grid);

    // Ground plane for shadow reception
    const groundGeo = new THREE.PlaneGeometry(600, 600);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    // Lights
    scene.add(new THREE.HemisphereLight(0x8899bb, 0x222211, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    keyLight.position.set(100, 250, 150);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 600;
    keyLight.shadow.camera.left = -200;
    keyLight.shadow.camera.right = 200;
    keyLight.shadow.camera.top = 200;
    keyLight.shadow.camera.bottom = -200;
    keyLight.shadow.bias = -0.002;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x8899cc, 0.4);
    fillLight.position.set(-80, 80, -120);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xff9966, 0.3);
    rimLight.position.set(-40, 100, -200);
    scene.add(rimLight);

    /* ── Shared geometry ── */
    const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
    cylinderGeo.translate(0, 0.5, 0);
    const jointGeo = new THREE.SphereGeometry(1, 8, 6);

    /* ── Multi-skeleton state ── */
    const skeletons = [];   // array of skeleton entries
    let selectedId = null;
    let idCounter = 0;
    const clock = new THREE.Clock();

    const _v1 = new THREE.Vector3();
    const _v2 = new THREE.Vector3();
    const _dir = new THREE.Vector3();
    const _up = new THREE.Vector3(0, 1, 0);
    const _quat = new THREE.Quaternion();

    const savedCameraState = { position: new THREE.Vector3(), target: new THREE.Vector3() };

    /* ── Find the "head" bone: highest Y in the hierarchy ── */
    function findHeadBone(rootBone) {
        let best = rootBone;
        let bestY = -Infinity;
        const pos = new THREE.Vector3();
        function walk(bone) {
            bone.getWorldPosition(pos);
            if (pos.y > bestY) { bestY = pos.y; best = bone; }
            for (const c of bone.children) { if (c.isBone) walk(c); }
        }
        walk(rootBone);
        return best;
    }

    /* ── Create head label (CSS2DObject) ── */
    function createHeadLabel(name, colorHex) {
        const div = document.createElement('div');
        div.className = 'bvh-head-label';
        div.textContent = name;
        div.style.borderColor = '#' + colorHex.toString(16).padStart(6, '0');
        div.style.color = '#' + colorHex.toString(16).padStart(6, '0');
        const label = new CSS2DObject(div);
        label.position.set(0, 8, 0); // offset above head bone
        return label;
    }

    /* ── Update cylinders/joints for one skeleton entry ── */
    function updateEntryVisuals(entry) {
        for (const cyl of entry.cylinders) {
            const { bone, parentBone } = cyl.userData;
            parentBone.getWorldPosition(_v1);
            bone.getWorldPosition(_v2);
            _dir.subVectors(_v2, _v1);
            const len = _dir.length();
            if (len < 0.001) { cyl.visible = false; continue; }
            cyl.visible = true;
            cyl.position.copy(_v1);
            _dir.normalize();
            _quat.setFromUnitVectors(_up, _dir);
            cyl.quaternion.copy(_quat);
            const thickness = Math.max(0.8, len * 0.1);
            cyl.scale.set(thickness, len, thickness);
        }
        for (const jm of entry.joints) {
            jm.userData.bone.getWorldPosition(_v1);
            jm.position.copy(_v1);
            jm.scale.setScalar(jm.userData.radius || 1.2);
        }
    }

    /* ── Create visual meshes for a skeleton entry ── */
    function buildVisuals(entry, rootBone) {
        const ci = entry.colorIndex;
        const col = SKEL_COLORS[ci % SKEL_COLORS.length];
        const cylMat = new THREE.MeshStandardMaterial({
            color: col.color, emissive: col.emissive, emissiveIntensity: 0.2,
            roughness: 0.35, metalness: 0.15,
        });
        const jntMat = new THREE.MeshStandardMaterial({
            color: col.joint, emissive: col.jointEmit, emissiveIntensity: 0.15,
            roughness: 0.3, metalness: 0.2,
        });
        entry.cylMat = cylMat;
        entry.jntMat = jntMat;

        function walk(bone) {
            const jm = new THREE.Mesh(jointGeo, jntMat);
            jm.castShadow = true;
            jm.userData.bone = bone;
            let avgLen = 0, cc = 0;
            for (const c of bone.children) { if (c.isBone) { avgLen += c.position.length(); cc++; } }
            jm.userData.radius = cc > 0 ? Math.max(0.8, (avgLen / cc) * 0.12) : 0.8;
            scene.add(jm);
            entry.joints.push(jm);

            for (const child of bone.children) {
                if (!child.isBone) continue;
                const cyl = new THREE.Mesh(cylinderGeo, cylMat);
                cyl.castShadow = true;
                cyl.userData.bone = child;
                cyl.userData.parentBone = bone;
                scene.add(cyl);
                entry.cylinders.push(cyl);
                walk(child);
            }
        }
        walk(rootBone);
    }

    /* ── Ground a skeleton container so lowest bone = Y 0 ── */
    function groundEntry(entry) {
        const cont = entry.container;
        cont.position.y = 0;
        cont.updateMatrixWorld(true);
        const pos = new THREE.Vector3();
        let minY = Infinity;
        function walkMin(bone) {
            bone.getWorldPosition(pos);
            if (pos.y < minY) minY = pos.y;
            for (const c of bone.children) { if (c.isBone) walkMin(c); }
        }
        const root = cont.children[0];
        if (root) walkMin(root);
        if (isFinite(minY)) {
            cont.position.y = -minY;
            cont.updateMatrixWorld(true);
        }
    }

    /* ── Frame camera to fit all skeletons ── */
    function frameAll() {
        if (skeletons.length === 0) return;
        const bbox = new THREE.Box3();
        const pos = new THREE.Vector3();
        for (const entry of skeletons) {
            groundEntry(entry);
            entry.container.updateMatrixWorld(true);
            const root = entry.container.children[0];
            if (!root) continue;
            (function walk(bone) {
                bone.getWorldPosition(pos);
                bbox.expandByPoint(pos);
                for (const c of bone.children) { if (c.isBone) walk(c); }
            })(root);
        }
        if (bbox.isEmpty()) return;
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fovRad = camera.fov * Math.PI / 180;
        const dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.6;

        controls.target.copy(center);
        camera.position.set(center.x + dist * 0.15, center.y, center.z + dist);
        camera.lookAt(center);
        controls.update();
        savedCameraState.position.copy(camera.position);
        savedCameraState.target.copy(controls.target);
    }

    /* ── Remove a skeleton entry ── */
    function removeEntry(id) {
        const idx = skeletons.findIndex(e => e.id === id);
        if (idx === -1) return;
        const entry = skeletons[idx];
        // Remove 3D objects
        for (const cyl of entry.cylinders) scene.remove(cyl);
        for (const jm of entry.joints) scene.remove(jm);
        if (entry.skeletonHelper) scene.remove(entry.skeletonHelper);
        if (entry.container) scene.remove(entry.container);
        if (entry.headLabel) {
            if (entry.headLabel.parent) entry.headLabel.parent.remove(entry.headLabel);
            scene.remove(entry.headLabel);
        }
        entry.cylMat?.dispose();
        entry.jntMat?.dispose();
        skeletons.splice(idx, 1);
        if (selectedId === id) selectedId = skeletons.length > 0 ? skeletons[0].id : null;
        // Re-position remaining skeletons
        repositionSkeletons();
        refreshSkeletonList();
        updateStatusBar();
        if (skeletons.length === 0) {
            const dz = document.getElementById('bvh-drop-zone');
            if (dz) dz.style.display = '';
        }
    }

    /* ── Spread skeletons along X axis so they don't overlap ── */
    function repositionSkeletons() {
        const spacing = 120;
        const totalWidth = (skeletons.length - 1) * spacing;
        skeletons.forEach((entry, i) => {
            entry.container.position.x = -totalWidth / 2 + i * spacing;
        });
    }

    /* ── Select a skeleton ── */
    function selectSkeleton(id) {
        selectedId = id;
        refreshSkeletonList();
        showSelectedInfo();
    }

    /* ── Refresh the skeleton list in the side panel ── */
    function refreshSkeletonList() {
        const listEl = document.getElementById('bvh-skeleton-list');
        if (!listEl) return;
        if (skeletons.length === 0) {
            listEl.innerHTML = '<p class="bvh-panel-empty">No files loaded</p>';
            return;
        }
        listEl.innerHTML = skeletons.map(entry => {
            const col = SKEL_COLORS[entry.colorIndex % SKEL_COLORS.length];
            const hexCol = '#' + col.color.toString(16).padStart(6, '0');
            const sel = entry.id === selectedId ? ' bvh-skel-item-selected' : '';
            return `<div class="bvh-skel-item${sel}" data-skel-id="${entry.id}">
                <span class="bvh-skel-dot" style="background:${hexCol}"></span>
                <span class="bvh-skel-name">${entry.fileName}</span>
                <span class="bvh-skel-meta">${entry.boneCount}b / ${entry.duration.toFixed(1)}s</span>
                <button class="bvh-skel-remove" data-remove-id="${entry.id}">x</button>
            </div>`;
        }).join('');

        // Attach click listeners
        listEl.querySelectorAll('.bvh-skel-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('bvh-skel-remove')) return;
                selectSkeleton(Number(el.dataset.skelId));
            });
        });
        listEl.querySelectorAll('.bvh-skel-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeEntry(Number(btn.dataset.removeId));
            });
        });
    }

    /* ── Show data for selected skeleton ── */
    function showSelectedInfo() {
        const dataPanel = document.getElementById('bvh-skeleton-data');
        if (!dataPanel) return;
        const entry = skeletons.find(e => e.id === selectedId);
        if (!entry) {
            dataPanel.innerHTML = '<p class="bvh-panel-empty">Select a skeleton</p>';
            return;
        }
        const rootBone = entry.container.children[0];
        dataPanel.innerHTML = `
            <div class="bvh-data-grid">
                <div class="bvh-data-item"><span class="bvh-data-label">File</span><span class="bvh-data-value">${entry.fileName}</span></div>
                <div class="bvh-data-item"><span class="bvh-data-label">Bones</span><span class="bvh-data-value">${entry.boneCount}</span></div>
                <div class="bvh-data-item"><span class="bvh-data-label">Duration</span><span class="bvh-data-value">${entry.duration.toFixed(2)}s</span></div>
                <div class="bvh-data-item"><span class="bvh-data-label">Frames</span><span class="bvh-data-value">${entry.frames}</span></div>
                <div class="bvh-data-item"><span class="bvh-data-label">FPS</span><span class="bvh-data-value">${entry.fps}</span></div>
                <div class="bvh-data-item"><span class="bvh-data-label">Tracks</span><span class="bvh-data-value">${entry.tracks}</span></div>
            </div>
            ${rootBone ? `<div class="bvh-bone-tree-header">Bone Hierarchy</div><div class="bvh-bone-tree">${buildBoneTree(rootBone)}</div>` : ''}
        `;
    }

    function updateStatusBar() {
        const statusEl = document.getElementById('bvh-status');
        const frameEl = document.getElementById('bvh-frame-info');
        const timeEl = document.getElementById('bvh-time-info');
        if (skeletons.length === 0) {
            if (statusEl) statusEl.textContent = 'No file loaded';
            if (frameEl) frameEl.textContent = '';
            if (timeEl) timeEl.textContent = '';
        } else {
            if (statusEl) statusEl.textContent = `${skeletons.length} skeleton${skeletons.length > 1 ? 's' : ''} loaded`;
            const totalBones = skeletons.reduce((s, e) => s + e.boneCount, 0);
            if (frameEl) frameEl.textContent = `${totalBones} total bones`;
            const sel = skeletons.find(e => e.id === selectedId);
            if (timeEl) timeEl.textContent = sel ? `Selected: ${sel.fileName}` : '';
        }
    }

    /* ── Load a BVH file as a new skeleton entry ── */
    function loadBVHData(text, fileName) {
        const loader = new BVHLoader();
        const result = loader.parse(text);
        const rootBone = result.skeleton.bones[0];
        const clip = result.clip;

        const id = ++idCounter;
        const colorIndex = (id - 1) % SKEL_COLORS.length;

        // Skeleton helper (thin lines)
        const skeletonHelper = new THREE.SkeletonHelper(rootBone);
        skeletonHelper.material.linewidth = 1;
        skeletonHelper.material.opacity = 0.3;
        skeletonHelper.material.transparent = true;
        scene.add(skeletonHelper);

        // Bone container
        const boneContainer = new THREE.Group();
        boneContainer.add(rootBone);
        scene.add(boneContainer);

        // Mixer
        const mixer = new THREE.AnimationMixer(rootBone);
        const action = mixer.clipAction(clip);
        action.play();

        const entry = {
            id,
            fileName,
            colorIndex,
            skeletonHelper,
            container: boneContainer,
            mixer,
            action,
            clip,
            boneCount: result.skeleton.bones.length,
            duration: clip.duration,
            frames: clip.tracks.length > 0 ? clip.tracks[0].times.length : 0,
            fps: clip.tracks.length > 0 ? Math.round(clip.tracks[0].times.length / clip.duration) : 0,
            tracks: clip.tracks.length,
            cylinders: [],
            joints: [],
            cylMat: null,
            jntMat: null,
            headBone: null,
            headLabel: null,
        };

        // Build visual meshes
        buildVisuals(entry, rootBone);

        // Find head bone and attach label
        mixer.update(0);
        boneContainer.updateMatrixWorld(true);
        const headBone = findHeadBone(rootBone);
        entry.headBone = headBone;
        const col = SKEL_COLORS[colorIndex % SKEL_COLORS.length];
        const label = createHeadLabel(fileName, col.color);
        headBone.add(label);
        entry.headLabel = label;

        skeletons.push(entry);
        selectedId = id;

        // Position all skeletons
        repositionSkeletons();

        // Ground & settle
        groundEntry(entry);
        updateEntryVisuals(entry);

        // Hide drop zone
        const dz = document.getElementById('bvh-drop-zone');
        if (dz) dz.style.display = 'none';

        refreshSkeletonList();
        showSelectedInfo();
        updateStatusBar();

        // Frame after settling
        setTimeout(() => {
            for (const e of skeletons) { if (e.mixer) e.mixer.update(0); groundEntry(e); }
            frameAll();
        }, 100);
    }

    /* ── Global state ── */
    const state = {
        playing: true,
        grid,
        skeletons,
        resetCamera: () => {
            if (savedCameraState.position.length() > 0) {
                camera.position.copy(savedCameraState.position);
                controls.target.copy(savedCameraState.target);
                controls.update();
            } else {
                frameAll();
            }
        },
        removeSelected: () => {
            if (selectedId != null) removeEntry(selectedId);
        },
    };
    window._bvhState = state;

    /* ── File input ── */
    const fileInput = document.getElementById('bvh-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            for (const file of e.target.files) {
                if (!file.name.endsWith('.bvh')) continue;
                const reader = new FileReader();
                reader.onload = (ev) => loadBVHData(ev.target.result, file.name);
                reader.readAsText(file);
            }
            fileInput.value = '';
        });
    }

    container.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); container.classList.add('bvh-dragover'); });
    container.addEventListener('dragleave', () => { container.classList.remove('bvh-dragover'); });
    container.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation();
        container.classList.remove('bvh-dragover');
        for (const file of e.dataTransfer.files) {
            if (!file.name.endsWith('.bvh')) continue;
            const reader = new FileReader();
            reader.onload = (ev) => loadBVHData(ev.target.result, file.name);
            reader.readAsText(file);
        }
    });

    /* ── Resize ── */
    function onResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        labelRenderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    /* ── Animation loop ── */
    let animId = null;
    function animate() {
        animId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        for (const entry of skeletons) {
            if (state.playing && entry.mixer) {
                entry.mixer.update(delta);
                groundEntry(entry);
            }
            updateEntryVisuals(entry);
        }
        controls.update();
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    }
    animate();

    /* ── Cleanup ── */
    return function cleanup() {
        window.removeEventListener('resize', onResize);
        if (animId) cancelAnimationFrame(animId);
        for (const entry of skeletons) {
            for (const cyl of entry.cylinders) scene.remove(cyl);
            for (const jm of entry.joints) scene.remove(jm);
            if (entry.skeletonHelper) scene.remove(entry.skeletonHelper);
            if (entry.container) scene.remove(entry.container);
            if (entry.headLabel) { if (entry.headLabel.parent) entry.headLabel.parent.remove(entry.headLabel); }
            entry.cylMat?.dispose();
            entry.jntMat?.dispose();
        }
        skeletons.length = 0;
        cylinderGeo.dispose();
        jointGeo.dispose();
        renderer.dispose();
        controls.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        if (labelRenderer.domElement.parentNode) labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
        window._bvhState = null;
    };
}
