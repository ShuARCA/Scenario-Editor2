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
            `--editor-text-color: ${targetText};`,
            `--flowchart-danger-color: ${themeColors.danger};`
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
    /* --shape-bg / --shape-border-color が inline style で設定されていない場合のデフォルト値を上書き */
    /* !important で background-color / border-color を直接上書きすると CSS 変数による個別色が消えるため禁止 */
    --shape-bg: var(--surface-color);
    --shape-border-color: var(--border-color);
    color: var(--text-color) !important;
    cursor: pointer;
}
.shape:hover {
    --shape-border-color: var(--primary-color);
    box-shadow: 0 0 3px color-mix(in srgb, var(--primary-color) 50%, transparent) !important;
}
.shape-text { color: var(--text-color) !important; }
body.viewer-mode .resize-handle,
body.viewer-mode .connection-point { display: none !important; }
.group-parent-overlay { align-items: center; padding-right: 28px; }
.group-overlay-btn {
    position: absolute;
    top: 6px;
    right: 4px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 4px;
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
    color: var(--text-muted);
    background: color-mix(in srgb, var(--surface-color) 80%, transparent);
    border: none;
    transition: all 0.15s ease;
    z-index: 10;
}
.group-overlay-btn:hover {
    color: var(--primary-color);
}
.overlay-group-area {
    position: absolute;
    background-color: var(--overlay-bg-color, color-mix(in srgb, var(--surface-color) 85%, transparent));
    border: 2px solid var(--overlay-border-color, var(--primary-color));
    border-radius: 10px;
    box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.12);
    /* z-indexはJSで動的設定（親シェイプより前面になるよう深さに応じて算出） */
    pointer-events: none;
    box-sizing: border-box;
}
.overlay-area-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 34px;
    background: transparent;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    pointer-events: auto;
    cursor: default !important;
    user-select: none;
    z-index: 12;
}

.overlay-area-title-group { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.overlay-area-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.overlay-area-icon svg {
    width: 18px;
    height: 18px;
    fill: var(--primary-color);
}
.overlay-area-title { font-size: 12px; font-weight: 600; color: var(--overlay-text-color, var(--text-color)); }
.overlay-area-close-btn {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 16px;
    color: var(--text-muted);
}
.overlay-area-close-btn:hover { color: var(--flowchart-danger-color); transform: scale(1.05); }
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

/* === ボックスコントロールスタイル補強 === */
.box-controls {
    position: absolute;
    top: 5px;
    right: 5px;
    display: flex;
    gap: 4px;
    z-index: 10;
}
.box-control-btn {
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s, background-color 0.2s, color 0.2s;
    opacity: 0;
}
.box-container:hover .box-control-btn,
.box-control-btn:focus,
.box-control-btn.active {
    opacity: 1;
}
.box-control-btn:hover {
    background-color: var(--border-color);
    color: var(--text-color);
}
.box-control-btn.copied {
    color: #10b981 !important;
}

/* === 画像コンテナおよび段組み（float）スタイル === */
.resizable-container {
    position: relative;
    display: inline-block;
    max-width: 100%;
    margin: 0.2em;
    overflow: visible;
    vertical-align: top;
}
.resizable-container img {
    margin: 0;
    display: block;
    max-width: 100%;
    height: auto;
}
.resizable-container.align-left {
    display: block;
    margin-left: 0;
    margin-right: auto;
}
.resizable-container.align-center {
    display: block;
    margin-left: auto;
    margin-right: auto;
}
.resizable-container.align-right {
    display: block;
    margin-left: auto;
    margin-right: 0;
}
.resizable-container.float-enabled.align-left {
    float: left;
    margin-right: 16px;
}
.resizable-container.float-enabled.align-right {
    float: right;
    margin-left: 16px;
}
.resizable-container.align-center + p,
.resizable-container:not(.float-enabled) + p,
.resizable-container.align-center + *,
.resizable-container:not(.float-enabled) + * {
    clear: both;
}
#editor::after {
    content: '';
    display: table;
    clear: both;
}
body.viewer-mode .resizable-container:hover,
body.viewer-mode .resizable-container.selected,
body.viewer-mode .resizable-container.resizing {
    outline: none !important;
    box-shadow: none !important;
}
body.viewer-mode .resizable-container .resize-handle {
    display: none !important;
}

