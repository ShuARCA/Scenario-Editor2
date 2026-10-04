/**
 * ズーム・パン管理
 * 
 * フローチャートのズームとパン操作を担当します。
 * 
 * @module flowchart/ZoomPanManager
 */

/**
 * ズーム・パン管理クラス
 */
export class ZoomPanManager {
    /**
     * ZoomPanManagerのコンストラクタ
     * 
     * @param {Object} flowchartApp - FlowchartAppへの参照
     */
    constructor(flowchartApp) {
        /** @type {Object} FlowchartAppへの参照 */
        this.app = flowchartApp;

        /** @type {number} 現在のズームレベル */
        this.zoomLevel = 1.0;

        /** @type {number} 最小ズームレベル */
        this.zoomMin = 0.1;

        /** @type {number} 最大ズームレベル */
        this.zoomMax = 2.0;

        /** @type {number} ズームステップ */
        this.zoomStep = 0.1;

        /** @type {{x: number, y: number}} 現在のパン位置（px） */
        this.pan = { x: 0, y: 0 };

        /** @type {boolean} パン中かどうか */
        this.isPanning = false;

        /** @type {{x: number, y: number}} パン開始時のマウス位置 */
        this.panStartMouse = { x: 0, y: 0 };

        /** @type {{x: number, y: number}} パン開始時のパンオフセット */
        this.panStartOffset = { x: 0, y: 0 };
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * ズームボタンをセットアップします。
     */
    setupZoomButtons() {
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const fitViewBtn = document.getElementById('fit-view-btn');

        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (fitViewBtn) fitViewBtn.addEventListener('click', () => this.fitView());

        // 初期トランスフォームを適用
        this.applyTransform();
    }

    // =====================================================
    // トランスフォーム適用
    // =====================================================

    /**
     * キャンバスコンテンツ要素に現在のパンとズームのCSS transformを適用します。
     */
    applyTransform() {
        const canvasContent = this.app.canvasContent;
        if (canvasContent) {
            canvasContent.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoomLevel})`;
            canvasContent.style.transformOrigin = '0 0';
        }
    }

    // =====================================================
    // ズーム操作
    // =====================================================

    /**
     * ズームインします。
     */
    zoomIn() {
        this.setZoom(this.zoomLevel + this.zoomStep);
    }

    /**
     * ズームアウトします。
     */
    zoomOut() {
        this.setZoom(this.zoomLevel - this.zoomStep);
    }

    /**
     * ズームレベルを設定します。指定したアンカー位置（デフォルトはキャンバス中心）を維持します。
     * 
     * @param {number} level - 新しいズームレベル
     * @param {number|null} [centerClientX=null] - 基準とするクライアントX座標（nullの場合はキャンバス中心）
     * @param {number|null} [centerClientY=null] - 基準とするクライアントY座標（nullの場合はキャンバス中心）
     */
    setZoom(level, centerClientX = null, centerClientY = null) {
        const oldZoom = this.zoomLevel;
        const newZoom = Math.max(this.zoomMin, Math.min(this.zoomMax, level));

        const canvas = this.app.canvas;
        if (canvas && oldZoom > 0) {
            const canvasRect = canvas.getBoundingClientRect();
            const cx = centerClientX !== null ? centerClientX - canvasRect.left : canvas.clientWidth / 2;
            const cy = centerClientY !== null ? centerClientY - canvasRect.top : canvas.clientHeight / 2;

            // ズーム前のアンカー位置（コンテンツ内座標）
            const contentX = (cx - this.pan.x) / oldZoom;
            const contentY = (cy - this.pan.y) / oldZoom;

            // 新しいズーム後もアンカー位置が画面上の同じ位置(cx, cy)にとどまるよう pan を補正
            this.pan.x = cx - contentX * newZoom;
            this.pan.y = cy - contentY * newZoom;
        }

        this.zoomLevel = newZoom;
        this.applyTransform();
    }

    /**
     * 現在のズームレベルを取得します。
     * 
     * @returns {number} ズームレベル
     */
    getZoom() {
        return this.zoomLevel;
    }

    /**
     * クライアント座標（画面上のマウス座標）をキャンバス内座標に変換します。
     * ズーム倍率およびパン移動量を考慮します。
     * 
     * @param {number} clientX - クライアントX座標
     * @param {number} clientY - クライアントY座標
     * @returns {{x: number, y: number}} キャンバス内座標
     */
    clientToCanvasCoords(clientX, clientY) {
        const canvas = this.app.canvas;
        if (!canvas) return { x: clientX, y: clientY };

        const canvasRect = canvas.getBoundingClientRect();
        const zoomLevel = this.zoomLevel || 1;

        return {
            x: (clientX - canvasRect.left - this.pan.x) / zoomLevel,
            y: (clientY - canvasRect.top - this.pan.y) / zoomLevel
        };
    }

    /**
     * 全体表示にフィットします。
     * 負の座標を含むシェイプ群であっても、外接矩形をキャンバス中央に綺麗に収めます。
     */
    fitView() {
        if (!this.app.shapes || this.app.shapes.size === 0) {
            this.zoomLevel = 1.0;
            this.pan = { x: 0, y: 0 };
            this.applyTransform();
            return;
        }

        // 対象シェイプおよび開いているオーバーレイ枠の外接矩形を計算
        const targets = [...this.app.shapes.values()];
        if (this.app.groupManager?.overlayStrategy?.openOverlays) {
            for (const overlay of this.app.groupManager.overlayStrategy.openOverlays.values()) {
                targets.push(overlay);
            }
        }

        const bbox = this.app.groupManager
            ? this.app.groupManager.getBoundingBox(targets)
            : this.app.core?.getBoundingBox();

        if (!bbox) return;

        let { minX, minY, maxX, maxY } = bbox;

        // パディングを追加
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // キャンバスサイズを取得
        const canvas = this.app.canvas;
        if (!canvas) return;

        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        if (!canvasWidth || !canvasHeight) return;

        // フィットするズームレベルを計算
        const contentWidth = Math.max(1, maxX - minX);
        const contentHeight = Math.max(1, maxY - minY);

        const scaleX = canvasWidth / contentWidth;
        const scaleY = canvasHeight / contentHeight;
        const scale = Math.min(scaleX, scaleY, 1.0); // 1.0を超えないように

        this.zoomLevel = Math.max(this.zoomMin, Math.min(this.zoomMax, scale));

        // コンテンツの中心をキャンバスの中心に合わせる
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        this.pan.x = canvasWidth / 2 - centerX * this.zoomLevel;
        this.pan.y = canvasHeight / 2 - centerY * this.zoomLevel;

        this.applyTransform();
    }

    // =====================================================
    // パン操作
    // =====================================================

    /**
     * パン操作を開始します。
     * 
     * @param {MouseEvent} e - マウスイベント
     */
    startPan(e) {
        this.isPanning = true;
        this.panStartMouse = { x: e.clientX, y: e.clientY };
        this.panStartOffset = { x: this.pan.x, y: this.pan.y };
    }

    /**
     * パン操作を更新します。
     * 上下左右あらゆる方向へ無制限にパン可能です。
     * 
     * @param {MouseEvent} e - マウスイベント
     */
    updatePan(e) {
        if (!this.isPanning) return;

        const dx = e.clientX - this.panStartMouse.x;
        const dy = e.clientY - this.panStartMouse.y;
        this.pan.x = this.panStartOffset.x + dx;
        this.pan.y = this.panStartOffset.y + dy;

        this.applyTransform();
    }

    /**
     * パン操作を終了します。
     */
    endPan() {
        this.isPanning = false;
    }

    /**
     * パン中かどうかを取得します。
     * 
     * @returns {boolean}
     */
    isPanningActive() {
        return this.isPanning;
    }
}
