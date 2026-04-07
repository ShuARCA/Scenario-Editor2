/**
 * グループ管理
 * 
 * シェイプのグループ化（親子関係）、衝突判定、
 * グループの展開・折りたたみ、自動リサイズを担当します。
 * 
 * セクション構成:
 *   1. 初期化・アクセサー
 *   2. 衝突判定・階層ユーティリティ
 *   3. グループ化操作（グループ化・解除）
 *   4. 展開・折りたたみ制御
 *   5. 子要素の表示制御
 *   6. サイズ計算
 *   7. レイアウト調整
 *   8. DOM更新・ノード移動
 * 
 * @module flowchart/GroupManager
 */

import { CONFIG } from '../core/Config.js';

export class GroupManager {

    // =====================================================
    // 1. 初期化・アクセサー
    // =====================================================

    /**
     * @param {Object} flowchartApp - FlowchartAppへの参照
     */
    constructor(flowchartApp) {
        /** @type {Object} FlowchartAppへの参照 */
        this.app = flowchartApp;

        /**
         * グループ化抑制フラグ。
         * toggleCollapse実行中にtrueとなり、handleDrop/groupShapesをブロックする。
         * @type {boolean}
         * @private
         */
        this._groupingLocked = false;
    }

    /**
     * FlowchartApp.shapes への短縮アクセサー。
     * @returns {Map}
     */
    get shapes() {
        return this.app.shapes;
    }

    // =====================================================
    // 2. 衝突判定・階層ユーティリティ
    // =====================================================

    /**
     * innerの中心がouterの矩形に含まれるか判定します。
     * 
     * @param {Object} inner - 内側（ドロップされた側）のシェイプ
     * @param {Object} outer - 外側（受け入れ側）のシェイプ
     * @returns {boolean}
     */
    checkCollision(inner, outer) {
        const cx = inner.x + inner.width / 2;
        const cy = inner.y + inner.height / 2;

        return (
            cx >= outer.x &&
            cx <= outer.x + outer.width &&
            cy >= outer.y &&
            cy <= outer.y + outer.height
        );
    }

    /**
     * childIdがparentIdの子孫かどうか再帰的に判定します。
     * 循環参照を防ぐガードとして使用します。
     * 
     * @param {string} parentId - 親ID
     * @param {string} childId - 子ID
     * @returns {boolean}
     */
    isDescendant(parentId, childId) {
        const parent = this.shapes.get(parentId);
        if (!parent || !parent.children) return false;
        if (parent.children.includes(childId)) return true;
        return parent.children.some(c => this.isDescendant(c, childId));
    }

    /**
     * 2つのシェイプが同じ階層（同じ親を持つ）にあるか判定します。
     * 
     * @param {Object} shape - 判定対象のシェイプ
     * @param {string|null} parentId - 比較基準となる親ID（nullならルート階層）
     * @returns {boolean}
     */
    isSameLevel(shape, parentId) {
        return parentId ? shape.parent === parentId : !shape.parent;
    }

    /**
     * ノードの階層の深さを返します（ルート=0, 子=1, 孫=2…）。
     * handleDropで複数の親候補から最も適切なノードを選ぶために使用します。
     * 
     * @param {Object} shape - 対象シェイプ
     * @returns {number}
     * @private
     */
    _getNodeDepth(shape) {
        let depth = 0;
        let currentId = shape.parent;
        while (currentId) {
            depth++;
            const p = this.shapes.get(currentId);
            if (!p) break;
            currentId = p.parent;
        }
        return depth;
    }

    /**
     * シェイプが表示中かどうかを判定します。
     * 折りたたまれた子ノード（display:none）を除外するために使用します。
     * 
     * @param {Object} shape - 対象シェイプ
     * @returns {boolean}
     * @private
     */
    _isVisible(shape) {
        return !(shape.element && shape.element.style.display === 'none');
    }

    // =====================================================
    // 3. グループ化操作
    // =====================================================

