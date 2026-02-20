/**
 * ユーティリティモジュール統合エクスポート
 * 
 * アプリケーション全体で使用されるユーティリティ関数をまとめてエクスポートします。
 * 
 * @module utils
 */

// 汎用ヘルパー関数
export {
    debounce,
    throttle,
    generateId,
    rgbToHex,
    hexToRgb,
    clamp,
    rectsOverlap,
    escapeHtml,
    deepClone,
    isEmpty
} from './helpers.js';

// DOM操作ヘルパー
export {
    getById,
    querySelector,
    querySelectorAll,
    addEventListenerIfExists,
    addEventListeners,
    removeEventListeners,
    togglePanelVisibility,
    showElement,
    hideElement,
    isHidden,
    toggleClass,
    addClasses,
    removeClasses,
    createElement,
    calculatePosition,
    calculatePositionFromSelection,
    scrollIntoView
} from './dom.js';

// HTMLサニタイザー
export { Sanitizer } from './Sanitizer.js';

// CSSサニタイザー
export { CssSanitizer } from './CssSanitizer.js';

// WCAGコントラストチェッカー
export { WcagChecker } from './WcagChecker.js';
