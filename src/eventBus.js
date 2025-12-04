/**
 * イベントバス
 * アプリケーション内のモジュール間通信を管理します。
 * Pub/Subパターンにより、モジュール間の疎結合を実現します。
 */
export class EventBus {
    constructor() {
        this.listeners = {};
    }

    /**
     * イベントリスナーを登録します。
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * イベントリスナーを削除します。
     * @param {string} event - イベント名
     * @param {Function} callback - 削除するコールバック関数
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    /**
     * イベントを発火させます。
     * @param {string} event - イベント名
     * @param {*} data - イベントデータ
     */
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => callback(data));
    }
}
