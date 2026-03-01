/**
 * カスタムCSSエディタUI
 * 
 * 設定モーダルの「カスタムCSS」タブ内で、
 * 各要素のCSS設定を縦に並べて表示するUIを構築・管理します。
 * 
 * @module ui/CustomCssEditor
 */

import { CustomCssManager } from './CustomCssManager.js';
import { CssSanitizer } from '../utils/CssSanitizer.js';
import { WcagChecker } from '../utils/WcagChecker.js';
import { createElement } from '../utils/dom.js';

// =====================================================
// 定数
// =====================================================

const PSEUDO_SELECTORS = ['::before', '::after'];

// Google Material Icons SVG paths
const SVG_ICONS = {
    /** refresh (個別リセット / 全リセット) */
    reset: 'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    /** file_download (インポート) */
    import: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    /** file_upload (エクスポート) */
    export: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
};

// =====================================================
// CustomCssEditorクラス
// =====================================================

export class CustomCssEditor {
    /**
     * @param {CustomCssManager} manager
     */
    constructor(manager) {
        this._manager = manager;
        this._editBuffer = {};
        this._registry = CustomCssManager.getElementRegistry();
        this._settingsManager = null;
        /** @type {Map<string, string>} 各要素で現在選択中の疑似要素タブ */
        this._pseudoTabs = new Map();
    }

    // ========================================
    // パブリック API
    // ========================================

    init(settingsManager) {
        this._settingsManager = settingsManager;
        this._buildMainArea();
    }

    open() {
        this._editBuffer = this._manager.getCustomStyles();
        this._pseudoTabs.clear();
        this._refreshAllBlocks();
    }

    close() {
        this._editBuffer = {};
    }

    save() {
        this._saveAllTextareasToBuffer();

        for (const [key, data] of Object.entries(this._editBuffer)) {
            this._manager.setElementStyle(key, data.styles || {}, data.pseudo || {});
        }
        this._manager.applyCustomStyles();
    }

    // ========================================
    // UI構築
    // ========================================

    _buildMainArea() {
        const main = document.getElementById('custom-css-editor-mount');
        if (!main) return;
        main.innerHTML = '';
        main.className = 'custom-css-vertical-layout';

        // 各要素ごとのブロックを生成
        for (const element of this._registry) {
            main.appendChild(this._createElementBlock(element));
        }

        // 最下部のグローバルボタンエリア
        main.appendChild(this._createGlobalActions());
    }

    /**
     * 1要素分の設定ブロックを生成
     * @param {Object} elementDef - レジストリから取得した要素定義
     * @returns {HTMLElement}
     */
    _createElementBlock(elementDef) {
        const block = createElement('div', {
            className: 'ccss-block',
            'data-element-key': elementDef.key,
        });

        // ヘッダー（タイトル + リセットボタン）
        const header = createElement('div', { className: 'ccss-block-header' });
        const title = createElement('div', { className: 'ccss-block-title' });
        title.textContent = elementDef.label;
        header.appendChild(title);

        const resetBtn = this._createIconButton(SVG_ICONS.reset, '', 'ccss-reset-btn', () => {
            this._handleResetElement(elementDef.key);
        });
        resetBtn.title = `${elementDef.label} をリセット`;
        header.appendChild(resetBtn);

        block.appendChild(header);

        // 疑似要素タブ（対応する要素のみ）
        if (elementDef.pseudoSupport) {
            const pseudoTabs = createElement('div', {
                className: 'ccss-pseudo-tabs',
                id: `ccss-pseudo-tabs-${elementDef.key}`,
            });
            block.appendChild(pseudoTabs);
        }

        // セレクタ表示
        const selectorDisplay = createElement('div', {
            className: 'ccss-selector-display',
            id: `ccss-selector-${elementDef.key}`,
        });
        block.appendChild(selectorDisplay);

        // コードテキストエリア
        const codeArea = createElement('div', { className: 'ccss-code-area' });
        const textarea = createElement('textarea', {
            className: 'ccss-code-textarea',
            id: `ccss-textarea-${elementDef.key}`,
            spellcheck: 'false',
            rows: '4',
        });
        textarea.placeholder = 'font-size: 2em;\ncolor: #333;';
        textarea.addEventListener('input', () => this._handleCodeInput(elementDef.key));

        const errorDisplay = createElement('div', {
            className: 'ccss-code-errors',
            id: `ccss-errors-${elementDef.key}`,
        });
        codeArea.appendChild(textarea);
        codeArea.appendChild(errorDisplay);
        block.appendChild(codeArea);

        // プレビュー
        const preview = createElement('div', {
            className: 'ccss-preview',
            id: `ccss-preview-${elementDef.key}`,
        });
        block.appendChild(preview);

        return block;
    }

