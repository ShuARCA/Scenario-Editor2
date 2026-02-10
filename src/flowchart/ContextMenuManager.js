/**
 * コンテキストメニュー管理
 * 
 * フローチャートの右クリックメニューを担当します。
 * 
 * @module flowchart/ContextMenuManager
 */

import { ColorPicker } from '../ui/ColorPicker.js';

/**
 * コンテキストメニュー管理クラス
 */
export class ContextMenuManager {
    /**
     * ContextMenuManagerのコンストラクタ
     * 
     * @param {Object} flowchartApp - FlowchartAppへの参照
     */
    constructor(flowchartApp) {
        /** @type {Object} FlowchartAppへの参照 */
        this.app = flowchartApp;

        /** @type {string|null} シェイプ編集対象のID */
        this.selectedShapeForContext = null;

        /** @type {string|null} 接続線編集対象のID */
        this.selectedConnectionForContext = null;

        // DOM参照 (setupContextMenuで初期化)
        this.contextMenu = null;
        this.ctxShapeSection = null;
        this.ctxConnectionSection = null;
        this.ctxShapeBg = null;
        this.ctxShapeBorder = null;
        this.ctxShapeText = null;
        this.ctxConnectionStyle = null;
        this.ctxConnectionArrow = null;
        this.ctxConnectionColor = null;
        this.ctxConnectionLabel = null;

        // カラーピッカー関連
        this.activeColorPicker = null;
        this.globalPickerContainer = null;
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * コンテキストメニューをセットアップします。
     */
    setupContextMenu() {
        // DOM要素の取得
        this.contextMenu = document.getElementById('flowchart-context-menu');
        this.ctxShapeSection = document.getElementById('shape-edit-section');
        this.ctxConnectionSection = document.getElementById('connection-edit-section');
        this.ctxShapeBg = document.getElementById('ctx-shape-bg');
        this.ctxShapeBorder = document.getElementById('ctx-shape-border');
        this.ctxShapeText = document.getElementById('ctx-shape-text');
        this.ctxShapeType = document.getElementById('ctx-shape-type');
        this.ctxConnectionStyle = document.getElementById('ctx-connection-style');
        this.ctxConnectionArrow = document.getElementById('ctx-connection-arrow');
        this.ctxConnectionColor = document.getElementById('ctx-connection-color');
        this.ctxConnectionLabel = document.getElementById('ctx-connection-label');

        this.globalPickerContainer = document.getElementById('global-color-picker-container');

        //シェイプメニュー
        const shapemenu = (e) => {
            e.preventDefault();
            const shapeEl = e.target.closest('.shape');
            if (shapeEl) {
                this.selectedShapeForContext = shapeEl.id;
                this.selectedConnectionForContext = null;
                this.app.selectShape(shapeEl.id);
                this.showContextMenu(e.clientX, e.clientY, 'shape');
            }
        };
        // 右クリックイベント（ロック中はブロック）
        this.app.canvas.addEventListener('contextmenu', (e) => {
            if (this.app._locked) {
                e.preventDefault();
                return;
            }
            shapemenu(e);
        });
        // ダブルクリックイベント（ロック中はブロック）
        this.app.canvas.addEventListener('dblclick', (e) => {
            if (this.app._locked) return;
            shapemenu(e);
        });

        // メニュークリック
        this.contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item) {
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            }
        });

        // 外側クリックで閉じる (ピッカーが開いている場合はピッカーの挙動に任せるか、ここで閉じる)
        document.addEventListener('mousedown', (e) => {
            // コンテキストメニュー外かつカラーピッカー外なら閉じる
            const inMenu = this.contextMenu && this.contextMenu.contains(e.target);
            const inPicker = this.globalPickerContainer && this.globalPickerContainer.contains(e.target);
            const inShape = e.target.closest('.shape');

            if (!inMenu && !inPicker && !inShape) {
                this.hideContextMenu(); // これでピッカーも閉じる（hideContextMenu内で処理）
            }
        });

        // シェイプスタイル入力 (スウォッチクリックイベント)
        this._setupShapeStyleInputs();

        // 接続線スタイル入力
        this._setupConnectionStyleInputs();
    }

    // =====================================================
    // 表示/非表示
    // =====================================================

    /**
     * コンテキストメニューを表示します。
     * 
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - 'shape' | 'connection'
     */
    showContextMenu(x, y, type) {
        if (!this.contextMenu) return;

        // ピッカーが開いていたら閉じる
        this._closeColorPicker();

        // セクションの表示切り替え
        if (type === 'shape') {
            this._showShapeSection();
        } else if (type === 'connection') {
            this._showConnectionSection();
        }

        // 画面はみ出し防止のための簡単な調整（必要に応じて実装）

        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.remove('hidden');
    }

    /**
     * コンテキストメニューを非表示にします。
     */
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.add('hidden');
        }
        this._closeColorPicker();
        this.selectedShapeForContext = null;
        this.selectedConnectionForContext = null;
    }

    // =====================================================
    // アクション処理
    // =====================================================

    /**
     * コンテキストメニューのアクションを処理します。
     * 
     * @param {string} action - アクション名
     */
    handleContextMenuAction(action) {
        if (action === 'delete') {
            if (this.selectedShapeForContext) {
                this.app.removeShape(this.selectedShapeForContext);
            } else if (this.selectedConnectionForContext) {
                this.app.removeConnection(this.selectedConnectionForContext);
            }
        }
    }

    /**
     * 接続線の右クリックを処理します。
     * 
     * @param {string} connectionId - 接続線ID
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    showConnectionContextMenu(connectionId, x, y) {
        this.selectedConnectionForContext = connectionId;
        this.selectedShapeForContext = null;
        this.showContextMenu(x, y, 'connection');
    }

    // =====================================================
    // カラーピッカー制御
    // =====================================================

    /**
     * カラーピッカーを表示します。
     * @param {HTMLElement} targetEl - スウォッチ要素
     * @param {string} initialColor - 初期色
     * @param {Function} onChange - 変更時コールバック
     * @private
     */
    _openColorPicker(targetEl, initialColor, onChange) {
        // 既存のピッカーがあれば閉じる
        this._closeColorPicker();

        if (!this.globalPickerContainer) return;

        // 位置計算
        const rect = targetEl.getBoundingClientRect();
        // コンテキストメニューの少し右側に表示するなどの調整
        // シンプルに要素の下や横に
        const top = rect.top + window.scrollY;
        const left = rect.right + 5 + window.scrollX; // 右側に表示

        this.globalPickerContainer.style.top = `${top}px`;
        this.globalPickerContainer.style.left = `${left}px`;
        this.globalPickerContainer.style.display = 'block';

        // ピッカー生成
        this.activeColorPicker = new ColorPicker(this.globalPickerContainer, {
            color: initialColor,
            onChange: (hex) => {
                // スウォッチ自体の色も更新
                targetEl.style.setProperty('--swatch-color', hex);
                targetEl.dataset.color = hex;
                onChange(hex);
            }
        });
    }

    /**
     * カラーピッカーを閉じます。
     * @private
     */
    _closeColorPicker() {
        if (this.globalPickerContainer) {
            this.globalPickerContainer.innerHTML = '';
            this.globalPickerContainer.style.display = 'none';
        }
        this.activeColorPicker = null;
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * シェイプセクションを表示します。
     * 
     * @private
     */
    _showShapeSection() {
        if (this.ctxShapeSection) this.ctxShapeSection.classList.remove('hidden');
        if (this.ctxConnectionSection) this.ctxConnectionSection.classList.add('hidden');

        const shape = this.app.shapes.get(this.selectedShapeForContext);
        if (shape) {
            this._updateSwatch(this.ctxShapeBg, shape.backgroundColor || '#ffffff');
            this._updateSwatch(this.ctxShapeBorder, shape.borderColor || '#cbd5e1');
            this._updateSwatch(this.ctxShapeText, shape.color || '#334155');
            if (this.ctxShapeType) {
                this.ctxShapeType.value = shape.type || 'rounded';
            }
        }
    }

    /**
     * 接続線セクションを表示します。
     * 
     * @private
     */
    _showConnectionSection() {
        if (this.ctxShapeSection) this.ctxShapeSection.classList.add('hidden');
        if (this.ctxConnectionSection) this.ctxConnectionSection.classList.remove('hidden');

        const conn = this.app.connections.find(c => c.id === this.selectedConnectionForContext);
        if (this.ctxConnectionStyle) {
            this.ctxConnectionStyle.value = conn?.style?.type || 'solid';
        }
        if (this.ctxConnectionArrow) {
            this.ctxConnectionArrow.value = conn?.style?.arrow || 'end';
        }
        if (this.ctxConnectionColor) {
            this._updateSwatch(this.ctxConnectionColor, conn?.style?.color || '#94a3b8');
        }
        if (this.ctxConnectionLabel) {
            this.ctxConnectionLabel.value = conn?.style?.label || '';
        }
    }

    /**
     * スウォッチの見た目とデータを更新
     */
    _updateSwatch(el, color) {
        if (!el) return;
        el.style.setProperty('--swatch-color', color);
        el.dataset.color = color;
    }

    /**
     * シェイプスタイル入力をセットアップします。
     * 
     * @private
     */
    _setupShapeStyleInputs() {
        // 背景色
        if (this.ctxShapeBg) {
            this.ctxShapeBg.addEventListener('click', (e) => {
                const currentColor = e.target.dataset.color || '#ffffff';
                this._openColorPicker(e.target, currentColor, (hex) => {
                    this._updateShapeStyle('backgroundColor', hex);
                });
            });
        }

        // 枠線色
        if (this.ctxShapeBorder) {
            this.ctxShapeBorder.addEventListener('click', (e) => {
                const currentColor = e.target.dataset.color || '#cbd5e1';
                this._openColorPicker(e.target, currentColor, (hex) => {
                    this._updateShapeStyle('borderColor', hex);
                });
            });
        }

        // 文字色
        if (this.ctxShapeText) {
            this.ctxShapeText.addEventListener('click', (e) => {
                const currentColor = e.target.dataset.color || '#334155';
                this._openColorPicker(e.target, currentColor, (hex) => {
                    this._updateShapeStyle('color', hex);
                });
            });
        }

        // 形状タイプ
        if (this.ctxShapeType) {
            this.ctxShapeType.addEventListener('change', (e) => {
                this._updateShapeStyle('type', e.target.value);
            });
        }
    }

    /**
     * 接続線スタイル入力をセットアップします。
     * 
     * @private
     */
    _setupConnectionStyleInputs() {
        if (this.ctxConnectionStyle) {
            this.ctxConnectionStyle.addEventListener('change', (e) => {
                this._updateConnectionStyle('type', e.target.value);
            });
        }

        if (this.ctxConnectionArrow) {
            this.ctxConnectionArrow.addEventListener('change', (e) => {
                this._updateConnectionStyle('arrow', e.target.value);
            });
        }

        if (this.ctxConnectionColor) {
            this.ctxConnectionColor.addEventListener('click', (e) => {
                const currentColor = e.target.dataset.color || '#94a3b8';
                this._openColorPicker(e.target, currentColor, (hex) => {
                    this._updateConnectionStyle('color', hex);
                });
            });
        }

        if (this.ctxConnectionLabel) {
            this.ctxConnectionLabel.addEventListener('input', (e) => {
                this._updateConnectionStyle('label', e.target.value);
            });
        }
    }

    /**
     * シェイプスタイルを更新します。
     * 
     * @param {string} prop - プロパティ名
     * @param {string} value - 値
     * @private
     */
    _updateShapeStyle(prop, value) {
        if (!this.selectedShapeForContext) return;

        const shape = this.app.shapes.get(this.selectedShapeForContext);
        if (shape && shape.element) {
            shape[prop] = value;
            // ShapeManagerに更新処理を委譲（CSS変数対応など）
            this.app.updateShapeElement(shape);
        }
    }

    /**
     * 接続線スタイルを更新します。
     * 
     * @param {string} prop - プロパティ名
     * @param {string} value - 値
     * @private
     */
    _updateConnectionStyle(prop, value) {
        if (!this.selectedConnectionForContext) return;

        const conn = this.app.connections.find(c => c.id === this.selectedConnectionForContext);
        if (conn) {
            if (!conn.style) conn.style = {};
            conn.style[prop] = value;
            this.app.drawConnections();
        }
    }
}
