/* ============================================================
   Zengine — engine.prefab-editor.js
   Full prefab edit mode. Saves the current scene, loads a single
   prefab object into the main canvas so all existing gizmo /
   inspector / animation tools work unchanged, then on "Update All"
   propagates every changed property to every live instance and to
   every stored scene snapshot.
   ============================================================ */

import { state }    from './engine.state.js';
import { drawGrid } from './engine.renderer.js';

let _savedSnapshot  = null;   // scene we paused to edit the prefab
let _editingPrefab  = null;   // prefab definition being edited
let _editObj        = null;   // the live PIXI container inside the editor

// ── Public API ───────────────────────────────────────────────

export function openPrefabEditor(prefab) {
    if (_editingPrefab) {
        console.warn('Prefab editor already open — close it first.');
        return;
    }
    _editingPrefab = prefab;

    // 1. Snapshot the current live scene (objects + camera)
    _savedSnapshot = _captureLiveScene();

    // 2. Clear the main canvas
    _clearScene();

    // 3. Reset camera to centre
    state.sceneContainer.x = state.app.screen.width  / 2;
    state.sceneContainer.y = state.app.screen.height / 2;
    state.sceneContainer.scale.set(1);
    drawGrid();

    // 4. Create the prefab object in the editor
    _spawnPrefabObject(prefab).then(obj => {
        _editObj = obj;
        import('./engine.objects.js').then(m => m.selectObject(obj));
        import('./engine.ui.js').then(m => {
            m.refreshHierarchy();
            m.syncPixiToInspector();
        });
    });

    // 5. Dim hierarchy panel, show green banner
    _showEditorBar(prefab);
}

export function closePrefabEditor(save) {
    if (!_editingPrefab) return;

    if (save && _editObj) {
        // Extract updated state from the live editor object
        const prefab = _editingPrefab;
        prefab.name           = _editObj.label            || prefab.name;
        prefab.tint           = _editObj.spriteGraphic?.tint ?? prefab.tint;
        prefab.scaleX         = _editObj.scale.x;
        prefab.scaleY         = _editObj.scale.y;
        prefab.rotation       = _editObj.rotation;
        prefab.animations     = _editObj.animations
            ? JSON.parse(JSON.stringify(_editObj.animations)) : [];
        prefab.activeAnimIndex = _editObj.activeAnimIndex || 0;
        prefab.components     = _editObj.components
            ? JSON.parse(JSON.stringify(_editObj.components)) : [];
        prefab.updatedAt      = Date.now();

        // Propagate to all live instances in current scene
        _applyToLiveInstances(prefab);

        // Propagate to all scene snapshots (other scenes)
        import('./engine.scenes.js').then(m => m.updatePrefabInAllScenes(prefab));

        import('./engine.ui.js').then(m => m.refreshPrefabPanel());
    }

    // Restore the paused scene
    _hideEditorBar();
    _restoreScene(_savedSnapshot);

    _savedSnapshot  = null;
    _editingPrefab  = null;
    _editObj        = null;
}

export function isEditorOpen() { return !!_editingPrefab; }
export function currentPrefab() { return _editingPrefab; }

// ── Internal helpers ─────────────────────────────────────────

function _captureLiveScene() {
    return {
        camX:     state.sceneContainer.x,
        camY:     state.sceneContainer.y,
        camSX:    state.sceneContainer.scale.x,
        camSY:    state.sceneContainer.scale.y,
        selIdx:   state.gameObject ? state.gameObjects.indexOf(state.gameObject) : -1,
        objects:  state.gameObjects.map(obj => ({
            label:    obj.label, shapeKey: obj.shapeKey,
            isImage:  obj.isImage, assetId: obj.assetId,
            prefabId: obj.prefabId || null,
            x: obj.x, y: obj.y,
            scaleX: obj.scale.x, scaleY: obj.scale.y,
            rotation: obj.rotation, unityZ: obj.unityZ || 0,
            tint: obj.spriteGraphic?.tint ?? 0xFFFFFF,
            animations: obj.animations
                ? JSON.parse(JSON.stringify(obj.animations)) : [],
            activeAnimIndex: obj.activeAnimIndex || 0,
            components: obj.components
                ? JSON.parse(JSON.stringify(obj.components)) : [],
        })),
    };
}

function _clearScene() {
    for (const obj of [...state.gameObjects]) {
        state.sceneContainer.removeChild(obj);
        try { obj.destroy({ children: true }); } catch (_) {}
    }
    state.gameObjects    = [];
    state.gameObject     = null;
    state.gizmoContainer = null;
    state.grpTranslate   = null;
    state.grpRotate      = null;
    state.grpScale       = null;
    state._gizmoHandles  = null;
    state.spriteBox      = null;
}

