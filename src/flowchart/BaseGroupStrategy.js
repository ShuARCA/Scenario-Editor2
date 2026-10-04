/**
 * グループ表示ストラテジー 基底クラス
 * 
 * グループ表示モード（展開固定 / オーバーレイ等）に共通する
 * アクセサー、スタイル解除、子ノード群の再帰的可視性制御を提供します。
 * 
 * @module flowchart/BaseGroupStrategy
 */

export class BaseGroupStrategy {
    /**
     * @param {import('./GroupManager.js').GroupManager} groupManager - GroupManagerへの参照
     */
    constructor(groupManager) {
        /** @type {import('./GroupManager.js').GroupManager} */
        this.groupManager = groupManager;
    }

    /**
     * ストラテジーの識別子（サブクラスで実装）
     * @type {string}
     */
    get mode() {
        throw new Error('BaseGroupStrategy.mode getter must be implemented by subclass');
    }

    /**
     * FlowchartApp へのアクセサー
     */
    get app() {
        return this.groupManager.app;
    }

    /**
     * shapes Map へのアクセサー
     */
    get shapes() {
        return this.groupManager.shapes;
    }

    /**
     * シェイプ要素からグループ関連のスタイル・クラス・ボタンを共通クリアします。
     * 
     * @param {Object} shape - 対象シェイプ
     */
    clearGroupStyles(shape) {
        if (!shape.element) return;
        shape.element.classList.remove('group-parent', 'group-parent-overlay');
        shape.element.querySelector('.group-overlay-btn')?.remove();
        shape.element.querySelector('.group-toggle')?.remove();
    }

    /**
     * 当該ストラテジーにおける子ノード群の実際の表示フラグを算出します。
     * 先祖に閉じているオーバーレイグループがある場合、子は非表示になります。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {boolean} visible - 要求された表示フラグ
     * @returns {boolean} 実際に適用する表示フラグ
     */
    resolveVisibility(shape, visible) {
        if (!visible) return false;

        // 先祖グループを遡り、閉じているオーバーレイがあれば非表示
        let currentId = shape.parent;
        while (currentId) {
            const ancestor = this.shapes.get(currentId);
            if (!ancestor) break;
            if (ancestor.groupMode === 'overlay') {
                const overlayStrat = this.groupManager.overlayStrategy;
                if (overlayStrat && !overlayStrat.isOverlayOpen(ancestor.id)) {
                    return false;
                }
            }
            currentId = ancestor.parent;
        }

        return true;
    }

    /**
     * 子ノード群の表示/非表示を再帰的に設定します。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {boolean} [visible=true] - 表示フラグ
     */
    setChildrenVisibility(shape, visible = true) {
        if (!shape.children) return;

        const actualVisible = this.resolveVisibility(shape, visible);

        shape.children.forEach(childId => {
            const child = this.shapes.get(childId);
            if (!child?.element) return;

            child.element.style.display = actualVisible ? 'flex' : 'none';

            // 子ノード自身がグループ親の場合、その子のストラテジーに再帰委譲
            if (child.children?.length > 0) {
                const childStrategy = this.groupManager.getStrategy(child);
                childStrategy.setChildrenVisibility(child, actualVisible);
            }
        });
    }

    /**
     * データ復元時のグループ状態復元（デフォルト実装）
     * 
     * @param {Object} shape - 親シェイプ
     */
    restoreGroupState(shape) {
        this.updateStyle(shape);
        this.updateParentSize(shape);
        this.setChildrenVisibility(shape, this.mode === 'inline');
    }

    /**
     * シェイプのスタイルを更新します（サブクラスで実装）。
     * @param {Object} shape
     */
    updateStyle(shape) {
        throw new Error('updateStyle must be implemented by subclass');
    }

    /**
     * 親シェイプのサイズを更新します（サブクラスで実装）。
     * @param {Object} shape
     */
    updateParentSize(shape) {
        throw new Error('updateParentSize must be implemented by subclass');
    }

    /**
     * グループ構成変更時の処理（サブクラスで実装）。
     * @param {Object} shape
     */
    onGroupChanged(shape) {
        throw new Error('onGroupChanged must be implemented by subclass');
    }
}
