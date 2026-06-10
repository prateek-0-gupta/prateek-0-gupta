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
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Caveat:wght@400;500;600;700&display=swap');

            * { margin: 0; padding: 0; box-sizing: border-box; }
            body, html { width: 100%; height: 100%; overflow: hidden; }

            #canvas-root {
                width: 100%; height: 100vh; overflow: hidden;
                background: #F7F6F3;
                font-family: 'Space Grotesk', sans-serif;
                color: #1A1A1A;
                position: relative;
                cursor: grab;
            }
            #canvas-root.grabbing { cursor: grabbing; }
            #canvas-root.sketching { cursor: crosshair; }

            #canvas-surface {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                transform-origin: 0 0;
            }

            #canvas-grid {
                position: absolute; top: -2000px; left: -2000px;
                width: 6000px; height: 6000px;
                pointer-events: none;
                opacity: 0.3;
                background-image: radial-gradient(circle, #ccc 1px, transparent 1px);
                background-size: 40px 40px;
            }

            #app-title {
                position: fixed; top: 14px; left: 20px;
                z-index: 900; pointer-events: none;
                line-height: 1.1;
            }
            #app-title .cogito {
                font-family: 'Caveat', cursive;
                font-size: 22px; font-weight: 600;
            }
            #app-title .tagline {
                font-size: 10px; letter-spacing: 1.2px;
                text-transform: uppercase; color: #b5b2ab;
            }

            #empty-hint {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                text-align: center; pointer-events: none;
                z-index: 1; transition: opacity 0.4s;
            }
            #empty-hint .big {
                font-family: 'Caveat', cursive;
                font-size: 44px; color: #c9c6bf;
            }
            #empty-hint .small {
                font-size: 12px; color: #c9c6bf;
                letter-spacing: 0.5px; margin-top: 6px;
            }
            #empty-hint.hidden { opacity: 0; }

            #sketch-canvas {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                pointer-events: none;
                z-index: 5;
            }
            #sketch-canvas.active { pointer-events: all; cursor: crosshair; }

            .canvas-card {
                position: absolute;
                min-width: 180px;
                max-width: 280px;
                padding: 16px 18px 20px;
                border-radius: 6px;
                font-family: 'Caveat', cursive;
                font-size: 19px;
                line-height: 1.35;
                cursor: grab;
                user-select: none;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05);
                z-index: 10;
                transition: box-shadow 0.2s;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            .canvas-card.longform {
                font-family: 'Space Grotesk', sans-serif;
                font-size: 13px; line-height: 1.5;
            }
            .canvas-card::before {
                content: '';
                position: absolute;
                bottom: -7px; left: 14px;
                width: 8px; height: 8px;
                border-radius: 50%;
                background: inherit;
                box-shadow: 0 1px 3px rgba(0,0,0,0.07);
            }
            .canvas-card::after {
                content: '';
                position: absolute;
                bottom: -13px; left: 8px;
                width: 4px; height: 4px;
                border-radius: 50%;
                background: inherit;
                box-shadow: 0 1px 2px rgba(0,0,0,0.06);
            }
            .canvas-card:hover {
                box-shadow: 0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08);
            }
            .canvas-card.dragging {
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                transform: scale(1.04) rotate(1deg);
                z-index: 100;
                cursor: grabbing;
            }
            .canvas-card.selected {
                box-shadow: 0 0 0 2px rgba(26,26,26,0.55), 0 4px 16px rgba(0,0,0,0.12);
            }
            .canvas-card .card-text { outline: none; min-height: 24px; }
            .canvas-card .card-text:focus { cursor: text; user-select: text; }

            .canvas-card .card-delete {
                position: absolute; top: 3px; right: 5px;
                width: 18px; height: 18px;
                border: none; background: none;
                cursor: pointer; opacity: 0;
                font-size: 12px; color: #666;
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                transition: opacity 0.2s;
            }
            .canvas-card:hover .card-delete { opacity: 0.6; }
            .canvas-card .card-delete:hover { opacity: 1; background: rgba(0,0,0,0.08); }

            .canvas-card .card-color-picker {
                position: absolute; bottom: 5px; right: 7px;
                display: none; gap: 3px;
            }
            .canvas-card:hover .card-color-picker { display: flex; }
            .card-color-dot {
                width: 11px; height: 11px;
                border-radius: 50%; border: 1.5px solid rgba(0,0,0,0.15);
                cursor: pointer;
                transition: transform 0.15s;
            }
            .card-color-dot:hover { transform: scale(1.35); }

            .card-slot-badge {
                position: absolute; top: -9px; right: 10px;
                font-family: 'Space Grotesk', sans-serif;
                font-size: 9px; font-weight: 600;
                letter-spacing: 0.8px; text-transform: uppercase;
                background: #1A1A1A; color: #fff;
                padding: 2px 7px; border-radius: 8px;
            }

            .chk { display: flex; align-items: baseline; gap: 7px; }
            .chk-box {
                flex: 0 0 auto;
                width: 14px; height: 14px;
                border: 1.5px solid rgba(26,26,26,0.4);
                border-radius: 4px;
                cursor: pointer;
                font-size: 10px; line-height: 12px;
                text-align: center;
                font-family: 'Space Grotesk', sans-serif;
                background: rgba(255,255,255,0.5);
                transform: translateY(2px);
            }
            .chk.done .chk-box { background: #1A1A1A; color: #fff; border-color: #1A1A1A; }
            .chk.done span:last-child { text-decoration: line-through; opacity: 0.5; }

            .card-yellow { background: #FFF3B0; }
            .card-sage { background: #D4E9D7; }
            .card-lavender { background: #E8DEFF; }
            .card-coral { background: #FFD6CC; }
            .card-sky { background: #D0EFFF; }

            #kanban-board {
                position: absolute;
                display: none;
                z-index: 2;
                pointer-events: none;
            }
            #kanban-board.visible { display: flex; }
            .kb-col {
                width: 260px; height: 640px;
                border: 2px dashed rgba(26,26,26,0.1);
                border-radius: 14px;
                margin-right: 14px;
                padding-top: 14px;
                text-align: center;
                transition: background 0.15s, border-color 0.15s;
            }
            .kb-col.drag-over {
                background: rgba(26,26,26,0.035);
                border-color: rgba(26,26,26,0.25);
            }
            .kb-col .kb-header {
                display: inline-block;
                font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 1.5px;
                color: #999; padding: 7px 14px;
                border-radius: 20px;
                background: rgba(255,255,255,0.85);
            }
            .kb-col .count {
                margin-left: 6px;
                background: rgba(0,0,0,0.08);
                padding: 2px 6px; border-radius: 8px;
                font-size: 10px;
            }

            #canvas-toolbar {
                position: fixed; bottom: 24px; left: 50%;
                transform: translateX(-50%);
                display: flex; gap: 4px;
                padding: 8px 12px;
                background: rgba(255,255,255,0.85);
                backdrop-filter: blur(12px);
                border-radius: 16px;
                border: 1px solid rgba(0,0,0,0.06);
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                z-index: 1000;
                font-size: 13px;
            }
            .toolbar-btn {
                width: 40px; height: 40px;
                border: none; background: none;
                border-radius: 10px;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                font-size: 18px;
                color: #555;
                position: relative;
                transition: background 0.15s, color 0.15s;
            }
            .toolbar-btn:hover { background: rgba(0,0,0,0.05); color: #1A1A1A; }
            .toolbar-btn.active { background: #1A1A1A; color: #fff; }
            .toolbar-btn:focus-visible { outline: 2px solid #1A1A1A; outline-offset: 2px; }
            .toolbar-btn .tooltip {
                position: absolute; bottom: calc(100% + 8px);
                left: 50%; transform: translateX(-50%);
                background: #1A1A1A; color: #fff;
                padding: 4px 10px; border-radius: 6px;
                font-size: 11px; white-space: nowrap;
                opacity: 0; pointer-events: none;
                transition: opacity 0.2s;
            }
            .toolbar-btn:hover .tooltip, .toolbar-btn:focus-visible .tooltip { opacity: 1; }
            .toolbar-divider { width: 1px; margin: 4px 6px; background: rgba(0,0,0,0.1); }

            #sketch-palette {
                position: fixed; bottom: 84px; left: 50%;
                transform: translateX(-50%);
                display: none; gap: 4px;
                padding: 6px 8px;
                background: rgba(255,255,255,0.9);
                backdrop-filter: blur(12px);
                border-radius: 12px;
                border: 1px solid rgba(0,0,0,0.06);
                box-shadow: 0 4px 16px rgba(0,0,0,0.08);
                z-index: 1000;
            }
            #sketch-palette.open { display: flex; }
            #sketch-palette .toolbar-btn { width: 34px; height: 34px; font-size: 15px; }

            #focus-overlay {
                position: fixed; top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(247,246,243,0.88);
                z-index: 50;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s;
            }
            #focus-overlay.active { opacity: 1; }
            .canvas-card.focus-highlight { z-index: 60; }

            #triage {
                position: fixed; inset: 0;
                background: rgba(247,246,243,0.96);
                backdrop-filter: blur(6px);
                z-index: 1500;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 28px;
            }
            #triage.open { display: flex; }
            #triage .triage-label {
                font-size: 11px; letter-spacing: 1.5px;
                text-transform: uppercase; color: #999;
            }
            #triage .triage-card {
                min-width: 260px; max-width: 420px;
                padding: 28px 32px;
                border-radius: 10px;
                font-family: 'Caveat', cursive;
                font-size: 26px; line-height: 1.35;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                text-align: center;
            }
            #triage .triage-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
            .triage-btn {
                border: 1.5px solid rgba(26,26,26,0.2);
                background: rgba(255,255,255,0.8);
                padding: 12px 22px;
                border-radius: 12px;
                font-family: 'Space Grotesk', sans-serif;
                font-size: 13px; font-weight: 500;
                cursor: pointer;
                transition: background 0.15s, transform 0.1s;
            }
            .triage-btn:hover { background: #1A1A1A; color: #fff; transform: translateY(-2px); }
            .triage-btn.quiet { border-style: dashed; color: #888; }
            #triage .triage-progress { font-size: 11px; color: #aaa; }

            #day-planner {
                position: fixed; right: -320px; top: 0;
                width: 320px; height: 100vh;
                background: rgba(255,255,255,0.95);
                backdrop-filter: blur(12px);
                border-left: 1px solid rgba(0,0,0,0.06);
                z-index: 500;
                overflow-y: auto;
                padding: 24px 16px 80px;
                transition: right 0.3s ease;
            }
            #day-planner.open { right: 0; }
            #day-planner h3 {
                font-size: 12px; text-transform: uppercase;
                letter-spacing: 1.5px; color: #999;
                margin-bottom: 4px;
            }
            #day-planner .planner-hint { font-size: 11px; color: #bbb; margin-bottom: 18px; }
            .time-slot {
                padding: 12px;
                margin-bottom: 10px;
                border: 1.5px dashed rgba(0,0,0,0.08);
                border-radius: 10px;
                min-height: 56px;
                transition: background 0.15s, border-color 0.15s;
            }
            .time-slot .slot-title {
                font-size: 11px; font-weight: 600;
                letter-spacing: 1px; text-transform: uppercase;
                color: #888;
            }
            .time-slot.slot-top3 { background: #FFF9DD; border-color: rgba(0,0,0,0.12); }
            .time-slot.drag-over { background: rgba(26,26,26,0.04); border-color: rgba(26,26,26,0.3); }
            .time-slot .slot-card {
                font-family: 'Caveat', cursive;
                font-size: 17px; color: #1A1A1A;
                margin-top: 6px;
                display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
            }
            .time-slot .slot-card button {
                border: none; background: none; cursor: pointer;
                color: #bbb; font-size: 11px;
            }
            .time-slot .slot-card button:hover { color: #1A1A1A; }

            #trash-tray {
                position: fixed; bottom: 24px; left: 20px;
                z-index: 900;
            }
            #trash-toggle {
                border: 1px solid rgba(0,0,0,0.08);
                background: rgba(255,255,255,0.85);
                backdrop-filter: blur(8px);
                border-radius: 12px;
                padding: 8px 14px;
                font-family: 'Space Grotesk', sans-serif;
                font-size: 11px; color: #888;
                cursor: pointer;
            }
            #trash-toggle:hover { color: #1A1A1A; }
            #trash-list {
                display: none;
                position: absolute; bottom: 44px; left: 0;
                width: 240px; max-height: 280px; overflow-y: auto;
                background: rgba(255,255,255,0.97);
                border: 1px solid rgba(0,0,0,0.08);
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.1);
                padding: 10px;
            }
            #trash-list.open { display: block; }
            .trash-item {
                display: flex; justify-content: space-between; gap: 8px;
                align-items: baseline;
                padding: 7px 6px;
                border-bottom: 1px solid rgba(0,0,0,0.04);
                font-family: 'Caveat', cursive; font-size: 16px;
            }
            .trash-item button {
                border: none; background: none; cursor: pointer;
                font-family: 'Space Grotesk', sans-serif;
                font-size: 10px; color: #999;
            }
            .trash-item button:hover { color: #1A1A1A; }
            .trash-empty { font-size: 11px; color: #bbb; padding: 8px; }

            #disclaimer-bar {
                position: fixed; bottom: 24px; right: 20px;
                padding: 8px 14px;
                background: rgba(255,255,255,0.85);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(0,0,0,0.08);
                color: #999;
                font-size: 10px;
                border-radius: 12px;
                z-index: 900;
                max-width: 220px;
            }
            #disclaimer-bar button {
                background: none; border: none;
                color: #bbb; cursor: pointer;
                margin-left: 8px; font-size: 10px;
            }
            #disclaimer-bar button:hover { color: #1A1A1A; }

            @keyframes plop {
                0% { transform: scale(0.3); opacity: 0; }
                60% { transform: scale(1.08); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
            .card-plop { animation: plop 0.25s ease-out; }

            @keyframes spark {
                0% { transform: scale(0.4) rotate(0deg); opacity: 1; }
                100% { transform: scale(1.8) rotate(40deg); opacity: 0; }
            }
            .done-spark {
                position: absolute;
                font-size: 26px;
                pointer-events: none;
                z-index: 200;
                animation: spark 0.6s ease-out forwards;
            }

            .canvas-card.dimmed { opacity: 0.12; pointer-events: none; }

            #undo-toast {
                position: fixed; bottom: 84px; left: 50%;
                transform: translateX(-50%);
                background: #1A1A1A; color: #fff;
                padding: 8px 16px; border-radius: 8px;
                font-size: 12px; z-index: 2000;
                opacity: 0; transition: opacity 0.2s;
                pointer-events: none;
            }
            #undo-toast.show { opacity: 1; }

            @media (prefers-reduced-motion: reduce) {
                .card-plop, .done-spark { animation: none; }
                #day-planner, #focus-overlay { transition: none; }
            }

            @media (max-width: 768px) {
                #canvas-toolbar { bottom: 12px; padding: 6px 8px; }
                .toolbar-btn { width: 36px; height: 36px; font-size: 16px; }
                .canvas-card { min-width: 140px; max-width: 220px; font-size: 17px; }
                #day-planner { width: 280px; }
                #disclaimer-bar { display: none; }
            }
        </style>

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

    // ============ EVENTS ============

    root.addEventListener('mousedown', (e) => {
        if (ctx.sketch.tool) return;
        if (e.target.closest('.canvas-card') || e.target.closest('#canvas-toolbar') ||
            e.target.closest('#day-planner') || e.target.closest('#disclaimer-bar') ||
            e.target.closest('#trash-tray') || e.target.closest('#sketch-palette') ||
            e.target.closest('#triage')) return;

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
                e.target.textContent = card.text;
                placeCaretEnd(e.target);
            }
        }
    });

    surface.addEventListener('focusout', (e) => {
        if (e.target.classList.contains('card-text')) {
            const card = ctx.state.cards.find(c => c.id === e.target.dataset.cardId);
            if (card) {
                card.text = e.target.innerText.replace(/\n$/, '');
                renderCards(ctx);
                saveState(ctx);
            }
        }
    });

    surface.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('card-text')) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); }
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