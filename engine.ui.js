/* ============================================================
   Zengine — engine.ui.js
   Inspector, hierarchy, asset panel, menus, resize handles.
   ============================================================ */

import { state, PIXELS_PER_UNIT } from './engine.state.js';

let els = null;

// ── Cache DOM ─────────────────────────────────────────────────
export function cacheInspectorElements() {
    els = {
        px: document.getElementById('inp-pos-x'),
        py: document.getElementById('inp-pos-y'),
        pz: document.getElementById('inp-pos-z'),
        rz: document.getElementById('inp-rot-z'),
        sx: document.getElementById('inp-scale-x'),
        sy: document.getElementById('inp-scale-y'),
        color:     document.getElementById('inp-color'),
        gizmoMode: document.getElementById('select-gizmo-mode'),
        objName:   document.getElementById('inp-obj-name'),
        btns: {
            t: document.getElementById('btn-tool-translate'),
            r: document.getElementById('btn-tool-rotate'),
            s: document.getElementById('btn-tool-scale'),
            a: document.getElementById('btn-tool-all'),
        },
    };
}

// ── PIXI → Inspector ─────────────────────────────────────────
export function syncPixiToInspector() {
    if (!els) return;
    const go = state.gameObject;
    if (!go) {
        ['px','py','pz','rz','sx','sy'].forEach(k => { if(els[k]) els[k].value = ''; });
        if (els.objName) els.objName.value = '';
        return;
    }

    els.px.value = (go.x  /  PIXELS_PER_UNIT).toFixed(2);
    els.py.value = (-go.y /  PIXELS_PER_UNIT).toFixed(2);
    els.pz.value = (go.unityZ || 0).toFixed(2);

    let deg = (go.rotation * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    els.rz.value = (-deg).toFixed(1);

    els.sx.value = go.scale.x.toFixed(2);
    els.sy.value = go.scale.y.toFixed(2);
    if (els.objName) els.objName.value = go.label || '';
}

// ── Inspector → PIXI ─────────────────────────────────────────
export function syncInspectorToPixi() {
    if (!els) return;
    const go = state.gameObject;
    if (!go) return;

    const prevZ = go.unityZ;
    go.x        = (parseFloat(els.px.value) || 0) *  PIXELS_PER_UNIT;
    go.y        = (parseFloat(els.py.value) || 0) * -PIXELS_PER_UNIT;
    go.unityZ   =  parseFloat(els.pz.value) || 0;
    go.rotation = (parseFloat(els.rz.value) || 0) * -Math.PI / 180;
    go.scale.x  =  parseFloat(els.sx.value) || 1;
    go.scale.y  =  parseFloat(els.sy.value) || 1;

    // Z value changed → re-sort render order immediately
    if (go.unityZ !== prevZ) {
        import('./engine.objects.js').then(m => m.applyZOrder(go));
    }
}

// ── Inspector Listeners ───────────────────────────────────────
export function initInspectorListeners() {
    if (!els) return;
    ['px','py','pz','rz','sx','sy'].forEach(k => {
        els[k].addEventListener('input', syncInspectorToPixi);
    });

    els.color.addEventListener('input', (e) => {
        const go = state.gameObject;
        if (!go) return;
        const hex = e.target.value.replace('#', '0x');
        const sp = go.spriteGraphic;
        if (sp && sp.tint !== undefined) sp.tint = parseInt(hex);
    });

    els.gizmoMode.addEventListener('change', (e) => setGizmoMode(e.target.value));

    els.btns.t.addEventListener('click', () => setGizmoMode('translate'));
    els.btns.r.addEventListener('click', () => setGizmoMode('rotate'));
    els.btns.s.addEventListener('click', () => setGizmoMode('scale'));
    els.btns.a.addEventListener('click', () => setGizmoMode('all'));

    if (els.objName) {
        els.objName.addEventListener('input', (e) => {
            if (state.gameObject) {
                state.gameObject.label = e.target.value;
                refreshHierarchy();
            }
        });
    }
}

// ── Gizmo Mode ────────────────────────────────────────────────
export function setGizmoMode(mode) {
    state.gizmoMode = mode;

    // Apply to ALL objects
    for (const obj of state.gameObjects) {
        if (!obj._grpTranslate) continue;
        obj._grpTranslate.visible = mode === 'translate' || mode === 'all';
        obj._grpRotate.visible    = mode === 'rotate'    || mode === 'all';
        obj._grpScale.visible     = mode === 'scale'     || mode === 'all';
        // Only show gizmos on selected
        if (obj !== state.gameObject) {
            obj._grpTranslate.visible = false;
            obj._grpRotate.visible    = false;
            obj._grpScale.visible     = false;
        }
    }

    if (!els) return;
    els.gizmoMode.value = mode;
    els.btns.t.className = `tool-btn${mode === 'translate' ? ' active' : ''}`;
    els.btns.r.className = `tool-btn${mode === 'rotate'    ? ' active' : ''}`;
    els.btns.s.className = `tool-btn${mode === 'scale'     ? ' active' : ''}`;
    els.btns.a.className = `tool-btn${mode === 'all'       ? ' active' : ''}`;
}

// ── Hierarchy Panel ───────────────────────────────────────────
export function refreshHierarchy() {
    const list = document.getElementById('hierarchy-list');
    if (!list) return;

    list.innerHTML = '';

    for (const obj of state.gameObjects) {
        const item = document.createElement('div');
        item.className = 'tree-item ml-4' + (obj === state.gameObject ? ' selected' : '');
        item.dataset.objId = state.gameObjects.indexOf(obj);
        item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding: 3px 8px; cursor:pointer;';

        const left = document.createElement('div');
        left.style.cssText = 'display:flex; align-items:center; flex:1; min-width:0;';

        // Icon
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox','0 0 24 24');
        icon.style.cssText = 'width:14px; height:14px; fill:none; stroke:#aaa; stroke-width:1.5; margin-right:4px; flex-shrink:0;';
        icon.innerHTML = obj.isImage
            ? '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="#aaa"/><path d="M21 15l-5-5L5 21"/>'
            : '<rect x="4" y="4" width="16" height="16" rx="1"/>';
        left.appendChild(icon);

        // Name (double-click to rename)
        const nameEl = document.createElement('span');
        nameEl.textContent = obj.label || 'Object';
        nameEl.style.cssText = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;';
        nameEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const inp = document.createElement('input');
            inp.type  = 'text';
            inp.value = obj.label || '';
            inp.style.cssText = 'background:#1e1e1e; border:1px solid #3A72A5; color:#fff; font-size:11px; padding:0 2px; width:100%;';
            nameEl.replaceWith(inp);
            inp.focus(); inp.select();
            const commit = () => {
                obj.label = inp.value || obj.label;
                refreshHierarchy();
                if (obj === state.gameObject && els?.objName) els.objName.value = obj.label;
            };
            inp.addEventListener('blur', commit);
            inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') inp.blur(); });
        });
        left.appendChild(nameEl);
        item.appendChild(left);

        // Z-order buttons
        const zBtns = document.createElement('div');
        zBtns.style.cssText = 'display:flex; gap:2px; flex-shrink:0; margin-left:4px;';

        const upBtn = _makeZBtn('▲', () => { import('./engine.objects.js').then(m => m.moveObjectUp(obj)); });
        const dnBtn = _makeZBtn('▼', () => { import('./engine.objects.js').then(m => m.moveObjectDown(obj)); });
        zBtns.appendChild(upBtn); zBtns.appendChild(dnBtn);
        item.appendChild(zBtns);

        // Click to select
        item.addEventListener('click', () => {
            import('./engine.objects.js').then(m => m.selectObject(obj));
        });

        // Double-click to open animation editor
        item.addEventListener('dblclick', () => {
            import('./engine.objects.js').then(m => m.selectObject(obj));
            import('./engine.animator.js').then(m => m.openAnimationEditor(obj));
        });

        list.appendChild(item);
    }

    if (state.gameObjects.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#666; font-size:11px; padding:8px 16px; font-style:italic;';
        empty.textContent = 'No objects in scene';
        list.appendChild(empty);
    }
}

