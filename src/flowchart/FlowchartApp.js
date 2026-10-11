/**
 * フローチャートコントローラー
 * 
 * フローチャートのメインコントローラークラス。
 * FlowchartCore（データ・基本操作）と各マネージャー（機能）を統括し、
 * ユーザーインタラクション（マウスイベント等）を処理します。
 */
import { FlowchartCore } from '../core/FlowchartCore.js';
import { CONFIG } from '../core/Config.js';

// マネージャーをインポート
import {
    ShapeManager,
    ConnectionManager,
    ZoomPanManager,
    ContextMenuManager,
    GroupManager
} from './index.js';

/**
 * フローチャートの描画と操作を管理するクラス
 */
export class FlowchartApp {
    /**
     * FlowchartAppのコンストラクタ
     * 
     * @param {import('../core/EventBus.js').EventBus} eventBus - アプリケーション全体で使用するイベントバス
     */
    constructor(eventBus) {
        // FlowchartCoreを初期化
        this.core = new FlowchartCore(eventBus);

        // イベントバス
        this.eventBus = eventBus;

        // DOM要素への参照
        this.container = document.getElementById('flowchart-container');
        this.canvas = document.getElementById('flowchart-canvas');
        this.shapesLayer = document.getElementById('shapes-layer');
        this.connectionsLayer = document.getElementById('connections-layer');
        this.canvasContent = document.getElementById('canvas-content');

        // 操作状態
        this.mode = 'select';
        this.zoomLevel = 1.0;

        // エディタマネージャーへの参照
        this.editorManager = null;

        // マネージャーへの参照
        this.shapeManager = null;
        this.connectionManager = null;
        this.zoomPanManager = null;
        this.contextMenuManager = null;
        this.groupManager = null;

        // 初期化はmain.jsから明示的に呼ばれることを想定
        // this.init(); 
    }

    /**
     * core.shapesへのアクセサー（StorageManager互換用）
     */
    get shapes() {
        return this.core.shapes;
    }

    /**
     * core.connectionsへのアクセサー（StorageManager互換用）
     */
    get connections() {
        return this.core.connections;
    }

    /**
     * エディタマネージャを設定
     * 
     * @param {Object} em - エディタマネージャ（のエントリポイント）
     */
    setEditorManager(em) {
        this.editorManager = em;
    }

    /**
     * フローチャートの初期化処理
     */
    init() {
        // FlowchartCoreを初期化
        this.core.init();

        // マネージャーを初期化
        this._initManagers();

        // イベントリスナーを設定
        this._setupEventListeners();

        // イベントバスの購読
        this._setupEventBusListeners();
    }

    /**
     * マネージャーを初期化します。
     * @private
     */
    _initManagers() {
        this.shapeManager = new ShapeManager(this);
        this.connectionManager = new ConnectionManager(this);
        this.zoomPanManager = new ZoomPanManager(this);
        this.contextMenuManager = new ContextMenuManager(this);
        this.groupManager = new GroupManager(this);

        // 各マネージャーを初期化
        this.zoomPanManager.setupZoomButtons();
        this.contextMenuManager.setupContextMenu();
    }

    /**
     * イベントリスナーを設定します。
     * @private
     */
    _setupEventListeners() {
        // モード切り替えボタン
        document.querySelectorAll('.mode-btn').forEach(btn => {
            if (btn.dataset.mode) {
                btn.addEventListener('click', () => {
                    // ロック中はモード切替をブロック
                    if (this._locked) return;
                    this.setMode(btn.dataset.mode);
                });
            }
        });

        // キャンバスのポインターイベント（タッチ・マウス両対応）
        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        document.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        document.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        document.addEventListener('pointercancel', (e) => this.handlePointerCancel(e));

        // キーボードイベント（矢印キーでノード移動）
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // ツールバー折りたたみ/展開ボタン
        const toggleBtn = document.getElementById('flowchart-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleToolbar());
        }
    }

    /**
     * EventBusリスナーをセットアップします。
     * @private
     */
    _setupEventBusListeners() {
        this.eventBus.on('editor:update', (headings) => this.syncFromEditor(headings));
    }

