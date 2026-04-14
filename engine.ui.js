/* ============================================================
   Zengine — engine.ui.js
   Inspector panel ↔ PIXI sync and toolbar tool-mode logic.
   ============================================================ */

import { state, PIXELS_PER_UNIT } from './engine.state.js';

// ── DOM Element Cache ────────────────────────────────────────
let els = null;

/**
 * Cache inspector DOM elements. Call once after DOMContentLoaded.
 */
export function cacheInspectorElements() {
    els = {
        px: document.getElementById('inp-pos-x'),
        py: document.getElementById('inp-pos-y'),
        pz: document.getElementById('inp-pos-z'),
        rz: document.getElementById('inp-rot-z'),
        sx: document.getElementById('inp-scale-x'),
        sy: document.getElementById('inp-scale-y'),
        sz: document.getElementById('inp-scale-z'),
        color:     document.getElementById('inp-color'),
        gizmoMode: document.getElementById('select-gizmo-mode'),
        btns: {
            t: document.getElementById('btn-tool-translate'),
            r: document.getElementById('btn-tool-rotate'),
            s: document.getElementById('btn-tool-scale'),
            a: document.getElementById('btn-tool-all'),
        },
    };
}

// ── PIXI → Inspector ────────────────────────────────────────
/**
 * Read the game object's current Pixi transform and push it
 * to the inspector input fields.
 */
export function syncPixiToInspector() {
    if (!els) return;
    const go = state.gameObject;

    els.px.value = (go.x / PIXELS_PER_UNIT).toFixed(2);
    els.py.value = (-go.y / PIXELS_PER_UNIT).toFixed(2);  // Unity Y is up
    els.pz.value = go.unityZ.toFixed(2);

    let deg = (go.rotation * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    els.rz.value = (-deg).toFixed(1);                      // CCW positive

    els.sx.value = go.scale.x.toFixed(2);
    els.sy.value = go.scale.y.toFixed(2);
}

// ── Inspector → PIXI ────────────────────────────────────────
/**
 * Read the inspector input fields and apply them to the Pixi
 * game object transform.
 */
export function syncInspectorToPixi() {
    if (!els) return;
    const go = state.gameObject;

    go.x       = (parseFloat(els.px.value) || 0) *  PIXELS_PER_UNIT;
    go.y       = (parseFloat(els.py.value) || 0) * -PIXELS_PER_UNIT;
    go.unityZ  =  parseFloat(els.pz.value) || 0;
    go.rotation = (parseFloat(els.rz.value) || 0) * -Math.PI / 180;
    go.scale.x  =  parseFloat(els.sx.value) || 1;
    go.scale.y  =  parseFloat(els.sy.value) || 1;
}

// ── Inspector Event Listeners ────────────────────────────────
/**
 * Wire up all inspector inputs so typing in them updates PIXI
 * in real time.
 */
export function initInspectorListeners() {
    if (!els) return;

    // Transform fields
    ['px', 'py', 'pz', 'rz', 'sx', 'sy'].forEach(key => {
        els[key].addEventListener('input', syncInspectorToPixi);
    });

    // Colour picker → sprite tint
    els.color.addEventListener('input', (e) => {
        const hex = e.target.value.replace('#', '0x');
        state.spriteBox.tint = parseInt(hex);
    });

    // Gizmo mode dropdown
    els.gizmoMode.addEventListener('change', (e) => setGizmoMode(e.target.value));

    // Toolbar buttons
    els.btns.t.addEventListener('click', () => setGizmoMode('translate'));
    els.btns.r.addEventListener('click', () => setGizmoMode('rotate'));
    els.btns.s.addEventListener('click', () => setGizmoMode('scale'));
    els.btns.a.addEventListener('click', () => setGizmoMode('all'));
}

// ── Tool Mode ────────────────────────────────────────────────
/**
 * Switch the active gizmo mode, showing/hiding the appropriate
 * handles and updating toolbar button active states.
 *
 * @param {'translate'|'rotate'|'scale'|'all'} mode
 */
export function setGizmoMode(mode) {
    const { grpTranslate, grpRotate, grpScale } = state;

    grpTranslate.visible = mode === 'translate' || mode === 'all';
    grpRotate.visible    = mode === 'rotate'    || mode === 'all';
    grpScale.visible     = mode === 'scale'     || mode === 'all';

    state.gizmoMode = mode;

    if (!els) return;
    els.gizmoMode.value = mode;
    els.btns.t.className = `tool-btn${mode === 'translate' ? ' active' : ''}`;
    els.btns.r.className = `tool-btn${mode === 'rotate'    ? ' active' : ''}`;
    els.btns.s.className = `tool-btn${mode === 'scale'     ? ' active' : ''}`;
    els.btns.a.className = `tool-btn${mode === 'all'       ? ' active' : ''}`;
}
