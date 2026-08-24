/**
 * ビューワーHTMLエクスポーター
 * 
 * エディタの現在の状態をスタンドアロンの閲覧専用HTMLファイルとしてエクスポートします。
 * 
 * 責務:
 * - エディタコンテンツ、フローチャート、アウトライン、設定をHTML文書に統合
 * - CSS（テーマ・カスタム）のインライン化
 * - 閲覧専用モードの適用（ロック状態 + 保存/読み込み無効化）
 * - ビューワー用JavaScript（コピー、スクロール、ズーム、アウトライン、コメント、リンク等）の埋め込み
 * 
 * @module storage/ViewerExporter
 */

import { TOGGLE_ICONS } from '../assets/icons/OutlineIcons.js';

/** フォントファミリーマッピング (SettingsManagerと同期) */
const FONT_FAMILIES = {
    'sans-serif': 'Inter, "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
    'rounded': '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", sans-serif',
    'serif': 'Merriweather, "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif',
    'monospace': '"Fira Code", "Consolas", "Courier New", monospace',
    'monospace-jp': '"Source Han Code JP", "MS Gothic", "Osaka-Mono", monospace',
    'system': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif'
};

/** テーマ定義 (SettingsManagerと同期) */
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
};

/** テーマ別のカラーパレット */
const THEME_COLORS = {
    [THEMES.LIGHT]: {
        surface: '#f8f8fa',
        surfaceHover: '#f0f0f2',
        surfaceActive: '#f0f0f2',
        text: '#2c2c2c',
        textMuted: '#54534f',
        border: '#e5e7eb',
        borderHover: '#cbd5e1',
        background: '#feffff',
        shadow: 'rgba(0, 0, 0, 0.1)',
        shadowHeavy: 'rgba(0, 0, 0, 0.15)',
        danger: '#d22d39',
        dangerBg: '#f6e1e3',
        dangerBorder: '#d22d39'
    },
    [THEMES.DARK]: {
        surface: '#212121',
        surfaceHover: '#323232',
        surfaceActive: '#323232',
        text: '#e7e7e7',
        textMuted: '#757575',
        border: '#3c3c3d',
        borderHover: '#4b4b4b',
        background: '#2a2a2b',
        shadow: 'rgba(0, 0, 0, 0.5)',
        shadowHeavy: 'rgba(0, 0, 0, 0.7)',
        danger: '#da3e44',
        dangerBg: '#2b171a',
        dangerBorder: '#da3e44'
    }
};

