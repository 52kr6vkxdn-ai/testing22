/* ============================================================
   Zengine — engine.prefabs.js
   Prefab system: save any object as a reusable prefab,
   drag-drop from prefab panel into any scene.
   Prefabs are stored in state.prefabs (shared across scenes).
   ============================================================ */

import { state } from './engine.state.js';

// ── Save object as prefab ─────────────────────────────────────
export function saveAsPrefab(obj) {
    if (!obj) return null;

    const prefab = {
        id:        'prefab_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        name:      obj.label || 'Prefab',
        shapeKey:  obj.shapeKey,
        isImage:   obj.isImage,
        assetId:   obj.assetId,
        tint:      obj.spriteGraphic?.tint ?? 0xFFFFFF,
        scaleX:    obj.scale.x,
        scaleY:    obj.scale.y,
        animations: obj.animations ? JSON.parse(JSON.stringify(obj.animations)) : [],
        activeAnimIndex: obj.activeAnimIndex || 0,
        thumbnail: _generateThumbnail(obj),
        createdAt: Date.now(),
    };

    state.prefabs.push(prefab);
    refreshPrefabPanel();
    return prefab;
}

// ── Instantiate prefab into scene ─────────────────────────────
export function instantiatePrefab(prefabId, x = 0, y = 0) {
    const prefab = state.prefabs.find(p => p.id === prefabId);
    if (!prefab) return null;

    return import('./engine.objects.js').then(({ createShapeObject, createImageObject }) => {
        let obj;
        if (prefab.isImage && prefab.assetId) {
            const asset = state.assets.find(a => a.id === prefab.assetId);
            if (asset) obj = createImageObject(asset, x, y);
            else       obj = createShapeObject('square', x, y);
        } else {
            obj = createShapeObject(prefab.shapeKey || 'square', x, y);
        }
        if (!obj) return null;

        // Restore prefab properties
        obj.label    = prefab.name;
        obj.scale.x  = prefab.scaleX;
        obj.scale.y  = prefab.scaleY;
        obj.prefabId = prefab.id;   // link to source
        if (obj.spriteGraphic?.tint !== undefined) obj.spriteGraphic.tint = prefab.tint;
        if (prefab.animations?.length) {
            obj.animations      = JSON.parse(JSON.stringify(prefab.animations));
            obj.activeAnimIndex = prefab.activeAnimIndex || 0;
        }
        if (state._bindGizmoHandles) state._bindGizmoHandles(obj);
        return obj;
    });
}

// ── Delete prefab ─────────────────────────────────────────────
export function deletePrefab(prefabId) {
    const idx = state.prefabs.findIndex(p => p.id === prefabId);
    if (idx === -1) return;
    state.prefabs.splice(idx, 1);
    refreshPrefabPanel();
}

// ── Rename prefab ─────────────────────────────────────────────
export function renamePrefab(prefabId, name) {
    const p = state.prefabs.find(p => p.id === prefabId);
    if (p) { p.name = name; refreshPrefabPanel(); }
}

