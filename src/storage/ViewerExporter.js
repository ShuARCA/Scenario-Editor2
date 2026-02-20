/**
 * ビューワーHTMLエクスポーター
 * 
 * エディタの現在の状態をスタンドアロンの閲覧専用HTMLファイルとしてエクスポートします。
 * 
 * 責務:
 * - エディタコンテンツ、フローチャート、アウトライン、設定をHTML文書に統合
 * - CSS（テーマ・カスタム）のインライン化
 * - 閲覧専用モードの適用（ロック状態 + 保存/読み込み無効化）
 * - ビューワー用JavaScript（コピー、スクロール、ズーム等）の埋め込み
 * 
 * @module storage/ViewerExporter
 */

export class ViewerExporter {
    // ========================================
    // 初期化
    // ========================================

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/EditorCore.js').EditorCore} deps.editorCore
     * @param {import('../flowchart/FlowchartApp.js').FlowchartApp} deps.flowchartApp
     * @param {import('../ui/SettingsManager.js').SettingsManager} deps.settingsManager
     * @param {import('../ui/CustomCssManager.js').CustomCssManager} deps.customCssManager
     * @param {import('../managers/OutlineManager.js').OutlineManager} deps.outlineManager
     * @param {string} title - ドキュメントタイトル
     */
    constructor(deps) {
        this.editorCore = deps.editorCore;
        this.flowchartApp = deps.flowchartApp;
        this.settingsManager = deps.settingsManager;
        this.customCssManager = deps.customCssManager;
        this.outlineManager = deps.outlineManager;

        // File System Access API のサポート状況
        this.supportsFileSystemAccess = 'showSaveFilePicker' in window;
    }

    // ========================================
    // エクスポート実行
    // ========================================

    /**
     * HTMLビューワーファイルをエクスポートします。
     * @param {string} title - ドキュメントタイトル
     * @param {string} filename - 保存ファイル名（拡張子なし）
     */
    async export(title, filename) {
        try {
            const html = await this._buildHtml(title);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const exportFilename = this._sanitizeFilename(filename) + '.html';

            await this._downloadHtml(blob, exportFilename);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('HTMLエクスポートエラー:', error);
            alert('HTMLエクスポートに失敗しました: ' + error.message);
        }
    }

    // ========================================
    // HTML構築
    // ========================================

