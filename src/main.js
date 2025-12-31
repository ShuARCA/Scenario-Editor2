/**
 * メインエントリーポイント
 * アプリケーションの各モジュールを初期化し、連携させます。
 */
import { UIManager } from './ui.js';
import { EditorManager } from './editorTiptap.js';
import { FlowchartApp } from './flowchart.js';
import { StorageManager } from './storage.js';
import { SearchManager } from './search.js';
import { SettingsManager } from './settings.js';
import { EventBus } from './eventBus.js';

document.addEventListener('DOMContentLoaded', () => {
    // イベントバスの初期化
    const eventBus = new EventBus();

    // UIの初期化
    const ui = new UIManager();

    // フローチャートの初期化
    const flowchartApp = new FlowchartApp(eventBus);

    // エディタの初期化
    const editorManager = new EditorManager(eventBus);

    // 初期同期
    editorManager.updateOutline();
    // エディタから初期状態を送信
    eventBus.emit('editor:update', editorManager.getHeadings());

    // 環境設定の初期化
    const settingsManager = new SettingsManager();

    // 検索機能の初期化
    const searchManager = new SearchManager(editorManager);

    // ストレージの初期化
    const storageManager = new StorageManager(editorManager, flowchartApp, settingsManager);

    console.log('iEditWeb Initialized');

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker Registered', reg))
            .catch(err => console.error('Service Worker Registration Failed', err));
    }
});
