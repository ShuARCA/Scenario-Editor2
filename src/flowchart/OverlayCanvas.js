/**
 * オーバーレイキャンバスエリア
 * 
 * フローチャートキャンバス（#canvas-content）上にオーバーレイエリア枠を展開し、
 * グループの子ノード群の表示・編集・移動を管理します。
 * 
 * 機能:
 * - フローチャートキャンバス上に直接エリアを展開
 * - 背景のぼかしや暗転を行わず、メインキャンバスの表示をクリアに維持
 * - 子ノードは通常のキャンバス座標系で動作するため、移動・リサイズ・右クリックメニュー・接続線が100%動作
 * - ヘッダーバーのドラッグにより子ノード群を一括移動可能
 * - 枠のリサイズハンドルで手動サイズ調整が可能
 * - 子ノードが枠外へ移動した場合に自動でグループ解除
 * - 子ノード移動・リサイズ時に枠が自動拡張（ノードが枠内に収まるよう追従）
 * - 閉じた後もアプリの操作を一切阻害しない完全なライフサイクル管理
 * 
 * @module flowchart/OverlayCanvas
 */

import { CONFIG } from '../core/Config.js';
import { createResizeHandles, calculateResizeBounds } from './ResizeHelper.js';

/** アクティブなオーバーレイのリスト */
const activeOverlays = [];

/** オーバーレイ枠のパディング (px) */
const AREA_PADDING = 20;

/** オーバーレイヘッダーの高さ (px) */
const HEADER_HEIGHT = 34;

/**
 * オーバーレイエリアのz-index基底値。
 * 設計: 迷子深度 d に対し 200 + d*200 を割り当てる。
 * depth=0 -> 200, depth=1 -> 400, depth=2 -> 600...
 * 
 * 子シェイプ z-index = オーバーレイz-index + 100 (300, 500, 700...):
 * 
 * 全体の重なり順序:
 *   親ノード(100) < 親オーバーレイ(200) < 子ノード(300) <
 *   子オーバーレイ(400) < 孫ノード(500) < 孫オーバーレイ(600) ...
 */
const BASE_OVERLAY_ZINDEX = 200;

/**
 * 入れ子オーバーレイ1段ごとのz-indexステップ。
 * 子オーバーレイは親オーバーレイより高いz-indexを持ちます。
 */
const OVERLAY_ZINDEX_STEP = 200;

/**
 * オーバーレイ内の子シェイプに加算するオフセット値。
 * 子シェイプはOverlayCanvasより必ず前面になります。
 */
const OVERLAY_CHILD_ZINDEX_OFFSET = 100;

export class OverlayCanvas {
    /**
     * @param {Object} shape - 親グループのシェイプデータ
     * @param {import('./OverlayGroupStrategy.js').OverlayGroupStrategy} strategy - OverlayGroupStrategy への参照
     */
    constructor(shape, strategy) {
        /** @type {Object} 親グループのシェイプデータ */
        this.shape = shape;

        /** @type {import('./OverlayGroupStrategy.js').OverlayGroupStrategy} */
        this.strategy = strategy;

        /** @type {import('./GroupManager.js').GroupManager} */
        this.groupManager = strategy.groupManager;

        /** @type {Object} FlowchartApp への参照 */
        this.app = this.groupManager.app;

        // DOM要素
        this.areaElement = null;
        this.headerElement = null;

        // ヘッダードラッグ状態
        this.isHeaderDragging = false;
        this.dragStartMouse = { x: 0, y: 0 };
        this.dragStartBounds = null;
        this.initialChildPositions = new Map();

        // 枠リサイズ状態
        this.isAreaResizing = false;
        this.areaResizeHandle = null;
        this.areaResizeStartMouse = { x: 0, y: 0 };
        this.areaResizeStartBounds = null;

        // バインド済みイベントハンドラ
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
        this._onKeyDown = this._handleKeyDown.bind(this);
    }

    // =====================================================
    // 公開API: ライフサイクル
    // =====================================================

