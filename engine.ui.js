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
        const pf = document.getElementById('inspector-prefab-section');
        if (pf) pf.style.display = 'none';
        _clearOverrideIndicators();
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

    // Per-object exact color (white-based drawing → tint = exact colour)
    if (els.color && go.spriteGraphic?.tint !== undefined) {
        const hex = '#' + (go.spriteGraphic.tint >>> 0).toString(16).padStart(6, '0');
        els.color.value = hex;
    }

    // Prefab section
    const pfSection = document.getElementById('inspector-prefab-section');
    if (pfSection) {
        if (go.prefabId) {
            const prefab = state.prefabs.find(p => p.id === go.prefabId);
            pfSection.style.display = '';
            const nameEl = document.getElementById('inspector-prefab-name');
            if (nameEl) nameEl.textContent = prefab ? prefab.name : 'Unknown Prefab';
        } else {
            pfSection.style.display = 'none';
        }
    }

    // Override indicators
    _refreshOverrideIndicators(go);
}

// ── Inspector → PIXI ─────────────────────────────────────────
export function syncInspectorToPixi() {
    if (!els) return;
    const go = state.gameObject;
    if (!go) return;

    go.x        = (parseFloat(els.px.value) || 0) *  PIXELS_PER_UNIT;
    go.y        = (parseFloat(els.py.value) || 0) * -PIXELS_PER_UNIT;
    const newZ  = parseFloat(els.pz.value) || 0;
    const zChanged = newZ !== (go.unityZ || 0);
    go.unityZ   = newZ;
    go.rotation = (parseFloat(els.rz.value) || 0) * -Math.PI / 180;
    go.scale.x  = parseFloat(els.sx.value) || 1;
    go.scale.y  = parseFloat(els.sy.value) || 1;

    if (zChanged) import('./engine.objects.js').then(m => m.sortByZ());
}

// ── Override Indicator helpers ────────────────────────────────
// Map of: fieldKey → { inputId, btnId }
const _OVERRIDE_MAP = {
    tint:     { inputId: 'inp-color',   btnId: 'ovr-tint' },
    scaleX:   { inputId: 'inp-scale-x', btnId: 'ovr-scaleX' },
    scaleY:   { inputId: 'inp-scale-y', btnId: 'ovr-scaleY' },
    rotation: { inputId: 'inp-rot-z',   btnId: 'ovr-rotation' },
};

function _refreshOverrideIndicators(go) {
    const isPrefabInst = !!(go?.prefabId);
    for (const [field, { btnId }] of Object.entries(_OVERRIDE_MAP)) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;
        if (isPrefabInst && go.overrides?.[field]) {
            btn.style.display = 'inline-flex';
        } else {
            btn.style.display = 'none';
        }
    }
}

function _clearOverrideIndicators() {
    for (const { btnId } of Object.values(_OVERRIDE_MAP)) {
        const btn = document.getElementById(btnId);
        if (btn) btn.style.display = 'none';
    }
}

function _markOverride(field) {
    const go = state.gameObject;
    if (!go?.prefabId) return;
    if (!go.overrides) go.overrides = {};
    go.overrides[field] = true;
    _refreshOverrideIndicators(go);
}

// ── Inspector Listeners ───────────────────────────────────────
export function initInspectorListeners() {
    if (!els) return;

    // Position / Z — position is always instance-unique, not an override field
    ['px','py','pz'].forEach(k => els[k].addEventListener('input', syncInspectorToPixi));

    // Rotation — override-trackable
    els.rz.addEventListener('input', () => {
        syncInspectorToPixi();
        _markOverride('rotation');
    });

    // Scale X / Y — override-trackable
    els.sx.addEventListener('input', () => { syncInspectorToPixi(); _markOverride('scaleX'); });
    els.sy.addEventListener('input', () => { syncInspectorToPixi(); _markOverride('scaleY'); });

    // Tint color — override-trackable
    els.color.addEventListener('input', (e) => {
        const go = state.gameObject;
        if (!go) return;
        const hex = e.target.value.replace('#', '0x');
        const sp  = go.spriteGraphic;
        if (sp && sp.tint !== undefined) sp.tint = parseInt(hex, 16);
        _markOverride('tint');
    });

    // Override reset buttons
    for (const [field, { btnId }] of Object.entries(_OVERRIDE_MAP)) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            import('./engine.objects.js').then(m => m.resetOverride(state.gameObject, field));
        });
    }

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
let _assetFilter = 'all'; // 'all' | 'sprite' | 'audio'

