import { useEffect, registerHandler } from '../../framework.js';
import { uid, escapeHtml, renderMarkdown, showToast, placeCaretEnd } from './lib/utils.js';
import { COLORS, COLOR_HEX, COLOR_NAMES, COLUMNS, KB_COL_W, KB_H, SLOTS, LONGFORM_AT } from './lib/constants.js';
import { blankState, loadState, saveState, saveStateDebounced, pushUndo, undoState } from './lib/state.js';
import { applyViewport, screenToCanvas, resizeSketch } from './lib/viewport.js';
import { createCard, softDelete, restoreCard, renderCards, renderTrash } from './lib/cards.js';
import { renderKanbanBoard, updateKanbanCounts, columnAtCanvasPoint, stackPositionFor, toggleBoard, assignColumn } from './lib/kanban.js';
import { initSketchState, setSketchTool, toggleSketchPalette, drawStroke, redrawSketch, eraseAt, onSketchMouseDown, onSketchMouseMove, onSketchMouseUp } from './lib/sketch.js';
import { openTriage, closeTriage, triageAction } from './lib/triage.js';
import { renderDayPlanner, slotAtScreenPoint } from './lib/planner.js';
import { enterFocus, exitFocus } from './lib/focus.js';

let _cleanup = null;

export default function IThinkThereforeIAm() {

    useEffect(() => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        _cleanup = initCanvas();
    }, []);

    return `
    <div id="canvas-root">
        <link rel="stylesheet" href="/k/js/pages/ithinkthereforiam/ithinkthereforiam.css">

        <div id="app-title">
            <div class="cogito">I think, therefore I am</div>
            <div class="tagline">dump first &middot; sort later</div>
        </div>

        <div id="empty-hint">
            <div class="big">I think&hellip;</div>
            <div class="small">double-click anywhere to finish that thought &middot; or just start typing</div>
        </div>

        <div id="canvas-surface">
            <div id="canvas-grid"></div>
            <div id="kanban-board"></div>
        </div>

        <canvas id="sketch-canvas"></canvas>
        <div id="focus-overlay"></div>

        <div id="triage">
            <div class="triage-label">what do I want to do with this?</div>
            <div class="triage-card card-yellow" id="triage-card-el"></div>
            <div class="triage-actions">
                <button class="triage-btn" data-triage="Now">Now</button>
                <button class="triage-btn" data-triage="Next">Next</button>
                <button class="triage-btn" data-triage="Later">Later</button>
                <button class="triage-btn quiet" data-triage="skip">leave it floating</button>
                <button class="triage-btn quiet" data-triage="trash">let it go</button>
            </div>
            <div class="triage-progress" id="triage-progress"></div>
        </div>

        <div id="sketch-palette">
            <button class="toolbar-btn" data-tool="pen"><span>&#9998;</span><span class="tooltip">Pen</span></button>
            <button class="toolbar-btn" data-tool="arrow"><span>&#8599;</span><span class="tooltip">Arrow</span></button>
            <button class="toolbar-btn" data-tool="rect"><span>&#9645;</span><span class="tooltip">Box</span></button>
            <button class="toolbar-btn" data-tool="eraser"><span>&#9676;</span><span class="tooltip">Eraser</span></button>
        </div>

        <div id="canvas-toolbar">
            <button class="toolbar-btn" id="btn-new">
                <span>&#10022;</span><span class="tooltip">New thought (N, or just type)</span>
            </button>
            <button class="toolbar-btn" id="btn-kanban">
                <span>&#9776;</span><span class="tooltip">My board (K)</span>
            </button>
            <button class="toolbar-btn" id="btn-focus">
                <span>&#9673;</span><span class="tooltip">Focus on selected (F)</span>
            </button>
            <button class="toolbar-btn" id="btn-sketch">
                <span>&#9998;</span><span class="tooltip">Sketch (S)</span>
            </button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" id="btn-sort">
                <span>&#8645;</span><span class="tooltip">Sort my thoughts</span>
            </button>
            <button class="toolbar-btn" id="btn-planner">
                <span>&#9636;</span><span class="tooltip">Plan today</span>
            </button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" id="btn-export">
                <span>&#8595;</span><span class="tooltip">Save my thoughts (JSON)</span>
            </button>
            <button class="toolbar-btn" id="btn-clear">
                <span>&#10005;</span><span class="tooltip">Forget everything</span>
            </button>
        </div>

        <div id="day-planner">
            <h3>Plan today</h3>
            <div class="planner-hint">drag a thought onto a slot</div>
            <div id="planner-slots"></div>
        </div>

        <div id="trash-tray">
            <button id="trash-toggle">things I let go &middot; <span id="trash-count">0</span></button>
            <div id="trash-list"></div>
        </div>

        <div id="settings-panel">
            <button id="settings-toggle">&#9881;</button>
            <div id="settings-dropdown">
                <div class="settings-section">
                    <div class="settings-label">Theme</div>
                    <div class="settings-row">
                        <button class="settings-chip" data-theme="light">Light</button>
                        <button class="settings-chip" data-theme="dark">Dark</button>
                        <button class="settings-chip" data-theme="auto">Auto</button>
                    </div>
                </div>
                <div class="settings-section">
                    <div class="settings-label">Card font</div>
                    <div class="settings-row">
                        <button class="settings-chip" data-font="caveat" style="font-family:'Caveat',cursive">Handwritten</button>
                        <button class="settings-chip" data-font="grotesk" style="font-family:'Space Grotesk',sans-serif">Clean</button>
                        <button class="settings-chip" data-font="inter" style="font-family:'Inter',sans-serif">Inter</button>
                        <button class="settings-chip" data-font="baskerville" style="font-family:'Libre Baskerville',serif">Serif</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="disclaimer-bar">
            everything stays in this browser. nothing touches a server.
            <button id="disclaimer-dismiss">ok</button>
        </div>

        <div id="undo-toast">undone</div>
    </div>
    `;
}

