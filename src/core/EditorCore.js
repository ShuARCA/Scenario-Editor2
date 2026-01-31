/**
 * エディタコア
 * 
 * Tiptapエディタの初期化と基本操作を担当します。
 * 各マネージャーはこのクラスへの参照を通じてエディタを操作します。
 * 
 * @module core/EditorCore
 */

import { Editor } from 'tiptap';
import { Ruby } from '../extensions/ruby.js';
import { Comment } from '../extensions/comment.js';
import { Link, isValidUrl } from '../extensions/link.js'; // isValidUrlをインポート
import { HeadingWithId } from '../extensions/headingWithId.js';
import { ResizableImage } from '../extensions/resizableImage.js';
import { Sanitizer } from '../utils/Sanitizer.js';
import { CONFIG } from './Config.js';
import { debounce } from '../utils/helpers.js';

// StarterKitから必要な拡張をインポート
import {
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight
} from 'tiptap';

/**
 * エディタコアクラス
 * Tiptapエディタの初期化と基本操作を提供します。
 */
export class EditorCore {
    /**
     * EditorCoreのコンストラクタ
     * 
     * @param {import('./EventBus.js').EventBus} eventBus - イベントバス
     */
    constructor(eventBus) {
        /** @type {import('./EventBus.js').EventBus} イベントバス */
        this.eventBus = eventBus;

        /** @type {Sanitizer} HTMLサニタイザー */
        this.sanitizer = new Sanitizer();

        /** @type {Editor|null} Tiptapエディタインスタンス */
        this.tiptap = null;

        /** @type {HTMLElement|null} エディタコンテナ */
        this.editorContainer = null;

        // コールバック
        this._onUpdateCallback = null;
        this._onSelectionUpdateCallback = null;
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * エディタを初期化します。
     * 
     * @param {HTMLElement|string} container - エディタコンテナ要素またはID
     * @param {Object} [options={}] - オプション
     * @returns {Editor} Tiptapエディタインスタンス
     */
    init(container, options = {}) {
        // コンテナの取得
        if (typeof container === 'string') {
            this.editorContainer = document.getElementById(container);
        } else {
            this.editorContainer = container;
        }

        if (!this.editorContainer) {
            throw new Error('エディタコンテナが見つかりません');
        }

        // 既存のコンテンツを取得
        const initialContent = this.editorContainer.innerHTML;

        // contenteditableを無効化（Tiptapが管理）
        this.editorContainer.removeAttribute('contenteditable');
        this.editorContainer.innerHTML = '';

        // Tiptapエディタを作成
        this.tiptap = new Editor({
            element: this.editorContainer,
            extensions: this._getExtensions(),
            content: initialContent || '<h1>ここにタイトルを入力...</h1><p>本文をここに入力してください。</p>',
            autofocus: options.autofocus ?? true,
            editorProps: {
                attributes: {
                    id: 'editor',
                    spellcheck: 'false'
                },
                handlePaste: (view, event, slice) => {
                    return this._handlePaste(view, event, slice);
                },
                handleDrop: (view, event, slice, moved) => {
                    return this._handleDrop(view, event, slice, moved);
                }
            },
            onUpdate: ({ editor }) => {
                this._onEditorUpdate();
            },
            onSelectionUpdate: ({ editor }) => {
                this._onSelectionUpdate();
            }
        });

        return this.tiptap;
    }

    /**
     * Tiptap拡張のリストを取得します。
     * 
     * @returns {Array} 拡張の配列
     * @private
     */
    _getExtensions() {
        return [
            StarterKit.configure({
                heading: false,
                image: false
            }),
            HeadingWithId,
            Ruby,
            Comment,
            Link,
            ResizableImage,
            TextStyle,
            Color,
            Underline.extend({
                renderHTML({ HTMLAttributes }) {
                    return ['span', {
                        style: 'text-decoration: underline;',
                        ...HTMLAttributes
                    }, 0]
                }
            }),
            Highlight.configure({
                multicolor: true
            })
        ];
    }

    // =====================================================
    // コンテンツ操作
    // =====================================================

    /**
     * エディタのHTMLコンテンツを取得します。
     * 
     * @returns {string} HTMLコンテンツ
     */
    getContent() {
        if (!this.tiptap) return '';
        return this.tiptap.getHTML();
    }

    /**
     * エディタにHTMLコンテンツを設定します。
     * 
     * @param {string} html - HTMLコンテンツ
     */
    setContent(html) {
        if (!this.tiptap) return;
        const sanitizedHtml = this.sanitizer.sanitize(html);
        this.tiptap.commands.setContent(sanitizedHtml);
    }

    /**
     * エディタのJSONコンテンツを取得します。
     * 
     * @returns {Object} JSONコンテンツ
     */
    getJSON() {
        if (!this.tiptap) return {};
        return this.tiptap.getJSON();
    }

    // =====================================================
    // 基本コマンド
    // =====================================================

    /**
     * 直前の操作を取り消します（Undo）。
     * 
     * @returns {boolean} 成功したかどうか
     */
    undo() {
        if (!this.tiptap) return false;
        return this.tiptap.commands.undo();
    }

    /**
     * 取り消した操作をやり直します（Redo）。
     * 
     * @returns {boolean} 成功したかどうか
     */
    redo() {
        if (!this.tiptap) return false;
        return this.tiptap.commands.redo();
    }

    /**
     * 選択範囲にスタイルを適用します。
     * 
     * @param {string} style - スタイル名
     * @param {*} [value=null] - スタイルの値
     * @returns {boolean} 成功したかどうか
     */
    applyStyle(style, value = null) {
        if (!this.tiptap) return false;

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
     * 見出しレベルを設定します。
     * 
     * @param {number} level - 見出しレベル（1-4）、0の場合は段落
     * @returns {boolean} 成功したかどうか
     */
    setHeadingLevel(level) {
        if (!this.tiptap) return false;

        if (level === 0) {
            return this.tiptap.chain().focus().setParagraph().run();
        }
        return this.tiptap.chain().focus().toggleHeading({ level }).run();
    }

    /**
     * テキスト色を設定します。
     * 
     * @param {string} color - 色（HEX形式）
     * @returns {boolean} 成功したかどうか
     */
    setTextColor(color) {
        if (!this.tiptap) return false;
        return this.tiptap.chain().focus().setColor(color).run();
    }

    /**
     * テキスト色を解除します。
     * 
     * @returns {boolean} 成功したかどうか
     */
    unsetTextColor() {
        if (!this.tiptap) return false;
        return this.tiptap.chain().focus().unsetColor().run();
    }

    /**
     * 背景色（ハイライト）を設定します。
     * 
     * @param {string} color - 色（HEX形式）
     * @returns {boolean} 成功したかどうか
     */
    setBackgroundColor(color) {
        if (!this.tiptap) return false;
        return this.tiptap.chain().focus().setHighlight({ color }).run();
    }

    /**
     * 背景色（ハイライト）を解除します。
     * 
     * @returns {boolean} 成功したかどうか
     */
    unsetBackgroundColor() {
        if (!this.tiptap) return false;
        return this.tiptap.chain().focus().unsetHighlight().run();
    }

    /**
     * コードブロックを挿入/解除します。
     * 
     * @returns {boolean} 成功したかどうか
     */
    toggleCodeBlock() {
        if (!this.tiptap) return false;
        return this.tiptap.chain().focus().toggleCodeBlock().run();
    }

    /**
     * ブロック引用を挿入/解除します。
     * 
     * @returns {boolean} 成功したかどうか
     */
    toggleBlockquote() {
        if (!this.tiptap) return false;
        return this.tiptap.chain().focus().toggleBlockquote().run();
    }

    // =====================================================
    // 選択とフォーカス
    // =====================================================

    /**
     * エディタにフォーカスを設定します。
     */
    focus() {
        if (this.tiptap) {
            this.tiptap.commands.focus();
        }
    }

    /**
     * 現在の選択範囲を取得します。
     * 
     * @returns {{from: number, to: number, empty: boolean}|null}
     */
    getSelection() {
        if (!this.tiptap) return null;
        const { from, to, empty } = this.tiptap.state.selection;
        return { from, to, empty };
    }

    /**
     * 指定されたマークがアクティブかどうかを確認します。
     * 
     * @param {string} markName - マーク名
     * @param {Object} [attrs={}] - 属性
     * @returns {boolean}
     */
    isActive(markName, attrs = {}) {
        if (!this.tiptap) return false;
        return this.tiptap.isActive(markName, attrs);
    }

    // =====================================================
    // コールバック設定
    // =====================================================

    /**
     * エディタ更新時のコールバックを設定します。
     * 
     * @param {Function} callback - コールバック関数
     */
    onUpdate(callback) {
        this._onUpdateCallback = callback;
    }

    /**
     * 選択更新時のコールバックを設定します。
     * 
     * @param {Function} callback - コールバック関数
     */
    onSelectionUpdate(callback) {
        this._onSelectionUpdateCallback = callback;
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * エディタ更新時の処理
     * 
     * @private
     */
    _onEditorUpdate() {
        if (this._onUpdateCallback) {
            this._onUpdateCallback(this.tiptap);
        }
        // 即時反映用イベントを発火（デバウンスなし）
        this.eventBus.emit('editor:rawUpdate', this.tiptap);
    }

    /**
     * 選択更新時の処理
     * 
     * @private
     */
    _onSelectionUpdate() {
        if (this._onSelectionUpdateCallback) {
            this._onSelectionUpdateCallback(this.tiptap);
        }
    }

    /**
     * ペースト処理
     * 
     * @param {*} view - Tiptapビュー
     * @param {ClipboardEvent} event - クリップボードイベント
     * @param {*} slice - スライス
     * @returns {boolean}
     * @private
     */
    _handlePaste(view, event, slice) {
        const items = event.clipboardData?.items;
        if (!items) return false;

        // 1. 画像ファイルの処理
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    event.preventDefault();
                    this._insertImageFromFile(file);
                    return true;
                }
            }
        }

        // 2. URL貼り付け処理
        const text = event.clipboardData?.getData('text/plain');
        if (text && isValidUrl(text.trim())) {
            event.preventDefault();
            this._insertLinkFromPaste(text.trim()); // 自動リンク処理を呼び出し
            return true;
        }

        return false;
    }

