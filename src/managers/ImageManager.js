/**
 * 画像管理
 * 
 * 画像の挿入、リサイズ、配置、段組み設定、画像ツールバーを担当します。
 * 
 * @module managers/ImageManager
 */

/**
 * 画像管理クラス
 */
export class ImageManager {
    /**
     * ImageManagerのコンストラクタ
     * 
     * @param {Object} editorCore - EditorManagerまたはEditorCoreへの参照
     */
    constructor(editorCore) {
        /** @type {Object} エディタへの参照 */
        this.editor = editorCore;

        // DOM参照
        this.imageToolbar = document.getElementById('image-toolbar');
        this.alignLeftBtn = document.getElementById('align-left-btn');
        this.alignCenterBtn = document.getElementById('align-center-btn');
        this.alignRightBtn = document.getElementById('align-right-btn');
        this.floatToggleBtn = document.getElementById('float-toggle-btn');
        this.deleteImageBtn = document.getElementById('delete-image-btn');

        /** @type {boolean} 編集ロック状態 */
        this._locked = false;
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * 画像ツールバーをセットアップします。
     */
    setupImageToolbar() {
        // 配置ボタン
        if (this.alignLeftBtn) {
            this.alignLeftBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._setImageAlignment('left');
            });
        }

        if (this.alignCenterBtn) {
            this.alignCenterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._setImageAlignment('center');
            });
        }

        if (this.alignRightBtn) {
            this.alignRightBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._setImageAlignment('right');
            });
        }

        // 段組みトグルボタン
        if (this.floatToggleBtn) {
            this.floatToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._toggleImageFloat();
            });
        }

        // 削除ボタン
        if (this.deleteImageBtn) {
            this.deleteImageBtn.addEventListener('click', () => {
                this._deleteImage();
            });
        }

        // エディタ内の右クリックイベント設定
        this._setupEditorRightClick();

        // 外部クリックイベント設定（メニュー外クリック時の閉じる処理）
        this._setupOutsideClickListener();
    }

    /**
     * エディタ内の右クリックイベントを設定します。
     * 画像を右クリックした際に選択状態にし、ツールバーを表示します。
     * @private
     */
    _setupEditorRightClick() {
        // エディタコンテナの取得（ファサード経由または直接ID指定）
        const editorElement = this.editor.editorContainer || document.getElementById('editor');
        if (!editorElement) return;

        editorElement.addEventListener('contextmenu', (e) => {
            const target = e.target;
            // 画像またはリサイズコンテナ内の画像を右クリックした場合
            if (target.tagName === 'IMG' && target.closest('.resizable-container')) {
                e.preventDefault(); // ブラウザ標準のコンテキストメニューを抑制
                e.stopPropagation();

                // 画像を選択状態にする
                this._selectImageByElement(target);

                // 選択状態の更新イベントは非同期で発生する可能性があるため
                // 直後にツールバーの表示更新を試みる
                setTimeout(() => {
                    this.showImageToolbar();
                }, 10);
            }
        });
    }

    /**
     * 画像またはツールバー以外をクリックした際の処理を設定します。
     * @private
     */
    _setupOutsideClickListener() {
        document.addEventListener('click', (e) => {
            // エディタが存在しない場合は何もしない
            if (!this.editor.tiptap) return;

            const target = e.target;

            // クリックされた要素がどこにあるか判定
            const isInsideToolbar = this.imageToolbar && this.imageToolbar.contains(target);
            const isInsideImage = target.closest('.resizable-container');

            // ツールバーでも画像でもない場所がクリックされた場合
            if (!isInsideToolbar && !isInsideImage) {
                // 画像が選択されているか確認
                if (this.isImageSelected()) {
                    // 画像の選択状態を解除（カーソル位置を選択開始位置に戻す＝テキスト選択状態にする）
                    // これによりNodeSelectionが解除され、NodeViewのdeselectNodeが発火して.selectedクラスが消える
                    const { from } = this.editor.tiptap.state.selection;
                    this.editor.tiptap.commands.setTextSelection(from);

                    // ツールバーを隠す
                    this.hideImageToolbar();
                } else {
                    // 画像が選択されていなくても（何らかの理由で）ツールバーが出ていたら隠す
                    if (this.imageToolbar && !this.imageToolbar.classList.contains('hidden')) {
                        this.hideImageToolbar();
                    }
                }
            }
        });
    }

    /**
     * DOM要素から画像を選択状態にします。
     * @param {HTMLElement} imgElement 
     * @private
     */
    _selectImageByElement(imgElement) {
        if (!this.editor.tiptap) return;

        // TiptapのViewからDOM位置に対応するドキュメント位置を取得
        // closest('.resizable-container') でコンテナを取得し、そこから位置を探るのが確実
        const container = imgElement.closest('.resizable-container');
        if (!container) return;

        try {
            // DOM要素の位置を取得
            const pos = this.editor.tiptap.view.posAtDOM(container, 0);

            if (pos !== null && pos !== undefined) {
                // その位置のノードを選択状態にする
                this.editor.tiptap.commands.setNodeSelection(pos);
            }
        } catch (error) {
            console.warn('Image selection failed:', error);
        }
    }

    // =====================================================
    // 画像操作
    // =====================================================

    /**
     * 画像をエディタに挿入します。
     * 
     * @param {string} src - 画像のソース（Base64またはURL）
     * @returns {string} 挿入された画像のID（互換性のため）
     */
    insertImage(src) {
        if (!this.editor.tiptap) return '';

        this.editor.tiptap.chain().focus().setImage({ src }).run();

        // 互換性のため、IDを返す（実際のIDはTiptapノード内で管理）
        return 'img-' + Date.now();
    }

    /**
     * ファイルから画像を読み込んでエディタに挿入します。
     * 
     * @param {File} file - 画像ファイル
     * @param {number|null} [pos=null] - 挿入位置（省略時は現在のカーソル位置）
     */
    insertImageFromFile(file, pos = null) {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target.result;
            if (pos !== null && this.editor.tiptap) {
                // 指定位置に挿入
                this.editor.tiptap.chain()
                    .focus()
                    .insertContentAt(pos, {
                        type: 'image',
                        attrs: { src }
                    })
                    .run();
            } else {
                this.insertImage(src);
            }
        };
        reader.readAsDataURL(file);
    }

    /**
     * 指定されたIDの画像をリサイズします。
     * 
     * @param {string} imageId - 画像のID
     * @param {number} width - 新しい幅（ピクセル）
     * @returns {boolean} 操作が成功したかどうか
     */
    resizeImage(imageId, width) {
        if (!this.editor.tiptap) return false;

        return this.editor.tiptap.chain()
            .focus()
            .resizeImage(width)
            .run();
    }

    // =====================================================
    // ツールバー表示/非表示
    // =====================================================

    /**
     * 編集ロック状態を設定します。
     * ロック中は画像ツールバーの表示をブロックします。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
        if (locked) {
            this.hideImageToolbar();
        }
    }

    /**
     * 画像ツールバーを表示します。
     */
    showImageToolbar() {
        if (!this.editor.tiptap || !this.imageToolbar || this._locked) return;

        const imageAttrs = this._getSelectedImageAttrs();
        if (!imageAttrs) return;

        this._updateImageToolbarState(imageAttrs); // 状態更新

        // 選択された画像要素（のラッパー）を見つける
        // TiptapのNodeSelectionからDOM要素を特定するのは少し難しいが、
        // .resizable-container.selected を探すのが手っ取り早い
        const selectedContainer = this.editor.editorContainer.querySelector('.resizable-container.selected');

        if (selectedContainer) {
            this.imageToolbar.classList.remove('hidden');
            this._positionImageToolbar(selectedContainer);
        }
    }

    /**
     * 画像ツールバーを非表示にします。
     * @private
     */
    hideImageToolbar() {
        this._hideImageToolbar();
    }

    /**
     * 画像ツールバーを非表示にします（内部用）。
     * @private
     */
    _hideImageToolbar() {
        if (this.imageToolbar) {
            this.imageToolbar.classList.add('hidden');
        }
    }

    /**
     * ツールバーの位置を調整します。
     * @param {HTMLElement} selectedContainer - 選択された画像を含むコンテナ要素
     * @private
     */
    _positionImageToolbar(selectedContainer) {
        const rect = selectedContainer.getBoundingClientRect();
        const toolbarHeight = 40; // ツールバーの高さ（CSSで定義されていると仮定）

        // 画像の上に配置
        this.imageToolbar.style.top = `${rect.top - toolbarHeight - 8 + window.scrollY}px`;
        this.imageToolbar.style.left = `${rect.left + window.scrollX}px`;
    }

    // =====================================================
    // 画像選択チェック
    // =====================================================

    /**
     * 画像ノードが選択されているかチェックします。
     * 
     * @returns {boolean}
     */
    isImageSelected() {
        if (!this.editor.tiptap) return false;

        const { from, to } = this.editor.tiptap.state.selection;
        let hasImage = false;

        this.editor.tiptap.state.doc.nodesBetween(from, to, (node) => {
            if (node.type.name === 'image') {
                hasImage = true;
                return false; // 早期終了
            }
        });

        return hasImage;
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * 選択中の画像ノードの属性を取得します。
     * 
     * @returns {Object|null}
     * @private
     */
    _getSelectedImageAttrs() {
        if (!this.editor.tiptap) return null;

        const { from, to } = this.editor.tiptap.state.selection;
        let imageAttrs = null;

        this.editor.tiptap.state.doc.nodesBetween(from, to, (node) => {
            if (node.type.name === 'image') {
                imageAttrs = node.attrs;
                return false;
            }
        });

        return imageAttrs;
    }

    /**
     * 画像の配置を設定します。
     * 
     * @param {string} alignment - 'left' | 'center' | 'right'
     * @private
     */
    _setImageAlignment(alignment) {
        if (!this.editor.tiptap) return;

        this.editor.tiptap.chain().focus().setImageAlignment(alignment).run();

        // ツールバー状態を更新
        const imageAttrs = this._getSelectedImageAttrs();
        if (imageAttrs) {
            this._updateImageToolbarState(imageAttrs);
        }
    }

    /**
     * 画像の段組みを切り替えます。
     * 
     * @private
     */
    _toggleImageFloat() {
        if (!this.editor.tiptap) return;

        const imageAttrs = this._getSelectedImageAttrs();
        if (!imageAttrs) return;

        const currentFloat = imageAttrs.floatEnabled || false;
        this.editor.tiptap.chain().focus().toggleImageFloat(!currentFloat).run();

        // ツールバー状態を更新
        setTimeout(() => {
            const newAttrs = this._getSelectedImageAttrs();
            if (newAttrs) {
                this._updateImageToolbarState(newAttrs);
            }
        }, 10);
    }

    /**
     * 画像を削除します。
     * 
     * @private
     */
    _deleteImage() {
        if (!this.editor.tiptap) return;

        // まず、現在の選択範囲が画像を含んでいるか確認
        let isImageSelected = this.isImageSelected();

        // 選択されていない場合、DOM上の選択状態からリカバリを試みる
        if (!isImageSelected) {
            const selectedContainer = this.editor.editorContainer.querySelector('.resizable-container.selected');
            if (selectedContainer) {
                const img = selectedContainer.querySelector('img');
                if (img) {
                    this._selectImageByElement(img);
                    isImageSelected = true;
                }
            }
        }

        // 削除実行
        // フォーカスを確実に戻してから削除コマンドを実行
        this.editor.tiptap.chain()
            .focus()
            .deleteSelection()
            .run();

        this.hideImageToolbar();
    }

    /**
     * 画像ツールバーの状態を更新します。
     * 
     * @param {Object} imageAttrs - 画像の属性
     * @private
     */
    _updateImageToolbarState(imageAttrs) {
        const alignment = imageAttrs.alignment || 'center';
        const floatEnabled = imageAttrs.floatEnabled || false;

        // 配置ボタンのアクティブ状態
        if (this.alignLeftBtn) {
            this.alignLeftBtn.classList.toggle('active', alignment === 'left');
        }
        if (this.alignCenterBtn) {
            this.alignCenterBtn.classList.toggle('active', alignment === 'center');
        }
        if (this.alignRightBtn) {
            this.alignRightBtn.classList.toggle('active', alignment === 'right');
        }

        // 段組みボタンのアクティブ状態
        if (this.floatToggleBtn) {
            this.floatToggleBtn.classList.toggle('active', floatEnabled);
            // 中央揃えの場合は無効化
            this.floatToggleBtn.disabled = (alignment === 'center');
        }
    }
}
