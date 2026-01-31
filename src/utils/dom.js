/**
 * DOM操作ヘルパー
 * 
 * 頻出するDOM操作を簡略化するヘルパー関数を提供します。
 * 
 * @module utils/dom
 */

// =====================================================
// 要素取得
// =====================================================

/**
 * IDで要素を取得します。
 * 
 * @param {string} id - 要素のID
 * @returns {HTMLElement|null} 要素、または見つからない場合null
 */
export function getById(id) {
    return document.getElementById(id);
}

/**
 * セレクタで単一要素を取得します。
 * 
 * @param {string} selector - CSSセレクタ
 * @param {HTMLElement} [parent=document] - 検索の起点となる要素
 * @returns {HTMLElement|null} 要素、または見つからない場合null
 */
export function querySelector(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * セレクタで複数要素を取得します。
 * 
 * @param {string} selector - CSSセレクタ
 * @param {HTMLElement} [parent=document] - 検索の起点となる要素
 * @returns {HTMLElement[]} 要素の配列
 */
export function querySelectorAll(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}

// =====================================================
// イベント操作
// =====================================================

/**
 * 要素が存在する場合のみイベントリスナーを追加します。
 * 
 * @param {string} elementId - 要素のID
 * @param {string} eventType - イベントタイプ（'click', 'change'等）
 * @param {Function} handler - イベントハンドラ
 * @returns {HTMLElement|null} 要素、または見つからない場合null
 * 
 * @example
 * addEventListenerIfExists('saveBtn', 'click', () => save());
 */
export function addEventListenerIfExists(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, handler);
    }
    return element;
}

/**
 * 複数のイベントリスナーを一度に追加します。
 * 
 * @param {HTMLElement} element - 対象要素
 * @param {Object} events - イベント名とハンドラのマップ
 * 
 * @example
 * addEventListeners(element, {
 *   click: handleClick,
 *   mouseenter: handleMouseEnter
 * });
 */
export function addEventListeners(element, events) {
    if (!element) return;
    Object.entries(events).forEach(([eventType, handler]) => {
        element.addEventListener(eventType, handler);
    });
}

/**
 * 複数のイベントリスナーを一度に削除します。
 * 
 * @param {HTMLElement} element - 対象要素
 * @param {Object} events - イベント名とハンドラのマップ
 */
export function removeEventListeners(element, events) {
    if (!element) return;
    Object.entries(events).forEach(([eventType, handler]) => {
        element.removeEventListener(eventType, handler);
    });
}

// =====================================================
// 表示/非表示操作
// =====================================================

/**
 * パネルの表示/非表示を切り替えます（hiddenクラス使用）。
 * 
 * @param {HTMLElement} panel - パネル要素
 * @param {boolean} show - trueなら表示、falseなら非表示
 */
export function togglePanelVisibility(panel, show) {
    if (!panel) return;
    if (show) {
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}

/**
 * 要素を表示します。
 * 
 * @param {HTMLElement} element - 対象要素
 */
export function showElement(element) {
    if (element) {
        element.classList.remove('hidden');
    }
}

/**
 * 要素を非表示にします。
 * 
 * @param {HTMLElement} element - 対象要素
 */
export function hideElement(element) {
    if (element) {
        element.classList.add('hidden');
    }
}

/**
 * 要素が非表示かどうかを判定します。
 * 
 * @param {HTMLElement} element - 対象要素
 * @returns {boolean} 非表示の場合true
 */
export function isHidden(element) {
    if (!element) return true;
    return element.classList.contains('hidden');
}

// =====================================================
// クラス操作
// =====================================================

/**
 * 条件に基づいてクラスを切り替えます。
 * 
 * @param {HTMLElement} element - 対象要素
 * @param {string} className - クラス名
 * @param {boolean} condition - trueなら追加、falseなら削除
 */
export function toggleClass(element, className, condition) {
    if (!element) return;
    if (condition) {
        element.classList.add(className);
    } else {
        element.classList.remove(className);
    }
}

/**
 * 要素に複数のクラスを追加します。
 * 
 * @param {HTMLElement} element - 対象要素
 * @param {...string} classNames - 追加するクラス名
 */
export function addClasses(element, ...classNames) {
    if (!element) return;
    element.classList.add(...classNames);
}

/**
 * 要素から複数のクラスを削除します。
 * 
 * @param {HTMLElement} element - 対象要素
 * @param {...string} classNames - 削除するクラス名
 */
export function removeClasses(element, ...classNames) {
    if (!element) return;
    element.classList.remove(...classNames);
}

// =====================================================
// 要素作成
// =====================================================

/**
 * 要素を作成します。
 * 
 * @param {string} tag - タグ名
 * @param {Object} [options] - オプション
 * @param {string} [options.className] - クラス名
 * @param {string} [options.id] - ID
 * @param {Object} [options.attributes] - 属性のマップ
 * @param {string} [options.textContent] - テキストコンテンツ
 * @param {string} [options.innerHTML] - HTMLコンテンツ
 * @param {Object} [options.style] - スタイルのマップ
 * @returns {HTMLElement} 作成された要素
 * 
 * @example
 * const button = createElement('button', {
 *   className: 'btn primary',
 *   textContent: '保存',
 *   attributes: { 'data-action': 'save' }
 * });
 */
export function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.className) {
        element.className = options.className;
    }

    if (options.id) {
        element.id = options.id;
    }

    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    if (options.textContent) {
        element.textContent = options.textContent;
    }

    if (options.innerHTML) {
        element.innerHTML = options.innerHTML;
    }

    if (options.style) {
        Object.entries(options.style).forEach(([key, value]) => {
            element.style[key] = value;
        });
    }

    return element;
}

// =====================================================
// 位置計算
// =====================================================

/**
 * 要素の位置を計算します。
 * 
 * @param {HTMLElement} anchorElement - 基準となる要素
 * @param {Object} [options] - オプション
 * @param {number} [options.offsetX=0] - X方向のオフセット
 * @param {number} [options.offsetY=8] - Y方向のオフセット
 * @returns {{top: number, left: number}} 位置
 */
export function calculatePosition(anchorElement, options = {}) {
    if (!anchorElement) return { top: 0, left: 0 };

    const rect = anchorElement.getBoundingClientRect();
    return {
        top: rect.bottom + (options.offsetY ?? 8),
        left: rect.left + (options.offsetX ?? 0)
    };
}

/**
 * 選択範囲の位置を計算します。
 * 
 * @param {Object} [options] - オプション
 * @param {number} [options.offsetY=8] - Y方向のオフセット
 * @returns {{top: number, left: number}|null} 位置、または選択がない場合null
 */
export function calculatePositionFromSelection(options = {}) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    return {
        top: rect.bottom + (options.offsetY ?? 8),
        left: rect.left
    };
}

// =====================================================
// スクロール
// =====================================================

/**
 * 要素を滑らかにスクロールして表示します。
 * 
 * @param {HTMLElement} element - 対象要素
 * @param {Object} [options] - スクロールオプション
 * @param {string} [options.behavior='smooth'] - スクロール動作
 * @param {string} [options.block='center'] - 垂直方向の配置
 */
export function scrollIntoView(element, options = {}) {
    if (!element) return;
    element.scrollIntoView({
        behavior: options.behavior ?? 'smooth',
        block: options.block ?? 'center'
    });
}