    /**
     * シェイプのドロップ時にグループ化/解除を判定します。
     * 
     * - 非表示ノード（折りたたみ中の子）は判定対象外
     * - 複数候補がヒットした場合、最も深い階層のノードを親として選択
     * 
     * @param {Object} shape - ドロップされたシェイプ
     */
    handleDrop(shape) {
        if (this._groupingLocked) return;

        let parentCandidate = null;
        let candidateDepth = -1;

        for (const [id, other] of this.shapes) {
            if (id === shape.id) continue;
            if (this.isDescendant(shape.id, id)) continue;
            if (!this._isVisible(other)) continue;

            if (this.checkCollision(shape, other)) {
                const depth = this._getNodeDepth(other);
                if (!parentCandidate || depth > candidateDepth) {
                    parentCandidate = other;
                    candidateDepth = depth;
                }
            }
        }

        if (parentCandidate) {
            this.groupShapes(parentCandidate, shape);
        } else if (shape.parent) {
            const parent = this.shapes.get(shape.parent);
            if (parent && !this.checkCollision(shape, parent)) {
                this.ungroupShape(shape);
            }
        }
    }

    /**
     * シェイプをグループ化（親子関係を設定）します。
     * 
     * @param {Object} parent - 親となるシェイプ
     * @param {Object} child - 子となるシェイプ
     */
    groupShapes(parent, child) {
        if (this._groupingLocked) return;
        if (child.parent === parent.id) return;

        // 既存の親から離脱
        if (child.parent) {
            this.ungroupShape(child);
        }

        // 新しい親子関係を構築
        child.parent = parent.id;
        if (!parent.children) parent.children = [];
        parent.children.push(child.id);

        this._onGroupChanged(parent);
    }

    /**
     * シェイプのグループ化を解除します。
     * 
     * @param {Object} child - グループから外すシェイプ
     */
    ungroupShape(child) {
        if (!child.parent) return;

        const parent = this.shapes.get(child.parent);
        child.parent = null;

        if (parent) {
            parent.children = parent.children.filter(id => id !== child.id);
            this._onGroupChanged(parent);
        }
    }

    /**
     * グループ構成変更後の共通処理（スタイル・サイズ・z-index更新）。
     * groupShapes/ungroupShapeから呼ばれます。
     * 
     * @param {Object} parent - 構成が変わった親シェイプ
     * @private
     */
    _onGroupChanged(parent) {
        this.updateShapeStyle(parent);
        this.updateParentSize(parent);
        if (this.app.updateAllZIndexes) {
            this.app.updateAllZIndexes();
        }
    }

    // =====================================================
    // 4. 展開・折りたたみ制御
    // =====================================================