    /**
     * 完全なHTMLドキュメントを組み立てます。
     * @private
     * @param {string} title - ドキュメントタイトル
     * @returns {string} HTML文字列
     */
    async _buildHtml(title) {
        const styles = await this._collectStyles();
        const editorContent = this._collectEditorContent();
        const flowchartHtml = this._captureFlowchart();
        const outlineHtml = this._captureOutline();
        const viewerScript = this._buildViewerScript();
        const themeClass = this._getThemeClass();
        const backgroundImageStyle = this._getBackgroundImageStyle();

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="iEditWeb Viewer Export">
    <title>${this._escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;500&family=M+PLUS+Rounded+1c:wght@400;500;700&family=Fira+Code&display=swap" rel="stylesheet">
    <style>
${styles}
    </style>
</head>
<body class="locked viewer-mode ${themeClass}">

    <!-- Header (閲覧専用: タイトルのみ) -->
    <header id="toolbar">
        <div id="toggleSidebar" title="アウトライン表示/非表示">
            <svg class="icon" viewBox="0 0 24 24">
                <path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z" />
            </svg>
        </div>
        <div id="filename">${this._escapeHtml(title)}</div>
        <div class="header-controls">
            <div class="viewer-badge">閲覧専用</div>
        </div>
    </header>

    <div id="container">
        <!-- Sidebar -->
        <aside id="sidebar">
            <div id="resizer"></div>
            <div class="sidebar-section">
                <h3>アウトライン</h3>
                <div id="outline-list">${outlineHtml}</div>
            </div>
        </aside>

        <!-- Main Content -->
        <main id="main-content">
            <!-- Flowchart Area -->
            <div id="flowchart-container"${flowchartHtml.isCollapsed ? ' class="collapsed"' : ''}>
                <div class="flowchart-toolbar">
                    <button id="zoom-in-btn" class="mode-btn" title="拡大">
                        <svg class="icon" viewBox="0 0 24 24">
                            <path d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />
                        </svg>
                    </button>
                    <button id="zoom-out-btn" class="mode-btn" title="縮小">
                        <svg class="icon" viewBox="0 0 24 24">
                            <path d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M7,9H12V10H7V9Z" />
                        </svg>
                    </button>
                    <button id="fit-view-btn" class="mode-btn" title="全体表示">
                        <svg class="icon" viewBox="0 0 24 24">
                            <path d="M2,2H8V4H4V8H2V2M22,8V2H16V4H20V8H22M2,16V22H8V20H4V16H2M20,20H16V22H22V16H20V20M9,7V9H7V15H9V17H15V15H17V9H15V7H9M9,9H15V15H9V9Z" />
                        </svg>
                    </button>
                </div>
                <div id="flowchart-canvas">
                    <div id="canvas-content" style="${flowchartHtml.canvasStyle}">
                        ${flowchartHtml.svg}
                        <div id="shapes-layer">${flowchartHtml.shapes}</div>
                    </div>
                </div>
            </div>

            <div id="vertical-resizer"></div>

            <!-- Editor Area -->
            <div id="editor-area">
                <button id="flowchart-toggle-btn" class="flowchart-toggle-btn" title="折りたたみ">
                    <svg class="icon" viewBox="0 -960 960 960">
                        <path d="m296-224-56-56 240-240 240 240-56 56-184-183-184 183Zm0-240-56-56 240-240 240 240-56 56-184-183-184 183Z" />
                    </svg>
                </button>
                <div id="editor-container"${backgroundImageStyle}>
                    <div id="editor" contenteditable="false" spellcheck="false">${editorContent}</div>
                </div>
            </div>
        </main>
    </div>

    <script>
${viewerScript}
    </script>
</body>
</html>`;
    }

    // ========================================
    // データ収集
    // ========================================

    /**
     * CSSスタイルを収集してインライン化します。
     * @private
     * @returns {Promise<string>} 結合されたCSS文字列
     */
    async _collectStyles() {
        const cssParts = [];

        // 1. ページ内のスタイルシートからCSSを収集
        const cssFiles = [
            'styles/main.css',
            'styles/editor.css',
            'styles/flowchart.css',
        ];

        for (const cssFile of cssFiles) {
            try {
                const response = await fetch(cssFile);
                if (response.ok) {
                    const cssText = await response.text();
                    cssParts.push(`/* === ${cssFile} === */\n${cssText}`);
                }
            } catch (e) {
                console.warn(`CSSファイルの読み込みに失敗: ${cssFile}`, e);
            }
        }

        // 2. 現在のCSS Custom Propertiesを取得
        const computedVars = this._collectCssVariables();
        if (computedVars) {
            cssParts.push(`/* === テーマ変数 === */\n:root {\n${computedVars}\n}`);
        }

        // 3. カスタムCSS（ユーザー定義）
        if (this.customCssManager) {
            const customStyle = document.getElementById('custom-css-styles');
            if (customStyle) {
                cssParts.push(`/* === カスタムCSS === */\n${customStyle.textContent}`);
            }
        }

        // 4. ビューワー専用スタイル
        cssParts.push(this._getViewerStyles());

        return cssParts.join('\n\n');
    }

    /**
     * 現在適用されているCSSカスタムプロパティを収集します。
     * @private
     * @returns {string} CSS変数宣言
     */
    _collectCssVariables() {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        const vars = [
            '--primary-color',
            '--primary-hover',
            '--font-family',
            '--editor-font-size',
            '--surface-color',
            '--text-color',
            '--border-color',
            '--bg-color',
        ];

        const declarations = vars
            .map(v => {
                const value = computed.getPropertyValue(v).trim();
                return value ? `    ${v}: ${value};` : null;
            })
            .filter(Boolean);

        return declarations.length > 0 ? declarations.join('\n') : null;
    }

    /**
     * エディタのHTMLコンテンツを取得します。
     * @private
     * @returns {string} HTMLコンテンツ
     */
    _collectEditorContent() {
        return this.editorCore.getContent() || '';
    }

    /**
     * フローチャートのDOM構造をキャプチャします。
     * @private
     * @returns {Object} フローチャートHTML情報
     */
    _captureFlowchart() {
        const container = document.getElementById('flowchart-container');
        const canvasContent = document.getElementById('canvas-content');
        const connectionsLayer = document.getElementById('connections-layer');
        const shapesLayer = document.getElementById('shapes-layer');

        if (!container || !canvasContent || !shapesLayer) {
            return { svg: '', shapes: '', canvasStyle: '', isCollapsed: false };
        }

        // 折りたたみ状態
        const isCollapsed = container.classList.contains('collapsed');

        // canvas-contentのtransformスタイル
        const canvasStyle = canvasContent.getAttribute('style') || '';

        // SVG接続レイヤーをクローン
        let svgHtml = '';
        if (connectionsLayer) {
            const svgClone = connectionsLayer.cloneNode(true);
            svgHtml = svgClone.outerHTML;
        }

        // シェイプレイヤーをクローン（各シェイプのDOM）
        let shapesHtml = '';
        if (shapesLayer) {
            const shapesClone = shapesLayer.cloneNode(true);
            // 不要な要素を除去（リサイズハンドル、接続ポイント）
            shapesClone.querySelectorAll('.resize-handle, .connection-point').forEach(el => el.remove());
            shapesHtml = shapesClone.innerHTML;
        }

        return { svg: svgHtml, shapes: shapesHtml, canvasStyle, isCollapsed };
    }

    /**
     * 現在のアウトラインをHTML文字列として取得します。
     * @private
     * @returns {string} アウトラインHTML
     */
    _captureOutline() {
        const outlineList = document.getElementById('outline-list');
        if (!outlineList) return '';

        // アウトラインリストをクローンして不要な要素を除去
        const clone = outlineList.cloneNode(true);
        // コンテキストメニュー用のボタン等を除去
        clone.querySelectorAll('.outline-menu-btn').forEach(el => el.remove());

        return clone.innerHTML;
    }

    // ========================================
    // ビューワー用スタイル
    // ========================================

    /**
     * ビューワー専用CSSを返します。
     * @private
     * @returns {string}
     */
    _getViewerStyles() {
        return `/* === ビューワー専用スタイル === */

/* 閲覧専用バッジ */
.viewer-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--primary-color, #0d9488);
    background: rgba(13, 148, 136, 0.12);
    border: 1px solid var(--primary-color, #0d9488);
    border-radius: 12px;
    letter-spacing: 0.5px;
    user-select: none;
}

/* ビューワーモードの上書き */
body.viewer-mode .header-controls button { display: none; }
body.viewer-mode .storage-dropdown { display: none; }
body.viewer-mode #float-toolbar { display: none !important; }
body.viewer-mode #ruby-panel { display: none !important; }
body.viewer-mode #comment-panel { display: none !important; }
body.viewer-mode #link-panel { display: none !important; }
body.viewer-mode #image-toolbar { display: none !important; }
body.viewer-mode #search-panel { display: none !important; }
body.viewer-mode #settings-modal { display: none !important; }
body.viewer-mode #custom-css-modal { display: none !important; }
body.viewer-mode #flowchart-context-menu { display: none !important; }
body.viewer-mode #outline-context-menu { display: none !important; }
body.viewer-mode #outline-icon-picker { display: none !important; }
body.viewer-mode .mode-btn[data-mode] { display: none !important; }
body.viewer-mode .toolbar-separator { display: none !important; }
body.viewer-mode #vertical-resizer { pointer-events: none; }
body.viewer-mode #resizer { pointer-events: none; }

/* フローチャート: リサイズハンドル・接続ポイント非表示 */
body.viewer-mode .resize-handle { display: none !important; }
body.viewer-mode .connection-point { display: none !important; }

/* フローチャート: ノードのカーソル */
body.viewer-mode .shape { cursor: pointer; }

/* アウトラインのアイコン非表示（ロック状態と同様） */
body.viewer-mode .outline-icon { pointer-events: none; }
`;
    }

    /**
     * テーマクラスを取得します。
     * @private
     * @returns {string}
     */
    _getThemeClass() {
        const settings = this.settingsManager.getSettings();
        return settings.theme === 'dark' ? 'dark-theme' : '';
    }

    /**
     * 背景画像のインラインスタイルを取得します。
     * @private
     * @returns {string}
     */
    _getBackgroundImageStyle() {
        const settings = this.settingsManager.getSettings();
        const styles = [];

        if (settings.editorBgColor) {
            styles.push(`background-color: ${settings.editorBgColor}`);
        }
        if (settings.backgroundImage) {
            styles.push(`background-image: url('${settings.backgroundImage}')`);
            styles.push('background-size: cover');
            styles.push('background-position: center');
        }

        return styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
    }

    // ========================================
    // ビューワー用JavaScript
    // ========================================

    /**
     * ビューワー用のインラインJavaScriptを生成します。
     * @private
     * @returns {string}
     */
    _buildViewerScript() {
        // フローチャートのシェイプデータをJSON形式で埋め込み
        const shapesData = this._serializeShapesData();

        return `
(function() {
    'use strict';

    // ===========================================
    // シェイプデータ（フローチャートノード情報）
    // ===========================================
    const SHAPES_DATA = ${shapesData};

    // ===========================================
    // 1. アウトラインクリック → 見出しスクロール
    // ===========================================
    function initOutlineNavigation() {
        const outlineList = document.getElementById('outline-list');
        if (!outlineList) return;

        outlineList.addEventListener('click', function(e) {
            const item = e.target.closest('[data-heading-id]');
            if (!item) return;
            e.preventDefault();
            const headingId = item.dataset.headingId;
            scrollToHeading(headingId);
        });
    }

    function scrollToHeading(headingId) {
        if (!headingId) return;
        const el = document.getElementById(headingId) ||
                   document.querySelector('[id="' + headingId + '"]');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // ===========================================
    // 2. ブロックコピー機能
    // ===========================================
    function initBlockCopy() {
        const editorContainer = document.getElementById('editor-container');
        const editorElement = document.getElementById('editor');
        if (!editorContainer || !editorElement) return;

        const blockSelectors = 'p, h1, h2, h3, h4, h5, h6, blockquote, pre, li';
        let currentBlock = null;
        let feedbackTimer = null;

        // コピーボタン作成
        const copyButton = document.createElement('button');
        copyButton.className = 'block-copy-button hidden';
        copyButton.title = 'テキストコピー';
        copyButton.innerHTML = 
            '<svg class="icon copy-icon" viewBox="0 0 24 24" width="16" height="16">' +
            '<path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" fill="currentColor"/>' +
            '</svg>' +
            '<svg class="icon check-icon" viewBox="0 0 24 24" width="16" height="16">' +
            '<path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" fill="currentColor"/>' +
            '</svg>';
        editorContainer.appendChild(copyButton);

        // マウス移動
        editorContainer.addEventListener('mousemove', function(event) {
            if (copyButton.contains(event.target)) return;
            const block = event.target.closest(blockSelectors);
            if (block && editorElement.contains(block)) {
                if (block !== currentBlock) {
                    currentBlock = block;
                    resetFeedback();
                    positionButton(block);
                    copyButton.classList.remove('hidden');
                }
            } else {
                if (currentBlock && !copyButton.classList.contains('hidden')) {
                    const rect = currentBlock.getBoundingClientRect();
                    if (event.clientY >= rect.top - 20 && event.clientY <= rect.bottom + 20) return;
                }
                copyButton.classList.add('hidden');
                currentBlock = null;
            }
        });

        editorContainer.addEventListener('mouseleave', function() {
            copyButton.classList.add('hidden');
            currentBlock = null;
        });

        editorContainer.addEventListener('scroll', function() {
            if (currentBlock && !copyButton.classList.contains('hidden')) {
                positionButton(currentBlock);
            }
        });

        // コピー実行
        copyButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!currentBlock) return;

            const selection = window.getSelection();
            const savedRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            try {
                const range = document.createRange();
                range.selectNode(currentBlock);
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand('copy');
                showFeedback();
            } catch(err) { /* ignore */ }
            finally {
                selection.removeAllRanges();
                if (savedRange) selection.addRange(savedRange);
            }
        });

        copyButton.addEventListener('mouseenter', function(e) { e.stopPropagation(); });

        function positionButton(block) {
            const blockRect = block.getBoundingClientRect();
            const containerRect = editorContainer.getBoundingClientRect();
            const top = blockRect.top - containerRect.top + editorContainer.scrollTop + (blockRect.height / 2) - 8;
            const left = blockRect.left - containerRect.left - 32;
            copyButton.style.position = 'absolute';
            copyButton.style.top = top + 'px';
            copyButton.style.left = Math.max(4, left) + 'px';
            copyButton.style.right = 'auto';
        }

        function showFeedback() {
            if (feedbackTimer) clearTimeout(feedbackTimer);
            copyButton.classList.add('copied');
            feedbackTimer = setTimeout(function() {
                copyButton.classList.remove('copied');
                feedbackTimer = null;
            }, 2000);
        }

        function resetFeedback() {
            if (feedbackTimer) { clearTimeout(feedbackTimer); feedbackTimer = null; }
            copyButton.classList.remove('copied');
        }
    }

    // ===========================================
    // 3. フローチャート パン / ズーム
    // ===========================================
    function initFlowchartControls() {
        const canvas = document.getElementById('flowchart-canvas');
        const canvasContent = document.getElementById('canvas-content');
        if (!canvas || !canvasContent) return;

        let zoomLevel = parseFloat(canvasContent.style.transform?.match(/scale\\(([^)]+)\\)/)?.[1]) || 1.0;
        let isPanning = false;
        let startX = 0, startY = 0;

        // ズームボタン
        var zoomInBtn = document.getElementById('zoom-in-btn');
        var zoomOutBtn = document.getElementById('zoom-out-btn');
        var fitViewBtn = document.getElementById('fit-view-btn');

        if (zoomInBtn) zoomInBtn.addEventListener('click', function() { setZoom(zoomLevel + 0.1); });
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', function() { setZoom(zoomLevel - 0.1); });
        if (fitViewBtn) fitViewBtn.addEventListener('click', fitView);

        function setZoom(newLevel) {
            zoomLevel = Math.max(0.2, Math.min(3.0, newLevel));
            canvasContent.style.transform = 'scale(' + zoomLevel + ')';
            canvasContent.style.transformOrigin = 'top left';
        }

        function fitView() {
            const shapes = document.querySelectorAll('#shapes-layer .shape');
            if (shapes.length === 0) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            shapes.forEach(function(s) {
                if (s.style.display === 'none') return;
                const x = parseInt(s.style.left) || 0;
                const y = parseInt(s.style.top) || 0;
                const w = parseInt(s.style.width) || 120;
                const h = parseInt(s.style.height) || 50;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x + w > maxX) maxX = x + w;
                if (y + h > maxY) maxY = y + h;
            });
            const padding = 40;
            const contentW = maxX - minX + padding * 2;
            const contentH = maxY - minY + padding * 2;
            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvasRect.width / contentW;
            const scaleY = canvasRect.height / contentH;
            zoomLevel = Math.min(scaleX, scaleY, 1.5);
            setZoom(zoomLevel);
            canvas.scrollLeft = (minX - padding) * zoomLevel;
            canvas.scrollTop = (minY - padding) * zoomLevel;
        }

        // パン操作
        canvas.addEventListener('mousedown', function(e) {
            if (e.target.closest('.shape') || e.target.closest('.mode-btn')) return;
            isPanning = true;
            startX = e.clientX + canvas.scrollLeft;
            startY = e.clientY + canvas.scrollTop;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', function(e) {
            if (!isPanning) return;
            canvas.scrollLeft = startX - e.clientX;
            canvas.scrollTop = startY - e.clientY;
        });

        window.addEventListener('mouseup', function() {
            if (isPanning) {
                isPanning = false;
                canvas.style.cursor = '';
            }
        });

        // ホイールズーム
        canvas.addEventListener('wheel', function(e) {
            e.preventDefault();
            var delta = e.deltaY > 0 ? -0.05 : 0.05;
            setZoom(zoomLevel + delta);
        }, { passive: false });
    }

