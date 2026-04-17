/* ============================================================
   Zengine — engine.objects.js
   Game object creation (shapes + image sprites) and gizmos.
   ============================================================ */

import { state } from './engine.state.js';
import { syncPixiToInspector, refreshHierarchy } from './engine.ui.js';

// ── Shape Definitions ────────────────────────────────────────
export const SHAPES = {
    square:       { label: 'Square',        color: 0x3B82F6 },
    circle:       { label: 'Circle',        color: 0x22C55E },
    triangle:     { label: 'Triangle',      color: 0xF97316 },
    diamond:      { label: 'Diamond',       color: 0xA855F7 },
    pentagon:     { label: 'Pentagon',      color: 0xEC4899 },
    hexagon:      { label: 'Hexagon',       color: 0x14B8A6 },
    star:         { label: 'Star',          color: 0xFACC15 },
    capsule:      { label: 'Capsule',       color: 0x64748B },
    rightTriangle:{ label: 'Right Triangle',color: 0xEF4444 },
    arrow:        { label: 'Arrow',         color: 0x06B6D4 },
};

// Counter for unique names
const _counts = {};
function _uniqueName(base) {
    _counts[base] = (_counts[base] || 0) + 1;
    return _counts[base] === 1 ? base : `${base} (${_counts[base]})`;
}

// ── Create Shape Object ──────────────────────────────────────
export function createShapeObject(shapeKey, x = 0, y = 0) {
    const def = SHAPES[shapeKey];
    if (!def) return;

    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.unityZ  = 0;
    container.label   = _uniqueName(def.label);
    container.shapeKey = shapeKey;
    container.isImage  = false;

    const g = _drawShape(shapeKey, def.color);
    container.addChild(g);
    container.spriteGraphic = g;
    container._tintColor = def.color;  // store initial tint per-object

    _attachGizmos(container);
    if (state._bindGizmoHandles) state._bindGizmoHandles(container);
    state.sceneContainer.addChild(container);
    state.gameObjects.push(container);
    _makeSelectable(container);

    selectObject(container);
    refreshHierarchy();
    return container;
}

// ── Create Image Sprite Object ───────────────────────────────
export function createImageObject(asset, x = 0, y = 0) {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.unityZ   = 0;
    container.label    = _uniqueName(asset.name.replace(/\.[^.]+$/, ''));
    container.isImage  = true;
    container.assetId  = asset.id;

    const tex = PIXI.Texture.from(asset.dataURL);
    // Use linear filtering for smooth edges — no pixelation
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    // Initial display size: 100px on longest axis, but retain full source resolution
    const natW   = tex.baseTexture.realWidth  || 100;
    const natH   = tex.baseTexture.realHeight || 100;
    const maxDim = Math.max(natW, natH);
    const scale  = 100 / maxDim;
    sprite.scale.set(scale);
    container.addChild(sprite);
    container.spriteGraphic = sprite;

    _attachGizmos(container);
    if (state._bindGizmoHandles) state._bindGizmoHandles(container);
    state.sceneContainer.addChild(container);
    state.gameObjects.push(container);
    _makeSelectable(container);

    selectObject(container);
    refreshHierarchy();
    return container;
}

// ── Select Object ─────────────────────────────────────────────
export function selectObject(obj) {
    // Hide ALL object gizmos first (clean slate)
    for (const o of state.gameObjects) {
        if (o._gizmoContainer) o._gizmoContainer.visible = false;
    }

    state.gameObject = obj;

    if (obj) {
        // Show this object's gizmo container
        if (obj._gizmoContainer) obj._gizmoContainer.visible = true;

        state.gizmoContainer = obj._gizmoContainer;
        state.grpTranslate   = obj._grpTranslate;
        state.grpRotate      = obj._grpRotate;
        state.grpScale       = obj._grpScale;
        state._gizmoHandles  = obj._gizmoHandles;
        state.spriteBox      = obj.spriteGraphic;

        // Apply the CURRENT gizmo mode immediately — fixes selection bug
        const m = state.gizmoMode || 'translate';
        if (obj._grpTranslate) obj._grpTranslate.visible = (m === 'translate' || m === 'all');
        if (obj._grpRotate)    obj._grpRotate.visible    = (m === 'rotate'    || m === 'all');
        if (obj._grpScale)     obj._grpScale.visible     = (m === 'scale'     || m === 'all');

        // Sync color picker to this object's actual tint (per-object inspector fix)
        const colorEl = document.getElementById('inp-color');
        if (colorEl && obj.spriteGraphic?.tint !== undefined) {
            const tint = obj.spriteGraphic.tint;
            colorEl.value = '#' + tint.toString(16).padStart(6, '0');
        }
    }

    syncPixiToInspector();
    refreshHierarchy();
}

