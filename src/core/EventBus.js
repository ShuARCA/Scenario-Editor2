/**
 * イベントバス
 * 
 * アプリケーション内のモジュール間通信を管理します。
 * Pub/Subパターンにより、モジュール間の疎結合を実現します。
 * 
 * @module core/EventBus
 */

/**
 * イベントバスクラス
 * モジュール間の通信を仲介し、疎結合を実現します。
 */
export class EventBus {
    /**
     * EventBusのコンストラクタ
     */
    constructor() {
        /** @type {Object.<string, Function[]>} イベント名とコールバック関数のマップ */
        this.listeners = {};
    }

    /**
     * イベントリスナーを登録します。
     * 
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     * @returns {void}
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * イベントリスナーを削除します。
     * 
     * @param {string} event - イベント名
     * @param {Function} callback - 削除するコールバック関数
     * @returns {void}
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    /**
     * イベントを発火させます。
     * 登録されているすべてのリスナーにイベントデータを配信します。
     * 
     * @param {string} event - イベント名
     * @param {*} data - イベントデータ
     * @returns {void}
     */
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => callback(data));
    }

    /**
     * 指定したイベントのすべてのリスナーを削除します。
     * 
     * @param {string} event - イベント名
     * @returns {void}
     */
    removeAllListeners(event) {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
        }
    }

    /**
     * イベントにリスナーが登録されているか確認します。
     * 
     * @param {string} event - イベント名
     * @returns {boolean} リスナーが存在する場合true
     */
    hasListeners(event) {
        return !!(this.listeners[event] && this.listeners[event].length > 0);
    }
}
