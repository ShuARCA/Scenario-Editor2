/**
 * PDF エクスポートのコアロジック
 * jsPDF と html2canvas を用いて、エディタ内容をPDFファイルとして生成します。
 */
export class PdfExporter {
    /**
     * @param {import('../core/EditorCore.js').EditorCore} editorCore
     * @param {import('../ui/SettingsManager.js').SettingsManager} settingsManager
     * @param {import('../managers/CommentManager.js').CommentManager} commentManager
     * @param {import('../managers/OutlineManager.js').OutlineManager} outlineManager
     */
    constructor(editorCore, settingsManager, commentManager, outlineManager) {
        this.editorCore = editorCore;
        this.settingsManager = settingsManager;
        this.commentManager = commentManager;
        this.outlineManager = outlineManager;
    }

    /**
     * 設定オブジェクトに基づいてPDFを出力します。
     * @param {Object} config PdfExportModal から渡される設定
     */
    async export(config) {
        const {
            title,
            pageSize, // 'a4', 'b5', 'letter'
            colorMode, // 'color', 'monochrome'
            commentDisplay, // 'show', 'hide'
            pageNumber, // 'show', 'hide'
            pageBreak, // 'continuous', 'h1', 'h2', 'h3', 'h4'
            bgOptions
        } = config;

        // 1. 印刷用クローンDOMの構築
        const cloneWrapper = this._createCloneDOM(commentDisplay === 'show', pageBreak);

        // 2. 印刷用iframeの作成
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        // ブラウザによっては0に近いと描画最適化（1ページしか出ない等）が起きるため、画面外で実寸大に近いサイズを持たせる
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
        iframe.style.zIndex = '-1000';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        iframe.style.border = 'none';

        document.body.appendChild(iframe);

        try {
            const doc = iframe.contentWindow.document;

            // 3. 元のドキュメントのCSSをコピー
            const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
            for (const tag of styleTags) {
                doc.head.appendChild(tag.cloneNode(true));
            }

            // iOS/Safariなどの互換性考慮のため、CSS読み込み完了を待機
            await new Promise(resolve => setTimeout(resolve, 300));

            // 4. PDF専用の印刷スタイルを追加
            const printStyle = doc.createElement('style');

            // ページ番号をCSSで出力する指定（対応ブラウザのみ有効。非対応の場合はブラウザのヘッダー/フッター設定に依存）
            const pageNumberCSS = pageNumber === 'show' ? `
                @page {
                    @bottom-center {
                        content: counter(page);
                        font-size: 10pt;
                        color: #666;
                    }
                }
            ` : '';

            // 背景画像のCSS指定
            let bgCSS = '';
            let bgBodyStyle = '';

            // iframe(about:blank)内で画像URL(相対パスやBlob)がリンク切れになるのを防ぐため絶対パス化
            let absoluteBgUrl = '';
            try {
                if (bgOptions && bgOptions.url) {
                    absoluteBgUrl = new URL(bgOptions.url, window.location.href).href;
                }
            } catch (e) {
                absoluteBgUrl = bgOptions.url; // URLコンストラクタ解析失敗時
            }

            if (absoluteBgUrl) {
                bgBodyStyle = `
                    background-image: url("${absoluteBgUrl}") !important;
                    background-repeat: no-repeat !important;
                    background-position: ${bgOptions.xOffset}px ${bgOptions.yOffset}px !important;
                    background-size: ${bgOptions.uiAreaWidth * bgOptions.scale}px auto !important;
                `;
            } else if (bgOptions && bgOptions.editorBgColor) {
                bgBodyStyle = `
                    background-color: ${bgOptions.editorBgColor} !important;
                `;
            }

            if (bgBodyStyle) {
                bgCSS = `
                    .pdf-export-fixed-bg {
                        ${bgBodyStyle}
                    }
                `;
            }

            // モノクロモード指定
            const filterCSS = colorMode === 'monochrome' ? `
                body {
                    filter: grayscale(100%);
                }
            ` : '';

            printStyle.textContent = `
                @page {
                    size: ${pageSize};
                    margin: 15mm;
                }
                
                /* ==============================================================
                   ページ全体が1枚で切れる問題への対処と背景描画の強制
                   ============================================================== */
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }

                html, body {
                    height: auto !important;
                    min-height: 100% !important;
                    overflow: visible !important;
                    display: block !important;
                }

                /* ==============================================================
                   文字やボックスがページ境界で割れるのを防ぐ
                   ============================================================== */
                h1, h2, h3, h4, h5, h6, 
                p, li, blockquote, pre, 
                .ProseMirror-node, img, table, tr, td, th, 
                .ruby-node, .box-node {
                    page-break-inside: avoid !important;
                    break-inside: avoid-page !important;
                }

                /* Tiptapのノードなどで強制的に改ページさせたい要素が来た場合 */
                .pdf-page-break-before {
                    page-break-before: always !important;
                    break-before: page !important;
                }
                ${pageNumberCSS}
                ${bgCSS}
                ${filterCSS}
                
                /* 印刷用クローンの幅リセット */
                .pdf-export-clone {
                    width: 100% !important; 
                    height: 100% !important;
                    margin: 0 !important;
                    background: transparent !important;
                }
            `;
            doc.head.appendChild(printStyle);

            // iframeのタイトル（保存時のデフォルトファイル名になる）
            const safeTitle = (title || 'document').replace(/[\\/:*?"<>|]/g, '_');
            doc.title = safeTitle;

            doc.body.appendChild(cloneWrapper);

            // 5. フォントや画像のロード待機
            if (doc.fonts && doc.fonts.ready) {
                await doc.fonts.ready;
            }
            // DOMレンダリング待ち
            await new Promise(resolve => setTimeout(resolve, 800));

            // 6. 印刷ダイアログの呼び出し
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

        } finally {
            // 7. iframeの削除 (印刷ダイアログの完了を待機するため遅延)
            setTimeout(() => {
                if (iframe && iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            }, 5000);
        }
    }

    // ==========================================
    // DOMクローンとスタイル調整
    // ==========================================

    /**
     * エディタとコメント（必要なら）のクローンを生成し、印刷用CSSをあてる
     * @private
     */
    _createCloneDOM(showComment, pageBreakStr) {
        const wrapper = document.createElement('div');
        // iEditWeb-tiptap の CSS変数が効くように、上位コンテナのクラスを付与する
        wrapper.className = 'pdf-export-clone pdf-export-clone-wrapper app-container';

        // CSS変数を引き継ぐために、ルートブロック(body)のスタイルをコピー
        wrapper.style.cssText = document.body.style.cssText;
        wrapper.style.backgroundColor = 'transparent'; // 背景色は別途PDFエクスポート時に塗るため透明に

        // --- エディタ部分 ---
        const editorClone = document.createElement('div');
        editorClone.className = 'pdf-export-clone-editor';
        editorClone.innerHTML = this.editorCore.getContent();

        // プロキシー用のクラスを付与(TiptapのCSSが適用されるよう)
        editorClone.classList.add('ProseMirror');

        // contenteditable属性が残っているとhtml2canvasが入力用として判定し、中身の描画を最適化/スキップしてしまう場合があるため削除
        editorClone.removeAttribute('contenteditable');
        editorClone.querySelectorAll('[contenteditable]').forEach(el => {
            el.removeAttribute('contenteditable');
        });

        // エディタの表示用CSS変数を強制的にインラインで設定
        const computedBody = window.getComputedStyle(document.body);
        const computedEditor = window.getComputedStyle(document.getElementById('editor'));
        editorClone.style.color = computedEditor.color || computedBody.color || '#333';
        editorClone.style.fontFamily = computedEditor.fontFamily || computedBody.fontFamily || 'sans-serif';
        editorClone.style.fontSize = computedEditor.fontSize || computedBody.fontSize || '16px';

        // 最初の要素にだけ改ページ処理を適用するなどのTiptap特有のCSS問題対策
        if (pageBreakStr !== 'continuous') {
            const level = parseInt(pageBreakStr.replace('h', ''), 10);
            for (let i = 1; i <= level; i++) {
                const headers = editorClone.querySelectorAll(`h${i}`);
                headers.forEach((h, index) => {
                    if (index > 0) { // 最初の要素は改ページしない
                        h.classList.add('pdf-page-break-before');
                    }
                });
            }
        }

        // テキストの折り返しと空白保持を強制（Tiptapの空pタグなどが潰れないように）
        editorClone.style.whiteSpace = 'pre-wrap';
        editorClone.style.wordBreak = 'break-word';

        wrapper.appendChild(editorClone);

        // --- コメント部分 ---
        if (showComment) {
            const sidebarClone = document.createElement('div');
            sidebarClone.className = 'pdf-export-clone-sidebar';

            // CommentManager から全てのコメントを取得し、簡易的なHTMLリストとしてサイドバーに配置する
            const comments = this.commentManager.comments; // [{id, text}, ...]

            if (comments && comments.length > 0) {
                const ul = document.createElement('ul');
                ul.style.listStyle = 'none';
                ul.style.padding = '0';

                comments.forEach(c => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '15px';
                    li.style.padding = '10px';
                    li.style.backgroundColor = '#f1f5f9';
                    li.style.borderRadius = '4px';
                    li.style.borderLeft = '4px solid #f59e0b';
                    li.innerText = c.text;
                    ul.appendChild(li);
                });
                sidebarClone.appendChild(ul);
            }

            wrapper.appendChild(sidebarClone);
        }

        return wrapper;
    }


}
