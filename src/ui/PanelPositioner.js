/**
 * パネル位置計算ユーティリティ
 * 
 * 各種パネル（ルビ、コメント、リンク、ポップアップなど）の
 * 表示位置を計算するための共通ロジックを提供します。
 * 
 * @module ui/PanelPositioner
 */

/**
 * パネル位置計算クラス
 * 画面内に収まるよう位置を調整します。
 */
export class PanelPositioner {
    /**
     * PanelPositionerのコンストラクタ
     * 
     * @param {HTMLElement} [containerElement=document.body] - 基準となるコンテナ要素
     */
    constructor(containerElement = document.body) {
        /** @type {HTMLElement} 基準コンテナ */
        this.container = containerElement;

        /** @type {number} デフォルトのY方向オフセット */
        this.defaultOffsetY = 8;

        /** @type {number} 画面端からのマージン */
        this.edgeMargin = 10;
    }

    // =====================================================
    // 公開メソッド
    // =====================================================

    /**
     * 選択範囲に基づいてパネル位置を計算します。
     * 
     * @param {Object} [options={}] - オプション
     * @param {number} [options.offsetY] - Y方向のオフセット
     * @param {number} [options.panelWidth] - パネルの幅（画面端調整用）
     * @param {number} [options.panelHeight] - パネルの高さ（画面端調整用）
     * @returns {{top: number, left: number}|null} 位置、または選択がない場合null
     */
    calculateFromSelection(options = {}) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // 選択範囲が非表示の場合
        if (rect.width === 0 && rect.height === 0) {
            return null;
        }

        const position = {
            top: rect.bottom + (options.offsetY ?? this.defaultOffsetY),
            left: rect.left
        };

        return this._adjustToViewport(position, options);
    }

    /**
     * アンカー要素に基づいてパネル位置を計算します。
     * 
     * @param {HTMLElement} anchorElement - 基準となる要素
     * @param {Object} [options={}] - オプション
     * @param {number} [options.offsetX] - X方向のオフセット
     * @param {number} [options.offsetY] - Y方向のオフセット
     * @param {number} [options.panelWidth] - パネルの幅
     * @param {number} [options.panelHeight] - パネルの高さ
     * @returns {{top: number, left: number}|null} 位置、または要素がない場合null
     */
    calculateFromAnchor(anchorElement, options = {}) {
        if (!anchorElement) return null;

        const rect = anchorElement.getBoundingClientRect();

        const position = {
            top: rect.bottom + (options.offsetY ?? this.defaultOffsetY),
            left: rect.left + (options.offsetX ?? 0)
        };

        return this._adjustToViewport(position, options);
    }

    /**
     * ボタン要素の下にパネルを表示する位置を計算します。
     * 
     * @param {HTMLElement} buttonElement - ボタン要素
     * @param {Object} [options={}] - オプション
     * @returns {{top: number, left: number}|null} 位置
     */
    calculateBelowButton(buttonElement, options = {}) {
        return this.calculateFromAnchor(buttonElement, {
            ...options,
            offsetY: options.offsetY ?? 4
        });
    }

    /**
     * マウスカーソル位置にパネルを表示する位置を計算します。
     * 
     * @param {MouseEvent} event - マウスイベント
     * @param {Object} [options={}] - オプション
     * @returns {{top: number, left: number}} 位置
     */
    calculateFromMouseEvent(event, options = {}) {
        const position = {
            top: event.clientY + (options.offsetY ?? this.defaultOffsetY),
            left: event.clientX + (options.offsetX ?? 0)
        };

        return this._adjustToViewport(position, options);
    }

    /**
     * エディタ内の要素に対してパネル位置を計算します（スクロール考慮）。
     * 
     * @param {HTMLElement} targetElement - 対象要素
     * @param {HTMLElement} editorContainer - エディタコンテナ
     * @param {Object} [options={}] - オプション
     * @returns {{top: number, left: number}|null} 位置
     */
    calculateInEditor(targetElement, editorContainer, options = {}) {
        if (!targetElement || !editorContainer) return null;

        const targetRect = targetElement.getBoundingClientRect();
        const containerRect = editorContainer.getBoundingClientRect();

        // エディタ内の相対位置を計算
        const position = {
            top: targetRect.bottom - containerRect.top + editorContainer.scrollTop + (options.offsetY ?? this.defaultOffsetY),
            left: targetRect.left - containerRect.left + (options.offsetX ?? 0)
        };

        return position;
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * 位置をビューポート内に収まるよう調整します。
     * 
     * @param {{top: number, left: number}} position - 元の位置
     * @param {Object} options - オプション
     * @returns {{top: number, left: number}} 調整後の位置
     * @private
     */
    _adjustToViewport(position, options = {}) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const panelWidth = options.panelWidth ?? 200;
        const panelHeight = options.panelHeight ?? 100;

        let { top, left } = position;

        // 右端からはみ出す場合は左に調整
        if (left + panelWidth > viewportWidth - this.edgeMargin) {
            left = viewportWidth - panelWidth - this.edgeMargin;
        }

        // 左端からはみ出す場合は右に調整
        if (left < this.edgeMargin) {
            left = this.edgeMargin;
        }

        // 下端からはみ出す場合は上に表示
        if (top + panelHeight > viewportHeight - this.edgeMargin) {
            // 選択範囲の上に表示
            const selectionTop = options._selectionTop ?? position.top - this.defaultOffsetY - panelHeight;
            top = Math.max(this.edgeMargin, selectionTop - panelHeight - this.defaultOffsetY);
        }

        return { top, left };
    }

    /**
     * コンテナ要素を設定します。
     * 
     * @param {HTMLElement} container - 新しいコンテナ要素
     */
    setContainer(container) {
        this.container = container;
    }
}

// =====================================================
// シングルトンインスタンス
// =====================================================

/** @type {PanelPositioner|null} デフォルトインスタンス */
let defaultInstance = null;

/**
 * デフォルトのPanelPositionerインスタンスを取得します。
 * 
 * @returns {PanelPositioner} デフォルトインスタンス
 */
export function getDefaultPositioner() {
    if (!defaultInstance) {
        defaultInstance = new PanelPositioner();
    }
    return defaultInstance;
}
