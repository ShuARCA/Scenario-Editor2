/**
 * 汎用ヘルパー関数
 * 
 * アプリケーション全体で使用される汎用的なヘルパー関数を提供します。
 * 
 * @module utils/helpers
 */

// =====================================================
// 関数ユーティリティ
// =====================================================

/**
 * 関数の実行を指定時間遅延させます（デバウンス）。
 * 連続して呼び出された場合、最後の呼び出しから指定時間経過後に実行されます。
 * 
 * @param {Function} func - 遅延実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 * 
 * @example
 * const debouncedSave = debounce(() => save(), 500);
 * debouncedSave(); // 500ms後に実行
 */
export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * 関数の実行を制限します（スロットル）。
 * 指定時間内に1回だけ実行されます。
 * 
 * @param {Function} func - 制限する関数
 * @param {number} limit - 制限時間（ミリ秒）
 * @returns {Function} スロットルされた関数
 * 
 * @example
 * const throttledScroll = throttle(() => handleScroll(), 100);
 */
export function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function (...args) {
        const context = this;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// =====================================================
// ID生成
// =====================================================

/**
 * ユニークなIDを生成します。
 * 
 * @param {string} [prefix='id'] - IDのプレフィックス
 * @returns {string} プレフィックス付きのユニークなID
 * 
 * @example
 * generateId() // => 'id-abc123def'
 * generateId('comment') // => 'comment-abc123def'
 */
export function generateId(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// =====================================================
// 色変換
// =====================================================

/**
 * RGB形式の色をHEX形式に変換します。
 * 
 * @param {string} rgb - RGB形式の色文字列（例: 'rgb(255, 0, 0)'）
 * @returns {string} HEX形式の色文字列（例: '#ff0000'）
 * 
 * @example
 * rgbToHex('rgb(255, 0, 0)') // => '#ff0000'
 */
export function rgbToHex(rgb) {
    if (!rgb) return '#000000';
    if (rgb.startsWith('#')) return rgb;

    const rgbMatch = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!rgbMatch) return rgb;

    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);

    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * HEX形式の色をRGB形式に変換します。
 * 
 * @param {string} hex - HEX形式の色文字列（例: '#ff0000'）
 * @returns {string} RGB形式の色文字列（例: 'rgb(255, 0, 0)'）
 */
export function hexToRgb(hex) {
    if (!hex) return 'rgb(0, 0, 0)';

    // #を除去
    hex = hex.replace(/^#/, '');

    // 3桁の場合は6桁に拡張
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgb(${r}, ${g}, ${b})`;
}

// =====================================================
// 数値ユーティリティ
// =====================================================

/**
 * 値を指定された範囲内に制限します（クランプ）。
 * 
 * @param {number} value - 制限する値
 * @param {number} min - 最小値
 * @param {number} max - 最大値
 * @returns {number} 範囲内に制限された値
 * 
 * @example
 * clamp(150, 0, 100) // => 100
 * clamp(-10, 0, 100) // => 0
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// =====================================================
// ジオメトリユーティリティ
// =====================================================

/**
 * 2つの矩形が重なっているかどうかを判定します。
 * 
 * @param {Object} rect1 - 矩形1 {x, y, width, height}
 * @param {Object} rect2 - 矩形2 {x, y, width, height}
 * @returns {boolean} 重なっている場合はtrue
 */
export function rectsOverlap(rect1, rect2) {
    return !(
        rect1.x + rect1.width <= rect2.x ||
        rect2.x + rect2.width <= rect1.x ||
        rect1.y + rect1.height <= rect2.y ||
        rect2.y + rect2.height <= rect1.y
    );
}

// =====================================================
// 文字列ユーティリティ
// =====================================================

/**
 * 文字列をエスケープしてHTMLとして安全にします。
 * 
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 * 
 * @example
 * escapeHtml('<script>') // => '&lt;script&gt;'
 */
export function escapeHtml(str) {
    if (!str) return '';
    const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => escapeMap[char]);
}

// =====================================================
// オブジェクトユーティリティ
// =====================================================

/**
 * 深いコピーを作成します（JSON互換オブジェクト用）。
 * 
 * @param {Object} obj - コピーするオブジェクト
 * @returns {Object} 深いコピー
 * 
 * @example
 * const copy = deepClone({ a: { b: 1 } });
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    return JSON.parse(JSON.stringify(obj));
}

/**
 * オブジェクトが空かどうかを判定します。
 * 
 * @param {Object} obj - 判定するオブジェクト
 * @returns {boolean} 空の場合true
 */
export function isEmpty(obj) {
    if (obj === null || obj === undefined) return true;
    if (typeof obj === 'object') {
        return Object.keys(obj).length === 0;
    }
    return false;
}
