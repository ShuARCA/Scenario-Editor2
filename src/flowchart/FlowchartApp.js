/**
 * フローチャートコントローラー
 * 
 * フローチャートのメインコントローラークラス。
 * FlowchartCore（データ・基本操作）と各マネージャー（機能）を統括し、
 * ユーザーインタラクション（マウスイベント等）を処理します。
 */
import { FlowchartCore } from '../core/FlowchartCore.js';
import { CONFIG } from '../core/Config.js';
import { generateId } from '../utils/helpers.js';

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
                btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
            }
        });

        // キャンバスのマウスイベント
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

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
     */
    selectShape(id) {
        this.shapeManager.selectShape(id);
    }

    /**
     * 選択を解除します。
     */
    clearSelection() {
        this.shapeManager.clearSelection();
        this.connectionManager.clearConnectionSelection();
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

    // ========================================
    // コンテキストメニュー（ContextMenuManagerに委譲）
    // ========================================

    /**
     * コンテキストメニューを表示します。
     */
    showContextMenu(x, y, type) {
        this.contextMenuManager.showContextMenu(x, y, type);
    }

    /**
     * コンテキストメニューを非表示にします。
     */
    hideContextMenu() {
        this.contextMenuManager.hideContextMenu();
    }

    // ========================================
    // マウスイベント処理
    // ========================================

    /**
     * マウスダウンイベントを処理します。
     * 
     * @param {MouseEvent} e
     */
    handleMouseDown(e) {
        const target = e.target;

        // リサイズハンドル
        if (target.classList.contains('resize-handle')) {
            this.shapeManager.startResize(e, target);
            return;
        }

        // 接続ポイント
        if (this.mode === 'connect' && target.classList.contains('connection-point')) {
            this.connectionManager.startConnect(target);
            return;
        }

        // 図形クリック
        const shapeEl = target.closest('.shape');
        if (shapeEl) {
            if (this.mode === 'select') {
                this.shapeManager.startDrag(e, shapeEl);
            } else if (this.mode === 'connect') {
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
            this.clearSelection();
            return;
        }

        // 背景クリック
        e.preventDefault();
        this.clearSelection();
        this.zoomPanManager.startPan(e);
    }

    /**
     * マウスムーブイベントを処理します。
     * 
     * @param {MouseEvent} e
     */
    handleMouseMove(e) {
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

        // ドラッグ中
        if (this.shapeManager.isDraggingActive()) {
            this.shapeManager.updateDrag(e);
            return;
        }

        // 接続プレビュー
        if (this.mode === 'connect' && this.connectionManager.connectStartShape) {
            const canvasRect = this.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - canvasRect.left + this.canvas.scrollLeft) / this.zoomLevel;
            const mouseY = (e.clientY - canvasRect.top + this.canvas.scrollTop) / this.zoomLevel;
            this.connectionManager.drawConnectionPreview(mouseX, mouseY);
        }
    }

    /**
     * マウスアップイベントを処理します。
     * 
     * @param {MouseEvent} e
     */
    handleMouseUp(e) {
        // パン終了
        if (this.zoomPanManager.isPanningActive()) {
            this.zoomPanManager.endPan();
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
            const target = e.target;
            if (target.classList.contains('connection-point')) {
                this.connectionManager.endConnect(target);
            } else {
                this.connectionManager.clearConnectionStart();
            }
            this.connectionManager.clearConnectionPreview();
        }
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
        const id = generateId();

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

        const newShape = {
            id: id,
            text: h.text,
            x: x,
            y: y,
            width: CONFIG.FLOWCHART.SHAPE.WIDTH,
            height: CONFIG.FLOWCHART.SHAPE.HEIGHT,
            headingIndex: index,
            headingId: h.id,
            seen: true,
            children: []
        };
        this.shapes.set(id, newShape);
        this.createShapeElement(newShape);
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
        let zIndex = 1;

        // ルートノード（親を持たないノード）を取得
        const rootShapes = [];
        this.shapes.forEach(shape => {
            if (!shape.parent) {
                rootShapes.push(shape);
            }
        });

        // 再帰的にz-indexを設定（子は親より高いz-indexを持つ）
        const setZIndexRecursive = (shape, baseZ) => {
            if (shape.element) {
                shape.element.style.zIndex = baseZ;
            }

            let currentZ = baseZ;

            if (shape.children && shape.children.length > 0) {
                shape.children.forEach(childId => {
                    const child = this.shapes.get(childId);
                    if (child) {
                        currentZ = setZIndexRecursive(child, currentZ + 1);
                    }
                });
            }

            return currentZ;
        };

        // ルートノードから順に処理
        rootShapes.forEach(shape => {
            zIndex = setZIndexRecursive(shape, zIndex) + 1;
        });
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
        this.core.setData(data);

        // DOM要素を再作成
        this.shapes.forEach(shape => {
            this.createShapeElement(shape);
        });

        this.drawConnections();
        this.updateCanvasSize();
    }
}
