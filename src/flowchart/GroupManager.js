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
        const oldX = shape.x;
        const oldY = shape.y;

        shape.collapsed = !shape.collapsed;

        const toggle = shape.element.querySelector('.group-toggle');
        if (toggle) toggle.textContent = shape.collapsed ? '+' : '-';

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

        // レイアウト調整（右端・下端の移動量に基づいて移動）
        const oldRight = oldX + oldWidth;
        const oldBottom = oldY + oldHeight;
        const newRight = shape.x + shape.width;
        const newBottom = shape.y + shape.height;

        const moveX = newRight - oldRight;
        const moveY = newBottom - oldBottom;

        if (moveX !== 0 || moveY !== 0) {
            this.adjustLayout(shape, moveX, moveY, oldRight, oldBottom);
        }

        // 親階層へのサイズ更新とレイアウト調整の伝播
        if (shape.parent) {
            this.updateAncestorsLayout(shape.parent);
        }

        // 子要素の表示/非表示（レイアウト調整後に実行することで誤衝突を防ぐ）
        this.setChildrenVisibility(shape, !shape.collapsed);

        this.app.drawConnections();
    }

    /**
     * 親階層を遡ってサイズ更新とレイアウト調整を行います。
     * 子ノードの変更（展開など）により親ノードが拡大した場合、
     * 親ノードの兄弟ノードなども退避させる必要があります。
     * 
     * @param {string} startParentId - 開始する親ID
     */
    updateAncestorsLayout(startParentId) {
        let currentId = startParentId;

        while (currentId) {
            const parent = this.shapes.get(currentId);
            if (!parent) break;

            const oldWidth = parent.width;
            const oldHeight = parent.height;
            const oldX = parent.x;
            const oldY = parent.y;
            const oldRight = oldX + oldWidth;
            const oldBottom = oldY + oldHeight;

            // 親のサイズを更新
            this.updateParentSize(parent);

            // レイアウト調整
            const newRight = parent.x + parent.width;
            const newBottom = parent.y + parent.height;
            const moveX = newRight - oldRight;
            const moveY = newBottom - oldBottom;

            if (moveX !== 0 || moveY !== 0) {
                this.adjustLayout(parent, moveX, moveY, oldRight, oldBottom);
            }

            currentId = parent.parent;
        }
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
     * 
     * 仕様:
     * - 移動対象: ソースノードの操作前の右下座標より右または下に左上座標があるノード（境界含む）
     * - 移動量: 
     *   - 右にだけあるノード → X だけ移動
     *   - 下にだけあるノード → Y だけ移動
     *   - 右かつ下にあるノード → X と Y 両方移動
     * 
     * @param {Object} sourceShape - 展開/折りたたみを行ったシェイプ
     * @param {number} moveX - 右端の移動量
     * @param {number} moveY - 下端の移動量
     * @param {number} oldRight - 操作前の右端座標
     * @param {number} oldBottom - 操作前の下端座標
     */
    adjustLayout(sourceShape, moveX, moveY, oldRight, oldBottom) {
        const sourceParentId = sourceShape.parent;

        // 移動対象のノードを特定して移動
        this.shapes.forEach(shape => {
            // 自分自身は除外
            if (shape.id === sourceShape.id) return;
            // 自分の子孫は除外
            if (this.isDescendant(sourceShape.id, shape.id)) return;
            // 同じ階層のノードのみ対象
            if (!this.isSameLevel(shape, sourceParentId)) return;

            // 左上座標がソースの操作前の右下より右にあるか
            const isRight = shape.x >= oldRight;
            // 左上座標がソースの操作前の右下より下にあるか
            const isBelow = shape.y >= oldBottom;

            // 移動対象でない場合はスキップ
            if (!isRight && !isBelow) return;

            // 移動量を計算
            const dx = isRight ? moveX : 0;
            const dy = isBelow ? moveY : 0;

            this.moveShape(shape, dx, dy);
        });
    }

    /**
     * シェイプを移動させます（再帰的）。
     * ShapeManagerのmoveShapeと重複しますが、GroupManager内で完結させるため実装します。
     * 
     * @param {Object} shape - 移動するシェイプ
     * @param {number} dx - X方向の移動量
     * @param {number} dy - Y方向の移動量
     */
    moveShape(shape, dx, dy) {
        shape.x += dx;
        shape.y += dy;

        if (shape.element) {
            shape.element.style.left = `${shape.x}px`;
            shape.element.style.top = `${shape.y}px`;
        }

        // 子要素も再帰的に移動
        if (shape.children) {
            shape.children.forEach(childId => {
                const child = this.shapes.get(childId);
                if (child) {
                    this.moveShape(child, dx, dy);
                }
            });
        }
    }

    /**
     * 2つのシェイプが同じ階層にあるか判定します。
     * 
     * @param {Object} shape - 判定対象のシェイプ
     * @param {string|null} sourceParentId - ソースシェイプの親ID
     * @returns {boolean}
     */
    isSameLevel(shape, sourceParentId) {
        if (sourceParentId) {
            return shape.parent === sourceParentId;
        } else {
            return !shape.parent;
        }
    }
}
