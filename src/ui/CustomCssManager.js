/**
 * カスタムCSS管理マネージャー
 * 
 * ユーザー定義のカスタムCSSデータを管理・適用する。
 * 要素レジストリ駆動で、新規要素の追加が容易な拡張性の高い設計。
 * 
 * @module ui/CustomCssManager
 */

import { CssSanitizer } from '../utils/CssSanitizer.js';
import { deepClone } from '../utils/helpers.js';

// =====================================================
// 要素レジストリ（拡張ポイント）
// =====================================================

/**
 * カスタマイズ対象要素の定義レジストリ
 * 新規要素を追加する場合はここにエントリを追加するだけで全機能に反映
 * 
 * @type {Array<{
 *   key: string,
 *   label: string,
 *   selector: string,
 *   pseudoSupport: boolean,
 *   properties: string[],
 *   defaults: Object
 * }>}
 */
const ELEMENT_REGISTRY = [
    {
        key: 'h1',
        label: '見出し 1',
        selector: '#editor h1',
        pseudoSupport: true,
        properties: [
            'font-size', 'font-family', 'font-weight', 'font-style',
            'color', 'background-color',
            'margin-top', 'margin-bottom',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border', 'border-bottom', 'border-radius',
            'text-align', 'text-decoration', 'text-transform',
            'letter-spacing', 'line-height',
        ],
        defaults: {
            'font-size': '2.25em',
            'margin-top': '2em',
            'margin-bottom': '0.6em',
            'border-bottom': '1px solid color-mix(in srgb, var(--text-color) 15%, transparent)',
        },
    },
    {
        key: 'h2',
        label: '見出し 2',
        selector: '#editor h2',
        pseudoSupport: true,
        properties: [
            'font-size', 'font-family', 'font-weight', 'font-style',
            'color', 'background-color',
            'margin-top', 'margin-bottom',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border', 'border-bottom', 'border-radius',
            'text-align', 'text-decoration', 'text-transform',
            'letter-spacing', 'line-height',
        ],
        defaults: {
            'font-size': '1.75em',
            'margin-top': '1.4em',
            'margin-bottom': '0.6em',
        },
    },
    {
        key: 'h3',
        label: '見出し 3',
        selector: '#editor h3',
        pseudoSupport: true,
        properties: [
            'font-size', 'font-family', 'font-weight', 'font-style',
            'color', 'background-color',
            'margin-top', 'margin-bottom',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border', 'border-bottom', 'border-radius',
            'text-align', 'text-decoration', 'text-transform',
            'letter-spacing', 'line-height',
        ],
        defaults: {
            'font-size': '1.5em',
            'margin-top': '1.25em',
            'margin-bottom': '0.5em',
        },
    },
    {
        key: 'h4',
        label: '見出し 4',
        selector: '#editor h4',
        pseudoSupport: true,
        properties: [
            'font-size', 'font-family', 'font-weight', 'font-style',
            'color', 'background-color',
            'margin-top', 'margin-bottom',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border', 'border-bottom', 'border-radius',
            'text-align', 'text-decoration', 'text-transform',
            'letter-spacing', 'line-height',
        ],
        defaults: {
            'font-size': '1.25em',
            'margin-top': '1em',
            'margin-bottom': '0.4em',
        },
    },
    {
        key: 'p',
        label: 'テキスト',
        selector: '#editor p',
        pseudoSupport: false,
        properties: [
            'font-size', 'font-family', 'font-weight', 'font-style',
            'color', 'background-color',
            'margin-top', 'margin-bottom',
            'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'text-align', 'text-indent',
            'letter-spacing', 'line-height',
        ],
        defaults: {
            'margin-top': '0.4em',
            'margin-bottom': '0.4em',
        },
    },
    {
        key: 'ul',
        label: '箇条書きリスト',
        selector: '#editor ul',
        pseudoSupport: false,
        properties: [
            'font-size', 'color',
            'margin-top', 'margin-bottom',
            'padding-left',
            'list-style-type', 'list-style-position',
            'line-height',
        ],
        defaults: {
            'padding-left': '2em',
        },
    },
    {
        key: 'ol',
        label: '番号付きリスト',
        selector: '#editor ol',
        pseudoSupport: false,
        properties: [
            'font-size', 'color',
            'margin-top', 'margin-bottom',
            'padding-left',
            'list-style-type', 'list-style-position',
            'line-height',
        ],
        defaults: {
            'padding-left': '2em',
        },
    },
    {
        key: 'blockquote',
        label: '引用',
        selector: '#editor blockquote',
        pseudoSupport: true,
        properties: [
            'font-size', 'font-family', 'font-style', 'color', 'background-color',
            'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
            'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'border', 'border-left', 'border-radius',
            'line-height',
        ],
        defaults: {
            'margin': '0.6em 1em',
            'padding': '0em 1em',
            'border-left': '2px solid var(--primary-color)',
        },
    },
    {
        key: 'pre',
        label: 'コードブロック',
        selector: '#editor pre',
        pseudoSupport: false,
        properties: [
            'font-size', 'font-family', 'color', 'background-color',
            'margin-top', 'margin-bottom',
            'padding',
            'border', 'border-radius',
            'line-height',
        ],
        defaults: {
            'background-color': 'rgba(200, 200, 200, 0.2)',
            'padding': '1em',
            'border-radius': '4px',
        },
    },
    {
        key: 'hr',
        label: '水平線',
        selector: '#editor hr',
        pseudoSupport: false,
        properties: [
            'border', 'border-style', 'border-color', 'border-width',
            'margin-top', 'margin-bottom',
            'height', 'background-color',
        ],
        defaults: {
            'border-style': 'dashed',
        },
    },
    {
        key: 'box',
        label: 'ボックス',
        selector: '.box-container',
        pseudoSupport: false,
        properties: [
            'border', 'border-color', 'border-width', 'border-style', 'border-radius',
            'margin-top', 'margin-bottom',
            'padding',
            'background-color',
        ],
        defaults: {
            'border': '2px solid #cbd5e1',
            'border-radius': '8px',
            'margin': '2em 0',
            'padding': '12px 0 6px 0',
        },
    },
];

