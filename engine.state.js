/* ============================================================
   Zengine — engine.state.js
   ============================================================ */

export const PIXELS_PER_UNIT = 100;
export const SNAP_GRID       = 25;

export const state = {
    app:            null,
    sceneContainer: null,
    gridLayer:      null,
    cameraBounds:   null,

    gameObjects: [],
    gameObject:  null,
    spriteBox:   null,

    gizmoContainer: null,
    grpTranslate:   null,
    grpRotate:      null,
    grpScale:       null,
    /** @type {'translate'|'rotate'|'scale'|'all'} */
    gizmoMode: 'translate',

    // ── Shared registries (all scenes) ────────────────────
    /** @type {Array<{id,name,dataURL}>} Image assets */
    assets: [],
    /** @type {Array<{id,name,dataURL,duration,volume,loop,...}>} */
    audioAssets: [],
    /** @type {Array<{id,name,shapeKey,isImage,assetId,tint,scaleX,scaleY,animations,thumbnail}>} */
    prefabs: [],

    // ── Scene registry ────────────────────────────────────
    scenes: [],
    activeSceneIndex: 0,

    _gizmoHandles: null,
};