/** ビューワー内共通SVGアイコン */
const VIEWER_ICONS = {
    SIDEBAR_TOGGLE: 'M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z',
    FLOWCHART_COLLAPSED: 'M600-160v-80H440v-200h-80v80H80v-240h280v80h80v-200h160v-80h280v240H600v-80h-80v320h80v-80h280v240H600Zm80-80h120v-80H680v80ZM160-440h120v-80H160v80Zm520-200h120v-80H680v80Zm0 400v-80 80ZM280-440v-80 80Zm400-200v-80 80Z',
    FLOWCHART_EXPANDED: 'm296-224-56-56 240-240 240 240-56 56-184-183-184 183Zm0-240-56-56 240-240 240 240-56 56-184-183-184 183Z',
    ZOOM_IN: 'M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z',
    ZOOM_OUT: 'M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M7,9H12V10H7V9Z',
    FIT_VIEW: 'M2,2H8V4H4V8H2V2M22,8V2H16V4H20V8H22M2,16V22H8V20H4V16H2M20,20H16V22H22V16H20V20M9,7V9H7V15H9V17H15V15H17V9H15V7H9M9,9H15V15H9V9Z',
    COPY: 'M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z',
    CHECK: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z'
};

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
     */
    constructor(deps) {
        this.editorCore = deps.editorCore;
        this.flowchartApp = deps.flowchartApp;
        this.settingsManager = deps.settingsManager;
        this.customCssManager = deps.customCssManager;
        this.outlineManager = deps.outlineManager;
        this.supportsFileSystemAccess = 'showSaveFilePicker' in window;
    }

    // ========================================
    // エクスポート実行
    // ========================================

    /**
     * HTMLビューワーファイルをエクスポートします。
     * @param {string} title - ドキュメントタイトル
     * @param {string} filename - 保存ファイル名（拡張子なし）
     * @param {Object} [options={}] - エクスポートオプション
     * @param {boolean} [options.includeFlowchart=true] - フローチャートを含めるかどうか
     */
    async export(title, filename, options = {}) {
        const opts = { includeFlowchart: true, ...options };
        try {
            const html = await this._buildHtml(title, opts);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const exportFilename = `${this._sanitizeFilename(filename)}.html`;
            await this._downloadHtml(blob, exportFilename);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('HTMLエクスポートエラー:', error);
            alert(`HTMLエクスポートに失敗しました: ${error.message}`);
        }
    }

    // ========================================
    // HTML構築
    // ========================================

    /**
     * 完全なHTMLドキュメントを構築します。
     * @private
     * @param {string} title - ドキュメントタイトル
     * @param {Object} [options={}] - エクスポートオプション
     * @returns {string} HTML文字列
     */
    async _buildHtml(title, options = {}) {
        const includeFlowchart = options.includeFlowchart !== false;
        const layoutCtx = this._getLayoutContext();
        const styles = await this._collectStyles(layoutCtx, options);
        const editorContent = this._collectEditorContent();
        const flowchartHtml = includeFlowchart
            ? this._captureFlowchart()
            : { svg: '', shapes: '', canvasStyle: '', isCollapsed: false, containerStyle: '' };
        const outlineHtml = this._captureOutline();
        const viewerScript = this._buildViewerScript(options);

        const flowchartIconPath = flowchartHtml.isCollapsed
            ? VIEWER_ICONS.FLOWCHART_COLLAPSED
            : VIEWER_ICONS.FLOWCHART_EXPANDED;

        const flowchartElementsHtml = includeFlowchart ? `
            <button id="flowchart-toggle-btn" class="flowchart-toggle-btn" title="${flowchartHtml.isCollapsed ? 'フローチャート' : '折りたたみ'}">
                <svg class="icon" viewBox="0 -960 960 960"><path d="${flowchartIconPath}" /></svg>
            </button>
            <div id="flowchart-container"${flowchartHtml.isCollapsed ? ' class="collapsed"' : ''}${flowchartHtml.containerStyle}>
                <div class="flowchart-toolbar">
                    <button id="zoom-in-btn" class="mode-btn" title="拡大"><svg class="icon" viewBox="0 0 24 24"><path d="${VIEWER_ICONS.ZOOM_IN}" /></svg></button>
                    <button id="zoom-out-btn" class="mode-btn" title="縮小"><svg class="icon" viewBox="0 0 24 24"><path d="${VIEWER_ICONS.ZOOM_OUT}" /></svg></button>
                    <button id="fit-view-btn" class="mode-btn" title="全体表示"><svg class="icon" viewBox="0 0 24 24"><path d="${VIEWER_ICONS.FIT_VIEW}" /></svg></button>
                </div>
                <div id="flowchart-canvas">
                    <div id="canvas-content" style="${flowchartHtml.canvasStyle}">
                        ${flowchartHtml.svg}
                        <div id="shapes-layer">${flowchartHtml.shapes}</div>
                    </div>
                </div>
            </div>
            <div id="vertical-resizer"></div>` : '';

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="iEditWeb Viewer Export">
    <title>${this._escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code&family=Inter:wght@400;500;600&family=M+PLUS+Rounded+1c:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
${styles}
    </style>
</head>
<body class="locked viewer-mode ${layoutCtx.themeClass}">
    <button id="toggleSidebar" class="sidebar-toggle-fixed" title="アウトライン表示/非表示">
        <svg class="icon" viewBox="0 0 24 24"><path d="${VIEWER_ICONS.SIDEBAR_TOGGLE}" /></svg>
    </button>
    <div id="container">
        <aside id="sidebar">
            <div id="resizer"></div>
            <div class="sidebar-section">
                <h3>アウトライン</h3>
                <div id="outline-list">${outlineHtml}</div>
            </div>
        </aside>
        <main id="main-content"${layoutCtx.mainContentStyle}>${flowchartElementsHtml}
            <div id="editor-area">
                <div id="editor-container"${layoutCtx.editorContainerStyle}>
                    <div id="editor" contenteditable="false" spellcheck="false"${layoutCtx.editorStyle}>${editorContent}</div>
                    <aside id="comment-sidebar" class="${layoutCtx.commentMode === 'always' ? '' : 'hidden'}">
                        <div id="comment-list"></div>
                    </aside>
                </div>
            </div>
        </main>
    </div>
    <div id="comment-popup" class="comment-popup hidden">
        <div class="comment-popup-content"><div class="comment-popup-text"></div></div>
    </div>
    <div id="link-popup" class="link-popup hidden">
        <div class="link-popup-content">
            <span class="link-popup-text"></span>
            <span class="link-popup-hint">（Ctrl + クリックで開く）</span>
        </div>
    </div>
    <script>
${viewerScript}
    </script>
</body>
</html>`;
    }

    // ========================================
    // スタイル収集 & レイアウト設定
    // ========================================

    /**
     * テーマ・レイアウトのコンテキスト情報を一括計算します。
     * @private
     */
    _getLayoutContext() {
        const settings = this.settingsManager?.getSettings?.() || {};
        const isDark = settings.theme === THEMES.DARK;
        const themeColors = isDark ? THEME_COLORS[THEMES.DARK] : THEME_COLORS[THEMES.LIGHT];

        let targetBg = themeColors.background;
        let targetText = themeColors.text;
        if (settings.useFileColors) {
            targetBg = settings.editorBgColor || themeColors.background;
            targetText = settings.editorTextColor || themeColors.text;
        }

        const fontFamily = FONT_FAMILIES[settings.fontFamily] || FONT_FAMILIES['sans-serif'];
        const fontSize = settings.fontSize || '12pt';
        const primaryColor = settings.primaryColor || '#0d9488';
        const primaryHover = `${primaryColor}cc`;

        const mainContentStyles = [];
        const editorContainerStyles = [];
        const editorStyles = [
            `font-family: ${fontFamily}`,
            `font-size: ${fontSize}`,
            `color: ${targetText} !important`,
            `background-color: ${targetBg} !important`
        ];

        if (settings.backgroundImage) {
            mainContentStyles.push(
                `background-image: url('${settings.backgroundImage}')`,
                'background-size: cover',
                'background-position: center',
                'background-repeat: no-repeat'
            );
            editorContainerStyles.push('background-color: transparent !important');
        } else {
            editorContainerStyles.push('background-color: transparent');
        }

        const cssVariables = [
            `--primary-color: ${primaryColor};`,
            `--primary-hover: ${primaryHover};`,
            `--font-family: ${fontFamily};`,
            `--editor-font-size: ${fontSize};`,
            `--surface-color: ${themeColors.surface};`,
            `--surface-hover: ${themeColors.surfaceHover};`,
            `--surface-active: ${themeColors.surfaceActive};`,
            `--text-color: ${themeColors.text};`,
            `--text-muted: ${themeColors.textMuted};`,
            `--border-color: ${themeColors.border};`,
            `--border-hover: ${themeColors.borderHover};`,
            `--shadow-color: ${themeColors.shadow};`,
            `--shadow-heavy: ${themeColors.shadowHeavy};`,
            `--sidebar-width: 250px;`,
            `--bg-color: ${targetBg};`,
            `--editor-bg-color: ${targetBg};`,
            `--editor-text-color: ${targetText};`
        ].map(line => `    ${line}`).join('\n');

        return {
            settings,
            isDark,
            themeClass: isDark ? 'dark-theme' : '',
            themeColors,
            targetBg,
            targetText,
            fontFamily,
            fontSize,
            primaryColor,
            commentMode: settings.commentDisplayMode || 'hover',
            mainContentStyle: mainContentStyles.length > 0 ? ` style="${mainContentStyles.join('; ')}"` : '',
            editorContainerStyle: editorContainerStyles.length > 0 ? ` style="${editorContainerStyles.join('; ')}"` : '',
            editorStyle: editorStyles.length > 0 ? ` style="${editorStyles.join('; ')}"` : '',
            cssVariables
        };
    }

    /**
     * スタイルシートを収集・インライン化します。
     * @private
     */
    async _collectStyles(layoutCtx, options = {}) {
        const includeFlowchart = options.includeFlowchart !== false;
        const cssParts = [];

        const cssFiles = ['styles/main.css', 'styles/editor.css'];
        if (includeFlowchart) cssFiles.push('styles/flowchart.css');

        for (const file of cssFiles) {
            try {
                const res = await fetch(file);
                if (res.ok) {
                    const text = await res.text();
                    cssParts.push(`/* === ${file} === */\n${text}`);
                }
            } catch (e) {
                console.warn(`CSS読み込み失敗: ${file}`, e);
            }
        }

        if (layoutCtx.cssVariables) {
            cssParts.push(`/* === テーマ変数 === */\n:root {\n${layoutCtx.cssVariables}\n}`);
        }

        cssParts.push(this._getViewerStyles(layoutCtx, options));

        const customCss = this.customCssManager?._generateCssText?.() ||
            document.getElementById('custom-css-styles')?.textContent?.trim() || '';
        if (customCss) {
            cssParts.push(`/* === カスタムCSS === */\n${customCss}`);
        }

        return cssParts.join('\n\n');
    }

    /**
     * ビューワー専用CSSを返します。
     * @private
     */
    _getViewerStyles(layoutCtx, options = {}) {
        const includeFlowchart = options.includeFlowchart !== false;
        const targetText = layoutCtx?.targetText || '#2c2c2c';
        const targetBg = layoutCtx?.targetBg || '#feffff';

        const flowchartStyles = includeFlowchart ? `
.flowchart-toggle-btn {
    position: absolute;
    top: 8px;
    left: 12px;
    z-index: 200;
    width: 30px;
    height: 30px;
    background-color: var(--surface-color);
    border: 0px solid var(--border-color);
    border-radius: 6px;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-muted) !important;
    transition: left 0.3s ease, background-color 0.15s, border-color 0.15s, color 0.15s;
}
.flowchart-toggle-btn:hover {
    background-color: var(--surface-hover);
    border: 1px solid var(--primary-color);
    color: var(--primary-color);
}
.flowchart-toggle-btn svg {
    width: 20px;
    height: 20px;
    fill: var(--text-muted);
}
.flowchart-toolbar {
    position: absolute;
    top: 0;
    left: 0;
    background-color: transparent;
    padding: 8px 12px 8px 48px;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 50;
    transition: padding-left 0.3s ease;
}
#sidebar.collapsed ~ #main-content .flowchart-toggle-btn { left: 48px; }
#sidebar.collapsed ~ #main-content .flowchart-toolbar { padding-left: 84px; }
#flowchart-container {
    background-color: transparent !important;
    transition: margin-top 0.3s ease;
}
.mode-btn { color: var(--text-muted) !important; }
.shape {
    background-color: var(--surface-color) !important;
    border-color: var(--border-color) !important;
    color: var(--text-color) !important;
    cursor: pointer;
}
.shape-text { color: var(--text-color) !important; }
body.viewer-mode .resize-handle,
body.viewer-mode .connection-point { display: none !important; }
` : '';

        return `/* === ビューワー専用スタイル === */
