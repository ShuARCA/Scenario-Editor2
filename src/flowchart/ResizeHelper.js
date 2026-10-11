/**
 * リサイズ共通ヘルパー
 * 
 * ノードおよびオーバーレイキャンバスのリサイズハンドル生成と
 * 幾何学計算（寸法・位置）を担当します。
 * 
 * @module flowchart/ResizeHelper
 */

/** @type {readonly string[]} リサイズハンドルの8方向位置 */
export const RESIZE_HANDLE_POSITIONS = Object.freeze(['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']);

/**
 * リサイズハンドル群をコンテナ要素内に生成して追加します。
 * 
 * @param {HTMLElement} container - ハンドルを追加する親要素
 * @param {((e: PointerEvent|MouseEvent, pos: string, handle: HTMLElement) => void)|null} [onPointerDown=null] - ハンドルクリック/タッチ時のコールバック
 * @returns {HTMLElement[]} 生成されたハンドル要素の配列
 */
export function createResizeHandles(container, onPointerDown = null) {
    return RESIZE_HANDLE_POSITIONS.map(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.dataset.pos = pos;
        if (onPointerDown) {
            handle.addEventListener('pointerdown', (e) => onPointerDown(e, pos, handle));
        }
        container.appendChild(handle);
        return handle;
    });
}

/**
 * リサイズ時の新しい位置とサイズを計算します。
 * 
 * @param {Object} params
 * @param {{ x: number, y: number, width: number, height: number }} params.startBounds - 開始時の矩形
 * @param {number} params.dx - X方向の移動量（ズーム補正済み）
 * @param {number} params.dy - Y方向の移動量（ズーム補正済み）
 * @param {string} params.handlePos - ハンドル位置 ('nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w')
 * @param {number} [params.minWidth=20] - 最小幅
 * @param {number} [params.minHeight=20] - 最小高さ
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function calculateResizeBounds({ startBounds, dx, dy, handlePos, minWidth = 20, minHeight = 20 }) {
    let newX = startBounds.x;
    let newY = startBounds.y;
    let newWidth = startBounds.width;
    let newHeight = startBounds.height;

    if (handlePos.includes('e')) {
        newWidth = Math.max(minWidth, startBounds.width + dx);
    }
    if (handlePos.includes('w')) {
        const w = Math.max(minWidth, startBounds.width - dx);
        newX = startBounds.x + (startBounds.width - w);
        newWidth = w;
    }
    if (handlePos.includes('s')) {
        newHeight = Math.max(minHeight, startBounds.height + dy);
    }
    if (handlePos.includes('n')) {
        const h = Math.max(minHeight, startBounds.height - dy);
        newY = startBounds.y + (startBounds.height - h);
        newHeight = h;
    }

    return { x: newX, y: newY, width: newWidth, height: newHeight };
}
