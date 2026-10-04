/**
 * グループ管理
 * 
 * シェイプのグループ化（親子関係）、衝突判定、子ノード追従移動、
 * グループ表示ストラテジー（展開固定 / オーバーレイ）の統括を担当します。
 * 
 * @module flowchart/GroupManager
 */

import { CONFIG } from '../core/Config.js';
import { InlineGroupStrategy } from './InlineGroupStrategy.js';
import { OverlayGroupStrategy } from './OverlayGroupStrategy.js';

export class GroupManager {
    /**
     * @param {Object} flowchartApp - FlowchartAppへの参照
     */
    constructor(flowchartApp) {
        /** @type {Object} FlowchartAppへの参照 */
        this.app = flowchartApp;

        /** @type {InlineGroupStrategy} 展開固定モードストラテジー */
        this.inlineStrategy = new InlineGroupStrategy(this);

        /** @type {OverlayGroupStrategy} オーバーレイモードストラテジー */
        this.overlayStrategy = new OverlayGroupStrategy(this);
    }

    /**
     * FlowchartApp.shapes への短縮アクセサー。
     * @returns {Map}
     */
    get shapes() {
        return this.app.shapes;
    }

    /**
     * シェイプに対応するストラテジーを取得します。
     * @param {Object} shape - 対象シェイプ
     * @returns {InlineGroupStrategy|OverlayGroupStrategy}
     */
    getStrategy(shape) {
        if (shape && shape.groupMode === 'overlay') {
            return this.overlayStrategy;
        }
        return this.inlineStrategy;
    }

    // =====================================================
    // 2. 衝突判定・階層ユーティリティ
    // =====================================================