async function _spawnPrefabObject(prefab) {
    const { createShapeObject, createImageObject } = await import('./engine.objects.js');
    let obj;

    if (prefab.isImage && prefab.assetId) {
        const asset = state.assets.find(a => a.id === prefab.assetId);
        obj = asset ? createImageObject(asset, 0, 0) : createShapeObject(prefab.shapeKey || 'square', 0, 0);
    } else {
        obj = createShapeObject(prefab.shapeKey || 'square', 0, 0);
    }

    if (!obj) return null;

    // Restore prefab properties
    obj.label           = prefab.name;
    obj.scale.x         = prefab.scaleX ?? 1;
    obj.scale.y         = prefab.scaleY ?? 1;
    obj.rotation        = prefab.rotation ?? 0;
    obj.unityZ          = 0;
    obj.prefabId        = prefab.id;
    obj.animations      = prefab.animations
        ? JSON.parse(JSON.stringify(prefab.animations)) : [];
    obj.activeAnimIndex = prefab.activeAnimIndex || 0;
    obj.components      = prefab.components
        ? JSON.parse(JSON.stringify(prefab.components)) : [];

    if (obj.spriteGraphic?.tint !== undefined) obj.spriteGraphic.tint = prefab.tint ?? 0xFFFFFF;

    if (state._bindGizmoHandles) state._bindGizmoHandles(obj);
    return obj;
}

function _applyToLiveInstances(prefab) {
    for (const obj of state.gameObjects) {
        if (obj === _editObj || obj.prefabId !== prefab.id) continue;
        // Visual sync (position stays instance-specific)
        if (obj.spriteGraphic?.tint !== undefined) obj.spriteGraphic.tint = prefab.tint;
        obj.scale.x         = prefab.scaleX;
        obj.scale.y         = prefab.scaleY;
        obj.rotation        = prefab.rotation;
        obj.animations      = prefab.animations
            ? JSON.parse(JSON.stringify(prefab.animations)) : [];
        obj.activeAnimIndex = prefab.activeAnimIndex || 0;
        obj.components      = prefab.components
            ? JSON.parse(JSON.stringify(prefab.components)) : [];
    }
}

function _restoreScene(snap) {
    _clearScene();

    state.sceneContainer.x        = snap.camX;
    state.sceneContainer.y        = snap.camY;
    state.sceneContainer.scale.x  = snap.camSX;
    state.sceneContainer.scale.y  = snap.camSY;
    drawGrid();

    if (!snap.objects?.length) {
        import('./engine.ui.js').then(m => { m.refreshHierarchy(); m.syncPixiToInspector(); });
        return;
    }

    import('./engine.objects.js').then(({ createShapeObject, createImageObject, selectObject }) => {
        for (const s of snap.objects) {
            let obj;
            if (s.isImage && s.assetId) {
                const asset = state.assets.find(a => a.id === s.assetId);
                obj = asset ? createImageObject(asset, s.x, s.y)
                            : createShapeObject('square', s.x, s.y);
            } else {
                obj = createShapeObject(s.shapeKey || 'square', s.x, s.y);
            }
            if (!obj) continue;

            obj.label           = s.label;
            obj.scale.x         = s.scaleX;
            obj.scale.y         = s.scaleY;
            obj.rotation        = s.rotation;
            obj.unityZ          = s.unityZ;
            obj.prefabId        = s.prefabId || null;
            obj.animations      = s.animations || [];
            obj.activeAnimIndex = s.activeAnimIndex || 0;
            obj.components      = s.components || [];
            if (obj.spriteGraphic?.tint !== undefined) obj.spriteGraphic.tint = s.tint;
            if (state._bindGizmoHandles) state._bindGizmoHandles(obj);
        }

        // Re-select whatever was selected before
        const target = snap.selIdx >= 0
            ? state.gameObjects[snap.selIdx]
            : state.gameObjects[state.gameObjects.length - 1];
        if (target) selectObject(target);

        import('./engine.ui.js').then(m => { m.refreshHierarchy(); m.syncPixiToInspector(); });
    });
}

// ── Editor Banner ────────────────────────────────────────────