export function setAssetFilter(filter) {
    _assetFilter = filter;
    refreshAssetPanel();
}

export function refreshAssetPanel() {
    const grid = document.getElementById('asset-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const filtered = state.assets.filter(a => {
        if (_assetFilter === 'sprite') return a.type !== 'audio';
        if (_assetFilter === 'audio')  return a.type === 'audio';
        return true;
    });

    for (const asset of filtered) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.style.cssText = 'display:flex; flex-direction:column; align-items:center; width:72px; padding:4px; border-radius:2px; cursor:grab; border:1px solid transparent;';
        item.draggable = true;
        item.dataset.assetId = asset.id;

        if (asset.type === 'audio') {
            // Audio icon
            const iconWrap = document.createElement('div');
            iconWrap.style.cssText = 'width:48px; height:48px; display:flex; align-items:center; justify-content:center; background:#1a1a2e; border-radius:4px; font-size:24px;';
            iconWrap.textContent = '🎵';
            item.appendChild(iconWrap);
        } else {
            const thumb = document.createElement('img');
            thumb.src = asset.dataURL;
            thumb.style.cssText = 'width:48px; height:48px; object-fit:contain; border-radius:2px; background:#1e1e1e;';
            item.appendChild(thumb);
        }

        const name = document.createElement('span');
        name.textContent = asset.name.length > 10 ? asset.name.slice(0, 9) + '…' : asset.name;
        name.title = asset.name;
        name.style.cssText = 'font-size:10px; color:#ccc; text-align:center; margin-top:3px; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        item.appendChild(name);

        // Drag start
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('assetId', asset.id);
            e.dataTransfer.effectAllowed = 'copy';
        });

        // Hover
        item.addEventListener('mouseenter', () => item.style.background = '#444');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');

        // Click audio asset → select for inspector
        if (asset.type === 'audio') {
            item.addEventListener('click', () => _showAudioInspector(asset));
        }

        grid.appendChild(item);
    }

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#555; font-size:11px; padding:12px; font-style:italic;';
        empty.textContent = _assetFilter === 'audio' ? 'No audio assets imported' : 'No assets yet';
        grid.appendChild(empty);
    }
}

function _showAudioInspector(asset) {
    // Show basic audio info in a toast/status bar
    const bar = document.getElementById('audio-inspector-bar');
    if (!bar) return;
    bar.innerHTML = `
        <span style="color:#aaa; margin-right:8px;">🎵 ${asset.name}</span>
        <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;color:#666;cursor:pointer;font-size:12px;">✕</button>
    `;
    bar.style.display = 'flex';
}

// ── Prefab Panel ──────────────────────────────────────────────
let _prefabSearch  = '';
let _prefabTagFilter = '';  // '' = all tags

