/**
 * オーバーレイ（Overlay）グループ表示ストラテジー
 * 
 * グループの子ノードをポップアップオーバーレイキャンバス内で表示・編集するストラテジーです。
 * 親ノードは通常サイズのままで、親ノード右上の「＋」ボタンをクリックすることで
 * オーバーレイキャンバスが開き、子ノードの確認・編集が可能になります。
 * 
 * @module flowchart/OverlayGroupStrategy
 */

import { CONFIG } from '../core/Config.js';
import { BaseGroupStrategy } from './BaseGroupStrategy.js';
import { OverlayCanvas } from './OverlayCanvas.js';

export class OverlayGroupStrategy extends BaseGroupStrategy {
    /**
     * @param {import('./GroupManager.js').GroupManager} groupManager - GroupManagerへの参照
     */
    constructor(groupManager) {
        super(groupManager);

        /** @type {Map<string, OverlayCanvas>} アクティブなオーバーレイのマップ (shapeId -> OverlayCanvas) */
        this.openOverlays = new Map();
    }

    /**
     * ストラテジーの識別子
     * @type {string}
     */
    get mode() {
        return 'overlay';
    }

    /**
     * 当該ストラテジーにおける子ノード群の実際の表示フラグを算出します。
     * オーバーレイが開いており、かつ先祖オーバーレイもすべて開いている場合のみ表示されます。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {boolean} visible - 要求された表示フラグ
     * @returns {boolean}
     */
    resolveVisibility(shape, visible) {
        if (!this.isOverlayOpen(shape.id)) return false;
        return super.resolveVisibility(shape, visible);
    }

    /**
     * シェイプのスタイルを更新します。
     * 親ノードに group-parent-overlay クラスと「＋」ボタンを付与します。
     * 
     * @param {Object} shape - 対象の親シェイプ
     */
    updateStyle(shape) {
        if (!shape.element) return;

        const hasChildren = shape.children?.length > 0;

        this.clearGroupStyles(shape);

        if (hasChildren) {
            shape.element.classList.add('group-parent-overlay');

            let btn = shape.element.querySelector('.group-overlay-btn');
            if (!btn) {
                btn = document.createElement('div');
                btn.className = 'group-overlay-btn';
                btn.textContent = '+';
                btn.title = 'オーバーレイキャンバスの表示／非表示';

                btn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleOverlay(shape);
                });

                // ダブルクリックで親ノードのコンテキストメニューが開かないよう抑止
                btn.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                });

                // 右クリックでコンテキストメニューが開かないよう抑止
                btn.addEventListener('contextmenu', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                });

                shape.element.appendChild(btn);
            }

            // 開いている状態ならボタンを開閉アクティブ表示
            btn.classList.toggle('active', this.isOverlayOpen(shape.id));
        } else {
            this.closeOverlay(shape);
        }
    }

    /**
     * 親シェイプのサイズを更新します。
     * overlay モードでは親ノードは独立したノードサイズを維持します。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {boolean} [forceReset=false] - inlineモードからの切り替え時など、強制的に通常サイズへリセットするか
     */
    updateParentSize(shape, forceReset = false) {
        if (forceReset) {
            if (shape.overlaySize) {
                shape.width = shape.overlaySize.width;
                shape.height = shape.overlaySize.height;
            } else {
                const defaultW = CONFIG.FLOWCHART.SHAPE?.WIDTH || 120;
                const defaultH = CONFIG.FLOWCHART.SHAPE?.HEIGHT || 36;
                shape.width = defaultW;
                shape.height = defaultH;
                shape.overlaySize = { width: defaultW, height: defaultH };
            }
        } else {
            // 通常時（復元時や構成変更時）：
            // 現在の shape.width / height（ユーザーが指定・変更した親ノードのサイズ）をそのまま維持
            shape.overlaySize = { width: shape.width, height: shape.height };
        }

        this.groupManager.updateShapeDOM(shape);
    }

    /**
     * グループ構成変更時の処理
     * 
     * @param {Object} shape - 親シェイプ
     */
    onGroupChanged(shape) {
        this.updateStyle(shape);
        this.updateParentSize(shape);

        // オーバーレイが開いていれば子の表示同期＋枠のサイズ同期（手動サイズ保護のためexpand）
        const overlay = this.openOverlays.get(shape.id);
        if (overlay) {
            this.setChildrenVisibility(shape, true);
            overlay.updateAreaBounds('expand');
        } else {
            this.setChildrenVisibility(shape, false);
        }
    }

    // =====================================================
    // オーバーレイ固有のライフサイクル管理
    // =====================================================

    /**
     * オーバーレイを開きます。
     * 
     * @param {Object} shape - 親シェイプ
     */
    openOverlay(shape) {
        if (this.openOverlays.has(shape.id)) return;

        const overlay = new OverlayCanvas(shape, this);
        this.openOverlays.set(shape.id, overlay);
        overlay.open();

        // 閉じたときのクリーンアップをフック
        const originalClose = overlay.close.bind(overlay);
        overlay.close = (isCascading = false) => {
            // Mapから先に削除することで、originalClose内のdrawConnections()が
            // isOverlayOpen()===false を正しく参照できるようにする
            this.openOverlays.delete(shape.id);
            originalClose(isCascading);
        };
    }

    /**
     * オーバーレイを閉じます。
     * 
     * @param {Object} shape - 親シェイプ
     * @param {boolean} [isCascading=false] - 親オーバーレイの閉鎖に伴う連動クローズかどうか
     */
    closeOverlay(shape, isCascading = false) {
        const overlay = this.openOverlays.get(shape.id);
        if (overlay) {
            overlay.close(isCascading);
            this.openOverlays.delete(shape.id);
        }
    }

    /**
     * 開いているすべてのオーバーレイを閉じます。
     */
    closeAllOverlays() {
        const overlays = Array.from(this.openOverlays.values());
        overlays.forEach(overlay => {
            overlay.close();
        });
        this.openOverlays.clear();
    }

    /**
     * 開いているすべてのオーバーレイの選択（アクティブ）状態を解除します。
     */
    clearOverlaySelection() {
        this.openOverlays.forEach(overlay => overlay.deselect());
    }

    /**
     * 現在選択中のすべてのオーバーレイキャンバスを取得します。
     * @returns {Array<OverlayCanvas>}
     */
    getSelectedOverlays() {
        const selected = [];
        for (const [, overlay] of this.openOverlays) {
            if (overlay.isSelected()) {
                selected.push(overlay);
            }
        }
        return selected;
    }

    /**
     * オーバーレイの開閉をトグルします。
     * 
     * @param {Object} shape - 親シェイプ
     */
    toggleOverlay(shape) {
        if (this.isOverlayOpen(shape.id)) {
            this.closeOverlay(shape);
        } else {
            this.openOverlay(shape);
        }
    }

    /**
     * 指定のグループのオーバーレイが開いているかどうかを返します。
     * 
     * @param {string} shapeId - シェイプID
     * @returns {boolean}
     */
    isOverlayOpen(shapeId) {
        return this.openOverlays.has(shapeId);
    }
}