// ── Delete Selected Object ────────────────────────────────────
export function deleteSelected() {
    const obj = state.gameObject;
    if (!obj) return;

    const idx = state.gameObjects.indexOf(obj);
    if (idx !== -1) state.gameObjects.splice(idx, 1);

    state.sceneContainer.removeChild(obj);
    obj.destroy({ children: true });

    const next = state.gameObjects[Math.min(idx, state.gameObjects.length - 1)] || null;
    state.gameObject = null;
    if (next) selectObject(next);
    else {
        state.gameObject     = null;
        state.gizmoContainer = null;
        state.grpTranslate   = null;
        state.grpRotate      = null;
        state.grpScale       = null;
        state._gizmoHandles  = null;
        state.spriteBox      = null;
        syncPixiToInspector();
        refreshHierarchy();
    }
}

// ── Z-order ───────────────────────────────────────────────────
export function moveObjectUp(obj) {
    const arr = state.gameObjects;
    const i   = arr.indexOf(obj);
    if (i <= 0) return;
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    // Re-order pixi children
    state.sceneContainer.removeChild(obj);
    const ref = arr[i]; // what used to be i-1
    state.sceneContainer.addChildAt(obj, state.sceneContainer.children.indexOf(ref));
    refreshHierarchy();
}

export function moveObjectDown(obj) {
    const arr = state.gameObjects;
    const i   = arr.indexOf(obj);
    if (i < 0 || i >= arr.length - 1) return;
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    state.sceneContainer.removeChild(obj);
    const ref = arr[i]; // what used to be i+1
    const refIdx = state.sceneContainer.children.indexOf(ref);
    state.sceneContainer.addChildAt(obj, refIdx + 1);
    refreshHierarchy();
}

// ── Apply Z position as Z-order (render priority) ────────────
export function applyZOrder(obj) {
    if (!obj || !state.sceneContainer) return;
    const z = obj.unityZ || 0;
    // Re-insert at correct zIndex position based on unityZ
    const sorted = [...state.gameObjects].sort((a, b) => (a.unityZ||0) - (b.unityZ||0));
    for (let i = 0; i < sorted.length; i++) {
        const o = sorted[i];
        if (state.sceneContainer.children.includes(o)) {
            state.sceneContainer.removeChild(o);
            state.sceneContainer.addChild(o);
        }
    }
    refreshHierarchy();
}

