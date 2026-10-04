/**
 * シェイプ管理
 * 
 * フローチャートのシェイプ（ノード）の作成、更新、削除、選択を担当します。
 * 
 * @module flowchart/ShapeManager
 */

import { CONFIG } from '../core/Config.js';
import { createResizeHandles, calculateResizeBounds } from './ResizeHelper.js';

/**
 * シェイプ管理クラス
 */
export class ShapeManager {
    /**
     * ShapeManagerのコンストラクタ
     * 
     * @param {Object} flowchartApp - FlowchartAppへの参照
     */
    constructor(flowchartApp) {
        /** @type {Object} FlowchartAppへの参照 */
        this.app = flowchartApp;

        // ドラッグ操作状態
        this.isDragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.dragStartPos = { x: 0, y: 0 };
        this.hasMoved = false;

        // リサイズ操作状態
        this.isResizing = false;
        this.resizeTarget = null;
        this.resizeHandlePos = null;
        this.resizeStart = { x: 0, y: 0 };
        this.resizeStartDims = null;

        // ダブルクリックおよび単一選択遅延管理
        this._singleSelectTimer = null;
        this._lastClickTime = 0;
        this._lastClickShapeId = null;
        this._isPotentialDoubleClick = false;
    }

    /**
     * 単一選択への遅延タイマーをクリアします。
     * @public
     */
    _clearSingleSelectTimer() {
        if (this._singleSelectTimer) {
            clearTimeout(this._singleSelectTimer);
            this._singleSelectTimer = null;
        }
    }

    // =====================================================
    // シェイプ作成
    // =====================================================

    /**
     * シェイプデータからDOM要素を作成します。
     * 
     * @param {Object} shapeData - シェイプデータ
     */
    createShapeElement(shapeData) {
        const el = document.createElement('div');
        el.className = 'shape';
        el.id = shapeData.id;

        // テキスト要素
        const textEl = document.createElement('div');
        textEl.className = 'shape-text';
        textEl.textContent = shapeData.text;
        el.appendChild(textEl);

        // 位置とサイズ
        el.style.left = `${shapeData.x}px`;
        el.style.top = `${shapeData.y}px`;
        el.style.width = `${shapeData.width}px`;
        el.style.height = `${shapeData.height}px`;

        // SVG背景（ひし形用）
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'shape-bg-svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('class', 'shape-bg-polygon');
        polygon.setAttribute('points', '0,50 50,0 100,50 50,100');
        svg.appendChild(polygon);
        el.appendChild(svg); // テキストの後ろ、接続ポイントの前くらいが良いが、z-indexで制御しているのでappendChildでOK

        // スタイルの適用
        if (shapeData.backgroundColor) el.style.setProperty('--shape-bg', shapeData.backgroundColor);
        if (shapeData.borderColor) el.style.setProperty('--shape-border-color', shapeData.borderColor);
        if (shapeData.color) el.style.setProperty('--shape-text-color', shapeData.color);

        // 形状タイプ
        el.dataset.shape = shapeData.type || 'rounded';

        // 接続ポイントの追加
        ['top', 'bottom', 'left', 'right'].forEach(pos => {
            const pt = document.createElement('div');
            pt.className = `connection-point ${pos}`;
            pt.dataset.pos = pos;
            el.appendChild(pt);
        });

        // リサイズハンドル
        createResizeHandles(el);

        this.app.shapesLayer.appendChild(el);
        shapeData.element = el;
    }

    /**
     * 新しいシェイプを作成します。
     * 
     * @param {Object} options - オプション
     * @returns {Object} 作成されたシェイプ
     */
    createShape(options = {}) {
        const shape = this.app.core.createShape({
            text: options.text || '新規ノード',
            type: options.type || 'rounded',
            ...options
        });

        this.createShapeElement(shape);
        return shape;
    }

    // =====================================================
    // シェイプ更新
    // =====================================================