// ── Render the prefab grid panel ──────────────────────────────
export function refreshPrefabPanel() {
    const grid = document.getElementById('prefab-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!state.prefabs.length) {
        grid.innerHTML = '<div style="color:#555; font-style:italic; padding:12px; font-size:11px;">No prefabs yet — right-click an object or use the context menu to save as prefab.</div>';
        return;
    }

    for (const prefab of state.prefabs) {
        const item = document.createElement('div');
        item.draggable = true;
        item.dataset.prefabId = prefab.id;
        item.style.cssText = `
            display:flex; flex-direction:column; align-items:center;
            width:80px; padding:6px 4px; border-radius:3px; cursor:grab;
            border:1px solid #333; background:#252525; position:relative;
            transition: border-color 0.1s, background 0.1s;
        `;

        // Thumbnail or icon
        const thumb = document.createElement('div');
        thumb.style.cssText = 'width:56px; height:56px; display:flex; align-items:center; justify-content:center; background:#1a1a1a; border-radius:3px; margin-bottom:4px; overflow:hidden;';
        if (prefab.thumbnail) {
            const img = document.createElement('img');
            img.src = prefab.thumbnail;
            img.style.cssText = 'width:100%; height:100%; object-fit:contain;';
            thumb.appendChild(img);
        } else {
            thumb.innerHTML = `<svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:none;stroke:#4a8ac4;stroke-width:1.5;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        }
        item.appendChild(thumb);

        // Name
        const nameEl = document.createElement('span');
        nameEl.textContent = prefab.name.length > 10 ? prefab.name.slice(0, 9) + '…' : prefab.name;
        nameEl.title = prefab.name;
        nameEl.style.cssText = 'font-size:10px; color:#bbb; text-align:center; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        item.appendChild(nameEl);

        // Prefab badge
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute; top:2px; left:2px; background:#1e3a5a; border:1px solid #3A72A5; color:#9bc; font-size:8px; padding:1px 3px; border-radius:2px; line-height:1.2;';
        badge.textContent = 'PREFAB';
        item.appendChild(badge);

        // Delete btn
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.title = 'Delete prefab';
        delBtn.style.cssText = 'position:absolute; top:2px; right:2px; background:#3a1a1a; border:1px solid #6a2a2a; color:#f88; border-radius:2px; width:14px; height:14px; cursor:pointer; font-size:9px; display:none; align-items:center; justify-content:center; padding:0; line-height:1;';
        item.appendChild(delBtn);

        // Hover effects
        item.addEventListener('mouseenter', () => {
            item.style.borderColor = '#3A72A5';
            item.style.background  = '#2e2e2e';
            delBtn.style.display   = 'flex';
        });
        item.addEventListener('mouseleave', () => {
            item.style.borderColor = '#333';
            item.style.background  = '#252525';
            delBtn.style.display   = 'none';
        });

        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePrefab(prefab.id);
        });

        // Double-click name to rename
        nameEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const inp = document.createElement('input');
            inp.type  = 'text';
            inp.value = prefab.name;
            inp.style.cssText = 'background:#1e1e1e; border:1px solid #3A72A5; color:#fff; font-size:10px; padding:1px 3px; width:72px; border-radius:2px; outline:none;';
            nameEl.replaceWith(inp);
            inp.focus(); inp.select();
            const commit = () => { renamePrefab(prefab.id, inp.value || prefab.name); };
            inp.addEventListener('blur', commit);
            inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); ev.stopPropagation(); });
        });

        // Drag to scene
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('prefabId', prefab.id);
            e.dataTransfer.effectAllowed = 'copy';
            item.style.opacity = '0.5';
        });
        item.addEventListener('dragend', () => { item.style.opacity = '1'; });

        grid.appendChild(item);
    }
}

// ── Init scene drop for prefabs ───────────────────────────────
export function initPrefabDrop() {
    const container = document.getElementById('pixi-container');
    if (!container) return;

    container.addEventListener('drop', (e) => {
        const prefabId = e.dataTransfer.getData('prefabId');
        if (!prefabId) return;

        const rect   = container.getBoundingClientRect();
        const px     = e.clientX - rect.left;
        const py     = e.clientY - rect.top;
        const local  = state.sceneContainer.toLocal(new PIXI.Point(px, py));

        instantiatePrefab(prefabId, local.x, local.y);
    });
}

// ── Generate a simple canvas thumbnail of the object ─────────
function _generateThumbnail(obj) {
    try {
        const renderer = state.app?.renderer;
        if (!renderer) return null;
        const tex    = renderer.generateTexture(obj, { resolution: 1, region: obj.getBounds() });
        const canvas = renderer.plugins.extract.canvas(tex);
        const out    = document.createElement('canvas');
        out.width = out.height = 56;
        const ctx = out.getContext('2d');
        const s   = Math.min(56 / canvas.width, 56 / canvas.height);
        ctx.drawImage(canvas, (56 - canvas.width * s) / 2, (56 - canvas.height * s) / 2, canvas.width * s, canvas.height * s);
        tex.destroy(true);
        return out.toDataURL();
    } catch (_) {
        return null;
    }
}
