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

        /** @type {boolean} パン中かどうか */
        this.isPanning = false;

        /** @type {{x: number, y: number}} パン開始位置 */
        this.panStart = { x: 0, y: 0 };

        /** @type {{left: number, top: number}} スクロール開始位置 */
        this.scrollStart = { left: 0, top: 0 };
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
     * ズームレベルを設定します。
     * 
     * @param {number} level - 新しいズームレベル
     */
    setZoom(level) {
        // 範囲制限
        this.zoomLevel = Math.max(this.zoomMin, Math.min(this.zoomMax, level));

        // キャンバスコンテンツにズームを適用
        const canvasContent = this.app.canvasContent;
        if (canvasContent) {
            canvasContent.style.transform = `scale(${this.zoomLevel})`;
            canvasContent.style.transformOrigin = 'top left';
        }
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
     * 全体表示にフィットします。
     */
    fitView() {
        if (!this.app.shapes || this.app.shapes.size === 0) {
            this.setZoom(1.0);
            return;
        }

        // すべてのシェイプのバウンディングボックスを計算
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.app.shapes.forEach(shape => {
            minX = Math.min(minX, shape.x);
            minY = Math.min(minY, shape.y);
            maxX = Math.max(maxX, shape.x + shape.width);
            maxY = Math.max(maxY, shape.y + shape.height);
        });

        if (minX === Infinity) return;

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

        // フィットするズームレベルを計算
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        const scaleX = canvasWidth / contentWidth;
        const scaleY = canvasHeight / contentHeight;
        const scale = Math.min(scaleX, scaleY, 1.0); // 1.0を超えないように

        this.setZoom(scale);

        // スクロール位置を調整
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        canvas.scrollLeft = centerX * scale - canvasWidth / 2;
        canvas.scrollTop = centerY * scale - canvasHeight / 2;
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
        this.panStart = { x: e.clientX, y: e.clientY };
        this.scrollStart = {
            left: this.app.canvas.scrollLeft,
            top: this.app.canvas.scrollTop
        };
    }

    /**
     * パン操作を更新します。
     * 
     * @param {MouseEvent} e - マウスイベント
     */
    updatePan(e) {
        if (!this.isPanning) return;

        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;
        this.app.canvas.scrollLeft = this.scrollStart.left - dx;
        this.app.canvas.scrollTop = this.scrollStart.top - dy;
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
