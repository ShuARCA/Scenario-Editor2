/**
 * 見出し表示管理
 * 
 * 見出し項目のサイドバー（アウトライン）表示および
 * フローチャートキャンバス上のノード描画の表示／非表示状態を管理します。
 * 
 * @module managers/HeadingVisibilityManager
 */

export class HeadingVisibilityManager {
    /**
     * @param {import('../core/EventBus.js').EventBus} eventBus - イベントバス
     * @param {Object} [options]
     */
    constructor(eventBus, options = {}) {
        /** @type {import('../core/EventBus.js').EventBus} */
        this.eventBus = eventBus;

        /** 
         * 見出しIDごとの表示状態マップ
         * @type {Map<string, { outlineVisible: boolean, flowchartVisible: boolean }>} 
         */
        this._states = new Map();

        /**
         * 親IDを解決するためのコールバック（オプション）
         * @type {((headingId: string) => string|null)|null}
         */
        this.parentResolver = options.parentResolver || null;
    }

    /**
     * 親IDを解決する関数を設定します。
     * @param {(headingId: string) => string|null} resolver
     */
    setParentResolver(resolver) {
        this.parentResolver = resolver;
    }

    /**
     * 見出しの表示設定を取得します（デフォルトは両方 true）。
     * @param {string} headingId
     * @returns {{ outlineVisible: boolean, flowchartVisible: boolean }}
     */
    getState(headingId) {
        if (!headingId) return { outlineVisible: true, flowchartVisible: true };
        const state = this._states.get(headingId);
        return {
            outlineVisible: state?.outlineVisible !== false,
            flowchartVisible: state?.flowchartVisible !== false
        };
    }

    /**
     * アウトラインでの表示状態を取得します（デフォルト true）。
     * 各項目は親子関係に関係なく独立して判定されます。
     * @param {string} headingId
     * @returns {boolean}
     */
    isOutlineVisible(headingId) {
        if (!headingId) return true;
        const state = this._states.get(headingId);
        return state?.outlineVisible !== false;
    }

    /**
     * フローチャートノード自身の表示設定を取得します（親の連動を考慮しない単体設定）。
     * @param {string} headingId
     * @returns {boolean}
     */
    isFlowchartSelfVisible(headingId) {
        if (!headingId) return true;
        const state = this._states.get(headingId);
        return state?.flowchartVisible !== false;
    }

    /**
     * フローチャートノードの実効表示状態を取得します。
     * 親ノードが非表示の場合、配下の子ノードも連動して非表示になります。
     * @param {string} headingId
     * @param {(id: string) => string|null} [customParentResolver]
     * @returns {boolean}
     */
    isNodeEffectivelyVisible(headingId, customParentResolver) {
        if (!headingId) return true;

        const resolver = customParentResolver || this.parentResolver;
        const visited = new Set();
        let curr = headingId;

        while (curr) {
            if (visited.has(curr)) break; // 循環参照ガード
            visited.add(curr);

            if (!this.isFlowchartSelfVisible(curr)) {
                return false;
            }

            if (!resolver) break;
            curr = resolver(curr);
        }

        return true;
    }

    /**
     * アウトラインの表示状態を設定します。
     * @param {string} headingId
     * @param {boolean} visible
     */
    setOutlineVisible(headingId, visible) {
        if (!headingId) return;
        const current = this.getState(headingId);
        if (current.outlineVisible === visible) return;

        this._ensureState(headingId).outlineVisible = visible;
        this._emitChange({ type: 'outline', headingId, visible });
    }

    /**
     * フローチャートノードの表示設定を設定します。
     * @param {string} headingId
     * @param {boolean} visible
     */
    setFlowchartVisible(headingId, visible) {
        if (!headingId) return;
        const current = this.getState(headingId);
        if (current.flowchartVisible === visible) return;

        this._ensureState(headingId).flowchartVisible = visible;
        this._emitChange({ type: 'flowchart', headingId, visible });
    }

    /**
     * アウトライン表示を反転します。
     * @param {string} headingId
     * @returns {boolean} 新しい表示状態
     */
    toggleOutlineVisible(headingId) {
        const next = !this.isOutlineVisible(headingId);
        this.setOutlineVisible(headingId, next);
        return next;
    }

    /**
     * フローチャートノード表示を反転します。
     * @param {string} headingId
     * @returns {boolean} 新しい表示状態
     */
    toggleFlowchartVisible(headingId) {
        const next = !this.isFlowchartSelfVisible(headingId);
        this.setFlowchartVisible(headingId, next);
        return next;
    }