body.viewer-mode {
    font-family: var(--font-family, sans-serif);
    color: var(--text-color) !important;
    background-color: var(--surface-color) !important;
}
body.viewer-mode #toolbar { display: none !important; }
body.viewer-mode #container { height: 100vh !important; }

.sidebar-toggle-fixed {
    position: fixed;
    top: 8px;
    left: 12px;
    z-index: 300;
    width: 30px;
    height: 30px;
    background-color: var(--surface-color);
    border: 0px solid var(--border-color);
    border-radius: 6px;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-muted) !important;
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.sidebar-toggle-fixed:hover {
    background-color: var(--surface-hover);
    border: 1px solid var(--primary-color);
    color: var(--primary-color);
}
.sidebar-toggle-fixed .icon {
    width: 20px;
    height: 20px;
    fill: currentColor;
}

body.viewer-mode #main-content {
    position: relative;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100vh;
}
${flowchartStyles}
#sidebar {
    background-color: var(--surface-color) !important;
    color: var(--text-color) !important;
    --sidebar-width: 250px;
    padding-top: 42px;
}
.sidebar-section h3 { color: var(--text-muted) !important; }
.outline-item { color: var(--text-color) !important; }
.outline-text { color: inherit !important; }
.outline-item.active { color: var(--primary-color) !important; }
#sidebar.collapsed {
    margin-left: calc(var(--sidebar-width) * -1 - 2px) !important;
    border-right: none !important;
}

body.viewer-mode .header-controls button,
body.viewer-mode .storage-dropdown,
body.viewer-mode #float-toolbar,
body.viewer-mode #ruby-panel,
body.viewer-mode #comment-panel,
body.viewer-mode #link-panel,
body.viewer-mode #image-toolbar,
body.viewer-mode #search-panel,
body.viewer-mode #settings-modal,
body.viewer-mode #custom-css-modal,
body.viewer-mode #flowchart-context-menu,
body.viewer-mode #outline-context-menu,
body.viewer-mode #outline-icon-picker,
body.viewer-mode .mode-btn[data-mode],
body.viewer-mode .toolbar-separator { display: none !important; }

body.viewer-mode .outline-icon { pointer-events: none; }

