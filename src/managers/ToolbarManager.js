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

        // ドロップダウントリガー (汎用処理)
        const dropdownTriggers = this.floatToolbar.querySelectorAll('.dropdown-trigger');

        dropdownTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const container = trigger.closest('.dropdown-container');
                const menu = container ? container.querySelector('.dropdown-menu') : null;

                if (menu) {
                    // 他の開いているメニューを閉じる
                    this.floatToolbar.querySelectorAll('.dropdown-menu.show').forEach(m => {
                        if (m !== menu) m.classList.remove('show');
                    });
                    menu.classList.toggle('show');
                }
            });
        });

        // ドロップダウン外クリックで閉じる (汎用)
        document.addEventListener('click', (e) => {
            const dropdowns = this.floatToolbar.querySelectorAll('.dropdown-menu.show');
            dropdowns.forEach(menu => {
                const container = menu.closest('.dropdown-container');
                if (container && !container.contains(e.target)) {
                    menu.classList.remove('show');
                }
            });
        });

        // フォーマットブロック選択 (カスタムドロップダウン)
        this.formatBlockDropdown = document.getElementById('formatBlockDropdown');
        if (this.formatBlockDropdown) {
            const items = this.formatBlockDropdown.querySelectorAll('.dropdown-item');

            // 項目選択
            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    // ドロップダウンを閉じる
                    const menu = item.closest('.dropdown-menu');
                    if (menu) menu.classList.remove('show');

                    const value = item.dataset.value;
                    const isBox = this.editor.tiptap.isActive('boxContainer');

                    // Box解除処理 (他スタイル選択時)
                    if (isBox && value !== 'box') {
                        // まずBoxを解除してParagraphに戻す
                        this.editor.tiptap.chain().focus().unsetBox().run();

                        // Paragraph以外が選択されていたら、さらにそのスタイルを適用
                        if (value !== 'p') {
                            if (value === 'blockquote') {
                                this.editor.tiptap.chain().focus().toggleBlockquote().run();
                            } else if (value.startsWith('h')) {
                                const level = parseInt(value.replace('h', ''));
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
                        const level = parseInt(value.replace('h', ''));
                        this.editor.tiptap.chain().focus().toggleHeading({ level }).run();
                    }

                    this.updateToolbarState();
                });
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
        const dropdownMenus = this.floatToolbar.querySelectorAll('.dropdown-menu');
        dropdownMenus.forEach(menu => menu.classList.remove('show'));

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

        // フォーマット選択の更新 (カスタムドロップダウン)
        this.formatBlockDropdown = document.getElementById('formatBlockDropdown');
        if (this.formatBlockDropdown) {
            const triggerText = this.formatBlockDropdown.querySelector('.dropdown-trigger span');
            const triggerIcon = this.formatBlockDropdown.querySelector('.dropdown-trigger .icon:not(.dropdown-arrow) path');

            let currentFormat = 'p';
            let currentLabel = 'テキスト';

            // アイコンパス定義
            const iconPaths = {
                'p': "M420-160v-520H200v-120h560v120H540v520H420Z",
                'h1': "M200-280v-400h80v160h160v-160h80v400h-80v-160H280v160h-80Zm480 0v-320h-80v-80h160v400h-80Z",
                'h2': "M120-280v-400h80v160h160v-160h80v400h-80v-160H200v160h-80Zm400 0v-160q0-33 23.5-56.5T600-520h160v-80H520v-80h240q33 0 56.5 23.5T840-600v80q0 33-23.5 56.5T760-440H600v80h240v80H520Z",
                'h3': "M120-280v-400h80v160h160v-160h80v400h-80v-160H200v160h-80Zm400 0v-80h240v-80H600v-80h160v-80H520v-80h240q33 0 56.5 23.5T840-600v240q0 33-23.5 56.5T760-280H520Z",
                'h4': "M120-280v-400h80v160h160v-160h80v400h-80v-160H200v160h-80Zm600 0v-120H520v-280h80v200h120v-200h80v200h80v80h-80v120h-80Z",
                'blockquote': "m228-240 92-160q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 23-5.5 42.5T458-480L320-240h-92Zm360 0 92-160q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 23-5.5 42.5T818-480L680-240h-92Z",
                'box': "M200-280h560v-80H200v80Zm0-160h560v-80H200v80Zm0-160h400v-80H200v80Zm-40 440q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z"
            };

            if (this.editor.tiptap.isActive('heading', { level: 1 })) {
                currentFormat = 'h1';
                currentLabel = '見出し 1';
            } else if (this.editor.tiptap.isActive('heading', { level: 2 })) {
                currentFormat = 'h2';
                currentLabel = '見出し 2';
            } else if (this.editor.tiptap.isActive('heading', { level: 3 })) {
                currentFormat = 'h3';
                currentLabel = '見出し 3';
            } else if (this.editor.tiptap.isActive('heading', { level: 4 })) {
                currentFormat = 'h4';
                currentLabel = '見出し 4';
            } else if (this.editor.tiptap.isActive('blockquote')) {
                currentFormat = 'blockquote';
                currentLabel = '引用';
            } else if (this.editor.tiptap.isActive('boxContainer')) {
                currentFormat = 'box';
                currentLabel = 'ボックス';
            } else {
                currentFormat = 'p';
                currentLabel = 'テキスト';
            }

            // アイコンとラベルの更新
            if (triggerText) triggerText.textContent = currentLabel;
            if (triggerIcon && iconPaths[currentFormat]) {
                triggerIcon.setAttribute('d', iconPaths[currentFormat]);
            }

            // ドロップダウン項目のアクティブ表示
            const items = this.formatBlockDropdown.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                if (item.dataset.value === currentFormat) {
                    item.classList.add('active');
                    // SVGの色もactiveクラスCSSで変わるはずだが、念のため確認
                } else {
                    item.classList.remove('active');
                }
            });
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
