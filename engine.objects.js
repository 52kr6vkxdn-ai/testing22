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
export function createShapeObject(shapeKey, x = 0, y = 0, initialTint = null) {
    const def = SHAPES[shapeKey];
    if (!def) return;

    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.unityZ   = 0;
    container.label    = _uniqueName(def.label);
    container.shapeKey = shapeKey;
    container.isImage  = false;
    container.components = [];
    container.overrides  = {};  // per-instance override flags

    const g = _drawShape(shapeKey);   // always white
    // Set tint = exact colour (initialTint overrides default for prefab restores)
    g.tint = initialTint ?? def.color;
    container.addChild(g);
    container.spriteGraphic = g;

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
    container.unityZ    = 0;
    container.label     = _uniqueName(asset.name.replace(/\.[^.]+$/, ''));
    container.isImage   = true;
    container.assetId   = asset.id;
    container.components = [];
    container.overrides  = {};  // per-instance override flags

    const tex     = PIXI.Texture.from(asset.dataURL);
    const sprite  = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    // Normalise to 100×100 px initially
    const maxDim  = Math.max(tex.width || 100, tex.height || 100);
    const scale   = 100 / maxDim;
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
    // Hide old gizmos
    if (state.gameObject && state.gameObject !== obj) {
        const oldGizmo = state.gameObject._gizmoContainer;
        if (oldGizmo) oldGizmo.visible = false;
    }

    state.gameObject = obj;

    if (obj) {
        const gc = obj._gizmoContainer;
        if (gc) gc.visible = true;

        state.gizmoContainer = obj._gizmoContainer;
        state.grpTranslate   = obj._grpTranslate;
        state.grpRotate      = obj._grpRotate;
        state.grpScale       = obj._grpScale;
        state._gizmoHandles  = obj._gizmoHandles;
        state.spriteBox      = obj.spriteGraphic;

        // FIX: Apply active gizmo mode to newly selected object's groups
        if (obj._grpTranslate) {
            const m = state.gizmoMode || 'translate';
            obj._grpTranslate.visible = m === 'translate' || m === 'all';
            obj._grpRotate.visible    = m === 'rotate'    || m === 'all';
            obj._grpScale.visible     = m === 'scale'     || m === 'all';
        }
    }

    syncPixiToInspector();
    refreshHierarchy();
}

// ── Save As Prefab ────────────────────────────────────────────
export function saveAsPrefab(obj, existingId = null) {
    if (!obj) return null;

    // If already a prefab instance, update the existing definition
    if (obj.prefabId && !existingId) existingId = obj.prefabId;

    const tint = obj.spriteGraphic?.tint ?? 0xFFFFFF;

    if (existingId) {
        // Update existing prefab in place
        const existing = state.prefabs.find(p => p.id === existingId);
        if (existing) {
            existing.name           = obj.label || existing.name;
            existing.tint           = tint;
            existing.scaleX         = obj.scale.x;
            existing.scaleY         = obj.scale.y;
            existing.rotation       = obj.rotation;
            existing.animations     = obj.animations
                ? JSON.parse(JSON.stringify(obj.animations)) : [];
            existing.activeAnimIndex = obj.activeAnimIndex || 0;
            existing.components     = obj.components
                ? JSON.parse(JSON.stringify(obj.components)) : [];
            existing.updatedAt      = Date.now();
            obj.prefabId = existing.id;
            import('./engine.ui.js').then(m => {
                m.refreshPrefabPanel();
                m.syncPixiToInspector();
            });
            return existing;
        }
    }

    // Create a brand new prefab definition
    const prefab = {
        id:             'prefab_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        name:           obj.label || 'Prefab',
        shapeKey:       obj.shapeKey  || 'square',
        isImage:        obj.isImage   || false,
        assetId:        obj.assetId   || null,
        tint,
        scaleX:         obj.scale.x,
        scaleY:         obj.scale.y,
        rotation:       obj.rotation,
        animations:     obj.animations
            ? JSON.parse(JSON.stringify(obj.animations)) : [],
        activeAnimIndex: obj.activeAnimIndex || 0,
        components:     obj.components
            ? JSON.parse(JSON.stringify(obj.components)) : [],
        tags:           [],
        createdAt:      Date.now(),
        updatedAt:      Date.now(),
    };

    state.prefabs.push(prefab);
    obj.prefabId = prefab.id;

    import('./engine.ui.js').then(m => {
        m.refreshPrefabPanel();
        m.syncPixiToInspector();
    });
    return prefab;
}

// ── Break Prefab Link ─────────────────────────────────────────
export function unlinkFromPrefab(obj) {
    if (!obj) return;
    obj.prefabId = null;
    import('./engine.ui.js').then(m => m.syncPixiToInspector());
}