function initCanvas() {
    // --- Build shared context for all modules ---
    const sketchCanvasEl = document.getElementById('sketch-canvas');
    const ctx = {
        dom: {
            root: document.getElementById('canvas-root'),
            surface: document.getElementById('canvas-surface'),
            sketchCanvas: sketchCanvasEl,
            focusOverlay: document.getElementById('focus-overlay'),
            dayPlanner: document.getElementById('day-planner'),
            kanbanBoard: document.getElementById('kanban-board'),
            emptyHint: document.getElementById('empty-hint'),
            triageEl: document.getElementById('triage'),
        },
        sketchCtx: sketchCanvasEl.getContext('2d'),
        state: loadState(),
        viewport: null,
        sketch: initSketchState(),
        undoStack: [],
        saveTimer: null,
        colorCursor: 0,
        selectedCardId: null,
        focusMode: false,
        triageQueue: [],
    };
    ctx.viewport = ctx.state.viewport || { x: 0, y: 0, zoom: 1 };
    ctx.colorCursor = ctx.state.colorCursor || 0;

    const { root, surface, dayPlanner, kanbanBoard, triageEl } = ctx.dom;

    // --- Local interaction state ---
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let dragCard = null;
    let dragOffset = { x: 0, y: 0 };
    let dragMoved = false;

    // --- Convenience wrappers ---
    function doRenderAll() {
        renderKanbanBoard(ctx);
        renderCards(ctx);
        applyViewport(ctx);
        redrawSketch(ctx);
        renderDayPlanner(ctx);
    }

    function doUndo() {
        if (undoState(ctx)) {
            doRenderAll();
            showToast('undone');
        }
    }

    // --- First visit seed ---
    function seedSamples() {
        if (ctx.state.seeded) return;
        ctx.state.seeded = true;
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const samples = [
            { dx: -300, dy: -160, color: 'card-yellow', text: 'double-click anywhere.\nthat is how I was made' },
            { dx: 60, dy: -190, color: 'card-sky', text: 'or just start typing.\na thought will catch your words' },
            { dx: -120, dy: 30, color: 'card-sage', text: 'press K to open the board.\ndrag me into Done. it feels nice' },
            { dx: 180, dy: 80, color: 'card-lavender', text: 'when it gets messy, press Sort.\none thought at a time\n- [ ] this is a checkbox, tap it' }
        ];
        samples.forEach((s, i) => {
            ctx.state.cards.push({
                id: uid(), x: cx + s.dx, y: cy + s.dy,
                text: s.text, color: s.color,
                column: null, timeSlot: null, created: Date.now() + i
            });
        });
        saveState(ctx);
    }

    function onResize() {
        resizeSketch(ctx);
        redrawSketch(ctx);
    }

    // --- Settings: theme + font ---
    function loadSettings() {
        try {
            return JSON.parse(localStorage.getItem('ithink_settings') || '{}');
        } catch { return {}; }
    }

    function saveSettings(settings) {
        localStorage.setItem('ithink_settings', JSON.stringify(settings));
    }

    function applySettings(settings) {
        // Theme
        root.classList.remove('theme-dark');
        const theme = settings.theme || 'light';
        if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.classList.add('theme-dark');
        }
        // Font
        root.classList.remove('font-inter', 'font-baskerville', 'font-grotesk');
        const font = settings.font || 'caveat';
        if (font !== 'caveat') root.classList.add('font-' + font);

        // Update chips
        document.querySelectorAll('[data-theme]').forEach(el =>
            el.classList.toggle('active', el.dataset.theme === (settings.theme || 'light')));
        document.querySelectorAll('[data-font]').forEach(el =>
            el.classList.toggle('active', el.dataset.font === (settings.font || 'caveat')));
    }

    const settings = loadSettings();
    applySettings(settings);

    // Listen for OS dark mode changes when set to auto
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const s = loadSettings();
        if (s.theme === 'auto') applySettings(s);
    });

    document.getElementById('settings-toggle').addEventListener('click', () => {
        document.getElementById('settings-dropdown').classList.toggle('open');
    });

    document.getElementById('settings-dropdown').addEventListener('click', (e) => {
        const chip = e.target.closest('.settings-chip');
        if (!chip) return;
        const s = loadSettings();
        if (chip.dataset.theme) s.theme = chip.dataset.theme;
        if (chip.dataset.font) s.font = chip.dataset.font;
        saveSettings(s);
        applySettings(s);
    });

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#settings-panel')) {
            document.getElementById('settings-dropdown').classList.remove('open');
        }
    });

    // ============ EVENTS ============

    root.addEventListener('mousedown', (e) => {
        if (ctx.sketch.tool) return;
        if (e.target.closest('.canvas-card') || e.target.closest('#canvas-toolbar') ||
            e.target.closest('#day-planner') || e.target.closest('#disclaimer-bar') ||
            e.target.closest('#trash-tray') || e.target.closest('#sketch-palette') ||
            e.target.closest('#triage') || e.target.closest('#settings-panel')) return;

        if (e.detail === 2) {
            const pos = screenToCanvas(ctx, e.clientX, e.clientY);
            createCard(ctx, pos.x - 90, pos.y - 30);
            return;
        }

        ctx.selectedCardId = null;
        if (ctx.focusMode) exitFocus(ctx); else renderCards(ctx);

        isPanning = true;
        panStart = { x: e.clientX - ctx.viewport.x, y: e.clientY - ctx.viewport.y };
        root.classList.add('grabbing');
    });

    root.addEventListener('mousemove', (e) => {
        if (isPanning) {
            ctx.viewport.x = e.clientX - panStart.x;
            ctx.viewport.y = e.clientY - panStart.y;
            applyViewport(ctx);
            redrawSketch(ctx);
        }

        if (dragCard) {
            dragMoved = true;
            const pos = screenToCanvas(ctx, e.clientX, e.clientY);
            const card = ctx.state.cards.find(c => c.id === dragCard);
            if (card) {
                card.x = pos.x - dragOffset.x;
                card.y = pos.y - dragOffset.y;
                const el = surface.querySelector(`.canvas-card[data-id="${dragCard}"]`);
                if (el) { el.style.left = card.x + 'px'; el.style.top = card.y + 'px'; }

                const col = columnAtCanvasPoint(ctx, card.x + 90, card.y + 30);
                kanbanBoard.querySelectorAll('.kb-col').forEach(c =>
                    c.classList.toggle('drag-over', c.dataset.col === col));

                const slot = slotAtScreenPoint(ctx, e.clientX, e.clientY);
                dayPlanner.querySelectorAll('.time-slot').forEach(s =>
                    s.classList.toggle('drag-over', s.dataset.slot === slot));
            }
        }
    });

    root.addEventListener('mouseup', (e) => {
        if (isPanning) {
            isPanning = false;
            root.classList.remove('grabbing');
            saveStateDebounced(ctx);
        }

        if (dragCard) {
            const el = surface.querySelector(`.canvas-card[data-id="${dragCard}"]`);
            if (el) el.classList.remove('dragging');
            const card = ctx.state.cards.find(c => c.id === dragCard);

            if (card && dragMoved) {
                const slot = slotAtScreenPoint(ctx, e.clientX, e.clientY);
                if (slot) {
                    const def = SLOTS.find(s => s.id === slot);
                    const inSlot = ctx.state.cards.filter(c => c.timeSlot === slot).length;
                    if (def.cap && inSlot >= def.cap && card.timeSlot !== slot) {
                        showToast('three is the point. swap one out first');
                    } else {
                        pushUndo(ctx);
                        card.timeSlot = slot;
                    }
                    renderDayPlanner(ctx);
                } else {
                    assignColumn(ctx, card, columnAtCanvasPoint(ctx, card.x + 90, card.y + 30));
                }
                renderCards(ctx);
            }

            kanbanBoard.querySelectorAll('.kb-col').forEach(c => c.classList.remove('drag-over'));
            dayPlanner.querySelectorAll('.time-slot').forEach(s => s.classList.remove('drag-over'));
            dragCard = null;
            dragMoved = false;
            saveState(ctx);
        }
    });

    root.addEventListener('wheel', (e) => {
        if (e.target.closest('#canvas-toolbar') || e.target.closest('#day-planner') || e.target.closest('#trash-list')) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(3, Math.max(0.2, ctx.viewport.zoom * delta));
        ctx.viewport.x = e.clientX - (e.clientX - ctx.viewport.x) * (newZoom / ctx.viewport.zoom);
        ctx.viewport.y = e.clientY - (e.clientY - ctx.viewport.y) * (newZoom / ctx.viewport.zoom);
        ctx.viewport.zoom = newZoom;
        applyViewport(ctx);
        redrawSketch(ctx);
        saveStateDebounced(ctx);
    }, { passive: false });

    // Card interactions (delegated)
    surface.addEventListener('mousedown', (e) => {
        const cardEl = e.target.closest('.canvas-card');
        if (!cardEl) return;

        if (e.target.closest('.card-delete')) {
            softDelete(ctx, e.target.closest('.card-delete').dataset.delete);
            return;
        }

        if (e.target.classList.contains('card-color-dot')) {
            pushUndo(ctx);
            const card = ctx.state.cards.find(c => c.id === e.target.dataset.card);
            if (card) { card.color = e.target.dataset.color; renderCards(ctx); saveState(ctx); }
            return;
        }

        if (e.target.classList.contains('chk-box')) {
            const li = parseInt(e.target.closest('.chk').dataset.li, 10);
            const card = ctx.state.cards.find(c => c.id === cardEl.dataset.id);
            if (card && document.activeElement !== cardEl.querySelector('.card-text')) {
                e.preventDefault();
                pushUndo(ctx);
                const lines = card.text.split('\n');
                lines[li] = lines[li].includes('[ ]')
                    ? lines[li].replace('[ ]', '[x]')
                    : lines[li].replace('[x]', '[ ]');
                card.text = lines.join('\n');
                renderCards(ctx);
                saveState(ctx);
                return;
            }
        }

        ctx.selectedCardId = cardEl.dataset.id;
        surface.querySelectorAll('.canvas-card.selected').forEach(c => c.classList.remove('selected'));
        cardEl.classList.add('selected');

        if (e.target.closest('.card-text')) return;

        const card = ctx.state.cards.find(c => c.id === cardEl.dataset.id);
        if (card) {
            pushUndo(ctx);
            const pos = screenToCanvas(ctx, e.clientX, e.clientY);
            dragCard = card.id;
            dragMoved = false;
            dragOffset = { x: pos.x - card.x, y: pos.y - card.y };
            cardEl.classList.add('dragging');
        }
    });

    surface.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('card-text')) {
            const card = ctx.state.cards.find(c => c.id === e.target.dataset.cardId);
            if (card) {
                const cardEl = e.target.closest('.canvas-card');
                if (cardEl) cardEl.classList.add('editing');
                e.target.textContent = card.text;
                placeCaretEnd(e.target);
            }
        }
    });

    surface.addEventListener('focusout', (e) => {
        if (e.target.classList.contains('card-text')) {
            const card = ctx.state.cards.find(c => c.id === e.target.dataset.cardId);
            if (card) {
                const cardEl = e.target.closest('.canvas-card');
                if (cardEl) cardEl.classList.remove('editing');
                card.text = e.target.innerText.replace(/\n$/, '');
                renderCards(ctx);
                saveState(ctx);
            }
        }
    });

    surface.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('card-text')) {
            // Shift+Enter for newline, plain Enter to save
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); }
            // Tab inserts a checklist item
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '\n- [ ] ');
            }
            e.stopPropagation();
        }
    });

    // Sketch drawing
    ctx.dom.sketchCanvas.addEventListener('mousedown', (e) => onSketchMouseDown(ctx, e));
    ctx.dom.sketchCanvas.addEventListener('mousemove', (e) => onSketchMouseMove(ctx, e));
    ctx.dom.sketchCanvas.addEventListener('mouseup', (e) => onSketchMouseUp(ctx, e));

    // Toolbar
    document.getElementById('canvas-toolbar').addEventListener('click', (e) => {
        const btn = e.target.closest('.toolbar-btn');
        if (!btn) return;

        if (btn.id === 'btn-new') {
            const pos = screenToCanvas(ctx, window.innerWidth / 2, window.innerHeight / 2);
            createCard(ctx, pos.x - 90, pos.y - 30);
        }
        if (btn.id === 'btn-kanban') toggleBoard(ctx, () => redrawSketch(ctx));
        if (btn.id === 'btn-focus') ctx.focusMode ? exitFocus(ctx) : enterFocus(ctx);
        if (btn.id === 'btn-sketch') toggleSketchPalette(ctx);
        if (btn.id === 'btn-sort') openTriage(ctx);
        if (btn.id === 'btn-planner') {
            renderDayPlanner(ctx);
            dayPlanner.classList.toggle('open');
        }
        if (btn.id === 'btn-export') {
            const data = JSON.stringify(ctx.state, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'my-thoughts.json';
            a.click();
            URL.revokeObjectURL(url);
        }
        if (btn.id === 'btn-clear') {
            if (confirm('Forget everything? Thoughts in "things I let go" survive; the rest will not.')) {
                pushUndo(ctx);
                ctx.state.cards = [];
                ctx.state.strokes = [];
                doRenderAll();
                saveState(ctx);
            }
        }
    });

    // Sketch palette
    document.getElementById('sketch-palette').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tool]');
        if (btn) setSketchTool(ctx, btn.dataset.tool);
    });

    // Triage actions
    triageEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-triage]');
        if (btn) triageAction(ctx, btn.dataset.triage);
        else if (e.target === triageEl) closeTriage(ctx);
    });

    // Trash tray
    document.getElementById('trash-toggle').addEventListener('click', () => {
        document.getElementById('trash-list').classList.toggle('open');
    });
    document.getElementById('trash-list').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-restore]');
        if (btn) restoreCard(ctx, btn.dataset.restore);
    });

    // Planner: unassign
    dayPlanner.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-unslot]');
        if (btn) {
            pushUndo(ctx);
            const card = ctx.state.cards.find(c => c.id === btn.dataset.unslot);
            if (card) { card.timeSlot = null; renderDayPlanner(ctx); renderCards(ctx); saveState(ctx); }
        }
    });

    // Disclaimer
    document.getElementById('disclaimer-dismiss').addEventListener('click', () => {
        document.getElementById('disclaimer-bar').style.display = 'none';
    });

    // Keyboard
    function onKeyDown(e) {
        const editing = e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        if (editing) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            doUndo();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Escape') {
            if (triageEl.classList.contains('open')) { closeTriage(ctx); return; }
            if (ctx.sketch.tool) { setSketchTool(ctx, ctx.sketch.tool); document.getElementById('sketch-palette').classList.remove('open'); return; }
            if (ctx.focusMode) { exitFocus(ctx); return; }
            dayPlanner.classList.remove('open');
            document.getElementById('trash-list').classList.remove('open');
            ctx.selectedCardId = null;
            renderCards(ctx);
            return;
        }

        if (triageEl.classList.contains('open')) return;

        if (e.key === 'k' || e.key === 'K') { toggleBoard(ctx, () => redrawSketch(ctx)); return; }
        if (e.key === 's' || e.key === 'S') { toggleSketchPalette(ctx); return; }
        if (e.key === 'f' || e.key === 'F') { ctx.focusMode ? exitFocus(ctx) : enterFocus(ctx); return; }
        if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            const pos = screenToCanvas(ctx, window.innerWidth / 2, window.innerHeight / 2);
            createCard(ctx, pos.x - 90, pos.y - 30);
            return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && ctx.selectedCardId) {
            softDelete(ctx, ctx.selectedCardId);
            return;
        }

        if (e.key.length === 1 && e.key !== ' ' && !ctx.sketch.tool) {
            e.preventDefault();
            const pos = screenToCanvas(ctx, window.innerWidth / 2, window.innerHeight / 2);
            createCard(ctx, pos.x - 90, pos.y - 30, e.key);
        }
    }
    document.addEventListener('keydown', onKeyDown);

    // Touch support
    let touchStartDist = 0;
    let touchStartZoom = 1;
    let lastTap = 0;

    root.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.hypot(dx, dy);
            touchStartZoom = ctx.viewport.zoom;
        } else if (e.touches.length === 1) {
            if (e.target.closest('.canvas-card') || e.target.closest('#canvas-toolbar') ||
                e.target.closest('#day-planner') || e.target.closest('#trash-tray') ||
                e.target.closest('#triage') || e.target.closest('#sketch-palette')) return;

            const now = Date.now();
            if (now - lastTap < 300) {
                const pos = screenToCanvas(ctx, e.touches[0].clientX, e.touches[0].clientY);
                createCard(ctx, pos.x - 90, pos.y - 30);
                lastTap = 0;
                return;
            }
            lastTap = now;

            isPanning = true;
            panStart = { x: e.touches[0].clientX - ctx.viewport.x, y: e.touches[0].clientY - ctx.viewport.y };
        }
    }, { passive: true });

    root.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && touchStartDist > 0) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            ctx.viewport.zoom = Math.min(3, Math.max(0.2, touchStartZoom * (Math.hypot(dx, dy) / touchStartDist)));
            applyViewport(ctx);
            redrawSketch(ctx);
        } else if (isPanning && e.touches.length === 1) {
            ctx.viewport.x = e.touches[0].clientX - panStart.x;
            ctx.viewport.y = e.touches[0].clientY - panStart.y;
            applyViewport(ctx);
            redrawSketch(ctx);
        }
    }, { passive: true });

    root.addEventListener('touchend', () => {
        isPanning = false;
        touchStartDist = 0;
        saveStateDebounced(ctx);
    });

    // --- Init ---
    seedSamples();
    onResize();
    window.addEventListener('resize', onResize);
    doRenderAll();

    return () => {
        window.removeEventListener('resize', onResize);
        document.removeEventListener('keydown', onKeyDown);
        clearTimeout(ctx.saveTimer);
    };
}