function _makeZBtn(label, cb) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = label === '▲' ? 'Move Up (draw order)' : 'Move Down (draw order)';
    btn.style.cssText = 'background:#2a2a2a; border:1px solid #444; color:#999; font-size:9px; padding:1px 3px; cursor:pointer; border-radius:2px; line-height:1;';
    btn.addEventListener('click', (e) => { e.stopPropagation(); cb(); });
    btn.addEventListener('mouseenter', () => btn.style.color = '#fff');
    btn.addEventListener('mouseleave', () => btn.style.color = '#999');
    return btn;
}

// ── Asset Panel ───────────────────────────────────────────────
export function refreshAssetPanel() {
    const grid = document.getElementById('asset-grid');
    if (!grid) return;

    grid.innerHTML = '';

    for (const asset of state.assets) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:72px; padding:4px; border-radius:2px; cursor:grab; border:1px solid transparent;';
        item.draggable = true;
        item.dataset.assetId = asset.id;

        const thumb = document.createElement('img');
        thumb.src = asset.dataURL;
        thumb.style.cssText = 'width:48px; height:48px; object-fit:contain; border-radius:2px; background:#1e1e1e; image-rendering:auto;';

        const name = document.createElement('span');
        name.textContent = asset.name.length > 10 ? asset.name.slice(0, 9) + '…' : asset.name;
        name.title = asset.name;
        name.style.cssText = 'font-size:10px; color:#ccc; text-align:center; margin-top:3px; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';

        item.appendChild(thumb);
        item.appendChild(name);

        // Drag start
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('assetId', asset.id);
            e.dataTransfer.effectAllowed = 'copy';
        });

        // Hover
        item.addEventListener('mouseenter', () => item.style.background = '#444');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');

        grid.appendChild(item);
    }
}

// ── Drop onto scene canvas ────────────────────────────────────
export function initSceneDrop() {
    const container = document.getElementById('pixi-container');
    if (!container) return;

    container.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const assetId = e.dataTransfer.getData('assetId');
        if (!assetId) return;
        const asset = state.assets.find(a => a.id === assetId);
        if (!asset || !state.app) return;

        // Convert page coords → scene-local coords
        const rect   = container.getBoundingClientRect();
        const px     = e.clientX - rect.left;
        const py     = e.clientY - rect.top;
        const global = new PIXI.Point(px, py);
        const local  = state.sceneContainer.toLocal(global);

        import('./engine.objects.js').then(m => {
            const obj = m.createImageObject(asset, local.x, local.y);
            if (obj && state._bindGizmoHandles) state._bindGizmoHandles(obj);
        });
    });
}
