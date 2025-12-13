/**
 * エディタロジック
 * テキストの入力、画像の挿入、ツールバーの操作、ルビ機能などを担当します。
 */
import { debounce, rgbToHex, generateId } from './utils.js';
import { Sanitizer } from './sanitizer.js';
import { CONFIG } from './config.js';
import { TOGGLE_ICONS, OUTLINE_ICONS, getIconList } from './outlineIcons.js';

/**
 * エディタのロジックを管理するクラス
 */
export class EditorManager {
    /**
     * @param {import('./eventBus.js').EventBus} eventBus - イベントバス
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.sanitizer = new Sanitizer();
        this.savedSelection = null;

        // アウトライン機能の状態管理
        this.outlineCollapsedState = new Map(); // 折りたたみ状態を保持 (headingId => boolean)
        this.currentIconTarget = null; // 現在アイコンを編集中の見出し要素
        this.lastActiveHeadingId = null; // 前回のハイライト状態をキャッシュ

        // DOM要素の参照を取得
        this._initDOMReferences();
        this.init();
    }

    // ========================================
    // 初期化
    // ========================================

    /**
     * DOM要素の参照を初期化します。
     * @private
     */
    _initDOMReferences() {
        this.editor = document.getElementById('editor');
        this.outlineList = document.getElementById('outline-list');
        this.floatToolbar = document.getElementById('float-toolbar');
        this.textColorPicker = document.getElementById('textColorPicker');
        this.highlightPicker = document.getElementById('highlightPicker');

        // ルビパネル関連
        this.rubyPanel = document.getElementById('ruby-panel');
        this.rubyInput = document.getElementById('ruby-input');
        this.rubyApplyBtn = document.getElementById('ruby-apply-btn');
        this.rubyDeleteBtn = document.getElementById('ruby-delete-btn');
        this.rubyBtn = document.getElementById('rubyBtn');

        // アイコンピッカー関連
        this.iconPicker = document.getElementById('outline-icon-picker');
    }

    /**
     * エディタを初期化します。
     */
    init() {
        this._setupInputHandler();
        this._setupSelectionHandler();
        this._setupImageHandling();
        this._setupToolbarActions();
        this._setupRubyProtection();
        this._setupRubyPanel();
        this._setupCopyHandler();
        this._setupEventBusListeners();
        this._setupIconPicker();
    }

    /**
     * 入力ハンドラをセットアップします。
     * @private
     */
    _setupInputHandler() {
        this.editor.addEventListener('input', debounce(() => {
            this.updateOutline();
            this.eventBus.emit('editor:update', this.getHeadings());
        }, CONFIG.EDITOR.DEBOUNCE_WAIT));
    }