// ── Apply Prefab Changes to All Instances ─────────────────────
export function applyPrefabToAll(prefabId) {
    const prefab = state.prefabs.find(p => p.id === prefabId);
    if (!prefab) return;
    const src = state.gameObject;
    // Push current object state back into the prefab definition first
    if (src?.prefabId === prefabId) {
        prefab.tint           = src.spriteGraphic?.tint ?? prefab.tint;
        prefab.scaleX         = src.scale.x;
        prefab.scaleY         = src.scale.y;
        prefab.rotation       = src.rotation;
        prefab.animations     = src.animations ? JSON.parse(JSON.stringify(src.animations)) : [];
        prefab.activeAnimIndex = src.activeAnimIndex || 0;
        prefab.components     = src.components ? JSON.parse(JSON.stringify(src.components)) : [];
        prefab.updatedAt      = Date.now();
    }
    // Apply to every live instance, respecting per-instance overrides
    for (const obj of state.gameObjects) {
        if (obj.prefabId !== prefabId || obj === src) continue;
        const ov = obj.overrides || {};
        if (!ov.tint     && obj.spriteGraphic?.tint !== undefined) obj.spriteGraphic.tint = prefab.tint;
        if (!ov.scaleX)  obj.scale.x  = prefab.scaleX;
        if (!ov.scaleY)  obj.scale.y  = prefab.scaleY;
        if (!ov.rotation) obj.rotation = prefab.rotation;
        obj.animations      = prefab.animations ? JSON.parse(JSON.stringify(prefab.animations)) : [];
        obj.activeAnimIndex = prefab.activeAnimIndex || 0;
        obj.components      = prefab.components ? JSON.parse(JSON.stringify(prefab.components)) : [];
    }
    // Also patch all scene snapshots (respecting overrides stored in snapshots)
    import('./engine.scenes.js').then(m => m.updatePrefabInAllScenes(prefab));
    import('./engine.ui.js').then(m => m.refreshPrefabPanel());
}

// ── Reset a single override field back to prefab value ────────
export function resetOverride(obj, field) {
    if (!obj?.prefabId) return;
    const prefab = state.prefabs.find(p => p.id === obj.prefabId);
    if (!prefab) return;
    if (!obj.overrides) obj.overrides = {};
    obj.overrides[field] = false;

    // Restore the prefab value for this field
    switch (field) {
        case 'tint':
            if (obj.spriteGraphic?.tint !== undefined) obj.spriteGraphic.tint = prefab.tint;
            break;
        case 'scaleX':   obj.scale.x  = prefab.scaleX;   break;
        case 'scaleY':   obj.scale.y  = prefab.scaleY;   break;
        case 'rotation': obj.rotation = prefab.rotation;  break;
    }
    import('./engine.ui.js').then(m => { m.syncPixiToInspector(); });
}

// ── Instantiate Prefab ────────────────────────────────────────
export function instantiatePrefab(prefab, x = 0, y = 0) {
    let obj;
    if (prefab.isImage && prefab.assetId) {
        const asset = state.assets.find(a => a.id === prefab.assetId);
        if (asset) obj = createImageObject(asset, x, y);
    }
    if (!obj) obj = createShapeObject(prefab.shapeKey || 'square', x, y, prefab.tint);

    if (!obj) return null;

    obj.label           = prefab.name;
    obj.scale.x         = prefab.scaleX ?? 1;
    obj.scale.y         = prefab.scaleY ?? 1;
    obj.rotation        = prefab.rotation ?? 0;
    obj.prefabId        = prefab.id;
    obj.overrides       = {};   // starts clean — no overrides
    obj.animations      = prefab.animations ? JSON.parse(JSON.stringify(prefab.animations)) : [];
    obj.activeAnimIndex = prefab.activeAnimIndex || 0;
    obj.components      = prefab.components ? JSON.parse(JSON.stringify(prefab.components)) : [];
    if (obj.spriteGraphic?.tint !== undefined) obj.spriteGraphic.tint = prefab.tint ?? 0xFFFFFF;

    if (state._bindGizmoHandles) state._bindGizmoHandles(obj);
    import('./engine.ui.js').then(m => {
        m.refreshHierarchy();
        m.refreshPrefabPanel();
    });
    return obj;
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

// ── Sort objects by Z position (higher Z = rendered on top) ──
export function sortByZ() {
    // Stable sort: objects with higher unityZ go last (rendered on top)
    state.gameObjects.sort((a, b) => (a.unityZ || 0) - (b.unityZ || 0));
    // Re-order PIXI children to match (grid/camera layers stay at index 0,1)
    for (const obj of state.gameObjects) {
        state.sceneContainer.removeChild(obj);
        state.sceneContainer.addChild(obj);
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
// All shapes are drawn in WHITE so that PIXI tint = exact user colour.
// The initial tint is set to the shape's default colour in createShapeObject.
function _drawShape(key) {
    const g = new PIXI.Graphics();
    g.beginFill(0xFFFFFF);   // always white — tint provides the real colour

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
