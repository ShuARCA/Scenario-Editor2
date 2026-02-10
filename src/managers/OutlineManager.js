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
        this.contextMenu = document.getElementById('outline-context-menu');

        /** @type {string|null} 現在コンテキストメニューの対象となっている見出しID */
        this.contextMenuTargetId = null;

        /** @type {HTMLElement|null} 現在アンカーとなっているボタン要素 */
        this.currentAnchorButton = null;

        /** @type {boolean} 編集ロック状態 */
        this._locked = false;
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
            // ピッカーが表示されており、かつピッカー外、かつアイコン(トリガー)外、かつコンテキストメニュー外の場合に閉じる
            if (this.iconPicker &&
                !this.iconPicker.classList.contains('hidden') &&
                !this.iconPicker.contains(e.target) &&
                !e.target.closest('.outline-icon') &&
                !e.target.closest('.outline-context-menu')) {
                this.hideIconPicker();
            }
        });

        // コンテキストメニューのセットアップ
        this._setupContextMenu();
    }

    /**
     * コンテキストメニューをセットアップします。
     * @private
     */
    _setupContextMenu() {
        if (!this.contextMenu) return;

        // メニュー項目のクリックイベント
        this.contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.outline-context-menu-item');
            if (item && !item.classList.contains('disabled')) {
                const action = item.dataset.action;
                this._handleContextMenuAction(action);
                // メニューは閉じない（連続操作を可能にする）
            }
        });

        // メニュー外クリックで閉じる
        document.addEventListener('mousedown', (e) => {
            if (this.contextMenu &&
                !this.contextMenu.classList.contains('hidden') &&
                !this.contextMenu.contains(e.target) &&
                !e.target.closest('.outline-menu-btn')) {
                this.hideContextMenu();
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

        // コンテキストメニューが開いている場合はアンカーを再設定
        if (this.contextMenuTargetId && this.contextMenu && !this.contextMenu.classList.contains('hidden')) {
            this._reanchorToCurrentTarget();
        }
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

        // 3. メニューボタン（ホバー時表示）
        const menuBtn = document.createElement('div');
        menuBtn.className = 'outline-menu-btn';
        menuBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z"/></svg>`;
        menuBtn.title = 'メニュー';
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._showContextMenuFromButton(item.id, item.level, menuBtn);
        });
        itemEl.appendChild(menuBtn);

        // 4. トグルアイコン
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

        // 右クリックでコンテキストメニュー（ボタンクリックと同様の挙動）
        itemEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // メニューボタンをアンカーとして使用
            this._showContextMenuFromButton(item.id, item.level, menuBtn);
        });

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
    // ロック制御
    // =====================================================

    /**
     * 編集ロック状態を設定します。
     * ロック中はコンテキストメニュー・アイコン変更をブロックします。
     * クリックジャンプ・展開/折りたたみは維持されます。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
        // ロック時は開いているメニューを閉じる
        if (locked) {
            this.hideContextMenu();
            this.hideIconPicker();
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
        if (!this.iconPicker || this._locked) return;

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

    // =====================================================
    // コンテキストメニュー
    // =====================================================

    /**
     * ボタンクリックからコンテキストメニューを表示します（CSS Anchor Positioning使用）。
     * 
     * @param {string} headingId - 見出しID
     * @param {number} level - 見出しレベル
     * @param {HTMLElement} buttonEl - メニューボタン要素
     * @private
     */
    _showContextMenuFromButton(headingId, level, buttonEl) {
        if (!this.contextMenu || this._locked) return;

        this.contextMenuTargetId = headingId;

        // 以前のアンカーをクリア
        if (this.currentAnchorButton) {
            this.currentAnchorButton.style.anchorName = '';
        }

        // 新しいアンカーを設定
        this.currentAnchorButton = buttonEl;
        buttonEl.style.anchorName = '--outline-menu-anchor';

        // 座標指定クラスを削除（Anchor Positioningを有効化）
        this.contextMenu.classList.remove('positioned-by-coords');
        this.contextMenu.style.top = '';
        this.contextMenu.style.left = '';

        this._updateContextMenuState(level, headingId);
        this.contextMenu.classList.remove('hidden');

        // ショートカットコンテキストを有効化
        if (this.shortcutManager) {
            this.shortcutManager.setActiveContext('outline');
        }
    }

    /**
     * 座標指定でコンテキストメニューを表示します（右クリック用）。
     * 
     * @param {string} headingId - 見出しID
     * @param {number} level - 見出しレベル
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @private
     */
    _showContextMenuAtCoords(headingId, level, x, y) {
        if (!this.contextMenu || this._locked) return;

        this.contextMenuTargetId = headingId;

        // 以前のアンカーをクリア
        if (this.currentAnchorButton) {
            this.currentAnchorButton.style.anchorName = '';
            this.currentAnchorButton = null;
        }

        // 座標指定クラスを追加（Anchor Positioningを無効化）
        this.contextMenu.classList.add('positioned-by-coords');
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.style.left = `${x}px`;

        this._updateContextMenuState(level, headingId);
        this.contextMenu.classList.remove('hidden');
    }

    /**
     * コンテキストメニューの項目の有効/無効状態を更新します。
     * 
     * @param {number} level - 見出しレベル
     * @param {string} headingId - 見出しID
     * @private
     */
    _updateContextMenuState(level, headingId) {
        if (!this.contextMenu) return;

        const promoteItem = this.contextMenu.querySelector('[data-action="promote"]');
        const demoteItem = this.contextMenu.querySelector('[data-action="demote"]');
        const moveUpItem = this.contextMenu.querySelector('[data-action="moveUp"]');
        const moveDownItem = this.contextMenu.querySelector('[data-action="moveDown"]');

        // 階層移動の有効/無効
        if (promoteItem) {
            promoteItem.classList.toggle('disabled', level <= 1);
        }
        if (demoteItem) {
            demoteItem.classList.toggle('disabled', level >= 4);
        }

        // 上下移動の有効/無効（同階層の前後要素があるかどうか）
        const { canMoveUp, canMoveDown } = this._canMoveHeading(headingId, level);
        if (moveUpItem) {
            moveUpItem.classList.toggle('disabled', !canMoveUp);
        }
        if (moveDownItem) {
            moveDownItem.classList.toggle('disabled', !canMoveDown);
        }
    }

    /**
     * 見出しが上下に移動可能かどうかを判定します。
     * 
     * @param {string} headingId - 見出しID
     * @param {number} level - 見出しレベル
     * @returns {{canMoveUp: boolean, canMoveDown: boolean}}
     * @private
     */
    _canMoveHeading(headingId, level) {
        const headings = this.getHeadings();
        const currentIndex = headings.findIndex(h => h.id === headingId);

        if (currentIndex === -1) {
            return { canMoveUp: false, canMoveDown: false };
        }

        // 同レベルの前の見出しを探す
        let canMoveUp = false;
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (headings[i].level === level) {
                canMoveUp = true;
                break;
            }
            if (headings[i].level < level) {
                // 親レベルに到達した場合、それより前には移動できない
                break;
            }
        }

        // 同レベルの次の見出しを探す
        let canMoveDown = false;
        for (let i = currentIndex + 1; i < headings.length; i++) {
            if (headings[i].level === level) {
                canMoveDown = true;
                break;
            }
            if (headings[i].level < level) {
                // 親レベルに到達した場合、それより後には移動できない
                break;
            }
        }

        return { canMoveUp, canMoveDown };
    }

    /**
     * コンテキストメニューを非表示にします。
     */
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.add('hidden');
        }
        if (this.currentAnchorButton) {
            this.currentAnchorButton.style.anchorName = '';
            this.currentAnchorButton = null;
        }
        this.contextMenuTargetId = null;

        // ショートカットコンテキストを無効化
        if (this.shortcutManager) {
            this.shortcutManager.setActiveContext(null);
        }
    }

    /**
     * コンテキストメニューのアクションを処理します。
     * 
     * @param {string} action - アクション名
     * @private
     */
    _handleContextMenuAction(action) {
        if (!this.contextMenuTargetId || !this.editor.tiptap) return;

        switch (action) {
            case 'promote':
                this._promoteHeading(this.contextMenuTargetId);
                break;
            case 'demote':
                this._demoteHeading(this.contextMenuTargetId);
                break;
            case 'moveUp':
                this._moveHeadingUp(this.contextMenuTargetId);
                break;
            case 'moveDown':
                this._moveHeadingDown(this.contextMenuTargetId);
                break;
            case 'changeIcon':
                this._openIconPickerForTarget();
                return; // メニューを閉じてアイコンピッカーを開くため、状態更新をスキップ
        }

        // 操作後にメニュー項目の有効/無効状態を更新
        this._refreshContextMenuState();
    }

    /**
     * 外部からアクションを実行します（ショートカットキー用）。
     * 
     * @param {string} action - アクション名
     * @param {string} headingId - 見出しID
     */
    executeAction(action, headingId) {
        if (!headingId || !this.editor.tiptap) return;

        switch (action) {
            case 'promote':
                this._promoteHeading(headingId);
                break;
            case 'demote':
                this._demoteHeading(headingId);
                break;
            case 'moveUp':
                this._moveHeadingUp(headingId);
                break;
            case 'moveDown':
                this._moveHeadingDown(headingId);
                break;
        }
    }

    /**
     * 現在のターゲット見出しのアイコンピッカーを開きます。
     * @private
     */
    _openIconPickerForTarget() {
        if (!this.contextMenuTargetId || !this.outlineList) return;

        // hideContextMenu で ID がクリアされるため先に保存
        const targetHeadingId = this.contextMenuTargetId;

        // コンテキストメニューを閉じる
        this.hideContextMenu();

        // ターゲット見出しのアイコン要素を検索
        const wrapper = this.outlineList.querySelector(`[data-heading-id="${targetHeadingId}"]`);
        if (wrapper) {
            const iconEl = wrapper.querySelector('.outline-icon');
            if (iconEl) {
                this.showIconPicker(targetHeadingId, iconEl);
            }
        }
    }

    /**
     * コンテキストメニューの状態を現在の見出し情報に基づいて更新します。
     * @private
     */
    _refreshContextMenuState() {
        if (!this.contextMenuTargetId || !this.editor.tiptap) return;

        // 現在の見出しのレベルを取得
        let currentLevel = null;
        this.editor.tiptap.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && node.attrs.id === this.contextMenuTargetId) {
                currentLevel = node.attrs.level;
                return false;
            }
        });

        if (currentLevel !== null) {
            this._updateContextMenuState(currentLevel, this.contextMenuTargetId);
        }

        // DOM再構築後の新しいボタン要素にアンカーを再設定
        this._reanchorToCurrentTarget();
    }

    /**
     * 現在のターゲット見出しのメニューボタンにアンカーを再設定します。
     * @private
     */
    _reanchorToCurrentTarget() {
        if (!this.contextMenuTargetId || !this.outlineList) return;

        // 以前のアンカーをクリア
        if (this.currentAnchorButton) {
            this.currentAnchorButton.style.anchorName = '';
        }

        // 新しいボタン要素を検索
        const wrapper = this.outlineList.querySelector(`[data-heading-id="${this.contextMenuTargetId}"]`);
        if (wrapper) {
            const newButton = wrapper.querySelector('.outline-menu-btn');
            if (newButton) {
                this.currentAnchorButton = newButton;
                newButton.style.anchorName = '--outline-menu-anchor';
            }
        }
    }

    /**
     * 見出しの階層を上げます（例: H2 -> H1）。
     * 
     * @param {string} headingId - 見出しID
     * @private
     */
    _promoteHeading(headingId) {
        this.editor.tiptap.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && node.attrs.id === headingId) {
                const currentLevel = node.attrs.level;
                if (currentLevel > 1) {
                    this.editor.tiptap.chain()
                        .setNodeSelection(pos)
                        .updateAttributes('heading', { level: currentLevel - 1 })
                        .run();
                }
                return false;
            }
        });
        this.updateOutline();
    }

    /**
     * 見出しの階層を下げます（例: H1 -> H2）。
     * 
     * @param {string} headingId - 見出しID
     * @private
     */
    _demoteHeading(headingId) {
        this.editor.tiptap.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && node.attrs.id === headingId) {
                const currentLevel = node.attrs.level;
                if (currentLevel < 4) {
                    this.editor.tiptap.chain()
                        .setNodeSelection(pos)
                        .updateAttributes('heading', { level: currentLevel + 1 })
                        .run();
                }
                return false;
            }
        });
        this.updateOutline();
    }

    /**
     * 見出しセクションを上へ移動します。
     * 
     * @param {string} headingId - 見出しID
     * @private
     */
    _moveHeadingUp(headingId) {
        const headings = this.getHeadings();
        const currentIndex = headings.findIndex(h => h.id === headingId);
        if (currentIndex === -1) return;

        const currentHeading = headings[currentIndex];
        const level = currentHeading.level;

        // 移動先（同レベルの前の見出し）を探す
        let targetIndex = -1;
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (headings[i].level === level) {
                targetIndex = i;
                break;
            }
            if (headings[i].level < level) {
                break;
            }
        }

        if (targetIndex === -1) return;

        this._swapHeadingSections(targetIndex, currentIndex, headings);
    }

    /**
     * 見出しセクションを下へ移動します。
     * 
     * @param {string} headingId - 見出しID
     * @private
     */
    _moveHeadingDown(headingId) {
        const headings = this.getHeadings();
        const currentIndex = headings.findIndex(h => h.id === headingId);
        if (currentIndex === -1) return;

        const currentHeading = headings[currentIndex];
        const level = currentHeading.level;

        // 移動先（同レベルの次の見出し）を探す
        let targetIndex = -1;
        for (let i = currentIndex + 1; i < headings.length; i++) {
            if (headings[i].level === level) {
                targetIndex = i;
                break;
            }
            if (headings[i].level < level) {
                break;
            }
        }

        if (targetIndex === -1) return;

        this._swapHeadingSections(currentIndex, targetIndex, headings);
    }

    /**
     * 2つの見出しセクションを入れ替えます。
     * 
     * @param {number} firstIndex - 最初の見出しのインデックス
     * @param {number} secondIndex - 2番目の見出しのインデックス
     * @param {Array} headings - 見出し配列
     * @private
     */
    _swapHeadingSections(firstIndex, secondIndex, headings) {
        const doc = this.editor.tiptap.state.doc;
        const tr = this.editor.tiptap.state.tr;

        const firstHeading = headings[firstIndex];
        const secondHeading = headings[secondIndex];

        // 各セクションの範囲を取得
        const firstRange = this._getHeadingSectionRange(firstHeading.id, firstHeading.level, headings, firstIndex);
        const secondRange = this._getHeadingSectionRange(secondHeading.id, secondHeading.level, headings, secondIndex);

        if (!firstRange || !secondRange) return;

        // セクションのコンテンツを取得
        const firstContent = doc.slice(firstRange.from, firstRange.to);
        const secondContent = doc.slice(secondRange.from, secondRange.to);

        // 後ろから順に置き換え（位置がずれないように）
        tr.replaceRange(secondRange.from, secondRange.to, firstContent);
        tr.replaceRange(firstRange.from, firstRange.to, secondContent);

        this.editor.tiptap.view.dispatch(tr);
        this.updateOutline();
    }

    /**
     * 見出しセクションの範囲（from, to）を取得します。
     * 
     * @param {string} headingId - 見出しID
     * @param {number} level - 見出しレベル
     * @param {Array} headings - 見出し配列
     * @param {number} index - 見出しのインデックス
     * @returns {{from: number, to: number}|null}
     * @private
     */
    _getHeadingSectionRange(headingId, level, headings, index) {
        let fromPos = null;
        let toPos = null;

        this.editor.tiptap.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && node.attrs.id === headingId) {
                fromPos = pos;
            }
        });

        if (fromPos === null) return null;

        // 次の同レベル以上の見出し、またはドキュメント末尾までを範囲とする
        for (let i = index + 1; i < headings.length; i++) {
            if (headings[i].level <= level) {
                // 次の同レベル以上の見出しの開始位置を取得
                this.editor.tiptap.state.doc.descendants((node, pos) => {
                    if (node.type.name === 'heading' && node.attrs.id === headings[i].id) {
                        toPos = pos;
                        return false;
                    }
                });
                break;
            }
        }

        if (toPos === null) {
            toPos = this.editor.tiptap.state.doc.content.size;
        }

        return { from: fromPos, to: toPos };
    }
}
