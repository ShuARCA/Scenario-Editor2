/**
 * アウトライン管理
 * 
 * 見出しのアウトライン表示、階層構造、アイコン選択を担当します。
 * 
 * @module managers/OutlineManager
 */

import { TOGGLE_ICONS, OUTLINE_ICONS, getIconList } from '../assets/icons/OutlineIcons.js';

/**
 * アウトライン管理クラス
 */
export class OutlineManager {
    /**
     * OutlineManagerのコンストラクタ
     * 
     * @param {Object} editorCore - EditorManagerまたはEditorCoreへの参照
     */
    constructor(editorCore) {
        /** @type {Object} エディタへの参照 */
        this.editor = editorCore;

        /** @type {Map<string, boolean>} アウトライン項目の折りたたみ状態 */
        this.outlineCollapsedState = new Map();

        /** @type {Object|null} 現在のアイコン選択対象 */
        this.currentIconTarget = null;

        /** @type {string|null} 最後にアクティブだった見出しID */
        this.lastActiveHeadingId = null;

        // DOM参照
        this.outlineList = document.getElementById('outline-list');
        this.iconPicker = document.getElementById('outline-icon-picker');
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * アイコンピッカーをセットアップします。
     */
    setupIconPicker() {
        if (!this.iconPicker) return;

        // アイコンリストを構築
        const iconList = getIconList();
        this.iconPicker.innerHTML = '';

        iconList.forEach(icon => {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'icon-picker-item';
            iconDiv.dataset.iconId = icon.id;
            iconDiv.title = icon.name;

            if (icon.svg) {
                iconDiv.innerHTML = icon.svg;
            } else {
                iconDiv.textContent = '×';
            }

            iconDiv.addEventListener('click', () => {
                this._selectIcon(icon.id);
            });

            this.iconPicker.appendChild(iconDiv);
        });

        // ピッカー外クリックで閉じる
        document.addEventListener('click', (e) => {
            // ピッカーが表示されており、かつピッカー外、かつアイコン(トリガー)外の場合に閉じる
            if (this.iconPicker &&
                !this.iconPicker.classList.contains('hidden') &&
                !this.iconPicker.contains(e.target) &&
                !e.target.closest('.outline-icon')) {
                this.hideIconPicker();
            }
        });
    }

    // =====================================================
    // 見出し取得
    // =====================================================

    /**
     * エディタ内の見出し要素を取得します。
     * 
     * @returns {Array<{text: string, level: number, element: HTMLElement, id: string, icon: string}>}
     */
    getHeadings() {
        if (!this.editor.tiptap) return [];

        const headings = [];
        const editorContainer = this.editor.editorContainer;
        const tiptapElement = editorContainer?.querySelector('.tiptap');

        // Tiptap状態から見出し情報を取得
        this.editor.tiptap.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
                const level = node.attrs.level;
                const id = node.attrs.id;
                const text = node.textContent || '';
                const icon = node.attrs.outlineIcon || 'document';

                // DOM要素への参照も取得（既存APIとの互換性維持）
                const element = tiptapElement?.querySelector(`h${level}[id="${id}"]`);

                headings.push({
                    text,
                    level,
                    element,
                    id,
                    icon
                });
            }
        });

        return headings;
    }

    // =====================================================
    // アウトライン更新
    // =====================================================

    /**
     * アウトラインを更新します。
     */
    updateOutline() {
        if (!this.outlineList) return;

        const headings = this.getHeadings();
        if (headings.length === 0) {
            this.outlineList.innerHTML = '<div class="outline-empty">見出しがありません</div>';
            return;
        }

        // 階層構造を構築
        const hierarchyData = this._buildOutlineHierarchy(headings);

        // アウトラインリストを再構築
        this.outlineList.innerHTML = '';
        hierarchyData.forEach(item => {
            const itemEl = this._createOutlineItemElement(item);
            this.outlineList.appendChild(itemEl);
        });
    }

    /**
     * 見出しリストから階層構造を構築します。
     * 
     * @param {Array} headings - 見出し配列
     * @returns {Array} 階層構造配列
     * @private
     */
    _buildOutlineHierarchy(headings) {
        const result = [];
        const stack = [];

        headings.forEach(h => {
            const item = { ...h, children: [] };

            while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                result.push(item);
            } else {
                stack[stack.length - 1].children.push(item);
            }

            stack.push(item);
        });

        return result;
    }

    /**
     * アウトライン項目のDOM要素を作成します。
     * 
     * @param {Object} item - 階層項目
     * @returns {HTMLElement}
     * @private
     */
    _createOutlineItemElement(item) {
        const wrapper = document.createElement('div');
        wrapper.className = 'outline-item-wrapper';
        wrapper.dataset.headingId = item.id;
        wrapper.dataset.level = item.level;

        if (item.level === 1) {
            wrapper.style.paddingLeft = `0px`;
        }

        const itemEl = document.createElement('div');
        itemEl.className = 'outline-item';
        itemEl.dataset.headingId = item.id;

        // 1. アイコン
        const iconEl = document.createElement('div');
        iconEl.className = 'outline-icon';
        // アイコン表示ロジックの復元
        if (item.icon && item.icon !== 'none' && OUTLINE_ICONS[item.icon]) {
            iconEl.innerHTML = OUTLINE_ICONS[item.icon].svg;
        } else if (item.icon && OUTLINE_ICONS[item.icon]) {
            // item.iconはあるが 'none' でないかどうかのチェックが漏れた場合の保険、または明示的なデフォルト
            // バックアップでは `if (item.icon && item.icon !== 'none' && OUTLINE_ICONS[item.icon])` となっている
            // ここではバックアップのロジックを優先
        }

        iconEl.title = 'クリックでアイコンを変更';
        iconEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showIconPicker(item.id, iconEl);
        });
        itemEl.appendChild(iconEl);

        // 2. テキスト
        const textEl = document.createElement('span');
        textEl.className = 'outline-text';
        textEl.textContent = item.text || '(無題)';
        itemEl.appendChild(textEl);

        // 3. トグルアイコン
        if (item.children.length > 0) {
            const toggleEl = document.createElement('div');
            toggleEl.className = 'outline-toggle';
            const isCollapsed = this.outlineCollapsedState.get(item.id) || false;
            toggleEl.innerHTML = isCollapsed ? TOGGLE_ICONS.collapsed : TOGGLE_ICONS.expanded;

            toggleEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleOutlineItem(item.id, toggleEl, wrapper);
            });
            itemEl.appendChild(toggleEl);
        }

        // クリックでスクロール
        itemEl.addEventListener('click', () => {
            this.scrollToHeading(item.id);
            this._setOutlineHighlight(item.id);
        });

        wrapper.appendChild(itemEl);

        // 子アイテム
        if (item.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'outline-children';

            const isCollapsed = this.outlineCollapsedState.get(item.id) || false;
            if (isCollapsed) {
                childrenContainer.classList.add('collapsed');
            }

            item.children.forEach(child => {
                childrenContainer.appendChild(this._createOutlineItemElement(child));
            });
            wrapper.appendChild(childrenContainer);
        }

        return wrapper;
    }

    // =====================================================
    // アウトライン操作
    // =====================================================

    /**
     * アウトライン項目の折りたたみ・展開を切り替えます。
     * 
     * @param {string} headingId - 見出しID
     * @param {HTMLElement} toggleEl - トグル要素
     * @param {HTMLElement} wrapper - ラッパー要素
     * @private
     */
    _toggleOutlineItem(headingId, toggleEl, wrapper) {
        const isCollapsed = !this.outlineCollapsedState.get(headingId);
        this.outlineCollapsedState.set(headingId, isCollapsed);

        toggleEl.innerHTML = isCollapsed ? TOGGLE_ICONS.collapsed : TOGGLE_ICONS.expanded;

        const childrenContainer = wrapper.querySelector('.outline-children');
        if (childrenContainer) {
            childrenContainer.classList.toggle('collapsed', isCollapsed);
        }

        // トグル後にハイライトを再評価（隠れていた項目が表示された場合などに更新が必要）
        if (this.lastActiveHeadingId) {
            this._setOutlineHighlight(this.lastActiveHeadingId);
        }
    }

    /**
     * アウトラインのハイライト状態を設定します。
     * 
     * @param {string} headingId - ハイライトする見出しID
     * @private
     */
    _setOutlineHighlight(headingId) {
        this.lastActiveHeadingId = headingId;

        // 既存のハイライトを解除
        this.outlineList?.querySelectorAll('.outline-item').forEach(el => {
            el.classList.remove('active', 'has-hidden-active');
        });

        if (!headingId) return;

        // 新しいハイライトを設定
        const targetWrapper = this.outlineList?.querySelector(`[data-heading-id="${headingId}"]`);

        if (targetWrapper) {
            const targetItem = targetWrapper.querySelector('.outline-item');
            if (targetItem) {
                const isVisible = this._isOutlineItemVisible(targetWrapper);

                if (isVisible) {
                    targetItem.classList.add('active');
                } else {
                    const visibleParent = this._findVisibleParentOutlineItem(targetWrapper);
                    if (visibleParent) {
                        visibleParent.classList.add('has-hidden-active');
                    }
                }
            }
        }
    }

    /**
     * アウトラインアイテムが表示されているかどうかを判定します。
     * @param {HTMLElement} wrapper 
     * @returns {boolean}
     * @private
     */
    _isOutlineItemVisible(wrapper) {
        if (!wrapper) return false;
        let parent = wrapper.parentElement;
        while (parent && parent !== this.outlineList) {
            if (parent.classList.contains('outline-children') &&
                parent.classList.contains('collapsed')) {
                return false;
            }
            parent = parent.parentElement;
        }
        return true;
    }

    /**
     * 表示されている親のアウトラインアイテムを見つけます。
     * @param {HTMLElement} wrapper 
     * @returns {HTMLElement|null}
     * @private
     */
    _findVisibleParentOutlineItem(wrapper) {
        if (!wrapper) return null;
        let parent = wrapper.parentElement;
        while (parent && parent !== this.outlineList) {
            if (parent.classList.contains('outline-item-wrapper')) {
                const parentItem = parent.querySelector(':scope > .outline-item');
                if (parentItem && this._isOutlineItemVisible(parent)) {
                    return parentItem;
                }
            }
            parent = parent.parentElement;
        }
        return null;
    }

    /**
     * カーソル位置に応じてアウトラインのハイライトを更新します。
     */
    updateOutlineHighlightByPosition() {
        if (!this.editor.tiptap) return;

        const { from } = this.editor.tiptap.state.selection;
        let currentHeadingId = null;

        // カーソルより前の最後の見出しを探す
        this.editor.tiptap.state.doc.nodesBetween(0, from, (node, pos) => {
            if (node.type.name === 'heading' && node.attrs.id) {
                currentHeadingId = node.attrs.id;
            }
        });

        if (currentHeadingId && currentHeadingId !== this.lastActiveHeadingId) {
            this._setOutlineHighlight(currentHeadingId);
        }
    }

    /**
     * 指定されたIDの見出し要素までスクロールします。
     * 
     * @param {string} headingId - 見出し要素のID
     */
    scrollToHeading(headingId) {
        const editorContainer = this.editor.editorContainer;
        const element = editorContainer?.querySelector(`[id="${headingId}"]`);

        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    // =====================================================
    // アイコンピッカー
    // =====================================================

    /**
     * アイコンピッカーを表示します。
     * 
     * @param {string} headingId - 見出しID
     * @param {HTMLElement} iconEl - アイコン要素
     */
    showIconPicker(headingId, iconEl) {
        if (!this.iconPicker) return;

        this.currentIconTarget = { headingId, iconEl };

        const rect = iconEl.getBoundingClientRect();
        this.iconPicker.style.top = `${rect.bottom + 5 + window.scrollY}px`;
        this.iconPicker.style.left = `${rect.left + window.scrollX}px`;
        this.iconPicker.classList.remove('hidden');
    }

    /**
     * アイコンピッカーを非表示にします。
     */
    hideIconPicker() {
        if (this.iconPicker) {
            this.iconPicker.classList.add('hidden');
        }
        this.currentIconTarget = null;
    }

    /**
     * アイコンを選択して適用します。
     * 
     * @param {string} iconId - アイコンID
     * @private
     */
    _selectIcon(iconId) {
        if (!this.currentIconTarget || !this.editor.tiptap) {
            this.hideIconPicker();
            return;
        }

        const { headingId } = this.currentIconTarget;

        // Tiptap内の該当見出しを探して更新
        this.editor.tiptap.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && node.attrs.id === headingId) {
                this.editor.tiptap.chain()
                    .setNodeSelection(pos)
                    .updateAttributes('heading', { outlineIcon: iconId })
                    .run();
                return false;
            }
        });

        this.hideIconPicker();

        // アウトラインを更新
        this.updateOutline();
    }
}