    /**
     * オーバーレイエリアをキャンバス上に展開します。
     */
    open() {
        if (this.areaElement) return;

        this._createAreaDOM();
        this._ensureChildPositions();
        this._showChildren();

        // shape.overlayBounds が保存済みであれば復元し、子が枠外に出ていれば拡張
        // 未保存（初回展開）であれば子ノード群からfitで計算
        if (this.shape.overlayBounds) {
            this.setBounds(this.shape.overlayBounds);
            // 子が枠外に出ている場合だけ拡張（手動リサイズ結果を保護）
            this.updateAreaBounds('expand');
        } else {
            this.updateAreaBounds('fit');
        }

        // 親シェイプより前面に表示されるよう z-index を動的設定
        // 入れ子の深さに応じて増加し、孫以降でも正しく重なります
        this._applyZIndex();

        this._setupEvents();

        activeOverlays.push(this);

        // 展開状態を保持
        this.shape.overlayOpen = true;
        delete this.shape._overlayWasOpen;

        // 折りたたみ前に開いていた子孫オーバーレイを自動再展開
        // （親がactiveOverlaysに積まれた後に展開することで、Esc順序が手前の子から正しく積まれる）
        this._restoreDescendantOverlays(this.shape);

        const btn = this.shape.element?.querySelector('.group-overlay-btn');
        if (btn) btn.classList.add('active');

        // 保存済みスタイルがあれば復元
        if (this.shape.overlayStyle) {
            this.applyStyle(this.shape.overlayStyle);
        }

        this.app.drawConnections();
    }

    /**
     * オーバーレイエリアを閉じます。
     * @param {boolean} [isCascading=false] - 親オーバーレイの閉鎖に伴う連動クローズかどうか
     */
    close(isCascading = false) {
        if (!this.areaElement) return;

        // 子孫ノードで開いているオーバーレイをすべて再帰的に閉じる（連動クローズとして伝播）
        this._closeDescendantOverlays(this.shape);

        const btn = this.shape.element?.querySelector('.group-overlay-btn');
        if (btn) btn.classList.remove('active');

        this._hideChildren();

        // 子シェイプのz-indexをリセット（CSSデフォルトに戻す）
        this._resetChildrenZIndex(this.shape);

        // 開閉状態の保持
        if (isCascading) {
            // 親の折りたたみに伴う連動閉鎖の場合、親が再展開された際に自動復元できるよう開いていた状態を記憶
            this.shape._overlayWasOpen = true;
            this.shape.overlayOpen = true;
        } else {
            // ユーザーによる明示的な閉鎖の場合
            this.shape.overlayOpen = false;
            delete this.shape._overlayWasOpen;
        }

        const index = activeOverlays.indexOf(this);
        if (index !== -1) activeOverlays.splice(index, 1);

        this._removeEvents();

        if (this.areaElement) {
            this.areaElement.remove();
            this.areaElement = null;
            this.headerElement = null;
        }

        this.app.drawConnections();
    }


    /**
     * オーバーレイキャンバスのスタイルを適用し、shape.overlayStyle に保存します。
     * ノードの backgroundColor / borderColor / textColor と同様の仕組みで、
     * CSS 変数 --overlay-bg-color / --overlay-border-color / --overlay-text-color を通じて外観を制御します。
     *
     * @param {{ backgroundColor?: string|null, borderColor?: string|null, textColor?: string|null }|null} style
     */
    applyStyle(style) {
        if (!style) return;

        // shape.overlayStyle に保存（統一形式に整形）
        this.shape.overlayStyle = {
            backgroundColor: style.backgroundColor !== undefined ? style.backgroundColor : (this.shape.overlayStyle?.backgroundColor ?? null),
            borderColor: style.borderColor !== undefined ? style.borderColor : (this.shape.overlayStyle?.borderColor ?? null),
            textColor: style.textColor !== undefined ? style.textColor : (style.color !== undefined ? style.color : (this.shape.overlayStyle?.textColor ?? null)),
        };

        if (!this.areaElement) return;

        const { backgroundColor, borderColor, textColor } = this.shape.overlayStyle;
        if (backgroundColor) {
            this.areaElement.style.setProperty('--overlay-bg-color', backgroundColor);
            this.areaElement.style.backgroundColor = backgroundColor;
        } else {
            this.areaElement.style.removeProperty('--overlay-bg-color');
            this.areaElement.style.backgroundColor = '';
        }

        if (borderColor) {
            this.areaElement.style.setProperty('--overlay-border-color', borderColor);
        } else {
            this.areaElement.style.removeProperty('--overlay-border-color');
        }

        const titleEl = this.areaElement.querySelector('.overlay-area-title');
        if (textColor) {
            this.areaElement.style.setProperty('--overlay-text-color', textColor);
            this.areaElement.style.color = textColor;
            if (titleEl) titleEl.style.color = textColor;
        } else {
            this.areaElement.style.removeProperty('--overlay-text-color');
            this.areaElement.style.color = '';
            if (titleEl) titleEl.style.color = '';
        }
    }