    // ========================================
    // UI操作
    // ========================================

    /**
     * ツールバー（およびフローチャート領域全体）の折りたたみ/展開を切り替えます。
     * マージントップのアニメーションでスライド表示/非表示を行います。
     */
    toggleToolbar() {
        const container = document.getElementById('flowchart-container');
        const toggleBtn = document.getElementById('flowchart-toggle-btn');
        const iconPath = toggleBtn.querySelector('path');

        if (!container || !toggleBtn || !iconPath) return;

        const isCollapsed = container.classList.contains('collapsed');
        const currentHeight = container.offsetHeight + 4;

        if (isCollapsed) {
            // 展開する
            // 1. クラスを削除してコンテンツを表示可能にする（ただしmarginはまだ維持）
            container.classList.remove('collapsed');

            // 2. margin-topを0に戻すアニメーション
            // transitionが効くようにrequestAnimationFrameを使用
            requestAnimationFrame(() => {
                container.style.marginTop = '0px';
            });

            // 3. アニメーション完了後のクリーンアップ（必要に応じて）
            // transitionendイベントで処理することも可能だが、今回はシンプルに

            toggleBtn.title = "折りたたみ";
            // メニュー内包表記
            iconPath.setAttribute('d', 'm296-224-56-56 240-240 240 240-56 56-184-183-184 183Zm0-240-56-56 240-240 240 240-56 56-184-183-184 183Z');
        } else {
            // 折りたたむ
            // 1. 現在の高さを取得してmargin-topに設定
            container.style.marginTop = `-${currentHeight}px`;
            container.classList.add('collapsed');

            toggleBtn.title = "フローチャート";
            // フローチャートアイコン
            iconPath.setAttribute('d', 'M600-160v-80H440v-200h-80v80H80v-240h280v80h80v-200h160v-80h280v240H600v-80h-80v320h80v-80h280v240H600Zm80-80h120v-80H680v80ZM160-440h120v-80H160v80Zm520-200h120v-80H680v80Zm0 400v-80 80ZM280-440v-80 80Zm400-200v-80 80Z');
        }
    }

    // ========================================
    // モード操作
    // ========================================

    /**
     * 操作モードを設定します。
     * 
     * @param {string} mode - 'select' | 'connect' | 'pan'
     */
    setMode(mode) {
        this.mode = mode;
        this.core.setMode(mode);

        // 状態のリセット
        this.connectionManager.clearConnectionStart();
        this.connectionManager.clearConnectionPreview();
        this.shapeManager.clearSelection();
    }

    // ========================================
    // シェイプ操作（ShapeManagerに委譲）
    // ========================================

    /**
     * シェイプを選択状態にする
     * 
     * @param {string} id - 選択するシェイプのID
     * @param {boolean} [addToSelection=false] - 既存の選択を維持して追加選択するかどうか
     */
    selectShape(id, addToSelection = false) {
        this.shapeManager.selectShape(id, addToSelection);
    }

    /**
     * シェイプの選択状態をトグル（切り替え）します。
     * 
     * @param {string} id - シェイプID
     * @returns {boolean}
     */
    toggleShapeSelection(id) {
        return this.shapeManager.toggleShapeSelection(id);
    }

    /**
     * 現在選択中の全シェイプを取得します。
     * 
     * @returns {Array<Object>}
     */
    getSelectedShapes() {
        return this.shapeManager.getSelectedShapes();
    }

    /**
     * 指定したシェイプが選択中かどうかを判定します。
     * 
     * @param {string} id - シェイプID
     * @returns {boolean}
     */
    isShapeSelected(id) {
        return this.shapeManager.isShapeSelected(id);
    }

    /**
     * 現在選択中の全オーバーレイキャンバスを取得します。
     * 
     * @returns {Array<Object>}
     */
    getSelectedOverlays() {
        return this.groupManager?.overlayStrategy?.getSelectedOverlays?.() || [];
    }

    /**
     * 指定したオーバーレイキャンバスが選択中かどうかを判定します。
     * 
     * @param {Object} overlay
     * @returns {boolean}
     */
    isOverlaySelected(overlay) {
        return overlay ? overlay.isSelected() : false;
    }

