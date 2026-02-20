/**
 * カスタムCSSエディタUI
 * 
 * コードのみのシンプルなインターフェース:
 * - 左サイドバーで要素を選択
 * - 疑似要素はGUIタブで切替
 * - テキストエリアに {} 内のCSS宣言を直接入力
 * - 現在適用中のCSS（デフォルト値）が初期表示
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

const MODAL_ID = 'custom-css-modal';
const PSEUDO_SELECTORS = ['::before', '::after'];

// =====================================================
// CustomCssEditorクラス
// =====================================================

export class CustomCssEditor {
    /**
     * @param {CustomCssManager} manager
     */
    constructor(manager) {
        this._manager = manager;
        this._selectedElementKey = 'h1';
        this._selectedPseudoTab = '';
        this._editBuffer = {};
        this._modalElement = null;
        this._isOpen = false;
        this._registry = CustomCssManager.getElementRegistry();
    }

    // ========================================
    // パブリック API
    // ========================================

    init() {
        this._modalElement = document.getElementById(MODAL_ID);
        if (!this._modalElement) {
            console.warn(`カスタムCSSモーダル要素 (#${MODAL_ID}) が見つかりません`);
            return;
        }
        this._buildModalContent();
        this._setupEventListeners();
    }

    open() {
        if (!this._modalElement) return;
        this._editBuffer = this._manager.getCustomStyles();
        this._selectedElementKey = 'h1';
        this._selectedPseudoTab = '';
        this._modalElement.classList.remove('hidden');
        this._isOpen = true;
        this._refreshUI();
    }

    close() {
        if (!this._modalElement) return;
        this._modalElement.classList.add('hidden');
        this._isOpen = false;
    }

    isOpen() {
        return this._isOpen;
    }

    // ========================================
    // UI構築
    // ========================================

    _buildModalContent() {
        this._modalElement.innerHTML = '';
        this._modalElement.className = 'custom-css-modal hidden';

        const overlay = createElement('div', { className: 'custom-css-overlay' });
        overlay.addEventListener('click', () => this.close());

        const container = createElement('div', { className: 'custom-css-container' });
        container.appendChild(this._buildHeader());

        const body = createElement('div', { className: 'custom-css-body' });
        body.appendChild(this._buildSidebar());
        body.appendChild(this._buildMainArea());
        container.appendChild(body);
        container.appendChild(this._buildFooter());

        this._modalElement.appendChild(overlay);
        this._modalElement.appendChild(container);
    }

    _buildHeader() {
        const header = createElement('div', { className: 'custom-css-header' });

        const title = createElement('h2', { className: 'custom-css-title' });
        title.textContent = 'カスタムCSS設定';

        const closeBtn = createElement('button', { className: 'custom-css-close-btn' });
        closeBtn.innerHTML = '&times;';
        closeBtn.title = '閉じる';
        closeBtn.addEventListener('click', () => this.close());

        header.appendChild(title);
        header.appendChild(closeBtn);
        return header;
    }

    _buildSidebar() {
        const sidebar = createElement('div', { className: 'custom-css-sidebar' });

        const label = createElement('div', { className: 'custom-css-sidebar-label' });
        label.textContent = '対象要素';
        sidebar.appendChild(label);

        const list = createElement('div', { className: 'custom-css-element-list' });
        for (const element of this._registry) {
            const item = createElement('button', {
                className: 'custom-css-element-item',
                'data-key': element.key,
            });
            item.textContent = element.label;
            if (element.key === this._selectedElementKey) item.classList.add('active');
            item.addEventListener('click', () => this._selectElement(element.key));
            list.appendChild(item);
        }
        sidebar.appendChild(list);

        // JSON I/O
        const ioSection = createElement('div', { className: 'custom-css-io-section' });
        const exportBtn = createElement('button', { className: 'custom-css-io-btn' });
        exportBtn.textContent = '📤 エクスポート';
        exportBtn.addEventListener('click', () => this._handleExport());
        const importBtn = createElement('button', { className: 'custom-css-io-btn' });
        importBtn.textContent = '📥 インポート';
        importBtn.addEventListener('click', () => this._handleImport());
        ioSection.appendChild(exportBtn);
        ioSection.appendChild(importBtn);
        sidebar.appendChild(ioSection);

        return sidebar;
    }

    _buildMainArea() {
        const main = createElement('div', { className: 'custom-css-main' });

        // 疑似要素タブ
        const pseudoTabs = createElement('div', {
            className: 'custom-css-pseudo-tabs-container',
            id: 'custom-css-pseudo-tabs-container',
        });
        main.appendChild(pseudoTabs);

        // セレクタ表示
        const selectorDisplay = createElement('div', {
            className: 'custom-css-selector-display',
            id: 'custom-css-selector-display',
        });
        main.appendChild(selectorDisplay);

        // コードテキストエリア
        const codeArea = createElement('div', { className: 'custom-css-code-area' });
        const textarea = createElement('textarea', {
            className: 'custom-css-code-textarea',
            id: 'custom-css-code-textarea',
            spellcheck: 'false',
        });
        textarea.placeholder = 'CSSプロパティを入力\n例:\nfont-size: 2em;\ncolor: #333;\nmargin-top: 1em;';
        textarea.addEventListener('input', () => this._handleCodeInput());

        const errorDisplay = createElement('div', {
            className: 'custom-css-code-errors',
            id: 'custom-css-code-errors',
        });
        codeArea.appendChild(textarea);
        codeArea.appendChild(errorDisplay);
        main.appendChild(codeArea);

        // WCAGインジケーター
        main.appendChild(createElement('div', {
            className: 'custom-css-wcag-indicator',
            id: 'custom-css-wcag-indicator',
        }));

        // プレビュー
        const previewSection = createElement('div', { className: 'custom-css-preview-section' });
        const previewLabel = createElement('div', { className: 'custom-css-preview-label' });
        previewLabel.textContent = 'プレビュー';
        const previewArea = createElement('div', {
            className: 'custom-css-preview',
            id: 'custom-css-preview',
        });
        previewSection.appendChild(previewLabel);
        previewSection.appendChild(previewArea);
        main.appendChild(previewSection);

        return main;
    }

    _buildFooter() {
        const footer = createElement('div', { className: 'custom-css-footer' });

        const left = createElement('div', { className: 'custom-css-footer-left' });
        const resetBtn = createElement('button', { className: 'custom-css-btn custom-css-btn-secondary' });
        resetBtn.textContent = 'この要素をリセット';
        resetBtn.addEventListener('click', () => this._handleResetElement());
        const resetAllBtn = createElement('button', { className: 'custom-css-btn custom-css-btn-danger' });
        resetAllBtn.textContent = 'すべてリセット';
        resetAllBtn.addEventListener('click', () => this._handleResetAll());
        left.appendChild(resetBtn);
        left.appendChild(resetAllBtn);

        const right = createElement('div', { className: 'custom-css-footer-right' });
        const cancelBtn = createElement('button', { className: 'custom-css-btn custom-css-btn-secondary' });
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.addEventListener('click', () => this.close());
        const applyBtn = createElement('button', { className: 'custom-css-btn custom-css-btn-primary' });
        applyBtn.textContent = '適用';
        applyBtn.addEventListener('click', () => this._handleApply());
        right.appendChild(cancelBtn);
        right.appendChild(applyBtn);

        footer.appendChild(left);
        footer.appendChild(right);
        return footer;
    }

    // ========================================
    // イベント処理
    // ========================================

    _setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._isOpen) this.close();
        });
    }

    _selectElement(key) {
        this._saveTextareaToBuffer();
        this._selectedElementKey = key;
        this._selectedPseudoTab = '';
        this._refreshUI();
    }

    _selectPseudoTab(tab) {
        this._saveTextareaToBuffer();
        this._selectedPseudoTab = tab;
        this._refreshUI();
    }

    _handleCodeInput() {
        const textarea = document.getElementById('custom-css-code-textarea');
        const errorDisplay = document.getElementById('custom-css-code-errors');
        if (!textarea || !errorDisplay) return;

        const text = textarea.value;
        const elementDef = this._registry.find(e => e.key === this._selectedElementKey);
        if (!elementDef) return;

        // バリデーション（セレクタで包んで検証）
        const fullCss = `${elementDef.selector} { ${text} }`;
        const result = CssSanitizer.validate(fullCss);
        if (result.valid) {
            errorDisplay.textContent = '';
            errorDisplay.classList.remove('has-errors');
        } else {
            errorDisplay.innerHTML = result.errors
                .map(e => `<div class="custom-css-error-item">⚠ ${e}</div>`)
                .join('');
            errorDisplay.classList.add('has-errors');
        }

        // ライブプレビュー・WCAG更新
        this._updatePreviewFromText(text);
        this._updateWcagFromText(text);
    }

    _handleApply() {
        this._saveTextareaToBuffer();

        for (const [key, data] of Object.entries(this._editBuffer)) {
            this._manager.setElementStyle(key, data.styles || {}, data.pseudo || {});
        }
        this._manager.applyCustomStyles();
        this._manager.saveToStorage();
        this.close();
    }

    _handleResetElement() {
        delete this._editBuffer[this._selectedElementKey];
        this._refreshUI();
    }

    _handleResetAll() {
        if (!confirm('すべてのカスタムCSS設定をリセットしますか？')) return;
        this._editBuffer = {};
        this._refreshUI();
    }

    _handleExport() {
        this._saveTextareaToBuffer();
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
                    this._refreshUI();
                } else {
                    alert(result.message);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    // ========================================
    // UI更新
    // ========================================

    _refreshUI() {
        this._updateSidebarActive();
        this._renderPseudoTabs();
        this._updateSelectorDisplay();
        this._populateTextarea();
        this._updatePreview();
        this._updateWcagIndicator();
    }

    _updateSidebarActive() {
        const items = this._modalElement?.querySelectorAll('.custom-css-element-item');
        if (!items) return;
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.key === this._selectedElementKey);
        });
    }

    _renderPseudoTabs() {
        const container = document.getElementById('custom-css-pseudo-tabs-container');
        if (!container) return;
        container.innerHTML = '';

        const elementDef = this._registry.find(e => e.key === this._selectedElementKey);
        if (!elementDef || !elementDef.pseudoSupport) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');

        const normalTab = createElement('button', {
            className: `custom-css-pseudo-tab ${this._selectedPseudoTab === '' ? 'active' : ''}`,
        });
        normalTab.textContent = '通常';
        normalTab.addEventListener('click', () => this._selectPseudoTab(''));
        container.appendChild(normalTab);

        for (const ps of PSEUDO_SELECTORS) {
            const tab = createElement('button', {
                className: `custom-css-pseudo-tab ${this._selectedPseudoTab === ps ? 'active' : ''}`,
            });
            tab.textContent = ps;
            tab.addEventListener('click', () => this._selectPseudoTab(ps));
            container.appendChild(tab);
        }
    }

    _updateSelectorDisplay() {
        const display = document.getElementById('custom-css-selector-display');
        if (!display) return;
        const elementDef = this._registry.find(e => e.key === this._selectedElementKey);
        if (!elementDef) return;
        display.textContent = `${elementDef.selector}${this._selectedPseudoTab} { ... }`;
    }

    /**
     * テキストエリアに現在のCSS宣言を表示
     * カスタムCSSがあればそれを、なければデフォルト値を表示
     */
    _populateTextarea() {
        const textarea = document.getElementById('custom-css-code-textarea');
        if (!textarea) return;

        const key = this._selectedElementKey;
        const elementDef = this._registry.find(e => e.key === key);
        if (!elementDef) return;

        let styles;
        if (this._selectedPseudoTab) {
            styles = this._editBuffer[key]?.pseudo?.[this._selectedPseudoTab] || {};
        } else {
            const custom = this._editBuffer[key]?.styles;
            styles = (custom && Object.keys(custom).length > 0)
                ? { ...custom }
                : { ...(elementDef.defaults || {}) };
        }
        textarea.value = this._formatDeclarations(styles);
    }

    // ========================================
    // テキストエリア ⇔ バッファ変換
    // ========================================

    _saveTextareaToBuffer() {
        const textarea = document.getElementById('custom-css-code-textarea');
        if (!textarea) return;

        const styles = this._parseDeclarations(textarea.value);
        const key = this._selectedElementKey;

        if (!this._editBuffer[key]) {
            this._editBuffer[key] = { styles: {}, pseudo: {} };
        }
        if (this._selectedPseudoTab) {
            if (!this._editBuffer[key].pseudo) this._editBuffer[key].pseudo = {};
            this._editBuffer[key].pseudo[this._selectedPseudoTab] = styles;
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
    // プレビュー
    // ========================================

    _updatePreview() {
        const area = document.getElementById('custom-css-preview');
        if (!area) return;
        const def = this._registry.find(e => e.key === this._selectedElementKey);
        if (!def) return;
        area.innerHTML = `<style>${this._generatePreviewCss(def)}</style>${this._generateSampleHtml(def)}`;
    }

    _updatePreviewFromText(text) {
        const area = document.getElementById('custom-css-preview');
        if (!area) return;
        const def = this._registry.find(e => e.key === this._selectedElementKey);
        if (!def) return;

        const styles = this._parseDeclarations(text);
        const sel = `#custom-css-preview-content ${def.key === 'box' ? '.box-container' : def.key}`;
        const decls = Object.entries(styles)
            .filter(([, v]) => v)
            .map(([k, v]) => k === 'font-family' ? `  ${k}: ${CustomCssManager.applyFontFallback(v)};` : `  ${k}: ${v};`)
            .join('\n');
        const css = decls ? `${sel}${this._selectedPseudoTab} {\n${decls}\n}` : '';
        area.innerHTML = `<style>${css}</style>${this._generateSampleHtml(def)}`;
    }

    _generatePreviewCss(def) {
        const data = this._editBuffer[def.key];
        const sel = `#custom-css-preview-content ${def.key === 'box' ? '.box-container' : def.key}`;
        const rules = [];

        // 通常スタイル（カスタムがあればカスタム、なければデフォルト）
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

        // 疑似要素
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
        const id = 'custom-css-preview-content';
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

    // ========================================
    // WCAGチェック
    // ========================================

    _updateWcagIndicator() {
        const el = document.getElementById('custom-css-wcag-indicator');
        if (!el) return;
        if (this._selectedPseudoTab) { el.innerHTML = ''; return; }

        const textarea = document.getElementById('custom-css-code-textarea');
        if (!textarea) return;
        this._renderWcag(el, this._parseDeclarations(textarea.value));
    }

    _updateWcagFromText(text) {
        const el = document.getElementById('custom-css-wcag-indicator');
        if (!el || this._selectedPseudoTab) return;
        this._renderWcag(el, this._parseDeclarations(text));
    }

    _renderWcag(container, styles) {
        const fg = styles['color'];
        const bg = styles['background-color'];
        if (!fg && !bg) { container.innerHTML = ''; return; }

        const fgColor = fg || '#000000';
        const bgColor = bg || '#ffffff';
        const ratio = WcagChecker.getContrastRatio(fgColor, bgColor);
        const fontSize = styles['font-size'];
        const fontWeight = styles['font-weight'];
        const isLargeText = fontSize ? WcagChecker._isLargeText(fontSize, fontWeight) : false;
        const level = WcagChecker.checkLevel(ratio, isLargeText);
        const label = WcagChecker.getLabel(ratio, isLargeText);

        container.innerHTML = `
            <div class="custom-css-wcag-title">コントラストチェック</div>
            <div class="custom-css-wcag-swatch">
                <span class="custom-css-wcag-sample" style="color: ${fgColor}; background-color: ${bgColor};">
                    サンプルテキスト Aa
                </span>
            </div>
            <div class="custom-css-wcag-result ${level.aaa ? 'aaa' : level.aa ? 'aa' : 'fail'}">
                ${label}
            </div>
        `;
    }
}
