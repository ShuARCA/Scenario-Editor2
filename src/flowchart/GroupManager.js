/**
 * グループ管理
 * 
 * シェイプのグループ化（親子関係）、衝突判定、
 * グループの展開・折りたたみ、自動リサイズを担当します。
 * 
 * @module flowchart/GroupManager
 */

import { CONFIG } from '../core/Config.js';

export class GroupManager {
    /**
     * GroupManagerのコンストラクタ
     * 
     * @param {Object} flowchartApp - FlowchartAppへの参照
     */
    constructor(flowchartApp) {
        /** @type {Object} FlowchartAppへの参照 */
        this.app = flowchartApp;
    }

    /**
     * シェイプのアクセサー
     */
    get shapes() {
        return this.app.shapes;
    }

    // =====================================================
    // ドロップ処理と衝突判定
    // =====================================================

    /**
     * シェイプのドロップ時の処理を行います。
     * グループ化やグループ解除を判定します。
     * 
     * @param {Object} shape - ドロップされたシェイプ
     */
    handleDrop(shape) {
        // 他の図形の上にドロップされたかチェック
        let parentCandidate = null;

        for (const [id, other] of this.shapes) {
            if (id === shape.id) continue;
            if (this.isDescendant(shape.id, id)) continue; // 自分の子孫にはドロップできない

            if (this.checkCollision(shape, other)) {
                parentCandidate = other;
            }
        }

        if (parentCandidate) {
            // グループ化
            this.groupShapes(parentCandidate, shape);
        } else {
            // 親がいた場合、親の外に出たかチェック
            if (shape.parent) {
                const parent = this.shapes.get(shape.parent);
                if (parent && !this.checkCollision(shape, parent)) {
                    this.ungroupShape(shape);
                }
            }
        }
    }

    /**
     * 2つのシェイプが衝突（包含）しているか判定します。
     * innerの中心がouterに含まれているかで判定します。
     * 
     * @param {Object} inner - 内側のシェイプ
     * @param {Object} outer - 外側のシェイプ
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
     * childIdがparentIdの子孫かどうかを判定します。
     * 循環参照を防ぐために使用します。
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

    // =====================================================
    // グループ化操作
    // =====================================================

    /**
     * シェイプをグループ化（親子関係を設定）します。
     * 
     * @param {Object} parent - 親となるシェイプ
     * @param {Object} child - 子となるシェイプ
     */
    groupShapes(parent, child) {
        // 既に親子関係がある場合は何もしない
        if (child.parent === parent.id) return;

        // 既存の親から削除
        if (child.parent) {
            this.ungroupShape(child);
        }

        // 新しい親に追加
        child.parent = parent.id;
        if (!parent.children) parent.children = [];
        parent.children.push(child.id);

        // スタイルとサイズを更新
        this.updateShapeStyle(parent);
        this.updateParentSize(parent);
        // z-index更新（FlowchartApp側で実装されているか、またはここで実装するか）
        // とりあえず親が再描画されるので、表示順序はDOM順序に依存するが、
        // z-index管理が必要なら別途FlowchartAppにメソッドを追加して呼ぶ
        if (this.app.updateAllZIndexes) {
            this.app.updateAllZIndexes();
        }
    }

    /**
     * シェイプのグループ化を解除します。
     * 
     * @param {Object} child - グループから外すシェイプ
     */
    ungroupShape(child) {
        if (!child.parent) return;

        const parent = this.shapes.get(child.parent);
        if (parent) {
            parent.children = parent.children.filter(id => id !== child.id);
            this.updateShapeStyle(parent);
            this.updateParentSize(parent);
        }
        child.parent = null;

        if (this.app.updateAllZIndexes) {
            this.app.updateAllZIndexes();
        }
    }

    // =====================================================
    // スタイルと表示更新
    // =====================================================

