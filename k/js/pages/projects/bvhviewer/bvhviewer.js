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
        if (window._bvhState) {
            window._bvhState.playing = !window._bvhState.playing;
            const btn = document.querySelector('[data-action="bvh-toggle-play"]');
            if (btn) btn.textContent = window._bvhState.playing ? '⏸' : '▶';
        }
    });

    registerHandler('bvh-reset-camera', () => {
        if (window._bvhState?.controls) {
            window._bvhState.controls.reset();
        }
    });

    registerHandler('bvh-toggle-grid', () => {
        if (window._bvhState?.grid) {
            window._bvhState.grid.visible = !window._bvhState.grid.visible;
        }
    });

    registerHandler('bvh-toggle-bones', () => {
        if (window._bvhState?.skeletonHelper) {
            window._bvhState.skeletonHelper.visible = !window._bvhState.skeletonHelper.visible;
        }
    });

    return `
    <div class="bvh-root">
        <div class="bvh-toolbar">
            <a href="/" data-link class="bvh-back">&larr; Back</a>
            <span class="bvh-toolbar-title">BVH Viewer</span>
            <div class="bvh-toolbar-actions">
                <button data-action="bvh-upload" class="bvh-tool-btn" title="Load BVH file">&#128194; Load</button>
                <button data-action="bvh-toggle-play" class="bvh-tool-btn" title="Play / Pause">⏸</button>
                <button data-action="bvh-reset-camera" class="bvh-tool-btn" title="Reset camera">&#8634;</button>
                <button data-action="bvh-toggle-grid" class="bvh-tool-btn" title="Toggle grid">&#9638;</button>
                <button data-action="bvh-toggle-bones" class="bvh-tool-btn" title="Toggle bones">&#9776;</button>
            </div>
        </div>

        <div id="bvh-canvas-wrap" class="bvh-canvas-wrap">
            <div id="bvh-drop-zone" class="bvh-drop-zone">
                <div class="bvh-drop-icon">&#9863;</div>
                <p class="bvh-drop-text">Drag &amp; drop a <strong>.bvh</strong> file here<br>or click Load above</p>
                <p class="bvh-drop-hint">Biovision Hierarchy motion capture format</p>
            </div>
        </div>

        <div class="bvh-status-bar">
            <span id="bvh-status">No file loaded</span>
            <span id="bvh-frame-info"></span>
        </div>

        <input type="file" id="bvh-file-input" accept=".bvh" style="display:none" />

        <div class="bvh-info-panel">
            <p>&#128218; A Three.js-based viewer for BVH (Biovision Hierarchy) motion capture files. Built for academic and educational purposes — explore skeletal animation data in real time.</p>
        </div>
    </div>`;
}

async function initBVHScene(container) {
    const THREE = await import('https://esm.sh/three@0.170.0');
    const { OrbitControls } = await import('https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js');
    const { BVHLoader } = await import('https://esm.sh/three@0.170.0/examples/jsm/loaders/BVHLoader.js');

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 100, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 80, 0);
    controls.update();

    const grid = new THREE.GridHelper(400, 40, 0x222222, 0x161616);
    scene.add(grid);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 200, 100);
    scene.add(dirLight);

    let mixer = null;
    let skeletonHelper = null;
    let clock = new THREE.Clock();

    const state = {
        playing: true,
        controls,
        grid,
        skeletonHelper: null,
    };
    window._bvhState = state;

    function loadBVHData(text, fileName) {
        const loader = new BVHLoader();
        const result = loader.parse(text);

        if (skeletonHelper) {
            scene.remove(skeletonHelper);
            skeletonHelper = null;
        }
        if (mixer) mixer = null;

        skeletonHelper = new THREE.SkeletonHelper(result.skeleton.bones[0]);
        skeletonHelper.material.linewidth = 2;
        scene.add(skeletonHelper);
        state.skeletonHelper = skeletonHelper;

        const boneContainer = new THREE.Group();
        boneContainer.add(result.skeleton.bones[0]);
        scene.add(boneContainer);

        mixer = new THREE.AnimationMixer(result.skeleton.bones[0]);
        const clip = result.clip;
        mixer.clipAction(clip).play();

        const statusEl = document.getElementById('bvh-status');
        const frameEl = document.getElementById('bvh-frame-info');
        if (statusEl) statusEl.textContent = fileName;
        if (frameEl) frameEl.textContent = `${result.skeleton.bones.length} bones · ${clip.duration.toFixed(1)}s`;

        const dropZone = document.getElementById('bvh-drop-zone');
        if (dropZone) dropZone.style.display = 'none';

        const bbox = new THREE.Box3().setFromObject(skeletonHelper);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        controls.target.copy(center);
        camera.position.set(center.x, center.y + size.y * 0.3, center.z + size.y * 1.5);
        controls.update();
    }

    const fileInput = document.getElementById('bvh-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => loadBVHData(ev.target.result, file.name);
            reader.readAsText(file);
        });
    }

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        container.classList.add('bvh-dragover');
    });
    container.addEventListener('dragleave', () => {
        container.classList.remove('bvh-dragover');
    });
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        container.classList.remove('bvh-dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.bvh')) {
            const reader = new FileReader();
            reader.onload = (ev) => loadBVHData(ev.target.result, file.name);
            reader.readAsText(file);
        }
    });

    function onResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    let animId = null;
    function animate() {
        animId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        if (mixer && state.playing) mixer.update(delta);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    return function cleanup() {
        window.removeEventListener('resize', onResize);
        if (animId) cancelAnimationFrame(animId);
        renderer.dispose();
        controls.dispose();
        if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        window._bvhState = null;
    };
}