// ── Gizmo attachment ──────────────────────────────────────────
function _attachGizmos(container) {
    const gizmoContainer = new PIXI.Container();
    container.addChild(gizmoContainer);
    container._gizmoContainer = gizmoContainer;

    // Translate
    const transX      = _makeAxisLine(0xFF4F4B,  60, 'arrow', false); transX.cursor = 'ew-resize';
    const transY      = _makeAxisLine(0x8FC93A,  60, 'arrow', true);  transY.cursor = 'ns-resize';
    const transCenter = _makeSquareHandle(0xFFFFFF, 0.4, 'move');
    const grpTranslate = new PIXI.Container();
    grpTranslate.addChild(transX, transY, transCenter);
    container._grpTranslate = grpTranslate;

    // Scale
    const scaleX      = _makeAxisLine(0xFF4F4B, 60, 'square', false); scaleX.cursor = 'ew-resize';
    const scaleY      = _makeAxisLine(0x8FC93A, 60, 'square', true);  scaleY.cursor = 'ns-resize';
    const scaleCenter = _makeSquareHandle(0x999999, 1.0, 'nwse-resize');
    const grpScale = new PIXI.Container();
    grpScale.addChild(scaleX, scaleY, scaleCenter);
    container._grpScale = grpScale;

    // Rotate
    const rotRing = new PIXI.Graphics();
    rotRing.lineStyle(3, 0xFACC15, 0.8);
    rotRing.drawCircle(0, 0, 50);
    rotRing.eventMode = 'static';
    rotRing.cursor    = 'crosshair';
    rotRing.hitArea   = new PIXI.Circle(0, 0, 60);
    const grpRotate = new PIXI.Container();
    grpRotate.addChild(rotRing);
    container._grpRotate = grpRotate;

    gizmoContainer.addChild(grpTranslate, grpRotate, grpScale);

    container._gizmoHandles = { transX, transY, transCenter, scaleX, scaleY, scaleCenter, rotRing };

    // Apply current mode visibility
    const m = state.gizmoMode || 'translate';
    grpTranslate.visible = m === 'translate' || m === 'all';
    grpRotate.visible    = m === 'rotate'    || m === 'all';
    grpScale.visible     = m === 'scale'     || m === 'all';
}

// ── Make container clickable to select + double-click to animate
function _makeSelectable(container) {
    container.eventMode = 'static';

    let _lastTap = 0;

    container.on('pointerdown', (e) => {
        if (e.button !== 0) return;
        selectObject(container);
        e.stopPropagation();

        // Double-click detection (within 350ms)
        const now = Date.now();
        if (now - _lastTap < 350) {
            import('./engine.animator.js').then(m => m.openAnimationEditor(container));
        }
        _lastTap = now;
    });
}

// ── Shape drawing ─────────────────────────────────────────────
function _drawShape(key, color) {
    const g = new PIXI.Graphics();
    g.beginFill(color);

    switch (key) {
        case 'square':
            g.drawRect(-25, -25, 50, 50);
            break;
        case 'circle':
            g.drawCircle(0, 0, 28);
            break;
        case 'triangle':
            g.drawPolygon([0,-30, 26,20, -26,20]);
            break;
        case 'diamond':
            g.drawPolygon([0,-32, 22,0, 0,32, -22,0]);
            break;
        case 'pentagon':
            g.drawPolygon(_polygon(5, 30));
            break;
        case 'hexagon':
            g.drawPolygon(_polygon(6, 28));
            break;
        case 'star':
            g.drawPolygon(_star(5, 30, 13));
            break;
        case 'capsule':
            g.drawRoundedRect(-14, -30, 28, 60, 14);
            break;
        case 'rightTriangle':
            g.drawPolygon([-25,25, 25,25, -25,-25]);
            break;
        case 'arrow':
            g.drawPolygon([0,-32, 14,-8, 6,-8, 6,32, -6,32, -6,-8, -14,-8]);
            break;
        default:
            g.drawRect(-25, -25, 50, 50);
    }

    g.endFill();
    return g;
}

function _polygon(sides, r) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    return pts;
}

function _star(points, outerR, innerR) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    return pts;
}

function _makeAxisLine(color, length, capStyle, isY) {
    const g = new PIXI.Graphics();
    g.beginFill(color);
    g.lineStyle(2, color);
    if (isY) g.drawRect(-1, -length, 2, length);
    else     g.drawRect(0, -1, length, 2);
    g.lineStyle(0);
    if (capStyle === 'arrow') {
        if (isY) { g.moveTo(-6, -length); g.lineTo(0, -length-12); g.lineTo(6, -length); }
        else     { g.moveTo(length, -6);  g.lineTo(length+12, 0);  g.lineTo(length, 6); }
    } else {
        if (isY) g.drawRect(-5, -length-10, 10, 10);
        else     g.drawRect(length, -5, 10, 10);
    }
    g.endFill();
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    return g;
}

function _makeSquareHandle(color, alpha, cursor) {
    const g = new PIXI.Graphics();
    g.beginFill(color, alpha);
    g.drawRect(-8, -8, 16, 16);
    g.endFill();
    g.eventMode = 'static';
    g.cursor    = cursor;
    return g;
}