    /**
     * オーバーレイ枠を選択状態（アクティブ）にします。
     * ノードの選択仕様に合わせて、アクティブ時にリサイズハンドルが表示されます。
     * 
     * @param {boolean} [addToSelection=false] - 既存の選択を維持して追加選択するかどうか
     */
    select(addToSelection = false) {
        if (!addToSelection) {
            this.app.clearSelection();
        }
        if (this.areaElement) {
            this.areaElement.classList.add('selected');
        }
        this._updateMultiSelectionClass();
    }

    /**
     * オーバーレイ枠の選択状態を解除します。
     */
    deselect() {
        if (this.areaElement) {
            this.areaElement.classList.remove('selected');
        }
        this._updateMultiSelectionClass();
    }

    /**
     * オーバーレイ枠の選択状態をトグル（切り替え）します。
     * @returns {boolean} 切り替え後に選択状態になったかどうか
     */
    toggleSelect() {
        if (!this.areaElement) return false;
        const isSelected = this.areaElement.classList.toggle('selected');
        this._updateMultiSelectionClass();
        return isSelected;
    }

    /**
     * オーバーレイ枠が選択中かどうかを判定します。
     * @returns {boolean}
     */
    isSelected() {
        return !!(this.areaElement?.classList.contains('selected'));
    }

    /**
     * @private
     */
    _updateMultiSelectionClass() {
        this.app.shapeManager?._updateMultiSelectionClass?.();
    }

    // =====================================================
    // 公開API: 枠のサイズ・位置管理（ノード互換アクセサー＆同期）
    // =====================================================

    /** @type {number} 枠のX座標 */
    get x() { return this.shape.overlayBounds?.x ?? 0; }

    /** @type {number} 枠のY座標 */
    get y() { return this.shape.overlayBounds?.y ?? 0; }

    /** @type {number} 枠の幅 */
    get width() { return this.shape.overlayBounds?.width ?? 0; }

    /** @type {number} 枠の高さ */
    get height() { return this.shape.overlayBounds?.height ?? 0; }

    /**
     * オーバーレイ枠の位置とサイズを更新し、DOMおよびshape.overlayBoundsに同期します。
     * 
     * @param {{ x: number, y: number, width: number, height: number }} bounds
     */
    setBounds(bounds) {
        this.shape.overlayBounds = { ...bounds };
        if (this.areaElement) {
            this.areaElement.style.left = `${bounds.x}px`;
            this.areaElement.style.top = `${bounds.y}px`;
            this.areaElement.style.width = `${bounds.width}px`;
            this.areaElement.style.height = `${bounds.height}px`;
        }
    }

    /**
     * オーバーレイ枠を平行移動します。
     * 手動で変更されたサイズ（width, height）を完全に保持し、位置（x, y）のみを更新します。
     * 親ノードやヘッダーのドラッグ移動時に呼び出されます。
     * 
     * @param {number} deltaX - X方向の移動量
     * @param {number} deltaY - Y方向の移動量
     */
    move(deltaX, deltaY) {
        if (!this.areaElement) return;

        this.setBounds({
            x: this.x + deltaX,
            y: this.y + deltaY,
            width: this.width,
            height: this.height
        });
    }