.outline-item.active {
    background-image: linear-gradient(90deg, var(--surface-hover) 15%,
        color-mix(in srgb, var(--primary-color) 15%, var(--surface-hover)) 70%,
        color-mix(in srgb, var(--primary-color) 30%, var(--surface-hover)) 95%,
        color-mix(in srgb, var(--primary-color) 50%, var(--surface-hover)));
    color: var(--primary-color) !important;
    font-weight: 400;
}
.outline-item.has-hidden-active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 8px;
    right: 8px;
    height: 2px;
    background-color: var(--primary-color);
    border-radius: 1px;
}

#editor {
    font-family: var(--font-family, sans-serif);
    font-size: var(--editor-font-size, 12pt);
    color: ${targetText} !important;
    background-color: ${targetBg} !important;
    padding: 8px 32px;
    outline: none;
}
#editor p { min-height: 1.5em; }
#editor p:empty::before,
#editor h1:empty::before,
#editor h2:empty::before,
#editor h3:empty::before,
#editor h4:empty::before,
#editor h5:empty::before,
#editor h6:empty::before {
    content: '\\00a0';
    display: inline-block;
    width: 0;
}
#editor h1,
#editor h2,
#editor h3,
#editor h4,
#editor h5,
#editor h6 {
    scroll-margin-top: 16px;
}
#editor p,
#editor h1,
#editor h2,
#editor h3,
#editor h4,
#editor h5,
#editor h6,
#editor li,
#editor blockquote,
#editor pre,
#editor div,
#editor td,
#editor th {
    color: inherit;
}

#editor a[data-link-id],
#editor a[data-heading-id],
#editor a[href] {
    color: var(--primary-color) !important;
    text-decoration: underline;
    cursor: pointer;
}

.link-popup {
    position: absolute;
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px var(--shadow-heavy), 0 4px 6px -2px var(--shadow-color);
    padding: 6px 12px;
    z-index: 1003;
    max-width: 320px;
    pointer-events: auto;
    font-size: 12px;
}
.link-popup.hidden { display: none; }
.link-popup-content { display: flex; flex-direction: column; gap: 2px; }
.link-popup-text {
    color: var(--primary-color) !important;
    font-weight: 400;
    word-break: break-all;
}
.link-popup-hint { color: var(--text-muted) !important; font-size: 11px; }

#editor .comment-mark {
    position: relative;
    cursor: pointer;
}
#editor .comment-mark:hover,
#editor .comment-mark.hover-sync {
    background-color: color-mix(in srgb, var(--primary-color) 20%, transparent);
    border-radius: 2px;
}
#editor .comment-mark.highlighted {
    background-color: color-mix(in srgb, var(--primary-color) 30%, transparent);
    border-radius: 2px;
}
#editor .comment-mark::after {
    content: '';
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-left: 2px;
    vertical-align: middle;
    background-color: var(--primary-color);
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M240-400h480v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM880-80 720-240H160q-33 0-56.5-23.5T80-320v-480q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v720ZM160-320h594l46 45v-525H160v480Zm0 0v-480 480Z'/%3E%3C/svg%3E");
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M240-400h480v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM880-80 720-240H160q-33 0-56.5-23.5T80-320v-480q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v720ZM160-320h594l46 45v-525H160v480Zm0 0v-480 480Z'/%3E%3C/svg%3E");
    mask-size: contain;
    mask-repeat: no-repeat;
    opacity: 0.9;
}

.comment-popup {
    position: absolute;
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px var(--shadow-heavy), 0 4px 6px -2px var(--shadow-color);
    padding: 10px 14px;
    z-index: 1003;
    max-width: 300px;
    pointer-events: auto;
}
.comment-popup.hidden { display: none; }
.comment-popup-text {
    font-size: 13px;
    color: var(--text-color);
    line-height: 1.5;
    word-wrap: break-word;
}

