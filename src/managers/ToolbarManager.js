/**
 * ツールバー管理
 * 
 * フローティングツールバーの表示/非表示、状態更新を担当します。
 * 
 * @module managers/ToolbarManager
 */

/**
 * ツールバー管理クラス
 */
export class ToolbarManager {
    /**
     * ToolbarManagerのコンストラクタ
     * 
     * @param {Object} editorCore - EditorManagerまたはEditorCoreへの参照
     */
    constructor(editorCore) {
        /** @type {Object} エディタへの参照 */
        this.editor = editorCore;

        // DOM参照
        this.floatToolbar = document.getElementById('float-toolbar');
        this.formatSelect = document.getElementById('formatBlockSelect');
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * ツールバーアクションをセットアップします。
     */
    setupToolbarActions() {
        // コマンドボタン
        this.floatToolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.editor.applyStyle(btn.dataset.cmd);
                this.updateToolbarState();
            });
        });

        // フォーマットブロック選択
        if (this.formatSelect) {
            this.formatSelect.addEventListener('change', () => {
                const value = this.formatSelect.value;
                if (value === 'p') {
                    this.editor.tiptap.chain().focus().setParagraph().run();
                } else if (value === 'blockquote') {
                    this.editor.tiptap.chain().focus().toggleBlockquote().run();
                } else if (value.startsWith('h')) {
                    const level = parseInt(value[1]);
                    this.editor.tiptap.chain().focus().toggleHeading({ level }).run();
                }
            });
        }

        // ルビボタン
        const rubyBtn = document.getElementById('rubyBtn');
        if (rubyBtn) {
            rubyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.editor.insertRuby();
            });
        }

        // コードブロックボタン
        const codeBtn = document.getElementById('codeBtn');
        if (codeBtn) {
            codeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.editor.insertCodeBlock();
            });
        }

        // コメントボタン
        const commentBtn = document.getElementById('commentBtn');
        if (commentBtn) {
            commentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.editor.insertComment();
            });
        }

        // リンクボタン
        const linkBtn = document.getElementById('linkBtn');
        if (linkBtn) {
            linkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.editor.insertLink();
            });
        }

        // 外側クリックで閉じる処理
        document.addEventListener('mousedown', (e) => {
            // ツールバーが表示されていない場合は何もしない
            if (this.floatToolbar.classList.contains('hidden')) return;

            const target = e.target;

            // 除外要素リスト（クリックしても閉じない要素）
            const ignoreElements = [
                this.floatToolbar, // ツールバー自身
                document.getElementById('ruby-panel'),
                document.getElementById('link-panel'),
                document.getElementById('comment-panel'),
                document.getElementById('textColorPicker'),
                document.getElementById('highlightPicker'),
                document.getElementById('image-toolbar')
            ];

            // ターゲットがいずれかの除外要素内にあるかチェック
            const isClickInside = ignoreElements.some(el => {
                return el && (el === target || el.contains(target));
            });

            if (!isClickInside) {
                // 選択範囲が維持されるべきクリック（エディタ内の操作など）は
                // TiptapのonSelectionUpdateで制御されるが、
                // 明示的に外側をクリックした場合は閉じる
                this.hideFloatToolbar();
            }
        });
    }

    // =====================================================
    // 表示/非表示
    // =====================================================

    /**
     * フローティングツールバーを表示します。
     */
    showFloatToolbar() {
        if (!this.editor.tiptap) return;

        const { from, to } = this.editor.tiptap.state.selection;
        if (from === to) return;

        // 正しいサイズ計測のために、一時的に表示状態（ただし不可視）にする
        this.floatToolbar.style.visibility = 'hidden';
        this.floatToolbar.classList.remove('hidden');

        // Tiptapのview.coordsAtPosを使用して位置を計算
        const startCoords = this.editor.tiptap.view.coordsAtPos(from);
        const endCoords = this.editor.tiptap.view.coordsAtPos(to);

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

        // 可視化
        this.floatToolbar.style.visibility = '';
    }

    /**
     * フローティングツールバーを非表示にします。
     */
    hideFloatToolbar() {
        this.floatToolbar.classList.add('hidden');

        // カラーピッカーも非表示
        if (this.editor.colorPickerManager) {
            this.editor.colorPickerManager.hideAllPickers();
        }
    }

    // =====================================================
    // 状態更新
    // =====================================================

    /**
     * ツールバーの状態を更新します。
     */
    updateToolbarState() {
        if (!this.editor.tiptap) return;

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
                btn.classList.toggle('active', this.editor.tiptap.isActive(markName));
            }
        });

        // フォーマット選択の更新
        if (this.formatSelect) {
            if (this.editor.tiptap.isActive('heading', { level: 1 })) {
                this.formatSelect.value = 'h1';
            } else if (this.editor.tiptap.isActive('heading', { level: 2 })) {
                this.formatSelect.value = 'h2';
            } else if (this.editor.tiptap.isActive('heading', { level: 3 })) {
                this.formatSelect.value = 'h3';
            } else if (this.editor.tiptap.isActive('heading', { level: 4 })) {
                this.formatSelect.value = 'h4';
            } else if (this.editor.tiptap.isActive('blockquote')) {
                this.formatSelect.value = 'blockquote';
            } else {
                this.formatSelect.value = 'p';
            }
        }
    }
}
