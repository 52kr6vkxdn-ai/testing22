/* ============================================================
   Zengine — engine.input.js
   Camera pan/zoom and gizmo drag interactions.
   ============================================================ */

import { state } from './engine.state.js';
import { syncPixiToInspector } from './engine.ui.js';

// ── Camera Controls ──────────────────────────────────────────
/**
 * Register middle-mouse pan and scroll-wheel zoom on the canvas.
 */
export function initCameraControls() {
    const canvas = state.app.view;

    let isPanning = false;

    canvas.addEventListener('mousedown', (e) => { if (e.button === 1) isPanning = true; });
    canvas.addEventListener('mouseup',   ()  => { isPanning = false; });
    canvas.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        state.sceneContainer.x += e.movementX;
        state.sceneContainer.y += e.movementY;
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const pointer    = state.app.renderer.events.pointer.global;
        const localPos   = state.sceneContainer.toLocal(pointer);

        state.sceneContainer.scale.x *= zoomFactor;
        state.sceneContainer.scale.y *= zoomFactor;

        const newGlobal = state.sceneContainer.toGlobal(localPos);
        state.sceneContainer.x += pointer.x - newGlobal.x;
        state.sceneContainer.y += pointer.y - newGlobal.y;
    });
}

// ── Gizmo Drag ───────────────────────────────────────────────
/**
 * Wire up pointer events for all gizmo handles.
 * Drag state:
 *   activeDrag   — which handle is being dragged
 *   dragStartLocal — scene-local pointer position at drag start
 *   objStartData   — snapshot of transform at drag start
 */
export function initGizmoDrag() {
    const { _gizmoHandles: h, app, sceneContainer, gameObject } = state;

    let activeDrag    = null;
    let dragStartLocal = null;
    let objStartData   = null;

    // ─ Start ────────────────────────────────────────────
    function onDragStart(e, mode) {
        activeDrag     = mode;
        dragStartLocal = sceneContainer.toLocal(e.global);
        objStartData   = {
            x:   gameObject.x,
            y:   gameObject.y,
            sx:  gameObject.scale.x,
            sy:  gameObject.scale.y,
            rot: gameObject.rotation,
        };

        if (mode === 'r') {
            const localCenter = gameObject.parent.toLocal(gameObject.getGlobalPosition());
            objStartData.startAngle = Math.atan2(
                dragStartLocal.y - localCenter.y,
                dragStartLocal.x - localCenter.x
            );
        }

        e.stopPropagation();
    }

    // ─ Move ─────────────────────────────────────────────
    function onDragMove(e) {
        if (!activeDrag) return;

        const currentLocal = sceneContainer.toLocal(e.global);
        const dx = currentLocal.x - dragStartLocal.x;
        const dy = currentLocal.y - dragStartLocal.y;

        switch (activeDrag) {

            case 'tC':
                gameObject.x = objStartData.x + dx;
                gameObject.y = objStartData.y + dy;
                break;

            case 'tX':
            case 'tY': {
                const angle  = gameObject.rotation;
                const isX    = activeDrag === 'tX';
                const axisX  = isX ? Math.cos(angle)            : Math.cos(angle - Math.PI / 2);
                const axisY  = isX ? Math.sin(angle)            : Math.sin(angle - Math.PI / 2);
                const proj   = dx * axisX + dy * axisY;
                gameObject.x = objStartData.x + proj * axisX;
                gameObject.y = objStartData.y + proj * axisY;
                break;
            }

            case 'sX':
            case 'sY': {
                const angle  = gameObject.rotation;
                const isX    = activeDrag === 'sX';
                const axisX  = isX ? Math.cos(angle)            : Math.cos(angle - Math.PI / 2);
                const axisY  = isX ? Math.sin(angle)            : Math.sin(angle - Math.PI / 2);
                const proj   = dx * axisX + dy * axisY;
                const delta  = proj / 50;                        // Sensitivity
                if (isX) gameObject.scale.x = objStartData.sx + delta;
                else     gameObject.scale.y = objStartData.sy + delta;
                break;
            }

            case 'sC': {
                const delta = (dx - dy) / 50;
                gameObject.scale.set(
                    objStartData.sx + delta,
                    objStartData.sy + delta
                );
                break;
            }

            case 'r': {
                const localCenter  = gameObject.parent.toLocal(gameObject.getGlobalPosition());
                const currentAngle = Math.atan2(
                    currentLocal.y - localCenter.y,
                    currentLocal.x - localCenter.x
                );
                gameObject.rotation = objStartData.rot + (currentAngle - objStartData.startAngle);
                break;
            }
        }

        syncPixiToInspector();
    }

    // ─ End ──────────────────────────────────────────────
    function onDragEnd() { activeDrag = null; }

    // ─ Bind handles ─────────────────────────────────────
    h.transX.on('pointerdown',      e => onDragStart(e, 'tX'));
    h.transY.on('pointerdown',      e => onDragStart(e, 'tY'));
    h.transCenter.on('pointerdown', e => onDragStart(e, 'tC'));
    h.scaleX.on('pointerdown',      e => onDragStart(e, 'sX'));
    h.scaleY.on('pointerdown',      e => onDragStart(e, 'sY'));
    h.scaleCenter.on('pointerdown', e => onDragStart(e, 'sC'));
    h.rotRing.on('pointerdown',     e => onDragStart(e, 'r'));

    // Global stage listeners for move/up
    app.stage.eventMode = 'static';
    app.stage.hitArea   = new PIXI.Rectangle(-100000, -100000, 200000, 200000);
    app.stage.on('pointermove',       onDragMove);
    app.stage.on('pointerup',         onDragEnd);
    app.stage.on('pointerupoutside',  onDragEnd);
}