export function refreshPrefabPanel() {
    const container = document.getElementById('prefab-panel-inner');
    if (!container) return;
    container.innerHTML = '';

    // ── Toolbar: search + export/import ───────────────────────
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;align-items:center;gap:5px;padding:5px 8px;border-bottom:1px solid #1a1a1a;flex-shrink:0;background:#0e1520;';

    const searchInp = document.createElement('input');
    searchInp.type = 'text';
    searchInp.placeholder = '🔍 Search…';
    searchInp.value = _prefabSearch;
    searchInp.style.cssText = 'flex:1;background:#141e2a;border:1px solid #2a3a4a;color:#ccc;border-radius:3px;padding:3px 7px;font-size:10px;min-width:0;';
    searchInp.addEventListener('input', (e) => { _prefabSearch = e.target.value; refreshPrefabPanel(); });
    toolbar.appendChild(searchInp);

    const countBadge = document.createElement('span');
    countBadge.style.cssText = 'font-size:9px;color:#444;white-space:nowrap;';
    countBadge.textContent = `${state.prefabs.length}`;
    toolbar.appendChild(countBadge);

    // Export button
    const exportBtn = _makeToolbarBtn('⬆ Export', '#141e2a', '#2a3a4a', '#7af', 'Export prefab library as JSON');
    exportBtn.addEventListener('click', _exportPrefabs);
    toolbar.appendChild(exportBtn);

    // Import button
    const importBtn = _makeToolbarBtn('⬇ Import', '#141e2a', '#2a3a4a', '#8f8', 'Import prefab library from JSON');
    importBtn.addEventListener('click', _importPrefabs);
    toolbar.appendChild(importBtn);

    container.appendChild(toolbar);

    // ── Tag filter chips ───────────────────────────────────────
    const allTags = [...new Set(state.prefabs.flatMap(p => p.tags || []))].sort();
    if (allTags.length > 0) {
        const tagRow = document.createElement('div');
        tagRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:4px 8px;border-bottom:1px solid #1a1a1a;flex-shrink:0;background:#0a1018;';

        const allChip = _makeTagChip('All', _prefabTagFilter === '');
        allChip.addEventListener('click', () => { _prefabTagFilter = ''; refreshPrefabPanel(); });
        tagRow.appendChild(allChip);

        for (const tag of allTags) {
            const chip = _makeTagChip(tag, _prefabTagFilter === tag);
            chip.addEventListener('click', () => { _prefabTagFilter = tag; refreshPrefabPanel(); });
            tagRow.appendChild(chip);
        }
        container.appendChild(tagRow);
    }

    // ── Grid ───────────────────────────────────────────────────
    const grid = document.createElement('div');
    grid.id = 'prefab-grid';
    grid.style.cssText = 'flex:1;overflow-y:auto;padding:8px;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;';
    container.appendChild(grid);

    const query  = _prefabSearch.toLowerCase().trim();
    let visible  = state.prefabs;
    if (query)            visible = visible.filter(p => p.name.toLowerCase().includes(query) || (p.tags||[]).some(t => t.toLowerCase().includes(query)));
    if (_prefabTagFilter) visible = visible.filter(p => (p.tags||[]).includes(_prefabTagFilter));

    if (visible.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#444;font-size:11px;padding:20px;font-style:italic;width:100%;text-align:center;line-height:1.6;';
        empty.innerHTML = state.prefabs.length === 0
            ? '📦 No prefabs yet.<br><span style="font-size:10px;">Select an object → <b>Save as Prefab</b></span>'
            : '🔍 Nothing matches.';
        grid.appendChild(empty);
        return;
    }

    for (const prefab of visible) {
        grid.appendChild(_buildPrefabCard(prefab));
    }
}

function _makeToolbarBtn(label, bg, border, color, title) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText = `background:${bg};border:1px solid ${border};color:${color};border-radius:3px;padding:2px 7px;cursor:pointer;font-size:9px;white-space:nowrap;`;
    return btn;
}

function _makeTagChip(label, active) {
    const chip = document.createElement('button');
    chip.textContent = label;
    chip.style.cssText = `
        background:${active ? '#1a3a5a' : '#0d1520'};
        border:1px solid ${active ? '#3A72A5' : '#2a3a4a'};
        color:${active ? '#9bc' : '#557'};
        border-radius:10px; padding:2px 8px; cursor:pointer; font-size:9px;
        transition: all .1s;
    `;
    return chip;
}