    /**
     * 子ノード群のバウンディングボックスに合わせてオーバーレイ枠の位置とサイズを更新します。
     * 
     * @param {'fit'|'expand'} [mode='fit']
     *   'fit'    - 子ノード全体にぴったり合わせる（デフォルト）
     *   'expand' - 現在の枠よりも子ノードがはみ出している場合のみ拡張
     */
    updateAreaBounds(mode = 'fit') {
        if (!this.areaElement || !this.shape.children || this.shape.children.length === 0) return;

        const box = this.groupManager.getBoundingBox(this.shape.children);
        if (!box) return;

        const fitLeft = box.minX - AREA_PADDING;
        const fitTop = box.minY - HEADER_HEIGHT - AREA_PADDING;
        const fitWidth = box.width + AREA_PADDING * 2;
        const fitHeight = box.height + HEADER_HEIGHT + AREA_PADDING * 2;

        if (mode === 'expand') {
            const curLeft = this.x || fitLeft;
            const curTop = this.y || fitTop;
            const curWidth = this.width || fitWidth;
            const curHeight = this.height || fitHeight;

            const newLeft = Math.min(curLeft, fitLeft);
            const newTop = Math.min(curTop, fitTop);
            const newRight = Math.max(curLeft + curWidth, fitLeft + fitWidth);
            const newBottom = Math.max(curTop + curHeight, fitTop + fitHeight);

            this.setBounds({
                x: newLeft,
                y: newTop,
                width: newRight - newLeft,
                height: newBottom - newTop
            });
        } else {
            this.setBounds({
                x: fitLeft,
                y: fitTop,
                width: fitWidth,
                height: fitHeight
            });
        }
    }

    /**
     * オーバーレイ枠のコンテンツ領域（ヘッダーを除く）を
     * シェイプ風オブジェクト { x, y, width, height } として返します。
     * 
     * GroupManager.checkCollision() でオーバーレイ枠を疑似的な親ノードとして
     * 衝突判定するために使用します。
     * 
     * @returns {{ x: number, y: number, width: number, height: number }|null}
     */
    getBoundsAsShape() {
        const b = this.shape.overlayBounds;
        if (!b) return null;
        return {
            x: b.x,
            y: b.y + HEADER_HEIGHT,
            width: b.width,
            height: b.height - HEADER_HEIGHT,
        };
    }


    // =====================================================
    // DOM構築
    // =====================================================

