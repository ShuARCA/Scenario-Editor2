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

        /** @type {import('../flowchart/OverlayCanvas.js').OverlayCanvas|null} オーバーレイ編集対象 */
        this.selectedOverlayForContext = null;

        // DOM参照 (setupContextMenuで初期化)
        this.contextMenu = null;
        this.ctxShapeSection = null;
        this.ctxConnectionSection = null;
        this.ctxOverlaySection = null;
        this.ctxShapeBg = null;
        this.ctxShapeBorder = null;
        this.ctxShapeText = null;
        this.ctxConnectionStyle = null;
        this.ctxConnectionArrow = null;
        this.ctxConnectionColor = null;
        this.ctxConnectionLabel = null;
        this.ctxOverlayBg = null;
        this.ctxOverlayBorder = null;
        this.ctxOverlayText = null;

        // カラーピッカー関連
        this.activeColorPicker = null;
        this.activePickerElement = null; // 現在アクティブなピッカーのトリガー要素
        this.globalPickerContainer = null;

        this.pickerOutsideClickHandler = (e) => {
            if (this.activeColorPicker && this.globalPickerContainer) {
                // ピッカー内なら何もしない
                if (this.globalPickerContainer.contains(e.target)) {
                    return;
                }
                this._closeColorPicker();
            }
        };
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
        this.ctxOverlaySection = document.getElementById('overlay-edit-section');
        this.ctxShapeBg = document.getElementById('ctx-shape-bg');
        this.ctxShapeBorder = document.getElementById('ctx-shape-border');
        this.ctxShapeText = document.getElementById('ctx-shape-text');
        this.ctxShapeType = document.getElementById('ctx-shape-type');
        this.ctxGroupModeRow = document.getElementById('ctx-group-mode-row');
        this.ctxGroupMode = document.getElementById('ctx-group-mode');
        this.ctxConnectionStyle = document.getElementById('ctx-connection-style');
        this.ctxConnectionArrow = document.getElementById('ctx-connection-arrow');
        this.ctxConnectionColor = document.getElementById('ctx-connection-color');
        this.ctxConnectionLabel = document.getElementById('ctx-connection-label');
        this.ctxOverlayBg = document.getElementById('ctx-overlay-bg');
        this.ctxOverlayBorder = document.getElementById('ctx-overlay-border');
        this.ctxOverlayText = document.getElementById('ctx-overlay-text');

        this.globalPickerContainer = document.getElementById('global-color-picker-container');

        //シェイプメニュー
        const shapemenu = (e) => {
            // グループボタン（オーバーレイ+ボタンやトグルボタン）のクリックは親ノードのメニュー対象外
            if (e.target.closest('.group-overlay-btn, .group-toggle')) {
                return;
            }
            e.preventDefault();
            const shapeEl = e.target.closest('.shape');
            if (shapeEl) {
                this.selectedShapeForContext = shapeEl.id;
                this.selectedConnectionForContext = null;
                // 右クリックされたノードが既に選択中の複数ノードに含まれている場合は複数選択を維持する。
                // 未選択のノードの場合は単一選択にする。
                if (!this.app.isShapeSelected(shapeEl.id)) {
                    this.app.selectShape(shapeEl.id, false);
                }
                this.showContextMenu(e.clientX, e.clientY, 'shape');
            }
        };
        // 右クリックイベント（ロック中はブロック）
        this.app.canvas.addEventListener('contextmenu', (e) => {
            if (this.app._locked) {
                e.preventDefault();
                return;
            }
            this.app.shapeManager?._clearSingleSelectTimer?.();
            shapemenu(e);
        });
        // ダブルクリックイベント（ロック中はブロック）
        this.app.canvas.addEventListener('dblclick', (e) => {
            if (this.app._locked) return;
            this.app.shapeManager?._clearSingleSelectTimer?.();
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

        // 外側クリック/タップで閉じる (ピッカーが開いている場合はピッカーの挙動に任せるか、ここで閉じる)
        const closeMenuOnOutside = (e) => {
            // コンテキストメニュー外かつカラーピッカー外なら閉じる
            const inMenu = this.contextMenu && this.contextMenu.contains(e.target);
            const inPicker = this.globalPickerContainer && this.globalPickerContainer.contains(e.target);
            const inShape = e.target.closest('.shape');
            const inOverlay = e.target.closest('.overlay-group-area');

            if (!inMenu && !inPicker && !inShape && !inOverlay) {
                this.hideContextMenu(); // これでピッカーも閉じる（hideContextMenu内で処理）
            }
        };
        document.addEventListener('pointerdown', closeMenuOnOutside);
        document.addEventListener('mousedown', closeMenuOnOutside);

        // シェイプスタイル入力 (スウォッチクリックイベント)
        this._setupShapeStyleInputs();

        // 接続線スタイル入力
        this._setupConnectionStyleInputs();

        // オーバーレイスタイル入力
        this._setupOverlayStyleInputs();
    }

    // =====================================================
    // 表示/非表示
    // =====================================================

    /**
     * コンテキストメニューを表示します。
     * 
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - 'shape' | 'connection' | 'overlay'
     */
    showContextMenu(x, y, type) {
        if (!this.contextMenu) return;

        // ピッカーが開いていたら閉じる
        this._closeColorPicker();

        // すべてのセクションを一旦非表示にリセット
        this._hideAllSections();

        const separator = this.contextMenu.querySelector('.context-menu-separator');
        const deleteItem = this.contextMenu.querySelector('.context-menu-item.delete');

        // セクションの表示切り替え
        if (type === 'shape') {
            this._showShapeSection();
            if (separator) separator.classList.remove('hidden');
            if (deleteItem) deleteItem.classList.remove('hidden');
        } else if (type === 'connection') {
            this._showConnectionSection();
            if (separator) separator.classList.remove('hidden');
            if (deleteItem) deleteItem.classList.remove('hidden');
        } else if (type === 'overlay') {
            this._showOverlaySection();
            // オーバーレイキャンバスのメニューでは削除ボタンは不要
            if (separator) separator.classList.add('hidden');
            if (deleteItem) deleteItem.classList.add('hidden');
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
        this._hideAllSections();
        this._closeColorPicker();
        this.selectedShapeForContext = null;
        this.selectedConnectionForContext = null;
        this.selectedOverlayForContext = null;
    }

    // =====================================================
    // アクション処理
    // =====================================================

    /**
     * コンテキストメニュー操作の対象となるシェイプ群を取得します。
     * 複数選択されている場合は選択中の全シェイプ、それ以外は右クリック対象のシェイプを返します。
     * 
     * @returns {Array<Object>}
     * @private
     */
    _getTargetShapes() {
        const selectedShapes = this.app.getSelectedShapes ? this.app.getSelectedShapes() : [];
        if (selectedShapes.length > 0 && selectedShapes.some(s => s.id === this.selectedShapeForContext)) {
            return selectedShapes;
        }
        if (this.selectedShapeForContext) {
            const single = this.app.shapes.get(this.selectedShapeForContext);
            return single ? [single] : [];
        }
        return [];
    }

    /**
     * コンテキストメニュー操作の対象となる接続線群を取得します。
     * 範囲選択中のノードを繋ぐ接続線の一括編集モードの場合はその全接続線、
     * それ以外は右クリック対象の接続線を返します。
     * 
     * @returns {Array<Object>}
     * @private
     */
    _getTargetConnections() {
        const interConns = this.app.connectionManager?.getSelectedInterConnectingConnections?.() || [];
        if (interConns.length > 0 && interConns.some(c => c.id === this.selectedConnectionForContext)) {
            return interConns;
        }
        if (this.selectedConnectionForContext) {
            const single = (this.app.connections || []).find(c => c.id === this.selectedConnectionForContext);
            return single ? [single] : [];
        }
        return [];
    }

    /**
     * コンテキストメニューのアクションを処理します。
     * 
     * @param {string} action - アクション名
     */
    handleContextMenuAction(action) {
        if (action === 'delete') {
            const targetShapes = this._getTargetShapes();
            const targetConnections = this._getTargetConnections();

            if (targetShapes.length > 0) {
                targetShapes.forEach(shape => {
                    this.app.removeShape(shape.id);
                });
            } else if (this.selectedShapeForContext) {
                this.app.removeShape(this.selectedShapeForContext);
            } else if (targetConnections.length > 0) {
                targetConnections.forEach(conn => {
                    this.app.removeConnection(conn.id);
                });
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
        this.selectedOverlayForContext = null;
        this.showContextMenu(x, y, 'connection');
    }

    /**
     * オーバーレイキャンバスの右クリックを処理します。
     *
     * @param {import('../flowchart/OverlayCanvas.js').OverlayCanvas} overlayCanvas - 対象OverlayCanvas
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    showOverlayContextMenu(overlayCanvas, x, y) {
        this.selectedOverlayForContext = overlayCanvas;
        this.selectedShapeForContext = null;
        this.selectedConnectionForContext = null;
        this.showContextMenu(x, y, 'overlay');
    }

    // =====================================================
    // カラーピッカー制御
    // =====================================================

    /**
     * カラーピッカーを表示します。
     * @param {HTMLElement} targetEl - スウォッチ要素
     * @param {string} initialColor - 初期色
     * @param {Function} onChange - 変更時コールバック
     * @param {boolean} [hasAlpha=true] - アルファチャンネル有効フラグ
     * @private
     */
    _openColorPicker(targetEl, initialColor, onChange, hasAlpha = true) {
        // 既存のピッカーがあれば閉じる
        this._closeColorPicker();

        if (!this.globalPickerContainer) return;

        // アンカー設定
        targetEl.style.anchorName = '--color-picker-anchor';
        this.activePickerElement = targetEl;

        this.globalPickerContainer.style.display = 'block';

        // ピッカー生成
        this.activeColorPicker = new ColorPicker(this.globalPickerContainer, {
            color: initialColor,
            hasAlpha: hasAlpha,
            onChange: (hex) => {
                // スウォッチ自体の色も更新
                targetEl.style.setProperty('--swatch-color', hex);
                targetEl.dataset.color = hex;
                onChange(hex);
            }
        });

        // 外側クリック監視を追加
        requestAnimationFrame(() => {
            document.addEventListener('pointerdown', this.pickerOutsideClickHandler, true);
            document.addEventListener('mousedown', this.pickerOutsideClickHandler, true);
        });
    }

    /**
     * カラーピッカーを閉じます。
     * @private
     */
    _closeColorPicker() {
        // イベント解除
        document.removeEventListener('pointerdown', this.pickerOutsideClickHandler, true);
        document.removeEventListener('mousedown', this.pickerOutsideClickHandler, true);

        if (this.globalPickerContainer) {
            this.globalPickerContainer.innerHTML = '';
            this.globalPickerContainer.style.display = 'none';
        }
        // アンカー解除
        if (this.activePickerElement) {
            this.activePickerElement.style.anchorName = '';
            this.activePickerElement = null;
        }
        this.activeColorPicker = null;
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * すべてのコンテキストメニューセクションを非表示にします。
     * @private
     */
    _hideAllSections() {
        if (this.ctxShapeSection) this.ctxShapeSection.classList.add('hidden');
        if (this.ctxConnectionSection) this.ctxConnectionSection.classList.add('hidden');
        if (this.ctxOverlaySection) this.ctxOverlaySection.classList.add('hidden');
    }

    /**
     * RGB/RGBAなどの色文字列をHEX(#RRGGBBまたは#RRGGBBAA)に変換します。
     * @param {string} colorStr
     * @returns {string}
     * @private
     */
    _colorToHex(colorStr) {
        if (!colorStr) return '';
        colorStr = colorStr.trim();
        if (colorStr.startsWith('#')) return colorStr;
        const match = colorStr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d\.]+))?\s*\)$/);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            if (match[4] !== undefined) {
                const a = Math.round(parseFloat(match[4]) * 255).toString(16).padStart(2, '0');
                return `#${r}${g}${b}${a}`;
            }
            return `#${r}${g}${b}`;
        }
        return colorStr;
    }

    /**
     * シェイプセクションを表示します。
     * 
     * @private
     */
    _showShapeSection() {
        if (this.ctxShapeSection) this.ctxShapeSection.classList.remove('hidden');

        const shape = this.app.shapes.get(this.selectedShapeForContext);
        if (shape) {
            this._updateSwatch(this.ctxShapeBg, shape.backgroundColor || '#ffffff');
            this._updateSwatch(this.ctxShapeBorder, shape.borderColor || '#cbd5e1');
            this._updateSwatch(this.ctxShapeText, shape.color || '#334155');
            if (this.ctxShapeType) {
                this.ctxShapeType.value = shape.type || 'rounded';
            }

            // グループ親ノードの場合のみグループモード切替を表示（複数選択時は選択対象のいずれかが親なら表示）
            const targetShapes = this._getTargetShapes();
            const isGroupParent = targetShapes.some(s => s.children && s.children.length > 0);
            if (this.ctxGroupModeRow) {
                this.ctxGroupModeRow.classList.toggle('hidden', !isGroupParent);
            }
            if (this.ctxGroupMode) {
                this.ctxGroupMode.value = shape.groupMode || 'inline';
            }
        }
    }

    /**
     * 接続線セクションを表示します。
     * 
     * @private
     */
    _showConnectionSection() {
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
     * オーバーレイセクションを表示します。
     * 未編集時はオーバーレイキャンバス要素のデフォルト（計算スタイルまたは既定色）を反映します。
     *
     * @private
     */
    _showOverlaySection() {
        if (this.ctxOverlaySection) this.ctxOverlaySection.classList.remove('hidden');

        const overlay = this.selectedOverlayForContext;
        const style = overlay?.shape?.overlayStyle;

        let bgColor = style?.backgroundColor;
        let borderColor = style?.borderColor;
        let textColor = style?.textColor;

        // 一度も編集されていない場合、オーバーレイキャンバス要素の計算スタイルまたはデフォルト色を反映
        if (!bgColor || !borderColor || !textColor) {
            let defaultBg = '#f8f8fad9';
            let defaultBorder = '#0d9488';
            let defaultText = '#1e293b';

            if (overlay?.areaElement) {
                const computed = window.getComputedStyle(overlay.areaElement);
                if (computed.backgroundColor && computed.backgroundColor !== 'transparent' && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    defaultBg = this._colorToHex(computed.backgroundColor) || defaultBg;
                }
                if (computed.borderColor && computed.borderColor !== 'transparent' && computed.borderColor !== 'rgba(0, 0, 0, 0)') {
                    defaultBorder = this._colorToHex(computed.borderColor) || defaultBorder;
                }
                const titleEl = overlay.areaElement.querySelector('.overlay-area-title');
                if (titleEl) {
                    const titleComputed = window.getComputedStyle(titleEl);
                    if (titleComputed.color && titleComputed.color !== 'transparent') {
                        defaultText = this._colorToHex(titleComputed.color) || defaultText;
                    }
                }
            }

            if (!bgColor) bgColor = defaultBg;
            if (!borderColor) borderColor = defaultBorder;
            if (!textColor) textColor = defaultText;
        }

        this._updateSwatch(this.ctxOverlayBg, bgColor);
        this._updateSwatch(this.ctxOverlayBorder, borderColor);
        this._updateSwatch(this.ctxOverlayText, textColor);
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
                }, false); // hasAlpha: false
            });
        }

        // 形状タイプ
        if (this.ctxShapeType) {
            this.ctxShapeType.addEventListener('change', (e) => {
                this._updateShapeStyle('type', e.target.value);
            });
        }

        // グループ表示モード（inline / overlay）
        if (this.ctxGroupMode) {
            this.ctxGroupMode.addEventListener('change', (e) => {
                const targetShapes = this._getTargetShapes();
                targetShapes.forEach(shape => {
                    if (shape && shape.children && shape.children.length > 0 && this.app.groupManager) {
                        this.app.groupManager.setGroupMode(shape, e.target.value);
                    }
                });
            });
        }
    }

    /**
     * オーバーレイスタイル入力をセットアップします。
     *
     * @private
     */
    _setupOverlayStyleInputs() {
        // 背景色
        if (this.ctxOverlayBg) {
            this.ctxOverlayBg.addEventListener('click', (e) => {
                const currentColor = e.target.dataset.color || '#f8f8fad9';
                this._openColorPicker(e.target, currentColor, (hex) => {
                    this._updateOverlayStyle('backgroundColor', hex);
                });
            });
        }

        // 枠線色
        if (this.ctxOverlayBorder) {
            this.ctxOverlayBorder.addEventListener('click', (e) => {
                const currentColor = e.target.dataset.color || '#0d9488';
                this._openColorPicker(e.target, currentColor, (hex) => {
                    this._updateOverlayStyle('borderColor', hex);
                }, true); // hasAlpha: true
            });
        }

        // 文字色
        if (this.ctxOverlayText) {
            this.ctxOverlayText.addEventListener('click', (e) => {
                const currentColor = e.target.dataset.color || '#1e293b';
                this._openColorPicker(e.target, currentColor, (hex) => {
                    this._updateOverlayStyle('textColor', hex);
                }, false);
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
     * 複数選択されている場合は選択中の全シェイプに適用されます。
     * 共通プロパティ（backgroundColor / borderColor / color）は表示中の選択オーバーレイにも適用します。
     * 
     * @param {string} prop - プロパティ名
     * @param {string} value - 値
     * @private
     */
    _updateShapeStyle(prop, value) {
        const targetShapes = this._getTargetShapes();
        if (targetShapes.length === 0) return;

        targetShapes.forEach(shape => {
            if (shape && shape.element) {
                shape[prop] = value;
                // ShapeManagerに更新処理を委譲（CSS変数対応など）
                this.app.updateShapeElement(shape);
            }
        });

        // 共通プロパティは表示中の選択オーバーレイにも適用（ふたつのプロパティのマッピング）
        const OVERLAY_PROP_MAP = {
            backgroundColor: 'backgroundColor',
            borderColor: 'borderColor',
            color: 'textColor',
        };
        const overlayProp = OVERLAY_PROP_MAP[prop];
        if (overlayProp) {
            // 選択中のオーバーレイかつ非表示ノードのオーバーレイには適用しない
            const selectedOverlays = this.app.getSelectedOverlays?.() || [];
            // 選択ノードが親のオーバーレイが選択中の場合（オーバーレイが表示中ない）は適用しない
            const selectedParentIds = new Set(
                targetShapes
                    .filter(s => s.groupMode === 'overlay' && !this.app.groupManager?.overlayStrategy?.isOverlayOpen(s.id))
                    .map(s => s.id)
            );
            // 表示中オーバーレイのうち、選択中の非表示オーバーレイ親ノードのオーバーレイは除外する
            const overlaysToApply = selectedOverlays.filter(ov => !selectedParentIds.has(ov.shape.id));
            overlaysToApply.forEach(overlay => {
                const currentStyle = overlay.shape?.overlayStyle || {};
                overlay.applyStyle({ ...currentStyle, [overlayProp]: value });
            });
        }

        // 形状変更等に伴う接続線の再描画
        this.app.drawConnections?.();
    }

    /**
     * オーバーレイスタイルを更新します。
     * 複数選択中の場合は選択中の全オーバーレイに適用されます。
     *
     * @param {string} prop - プロパティ名
     * @param {string} value - 値
     * @private
     */
    _updateOverlayStyle(prop, value) {
        if (!this.selectedOverlayForContext) return;

        // 選択中の全オーバーレイに適用
        const selectedOverlays = this.app.getSelectedOverlays?.() || [];
        const targets = selectedOverlays.length > 0 ? selectedOverlays : [this.selectedOverlayForContext];

        targets.forEach(overlay => {
            const currentStyle = overlay.shape?.overlayStyle || {};
            overlay.applyStyle({ ...currentStyle, [prop]: value });
        });

        // 共通プロパティは選択中の通常シェイプにも適用
        const SHAPE_PROP_MAP = {
            backgroundColor: 'backgroundColor',
            borderColor: 'borderColor',
            textColor: 'color',
        };
        const shapeProp = SHAPE_PROP_MAP[prop];
        if (shapeProp) {
            const selectedShapes = this.app.getSelectedShapes ? this.app.getSelectedShapes() : [];
            selectedShapes.forEach(shape => {
                if (shape && shape.element) {
                    shape[shapeProp] = value;
                    this.app.updateShapeElement(shape);
                }
            });
            this.app.drawConnections?.();
        }
    }

    /**
     * 接続線スタイルを更新します。
     * 範囲選択中のノードを繋ぐ接続線の一括編集モードの場合は全対象接続線に適用されます。
     * 
     * @param {string} prop - プロパティ名
     * @param {string} value - 値
     * @private
     */
    _updateConnectionStyle(prop, value) {
        const targetConnections = this._getTargetConnections();
        if (targetConnections.length === 0) return;

        targetConnections.forEach(conn => {
            if (!conn.style) conn.style = {};
            conn.style[prop] = value;
        });

        this.app.drawConnections?.();
    }
}
