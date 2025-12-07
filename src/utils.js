/**
 * ユーティリティ関数
 * 
 * アプリケーション全体で使用される汎用的なヘルパー関数を提供します。
 */

/**
 * 関数の実行を指定時間遅延させます（デバウンス）。
 * 連続して呼び出された場合、最後の呼び出しから指定時間経過後に実行されます。
 * 
 * @param {Function} func - 遅延実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
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
 * ユニークなIDを生成します。
 * 
 * @returns {string} 'id-'プレフィックス付きのユニークなID
 */
export function generateId() {
  return 'id-' + Math.random().toString(36).substr(2, 9);
}

/**
 * RGB形式の色をHEX形式に変換します。
 * 
 * @param {string} rgb - RGB形式の色文字列（例: 'rgb(255, 0, 0)'）
 * @returns {string} HEX形式の色文字列（例: '#ff0000'）
 */
export function rgbToHex(rgb) {
  if (!rgb) return '#000000';
  if (rgb.startsWith('#')) return rgb;
  const rgbMatch = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!rgbMatch) return rgb;

  const r = parseInt(rgbMatch[1]);
  const g = parseInt(rgbMatch[2]);
  const b = parseInt(rgbMatch[3]);

  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * 値を指定された範囲内に制限します（クランプ）。
 * 
 * @param {number} value - 制限する値
 * @param {number} min - 最小値
 * @param {number} max - 最大値
 * @returns {number} 範囲内に制限された値
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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

/**
 * 文字列をエスケープしてHTMLとして安全にします。
 * 
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
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

/**
 * 深いコピーを作成します（JSON互換オブジェクト用）。
 * 
 * @param {Object} obj - コピーするオブジェクト
 * @returns {Object} 深いコピー
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}