    /**
     * エリア枠のDOM要素を生成し、#canvas-content に配置します。
     * @private
     */
    _createAreaDOM() {
        const canvasContent = this.app.canvasContent || document.getElementById('canvas-content');
        if (!canvasContent) return;

        this.areaElement = document.createElement('div');
        this.areaElement.className = 'overlay-group-area';
        this.areaElement.id = `overlay-area-${this.shape.id}`;

        // ヘッダーバー
        this.headerElement = document.createElement('div');
        this.headerElement.className = 'overlay-area-header';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'overlay-area-title-group';

        const icon = document.createElement('span');
        icon.className = 'overlay-area-icon';
        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="var(--primary-color)"><path d="M800-360v-200q0-50-35-85t-85-35H240v-120q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v360q0 33-23.5 56.5T800-360ZM160-80q-33 0-56.5-23.5T80-160v-360q0-33 23.5-56.5T160-600h480q33 0 56.5 23.5T720-520v360q0 33-23.5 56.5T640-80H160Z"/></svg>';

        const title = document.createElement('span');
        title.className = 'overlay-area-title';
        title.textContent = this.shape.text || 'グループエリア';

        titleGroup.appendChild(icon);
        titleGroup.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'overlay-area-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = '閉じる (Esc)';
        closeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });

        this.headerElement.appendChild(titleGroup);
        this.headerElement.appendChild(closeBtn);
        this.areaElement.appendChild(this.headerElement);

        // ヘッダードラッグ
        this.headerElement.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target === closeBtn) return;
            const isCtrl = e.ctrlKey || e.metaKey;
            this._startHeaderDrag(e, isCtrl);
        });

        // リサイズハンドル
        this._createResizeHandles();

        // 接続ポイントの追加
        ['top', 'bottom', 'left', 'right'].forEach(pos => {
            const pt = document.createElement('div');
            pt.className = `connection-point ${pos}`;
            pt.dataset.pos = pos;
            this.areaElement.appendChild(pt);
        });

        // 右クリック / ダブルクリックでスタイル編集メニューを表示
        // ヘッダーは pointer-events: auto なのでイベントを受け取れる
        const openStyleMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.app.shapeManager?._clearSingleSelectTimer?.();
            if (!this.isSelected()) {
                this.select(false);
            }
            this.app.contextMenuManager?.showOverlayContextMenu(this, e.clientX, e.clientY);
        };
        this.headerElement.addEventListener('contextmenu', openStyleMenu);
        this.headerElement.addEventListener('dblclick', openStyleMenu);

        canvasContent.appendChild(this.areaElement);
    }

    /**
     * 枠のリサイズハンドルを生成します。
     * @private
     */
    _createResizeHandles() {
        createResizeHandles(this.areaElement, (e, pos) => {
            e.stopPropagation();
            e.preventDefault();
            this._startAreaResize(e, pos);
        });
    }

    // =====================================================
    // 子ノード管理
    // =====================================================

    /**
     * 子ノードの位置を確認し、初回展開時に適切な初期位置を設定します。
     * 親ノードの右側として被らない位置にオーバーレイキャンバスおよび子ノード群を配置します。
     * @private
     */
    _ensureChildPositions() {
        if (!this.shape.children || this.shape.children.length === 0) return;

        // 既に手動配置（overlayBounds保存済み）されている場合は既存配置を尊重
        if (this.shape.overlayBounds) return;

        const children = this.shape.children
            .map(id => this.groupManager.shapes.get(id))
            .filter(Boolean);
        if (children.length === 0) return;

        // 親ノードの位置とサイズ
        const parentX = this.shape.x;
        const parentY = this.shape.y;
        const parentWidth = this.shape.width || (CONFIG.FLOWCHART.SHAPE?.WIDTH || 120);
        const parentRight = parentX + parentWidth;

        // 親ノードの右側に空ける隙間 (px)
        const GAP = 10;

        // オーバーレイ枠が配置されるべき目標X座標および初期Y座標
        const targetOverlayLeft = parentRight + GAP;
        const targetOverlayTop = parentY;

        // 子ノード群のコンテンツ開始座標（オーバーレイ枠内の左上パディング後）
        const contentStartX = targetOverlayLeft + AREA_PADDING;
        const contentStartY = targetOverlayTop + HEADER_HEIGHT + AREA_PADDING;

        // 子ノード群の現在のバウンディングボックス
        const box = this.groupManager.getBoundingBox(this.shape.children);
        if (!box) return;

        const currentOverlayLeft = box.minX - AREA_PADDING;
        const currentOverlayTop = box.minY - HEADER_HEIGHT - AREA_PADDING;

        // 子ノード同士が重なり合っているかチェック（親ノードの上に重ねてドロップされた場合など）
        let areChildrenOverlapping = false;
        for (let i = 0; i < children.length; i++) {
            for (let j = i + 1; j < children.length; j++) {
                if (Math.abs(children[i].x - children[j].x) < 20 && Math.abs(children[i].y - children[j].y) < 20) {
                    areChildrenOverlapping = true;
                    break;
                }
            }
            if (areChildrenOverlapping) break;
        }

        // オーバーレイ枠が親ノードの右側に十分離れていない（被る、または左側にある）場合
        const isTooCloseOrLeft = currentOverlayLeft < targetOverlayLeft;

        if (areChildrenOverlapping) {
            // 重なり合っている場合は親ノード右側に縦一列で整列
            let currentY = contentStartY;
            const gapY = 20;

            children.forEach(child => {
                const dx = contentStartX - child.x;
                const dy = currentY - child.y;
                child.x = contentStartX;
                child.y = currentY;
                this.groupManager.updateShapeDOM(child);
                if (child.children && child.children.length > 0) {
                    this.groupManager.moveGroupRecursive(child, dx, dy);
                }
                currentY += (child.height || CONFIG.FLOWCHART.SHAPE?.HEIGHT || 36) + gapY;
            });
        } else if (isTooCloseOrLeft) {
            // 子ノード同士の相対位置関係を保ったまま、親ノード右側の被らない位置へ平行移動
            const shiftX = targetOverlayLeft - currentOverlayLeft;
            const shiftY = targetOverlayTop - currentOverlayTop;

            children.forEach(child => {
                child.x += shiftX;
                child.y += shiftY;
                this.groupManager.updateShapeDOM(child);
                if (child.children && child.children.length > 0) {
                    this.groupManager.moveGroupRecursive(child, shiftX, shiftY);
                }
            });
        }
    }

    /**
     * 子ノード群を表示します。
     * 直接の子ノードを表示し、インライングループ（常時展開）の子孫も再帰的に表示します。
     * オーバーレイグループの子については、開閉状態に合わせてボタン表示を同期します。
     * @private
     */
    _showChildren() {
        if (!this.shape.children) return;
        this.shape.children.forEach(childId => {
            const child = this.groupManager.shapes.get(childId);
            if (!child?.element) return;
            child.element.style.display = 'flex';

            if (child.children?.length > 0) {
                if (child.groupMode === 'overlay') {
                    const btn = child.element.querySelector('.group-overlay-btn');
                    if (btn) {
                        btn.classList.toggle('active', this.groupManager.overlayStrategy.isOverlayOpen(childId));
                    }
                } else {
                    // inlineグループの子孫は常時展開のため再帰的に表示
                    this._showInlineDescendants(child);
                }
            }
        });
    }

    /**
     * インライングループ配下の子孫ノードを再帰的に表示します。
     * （途中でoverlayグループがある場合はそのoverlayの開閉状態に従う）
     * @param {Object} shape
     * @private
     */
    _showInlineDescendants(shape) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.groupManager.shapes.get(childId);
            if (!child?.element) return;
            child.element.style.display = 'flex';

            if (child.children?.length > 0) {
                if (child.groupMode === 'overlay') {
                    const btn = child.element.querySelector('.group-overlay-btn');
                    if (btn) {
                        btn.classList.toggle('active', this.groupManager.overlayStrategy.isOverlayOpen(childId));
                    }
                    if (this.groupManager.overlayStrategy.isOverlayOpen(childId)) {
                        this._showInlineDescendants(child);
                    }
                } else {
                    this._showInlineDescendants(child);
                }
            }
        });
    }

    /**
     * 子孫ノードで開いているオーバーレイをすべて再帰的に閉じます。
     * 自身のオーバーレイは閉じません（close() のフロー上、呼び出し元が管理）。
     * @param {Object} shape - 探索起点のシェイプ
     * @private
     */
    _closeDescendantOverlays(shape) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.groupManager.shapes.get(childId);
            if (!child) return;
            // 子自身のオーバーレイが開いていれば閉じる前にフラグをセット（再展開時に状態を復元するため）
            if (this.groupManager.overlayStrategy?.isOverlayOpen(childId)) {
                this.groupManager.overlayStrategy.closeOverlay(child, true); // 連動クローズ
            } else if (child.children?.length > 0) {
                // オーバーレイが開いていない子でもさらに孫がいれば再帰探索
                this._closeDescendantOverlays(child);
            }
        });
    }

    /**
     * 子ノード群を再帰的に非表示にします。
     * 子が入れ子グループを持つ場合も孫以降すべて非表示にします。
     * @private
     */
    _hideChildren() {
        this._hideDescendants(this.shape);
    }

    /**
     * 指定シェイプの子孫ノードをすべて非表示にします。
     * @param {Object} shape - 探索起点のシェイプ
     * @private
     */
    _hideDescendants(shape) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.groupManager.shapes.get(childId);
            if (!child?.element) return;
            child.element.style.display = 'none';
            // 孫以降も再帰的に非表示
            if (child.children?.length > 0) {
                this._hideDescendants(child);
            }
        });
    }

    /**
     * 記憶された展開状態（_overlayWasOpen）を元に子孫のオーバーレイを再展開します。
     * open() 後に呼び出すことで、展開→折りたたみ→再展開時の子孫ノードの状態を保持します。
     * @param {Object} shape - 探索起点のシェイプ
     * @private
     */
    _restoreDescendantOverlays(shape) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.groupManager.shapes.get(childId);
            if (!child) return;
            if (child._overlayWasOpen || child.overlayOpen) {
                delete child._overlayWasOpen;
                // openOverlay 内部で再帰的に _restoreDescendantOverlays が呼ばれる
                this.groupManager.overlayStrategy?.openOverlay(child);
            } else if (child.children?.length > 0) {
                // 子自身がoverlayでなくても、インラインの子配下に開いていたoverlayがあれば再帰探索
                this._restoreDescendantOverlays(child);
            }
        });
    }

    // =====================================================
    // z-index 管理
    // =====================================================

    /**
     * オーバーレイエリアのz-indexを、親シェイプより前面に来るよう動的に設定します。
     * 入れ子の深さ（何層目のオーバーレイか）に応じてz-indexを増加させ、
     * 孫グループのオーバーレイも正しく前面に重なります。
     * @private
     */
    _applyZIndex() {
        if (!this.areaElement) return;
        const depth = this._getOverlayDepth();
        const overlayZ = BASE_OVERLAY_ZINDEX + depth * OVERLAY_ZINDEX_STEP;
        this.areaElement.style.zIndex = overlayZ;

        // オーバーレイ内の子シェイプをオーバーレイより前面に設定
        // 子シェイプz-index = overlayZ + OFFSET (200 + d*200 + 100 = 300, 500, 700...)
        this._setChildrenZIndex(this.shape, overlayZ + OVERLAY_CHILD_ZINDEX_OFFSET);
    }

    /**
     * このオーバーレイの入れ子深さを計算します。
     * 祖先シェイプを遡り、現在開いているオーバーレイの数をカウントします。
     * （自身は含まない）
     * 
     * 例:
     *   - トップレベルグループのオーバーレイ → depth 0 → z-index = BASE
     *   - 子グループのオーバーレイ（親が開いている） → depth 1 → z-index = BASE + STEP
     *   - 孫グループのオーバーレイ → depth 2 → z-index = BASE + 2*STEP
     * 
     * @returns {number} 入れ子深さ（0始まり）
     * @private
     */
    _getOverlayDepth() {
        let depth = 0;
        let pid = this.shape.parent;
        while (pid) {
            const pShape = this.groupManager.shapes.get(pid);
            if (!pShape) break;
            if (pShape.groupMode === 'overlay' &&
                this.groupManager.overlayStrategy?.isOverlayOpen(pid)) {
                depth++;
            }
            pid = pShape.parent;
        }
        return depth;
    }

    /**
     * オーバーレイ内の子シェイプのz-indexを指定値に設定します。
     * インライングループ配下の子孫も再帰的に扱います。
     * オーバーレイグループの子については、そのオーバーレイが開かれた際に再度設定されるため、
     * オーバーレイモードの直接の子のみ扱います。
     * @param {Object} shape - 起点シェイプ
     * @param {number} zIndex - 設定するz-index値
     * @private
     */
    _setChildrenZIndex(shape, zIndex) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.groupManager.shapes.get(childId);
            if (!child) return;
            if (child.element) {
                child.element.style.zIndex = zIndex;
            }
            // インライングループの子孫は常時展開なので同じz-indexを再帰設定
            // （オーバーレイグループの子はそのオーバーレイ_applyZIndexで再設定される）
            if (child.groupMode !== 'overlay' && child.children?.length > 0) {
                this._setChildrenZIndex(child, zIndex);
            }
        });
    }

    /**
     * オーバーレイ内の子シェイプのz-indexをリセットします。
     * オーバーレイを閉じる際に呼び出し、CSSデフォルト（updateAllZIndexesによる値）に戻します。
     * @param {Object} shape - 起点シェイプ
     * @private
     */
    _resetChildrenZIndex(shape) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.groupManager.shapes.get(childId);
            if (!child) return;
            if (child.element) {
                // インラインスタイルをクリアすることで CSS から継承されるz-indexに戻る
                child.element.style.zIndex = '';
            }
            if (child.children?.length > 0) {
                this._resetChildrenZIndex(child);
            }
        });
    }

    // =====================================================
    // ヘッダードラッグ（子ノード群一括移動）
    // =====================================================

    /**
     * ヘッダーのドラッグ移動を開始します。
     * @param {MouseEvent} e
     * @param {boolean} [isCtrl=false]
     * @private
     */
    _startHeaderDrag(e, isCtrl = false) {
        if (this.app.shapeManager?.startOverlayDrag) {
            this.app.shapeManager.startOverlayDrag(e, this, isCtrl);
            return;
        }

        this.select();
        this.isHeaderDragging = true;
        this.dragStartMouse = { x: e.clientX, y: e.clientY };

        // ドラッグ開始時の枠の位置とサイズを保存（手動リサイズされたサイズを維持）
        this.dragStartBounds = {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };

        this.initialChildPositions.clear();
        if (this.shape.children) {
            this.shape.children.forEach(childId => {
                const child = this.groupManager.shapes.get(childId);
                if (child) {
                    this.initialChildPositions.set(childId, { x: child.x, y: child.y });
                }
            });
        }

        e.preventDefault();
        e.stopPropagation();
    }

    // =====================================================
    // 枠のリサイズ
    // =====================================================

    /**
     * 枠のリサイズを開始します。
     * @param {MouseEvent} e
     * @param {string} handlePos - 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
     * @private
     */
    _startAreaResize(e, handlePos) {
        if (this.app.shapeManager?.startOverlayResize) {
            this.app.shapeManager.startOverlayResize(e, handlePos, this);
            return;
        }

        this.select();
        this.isAreaResizing = true;
        this.areaResizeHandle = handlePos;
        this.areaResizeStartMouse = { x: e.clientX, y: e.clientY };
        this.areaResizeStartBounds = {
            x: parseFloat(this.areaElement.style.left) || 0,
            y: parseFloat(this.areaElement.style.top) || 0,
            width: parseFloat(this.areaElement.style.width) || 100,
            height: parseFloat(this.areaElement.style.height) || 100,
        };
        this.areaElement.classList.add('resizing');
    }

    /**
     * 枠のリサイズを更新します。
     * @param {MouseEvent} e
     * @private
     */
    _updateAreaResize(e) {
        if (!this.isAreaResizing || !this.areaResizeStartBounds) return;

        const zoomLevel = this.app.zoomPanManager?.getZoom() || 1;
        const dx = (e.clientX - this.areaResizeStartMouse.x) / zoomLevel;
        const dy = (e.clientY - this.areaResizeStartMouse.y) / zoomLevel;

        const updated = calculateResizeBounds({
            startBounds: this.areaResizeStartBounds,
            dx,
            dy,
            handlePos: this.areaResizeHandle,
            minWidth: 100,
            minHeight: HEADER_HEIGHT + 40,
        });

        this.setBounds(updated);
    }

    // =====================================================
    // イベントハンドラ
    // =====================================================

    /**
     * マウスムーブイベント（ヘッダードラッグ中 / 枠リサイズ中）
     * @private
     */
    _handleMouseMove(e) {
        if (this.isHeaderDragging) {
            const zoomLevel = this.app.zoomPanManager?.getZoom() || 1;
            const dx = (e.clientX - this.dragStartMouse.x) / zoomLevel;
            const dy = (e.clientY - this.dragStartMouse.y) / zoomLevel;

            // 1. 枠自身の平行移動（手動リサイズされたサイズを完全に維持）
            if (this.dragStartBounds) {
                this.setBounds({
                    x: this.dragStartBounds.x + dx,
                    y: this.dragStartBounds.y + dy,
                    width: this.dragStartBounds.width,
                    height: this.dragStartBounds.height
                });
            }

            // 2. 子ノード群の平行移動
            this.initialChildPositions.forEach((pos, childId) => {
                const child = this.groupManager.shapes.get(childId);
                if (child) {
                    const nextX = pos.x + dx;
                    const nextY = pos.y + dy;
                    const childDeltaX = nextX - child.x;
                    const childDeltaY = nextY - child.y;

                    child.x = nextX;
                    child.y = nextY;
                    this.groupManager.updateShapeDOM(child);

                    // 子自身が子グループを持つ場合、子孫ノード群およびオーバーレイ枠も再帰平行移動（サイズ維持）
                    if (child.children && child.children.length > 0) {
                        this.groupManager._moveChildrenRecursive(child, childDeltaX, childDeltaY);
                        this.groupManager.moveOverlaysRecursive(child, childDeltaX, childDeltaY);
                    }
                }
            });

            this.app.drawConnections();
        }

        if (this.isAreaResizing) {
            this._updateAreaResize(e);
            this.app.drawConnections();
        }
    }

    /**
     * マウスアップイベント
     * @private
     */
    _handleMouseUp() {
        if (this.isHeaderDragging) {
            this.isHeaderDragging = false;
            this.dragStartBounds = null;
            this.initialChildPositions.clear();
            this.app.updateCanvasSize();
        }

        if (this.isAreaResizing) {
            this.isAreaResizing = false;
            this.areaResizeHandle = null;
            this.areaResizeStartBounds = null;
            if (this.areaElement) {
                this.areaElement.classList.remove('resizing');
            }
            this.app.drawConnections();
        }
    }

    /**
     * キーダウンイベント（Escキーで閉じる）
     * @private
     */
    _handleKeyDown(e) {
        if (e.key === 'Escape') {
            if (activeOverlays[activeOverlays.length - 1] === this) {
                this.close();
            }
        }
    }

    // =====================================================
    // イベント登録・解除
    // =====================================================

    /**
     * イベントリスナーを設定します。
     * @private
     */
    _setupEvents() {
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('keydown', this._onKeyDown);
    }

    /**
     * イベントリスナーを解除します。
     * @private
     */
    _removeEvents() {
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('keydown', this._onKeyDown);
    }
}
