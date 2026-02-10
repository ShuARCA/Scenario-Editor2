/**
 * コメント管理
 * 
 * コメントの挿入・編集・削除、コメントパネル、サイドバー表示を担当します。
 * 
 * @module managers/CommentManager
 */

import { PanelPositioner } from '../ui/PanelPositioner.js';

/**
 * コメント管理クラス
 */
export class CommentManager {
    /**
     * CommentManagerのコンストラクタ
     * 
     * @param {Object} editorCore - EditorManagerまたはEditorCoreへの参照
     */
    constructor(editorCore) {
        /** @type {Object} エディタへの参照 */
        this.editor = editorCore;

        /** @type {PanelPositioner} 位置計算ユーティリティ */
        this.positioner = new PanelPositioner();

        /** @type {Object|null} 編集中のコメント情報 */
        this.currentCommentTarget = null;

        /** @type {string} コメント表示モード ('always' | 'hover') */
        this.displayMode = 'hover';

        // DOM参照
        this.commentPanel = document.getElementById('comment-panel');
        this.commentInput = document.getElementById('comment-input');
        this.commentApplyBtn = document.getElementById('comment-apply-btn');
        this.commentDeleteBtn = document.getElementById('comment-delete-btn');
        this.commentBtn = document.getElementById('commentBtn');
        this.commentSidebar = document.getElementById('comment-sidebar');
        this.commentList = document.getElementById('comment-list');
        this.commentPopup = document.getElementById('comment-popup');
        this.commentDisplaySelect = document.getElementById('comment-display-select');

        /** @type {boolean} 編集ロック状態 */
        this._locked = false;
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * コメントパネルをセットアップします。
     */
    setupCommentPanel() {
        if (!this.commentPanel) return;

        // 適用ボタン
        if (this.commentApplyBtn) {
            this.commentApplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._applyCommentFromPanel();
            });
        }