/**
 * プロパティ定義マップ
 * GUIフォーム生成時に使用する各プロパティの型・ラベル情報
 */
const PROPERTY_DEFINITIONS = {
    // テキスト関連
    'font-size': { type: 'text', label: 'フォントサイズ', placeholder: '例: 2em, 16px' },
    'font-family': { type: 'text', label: 'フォント', placeholder: '例: serif, sans-serif' },
    'font-weight': {
        type: 'select', label: 'フォント太さ',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'normal', label: '通常 (400)' },
            { value: 'bold', label: '太字 (700)' },
            { value: '100', label: '100' },
            { value: '200', label: '200' },
            { value: '300', label: '300' },
            { value: '500', label: '500' },
            { value: '600', label: '600' },
            { value: '800', label: '800' },
            { value: '900', label: '900' },
        ]
    },
    'font-style': {
        type: 'select', label: 'フォントスタイル',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'normal', label: '通常' },
            { value: 'italic', label: 'イタリック' },
        ]
    },
    'color': { type: 'color', label: '文字色' },
    'background-color': { type: 'color', label: '背景色' },
    'text-align': {
        type: 'select', label: 'テキスト配置',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'left', label: '左揃え' },
            { value: 'center', label: '中央揃え' },
            { value: 'right', label: '右揃え' },
            { value: 'justify', label: '両端揃え' },
        ]
    },
    'text-decoration': { type: 'text', label: 'テキスト装飾', placeholder: '例: underline, none' },
    'text-transform': {
        type: 'select', label: 'テキスト変換',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'none', label: 'なし' },
            { value: 'uppercase', label: '大文字' },
            { value: 'lowercase', label: '小文字' },
            { value: 'capitalize', label: '先頭大文字' },
        ]
    },
    'text-indent': { type: 'text', label: 'テキストインデント', placeholder: '例: 1em' },
    'letter-spacing': { type: 'text', label: '文字間隔', placeholder: '例: 0.05em' },
    'word-spacing': { type: 'text', label: '単語間隔', placeholder: '例: 0.1em' },
    'line-height': { type: 'text', label: '行の高さ', placeholder: '例: 1.6, 24px' },
    // ボックスモデル
    'margin': { type: 'text', label: 'マージン', placeholder: '例: 1em 0' },
    'margin-top': { type: 'text', label: '上マージン', placeholder: '例: 2em' },
    'margin-bottom': { type: 'text', label: '下マージン', placeholder: '例: 0.6em' },
    'margin-left': { type: 'text', label: '左マージン', placeholder: '例: 1em' },
    'margin-right': { type: 'text', label: '右マージン', placeholder: '例: 1em' },
    'padding': { type: 'text', label: 'パディング', placeholder: '例: 0.5em 1em' },
    'padding-top': { type: 'text', label: '上パディング', placeholder: '例: 0.5em' },
    'padding-bottom': { type: 'text', label: '下パディング', placeholder: '例: 0.5em' },
    'padding-left': { type: 'text', label: '左パディング', placeholder: '例: 1em' },
    'padding-right': { type: 'text', label: '右パディング', placeholder: '例: 1em' },
    // ボーダー
    'border': { type: 'text', label: 'ボーダー', placeholder: '例: 1px solid #ccc' },
    'border-top': { type: 'text', label: '上ボーダー', placeholder: '例: 1px solid #ccc' },
    'border-bottom': { type: 'text', label: '下ボーダー', placeholder: '例: 1px solid #ccc' },
    'border-left': { type: 'text', label: '左ボーダー', placeholder: '例: 2px solid blue' },
    'border-right': { type: 'text', label: '右ボーダー', placeholder: '例: 1px solid #ccc' },
    'border-style': {
        type: 'select', label: 'ボーダースタイル',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'solid', label: '実線' },
            { value: 'dashed', label: '破線' },
            { value: 'dotted', label: '点線' },
            { value: 'double', label: '二重線' },
            { value: 'none', label: 'なし' },
        ]
    },
    'border-color': { type: 'color', label: 'ボーダー色' },
    'border-width': { type: 'text', label: 'ボーダー幅', placeholder: '例: 2px' },
    'border-radius': { type: 'text', label: '角丸', placeholder: '例: 8px' },
    // リスト
    'list-style-type': {
        type: 'select', label: 'リストマーカー',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'disc', label: '●' },
            { value: 'circle', label: '○' },
            { value: 'square', label: '■' },
            { value: 'decimal', label: '1, 2, 3...' },
            { value: 'lower-alpha', label: 'a, b, c...' },
            { value: 'upper-alpha', label: 'A, B, C...' },
            { value: 'lower-roman', label: 'i, ii, iii...' },
            { value: 'upper-roman', label: 'I, II, III...' },
            { value: 'none', label: 'なし' },
        ]
    },
    'list-style-position': {
        type: 'select', label: 'マーカー位置',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'inside', label: '内側' },
            { value: 'outside', label: '外側' },
        ]
    },
    // その他
    'height': { type: 'text', label: '高さ', placeholder: '例: 2px' },
    'width': { type: 'text', label: '幅', placeholder: '例: 100%' },
    'max-width': { type: 'text', label: '最大幅', placeholder: '例: 800px' },
    'min-width': { type: 'text', label: '最小幅', placeholder: '例: 200px' },
    // 疑似要素用
    'content': { type: 'text', label: 'コンテンツ', placeholder: '例: "★ "' },
    'display': {
        type: 'select', label: '表示',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'inline', label: 'インライン' },
            { value: 'block', label: 'ブロック' },
            { value: 'inline-block', label: 'インラインブロック' },
            { value: 'none', label: '非表示' },
        ]
    },
    'opacity': { type: 'text', label: '不透明度', placeholder: '例: 0.5' },
    'visibility': {
        type: 'select', label: '可視性',
        options: [
            { value: '', label: '（デフォルト）' },
            { value: 'visible', label: '表示' },
            { value: 'hidden', label: '非表示' },
        ]
    },
};

