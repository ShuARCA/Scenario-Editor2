/**
 * 展開固定（Inline）グループ表示ストラテジー
 * 
 * グループの子ノードを親ノード内に常時表示（展開固定）するストラテジーです。
 * 折りたたみ機能は持たず、子ノードの配置に合わせて親ノードのサイズが自動計算されます。
 * 
 * @module flowchart/InlineGroupStrategy
 */

import { CONFIG } from '../core/Config.js';
import { BaseGroupStrategy } from './BaseGroupStrategy.js';

export class InlineGroupStrategy extends BaseGroupStrategy {
    /**
     * ストラテジーの識別子
     * @type {string}
     */
    get mode() {
        return 'inline';
    }

    /**
     * シェイプのスタイルを更新します。
     * inline モードでは親ノードに group-parent クラスを付与します。
     * 
     * @param {Object} shape - 対象の親シェイプ
     */
    updateStyle(shape) {
        if (!shape.element) return;

        this.clearGroupStyles(shape);

        if (shape.children?.length > 0) {
            shape.element.classList.add('group-parent');
        }
    }

    /**
     * 子ノードの位置に合わせて親シェイプのサイズ・位置を更新します。
     * 
     * @param {Object} shape - 親シェイプ
     */
    updateParentSize(shape) {
        if (!shape.children || shape.children.length === 0) return;

        // 子要素のバウンディングボックスを計算
        const box = this.groupManager.getBoundingBox(shape.children);
        if (!box) return;

        const padding = CONFIG.FLOWCHART.LAYOUT?.GROUP_PADDING || 20;
        const headerHeight = CONFIG.FLOWCHART.LAYOUT?.GROUP_HEADER_HEIGHT || 40;

        const newX = Math.min(shape.x, box.minX - padding);
        const newY = Math.min(shape.y, box.minY - headerHeight - padding);
        const newWidth = Math.max(shape.width, (box.maxX - newX) + padding);
        const newHeight = Math.max(shape.height, (box.maxY - newY) + padding);

        shape.x = newX;
        shape.y = newY;
        shape.width = newWidth;
        shape.height = newHeight;

        this.groupManager.updateShapeDOM(shape);

        // 祖先グループがある場合は再帰的に祖先のサイズも更新
        if (shape.parent) {
            const parent = this.shapes.get(shape.parent);
            if (parent) {
                this.groupManager.updateParentSize(parent);
            }
        }
    }

    /**
     * グループ構成変更時の処理
     * 
     * @param {Object} shape - 親シェイプ
     */
    onGroupChanged(shape) {
        this.updateStyle(shape);
        this.updateParentSize(shape);
        this.setChildrenVisibility(shape, true);
    }
}
