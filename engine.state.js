/* ============================================================
   Zengine — engine.state.js
   Shared constants and mutable global state.
   All other modules import from here; nothing else holds
   engine-wide variables.
   ============================================================ */

// ── Constants ──────────────────────────────────────────────
export const PIXELS_PER_UNIT = 100;   // World-unit → pixel ratio

// ── Runtime State ──────────────────────────────────────────
// Populated by engine.core.js after PIXI initialises.
export const state = {
    /** @type {PIXI.Application|null} */
    app: null,

    /** @type {PIXI.Container|null}   Root scene container (camera) */
    sceneContainer: null,

    /** @type {PIXI.Graphics|null}    Infinite grid layer */
    gridLayer: null,

    /** @type {PIXI.Graphics|null}    White border showing camera bounds */
    cameraBounds: null,

    /** @type {PIXI.Container|null}   The selected game object */
    gameObject: null,

    /** @type {PIXI.Graphics|null}    The coloured sprite box */
    spriteBox: null,

    // ── Gizmo groups ─────────────────────────────────────
    /** @type {PIXI.Container|null} */
    gizmoContainer: null,
    /** @type {PIXI.Container|null} */
    grpTranslate: null,
    /** @type {PIXI.Container|null} */
    grpRotate: null,
    /** @type {PIXI.Container|null} */
    grpScale: null,

    // ── Current tool mode ─────────────────────────────────
    /** @type {'translate'|'rotate'|'scale'|'all'} */
    gizmoMode: 'translate',
};
