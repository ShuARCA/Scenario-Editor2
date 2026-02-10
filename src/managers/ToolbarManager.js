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

        /** @type {boolean} 編集ロック状態 */
        this._locked = false;
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
                // 親がドロップダウンなら閉じる
                const dropdownMenu = btn.closest('.dropdown-menu');
                if (dropdownMenu) {
                    dropdownMenu.classList.remove('show');
                }
                this.editor.applyStyle(btn.dataset.cmd);
                this.updateToolbarState();
            });
        });

        // ドロップダウントリガー
        const dropdownTrigger = this.floatToolbar.querySelector('.dropdown-trigger');
        const dropdownMenu = this.floatToolbar.querySelector('.dropdown-menu');

        if (dropdownTrigger && dropdownMenu) {
            dropdownTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // ツールバーのクリックイベントが伝播しないようにする
                dropdownMenu.classList.toggle('show');
            });

            // ドロップダウン外クリックで閉じる
            document.addEventListener('click', (e) => {
                if (!dropdownTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) {
                    dropdownMenu.classList.remove('show');
                }
            });
        }

        // フォーマットブロック選択
        if (this.formatSelect) {
            this.formatSelect.addEventListener('change', () => {
                const value = this.formatSelect.value;
                const isBox = this.editor.tiptap.isActive('boxContainer');

                // Box解除処理 (他スタイル選択時)
                if (isBox && value !== 'box') {
                    // まずBoxを解除してParagraphに戻す
                    this.editor.tiptap.chain().focus().unsetBox().run();

                    // Paragraph以外が選択されていたら、さらにそのスタイルを適用
                    // (unsetBoxでParagraphになっている前提)
                    if (value !== 'p') {
                        // 少し待たないとDOM更新/Selection更新が間に合わない可能性があるが、Chainでいけるはず
                        // ただしunsetBoxの実装次第。
                        if (value === 'blockquote') {
                            this.editor.tiptap.chain().focus().toggleBlockquote().run();
                        } else if (value.startsWith('h')) {
                            const level = parseInt(value[1]);
                            this.editor.tiptap.chain().focus().toggleHeading({ level }).run();
                        }
                    }
                    return;
                }

                if (value === 'p') {
                    this.editor.tiptap.chain().focus().setParagraph().run();
                } else if (value === 'blockquote') {
                    this.editor.tiptap.chain().focus().toggleBlockquote().run();
                } else if (value === 'box') {
                    this.editor.tiptap.chain().focus().toggleBox().run();
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
     * 編集ロック状態を設定します。
     * ロック中はフローティングツールバーの表示をブロックします。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
        if (locked) {
            this.hideFloatToolbar();
        }
    }

    /**
     * フローティングツールバーを表示します。
     */
    showFloatToolbar() {
        if (!this.editor.tiptap || this._locked) return;

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

        // ドロップダウンも閉じる
        const dropdownMenu = this.floatToolbar.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.classList.remove('show');
        }

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
            'insertOrderedList': 'orderedList',
            'insertTaskList': 'taskList'
        };

        let isAnyListActive = false;

        Object.entries(commands).forEach(([cmdName, markName]) => {
            const btn = this.floatToolbar.querySelector(`button[data-cmd="${cmdName}"]`);
            if (btn) {
                const isActive = this.editor.tiptap.isActive(markName);
                btn.classList.toggle('active', isActive);

                if (isActive && ['bulletList', 'orderedList', 'taskList'].includes(markName)) {
                    isAnyListActive = true;
                }
            }
        });

        // リストドロップダウントリガーのアクティブ状態更新
        const dropdownTrigger = this.floatToolbar.querySelector('.dropdown-trigger');
        if (dropdownTrigger) {
            dropdownTrigger.classList.toggle('active', isAnyListActive);
        }

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
            } else if (this.editor.tiptap.isActive('boxContainer')) {
                this.formatSelect.value = 'box';
            } else {
                this.formatSelect.value = 'p';
            }
        }

        // 文字色・背景色のアイコン反映
        // 文字色
        const textColorBtn = document.getElementById('textColorBtn');
        if (textColorBtn) {
            const color = this.editor.tiptap.getAttributes('textStyle').color;
            const svgPath = textColorBtn.querySelector('path');
            if (svgPath) {
                // 色が設定されていればその色、なければCSSの継承(親ボタンの色 => var(--toolbar-button-color))
                // ボタンのcolorスタイルを直接変更するとhover時の色変化と競合するので、
                // svgのfillまたはstyleを操作する方が安全だが、
                // アイコン全体の色を変えるならボタンのstyle.colorが良い
                // ただし、hover時の挙動を見ると:
                // button:hover { color: var(--text-color); }
                // なので、style.colorを設定するとhoverしてもその色が優先されてしまう(インラインスタイルは強い)
                // 
                // 要件: 「現在選択範囲に適用されている文字色をアイコンの色に反映してください」
                // 選択色が赤なら、アイコンも赤に見えるべき。

                if (color) {
                    textColorBtn.style.color = color;
                    // SVGのfillはcurrentcolorになっていることが多いので、親のcolorに追従するはず
                    //念のためfillも確認
                    svgPath.style.fill = 'currentColor';
                } else {
                    textColorBtn.style.color = ''; // デフォルトに戻す
                }
            }
        }

        // 背景色
        const highlightBtn = document.getElementById('highlightBtn');
        if (highlightBtn) {
            const highlight = this.editor.tiptap.getAttributes('highlight');
            const color = highlight.color;

            // 背景色ボタンは「背景色」自体を変えるべきか、「アイコンの背景」を変えるべきか
            // 要件: 「アイコンの背景色に反映してください」
            if (color) {
                highlightBtn.style.backgroundColor = color;
                // 背景が濃い色の場合、アイコン（文字）が見えなくなる可能性があるが、
                // ひとまず要件通り背景色を反映。
                // 視認性確保のため、背景色の輝度によってアイコン色を変えるなどの工夫が必要かもしれないが、
                // まずはシンプルに実装
            } else {
                highlightBtn.style.backgroundColor = ''; // 透明/デフォルト
            }
        }
    }
}