/**
 * 疑似要素で使用するプロパティ
 */
const PSEUDO_PROPERTIES = [
    'content', 'display', 'color', 'background-color',
    'font-size', 'font-weight', 'font-style',
    'margin-right', 'margin-left', 'padding',
    'opacity',
];

/**
 * 日本語フォントフォールバックチェーン
 */
const FONT_FALLBACK_CHAIN = [
    '"Hiragino Kaku Gothic ProN"',
    '"Hiragino Sans"',
    '"Noto Sans JP"',
    '"Yu Gothic"',
    '"Meiryo"',
    'sans-serif',
];

/** カスタムスタイル用<style>タグのID */
const STYLE_ELEMENT_ID = 'custom-css-styles';

/** localStorageキー */
const STORAGE_KEY = 'iEditWeb_customCss';

// =====================================================
// CustomCssManagerクラス
// =====================================================

/**
 * カスタムCSS管理マネージャー
 * 
 * @example
 * const manager = new CustomCssManager();
 * manager.setElementStyle('h1', { 'font-size': '3em', 'color': '#ff0000' });
 * manager.applyCustomStyles();
 */
export class CustomCssManager {
    constructor() {
        /** @type {Object} 要素ごとのカスタムスタイルデータ */
        this._customData = {};

        /** @type {HTMLStyleElement|null} 動的スタイル要素 */
        this._styleElement = null;

        this._initializeData();
    }