    // ===========================================
    // 4. フローチャート グループ折りたたみ/展開
    // ===========================================
    function initGroupToggle() {
        var shapesLayer = document.getElementById('shapes-layer');
        if (!shapesLayer) return;

        shapesLayer.addEventListener('mousedown', function(e) {
            var toggle = e.target.closest('.group-toggle');
            if (!toggle) return;
            e.stopPropagation();

            var shapeEl = toggle.closest('.shape');
            if (!shapeEl) return;
            var shapeId = shapeEl.id;
            var shapeData = SHAPES_DATA[shapeId];
            if (!shapeData || !shapeData.children || shapeData.children.length === 0) return;

            // 折りたたみ状態を反転
            shapeData.collapsed = !shapeData.collapsed;
            toggle.textContent = shapeData.collapsed ? '+' : '-';

            // 子要素の表示/非表示を切り替え
            setChildrenVisibility(shapeId, !shapeData.collapsed);

            // 接続線を再描画
            redrawConnections();
        });

        function setChildrenVisibility(parentId, visible) {
            var parentData = SHAPES_DATA[parentId];
            if (!parentData || !parentData.children) return;
            parentData.children.forEach(function(childId) {
                var childEl = document.getElementById(childId);
                if (childEl) {
                    childEl.style.display = visible ? '' : 'none';
                }
                var childData = SHAPES_DATA[childId];
                if (childData && childData.children && childData.children.length > 0) {
                    // 子も折りたたまれている場合はその子は非表示のまま
                    if (visible && !childData.collapsed) {
                        setChildrenVisibility(childId, true);
                    } else if (!visible) {
                        setChildrenVisibility(childId, false);
                    }
                }
            });
        }
    }