    /**
     * シェイプ要素を更新します。
     * 
     * @param {Object} shapeData - シェイプデータ
     */
    updateShapeElement(shapeData) {
        if (!shapeData.element) return;

        let textEl = shapeData.element.querySelector('.shape-text');
        if (!textEl) {
            textEl = document.createElement('div');
            textEl.className = 'shape-text';
            shapeData.element.insertBefore(textEl, shapeData.element.firstChild);
        }
        textEl.textContent = shapeData.text;

        // スタイルの更新
        if (shapeData.backgroundColor) shapeData.element.style.setProperty('--shape-bg', shapeData.backgroundColor);
        if (shapeData.borderColor) shapeData.element.style.setProperty('--shape-border-color', shapeData.borderColor);
        if (shapeData.color) shapeData.element.style.setProperty('--shape-text-color', shapeData.color);

        // 形状タイプの更新
        if (shapeData.type) {
            shapeData.element.dataset.shape = shapeData.type;
        }
    }

    /**
     * シェイプの位置を更新します。
     * 
     * @param {Object} shape - シェイプデータ
     */
    updateShapePosition(shape) {
        if (shape.element) {
            shape.element.style.left = `${shape.x}px`;
            shape.element.style.top = `${shape.y}px`;
        }
    }

    /**
     * シェイプのサイズを更新します。
     * 
     * @param {Object} shape - シェイプデータ
     */
    updateShapeSize(shape) {
        if (shape.element) {
            shape.element.style.width = `${shape.width}px`;
            shape.element.style.height = `${shape.height}px`;
        }
    }

    // =====================================================
    // シェイプ選択
    // =====================================================

    /**
     * シェイプを選択します。
     * 
     * @param {string} id - シェイプID
     * @param {boolean} [addToSelection=false] - 既存の選択を維持して追加選択するかどうか
     */
    selectShape(id, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }
        const shape = this.app.shapes.get(id);
        if (!shape?.element) return;

