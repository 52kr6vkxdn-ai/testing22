/* ============================================================
   Zengine — engine.core.js
   Boot sequence.
   ============================================================ */

import { state }                          from './engine.state.js';
import { initScene, startGizmoSizeTicker }from './engine.renderer.js';
import { createShapeObject }              from './engine.objects.js';
import { initCameraControls, initGizmoDrag, initKeyboardShortcuts } from './engine.input.js';
import {
    cacheInspectorElements,
    initInspectorListeners,
    setGizmoMode,
    syncPixiToInspector,
    refreshHierarchy,
    refreshAssetPanel,
    refreshPrefabPanel,
    initSceneDrop,
} from './engine.ui.js';
import { initScenes, toggleSceneDropdown } from './engine.scenes.js';

export function startEngine() {
    if (typeof PIXI === 'undefined') {
        document.getElementById('pixi-container').innerHTML =
            `<div style="color:red;padding:20px;">Error: PIXI.js failed to load.</div>`;
        return;
    }

    const container = document.getElementById('pixi-container');
    state.app = new PIXI.Application({
        resizeTo:        container,
        backgroundColor: 0x282828,
        resolution:      window.devicePixelRatio || 1,
        autoDensity:     true,
        preference:      'webgl',
        antialias:       true,
    });
    container.appendChild(state.app.view);

    // Image quality: use linear (bilinear) filtering — no pixelation on scale/zoom
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.LINEAR;
    // Preserve full resolution — no forced downscale
    PIXI.settings.MIPMAP_TEXTURES = PIXI.MIPMAP_MODES.ON;

    initScene();
    startGizmoSizeTicker();
    initCameraControls();
    initGizmoDrag();
    initKeyboardShortcuts();
    cacheInspectorElements();
    initInspectorListeners();
    initSceneDrop();

    setGizmoMode('translate');

    // Create default object
    const sq = createShapeObject('square', 0, 0);
    if (sq && state._bindGizmoHandles) state._bindGizmoHandles(sq);

    syncPixiToInspector();
    refreshHierarchy();
    refreshAssetPanel();

    // Init scenes + menus
    initScenes();
    initMenus();
    initResizePanels();
}

// ── Menu System ───────────────────────────────────────────────
function initMenus() {
    // Close any open menu on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-item')) {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());
        }
    });

    // Assets menu
    const assetsBtn = document.getElementById('menu-assets');
    if (assetsBtn) {
        assetsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu(assetsBtn, [
                {
                    label: '📁 Import Asset…',
                    action: () => {
                        document.getElementById('asset-file-input')?.click();
                    }
                },
                { separator: true },
                { label: 'Create Folder', action: () => {} },
                { label: 'Refresh', action: () => refreshAssetPanel() },
            ]);
        });
    }

    // File input for assets (images + audio)
    const fileInput = document.getElementById('asset-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();

                if (file.type.startsWith('image/')) {
                    reader.onload = (ev) => {
                        const asset = {
                            id:      'asset_' + Date.now() + '_' + Math.random().toString(36).slice(2),
                            name:    file.name,
                            type:    'sprite',
                            dataURL: ev.target.result,
                        };
                        state.assets.push(asset);
                        refreshAssetPanel();
                    };
                    reader.readAsDataURL(file);

                } else if (file.type.startsWith('audio/')) {
                    reader.onload = (ev) => {
                        const asset = {
                            id:      'asset_' + Date.now() + '_' + Math.random().toString(36).slice(2),
                            name:    file.name,
                            type:    'audio',
                            dataURL: ev.target.result,
                            size:    file.size,
                            mimeType: file.type,
                        };
                        state.assets.push(asset);
                        refreshAssetPanel();
                        // Auto-switch to audio folder view
                        import('./engine.ui.js').then(m => m.setAssetFilter('audio'));
                    };
                    reader.readAsDataURL(file);
                }
            });
            fileInput.value = '';
        });
    }

    // Save as Prefab button
    const prefabBtn = document.getElementById('btn-save-prefab');
    if (prefabBtn) {
        prefabBtn.addEventListener('click', () => {
            if (!state.gameObject) return;
            import('./engine.objects.js').then(m => {
                const prefab = m.saveAsPrefab(state.gameObject);
                if (prefab) {
                    document.getElementById('tab-prefabs-btn')?.click();
                }
            });
        });
    }

    // Apply to all instances button
    const applyAllBtn = document.getElementById('btn-prefab-apply-all');
    if (applyAllBtn) {
        applyAllBtn.addEventListener('click', () => {
            const go = state.gameObject;
            if (!go?.prefabId) return;
            import('./engine.objects.js').then(m => m.applyPrefabToAll(go.prefabId));
        });
    }

    // Open Prefab Editor button (from inspector)
    const editPrefabBtn = document.getElementById('btn-prefab-open-editor');
    if (editPrefabBtn) {
        editPrefabBtn.addEventListener('click', () => {
            const go = state.gameObject;
            if (!go?.prefabId) return;
            const prefab = state.prefabs.find(p => p.id === go.prefabId);
            if (prefab) import('./engine.prefab-editor.js').then(m => m.openPrefabEditor(prefab));
        });
    }

    // Unlink from prefab button
    const unlinkBtn = document.getElementById('btn-prefab-unlink');
    if (unlinkBtn) {
        unlinkBtn.addEventListener('click', () => {
            if (!state.gameObject) return;
            import('./engine.objects.js').then(m => m.unlinkFromPrefab(state.gameObject));
        });
    }

    // GameObject menu
    const goBtn = document.getElementById('menu-gameobject');
    if (goBtn) {
        goBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            import('./engine.objects.js').then(({ SHAPES, createShapeObject }) => {
                const items = Object.entries(SHAPES).map(([key, def]) => ({
                    label: `${_shapeIcon(key)}  ${def.label}`,
                    action: () => {
                        const obj = createShapeObject(key);
                        if (obj && state._bindGizmoHandles) state._bindGizmoHandles(obj);
                    }
                }));
                toggleMenu(goBtn, [
                    { label: '─── 2D Shapes ───', disabled: true },
                    ...items,
                    { separator: true },
                    { label: '✦ Empty Object', action: () => {
                        import('./engine.objects.js').then(({ createShapeObject }) => {
                            const obj = createShapeObject('square');
                            if (obj && state._bindGizmoHandles) state._bindGizmoHandles(obj);
                        });
                    }},
                ]);
            });
        });
    }
}

