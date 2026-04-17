/* ============================================================
   Zengine — engine.renderer.js
   Scene graph, grid, camera bounds, gizmo size ticker.
   ============================================================ */

import { state, PIXELS_PER_UNIT } from './engine.state.js';

export function initScene() {
    const { app } = state;

    // ── GPU / Quality settings ────────────────────────────
    // Use LINEAR filtering for smooth edges (no pixelation)
    PIXI.settings.SCALE_MODE      = PIXI.SCALE_MODES.LINEAR;
    // Preserve full resolution — no forced downscale
    PIXI.settings.RESOLUTION      = window.devicePixelRatio || 1;
    // Max texture size guard (GPU limit)
    PIXI.settings.SPRITE_MAX_TEXTURES = 32;

    state.sceneContainer = new PIXI.Container();
    app.stage.addChild(state.sceneContainer);
    state.sceneContainer.position.set(
        app.screen.width  / 2,
        app.screen.height / 2
    );

    state.gridLayer    = new PIXI.Graphics();
    state.cameraBounds = new PIXI.Graphics();

    state.sceneContainer.addChild(state.gridLayer, state.cameraBounds);

    drawGrid();
}

export function drawGrid() {
    const { gridLayer, cameraBounds } = state;
    gridLayer.clear();
    gridLayer.lineStyle(1, 0x333333, 1);
    const size = 5000, step = 25;
    for (let i = -size; i <= size; i += step) {
        gridLayer.moveTo(i, -size); gridLayer.lineTo(i,  size);
        gridLayer.moveTo(-size, i); gridLayer.lineTo(size, i);
    }
    gridLayer.lineStyle(2, 0x555555, 1);
    gridLayer.moveTo(0, -size); gridLayer.lineTo(0,  size);
    gridLayer.moveTo(-size, 0); gridLayer.lineTo(size, 0);

    cameraBounds.clear();
    cameraBounds.lineStyle(2, 0xFFFFFF, 0.2);
    cameraBounds.drawRect(-300, -170, 600, 340);
}

export function startGizmoSizeTicker() {
    state.app.ticker.add(() => {
        const camScale = state.sceneContainer.scale.x;
        for (const obj of state.gameObjects) {
            const gc = obj._gizmoContainer;
            if (!gc) continue;
            gc.scale.set(
                1 / (camScale * obj.scale.x),
                1 / (camScale * obj.scale.y)
            );
        }
    });
}
