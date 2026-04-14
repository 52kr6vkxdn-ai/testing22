/* ============================================================
   Zengine — engine.objects.js
   Game object (sprite box) creation and gizmo construction.
   ============================================================ */

import { state } from './engine.state.js';

// ── Game Object ─────────────────────────────────────────────
/**
 * Create the default coloured square game object and add it
 * to the scene.
 */
export function createGameObject() {
    const { gameObject } = state;

    const spriteBox = new PIXI.Graphics();
    spriteBox.beginFill(0xFFFFFF);          // White base so tinting works
    spriteBox.lineStyle(1, 0xFFFFFF, 1);
    spriteBox.drawRect(-25, -25, 50, 50);   // 50×50 px, centred on origin
    spriteBox.endFill();
    spriteBox.tint = 0x3B82F6;             // Default blue

    gameObject.addChild(spriteBox);
    gameObject.unityZ = 0;                 // Z-depth (2-D: data only)

    state.spriteBox = spriteBox;
}

// ── Gizmos ──────────────────────────────────────────────────
/**
 * Build translate / rotate / scale gizmo handles and attach
 * them to the selected game object so they move with it.
 */
export function createGizmos() {
    const { gameObject } = state;

    const gizmoContainer = new PIXI.Container();
    gameObject.addChild(gizmoContainer);
    state.gizmoContainer = gizmoContainer;

    // ─ Translate ─────────────────────────────────────────
    const transX      = _makeAxisLine(0xFF4F4B,  60, 'arrow', false); transX.cursor = 'ew-resize';
    const transY      = _makeAxisLine(0x8FC93A,  60, 'arrow', true);  transY.cursor = 'ns-resize';
    const transCenter = _makeSquareHandle(0xFFFFFF, 0.4, 'move');

    const grpTranslate = new PIXI.Container();
    grpTranslate.addChild(transX, transY, transCenter);
    state.grpTranslate = grpTranslate;

    // ─ Scale ─────────────────────────────────────────────
    const scaleX      = _makeAxisLine(0xFF4F4B, 60, 'square', false); scaleX.cursor = 'ew-resize';
    const scaleY      = _makeAxisLine(0x8FC93A, 60, 'square', true);  scaleY.cursor = 'ns-resize';
    const scaleCenter = _makeSquareHandle(0x999999, 1.0, 'nwse-resize');

    const grpScale = new PIXI.Container();
    grpScale.addChild(scaleX, scaleY, scaleCenter);
    state.grpScale = grpScale;

    // ─ Rotate ─────────────────────────────────────────────
    const rotRing = new PIXI.Graphics();
    rotRing.lineStyle(3, 0xFACC15, 0.8);
    rotRing.drawCircle(0, 0, 50);
    rotRing.eventMode = 'static';
    rotRing.cursor    = 'crosshair';
    rotRing.hitArea   = new PIXI.Circle(0, 0, 60);   // Generous hit zone

    const grpRotate = new PIXI.Container();
    grpRotate.addChild(rotRing);
    state.grpRotate = grpRotate;

    gizmoContainer.addChild(grpTranslate, grpRotate, grpScale);

    // Expose handles to engine.input.js via state
    state._gizmoHandles = { transX, transY, transCenter, scaleX, scaleY, scaleCenter, rotRing };
}

// ── Helpers ─────────────────────────────────────────────────
/**
 * Draw a coloured line with either an arrowhead or a square cap.
 * @param {number}  color     Hex colour
 * @param {number}  length    Line length in pixels
 * @param {'arrow'|'square'} capStyle
 * @param {boolean} isY       true = vertical (Y axis), false = horizontal (X)
 */
function _makeAxisLine(color, length, capStyle, isY) {
    const g = new PIXI.Graphics();
    g.beginFill(color);
    g.lineStyle(2, color);

    // Shaft
    if (isY) g.drawRect(-1, -length, 2, length);
    else     g.drawRect(0, -1, length, 2);

    g.lineStyle(0);

    // Cap
    if (capStyle === 'arrow') {
        if (isY) {
            g.moveTo(-6, -length); g.lineTo(0, -length - 12); g.lineTo(6, -length);
        } else {
            g.moveTo(length, -6); g.lineTo(length + 12, 0); g.lineTo(length, 6);
        }
    } else {
        if (isY) g.drawRect(-5, -length - 10, 10, 10);
        else     g.drawRect(length, -5, 10, 10);
    }

    g.endFill();
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    return g;
}

/**
 * Create a small square centre handle.
 * @param {number} color  Hex fill colour
 * @param {number} alpha  Fill alpha
 * @param {string} cursor CSS cursor string
 */
function _makeSquareHandle(color, alpha, cursor) {
    const g = new PIXI.Graphics();
    g.beginFill(color, alpha);
    g.drawRect(-8, -8, 16, 16);
    g.endFill();
    g.eventMode = 'static';
    g.cursor    = cursor;
    return g;
}
