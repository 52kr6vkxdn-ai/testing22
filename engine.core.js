/* ============================================================
   Zengine — engine.core.js
   PIXI Application creation and ordered startup sequence.
   This is the single entry point called by index.html.
   ============================================================ */

import { state }                    from './engine.state.js';
import { initScene, startGizmoSizeTicker } from './engine.renderer.js';
import { createGameObject, createGizmos }  from './engine.objects.js';
import { initCameraControls, initGizmoDrag } from './engine.input.js';
import {
    cacheInspectorElements,
    initInspectorListeners,
    setGizmoMode,
    syncPixiToInspector,
} from './engine.ui.js';

/**
 * Boot the engine.
 * Called from index.html's window.onload handler.
 */
export function startEngine() {
    // ── Guard: PIXI must be loaded ────────────────────────
    if (typeof PIXI === 'undefined') {
        document.getElementById('pixi-container').innerHTML =
            `<div style="color:red; padding: 20px;">
                Error: PIXI.js failed to load.
                Check the CDN link or local file path in index.html.
             </div>`;
        return;
    }

    // ── 1. Create PIXI Application ────────────────────────
    const container = document.getElementById('pixi-container');
    state.app = new PIXI.Application({
        resizeTo:       container,
        backgroundColor: 0x282828,
        resolution:     window.devicePixelRatio || 1,
        autoDensity:    true,
        preference:     'webgl',
    });
    container.appendChild(state.app.view);

    // ── 2. Build scene hierarchy ──────────────────────────
    initScene();

    // ── 3. Create game object and gizmos ──────────────────
    createGameObject();
    createGizmos();

    // ── 4. Start gizmo screen-size correction ticker ──────
    startGizmoSizeTicker();

    // ── 5. Wire up input handlers ─────────────────────────
    initCameraControls();
    initGizmoDrag();

    // ── 6. Cache and initialise inspector UI ──────────────
    cacheInspectorElements();
    initInspectorListeners();

    // ── 7. Set initial state ──────────────────────────────
    setGizmoMode('translate');
    syncPixiToInspector();
}
