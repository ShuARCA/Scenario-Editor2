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
     * FlowchartAppのコンストラクタ
     * 
     * @param {import('./eventBus.js').EventBus} eventBus - アプリケーション全体で使用するイベントバス
     */
    constructor(eventBus) {
        // =====================================================
        // DOM要素の参照
        // =====================================================
        this.container = document.getElementById('flowchart-container');
        this.canvas = document.getElementById('flowchart-canvas');
        this.shapesLayer = document.getElementById('shapes-layer');
        this.connectionsLayer = document.getElementById('connections-layer');
        this.canvasContent = document.getElementById('canvas-content');

        // =====================================================
        // イベントバス
        // =====================================================
        this.eventBus = eventBus;

        // =====================================================
        // データストア
        // =====================================================
        /** @type {Map<string, Object>} シェイプID -> シェイプデータ */
        this.shapes = new Map();
        /** @type {Array<Object>} 接続線の配列 { id, from, to, fromPoint, toPoint, style } */
        this.connections = [];

        // =====================================================
        // 操作モード状態
        // =====================================================
        this.mode = 'select'; // 'select' | 'connect' | 'pan'

        // =====================================================
        // ドラッグ操作状態
        // =====================================================
        this.isDragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };

        // =====================================================
        // パン操作状態
        // =====================================================
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.scrollStart = { left: 0, top: 0 };

        // =====================================================
        // 接続操作状態
        // =====================================================
        this.connectStartShape = null;

        // =====================================================
        // ズーム設定
        // =====================================================
        this.zoomLevel = 1.0;
        this.zoomMin = 0.1;
        this.zoomMax = 2.0;
        this.zoomStep = 0.1;

        // 初期化処理を実行
        this.init();
    }

    /**
     * エディタマネージャを設定
     * 
     * @param {Object} em - エディタマネージャのインスタンス
     */
    setEditorManager(em) {
        this.editorManager = em;
    }

    /**
     * フローチャートの初期化処理
     * - ツールバーボタンのイベント登録
     * - ズームボタンのイベント登録
     * - キャンバスのマウスイベント登録
     * - コンテキストメニューのセットアップ
     * - イベントバスの購読
     */
    init() {
        // モード切り替えボタンの設定
        document.querySelectorAll('.mode-btn').forEach(btn => {
            if (btn.dataset.mode) {
                btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
            }
        });

        // ズームボタンの設定
        this.setupZoomButtons();

        // キャンバスのマウスイベント
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // コンテキストメニューのセットアップ
        this.setupContextMenu();

        // エディタからの更新イベントを購読
        this.eventBus.on('editor:update', (headings) => this.syncFromEditor(headings));
    }

    /**
     * ズームボタンのイベント設定
     * @private
     */
    setupZoomButtons() {
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const fitViewBtn = document.getElementById('fit-view-btn');

        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (fitViewBtn) fitViewBtn.addEventListener('click', () => this.fitView());
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

        // 接続線用の追加入力フィールド
        this.ctxConnectionArrow = document.getElementById('ctx-connection-arrow');
        this.ctxConnectionColor = document.getElementById('ctx-connection-color');
        this.ctxConnectionLabel = document.getElementById('ctx-connection-label');

        // 矢印スタイルのリアルタイム更新
        if (this.ctxConnectionArrow) {
            this.ctxConnectionArrow.addEventListener('change', (e) => {
                if (this.selectedConnectionForContext) {
                    const conn = this.connections.find(c => c.id === this.selectedConnectionForContext);
                    if (conn) {
                        if (!conn.style) conn.style = {};
                        conn.style.arrow = e.target.value;
                        this.drawConnections();
                    }
                }
            });
        }

        // 線色のリアルタイム更新
        if (this.ctxConnectionColor) {
            this.ctxConnectionColor.addEventListener('input', (e) => {
                if (this.selectedConnectionForContext) {
                    const conn = this.connections.find(c => c.id === this.selectedConnectionForContext);
                    if (conn) {
                        if (!conn.style) conn.style = {};
                        conn.style.color = e.target.value;
                        this.drawConnections();
                    }
                }
            });
        }

        // ラベルのリアルタイム更新
        if (this.ctxConnectionLabel) {
            this.ctxConnectionLabel.addEventListener('input', (e) => {
                if (this.selectedConnectionForContext) {
                    const conn = this.connections.find(c => c.id === this.selectedConnectionForContext);
                    if (conn) {
                        if (!conn.style) conn.style = {};
                        conn.style.label = e.target.value;
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
            if (this.ctxConnectionArrow) {
                this.ctxConnectionArrow.value = conn?.style?.arrow || 'end';
            }
            if (this.ctxConnectionColor) {
                this.ctxConnectionColor.value = conn?.style?.color || '#94a3b8';
            }
            if (this.ctxConnectionLabel) {
                this.ctxConnectionLabel.value = conn?.style?.label || '';
            }
        }

        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.remove('hidden');
    }

    /**
     * コンテキストメニューを非表示にする
     */
    hideContextMenu() {
        this.contextMenu.classList.add('hidden');
        this.selectedShapeForContext = null;
        this.selectedConnectionForContext = null;
    }

    /**
     * コンテキストメニューのアクションを処理
     * 
     * @param {string} action - 実行するアクション（'delete'など）
     */
    handleContextMenuAction(action) {
        if (action === 'delete') {
            if (this.selectedShapeForContext) {
                this.removeShape(this.selectedShapeForContext);
            } else if (this.selectedConnectionForContext) {
                this.removeConnection(this.selectedConnectionForContext);
            }
        }
    }

    /**
     * 接続線を削除
     * 
     * @param {string} id - 削除する接続線のID
     */
    removeConnection(id) {
        this.connections = this.connections.filter(c => c.id !== id);

        // DOM要素の削除
        const path = document.getElementById(`conn-path-${id}`);
        const hit = document.getElementById(`conn-hit-${id}`);
        if (path) path.remove();
        if (hit) hit.remove();

        this.clearSelection();
    }

    /**
     * 選択中のシェイプのスタイルを更新
     * 
     * @param {string} prop - 更新するCSSプロパティ名
     * @param {string} value - 設定する値
     */
    updateSelectedShapeStyle(prop, value) {
        this.shapes.forEach(shape => {
            if (shape.element?.classList.contains('selected')) {
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
        // 接続モード時にクラスを追加（接続ポイントの表示制御用）
        this.canvas.classList.toggle('connect-mode', mode === 'connect');

        // 状態のリセット
        this.connectStartShape = null;
        this.connectStartPoint = null;
        this.clearConnectionPreview();
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

                // 位置の計算
                let x = CONFIG.FLOWCHART.LAYOUT.START_X;
                let y = CONFIG.FLOWCHART.LAYOUT.START_Y;
                const gapY = 20; // ノード間の間隔

                // 1つ前の見出しに対応するノードを探す
                if (index > 0) {
                    const prevHeading = headings[index - 1];
                    const prevShape = Array.from(this.shapes.values()).find(s => s.headingId === prevHeading.id);
                    if (prevShape) {
                        x = prevShape.x;
                        y = prevShape.y + prevShape.height + gapY;
                    } else {
                        // 前のノードが見つからない場合はデフォルトのグリッド配置（フォールバック）
                        x = CONFIG.FLOWCHART.LAYOUT.START_X + (index * CONFIG.FLOWCHART.LAYOUT.STEP_X) % CONFIG.FLOWCHART.LAYOUT.WRAP_X;
                        y = CONFIG.FLOWCHART.LAYOUT.START_Y + Math.floor(index / 5) * CONFIG.FLOWCHART.LAYOUT.STEP_Y;
                    }
                }

                const newShape = {
                    id: id,
                    text: h.text,
                    x: x,
                    y: y,
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

        // z-index更新
        this.updateAllZIndexes();

        // キャンバスサイズを更新
        this.updateCanvasSize();
    }

    /**
     * シェイプを削除
     * 
     * 親子関係の解消、接続線の削除、DOM要素の削除を行う
     * 
     * @param {string} id - 削除するシェイプのID
     */
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
                if (child) this.ungroupShape(child);
            });
        }

        // このシェイプに関連する接続線を削除
        this.connections = this.connections.filter(c => c.from !== id && c.to !== id);

        // DOM要素の削除
        shape.element?.remove();

        // データストアから削除
        this.shapes.delete(id);

        // コンテキストメニュー用の選択状態をクリア
        if (this.selectedShapeForContext === id) {
            this.selectedShapeForContext = null;
        }

        this.clearSelection();
    }

    /**
     * シェイプのDOM要素を作成
     * 
     * @param {Object} shapeData - シェイプデータ
     */
    createShapeElement(shapeData) {
        const el = document.createElement('div');
        el.className = 'shape';
        el.id = shapeData.id;
        const textEl = document.createElement('div');
        textEl.className = 'shape-text';
        textEl.textContent = shapeData.text;
        el.appendChild(textEl);

        el.style.left = `${shapeData.x}px`;
        el.style.top = `${shapeData.y}px`;
        el.style.width = `${shapeData.width}px`;
        el.style.height = `${shapeData.height}px`;

        // スタイルの適用
        if (shapeData.backgroundColor) el.style.backgroundColor = shapeData.backgroundColor;
        if (shapeData.borderColor) el.style.borderColor = shapeData.borderColor;
        if (shapeData.color) el.style.color = shapeData.color;

        // 接続ポイントの追加（上下左右）
        ['top', 'bottom', 'left', 'right'].forEach(pos => {
            const pt = document.createElement('div');
            pt.className = `connection-point ${pos}`;
            pt.dataset.pos = pos;
            el.appendChild(pt);
        });

        // リサイズハンドルの追加（四隅）
        ['nw', 'ne', 'sw', 'se'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.pos = pos;
            el.appendChild(handle);
        });

        this.shapesLayer.appendChild(el);
        shapeData.element = el;
    }

    /**
     * シェイプを選択状態にする
     * 
     * @param {string} id - 選択するシェイプのID
     */
    selectShape(id) {
        this.clearSelection();
        const shape = this.shapes.get(id);
        if (!shape?.element) return;

        shape.element.classList.add('selected');

        // プロパティパネルの更新
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
            // テキスト要素を更新
            let textEl = shapeData.element.querySelector('.shape-text');
            if (!textEl) {
                textEl = document.createElement('div');
                textEl.className = 'shape-text';
                // 先頭に挿入
                shapeData.element.insertBefore(textEl, shapeData.element.firstChild);
            }
            textEl.textContent = shapeData.text;
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
            return;
        }

        // 接続線（SVG path）のクリック処理
        // 接続線をクリックした場合はパンしない
        if (target.tagName.toLowerCase() === 'path' || target.closest('path')) {
            this.clearSelection();
            return;
        }

        // 背景をクリックした場合はパン開始
        e.preventDefault();
        this.clearSelection();
        this.startPan(e);
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
        this.scrollStart = { left: this.canvas.scrollLeft, top: this.canvas.scrollTop };
    }

    startConnect(target) {
        const shapeEl = target.closest('.shape');
        if (shapeEl) {
            this.connectStartShape = shapeEl.id;
            // 接続ポイントの位置を保存（top, bottom, left, right）
            if (target.classList.contains('connection-point')) {
                if (target.classList.contains('top')) {
                    this.connectStartPoint = 'top';
                } else if (target.classList.contains('bottom')) {
                    this.connectStartPoint = 'bottom';
                } else if (target.classList.contains('left')) {
                    this.connectStartPoint = 'left';
                } else if (target.classList.contains('right')) {
                    this.connectStartPoint = 'right';
                } else {
                    this.connectStartPoint = 'bottom'; // デフォルト
                }
            } else {
                this.connectStartPoint = 'bottom'; // デフォルト
            }
        }
    }

    startDrag(e, shapeEl) {
        this.isDragging = true;
        this.dragTarget = shapeEl;
        // クリック判定用：開始位置と移動フラグ
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.hasMoved = false;
        // ズームレベルを考慮したオフセット計算
        const shape = this.shapes.get(shapeEl.id);
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - canvasRect.left + this.canvas.scrollLeft) / this.zoomLevel;
        const mouseY = (e.clientY - canvasRect.top + this.canvas.scrollTop) / this.zoomLevel;
        this.dragOffset = {
            x: mouseX - shape.x,
            y: mouseY - shape.y
        };
        this.selectShape(shapeEl.id);
    }

    handleMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.canvas.scrollLeft = this.scrollStart.left - dx;
            this.canvas.scrollTop = this.scrollStart.top - dy;
            return;
        }

        if (this.isResizing && this.resizeTarget) {
            const dx = (e.clientX - this.resizeStart.x) / this.zoomLevel;
            const dy = (e.clientY - this.resizeStart.y) / this.zoomLevel;
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
            // 移動判定：閾値（5px）を超えたらドラッグとみなす
            if (this.dragStartPos) {
                const dx = Math.abs(e.clientX - this.dragStartPos.x);
                const dy = Math.abs(e.clientY - this.dragStartPos.y);
                if (dx > 5 || dy > 5) {
                    this.hasMoved = true;
                }
            }

            // canvas-content に対する新しい位置を計算（ズームレベルで補正）
            const canvasRect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - canvasRect.left + this.canvas.scrollLeft) / this.zoomLevel - this.dragOffset.x;
            const y = (e.clientY - canvasRect.top + this.canvas.scrollTop) / this.zoomLevel - this.dragOffset.y;

            const shape = this.shapes.get(this.dragTarget.id);
            if (shape) {
                const dx = x - shape.x;
                const dy = y - shape.y;

                this.moveShape(shape, dx, dy);

                // 親のサイズ更新（自動リサイズを削除: グループ解除機能を妨げないようにするため）
                // if (shape.parent) {
                //     const parent = this.shapes.get(shape.parent);
                //     if (parent) this.updateParentSize(parent);
                // }

                this.drawConnections();
            }
        }

        // 接続モードでドラッグ中の場合、プレビュー線を描画
        if (this.mode === 'connect' && this.connectStartShape) {
            const canvasRect = this.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - canvasRect.left + this.canvas.scrollLeft) / this.zoomLevel;
            const mouseY = (e.clientY - canvasRect.top + this.canvas.scrollTop) / this.zoomLevel;
            this.drawConnectionPreview(mouseX, mouseY);
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
            // キャンバスサイズを更新
            this.updateCanvasSize();
            return;
        }

        if (this.isDragging && this.dragTarget && this.mode === 'select') {
            const droppedShape = this.shapes.get(this.dragTarget.id);

            if (!this.hasMoved && droppedShape && droppedShape.headingId) {
                // クリック（ドラッグなし）：エディタの対応する見出しにスクロール
                this.eventBus.emit('editor:scrollToHeading', droppedShape.headingId);
            } else if (droppedShape) {
                // ドロップ時のグループ化判定
                this.handleDrop(droppedShape);
            }
        }

        this.isDragging = false;
        this.dragTarget = null;
        this.dragStartPos = null;
        this.hasMoved = false;
        this.isPanning = false;

        // キャンバスサイズを更新
        this.updateCanvasSize();

        if (this.mode === 'connect' && this.connectStartShape) {
            const target = e.target;
            if (target.classList.contains('connection-point')) {
                const shapeEl = target.closest('.shape');
                if (shapeEl && shapeEl.id !== this.connectStartShape) {
                    // 終点の接続ポイントを判定
                    let toPoint = 'top'; // デフォルト
                    if (target.classList.contains('top')) {
                        toPoint = 'top';
                    } else if (target.classList.contains('bottom')) {
                        toPoint = 'bottom';
                    } else if (target.classList.contains('left')) {
                        toPoint = 'left';
                    } else if (target.classList.contains('right')) {
                        toPoint = 'right';
                    }

                    // 接続を作成（始点・終点のポイント情報も保存）
                    this.connections.push({
                        id: generateId(),
                        from: this.connectStartShape,
                        to: shapeEl.id,
                        fromPoint: this.connectStartPoint || 'bottom',
                        toPoint: toPoint
                    });
                    this.drawConnections();
                }
            }
            // プレビューをクリア
            this.clearConnectionPreview();
            this.connectStartShape = null;
            this.connectStartPoint = null;
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

    /**
     * シェイプをグループ化（親子関係を設定）
     * 
     * @param {Object} parent - 親となるシェイプ
     * @param {Object} child - 子となるシェイプ
     */
    groupShapes(parent, child) {
        // 既に親子関係がある場合は何もしない
        if (child.parent === parent.id) return;

        // 既存の親から削除
        if (child.parent) {
            this.ungroupShape(child);
        }

        // 新しい親に追加
        child.parent = parent.id;
        if (!parent.children) parent.children = [];
        parent.children.push(child.id);

        // スタイルとサイズを更新
        this.updateShapeStyle(parent);
        this.updateParentSize(parent);
        this.updateAllZIndexes();
    }

    /**
     * シェイプのグループ化を解除
     * 
     * @param {Object} child - グループから外すシェイプ
     */
    ungroupShape(child) {
        if (!child.parent) return;

        const parent = this.shapes.get(child.parent);
        if (parent) {
            parent.children = parent.children.filter(id => id !== child.id);
            this.updateShapeStyle(parent);
            this.updateParentSize(parent);
        }
        child.parent = null;
        this.updateAllZIndexes();
    }

    /**
     * シェイプのスタイルを更新
     * 
     * 子を持つ場合はgroup-parentクラスと折りたたみボタンを追加
     * 
     * @param {Object} shape - 対象のシェイプ
     */
    updateShapeStyle(shape) {
        if (!shape.element) return;

        const hasChildren = shape.children?.length > 0;

        if (hasChildren) {
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
            shape.element.querySelector('.group-toggle')?.remove();
        }
    }

    toggleCollapse(shape) {
        // 現在の状態のサイズを保存
        if (shape.collapsed) {
            shape.collapsedSize = { width: shape.width, height: shape.height };
        } else {
            shape.expandedSize = { width: shape.width, height: shape.height };
        }

        const oldWidth = shape.width;
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

        // レイアウト調整（水平・垂直両方向）
        const deltaX = shape.width - oldWidth;
        const deltaY = shape.height - oldHeight;

        if (deltaX !== 0 || deltaY !== 0) {
            // 折りたたみ時は変更前のサイズで重なりをチェックする必要があるため、
            // 一時的に変更前のサイズを渡す
            this.adjustLayout(shape, deltaX, deltaY, oldWidth, oldHeight);
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

    /**
     * 全てのシェイプのz-indexを親子関係に基づいて更新します。
     * 子ノードは親ノードより高いz-indexを持ちます。
     */
    updateAllZIndexes() {
        const baseZIndex = 10;

        /**
         * 再帰的にシェイプとその子のz-indexを設定します。
         * @param {Object} shape - シェイプオブジェクト
         * @param {number} level - 親子階層のレベル
         */
        const setZIndex = (shape, level) => {
            if (shape.element) {
                shape.element.style.zIndex = baseZIndex + level;
            }
            if (shape.children) {
                shape.children.forEach(childId => {
                    const child = this.shapes.get(childId);
                    if (child) {
                        setZIndex(child, level + 1);
                    }
                });
            }
        };

        // ルートシェイプ（親を持たない）を特定して処理
        this.shapes.forEach(shape => {
            if (!shape.parent) {
                setZIndex(shape, 0);
            }
        });
    }

    /**
     * グループの展開/折りたたみに伴うレイアウト調整
     * 
     * 動作概要:
     * - 展開時（delta > 0）: 重なりがある場合のみノードを外側へ移動
     * - 折りたたみ時（delta < 0）: ブロッキングノードを考慮してノードを内側へ移動
     * 
     * 補正対象:
     * - ソースノードの右端/下端より右/下にある同じ階層のノード
     * - 子孫ノードは親と一緒に動くため対象外
     * 
     * @param {Object} sourceShape - サイズが変更されたグループShape
     * @param {number} deltaX - X方向の変化量（正: 拡大, 負: 縮小）
     * @param {number} deltaY - Y方向の変化量（正: 拡大, 負: 縮小）
     * @param {number} [oldWidth] - 変更前の幅
     * @param {number} [oldHeight] - 変更前の高さ
     */
    adjustLayout(sourceShape, deltaX, deltaY, oldWidth, oldHeight) {
        // 変更前のサイズを決定（未指定の場合は現在のサイズを使用）
        const checkWidth = oldWidth ?? sourceShape.width;
        const checkHeight = oldHeight ?? sourceShape.height;

        // 変更前後の右下座標を計算
        const oldRight = sourceShape.x + checkWidth;
        const oldBottom = sourceShape.y + checkHeight;
        const newRight = sourceShape.x + sourceShape.width;
        const newBottom = sourceShape.y + sourceShape.height;

        // 同じ階層のノードのみを移動対象とする
        const sourceParentId = sourceShape.parent;

        // X軸・Y軸それぞれの有効な補正量を計算
        const effectiveDeltaX = this.calculateEffectiveDelta(
            deltaX, sourceShape, 'x', oldRight, newRight, sourceParentId
        );
        const effectiveDeltaY = this.calculateEffectiveDelta(
            deltaY, sourceShape, 'y', oldBottom, newBottom, sourceParentId
        );

        // 各ノードに対して補正を適用
        this.shapes.forEach(shape => {
            // 自分自身と子孫は対象外
            if (shape.id === sourceShape.id) return;
            if (this.isDescendant(sourceShape.id, shape.id)) return;

            // 同じ階層のノードのみ対象
            if (!this.isSameLevel(shape, sourceParentId)) return;

            // 補正量を計算
            // 展開時（delta > 0）は、展開範囲内（oldEdge〜newEdge）のノードも移動対象
            // 折りたたみ時（delta < 0）は、folded後の位置より右/下のノードが対象
            let dx = 0;
            let dy = 0;

            if (effectiveDeltaX !== 0) {
                // X方向: oldRight以降のノード、または展開範囲内のノード
                if (deltaX > 0) {
                    // 展開時: 展開範囲と重なる、または右にあるノードを移動
                    const shapeEnd = shape.x + shape.width;
                    if (shapeEnd > oldRight) {
                        dx = effectiveDeltaX;
                    }
                } else {
                    // 折りたたみ時: 変更前の右端より右にあるノードを移動
                    if (shape.x >= oldRight) {
                        dx = effectiveDeltaX;
                    }
                }
            }

            if (effectiveDeltaY !== 0) {
                // Y方向: oldBottom以降のノード、または展開範囲内のノード
                if (deltaY > 0) {
                    // 展開時: 展開範囲と重なる、または下にあるノードを移動
                    const shapeEnd = shape.y + shape.height;
                    if (shapeEnd > oldBottom) {
                        dy = effectiveDeltaY;
                    }
                } else {
                    // 折りたたみ時: 変更前の下端より下にあるノードを移動
                    if (shape.y >= oldBottom) {
                        dy = effectiveDeltaY;
                    }
                }
            }

            // 移動が必要な場合のみ実行
            if (dx !== 0 || dy !== 0) {
                this.moveShape(shape, dx, dy);
            }
        });
    }

    /**
     * 軸ごとの有効な補正量を計算
     * 
     * @param {number} delta - 元の補正量
     * @param {Object} sourceShape - ソースShape
     * @param {'x'|'y'} axis - 軸
     * @param {number} oldEdge - 変更前の右端/下端
     * @param {number} newEdge - 変更後の右端/下端
     * @param {string|null} sourceParentId - ソースの親ID
     * @returns {number} 有効な補正量
     */
    calculateEffectiveDelta(delta, sourceShape, axis, oldEdge, newEdge, sourceParentId) {
        if (delta < 0) {
            // 折りたたみ時: ブロッキングノード（展開中の親ノード）を検索
            const blockingNode = this.findBlockingExpandedNode(
                newEdge, oldEdge, axis, sourceShape.id, sourceParentId
            );
            return this.calculateAdjustedDeltaForCollapse(delta, blockingNode, oldEdge);
        } else if (delta > 0) {
            // 展開時: 展開範囲内に重なりがあるか確認
            const hasOverlap = this.checkExpandOverlap(sourceShape, axis, oldEdge);
            return hasOverlap ? delta : 0;
        }
        return 0;
    }

    /**
     * 同じ階層のノードかどうかを判定
     * 
     * @param {Object} shape - 判定対象のShape
     * @param {string|null} sourceParentId - ソースの親ID
     * @returns {boolean} 同じ階層ならtrue
     */
    isSameLevel(shape, sourceParentId) {
        if (sourceParentId) {
            // ソースが子ノードの場合: 同じ親を持つ兄弟のみ
            return shape.parent === sourceParentId;
        } else {
            // ソースがルートノードの場合: 他のルートノードのみ
            return !shape.parent;
        }
    }

    /**
     * 折りたたみ時のブロッキングノード（展開中の親ノード）を検索
     * 
     * 補正範囲（newEdge〜oldEdge）内に展開中の親ノードがあれば、
     * そのノードの位置情報を返す
     * 
     * @param {number} newEdge - 折りたたみ後の右端/下端
     * @param {number} oldEdge - 折りたたみ前の右端/下端
     * @param {'x'|'y'} axis - 軸
     * @param {string} sourceId - ソースノードのID
     * @param {string|null} sourceParentId - ソースノードの親ID
     * @returns {Object|null} ブロッキングノード情報 { shapeStart, shapeEnd }
     */
    findBlockingExpandedNode(newEdge, oldEdge, axis, sourceId, sourceParentId) {
        for (const [id, shape] of this.shapes) {
            // 除外条件: 自分自身、子を持たない、折りたたみ中、子孫
            if (id === sourceId) continue;
            if (!shape.children || shape.children.length === 0) continue;
            if (shape.collapsed) continue;
            if (this.isDescendant(sourceId, id)) continue;

            // 同じ階層のみ対象
            if (!this.isSameLevel(shape, sourceParentId)) continue;

            // ノードの範囲を取得
            const { start, end } = this.getShapeEdge(shape, axis);

            // 補正範囲内に存在するか（一部または全部が重なっている）
            if (end > newEdge && start < oldEdge) {
                return { shapeStart: start, shapeEnd: end };
            }
        }
        return null;
    }

    /**
     * 折りたたみ時の補正量を計算（ブロッキングノード考慮）
     * 
     * @param {number} delta - 元の補正量（負の値）
     * @param {Object|null} blockingNode - ブロッキングノード情報
     * @param {number} oldEdge - 折りたたみ前の右端/下端
     * @returns {number} 調整後の補正量
     */
    calculateAdjustedDeltaForCollapse(delta, blockingNode, oldEdge) {
        if (!blockingNode) {
            return delta; // ブロッキングノードなし → 通常の補正
        }

        // ブロッキングノードの右/下端までしか詰めない
        const adjustedDelta = blockingNode.shapeEnd - oldEdge;

        // 補正範囲をまたいでいる場合（shapeEnd >= oldEdge）は補正しない
        return (adjustedDelta >= 0) ? 0 : adjustedDelta;
    }

    /**
     * 展開範囲内に重なるノードが存在するかをチェック
     * 
     * 展開前後の座標間（oldEdge〜newEdge）にノードが存在するか確認
     * ノードの一部でも展開範囲と重なる場合は検出する
     * 子ノードは親の位置で決まるため検索対象から除外
     * 
     * @param {Object} sourceShape - 展開するソースShape
     * @param {'x'|'y'} axis - 軸
     * @param {number} oldEdge - 展開前の右端/下端
     * @returns {boolean} 重なりがあればtrue
     */
    checkExpandOverlap(sourceShape, axis, oldEdge) {
        const newEdge = this.getShapeEdge(sourceShape, axis).end;

        for (const [id, shape] of this.shapes) {
            // 除外条件: 自分自身、子孫、子ノード（親を持つノード）
            if (id === sourceShape.id) continue;
            if (this.isDescendant(sourceShape.id, id)) continue;
            if (shape.parent) continue;

            // ノードの範囲を取得
            const { start, end } = this.getShapeEdge(shape, axis);

            // 展開範囲（oldEdge〜newEdge）とノードが一部でも重なるかチェック
            // 条件: ノードの終端が展開前の端より大きく、かつノードの始端が展開後の端より小さい
            if (end > oldEdge && start < newEdge) {
                return true; // 重なりあり
            }
        }
        return false; // 重なりなし
    }

    /**
     * Shapeの軸に応じた開始位置と終了位置を取得
     * 
     * @param {Object} shape - Shape
     * @param {'x'|'y'} axis - 軸
     * @returns {{start: number, end: number}} 開始位置と終了位置
     */
    getShapeEdge(shape, axis) {
        if (axis === 'x') {
            return { start: shape.x, end: shape.x + shape.width };
        } else {
            return { start: shape.y, end: shape.y + shape.height };
        }
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

            // 接続ポイントの座標を計算（保存されたfromPoint/toPointを使用）
            const fromPoint = conn.fromPoint || 'bottom';
            const toPoint = conn.toPoint || 'top';

            // 始点座標の計算
            let startX, startY;
            switch (fromPoint) {
                case 'top':
                    startX = fromShape.x + fromShape.width / 2;
                    startY = fromShape.y;
                    break;
                case 'bottom':
                    startX = fromShape.x + fromShape.width / 2;
                    startY = fromShape.y + fromShape.height;
                    break;
                case 'left':
                    startX = fromShape.x;
                    startY = fromShape.y + fromShape.height / 2;
                    break;
                case 'right':
                    startX = fromShape.x + fromShape.width;
                    startY = fromShape.y + fromShape.height / 2;
                    break;
                default:
                    startX = fromShape.x + fromShape.width / 2;
                    startY = fromShape.y + fromShape.height;
            }

            // 終点座標の計算
            let endX, endY;
            switch (toPoint) {
                case 'top':
                    endX = toShape.x + toShape.width / 2;
                    endY = toShape.y;
                    break;
                case 'bottom':
                    endX = toShape.x + toShape.width / 2;
                    endY = toShape.y + toShape.height;
                    break;
                case 'left':
                    endX = toShape.x;
                    endY = toShape.y + toShape.height / 2;
                    break;
                case 'right':
                    endX = toShape.x + toShape.width;
                    endY = toShape.y + toShape.height / 2;
                    break;
                default:
                    endX = toShape.x + toShape.width / 2;
                    endY = toShape.y;
            }

            // ベジェ曲線の制御点を計算
            const dx = Math.abs(endX - startX);
            const dy = Math.abs(endY - startY);
            const offset = Math.max(dx, dy) * 0.5;

            let cp1x, cp1y, cp2x, cp2y;

            // 始点の制御点
            switch (fromPoint) {
                case 'top':
                    cp1x = startX;
                    cp1y = startY - offset;
                    break;
                case 'bottom':
                    cp1x = startX;
                    cp1y = startY + offset;
                    break;
                case 'left':
                    cp1x = startX - offset;
                    cp1y = startY;
                    break;
                case 'right':
                    cp1x = startX + offset;
                    cp1y = startY;
                    break;
                default:
                    cp1x = startX;
                    cp1y = startY + offset;
            }

            // 終点の制御点
            switch (toPoint) {
                case 'top':
                    cp2x = endX;
                    cp2y = endY - offset;
                    break;
                case 'bottom':
                    cp2x = endX;
                    cp2y = endY + offset;
                    break;
                case 'left':
                    cp2x = endX - offset;
                    cp2y = endY;
                    break;
                case 'right':
                    cp2x = endX + offset;
                    cp2y = endY;
                    break;
                default:
                    cp2x = endX;
                    cp2y = endY - offset;
            }

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

            const arrowStyle = conn.style?.arrow || 'end';
            const lineColor = conn.style?.color || CONFIG.FLOWCHART.COLORS.CONNECTION_DEFAULT;
            const isSelected = this.selectedConnectionId === conn.id;
            const displayColor = isSelected ? CONFIG.FLOWCHART.COLORS.CONNECTION_SELECTED : lineColor;

            // 接続線ごとに動的にマーカーを作成
            const defs = this.connectionsLayer.querySelector('defs');
            const markerId = `arrow-${conn.id}`;
            const markerTailId = `arrow-tail-${conn.id}`;

            // 終点マーカー
            let marker = document.getElementById(markerId);
            if (!marker) {
                marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.id = markerId;
                marker.setAttribute('markerWidth', '6');
                marker.setAttribute('markerHeight', '6');
                marker.setAttribute('refX', '6');
                marker.setAttribute('refY', '3');
                marker.setAttribute('orient', 'auto');
                const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                markerPath.setAttribute('d', 'M0,0 L6,3 L0,6');
                marker.appendChild(markerPath);
                defs.appendChild(marker);
            }
            marker.querySelector('path').setAttribute('fill', displayColor);

            // 始点マーカー（矢印は終点と反対向き、図形の外側に描画）
            let markerTail = document.getElementById(markerTailId);
            if (!markerTail) {
                markerTail = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                markerTail.id = markerTailId;
                markerTail.setAttribute('markerWidth', '6');
                markerTail.setAttribute('markerHeight', '6');
                markerTail.setAttribute('refX', '0');
                markerTail.setAttribute('refY', '3');
                markerTail.setAttribute('orient', 'auto');
                const markerTailPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                // 矢印を反対向きに（終点マーカーと逆方向）
                markerTailPath.setAttribute('d', 'M6,0 L0,3 L6,6');
                markerTail.appendChild(markerTailPath);
                defs.appendChild(markerTail);
            } else {
                // 既存のマーカーの属性を更新（refXが古い値の場合に対応）
                markerTail.setAttribute('refX', '0');
                markerTail.querySelector('path').setAttribute('d', 'M6,0 L0,3 L6,6');
            }
            markerTail.querySelector('path').setAttribute('fill', displayColor);

            // パスのスタイル設定
            path.setAttribute('stroke', displayColor);
            path.setAttribute('stroke-width', isSelected ? '3' : '2');

            // 終点矢印
            if (arrowStyle === 'end' || arrowStyle === 'both') {
                path.setAttribute('marker-end', `url(#${markerId})`);
            } else {
                path.removeAttribute('marker-end');
            }
            // 始点矢印
            if (arrowStyle === 'both') {
                path.setAttribute('marker-start', `url(#${markerTailId})`);
            } else {
                path.removeAttribute('marker-start');
            }

            if (conn.style?.type === 'dashed') {
                path.setAttribute('stroke-dasharray', '5,5');
            } else {
                path.removeAttribute('stroke-dasharray');
            }

            // ラベルの描画
            let labelText = document.getElementById(`conn-label-${conn.id}`);
            const labelContent = conn.style?.label || '';
            if (labelContent) {
                if (!labelText) {
                    labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    labelText.id = `conn-label-${conn.id}`;
                    labelText.setAttribute('class', 'connection-label');
                    labelText.setAttribute('text-anchor', 'middle');
                    labelText.setAttribute('dominant-baseline', 'middle');
                    this.connectionsLayer.appendChild(labelText);
                }
                // パスの中間点を計算
                const pathLength = path.getTotalLength();
                const midPoint = path.getPointAtLength(pathLength / 2);
                labelText.setAttribute('x', midPoint.x);
                labelText.setAttribute('y', midPoint.y);
                labelText.textContent = labelContent;
                // 線色と同じ色を設定
                labelText.setAttribute('fill', lineColor);
            } else if (labelText) {
                labelText.remove();
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

    /**
     * ズームレベルを設定します。
     * @param {number} level - 新しいズームレベル (0.1 ~ 2.0)
     */
    setZoom(level) {
        // 範囲制限
        this.zoomLevel = Math.max(this.zoomMin, Math.min(this.zoomMax, level));

        // canvas-content に transform を適用
        if (this.canvasContent) {
            this.canvasContent.style.transform = `scale(${this.zoomLevel})`;
        }

        // 接続線を再描画（座標はそのまま、scaleでスケールされる）
        this.drawConnections();
    }

    /**
     * ズームイン (拡大)
     */
    zoomIn() {
        this.setZoom(this.zoomLevel + this.zoomStep);
    }

    /**
     * ズームアウト (縮小)
     */
    zoomOut() {
        this.setZoom(this.zoomLevel - this.zoomStep);
    }

    /**
     * すべてのシェイプが表示されるようにズームとスクロールを調整します。
     * 一番上、左、右、下のノードを参照して表示エリアに収めます。
     * 最小10%で収まらない場合は上と左を優先します。
     */
    fitView() {
        if (this.shapes.size === 0) {
            // シェイプがない場合は1.0にリセット
            this.setZoom(1.0);
            this.container.scrollLeft = 0;
            this.container.scrollTop = 0;
            return;
        }

        // 全シェイプのバウンディングボックスを計算（上下左右の端）
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.shapes.forEach(shape => {
            // 非表示のシェイプは除外
            if (shape.element && shape.element.style.display === 'none') return;

            // 一番左
            minX = Math.min(minX, shape.x);
            // 一番上
            minY = Math.min(minY, shape.y);
            // 一番右
            maxX = Math.max(maxX, shape.x + shape.width);
            // 一番下
            maxY = Math.max(maxY, shape.y + shape.height);
        });

        // 有効なシェイプがない場合
        if (minX === Infinity) {
            this.setZoom(1.0);
            this.container.scrollLeft = 0;
            this.container.scrollTop = 0;
            return;
        }

        // バウンディングボックスのサイズ
        const boundingWidth = maxX - minX;
        const boundingHeight = maxY - minY;

        // コンテナ（表示エリア）のサイズを取得
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;

        // パディング（余白）
        const padding = 20;

        // 最適なスケールを計算（全体が表示エリアに収まるように）
        const availableWidth = containerWidth - padding * 2;
        const availableHeight = containerHeight - padding * 2;

        let scaleX = availableWidth / boundingWidth;
        let scaleY = availableHeight / boundingHeight;
        let optimalScale = Math.min(scaleX, scaleY);

        // スケール範囲を制限（最小10%、最大200%）
        optimalScale = Math.max(this.zoomMin, Math.min(this.zoomMax, optimalScale));

        // ズームを適用
        this.setZoom(optimalScale);

        // スクロール位置を計算
        // 左上を優先するため、minX, minY を基準にスクロール
        // ノードの左上がパディング分の位置に来るようにする
        const scrollLeft = minX * optimalScale - padding;
        const scrollTop = minY * optimalScale - padding;

        // 最小10%で収まらない場合は左上を優先（scrollを0に近づける）
        this.container.scrollLeft = Math.max(0, scrollLeft);
        this.container.scrollTop = Math.max(0, scrollTop);
    }

    /**
     * キャンバスサイズをノードの位置に応じて自動調整します。
     * 最小サイズは表示エリアのサイズとなります。
     * 負の座標にノードがある場合、すべてのノードを正の座標にシフトします。
     */
    updateCanvasSize() {
        if (!this.canvasContent) return;

        // コンテナの表示サイズを取得（最小サイズ）
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;

        if (this.shapes.size === 0) {
            // シェイプがない場合は表示エリアサイズに設定
            this.canvasContent.style.width = `${containerWidth}px`;
            this.canvasContent.style.height = `${containerHeight}px`;
            return;
        }

        // 全シェイプのバウンディングボックスを計算
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

        this.shapes.forEach(shape => {
            minX = Math.min(minX, shape.x);
            minY = Math.min(minY, shape.y);
            maxX = Math.max(maxX, shape.x + shape.width);
            maxY = Math.max(maxY, shape.y + shape.height);
        });

        // 負の座標がある場合、すべてのノードをシフト
        const padding = 50; // 左上の余白
        const shiftX = minX < padding ? padding - minX : 0;
        const shiftY = minY < padding ? padding - minY : 0;

        if (shiftX > 0 || shiftY > 0) {
            // すべてのノードをシフト
            this.shapes.forEach(shape => {
                shape.x += shiftX;
                shape.y += shiftY;
                if (shape.element) {
                    shape.element.style.left = `${shape.x}px`;
                    shape.element.style.top = `${shape.y}px`;
                }
            });

            // バウンディングボックスを再計算
            maxX += shiftX;
            maxY += shiftY;

            // 接続線を再描画
            this.drawConnections();
        }

        // 余白を追加
        const canvasPadding = 200;

        // 最小サイズは表示エリアサイズ
        const newWidth = Math.max(containerWidth / this.zoomLevel, maxX + canvasPadding);
        const newHeight = Math.max(containerHeight / this.zoomLevel, maxY + canvasPadding);

        this.canvasContent.style.width = `${newWidth}px`;
        this.canvasContent.style.height = `${newHeight}px`;
    }

    /**
     * 接続線のプレビューを描画します。
     * 始点の図形から現在のマウス位置まで破線を描画します。
     * @param {number} mouseX - マウスのX座標（キャンバス座標系）
     * @param {number} mouseY - マウスのY座標（キャンバス座標系）
     */
    drawConnectionPreview(mouseX, mouseY) {
        const fromShape = this.shapes.get(this.connectStartShape);
        if (!fromShape) return;

        // 始点座標の計算
        const fromPoint = this.connectStartPoint || 'bottom';
        let startX, startY;
        switch (fromPoint) {
            case 'top':
                startX = fromShape.x + fromShape.width / 2;
                startY = fromShape.y;
                break;
            case 'bottom':
                startX = fromShape.x + fromShape.width / 2;
                startY = fromShape.y + fromShape.height;
                break;
            case 'left':
                startX = fromShape.x;
                startY = fromShape.y + fromShape.height / 2;
                break;
            case 'right':
                startX = fromShape.x + fromShape.width;
                startY = fromShape.y + fromShape.height / 2;
                break;
            default:
                startX = fromShape.x + fromShape.width / 2;
                startY = fromShape.y + fromShape.height;
        }

        // ベジェ曲線の制御点を計算
        const dx = Math.abs(mouseX - startX);
        const dy = Math.abs(mouseY - startY);
        const offset = Math.max(dx, dy) * 0.5;

        let cp1x, cp1y;
        switch (fromPoint) {
            case 'top':
                cp1x = startX;
                cp1y = startY - offset;
                break;
            case 'bottom':
                cp1x = startX;
                cp1y = startY + offset;
                break;
            case 'left':
                cp1x = startX - offset;
                cp1y = startY;
                break;
            case 'right':
                cp1x = startX + offset;
                cp1y = startY;
                break;
            default:
                cp1x = startX;
                cp1y = startY + offset;
        }

        // 終点の制御点（マウス位置に向かって）
        const cp2x = mouseX;
        const cp2y = mouseY;

        const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${mouseX} ${mouseY}`;

        // プレビュー要素の取得または作成
        let previewPath = document.getElementById('connection-preview');
        if (!previewPath) {
            previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            previewPath.id = 'connection-preview';
            previewPath.classList.add('connection-preview');
            this.connectionsLayer.appendChild(previewPath);
        }

        previewPath.setAttribute('d', d);
    }

    /**
     * 接続線のプレビューをクリアします。
     */
    clearConnectionPreview() {
        const previewPath = document.getElementById('connection-preview');
        if (previewPath) {
            previewPath.remove();
        }
    }
}
