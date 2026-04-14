/* ============================================================
   Zengine — engine.renderer.js
   PixiJS scene-graph setup, grid drawing, camera bounds,
   and the gizmo constant-screen-size ticker.
   ============================================================ */

import { state, PIXELS_PER_UNIT } from './engine.state.js';

// ── Scene Graph Initialisation ──────────────────────────────
/**
 * Build the root scene hierarchy and attach it to the PIXI stage.
 * Must be called after engine.core.js has created state.app.
 */
export function initScene() {
    const { app } = state;

    // Camera container — pan/zoom lives here
    state.sceneContainer = new PIXI.Container();
    app.stage.addChild(state.sceneContainer);
    state.sceneContainer.position.set(
        app.screen.width  / 2,
        app.screen.height / 2
    );

    // Sub-layers (order = draw order)
    state.gridLayer    = new PIXI.Graphics();
    state.cameraBounds = new PIXI.Graphics();
    state.gameObject   = new PIXI.Container();

    state.sceneContainer.addChild(
        state.gridLayer,
        state.cameraBounds,
        state.gameObject
    );

    drawGrid();
}

// ── Grid ────────────────────────────────────────────────────
/**
 * (Re)draw the infinite background grid.
 * Thin lines every 25 px, thicker axes at origin.
 */
export function drawGrid() {
    const { gridLayer, cameraBounds } = state;

    // Grid lines
    gridLayer.clear();
    gridLayer.lineStyle(1, 0x333333, 1);
    const size = 5000;
    const step = 25;
    for (let i = -size; i <= size; i += step) {
        gridLayer.moveTo(i, -size); gridLayer.lineTo(i,  size);
        gridLayer.moveTo(-size, i); gridLayer.lineTo(size, i);
    }

    // Bold axes
    gridLayer.lineStyle(2, 0x555555, 1);
    gridLayer.moveTo(0, -size); gridLayer.lineTo(0,  size);  // Y axis
    gridLayer.moveTo(-size, 0); gridLayer.lineTo(size, 0);   // X axis

    // Camera bounds rectangle (white, semi-transparent)
    cameraBounds.clear();
    cameraBounds.lineStyle(2, 0xFFFFFF, 0.2);
    cameraBounds.drawRect(-300, -170, 600, 340);
}

// ── Gizmo Size Correction ────────────────────────────────────
/**
 * Keep gizmo handles at a constant screen size regardless of
 * camera zoom or object scale.  Called once; registers a ticker.
 */
export function startGizmoSizeTicker() {
    state.app.ticker.add(() => {
        const camScale  = state.sceneContainer.scale.x;
        const objScaleX = state.gameObject.scale.x;
        const objScaleY = state.gameObject.scale.y;
        state.gizmoContainer.scale.set(
            1 / (camScale * objScaleX),
            1 / (camScale * objScaleY)
        );
    });
}
