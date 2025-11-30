/**
 * メインエントリーポイント
 */
import { UIManager } from './ui.js';
import { EditorManager } from './editor.js';
import { FlowchartApp } from './flowchart.js';
import { StorageManager } from './storage.js';
import { SearchManager } from './search.js';
import { SettingsManager } from './settings.js';

document.addEventListener('DOMContentLoaded', () => {
    // UIの初期化
    const ui = new UIManager();

    // フローチャートの初期化 (後でエディタが必要)
    const flowchartApp = new FlowchartApp(null);

    // エディタの初期化 (フローチャートが必要)
    const editorManager = new EditorManager(flowchartApp);

    // リンク
    flowchartApp.setEditorManager(editorManager);

    // 初期同期
    editorManager.updateOutline();
    flowchartApp.syncFromEditor();

    // ストレージの初期化
    const storageManager = new StorageManager(editorManager, flowchartApp);

    // 検索機能の初期化
    const searchManager = new SearchManager(editorManager);

    // 環境設定の初期化
    const settingsManager = new SettingsManager();

    console.log('iEditWeb Initialized');
});