    // ========================================
    // レジストリアクセス（静的）
    // ========================================

    /**
     * 要素レジストリを取得
     * @returns {Array} レジストリのディープコピー
     */
    static getElementRegistry() {
        return deepClone(ELEMENT_REGISTRY);
    }

    /**
     * プロパティ定義マップを取得
     * @returns {Object} プロパティ定義のディープコピー
     */
    static getPropertyDefinitions() {
        return deepClone(PROPERTY_DEFINITIONS);
    }

    /**
     * 疑似要素用プロパティリストを取得
     * @returns {string[]} プロパティ名の配列
     */
    static getPseudoProperties() {
        return [...PSEUDO_PROPERTIES];
    }

    /**
     * 要素キーからレジストリエントリを取得
     * @param {string} key - 要素キー
     * @returns {Object|undefined} レジストリエントリ
     */
    static getElementDef(key) {
        const entry = ELEMENT_REGISTRY.find(e => e.key === key);
        return entry ? deepClone(entry) : undefined;
    }

    // ========================================
    // パブリック API
    // ========================================

    /**
     * カスタムスタイルデータ全体を取得
     * @returns {Object} カスタムスタイルデータのディープコピー
     */
    getCustomStyles() {
        return deepClone(this._customData);
    }

    /**
     * カスタムスタイルデータ全体を設定
     * @param {Object} data - カスタムスタイルデータ
     */
    setCustomStyles(data) {
        if (!data || typeof data !== 'object') return;
        this._customData = deepClone(data);
    }

    /**
     * 特定要素のスタイルを取得
     * @param {string} elementKey - 要素キー
     * @returns {Object} スタイルデータ { styles: {}, pseudo: {} }
     */
    getElementStyle(elementKey) {
        const data = this._customData[elementKey];
        return data ? deepClone(data) : { styles: {}, pseudo: {} };
    }

    /**
     * 特定要素のスタイルを設定
     * @param {string} elementKey - 要素キー
     * @param {Object} styles - CSSプロパティ・値のオブジェクト
     * @param {Object} [pseudo={}] - 疑似要素スタイル { '::before': {}, '::after': {} }
     */
    setElementStyle(elementKey, styles, pseudo = {}) {
        // レジストリに存在する要素のみ受け付け
        if (!ELEMENT_REGISTRY.find(e => e.key === elementKey)) return;

        // サニタイズ
        const sanitizedStyles = this._sanitizeStyles(styles);
        const sanitizedPseudo = {};

        for (const [pseudoSel, pseudoStyles] of Object.entries(pseudo)) {
            if (['::before', '::after'].includes(pseudoSel)) {
                sanitizedPseudo[pseudoSel] = this._sanitizeStyles(pseudoStyles);
            }
        }

        this._customData[elementKey] = {
            styles: sanitizedStyles,
            pseudo: sanitizedPseudo,
        };
    }