    /**
     * ドロップ処理
     * 
     * @param {*} view - Tiptapビュー
     * @param {DragEvent} event - ドラッグイベント
     * @param {*} slice - スライス
     * @param {boolean} moved - 移動かどうか
     * @returns {boolean}
     * @private
     */
    _handleDrop(view, event, slice, moved) {
        if (moved) return false;

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        let hasImage = false;
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                hasImage = true;
                event.preventDefault();

                const coordinates = view.posAtCoords({
                    left: event.clientX,
                    top: event.clientY
                });

                this._insertImageFromFile(file, coordinates?.pos);
            }
        }
        return hasImage;
    }

    /**
     * ファイルから画像を挿入します。
     * 
     * @param {File} file - 画像ファイル
     * @param {number|null} [pos=null] - 挿入位置
     * @private
     */
    _insertImageFromFile(file, pos = null) {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target.result;
            if (pos !== null && this.tiptap) {
                this.tiptap.chain()
                    .focus()
                    .insertContentAt(pos, {
                        type: 'image',
                        attrs: { src }
                    })
                    .run();
            } else if (this.tiptap) {
                this.tiptap.chain().focus().setImage({ src }).run();
            }
        };
        reader.readAsDataURL(file);
    }

    /**
     * URLペースト時にリンクを挿入します。
     * 
     * @param {string} url - ペーストされたURL
     * @private
     */
    _insertLinkFromPaste(url) {
        if (!this.tiptap) return;

        // http/httpsが無い場合は追加
        let href = url;
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
            href = 'https://' + href;
        }

        const { from, to, empty } = this.tiptap.state.selection;

        if (!empty && from !== to) {
            // テキスト選択がある場合: 選択テキストにリンクを適用
            this.tiptap.chain()
                .focus()
                .setLink({ href })
                .run();
        } else {
            // テキスト選択がない場合: URLをテキストとして挿入し、リンクを適用
            this.tiptap.chain()
                .focus()
                .insertContent(url)
                .setTextSelection({ from: from, to: from + url.length })
                .setLink({ href })
                .run();
        }
    }

    // =====================================================
    // 破棄
    // =====================================================

    /**
     * エディタを破棄します。
     */
    destroy() {
        if (this.tiptap) {
            this.tiptap.destroy();
            this.tiptap = null;
        }
    }
}
