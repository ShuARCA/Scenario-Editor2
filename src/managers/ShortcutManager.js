/**
 * ショートカットキー管理
 * 
 * キーボードショートカットを一元管理し、将来的なユーザーカスタマイズを容易にします。
 * 
 * @module managers/ShortcutManager
 */

import { CONFIG } from '../core/Config.js';

/**
 * ショートカットマネージャークラス
 */
export class ShortcutManager {
    /**
     * ShortcutManagerのコンストラクタ
     */
    constructor() {
        /** @type {Map<string, Array<{shortcut: Object, handler: Function}>>} コンテキスト別ハンドラー */
        this.handlers = new Map();

        /** @type {string|null} 現在アクティブなコンテキスト */
        this.activeContext = null;

        /** @type {boolean} 編集ロック状態 */
        this._locked = false;

        this._setupGlobalListener();
    }

    /**
     * グローバルキーダウンリスナーをセットアップします。
     * @private
     */
    _setupGlobalListener() {
        document.addEventListener('keydown', (e) => {
            this._handleKeyDown(e);
        });
    }

    /**
     * キーダウンイベントを処理します。
     * @param {KeyboardEvent} e 
     * @private
     */
    _handleKeyDown(e) {
        // ロック中はoutlineコンテキストのショートカットをブロック
        if (this._locked && this.activeContext === 'outline') return;

        // アクティブなコンテキストのハンドラーを取得
        const contextHandlers = this.handlers.get(this.activeContext);
        if (!contextHandlers) return;

        for (const { shortcut, handler } of contextHandlers) {
            if (this._matchesShortcut(e, shortcut)) {
                e.preventDefault();
                e.stopPropagation();
                handler(shortcut.action);
                return;
            }
        }
    }

    /**
     * イベントがショートカットにマッチするかチェックします。
     * @param {KeyboardEvent} e 
     * @param {Object} shortcut 
     * @returns {boolean}
     * @private
     */
    _matchesShortcut(e, shortcut) {
        if (e.key !== shortcut.key) return false;
        if ((shortcut.ctrlKey || false) !== e.ctrlKey) return false;
        if ((shortcut.shiftKey || false) !== e.shiftKey) return false;
        if ((shortcut.altKey || false) !== e.altKey) return false;
        return true;
    }

    /**
     * コンテキストにショートカットハンドラーを登録します。
     * 
     * @param {string} context - コンテキスト名（例: 'outline'）
     * @param {Array} shortcuts - ショートカット設定配列
     * @param {Function} handler - アクションを受け取るハンドラー関数
     */
    registerContext(context, shortcuts, handler) {
        const contextHandlers = shortcuts.map(shortcut => ({
            shortcut,
            handler
        }));
        this.handlers.set(context, contextHandlers);
    }

    /**
     * アクティブなコンテキストを設定します。
     * 
     * @param {string|null} context - コンテキスト名、またはnullで無効化
     */
    setActiveContext(context) {
        this.activeContext = context;
    }

    /**
     * 編集ロック状態を設定します。
     * ロック中はアウトラインコンテキストのショートカットをブロックします。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
    }

    /**
     * 指定されたコンテキストのショートカット設定を取得します。
     * 
     * @param {string} context - コンテキスト名
     * @returns {Array} ショートカット設定配列
     */
    getShortcuts(context) {
        const contextKey = context.toUpperCase();
        return CONFIG.SHORTCUTS[contextKey] || [];
    }

    /**
     * ショートカットのラベル（キー表示用文字列）を生成します。
     * 
     * @param {Object} shortcut - ショートカット設定
     * @returns {string} 表示用文字列（例: "Ctrl+←"）
     */
    formatShortcutLabel(shortcut) {
        const parts = [];
        if (shortcut.ctrlKey) parts.push('Ctrl');
        if (shortcut.shiftKey) parts.push('Shift');
        if (shortcut.altKey) parts.push('Alt');

        // キー名を表示用に変換
        const keyMap = {
            'ArrowLeft': '←',
            'ArrowRight': '→',
            'ArrowUp': '↑',
            'ArrowDown': '↓'
        };
        parts.push(keyMap[shortcut.key] || shortcut.key);

        return parts.join('+');
    }
}
