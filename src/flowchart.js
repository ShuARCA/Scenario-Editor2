/**
 * フローチャートロジック
 */
import { generateId, rgbToHex } from './utils.js';
import { CONFIG } from './config.js';

/**
 * フローチャートの描画と操作を管理するクラス
 */
export class FlowchartApp {
    /**
     * @param {import('./eventBus.js').EventBus} eventBus - イベントバス
     */
    constructor(eventBus) {
        this.container = document.getElementById('flowchart-container');
        this.canvas = document.getElementById('flowchart-canvas');
        this.shapesLayer = document.getElementById('shapes-layer');
        this.connectionsLayer = document.getElementById('connections-layer');
        this.eventBus = eventBus;

        /** @type {Map<string, Object>} id -> shapeData */
        this.shapes = new Map();
        /** @type {Array<Object>} { from: shapeId, to: shapeId, id: ... } */
        this.connections = [];

        this.mode = 'select'; // select, connect, pan
        this.isDragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };

        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.scrollStart = { left: 0, top: 0 };

        this.connectStartShape = null;

        this.init();
    }

    setEditorManager(em) {
        this.editorManager = em;
    }

    init() {
        // ツールバー
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMode(btn.dataset.mode);
            });
        });

        // キャンバスイベント
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // コンテキストメニューのセットアップ
        this.setupContextMenu();

        // プロパティパネルのセットアップ
        this.setupPropertyPanel();

        // イベント購読
        this.eventBus.on('editor:update', (headings) => {
            this.syncFromEditor(headings);
        });
    }

    setupContextMenu() {
        this.contextMenu = document.getElementById('flowchart-context-menu');
        this.selectedShapeForContext = null;
        this.selectedConnectionForContext = null;

        // コンテキストメニュー内の入力フィールド
        this.ctxShapeSection = document.getElementById('shape-edit-section');
        this.ctxConnectionSection = document.getElementById('connection-edit-section');
        this.ctxShapeBg = document.getElementById('ctx-shape-bg');
        this.ctxShapeBorder = document.getElementById('ctx-shape-border');
        this.ctxShapeText = document.getElementById('ctx-shape-text');
        this.ctxConnectionStyle = document.getElementById('ctx-connection-style');

        // 右クリックイベント (Canvas全体で捕捉し、ターゲットがshapeか判定)
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const shapeEl = e.target.closest('.shape');
            if (shapeEl) {
                this.selectedShapeForContext = shapeEl.id;
                this.selectedConnectionForContext = null;
                this.selectShape(shapeEl.id);
                this.showContextMenu(e.clientX, e.clientY, 'shape');
            }
        });

        // コンテキストメニューのクリックイベント
        this.contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item) {
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            }
        });

        // 外側クリックでメニューを閉じる (mousedown を使用して右クリック直後の問題を回避)
        document.addEventListener('mousedown', (e) => {
            if (this.contextMenu && !this.contextMenu.contains(e.target) && !e.target.closest('.shape')) {
                this.hideContextMenu();
            }
        });

        // シェイプ用カラー入力のリアルタイム更新
        if (this.ctxShapeBg) {
            this.ctxShapeBg.addEventListener('input', (e) => {
                if (this.selectedShapeForContext) {
                    const shape = this.shapes.get(this.selectedShapeForContext);
                    if (shape && shape.element) {
                        shape.backgroundColor = e.target.value;
                        shape.element.style.backgroundColor = e.target.value;
                    }
                }
            });
        }

        if (this.ctxShapeBorder) {
            this.ctxShapeBorder.addEventListener('input', (e) => {
                if (this.selectedShapeForContext) {
                    const shape = this.shapes.get(this.selectedShapeForContext);
                    if (shape && shape.element) {
                        shape.borderColor = e.target.value;
                        shape.element.style.borderColor = e.target.value;
                    }
                }
            });
        }

        if (this.ctxShapeText) {
            this.ctxShapeText.addEventListener('input', (e) => {
                if (this.selectedShapeForContext) {
                    const shape = this.shapes.get(this.selectedShapeForContext);
                    if (shape && shape.element) {
                        shape.color = e.target.value;
                        shape.element.style.color = e.target.value;
                    }
                }
            });
        }

        // 接続線用スタイルのリアルタイム更新
        if (this.ctxConnectionStyle) {
            this.ctxConnectionStyle.addEventListener('change', (e) => {
                if (this.selectedConnectionForContext) {
                    const conn = this.connections.find(c => c.id === this.selectedConnectionForContext);
                    if (conn) {
                        if (!conn.style) conn.style = {};
                        conn.style.type = e.target.value;
                        this.drawConnections();
                    }
                }
            });
        }
    }

    showContextMenu(x, y, type) {
        // セクションの表示/非表示を切り替え
        if (type === 'shape') {
            if (this.ctxShapeSection) this.ctxShapeSection.classList.remove('hidden');
            if (this.ctxConnectionSection) this.ctxConnectionSection.classList.add('hidden');

            // 現在の値を設定
            const shape = this.shapes.get(this.selectedShapeForContext);
            if (shape) {
                if (this.ctxShapeBg) this.ctxShapeBg.value = shape.backgroundColor || '#ffffff';
                if (this.ctxShapeBorder) this.ctxShapeBorder.value = shape.borderColor || '#cbd5e1';
                if (this.ctxShapeText) this.ctxShapeText.value = shape.color || '#334155';
            }
        } else if (type === 'connection') {
            if (this.ctxShapeSection) this.ctxShapeSection.classList.add('hidden');
            if (this.ctxConnectionSection) this.ctxConnectionSection.classList.remove('hidden');

            // 現在の値を設定
            const conn = this.connections.find(c => c.id === this.selectedConnectionForContext);
            if (this.ctxConnectionStyle) {
                this.ctxConnectionStyle.value = conn?.style?.type || 'solid';
            }
        }

        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.remove('hidden');
    }

    hideContextMenu() {
        this.contextMenu.classList.add('hidden');
        this.selectedShapeForContext = null;
        this.selectedConnectionForContext = null;
    }

    handleContextMenuAction(action) {
        if (action === 'delete') {
            if (this.selectedShapeForContext) {
                this.removeShape(this.selectedShapeForContext);
            } else if (this.selectedConnectionForContext) {
                this.removeConnection(this.selectedConnectionForContext);
            }
        }
    }

    removeConnection(id) {
        this.connections = this.connections.filter(c => c.id !== id);
        // DOM要素の削除
        const path = document.getElementById(`conn-path-${id}`);
        const hit = document.getElementById(`conn-hit-${id}`);
        if (path) path.remove();
        if (hit) hit.remove();
        this.clearSelection();
    }

    setupPropertyPanel() {
        this.propertiesPanel = document.getElementById('flowchart-properties');
        this.shapeBgColorInput = document.getElementById('shapeBgColor');
        this.shapeBorderColorInput = document.getElementById('shapeBorderColor');
        this.shapeTextColorInput = document.getElementById('shapeTextColor');
        this.connectionStyleSelect = document.getElementById('connectionStyle');

        if (this.shapeBgColorInput) {
            this.shapeBgColorInput.addEventListener('input', (e) => {
                this.updateSelectedShapeStyle('backgroundColor', e.target.value);
            });
        }

        if (this.shapeBorderColorInput) {
            this.shapeBorderColorInput.addEventListener('input', (e) => {
                this.updateSelectedShapeStyle('borderColor', e.target.value);
            });
        }

        if (this.shapeTextColorInput) {
            this.shapeTextColorInput.addEventListener('input', (e) => {
                this.updateSelectedShapeStyle('color', e.target.value);
            });
        }

        if (this.connectionStyleSelect) {
            this.connectionStyleSelect.addEventListener('change', (e) => {
                this.updateSelectedConnectionStyle('type', e.target.value);
            });
        }
    }

    updateSelectedShapeStyle(prop, value) {
        this.shapes.forEach(shape => {
            if (shape.element && shape.element.classList.contains('selected')) {
                shape[prop] = value;
                shape.element.style[prop] = value;
            }
        });
    }

    updateSelectedConnectionStyle(prop, value) {
        if (this.selectedConnectionId) {
            const conn = this.connections.find(c => c.id === this.selectedConnectionId);
            if (conn) {
                if (!conn.style) conn.style = {};
                conn.style[prop] = value;
                this.drawConnections();
            }
        }
    }

    setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        this.canvas.classList.toggle('panning', mode === 'pan');

        // 状態のリセット
        this.connectStartShape = null;
        this.clearSelection();
    }

    /**
     * エディタの見出しとフローチャートの図形を同期します。
     * 見出しのIDを使用して、既存の図形と紐付けを行います。
     * @param {Array} headings - 見出し情報の配列
     */
    syncFromEditor(headings) {
        if (!headings) return;

        // すべて未確認としてマーク
        this.shapes.forEach(s => s.seen = false);

        headings.forEach((h, index) => {
            // IDで既存の図形を検索
            let shape = Array.from(this.shapes.values()).find(s => s.headingId === h.id);

            // 後方互換性: IDがない場合はインデックスで検索（古いデータ用）
            if (!shape) {
                shape = Array.from(this.shapes.values()).find(s => !s.headingId && s.headingIndex === index);
                if (shape) {
                    // IDを紐付ける
                    shape.headingId = h.id;
                }
            }

            if (shape) {
                shape.text = h.text;
                shape.seen = true;
                shape.headingIndex = index; // インデックスも更新（順序用）
                this.updateShapeElement(shape);
            } else {
                // 新規作成
                const id = generateId();
                const newShape = {
                    id: id,
                    text: h.text,
                    x: CONFIG.FLOWCHART.LAYOUT.START_X + (index * CONFIG.FLOWCHART.LAYOUT.STEP_X) % CONFIG.FLOWCHART.LAYOUT.WRAP_X,
                    y: CONFIG.FLOWCHART.LAYOUT.START_Y + Math.floor(index / 5) * CONFIG.FLOWCHART.LAYOUT.STEP_Y,
                    width: CONFIG.FLOWCHART.SHAPE.WIDTH,
                    height: CONFIG.FLOWCHART.SHAPE.HEIGHT,
                    headingIndex: index,
                    headingId: h.id, // IDを保存
                    seen: true,
                    children: []
                };
                this.shapes.set(id, newShape);
                this.createShapeElement(newShape);
            }
        });

        // エディタから削除された見出しに対応する図形を削除
        // ただし、ユーザーが手動で追加した図形（headingIdを持たない）は残す
        const toRemove = [];
        this.shapes.forEach((s, id) => {
            if (s.headingId && !s.seen) {
                toRemove.push(id);
            } else if (s.headingIndex !== undefined && !s.headingId && !s.seen) {
                // 古いデータ形式の場合の削除判定
                toRemove.push(id);
            }
        });
        toRemove.forEach(id => this.removeShape(id));

        this.drawConnections();
    }

    removeShape(id) {
        const shape = this.shapes.get(id);
        if (!shape) return;

        // 親子関係の解消
        if (shape.parent) {
            this.ungroupShape(shape);
        }
        if (shape.children) {
            // 子要素の親参照を削除（グループ解除）
            [...shape.children].forEach(childId => {
                const child = this.shapes.get(childId);
                if (child) {
                    this.ungroupShape(child);
                }
            });
        }

        // 接続の削除
        this.connections = this.connections.filter(c => c.from !== id && c.to !== id);

        // DOM要素の削除
        if (shape.element) {
            shape.element.remove();
        }

        // データ削除
        this.shapes.delete(id);

        // 選択状態の解除
        if (this.selectedShapeForContext === id) {
            this.selectedShapeForContext = null;
        }

        // プロパティパネルを隠す（もし選択されていたら）
        // 簡易的にクリア
        this.clearSelection();
    }

    createShapeElement(shapeData) {
        const el = document.createElement('div');
        el.className = 'shape';
        el.id = shapeData.id;
        el.textContent = shapeData.text;
        el.style.left = `${shapeData.x}px`;
        el.style.top = `${shapeData.y}px`;
        el.style.width = `${shapeData.width}px`;
        el.style.height = `${shapeData.height}px`; // 実際には最小の高さ

        // スタイルの適用
        if (shapeData.backgroundColor) el.style.backgroundColor = shapeData.backgroundColor;
        if (shapeData.borderColor) el.style.borderColor = shapeData.borderColor;
        if (shapeData.color) el.style.color = shapeData.color;

        // 接続ポイントの追加
        ['top', 'bottom', 'left', 'right'].forEach(pos => {
            const pt = document.createElement('div');
            pt.className = `connection-point ${pos}`;
            pt.dataset.pos = pos;
            el.appendChild(pt);
        });

        // リサイズハンドルの追加
        ['nw', 'ne', 'sw', 'se'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.pos = pos;
            el.appendChild(handle);
        });

        this.shapesLayer.appendChild(el);
        shapeData.element = el;
    }

    // ... (updateShapeElement, removeShape, handleMouseDown, handleMouseMove, handleMouseUp, handleDrop, checkCollision, isDescendant, groupShapes, ungroupShape, updateShapeStyle, toggleCollapse, setChildrenVisibility methods remain same)

    selectShape(id) {
        this.clearSelection();
        const shape = this.shapes.get(id);
        if (shape && shape.element) {
            shape.element.classList.add('selected');

            // プロパティパネルの表示と値の更新
            if (this.propertiesPanel) {
                this.propertiesPanel.classList.remove('hidden');
                if (this.shapeBgColorInput) {
                    this.shapeBgColorInput.value = rgbToHex(shape.element.style.backgroundColor) || CONFIG.FLOWCHART.COLORS.DEFAULT_BG;
                }
                if (this.shapeBorderColorInput) {
                    this.shapeBorderColorInput.value = rgbToHex(shape.element.style.borderColor) || CONFIG.FLOWCHART.COLORS.DEFAULT_BORDER;
                }
                if (this.shapeTextColorInput) {
                    this.shapeTextColorInput.value = rgbToHex(shape.element.style.color) || CONFIG.FLOWCHART.COLORS.DEFAULT_TEXT;
                }
            }
        }
    }

    clearSelection() {
        this.shapes.forEach(s => {
            if (s.element) s.element.classList.remove('selected');
        });
        this.selectedConnectionId = null;
        this.drawConnections(); // 再描画して選択状態を解除
        // プロパティパネルを隠す
        if (this.propertiesPanel) this.propertiesPanel.classList.add('hidden');
    }

    updateShapeElement(shapeData) {
        if (shapeData.element) {
            // 接続ポイントとリサイズハンドルを保持
            const points = Array.from(shapeData.element.querySelectorAll('.connection-point'));
            const handles = Array.from(shapeData.element.querySelectorAll('.resize-handle'));

            shapeData.element.textContent = shapeData.text;

            points.forEach(p => shapeData.element.appendChild(p));
            handles.forEach(h => shapeData.element.appendChild(h));
        }
    }

    updateSelectedConnectionStyle(prop, value) {
        // 簡易的な実装: 選択された接続がないため、すべての接続に適用するか、
        // または接続を選択可能にする必要があります。
        // ここでは、現在選択されている図形から出る接続に適用してみます。
        this.shapes.forEach(shape => {
            if (shape.element && shape.element.classList.contains('selected')) {
                // この図形から出る接続を探す
                this.connections.forEach(conn => {
                    if (conn.from === shape.id) {
                        conn[prop] = value;
                    }
                });
            }
        });
        this.drawConnections();
    }

    /**
     * マウスダウンイベントを処理します。
     * モードに応じてパン、選択、接続の開始を行います。
     * @param {MouseEvent} e 
     */
    handleMouseDown(e) {
        if (this.mode === 'pan') {
            this.startPan(e);
            return;
        }

        const target = e.target;

        // リサイズハンドルのクリック処理
        if (target.classList.contains('resize-handle')) {
            this.startResize(e, target);
            return;
        }

        // 接続ポイントのクリック処理
        if (this.mode === 'connect' && target.classList.contains('connection-point')) {
            this.startConnect(target);
            return;
        }

        // 図形のクリック処理
        const shapeEl = target.closest('.shape');
        if (shapeEl) {
            if (this.mode === 'select') {
                this.startDrag(e, shapeEl);
            }
        } else {
            // 背景をクリック
            this.clearSelection();
        }
    }

    startResize(e, handle) {
        e.stopPropagation();
        const shapeEl = handle.closest('.shape');
        if (!shapeEl) return;

        this.isResizing = true;
        this.resizeTarget = this.shapes.get(shapeEl.id);
        this.resizeHandlePos = handle.dataset.pos;
        this.resizeStart = { x: e.clientX, y: e.clientY };
        this.resizeStartDims = {
            x: this.resizeTarget.x,
            y: this.resizeTarget.y,
            width: this.resizeTarget.width,
            height: this.resizeTarget.height
        };

        shapeEl.classList.add('resizing');
        this.selectShape(shapeEl.id);
    }

    startPan(e) {
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.scrollStart = { left: this.container.scrollLeft, top: this.container.scrollTop };
    }

    startConnect(target) {
        const shapeEl = target.closest('.shape');
        if (shapeEl) {
            this.connectStartShape = shapeEl.id;
            // ポイントをハイライト？
        }
    }

    startDrag(e, shapeEl) {
        this.isDragging = true;
        this.dragTarget = shapeEl;
        const rect = shapeEl.getBoundingClientRect();
        // 図形の左上に対するオフセットを計算
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        this.selectShape(shapeEl.id);
    }

    handleMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.container.scrollLeft = this.scrollStart.left - dx;
            this.container.scrollTop = this.scrollStart.top - dy;
            return;
        }

        if (this.isResizing && this.resizeTarget) {
            const dx = e.clientX - this.resizeStart.x;
            const dy = e.clientY - this.resizeStart.y;
            const dims = this.resizeStartDims;
            const minW = 50;
            const minH = 30;

            let newX = dims.x;
            let newY = dims.y;
            let newW = dims.width;
            let newH = dims.height;

            if (this.resizeHandlePos.includes('e')) {
                newW = Math.max(minW, dims.width + dx);
            }
            if (this.resizeHandlePos.includes('w')) {
                const w = Math.max(minW, dims.width - dx);
                newX = dims.x + (dims.width - w);
                newW = w;
            }
            if (this.resizeHandlePos.includes('s')) {
                newH = Math.max(minH, dims.height + dy);
            }
            if (this.resizeHandlePos.includes('n')) {
                const h = Math.max(minH, dims.height - dy);
                newY = dims.y + (dims.height - h);
                newH = h;
            }

            this.resizeTarget.x = newX;
            this.resizeTarget.y = newY;
            this.resizeTarget.width = newW;
            this.resizeTarget.height = newH;

            // サイズ情報を保存
            if (this.resizeTarget.collapsed) {
                this.resizeTarget.collapsedSize = { width: newW, height: newH };
            } else {
                this.resizeTarget.expandedSize = { width: newW, height: newH };
            }

            if (this.resizeTarget.element) {
                this.resizeTarget.element.style.left = `${newX}px`;
                this.resizeTarget.element.style.top = `${newY}px`;
                this.resizeTarget.element.style.width = `${newW}px`;
                this.resizeTarget.element.style.height = `${newH}px`;
            }

            // 親のサイズ更新
            if (this.resizeTarget.parent) {
                const parent = this.shapes.get(this.resizeTarget.parent);
                if (parent) this.updateParentSize(parent);
            }

            this.drawConnections();
            return;
        }

        if (this.isDragging && this.dragTarget && this.mode === 'select') {
            // canvas-content に対する新しい位置を計算
            const canvasRect = this.canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left + this.container.scrollLeft - this.dragOffset.x;
            const y = e.clientY - canvasRect.top + this.container.scrollTop - this.dragOffset.y;

            const shape = this.shapes.get(this.dragTarget.id);
            if (shape) {
                const dx = x - shape.x;
                const dy = y - shape.y;

                this.moveShape(shape, dx, dy);

                // 親のサイズ更新
                if (shape.parent) {
                    const parent = this.shapes.get(shape.parent);
                    if (parent) this.updateParentSize(parent);
                }

                this.drawConnections();
            }
        }
    }

    moveShape(shape, dx, dy) {
        shape.x += dx;
        shape.y += dy;
        if (shape.element) {
            shape.element.style.left = `${shape.x}px`;
            shape.element.style.top = `${shape.y}px`;
        }

        // 子要素も移動
        if (shape.children) {
            shape.children.forEach(childId => {
                const child = this.shapes.get(childId);
                if (child) {
                    this.moveShape(child, dx, dy);
                }
            });
        }
    }

    handleMouseUp(e) {
        if (this.isResizing) {
            if (this.resizeTarget && this.resizeTarget.element) {
                this.resizeTarget.element.classList.remove('resizing');
            }
            this.isResizing = false;
            this.resizeTarget = null;
            this.resizeHandlePos = null;
            return;
        }

        if (this.isDragging && this.dragTarget && this.mode === 'select') {
            // ドロップ時のグループ化判定
            const droppedShape = this.shapes.get(this.dragTarget.id);
            if (droppedShape) {
                this.handleDrop(droppedShape);
            }
        }

        this.isDragging = false;
        this.dragTarget = null;
        this.isPanning = false;

        if (this.mode === 'connect' && this.connectStartShape) {
            const target = e.target;
            if (target.classList.contains('connection-point')) {
                const shapeEl = target.closest('.shape');
                if (shapeEl && shapeEl.id !== this.connectStartShape) {
                    // 接続を作成
                    this.connections.push({
                        id: generateId(),
                        from: this.connectStartShape,
                        to: shapeEl.id
                    });
                    this.drawConnections();
                }
            }
            this.connectStartShape = null;
        }
    }

    handleDrop(shape) {
        // 他の図形の上にドロップされたかチェック
        let parentCandidate = null;

        for (const [id, other] of this.shapes) {
            if (id === shape.id) continue;
            if (this.isDescendant(shape.id, id)) continue; // 自分の子孫にはドロップできない

            if (this.checkCollision(shape, other)) {
                parentCandidate = other;
            }
        }

        if (parentCandidate) {
            // グループ化
            this.groupShapes(parentCandidate, shape);
        } else {
            // 親がいた場合、親の外に出たかチェック
            if (shape.parent) {
                const parent = this.shapes.get(shape.parent);
                if (parent && !this.checkCollision(shape, parent)) {
                    this.ungroupShape(shape);
                }
            }
        }
    }

    checkCollision(inner, outer) {
        // innerの中心がouterに含まれているかで判定
        const cx = inner.x + inner.width / 2;
        const cy = inner.y + inner.height / 2;

        return (
            cx >= outer.x &&
            cx <= outer.x + outer.width &&
            cy >= outer.y &&
            cy <= outer.y + outer.height
        );
    }

    isDescendant(parentId, childId) {
        const parent = this.shapes.get(parentId);
        if (!parent || !parent.children) return false;
        if (parent.children.includes(childId)) return true;
        return parent.children.some(c => this.isDescendant(c, childId));
    }

    groupShapes(parent, child) {
        if (child.parent === parent.id) return; // 既に子

        // 既存の親から削除
        if (child.parent) {
            this.ungroupShape(child);
        }

        // 新しい親に追加
        child.parent = parent.id;
        if (!parent.children) parent.children = [];
        parent.children.push(child.id);

        // スタイル更新
        // スタイル更新
        this.updateShapeStyle(parent);
        this.updateParentSize(parent);
    }

    ungroupShape(child) {
        if (!child.parent) return;

        const parent = this.shapes.get(child.parent);
        if (parent) {
            parent.children = parent.children.filter(id => id !== child.id);
            this.updateShapeStyle(parent);
            this.updateParentSize(parent);
        }
        child.parent = null;
    }

    updateShapeStyle(shape) {
        if (!shape.element) return;

        if (shape.children && shape.children.length > 0) {
            shape.element.classList.add('group-parent');
            // 折りたたみボタンの追加（なければ）
            if (!shape.element.querySelector('.group-toggle')) {
                const toggle = document.createElement('div');
                toggle.className = 'group-toggle';
                toggle.textContent = '-';
                toggle.addEventListener('mousedown', (e) => {
                    e.stopPropagation(); // ドラッグ開始を防ぐ
                    this.toggleCollapse(shape);
                });
                shape.element.appendChild(toggle);
            }
        } else {
            shape.element.classList.remove('group-parent');
            const toggle = shape.element.querySelector('.group-toggle');
            if (toggle) toggle.remove();
        }
    }

    toggleCollapse(shape) {
        // 現在の状態のサイズを保存
        if (shape.collapsed) {
            shape.collapsedSize = { width: shape.width, height: shape.height };
        } else {
            shape.expandedSize = { width: shape.width, height: shape.height };
        }

        const oldHeight = shape.height;
        shape.collapsed = !shape.collapsed;
        const toggle = shape.element.querySelector('.group-toggle');
        if (toggle) toggle.textContent = shape.collapsed ? '+' : '-';

        // 子要素の表示/非表示
        this.setChildrenVisibility(shape, !shape.collapsed);

        // サイズ復元または再計算
        if (shape.collapsed) {
            if (shape.collapsedSize) {
                shape.width = shape.collapsedSize.width;
                shape.height = shape.collapsedSize.height;
                this.updateShapeDOM(shape);
            } else {
                // デフォルト（最小）サイズ
                shape.width = CONFIG.FLOWCHART.SHAPE.WIDTH;
                shape.height = CONFIG.FLOWCHART.SHAPE.HEIGHT;
                this.updateShapeDOM(shape);
            }
        } else {
            if (shape.expandedSize) {
                shape.width = shape.expandedSize.width;
                shape.height = shape.expandedSize.height;
                this.updateShapeDOM(shape);
                // 必要に応じて子要素を包含するように拡張するかチェックしてもよいが
                // ここではユーザーが設定したサイズを優先する
                // ただし、子要素がはみ出ている場合は updateParentSize を呼んで調整する手もある
                // 今回は updateParentSize を呼ぶと自動計算で上書きされる可能性があるため、
                // 復元のみ行う。
            } else {
                this.updateParentSize(shape);
            }
        }

        // レイアウト調整
        const deltaY = shape.height - oldHeight;
        if (deltaY !== 0) {
            this.adjustLayout(shape, deltaY);
        }

        this.drawConnections();
    }

    updateShapeDOM(shape) {
        if (shape.element) {
            shape.element.style.width = `${shape.width}px`;
            shape.element.style.height = `${shape.height}px`;
            shape.element.style.left = `${shape.x}px`;
            shape.element.style.top = `${shape.y}px`;
        }
    }

    updateParentSize(shape) {
        if (!shape.children || shape.children.length === 0) return;

        if (shape.collapsed) {
            // 折りたたみ時はサイズ変更しない（ユーザー指定サイズまたはデフォルトを維持）
            // ただし、初期化時などでサイズがない場合はデフォルトを設定
            if (!shape.width) shape.width = CONFIG.FLOWCHART.SHAPE.WIDTH;
            if (!shape.height) shape.height = CONFIG.FLOWCHART.SHAPE.HEIGHT;
        } else {
            // 展開時は子要素を包含する矩形を計算
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            // まず子要素の範囲を取得
            shape.children.forEach(childId => {
                const child = this.shapes.get(childId);
                if (child) {
                    minX = Math.min(minX, child.x);
                    minY = Math.min(minY, child.y);
                    maxX = Math.max(maxX, child.x + child.width);
                    maxY = Math.max(maxY, child.y + child.height);
                }
            });

            const padding = CONFIG.FLOWCHART.LAYOUT.GROUP_PADDING;
            const headerHeight = CONFIG.FLOWCHART.LAYOUT.GROUP_HEADER_HEIGHT; // 親のラベル部分

            // 親の新しいRect
            // 子要素のBoundingBoxを包む
            let newX = Math.min(shape.x, minX - padding);
            let newY = Math.min(shape.y, minY - headerHeight - padding);
            let newWidth = Math.max(shape.width, (maxX - newX) + padding);
            let newHeight = Math.max(shape.height, (maxY - newY) + padding);

            // ユーザーが手動で広げたサイズ（expandedSize）があれば、それより小さくならないようにする
            if (shape.expandedSize) {
                newWidth = Math.max(newWidth, shape.expandedSize.width);
                newHeight = Math.max(newHeight, shape.expandedSize.height);
            }

            shape.x = newX;
            shape.y = newY;
            shape.width = newWidth;
            shape.height = newHeight;

            // 現在のサイズをexpandedSizeとして更新（自動拡張された場合のため）
            shape.expandedSize = { width: newWidth, height: newHeight };
        }

        // DOM更新
        this.updateShapeDOM(shape);
    }

    adjustLayout(sourceShape, deltaY) {
        // sourceShapeより下にある図形を移動
        // 単純なY座標比較 + 水平方向の重なりチェック

        const sourceBottom = sourceShape.y + sourceShape.height - deltaY; // 変更前のボトム？
        // いや、単純に中心座標などで判定

        this.shapes.forEach(shape => {
            if (shape.id === sourceShape.id) return;
            if (this.isDescendant(sourceShape.id, shape.id)) return; // 子孫は親と一緒に動く（サイズ変更で包含される）
            if (shape.parent) return; // 親がいる場合は親のサイズ変更で処理されるはず（トップレベルのみ調整）

            // 水平方向の重なりがあるか
            const horizontalOverlap = (
                shape.x < sourceShape.x + sourceShape.width &&
                shape.x + shape.width > sourceShape.x
            );

            if (horizontalOverlap && shape.y > sourceShape.y) {
                this.moveShape(shape, 0, deltaY);
            }
        });
    }

    setChildrenVisibility(shape, visible) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.shapes.get(childId);
            if (child && child.element) {
                child.element.style.display = visible ? 'flex' : 'none';
                // 再帰的に処理（子が展開されていれば表示、折りたたまれていれば非表示のまま）
                if (visible && child.children && child.children.length > 0) {
                    this.setChildrenVisibility(child, !child.collapsed);
                } else if (!visible && child.children) {
                    // 親が非表示なら子も非表示
                    this.setChildrenVisibility(child, false);
                }
            }
        });
    }


    drawConnections() {
        // 既存の接続パスを追跡するためのセット
        const activeConnectionIds = new Set();

        this.connections.forEach(conn => {
            const fromShape = this.shapes.get(conn.from);
            const toShape = this.shapes.get(conn.to);

            if (!fromShape || !toShape || !fromShape.element || !toShape.element) return;

            // 親が折りたたまれていて、自分が非表示の場合は描画しない
            if (fromShape.element.style.display === 'none' || toShape.element.style.display === 'none') {
                // 非表示の場合はDOM要素があれば削除
                const existingPath = document.getElementById(`conn-path-${conn.id}`);
                const existingHit = document.getElementById(`conn-hit-${conn.id}`);
                if (existingPath) existingPath.remove();
                if (existingHit) existingHit.remove();
                return;
            }

            activeConnectionIds.add(conn.id);

            // 接続ポイントの計算
            const startX = fromShape.x + fromShape.width / 2;
            const startY = fromShape.y + fromShape.height / 2;
            const endX = toShape.x + toShape.width / 2;
            const endY = toShape.y + toShape.height / 2;

            // ベジェ曲線
            const dx = Math.abs(endX - startX);
            const cp1x = startX + dx * 0.5;
            const cp1y = startY;
            const cp2x = endX - dx * 0.5;
            const cp2y = endY;

            const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

            // パス要素の取得または作成
            let path = document.getElementById(`conn-path-${conn.id}`);
            let hitPath = document.getElementById(`conn-hit-${conn.id}`);

            if (!path) {
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.id = `conn-path-${conn.id}`;
                path.setAttribute('fill', 'none');
                this.connectionsLayer.appendChild(path);

                hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                hitPath.id = `conn-hit-${conn.id}`;
                hitPath.setAttribute('stroke', 'transparent');
                hitPath.setAttribute('stroke-width', '10');
                hitPath.setAttribute('fill', 'none');
                hitPath.style.cursor = 'pointer';
                hitPath.style.pointerEvents = 'stroke';
                hitPath.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectConnection(conn.id);
                });
                hitPath.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectedConnectionForContext = conn.id;
                    this.selectedShapeForContext = null;
                    this.selectConnection(conn.id);
                    this.showContextMenu(e.clientX, e.clientY, 'connection');
                });
                this.connectionsLayer.appendChild(hitPath);
            }

            // 属性の更新
            path.setAttribute('d', d);
            hitPath.setAttribute('d', d);

            if (this.selectedConnectionId === conn.id) {
                path.setAttribute('stroke', CONFIG.FLOWCHART.COLORS.CONNECTION_SELECTED);
                path.setAttribute('stroke-width', '3');
                path.setAttribute('marker-end', 'url(#arrow-head-selected)');
            } else {
                path.setAttribute('stroke', conn.style?.color || CONFIG.FLOWCHART.COLORS.CONNECTION_DEFAULT);
                path.setAttribute('stroke-width', '2');
                path.setAttribute('marker-end', 'url(#arrow-head)');
            }

            if (conn.style?.type === 'dashed') {
                path.setAttribute('stroke-dasharray', '5,5');
            } else {
                path.removeAttribute('stroke-dasharray');
            }
        });

        // 存在しなくなった接続のDOM要素を削除
        Array.from(this.connectionsLayer.children).forEach(child => {
            // IDから接続IDを抽出
            const match = child.id.match(/^conn-(path|hit)-(.*)$/);
            if (match) {
                const connId = match[2];
                if (!activeConnectionIds.has(connId)) {
                    child.remove();
                }
            }
        });
    }

    selectConnection(id) {
        this.clearSelection();
        this.selectedConnectionId = id;
        this.drawConnections();

        // プロパティパネル表示
        if (this.propertiesPanel) {
            this.propertiesPanel.classList.remove('hidden');
        }
        // 接続用の設定を表示、シェイプ用を隠すなどの制御が必要だが
        // ここでは簡易的に全部表示
        const conn = this.connections.find(c => c.id === id);
        if (conn && conn.style && this.connectionStyleSelect) {
            this.connectionStyleSelect.value = conn.style.type || 'solid';
        } else if (this.connectionStyleSelect) {
            this.connectionStyleSelect.value = 'solid';
        }
    }
}
