/**
 * 編集ロック管理
 * 
 * アプリケーション全体の編集ロック（閲覧モード）を管理します。
 * EventBusを介してロック状態の変更を全コンポーネントに通知します。
 * 
 * @module managers/LockManager
 */

/**
 * Google Material Icon SVG（南京錠）
 * lock: ロック中アイコン
 * lock_open: ロック解除アイコン
 */
const LOCK_ICONS = {
    locked: `<svg class="icon" viewBox="0 -960 960 960" style="fill: var(--primary-color);">
        <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z"/>
    </svg>`,
    unlocked: `<svg class="icon" viewBox="0 -960 960 960">
        <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h360v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85H280q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280Z"/>
    </svg>`
};

/**
 * 編集ロック管理クラス
 * 
 * ロック状態のトグル、ヘッダーアイコンの切替、EventBusへの通知を担当します。
 */
export class LockManager {
    /**
     * LockManagerのコンストラクタ
     * 
     * @param {import('../core/EventBus.js').EventBus} eventBus - イベントバス
     */
    constructor(eventBus) {
        /** @type {import('../core/EventBus.js').EventBus} イベントバス */
        this.eventBus = eventBus;

        /** @type {boolean} ロック状態 */
        this._locked = false;

        /** @type {HTMLElement|null} ロックボタン要素 */
        this.lockBtn = document.getElementById('lockBtn');

        this._init();
    }

    /**
     * 初期化処理
     * @private
     */
    _init() {
        if (!this.lockBtn) {
            console.warn('LockManager: #lockBtn が見つかりません');
            return;
        }

        // アイコンを初期状態（アンロック）に設定
        this._updateIcon();

        // クリックイベント
        this.lockBtn.addEventListener('click', () => {
            this.toggle();
        });
    }

    /**
     * ロック状態を取得します。
     * 
     * @returns {boolean} ロック状態
     */
    isLocked() {
        return this._locked;
    }

    /**
     * ロック状態をトグルします。
     */
    toggle() {
        this.setLocked(!this._locked);
    }

    /**
     * ロック状態を設定します。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
        this._updateIcon();
        this._updateBodyClass();
        this.eventBus.emit('lock:changed', this._locked);
    }

    /**
     * ヘッダーアイコンの表示を更新します。
     * @private
     */
    _updateIcon() {
        if (!this.lockBtn) return;

        this.lockBtn.innerHTML = this._locked
            ? LOCK_ICONS.locked
            : LOCK_ICONS.unlocked;

        this.lockBtn.title = this._locked ? '編集ロック解除' : '編集をロック';
    }

    /**
     * bodyにロッククラスを追加/削除します。
     * CSS制御用のグローバルクラス。
     * @private
     */
    _updateBodyClass() {
        document.body.classList.toggle('locked', this._locked);
    }
}