#comment-sidebar {
    width: 280px;
    min-width: 200px;
    background-color: transparent;
    flex-shrink: 0;
}
#comment-sidebar.hidden { display: none; }
#comment-list {
    position: relative;
    min-height: 100%;
    padding: 8px 0;
}
.comment-list-item {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    padding: 10px 12px;
    margin-bottom: 4px;
    background-color: var(--surface-color);
    border-radius: 6px;
    cursor: pointer;
    border-left: 3px solid var(--primary-color);
    box-shadow: 0 1px 3px var(--shadow-color);
    width: calc(100% - 16px);
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.comment-list-item:hover,
.comment-list-item.active,
.comment-list-item.hover-sync {
    border: 2px solid var(--primary-color);
    border-left-width: 3px;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 50%, transparent);
}
.comment-list-item-text {
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-color);
    word-break: break-word;
    flex: 1;
}
`;
    }

    // ========================================
    // DOMキャプチャ
    // ========================================

    /**
     * エディタコンテンツを取得し、空ブロックに <br> を補完します。
     * @private
     */
    _collectEditorContent() {
        const rawHtml = this.editorCore.getContent() || '';
        if (!rawHtml) return '';

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawHtml, 'text/html');
            const blocks = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li');
            blocks.forEach(el => {
                if (el.children.length === 0 && (!el.textContent || el.textContent.trim() === '')) {
                    el.innerHTML = '<br>';
                }
            });
            return doc.body.innerHTML;
        } catch (e) {
            return rawHtml
                .replace(/<p>(\s*)<\/p>/gi, '<p><br></p>')
                .replace(/<(h[1-6])([^>]*)>(\s*)<\/\1>/gi, '<$1$2><br></$1>');
        }
    }

    /**
     * フローチャートのDOMをキャプチャします。
     * @private
     */
    _captureFlowchart() {
        const container = document.getElementById('flowchart-container');
        const canvasContent = document.getElementById('canvas-content');
        const connectionsLayer = document.getElementById('connections-layer');
        const shapesLayer = document.getElementById('shapes-layer');

        if (!container || !canvasContent || !shapesLayer) {
            return { svg: '', shapes: '', canvasStyle: '', isCollapsed: false, containerStyle: '' };
        }

        const isCollapsed = container.classList.contains('collapsed');
        const canvasStyle = canvasContent.getAttribute('style') || '';
        const containerStyle = isCollapsed ? ` style="margin-top: -${container.offsetHeight + 4 || 304}px;"` : '';

        let svgHtml = '';
        if (connectionsLayer) {
            svgHtml = connectionsLayer.cloneNode(true).outerHTML;
        }

        let shapesHtml = '';
        if (shapesLayer) {
            const shapesClone = shapesLayer.cloneNode(true);
            shapesClone.querySelectorAll('.resize-handle, .connection-point').forEach(el => el.remove());
            shapesHtml = shapesClone.innerHTML;
        }

        return { svg: svgHtml, shapes: shapesHtml, canvasStyle, isCollapsed, containerStyle };
    }

    /**
     * アウトラインのDOMをキャプチャします。
     * @private
     */
    _captureOutline() {
        const outlineList = document.getElementById('outline-list');
        if (!outlineList) return '';

        const clone = outlineList.cloneNode(true);
        clone.querySelectorAll('.outline-menu-btn').forEach(el => el.remove());
        return clone.innerHTML;
    }

    /**
     * シェイプデータをJSONシリアライズします。
     * @private
     */
    _serializeShapesData() {
        const data = {};
        if (!this.flowchartApp?.shapes) return JSON.stringify(data);

        for (const [id, shape] of this.flowchartApp.shapes.entries()) {
            data[id] = {
                headingId: shape.headingId || null,
                collapsed: shape.collapsed || false,
                children: shape.children ? shape.children.map(c => typeof c === 'string' ? c : c.id || c) : [],
                parent: shape.parent || null
            };
        }
        return JSON.stringify(data);
    }

    /**
     * アウトライン折りたたみ状態をシリアライズします。
     * @private
     */
    _serializeCollapsedOutlineIds() {
        if (!this.outlineManager?.getCollapsedState) return '{}';
        return JSON.stringify(this.outlineManager.getCollapsedState());
    }

    /**
     * ビューワー用の埋め込みJavaScriptを生成します。
     * @private
     */
    _buildViewerScript(options = {}) {
        const includeFlowchart = options.includeFlowchart !== false;
        const shapesData = includeFlowchart ? this._serializeShapesData() : '[]';
        const collapsedOutlineIds = this._serializeCollapsedOutlineIds();
        const settings = this.settingsManager?.getSettings?.() || {};
        const commentDisplayMode = settings.commentDisplayMode || 'hover';

        const toggleIconsJson = JSON.stringify({
            collapsed: TOGGLE_ICONS.collapsed,
            expanded: TOGGLE_ICONS.expanded
        });

        return `(function() {
    'use strict';

    const CONFIG = {
        shapesData: ${shapesData},
        collapsedOutlineIds: ${collapsedOutlineIds},
        commentDisplayMode: ${JSON.stringify(commentDisplayMode)},
        toggleIcons: ${toggleIconsJson}
    };

    function scrollToHeading(headingId, options = {}) {
        if (!headingId) return;
        const el = document.getElementById(headingId) || document.querySelector('[id="' + headingId + '"]');
        if (el) {
            try {
                el.scrollIntoView({
                    behavior: options.behavior || 'smooth',
                    block: options.block || 'start'
                });
            } catch (e) {
                el.scrollIntoView(true);
            }
        }
    }

    function initSidebar() {
        const toggleBtn = document.getElementById('toggleSidebar');
        const sidebar = document.getElementById('sidebar');
        if (!toggleBtn || !sidebar) return;

        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }

    function initOutline() {
        const outlineList = document.getElementById('outline-list');
        const editorContainer = document.getElementById('editor-container');
        const editor = document.getElementById('editor');
        if (!outlineList || !editor) return;

        let lastActiveHeadingId = null;
        const collapsedMap = new Map();

        if (CONFIG.collapsedOutlineIds && typeof CONFIG.collapsedOutlineIds === 'object') {
            for (const [id, collapsed] of Object.entries(CONFIG.collapsedOutlineIds)) {
                if (collapsed) {
                    collapsedMap.set(id, true);
                    const wrapper = outlineList.querySelector('.outline-item-wrapper[data-heading-id="' + id + '"]');
                    if (wrapper) {
                        const children = wrapper.querySelector('.outline-children');
                        if (children) children.classList.add('collapsed');
                        const toggle = wrapper.querySelector(':scope > .outline-item .outline-toggle');
                        if (toggle) toggle.innerHTML = CONFIG.toggleIcons.collapsed;
                    }
                }
            }
        }

        outlineList.addEventListener('click', function(e) {
            const toggleEl = e.target.closest('.outline-toggle');
            if (toggleEl) {
                e.preventDefault();
                e.stopPropagation();
                const itemWrapper = toggleEl.closest('.outline-item-wrapper');
                if (!itemWrapper) return;
                const headingId = itemWrapper.dataset.headingId;
                const childrenContainer = itemWrapper.querySelector(':scope > .outline-children');
                if (!childrenContainer) return;

                const isCollapsed = !collapsedMap.get(headingId);
                collapsedMap.set(headingId, isCollapsed);
                childrenContainer.classList.toggle('collapsed', isCollapsed);
                toggleEl.innerHTML = isCollapsed ? CONFIG.toggleIcons.collapsed : CONFIG.toggleIcons.expanded;

                if (lastActiveHeadingId) setOutlineHighlight(lastActiveHeadingId);
                return;
            }

            const item = e.target.closest('.outline-item');
            if (item) {
                e.preventDefault();
                const headingId = item.dataset.headingId;
                if (headingId) {
                    scrollToHeading(headingId);
                    setOutlineHighlight(headingId);
                }
            }
        });

        function isOutlineItemVisible(wrapper) {
            if (!wrapper) return false;
            let parent = wrapper.parentElement;
            while (parent && parent !== outlineList) {
                if (parent.classList.contains('outline-children') && parent.classList.contains('collapsed')) {
                    return false;
                }
                parent = parent.parentElement;
            }
            return true;
        }

        function findVisibleParentOutlineItem(wrapper) {
            if (!wrapper) return null;
            let parent = wrapper.parentElement;
            while (parent && parent !== outlineList) {
                if (parent.classList.contains('outline-item-wrapper')) {
                    const parentItem = parent.querySelector(':scope > .outline-item');
                    if (parentItem && isOutlineItemVisible(parent)) {
                        return parentItem;
                    }
                }
                parent = parent.parentElement;
            }
            return null;
        }

        function setOutlineHighlight(headingId) {
            lastActiveHeadingId = headingId;
            outlineList.querySelectorAll('.outline-item').forEach(function(el) {
                el.classList.remove('active', 'has-hidden-active');
            });

            if (!headingId) return;

            const targetWrapper = outlineList.querySelector('.outline-item-wrapper[data-heading-id="' + headingId + '"]');
            if (targetWrapper) {
                const targetItem = targetWrapper.querySelector(':scope > .outline-item');
                if (targetItem) {
                    if (isOutlineItemVisible(targetWrapper)) {
                        targetItem.classList.add('active');
                    } else {
                        const visibleParent = findVisibleParentOutlineItem(targetWrapper);
                        if (visibleParent) visibleParent.classList.add('has-hidden-active');
                    }
                }
            }
        }

        let scrollTimer = null;
        function updateHighlightOnScroll() {
            if (!editorContainer) return;
            const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
            if (headings.length === 0) return;

            const containerRect = editorContainer.getBoundingClientRect();
            let currentHeadingId = null;

            for (let i = 0; i < headings.length; i++) {
                const h = headings[i];
                const rect = h.getBoundingClientRect();
                if (rect.top - containerRect.top <= 120) {
                    if (h.id) currentHeadingId = h.id;
                } else {
                    break;
                }
            }

            if (!currentHeadingId && headings.length > 0) {
                currentHeadingId = headings[0].id;
            }

            if (currentHeadingId && currentHeadingId !== lastActiveHeadingId) {
                setOutlineHighlight(currentHeadingId);
            }
        }

        if (editorContainer) {
            editorContainer.addEventListener('scroll', function() {
                if (scrollTimer) cancelAnimationFrame(scrollTimer);
                scrollTimer = requestAnimationFrame(updateHighlightOnScroll);
            });
        }

        updateHighlightOnScroll();
    }

    function initFlowchart() {
        const canvas = document.getElementById('flowchart-canvas');
        const canvasContent = document.getElementById('canvas-content');
        const toggleBtn = document.getElementById('flowchart-toggle-btn');
        const container = document.getElementById('flowchart-container');
        const shapesLayer = document.getElementById('shapes-layer');

        if (toggleBtn && container) {
            toggleBtn.addEventListener('click', function() {
                const iconPath = toggleBtn.querySelector('path');
                const isCollapsed = container.classList.contains('collapsed');
                const currentHeight = container.offsetHeight + 4;

                if (isCollapsed) {
                    container.classList.remove('collapsed');
                    requestAnimationFrame(function() {
                        container.style.marginTop = '0px';
                    });
                    toggleBtn.title = '折りたたみ';
                    if (iconPath) iconPath.setAttribute('d', '${VIEWER_ICONS.FLOWCHART_EXPANDED}');
                } else {
                    container.style.marginTop = '-' + currentHeight + 'px';
                    container.classList.add('collapsed');
                    toggleBtn.title = 'フローチャート';
                    if (iconPath) iconPath.setAttribute('d', '${VIEWER_ICONS.FLOWCHART_COLLAPSED}');
                }
            });
        }

        if (!canvas || !canvasContent) return;

        let zoomLevel = parseFloat(canvasContent.style.transform?.match(/scale\\(([^)]+)\\)/)?.[1]) || 1.0;
        let isPanning = false;
        let startX = 0, startY = 0;

        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const fitViewBtn = document.getElementById('fit-view-btn');

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

        if (zoomInBtn) zoomInBtn.addEventListener('click', function() { setZoom(zoomLevel + 0.1); });
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', function() { setZoom(zoomLevel - 0.1); });
        if (fitViewBtn) fitViewBtn.addEventListener('click', fitView);

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


        if (shapesLayer) {
            shapesLayer.addEventListener('mousedown', function(e) {
                const toggle = e.target.closest('.group-toggle');
                if (!toggle) return;
                e.stopPropagation();

                const shapeEl = toggle.closest('.shape');
                if (!shapeEl) return;
                const shapeId = shapeEl.id;
                const shapeData = CONFIG.shapesData[shapeId];
                if (!shapeData || !shapeData.children || shapeData.children.length === 0) return;

                shapeData.collapsed = !shapeData.collapsed;
                toggle.textContent = shapeData.collapsed ? '+' : '-';
                setChildrenVisibility(shapeId, !shapeData.collapsed);
                redrawConnections();
            });

            shapesLayer.addEventListener('mousedown', function(e) {
                if (e.target.closest('.group-toggle')) return;
                const shapeEl = e.target.closest('.shape');
                if (!shapeEl) return;
                const shapeId = shapeEl.id;
                const shapeData = CONFIG.shapesData[shapeId];
                if (shapeData && shapeData.headingId) {
                    setTimeout(function() {
                        scrollToHeading(shapeData.headingId);
                    }, 0);
                }
            });
        }

        function setChildrenVisibility(parentId, visible) {
            const parentData = CONFIG.shapesData[parentId];
            if (!parentData || !parentData.children) return;
            parentData.children.forEach(function(childId) {
                const childEl = document.getElementById(childId);
                if (childEl) childEl.style.display = visible ? '' : 'none';
                const childData = CONFIG.shapesData[childId];
                if (childData && childData.children && childData.children.length > 0) {
                    if (visible && !childData.collapsed) {
                        setChildrenVisibility(childId, true);
                    } else if (!visible) {
                        setChildrenVisibility(childId, false);
                    }
                }
            });
        }

        function redrawConnections() {
            const svg = document.getElementById('connections-layer');
            if (!svg) return;
            const paths = svg.querySelectorAll('path[data-from], g[data-from]');
            paths.forEach(function(pathOrGroup) {
                const fromId = pathOrGroup.dataset.from;
                const toId = pathOrGroup.dataset.to;
                const fromEl = fromId ? document.getElementById(fromId) : null;
                const toEl = toId ? document.getElementById(toId) : null;
                const fromVisible = fromEl && fromEl.style.display !== 'none';
                const toVisible = toEl && toEl.style.display !== 'none';
                pathOrGroup.style.display = (fromVisible && toVisible) ? '' : 'none';
            });
        }
    }

    function initComments() {
        const editor = document.getElementById('editor');
        const editorContainer = document.getElementById('editor-container');
        const commentPopup = document.getElementById('comment-popup');
        const commentSidebar = document.getElementById('comment-sidebar');
        const commentList = document.getElementById('comment-list');
        if (!editor || !editorContainer) return;

        const commentMarks = editor.querySelectorAll('.comment-mark');
        if (commentMarks.length === 0) return;

        const isAlwaysMode = CONFIG.commentDisplayMode === 'always';
        let popupHideTimer = null;

        function showCommentPopup(mark) {
            if (!commentPopup) return;
            const text = mark.dataset.commentText || mark.getAttribute('data-comment-text');
            if (!text) return;

            const textEl = commentPopup.querySelector('.comment-popup-text');
            if (textEl) textEl.textContent = text;

            const rect = mark.getBoundingClientRect();
            commentPopup.style.top = (rect.bottom + 5 + window.scrollY) + 'px';
            commentPopup.style.left = (rect.left + window.scrollX) + 'px';
            commentPopup.classList.remove('hidden');
        }

        function hideCommentPopup() {
            if (commentPopup) commentPopup.classList.add('hidden');
        }

        if (commentPopup) {
            commentPopup.addEventListener('mouseleave', hideCommentPopup);
        }

        if (isAlwaysMode && commentSidebar && commentList) {
            commentSidebar.classList.remove('hidden');
            commentList.innerHTML = '';

            const uniqueComments = [];
            commentMarks.forEach(function(mark) {
                const id = mark.dataset.commentId || mark.getAttribute('data-comment-id');
                const text = mark.dataset.commentText || mark.getAttribute('data-comment-text');
                if (id && !uniqueComments.find(function(c) { return c.id === id; })) {
                    uniqueComments.push({ id: id, text: text || '', mark: mark });
                }
            });

            uniqueComments.forEach(function(c) {
                const item = document.createElement('div');
                item.className = 'comment-list-item';
                item.dataset.commentId = c.id;

                const textDiv = document.createElement('div');
                textDiv.className = 'comment-list-item-text';
                textDiv.textContent = c.text;
                item.appendChild(textDiv);

                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const targetMark = editor.querySelector('.comment-mark[data-comment-id="' + c.id + '"]');
                    if (targetMark) {
                        targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    commentList.querySelectorAll('.comment-list-item').forEach(function(el) {
                        el.classList.remove('active');
                    });
                    item.classList.add('active');
                });

                item.addEventListener('mouseenter', function() {
                    const marks = editor.querySelectorAll('.comment-mark[data-comment-id="' + c.id + '"]');
                    marks.forEach(function(m) { m.classList.add('highlighted'); });
                });
                item.addEventListener('mouseleave', function() {
                    const marks = editor.querySelectorAll('.comment-mark[data-comment-id="' + c.id + '"]');
                    marks.forEach(function(m) { m.classList.remove('highlighted'); });
                });

                commentList.appendChild(item);
            });

            function updatePositions() {
                const sidebarRect = commentSidebar.getBoundingClientRect();
                const items = commentList.querySelectorAll('.comment-list-item');
                let lastBottom = 0;
                const MIN_SPACING = 8;

                items.forEach(function(item) {
                    const commentId = item.dataset.commentId;
                    const mark = editor.querySelector('.comment-mark[data-comment-id="' + commentId + '"]');
                    if (!mark) return;

                    const markRect = mark.getBoundingClientRect();
                    let relativeTop = markRect.top - sidebarRect.top;
                    if (relativeTop < lastBottom + MIN_SPACING) {
                        relativeTop = lastBottom + MIN_SPACING;
                    }

                    item.style.position = 'absolute';
                    item.style.top = relativeTop + 'px';
                    item.style.left = '8px';
                    item.style.right = '8px';

                    lastBottom = relativeTop + item.offsetHeight;
                });
            }

            requestAnimationFrame(updatePositions);
            editorContainer.addEventListener('scroll', function() {
                requestAnimationFrame(updatePositions);
            });
            window.addEventListener('resize', function() {
                requestAnimationFrame(updatePositions);
            });
        }

        editor.addEventListener('mouseover', function(e) {
            const mark = e.target.closest('.comment-mark');
            if (mark) {
                if (popupHideTimer) clearTimeout(popupHideTimer);
                if (isAlwaysMode && commentList) {
                    const id = mark.dataset.commentId || mark.getAttribute('data-comment-id');
                    const sidebarItem = commentList.querySelector('.comment-list-item[data-comment-id="' + id + '"]');
                    if (sidebarItem) sidebarItem.classList.add('hover-sync');
                } else {
                    showCommentPopup(mark);
                }
            }
        });

        editor.addEventListener('mouseout', function(e) {
            const mark = e.target.closest('.comment-mark');
            if (mark) {
                if (isAlwaysMode && commentList) {
                    const id = mark.dataset.commentId || mark.getAttribute('data-comment-id');
                    const sidebarItem = commentList.querySelector('.comment-list-item[data-comment-id="' + id + '"]');
                    if (sidebarItem) sidebarItem.classList.remove('hover-sync');
                } else {
                    popupHideTimer = setTimeout(function() {
                        if (!commentPopup || !commentPopup.matches(':hover')) {
                            hideCommentPopup();
                        }
                    }, 150);
                }
            }
        });
    }

    function initLinks() {
        const editor = document.getElementById('editor');
        const linkPopup = document.getElementById('link-popup');
        if (!editor) return;

        let linkHideTimer = null;

        if (linkPopup) {
            editor.addEventListener('mouseover', function(e) {
                const linkMark = e.target.closest('a[data-heading-id], a[data-link-id], a[href], .link-mark');
                if (linkMark) {
                    if (linkHideTimer) clearTimeout(linkHideTimer);
                    const headingId = linkMark.dataset.headingId || linkMark.getAttribute('data-heading-id');
                    const href = linkMark.getAttribute('href');
                    const textEl = linkPopup.querySelector('.link-popup-text');

                    if (headingId) {
                        const targetHeading = document.getElementById(headingId);
                        const headingText = targetHeading ? targetHeading.textContent.trim() : headingId;
                        if (textEl) textEl.textContent = '見出し: ' + headingText;
                    } else if (href) {
                        if (textEl) textEl.textContent = href;
                    } else {
                        return;
                    }

                    const rect = linkMark.getBoundingClientRect();
                    linkPopup.style.top = (rect.bottom + 5 + window.scrollY) + 'px';
                    linkPopup.style.left = (rect.left + window.scrollX) + 'px';
                    linkPopup.classList.remove('hidden');
                }
            });

            editor.addEventListener('mouseout', function(e) {
                const linkMark = e.target.closest('a[data-heading-id], a[data-link-id], a[href], .link-mark');
                if (linkMark) {
                    linkHideTimer = setTimeout(function() {
                        linkPopup.classList.add('hidden');
                    }, 200);
                }
            });
        }

        editor.addEventListener('click', function(e) {
            const linkMark = e.target.closest('a[data-heading-id], a[data-link-id], a[href], .link-mark');
            if (!linkMark) return;

            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const headingId = linkMark.dataset.headingId || linkMark.getAttribute('data-heading-id');
                const href = linkMark.getAttribute('href');

                if (headingId) {
                    scrollToHeading(headingId);
                } else if (href) {
                    window.open(href, '_blank', 'noopener,noreferrer');
                }
            }
        });
    }

    function initBlockCopy() {
        const editorContainer = document.getElementById('editor-container');
        const editorElement = document.getElementById('editor');
        if (!editorContainer || !editorElement) return;

        const blockSelectors = 'p, h1, h2, h3, h4, h5, h6, blockquote, pre, li';
        let currentBlock = null;
        let feedbackTimer = null;

        const copyButton = document.createElement('button');
        copyButton.className = 'block-copy-button hidden';
        copyButton.title = 'テキストコピー';
        copyButton.innerHTML =
            '<svg class="icon copy-icon" viewBox="0 0 24 24" width="16" height="16">' +
            '<path d="${VIEWER_ICONS.COPY}" fill="currentColor"/>' +
            '</svg>' +
            '<svg class="icon check-icon" viewBox="0 0 24 24" width="16" height="16">' +
            '<path d="${VIEWER_ICONS.CHECK}" fill="currentColor"/>' +
            '</svg>';
        editorContainer.appendChild(copyButton);

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

        copyButton.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!currentBlock) return;

            const text = currentBlock.innerText || currentBlock.textContent || '';
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const range = document.createRange();
                    range.selectNode(currentBlock);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    document.execCommand('copy');
                    selection.removeAllRanges();
                }
                showFeedback();
            } catch (err) {
                // フォールバック
                try {
                    const range = document.createRange();
                    range.selectNode(currentBlock);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    document.execCommand('copy');
                    selection.removeAllRanges();
                    showFeedback();
                } catch(e) {}
            }
        });

        copyButton.addEventListener('mouseenter', function(e) { e.stopPropagation(); });

        function positionButton(block) {
            const blockRect = block.getBoundingClientRect();
            const containerRect = editorContainer.getBoundingClientRect();
            const top = blockRect.top - containerRect.top + editorContainer.scrollTop + (blockRect.height / 2) - 8;
            const left = blockRect.left - containerRect.left - 24;
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

    function initResizers() {
        const sidebar = document.getElementById('sidebar');
        const resizer = document.getElementById('resizer');
        let isResizing = false;

        if (sidebar && resizer) {
            resizer.addEventListener('mousedown', function(e) {
                if (sidebar.classList.contains('collapsed')) return;
                isResizing = true;
                document.body.style.cursor = 'col-resize';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isResizing) return;
                const newWidth = Math.max(150, Math.min(500, e.clientX));
                sidebar.style.setProperty('--sidebar-width', newWidth + 'px');
            });
        }

        const verticalResizer = document.getElementById('vertical-resizer');
        const flowchartContainer = document.getElementById('flowchart-container');
        let isVerticalResizing = false;

        if (verticalResizer && flowchartContainer) {
            verticalResizer.addEventListener('mousedown', function(e) {
                if (flowchartContainer.classList.contains('collapsed')) return;
                isVerticalResizing = true;
                document.body.style.cursor = 'row-resize';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isVerticalResizing) return;
                const toolbar = document.getElementById('toolbar');
                const headerHeight = toolbar ? toolbar.offsetHeight : 0;
                const totalHeight = window.innerHeight - headerHeight;

                let newHeight = e.clientY - headerHeight;
                newHeight = Math.max(100, Math.min(totalHeight - 100, newHeight));

                flowchartContainer.style.height = newHeight + 'px';
                flowchartContainer.style.flexGrow = '0';
            });
        }

        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
            if (isVerticalResizing) {
                isVerticalResizing = false;
                document.body.style.cursor = '';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        initSidebar();
        initOutline();
        ${includeFlowchart ? 'initFlowchart();' : ''}
        initResizers();
        initComments();
        initLinks();
        initBlockCopy();
    });
})();
`;
    }

    /**
     * HTMLファイルを保存・ダウンロードします。
     * @private
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
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        }
    }

    /**
     * ファイル名をサニタイズします。
     * @private
     */
    _sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') return 'document';
        return filename
            .replace(/[/\\:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim() || 'document';
    }

    /**
     * HTMLエスケープを行います。
     * @private
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