    /**
     * innerの中心がouterの矩形に含まれるか判定します。
     * 
     * @param {Object} inner - 内側（ドロップされた側）のシェイプ
     * @param {Object} outer - 外側（受け入れ側）のシェイプまたは境界矩形
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
     * 指定したシェイプ群（またはシェイプIDリスト）のバウンディングボックス（最小外接矩形）を計算します。
     * 
     * @param {Array<string|Object>} shapesOrIds - シェイプオブジェクトまたはシェイプIDの配列
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }|null}
     */
    getBoundingBox(shapesOrIds) {
        if (!shapesOrIds || shapesOrIds.length === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        shapesOrIds.forEach(item => {
            const shape = typeof item === 'string' ? this.shapes.get(item) : item;
            if (shape) {
                minX = Math.min(minX, shape.x);
                minY = Math.min(minY, shape.y);
                maxX = Math.max(maxX, shape.x + shape.width);
                maxY = Math.max(maxY, shape.y + shape.height);
            }
        });

        if (minX === Infinity) return null;

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * ノードの階層の深さを返します（ルート=0, 子=1, 孫=2…）。
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
     * 
     * @param {Object} shape - 対象シェイプ
     * @returns {boolean}
     * @private
     */
    _isVisible(shape) {
        if (!shape.element) return false;
        if (shape.element.style.display === 'none') return false;
        return true;
    }

    // =====================================================
    // 3. グループ化操作・ドロップ判定
    // =====================================================

    /**
     * シェイプのドロップ時にグループ化/解除を判定します。
     * 通常ノードおよびオーバーレイ枠（疑似ノード）を統一的に探索します。
     * 
     * @param {Object} shape - ドロップされたシェイプ
     * @param {Set<string>} [ignoredIds=null] - 衝突判定から除外するシェイプIDのセット（複数ドラッグ時用）
     */
    handleDrop(shape, ignoredIds = null) {
        // ドロップ受け入れ候補コンテナ（シェイプと境界矩形のペア）を収集
        const candidates = [];

        // ① 通常シェイプ（開いているoverlay親ノードは枠境界で判定するためスキップ）
        for (const [id, other] of this.shapes) {
            if (id === shape.id) continue;
            if (ignoredIds && ignoredIds.has(id)) continue;
            if (this.isDescendant(shape.id, id)) continue;
            if (!this._isVisible(other)) continue;
            if (other.groupMode === 'overlay' && this.overlayStrategy?.isOverlayOpen(other.id)) continue;

            candidates.push({ parentShape: other, bounds: other });
        }

        // ② オーバーレイキャンバス枠（疑似的な親ノードとして扱う）
        if (this.overlayStrategy) {
            for (const [parentId, overlay] of this.overlayStrategy.openOverlays) {
                if (parentId === shape.id) continue;
                if (ignoredIds && ignoredIds.has(parentId)) continue;
                if (this.isDescendant(shape.id, parentId)) continue;

                const bounds = overlay.getBoundsAsShape();
                const parentShape = this.shapes.get(parentId);
                if (bounds && parentShape) {
                    candidates.push({ parentShape, bounds });
                }
            }
        }

        // 最も階層が深い衝突親候補を選択
        let parentCandidate = null;
        let candidateDepth = -1;

        for (const candidate of candidates) {
            if (this.checkCollision(shape, candidate.bounds)) {
                const depth = this._getNodeDepth(candidate.parentShape);
                if (!parentCandidate || depth > candidateDepth) {
                    parentCandidate = candidate.parentShape;
                    candidateDepth = depth;
                }
            }
        }

        // ③ グループ化/解除の実行
        if (parentCandidate) {
            this.groupShapes(parentCandidate, shape);
        } else if (shape.parent) {
            const parent = this.shapes.get(shape.parent);
            // 親がoverlayで枠が閉じている場合は解除しない（安全ガード）
            const isClosedOverlay = parent?.groupMode === 'overlay' && !this.overlayStrategy?.isOverlayOpen(parent.id);
            if (!isClosedOverlay) {
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

        if (child.element) {
            child.element.style.display = 'flex';
        }

        if (parent) {
            parent.children = parent.children.filter(id => id !== child.id);
            this._onGroupChanged(parent);
        }
    }

    /**
     * グループ構成変更後の共通処理。
     * 
     * @param {Object} parent - 構成が変わった親シェイプ
     * @private
     */
    _onGroupChanged(parent) {
        const strategy = this.getStrategy(parent);
        strategy.onGroupChanged(parent);

        if (this.app.updateAllZIndexes) {
            this.app.updateAllZIndexes();
        }
        this.app.drawConnections();
    }

    // =====================================================
    // 4. 親ノード移動に伴うグループ追従
    // =====================================================

    /**
     * 親ノード移動時に、子ノード群および関連オーバーレイ枠を再帰的に追従移動させます。
     * 手動で変更された枠の大きさを保持するため、自動リサイズは行わず平行移動のみを行います。
     * 
     * @param {Object} parentShape - 移動した親シェイプ
     * @param {number} deltaX - X方向の移動量
     * @param {number} deltaY - Y方向の移動量
     */
    moveGroupRecursive(parentShape, deltaX, deltaY) {
        // 子ノード群を再帰的に移動
        if (parentShape.children && parentShape.children.length > 0) {
            this._moveChildrenRecursive(parentShape, deltaX, deltaY);
        }

        // 親ノード自身および子孫が持つオーバーレイ枠を平行移動（手動変更サイズを維持）
        this.moveOverlaysRecursive(parentShape, deltaX, deltaY);
    }

    /**
     * 子ノード群を再帰的に移動させます。
     * @private
     */
    _moveChildrenRecursive(parentShape, deltaX, deltaY) {
        parentShape.children.forEach(childId => {
            const child = this.shapes.get(childId);
            if (child) {
                child.x += deltaX;
                child.y += deltaY;
                this.updateShapeDOM(child);

                if (child.children && child.children.length > 0) {
                    this._moveChildrenRecursive(child, deltaX, deltaY);
                }
            }
        });
    }

    /**
     * 指定シェイプおよびその子孫が開いているオーバーレイ枠を再帰的に平行移動します。
     * 手動で変更された枠の大きさを保持するため、自動リサイズは行いません。
     * 
     * @param {Object} shape - 起点となるシェイプ
     * @param {number} deltaX - X方向の移動量
     * @param {number} deltaY - Y方向の移動量
     */
    moveOverlaysRecursive(shape, deltaX, deltaY) {
        if (!this.overlayStrategy) return;

        const ownOverlay = this.overlayStrategy.openOverlays.get(shape.id);
        if (ownOverlay) {
            ownOverlay.move(deltaX, deltaY);
        } else if (shape.overlayBounds) {
            shape.overlayBounds.x += deltaX;
            shape.overlayBounds.y += deltaY;
        }

        if (shape.children && shape.children.length > 0) {
            shape.children.forEach(childId => {
                const child = this.shapes.get(childId);
                if (child) {
                    this.moveOverlaysRecursive(child, deltaX, deltaY);
                }
            });
        }
    }

    // =====================================================
    // 5. モード制御・表示委譲
    // =====================================================

    /**
     * グループの表示モード（inline / overlay）を変更します。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {'inline'|'overlay'} newMode - 新しいモード
     */
    setGroupMode(shape, newMode) {
        if (!shape || shape.groupMode === newMode) return;

        const oldMode = shape.groupMode || 'inline';

        // 旧モードのクリーンアップ（オーバーレイが開いていれば閉じるなど）
        if (oldMode === 'overlay') {
            this.overlayStrategy.closeOverlay(shape);
        }

        // 新モードを設定
        shape.groupMode = newMode;
        const newStrategy = this.getStrategy(shape);

        // 新ストラテジーに応じたスタイルとレイアウトの更新
        newStrategy.updateStyle(shape);
        if (newMode === 'overlay' && oldMode === 'inline') {
            this.overlayStrategy.updateParentSize(shape, true);
        } else {
            newStrategy.updateParentSize(shape);
        }

        if (newMode === 'inline') {
            newStrategy.setChildrenVisibility(shape, true);
        } else {
            newStrategy.setChildrenVisibility(shape, false);
        }

        if (this.app.updateAllZIndexes) {
            this.app.updateAllZIndexes();
        }
        this.app.drawConnections();
    }

    /**
     * シェイプのスタイルを更新します（ストラテジーに委譲）。
     * 
     * @param {Object} shape - 対象シェイプ
     */
    updateShapeStyle(shape) {
        this.getStrategy(shape).updateStyle(shape);
    }

    /**
     * 親シェイプのサイズを更新します（ストラテジーに委譲）。
     * 
     * @param {Object} shape - 親シェイプ
     */
    updateParentSize(shape) {
        this.getStrategy(shape).updateParentSize(shape);
    }

    /**
     * 子要素の表示/非表示を設定します（ストラテジーに委譲）。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {boolean} visible - 表示フラグ
     */
    setChildrenVisibility(shape, visible) {
        this.getStrategy(shape).setChildrenVisibility(shape, visible);
    }

    /**
     * グループの状態を復元します（ストラテジーに委譲）。
     * 
     * @param {Object} shape - 対象シェイプ
     */
    restoreGroupState(shape) {
        this.getStrategy(shape).restoreGroupState(shape);
    }

    // =====================================================
    // 6. DOM更新
    // =====================================================

    /**
     * シェイプのDOM要素（位置・サイズ）をデータに同期します。
     * 
     * @param {Object} shape
     */
    updateShapeDOM(shape) {
        if (!shape.element) return;
        shape.element.style.left = `${shape.x}px`;
        shape.element.style.top = `${shape.y}px`;
        shape.element.style.width = `${shape.width}px`;
        shape.element.style.height = `${shape.height}px`;
    }
}