    /**
     * 特定の見出しレベル（H1〜H6）のアウトライン表示を一括設定します。
     * @param {Array<{ id: string, level: number }>} headings - 見出し一覧
     * @param {number} level - 対象の見出しレベル
     * @param {boolean} visible - 設定する表示状態
     */
    setLevelOutlineVisible(headings, level, visible) {
        if (!Array.isArray(headings)) return;
        let changed = false;

        headings.forEach(h => {
            if (h.level === level) {
                const s = this._ensureState(h.id);
                if (s.outlineVisible !== visible) {
                    s.outlineVisible = visible;
                    changed = true;
                }
            }
        });

        if (changed) {
            this._emitChange({ type: 'level:outline', level, visible, batch: true });
        }
    }

    /**
     * 特定の見出しレベル（H1〜H6）のフローチャート表示を一括設定します。
     * @param {Array<{ id: string, level: number }>} headings - 見出し一覧
     * @param {number} level - 対象の見出しレベル
     * @param {boolean} visible - 設定する表示状態
     */
    setLevelFlowchartVisible(headings, level, visible) {
        if (!Array.isArray(headings)) return;
        let changed = false;

        headings.forEach(h => {
            if (h.level === level) {
                const s = this._ensureState(h.id);
                if (s.flowchartVisible !== visible) {
                    s.flowchartVisible = visible;
                    changed = true;
                }
            }
        });

        if (changed) {
            this._emitChange({ type: 'level:flowchart', level, visible, batch: true });
        }
    }

    /**
     * すべての見出しのアウトライン表示を一括設定します。
     * @param {Array<{ id: string }>} headings
     * @param {boolean} visible
     */
    setAllOutlineVisible(headings, visible) {
        if (!Array.isArray(headings)) return;
        let changed = false;

        headings.forEach(h => {
            const s = this._ensureState(h.id);
            if (s.outlineVisible !== visible) {
                s.outlineVisible = visible;
                changed = true;
            }
        });

        if (changed) {
            this._emitChange({ type: 'all:outline', visible, batch: true });
        }
    }

    /**
     * すべての見出しのフローチャートノード表示を一括設定します。
     * @param {Array<{ id: string }>} headings
     * @param {boolean} visible
     */
    setAllFlowchartVisible(headings, visible) {
        if (!Array.isArray(headings)) return;
        let changed = false;

        headings.forEach(h => {
            const s = this._ensureState(h.id);
            if (s.flowchartVisible !== visible) {
                s.flowchartVisible = visible;
                changed = true;
            }
        });

        if (changed) {
            this._emitChange({ type: 'all:flowchart', visible, batch: true });
        }
    }

    /**
     * 内部Stateオブジェクトを取得または生成します。
     * @private
     * @param {string} headingId
     * @returns {{ outlineVisible: boolean, flowchartVisible: boolean }}
     */
    _ensureState(headingId) {
        let s = this._states.get(headingId);
        if (!s) {
            s = { outlineVisible: true, flowchartVisible: true };
            this._states.set(headingId, s);
        }
        return s;
    }

    /**
     * 変更イベントを発行します。
     * @private
     * @param {Object} payload
     */
    _emitChange(payload) {
        if (this.eventBus) {
            this.eventBus.emit('heading:visibility:changed', payload);
        }
    }

    /**
     * シリアライズ可能なJSONオブジェクトとして状態を取得します。
     * デフォルト（両方true）以外の項目のみを保存してデータ量を最小化します。
     * @returns {Record<string, { outlineVisible?: boolean, flowchartVisible?: boolean }>}
     */
    serialize() {
        const result = {};
        for (const [id, state] of this._states.entries()) {
            const item = {};
            if (state.outlineVisible === false) {
                item.outlineVisible = false;
            }
            if (state.flowchartVisible === false) {
                item.flowchartVisible = false;
            }
            if (Object.keys(item).length > 0) {
                result[id] = item;
            }
        }
        return result;
    }

    /**
     * シリアライズデータから状態を復元します。
     * @param {Record<string, { outlineVisible?: boolean, flowchartVisible?: boolean }>|null} data
     */
    deserialize(data) {
        this._states.clear();
        if (data && typeof data === 'object') {
            for (const [id, val] of Object.entries(data)) {
                if (val && typeof val === 'object') {
                    this._states.set(id, {
                        outlineVisible: val.outlineVisible !== false,
                        flowchartVisible: val.flowchartVisible !== false
                    });
                }
            }
        }
        this._emitChange({ type: 'restored', batch: true });
    }

    /**
     * 存在しなくなった見出しIDのクリーンアップを行います。
     * @param {Set<string>} validHeadingIds - 現在存在する見出しIDのセット
     */
    cleanup(validHeadingIds) {
        if (!validHeadingIds) return;
        for (const id of this._states.keys()) {
            if (!validHeadingIds.has(id)) {
                this._states.delete(id);
            }
        }
    }
}