    /**
     * 選択変更ハンドラをセットアップします。
     * @private
     */
    _setupSelectionHandler() {
        // アウトラインハイライト更新用のデバウンス処理（10ms）
        const debouncedOutlineUpdate = debounce((node) => {
            this._updateOutlineHighlightByPosition(node);
        }, 10);

        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const isInsideEditor = this.editor.contains(container) || container === this.editor;

            // アウトラインハイライト更新（デバウンス付き）
            if (isInsideEditor) {
                debouncedOutlineUpdate(range.startContainer);
            }

            // フローティングツールバーの処理は即時実行
            this._handleFloatToolbar(selection, range, isInsideEditor);
        });
    }

    /**
     * EventBusリスナーをセットアップします。
     * @private
     */
    _setupEventBusListeners() {
        this.eventBus.on('editor:scrollToHeading', (headingId) => {
            this.scrollToHeading(headingId);
        });
    }

    // ========================================
    // コンテンツ操作
    // ========================================

    /**
     * エディタのHTMLコンテンツを取得します。
     * @returns {string} エディタのHTMLコンテンツ
     */
    getContent() {
        return this.editor.innerHTML;
    }

    /**
     * エディタにHTMLコンテンツを設定します。
     * @param {string} html - 設定するHTMLコンテンツ
     */
    setContent(html) {
        const sanitizedHtml = this.sanitizer.sanitize(html);
        this.editor.innerHTML = sanitizedHtml;
        this.updateOutline();
        this.eventBus.emit('editor:update', this.getHeadings());
    }

    /**
     * 直前の操作を取り消します（Undo）。
     * @returns {boolean} 操作が成功したかどうか
     */
    undo() {
        this.editor.focus();
        return document.execCommand('undo', false, null);
    }

    /**
     * 取り消した操作をやり直します（Redo）。
     * @returns {boolean} 操作が成功したかどうか
     */
    redo() {
        this.editor.focus();
        return document.execCommand('redo', false, null);
    }

    // ========================================
    // スタイル適用
    // ========================================

    /**
     * 選択範囲にスタイルを適用します。
     * @param {string} style - スタイル名
     * @param {string|null} value - スタイルの値
     * @returns {boolean} 操作が成功したかどうか
     */
    applyStyle(style, value = null) {
        this.editor.focus();
        return document.execCommand(style, false, value);
    }

    /**
     * 選択範囲の見出しレベルを設定します。
     * @param {number} level - 見出しレベル（1-4）、0の場合は通常の段落
     * @returns {boolean} 操作が成功したかどうか
     */
    setHeadingLevel(level) {
        this.editor.focus();
        const tag = level === 0 ? 'p' : `h${level}`;
        return document.execCommand('formatBlock', false, tag);
    }

    /**
     * 選択範囲のテキスト色を設定します。
     * @param {string} color - 色（HEX形式またはRGB形式）
     * @returns {boolean} 操作が成功したかどうか
     */
    setTextColor(color) {
        this.editor.focus();
        const rubyElements = this._getRubyElementsInSelection();
        const result = document.execCommand('foreColor', false, color);

        // ルビ要素のrt要素にも色を適用
        rubyElements.forEach(ruby => {
            const rt = ruby.querySelector('rt');
            if (rt) rt.style.color = color;
        });

        return result;
    }

    /**
     * 選択範囲の背景色（ハイライト）を設定します。
     * @param {string} color - 色（HEX形式またはRGB形式）
     * @returns {boolean} 操作が成功したかどうか
     */
    setBackgroundColor(color) {
        this.editor.focus();
        const rubyElements = this._getRubyElementsInSelection();
        const result = document.execCommand('hiliteColor', false, color);

        // ルビ要素のrt要素にも色を適用
        rubyElements.forEach(ruby => {
            const rt = ruby.querySelector('rt');
            if (rt) rt.style.backgroundColor = color;
        });

        return result;
    }

    // ========================================
    // ツールバー
    // ========================================

    /**
     * ツールバーアクションをセットアップします。
     * @private
     */
    _setupToolbarActions() {
        // コマンドボタン
        this.floatToolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand(btn.dataset.cmd, false, null);
                this._updateToolbarState();
            });
        });

        // フォーマットブロック選択
        const formatSelect = document.getElementById('formatBlockSelect');
        formatSelect.addEventListener('change', () => {
            document.execCommand('formatBlock', false, formatSelect.value);
            this.editor.focus();
        });

        // カラーピッカー
        this._setupColorPicker('textColorBtn', 'textColorPicker', 'foreColor');
        this._setupColorPicker('highlightBtn', 'highlightPicker', 'hiliteColor');

        // ルビとコードブロック
        document.getElementById('rubyBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.insertRuby();
        });
        document.getElementById('codeBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.insertCodeBlock();
        });
    }

    /**
     * カラーピッカーをセットアップします。
     * @private
     */
    _setupColorPicker(btnId, pickerId, command) {
        const btn = document.getElementById(btnId);
        const picker = document.getElementById(pickerId);
        const colors = CONFIG.EDITOR.COLORS;

        picker.innerHTML = '';
        colors.forEach(color => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                // ルビ要素のrt要素にも色を適用するため、専用メソッドを使用
                if (command === 'foreColor') {
                    this.setTextColor(color);
                } else if (command === 'hiliteColor') {
                    this.setBackgroundColor(color);
                } else {
                    document.execCommand(command, false, color);
                }
                picker.classList.add('hidden');
            });
            picker.appendChild(div);
        });

        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            picker.classList.toggle('hidden');
            const rect = btn.getBoundingClientRect();
            picker.style.top = `${rect.bottom + 5 + window.scrollY}px`;
            picker.style.left = `${rect.left + window.scrollX}px`;
        });
    }

    /**
     * 選択変更時のフローティングツールバー処理を行います。
     * @private
     */
    _handleFloatToolbar(selection, range, isInsideEditor) {
        if (!isInsideEditor || selection.isCollapsed) {
            this._hideFloatToolbar();
            return;
        }

        this._showFloatToolbar(range);
        this._updateToolbarState();
    }

    /**
     * カーソル位置に応じてアウトラインのハイライトを更新します。
     * @private
     * @param {Node} cursorNode - カーソルがあるノード
     */
    _updateOutlineHighlightByPosition(cursorNode) {
        if (!cursorNode) return;

        // カーソル位置から最も近い親の見出しを見つける（現在位置が属するセクション）
        const headings = Array.from(this.editor.querySelectorAll('h1, h2, h3, h4'));
        if (headings.length === 0) return;

        // カーソル位置を取得
        let currentNode = cursorNode;
        if (currentNode.nodeType === Node.TEXT_NODE) {
            currentNode = currentNode.parentNode;
        }

        // 各見出しとカーソル位置の関係を判定
        let activeHeadingId = null;

        for (let i = headings.length - 1; i >= 0; i--) {
            const heading = headings[i];

            // カーソル位置がこの見出し以降にあるかをチェック
            const position = heading.compareDocumentPosition(currentNode);

            // currentNodeがheadingの後ろにある、またはheading自体である
            if (position & Node.DOCUMENT_POSITION_FOLLOWING ||
                position === 0 ||
                heading.contains(currentNode) ||
                currentNode === heading) {
                activeHeadingId = heading.id;
                break;
            }
        }

        // 前回と同じ場合は更新をスキップ（チカチカ防止）
        if (this.lastActiveHeadingId === activeHeadingId) {
            return;
        }

        // 一元的なハイライト管理メソッドを呼び出し
        this._setOutlineHighlight(activeHeadingId);
    }

    /**
     * アウトラインのハイライト状態を設定します。
     * これはハイライト管理の唯一のエントリーポイントです。
     * @private
     * @param {string|null} headingId - ハイライトする見出しのID、nullの場合はハイライトを解除
     * @param {boolean} skipCache - キャッシュチェックをスキップするか（デフォルト: false）
     */
    _setOutlineHighlight(headingId, skipCache = false) {
        // キャッシュを更新
        this.lastActiveHeadingId = headingId;

        // まず全てのactiveとhas-hidden-activeクラスを削除
        this.outlineList.querySelectorAll('.outline-item').forEach(item => {
            item.classList.remove('active', 'has-hidden-active');
        });

        if (!headingId) return;

        // 該当するアウトラインアイテムを検索
        const activeItem = this.outlineList.querySelector(
            `.outline-item[data-heading-id="${headingId}"]`
        );

        if (activeItem) {
            // 該当アイテムが表示されているかチェック
            const wrapper = activeItem.closest('.outline-item-wrapper');
            const isVisible = this._isOutlineItemVisible(wrapper);

            if (isVisible) {
                // 表示されている場合は通常のハイライト
                activeItem.classList.add('active');
            } else {
                // 折りたたまれている場合は、表示されている親にインジケーターを追加
                const visibleParent = this._findVisibleParentOutlineItem(wrapper);
                if (visibleParent) {
                    visibleParent.classList.add('has-hidden-active');
                }
            }
        }
    }

    /**
     * アウトラインアイテムが表示されているかどうかを判定します。
     * @private
     * @param {HTMLElement} wrapper - アウトラインアイテムのラッパー要素
     * @returns {boolean} 表示されている場合true
     */
    _isOutlineItemVisible(wrapper) {
        if (!wrapper) return false;

        // wrapperが折りたたまれたコンテナ内にあるかチェック
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
     * @private
     * @param {HTMLElement} wrapper - アウトラインアイテムのラッパー要素
     * @returns {HTMLElement|null} 表示されている親のoutline-item要素
     */
    _findVisibleParentOutlineItem(wrapper) {
        if (!wrapper) return null;

        let parent = wrapper.parentElement;
        while (parent && parent !== this.outlineList) {
            // 親のwrapperを見つける
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
     * フローティングツールバーを表示します。
     * @private
     */
    _showFloatToolbar(range) {
        const rect = range.getBoundingClientRect();
        const toolbarRect = this.floatToolbar.getBoundingClientRect();
        const margin = 10;

        let top = rect.top - toolbarRect.height - margin;
        let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);

        // 境界チェック
        if (top < margin) top = rect.bottom + margin;
        if (left < margin) left = margin;
        if (left + toolbarRect.width > window.innerWidth - margin) {
            left = window.innerWidth - toolbarRect.width - margin;
        }

        this.floatToolbar.style.top = `${top + window.scrollY}px`;
        this.floatToolbar.style.left = `${left + window.scrollX}px`;
        this.floatToolbar.classList.remove('hidden');
    }

    /**
     * フローティングツールバーを非表示にします。
     * @private
     */
    _hideFloatToolbar() {
        this.floatToolbar.classList.add('hidden');
        this.textColorPicker.classList.add('hidden');
        this.highlightPicker.classList.add('hidden');
    }

    /**
     * ツールバーの状態を更新します。
     * @private
     */
    _updateToolbarState() {
        const commands = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];
        commands.forEach(cmd => {
            const btn = this.floatToolbar.querySelector(`button[data-cmd="${cmd}"]`);
            if (btn) {
                btn.classList.toggle('active', document.queryCommandState(cmd));
            }
        });

        const formatSelect = document.getElementById('formatBlockSelect');
        const selection = window.getSelection();
        if (selection.rangeCount) {
            let parent = selection.getRangeAt(0).commonAncestorContainer;
            if (parent.nodeType === 3) parent = parent.parentNode;

            const tagName = parent.tagName?.toLowerCase();
            const validTags = ['p', 'h1', 'h2', 'h3', 'h4', 'pre', 'blockquote'];
            formatSelect.value = validTags.includes(tagName) ? tagName : 'p';
        }
    }

    // ========================================
    // 見出し・アウトライン
    // ========================================

    /**
     * エディタ内の見出し要素を取得します。
     * @returns {Array<{text: string, level: number, element: HTMLElement, id: string}>}
     */
    getHeadings() {
        return Array.from(this.editor.querySelectorAll('h1, h2, h3, h4')).map(h => {
            if (!h.id) h.id = generateId();
            return {
                text: h.textContent,
                level: parseInt(h.tagName[1]),
                element: h,
                id: h.id
            };
        });
    }

    /**
     * アウトラインを更新します。
     * 階層構造、折りたたみ・展開、アイコン設定に対応
     */
    updateOutline() {
        this.outlineList.innerHTML = '';
        const headings = Array.from(this.editor.querySelectorAll('h1, h2, h3, h4'));

        if (headings.length === 0) return;

        // 各見出しにIDを付与
        headings.forEach(h => {
            if (!h.id) h.id = generateId();
        });

        // 階層構造を構築
        const rootItems = this._buildOutlineHierarchy(headings);

        // DOM要素を生成
        rootItems.forEach(item => {
            const element = this._createOutlineItemElement(item);
            this.outlineList.appendChild(element);
        });

        // DOM再構築後にハイライト状態を再適用
        // キャッシュをリセットして強制的に更新
        this.lastActiveHeadingId = null;
        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            if (this.editor.contains(range.startContainer)) {
                this._updateOutlineHighlightByPosition(range.startContainer);
            }
        }
    }

    /**
     * 見出しリストから階層構造を構築します。
     * @private
     * @param {HTMLElement[]} headings - 見出し要素の配列
     * @returns {Array} 階層構造化されたアウトラインアイテム
     */
    _buildOutlineHierarchy(headings) {
        const items = headings.map(h => ({
            element: h,
            id: h.id,
            text: h.textContent || '(タイトルなし)',
            level: parseInt(h.tagName[1]),
            icon: h.dataset.outlineIcon || 'document',
            children: []
        }));

        const root = [];
        const stack = [{ level: 0, children: root }];

        items.forEach(item => {
            // 現在のアイテムのレベル以上の要素をスタックから削除
            while (stack.length > 1 && stack[stack.length - 1].level >= item.level) {
                stack.pop();
            }

            // 親の子リストに追加
            stack[stack.length - 1].children.push(item);

            // このアイテムを将来の子のためにスタックに追加
            stack.push({ level: item.level, children: item.children });
        });

        return root;
    }

    /**
     * アウトライン項目のDOM要素を作成します。
     * @private
     * @param {Object} item - アウトラインアイテム
     * @returns {HTMLElement} 作成されたDOM要素
     */
    _createOutlineItemElement(item) {
        const wrapper = document.createElement('div');
        wrapper.className = 'outline-item-wrapper';
        wrapper.dataset.headingId = item.id;
        wrapper.style.paddingLeft = `${(item.level - 1) * 12}px`;

        // メインのアウトラインアイテム
        const itemEl = document.createElement('div');
        itemEl.className = 'outline-item';
        itemEl.dataset.headingId = item.id;

        // アイコン（クリックで変更可能）
        const iconEl = document.createElement('div');
        iconEl.className = 'outline-icon';
        if (item.icon && item.icon !== 'none' && OUTLINE_ICONS[item.icon]) {
            iconEl.innerHTML = OUTLINE_ICONS[item.icon].svg;
        }
        // 未設定の場合は空欄のままにする
        iconEl.title = 'クリックでアイコンを変更';
        iconEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this._showIconPicker(item.element, iconEl);
        });

        // テキスト
        const textEl = document.createElement('span');
        textEl.className = 'outline-text';
        textEl.textContent = item.text;

        itemEl.appendChild(iconEl);
        itemEl.appendChild(textEl);

        // 子要素がある場合は折りたたみトグルを追加
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

        // クリックで見出しにスクロール
        itemEl.addEventListener('click', () => {
            item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 一元的なハイライト管理メソッドを使用
            this._setOutlineHighlight(item.id);
        });

        wrapper.appendChild(itemEl);

        // 子要素を再帰的に追加
        if (item.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'outline-children';

            const isCollapsed = this.outlineCollapsedState.get(item.id) || false;
            if (isCollapsed) {
                childrenContainer.classList.add('collapsed');
            }

            item.children.forEach(child => {
                const childElement = this._createOutlineItemElement(child);
                childrenContainer.appendChild(childElement);
            });

            wrapper.appendChild(childrenContainer);
        }

        return wrapper;
    }

    /**
     * アウトライン項目の折りたたみ・展開を切り替えます。
     * @private
     */
    _toggleOutlineItem(headingId, toggleEl, wrapper) {
        const childrenContainer = wrapper.querySelector('.outline-children');
        if (!childrenContainer) return;

        const isCollapsed = this.outlineCollapsedState.get(headingId) || false;
        const newState = !isCollapsed;

        this.outlineCollapsedState.set(headingId, newState);

        if (newState) {
            childrenContainer.classList.add('collapsed');
            toggleEl.innerHTML = TOGGLE_ICONS.collapsed;
        } else {
            childrenContainer.classList.remove('collapsed');
            toggleEl.innerHTML = TOGGLE_ICONS.expanded;
        }
    }

    /**
     * アイコンピッカーをセットアップします。
     * @private
     */
    _setupIconPicker() {
        if (!this.iconPicker) return;

        // アイコンオプションを動的に生成
        const icons = getIconList();
        this.iconPicker.innerHTML = '';

        icons.forEach(icon => {
            const item = document.createElement('div');
            item.className = 'icon-picker-item';
            item.dataset.iconId = icon.id;
            item.title = icon.name;

            if (icon.svg) {
                item.innerHTML = icon.svg;
            } else {
                item.textContent = '×'; // "なし" の場合
            }

            item.addEventListener('click', () => {
                this._selectIcon(icon.id);
            });

            this.iconPicker.appendChild(item);
        });

        // クリック外で閉じる
        document.addEventListener('click', (e) => {
            if (!this.iconPicker.contains(e.target) &&
                !e.target.closest('.outline-icon')) {
                this._hideIconPicker();
            }
        });
    }

    /**
     * アイコンピッカーを表示します。
     * @private
     */
    _showIconPicker(headingElement, iconEl) {
        this.currentIconTarget = headingElement;

        // 現在のアイコンをハイライト
        const currentIcon = headingElement.dataset.outlineIcon || 'document';
        this.iconPicker.querySelectorAll('.icon-picker-item').forEach(item => {
            item.classList.toggle('active', item.dataset.iconId === currentIcon);
        });

        // 位置を設定
        const rect = iconEl.getBoundingClientRect();
        this.iconPicker.style.top = `${rect.bottom + 5}px`;
        this.iconPicker.style.left = `${rect.left}px`;

        this.iconPicker.classList.remove('hidden');
    }

    /**
     * アイコンピッカーを非表示にします。
     * @private
     */
    _hideIconPicker() {
        if (this.iconPicker) {
            this.iconPicker.classList.add('hidden');
        }
        this.currentIconTarget = null;
    }

    /**
     * アイコンを選択して適用します。
     * @private
     */
    _selectIcon(iconId) {
        if (!this.currentIconTarget) return;

        // 見出し要素にdata属性として保存
        this.currentIconTarget.dataset.outlineIcon = iconId;

        this._hideIconPicker();

        // アウトラインを更新
        this.updateOutline();
    }

    /**
     * 指定されたIDの見出し要素までスクロールします。
     * @param {string} headingId - 見出し要素のID
     */
    scrollToHeading(headingId) {
        const heading = document.getElementById(headingId);
        if (heading && this.editor.contains(heading)) {
            heading.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 一元的なハイライト管理メソッドを使用
            this._setOutlineHighlight(headingId);
        }
    }

    // ========================================
    // 画像処理
    // ========================================

    /**
     * 画像ハンドリングをセットアップします。
     * @private
     */
    _setupImageHandling() {
        // ドラッグ＆ドロップ
        this.editor.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this._handleFiles(files);
            } else {
                const html = e.dataTransfer.getData('text/html');
                if (html) {
                    document.execCommand('insertHTML', false, this.sanitizer.sanitize(html));
                }
            }
        });

        this.editor.addEventListener('dragover', (e) => e.preventDefault());

        // 貼り付け
        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const clipboardData = e.clipboardData || e.originalEvent.clipboardData;
            let hasFile = false;

            for (const item of clipboardData.items) {
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        this._handleFiles([file]);
                        hasFile = true;
                    }
                }
            }

            if (!hasFile) {
                const html = clipboardData.getData('text/html');
                const text = clipboardData.getData('text/plain');

                if (html) {
                    document.execCommand('insertHTML', false, this.sanitizer.sanitize(html));
                } else if (text) {
                    document.execCommand('insertText', false, text);
                }
            }
        });
    }

    /**
     * ファイルを処理します。
     * @private
     */
    _handleFiles(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => this.insertImage(e.target.result);
                reader.readAsDataURL(file);
            }
        });
    }

    /**
     * 画像をエディタに挿入します。
     * @param {string} src - 画像のソース
     * @returns {string} 挿入された画像のID
     */
    insertImage(src) {
        const imageId = generateId();
        const container = this._createImageContainer(imageId);
        const img = this._createImageElement(src, imageId, container);
        const handle = this._createResizeHandle();

        container.appendChild(img);
        container.appendChild(handle);

        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            range.insertNode(container);
            range.collapse(false);
        } else {
            this.editor.appendChild(container);
        }

        this._setupResizeHandler(container, img, handle);
        return imageId;
    }

    /**
     * 画像コンテナを作成します。
     * @private
     */
    _createImageContainer(imageId) {
        const container = document.createElement('div');
        container.className = 'resizable-container';
        container.contentEditable = 'false';
        Object.assign(container.style, {
            position: 'relative',
            display: 'inline-block',
            margin: '10px'
        });
        container.dataset.imageId = imageId;
        return container;
    }

    /**
     * 画像要素を作成します。
     * @private
     */
    _createImageElement(src, imageId, container) {
        const img = document.createElement('img');
        img.src = src;
        img.id = imageId;
        img.style.display = 'block';

        img.onload = () => {
            let initialWidth = Math.min(img.naturalWidth, CONFIG.EDITOR.MAX_IMAGE_WIDTH);
            img.dataset.originalWidth = initialWidth;
            img.style.width = `${initialWidth}px`;
            img.style.height = 'auto';
            container.style.maxWidth = `${initialWidth}px`;
        };

        return img;
    }

    /**
     * リサイズハンドルを作成します。
     * @private
     */
    _createResizeHandle() {
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        Object.assign(handle.style, {
            position: 'absolute',
            bottom: '0',
            right: '0',
            width: '10px',
            height: '10px',
            backgroundColor: '#3b82f6',
            cursor: 'nwse-resize'
        });
        return handle;
    }

    /**
     * 指定されたIDの画像をリサイズします。
     * @param {string} imageId - 画像のID
     * @param {number} width - 新しい幅（ピクセル）
     * @returns {boolean} 操作が成功したかどうか
     */
    resizeImage(imageId, width) {
        const img = document.getElementById(imageId);
        if (!img || !this.editor.contains(img)) return false;

        const newWidth = Math.max(50, Math.min(width, window.innerWidth - 40));
        img.dataset.originalWidth = newWidth;
        img.style.width = `${newWidth}px`;
        img.style.height = 'auto';

        const container = img.parentElement;
        if (container?.classList.contains('resizable-container')) {
            container.style.maxWidth = `${newWidth}px`;
        }

        return true;
    }

    /**
     * リサイズハンドラをセットアップします。
     * @private
     */
    _setupResizeHandler(container, img, handle) {
        let isResizing = false;
        let startX, startWidth;

        const onMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = startWidth + (e.clientX - startX);
            if (newWidth > 50) {
                img.dataset.originalWidth = newWidth;
                img.style.width = `${newWidth}px`;
                img.style.height = 'auto';
                container.style.maxWidth = `${newWidth}px`;
            }
        };

        const onMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startWidth = img.offsetWidth;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // ========================================
    // コピー・カット処理
    // ========================================

    /**
     * コピー/カット時にルビテキストを除外するハンドラをセットアップします。
     * @private
     */
    _setupCopyHandler() {
        const handleClipboard = (e, shouldDelete) => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const textWithoutRt = this._getSelectedTextWithoutRt(range);
            const htmlWithoutRt = this._getSelectedHtmlWithoutRt(range);

            e.clipboardData.setData('text/plain', textWithoutRt);
            e.clipboardData.setData('text/html', htmlWithoutRt);

            if (shouldDelete) range.deleteContents();
            e.preventDefault();
        };

        this.editor.addEventListener('copy', (e) => handleClipboard(e, false));
        this.editor.addEventListener('cut', (e) => handleClipboard(e, true));
    }

    /**
     * 選択範囲内のテキストを取得します（rt要素を除外）。
     * @private
     */
    _getSelectedTextWithoutRt(range) {
        if (!range) return '';
        const fragment = range.cloneContents();
        fragment.querySelectorAll('rt').forEach(rt => rt.remove());
        return fragment.textContent || '';
    }

    /**
     * 選択範囲内のHTMLを取得します（rt要素を除外）。
     * @private
     */
    _getSelectedHtmlWithoutRt(range) {
        if (!range) return '';
        const fragment = range.cloneContents();
        fragment.querySelectorAll('rt, rp').forEach(el => el.remove());
        const div = document.createElement('div');
        div.appendChild(fragment);
        return div.innerHTML;
    }

    // ========================================
    // コードブロック
    // ========================================

    /**
     * コードブロックを挿入します。
     */
    insertCodeBlock() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        const text = range.toString();

        code.textContent = text || 'コードを入力...';
        pre.appendChild(code);

        if (text) range.deleteContents();
        range.insertNode(pre);
        range.setStartAfter(pre);
        range.setEndAfter(pre);
        selection.removeAllRanges();
        selection.addRange(range);
    }


    // ========================================
    // ルビ機能 - パネル操作
    // ========================================

    /**
     * ルビパネルをセットアップします。
     * @private
     */
    _setupRubyPanel() {
        if (!this.rubyPanel || !this.rubyInput || !this.rubyApplyBtn || !this.rubyDeleteBtn) {
            return;
        }

        this.rubyApplyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this._applyRubyFromPanel();
        });

        this.rubyDeleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this._deleteRubyFromPanel();
        });

        this.rubyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._applyRubyFromPanel();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this._hideRubyPanel();
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (!this.rubyPanel.classList.contains('hidden') &&
                !this.rubyPanel.contains(e.target) &&
                e.target !== this.rubyBtn &&
                !this.rubyBtn.contains(e.target)) {
                this._hideRubyPanel();
            }
        });
    }

    /**
     * ルビを挿入します（ルビパネル経由）。
     */
    insertRuby() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const text = range.toString();
        const rubyInfo = this.detectExistingRuby();

        if (!text && !rubyInfo.rubyElement) return;

        this._showRubyPanel();
    }

    /**
     * ルビパネルを表示します。
     * @private
     */
    _showRubyPanel() {
        if (!this.rubyPanel || !this.rubyBtn) return;

        this._saveSelectionForRuby();
        const rubyInfo = this.detectExistingRuby();
        this.rubyInput.value = rubyInfo.rubyText || '';

        this.rubyPanel.classList.remove('hidden');
        const position = this._calculateRubyPanelPosition(this.rubyBtn);
        this.rubyPanel.style.top = `${position.top}px`;
        this.rubyPanel.style.left = `${position.left}px`;

        setTimeout(() => {
            this.rubyInput.focus();
            this.rubyInput.select();
        }, 0);
    }

    /**
     * ルビパネルを非表示にします。
     * @private
     */
    _hideRubyPanel() {
        if (!this.rubyPanel) return;
        this.rubyPanel.classList.add('hidden');
        this.rubyInput.value = '';
    }

    /**
     * ルビパネルの位置を計算します。
     * @private
     */
    _calculateRubyPanelPosition(anchorElement) {
        const anchorRect = anchorElement.getBoundingClientRect();
        const panelRect = this.rubyPanel.getBoundingClientRect();
        const panelWidth = panelRect.width || 200;
        const panelHeight = panelRect.height || 100;
        const margin = 10;
        const gap = 5;

        let top = anchorRect.bottom + gap + window.scrollY;
        let left = anchorRect.left + (anchorRect.width / 2) - (panelWidth / 2) + window.scrollX;

        // 画面端のチェック
        left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

        if (top + panelHeight > window.innerHeight + window.scrollY - margin) {
            top = anchorRect.top - panelHeight - gap + window.scrollY;
        }

        top = Math.max(window.scrollY + margin, top);
        const maxTop = window.innerHeight + window.scrollY - panelHeight - margin;
        top = Math.min(top, maxTop);

        return { top, left };
    }

    /**
     * ルビパネル用に選択範囲を保存します。
     * @private
     */
    _saveSelectionForRuby() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.savedSelection = selection.getRangeAt(0).cloneRange();
        }
    }

    /**
     * 保存した選択範囲を復元します。
     * @private
     */
    _restoreSelectionForRuby() {
        if (this.savedSelection) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedSelection);
        }
    }

    /**
     * ルビパネルからルビを適用します。
     * @private
     */
    _applyRubyFromPanel() {
        const rubyText = this.rubyInput.value.trim();
        if (!rubyText) {
            this._hideRubyPanel();
            return;
        }

        this._restoreSelectionForRuby();
        const rubyInfo = this.detectExistingRuby();

        if (rubyInfo.rubyElement) {
            this.updateRuby(rubyInfo.rubyElement, rubyText);
        } else {
            this.setRuby(rubyText);
        }

        this._hideRubyPanel();
        this.editor.focus();
    }

    /**
     * ルビパネルからルビを削除します。
     * @private
     */
    _deleteRubyFromPanel() {
        this._restoreSelectionForRuby();
        const rubyInfo = this.detectExistingRuby();

        if (rubyInfo.rubyElement) {
            this.removeRuby(rubyInfo.rubyElement);
        }

        this._hideRubyPanel();
        this.editor.focus();
    }

    // ========================================
    // ルビ機能 - CRUD操作
    // ========================================

    /**
     * 選択範囲にルビを設定します。
     * @param {string} rubyText - ルビテキスト
     * @returns {boolean} 操作が成功したかどうか
     */
    setRuby(rubyText) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        const text = range.toString();
        if (!text) return false;

        const styles = this._getFirstCharacterStyles(range);
        const contents = range.extractContents();

        const ruby = document.createElement('ruby');
        ruby.appendChild(contents);

        const rt = document.createElement('rt');
        rt.textContent = rubyText;
        // rt要素を編集不可にすることで、カーソルがrt内に入らなくなる
        rt.contentEditable = 'false';
        if (styles.color) rt.style.color = styles.color;
        if (styles.backgroundColor) rt.style.backgroundColor = styles.backgroundColor;

        ruby.appendChild(rt);
        range.insertNode(ruby);

        range.setStartAfter(ruby);
        range.setEndAfter(ruby);
        selection.removeAllRanges();
        selection.addRange(range);

        return true;
    }

    /**
     * 既存のルビ要素を更新します。
     * @param {HTMLElement} rubyElement - 更新対象のruby要素
     * @param {string} newRubyText - 新しいルビテキスト
     * @returns {boolean} 操作が成功したかどうか
     */
    updateRuby(rubyElement, newRubyText) {
        if (!rubyElement || rubyElement.tagName !== 'RUBY' || !newRubyText) return false;

        const styles = this._getRubyBaseTextStyles(rubyElement);
        let rtElement = rubyElement.querySelector('rt');

        if (rtElement) {
            rtElement.textContent = newRubyText;
        } else {
            rtElement = document.createElement('rt');
            rtElement.textContent = newRubyText;
            rubyElement.appendChild(rtElement);
        }

        // rt要素を編集不可にすることで、カーソルがrt内に入らなくなる
        rtElement.contentEditable = 'false';
        if (styles.color) rtElement.style.color = styles.color;
        if (styles.backgroundColor) rtElement.style.backgroundColor = styles.backgroundColor;

        return true;
    }

    /**
     * ルビ要素を削除し、ベーステキストのみを残します。
     * @param {HTMLElement} rubyElement - 削除対象のruby要素
     * @returns {boolean} 操作が成功したかどうか
     */
    removeRuby(rubyElement) {
        if (!rubyElement || rubyElement.tagName !== 'RUBY') return false;

        const baseText = this._getBaseTextFromRuby(rubyElement);
        const styles = this._getRubyBaseTextStyles(rubyElement);
        const parent = rubyElement.parentNode;
        if (!parent) return false;

        if (styles.color || styles.backgroundColor) {
            const span = document.createElement('span');
            span.textContent = baseText;
            if (styles.color) span.style.color = styles.color;
            if (styles.backgroundColor) span.style.backgroundColor = styles.backgroundColor;
            parent.replaceChild(span, rubyElement);
        } else {
            parent.replaceChild(document.createTextNode(baseText), rubyElement);
        }

        return true;
    }

    /**
     * 選択範囲内の既存ルビ要素を検出します。
     * @param {Selection} [selection] - 選択範囲
     * @returns {{rubyElement: HTMLElement|null, rubyText: string, baseText: string}}
     */
    detectExistingRuby(selection = null) {
        const sel = selection || window.getSelection();
        const result = { rubyElement: null, rubyText: '', baseText: '' };

        if (!sel || !sel.rangeCount) return result;

        const range = sel.getRangeAt(0);
        let container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;

        // ruby要素を探す
        if (container.tagName === 'RUBY') {
            result.rubyElement = container;
        } else if (container.tagName === 'RT') {
            result.rubyElement = container.closest('ruby');
        } else {
            const rubyInRange = container.querySelector?.('ruby');
            if (rubyInRange && range.intersectsNode(rubyInRange)) {
                result.rubyElement = rubyInRange;
            } else {
                result.rubyElement = container.closest?.('ruby') || null;
            }
        }

        if (result.rubyElement) {
            const rtElement = result.rubyElement.querySelector('rt');
            result.rubyText = rtElement?.textContent || '';
            result.baseText = this._getBaseTextFromRuby(result.rubyElement);
        }

        return result;
    }

    // ========================================
    // ルビ機能 - スタイル取得
    // ========================================

    /**
     * 選択範囲の先頭1文字のスタイルを取得します。
     * @private
     */
    _getFirstCharacterStyles(range) {
        const result = { color: null, backgroundColor: null };
        if (!range) return result;

        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

        if (node?.nodeType === Node.ELEMENT_NODE) {
            this._extractStylesFromElement(node, result);
        }

        return result;
    }

    /**
     * ruby要素のベーステキストのスタイルを取得します。
     * @private
     */
    _getRubyBaseTextStyles(rubyElement) {
        const result = { color: null, backgroundColor: null };
        if (!rubyElement) return result;

        // ruby要素自体のスタイルを確認
        this._extractStylesFromElement(rubyElement, result);

        // ruby要素の子要素（rt以外）のスタイルも確認
        // 色変更時にfontタグやspanタグが追加されるため
        for (const child of rubyElement.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'RT' && child.tagName !== 'RP') {
                const childResult = { color: null, backgroundColor: null };
                this._extractStylesFromElement(child, childResult);
                // 子要素のスタイルを優先
                if (childResult.color) result.color = childResult.color;
                if (childResult.backgroundColor) result.backgroundColor = childResult.backgroundColor;
            }
        }

        return result;
    }

    /**
     * 要素からスタイルを抽出します。
     * @private
     */
    _extractStylesFromElement(element, result) {
        const computedStyle = window.getComputedStyle(element);

        const color = computedStyle.color;
        if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') {
            result.color = color;
        }

        const bgColor = computedStyle.backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            result.backgroundColor = bgColor;
        }

        // インラインスタイルを優先
        if (element.style?.color) result.color = element.style.color;
        if (element.style?.backgroundColor) result.backgroundColor = element.style.backgroundColor;

        // 親要素のスタイルも確認
        let parent = element.parentNode;
        while (parent && parent !== this.editor) {
            if (parent.nodeType === Node.ELEMENT_NODE && parent.style) {
                if (parent.style.color && !result.color) result.color = parent.style.color;
                if (parent.style.backgroundColor && !result.backgroundColor) {
                    result.backgroundColor = parent.style.backgroundColor;
                }
            }
            parent = parent.parentNode;
        }
    }

    /**
     * ruby要素からベーステキストを取得します。
     * @private
     */
    _getBaseTextFromRuby(rubyElement) {
        if (!rubyElement) return '';
        let baseText = '';
        for (const node of rubyElement.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                baseText += node.textContent;
            } else if (node.tagName !== 'RT' && node.tagName !== 'RP') {
                baseText += node.textContent;
            }
        }
        return baseText;
    }

    // ========================================
    // ルビ機能 - 選択範囲内のルビ要素取得
    // ========================================

    /**
     * 選択範囲内のルビ要素を取得します。
     * @private
     */
    _getRubyElementsInSelection() {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return [];

        const range = selection.getRangeAt(0);
        const rubyElements = [];

        let container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;

        if (container.tagName === 'RUBY') {
            rubyElements.push(container);
        } else if (container.tagName === 'RT') {
            const ruby = container.closest('ruby');
            if (ruby) rubyElements.push(ruby);
        } else {
            const rubies = container.querySelectorAll?.('ruby') || [];
            rubies.forEach(ruby => {
                if (range.intersectsNode(ruby)) rubyElements.push(ruby);
            });

            const ancestorRuby = container.closest?.('ruby');
            if (ancestorRuby && !rubyElements.includes(ancestorRuby)) {
                rubyElements.push(ancestorRuby);
            }
        }

        return rubyElements;
    }


    // ========================================
    // ルビ機能 - 編集保護
    // ========================================

    /**
     * ルビ要素の直接編集を防止するイベントハンドラをセットアップします。
     * rt要素にcontenteditable="false"を設定しているため、
     * カーソルはrt要素内に入らず、ブラウザのデフォルト動作で1文字ずつ移動します。
     * @private
     */
    _setupRubyProtection() {
        // 既存のrt要素にcontenteditable="false"を設定
        this._ensureRtNotEditable();

        // DOMの変更を監視して、新しいrt要素にもcontenteditable="false"を設定
        this._setupRubyMutationObserver();
    }

    /**
     * エディタ内の既存のrt要素にcontenteditable="false"を設定します。
     * @private
     */
    _ensureRtNotEditable() {
        this.editor.querySelectorAll('rt').forEach(rt => {
            if (rt.contentEditable !== 'false') {
                rt.contentEditable = 'false';
            }
        });
    }

    /**
     * DOMの変更を監視して、新しいrt要素にcontenteditable="false"を設定します。
     * @private
     */
    _setupRubyMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let hasNewRt = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'RT') {
                                hasNewRt = true;
                            } else if (node.querySelector?.('rt')) {
                                hasNewRt = true;
                            }
                        }
                    }
                }
            }
            if (hasNewRt) {
                this._ensureRtNotEditable();
            }
        });

        observer.observe(this.editor, {
            childList: true,
            subtree: true
        });
    }

    /**
     * ルビ要素への直接編集を防止します（keydownイベント用）。
     * contenteditable="false"によりrt要素内にカーソルは入らないため、
     * このメソッドは主にテスト用の後方互換性のために残しています。
     * @private
     */
    _preventRubyEdit(event) {
        // ナビゲーションキーは常に許可（ブラウザのデフォルト動作に任せる）
        if (this._isNavigationKey(event)) {
            return true;
        }

        return true;
    }

    /**
     * ルビ要素への直接編集を防止します（beforeinputイベント用）。
     * contenteditable="false"によりrt要素内にカーソルは入らないため、
     * このメソッドは主にテスト用の後方互換性のために残しています。
     * @private
     */
    _preventRubyBeforeInput(event) {
        return true;
    }

    /**
     * カーソルをベーステキストの末尾に移動します。
     * @private
     */
    _moveCursorToBaseTextEnd(rtOrRubyElement) {
        const rubyElement = rtOrRubyElement.tagName === 'RT'
            ? rtOrRubyElement.closest('ruby')
            : rtOrRubyElement;

        if (!rubyElement) return;

        const baseTextNode = this._findBaseTextNode(rubyElement);
        if (baseTextNode) {
            const selection = window.getSelection();
            const newRange = document.createRange();
            newRange.setStart(baseTextNode, baseTextNode.textContent.length);
            newRange.setEnd(baseTextNode, baseTextNode.textContent.length);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }

    /**
     * カーソルをベーステキストの末尾に移動します（後方互換性のため）。
     * @private
     */
    _moveCursorToBaseText(rtOrRubyElement) {
        this._moveCursorToBaseTextEnd(rtOrRubyElement);
    }

    // ========================================
    // ルビ機能 - DOM探索ユーティリティ
    // ========================================

    /**
     * 指定されたノードを含むrt要素を検索します。
     * @private
     */
    _findContainingRt(node) {
        if (!node) return null;
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'RT') return node;

        let current = node;
        while (current && current !== this.editor) {
            if (current.nodeType === Node.ELEMENT_NODE && current.tagName === 'RT') return current;
            current = current.parentNode;
        }
        return null;
    }

    /**
     * 指定されたノードを含むruby要素を検索します。
     * @private
     */
    _findContainingRuby(node) {
        if (!node) return null;
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'RUBY') return node;

        let current = node;
        while (current && current !== this.editor) {
            if (current.nodeType === Node.ELEMENT_NODE && current.tagName === 'RUBY') return current;
            current = current.parentNode;
        }
        return null;
    }

    /**
     * ruby要素内のベーステキストノードを検索します。
     * @private
     */
    _findBaseTextNode(rubyElement) {
        if (!rubyElement) return null;
        for (const node of rubyElement.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                return node;
            }
        }
        return null;
    }

    /**
     * 指定ノードの次のテキストノードを取得します。
     * @private
     */
    _getNextTextNode(node) {
        let current = node;
        while (current) {
            if (current.nextSibling) {
                current = current.nextSibling;
                if (current.nodeType === Node.TEXT_NODE && current.textContent.trim()) {
                    return current;
                }
                if (current.nodeType === Node.ELEMENT_NODE && current.tagName !== 'RT') {
                    const textNode = this._findFirstTextNode(current);
                    if (textNode) return textNode;
                }
            } else {
                current = current.parentNode;
                if (current === this.editor || !current) return null;
            }
        }
        return null;
    }

    /**
     * 指定ノードの前のテキストノードを取得します。
     * @private
     */
    _getPrevTextNode(node) {
        let current = node;
        while (current) {
            if (current.previousSibling) {
                current = current.previousSibling;
                if (current.nodeType === Node.TEXT_NODE && current.textContent.trim()) {
                    return current;
                }
                if (current.nodeType === Node.ELEMENT_NODE && current.tagName !== 'RT') {
                    const textNode = this._findLastTextNode(current);
                    if (textNode) return textNode;
                }
            } else {
                current = current.parentNode;
                if (current === this.editor || !current) return null;
            }
        }
        return null;
    }

    /**
     * 要素内の最初のテキストノードを取得します。
     * @private
     */
    _findFirstTextNode(node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return node;
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'RT') return null;

        for (const child of node.childNodes) {
            const textNode = this._findFirstTextNode(child);
            if (textNode) return textNode;
        }
        return null;
    }

    /**
     * 要素内の最後のテキストノードを取得します。
     * @private
     */
    _findLastTextNode(node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return node;
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'RT') return null;

        for (let i = node.childNodes.length - 1; i >= 0; i--) {
            const textNode = this._findLastTextNode(node.childNodes[i]);
            if (textNode) return textNode;
        }
        return null;
    }

    // ========================================
    // ルビ機能 - 選択範囲ユーティリティ
    // ========================================

    /**
     * ナビゲーションキーかどうかを判定します。
     * @private
     */
    _isNavigationKey(event) {
        const navigationKeys = [
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'Home', 'End', 'PageUp', 'PageDown',
            'Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
            'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
            'Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'NumLock'
        ];

        if (navigationKeys.includes(event.key)) return true;

        if (event.ctrlKey || event.metaKey) {
            const allowedWithCtrl = ['a', 'c', 'v', 'x', 'z', 'y'];
            if (allowedWithCtrl.includes(event.key.toLowerCase())) return true;
        }

        return false;
    }

    /**
     * 選択範囲がルビ要素全体を含んでいるかチェックします。
     * @private
     */
    _isEntireRubySelected(rubyElement, range) {
        if (!rubyElement || !range) return false;

        try {
            const rubyRange = document.createRange();
            rubyRange.selectNode(rubyElement);
            const startComparison = range.compareBoundaryPoints(Range.START_TO_START, rubyRange);
            const endComparison = range.compareBoundaryPoints(Range.END_TO_END, rubyRange);
            return startComparison <= 0 && endComparison >= 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * 選択範囲をルビ要素に対して調整します。
     * @param {Range} [range] - 調整対象の範囲
     * @returns {Range|null} 調整後の範囲
     */
    adjustSelectionForRuby(range = null) {
        const selection = window.getSelection();
        if (!range) {
            if (!selection?.rangeCount) return null;
            range = selection.getRangeAt(0);
        }

        if (range.collapsed) return range;

        let { startContainer, endContainer, startOffset, endOffset } = range;

        // 開始位置がrt要素内にある場合
        const startRt = this._findContainingRt(startContainer);
        if (startRt) {
            const rubyElement = startRt.closest('ruby');
            if (rubyElement?.nextSibling) {
                startContainer = rubyElement.nextSibling;
                startOffset = 0;
            } else if (rubyElement?.parentNode) {
                const index = Array.from(rubyElement.parentNode.childNodes).indexOf(rubyElement);
                startContainer = rubyElement.parentNode;
                startOffset = index + 1;
            }
        } else {
            const startRuby = this._findContainingRuby(startContainer);
            if (startRuby?.nextSibling) {
                startContainer = startRuby.nextSibling;
                startOffset = 0;
            } else if (startRuby?.parentNode) {
                const index = Array.from(startRuby.parentNode.childNodes).indexOf(startRuby);
                startContainer = startRuby.parentNode;
                startOffset = index + 1;
            }
        }

        // 終了位置がrt要素内にある場合
        const endRt = this._findContainingRt(endContainer);
        if (endRt) {
            const rubyElement = endRt.closest('ruby');
            if (rubyElement) {
                const baseTextNode = this._findBaseTextNode(rubyElement);
                if (baseTextNode) {
                    endContainer = baseTextNode;
                    endOffset = baseTextNode.textContent.length;
                } else if (rubyElement.previousSibling?.nodeType === Node.TEXT_NODE) {
                    endContainer = rubyElement.previousSibling;
                    endOffset = rubyElement.previousSibling.textContent.length;
                }
            }
        } else {
            const endRuby = this._findContainingRuby(endContainer);
            if (endRuby?.previousSibling) {
                if (endRuby.previousSibling.nodeType === Node.TEXT_NODE) {
                    endContainer = endRuby.previousSibling;
                    endOffset = endRuby.previousSibling.textContent.length;
                } else if (endRuby.parentNode) {
                    const index = Array.from(endRuby.parentNode.childNodes).indexOf(endRuby);
                    endContainer = endRuby.parentNode;
                    endOffset = index;
                }
            } else if (endRuby?.parentNode) {
                const index = Array.from(endRuby.parentNode.childNodes).indexOf(endRuby);
                endContainer = endRuby.parentNode;
                endOffset = index;
            }
        }

        try {
            const newRange = document.createRange();
            newRange.setStart(startContainer, startOffset);
            newRange.setEnd(endContainer, endOffset);
            return newRange;
        } catch (e) {
            return range;
        }
    }

    /**
     * カーソルがルビ要素内にあるかチェックします。
     * @returns {boolean}
     */
    isCursorInRuby() {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return false;
        return this._findContainingRuby(selection.getRangeAt(0).startContainer) !== null;
    }

    /**
     * 選択範囲にルビ要素が部分的に含まれているかチェックします。
     * @param {Range} [range] - チェック対象の範囲
     * @returns {boolean}
     */
    hasPartialRubyInSelection(range = null) {
        const selection = window.getSelection();
        if (!range) {
            if (!selection?.rangeCount) return false;
            range = selection.getRangeAt(0);
        }

        if (range.collapsed) return false;

        if (this._findContainingRt(range.startContainer) || this._findContainingRt(range.endContainer)) {
            return true;
        }

        const startRuby = this._findContainingRuby(range.startContainer);
        const endRuby = this._findContainingRuby(range.endContainer);

        return !!(startRuby || endRuby);
    }

    /**
     * 選択範囲にrt要素が含まれているかチェックします。
     * @param {Range} range - チェック対象の範囲
     * @returns {boolean}
     */
    hasRtInSelection(range) {
        if (!range || range.collapsed) return false;

        const fragment = range.cloneContents();
        if (fragment.querySelectorAll('rt').length > 0) return true;

        return !!(this._findContainingRt(range.startContainer) || this._findContainingRt(range.endContainer));
    }

    /**
     * 選択範囲からrt要素を除外した新しい範囲を作成します。
     * @param {Range} range - 元の選択範囲
     * @returns {Range}
     */
    excludeRtFromSelection(range) {
        if (!range || range.collapsed) return range;

        let { startContainer, endContainer, startOffset, endOffset } = range;

        const startRt = this._findContainingRt(startContainer);
        if (startRt) {
            const rubyElement = startRt.closest('ruby');
            if (rubyElement?.nextSibling) {
                startContainer = rubyElement.nextSibling;
                startOffset = 0;
            }
        }

        const endRt = this._findContainingRt(endContainer);
        if (endRt) {
            const rubyElement = endRt.closest('ruby');
            if (rubyElement) {
                const baseTextNode = this._findBaseTextNode(rubyElement);
                if (baseTextNode) {
                    endContainer = baseTextNode;
                    endOffset = baseTextNode.textContent.length;
                }
            }
        }

        try {
            const newRange = document.createRange();
            newRange.setStart(startContainer, startOffset);
            newRange.setEnd(endContainer, endOffset);
            return newRange;
        } catch (e) {
            return range;
        }
    }

    // ========================================
    // 公開ユーティリティ（テスト用）
    // ========================================

    // 以下のメソッドはテストから呼び出されるため公開
    getSelectedTextWithoutRt(range) { return this._getSelectedTextWithoutRt(range); }
    getSelectedHtmlWithoutRt(range) { return this._getSelectedHtmlWithoutRt(range); }
    findContainingRt(node) { return this._findContainingRt(node); }
    findContainingRuby(node) { return this._findContainingRuby(node); }
    findBaseTextNode(rubyElement) { return this._findBaseTextNode(rubyElement); }
    getBaseTextFromRuby(rubyElement) { return this._getBaseTextFromRuby(rubyElement); }
    getRubyElementsInSelection() { return this._getRubyElementsInSelection(); }
    calculateRubyPanelPosition(anchor) { return this._calculateRubyPanelPosition(anchor); }
    isNavigationKey(event) { return this._isNavigationKey(event); }
    isEntireRubySelected(ruby, range) { return this._isEntireRubySelected(ruby, range); }
    preventRubyEdit(event) { return this._preventRubyEdit(event); }
    preventRubyBeforeInput(event) { return this._preventRubyBeforeInput(event); }

    // 非推奨メソッド（後方互換性のため）
    /** @deprecated Use _handleSelectionChange instead */
    handleSelectionChange() { return this._handleSelectionChange(); }
    /** @deprecated Use _showFloatToolbar instead */
    showFloatToolbar(range) { return this._showFloatToolbar(range); }
    /** @deprecated Use _hideFloatToolbar instead */
    hideFloatToolbar() { return this._hideFloatToolbar(); }
    /** @deprecated Use _updateToolbarState instead */
    updateToolbarState() { return this._updateToolbarState(); }
    /** @deprecated Use _handleFiles instead */
    handleFiles(files) { return this._handleFiles(files); }
}
