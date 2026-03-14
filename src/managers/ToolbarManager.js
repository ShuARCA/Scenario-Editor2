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

        /** @type {boolean} モバイル（タッチデバイス）モード */
        this._isMobile = this._detectTouchDevice();

        /** @type {Function|null} Visual Viewport イベントハンドラ参照 */
        this._viewportHandler = null;

        // モバイルモードの初期化
        if (this._isMobile) {
            this._setupMobileMode();
        }
    }

    // =====================================================
    // モバイル判定・初期化
    // =====================================================

    /**
     * タッチデバイスかどうかを判定します。
     * 画面幅は使用せず、ポインター精度とタッチポイント数で判定します。
     * 
     * @returns {boolean} タッチデバイスの場合true
     */
    _detectTouchDevice() {
        const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const hasTouchPoints = navigator.maxTouchPoints > 0;
        return hasCoarsePointer && hasTouchPoints;
    }

    /**
     * モバイルモードの初期化処理を行います。
     * Visual Viewport APIへのイベントリスナー登録、CSSクラスの付与を行います。
     */
    _setupMobileMode() {
        this.floatToolbar.classList.add('mobile-mode');

        // Visual Viewport APIでキーボードの表示/非表示を追従
        if (window.visualViewport) {
            this._viewportHandler = this._onVisualViewportChange.bind(this);
            window.visualViewport.addEventListener('resize', this._viewportHandler);
            window.visualViewport.addEventListener('scroll', this._viewportHandler);
        }
    }

    /**
     * Visual Viewport の resize / scroll イベントハンドラ。
     * ツールバーが表示中の場合、キーボード上部に位置を更新します。
     */
    _onVisualViewportChange() {
        if (this.floatToolbar.classList.contains('hidden')) return;
        this._positionMobileToolbar();
    }

    /**
     * モバイル環境でのツールバー位置を計算・設定します。
     * キーボードの直上に配置するために Visual Viewport API を利用します。
     */
    _positionMobileToolbar() {
        const vv = window.visualViewport;
        if (!vv) return;

        // Visual Viewport の bottom = offsetTop + height
        // キーボードが表示されるとvv.heightが縮む
        const toolbarBottom = window.innerHeight - (vv.offsetTop + vv.height);
        this.floatToolbar.style.bottom = `${toolbarBottom}px`;
        // fixed配置なので top / left はCSSで制御
        this.floatToolbar.style.top = 'auto';
        this.floatToolbar.style.left = '0';
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
                document.getElementById('image-toolbar'),
                document.getElementById('global-color-picker-container')
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
     * モバイルとデスクトップで配置方法を切り替えます。
     */
    showFloatToolbar() {
        if (!this.editor.tiptap || this._locked) return;

        const { from, to } = this.editor.tiptap.state.selection;
        if (from === to) return;

        // 正しいサイズ計測のために、一時的に表示状態（ただし不可視）にする
        this.floatToolbar.style.visibility = 'hidden';
        this.floatToolbar.classList.remove('hidden');

        if (this._isMobile) {
            this._showMobileToolbar();
        } else {
            this._showDesktopToolbar(from, to);
        }

        // 可視化
        this.floatToolbar.style.visibility = '';
    }

    /**
     * デスクトップ環境でのツールバー表示処理。
     * 選択範囲の中央上部に絶対座標で配置します。
     * 
     * @param {number} from - 選択範囲の開始位置
     * @param {number} to - 選択範囲の終了位置
     */
    _showDesktopToolbar(from, to) {
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
    }

    /**
     * モバイル環境でのツールバー表示処理。
     * 画面下部（キーボードの直上）にfixed配置します。
     */
    _showMobileToolbar() {
        this._positionMobileToolbar();
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

        // モバイルモード時のインラインスタイルをリセット
        if (this._isMobile) {
            this.floatToolbar.style.bottom = '';
            this.floatToolbar.style.top = '';
            this.floatToolbar.style.left = '';
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

        // リストドロップダウントリガーのアクティブ状態とアイコンの更新
        const listDropdown = document.getElementById('listDropdown');
        if (listDropdown) {
            const trigger = listDropdown.querySelector('.dropdown-trigger');
            const triggerIcon = trigger ? trigger.querySelector('.icon:not([style*="width"]) path') : null;

            let currentList = null;
            if (this.editor.tiptap.isActive('bulletList')) {
                currentList = 'bulletList';
            } else if (this.editor.tiptap.isActive('orderedList')) {
                currentList = 'orderedList';
            } else if (this.editor.tiptap.isActive('taskList')) {
                currentList = 'taskList';
            }

            const listIcons = {
                'bulletList': "M360-200v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360ZM200-160q-33 0-56.5-23.5T120-240q0-33 23.5-56.5T200-320q33 0 56.5 23.5T280-240q0 33-23.5 56.5T200-160Zm0-240q-33 0-56.5-23.5T120-480q0-33 23.5-56.5T200-560q33 0 56.5 23.5T280-480q0 33-23.5 56.5T200-400Zm-56.5-263.5Q120-687 120-720t23.5-56.5Q167-800 200-800t56.5 23.5Q280-753 280-720t-23.5 56.5Q233-640 200-640t-56.5-23.5Z",
                'orderedList': "M120-80v-60h100v-30h-60v-60h60v-30H120v-60h120q17 0 28.5 11.5T280-280v40q0 17-11.5 28.5T240-200q17 0 28.5 11.5T280-160v40q0 17-11.5 28.5T240-80H120Zm0-280v-110q0-17 11.5-28.5T160-510h60v-30H120v-60h120q17 0 28.5 11.5T280-560v70q0 17-11.5 28.5T240-450h-60v30h100v60H120Zm60-280v-180h-60v-60h120v240h-60Zm180 440v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360Z",
                'taskList': "M222-200 80-342l56-56 85 85 170-170 56 57-225 226Zm0-320L80-662l56-56 85 85 170-170 56 57-225 226Zm298 240v-80h360v80H520Zm0-320v-80h360v80H520Z"
            };

            if (currentList && listIcons[currentList]) {
                if (triggerIcon) {
                    triggerIcon.setAttribute('d', listIcons[currentList]);
                }
                trigger.classList.add('active');
            } else {
                if (triggerIcon) {
                    triggerIcon.setAttribute('d', listIcons['bulletList']); // デフォルトは箇条書きアイコン
                }
                trigger.classList.remove('active');
            }
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
                } else {
                    item.classList.remove('active');
                }
            });
        }

        // テキスト配置の更新
        const alignDropdown = document.getElementById('alignDropdown');
        if (alignDropdown) {
            const triggerIcon = alignDropdown.querySelector('.dropdown-trigger .icon:not([style*="width"]) path');

            let currentAlign = 'left';
            if (this.editor.tiptap.isActive({ textAlign: 'center' })) {
                currentAlign = 'center';
            } else if (this.editor.tiptap.isActive({ textAlign: 'right' })) {
                currentAlign = 'right';
            }

            const alignIcons = {
                'left': "M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z",
                'center': "M3,3H21V5H3V3M7,7H17V9H7V7M3,11H21V13H3V11M7,15H17V17H7V15M3,19H21V21H3V19Z",
                'right': "M3,3H21V5H3V3M9,7H21V9H9V7M3,11H21V13H3V11M9,15H21V17H9V15M3,19H21V21H3V19Z"
            };

            // トリガーアイコン更新
            if (triggerIcon && alignIcons[currentAlign]) {
                triggerIcon.setAttribute('d', alignIcons[currentAlign]);
            }

            // ドロップダウン項目のアクティブ表示
            const items = alignDropdown.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                const cmd = item.dataset.cmd; // alignLeft, alignCenter, alignRight
                const alignTypes = {
                    'alignLeft': 'left',
                    'alignCenter': 'center',
                    'alignRight': 'right'
                };

                if (alignTypes[cmd] === currentAlign) {
                    item.classList.add('active');
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
                if (color) {
                    textColorBtn.style.color = color;
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
            if (color) {
                highlightBtn.style.backgroundColor = color;
            } else {
                highlightBtn.style.backgroundColor = ''; // 透明/デフォルト
            }
        }
    }
}
