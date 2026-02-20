/**
 * シェイプ管理
 * 
 * フローチャートのシェイプ（ノード）の作成、更新、削除、選択を担当します。
 * 
 * @module flowchart/ShapeManager
 */

import { generateId } from '../utils/helpers.js';
import { CONFIG } from '../core/Config.js';

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
        ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.pos = pos;
            el.appendChild(handle);
        });

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
        const id = generateId();
        const shape = {
            id: id,
            text: options.text || '新規ノード',
            type: options.type || 'rounded',
            x: options.x ?? CONFIG.FLOWCHART.LAYOUT.START_X,
            y: options.y ?? CONFIG.FLOWCHART.LAYOUT.START_Y,
            width: options.width ?? CONFIG.FLOWCHART.SHAPE.WIDTH,
            height: options.height ?? CONFIG.FLOWCHART.SHAPE.HEIGHT,
            headingId: options.headingId || null,
            headingIndex: options.headingIndex ?? undefined,
            children: []
        };

        this.app.shapes.set(id, shape);
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
     */
    selectShape(id) {
        this.clearSelection();
        const shape = this.app.shapes.get(id);
        if (!shape?.element) return;

        shape.element.classList.add('selected');
    }

    /**
     * 選択を解除します。
     */
    clearSelection() {
        this.app.shapes.forEach(s => {
            if (s.element) s.element.classList.remove('selected');
        });
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
     */
    startDrag(e, shapeEl) {
        this.isDragging = true;
        this.dragTarget = shapeEl;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        this.hasMoved = false;

        const shape = this.app.shapes.get(shapeEl.id);
        if (!shape) {
            console.warn(`Shape data not found for id: ${shapeEl.id}`);
            return;
        }
        const canvasRect = this.app.canvas.getBoundingClientRect();
        const zoomLevel = this.app.zoomPanManager?.getZoom() || 1;

        const mouseX = (e.clientX - canvasRect.left + this.app.canvas.scrollLeft) / zoomLevel;
        const mouseY = (e.clientY - canvasRect.top + this.app.canvas.scrollTop) / zoomLevel;

        this.dragOffset = {
            x: mouseX - shape.x,
            y: mouseY - shape.y
        };

        this.selectShape(shapeEl.id);
    }

    /**
     * ドラッグを更新します。
     * 
     * @param {MouseEvent} e - マウスイベント
     */
    updateDrag(e) {
        if (!this.isDragging || !this.dragTarget) return;

        // 移動判定
        const dx = Math.abs(e.clientX - this.dragStartPos.x);
        const dy = Math.abs(e.clientY - this.dragStartPos.y);
        if (dx > 3 || dy > 3) this.hasMoved = true;

        if (!this.hasMoved) return;

        const shape = this.app.shapes.get(this.dragTarget.id);
        if (!shape) return;

        const canvasRect = this.app.canvas.getBoundingClientRect();
        const zoomLevel = this.app.zoomPanManager?.getZoom() || 1;

        const mouseX = (e.clientX - canvasRect.left + this.app.canvas.scrollLeft) / zoomLevel;
        const mouseY = (e.clientY - canvasRect.top + this.app.canvas.scrollTop) / zoomLevel;

        const newX = Math.max(0, mouseX - this.dragOffset.x);
        const newY = Math.max(0, mouseY - this.dragOffset.y);

        // 親ノードの移動量を計算
        const deltaX = newX - shape.x;
        const deltaY = newY - shape.y;

        // 親ノードの位置を更新
        shape.x = newX;
        shape.y = newY;
        this.updateShapePosition(shape);

        // 子ノードも追従させる
        if (shape.children && shape.children.length > 0) {
            this.moveChildrenRecursive(shape, deltaX, deltaY);
        }

        this.app.drawConnections();
    }

    /**
     * 子ノードを再帰的に移動します。
     * 
     * @param {Object} parentShape - 親シェイプ
     * @param {number} deltaX - X方向の移動量
     * @param {number} deltaY - Y方向の移動量
     */
    moveChildrenRecursive(parentShape, deltaX, deltaY) {
        if (!parentShape.children) return;

        parentShape.children.forEach(childId => {
            const child = this.app.shapes.get(childId);
            if (child) {
                child.x += deltaX;
                child.y += deltaY;
                this.updateShapePosition(child);

                // 孫ノードも再帰的に移動
                if (child.children && child.children.length > 0) {
                    this.moveChildrenRecursive(child, deltaX, deltaY);
                }
            }
        });
    }

    /**
     * ドラッグを終了します。
     */
    endDrag() {
        if (this.isDragging && this.dragTarget) {
            const shape = this.app.shapes.get(this.dragTarget.id);

            if (!this.hasMoved) {
                // クリックとして処理
                if (shape?.headingId && this.app.editorManager) {
                    this.app.editorManager.scrollToHeading(shape.headingId);
                }
            } else if (shape && this.app.groupManager) {
                // ドロップ時のグループ化判定
                this.app.groupManager.handleDrop(shape);
            }
        }

        this.isDragging = false;
        this.dragTarget = null;
        this.hasMoved = false;
    }

    // =====================================================
    // リサイズ操作
    // =====================================================

    /**
     * リサイズを開始します。
     * 
     * @param {MouseEvent} e - マウスイベント
     * @param {HTMLElement} handle - リサイズハンドル
     */
    startResize(e, handle) {
        e.stopPropagation();
        const shapeEl = handle.closest('.shape');
        if (!shapeEl) return;

        this.isResizing = true;
        const shape = this.app.shapes.get(shapeEl.id);
        if (!shape) {
            console.warn(`Shape data not found for id: ${shapeEl.id}`);
            return;
        }
        this.resizeTarget = shape;
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

    /**
     * リサイズを更新します。
     * 
     * @param {MouseEvent} e - マウスイベント
     */
    updateResize(e) {
        if (!this.isResizing || !this.resizeTarget) return;

        const zoomLevel = this.app.zoomPanManager?.getZoom() || 1;
        const dx = (e.clientX - this.resizeStart.x) / zoomLevel;
        const dy = (e.clientY - this.resizeStart.y) / zoomLevel;
        const dims = this.resizeStartDims;
        const minW = CONFIG.FLOWCHART.SHAPE.MIN_WIDTH;
        const minH = CONFIG.FLOWCHART.SHAPE.MIN_HEIGHT;

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

        this.updateShapePosition(this.resizeTarget);
        this.updateShapeSize(this.resizeTarget);
        this.app.drawConnections();
    }

    /**
     * リサイズを終了します。
     */
    endResize() {
        if (this.resizeTarget?.element) {
            this.resizeTarget.element.classList.remove('resizing');
        }
        this.isResizing = false;
        this.resizeTarget = null;
        this.resizeHandlePos = null;
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
