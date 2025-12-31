/**
 * エディタロジック (Tiptap版)
 * テキストの入力、画像の挿入、ツールバーの操作、ルビ機能などを担当します。
 * 
 * 既存のEditorManagerの外部インターフェースを維持しつつ、
 * 内部実装をTiptapに置き換えています。
 */
import { Editor, Extension } from 'tiptap';
import { Ruby } from './extensions/ruby.js';
import { HeadingWithId } from './extensions/headingWithId.js';
import { ResizableImage } from './extensions/resizableImage.js';
import { debounce, generateId } from './utils.js';
import { Sanitizer } from './sanitizer.js';
import { CONFIG } from './config.js';
import { TOGGLE_ICONS, OUTLINE_ICONS, getIconList } from './outlineIcons.js';

// StarterKitから必要な拡張をインポート（バンドル済み）
import {
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight
} from 'tiptap';

/**
 * エディタのロジックを管理するクラス (Tiptap版)
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
        this.outlineCollapsedState = new Map();
        this.currentIconTarget = null;
        this.lastActiveHeadingId = null;

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
        this.editorContainer = document.getElementById('editor');
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
        // Tiptapエディタの初期化
        this._initTiptapEditor();
        this._setupToolbarActions();
        this._setupRubyPanel();
        this._setupIconPicker();
        this._setupEventBusListeners();
    }

    /**
     * Tiptapエディタを初期化します。
     * @private
     */
    _initTiptapEditor() {
        // 既存のコンテンツを取得
        const initialContent = this.editorContainer.innerHTML;

        // contenteditableを無効化（Tiptapが管理）
        this.editorContainer.removeAttribute('contenteditable');
        this.editorContainer.innerHTML = '';

        // Tiptapエディタを作成
        this.tiptap = new Editor({
            element: this.editorContainer,
            extensions: [
                StarterKit.configure({
                    // HeadingはカスタムのHeadingWithIdを使用
                    heading: false,
                    // ImageはカスタムのResizableImageを使用
                    image: false
                }),
                HeadingWithId,
                Ruby,
                ResizableImage,
                Underline,
                TextStyle,
                Color,
                Highlight.configure({
                    multicolor: true
                })
            ],
            content: initialContent || '<h1>ここにタイトルを入力...</h1><p>本文をここに入力してください。</p>',
            autofocus: true,
            editorProps: {
                attributes: {
                    id: 'editor',
                    spellcheck: 'false'
                }
            },
            onUpdate: ({ editor }) => {
                this._onEditorUpdate();
            },
            onSelectionUpdate: ({ editor }) => {
                this._onSelectionUpdate();
            }
        });
    }

    /**
     * エディタ更新時の処理
     * @private
     */
    _onEditorUpdate() {
        // デバウンスしてアウトラインを更新
        if (!this._debouncedOutlineUpdate) {
            this._debouncedOutlineUpdate = debounce(() => {
                this.updateOutline();
                this.eventBus.emit('editor:update', this.getHeadings());
            }, CONFIG.EDITOR.DEBOUNCE_WAIT);
        }
        this._debouncedOutlineUpdate();
    }

    /**
     * 選択更新時の処理
     * @private
     */
    _onSelectionUpdate() {
        const { from, to, empty } = this.tiptap.state.selection;

        // フローティングツールバーの表示/非表示
        if (empty || from === to) {
            this._hideFloatToolbar();
        } else {
            this._showFloatToolbar();
            this._updateToolbarState();
        }

        // アウトラインハイライトの更新
        this._updateOutlineHighlightByPosition();
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
        return this.tiptap.getHTML();
    }

    /**
     * エディタにHTMLコンテンツを設定します。
     * @param {string} html - 設定するHTMLコンテンツ
     */
    setContent(html) {
        const sanitizedHtml = this.sanitizer.sanitize(html);
        this.tiptap.commands.setContent(sanitizedHtml);
        this.updateOutline();
        this.eventBus.emit('editor:update', this.getHeadings());
    }

    /**
     * 直前の操作を取り消します（Undo）。
     * @returns {boolean} 操作が成功したかどうか
     */
    undo() {
        return this.tiptap.commands.undo();
    }

    /**
     * 取り消した操作をやり直します（Redo）。
     * @returns {boolean} 操作が成功したかどうか
     */
    redo() {
        return this.tiptap.commands.redo();
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
        const commandMap = {
            'bold': () => this.tiptap.chain().focus().toggleBold().run(),
            'italic': () => this.tiptap.chain().focus().toggleItalic().run(),
            'underline': () => this.tiptap.chain().focus().toggleUnderline().run(),
            'strike': () => this.tiptap.chain().focus().toggleStrike().run(),
            'insertUnorderedList': () => this.tiptap.chain().focus().toggleBulletList().run(),
            'insertOrderedList': () => this.tiptap.chain().focus().toggleOrderedList().run()
        };

        if (commandMap[style]) {
            return commandMap[style]();
        }
        return false;
    }

    /**
     * 選択範囲の見出しレベルを設定します。
     * @param {number} level - 見出しレベル（1-4）、0の場合は通常の段落
     * @returns {boolean} 操作が成功したかどうか
     */
    setHeadingLevel(level) {
        if (level === 0) {
            return this.tiptap.chain().focus().setParagraph().run();
        }
        return this.tiptap.chain().focus().toggleHeading({ level }).run();
    }

    /**
     * 選択範囲のテキスト色を設定します。
     * @param {string} color - 色（HEX形式またはRGB形式）
     * @returns {boolean} 操作が成功したかどうか
     */
    setTextColor(color) {
        return this.tiptap.chain().focus().setColor(color).run();
    }

    /**
     * 選択範囲の背景色（ハイライト）を設定します。
     * @param {string} color - 色（HEX形式またはRGB形式）
     * @returns {boolean} 操作が成功したかどうか
     */
    setBackgroundColor(color) {
        return this.tiptap.chain().focus().setHighlight({ color }).run();
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
                this.applyStyle(btn.dataset.cmd);
                this._updateToolbarState();
            });
        });

        // フォーマットブロック選択
        const formatSelect = document.getElementById('formatBlockSelect');
        formatSelect.addEventListener('change', () => {
            const value = formatSelect.value;
            if (value === 'p') {
                this.tiptap.chain().focus().setParagraph().run();
            } else if (value === 'blockquote') {
                this.tiptap.chain().focus().toggleBlockquote().run();
            } else if (value.startsWith('h')) {
                const level = parseInt(value[1]);
                this.tiptap.chain().focus().toggleHeading({ level }).run();
            }
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
                if (command === 'foreColor') {
                    this.setTextColor(color);
                } else if (command === 'hiliteColor') {
                    this.setBackgroundColor(color);
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
     * フローティングツールバーを表示します。
     * @private
     */
    _showFloatToolbar() {
        const { from, to } = this.tiptap.state.selection;
        if (from === to) return;

        // Tiptapのview.coordsAtPosを使用して位置を計算
        const startCoords = this.tiptap.view.coordsAtPos(from);
        const endCoords = this.tiptap.view.coordsAtPos(to);

        const toolbarRect = this.floatToolbar.getBoundingClientRect();
        const margin = 10;

        // 選択範囲の中央上部に配置
        const centerX = (startCoords.left + endCoords.right) / 2;
        let top = startCoords.top - toolbarRect.height - margin;
        let left = centerX - (toolbarRect.width / 2);

        // 境界チェック
        if (top < margin) top = endCoords.bottom + margin;
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
        const commands = {
            'bold': 'bold',
            'italic': 'italic',
            'underline': 'underline',
            'insertUnorderedList': 'bulletList',
            'insertOrderedList': 'orderedList'
        };

        Object.entries(commands).forEach(([cmdName, markName]) => {
            const btn = this.floatToolbar.querySelector(`button[data-cmd="${cmdName}"]`);
            if (btn) {
                btn.classList.toggle('active', this.tiptap.isActive(markName));
            }
        });

        // フォーマット選択の更新
        const formatSelect = document.getElementById('formatBlockSelect');
        if (this.tiptap.isActive('heading', { level: 1 })) {
            formatSelect.value = 'h1';
        } else if (this.tiptap.isActive('heading', { level: 2 })) {
            formatSelect.value = 'h2';
        } else if (this.tiptap.isActive('heading', { level: 3 })) {
            formatSelect.value = 'h3';
        } else if (this.tiptap.isActive('heading', { level: 4 })) {
            formatSelect.value = 'h4';
        } else if (this.tiptap.isActive('blockquote')) {
            formatSelect.value = 'blockquote';
        } else {
            formatSelect.value = 'p';
        }
    }

    // ========================================
    // 見出し・アウトライン
    // ========================================

    /**
     * エディタ内の見出し要素を取得します。
     * Tiptap状態を真実の情報源として使用します（Single Source of Truth）。
     * HeadingWithIdのonCreate/onTransactionでIDは自動付与されます。
     * @returns {Array<{text: string, level: number, element: HTMLElement, id: string, icon: string}>}
     */
    getHeadings() {
        const headings = [];
        const tiptapElement = this.editorContainer.querySelector('.tiptap');

        // Tiptap状態から見出し情報を取得
        this.tiptap.state.doc.descendants((node, pos) => {
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
                    id,
                    icon,
                    element
                });
            }
        });

        return headings;
    }

    /**
     * アウトラインを更新します。
     */
    updateOutline() {
        this.outlineList.innerHTML = '';
        const headings = this.getHeadings();

        if (headings.length === 0) return;

        // 階層構造を構築
        const rootItems = this._buildOutlineHierarchy(headings);

        // DOM要素を生成
        rootItems.forEach(item => {
            const element = this._createOutlineItemElement(item);
            this.outlineList.appendChild(element);
        });

        // ハイライト状態を再適用
        this.lastActiveHeadingId = null;
        this._updateOutlineHighlightByPosition();
    }

    /**
     * 見出しリストから階層構造を構築します。
     * @private
     */
    _buildOutlineHierarchy(headings) {
        const items = headings.map(h => ({
            id: h.id,
            text: h.text || '(タイトルなし)',
            level: h.level,
            icon: h.icon || 'document',
            children: []
        }));

        const root = [];
        const stack = [{ level: 0, children: root }];

        items.forEach(item => {
            while (stack.length > 1 && stack[stack.length - 1].level >= item.level) {
                stack.pop();
            }
            stack[stack.length - 1].children.push(item);
            stack.push({ level: item.level, children: item.children });
        });

        return root;
    }

    /**
     * アウトライン項目のDOM要素を作成します。
     * @private
     */
    _createOutlineItemElement(item) {
        const wrapper = document.createElement('div');
        wrapper.className = 'outline-item-wrapper';
        wrapper.dataset.headingId = item.id;
        wrapper.style.paddingLeft = `${(item.level - 1) * 12}px`;

        const itemEl = document.createElement('div');
        itemEl.className = 'outline-item';
        itemEl.dataset.headingId = item.id;

        // アイコン
        const iconEl = document.createElement('div');
        iconEl.className = 'outline-icon';
        if (item.icon && item.icon !== 'none' && OUTLINE_ICONS[item.icon]) {
            iconEl.innerHTML = OUTLINE_ICONS[item.icon].svg;
        }
        iconEl.title = 'クリックでアイコンを変更';
        iconEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this._showIconPicker(item.id, iconEl);
        });

        // テキスト
        const textEl = document.createElement('span');
        textEl.className = 'outline-text';
        textEl.textContent = item.text;

        itemEl.appendChild(iconEl);
        itemEl.appendChild(textEl);

        // 折りたたみトグル
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

        // 子要素
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
     * アウトラインのハイライト状態を設定します。
     * @private
     */
    _setOutlineHighlight(headingId) {
        this.lastActiveHeadingId = headingId;

        this.outlineList.querySelectorAll('.outline-item').forEach(item => {
            item.classList.remove('active', 'has-hidden-active');
        });

        if (!headingId) return;

        const activeItem = this.outlineList.querySelector(
            `.outline-item[data-heading-id="${headingId}"]`
        );

        if (activeItem) {
            const wrapper = activeItem.closest('.outline-item-wrapper');
            const isVisible = this._isOutlineItemVisible(wrapper);

            if (isVisible) {
                activeItem.classList.add('active');
            } else {
                const visibleParent = this._findVisibleParentOutlineItem(wrapper);
                if (visibleParent) {
                    visibleParent.classList.add('has-hidden-active');
                }
            }
        }
    }

    /**
     * カーソル位置に応じてアウトラインのハイライトを更新します。
     * Tiptap状態を使用して現在位置を判定します（Single Source of Truth）。
     * @private
     */
    _updateOutlineHighlightByPosition() {
        const { from } = this.tiptap.state.selection;
        let activeHeadingId = null;

        // Tiptap状態から、カーソル位置以前の最後の見出しを見つける
        this.tiptap.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
                // ノードの開始位置がカーソル位置以前であれば更新
                if (pos <= from) {
                    activeHeadingId = node.attrs.id;
                }
            }
        });

        // 前回と同じ場合は更新をスキップ（チカチカ防止）
        if (this.lastActiveHeadingId === activeHeadingId) return;
        this._setOutlineHighlight(activeHeadingId);
    }

    /**
     * アウトラインアイテムが表示されているかどうかを判定します。
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
     * 指定されたIDの見出し要素までスクロールします。
     * @param {string} headingId - 見出し要素のID
     */
    scrollToHeading(headingId) {
        // TiptapがレンダリングするDOMから検索
        const tiptapElement = this.editorContainer.querySelector('.tiptap');
        const heading = tiptapElement?.querySelector(`[id="${headingId}"]`);
        if (heading) {
            heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this._setOutlineHighlight(headingId);
        }
    }

    // ========================================
    // アイコンピッカー
    // ========================================

    /**
     * アイコンピッカーをセットアップします。
     * @private
     */
    _setupIconPicker() {
        if (!this.iconPicker) return;

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
                item.textContent = '×';
            }

            item.addEventListener('click', () => {
                this._selectIcon(icon.id);
            });

            this.iconPicker.appendChild(item);
        });

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
    _showIconPicker(headingId, iconEl) {
        this.currentIconTarget = headingId;

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

        // TiptapのステートからIDに一致するノードを検索して更新
        let targetPos = null;
        let targetNode = null;

        this.tiptap.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && node.attrs.id === this.currentIconTarget) {
                targetPos = pos;
                targetNode = node;
                return false; // ループ終了
            }
        });

        if (targetPos !== null && targetNode) {
            // トランザクションを作成して属性を更新
            const tr = this.tiptap.state.tr;
            tr.setNodeMarkup(targetPos, undefined, {
                ...targetNode.attrs,
                outlineIcon: iconId
            });
            this.tiptap.view.dispatch(tr);
        }

        this._hideIconPicker();
        // ステート更新によりonUpdateがトリガーされるが、即時反映のため手動呼び出しも維持
        this.updateOutline();
    }

    // ========================================
    // 画像処理
    // ========================================

    /**
     * 画像をエディタに挿入します。
     * @param {string} src - 画像のソース
     * @returns {string} 挿入された画像のID（互換性のため）
     */
    insertImage(src) {
        this.tiptap.chain().focus().setImage({ src }).run();
        return generateId();
    }

    /**
     * 指定されたIDの画像をリサイズします。
     * @param {string} imageId - 画像のID
     * @param {number} width - 新しい幅（ピクセル）
     * @returns {boolean} 操作が成功したかどうか
     */
    resizeImage(imageId, width) {
        // ResizableImage拡張がNodeView内で処理するため、
        // ここでは属性更新のみ
        return this.tiptap.commands.resizeImage(width);
    }

    // ========================================
    // コードブロック
    // ========================================

    /**
     * コードブロックを挿入します。
     */
    insertCodeBlock() {
        this.tiptap.chain().focus().toggleCodeBlock().run();
    }

    // ========================================
    // ルビ機能
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
     * ルビを挿入します。
     */
    insertRuby() {
        const { from, to, empty } = this.tiptap.state.selection;
        if (empty) return;

        // 選択範囲を保存（ルビパネルにフォーカスが移動すると失われるため）
        this.savedRubySelection = { from, to };

        // 既存のルビを検出
        const rubyInfo = this.detectExistingRuby();

        // 既存ルビがある場合はその情報を保存（firstRuby: 表示用, allRubies: 削除用）
        this.existingRubyInfo = rubyInfo.allRubies.length > 0 ? rubyInfo : null;

        this._showRubyPanel();
    }

    /**
     * ルビパネルを表示します。
     * @private
     */
    _showRubyPanel() {
        if (!this.rubyPanel || !this.rubyBtn) return;

        // 既存ルビがある場合は最初のものの値を表示
        if (this.existingRubyInfo && this.existingRubyInfo.firstRuby) {
            this.rubyInput.value = this.existingRubyInfo.firstRuby.rubyText || '';
        } else {
            this.rubyInput.value = '';
        }

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
        this.savedRubySelection = null;
        this.existingRubyInfo = null;
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

        left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

        if (top + panelHeight > window.innerHeight + window.scrollY - margin) {
            top = anchorRect.top - panelHeight - gap + window.scrollY;
        }

        return { top, left };
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

        // 既存ルビが複数ある場合は全て削除してから新たに適用
        if (this.existingRubyInfo && this.existingRubyInfo.allRubies.length > 0) {
            // 後ろから削除（位置がずれないように）
            for (const ruby of this.existingRubyInfo.allRubies) {
                const { nodePos, rubyNode } = ruby;
                if (nodePos !== null && rubyNode) {
                    const nodeSize = rubyNode.nodeSize;
                    const baseText = rubyNode.textContent || '';

                    // 既存ルビを削除してベーステキストに戻す
                    this.tiptap.chain()
                        .focus()
                        .deleteRange({ from: nodePos, to: nodePos + nodeSize })
                        .insertContentAt(nodePos, baseText)
                        .run();
                }
            }
        }

        // 保存した選択範囲でルビを適用
        if (this.savedRubySelection) {
            const { from, to } = this.savedRubySelection;
            // ドキュメントが変更されている可能性があるので再取得
            const currentDoc = this.tiptap.state.doc;
            const maxPos = currentDoc.content.size;

            // 選択範囲がドキュメント内に収まっているか確認
            const safeFrom = Math.min(from, maxPos);
            const safeTo = Math.min(to, maxPos);

            if (safeFrom < safeTo) {
                const baseText = currentDoc.textBetween(safeFrom, safeTo, '');

                if (baseText) {
                    this.tiptap
                        .chain()
                        .focus()
                        .setTextSelection({ from: safeFrom, to: safeTo })
                        .setRuby(rubyText)
                        .run();
                }
            }
        }

        this._hideRubyPanel();
    }

    /**
     * ルビパネルからルビを削除します。
     * @private
     */
    _deleteRubyFromPanel() {
        // 既存ルビが複数ある場合は全て削除
        if (this.existingRubyInfo && this.existingRubyInfo.allRubies.length > 0) {
            // 後ろから削除（位置がずれないように）
            for (const ruby of this.existingRubyInfo.allRubies) {
                const { nodePos, rubyNode } = ruby;
                if (nodePos !== null && rubyNode) {
                    const nodeSize = rubyNode.nodeSize;
                    const baseText = rubyNode.textContent || '';

                    // 既存ルビを削除してベーステキストに戻す
                    this.tiptap.chain()
                        .focus()
                        .deleteRange({ from: nodePos, to: nodePos + nodeSize })
                        .insertContentAt(nodePos, baseText)
                        .run();
                }
            }
        }
        this._hideRubyPanel();
    }

    /**
     * 選択範囲内の既存ルビ要素を検出します。
     * @returns {{firstRuby: {rubyNode, rubyText, baseText, nodePos}|null, allRubies: Array}}
     */
    detectExistingRuby() {
        const result = {
            firstRuby: null,  // 最初に見つかったルビ（パネル表示用）
            allRubies: []     // 全てのルビ（削除用）
        };

        const { from, to } = this.tiptap.state.selection;
        const $from = this.tiptap.state.doc.resolve(from);

        // 1. カーソル位置を含む親ノードからrubyを探す（カーソルがruby内にある場合）
        for (let d = $from.depth; d >= 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'ruby') {
                const rubyInfo = {
                    rubyNode: node,
                    rubyText: node.attrs.rubyText || '',
                    baseText: node.textContent || '',
                    nodePos: $from.before(d)
                };
                if (!result.firstRuby) {
                    result.firstRuby = rubyInfo;
                }
                result.allRubies.push(rubyInfo);
                break;
            }
        }

        // 2. 選択範囲内のrubyノードを全て収集
        this.tiptap.state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'ruby') {
                // 既に追加済みでないか確認
                const alreadyAdded = result.allRubies.some(r => r.nodePos === pos);
                if (!alreadyAdded) {
                    const rubyInfo = {
                        rubyNode: node,
                        rubyText: node.attrs.rubyText || '',
                        baseText: node.textContent || '',
                        nodePos: pos
                    };
                    if (!result.firstRuby) {
                        result.firstRuby = rubyInfo;
                    }
                    result.allRubies.push(rubyInfo);
                }
            }
        });

        // 位置の降順でソート（後ろから削除するため）
        result.allRubies.sort((a, b) => b.nodePos - a.nodePos);

        return result;
    }

    /**
     * 選択範囲にルビを設定します。
     * @param {string} rubyText - ルビテキスト
     * @returns {boolean} 操作が成功したかどうか
     */
    setRuby(rubyText) {
        return this.tiptap.chain().focus().setRuby(rubyText).run();
    }

    /**
     * 既存のルビ要素を更新します。
     * @param {HTMLElement} rubyElement - 更新対象のruby要素（互換性のため、実際にはrubyTextを直接使用）
     * @param {string} newRubyText - 新しいルビテキスト
     * @returns {boolean} 操作が成功したかどうか
     */
    updateRuby(rubyElement, newRubyText) {
        return this.tiptap.chain().focus().updateRuby(newRubyText).run();
    }

    /**
     * ルビ要素を削除し、ベーステキストのみを残します。
     * @returns {boolean} 操作が成功したかどうか
     */
    removeRuby() {
        return this.tiptap.chain().focus().unsetRuby().run();
    }

    // ========================================
    // 後方互換性のためのユーティリティメソッド
    // ========================================

    // 既存のテストやSearchManagerとの互換性のため
    getSelectedTextWithoutRt(range) { return ''; }
    getSelectedHtmlWithoutRt(range) { return ''; }
    findContainingRt(node) { return null; }
    findContainingRuby(node) { return null; }
    findBaseTextNode(rubyElement) { return null; }
    getBaseTextFromRuby(rubyElement) { return ''; }
    getRubyElementsInSelection() { return []; }
    calculateRubyPanelPosition(anchor) { return this._calculateRubyPanelPosition(anchor); }
    isCursorInRuby() { return this.tiptap.isActive('ruby'); }
    hasPartialRubyInSelection() { return false; }
    hasRtInSelection() { return false; }
    adjustSelectionForRuby() { return null; }
    excludeRtFromSelection() { return null; }
}