function _shapeIcon(key) {
    const map = {
        square:'■', circle:'●', triangle:'▲', diamond:'◆',
        pentagon:'⬠', hexagon:'⬡', star:'★', capsule:'▬',
        rightTriangle:'◤', arrow:'↑'
    };
    return map[key] || '■';
}

function toggleMenu(anchor, items) {
    // Remove any existing
    document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.cssText = `
        position: fixed;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 3px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6);
        z-index: 9999;
        min-width: 180px;
        padding: 3px 0;
        font-size: 11px;
        color: #e0e0e0;
    `;

    for (const item of items) {
        if (item.separator) {
            const sep = document.createElement('div');
            sep.style.cssText = 'border-top:1px solid #444; margin:3px 0;';
            menu.appendChild(sep);
            continue;
        }
        const row = document.createElement('div');
        row.style.cssText = `
            padding: 5px 14px;
            cursor: ${item.disabled ? 'default' : 'pointer'};
            color: ${item.disabled ? '#666' : '#e0e0e0'};
            white-space: nowrap;
            letter-spacing: 0.3px;
        `;
        row.textContent = item.label;
        if (!item.disabled) {
            row.addEventListener('mouseenter', () => row.style.background = '#3A72A5');
            row.addEventListener('mouseleave', () => row.style.background = '');
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.remove();
                item.action();
            });
        }
        menu.appendChild(row);
    }

    const rect = anchor.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top  = (rect.bottom + 2) + 'px';
    document.body.appendChild(menu);
}

// ── Resizable Panels ──────────────────────────────────────────
function initResizePanels() {
    // Hierarchy (left) resize
    const hierarchyResizer = document.getElementById('resizer-hierarchy');
    const hierarchyPanel   = document.getElementById('panel-hierarchy');
    if (hierarchyResizer && hierarchyPanel) {
        makeHorizResizer(hierarchyResizer, hierarchyPanel, 'left', 140, 400);
    }

    // Inspector (right) resize
    const inspectorResizer = document.getElementById('resizer-inspector');
    const inspectorPanel   = document.getElementById('panel-inspector');
    if (inspectorResizer && inspectorPanel) {
        makeHorizResizer(inspectorResizer, inspectorPanel, 'right', 200, 500);
    }

    // Bottom panel (project/assets) resize
    const bottomResizer = document.getElementById('resizer-bottom');
    const bottomPanel   = document.getElementById('panel-bottom');
    if (bottomResizer && bottomPanel) {
        makeVertResizer(bottomResizer, bottomPanel, 120, 500);
    }
}

function makeHorizResizer(handle, panel, side, minW, maxW) {
    let dragging = false, startX = 0, startW = 0;

    handle.addEventListener('mousedown', (e) => {
        dragging = true;
        startX   = e.clientX;
        startW   = panel.getBoundingClientRect().width;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
        const newW  = Math.max(minW, Math.min(maxW, startW + delta));
        panel.style.width = newW + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
}

function makeVertResizer(handle, panel, minH, maxH) {
    let dragging = false, startY = 0, startH = 0;

    handle.addEventListener('mousedown', (e) => {
        dragging = true;
        startY   = e.clientY;
        startH   = panel.getBoundingClientRect().height;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const newH = Math.max(minH, Math.min(maxH, startH - (e.clientY - startY)));
        panel.style.height = newH + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
}
