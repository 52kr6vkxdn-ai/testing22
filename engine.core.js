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
    initSceneDrop,
} from './engine.ui.js';
import { initScenes, toggleSceneDropdown } from './engine.scenes.js';
import { refreshPrefabPanel, initPrefabDrop } from './engine.prefabs.js';
import { refreshAudioPanel } from './engine.audio.js';

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
    });
    container.appendChild(state.app.view);

    initScene();
    startGizmoSizeTicker();
    initCameraControls();
    initGizmoDrag();
    initKeyboardShortcuts();
    cacheInspectorElements();
    initInspectorListeners();
    initSceneDrop();
    initPrefabDrop();

    setGizmoMode('translate');

    // Create default object
    const sq = createShapeObject('square', 0, 0);
    if (sq && state._bindGizmoHandles) state._bindGizmoHandles(sq);

    syncPixiToInspector();
    refreshHierarchy();
    refreshAssetPanel();
    refreshPrefabPanel();
    refreshAudioPanel();

    // Init scenes + menus
    initScenes();
    initMenus();
    initResizePanels();
    initContextMenu();
}

// ── Right-click context menu on scene ────────────────────────
function initContextMenu() {
    const canvas = document.getElementById('pixi-container');
    if (!canvas) return;
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const obj = state.gameObject;
        if (!obj) return;

        document.getElementById('ctx-menu')?.remove();
        const menu = document.createElement('div');
        menu.id = 'ctx-menu';
        menu.style.cssText = \`position:fixed;left:\${e.clientX}px;top:\${e.clientY}px;
            background:#242424;border:1px solid #444;border-radius:3px;
            box-shadow:0 4px 16px rgba(0,0,0,0.6);z-index:9999;font-size:11px;
            color:#e0e0e0;min-width:160px;padding:3px 0;\`;

        const items = [
            { label: '⭐ Save as Prefab', action: () => {
                import('./engine.prefabs.js').then(m => {
                    m.saveAsPrefab(obj);
                    // Switch to prefab tab
                    document.getElementById('tab-prefabs-btn')?.click();
                });
            }},
            { separator: true },
            { label: '🗑 Delete Object', action: () => import('./engine.objects.js').then(m => m.deleteSelected()) },
        ];

        for (const item of items) {
            if (item.separator) {
                const s = document.createElement('div');
                s.style.cssText = 'border-top:1px solid #333;margin:3px 0;';
                menu.appendChild(s); continue;
            }
            const row = document.createElement('div');
            row.style.cssText = 'padding:6px 14px;cursor:pointer;white-space:nowrap;';
            row.textContent = item.label;
            row.addEventListener('mouseenter', () => row.style.background = '#3A72A5');
            row.addEventListener('mouseleave', () => row.style.background = '');
            row.addEventListener('click', () => { menu.remove(); item.action(); });
            menu.appendChild(row);
        }

        document.body.appendChild(menu);
        setTimeout(() => {
            document.addEventListener('click', function h() { menu.remove(); document.removeEventListener('click', h); });
        }, 0);
    });
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

    // File input for assets
    const fileInput = document.getElementById('asset-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => {
                if (!file.type.startsWith('image/')) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const asset = {
                        id:      'asset_' + Date.now() + '_' + Math.random().toString(36).slice(2),
                        name:    file.name,
                        dataURL: ev.target.result,
                    };
                    state.assets.push(asset);
                    refreshAssetPanel();
                };
                reader.readAsDataURL(file);
            });
            // Reset so same file can be re-imported
            fileInput.value = '';
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