        // 削除ボタン
        if (this.commentDeleteBtn) {
            this.commentDeleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._deleteCommentFromPanel();
            });
        }

        // Enterキーで適用(Shift+Enterは改行)
        if (this.commentInput) {
            this.commentInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._applyCommentFromPanel();
                } else if (e.key === 'Escape') {
                    this.hideCommentPanel();
                }
            });
        }

        // パネル外クリックで閉じる
        document.addEventListener('mousedown', (e) => {
            if (this.commentPanel &&
                !this.commentPanel.classList.contains('hidden') &&
                !this.commentPanel.contains(e.target) &&
                e.target !== this.commentBtn) {
                this.hideCommentPanel();
            }
        });

        // 表示モード変更 (設定画面の適用ボタン経由で変更される)
        // SettingsManagerが発火するイベントを購読
        document.addEventListener('commentDisplayModeChange', (e) => {
            if (e.detail && e.detail.mode) {
                this.displayMode = e.detail.mode;
                this._updateCommentDisplay();
            }
        });

        // 初期表示モードを読み込み
        this._loadCommentDisplayMode();

        // リアルタイム同期用のイベントリスナー設定
        if (this.editor.eventBus) {
            this.editor.eventBus.on('editor:rawUpdate', () => {
                if (this.displayMode === 'always') {
                    this.updateCommentSidebar();
                }
            });
        }

        // 外部クリックでの選択解除
        document.addEventListener('mousedown', (e) => {
            // サイドバーアイテム以外がクリックされた場合、選択解除
            // ただし、コメントパネル操作中や編集ボタンクリック時は除外したいが、
            // stopPropagationで制御されているはず。
            // ここでは「.comment-list-item」内かどうかを判定
            if (!e.target.closest('.comment-list-item')) {
                if (this.activeCommentId) {
                    this.activeCommentId = null;
                    this._updateActiveState();
                }
            }
        });
    }

    /**
     * コメントホバー機能をセットアップします。
     */
    setupCommentHover() {
        const editorContainer = this.editor.editorContainer;
        if (!editorContainer) return;

        editorContainer.addEventListener('mouseover', (e) => {
            const commentMark = e.target.closest('.comment-mark');
            if (commentMark) {
                if (this.displayMode === 'hover') {
                    this._showCommentPopup(commentMark);
                } else if (this.displayMode === 'always') {
                    // サイドバーの対応する要素をホバー状態にする
                    const commentId = commentMark.dataset.commentId;
                    if (commentId && this.commentList) {
                        const sidebarItem = this.commentList.querySelector(`.comment-list-item[data-comment-id="${commentId}"]`);
                        if (sidebarItem) {
                            sidebarItem.classList.add('hover-sync');
                        }
                    }
                }
            }
        });

        editorContainer.addEventListener('mouseout', (e) => {
            const commentMark = e.target.closest('.comment-mark');
            if (commentMark) {
                if (this.displayMode === 'hover') {
                    setTimeout(() => {
                        if (!this.commentPopup?.matches(':hover')) {
                            this._hideCommentPopup();
                        }
                    }, 100);
                } else if (this.displayMode === 'always') {
                    // サイドバーのホバー状態を解除
                    if (this.commentList) {
                        const items = this.commentList.querySelectorAll('.comment-list-item.hover-sync');
                        items.forEach(item => item.classList.remove('hover-sync'));
                    }
                }
            }
        });

        // ポップアップからマウスが離れたら非表示
        if (this.commentPopup) {
            this.commentPopup.addEventListener('mouseleave', () => {
                this._hideCommentPopup();
            });

            // ポップアップ内のボタン処理
            this.commentPopup.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.comment-popup-edit-btn');

                if (editBtn && this.currentPopupCommentId) {
                    const commentId = this.currentPopupCommentId; // 先に保存
                    this._hideCommentPopup(); // これでcurrentPopupCommentIdがnullになる
                    this._editCommentById(commentId); // 保存したIDを使用
                }
            });
        }
    }

    // =====================================================
    // ロック制御
    // =====================================================

    /**
     * 編集ロック状態を設定します。
     * ロック中はコメント挿入/編集をブロックします。
     * コメントの閲覧（ポップアップ表示、サイドバー表示）は維持されます。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
        if (locked) {
            this.hideCommentPanel();
        }
        // ポップアップ内の編集ボタンの表示/非表示
        if (this.commentPopup) {
            const editBtn = this.commentPopup.querySelector('.comment-popup-edit-btn');
            if (editBtn) {
                editBtn.style.display = locked ? 'none' : '';
            }
        }
        // サイドバー内の編集ボタンの表示/非表示
        if (this.commentList) {
            const editBtns = this.commentList.querySelectorAll('.comment-list-item-edit-btn');
            editBtns.forEach(btn => {
                btn.style.display = locked ? 'none' : '';
            });
        }
    }

    // =====================================================
    // コメント操作
    // =====================================================

    /**
     * コメントを挿入/編集します。
     */
    insertComment() {
        if (!this.editor.tiptap || this._locked) return;

        const { from, to, empty } = this.editor.tiptap.state.selection;

        // 選択範囲がない場合は何もしない
        if (empty || from === to) return;

        // 既存のコメントを検出
        const commentInfo = this.detectExistingComment();

        this.showCommentPanel(commentInfo);
    }

    /**
     * 選択範囲内の既存コメントを検出します。
     * 
     * @returns {{firstComment: Object|null, allComments: Array}}
     */
    detectExistingComment() {
        if (!this.editor.tiptap) {
            return { firstComment: null, allComments: [] };
        }

        const { from, to } = this.editor.tiptap.state.selection;
        const allComments = [];
        let firstComment = null;

        this.editor.tiptap.state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isText && node.marks) {
                const commentMark = node.marks.find(m => m.type.name === 'comment');
                if (commentMark) {
                    const commentData = {
                        commentId: commentMark.attrs.commentId,
                        commentText: commentMark.attrs.commentText || '',
                        from: pos,
                        to: pos + node.nodeSize
                    };
                    // 重複チェック
                    if (!allComments.find(c => c.commentId === commentData.commentId)) {
                        allComments.push(commentData);
                        if (!firstComment) {
                            firstComment = commentData;
                        }
                    }
                }
            }
        });

        return { firstComment, allComments };
    }

    // =====================================================
    // パネル表示/非表示
    // =====================================================

    /**
     * コメントパネルを表示します。
     * 
     * @param {Object} commentInfo - 既存コメント情報
     */
    showCommentPanel(commentInfo = null) {
        if (!this.commentPanel || !this.commentInput) return;

        // 既存コメントがある場合は編集モード
        if (commentInfo?.firstComment) {
            this.currentCommentTarget = commentInfo.firstComment;
            this.commentInput.value = commentInfo.firstComment.commentText || '';
            if (this.commentDeleteBtn) {
                this.commentDeleteBtn.classList.remove('hidden');
            }
        } else {
            this.currentCommentTarget = null;
            this.commentInput.value = '';
            if (this.commentDeleteBtn) {
                this.commentDeleteBtn.classList.add('hidden');
            }
        }

        // 位置計算
        const position = this._calculatePanelPosition();
        if (position) {
            this.commentPanel.style.top = `${position.top}px`;
            this.commentPanel.style.left = `${position.left}px`;
        }

        this.commentPanel.classList.remove('hidden');

        // 入力フィールドにフォーカス
        setTimeout(() => {
            this.commentInput.focus();
        }, 10);
    }

    /**
     * コメントパネルを非表示にします。
     */
    hideCommentPanel() {
        if (this.commentPanel) {
            this.commentPanel.classList.add('hidden');
        }
        this.currentCommentTarget = null;
    }

    // =====================================================
    // ボタン状態
    // =====================================================

    /**
     * コメントボタンの状態を更新します。
     */
    updateCommentButtonState() {
        if (!this.commentBtn) return;

        const commentInfo = this.detectExistingComment();
        if (commentInfo.allComments.length > 0) {
            this.commentBtn.classList.add('has-comment');
        } else {
            this.commentBtn.classList.remove('has-comment');
        }
    }

    // =====================================================
    // サイドバー
    // =====================================================

    /**
     * コメントサイドバーを更新します。
     */
    updateCommentSidebar() {
        if (!this.commentList || !this.commentSidebar) return;

        if (this.displayMode !== 'always') {
            this.commentSidebar.classList.add('hidden');
            return;
        }

        const comments = this._getAllComments();
        this.commentList.innerHTML = '';

        if (comments.length === 0) {
            // コメントがない場合でもサイドバーは表示しておく（必要なら）
            // this.commentSidebar.classList.add('hidden'); 
            // 元の実装ではコメントがある時のみ中身を入れるが、サイドバー自体の表示制御は_updateCommentDisplayで行う
        }

        this.commentSidebar.classList.remove('hidden');

        comments.forEach(comment => {
            const item = document.createElement('div');
            item.className = 'comment-list-item'; // クラス名を元に戻す (old: comment-list-item, new: comment-sidebar-item)
            // スタイル合わせのため、もしcss側でsidebar-itemになっているならそちらに合わせる必要があるが、
            // oldのcssクラス名 `comment-list-item` が使われている可能性が高い。
            // newのクラスではなくoldのクラスを使用する。
            // しかし、step 5のnew実装では `comment-sidebar-item` を使っていた。
            // users request says "refer to backup". Backup uses `comment-list-item`.
            // I will use `comment-list-item` to match the backup logic.
            if (comment.commentId === this.activeCommentId) {
                item.classList.add('active');
            }
            item.dataset.commentId = comment.commentId;
            item.setAttribute('data-comment-from', comment.from); // for positioning

            const textDiv = document.createElement('div');
            textDiv.className = 'comment-list-item-text'; // old class
            textDiv.textContent = comment.commentText;
            item.appendChild(textDiv);

            // 編集アイコン
            const editBtn = document.createElement('button');
            editBtn.className = 'comment-list-item-edit-btn'; // old class
            editBtn.title = '編集';
            editBtn.innerHTML = this._getEditIconSVG();
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._editCommentById(comment.commentId);
            });
            item.appendChild(editBtn);

            // クリックでハイライト
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // 外部クリック解除を防ぐ

                // 状態更新
                this.activeCommentId = comment.commentId;
                this._updateActiveState();

                // テキスト範囲をハイライト
                // commentオブジェクトにtoが含まれていない場合があるので確認が必要
                // _getAllCommentsの実装を確認すると to も推測できるが、markからnodeSizeを取得する必要がある。
                // 下の_getAllCommentsも修正する必要があるかもしれない。
                const to = comment.to || (comment.from + (comment.baseText ? comment.baseText.length : 0));
                this._highlightCommentRange(comment.from, to);
            });

            // ホバーでエディタ側のテキストをハイライト
            item.addEventListener('mouseenter', () => {
                this._setCommentMarkHighlight(comment.commentId, true);
            });

            item.addEventListener('mouseleave', () => {
                if (comment.commentId !== this.activeCommentId) {
                    this._setCommentMarkHighlight(comment.commentId, false);
                }
            });

            this.commentList.appendChild(item);
        });

        // 位置更新
        requestAnimationFrame(() => {
            this._updateCommentPositions();
        });
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * パネル位置を計算します。
     * 
     * @returns {{top: number, left: number}|null}
     * @private
     */
    _calculatePanelPosition() {
        if (this.commentBtn) {
            return this.positioner.calculateFromAnchor(this.commentBtn, {
                offsetY: 8,
                panelWidth: 280,
                panelHeight: 120
            });
        }

        return this.positioner.calculateFromSelection({
            panelWidth: 280,
            panelHeight: 120
        });
    }

    /**
     * コメントパネルからコメントを適用します。
     * 
     * @private
     */
    _applyCommentFromPanel() {
        if (!this.commentInput || !this.editor.tiptap) return;

        const commentText = this.commentInput.value.trim();
        if (!commentText) {
            this.hideCommentPanel();
            return;
        }

        if (this.currentCommentTarget?.commentId) {
            // 編集モード
            this.editor.tiptap.chain()
                .focus()
                .updateComment(this.currentCommentTarget.commentId, commentText)
                .run();
        } else {
            // 新規作成
            this.editor.tiptap.chain()
                .focus()
                .setComment(commentText)
                .run();
        }

        this.hideCommentPanel();
        this.updateCommentSidebar();
    }

    /**
     * コメントパネルからコメントを削除します。
     * 
     * @private
     */
    _deleteCommentFromPanel() {
        if (this.currentCommentTarget?.commentId && this.editor.tiptap) {
            this.editor.tiptap.chain()
                .focus()
                .removeCommentById(this.currentCommentTarget.commentId)
                .run();
        }
        this.hideCommentPanel();
        this.updateCommentSidebar();
    }

    /**
     * 表示モードを読み込みます。
     * 
     * @private
     */
    _loadCommentDisplayMode() {
        const savedSettings = localStorage.getItem('ieditweb-settings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                if (parsed.commentDisplayMode) {
                    this.displayMode = parsed.commentDisplayMode;
                }
            } catch (e) {
                console.warn('Failed to parse settings:', e);
            }
        }

        // 旧設定との互換性（もしあれば）
        if (!savedSettings) {
            const legacyMode = localStorage.getItem('commentDisplayMode');
            if (legacyMode) {
                this.displayMode = legacyMode;
            }
        }

        if (this.commentDisplaySelect) {
            this.commentDisplaySelect.value = this.displayMode;
        }
        this._updateCommentDisplay();
    }

    /**
     * 表示モードに応じてUIを更新します。
     * 
     * @private
     */
    _updateCommentDisplay() {
        // localStorageへの保存はSettingsManagerが担当するため、ここでは行わない

        if (this.displayMode === 'always') {
            this.commentSidebar?.classList.remove('hidden');
            this.updateCommentSidebar();
        } else {
            if (this.commentSidebar) {
                this.commentSidebar.classList.add('hidden');
            }
        }
    }

    /**
     * すべてのコメントを取得します。
     * 
     * @returns {Array}
     * @private
     */
    _getAllComments() {
        if (!this.editor.tiptap) return [];

        const comments = [];
        // doc.descendantsを使って走査し、見出し順（出現順）に並べる
        this.editor.tiptap.state.doc.descendants((node, pos) => {
            if (node.isText && node.marks) {
                const commentMark = node.marks.find(m => m.type.name === 'comment');
                if (commentMark) {
                    // 同じIDが既に登録されていないか確認
                    const exists = comments.find(c => c.commentId === commentMark.attrs.commentId);
                    if (!exists) {
                        comments.push({
                            commentId: commentMark.attrs.commentId,
                            commentText: commentMark.attrs.commentText || '',
                            from: pos,
                            to: pos + node.nodeSize,
                            baseText: node.text
                        });
                    }
                }
            }
        });

        return comments;
    }

    /**
     * コメントの位置を更新します。
     * @private
     */
    _updateCommentPositions() {
        if (!this.commentList || this.displayMode !== 'always') return;
        if (!this.editor.tiptap) return;

        const editorContainer = document.getElementById('editor-container');
        const sidebarRect = this.commentSidebar?.getBoundingClientRect();
        if (!editorContainer || !sidebarRect) return;

        const items = this.commentList.querySelectorAll('.comment-list-item');
        let lastBottom = 0; // 直前のコメントの下端位置
        const MIN_SPACING = 8; // コメント間の最小間隔

        items.forEach(item => {
            const from = parseInt(item.getAttribute('data-comment-from'), 10);
            if (isNaN(from)) return;

            try {
                // テキスト位置から座標を取得
                const coords = this.editor.tiptap.view.coordsAtPos(from);

                // サイドバー内での相対位置を計算
                // coords.topはビューポート基準、sidebarRect.topもビューポート基準
                // requestAnimationFrame内で実行されることが多いため、最新の値を計算
                let relativeTop = coords.top - sidebarRect.top;

                // 衝突判定と位置調整
                // 前のコメントの下端よりも上に来てしまう場合は押し下げる
                if (relativeTop < lastBottom + MIN_SPACING) {
                    relativeTop = lastBottom + MIN_SPACING;
                }

                // 位置を設定
                item.style.position = 'absolute';
                item.style.top = `${relativeTop}px`;
                item.style.left = '8px';
                item.style.right = '8px';

                // 次の判定のために下端を更新
                // offsetHeightで高さを取得 (レイアウト再計算が発生する可能性があるが、整合性確保のため必要)
                const height = item.offsetHeight;
                lastBottom = relativeTop + height;

            } catch (e) {
                // 位置計算エラーは無視
                console.warn('Comment positioning error:', e);
            }
        });
    }

    /**
     * サイドバーの選択状態を更新します（再描画なし）。
     * @private
     */
    _updateActiveState() {
        if (!this.commentList) return;
        const items = this.commentList.querySelectorAll('.comment-list-item');
        items.forEach(item => {
            const commentId = item.dataset.commentId;
            if (commentId === this.activeCommentId) {
                item.classList.add('active');
                this._setCommentMarkHighlight(commentId, true);
            } else {
                item.classList.remove('active');
                this._setCommentMarkHighlight(commentId, false);
            }
        });
    }

    /**
     * エディタ上のコメントマークのハイライトを設定します。
     * @param {string} commentId - コメントID
     * @param {boolean} isHighlighted - ハイライトするかどうか
     * @private
     */
    _setCommentMarkHighlight(commentId, isHighlighted) {
        if (!this.editor.editorContainer) return;

        // data-comment-idを持つすべてのマーク要素を取得 (分割されている可能性があるため)
        const marks = this.editor.editorContainer.querySelectorAll(`.comment-mark[data-comment-id="${commentId}"]`);
        marks.forEach(mark => {
            if (isHighlighted) {
                mark.classList.add('hover-sync');
            } else {
                mark.classList.remove('hover-sync');
            }
        });
    }

    /**
     * コメント範囲をハイライト表示します。
     * @param {number} from - 開始位置
     * @param {number} to - 終了位置
     * @private
     */
    _highlightCommentRange(from, to) {
        if (!this.editor.tiptap) return;
    }

    /**
     * コメントポップアップを表示します。
     * 
     * @param {HTMLElement} commentMark - コメントマーク要素
     * @private
     */
    _showCommentPopup(commentMark) {
        if (!this.commentPopup) return;

        const commentId = commentMark.dataset.commentId;
        const commentText = commentMark.dataset.commentText;

        if (!commentText) return;

        this.currentPopupCommentId = commentId;

        const textEl = this.commentPopup.querySelector('.comment-popup-text');
        if (textEl) {
            textEl.textContent = commentText;
        }

        const rect = commentMark.getBoundingClientRect();
        this.commentPopup.style.top = `${rect.bottom + 5 + window.scrollY}px`;
        this.commentPopup.style.left = `${rect.left + window.scrollX}px`;
        this.commentPopup.classList.remove('hidden');
    }

    /**
     * コメントポップアップを非表示にします。
     * 
     * @private
     */
    _hideCommentPopup() {
        if (this.commentPopup) {
            this.commentPopup.classList.add('hidden');
        }
        this.currentPopupCommentId = null;
        this.activeCommentId = null; // 選択中のコメントID
    }

    /**
     * コメントIDでコメントを編集します。
     * 
     * @param {string} commentId
     * @private
     */
    _editCommentById(commentId) {
        // コメントを検索して選択
        const allComments = this._getAllComments();
        const target = allComments.find(c => c.commentId === commentId);

        if (target && this.editor.tiptap) {
            // 1. テキストを選択状態にする
            this.editor.tiptap.chain()
                .focus()
                .setTextSelection({ from: target.from, to: target.to })
                .run();

            // 2. フローティングツールバーを表示 (ToolBarManager経由)
            // main.js で toolbarManager へのアクセスを許可している前提
            if (this.editor.toolbarManager) {
                this.editor.toolbarManager.showFloatToolbar();
            }

            // 3. コメントボタンを押下する (処理で実行)
            // これにより ToolbarManager -> CommentManager.insertComment -> showCommentPanel
            // という正規のフローが走り、位置計算もボタン基準(表示されている場合)または選択範囲基準で行われる
            setTimeout(() => {
                const commentBtn = document.getElementById('commentBtn');
                if (commentBtn) {
                    commentBtn.click();
                }
            }, 10);
        }
    }

    /**
     * 編集アイコンのSVGを取得します。
     * 
     * @returns {string}
     * @private
     */
    _getEditIconSVG() {
        return '<svg viewBox="0 -960 960 960" width="16" height="16"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>';
    }
}
