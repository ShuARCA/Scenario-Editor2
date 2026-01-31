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
            this.deleteImageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._deleteImage();
            });
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
     * 画像ツールバーを表示します。
     */
    showImageToolbar() {
        if (!this.imageToolbar || !this.editor.tiptap) return;

        const imageAttrs = this._getSelectedImageAttrs();
        if (!imageAttrs) return;

        // DOM内の選択された画像要素を探す
        const editorElement = this.editor.editorContainer?.querySelector('.tiptap');
        const selectedImage = editorElement?.querySelector('.image-container.selected img');

        if (!selectedImage) return;

        const rect = selectedImage.getBoundingClientRect();
        const toolbarHeight = 40;

        // 画像の上に配置
        this.imageToolbar.style.top = `${rect.top - toolbarHeight - 8 + window.scrollY}px`;
        this.imageToolbar.style.left = `${rect.left + window.scrollX}px`;
        this.imageToolbar.classList.remove('hidden');

        this._updateImageToolbarState(imageAttrs);
    }

    /**
     * 画像ツールバーを非表示にします。
     */
    hideImageToolbar() {
        if (this.imageToolbar) {
            this.imageToolbar.classList.add('hidden');
        }
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

        this.editor.tiptap.chain().focus().deleteSelection().run();
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
