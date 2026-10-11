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

        /** @type {Map<number, {clientX: number, clientY: number}>} アクティブなポインター（マルチタッチ追跡用） */
        this.activePointers = new Map();

        /** @type {number|null} ピンチ開始時の2ポインター間距離 */
        this.initialPinchDistance = null;

        /** @type {number|null} ピンチ開始時のズームレベル */
        this.initialPinchZoom = null;

        /** @type {{x: number, y: number}|null} ピンチ開始時の中心（コンテンツ内座標） */
        this.initialPinchCenterContent = null;
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
    // パン・ピンチ操作
    // =====================================================

    /**
     * 2つのポインター座標間の距離を算出します。
     * @private
     * @param {{clientX: number, clientY: number}} p1
     * @param {{clientX: number, clientY: number}} p2
     * @returns {number}
     */
    _getPointersDistance(p1, p2) {
        const dx = p1.clientX - p2.clientX;
        const dy = p1.clientY - p2.clientY;
        return Math.hypot(dx, dy);
    }

    /**
     * 2つのポインター座標の中心を算出します。
     * @private
     * @param {{clientX: number, clientY: number}} p1
     * @param {{clientX: number, clientY: number}} p2
     * @returns {{x: number, y: number}}
     */
    _getPointersCenter(p1, p2) {
        return {
            x: (p1.clientX + p2.clientX) / 2,
            y: (p1.clientY + p2.clientY) / 2
        };
    }

    /**
     * パン操作を開始します。
     * 
     * @param {PointerEvent|MouseEvent} e - ポインターまたはマウスイベント
     */
    startPan(e) {
        this.isPanning = true;

        if (e.pointerId !== undefined) {
            this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        }

        if (this.activePointers.size >= 2) {
            // 2本指によるピンチ開始
            const [p1, p2] = Array.from(this.activePointers.values());
            this.initialPinchDistance = this._getPointersDistance(p1, p2);
            this.initialPinchZoom = this.zoomLevel;

            const center = this._getPointersCenter(p1, p2);
            const canvas = this.app.canvas;
            const canvasRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
            const cx = center.x - canvasRect.left;
            const cy = center.y - canvasRect.top;

            this.initialPinchCenterContent = {
                x: (cx - this.pan.x) / (this.zoomLevel || 1),
                y: (cy - this.pan.y) / (this.zoomLevel || 1)
            };
        } else {
            // 1本指またはマウスクリックによるパン開始
            this.panStartMouse = { x: e.clientX, y: e.clientY };
            this.panStartOffset = { x: this.pan.x, y: this.pan.y };
        }
    }

    /**
     * パン操作を更新します。
     * 上下左右あらゆる方向へ無制限にパン可能です。
     * マルチタッチ時はピンチイン/ピンチアウトによるズームおよび2本指パンを行います。
     * 
     * @param {PointerEvent|MouseEvent} e - ポインターまたはマウスイベント
     */
    updatePan(e) {
        if (!this.isPanning) return;

        if (e.pointerId !== undefined) {
            this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        }

        // 2本指以上の場合: ピンチズーム＆パン
        if (this.activePointers.size >= 2) {
            const [p1, p2] = Array.from(this.activePointers.values());
            const currentDistance = this._getPointersDistance(p1, p2);
            const center = this._getPointersCenter(p1, p2);

            // ピンチ初期状態が未設定なら設定（後から2本目が触れたケース）
            if (!this.initialPinchDistance || this.initialPinchDistance <= 0) {
                this.initialPinchDistance = currentDistance;
                this.initialPinchZoom = this.zoomLevel;

                const canvas = this.app.canvas;
                const canvasRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
                const cx = center.x - canvasRect.left;
                const cy = center.y - canvasRect.top;

                this.initialPinchCenterContent = {
                    x: (cx - this.pan.x) / (this.zoomLevel || 1),
                    y: (cy - this.pan.y) / (this.zoomLevel || 1)
                };
            }

            if (this.initialPinchDistance > 0 && this.initialPinchCenterContent) {
                const scaleRatio = currentDistance / this.initialPinchDistance;
                const newZoom = Math.max(this.zoomMin, Math.min(this.zoomMax, (this.initialPinchZoom || 1) * scaleRatio));
                this.zoomLevel = newZoom;

                const canvas = this.app.canvas;
                const canvasRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
                const cx = center.x - canvasRect.left;
                const cy = center.y - canvasRect.top;

                // 指の中心位置を基準にパン位置を補正
                this.pan.x = cx - this.initialPinchCenterContent.x * newZoom;
                this.pan.y = cy - this.initialPinchCenterContent.y * newZoom;

                this.applyTransform();
            }
            return;
        }

        // 1本指またはマウスによる通常パン
        const dx = e.clientX - this.panStartMouse.x;
        const dy = e.clientY - this.panStartMouse.y;
        this.pan.x = this.panStartOffset.x + dx;
        this.pan.y = this.panStartOffset.y + dy;

        this.applyTransform();
    }

    /**
     * パン操作を終了します。
     * 
     * @param {PointerEvent|MouseEvent} [e] - 終了イベント
     */
    endPan(e) {
        if (e && e.pointerId !== undefined) {
            this.activePointers.delete(e.pointerId);
        } else {
            this.activePointers.clear();
        }

        if (this.activePointers.size === 1) {
            // 2本指のうち1本が離れ、1本が残った場合: 残った指を起点とした通常パンへシームレスに切り替え
            const remaining = Array.from(this.activePointers.values())[0];
            this.panStartMouse = { x: remaining.clientX, y: remaining.clientY };
            this.panStartOffset = { x: this.pan.x, y: this.pan.y };
            this.initialPinchDistance = null;
            this.initialPinchZoom = null;
            this.initialPinchCenterContent = null;
        } else if (this.activePointers.size === 0) {
            this.isPanning = false;
            this.initialPinchDistance = null;
            this.initialPinchZoom = null;
            this.initialPinchCenterContent = null;
        }
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