    /**
     * グローバル操作ボタン群を生成
     * @returns {HTMLElement}
     */
    _createGlobalActions() {
        const section = createElement('div', { className: 'ccss-global-actions' });

        section.appendChild(this._createIconButton(
            SVG_ICONS.reset, '全要素リセット', 'ccss-action-btn ccss-action-danger',
            () => this._handleResetAll()
        ));
        section.appendChild(this._createIconButton(
            SVG_ICONS.import, 'インポート', 'ccss-action-btn',
            () => this._handleImport()
        ));
        section.appendChild(this._createIconButton(
            SVG_ICONS.export, 'エクスポート', 'ccss-action-btn',
            () => this._handleExport()
        ));

        return section;
    }

    /**
     * SVGアイコン付きボタンを生成
     * @param {string} svgPath - SVG pathのd属性
     * @param {string} label - ボタンテキスト（空文字の場合はアイコンのみ）
     * @param {string} className - CSSクラス
     * @param {Function} onClick - クリックハンドラ
     * @returns {HTMLButtonElement}
     */
    _createIconButton(svgPath, label, className, onClick) {
        const btn = createElement('button', { className });
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="${svgPath}" fill="currentColor"/></svg>`;
        if (label) {
            const span = createElement('span');
            span.textContent = label;
            btn.appendChild(span);
        }
        btn.addEventListener('click', onClick);
        return btn;
    }

    // ========================================
    // イベント処理
    // ========================================

    _handleCodeInput(key) {
        const textarea = document.getElementById(`ccss-textarea-${key}`);
        const errorDisplay = document.getElementById(`ccss-errors-${key}`);
        if (!textarea || !errorDisplay) return;

        const text = textarea.value;
        const elementDef = this._registry.find(e => e.key === key);
        if (!elementDef) return;

        // バリデーション
        const fullCss = `${elementDef.selector} { ${text} }`;
        const result = CssSanitizer.validate(fullCss);
        if (result.valid) {
            errorDisplay.textContent = '';
            errorDisplay.classList.remove('has-errors');
        } else {
            errorDisplay.innerHTML = result.errors
                .map(e => `<div class="ccss-error-item">⚠ ${e}</div>`)
                .join('');
            errorDisplay.classList.add('has-errors');
        }

        // プレビュー更新
        this._updatePreviewFromText(key, text);
    }

    _handleResetElement(key) {
        delete this._editBuffer[key];
        this._pseudoTabs.set(key, '');
        this._refreshBlock(key);
    }

    _handleResetAll() {
        if (!confirm('すべてのカスタムCSS設定をリセットしますか？')) return;
        this._editBuffer = {};
        this._pseudoTabs.clear();
        this._refreshAllBlocks();
    }

    _handleExport() {
        this._saveAllTextareasToBuffer();
        const tempManager = new CustomCssManager();
        tempManager.setCustomStyles(this._editBuffer);
        const json = tempManager.exportToJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `custom-css-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    _handleImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const tempManager = new CustomCssManager();
                const result = tempManager.importFromJson(ev.target.result);
                if (result.success) {
                    this._editBuffer = tempManager.getCustomStyles();
                    this._refreshAllBlocks();
                } else {
                    alert(result.message);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    _selectPseudoTab(key, pseudoSelector) {
        this._saveTextareaToBuffer(key);
        this._pseudoTabs.set(key, pseudoSelector);
        this._refreshBlock(key);
    }

    // ========================================
    // UI更新
    // ========================================

    _refreshAllBlocks() {
        for (const element of this._registry) {
            this._refreshBlock(element.key);
        }
    }

    _refreshBlock(key) {
        const elementDef = this._registry.find(e => e.key === key);
        if (!elementDef) return;

        this._renderPseudoTabs(key, elementDef);
        this._updateSelectorDisplay(key, elementDef);
        this._populateTextarea(key, elementDef);
        this._updatePreview(key, elementDef);
    }

    _renderPseudoTabs(key, elementDef) {
        const container = document.getElementById(`ccss-pseudo-tabs-${key}`);
        if (!container) return;
        container.innerHTML = '';

        if (!elementDef.pseudoSupport) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');

        const currentTab = this._pseudoTabs.get(key) || '';

        const normalTab = createElement('button', {
            className: `ccss-pseudo-tab ${currentTab === '' ? 'active' : ''}`,
        });
        normalTab.textContent = '通常';
        normalTab.addEventListener('click', () => this._selectPseudoTab(key, ''));
        container.appendChild(normalTab);

        for (const ps of PSEUDO_SELECTORS) {
            const tab = createElement('button', {
                className: `ccss-pseudo-tab ${currentTab === ps ? 'active' : ''}`,
            });
            tab.textContent = ps;
            tab.addEventListener('click', () => this._selectPseudoTab(key, ps));
            container.appendChild(tab);
        }
    }

    _updateSelectorDisplay(key, elementDef) {
        const display = document.getElementById(`ccss-selector-${key}`);
        if (!display) return;
        const pseudo = this._pseudoTabs.get(key) || '';
        display.textContent = `${elementDef.selector}${pseudo} { ... }`;
    }

    _populateTextarea(key, elementDef) {
        const textarea = document.getElementById(`ccss-textarea-${key}`);
        if (!textarea) return;

        const pseudo = this._pseudoTabs.get(key) || '';
        let styles;
        if (pseudo) {
            styles = this._editBuffer[key]?.pseudo?.[pseudo] || {};
        } else {
            const custom = this._editBuffer[key]?.styles;
            styles = (custom && Object.keys(custom).length > 0)
                ? { ...custom }
                : { ...(elementDef.defaults || {}) };
        }
        textarea.value = this._formatDeclarations(styles);
    }

    _updatePreview(key, elementDef) {
        const area = document.getElementById(`ccss-preview-${key}`);
        if (!area) return;
        area.innerHTML = `<style>${this._generatePreviewCss(elementDef)}</style>${this._generateSampleHtml(elementDef)}`;
    }

    _updatePreviewFromText(key, text) {
        const area = document.getElementById(`ccss-preview-${key}`);
        if (!area) return;
        const def = this._registry.find(e => e.key === key);
        if (!def) return;

        const styles = this._parseDeclarations(text);
        const pseudo = this._pseudoTabs.get(key) || '';
        const sel = `#ccss-preview-content-${key} ${def.key === 'box' ? '.box-container' : def.key}`;
        const decls = Object.entries(styles)
            .filter(([, v]) => v)
            .map(([k, v]) => k === 'font-family' ? `  ${k}: ${CustomCssManager.applyFontFallback(v)};` : `  ${k}: ${v};`)
            .join('\n');
        const css = decls ? `${sel}${pseudo} {\n${decls}\n}` : '';
        area.innerHTML = `<style>${css}</style>${this._generateSampleHtml(def)}`;
    }

    // ========================================
    // テキストエリア ⇔ バッファ変換
    // ========================================

    _saveAllTextareasToBuffer() {
        for (const element of this._registry) {
            this._saveTextareaToBuffer(element.key);
        }
    }

    _saveTextareaToBuffer(key) {
        const textarea = document.getElementById(`ccss-textarea-${key}`);
        if (!textarea) return;

        const styles = this._parseDeclarations(textarea.value);
        const pseudo = this._pseudoTabs.get(key) || '';

        if (!this._editBuffer[key]) {
            this._editBuffer[key] = { styles: {}, pseudo: {} };
        }
        if (pseudo) {
            if (!this._editBuffer[key].pseudo) this._editBuffer[key].pseudo = {};
            this._editBuffer[key].pseudo[pseudo] = styles;
        } else {
            this._editBuffer[key].styles = styles;
        }
    }

    _parseDeclarations(text) {
        if (!text || !text.trim()) return {};
        const styles = {};
        const parts = text.split(/[;\n]/).filter(p => p.trim());
        for (const part of parts) {
            const idx = part.indexOf(':');
            if (idx === -1) continue;
            const prop = part.substring(0, idx).trim().toLowerCase();
            const value = part.substring(idx + 1).trim().replace(/;$/, '').trim();
            if (prop && value) styles[prop] = value;
        }
        return styles;
    }

    _formatDeclarations(styles) {
        if (!styles || Object.keys(styles).length === 0) return '';
        return Object.entries(styles)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v};`)
            .join('\n');
    }

    // ========================================
    // プレビュー生成
    // ========================================

    _generatePreviewCss(def) {
        const data = this._editBuffer[def.key];
        const sel = `#ccss-preview-content-${def.key} ${def.key === 'box' ? '.box-container' : def.key}`;
        const rules = [];

        const styles = data?.styles && Object.keys(data.styles).length > 0
            ? data.styles
            : (def.defaults || {});

        if (Object.keys(styles).length > 0) {
            const decls = Object.entries(styles)
                .filter(([, v]) => v)
                .map(([k, v]) => k === 'font-family' ? `  ${k}: ${CustomCssManager.applyFontFallback(v)};` : `  ${k}: ${v};`)
                .join('\n');
            if (decls) rules.push(`${sel} {\n${decls}\n}`);
        }

        if (data?.pseudo) {
            for (const [ps, psStyles] of Object.entries(data.pseudo)) {
                const decls = Object.entries(psStyles)
                    .filter(([, v]) => v)
                    .map(([k, v]) => `  ${k}: ${v};`)
                    .join('\n');
                if (decls) rules.push(`${sel}${ps} {\n${decls}\n}`);
            }
        }
        return rules.join('\n');
    }

    _generateSampleHtml(def) {
        const id = `ccss-preview-content-${def.key}`;
        const samples = {
            h1: `<h1>見出し 1 のサンプル</h1>`,
            h2: `<h2>見出し 2 のサンプル</h2>`,
            h3: `<h3>見出し 3 のサンプル</h3>`,
            h4: `<h4>見出し 4 のサンプル</h4>`,
            p: `<p>テキストのサンプルです。プレビュー用のテキストです。</p>`,
            ul: `<ul><li>箇条書き項目 1</li><li>箇条書き項目 2</li><li>箇条書き項目 3</li></ul>`,
            ol: `<ol><li>番号付き項目 1</li><li>番号付き項目 2</li><li>番号付き項目 3</li></ol>`,
            blockquote: `<blockquote>引用文のサンプルです。</blockquote>`,
            pre: `<pre>// コードブロック\nconst hello = "world";</pre>`,
            hr: `<p>上のテキスト</p><hr><p>下のテキスト</p>`,
            box: `<div class="box-container"><div class="box-title">ボックスタイトル</div><div class="box-body"><p>ボックス内のテキスト</p></div></div>`,
        };
        return `<div id="${id}">${samples[def.key] || '<p>サンプル</p>'}</div>`;
    }
}
