/**
 * 接続線管理
 * 
 * フローチャートの接続線の描画、作成、選択を担当します。
 * 
 * @module flowchart/ConnectionManager
 */

import { generateId } from '../utils/helpers.js';

/**
 * 接続線管理クラス
 */
export class ConnectionManager {
    /**
     * ConnectionManagerのコンストラクタ
     * 
     * @param {Object} flowchartApp - FlowchartAppへの参照
     */
    constructor(flowchartApp) {
        /** @type {Object} FlowchartAppへの参照 */
        this.app = flowchartApp;

        /** @type {string|null} 選択中の接続線ID */
        this.selectedConnectionId = null;

        /** @type {string|null} 接続開始シェイプID */
        this.connectStartShape = null;

        /** @type {string|null} 接続開始ポイント */
        this.connectStartPoint = null;
    }

    // =====================================================
    // 接続線作成
    // =====================================================

    /**
     * 接続を開始します。
     * 
     * @param {HTMLElement} target - 接続ポイント要素
     */
    startConnect(target) {
        const shapeEl = target.closest('.shape');
        if (!shapeEl) return;

        this.connectStartShape = shapeEl.id;
        this.connectStartPoint = this._getConnectionPointFromElement(target);
    }

    /**
     * 接続を完了します。
     * 
     * @param {HTMLElement} target - 接続ポイント要素
     * @returns {boolean} 接続が作成されたかどうか
     */
    endConnect(target) {
        if (!this.connectStartShape) return false;

        const shapeEl = target.closest('.shape');
        if (!shapeEl || shapeEl.id === this.connectStartShape) {
            this.clearConnectionStart();
            return false;
        }

        const endPoint = this._getConnectionPointFromElement(target);

        // 既存の接続をチェック
        const existingConn = this.app.connections.find(
            c => c.from === this.connectStartShape && c.to === shapeEl.id
        );

        if (!existingConn) {
            this.createConnection(
                this.connectStartShape,
                shapeEl.id,
                this.connectStartPoint,
                endPoint
            );
        }

        this.clearConnectionStart();
        return true;
    }

    /**
     * 接続を作成します。
     * 
     * @param {string} fromId - 開始シェイプID
     * @param {string} toId - 終了シェイプID
     * @param {string} fromPoint - 開始ポイント（top, bottom, left, right）
     * @param {string} toPoint - 終了ポイント
     * @returns {Object} 作成された接続
     */
    createConnection(fromId, toId, fromPoint = 'bottom', toPoint = 'top') {
        const connection = {
            id: generateId('conn'),
            from: fromId,
            to: toId,
            fromPoint: fromPoint,
            toPoint: toPoint,
            style: {
                type: 'solid',
                arrow: 'end',
                color: '#94a3b8'
            }
        };

        this.app.connections.push(connection);
        this.drawConnections();

        return connection;
    }

    /**
     * 接続開始をクリアします。
     */
    clearConnectionStart() {
        this.connectStartShape = null;
        this.connectStartPoint = null;
    }

    // =====================================================
    // 接続線描画
    // =====================================================

    /**
     * すべての接続線を描画します。
     */
    drawConnections() {
        const svg = this.app.connectionsLayer;
        if (!svg) return;

        // 既存のパスを削除（defs以外）
        // querySelectorAll('path')だとdefs内のmarker内のpathも取得してしまうため、
        // 直下の要素のみを対象にする、またはIDで判断する
        const children = Array.from(svg.children);
        children.forEach(child => {
            if (child.tagName === 'path' || child.tagName === 'text') {
                child.remove();
            }
        });

        this.app.connections.forEach(conn => {
            this._drawConnection(conn);
        });
    }

