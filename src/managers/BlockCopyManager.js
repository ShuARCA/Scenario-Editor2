/**
 * ブロックコピー管理
 * 
 * エディタ内のブロック要素にホバーしたときにコピーボタンを表示し、
 * クリックでそのブロックのテキストをクリップボードにコピーします。
 * 
 * @module managers/BlockCopyManager
 */

/**
 * ブロックコピー管理クラス
 */
export class BlockCopyManager {
    /**
     * BlockCopyManagerのコンストラクタ
     * 
     * @param {Object} editorCore - EditorManagerまたはEditorCoreへの参照
     */
    constructor(editorCore) {
        /** @type {Object} エディタへの参照 */
        this.editor = editorCore;

        /** @type {HTMLElement|null} コピーボタン要素 */
        this.copyButton = null;

        /** @type {HTMLElement|null} 現在ホバー中のブロック要素 */
        this.currentBlock = null;

        /** @type {number|null} フィードバックタイマーID */
        this.feedbackTimer = null;

        /** @type {HTMLElement|null} エディタコンテナ */
        this.editorContainer = null;

        /** @type {HTMLElement|null} エディタ要素 */
        this.editorElement = null;

        // 対象となるブロック要素のセレクタ
        this.blockSelectors = 'p, h1, h2, h3, h4, h5, h6, blockquote, pre, li';

        // バインドされたイベントハンドラ（removeEventListener用）
        this._boundHandleMouseMove = this._handleMouseMove.bind(this);
        this._boundHandleMouseLeave = this._handleMouseLeave.bind(this);
        this._boundHandleEditorScroll = this._handleEditorScroll.bind(this);
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * ブロックコピー機能を初期化します。
     */
    init() {
        this.editorContainer = document.getElementById('editor-container');
        this.editorElement = document.getElementById('editor');

        if (!this.editorContainer || !this.editorElement) {
            console.warn('BlockCopyManager: エディタ要素が見つかりません');
            return;
        }

        // コピーボタンを作成
        this._createCopyButton();

        // イベントリスナーをセットアップ
        this._setupEventListeners();
    }

    /**
     * コピーボタンDOM要素を生成します。
     * @private
     */
    _createCopyButton() {
        this.copyButton = document.createElement('button');
        this.copyButton.className = 'block-copy-button hidden';
        this.copyButton.title = 'テキストコピー';
        this.copyButton.innerHTML = `
            <svg class="icon copy-icon" viewBox="0 0 24 24" width="16" height="16">
                <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" fill="currentColor"/>
            </svg>
            <svg class="icon check-icon" viewBox="0 0 24 24" width="16" height="16">
                <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" fill="currentColor"/>
            </svg>
        `;

        // ボタンクリックイベント
        this.copyButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.currentBlock) {
                this._copyBlockText(this.currentBlock);
            }
        });

        // ボタン上でのマウスイベントが親に伝播しないようにする
        this.copyButton.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
        });

        // ドキュメントに追加（editor-containerの親に配置して絶対位置で表示）
        this.editorContainer.appendChild(this.copyButton);
    }

    /**
     * イベントリスナーをセットアップします。
     * @private
     */
    _setupEventListeners() {
        // マウス移動でホバー中のブロックを検出（コンテナ全体で監視してボタンも含む）
        this.editorContainer.addEventListener('mousemove', this._boundHandleMouseMove);

        // コンテナからマウスが離れたらボタンを非表示
        this.editorContainer.addEventListener('mouseleave', this._boundHandleMouseLeave);

        // スクロール時にボタン位置を更新
        this.editorContainer.addEventListener('scroll', this._boundHandleEditorScroll);
    }

    // =====================================================
    // イベントハンドラ
    // =====================================================

    /**
     * マウス移動時にホバー中のブロック要素を検出します。
     * @param {MouseEvent} event - マウスイベント
     * @private
     */
    _handleMouseMove(event) {
        const target = event.target;

        // コピーボタン自身の上にいる場合は現在のブロックを維持
        if (this.copyButton.contains(target)) {
            return;
        }

        // ターゲットまたはその祖先からブロック要素を探す
        const blockElement = target.closest(this.blockSelectors);

        if (blockElement && this.editorElement.contains(blockElement)) {
            // 新しいブロックにホバーした場合
            if (blockElement !== this.currentBlock) {
                this.currentBlock = blockElement;
                this._resetFeedback(); // フィードバックをリセット
                this._positionButton(blockElement);
                this._showButton();
            }
        } else {
            // ブロック要素外にいる場合でも、現在のブロックのY軸範囲内（特に左側）にいれば維持
            if (this.currentBlock && !this.copyButton.classList.contains('hidden')) {
                const rect = this.currentBlock.getBoundingClientRect();
                const mouseY = event.clientY;
                const buffer = 20; // 判定の余裕（上下）

                // 現在のブロックと同じ高さ（＋余裕）の位置にマウスがあれば維持
                if (mouseY >= rect.top - buffer && mouseY <= rect.bottom + buffer) {
                    return;
                }
            }

            // それ以外は非表示
            this._hideButton();
            this.currentBlock = null;
        }
    }

    /**
     * マウスがコンテナ外に出たときの処理。
     * @private
     */
    _handleMouseLeave() {
        this._hideButton();
        this.currentBlock = null;
    }

    /**
     * エディタスクロール時にボタン位置を更新します。
     * @private
     */
    _handleEditorScroll() {
        if (this.currentBlock && !this.copyButton.classList.contains('hidden')) {
            this._positionButton(this.currentBlock);
        }
    }

    // =====================================================
    // UI操作
    // =====================================================

    /**
     * コピーボタンをブロック要素の左側に配置します。
     * @param {HTMLElement} blockElement - ブロック要素
     * @private
     */
    _positionButton(blockElement) {
        const blockRect = blockElement.getBoundingClientRect();
        const containerRect = this.editorContainer.getBoundingClientRect();

        // ブロック要素のすぐ左隣、垂直方向は中央に配置
        // editor-containerはrelativeなので、scrollTopを加味して絶対位置を計算
        const relativeTop = blockRect.top - containerRect.top + this.editorContainer.scrollTop + (blockRect.height / 2) - 8;

        // 左位置の計算: コンテナ左端からの距離
        // blockRect.left (ビューポート) - containerRect.left (ビューポート) - オフセット
        const relativeLeft = blockRect.left - containerRect.left - 32;

        this.copyButton.style.position = 'absolute';
        this.copyButton.style.top = `${relativeTop}px`;
        this.copyButton.style.left = `${Math.max(4, relativeLeft)}px`; // 最小4pxを確保
        this.copyButton.style.right = 'auto';
    }

    /**
     * コピーボタンを表示します。
     * @private
     */
    _showButton() {
        this.copyButton.classList.remove('hidden');
    }

    /**
     * コピーボタンを非表示にします。
     * @private
     */
    _hideButton() {
        this.copyButton.classList.add('hidden');
        this._resetFeedback(); // 非表示時もリセット
    }

    // =====================================================
    // コピー機能
    // =====================================================

    /**
     * ブロック要素のテキストをクリップボードにコピーします。
     * 「ブロックのテキストを範囲選択してコピーした際と同じ内容」にするため、
     * 実際にSelection APIを使って選択し、標準のcopyコマンドを実行します。
     * 
     * @param {HTMLElement} blockElement - ブロック要素
     * @private
     */
    _copyBlockText(blockElement) {
        const selection = window.getSelection();
        // 現在の選択範囲を保存
        const currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        try {
            // ブロック要素を選択
            const range = document.createRange();
            range.selectNode(blockElement); // ブロック全体を選択

            selection.removeAllRanges();
            selection.addRange(range);

            // コピー実行
            // execCommand('copy') は同期的に実行され、ユーザーの選択範囲をクリップボードにコピーします
            const successful = document.execCommand('copy');

            if (successful) {
                this._showCopiedFeedback();
            } else {
                console.error('BlockCopyManager: コピーコマンドが失敗しました');
            }
        } catch (err) {
            console.error('BlockCopyManager: コピー中にエラーが発生しました', err);
        } finally {
            // 選択範囲を復元
            selection.removeAllRanges();
            if (currentRange) {
                selection.addRange(currentRange);
            }
        }
    }

    /**
     * コピー成功時の視覚的フィードバックを表示します。
     * @private
     */
    _showCopiedFeedback() {
        // 既存のタイマーをクリア
        if (this.feedbackTimer) {
            clearTimeout(this.feedbackTimer);
        }

        // コピー済み状態にする
        this.copyButton.classList.add('copied');

        // 2秒後に元に戻す
        this.feedbackTimer = setTimeout(() => {
            this.copyButton.classList.remove('copied');
            this.feedbackTimer = null;
        }, 2000);
    }

    // =====================================================
    // クリーンアップ
    // =====================================================

    /**
     * コピー完了のフィードバックをリセットします。
     * @private
     */
    _resetFeedback() {
        if (this.feedbackTimer) {
            clearTimeout(this.feedbackTimer);
            this.feedbackTimer = null;
        }
        this.copyButton.classList.remove('copied');
    }

    /**
     * リソースを解放します。
     */
    destroy() {
        if (this.editorContainer) {
            this.editorContainer.removeEventListener('mousemove', this._boundHandleMouseMove);
            this.editorContainer.removeEventListener('mouseleave', this._boundHandleMouseLeave);
            this.editorContainer.removeEventListener('scroll', this._boundHandleEditorScroll);
        }

        if (this.editorContainer) {
            this.editorContainer.removeEventListener('scroll', this._boundHandleEditorScroll);
        }

        if (this.copyButton && this.copyButton.parentNode) {
            this.copyButton.parentNode.removeChild(this.copyButton);
        }

        if (this.feedbackTimer) {
            clearTimeout(this.feedbackTimer);
        }

        this.copyButton = null;
        this.currentBlock = null;
    }
}