    /**
     * 選択を解除します。
     */
    clearSelection() {
        this.shapeManager.clearSelection();
        this.connectionManager.clearConnectionSelection();
        this.groupManager?.overlayStrategy?.clearOverlaySelection();
        this.drawConnections();
    }

    /**
     * シェイプを削除
     * 
     * @param {string} id - 削除するシェイプのID
     */
    removeShape(id) {
        this.shapeManager.removeShape(id);
        this.drawConnections();
    }

    /**
     * シェイプのDOM要素を作成
     * 
     * @param {Object} shapeData - シェイプデータ
     */
    createShapeElement(shapeData) {
        this.shapeManager.createShapeElement(shapeData);
    }

    /**
     * シェイプ要素を更新します。
     * 
     * @param {Object} shapeData - シェイプデータ
     */
    updateShapeElement(shapeData) {
        this.shapeManager.updateShapeElement(shapeData);
    }

    // ========================================
    // 接続線操作（ConnectionManagerに委譲）
    // ========================================

    /**
     * すべての接続線を描画します。
     */
    drawConnections() {
        this.connectionManager.drawConnections();
    }

    /**
     * 接続線を削除
     * 
     * @param {string} id - 削除する接続線のID
     */
    removeConnection(id) {
        this.connectionManager.removeConnection(id);
    }

    /**
     * 接続プレビューをクリアします。
     */
    clearConnectionPreview() {
        this.connectionManager.clearConnectionPreview();
    }

    // ========================================
    // ズーム・パン（ZoomPanManagerに委譲）
    // ========================================

    /**
     * ズームインします。
     */
    zoomIn() {
        this.zoomPanManager.zoomIn();
        this.zoomLevel = this.zoomPanManager.getZoom();
    }

    /**
     * ズームアウトします。
     */
    zoomOut() {
        this.zoomPanManager.zoomOut();
        this.zoomLevel = this.zoomPanManager.getZoom();
    }

    /**
     * 全体表示にフィットします。
     */
    fitView() {
        this.zoomPanManager.fitView();
        this.zoomLevel = this.zoomPanManager.getZoom();
    }

    /**
     * クライアント座標（画面上のマウス座標）をキャンバス内座標に変換します。
     * 
     * @param {number} clientX - クライアントX座標
     * @param {number} clientY - クライアントY座標
     * @returns {{x: number, y: number}} キャンバス内座標
     */
    clientToCanvasCoords(clientX, clientY) {
        return this.zoomPanManager
            ? this.zoomPanManager.clientToCanvasCoords(clientX, clientY)
            : { x: clientX, y: clientY };
    }

    // ========================================
    // コンテキストメニュー（ContextMenuManagerに委譲）
    // ========================================

    /**
     * コンテキストメニューを表示します。
     */
    showContextMenu(x, y, type) {
        if (this._locked) return;
        this.contextMenuManager.showContextMenu(x, y, type);
    }

    /**
     * コンテキストメニューを非表示にします。
     */
    hideContextMenu() {
        this.contextMenuManager.hideContextMenu();
    }

    // ========================================
    // ロック制御
    // ========================================

