/* ============================================================
   Zengine — engine.playmode.js
   Play / Pause / Stop controls.
   On Play: snapshot current scene, disable editing UI.
   On Stop:  restore snapshot, re-enable editing.
   ============================================================ */

import { state } from './engine.state.js';

// ── Enter play mode ───────────────────────────────────────────
export function enterPlayMode() {
    if (state.isPlaying) return;

    // Save scene snapshot to restore later
    state._playSnapshot = _snapshotScene();

    state.isPlaying = true;
    state.isPaused  = false;

    _updatePlayButtons();
    _setEditorEnabled(false);
    _logConsole('▶ Play Mode started', '#4ade80');
}

// ── Pause ─────────────────────────────────────────────────────
export function pausePlayMode() {
    if (!state.isPlaying) return;
    state.isPaused = !state.isPaused;
    _updatePlayButtons();
    _logConsole(state.isPaused ? '⏸ Paused' : '▶ Resumed', '#facc15');
}

// ── Stop (restore to edit state) ─────────────────────────────
export function stopPlayMode() {
    if (!state.isPlaying) return;

    state.isPlaying = false;
    state.isPaused  = false;

    // Restore scene
    if (state._playSnapshot) {
        _restoreScene(state._playSnapshot);
        state._playSnapshot = null;
    }

    _updatePlayButtons();
    _setEditorEnabled(true);
    _logConsole('■ Play Mode stopped', '#f87171');
}

// ── Update toolbar button appearance ─────────────────────────
function _updatePlayButtons() {
    const play  = document.getElementById('btn-play');
    const pause = document.getElementById('btn-pause');
    const stop  = document.getElementById('btn-stop');

    if (play)  play.classList.toggle('active', state.isPlaying && !state.isPaused);
    if (pause) pause.classList.toggle('active', state.isPaused);
    if (stop)  stop.classList.toggle('active', false);

    // Tint the viewport border when playing
    const container = document.getElementById('pixi-container');
    if (container) {
        container.style.outline = state.isPlaying
            ? '2px solid #4ade80'
            : 'none';
    }
}

// ── Disable / enable editing controls ────────────────────────
function _setEditorEnabled(enabled) {
    // Gizmos
    for (const obj of state.gameObjects) {
        const gc = obj._gizmoContainer;
        if (gc) gc.visible = false; // always hide in play mode
    }

    // Toolbar gizmo buttons
    ['btn-tool-translate','btn-tool-rotate','btn-tool-scale','btn-tool-all'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.pointerEvents = enabled ? '' : 'none';
    });

    // Inspector inputs
    document.querySelectorAll('#panel-inspector input, #panel-inspector select, #panel-inspector button').forEach(el => {
        el.disabled = !enabled;
    });

    // Hierarchy action buttons
    document.querySelectorAll('#hierarchy-list button').forEach(el => el.disabled = !enabled);
}

// ── Full scene snapshot ──────────────────────────────────────
function _snapshotScene() {
    return {
        objects: state.gameObjects.map(obj => ({
            label:    obj.label,
            shapeKey: obj.shapeKey,
            isImage:  obj.isImage,
            assetId:  obj.assetId,
            prefabId: obj.prefabId || null,
            x:        obj.x,
            y:        obj.y,
            scaleX:   obj.scale.x,
            scaleY:   obj.scale.y,
            rotation: obj.rotation,
            unityZ:   obj.unityZ || 0,
            tint:     obj.spriteGraphic?.tint ?? 0xFFFFFF,
            animations:      obj.animations ? JSON.parse(JSON.stringify(obj.animations)) : [],
            activeAnimIndex: obj.activeAnimIndex || 0,
        })),
        camX:      state.sceneContainer?.x       ?? 0,
        camY:      state.sceneContainer?.y       ?? 0,
        camScaleX: state.sceneContainer?.scale.x ?? 1,
        camScaleY: state.sceneContainer?.scale.y ?? 1,
        selectedLabel: state.gameObject?.label ?? null,
    };
}

// ── Restore from snapshot ────────────────────────────────────
function _restoreScene(snap) {
    for (const obj of state.gameObjects) {
        state.sceneContainer.removeChild(obj);
        try { obj.destroy({ children: true }); } catch (_) {}
    }
    state.gameObjects    = [];
    state.gameObject     = null;
    state.gizmoContainer = null;

    if (state.sceneContainer) {
        state.sceneContainer.x       = snap.camX;
        state.sceneContainer.y       = snap.camY;
        state.sceneContainer.scale.x = snap.camScaleX;
        state.sceneContainer.scale.y = snap.camScaleY;
    }

    import('./engine.renderer.js').then(m => m.drawGrid());

    import('./engine.objects.js').then(({ createShapeObject, createImageObject, selectObject }) => {
        for (const s of snap.objects) {
            let obj;
            if (s.isImage && s.assetId) {
                const asset = state.assets.find(a => a.id === s.assetId);
                obj = asset ? createImageObject(asset, s.x, s.y) : createShapeObject('square', s.x, s.y);
            } else {
                obj = createShapeObject(s.shapeKey || 'square', s.x, s.y);
            }
            if (!obj) continue;
            obj.label    = s.label;
            obj.scale.x  = s.scaleX;
            obj.scale.y  = s.scaleY;
            obj.rotation = s.rotation;
            obj.unityZ   = s.unityZ;
            obj.prefabId = s.prefabId || null;
            if (obj.spriteGraphic?.tint !== undefined) obj.spriteGraphic.tint = s.tint;
            if (s.animations?.length) {
                obj.animations      = s.animations;
                obj.activeAnimIndex = s.activeAnimIndex || 0;
            }
            if (state._bindGizmoHandles) state._bindGizmoHandles(obj);
        }

        const target = snap.selectedLabel
            ? state.gameObjects.find(o => o.label === snap.selectedLabel)
            : state.gameObjects[state.gameObjects.length - 1];
        if (target) selectObject(target);
        else {
            import('./engine.ui.js').then(m => { m.syncPixiToInspector(); m.refreshHierarchy(); });
        }
    });
}

// ── Console log helper ────────────────────────────────────────
function _logConsole(msg, color = '#e0e0e0') {
    const cons = document.getElementById('tab-console');
    if (!cons) return;
    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = msg;
    cons.appendChild(line);
    cons.scrollTop = cons.scrollHeight;
}