    // ===========================================
    // 5. フローチャート ノードクリック → スクロール
    // ===========================================
    function initNodeClickScroll() {
        var shapesLayer = document.getElementById('shapes-layer');
        if (!shapesLayer) return;

        shapesLayer.addEventListener('mousedown', function(e) {
            if (e.target.closest('.group-toggle')) return;

            var shapeEl = e.target.closest('.shape');
            if (!shapeEl) return;

            var shapeId = shapeEl.id;
            var shapeData = SHAPES_DATA[shapeId];
            if (shapeData && shapeData.headingId) {
                setTimeout(function() {
                    scrollToHeading(shapeData.headingId);
                }, 0);
            }
        });
    }

    // ===========================================
    // 6. フローチャート折りたたみトグル
    // ===========================================
    function initFlowchartToggle() {
        var toggleBtn = document.getElementById('flowchart-toggle-btn');
        var container = document.getElementById('flowchart-container');
        if (!toggleBtn || !container) return;

        toggleBtn.addEventListener('click', function() {
            container.classList.toggle('collapsed');
        });
    }

    // ===========================================
    // 7. サイドバー表示/非表示
    // ===========================================
    function initSidebarToggle() {
        var toggleBtn = document.getElementById('toggleSidebar');
        var sidebar = document.getElementById('sidebar');
        if (!toggleBtn || !sidebar) return;

        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('hidden');
        });
    }

    // ===========================================
    // 接続線の再描画ヘルパー
    // ===========================================
    function redrawConnections() {
        // 非表示のシェイプに接続する線を非表示にする
        var svg = document.getElementById('connections-layer');
        if (!svg) return;
        var paths = svg.querySelectorAll('path[data-from], g[data-from]');
        paths.forEach(function(pathOrGroup) {
            var fromId = pathOrGroup.dataset.from;
            var toId = pathOrGroup.dataset.to;
            var fromEl = fromId ? document.getElementById(fromId) : null;
            var toEl = toId ? document.getElementById(toId) : null;
            var fromVisible = fromEl && fromEl.style.display !== 'none';
            var toVisible = toEl && toEl.style.display !== 'none';
            pathOrGroup.style.display = (fromVisible && toVisible) ? '' : 'none';
        });
    }

    // ===========================================
    // 初期化
    // ===========================================
    document.addEventListener('DOMContentLoaded', function() {
        initOutlineNavigation();
        initBlockCopy();
        initFlowchartControls();
        initGroupToggle();
        initNodeClickScroll();
        initFlowchartToggle();
        initSidebarToggle();
    });
})();
`;
    }

    /**
     * フローチャートのシェイプデータをJSONとしてシリアライズします。
     * @private
     * @returns {string} JSON文字列
     */
    _serializeShapesData() {
        const data = {};

        if (!this.flowchartApp || !this.flowchartApp.shapes) {
            return JSON.stringify(data);
        }

        for (const [id, shape] of this.flowchartApp.shapes.entries()) {
            data[id] = {
                headingId: shape.headingId || null,
                collapsed: shape.collapsed || false,
                children: shape.children ? shape.children.map(c => typeof c === 'string' ? c : c.id || c) : [],
                parent: shape.parent || null,
            };
        }

        return JSON.stringify(data);
    }

    // ========================================
    // ユーティリティ
    // ========================================

    /**
     * HTMLファイルをダウンロードします。
     * @private
     * @param {Blob} blob
     * @param {string} filename
     */
    async _downloadHtml(blob, filename) {
        if (this.supportsFileSystemAccess) {
            const options = {
                suggestedName: filename,
                types: [{
                    description: 'HTMLファイル',
                    accept: { 'text/html': ['.html'] }
                }]
            };
            const fileHandle = await window.showSaveFilePicker(options);
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            console.log('HTMLビューワーをエクスポートしました:', fileHandle.name);
        } else {
            // フォールバック: FileSaver.js or link download
            if (typeof saveAs === 'function') {
                saveAs(blob, filename);
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }
    }

    /**
     * ファイル名をサニタイズします。
     * @private
     * @param {string} filename
     * @returns {string}
     */
    _sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') return 'document';
        return filename
            .replace(/[/\\:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim() || 'document';
    }

    /**
     * HTMLエスケープ
     * @private
     * @param {string} str
     * @returns {string}
     */
    _escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