    /**
     * 編集ロック状態を設定します。
     * ロック中は選択モードに固定し、ドラッグ、リサイズ、接続、コンテキストメニューをブロックします。
     * パン、ズーム、展開/折りたたみ、テキストジャンプは維持されます。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
        if (locked) {
            // ロック前のモードを保存し、選択モードに強制切替
            this._modeBeforeLock = this.mode;
            if (this.mode !== 'select') {
                this.setMode('select');
            }
            this.hideContextMenu();

            // 選択/接続モード切替ボタンのみ非表示（ズーム・全体表示は維持）
            document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
                btn.style.display = 'none';
            });
        } else {
            // ロック解除時にモード切替ボタンを再表示
            document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
                btn.style.display = '';
            });

            // ロック前のモードが保存されていれば復帰
            if (this._modeBeforeLock && this._modeBeforeLock !== this.mode) {
                this.setMode(this._modeBeforeLock);
            }
            this._modeBeforeLock = null;
        }
    }

    // ========================================
    // ポインター・マウスイベント処理
    // ========================================

    /**
     * ポインターダウン（タッチ/マウス）イベントを処理します。
     * 
     * @param {PointerEvent|MouseEvent} e
     */
    handlePointerDown(e) {
        // 左クリック/タッチ以外（右クリック、中クリック等）はドラッグや選択操作を行わない
        if (e.button !== 0) return;

        const target = e.target;

        // リサイズハンドル（ロック中はブロック）
        if (target.classList.contains('resize-handle')) {
            if (this._locked) return;
            // 接続モード中はリサイズ不可
            if (this.mode === 'connect') return;
            this.shapeManager.startResize(e, target);
            return;
        }

        // 接続ポイント（ロック中はブロック）
        const connPoint = target.closest ? target.closest('.connection-point') : null;
        if (this.mode === 'connect' && connPoint) {
            if (this._locked) return;
            this.connectionManager.startConnect(connPoint);
            return;
        }

        // グループボタン（オーバーレイ+ボタンやトグルボタン）クリック時は親ノードの選択・ドラッグを行わない
        if (target.closest('.group-overlay-btn, .group-toggle')) {
            return;
        }

        // 図形クリック
        const shapeEl = target.closest('.shape');
        if (shapeEl) {
            const isCtrl = e.ctrlKey || e.metaKey;
            const shapeId = shapeEl.id;

            if (this.mode === 'select') {
                if (this._locked) {
                    // ロック中は選択＋テキストジャンプ（ドラッグなし）
                    if (isCtrl) {
                        this.toggleShapeSelection(shapeId);
                    } else {
                        this.selectShape(shapeId, false);
                    }
                    // mousedown中のscrollはフォーカスと競合するため非同期実行
                    setTimeout(() => {
                        const shape = this.core.shapes.get(shapeId);
                        if (shape && shape.headingId && this.editorManager) {
                            this.editorManager.scrollToHeading(shape.headingId);
                        }
                    }, 0);
                    return;
                }
                this.shapeManager.startDrag(e, shapeEl, isCtrl);
            } else if (this.mode === 'connect') {
                if (this._locked) return;
                // 接続モードで図形をクリック
                const point = target.closest('.connection-point');
                if (point) {
                    this.connectionManager.startConnect(point);
                }
            }
            return;
        }

        // 接続線クリック
        if (target.tagName.toLowerCase() === 'path' || target.closest('path')) {
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl && this.mode === 'select' && !this._locked) {
                e.preventDefault();
                this.shapeManager.startBoxSelection(e);
                return;
            }
            this.clearSelection();
            return;
        }

        // 背景クリック
        e.preventDefault();
        const isCtrl = e.ctrlKey || e.metaKey;
        if (isCtrl && this.mode === 'select' && !this._locked) {
            this.shapeManager.startBoxSelection(e);
            return;
        }

