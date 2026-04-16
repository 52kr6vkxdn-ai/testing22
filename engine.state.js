/* ============================================================
   Zengine — engine.state.js
   Shared constants and mutable global state.
   ============================================================ */

export const PIXELS_PER_UNIT = 100;
export const SNAP_GRID       = 25;

export const state = {
    /** @type {PIXI.Application|null} */
    app: null,

    /** @type {PIXI.Container|null} */
    sceneContainer: null,

    /** @type {PIXI.Graphics|null} */
    gridLayer: null,

    /** @type {PIXI.Graphics|null} */
    cameraBounds: null,

    // ── Multi-object support ──────────────────────────────
    /** @type {PIXI.Container[]} */
    gameObjects: [],

    /** @type {PIXI.Container|null} */
    gameObject: null,

    /** @type {PIXI.Graphics|null} */
    spriteBox: null,

    // ── Gizmo state ───────────────────────────────────────
    /** @type {PIXI.Container|null} */
    gizmoContainer: null,
    /** @type {PIXI.Container|null} */
    grpTranslate: null,
    /** @type {PIXI.Container|null} */
    grpRotate: null,
    /** @type {PIXI.Container|null} */
    grpScale: null,

    /** @type {'translate'|'rotate'|'scale'|'all'} */
    gizmoMode: 'translate',

    // ── Asset registry (shared across ALL scenes) ─────────
    /** @type {Array<{id:string, name:string, dataURL:string}>} */
    assets: [],

    // ── Scene registry ────────────────────────────────────
    /**
     * @type {Array<{id:string, name:string, snapshot:object|null}>}
     * snapshot=null means this scene is currently live (no save needed to read it)
     */
    scenes: [],

    /** @type {number} Index into state.scenes */
    activeSceneIndex: 0,

    // ── Internal gizmo binding ────────────────────────────
    _gizmoHandles: null,
};