    /**
     * カスタムスタイルをDOMに適用
     * 動的<style>タグを生成・更新してエディタに注入
     */
    applyCustomStyles() {
        const cssText = this._generateCssText();
        this._injectStyles(cssText);
    }

    /**
     * 特定要素または全体をデフォルトに戻す
     * @param {string} [elementKey] - 指定しない場合は全体リセット
     */
    resetToDefaults(elementKey) {
        if (elementKey) {
            delete this._customData[elementKey];
        } else {
            this._customData = {};
        }
    }

    /**
     * カスタムスタイルをJSON文字列としてエクスポート
     * @returns {string} JSON文字列
     */
    exportToJson() {
        const exportData = {
            version: 1,
            timestamp: new Date().toISOString(),
            customStyles: this._customData,
        };
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * JSON文字列からカスタムスタイルをインポート
     * @param {string} jsonString - JSON文字列
     * @returns {{ success: boolean, message: string }} 結果
     */
    importFromJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (!data || typeof data !== 'object') {
                return { success: false, message: '無効なJSONデータです' };
            }

            // バージョン1フォーマット
            if (data.version === 1 && data.customStyles) {
                // 各要素のデータを検証・サニタイズ
                const sanitizedData = {};
                for (const [key, value] of Object.entries(data.customStyles)) {
                    if (ELEMENT_REGISTRY.find(e => e.key === key)) {
                        sanitizedData[key] = {
                            styles: this._sanitizeStyles(value.styles || {}),
                            pseudo: {},
                        };
                        if (value.pseudo) {
                            for (const [ps, psStyles] of Object.entries(value.pseudo)) {
                                if (['::before', '::after'].includes(ps)) {
                                    sanitizedData[key].pseudo[ps] = this._sanitizeStyles(psStyles || {});
                                }
                            }
                        }
                    }
                }
                this._customData = sanitizedData;
                return { success: true, message: 'インポートが完了しました' };
            }

            // フォールバック: 直接データとして解釈
            this._customData = {};
            for (const [key, value] of Object.entries(data)) {
                if (ELEMENT_REGISTRY.find(e => e.key === key) && typeof value === 'object') {
                    this._customData[key] = {
                        styles: this._sanitizeStyles(value.styles || value || {}),
                        pseudo: {},
                    };
                }
            }
            return { success: true, message: 'インポートが完了しました（旧フォーマット）' };

        } catch (e) {
            return { success: false, message: `JSONパースエラー: ${e.message}` };
        }
    }

    /**
     * localStorageに保存
     */
    saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._customData));
        } catch (e) {
            console.warn('カスタムCSS設定の保存に失敗しました:', e);
        }
    }

    /**
     * localStorageから読み込み
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this._customData = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('カスタมCSS設定の読み込みに失敗しました:', e);
            this._customData = {};
        }
    }

    /**
     * カスタムデータが存在するか（何かカスタマイズされているか）
     * @returns {boolean}
     */
    hasCustomStyles() {
        return Object.keys(this._customData).some(key => {
            const data = this._customData[key];
            if (!data) return false;
            const hasStyles = data.styles && Object.keys(data.styles).some(k => data.styles[k]);
            const hasPseudo = data.pseudo && Object.keys(data.pseudo).some(ps => {
                return data.pseudo[ps] && Object.keys(data.pseudo[ps]).some(k => data.pseudo[ps][k]);
            });
            return hasStyles || hasPseudo;
        });
    }

    /**
     * フォントフォールバックチェーンを付与
     * @param {string} fontFamily - ユーザー入力のfont-family
     * @returns {string} フォールバック付きのfont-family
     */
    static applyFontFallback(fontFamily) {
        if (!fontFamily || typeof fontFamily !== 'string') return '';

        const trimmed = fontFamily.trim();
        if (!trimmed) return '';

        // すでにフォールバックが含まれている場合はそのまま返す
        const lowerCase = trimmed.toLowerCase();
        if (lowerCase.includes('sans-serif') ||
            lowerCase.includes('serif') ||
            lowerCase.includes('monospace')) {
            return trimmed;
        }

        // フォールバックチェーンを追加
        return `${trimmed}, ${FONT_FALLBACK_CHAIN.join(', ')}`;
    }

    // ========================================
    // プライベートメソッド
    // ========================================

    /**
     * データの初期化
     * @private
     */
    _initializeData() {
        this._customData = {};
    }

    /**
     * スタイルオブジェクトのサニタイズ
     * @param {Object} styles - CSSプロパティ・値のオブジェクト
     * @returns {Object} サニタイズ済みオブジェクト
     * @private
     */
    _sanitizeStyles(styles) {
        if (!styles || typeof styles !== 'object') return {};

        const sanitized = {};
        for (const [prop, value] of Object.entries(styles)) {
            if (typeof value !== 'string') continue;

            const trimmedProp = prop.trim().toLowerCase();
            const trimmedValue = value.trim();

            if (!trimmedProp || !trimmedValue) continue;

            // ブラックリスト: 危険なパターンが含まれていないか確認
            if (!CssSanitizer.isValueSafe(trimmedValue)) continue;

            // 値をサニタイズ（危険パターンのみ除去）
            const sanitizedDecl = CssSanitizer.sanitize(
                `${trimmedProp}: ${trimmedValue}`
            );

            if (sanitizedDecl) {
                const colonIdx = sanitizedDecl.indexOf(':');
                if (colonIdx !== -1) {
                    const val = sanitizedDecl.substring(colonIdx + 1).trim();
                    if (val) {
                        sanitized[trimmedProp] = val;
                    }
                }
            }
        }

        return sanitized;
    }

    /**
     * カスタムスタイルデータからCSS文字列を生成
     * @returns {string} CSS文字列
     * @private
     */
    _generateCssText() {
        const rules = [];

        for (const elementDef of ELEMENT_REGISTRY) {
            const data = this._customData[elementDef.key];
            if (!data) continue;

            // 通常スタイル
            if (data.styles && Object.keys(data.styles).length > 0) {
                const declarations = this._buildDeclarations(data.styles, elementDef.key);
                if (declarations) {
                    rules.push(`${elementDef.selector} {\n${declarations}\n}`);
                }
            }

            // 疑似要素スタイル
            if (data.pseudo && elementDef.pseudoSupport) {
                for (const [pseudoSel, pseudoStyles] of Object.entries(data.pseudo)) {
                    if (pseudoStyles && Object.keys(pseudoStyles).length > 0) {
                        const declarations = this._buildDeclarations(pseudoStyles);
                        if (declarations) {
                            rules.push(`${elementDef.selector}${pseudoSel} {\n${declarations}\n}`);
                        }
                    }
                }
            }
        }

        return rules.join('\n\n');
    }

    /**
     * スタイルオブジェクトからCSS宣言文字列を構築
     * @param {Object} styles - スタイルオブジェクト
     * @param {string} [elementKey] - 要素キー（フォントフォールバック処理用）
     * @returns {string} CSS宣言文字列
     * @private
     */
    _buildDeclarations(styles, elementKey) {
        const lines = [];
        for (const [prop, value] of Object.entries(styles)) {
            if (!value) continue;

            let finalValue = value;

            // font-familyの場合、フォールバックチェーンを付与
            if (prop === 'font-family') {
                finalValue = CustomCssManager.applyFontFallback(value);
            }

            lines.push(`  ${prop}: ${finalValue};`);
        }
        return lines.join('\n');
    }

    /**
     * CSS文字列を動的<style>タグに注入
     * @param {string} cssText - CSS文字列
     * @private
     */
    _injectStyles(cssText) {
        // 既存のスタイル要素を取得または作成
        if (!this._styleElement) {
            this._styleElement = document.getElementById(STYLE_ELEMENT_ID);
            if (!this._styleElement) {
                this._styleElement = document.createElement('style');
                this._styleElement.id = STYLE_ELEMENT_ID;
                document.head.appendChild(this._styleElement);
            }
        }

        this._styleElement.textContent = cssText;
    }
}