@media print {
    .box-controls,
    .block-copy-button,
    .sidebar-toggle-fixed,
    .flowchart-toggle-btn {
        display: none !important;
    }
}
`;
    }

    // ========================================
    // DOMキャプチャ
    // ========================================

    /**
     * エディタコンテンツを取得し、空ブロックの補完やボックスコピーボタンの追加を行います。
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

            // 画像コンテナの整形: 配置と段組み（float）を反映
            const images = doc.body.querySelectorAll('img');
            images.forEach(img => {
                // 既に resizable-container 内にある場合はハンドル等のクリーンアップのみ
                const existingContainer = img.closest('.resizable-container');
                if (existingContainer) {
                    existingContainer.querySelectorAll('.resize-handle').forEach(el => el.remove());
                    return;
                }

                const alignment = img.getAttribute('data-alignment') || 'left';
                const floatEnabled = img.getAttribute('data-float-enabled') === 'true' && alignment !== 'center';

                const container = doc.createElement('div');
                container.className = `resizable-container align-${alignment}`;
                if (floatEnabled) {
                    container.classList.add('float-enabled');
                }

                // 幅の決定
                let width = img.style.width;
                if (!width && img.getAttribute('data-original-width')) {
                    width = `${img.getAttribute('data-original-width')}px`;
                }
                if (!width && img.getAttribute('width')) {
                    const w = img.getAttribute('width');
                    width = isNaN(w) ? w : `${w}px`;
                }

                // エディタの実DOMからのフォールバック取得
                if (!width) {
                    try {
                        const src = img.getAttribute('src');
                        if (src) {
                            const liveImgs = document.querySelectorAll('#editor img');
                            for (const liveImg of liveImgs) {
                                if (liveImg.getAttribute('src') === src) {
                                    const liveContainer = liveImg.closest('.resizable-container');
                                    if (liveContainer && liveContainer.style.width) {
                                        width = liveContainer.style.width;
                                        break;
                                    }
                                    if (liveImg.style.width) {
                                        width = liveImg.style.width;
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (_) {}
                }

                if (width) {
                    container.style.width = width;
                    img.style.width = width;
                }

                img.style.display = 'block';
                img.style.height = 'auto';
                img.style.maxWidth = '100%';

                const parent = img.parentElement;
                if (parent && parent.tagName.toLowerCase() === 'p' && parent.children.length === 1 && parent.textContent.trim() === '') {
                    parent.parentNode.insertBefore(container, parent);
                    container.appendChild(img);
                    parent.remove();
                } else if (img.parentNode) {
                    img.parentNode.insertBefore(container, img);
                    container.appendChild(img);
                }
            });

            // ボックスコンテナの整形: コピーボタンを追加し、設定関連要素を除去
            const boxContainers = doc.body.querySelectorAll('.box-container');
            boxContainers.forEach(box => {
                // 設定ボタンや設定パネルが存在する場合は除去
                box.querySelectorAll('.box-settings-btn, .box-settings-panel').forEach(el => el.remove());

                // 既存の controls がない場合は作成
                let controls = box.querySelector('.box-controls');
                if (!controls) {
                    controls = doc.createElement('div');
                    controls.className = 'box-controls';
                    box.insertBefore(controls, box.firstChild);
                }

                // コピーボタンが存在しない場合は追加
                if (!controls.querySelector('.box-copy-btn')) {
                    const copyBtn = doc.createElement('button');
                    copyBtn.type = 'button';
                    copyBtn.className = 'box-control-btn box-copy-btn';
                    copyBtn.title = '内容をコピー';
                    copyBtn.setAttribute('aria-label', 'ボックスの内容をコピー');
                    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="${VIEWER_ICONS.COPY}" /></svg>`;
                    controls.appendChild(copyBtn);
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

        const overlayStrat = this.flowchartApp?.groupManager?.overlayStrategy;
        for (const [id, shape] of this.flowchartApp.shapes.entries()) {
            const isOpen = overlayStrat ? (overlayStrat.isOverlayOpen(id) || !!shape.overlayOpen || !!shape._overlayWasOpen) : (!!shape.overlayOpen || !!shape._overlayWasOpen);
            let overlayBounds = shape.overlayBounds || null;
            if (overlayStrat && overlayStrat.isOverlayOpen(id)) {
                const overlay = overlayStrat.openOverlays.get(id);
                if (overlay && overlay.areaElement) {
                    overlayBounds = {
                        x: overlay.x,
                        y: overlay.y,
                        width: overlay.width,
                        height: overlay.height
                    };
                }
            }
            data[id] = {
                headingId: shape.headingId || null,
                groupMode: shape.groupMode || (shape.collapsed ? 'overlay' : 'inline'),
                children: shape.children ? shape.children.map(c => typeof c === 'string' ? c : c.id || c) : [],
                parent: shape.parent || null,
                overlayBounds: overlayBounds,
                overlayStyle: shape.overlayStyle || null,
                overlayOpen: isOpen
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
        const viewerIconsJson = JSON.stringify({
            COPY: VIEWER_ICONS.COPY,
            CHECK: VIEWER_ICONS.CHECK
        });

        return `(function() {
    'use strict';

    const CONFIG = {
        shapesData: ${shapesData},
        collapsedOutlineIds: ${collapsedOutlineIds},
        commentDisplayMode: ${JSON.stringify(commentDisplayMode)},
        toggleIcons: ${toggleIconsJson},
        viewerIcons: ${viewerIconsJson}
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

        let zoomLevel = 1.0;
        let panX = 0, panY = 0;

        const transMatch = canvasContent.style.transform ? canvasContent.style.transform.match(/translate\\(([^,]+)px,\\s*([^)]+)px\\)\\s*scale\\(([^)]+)\\)/) : null;
        if (transMatch) {
            panX = parseFloat(transMatch[1]) || 0;
            panY = parseFloat(transMatch[2]) || 0;
            zoomLevel = parseFloat(transMatch[3]) || 1.0;
        } else {
            const scaleMatch = canvasContent.style.transform ? canvasContent.style.transform.match(/scale\\(([^)]+)\\)/) : null;
            if (scaleMatch) {
                zoomLevel = parseFloat(scaleMatch[1]) || 1.0;
            }
        }

        function applyTransform() {
            canvasContent.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoomLevel + ')';
            canvasContent.style.transformOrigin = '0 0';
        }

        applyTransform();

        let isPanning = false;
        let startMouseX = 0, startMouseY = 0;
        let startPanX = 0, startPanY = 0;

        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const fitViewBtn = document.getElementById('fit-view-btn');

        function setZoom(newLevel, centerClientX, centerClientY) {
            const oldZoom = zoomLevel;
            const targetZoom = Math.max(0.1, Math.min(2.0, newLevel));
            if (targetZoom === oldZoom) return;

            const rect = canvas.getBoundingClientRect();
            const cx = centerClientX !== undefined && centerClientX !== null ? centerClientX - rect.left : canvas.clientWidth / 2;
            const cy = centerClientY !== undefined && centerClientY !== null ? centerClientY - rect.top : canvas.clientHeight / 2;

            const contentX = (cx - panX) / oldZoom;
            const contentY = (cy - panY) / oldZoom;

            panX = cx - contentX * targetZoom;
            panY = cy - contentY * targetZoom;
            zoomLevel = targetZoom;

            applyTransform();
        }

        function fitView() {
            const shapes = document.querySelectorAll('#shapes-layer .shape');
            if (shapes.length === 0) {
                zoomLevel = 1.0;
                panX = 0;
                panY = 0;
                applyTransform();
                return;
            }
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            shapes.forEach(function(s) {
                if (s.style.display === 'none') return;
                const x = parseFloat(s.style.left) || 0;
                const y = parseFloat(s.style.top) || 0;
                const w = parseFloat(s.style.width) || 120;
                const h = parseFloat(s.style.height) || 50;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x + w > maxX) maxX = x + w;
                if (y + h > maxY) maxY = y + h;
            });

            const overlays = document.querySelectorAll('.overlay-group-area');
            overlays.forEach(function(o) {
                if (o.style.display === 'none') return;
                const x = parseFloat(o.style.left) || 0;
                const y = parseFloat(o.style.top) || 0;
                const w = parseFloat(o.style.width) || 100;
                const h = parseFloat(o.style.height) || 100;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x + w > maxX) maxX = x + w;
                if (y + h > maxY) maxY = y + h;
            });

            if (minX === Infinity) return;

            const padding = 50;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const canvasRect = canvas.getBoundingClientRect();
            const contentW = Math.max(1, maxX - minX);
            const contentH = Math.max(1, maxY - minY);
            const scaleX = canvasRect.width / contentW;
            const scaleY = canvasRect.height / contentH;
            zoomLevel = Math.max(0.1, Math.min(1.0, Math.min(scaleX, scaleY)));

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            panX = canvasRect.width / 2 - centerX * zoomLevel;
            panY = canvasRect.height / 2 - centerY * zoomLevel;

            applyTransform();
        }

        if (zoomInBtn) zoomInBtn.addEventListener('click', function() { setZoom(zoomLevel + 0.1); });
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', function() { setZoom(zoomLevel - 0.1); });
        if (fitViewBtn) fitViewBtn.addEventListener('click', fitView);

        // ピンチズーム用ポインター追跡
        const activePointers = new Map();
        let lastPinchDist = 0;
        let lastPinchMidX = 0;
        let lastPinchMidY = 0;

        canvas.style.touchAction = 'none';

        canvas.addEventListener('pointerdown', function(e) {
            activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

            // 2本指以上のピンチ中はパン開始しない
            if (activePointers.size > 1) {
                isPanning = false;
                return;
            }

            if (e.target.closest('.shape') || e.target.closest('.mode-btn') || e.target.closest('.overlay-group-area')) return;
            isPanning = true;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startPanX = panX;
            startPanY = panY;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
            canvas.setPointerCapture(e.pointerId);
        });

        canvas.addEventListener('pointermove', function(e) {
            if (!activePointers.has(e.pointerId)) return;
            activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

            // 2本指ピンチズーム
            if (activePointers.size === 2) {
                isPanning = false;
                const ptrs = Array.from(activePointers.values());
                const newDist = Math.hypot(ptrs[0].clientX - ptrs[1].clientX, ptrs[0].clientY - ptrs[1].clientY);
                const midX = (ptrs[0].clientX + ptrs[1].clientX) / 2;
                const midY = (ptrs[0].clientY + ptrs[1].clientY) / 2;
                if (lastPinchDist > 0) {
                    setZoom(zoomLevel * (newDist / lastPinchDist), midX, midY);
                }
                lastPinchDist = newDist;
                lastPinchMidX = midX;
                lastPinchMidY = midY;
                return;
            }

            if (!isPanning) return;
            panX = startPanX + (e.clientX - startMouseX);
            panY = startPanY + (e.clientY - startMouseY);
            applyTransform();
        });

        function endPan(e) {
            activePointers.delete(e.pointerId);
            if (activePointers.size === 0) {
                lastPinchDist = 0;
                if (isPanning) {
                    isPanning = false;
                    canvas.style.cursor = '';
                }
            } else if (activePointers.size === 1) {
                // 2本指から1本指に戻ったらピンチ終了
                lastPinchDist = 0;
                const remaining = Array.from(activePointers.values())[0];
                startMouseX = remaining.clientX;
                startMouseY = remaining.clientY;
                startPanX = panX;
                startPanY = panY;
                isPanning = false;
            }
        }

        canvas.addEventListener('pointerup', endPan);
        canvas.addEventListener('pointercancel', endPan);

        // マウス向けフォールバック（既存ブラウザ互換）
        canvas.addEventListener('mousedown', function(e) {
            if (activePointers.size > 0) return; // ポインターイベント使用中は無視
            if (e.target.closest('.shape') || e.target.closest('.mode-btn') || e.target.closest('.overlay-group-area')) return;
            isPanning = true;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startPanX = panX;
            startPanY = panY;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', function(e) {
            if (!isPanning || activePointers.size > 0) return;
            panX = startPanX + (e.clientX - startMouseX);
            panY = startPanY + (e.clientY - startMouseY);
            applyTransform();
        });

        window.addEventListener('mouseup', function() {
            if (isPanning && activePointers.size === 0) {
                isPanning = false;
                canvas.style.cursor = '';
            }
        });


        // -----------------------------------------------------
        // オーバーレイ管理（エディタ同等の多重・入れ子・再帰的可視性対応）
        // -----------------------------------------------------
        const openOverlays = new Map(); // shapeId => { area, shapeId, shapeEl, btn }
        const activeOverlayStack = [];  // [shapeId, ...] (Escキー順序用)

        /**
         * 指定シェイプのオーバーレイ入れ子深さを返す。
         * 祖先シェイプを遡り、現在開いているオーバーレイの数をカウント。
         * トップレベル = 0、子 = 1、孫 = 2 ...
         * @param {string} shapeId
         * @returns {number}
         */
        function getOverlayDepth(shapeId) {
            var depth = 0;
            var pid = CONFIG.shapesData[shapeId] && CONFIG.shapesData[shapeId].parent;
            while (pid) {
                var pd = CONFIG.shapesData[pid];
                if (!pd) break;
                if (pd.groupMode === 'overlay' && openOverlays.has(pid)) {
                    depth++;
                }
                pid = pd.parent;
            }
            return depth;
        }

        /**
         * シェイプがビューワー上で実際に可視（表示中）かどうかを判定
         */
        function isShapeVisibleInViewer(shapeId) {
            if (!shapeId) return false;
            if (shapeId.startsWith('overlay-area-')) {
                const pid = shapeId.replace('overlay-area-', '');
                return openOverlays.has(pid) && isShapeVisibleInViewer(pid);
            }
            const el = document.getElementById(shapeId);
            if (!el || el.style.display === 'none') return false;
            let pid = CONFIG.shapesData[shapeId]?.parent;
            while (pid) {
                const pd = CONFIG.shapesData[pid];
                if (!pd) break;
                if (pd.groupMode === 'overlay' && !openOverlays.has(pid)) {
                    return false;
                }
                pid = pd.parent;
            }
            return true;
        }

        /**
         * インライングループ配下の子孫ノードを再帰的に表示
         */
        function showInlineDescendants(parentId) {
            const pData = CONFIG.shapesData[parentId];
            if (!pData || !pData.children) return;
            pData.children.forEach(function(childId) {
                const childEl = document.getElementById(childId);
                if (childEl) childEl.style.display = 'flex';
                const cData = CONFIG.shapesData[childId];
                if (cData && cData.children && cData.children.length > 0) {
                    if (cData.groupMode === 'overlay') {
                        const btn = childEl.querySelector('.group-overlay-btn, .group-toggle');
                        if (btn) btn.classList.toggle('active', openOverlays.has(childId));
                        if (openOverlays.has(childId)) {
                            showInlineDescendants(childId);
                        }
                    } else {
                        showInlineDescendants(childId);
                    }
                }
            });
        }

        /**
         * 指定シェイプの子孫ノードをすべて再帰的に非表示
         */
        function hideDescendants(parentId) {
            const pData = CONFIG.shapesData[parentId];
            if (!pData || !pData.children) return;
            pData.children.forEach(function(childId) {
                const childEl = document.getElementById(childId);
                if (childEl) childEl.style.display = 'none';
                const cData = CONFIG.shapesData[childId];
                if (cData && cData.children && cData.children.length > 0) {
                    hideDescendants(childId);
                }
            });
        }

        /**
         * 指定シェイプ配下の開いているオーバーレイをすべて再帰的に閉じる（再展開用フラグをセット）
         */
        function closeDescendantOverlays(parentId) {
            const pData = CONFIG.shapesData[parentId];
            if (!pData || !pData.children) return;
            pData.children.forEach(function(childId) {
                const cData = CONFIG.shapesData[childId];
                if (!cData) return;
                if (openOverlays.has(childId)) {
                    cData._overlayWasOpen = true;
                    closeViewerOverlay(childId);
                } else if (cData.children && cData.children.length > 0) {
                    closeDescendantOverlays(childId);
                }
            });
        }

        /**
         * 記憶された展開状態（_overlayWasOpen）を元に子孫オーバーレイを再展開
         */
        function restoreDescendantOverlays(parentId) {
            const pData = CONFIG.shapesData[parentId];
            if (!pData || !pData.children) return;
            pData.children.forEach(function(childId) {
                const cData = CONFIG.shapesData[childId];
                if (!cData) return;
                if (cData._overlayWasOpen) {
                    delete cData._overlayWasOpen;
                    const childEl = document.getElementById(childId);
                    if (childEl) openViewerOverlay(childEl, cData);
                } else if (cData.children && cData.children.length > 0) {
                    restoreDescendantOverlays(childId);
                }
            });
        }

        /**
         * オーバーレイを閉じる
         */
        function closeViewerOverlay(shapeId) {
            const overlay = openOverlays.get(shapeId);
            if (!overlay) return;

            // 子孫オーバーレイを再帰的に閉じる
            closeDescendantOverlays(shapeId);

            if (overlay.btn) overlay.btn.classList.remove('active');

            // 子孫ノードを非表示
            hideDescendants(shapeId);

            // 子シェイプのz-indexをリセット（CSSデフォルトに戻す）
            resetChildrenZIndex(shapeId);

            // マップとスタックから削除
            openOverlays.delete(shapeId);
            const idx = activeOverlayStack.indexOf(shapeId);
            if (idx !== -1) activeOverlayStack.splice(idx, 1);

            // DOM削除
            if (overlay.area) overlay.area.remove();

            redrawConnections();
        }

        /**
         * 子シェイプのz-indexを指定値に設定します（インライングループの子孫も再帰的に）。
         * オーバーレイグループの子については、そのオーバーレイが開かれた際に再度設定されます。
         * @param {string} parentId
         * @param {number} zIndex
         */
        function setChildrenZIndex(parentId, zIndex) {
            var pd = CONFIG.shapesData[parentId];
            if (!pd || !pd.children) return;
            pd.children.forEach(function(cid) {
                var cel = document.getElementById(cid);
                if (cel) cel.style.zIndex = zIndex;
                var cd = CONFIG.shapesData[cid];
                // インライングループの子孫は常時展開なので同じz-indexを再帰設定
                // （オーバーレイグループの子はそのオーバーレイが開かれた際に再設定される）
                if (cd && cd.groupMode !== 'overlay' && cd.children && cd.children.length > 0) {
                    setChildrenZIndex(cid, zIndex);
                }
            });
        }

        /**
         * 子シェイプのz-indexをリセットします（オーバーレイを閉じる際に呼び出す）。
         * @param {string} parentId
         */
        function resetChildrenZIndex(parentId) {
            var pd = CONFIG.shapesData[parentId];
            if (!pd || !pd.children) return;
            pd.children.forEach(function(cid) {
                var cel = document.getElementById(cid);
                if (cel) cel.style.zIndex = '';
                var cd = CONFIG.shapesData[cid];
                if (cd && cd.children && cd.children.length > 0) {
                    resetChildrenZIndex(cid);
                }
            });
        }



        /**
         * オーバーレイを開く
         */
        function openViewerOverlay(shapeEl, shapeData) {
            const shapeId = shapeEl.id;
            if (openOverlays.has(shapeId)) return;

            const canvasContent = document.getElementById('canvas-content');
            if (!canvasContent) return;

            // 1. エリアDOM作成
            const area = document.createElement('div');
            area.className = 'overlay-group-area';
            area.id = 'overlay-area-' + shapeId;

            const header = document.createElement('div');
            header.className = 'overlay-area-header';

            const titleGroup = document.createElement('div');
            titleGroup.className = 'overlay-area-title-group';
            const icon = document.createElement('span');
            icon.className = 'overlay-area-icon';
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="var(--primary-color)"><path d="M800-360v-200q0-50-35-85t-85-35H240v-120q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v360q0 33-23.5 56.5T800-360ZM160-80q-33 0-56.5-23.5T80-160v-360q0-33 23.5-56.5T160-600h480q33 0 56.5 23.5T720-520v360q0 33-23.5 56.5T640-80H160Z"/></svg>';
            const title = document.createElement('span');
            title.className = 'overlay-area-title';
            const textEl = shapeEl.querySelector('.shape-text');
            title.textContent = textEl ? textEl.textContent : 'グループエリア';
            titleGroup.appendChild(icon);
            titleGroup.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.className = 'overlay-area-close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.title = '閉じる (Esc)';
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                closeViewerOverlay(shapeId);
            });

            header.appendChild(titleGroup);
            header.appendChild(closeBtn);
            area.appendChild(header);

            // ビューワーではオーバーレイキャンバスはドラッグ不可（位置固定）

            canvasContent.appendChild(area);

            // 2. 直接の子を表示し、インライングループの子孫も再帰的に表示
            if (shapeData.children) {
                shapeData.children.forEach(function(cid) {
                    const cel = document.getElementById(cid);
                    if (cel) cel.style.display = 'flex';
                    const cData = CONFIG.shapesData[cid];
                    if (cData && cData.children && cData.children.length > 0) {
                        if (cData.groupMode === 'overlay') {
                            const btn = cel.querySelector('.group-overlay-btn, .group-toggle');
                            if (btn) btn.classList.toggle('active', openOverlays.has(cid));
                        } else {
                            showInlineDescendants(cid);
                        }
                    }
                });
            }

            // 3. 枠のバウンディングボックス設定
            if (shapeData.overlayBounds) {
                area.style.left = shapeData.overlayBounds.x + 'px';
                area.style.top = shapeData.overlayBounds.y + 'px';
                area.style.width = shapeData.overlayBounds.width + 'px';
                area.style.height = shapeData.overlayBounds.height + 'px';
            } else {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                function collectBounds(pid) {
                    const pd = CONFIG.shapesData[pid];
                    if (!pd || !pd.children) return;
                    pd.children.forEach(function(cid) {
                        const cel = document.getElementById(cid);
                        if (cel && cel.style.display !== 'none') {
                            const cx = parseFloat(cel.style.left) || 0;
                            const cy = parseFloat(cel.style.top) || 0;
                            const cw = parseFloat(cel.style.width) || 120;
                            const ch = parseFloat(cel.style.height) || 36;
                            if (cx < minX) minX = cx;
                            if (cy < minY) minY = cy;
                            if (cx + cw > maxX) maxX = cx + cw;
                            if (cy + ch > maxY) maxY = cy + ch;
                        }
                        const cd = CONFIG.shapesData[cid];
                        if (cd && cd.groupMode !== 'overlay') {
                            collectBounds(cid);
                        }
                    });
                }
                collectBounds(shapeId);

                if (minX !== Infinity) {
                    const padding = 20;
                    const headerH = 34;
                    area.style.left = (minX - padding) + 'px';
                    area.style.top = (minY - headerH - padding) + 'px';
                    area.style.width = ((maxX - minX) + padding * 2) + 'px';
                    area.style.height = ((maxY - minY) + headerH + padding * 2) + 'px';
                }
            }

            // 4. overlayStyle（背景色・枠線色・文字色）の適用
            if (shapeData.overlayStyle) {
                const { backgroundColor, borderColor, textColor } = shapeData.overlayStyle;
                if (backgroundColor) {
                    area.style.backgroundColor = backgroundColor;
                    area.style.setProperty('--overlay-bg-color', backgroundColor);
                }
                if (borderColor) {
                    area.style.setProperty('--overlay-border-color', borderColor);
                }
                const actualTextColor = textColor || shapeData.overlayStyle.color;
                if (actualTextColor) {
                    area.style.setProperty('--overlay-text-color', actualTextColor);
                    area.style.color = actualTextColor;
                    const titleEl = area.querySelector('.overlay-area-title');
                    if (titleEl) {
                        titleEl.style.color = actualTextColor;
                    }
                }
            }

            const btn = shapeEl.querySelector('.group-overlay-btn, .group-toggle');
            if (btn) btn.classList.add('active');

            openOverlays.set(shapeId, {
                area: area,
                shapeId: shapeId,
                shapeEl: shapeEl,
                btn: btn
            });
            activeOverlayStack.push(shapeId);

            // z-index: 親シェイプより前面に、入れ子深さに応じて増加
            // 全体の重なり: 親(100) < 親オーバーレイ(200) < 子(300) < 子オーバーレイ(400) < 孫(500)...
            var overlayDepth = getOverlayDepth(shapeId);
            var overlayZ = 200 + overlayDepth * 200;
            area.style.zIndex = overlayZ;

            // 子シェイプをオーバーレイより前面に設定 (overlayZ + 100 = 300, 500, 700...)
            setChildrenZIndex(shapeId, overlayZ + 100);

            // 4. 子孫オーバーレイの復元（親がスタックに積まれた後に復元することでEscキー順序を正しく維持）
            restoreDescendantOverlays(shapeId);

            redrawConnections();
        }

        // 初期状態の可視性設定（overlayモードのグループ配下を非表示に）
        if (CONFIG.shapesData) {
            Object.keys(CONFIG.shapesData).forEach(function(id) {
                const data = CONFIG.shapesData[id];
                if (data.groupMode === 'overlay' && data.children) {
                    hideDescendants(id);
                }
            });

            // 保存時に開いていたオーバーレイの自動復元
            Object.entries(CONFIG.shapesData).forEach(function([sid, sdata]) {
                if (sdata.groupMode === 'overlay' && sdata.overlayOpen) {
                    let canOpen = true;
                    let pid = sdata.parent;
                    while (pid) {
                        const pd = CONFIG.shapesData[pid];
                        if (!pd) break;
                        if (pd.groupMode === 'overlay' && !pd.overlayOpen) {
                            canOpen = false;
                            break;
                        }
                        pid = pd.parent;
                    }
                    if (canOpen) {
                        const el = document.getElementById(sid);
                        if (el && !openOverlays.has(sid)) {
                            openViewerOverlay(el, sdata);
                        }
                    } else {
                        sdata._overlayWasOpen = true;
                    }
                }
            });

            redrawConnections();
        }

        // クリックイベント
        if (shapesLayer) {
            shapesLayer.addEventListener('click', function(e) {
                const btn = e.target.closest('.group-overlay-btn, .group-toggle');
                if (btn) {
                    e.stopPropagation();
                    const shapeEl = btn.closest('.shape');
                    if (!shapeEl) return;
                    const shapeId = shapeEl.id;
                    const shapeData = CONFIG.shapesData[shapeId];
                    if (!shapeData || !shapeData.children || shapeData.children.length === 0) return;

                    if (openOverlays.has(shapeId)) {
                        closeViewerOverlay(shapeId);
                    } else {
                        openViewerOverlay(shapeEl, shapeData);
                    }
                    return;
                }

                const shapeEl = e.target.closest('.shape');
                if (!shapeEl) return;
                const shapeId = shapeEl.id;
                const shapeData = CONFIG.shapesData[shapeId];
                if (shapeData && shapeData.headingId) {
                    scrollToHeading(shapeData.headingId);
                }
            });
        }

        // Escキーで一番手前のオーバーレイを閉じる
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && activeOverlayStack.length > 0) {
                const topId = activeOverlayStack[activeOverlayStack.length - 1];
                closeViewerOverlay(topId);
            }
        });

        // 接続線の再描画（可視性に応じて表示/非表示を切り替え）
        function redrawConnections() {
            // 接続線はshapes-layer内の.connection-wrapperまたはconnections-layerに格納されている
            const shapesLayerEl = document.getElementById('shapes-layer');
            if (shapesLayerEl) {
                const wrappers = shapesLayerEl.querySelectorAll('.connection-wrapper');
                wrappers.forEach(function(wrapper) {
                    const path = wrapper.querySelector('path[data-from]');
                    const fromId = wrapper.getAttribute('data-from') || wrapper.dataset?.from || path?.getAttribute('data-from') || path?.dataset?.from;
                    const toId = wrapper.getAttribute('data-to') || wrapper.dataset?.to || path?.getAttribute('data-to') || path?.dataset?.to;
                    const fromVisible = fromId ? isShapeVisibleInViewer(fromId) : false;
                    const toVisible = toId ? isShapeVisibleInViewer(toId) : false;
                    wrapper.style.display = (fromVisible && toVisible) ? '' : 'none';
                });
            }
            const connLayer = document.getElementById('connections-layer');
            if (connLayer) {
                const paths = connLayer.querySelectorAll('path[data-from]');
                paths.forEach(function(path) {
                    const fromId = path.getAttribute('data-from') || path.dataset?.from;
                    const toId = path.getAttribute('data-to') || path.dataset?.to;
                    const fromVisible = fromId ? isShapeVisibleInViewer(fromId) : false;
                    const toVisible = toId ? isShapeVisibleInViewer(toId) : false;
                    path.style.display = (fromVisible && toVisible) ? '' : 'none';
                });
            }
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
            const startSidebarResize = function(e) {
                if (e.button !== 0) return;
                if (sidebar.classList.contains('collapsed')) return;
                isResizing = true;
                resizer.classList.add('resizing');
                document.body.style.cursor = 'col-resize';
                e.preventDefault();
                if (e.pointerId !== undefined && resizer.setPointerCapture) {
                    resizer.setPointerCapture(e.pointerId);
                }
            };
            resizer.addEventListener('pointerdown', startSidebarResize);
            resizer.addEventListener('mousedown', startSidebarResize);
        }

        const verticalResizer = document.getElementById('vertical-resizer');
        const flowchartContainer = document.getElementById('flowchart-container');
        let isVerticalResizing = false;

        if (verticalResizer && flowchartContainer) {
            const startVerticalResize = function(e) {
                if (e.button !== 0) return;
                if (flowchartContainer.classList.contains('collapsed')) return;
                isVerticalResizing = true;
                verticalResizer.classList.add('resizing');
                document.body.style.cursor = 'row-resize';
                e.preventDefault();
                if (e.pointerId !== undefined && verticalResizer.setPointerCapture) {
                    verticalResizer.setPointerCapture(e.pointerId);
                }
            };
            verticalResizer.addEventListener('pointerdown', startVerticalResize);
            verticalResizer.addEventListener('mousedown', startVerticalResize);
        }

        const handleMove = function(e) {
            if (isResizing && sidebar) {
                const newWidth = Math.max(150, Math.min(500, e.clientX));
                sidebar.style.setProperty('--sidebar-width', newWidth + 'px');
            }

            if (isVerticalResizing && flowchartContainer) {
                const containerRect = flowchartContainer.getBoundingClientRect();
                const containerTop = containerRect.top;
                const maxAllowed = window.innerHeight - containerTop - 100;

                let newHeight = e.clientY - containerTop;
                newHeight = Math.max(100, Math.min(maxAllowed, newHeight));

                flowchartContainer.style.height = newHeight + 'px';
                flowchartContainer.style.flexGrow = '0';
            }
        };

        document.addEventListener('pointermove', handleMove);
        document.addEventListener('mousemove', handleMove);

        const handleEnd = function() {
            if (isResizing) {
                isResizing = false;
                if (resizer) resizer.classList.remove('resizing');
                document.body.style.cursor = '';
            }
            if (isVerticalResizing) {
                isVerticalResizing = false;
                if (verticalResizer) verticalResizer.classList.remove('resizing');
                document.body.style.cursor = '';
                window.dispatchEvent(new Event('resize'));
            }
        };

        document.addEventListener('pointerup', handleEnd);
        document.addEventListener('pointercancel', handleEnd);
        document.addEventListener('mouseup', handleEnd);
    }

    function initBoxCopy() {
        const editorElement = document.getElementById('editor');
        if (!editorElement) return;

        // 防御策: 万が一静的HTMLに .box-controls が未注入のボックスがあれば補完
        const boxes = editorElement.querySelectorAll('.box-container');
        boxes.forEach(function(box) {
            box.querySelectorAll('.box-settings-btn, .box-settings-panel').forEach(function(el) {
                el.remove();
            });

            let controls = box.querySelector('.box-controls');
            if (!controls) {
                controls = document.createElement('div');
                controls.className = 'box-controls';
                box.insertBefore(controls, box.firstChild);
            }
            if (!controls.querySelector('.box-copy-btn')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'box-control-btn box-copy-btn';
                btn.title = '内容をコピー';
                btn.setAttribute('aria-label', 'ボックスの内容をコピー');
                btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="' + CONFIG.viewerIcons.COPY + '" /></svg>';
                controls.appendChild(btn);
            }
        });

        const feedbackTimers = new WeakMap();
        const resetIconTimers = new WeakMap();

        function copyText(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            }
            return new Promise(function(resolve, reject) {
                try {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.left = '-9999px';
                    textarea.style.top = '-9999px';
                    textarea.setAttribute('readonly', '');
                    document.body.appendChild(textarea);
                    textarea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    if (successful) {
                        resolve();
                    } else {
                        reject(new Error('execCommand copy failed'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }

        function showCopySuccess(btn, box) {
            if (feedbackTimers.has(btn)) {
                clearTimeout(feedbackTimers.get(btn));
            }
            if (resetIconTimers.has(btn)) {
                clearTimeout(resetIconTimers.get(btn));
            }
            if (!btn.dataset.originalHtml) {
                btn.dataset.originalHtml = btn.innerHTML;
            }
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" style="color: #10b981;"><path fill="currentColor" d="' + CONFIG.viewerIcons.CHECK + '" /></svg>';
            btn.classList.add('copied');

            const timer = setTimeout(function() {
                const targetBox = box || btn.closest('.box-container');
                const isHovered = targetBox ? (targetBox.matches(':hover') || targetBox.querySelector(':hover') !== null) : false;

                if (isHovered) {
                    btn.innerHTML = btn.dataset.originalHtml;
                    btn.classList.remove('copied');
                    btn.blur();
                } else {
                    // ホバー状態でなければ、まずフォーカスを解除してフェードアウトを開始
                    btn.blur();
                    // フェードアウト完了後（完全に非表示になった後）に元のアイコン・スタイルへ復帰
                    const resetTimer = setTimeout(function() {
                        btn.innerHTML = btn.dataset.originalHtml;
                        btn.classList.remove('copied');
                        resetIconTimers.delete(btn);
                    }, 250);
                    resetIconTimers.set(btn, resetTimer);
                }
                feedbackTimers.delete(btn);
            }, 2000);
            feedbackTimers.set(btn, timer);
        }

        // イベント委譲によるクリックハンドリング
        editorElement.addEventListener('click', async function(e) {
            const copyBtn = e.target.closest('.box-copy-btn');
            if (!copyBtn) return;

            e.preventDefault();
            e.stopPropagation();

            const box = copyBtn.closest('.box-container');
            if (!box) return;

            const bodyEl = box.querySelector('.box-body');
            const text = bodyEl
                ? (bodyEl.innerText !== undefined ? bodyEl.innerText : bodyEl.textContent)
                : (box.innerText !== undefined ? box.innerText : box.textContent);

            try {
                await copyText(text || '');
                showCopySuccess(copyBtn, box);
            } catch (err) {
                try {
                    const range = document.createRange();
                    range.selectNodeContents(bodyEl || box);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    document.execCommand('copy');
                    selection.removeAllRanges();
                    showCopySuccess(copyBtn, box);
                } catch (fallbackErr) {
                    console.error('Box copy failed:', fallbackErr);
                }
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
        initBoxCopy();
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

