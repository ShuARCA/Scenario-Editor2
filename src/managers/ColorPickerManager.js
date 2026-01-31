/**
 * カラーピッカー管理
 * 
 * 文字色・ハイライト色のカラーピッカー機能を担当します。
 * カスタムカラーの追加・保存・復元も管理します。
 * 
 * @module managers/ColorPickerManager
 */

import { CONFIG } from '../core/Config.js';

/**
 * カラーピッカー管理クラス
 */
export class ColorPickerManager {
    /**
     * ColorPickerManagerのコンストラクタ
     * 
     * @param {Object} editorCore - EditorManagerまたはEditorCoreへの参照
     */
    constructor(editorCore) {
        /** @type {Object} エディタへの参照 */
        this.editor = editorCore;

        /** @type {string[]} カスタム文字色の配列（最大9色） */
        this.customTextColors = [];

        /** @type {string[]} カスタムハイライト色の配列（最大9色） */
        this.customHighlightColors = [];

        // DOM参照
        this.textColorPicker = document.getElementById('textColorPicker');
        this.highlightPicker = document.getElementById('highlightPicker');

        // ボタン参照（setupColorPickerで設定）
        this.textColorBtn = null;
        this.highlightBtn = null;

        // 外側クリックで閉じる
        document.addEventListener('mousedown', (e) => {
            const checkAndHide = (picker, btn) => {
                if (picker &&
                    !picker.classList.contains('hidden') &&
                    !picker.contains(e.target) &&
                    (!btn || !btn.contains(e.target)) &&
                    // カスタムカラー追加ボタンのinput要素などは除外
                    !e.target.closest('.hidden-color-input')) {
                    picker.classList.add('hidden');
                }
            };

            checkAndHide(this.textColorPicker, this.textColorBtn);
            checkAndHide(this.highlightPicker, this.highlightBtn);
        });
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * カラーピッカーを初期化します。
     * 
     * @param {string} btnId - ボタンのID
     * @param {string} pickerId - ピッカーのID
     * @param {string} command - コマンド種別（'foreColor' | 'hiliteColor'）
     */
    setupColorPicker(btnId, pickerId, command) {
        const btn = document.getElementById(btnId);
        const picker = document.getElementById(pickerId);
        const isForeColor = command === 'foreColor';

        // ボタン参照を保存（外側クリック判定用）
        if (isForeColor) {
            this.textColorBtn = btn;
        } else {
            this.highlightBtn = btn;
        }

        const presetColors = isForeColor ? CONFIG.EDITOR.TEXT_COLORS : CONFIG.EDITOR.HIGHLIGHT_COLORS;

        // ピッカー再構築用の関数
        const rebuildPicker = () => {
            picker.innerHTML = '';

            // プリセット色を追加（nullを含む10色）
            presetColors.forEach((item) => {
                const colorValue = item.color;
                const colorName = item.name;
                const div = document.createElement('div');
                div.className = 'color-option';
                div.title = colorName;

                if (colorValue === null) {
                    // null = デフォルト色/クリア
                    div.classList.add('default-option');
                    if (isForeColor) {
                        // 文字色のデフォルト: --text-colorで塗りつぶし
                        div.classList.add('text-default');
                    } else {
                        // ハイライトのクリア: 透明背景＋×表示
                        div.classList.add('highlight-clear');
                        div.textContent = '×';
                    }
                } else {
                    div.style.backgroundColor = colorValue;
                }

                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this._applyColor(colorValue, isForeColor);
                    picker.classList.add('hidden');
                });
                picker.appendChild(div);
            });

            // セパレーター
            const separator = document.createElement('div');
            separator.className = 'color-picker-separator';
            picker.appendChild(separator);

            // カスタム色を追加
            const customColors = isForeColor ? this.customTextColors : this.customHighlightColors;
            customColors.forEach((color) => {
                const div = document.createElement('div');
                div.className = 'color-option custom-color';
                div.style.backgroundColor = color;
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this._applyColor(color, isForeColor);
                    picker.classList.add('hidden');
                });
                picker.appendChild(div);
            });

            // カスタム色追加ボタン
            this._createAddCustomColorButton(picker, isForeColor);
        };

        // ピッカー再構築関数を保存
        picker._rebuild = rebuildPicker;

        // 初期構築
        rebuildPicker();

        // ボタンクリックでピッカー表示
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            picker.classList.toggle('hidden');
            const rect = btn.getBoundingClientRect();
            picker.style.top = `${rect.bottom + 5 + window.scrollY}px`;
            picker.style.left = `${rect.left + window.scrollX}px`;
        });
    }

    // =====================================================
    // カスタムカラー管理
    // =====================================================

    /**
     * カスタム色を設定します（ZIPファイル読み込み時に使用）。
     * 
     * @param {Object} colors - カスタム色オブジェクト
     * @param {string[]} [colors.text] - 文字色のカスタム配列
     * @param {string[]} [colors.highlight] - ハイライト色のカスタム配列
     */
    setCustomColors(colors) {
        if (!colors) return;

        if (colors.text && Array.isArray(colors.text)) {
            this.customTextColors = colors.text.slice(0, 9);
        }
        if (colors.highlight && Array.isArray(colors.highlight)) {
            this.customHighlightColors = colors.highlight.slice(0, 9);
        }

        this.rebuildAllPickers();
    }

    /**
     * カスタム色を取得します（ZIP保存時に使用）。
     * 
     * @returns {Object} カスタム色配列を含むオブジェクト
     */
    getCustomColors() {
        return {
            text: [...this.customTextColors],
            highlight: [...this.customHighlightColors]
        };
    }

    /**
     * カスタム文字色を追加します（最大9色、超過時は古いものを破棄）。
     * 
     * @param {string} color - 追加する色（HEX形式）
     */
    addCustomTextColor(color) {
        if (this.customTextColors.includes(color)) return;
        if (this.customTextColors.length >= 9) {
            this.customTextColors.shift();
        }
        this.customTextColors.push(color);
        this._emitColorChanged();
    }

    /**
     * カスタムハイライト色を追加します（最大9色、超過時は古いものを破棄）。
     * 
     * @param {string} color - 追加する色（HEX形式）
     */
    addCustomHighlightColor(color) {
        if (this.customHighlightColors.includes(color)) return;
        if (this.customHighlightColors.length >= 9) {
            this.customHighlightColors.shift();
        }
        this.customHighlightColors.push(color);
        this._emitColorChanged();
    }

    /**
     * 両方のカラーピッカーを再構築します。
     */
    rebuildAllPickers() {
        if (this.textColorPicker?._rebuild) {
            this.textColorPicker._rebuild();
        }
        if (this.highlightPicker?._rebuild) {
            this.highlightPicker._rebuild();
        }
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * 色を適用します。
     * 
     * @param {string|null} colorValue - 色の値（nullの場合は解除）
     * @param {boolean} isForeColor - 文字色の場合true
     * @private
     */
    _applyColor(colorValue, isForeColor) {
        if (!this.editor.tiptap) return;

        if (colorValue === null) {
            // null選択時はunsetを呼び出す
            if (isForeColor) {
                this.editor.tiptap.chain().focus().unsetColor().run();
            } else {
                this.editor.tiptap.chain().focus().unsetHighlight().run();
            }
        } else {
            if (isForeColor) {
                this.editor.tiptap.chain().focus().setColor(colorValue).run();
            } else {
                this.editor.tiptap.chain().focus().setHighlight({ color: colorValue }).run();
            }
        }
    }

    /**
     * カスタム色追加ボタンを作成します。
     * 
     * @param {HTMLElement} picker - ピッカー要素
     * @param {boolean} isForeColor - 文字色の場合true
     * @private
     */
    _createAddCustomColorButton(picker, isForeColor) {
        const addBtn = document.createElement('div');
        addBtn.className = 'color-option add-custom';
        addBtn.textContent = '＋';
        addBtn.title = 'カスタム色を追加';

        // 隠しカラーインプット
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'hidden-color-input';
        colorInput.style.position = 'absolute';
        colorInput.style.opacity = '0';
        colorInput.style.pointerEvents = 'none';

        addBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            colorInput.click();
        });

        // changeイベント：色を決定したときのみ追加
        colorInput.addEventListener('change', (e) => {
            const newColor = e.target.value;
            if (isForeColor) {
                this.addCustomTextColor(newColor);
            } else {
                this.addCustomHighlightColor(newColor);
            }
            this.rebuildAllPickers();
        });

        addBtn.appendChild(colorInput);
        picker.appendChild(addBtn);
    }

    /**
     * カスタムカラー変更イベントを発火します。
     * 
     * @private
     */
    _emitColorChanged() {
        if (this.editor.eventBus) {
            this.editor.eventBus.emit('editor:customColorsChanged', this.getCustomColors());
        }
    }

    /**
     * ピッカーを非表示にします。
     */
    hideAllPickers() {
        if (this.textColorPicker) {
            this.textColorPicker.classList.add('hidden');
        }
        if (this.highlightPicker) {
            this.highlightPicker.classList.add('hidden');
        }
    }
}