        this.clearSelection();
        this.zoomPanManager.startPan(e);
    }

    /**
     * ポインタームーブ（ドラッグ/移動）イベントを処理します。
     * 
     * @param {PointerEvent|MouseEvent} e
     */
    handlePointerMove(e) {
        // パン中
        if (this.zoomPanManager.isPanningActive()) {
            this.zoomPanManager.updatePan(e);
            return;
        }

        // リサイズ中
        if (this.shapeManager.isResizingActive()) {
            this.shapeManager.updateResize(e);
            return;
        }

        // 範囲選択中
        if (this.shapeManager.isBoxSelectingActive()) {
            this.shapeManager.updateBoxSelection(e);
            return;
        }

        // ドラッグ中
        if (this.shapeManager.isDraggingActive()) {
            this.shapeManager.updateDrag(e);
            return;
        }

        // 接続プレビュー
        if (this.mode === 'connect' && this.connectionManager.connectStartShape) {
            const { x: mouseX, y: mouseY } = this.clientToCanvasCoords(e.clientX, e.clientY);
            this.connectionManager.drawConnectionPreview(mouseX, mouseY);
        }
    }

    /**
     * ポインターアップ（指を離す/マウス離す）イベントを処理します。
     * 
     * @param {PointerEvent|MouseEvent} e
     */
    handlePointerUp(e) {
        // 左クリック/タッチ以外は何もしない
        if (e.button !== 0) return;

        // パン終了
        if (this.zoomPanManager.isPanningActive()) {
            this.zoomPanManager.endPan(e);
        }

        // 範囲選択終了
        if (this.shapeManager.isBoxSelectingActive()) {
            this.shapeManager.endBoxSelection(e);
        }

        // リサイズ終了
        if (this.shapeManager.isResizingActive()) {
            this.shapeManager.endResize();
            this.updateCanvasSize();
        }

        // ドラッグ終了
        if (this.shapeManager.isDraggingActive()) {
            this.shapeManager.endDrag();
            this.updateCanvasSize();
        }

        // 接続完了
        if (this.mode === 'connect' && this.connectionManager.connectStartShape) {
            let connPoint = null;

            // 1. 指/カーソルを離した座標の直下要素を取得（タッチデバイスでは e.target が始点要素に固定されるため必須）
            if (e.clientX !== undefined && e.clientY !== undefined) {
                const hitEl = document.elementFromPoint(e.clientX, e.clientY);
                if (hitEl) {
                    connPoint = hitEl.closest ? hitEl.closest('.connection-point') : null;
                }

                // 重なり要素から接続ポイントを検索
                if (!connPoint && document.elementsFromPoint) {
                    const elements = document.elementsFromPoint(e.clientX, e.clientY);
                    for (const el of elements) {
                        const pt = el.closest ? el.closest('.connection-point') : null;
                        if (pt) {
                            connPoint = pt;
                            break;
                        }
                    }
                }

                // 2. 接続ポイントそのものではなくノード（シェイプまたはオーバーレイ）上にドロップされた場合、
                //    そのノードの最も近い接続ポイントを自動選択
                if (!connPoint && hitEl) {
                    const targetNode = hitEl.closest ? hitEl.closest('.shape, .overlay-group-area') : null;
                    if (targetNode && targetNode.id !== this.connectionManager.connectStartShape) {
                        const points = targetNode.querySelectorAll('.connection-point');
                        let closestPt = null;
                        let minDistance = Infinity;
                        points.forEach(pt => {
                            const rect = pt.getBoundingClientRect();
                            const ptCenterX = rect.left + rect.width / 2;
                            const ptCenterY = rect.top + rect.height / 2;
                            const dist = Math.hypot(e.clientX - ptCenterX, e.clientY - ptCenterY);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestPt = pt;
                            }
                        });
                        connPoint = closestPt;
                    }
                }
            }

            // フォールバック: e.target（マウス操作等）
            if (!connPoint && e.target?.closest) {
                connPoint = e.target.closest('.connection-point');
            }

            if (connPoint) {
                this.connectionManager.endConnect(connPoint);
            } else {
                this.connectionManager.clearConnectionStart();
            }
            this.connectionManager.clearConnectionPreview();
        }
    }

    /**
     * ポインターキャンセル（タッチ中断/OS割り込み等）イベントを処理します。
     * 
     * @param {PointerEvent} e
     */
    handlePointerCancel(e) {
        if (this.zoomPanManager.isPanningActive()) {
            this.zoomPanManager.endPan(e);
        }

        if (this.shapeManager.isBoxSelectingActive()) {
            this.shapeManager.endBoxSelection(e);
        }

        if (this.shapeManager.isResizingActive()) {
            this.shapeManager.endResize();
            this.updateCanvasSize();
        }

        if (this.shapeManager.isDraggingActive()) {
            this.shapeManager.endDrag();
            this.updateCanvasSize();
        }

        if (this.mode === 'connect' && this.connectionManager.connectStartShape) {
            this.connectionManager.clearConnectionStart();
            this.connectionManager.clearConnectionPreview();
        }
    }

    /**
     * 後方互換用マウスダウンハンドラ
     * @param {MouseEvent} e
     */
    handleMouseDown(e) {
        return this.handlePointerDown(e);
    }

    /**
     * 後方互換用マウスムーブハンドラ
     * @param {MouseEvent} e
     */
    handleMouseMove(e) {
        return this.handlePointerMove(e);
    }

    /**
     * 後方互換用マウスアップハンドラ
     * @param {MouseEvent} e
     */
    handleMouseUp(e) {
        return this.handlePointerUp(e);
    }

    /**
     * キーダウンイベントを処理します。
     * 選択中のノードを矢印キーで移動します。
     * 
     * @param {KeyboardEvent} e
     */
    handleKeyDown(e) {
        // 入力フィールドやエディタ内ではスキップ
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
            || e.target.isContentEditable) {
            return;
        }

        // フローチャートが非表示の場合はスキップ
        if (!this.container || this.container.classList.contains('collapsed')) return;

        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (!arrowKeys.includes(e.key)) return;

        // 選択中のノードまたはオーバーレイがなければスキップ
        const hasSelectedShape = !!this.shapeManager._getSelectedShape();
        const hasSelectedOverlay = (this.getSelectedOverlays() || []).length > 0;
        if (!hasSelectedShape && !hasSelectedOverlay) return;

        // 移動量（1px固定）
        const step = 1;

        let deltaX = 0, deltaY = 0;
        switch (e.key) {
            case 'ArrowUp': deltaY = -step; break;
            case 'ArrowDown': deltaY = step; break;
            case 'ArrowLeft': deltaX = -step; break;
            case 'ArrowRight': deltaX = step; break;
        }

        this.shapeManager.moveSelectedByKey(deltaX, deltaY);

        // ブラウザのスクロールを抑制
        e.preventDefault();
    }

    // ========================================
    // エディタ同期
    // ========================================

    /**
     * エディタの見出しとフローチャートの図形を同期します。
     * 
     * @param {Array} headings - 見出し情報の配列
     */
    syncFromEditor(headings) {
        if (!headings) return;

        // すべて未確認としてマーク
        this.shapes.forEach(s => s.seen = false);

        headings.forEach((h, index) => {
            // IDで既存の図形を検索
            let shape = Array.from(this.shapes.values()).find(s => s.headingId === h.id);

            // 後方互換性
            if (!shape) {
                shape = Array.from(this.shapes.values()).find(s => !s.headingId && s.headingIndex === index);
                if (shape) {
                    shape.headingId = h.id;
                }
            }

            if (shape) {
                shape.text = h.text;
                shape.seen = true;
                shape.headingIndex = index;
                this.updateShapeElement(shape);
            } else {
                // 新規作成
                this._createShapeFromHeading(h, index, headings);
            }
        });

        // 削除された見出しに対応する図形を削除
        const toRemove = [];
        this.shapes.forEach((s, id) => {
            if (s.headingId && !s.seen) {
                toRemove.push(id);
            } else if (s.headingIndex !== undefined && !s.headingId && !s.seen) {
                toRemove.push(id);
            }
        });
        toRemove.forEach(id => this.removeShape(id));

        this.drawConnections();
        this.updateCanvasSize();
    }

    /**
     * 見出しからシェイプを作成します。
     * 
     * @param {Object} h - 見出し情報
     * @param {number} index - インデックス
     * @param {Array} headings - 見出し配列
     * @private
     */
    _createShapeFromHeading(h, index, headings) {
        // 位置の計算
        let x = CONFIG.FLOWCHART.LAYOUT.START_X;
        let y = CONFIG.FLOWCHART.LAYOUT.START_Y;
        const gapY = 20;

        if (index > 0) {
            const prevHeading = headings[index - 1];
            const prevShape = Array.from(this.shapes.values()).find(s => s.headingId === prevHeading.id);
            if (prevShape) {
                x = prevShape.x;
                y = prevShape.y + prevShape.height + gapY;
            } else {
                x = CONFIG.FLOWCHART.LAYOUT.START_X + (index * CONFIG.FLOWCHART.LAYOUT.STEP_X) % CONFIG.FLOWCHART.LAYOUT.WRAP_X;
                y = CONFIG.FLOWCHART.LAYOUT.START_Y + Math.floor(index / 5) * CONFIG.FLOWCHART.LAYOUT.STEP_Y;
            }
        }

        this.shapeManager.createShape({
            text: h.text,
            x,
            y,
            headingId: h.id,
            headingIndex: index,
            seen: true
        });
    }

    // ========================================
    // キャンバスサイズ
    // ========================================

    /**
     * キャンバスサイズを更新します。
     */
    updateCanvasSize() {
        this.core.updateCanvasSize();
    }

    // ========================================
    // z-index更新（完全移行に伴い、実態があれば実装、なければ削除）
    // ========================================

    /**
     * すべてのシェイプのz-indexを更新します。
     * 子ノードは親ノードより上に表示されるようにします。
     */
    updateAllZIndexes() {
        const BASE_Z_INDEX = 100;
        const Z_INDEX_STEP = 200;

        // 再帰的に深さ（depth）をベースにz-indexを設定
        // オーバーレイ(200, 400, 600...) と交互に重なる設計:
        //   depth=0 -> 100, depth=1 -> 300, depth=2 -> 500...
        // ただし、オーバーレイが開かれた際には子ノードのz-indexが
        // OverlayCanvas._applyZIndex() によって上書きされるため、
        // ここでの値はオーバーレイが閉じている状態の基底値として機能します。
        const setZIndexRecursive = (shape, depth) => {
            if (shape.element) {
                shape.element.style.zIndex = BASE_Z_INDEX + (depth * Z_INDEX_STEP);
            }

            if (shape.children && shape.children.length > 0) {
                shape.children.forEach(childId => {
                    const child = this.shapes.get(childId);
                    if (child) {
                        setZIndexRecursive(child, depth + 1);
                    }
                });
            }
        };

        // ルートノード（親を持たないノード）を取得
        const rootShapes = [];
        this.shapes.forEach(shape => {
            if (!shape.parent) {
                rootShapes.push(shape);
            }
        });

        // ルートノードから順に処理
        rootShapes.forEach(shape => {
            setZIndexRecursive(shape, 0);
        });

        // 接続線のzIndexも更新するため再描画
        if (this.connectionManager) {
            this.connectionManager.drawConnections();
        }
    }

    // ========================================
    // データ操作
    // ========================================

    /**
     * フローチャートのデータを取得します。
     * 
     * @returns {Object}
     */
    getData() {
        return this.core.getData();
    }

    /**
     * フローチャートのデータを設定します。
     * 
     * @param {Object} data
     */
    setData(data) {
        // 開いているオーバーレイがあれば閉じる
        if (this.groupManager?.overlayStrategy) {
            this.groupManager.overlayStrategy.closeAllOverlays();
        }

        // 既存のシェイプDOMをクリア
        if (this.shapesLayer) {
            this.shapesLayer.innerHTML = '';
        }

        this.core.setData(data);

        // DOM要素を再作成
        this.shapes.forEach(shape => {
            this.createShapeElement(shape);
        });

        // グループの状態を復元
        if (this.groupManager) {
            this.shapes.forEach(shape => {
                this.groupManager.restoreGroupState(shape);
            });

            // 保存時に開いていたオーバーレイの展開状態を復元（親から順に展開）
            if (this.groupManager.overlayStrategy) {
                const overlayShapes = Array.from(this.shapes.values())
                    .filter(shape => shape.groupMode === 'overlay' && shape.overlayOpen);

                const getDepth = (s) => {
                    let d = 0, p = s.parent;
                    while (p) { d++; p = this.shapes.get(p)?.parent; }
                    return d;
                };
                overlayShapes.sort((a, b) => getDepth(a) - getDepth(b));

                overlayShapes.forEach(shape => {
                    // 先祖に閉じているオーバーレイがないか確認
                    let canOpen = true;
                    let pid = shape.parent;
                    while (pid) {
                        const pShape = this.shapes.get(pid);
                        if (!pShape) break;
                        if (pShape.groupMode === 'overlay' && !pShape.overlayOpen) {
                            canOpen = false;
                            break;
                        }
                        pid = pShape.parent;
                    }
                    if (canOpen) {
                        this.groupManager.overlayStrategy.openOverlay(shape);
                    } else {
                        shape._overlayWasOpen = true;
                    }
                });
            }
        }

        this.drawConnections();
        this.updateCanvasSize();
    }
}