    /**
     * シェイプのスタイルを更新します。
     * 子を持つ場合はgroup-parentクラスと折りたたみボタンを追加します。
     * 
     * @param {Object} shape - 対象のシェイプ
     */
    updateShapeStyle(shape) {
        if (!shape.element) return;

        const hasChildren = shape.children?.length > 0;

        if (hasChildren) {
            shape.element.classList.add('group-parent');
            // 折りたたみボタンの追加（なければ）
            if (!shape.element.querySelector('.group-toggle')) {
                const toggle = document.createElement('div');
                toggle.className = 'group-toggle';
                toggle.textContent = shape.collapsed ? '+' : '-';
                toggle.addEventListener('mousedown', (e) => {
                    e.stopPropagation(); // ドラッグ開始を防ぐ
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
     * 
     * @param {Object} shape - 対象のシェイプ
     */
    toggleCollapse(shape) {
        // 現在の状態のサイズを保存
        if (shape.collapsed) {
            shape.collapsedSize = { width: shape.width, height: shape.height };
        } else {
            shape.expandedSize = { width: shape.width, height: shape.height };
        }

        const oldWidth = shape.width;
        const oldHeight = shape.height;
        shape.collapsed = !shape.collapsed;

        const toggle = shape.element.querySelector('.group-toggle');
        if (toggle) toggle.textContent = shape.collapsed ? '+' : '-';

        // 子要素の表示/非表示
        this.setChildrenVisibility(shape, !shape.collapsed);

        // サイズ復元または再計算
        if (shape.collapsed) {
            if (shape.collapsedSize) {
                shape.width = shape.collapsedSize.width;
                shape.height = shape.collapsedSize.height;
                this.updateShapeDOM(shape);
            } else {
                // デフォルト（最小）サイズ
                shape.width = CONFIG.FLOWCHART.SHAPE.WIDTH;
                shape.height = CONFIG.FLOWCHART.SHAPE.HEIGHT;
                this.updateShapeDOM(shape);
            }
        } else {
            if (shape.expandedSize) {
                shape.width = shape.expandedSize.width;
                shape.height = shape.expandedSize.height;
                this.updateShapeDOM(shape);
            } else {
                this.updateParentSize(shape);
            }
        }

        // レイアウト調整（水平・垂直両方向）
        const deltaX = shape.width - oldWidth;
        const deltaY = shape.height - oldHeight;

        if (deltaX !== 0 || deltaY !== 0) {
            this.adjustLayout(shape, deltaX, deltaY, oldWidth, oldHeight);
        }

        this.app.drawConnections();
    }

    /**
     * 子要素の表示/非表示を設定します。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {boolean} visible - 表示するかどうか
     */
    setChildrenVisibility(shape, visible) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.shapes.get(childId);
            if (child && child.element) {
                child.element.style.display = visible ? 'flex' : 'none';
                // 再帰的に処理
                if (visible && child.children && child.children.length > 0) {
                    this.setChildrenVisibility(child, !child.collapsed);
                } else if (!visible && child.children) {
                    this.setChildrenVisibility(child, false);
                }
            }
        });
    }

    /**
     * シェイプのDOM要素（サイズ・位置）を更新します。
     * 
     * @param {Object} shape 
     */
    updateShapeDOM(shape) {
        if (shape.element) {
            shape.element.style.width = `${shape.width}px`;
            shape.element.style.height = `${shape.height}px`;
            shape.element.style.left = `${shape.x}px`;
            shape.element.style.top = `${shape.y}px`;
        }
    }

    // =====================================================
    // サイズ計算とレイアウト調整
    // =====================================================

    /**
     * 子要素に合わせて親シェイプのサイズを更新します。
     * 
     * @param {Object} shape - 親シェイプ
     */
    updateParentSize(shape) {
        if (!shape.children || shape.children.length === 0) return;

        if (shape.collapsed) {
            if (!shape.width) shape.width = CONFIG.FLOWCHART.SHAPE.WIDTH;
            if (!shape.height) shape.height = CONFIG.FLOWCHART.SHAPE.HEIGHT;
        } else {
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

            // 子要素がない場合などは処理しない
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

        this.updateShapeDOM(shape);
    }

    /**
     * グループの展開/折りたたみに伴うレイアウト調整を行います。
     * 他のノードが重ならないように移動させます。
     */
    adjustLayout(sourceShape, deltaX, deltaY, oldWidth, oldHeight) {
        const checkWidth = oldWidth ?? sourceShape.width;
        const checkHeight = oldHeight ?? sourceShape.height;

        const oldRight = sourceShape.x + checkWidth;
        const oldBottom = sourceShape.y + checkHeight;
        const newRight = sourceShape.x + sourceShape.width;
        const newBottom = sourceShape.y + sourceShape.height;

        const sourceParentId = sourceShape.parent;

        const effectiveDeltaX = this.calculateEffectiveDelta(
            deltaX, sourceShape, 'x', oldRight, newRight, sourceParentId
        );
        const effectiveDeltaY = this.calculateEffectiveDelta(
            deltaY, sourceShape, 'y', oldBottom, newBottom, sourceParentId
        );

        this.shapes.forEach(shape => {
            if (shape.id === sourceShape.id) return;
            if (this.isDescendant(sourceShape.id, shape.id)) return;
            if (!this.isSameLevel(shape, sourceParentId)) return;

            let dx = 0;
            let dy = 0;

            if (effectiveDeltaX !== 0) {
                if (deltaX > 0) {
                    const shapeEnd = shape.x + shape.width;
                    if (shapeEnd > oldRight) {
                        dx = effectiveDeltaX;
                    }
                } else {
                    if (shape.x >= oldRight) {
                        dx = effectiveDeltaX;
                    }
                }
            }

            if (effectiveDeltaY !== 0) {
                if (deltaY > 0) {
                    const shapeEnd = shape.y + shape.height;
                    if (shapeEnd > oldBottom) {
                        dy = effectiveDeltaY;
                    }
                } else {
                    if (shape.y >= oldBottom) {
                        dy = effectiveDeltaY;
                    }
                }
            }

            if (dx !== 0 || dy !== 0) {
                this.moveShape(shape, dx, dy);
            }
        });
    }

    /**
     * シェイプを移動させます（再帰的）。
     * ShapeManagerのmoveShapeと重複しますが、GroupManager内で完結させるため実装します。
     */
    moveShape(shape, dx, dy) {
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
                    this.moveShape(child, dx, dy);
                }
            });
        }
    }

    calculateEffectiveDelta(delta, sourceShape, axis, oldEdge, newEdge, sourceParentId) {
        if (delta < 0) {
            const blockingNode = this.findBlockingExpandedNode(
                newEdge, oldEdge, axis, sourceShape.id, sourceParentId
            );
            return this.calculateAdjustedDeltaForCollapse(delta, blockingNode, oldEdge);
        } else if (delta > 0) {
            const hasOverlap = this.checkExpandOverlap(sourceShape, axis, oldEdge);
            return hasOverlap ? delta : 0;
        }
        return 0;
    }

    isSameLevel(shape, sourceParentId) {
        if (sourceParentId) {
            return shape.parent === sourceParentId;
        } else {
            return !shape.parent;
        }
    }

    findBlockingExpandedNode(newEdge, oldEdge, axis, sourceId, sourceParentId) {
        for (const [id, shape] of this.shapes) {
            if (id === sourceId) continue;
            if (!shape.children || shape.children.length === 0) continue;
            if (shape.collapsed) continue;
            if (this.isDescendant(sourceId, id)) continue;
            if (!this.isSameLevel(shape, sourceParentId)) continue;

            const { start, end } = this.getShapeEdge(shape, axis);

            if (end > newEdge && start < oldEdge) {
                return { shapeStart: start, shapeEnd: end };
            }
        }
        return null;
    }

    calculateAdjustedDeltaForCollapse(delta, blockingNode, oldEdge) {
        if (!blockingNode) {
            return delta;
        }
        const adjustedDelta = blockingNode.shapeEnd - oldEdge;
        return (adjustedDelta >= 0) ? 0 : adjustedDelta;
    }

    checkExpandOverlap(sourceShape, axis, oldEdge) {
        const newEdge = this.getShapeEdge(sourceShape, axis).end;

        for (const [id, shape] of this.shapes) {
            if (id === sourceShape.id) continue;
            if (this.isDescendant(sourceShape.id, id)) continue;
            if (shape.parent) continue;

            const { start, end } = this.getShapeEdge(shape, axis);

            if (end > oldEdge && start < newEdge) {
                return true;
            }
        }
        return false;
    }

    getShapeEdge(shape, axis) {
        if (axis === 'x') {
            return { start: shape.x, end: shape.x + shape.width };
        } else {
            return { start: shape.y, end: shape.y + shape.height };
        }
    }
}