function _showEditorBar(prefab) {
    _removeBar();

    const bar = document.createElement('div');
    bar.id = 'prefab-editor-bar';
    bar.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; height: 40px;
        background: linear-gradient(90deg,#0a1f0a,#112211);
        border-bottom: 2px solid #4ade80;
        z-index: 100000;
        display: flex; align-items: center; padding: 0 14px; gap: 10px;
        font-size: 11px; color: #d0d0d0;
        box-shadow: 0 3px 18px rgba(0,200,80,.25);
    `;

    bar.innerHTML = `
        <!-- Prefab icon -->
        <svg style="width:15px;height:15px;flex-shrink:0;fill:none;stroke:#4ade80;stroke-width:2;" viewBox="0 0 24 24">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
        </svg>
        <span style="color:#4ade80;font-weight:700;letter-spacing:.6px;">PREFAB EDITOR</span>
        <span style="color:#444;">│</span>
        <input id="pe-name-inp" value="${prefab.name}"
            style="background:#0d200d;border:1px solid #2a5a2a;color:#8f8;border-radius:3px;
                   padding:2px 7px;font-size:11px;width:160px;font-style:italic;" />
        <span style="color:#444;font-size:10px;margin-left:2px;">Edit freely — changes propagate to every instance on save</span>
        <div style="flex:1;"></div>
        <!-- instance count badge -->
        <span id="pe-instance-badge" style="background:#1a3a1a;border:1px solid #2a5a2a;color:#6a9;
              font-size:10px;padding:2px 8px;border-radius:10px;">0 instances</span>
        <div style="width:1px;height:18px;background:#333;"></div>
        <!-- Edit Animation -->
        <button id="pe-btn-anim"
            style="background:#112211;border:1px solid #3a8a3a;color:#8f8;border-radius:3px;
                   padding:3px 11px;cursor:pointer;font-size:10px;display:flex;align-items:center;gap:5px;">
            <svg style="width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>Open Animation Editor
        </button>
        <!-- Duplicate Prefab -->
        <button id="pe-btn-dup"
            style="background:#112211;border:1px solid #3a8a3a;color:#8f8;border-radius:3px;
                   padding:3px 11px;cursor:pointer;font-size:10px;">
            ⊕ Duplicate Prefab
        </button>
        <div style="width:1px;height:18px;background:#333;"></div>
        <!-- Update All -->
        <button id="pe-btn-save"
            style="background:#0f3a0f;border:1px solid #4ade80;color:#4ade80;border-radius:3px;
                   padding:4px 14px;cursor:pointer;font-weight:700;font-size:11px;
                   display:flex;align-items:center;gap:6px;
                   box-shadow:0 0 8px rgba(74,222,128,.2);">
            <svg style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg>
            Update All Instances
        </button>
        <!-- Discard -->
        <button id="pe-btn-cancel"
            style="background:#1e1e1e;border:1px solid #555;color:#888;border-radius:3px;
                   padding:4px 12px;cursor:pointer;font-size:10px;">
            Discard & Close
        </button>
    `;

    document.body.prepend(bar);
    document.body.style.paddingTop = '40px';

    // Update instance count badge
    _updateInstanceBadge(prefab.id);

    // Name change
    document.getElementById('pe-name-inp').addEventListener('input', (e) => {
        if (_editObj) {
            _editObj.label = e.target.value;
            import('./engine.ui.js').then(m => m.refreshHierarchy());
        }
    });

    // Animation editor
    document.getElementById('pe-btn-anim').addEventListener('click', () => {
        if (_editObj) import('./engine.animator.js').then(m => m.openAnimationEditor(_editObj));
    });

    // Duplicate prefab
    document.getElementById('pe-btn-dup').addEventListener('click', () => {
        if (!_editingPrefab) return;
        const copy = JSON.parse(JSON.stringify(_editingPrefab));
        copy.id   = 'prefab_' + Date.now() + '_dup';
        copy.name = copy.name + ' (copy)';
        copy.createdAt = Date.now();
        state.prefabs.push(copy);
        import('./engine.ui.js').then(m => m.refreshPrefabPanel());
    });

    // Save
    document.getElementById('pe-btn-save').addEventListener('click', async () => {
        if (_editingPrefab && document.getElementById('pe-name-inp')) {
            _editingPrefab.name = document.getElementById('pe-name-inp').value.trim()
                                    || _editingPrefab.name;
        }
        closePrefabEditor(true);
    });

    // Cancel
    document.getElementById('pe-btn-cancel').addEventListener('click', () => {
        if (confirm('Discard all changes to this prefab?')) closePrefabEditor(false);
    });
}

function _updateInstanceBadge(prefabId) {
    // Count live instances
    const count = state.gameObjects.filter(o => o.prefabId === prefabId).length;
    const badge = document.getElementById('pe-instance-badge');
    if (badge) badge.textContent = `${count} instance${count !== 1 ? 's' : ''}`;
}

function _removeBar() {
    document.getElementById('prefab-editor-bar')?.remove();
    document.body.style.paddingTop = '';
}
function _hideEditorBar() { _removeBar(); }