function _buildPrefabCard(prefab) {
    const instanceCount = state.gameObjects.filter(o => o.prefabId === prefab.id).length;
    const overrideCount = state.gameObjects.filter(o => o.prefabId === prefab.id && Object.values(o.overrides||{}).some(Boolean)).length;
    const tintHex = '#' + (prefab.tint >>> 0).toString(16).padStart(6, '0');

    const card = document.createElement('div');
    card.style.cssText = `display:flex;flex-direction:column;align-items:center;width:84px;
        padding:5px 4px 4px;border-radius:5px;cursor:grab;position:relative;
        border:1px solid #2a4060;background:#0e1828;`;
    card.draggable = true;
    card.dataset.prefabId = prefab.id;
    card.title = `${prefab.name}${prefab.tags?.length ? '\nTags: ' + prefab.tags.join(', ') : ''}\n${instanceCount} instance${instanceCount !== 1 ? 's' : ''} • double-click to edit`;

    // Colour swatch top bar
    const swatch = document.createElement('div');
    swatch.style.cssText = `position:absolute;top:0;left:0;right:0;height:3px;border-radius:5px 5px 0 0;background:${tintHex};`;
    card.appendChild(swatch);

    // Icon (coloured)
    const icon = document.createElement('div');
    icon.style.cssText = `width:46px;height:46px;display:flex;align-items:center;justify-content:center;
        font-size:${prefab.isImage ? 22 : 28}px;background:#060e18;border-radius:5px;margin-top:3px;color:${tintHex};`;
    icon.textContent = prefab.isImage ? '🖼️' : _prefabIcon(prefab.shapeKey);
    card.appendChild(icon);

    // Name (double-click to rename inline)
    const name = document.createElement('span');
    name.textContent = prefab.name.length > 12 ? prefab.name.slice(0, 11) + '…' : prefab.name;
    name.title = prefab.name;
    name.style.cssText = 'font-size:9px;color:#9bc;text-align:center;margin-top:3px;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;';
    name.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const inp = document.createElement('input');
        inp.value = prefab.name;
        inp.style.cssText = 'width:100%;background:#0d1f2d;border:1px solid #3A72A5;color:#9bc;font-size:9px;border-radius:2px;padding:0 2px;text-align:center;';
        name.replaceWith(inp);
        inp.focus(); inp.select();
        const commit = () => {
            if (inp.value.trim()) { prefab.name = inp.value.trim(); prefab.updatedAt = Date.now(); }
            refreshPrefabPanel();
        };
        inp.addEventListener('blur', commit);
        inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); ev.stopPropagation(); });
    });
    card.appendChild(name);

    // Tags row
    if (prefab.tags?.length > 0) {
        const tagsRow = document.createElement('div');
        tagsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;justify-content:center;margin-top:2px;width:100%;';
        for (const t of prefab.tags.slice(0, 2)) {
            const chip = document.createElement('span');
            chip.textContent = t;
            chip.style.cssText = 'background:#1a2a3a;color:#68a;font-size:7px;padding:1px 4px;border-radius:6px;';
            tagsRow.appendChild(chip);
        }
        if (prefab.tags.length > 2) {
            const more = document.createElement('span');
            more.textContent = `+${prefab.tags.length - 2}`;
            more.style.cssText = 'color:#445;font-size:7px;padding:1px 2px;';
            tagsRow.appendChild(more);
        }
        card.appendChild(tagsRow);
    }

    // Badges row: instance count + override count + anim indicator
    const badges = document.createElement('div');
    badges.style.cssText = 'position:absolute;top:5px;left:3px;display:flex;flex-direction:column;gap:2px;';
    if (instanceCount > 0) {
        const b = document.createElement('span');
        b.textContent = `×${instanceCount}`;
        b.style.cssText = 'background:#0d2040;color:#7af;font-size:7px;padding:1px 3px;border-radius:6px;line-height:1.4;border:1px solid #1a3a5a;';
        badges.appendChild(b);
    }
    if (overrideCount > 0) {
        const b = document.createElement('span');
        b.textContent = `${overrideCount}M`;
        b.title = `${overrideCount} instance${overrideCount > 1 ? 's' : ''} with local overrides`;
        b.style.cssText = 'background:#2a1a0a;color:#fa8;font-size:7px;padding:1px 3px;border-radius:6px;line-height:1.4;border:1px solid #5a3010;';
        badges.appendChild(b);
    }
    card.appendChild(badges);

    if (prefab.animations?.length > 0) {
        const animDot = document.createElement('span');
        animDot.textContent = '▶';
        animDot.title = `${prefab.animations.length} animation${prefab.animations.length > 1 ? 's' : ''}`;
        animDot.style.cssText = 'position:absolute;top:5px;right:16px;color:#facc15;font-size:7px;';
        card.appendChild(animDot);
    }

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.title = 'Remove prefab';
    delBtn.style.cssText = 'position:absolute;top:3px;right:3px;background:none;border:none;color:#333;cursor:pointer;font-size:9px;padding:0;line-height:1;';
    delBtn.addEventListener('mouseenter', () => delBtn.style.color = '#f88');
    delBtn.addEventListener('mouseleave', () => delBtn.style.color = '#333');
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Delete prefab "${prefab.name}"?`)) return;
        state.prefabs.splice(state.prefabs.indexOf(prefab), 1);
        refreshPrefabPanel();
    });
    card.appendChild(delBtn);

    // Action row: Edit + Tag + Find
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:2px;margin-top:3px;width:100%;';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✎ Edit';
    editBtn.style.cssText = 'flex:1;background:#082008;border:1px solid #1a5a1a;color:#3a8;border-radius:2px;font-size:8px;padding:2px 0;cursor:pointer;';
    editBtn.addEventListener('mouseenter', () => { editBtn.style.borderColor = '#4ade80'; editBtn.style.color = '#4ade80'; });
    editBtn.addEventListener('mouseleave', () => { editBtn.style.borderColor = '#1a5a1a'; editBtn.style.color = '#3a8'; });
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        import('./engine.prefab-editor.js').then(m => m.openPrefabEditor(prefab));
    });

    const tagBtn = document.createElement('button');
    tagBtn.textContent = '🏷';
    tagBtn.title = 'Edit tags';
    tagBtn.style.cssText = 'background:#0e1828;border:1px solid #2a3a50;color:#68a;border-radius:2px;font-size:10px;padding:1px 4px;cursor:pointer;';
    tagBtn.addEventListener('click', (e) => { e.stopPropagation(); _showTagEditor(prefab, card); });

    const findBtn = document.createElement('button');
    findBtn.textContent = '◎';
    findBtn.title = 'Select first instance in scene';
    findBtn.style.cssText = 'background:#0e1828;border:1px solid #2a3a50;color:#7af;border-radius:2px;font-size:9px;padding:1px 4px;cursor:pointer;';
    findBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const inst = state.gameObjects.find(o => o.prefabId === prefab.id);
        if (inst) import('./engine.objects.js').then(m => m.selectObject(inst));
    });

    actions.appendChild(editBtn);
    actions.appendChild(tagBtn);
    actions.appendChild(findBtn);
    card.appendChild(actions);

    // Drag
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('prefabId', prefab.id);
        e.dataTransfer.effectAllowed = 'copy';
    });

    card.addEventListener('dblclick', () => {
        import('./engine.prefab-editor.js').then(m => m.openPrefabEditor(prefab));
    });

    card.addEventListener('mouseenter', () => { card.style.background = '#132030'; card.style.borderColor = '#3A72A5'; });
    card.addEventListener('mouseleave', () => { card.style.background = '#0e1828'; card.style.borderColor = '#2a4060'; });

    return card;
}

// ── Tag editor popover ────────────────────────────────────────
function _showTagEditor(prefab, anchor) {
    document.getElementById('tag-editor-pop')?.remove();
    const pop = document.createElement('div');
    pop.id = 'tag-editor-pop';
    const r = anchor.getBoundingClientRect();
    pop.style.cssText = `position:fixed;left:${r.right + 6}px;top:${r.top}px;
        background:#0e1828;border:1px solid #3A72A5;border-radius:4px;
        padding:8px;z-index:99998;min-width:160px;font-size:11px;color:#ccc;
        box-shadow:0 4px 16px rgba(0,0,0,.7);`;

    pop.innerHTML = `<div style="font-weight:bold;color:#9bc;margin-bottom:6px;font-size:10px;">🏷 Tags for "${prefab.name}"</div>`;

    if (!prefab.tags) prefab.tags = [];

    const tagsList = document.createElement('div');
    tagsList.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;min-height:20px;';

    const renderTags = () => {
        tagsList.innerHTML = '';
        (prefab.tags || []).forEach(tag => {
            const chip = document.createElement('span');
            chip.style.cssText = 'background:#1a2a3a;color:#9bc;font-size:9px;padding:2px 6px;border-radius:8px;display:flex;align-items:center;gap:3px;cursor:pointer;';
            chip.innerHTML = `${tag} <span style="color:#f88;font-size:9px;">✕</span>`;
            chip.addEventListener('click', () => {
                prefab.tags = prefab.tags.filter(t => t !== tag);
                renderTags();
                refreshPrefabPanel();
            });
            tagsList.appendChild(chip);
        });
        if (prefab.tags.length === 0) {
            tagsList.innerHTML = '<span style="color:#444;font-size:9px;font-style:italic;">no tags</span>';
        }
    };
    renderTags();
    pop.appendChild(tagsList);

    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:4px;';
    const inp = document.createElement('input');
    inp.placeholder = 'Add tag…';
    inp.style.cssText = 'flex:1;background:#141e2a;border:1px solid #2a3a4a;color:#ccc;border-radius:3px;padding:2px 5px;font-size:9px;';
    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.style.cssText = 'background:#1a3a1a;border:1px solid #3a8;color:#8f8;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:10px;';
    const doAdd = () => {
        const v = inp.value.trim().replace(/\s+/g, '-').toLowerCase();
        if (v && !prefab.tags.includes(v)) { prefab.tags.push(v); renderTags(); refreshPrefabPanel(); }
        inp.value = '';
        inp.focus();
    };
    addBtn.addEventListener('click', doAdd);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); e.stopPropagation(); });
    addRow.appendChild(inp); addRow.appendChild(addBtn);
    pop.appendChild(addRow);

    document.body.appendChild(pop);
    inp.focus();

    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!pop.contains(e.target) && e.target !== anchor) {
                pop.remove();
                document.removeEventListener('click', handler);
            }
        });
    }, 0);
}

// ── Export / Import ───────────────────────────────────────────
function _exportPrefabs() {
    if (state.prefabs.length === 0) { alert('No prefabs to export.'); return; }
    const data = JSON.stringify({ version: 1, prefabs: state.prefabs }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'zengine-prefabs.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _importPrefabs() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', () => {
        const file = inp.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                const incoming = parsed.prefabs || (Array.isArray(parsed) ? parsed : null);
                if (!incoming) { alert('Invalid prefab file.'); return; }
                let added = 0;
                for (const p of incoming) {
                    if (!p.id || !p.name) continue;
                    // Skip duplicates by id
                    if (state.prefabs.some(ex => ex.id === p.id)) continue;
                    // Ensure required fields
                    p.tags = p.tags || [];
                    p.overrides = {};
                    p.createdAt = p.createdAt || Date.now();
                    p.updatedAt = p.updatedAt || Date.now();
                    state.prefabs.push(p);
                    added++;
                }
                refreshPrefabPanel();
                alert(`Imported ${added} prefab${added !== 1 ? 's' : ''}.`);
            } catch (e) { alert('Failed to parse prefab file: ' + e.message); }
        };
        reader.readAsText(file);
    });
    inp.click();
}

function _prefabIcon(shapeKey) {
    const map = { square:'■', circle:'●', triangle:'▲', diamond:'◆', pentagon:'⬠', hexagon:'⬡', star:'★', capsule:'▬', rightTriangle:'◤', arrow:'↑' };
    return map[shapeKey] || '■';
}

// ── Drop onto scene canvas ────────────────────────────────────
export function initSceneDrop() {
    const container = document.getElementById('pixi-container');
    if (!container) return;

    container.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });

    container.addEventListener('drop', (e) => {
        e.preventDefault();

        // Convert page coords → scene-local coords
        const rect   = container.getBoundingClientRect();
        const px     = e.clientX - rect.left;
        const py     = e.clientY - rect.top;
        const global = new PIXI.Point(px, py);
        const local  = state.sceneContainer.toLocal(global);

        // ── Prefab drop ──────────────────────────────────────
        const prefabId = e.dataTransfer.getData('prefabId');
        if (prefabId) {
            const prefab = state.prefabs.find(p => p.id === prefabId);
            if (prefab && state.app) {
                import('./engine.objects.js').then(m => m.instantiatePrefab(prefab, local.x, local.y));
            }
            return;
        }

        // ── Asset drop (image only — skip audio) ─────────────
        const assetId = e.dataTransfer.getData('assetId');
        if (!assetId) return;
        const asset = state.assets.find(a => a.id === assetId);
        if (!asset || !state.app || asset.type === 'audio') return;

        import('./engine.objects.js').then(m => {
            const obj = m.createImageObject(asset, local.x, local.y);
            if (obj && state._bindGizmoHandles) state._bindGizmoHandles(obj);
        });
    });
}
