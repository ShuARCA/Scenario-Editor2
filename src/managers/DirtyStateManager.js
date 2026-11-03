/**
 * 未保存変更状態マネージャー
 * 
 * アプリケーション内の未保存変更（ダーティ状態）を管理し、
 * 未保存データがある場合のブラウザ離脱（タブ閉じ・リロード等）を防止します。
 * 
 * 責務:
 * - ダーティ状態（isDirty）の保持と管理
 * - beforeunload リスナーの動的な登録・解除（ダーティ時のみ登録）
 * - ファイル読み込み処理中などの誤検知を防ぐサスペンド（一時停止）機能
 * - EventBus を通じた状態変化通知
 * 
 * @module managers/DirtyStateManager
 */
export class DirtyStateManager {
    /**
     * @param {import('../core/EventBus.js').EventBus} [eventBus] - イベントバス
     */
    constructor(eventBus = null) {
        /** @type {import('../core/EventBus.js').EventBus|null} */
        this.eventBus = eventBus;

        /** @type {boolean} 未保存の変更があるかどうか */
        this._isDirty = false;

        /** @type {boolean} 変更検知を一時停止中かどうか（ファイル読み込み中など） */
        this._isSuspended = false;

        /** @type {boolean} beforeunload リスナーが現在 window に登録されているか */
        this._isListening = false;

        /** @type {Function} beforeunload イベントハンドラ */
        this._beforeUnloadHandler = this._handleBeforeUnload.bind(this);
    }

    /**
     * 現在未保存の変更があるかどうかを取得します。
     * @returns {boolean}
     */
    isDirty() {
        return this._isDirty;
    }

    /**
     * 現在変更検知がサスペンド中かどうかを取得します。
     * @returns {boolean}
     */
    isSuspended() {
        return this._isSuspended;
    }

    /**
     * 未保存の変更が発生したことを記録し、離脱警告を有効化します。
     */
    markDirty() {
        if (this._isSuspended) return;

        if (!this._isDirty) {
            this._isDirty = true;
            this._attachBeforeUnload();
            if (this.eventBus) {
                this.eventBus.emit('dirty:changed', true);
            }
        }
    }

    /**
     * 変更が保存された（または読み込まれた）ことを記録し、離脱警告を解除します。
     */
    markClean() {
        if (this._isDirty) {
            this._isDirty = false;
            this._detachBeforeUnload();
            if (this.eventBus) {
                this.eventBus.emit('dirty:changed', false);
            }
        }
    }

    /**
     * ファイル読み込み時など、プログラムによる一括変更中に一時的にダーティ検知を停止します。
     */
    suspend() {
        this._isSuspended = true;
    }

    /**
     * ダーティ検知の一時停止を解除します。
     * @param {boolean} [resetClean=false] - 解除と同時にクリーン状態（未保存なし）にリセットするかどうか
     */
    resume(resetClean = false) {
        this._isSuspended = false;
        if (resetClean) {
            this.markClean();
        }
    }

    /**
     * beforeunload イベントハンドラ
     * @private
     * @param {BeforeUnloadEvent} event
     * @returns {string|void}
     */
    _handleBeforeUnload(event) {
        if (!this._isDirty) return;

        // 標準的なブラウザ離脱防止処理
        event.preventDefault();
        event.returnValue = ''; // Chrome等の仕様で空文字列または真値が必要
        return '';
    }

    /**
     * beforeunload リスナーを登録します。
     * @private
     */
    _attachBeforeUnload() {
        if (!this._isListening && typeof window !== 'undefined') {
            window.addEventListener('beforeunload', this._beforeUnloadHandler);
            this._isListening = true;
        }
    }

    /**
     * beforeunload リスナーを解除します。
     * @private
     */
    _detachBeforeUnload() {
        if (this._isListening && typeof window !== 'undefined') {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            this._isListening = false;
        }
    }

    /**
     * リソースを解放します。
     */
    destroy() {
        this._detachBeforeUnload();
    }
}

