/**
 * CSSサニタイザー
 * 
 * ユーザーが入力したCSSの安全性を検証・クリーンアップします。
 * 危険なスクリプト注入パターンを検出・除去し、安全なCSSのみを許可します。
 * 
 * @module utils/CssSanitizer
 */

// =====================================================
// 定数定義
// =====================================================

/**
 * 危険なCSSパターン（ブラックリスト）
 * これらのパターンにマッチするCSS値はすべてブロック
 */
const DANGEROUS_PATTERNS = [
    /expression\s*\(/gi,                    // IE expression()
    /javascript\s*:/gi,                     // javascript: URL
    /vbscript\s*:/gi,                       // vbscript: URL
    /-moz-binding\s*:/gi,                   // Firefox XBL binding
    /behavior\s*:/gi,                       // IE behavior
    /url\s*\(\s*["']?\s*javascript/gi,      // url(javascript:...)
    /url\s*\(\s*["']?\s*data\s*:/gi,        // url(data:...)
    /url\s*\(\s*["']?\s*vbscript/gi,        // url(vbscript:...)
    /@import/gi,                            // @import
    /@charset/gi,                           // @charset
    /@namespace/gi,                         // @namespace
    /\\00/gi,                               // Unicode escape bypass
];



// =====================================================
// CssSanitizerクラス
// =====================================================

/**
 * CSSサニタイザークラス
 * CSS入力の安全性を検証・クリーンアップする静的ユーティリティ
 */
export class CssSanitizer {

    // ========================================
    // パブリック API
    // ========================================

    /**
     * CSS文字列をサニタイズして安全なCSSのみを返す
     * ブラックリスト方式: 危険なパターンのみを除去し、それ以外はすべて許可
     * 
     * @param {string} cssText - サニタイズ対象のCSS文字列
     * @returns {string} サニタイズ後のCSS文字列
     */
    static sanitize(cssText) {
        if (!cssText || typeof cssText !== 'string') {
            return '';
        }

        // 危険なパターンを一律除去
        return CssSanitizer._removeDangerousPatterns(cssText).trim();
    }

    /**
     * CSS文字列を検証し、エラーメッセージを返す
     * 
     * @param {string} cssText - 検証対象のCSS文字列
     * @returns {{ valid: boolean, errors: string[] }} 検証結果
     */
    static validate(cssText) {
        const errors = [];

        if (!cssText || typeof cssText !== 'string') {
            return { valid: true, errors: [] };
        }

        // 危険パターンの検出
        for (const pattern of DANGEROUS_PATTERNS) {
            // RegExpは lastIndex を持つため、毎回リセットするためにコピーを作成
            const testPattern = new RegExp(pattern.source, pattern.flags);
            if (testPattern.test(cssText)) {
                const patternName = CssSanitizer._getPatternName(pattern);
                errors.push(`危険なパターンが検出されました: ${patternName}`);
            }
        }

        // 基本的な構文チェック
        const syntaxErrors = CssSanitizer._checkBasicSyntax(cssText);
        errors.push(...syntaxErrors);

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * CSS値に危険なパターンが含まれるか判定
     * 
     * @param {string} value - CSSプロパティ値
     * @returns {boolean} 安全な場合true
     */
    static isValueSafe(value) {
        if (!value || typeof value !== 'string') return true;
        return !DANGEROUS_PATTERNS.some(p => new RegExp(p.source, p.flags).test(value));
    }

    // ========================================
    // プライベートメソッド
    // ========================================

    /**
     * 危険なパターンをCSS文字列から除去
     * @param {string} cssText - CSS文字列
     * @returns {string} クリーンなCSS文字列
     * @private
     */
    static _removeDangerousPatterns(cssText) {
        let cleaned = cssText;
        for (const pattern of DANGEROUS_PATTERNS) {
            cleaned = cleaned.replace(new RegExp(pattern.source, pattern.flags), '/* blocked */');
        }
        return cleaned;
    }



    /**
     * 基本的なCSS構文チェック
     * @param {string} cssText - CSS文字列
     * @returns {string[]} エラーメッセージ配列
     * @private
     */
    static _checkBasicSyntax(cssText) {
        const errors = [];

        // 括弧の対応チェック
        const openBraces = (cssText.match(/{/g) || []).length;
        const closeBraces = (cssText.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push(`括弧の対応が正しくありません（開き: ${openBraces}、閉じ: ${closeBraces}）`);
        }

        // 空の値チェック（property: ; のパターン）
        if (/:\s*;/.test(cssText)) {
            errors.push('値が空のプロパティがあります');
        }

        return errors;
    }

    /**
     * 危険パターンの表示名を取得
     * @param {RegExp} pattern - パターン
     * @returns {string} パターンの表示名
     * @private
     */
    static _getPatternName(pattern) {
        const source = pattern.source;
        if (source.includes('expression')) return 'expression()';
        if (source.includes('javascript')) return 'javascript:';
        if (source.includes('vbscript')) return 'vbscript:';
        if (source.includes('-moz-binding')) return '-moz-binding';
        if (source.includes('behavior')) return 'behavior';
        if (source.includes('@import')) return '@import';
        if (source.includes('@charset')) return '@charset';
        if (source.includes('@namespace')) return '@namespace';
        if (source.includes('\\\\00')) return 'Unicode escape';
        return source;
    }
}
