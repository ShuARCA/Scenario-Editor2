/**
 * ルビ管理
 * 
 * ルビ（振り仮名）の挿入・編集・削除とルビパネルを担当します。
 * 
 * @module managers/RubyManager
 */

import { PanelPositioner } from '../ui/PanelPositioner.js';

/**
 * ルビ管理クラス
 */
export class RubyManager {
    /**
     * RubyManagerのコンストラクタ
     * 
     * @param {Object} editorCore - EditorManagerまたはEditorCoreへの参照
     */
    constructor(editorCore) {
        /** @type {Object} エディタへの参照 */
        this.editor = editorCore;

        /** @type {PanelPositioner} 位置計算ユーティリティ */
        this.positioner = new PanelPositioner();

        /** @type {Object|null} 編集中のルビ情報 */
        this.currentRubyTarget = null;

        // DOM参照
        this.rubyPanel = document.getElementById('ruby-panel');
        this.rubyInput = document.getElementById('ruby-input');
        this.rubyApplyBtn = document.getElementById('ruby-apply-btn');
        this.rubyDeleteBtn = document.getElementById('ruby-delete-btn');
        this.rubyBtn = document.getElementById('rubyBtn');
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * ルビパネルをセットアップします。
     */
    setupRubyPanel() {
        if (!this.rubyPanel) return;

        // 適用ボタン
        if (this.rubyApplyBtn) {
            this.rubyApplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._applyRubyFromPanel();
            });
        }

        // 削除ボタン
        if (this.rubyDeleteBtn) {
            this.rubyDeleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._deleteRubyFromPanel();
            });
        }

        // Enterキーで適用
        if (this.rubyInput) {
            this.rubyInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._applyRubyFromPanel();
                } else if (e.key === 'Escape') {
                    this.hideRubyPanel();
                }
            });
        }

        // パネル外クリックで閉じる
        document.addEventListener('mousedown', (e) => {
            if (this.rubyPanel &&
                !this.rubyPanel.classList.contains('hidden') &&
                !this.rubyPanel.contains(e.target) &&
                e.target !== this.rubyBtn) {
                this.hideRubyPanel();
            }
        });
    }

    // =====================================================
    // ルビ操作
    // =====================================================

    /**
     * ルビを挿入/編集します。
     */
    insertRuby() {
        if (!this.editor.tiptap) return;

        const { from, to, empty } = this.editor.tiptap.state.selection;

        // 選択範囲がない場合は何もしない
        if (empty || from === to) return;

        // 既存のルビを検出
        const rubyInfo = this.detectExistingRuby();

        this.showRubyPanel(rubyInfo);
    }

    /**
     * 選択範囲にルビを設定します。
     * 
     * @param {string} rubyText - ルビテキスト
     * @returns {boolean} 操作が成功したかどうか
     */
    setRuby(rubyText) {
        if (!this.editor.tiptap) return false;
        return this.editor.tiptap.chain().focus().setRuby(rubyText).run();
    }

    /**
     * ルビを更新します。
     * 
     * @param {string} newRubyText - 新しいルビテキスト
     * @returns {boolean} 操作が成功したかどうか
     */
    updateRuby(newRubyText) {
        if (!this.editor.tiptap) return false;
        return this.editor.tiptap.chain().focus().updateRuby(newRubyText).run();
    }

    /**
     * ルビを削除します。
     * 
     * @returns {boolean} 操作が成功したかどうか
     */
    removeRuby() {
        if (!this.editor.tiptap) return false;
        return this.editor.tiptap.chain().focus().unsetRuby().run();
    }

    /**
     * 選択範囲内の既存ルビ要素を検出します。
     * 
     * @returns {{firstRuby: Object|null, allRubies: Array}} ルビ情報
     */
    detectExistingRuby() {
        if (!this.editor.tiptap) {
            return { firstRuby: null, allRubies: [] };
        }

        const { from, to } = this.editor.tiptap.state.selection;
        const allRubies = [];
        let firstRuby = null;

        this.editor.tiptap.state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'ruby') {
                const rubyData = {
                    rubyNode: node,
                    rubyText: node.attrs.rubyText || '',
                    baseText: node.textContent || '',
                    nodePos: pos
                };
                allRubies.push(rubyData);
                if (!firstRuby) {
                    firstRuby = rubyData;
                }
            }
        });

        return { firstRuby, allRubies };
    }

    // =====================================================
    // パネル表示/非表示
    // =====================================================

    /**
     * ルビパネルを表示します。
     * 
     * @param {Object} rubyInfo - 既存ルビ情報
     */
    showRubyPanel(rubyInfo = null) {
        if (!this.rubyPanel || !this.rubyInput) return;

        // 既存ルビがある場合は編集モード
        if (rubyInfo?.firstRuby) {
            this.currentRubyTarget = rubyInfo.firstRuby;
            this.rubyInput.value = rubyInfo.firstRuby.rubyText || '';
            if (this.rubyDeleteBtn) {
                this.rubyDeleteBtn.classList.remove('hidden');
            }
        } else {
            this.currentRubyTarget = null;
            this.rubyInput.value = '';
            if (this.rubyDeleteBtn) {
                this.rubyDeleteBtn.classList.add('hidden');
            }
        }

        // 位置計算
        const position = this._calculatePanelPosition();
        if (position) {
            this.rubyPanel.style.top = `${position.top}px`;
            this.rubyPanel.style.left = `${position.left}px`;
        }

        this.rubyPanel.classList.remove('hidden');

        // 入力フィールドにフォーカス
        setTimeout(() => {
            this.rubyInput.focus();
            this.rubyInput.select();
        }, 10);
    }

    /**
     * ルビパネルを非表示にします。
     */
    hideRubyPanel() {
        if (this.rubyPanel) {
            this.rubyPanel.classList.add('hidden');
        }
        this.currentRubyTarget = null;
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * パネル位置を計算します。
     * 
     * @returns {{top: number, left: number}|null}
     * @private
     */
    _calculatePanelPosition() {
        // ルビボタンを基準にする
        if (this.rubyBtn) {
            return this.positioner.calculateFromAnchor(this.rubyBtn, {
                offsetY: 8,
                panelWidth: 200,
                panelHeight: 80
            });
        }

        // フォールバック: 選択範囲から計算
        return this.positioner.calculateFromSelection({
            panelWidth: 200,
            panelHeight: 80
        });
    }

    /**
     * ルビパネルからルビを適用します。
     * 
     * @private
     */
    _applyRubyFromPanel() {
        if (!this.rubyInput) return;

        const rubyText = this.rubyInput.value.trim();
        if (!rubyText) {
            this.hideRubyPanel();
            return;
        }

        if (this.currentRubyTarget) {
            // 編集モード
            this.updateRuby(rubyText);
        } else {
            // 新規作成
            this.setRuby(rubyText);
        }

        this.hideRubyPanel();
    }

    /**
     * ルビパネルからルビを削除します。
     * 
     * @private
     */
    _deleteRubyFromPanel() {
        if (this.currentRubyTarget) {
            this.removeRuby();
        }
        this.hideRubyPanel();
    }
}