    /**
     * 単一の接続線を描画します。
     * 
     * @param {Object} conn - 接続データ
     * @private
     */
    _drawConnection(conn) {
        const fromShape = this.app.shapes.get(conn.from);
        const toShape = this.app.shapes.get(conn.to);
        if (!fromShape || !toShape) return;

        const startPt = this._getConnectionPoint(fromShape, conn.fromPoint || 'bottom');
        const endPt = this._getConnectionPoint(toShape, conn.toPoint || 'top');

        const isSelected = conn.id === this.selectedConnectionId;
        const strokeColor = conn.style?.color || '#94a3b8';
        const actualColor = isSelected ? 'var(--primary-color)' : strokeColor;

        // パスを計算
        const pathD = this._calculatePath(startPt, endPt, conn.fromPoint, conn.toPoint);

        // 当たり判定用の太いパス（クリックしやすくするため）
        const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.id = `conn-hit-${conn.id}`;
        hitPath.setAttribute('d', pathD);
        hitPath.setAttribute('stroke', 'rgba(0,0,0,0)'); // 透明だが判定はある
        hitPath.setAttribute('stroke-width', '20');
        hitPath.setAttribute('fill', 'none');
        hitPath.style.pointerEvents = 'stroke';
        hitPath.style.cursor = 'pointer';

        hitPath.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectConnection(conn.id);
        });

        hitPath.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectConnection(conn.id);
            if (this.app.contextMenuManager) {
                this.app.contextMenuManager.showConnectionContextMenu(conn.id, e.clientX, e.clientY);
            }
        });

        this.app.connectionsLayer.appendChild(hitPath);

        // 表示用パス
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.id = `conn-path-${conn.id}`;
        path.setAttribute('d', pathD);
        path.setAttribute('stroke', actualColor);
        path.setAttribute('stroke-width', isSelected ? '3' : '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke-linecap', 'round');
        path.style.pointerEvents = 'none';

        // 点線スタイル
        if (conn.style?.type === 'dashed') {
            path.setAttribute('stroke-dasharray', '8,4');
        }

        // マーカーの更新と適用
        const { markerId, markerTailId } = this._updateConnectionMarkers(conn.id, actualColor);
        const arrowStyle = conn.style?.arrow || 'end';

        // 終点マーカー
        if (arrowStyle === 'end' || arrowStyle === 'both') {
            path.setAttribute('marker-end', `url(#${markerId})`);
        } else {
            path.removeAttribute('marker-end');
        }

        // 始点マーカー
        if (arrowStyle === 'both') {
            path.setAttribute('marker-start', `url(#${markerTailId})`);
        } else {
            path.removeAttribute('marker-start');
        }

        this.app.connectionsLayer.appendChild(path);

        // ラベル
        if (conn.style?.label) {
            this._drawConnectionLabel(conn, startPt, endPt);
        }
    }

    /**
     * 接続線のマーカー（矢印）を作成・更新します。
     * 
     * @param {string} connId - 接続線ID
     * @param {string} color - 色コード
     * @returns {{markerId: string, markerTailId: string}} マーカーID
     * @private
     */
    _updateConnectionMarkers(connId, color) {
        const defs = this.app.connectionsLayer.querySelector('defs');
        const markerId = `arrow-${connId}`;
        const markerTailId = `arrow-tail-${connId}`;

        // 終点マーカー作成・更新
        let marker = document.getElementById(markerId);
        if (!marker) {
            marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.id = markerId;
            marker.setAttribute('markerWidth', '6');
            marker.setAttribute('markerHeight', '6');
            marker.setAttribute('refX', '6');
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');
            const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            markerPath.setAttribute('d', 'M0,0 L6,3 L0,6');
            marker.appendChild(markerPath);
            defs.appendChild(marker);
        }
        marker.querySelector('path').setAttribute('fill', color);

        // 始点マーカー作成・更新
        let markerTail = document.getElementById(markerTailId);
        if (!markerTail) {
            markerTail = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            markerTail.id = markerTailId;
            markerTail.setAttribute('markerWidth', '6');
            markerTail.setAttribute('markerHeight', '6');
            markerTail.setAttribute('refX', '0');
            markerTail.setAttribute('refY', '3');
            markerTail.setAttribute('orient', 'auto');
            const markerTailPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            markerTailPath.setAttribute('d', 'M6,0 L0,3 L6,6');
            markerTail.appendChild(markerTailPath);
            defs.appendChild(markerTail);
        } else {
            // 既存のマーカーの属性を更新（念のため）
            markerTail.setAttribute('refX', '0');
            markerTail.querySelector('path').setAttribute('d', 'M6,0 L0,3 L6,6');
        }
        markerTail.querySelector('path').setAttribute('fill', color);

        return { markerId, markerTailId };
    }

    /**
     * 接続線のラベルを描画します。
     * 
     * @param {Object} conn - 接続データ
     * @param {{x: number, y: number}} startPt - 開始点
     * @param {{x: number, y: number}} endPt - 終了点
     * @private
     */
    _drawConnectionLabel(conn, startPt, endPt) {
        const midX = (startPt.x + endPt.x) / 2;
        const midY = (startPt.y + endPt.y) / 2;

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', midY - 8);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', conn.style?.color || '#94a3b8');
        text.setAttribute('font-size', '12');
        text.textContent = conn.style.label;

        this.app.connectionsLayer.appendChild(text);
    }

    // =====================================================
    // 接続線選択
    // =====================================================

    /**
     * 接続線を選択します。
     * 
     * @param {string} id - 接続線ID
     */
    selectConnection(id) {
        this.app.shapeManager?.clearSelection();
        this.selectedConnectionId = id;
        this.drawConnections();
    }

    /**
     * 接続線の選択を解除します。
     */
    clearConnectionSelection() {
        this.selectedConnectionId = null;
    }

    // =====================================================
    // 接続線削除
    // =====================================================

    /**
     * 接続線を削除します。
     * 
     * @param {string} id - 接続線ID
     */
    removeConnection(id) {
        // コアから接続データを削除
        this.app.core.removeConnection(id);

        // パスと当たり判定、ラベルの削除
        const path = document.getElementById(`conn-path-${id}`);
        const hit = document.getElementById(`conn-hit-${id}`);
        const label = document.getElementById(`conn-label-${id}`);
        if (path) path.remove();
        if (hit) hit.remove();
        if (label) label.remove();

        // マーカーの削除
        const marker = document.getElementById(`arrow-${id}`);
        const markerTail = document.getElementById(`arrow-tail-${id}`);
        if (marker) marker.remove();
        if (markerTail) markerTail.remove();

        this.clearConnectionSelection();
    }

    // =====================================================
    // プレビュー
    // =====================================================

    /**
     * 接続プレビューを描画します。
     * 
     * @param {number} mouseX - マウスX座標
     * @param {number} mouseY - マウスY座標
     */
    drawConnectionPreview(mouseX, mouseY) {
        if (!this.connectStartShape) return;

        const fromShape = this.app.shapes.get(this.connectStartShape);
        if (!fromShape) return;

        this.clearConnectionPreview();

        const startPt = this._getConnectionPoint(fromShape, this.connectStartPoint || 'bottom');
        const endPt = { x: mouseX, y: mouseY };
        const previewToPoint = this._inferPreviewToPoint(startPt, endPt);
        const pathD = this._calculatePath(
            startPt,
            endPt,
            this.connectStartPoint || 'bottom',
            previewToPoint
        );

        const preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        preview.id = 'connection-preview';
        preview.setAttribute('d', pathD);
        preview.setAttribute('stroke', '#3b82f6');
        preview.setAttribute('stroke-width', '2');
        preview.setAttribute('stroke-linejoin', 'round');
        preview.setAttribute('stroke-linecap', 'round');
        preview.setAttribute('stroke-dasharray', '5,5');
        preview.setAttribute('fill', 'none');

        this.app.connectionsLayer.appendChild(preview);
    }

    /**
     * 接続プレビューをクリアします。
     */
    clearConnectionPreview() {
        const preview = document.getElementById('connection-preview');
        if (preview) preview.remove();
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * 要素から接続ポイントを取得します。
     * 
     * @param {HTMLElement} element - 接続ポイント要素
     * @returns {string} ポイント名（top, bottom, left, right）
     * @private
     */
    _getConnectionPointFromElement(element) {
        if (element.classList.contains('top')) return 'top';
        if (element.classList.contains('bottom')) return 'bottom';
        if (element.classList.contains('left')) return 'left';
        if (element.classList.contains('right')) return 'right';
        return 'bottom';
    }

    /**
     * シェイプの接続ポイント座標を取得します。
     * 
     * @param {Object} shape - シェイプデータ
     * @param {string} point - ポイント名
     * @returns {{x: number, y: number}} 座標
     * @private
     */
    _getConnectionPoint(shape, point) {
        const centerX = shape.x + shape.width / 2;
        const centerY = shape.y + shape.height / 2;

        switch (point) {
            case 'top':
                return { x: centerX, y: shape.y };
            case 'bottom':
                return { x: centerX, y: shape.y + shape.height };
            case 'left':
                return { x: shape.x, y: centerY };
            case 'right':
                return { x: shape.x + shape.width, y: centerY };
            default:
                return { x: centerX, y: shape.y + shape.height };
        }
    }

    /**
     * ベジェ曲線パスを計算します。
     * 
     * @param {{x: number, y: number}} start - 開始点
     * @param {{x: number, y: number}} end - 終了点
     * @param {string} fromPoint - 開始ポイント名
     * @param {string} toPoint - 終了ポイント名
     * @returns {string} SVGパス
     * @private
     */
    _calculatePath(start, end, fromPoint, toPoint) {
        const normalizedFromPoint = fromPoint || 'bottom';
        const normalizedToPoint = toPoint || 'top';
        const points = this._buildOrthogonalPoints(start, end, normalizedFromPoint, normalizedToPoint);
        return this._buildRoundedPath(points);
    }

    /**
     * 端子向きからベクトルを取得します。
     *
     * @param {string} point - top|bottom|left|right
     * @returns {{x: number, y: number}} 方向ベクトル
     * @private
     */
    _getDirectionVector(point) {
        switch (point) {
            case 'top':
                return { x: 0, y: -1 };
            case 'bottom':
                return { x: 0, y: 1 };
            case 'left':
                return { x: -1, y: 0 };
            case 'right':
                return { x: 1, y: 0 };
            default:
                return { x: 0, y: 1 };
        }
    }

    /**
     * 接続端子が左右方向かを返します。
     *
     * @param {string} point - top|bottom|left|right
     * @returns {boolean}
     * @private
     */
    _isHorizontalPoint(point) {
        return point === 'left' || point === 'right';
    }

    /**
     * 角丸鍵線用の折れ点列を生成します（SmoothStep風ロジック）。
     *
     * @param {{x: number, y: number}} start - 開始点
     * @param {{x: number, y: number}} end - 終了点
     * @param {string} fromPoint - 開始端子向き
     * @param {string} toPoint - 終了端子向き
     * @returns {Array<{x: number, y: number}>} 折れ点列
     * @private
     */
    _buildOrthogonalPoints(start, end, fromPoint, toPoint) {
        const sourceDir = this._getDirectionVector(fromPoint);
        const targetDir = this._getDirectionVector(toPoint);

        // 1. 初期スタブの計算
        // ノードから少し離れた位置まで必ず直進させる
        const minDistance = 20;
        const startStub = {
            x: start.x + sourceDir.x * minDistance,
            y: start.y + sourceDir.y * minDistance
        };
        const endStub = {
            x: end.x + targetDir.x * minDistance,
            y: end.y + targetDir.y * minDistance
        };

        // 2. 中間点の計算
        const points = [start, startStub];

        const isHorizontalStart = this._isHorizontalPoint(fromPoint);
        const isHorizontalEnd = this._isHorizontalPoint(toPoint);

        if (isHorizontalStart === isHorizontalEnd) {
            // 同じ向き（水平同士 or 垂直同士）
            const isHorizontal = isHorizontalStart;
            // ベクトルの向きが完全に一致するか（Right->Right など）
            const isSameDirection = (sourceDir.x === targetDir.x) && (sourceDir.y === targetDir.y);

            if (isHorizontal) {
                // 水平同士
                if (isSameDirection) {
                    // Right->Right または Left->Left
                    // 常に迂回が必要。endStubへの進入方向とtargetDirが逆になるため、
                    // endStubの手前で折り返す（180度ターン）のを避けるには、
                    // endStubよりも「奥」まで行ってから戻る必要がある。
                    const dir = sourceDir.x; // 1 or -1
                    // 2つのStubのうち、進行方向により奥にある方を取得し、さらにマージンを追加
                    let detourX;
                    if (dir > 0) { // Right
                        detourX = Math.max(startStub.x, endStub.x) + minDistance;
                    } else { // Left
                        detourX = Math.min(startStub.x, endStub.x) - minDistance;
                    }

                    points.push({ x: detourX, y: startStub.y });
                    points.push({ x: detourX, y: endStub.y });

                } else {
                    // Right->Left または Left->Right (対面または背中合わせ)
                    const dir = sourceDir.x;
                    const targetRelX = (endStub.x - startStub.x) * dir;

                    if (targetRelX > 0) {
                        // 対面（向き合っている）: 中間で縦移動
                        const midX = (startStub.x + endStub.x) / 2;
                        points.push({ x: midX, y: startStub.y });
                        points.push({ x: midX, y: endStub.y });
                    } else {
                        // 背中合わせ: 縦に迂回が必要
                        const midY = (startStub.y + endStub.y) / 2;
                        points.push({ x: startStub.x, y: midY });
                        points.push({ x: endStub.x, y: midY });
                    }
                }
            } else {
                // 垂直同士
                if (isSameDirection) {
                    // Top->Top または Bottom->Bottom
                    const dir = sourceDir.y; // 1 or -1
                    let detourY;
                    if (dir > 0) { // Bottom
                        detourY = Math.max(startStub.y, endStub.y) + minDistance;
                    } else { // Top
                        detourY = Math.min(startStub.y, endStub.y) - minDistance;
                    }

                    points.push({ x: startStub.x, y: detourY });
                    points.push({ x: endStub.x, y: detourY });

                } else {
                    // Top->Bottom または Bottom->Top
                    const dir = sourceDir.y;
                    const targetRelY = (endStub.y - startStub.y) * dir;

                    if (targetRelY > 0) {
                        // 対面: 中間で横移動
                        const midY = (startStub.y + endStub.y) / 2;
                        points.push({ x: startStub.x, y: midY });
                        points.push({ x: endStub.x, y: midY });
                    } else {
                        // 背中合わせ: 横に迂回
                        const midX = (startStub.x + endStub.x) / 2;
                        points.push({ x: midX, y: startStub.y });
                        points.push({ x: midX, y: endStub.y });
                    }
                }
            }
        } else {
            // 異なる向き（水平 -> 垂直 or 垂直 -> 水平）
            if (isHorizontalStart) {
                // 水平(Start) -> 垂直(End)
                const dirX = sourceDir.x;
                const isTargetAheadX = (endStub.x - startStub.x) * dirX > 0;

                const dirY = targetDir.y;
                // endStubへの進入方向チェック（Endに入るにはtargetDirの逆から入る必要がある）
                const canEnterDirectly = (endStub.y - startStub.y) * targetDir.y < 0;

                if (isTargetAheadX && canEnterDirectly) {
                    // L字で接続可能
                    points.push({ x: endStub.x, y: startStub.y });
                } else {
                    // 迂回が必要
                    // どちらの軸を優先するか？ 
                    // 交点 (startStub.x, endStub.y) を使うと:
                    // startStub -> 交点 (垂直移動。Startは水平なのにここで直角？) -> おかしい。
                    // startStubからは水平にしか出られない。
                    // なので、必ず startStub -> (something, startStub.y) -> ... と続く。

                    // L字が無理なら、2回曲がる必要がある。
                    // パターンA: X軸を合わせてから縦移動 (isTargetAheadXならこれだった)
                    // パターンB: Y軸を合わせてから... いやStartは水平移動しかできない。

                    // なので、必ず「startStubから水平移動」して「endStubと同じX」または「中間X」まで行く。
                    // しかし isTargetAheadX でない（背中側）なら、一度戻らないといけない。
                    // または、Xはあってるが canEnterDirectly でない（ターゲットの後ろ側に回り込む必要がある）場合。

                    points.push({ x: startStub.x, y: endStub.y });
                }
            } else {
                // 垂直(Start) -> 水平(End)
                const dirY = sourceDir.y;
                const isTargetAheadY = (endStub.y - startStub.y) * dirY > 0;
                const canEnterDirectly = (endStub.x - startStub.x) * targetDir.x < 0;

                if (isTargetAheadY && canEnterDirectly) {
                    points.push({ x: startStub.x, y: endStub.y });
                } else {
                    points.push({ x: endStub.x, y: startStub.y });
                }
            }
        }

        points.push(endStub);
        points.push(end);

        return this._simplifyOrthogonalPoints(points);
    }

    /**
     * 重複点・同一直線上の中間点を除去します。
     *
     * @param {Array<{x: number, y: number}>} points - 点列
     * @returns {Array<{x: number, y: number}>} 簡略化後の点列
     * @private
     */
    _simplifyOrthogonalPoints(points) {
        if (points.length < 2) return points;

        const epsilon = 0.5;
        const simplified = [points[0]];

        for (let i = 1; i < points.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const curr = points[i];
            const next = points[i + 1];

            // 1. 重複削除
            if (Math.abs(prev.x - curr.x) < epsilon && Math.abs(prev.y - curr.y) < epsilon) {
                continue;
            }

            // 2. 同一直線上の点削除
            // 垂直線上
            const isVertical =
                Math.abs(prev.x - curr.x) < epsilon &&
                Math.abs(curr.x - next.x) < epsilon;

            // 水平線上
            const isHorizontal =
                Math.abs(prev.y - curr.y) < epsilon &&
                Math.abs(curr.y - next.y) < epsilon;

            if (isVertical || isHorizontal) {
                continue;
            }

            simplified.push(curr);
        }

        // 最後の点を追加（重複チェック）
        const last = simplified[simplified.length - 1];
        const end = points[points.length - 1];
        if (Math.abs(last.x - end.x) > epsilon || Math.abs(last.y - end.y) > epsilon) {
            simplified.push(end);
        }

        return simplified;
    }

    /**
     * 折れ点列から角丸のSVGパスを構築します。
     *
     * @param {Array<{x: number, y: number}>} points - 折れ点列
     * @returns {string} SVGパス
     * @private
     */
    _buildRoundedPath(points) {
        if (!points.length) {
            return '';
        }

        if (points.length === 1) {
            return `M ${points[0].x} ${points[0].y}`;
        }

        const cornerRadius = 12;
        let path = `M ${points[0].x} ${points[0].y}`;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const current = points[i];
            const next = points[i + 1];

            if (!next) {
                path += ` L ${current.x} ${current.y}`;
                continue;
            }

            const inDx = current.x - prev.x;
            const inDy = current.y - prev.y;
            const outDx = next.x - current.x;
            const outDy = next.y - current.y;
            const inLength = Math.hypot(inDx, inDy);
            const outLength = Math.hypot(outDx, outDy);

            if (inLength < 0.001 || outLength < 0.001) {
                continue;
            }

            const inUnit = { x: inDx / inLength, y: inDy / inLength };
            const outUnit = { x: outDx / outLength, y: outDy / outLength };
            const noTurn =
                Math.abs(inUnit.x - outUnit.x) < 0.001 &&
                Math.abs(inUnit.y - outUnit.y) < 0.001;

            if (noTurn) {
                path += ` L ${current.x} ${current.y}`;
                continue;
            }

            const radius = Math.min(cornerRadius, inLength / 2, outLength / 2);
            if (radius < 0.5) {
                path += ` L ${current.x} ${current.y}`;
                continue;
            }

            const cornerStart = {
                x: current.x - inUnit.x * radius,
                y: current.y - inUnit.y * radius
            };
            const cornerEnd = {
                x: current.x + outUnit.x * radius,
                y: current.y + outUnit.y * radius
            };
            const cross = inUnit.x * outUnit.y - inUnit.y * outUnit.x;
            const sweepFlag = cross > 0 ? 1 : 0;

            path += ` L ${cornerStart.x} ${cornerStart.y}`;
            path += ` A ${radius} ${radius} 0 0 ${sweepFlag} ${cornerEnd.x} ${cornerEnd.y}`;
        }

        return path;
    }

    /**
     * プレビュー終点の接続向きを推定します。
     *
     * @param {{x: number, y: number}} start - 開始点
     * @param {{x: number, y: number}} end - 終了点
     * @returns {string} top|bottom|left|right
     * @private
     */
    _inferPreviewToPoint(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0 ? 'left' : 'right';
        }

        return dy >= 0 ? 'top' : 'bottom';
    }
}