        shape.element.classList.add('selected');
        this._updateMultiSelectionClass();
    }

    /**
     * シェイプの選択状態をトグル（切り替え）します。
     * 
     * @param {string} id - シェイプID
     * @returns {boolean} 切り替え後に選択状態になったかどうか
     */
    toggleShapeSelection(id) {
        const shape = this.app.shapes.get(id);
        if (!shape?.element) return false;

        const isSelected = shape.element.classList.toggle('selected');
        this._updateMultiSelectionClass();
        return isSelected;
    }

    /**
     * シェイプの選択を解除します。
     * 
     * @param {string} id - シェイプID
     */
    deselectShape(id) {
        const shape = this.app.shapes.get(id);
        if (shape?.element) {
            shape.element.classList.remove('selected');
            this._updateMultiSelectionClass();
        }
    }

    /**
     * 選択を解除します。
     * オーバーレイキャンバスの選択状態も同時に解除します。
     */
    clearSelection() {
        this._clearSingleSelectTimer();
        this.app.shapes.forEach(s => {
            if (s.element) s.element.classList.remove('selected');
        });
        // 開いているオーバーレイの選択もすべて解除
        this.app.groupManager?.overlayStrategy?.clearOverlaySelection?.();
        this._updateMultiSelectionClass();
    }

    /**
     * 現在選択中の全シェイプを取得します。
     * 
     * @returns {Array<Object>} 選択中のシェイプオブジェクトの配列
     */
    getSelectedShapes() {
        const selected = [];
        for (const [, shape] of this.app.shapes) {
            if (shape.element?.classList.contains('selected')) {
                selected.push(shape);
            }
        }
        return selected;
    }

    /**
     * 現在選択中の全シェイプIDを取得します。
     * 
     * @returns {Array<string>} 選択中のシェイプIDの配列
     */
    getSelectedShapeIds() {
        return this.getSelectedShapes().map(s => s.id);
    }

    /**
     * 指定したシェイプが選択中かどうかを判定します。
     * 
     * @param {string} id - シェイプID
     * @returns {boolean}
     */
    isShapeSelected(id) {
        const shape = this.app.shapes.get(id);
        return !!(shape?.element?.classList.contains('selected'));
    }

    /**
     * 複数選択状態に応じてキャンバス要素のクラスを更新します。
     * ノードの選択数 + オーバーレイキャンバスの選択数の合計で判定します。
     * @public
     */
    _updateMultiSelectionClass() {
        if (!this.app.canvas) return;
        const shapeCount = this.getSelectedShapes().length;
        const overlayCount = this.app.getSelectedOverlays?.()?.length || 0;
        const total = shapeCount + overlayCount;
        if (total >= 2) {
            this.app.canvas.classList.add('multi-selection');
        } else {
            this.app.canvas.classList.remove('multi-selection');
        }
        // 範囲選択中のノード間を繋ぐ接続線のアクティブ表示を更新
        this.app.drawConnections?.();
    }

    // =====================================================
    // シェイプ削除
    // =====================================================

    /**
     * シェイプを削除します。
     * 
     * @param {string} id - シェイプID
     */
    removeShape(id) {
        const shape = this.app.shapes.get(id);
        if (!shape) return;

        // 親子関係の解消
        if (shape.parent && this.app.groupManager) {
            this.app.groupManager.ungroupShape(shape);
        }
        if (shape.children && this.app.groupManager) {
            // 子要素の親参照を削除（グループ解除）
            [...shape.children].forEach(childId => {
                const child = this.app.shapes.get(childId);
                if (child) this.app.groupManager.ungroupShape(child);
            });
        }

        // Coreの機能を使用して削除（データ、DOM、接続線の一括削除）
        if (this.app.core) {
            this.app.core.removeShape(id);
        } else {
            console.error('FlowchartCore is not initialized');
        }

        // コンテキストメニュー関連の選択状態をクリア
        if (this.app.contextMenuManager && this.app.contextMenuManager.selectedShapeForContext === id) {
            this.app.contextMenuManager.selectedShapeForContext = null;
        }

        this.clearSelection();
    }



    // =====================================================
    // ドラッグ操作
    // =====================================================

    /**
     * ドラッグを開始します。
     * 
     * @param {MouseEvent} e - マウスイベント
     * @param {HTMLElement} shapeEl - シェイプ要素
     * @param {boolean} [isCtrl=false] - Ctrlキー（またはCmdキー）が押されているかどうか
     */
    startDrag(e, shapeEl, isCtrl = false) {
        const shape = this.app.shapes.get(shapeEl.id);
        if (!shape) {
            console.warn(`Shape data not found for id: ${shapeEl.id}`);
            return;
        }

        // 進行中の単一選択タイマーがあれば直ちにクリア
        this._clearSingleSelectTimer();

        const now = Date.now();
        // 同一シェイプに対する短時間の連続クリックをダブルクリック候補と判定
        const isDoubleClick = (this._lastClickShapeId === shapeEl.id && now - this._lastClickTime < 350);
        this._isPotentialDoubleClick = isDoubleClick;
        this._lastClickTime = now;
        this._lastClickShapeId = shapeEl.id;

        this._shouldSingleSelectOnMouseUp = false;

        if (isCtrl) {
            // Ctrlキー押下時: 選択状態をトグル
            const isNowSelected = this.toggleShapeSelection(shapeEl.id);
            if (!isNowSelected) {
                // 選択解除された場合はドラッグを開始しない
                this.isDragging = false;
                this.dragTarget = null;
                return;
            }
        } else {
            // 通常時:
            // 既に選択済みのノードをクリックした場合は、複数選択を維持してドラッグ準備。
            // 移動がなければ mouseup 後に遅延して単一選択に切り替える（ダブルクリックの場合はキャンセル）。
            if (this.isShapeSelected(shapeEl.id)) {
                const selectedCount = this.getSelectedShapes().length;
                const overlayCount = this.app.getSelectedOverlays?.()?.length || 0;
                if (selectedCount + overlayCount > 1) {
                    if (!isDoubleClick) {
                        this._shouldSingleSelectOnMouseUp = true;
                    }
                }
            } else {
                // 未選択のノードをクリックした場合は単一選択
                this.selectShape(shapeEl.id, false);
            }
        }

        this.isDragging = true;
        this.dragTarget = shapeEl;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.hasMoved = false;

        const { x: mouseX, y: mouseY } = this.app.clientToCanvasCoords(e.clientX, e.clientY);
        this.dragStartCanvasPos = { x: mouseX, y: mouseY };

        // 選択中のシェイプ群から、祖先が選択ノードに含まれていないルート移動対象ノードを抽出
        // （祖先が移動すれば子孫は moveGroupRecursive で自動追従するため、二重移動を防ぐ）
        const selectedShapes = this.getSelectedShapes();
        const selectedIds = new Set(selectedShapes.map(s => s.id));

        const isAncestorSelected = (s) => {
            let pId = s.parent;
            while (pId) {
                if (selectedIds.has(pId)) return true;
                const p = this.app.shapes.get(pId);
                pId = p ? p.parent : null;
            }
            return false;
        };

        this.draggedRootShapes = selectedShapes
            .filter(s => !isAncestorSelected(s))
            .map(s => ({
                shape: s,
                startX: s.x,
                startY: s.y
            }));
    }

    /**
     * ドラッグを更新します。
     * 選択中の全ルートノードをまとめて移動します。
     * 
     * @param {MouseEvent} e - マウスイベント
     */
    updateDrag(e) {
        if (!this.isDragging || !this.dragTarget) return;

        // 移動判定（わずかなマウス揺れはクリックとして扱う）
        const dx = Math.abs(e.clientX - this.dragStartPos.x);
        const dy = Math.abs(e.clientY - this.dragStartPos.y);
        if (dx > 3 || dy > 3) this.hasMoved = true;

        if (!this.hasMoved) return;

        const { x: mouseX, y: mouseY } = this.app.clientToCanvasCoords(e.clientX, e.clientY);
        const totalDeltaX = mouseX - this.dragStartCanvasPos.x;
        const totalDeltaY = mouseY - this.dragStartCanvasPos.y;

        if (!this.draggedRootShapes || this.draggedRootShapes.length === 0) return;

        for (const item of this.draggedRootShapes) {
            const newX = item.startX + totalDeltaX;
            const newY = item.startY + totalDeltaY;

            const stepDeltaX = newX - item.shape.x;
            const stepDeltaY = newY - item.shape.y;

            item.shape.x = newX;
            item.shape.y = newY;
            this.updateShapePosition(item.shape);

            // グループ（子ノード・オーバーレイ枠）を追従移動
            this.app.groupManager?.moveGroupRecursive(item.shape, stepDeltaX, stepDeltaY);
        }

        // 選択中のオーバーレイキャンバス（ドラッグ対象以外）も一括移動
        for (const item of (this.draggedRootOverlays || [])) {
            const newX = item.startX + totalDeltaX;
            const newY = item.startY + totalDeltaY;
            const stepDeltaX = newX - item.overlay.x;
            const stepDeltaY = newY - item.overlay.y;

            item.overlay.move(stepDeltaX, stepDeltaY);

            // オーバーレイ内の子ノードも全て平行移動
            if (item.overlay.shape.children) {
                item.overlay.shape.children.forEach(childId => {
                    const child = this.app.shapes.get(childId);
                    if (child) {
                        child.x += stepDeltaX;
                        child.y += stepDeltaY;
                        this.app.groupManager?.updateShapeDOM(child);
                        if (child.children?.length > 0) {
                            this.app.groupManager?._moveChildrenRecursive(child, stepDeltaX, stepDeltaY);
                        }
                        this.app.groupManager?.moveOverlaysRecursive(child, stepDeltaX, stepDeltaY);
                    }
                });
            }
        }

        this.app.drawConnections();
    }

    /**
     * 子ノードを再帰的に移動します（GroupManagerに委譲）。
     * 
     * @param {Object} parentShape - 親シェイプ
     * @param {number} deltaX - X方向の移動量
     * @param {number} deltaY - Y方向の移動量
     */
    moveChildrenRecursive(parentShape, deltaX, deltaY) {
        this.app.groupManager?.moveGroupRecursive(parentShape, deltaX, deltaY);
    }

    /**
     * ドラッグを終了します。
     * グループ化/解除の判定は GroupManager.handleDrop に全面委譲。
     * overlayモードも含めた全ケースを GroupManager が統一して処理する。
     */
    endDrag() {
        if (this.isDragging && this.dragTarget) {
            const shape = this.app.shapes.get(this.dragTarget.id);

            if (!this.hasMoved) {
                // 移動がなかった場合: 単一選択切り替えまたは見出しジャンプ
                if (this._shouldSingleSelectOnMouseUp) {
                    const targetId = this.dragTarget.id;
                    const headingId = shape?.headingId;
                    // 直ちに単一選択にせず、ダブルクリックの可能性を待つために遅延実行
                    this._singleSelectTimer = setTimeout(() => {
                        this._singleSelectTimer = null;
                        this.selectShape(targetId, false);
                        if (headingId && this.app.editorManager) {
                            this.app.editorManager.scrollToHeading(headingId);
                        }
                    }, 250);
                } else if (!this._isPotentialDoubleClick && shape?.headingId && this.app.editorManager) {
                    // 単一選択ノードをクリックした場合は通常通り見出しジャンプ
                    this.app.editorManager.scrollToHeading(shape.headingId);
                }
            } else if (this.app.groupManager && this.draggedRootShapes?.length > 0) {
                // 移動があった場合: 移動した各ルートシェイプのドロップ判定
                // 同時移動中の他のルートシェイプへの誤ったグループ化を防ぐため除外IDを渡す
                const ignoredIds = new Set(this.draggedRootShapes.map(item => item.shape.id));
                for (const item of this.draggedRootShapes) {
                    this.app.groupManager.handleDrop(item.shape, ignoredIds);
                }
            }
        }

        this.isDragging = false;
        this.dragTarget = null;
        this.hasMoved = false;
        this._shouldSingleSelectOnMouseUp = false;
        this.draggedRootShapes = [];
        this.draggedRootOverlays = [];
    }

    // =====================================================
    // オーバーレイドラッグ操作
    // =====================================================

    /**
     * オーバーレイキャンバスのヘッダードラッグを開始します。
     * ShapeManager に一括移動処理を委譲するため OverlayCanvas._startHeaderDrag から呼ばれます。
     * 
     * @param {MouseEvent} e
     * @param {Object} overlayCanvas - OverlayCanvasインスタンス
     * @param {boolean} [isCtrl=false]
     */
    startOverlayDrag(e, overlayCanvas, isCtrl = false) {
        this._clearSingleSelectTimer();

        if (isCtrl) {
            const isNowSelected = overlayCanvas.toggleSelect();
            if (!isNowSelected) {
                this.isDragging = false;
                return;
            }
        } else {
            if (!overlayCanvas.isSelected()) {
                overlayCanvas.select(false);
            } else {
                // 既に選択済み: 複数選択を維持してドラッグ準備
            }
        }

        this.isDragging = true;
        this.dragTarget = overlayCanvas.areaElement;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.dragStartCanvasPos = this.app.clientToCanvasCoords(e.clientX, e.clientY);
        this.hasMoved = false;
        this._shouldSingleSelectOnMouseUp = false;
        this._isOverlayDragging = true;

        // 選択中のノードのドラッグ対象を障定
        const selectedShapes = this.getSelectedShapes();
        const selectedIds = new Set(selectedShapes.map(s => s.id));

        const isAncestorSelected = (s) => {
            let pId = s.parent;
            while (pId) {
                if (selectedIds.has(pId)) return true;
                const p = this.app.shapes.get(pId);
                pId = p ? p.parent : null;
            }
            return false;
        };

        // 選択中オーバーレイの内部子ノードを除外したノードのドラッグ対象を記録
        const selectedOverlays = this.app.getSelectedOverlays?.() || [];
        const overlayParentIds = new Set(selectedOverlays.map(ov => ov.shape.id));

        // 選択ノードの中で、選択オーバーレイの内部子ノードなら除外（オーバレイの移動で追従する）
        const isInsideSelectedOverlay = (s) => {
            let pId = s.parent;
            while (pId) {
                if (overlayParentIds.has(pId)) return true;
                const p = this.app.shapes.get(pId);
                pId = p ? p.parent : null;
            }
            return false;
        };

        this.draggedRootShapes = selectedShapes
            .filter(s => !isAncestorSelected(s) && !isInsideSelectedOverlay(s))
            .map(s => ({ shape: s, startX: s.x, startY: s.y }));

        // オーバーレイが移動するための初期位置を記録
        this.draggedRootOverlays = selectedOverlays
            .map(ov => ({
                overlay: ov,
                startX: ov.x,
                startY: ov.y,
            }));

        e.preventDefault();
        e.stopPropagation();
    }

    // =====================================================
    // リサイズ操作
    // =====================================================

    /**
     * 通常ノードのリサイズを開始します。
     * 複数選択時は選択中の全ノードおよびオーバーレイを同じ変位量で一括リサイズします。
     * 
     * @param {MouseEvent} e - マウスイベント
     * @param {HTMLElement} handle - リサイズハンドル
     */
    startResize(e, handle) {
        e.stopPropagation();
        const shapeEl = handle.closest('.shape');
        if (!shapeEl) return;

        const shape = this.app.shapes.get(shapeEl.id);
        if (!shape) {
            console.warn(`Shape data not found for id: ${shapeEl.id}`);
            return;
        }

        this.isResizing = true;
        this.resizeTarget = shape;
        this.resizeHandlePos = handle.dataset.pos;
        this.resizeStart = { x: e.clientX, y: e.clientY };
        this.resizeStartDims = {
            x: this.resizeTarget.x,
            y: this.resizeTarget.y,
            width: this.resizeTarget.width,
            height: this.resizeTarget.height
        };
        this._isOverlayDragging = false;

        shapeEl.classList.add('resizing');
        // リサイズ対象が選択されていない場合は単一選択に（已選択時は複数選択を維持）
        if (!this.isShapeSelected(shapeEl.id)) {
            this.selectShape(shapeEl.id, false);
        }

        // 複数選択中の各要素のリサイズ開始対象を記録（変位量計算の基準値）
        const selectedShapes = this.getSelectedShapes();
        const selectedOverlays = this.app.getSelectedOverlays?.() || [];

        // リサイズ対象ノードを除いた他の選択中ノードの初期サイズを記録
        this.resizeOtherShapes = selectedShapes
            .filter(s => s.id !== shape.id)
            .map(s => ({
                shape: s,
                startX: s.x, startY: s.y,
                startW: s.width, startH: s.height
            }));

        // 選択中オーバーレイの初期サイズを記録
        this.resizeOverlays = selectedOverlays.map(ov => ({
            overlay: ov,
            startX: ov.x, startY: ov.y,
            startW: ov.width, startH: ov.height
        }));
    }

    /**
     * オーバーレイキャンバスのリサイズを開始します。
     * 複数選択時は選択中の全ノードおよびオーバーレイを同じ変位量で一括リサイズします。
     * 
     * @param {MouseEvent} e
     * @param {string} handlePos
     * @param {Object} overlayCanvas - OverlayCanvasインスタンス
     */
    startOverlayResize(e, handlePos, overlayCanvas) {
        e.stopPropagation();
        e.preventDefault();

        if (!overlayCanvas.isSelected()) {
            overlayCanvas.select(false);
        }

        this.isResizing = true;
        this._isOverlayResizing = true;
        this.resizeTarget = null; // オーバーレイ首リサイズの場合は null
        this._primaryResizeOverlay = overlayCanvas;
        this.resizeHandlePos = handlePos;
        this.resizeStart = { x: e.clientX, y: e.clientY };
        this._primaryOverlayResizeStartBounds = {
            x: overlayCanvas.x, y: overlayCanvas.y,
            width: overlayCanvas.width, height: overlayCanvas.height
        };

        // 複数選択中のノードの初期サイズを記録
        const selectedShapes = this.getSelectedShapes();
        this.resizeOtherShapes = selectedShapes.map(s => ({
            shape: s,
            startX: s.x, startY: s.y,
            startW: s.width, startH: s.height
        }));

        // 返リサイズ対象オーバーレイを除いた他の選択中オーバーレイの初期サイズを記録
        const selectedOverlays = this.app.getSelectedOverlays?.() || [];
        this.resizeOverlays = selectedOverlays
            .filter(ov => ov !== overlayCanvas)
            .map(ov => ({
                overlay: ov,
                startX: ov.x, startY: ov.y,
                startW: ov.width, startH: ov.height
            }));

        if (overlayCanvas.areaElement) {
            overlayCanvas.areaElement.classList.add('resizing');
        }
    }

    /**
     * リサイズを更新します。
     * 複数選択時は選択中の全ノードおよびオーバーレイを同じ変位量で同時リサイズします。
     * 
     * @param {MouseEvent} e - マウスイベント
     */
    updateResize(e) {
        if (!this.isResizing) return;

        const zoomLevel = this.app.zoomPanManager?.getZoom() || 1;
        const dx = (e.clientX - this.resizeStart.x) / zoomLevel;
        const dy = (e.clientY - this.resizeStart.y) / zoomLevel;

        if (this._isOverlayResizing && this._primaryResizeOverlay) {
            // ─── オーバーレイ首リサイズ ───
            const start = this._primaryOverlayResizeStartBounds;
            if (!start) return;

            const updated = calculateResizeBounds({
                startBounds: start,
                dx, dy,
                handlePos: this.resizeHandlePos,
                minWidth: 100,
                minHeight: 50,
            });

            this._primaryResizeOverlay.setBounds(updated);

            const ddx = updated.x - start.x;
            const ddy = updated.y - start.y;
            const dw  = updated.width  - start.width;
            const dh  = updated.height - start.height;

            // 他の選択中ノードに同じ変位量でリサイズ
            for (const item of (this.resizeOtherShapes || [])) {
                const nb = calculateResizeBounds({
                    startBounds: { x: item.startX, y: item.startY, width: item.startW, height: item.startH },
                    dx: ddx + dw, dy: ddy + dh,
                    handlePos: this.resizeHandlePos,
                    minWidth: CONFIG.FLOWCHART.SHAPE.MIN_WIDTH,
                    minHeight: CONFIG.FLOWCHART.SHAPE.MIN_HEIGHT,
                });
                item.shape.x = nb.x; item.shape.y = nb.y;
                item.shape.width = nb.width; item.shape.height = nb.height;
                this.updateShapePosition(item.shape);
                this.updateShapeSize(item.shape);
            }

            // 他の選択中オーバーレイに同じ変位量でリサイズ
            for (const item of (this.resizeOverlays || [])) {
                const nb = calculateResizeBounds({
                    startBounds: { x: item.startX, y: item.startY, width: item.startW, height: item.startH },
                    dx: ddx + dw, dy: ddy + dh,
                    handlePos: this.resizeHandlePos,
                    minWidth: 100,
                    minHeight: 50,
                });
                item.overlay.setBounds(nb);
            }

        } else if (this.resizeTarget) {
            // ─── 通常ノード首リサイズ ───
            const updated = calculateResizeBounds({
                startBounds: this.resizeStartDims,
                dx, dy,
                handlePos: this.resizeHandlePos,
                minWidth: CONFIG.FLOWCHART.SHAPE.MIN_WIDTH,
                minHeight: CONFIG.FLOWCHART.SHAPE.MIN_HEIGHT,
            });

            const ddx = updated.x - this.resizeStartDims.x;
            const ddy = updated.y - this.resizeStartDims.y;
            const dw  = updated.width  - this.resizeStartDims.width;
            const dh  = updated.height - this.resizeStartDims.height;

            this.resizeTarget.x = updated.x;
            this.resizeTarget.y = updated.y;
            this.resizeTarget.width = updated.width;
            this.resizeTarget.height = updated.height;

            this.updateShapePosition(this.resizeTarget);
            this.updateShapeSize(this.resizeTarget);

            // オーバーレイ方式の親ノード自身がリサイズされた場合、overlaySizeも最新サイズに同期
            if (this.resizeTarget.groupMode === 'overlay') {
                this.resizeTarget.overlaySize = {
                    width: this.resizeTarget.width,
                    height: this.resizeTarget.height
                };
            }

            // 親オーバーレイ枠があればサイズ追従更新（ノードが枠外に出た場合は自動拡張）
            if (this.resizeTarget.parent && this.app.groupManager?.overlayStrategy) {
                const overlay = this.app.groupManager.overlayStrategy.openOverlays.get(this.resizeTarget.parent);
                if (overlay) overlay.updateAreaBounds('expand');
            }

            // 他の選択中ノードに同じ変位量でリサイズ
            for (const item of (this.resizeOtherShapes || [])) {
                const nb = calculateResizeBounds({
                    startBounds: { x: item.startX, y: item.startY, width: item.startW, height: item.startH },
                    dx: ddx + dw, dy: ddy + dh,
                    handlePos: this.resizeHandlePos,
                    minWidth: CONFIG.FLOWCHART.SHAPE.MIN_WIDTH,
                    minHeight: CONFIG.FLOWCHART.SHAPE.MIN_HEIGHT,
                });
                item.shape.x = nb.x; item.shape.y = nb.y;
                item.shape.width = nb.width; item.shape.height = nb.height;
                this.updateShapePosition(item.shape);
                this.updateShapeSize(item.shape);
            }

            // 他の選択中オーバーレイに同じ変位量でリサイズ
            for (const item of (this.resizeOverlays || [])) {
                const nb = calculateResizeBounds({
                    startBounds: { x: item.startX, y: item.startY, width: item.startW, height: item.startH },
                    dx: ddx + dw, dy: ddy + dh,
                    handlePos: this.resizeHandlePos,
                    minWidth: 100,
                    minHeight: 50,
                });
                item.overlay.setBounds(nb);
            }
        }

        this.app.drawConnections();
    }

    /**
     * リサイズを終了します。
     */
    endResize() {
        if (this.resizeTarget?.element) {
            this.resizeTarget.element.classList.remove('resizing');
        }
        if (this._primaryResizeOverlay?.areaElement) {
            this._primaryResizeOverlay.areaElement.classList.remove('resizing');
        }
        this.isResizing = false;
        this.resizeTarget = null;
        this.resizeHandlePos = null;
        this._isOverlayResizing = false;
        this._primaryResizeOverlay = null;
        this._primaryOverlayResizeStartBounds = null;
        this.resizeOtherShapes = [];
        this.resizeOverlays = [];
    }

    // =====================================================
    // キーボード移動
    // =====================================================

    /**
     * 現在選択中のシェイプを1つ取得します（互換性用）。
     * @private
     * @returns {Object|null} 選択中のシェイプ、またはnull
     */
    _getSelectedShape() {
        const selected = this.getSelectedShapes();
        return selected[0] || null;
    }

    /**
     * 選択中のシェイプ群をキーボード操作でまとめて移動します。
     * 選択中のオーバーレイキャンバス（内部子ノード含む）も一括移動します。
     * 
     * @param {number} deltaX - X方向の移動量（px）
     * @param {number} deltaY - Y方向の移動量（px）
     */
    moveSelectedByKey(deltaX, deltaY) {
        const selectedShapes = this.getSelectedShapes();
        const selectedOverlays = this.app.getSelectedOverlays?.() || [];
        if (selectedShapes.length === 0 && selectedOverlays.length === 0) return;

        const selectedIds = new Set(selectedShapes.map(s => s.id));
        const overlayParentIds = new Set(selectedOverlays.map(ov => ov.shape.id));

        const isAncestorSelected = (s) => {
            let pId = s.parent;
            while (pId) {
                if (selectedIds.has(pId)) return true;
                const p = this.app.shapes.get(pId);
                pId = p ? p.parent : null;
            }
            return false;
        };

        const isInsideSelectedOverlay = (s) => {
            let pId = s.parent;
            while (pId) {
                if (overlayParentIds.has(pId)) return true;
                const p = this.app.shapes.get(pId);
                pId = p ? p.parent : null;
            }
            return false;
        };

        const rootShapes = selectedShapes.filter(s => !isAncestorSelected(s) && !isInsideSelectedOverlay(s));

        for (const shape of rootShapes) {
            shape.x += deltaX;
            shape.y += deltaY;
            this.updateShapePosition(shape);
            this.app.groupManager?.moveGroupRecursive(shape, deltaX, deltaY);
        }

        // 選択中オーバーレイおよびその内部子ノードも一括移動
        for (const overlay of selectedOverlays) {
            overlay.move(deltaX, deltaY);
            if (overlay.shape.children) {
                overlay.shape.children.forEach(childId => {
                    const child = this.app.shapes.get(childId);
                    if (child) {
                        child.x += deltaX;
                        child.y += deltaY;
                        this.app.groupManager?.updateShapeDOM(child);
                        if (child.children?.length > 0) {
                            this.app.groupManager?._moveChildrenRecursive(child, deltaX, deltaY);
                        }
                        this.app.groupManager?.moveOverlaysRecursive(child, deltaX, deltaY);
                    }
                });
            }
        }

        this.app.drawConnections();
    }


    // =====================================================
    // 状態チェック
    // =====================================================

    /**
     * ドラッグ中かどうかを取得します。
     * 
     * @returns {boolean}
     */
    isDraggingActive() {
        return this.isDragging;
    }

    /**
     * リサイズ中かどうかを取得します。
     * 
     * @returns {boolean}
     */
    isResizingActive() {
        return this.isResizing;
    }
}