    /**
     * シェイプのスタイルを更新します。
     * 子を持つ場合は group-parent クラスと折りたたみボタンを付与します。
     * 
     * @param {Object} shape - 対象のシェイプ
     */
    updateShapeStyle(shape) {
        if (!shape.element) return;

        const hasChildren = shape.children?.length > 0;

        if (hasChildren) {
            shape.element.classList.add('group-parent');
            if (!shape.element.querySelector('.group-toggle')) {
                const toggle = document.createElement('div');
                toggle.className = 'group-toggle';
                toggle.textContent = shape.collapsed ? '+' : '-';
                toggle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.toggleCollapse(shape);
                });
                shape.element.appendChild(toggle);
            }
        } else {
            shape.element.classList.remove('group-parent');
            shape.element.querySelector('.group-toggle')?.remove();
        }
    }

    /**
     * グループの折りたたみ/展開を切り替えます。
     * 処理中は _groupingLocked で誤グループ化を防止します。
     * 
     * @param {Object} shape - 対象の親シェイプ
     */
    toggleCollapse(shape) {
        this._groupingLocked = true;
        try {
            if (shape.collapsed) {
                this._expandGroup(shape);
            } else {
                this._collapseGroup(shape);
            }
            this.app.drawConnections();
        } finally {
            this._groupingLocked = false;
        }
    }

    /**
     * グループを展開します。
     * 
     * 処理順序（子ノード表示前に周囲を退避させる）:
     *   1. 展開サイズの決定（データのみ）
     *   2. 周囲ノードの退避
     *   3. 親ノードのDOM更新
     *   4. 子ノードの表示
     *   5. 祖先への伝播
     * 
     * @param {Object} shape - 展開する親シェイプ
     * @private
     */
    _expandGroup(shape) {
        // Phase 1: 展開サイズの決定（DOM未更新）
        shape.collapsedSize = { width: shape.width, height: shape.height };
        const oldBounds = this._getBounds(shape);

        shape.collapsed = false;
        if (shape.expandedSize) {
            shape.width = shape.expandedSize.width;
            shape.height = shape.expandedSize.height;
        } else {
            this._recalcParentSizeData(shape);
        }

        // Phase 2: 周囲ノードの退避
        this._pushSurroundingNodes(shape, oldBounds);
        this._resolveExpandOverlaps(shape);

        // Phase 3: 親ノードのDOM更新
        this._updateShapeDOMAndToggle(shape, '-');

        // Phase 4: 子ノードの表示
        this.setChildrenVisibility(shape, true);

        // Phase 5: 祖先への伝播
        if (shape.parent) {
            this._updateAncestorsLayout(shape.parent);
        }
    }

    /**
     * グループを折りたたみます。
     * 
     * 処理順序（子ノードを先に隠して誤グループ化を防止）:
     *   1. 子ノードの非表示
     *   2. 折りたたみサイズの決定
     *   3. 親ノードのDOM更新
     *   4. 周囲ノードの位置調整
     *   5. 祖先への伝播
     * 
     * @param {Object} shape - 折りたたむ親シェイプ
     * @private
     */
    _collapseGroup(shape) {
        // Phase 1: 子ノードの非表示
        shape.expandedSize = { width: shape.width, height: shape.height };
        this.setChildrenVisibility(shape, false);

        // Phase 2: 折りたたみサイズの決定
        const oldBounds = this._getBounds(shape);
        shape.collapsed = true;

        if (shape.collapsedSize) {
            shape.width = shape.collapsedSize.width;
            shape.height = shape.collapsedSize.height;
        } else {
            shape.width = CONFIG.FLOWCHART.SHAPE.WIDTH;
            shape.height = CONFIG.FLOWCHART.SHAPE.HEIGHT;
        }

        // Phase 3: 親ノードのDOM更新
        this._updateShapeDOMAndToggle(shape, '+');

        // Phase 4: 周囲ノードの位置調整
        this._pushSurroundingNodes(shape, oldBounds);

        // Phase 5: 祖先への伝播
        if (shape.parent) {
            this._updateAncestorsLayout(shape.parent);
        }
    }

    /**
     * シェイプの現在の境界情報を取得します。
     * 展開/折りたたみのレイアウト調整計算に使用します。
     * 
     * @param {Object} shape
     * @returns {{ x: number, y: number, right: number, bottom: number }}
     * @private
     */
    _getBounds(shape) {
        return {
            x: shape.x,
            y: shape.y,
            right: shape.x + shape.width,
            bottom: shape.y + shape.height,
        };
    }

    /**
     * サイズ変更前後の差分に基づき、周囲の同階層ノードを退避/引寄せします。
     * _expandGroup と _collapseGroup の共通処理です。
     * 
     * @param {Object} shape - サイズが変わったシェイプ
     * @param {{ right: number, bottom: number }} oldBounds - 変更前の境界
     * @private
     */
    _pushSurroundingNodes(shape, oldBounds) {
        const newRight = shape.x + shape.width;
        const newBottom = shape.y + shape.height;
        const moveX = newRight - oldBounds.right;
        const moveY = newBottom - oldBounds.bottom;

        if (moveX !== 0 || moveY !== 0) {
            this._adjustLayout(shape, moveX, moveY, oldBounds.right, oldBounds.bottom);
        }
    }

    /**
     * シェイプのDOM（サイズ・位置）と折りたたみトグルを一括更新します。
     * 
     * @param {Object} shape
     * @param {string} toggleText - '+' または '-'
     * @private
     */
    _updateShapeDOMAndToggle(shape, toggleText) {
        this._updateShapeDOM(shape);
        const toggle = shape.element?.querySelector('.group-toggle');
        if (toggle) toggle.textContent = toggleText;
    }

    // =====================================================
    // 5. 子要素の表示制御
    // =====================================================

    /**
     * 子要素の表示/非表示を再帰的に設定します。
     * 表示時は各子のcollapsed状態を尊重します。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {boolean} visible - 表示するかどうか
     */
    setChildrenVisibility(shape, visible) {
        if (!shape.children) return;

        shape.children.forEach(childId => {
            const child = this.shapes.get(childId);
            if (!child?.element) return;

            child.element.style.display = visible ? 'flex' : 'none';

            // 再帰: 表示時は子自身の折りたたみ状態を尊重
            if (child.children?.length > 0) {
                this.setChildrenVisibility(child, visible && !child.collapsed);
            }
        });
    }

    // =====================================================
    // 6. サイズ計算
    // =====================================================

    /**
     * 子要素に合わせて親シェイプのサイズを更新します（DOM更新あり）。
     * 
     * @param {Object} shape - 親シェイプ
     */
    updateParentSize(shape) {
        this._recalcParentSizeData(shape);
        this._updateShapeDOM(shape);
    }

    /**
     * 子要素の位置に基づいて親シェイプのサイズを再計算します（データのみ）。
     * DOM更新を遅延させたい展開処理で使用します。
     * 
     * @param {Object} shape - 親シェイプ
     * @private
     */
    _recalcParentSizeData(shape) {
        if (!shape.children || shape.children.length === 0) return;

        if (shape.collapsed) {
            if (!shape.width) shape.width = CONFIG.FLOWCHART.SHAPE.WIDTH;
            if (!shape.height) shape.height = CONFIG.FLOWCHART.SHAPE.HEIGHT;
            return;
        }

        // 子要素のバウンディングボックスを計算
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        shape.children.forEach(childId => {
            const child = this.shapes.get(childId);
            if (child) {
                minX = Math.min(minX, child.x);
                minY = Math.min(minY, child.y);
                maxX = Math.max(maxX, child.x + child.width);
                maxY = Math.max(maxY, child.y + child.height);
            }
        });
        if (minX === Infinity) return;

        const padding = CONFIG.FLOWCHART.LAYOUT?.GROUP_PADDING || 20;
        const headerHeight = CONFIG.FLOWCHART.LAYOUT?.GROUP_HEADER_HEIGHT || 30;

        let newX = Math.min(shape.x, minX - padding);
        let newY = Math.min(shape.y, minY - headerHeight - padding);
        let newWidth = Math.max(shape.width, (maxX - newX) + padding);
        let newHeight = Math.max(shape.height, (maxY - newY) + padding);

        if (shape.expandedSize) {
            newWidth = Math.max(newWidth, shape.expandedSize.width);
            newHeight = Math.max(newHeight, shape.expandedSize.height);
        }

        shape.x = newX;
        shape.y = newY;
        shape.width = newWidth;
        shape.height = newHeight;
        shape.expandedSize = { width: newWidth, height: newHeight };
    }

    // =====================================================
    // 7. レイアウト調整
    // =====================================================

    /**
     * 親階層を遡ってサイズ更新とレイアウト調整を行います。
     * 子ノードの変更により親ノードが拡大した場合、
     * 親ノードの兄弟ノードなども退避させます。
     * 
     * @param {string} startParentId - 開始する親ID
     * @private
     */
    _updateAncestorsLayout(startParentId) {
        let currentId = startParentId;

        while (currentId) {
            const parent = this.shapes.get(currentId);
            if (!parent) break;

            const oldBounds = this._getBounds(parent);
            this.updateParentSize(parent);
            this._pushSurroundingNodes(parent, oldBounds);
            this._resolveExpandOverlaps(parent);

            currentId = parent.parent;
        }
    }

    /**
     * ソースノードのサイズ変更に伴い、同階層の周囲ノードを移動します。
     * 
     * - ソースの旧右端より右にあるノード → X方向に移動
     * - ソースの旧下端より下にあるノード → Y方向に移動
     * - 両方に該当するノード → XY両方向に移動
     * 
     * @param {Object} sourceShape - サイズが変わったシェイプ
     * @param {number} moveX - 右端の変化量
     * @param {number} moveY - 下端の変化量
     * @param {number} oldRight - 変更前の右端座標
     * @param {number} oldBottom - 変更前の下端座標
     * @private
     */
    _adjustLayout(sourceShape, moveX, moveY, oldRight, oldBottom) {
        const sourceParentId = sourceShape.parent;

        this.shapes.forEach(shape => {
            if (shape.id === sourceShape.id) return;
            if (this.isDescendant(sourceShape.id, shape.id)) return;
            if (!this.isSameLevel(shape, sourceParentId)) return;

            const isRight = shape.x >= oldRight;
            const isBelow = shape.y >= oldBottom;
            if (!isRight && !isBelow) return;

            this._moveShapeRecursive(shape, isRight ? moveX : 0, isBelow ? moveY : 0);
        });
    }

    /**
     * 展開後の親ノード範囲内に残った非子孫ノードを外側に退避させます。
     * 
     * adjustLayoutはoldRight/oldBottomより右・下のノードのみ移動するため、
     * 折りたたみ中に親の範囲内へ配置されたノードは移動対象外になります。
     * この関数でそうしたノードを親の外に押し出し、誤グループ化を防止します。
     * 
     * @param {Object} parentShape - 展開された親シェイプ
     * @private
     */
    _resolveExpandOverlaps(parentShape) {
        if (parentShape.collapsed) return;

        const padding = CONFIG.FLOWCHART.LAYOUT?.GROUP_PADDING || 20;
        const parentRight = parentShape.x + parentShape.width;
        const sourceParentId = parentShape.parent;

        this.shapes.forEach(shape => {
            if (shape.id === parentShape.id) return;
            if (this.isDescendant(parentShape.id, shape.id)) return;
            if (!this.isSameLevel(shape, sourceParentId)) return;

            if (this.checkCollision(shape, parentShape)) {
                this._moveShapeRecursive(shape, parentRight + padding - shape.x, 0);
            }
        });
    }

    // =====================================================
    // 8. DOM更新・ノード移動
    // =====================================================

    /**
     * シェイプのDOM要素（位置・サイズ）をデータに同期します。
     * 
     * @param {Object} shape
     * @private
     */
    _updateShapeDOM(shape) {
        if (!shape.element) return;
        shape.element.style.left = `${shape.x}px`;
        shape.element.style.top = `${shape.y}px`;
        shape.element.style.width = `${shape.width}px`;
        shape.element.style.height = `${shape.height}px`;
    }

    /**
     * シェイプとその子孫を再帰的に移動します。
     * データとDOMの両方を更新します。
     * 
     * @param {Object} shape - 移動するシェイプ
     * @param {number} dx - X方向の移動量
     * @param {number} dy - Y方向の移動量
     * @private
     */
    _moveShapeRecursive(shape, dx, dy) {
        shape.x += dx;
        shape.y += dy;

        if (shape.element) {
            shape.element.style.left = `${shape.x}px`;
            shape.element.style.top = `${shape.y}px`;
        }

        if (shape.children) {
            shape.children.forEach(childId => {
                const child = this.shapes.get(childId);
                if (child) {
                    this._moveShapeRecursive(child, dx, dy);
                }
            });
        }
    }
}
