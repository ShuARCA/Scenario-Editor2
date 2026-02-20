/**
 * メインエントリーポイント
 * アプリケーションの各モジュールを初期化し、連携させます。
 * 
 * モジュール構造:
 * - core/: EventBus, Config, EditorCore, FlowchartCore
 * - managers/: エディタ機能マネージャー
 * - flowchart/: フローチャートマネージャー
 * - ui/: UIマネージャー, PanelPositioner
 * - utils/: ヘルパー関数, DOM操作, Sanitizer
 */

// コアモジュール
import { EventBus } from './core/EventBus.js';
import { EditorCore } from './core/EditorCore.js';
import { CONFIG } from './core/Config.js';
import { debounce } from './utils/helpers.js';

// エディタ機能マネージャー
import {
    OutlineManager,
    RubyManager,
    CommentManager,
    LinkManager,
    ImageManager,
    ColorPickerManager,
    ToolbarManager,
    BlockCopyManager,
    LockManager
} from './managers/index.js';
import { ShortcutManager } from './managers/ShortcutManager.js';

// フローチャートコントローラー
import { FlowchartApp } from './flowchart/index.js'; // FlowchartAppはindexからエクスポート済み

// UI・ストレージ・検索マネージャー
import { UIManager, SearchManager, SettingsManager, CustomCssManager, CustomCssEditor } from './ui/index.js';
import { StorageManager } from './storage/index.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. コアモジュールの初期化
    const eventBus = new EventBus();
    const editorCore = new EditorCore(eventBus);

    // 2. UIマネージャーの初期化
    const uiManager = new UIManager();
    const settingsManager = new SettingsManager();

    // 2.5 ロックマネージャーの初期化
    const lockManager = new LockManager(eventBus);

    // 2.6 カスタムCSSマネージャーの初期化
    const customCssManager = new CustomCssManager();
    customCssManager.loadFromStorage();
    customCssManager.applyCustomStyles();

    const customCssEditor = new CustomCssEditor(customCssManager);
    customCssEditor.init();

    // SettingsManagerとの連携: カスタムCSS設定ボタン押下時にモーダルを開く
    settingsManager._onOpenCustomCss = () => {
        settingsManager.close();
        customCssEditor.open();
    };

    // 3. エディタ機能マネージャーの初期化
    // 各マネージャーの作成（依存関係注入）
    const editorManagers = {
        outline: new OutlineManager(editorCore), // EditorCoreを渡す（ファサードではない）
        ruby: new RubyManager(editorCore),       // これ以降も同様にEditorCoreを渡す必要があるが...
        comment: new CommentManager(editorCore), // 既存マネージャーはEditorManager(ファサード)を期待している可能性がある
        link: new LinkManager(editorCore),       // EditorCoreはファサードとAPI互換性がない部分があるため注意
        image: new ImageManager(editorCore),     // 特に `init` で `setup...` メソッドを呼んでいる部分など
        colorPicker: new ColorPickerManager(editorCore),
        toolbar: new ToolbarManager(editorCore),
        blockCopy: new BlockCopyManager(editorCore)
    };

    /**
     * 【重要】マネージャーの互換性対応
     * 各マネージャーはこれまで `EditorManager` (ファサード) をコンストラクタで受け取り、
     * `this.editor.insertRuby()` のように呼び出していた可能性がある。
     * しかし現在 `this.editor` は `EditorCore` であり、`insertRuby` は存在しない。
     * マネージャー同士の連携が必要な場合（ToolbarからRuby呼び出しなど）、
     * ここで相互参照を設定するか、イベントバス経由にする必要がある。
     * 
     * 現状の実装では `ToolbarManager` が `document.getElementById('rubyBtn')` のイベントを設定しており、
     * そこで `this.editor.insertRuby()` を呼んでいる可能性が高い。
     * EditorCoreには `insertRuby` がないのでエラーになる。
     * 
     * 解決策: プロキシオブジェクトを作成して、EditorCore + 各マネージャーへのアクセスを提供する
     * ＝ 実質的に main.js 内でファサードを動的に生成する。
     */

    // 動的ファサード（マネージャー間の連携用）
    const editorFacade = new Proxy(editorCore, {
        get: (target, prop) => {
            // Coreにあるプロパティはそのまま返す
            if (prop in target) return target[prop];
            // マネージャーへの委譲
            if (prop === 'insertRuby') return () => editorManagers.ruby.insertRuby();
            if (prop === 'insertComment') return () => editorManagers.comment.insertComment();
            if (prop === 'insertLink') return () => editorManagers.link.insertLink();
            if (prop === 'insertImage') return (src) => editorManagers.image.insertImage(src);
            if (prop === 'resizeImage') return (id, width) => editorManagers.image.resizeImage(id, width);
            if (prop === 'getHeadings') return () => editorManagers.outline.getHeadings();
            if (prop === 'updateOutline') return () => editorManagers.outline.updateOutline();
            if (prop === 'scrollToHeading') return (id) => editorManagers.outline.scrollToHeading(id);
            if (prop === 'setCustomColors') return (c) => editorManagers.colorPicker.setCustomColors(c);
            if (prop === 'setCustomColors') return (c) => editorManagers.colorPicker.setCustomColors(c);
            if (prop === 'getCustomColors') return () => editorManagers.colorPicker.getCustomColors();
            // Managerへの直接アクセス
            if (prop === 'colorPickerManager') return editorManagers.colorPicker;
            if (prop === 'toolbarManager') return editorManagers.toolbar;
            if (prop === 'customCssManager') return customCssManager;
            // 後方互換プロパティ
            if (prop === 'editorContainer') return target.editorContainer;

            return undefined;
        }
    });

    // マネージャーの `editor` プロパティをファサードに差し替える（強引だが互換性確保のため）
    Object.values(editorManagers).forEach(manager => {
        manager.editor = editorFacade;
    });

    // 4. エディタ初期化 (DOM操作を含むマネージャーセットアップの前に実行)
    editorCore.init('editor'); // ID指定

    // 5. マネージャーのセットアップ
    editorManagers.outline.setupIconPicker();
    editorManagers.ruby.setupRubyPanel();
    editorManagers.comment.setupCommentPanel();
    editorManagers.comment.setupCommentHover();
    editorManagers.link.setupLinkPanel();
    editorManagers.link.setupLinkHover();
    editorManagers.image.setupImageToolbar();
    editorManagers.toolbar.setupToolbarActions();
    editorManagers.colorPicker.setupColorPicker('textColorBtn', 'textColorPicker', 'foreColor');
    editorManagers.colorPicker.setupColorPicker('highlightBtn', 'highlightPicker', 'hiliteColor');
    editorManagers.blockCopy.init();

    // 5.5 ショートカットマネージャーのセットアップ
    const shortcutManager = new ShortcutManager();
    shortcutManager.registerContext(
        'outline',
        shortcutManager.getShortcuts('outline'),
        (action) => {
            // コンテキストメニューの対象見出しに対してアクションを実行
            const targetId = editorManagers.outline.contextMenuTargetId;
            if (targetId) {
                editorManagers.outline.executeAction(action, targetId);
                // メニュー項目の有効/無効状態を更新
                editorManagers.outline._refreshContextMenuState();
            }
        }
    );
    // OutlineManagerにショートカットマネージャーへの参照を渡す
    editorManagers.outline.shortcutManager = shortcutManager;

    // 6. コールバック設定（EditorManagerファサードがやっていた役割）
    editorCore.onUpdate(() => {
        const debouncedUpdate = debounce(() => {
            editorManagers.outline.updateOutline();
            eventBus.emit('editor:update', editorManagers.outline.getHeadings());
            editorManagers.link.checkBrokenHeadingLinks();
        }, CONFIG.EDITOR.DEBOUNCE_WAIT);
        debouncedUpdate();
    });

    editorCore.onSelectionUpdate(() => {
        const selection = editorCore.getSelection();
        if (!selection) return;

        const { from, to, empty } = selection;
        const isImageSelected = editorManagers.image.isImageSelected();

        // ロック中はフローティングツールバー・画像ツールバーを表示しない
        if (lockManager.isLocked()) {
            editorManagers.toolbar.hideFloatToolbar();
            editorManagers.image.hideImageToolbar();
            editorManagers.outline.updateOutlineHighlightByPosition();
            return;
        }

        if (isImageSelected) {
            editorManagers.toolbar.hideFloatToolbar();
            editorManagers.image.showImageToolbar();
        } else {
            editorManagers.image.hideImageToolbar();

            if (empty || from === to) {
                editorManagers.toolbar.hideFloatToolbar();
            } else {
                editorManagers.toolbar.showFloatToolbar();
                editorManagers.toolbar.updateToolbarState();
                editorManagers.comment.updateCommentButtonState();
                editorManagers.link.updateLinkButtonState();
            }
        }
        editorManagers.outline.updateOutlineHighlightByPosition();
    });

    // EventBusリスナー（スクロール処理）
    eventBus.on('editor:scrollToHeading', (headingId) => {
        editorManagers.outline.scrollToHeading(headingId);
    });


    // 7. フローチャートの初期化
    const flowchartApp = new FlowchartApp(eventBus);
    flowchartApp.setEditorManager(editorFacade); // フローチャートにもファサードを渡す（syncFromEditorなどで使用）
    flowchartApp.init(); // 明示的に初期化

    // 8. 検索・ストレージの初期化
    // SearchManagerにはEditorCoreを渡す（先ほどSearchManagerをEditorCore依存に修正したため）
    const searchManager = new SearchManager(editorCore);

    // StorageManagerには依存関係をフルセットで渡す
    const storageManager = new StorageManager(editorCore, editorManagers.colorPicker, flowchartApp, settingsManager, lockManager);
    storageManager.setViewerExporterDeps({
        customCssManager,
        outlineManager: editorManagers.outline,
    });

    // 9. 初期同期
    editorManagers.outline.updateOutline();
    eventBus.emit('editor:update', editorManagers.outline.getHeadings());

    // 10. ロック変更イベントリスナー
    eventBus.on('lock:changed', (isLocked) => {
        editorCore.setLocked(isLocked);
        editorManagers.outline.setLocked(isLocked);
        editorManagers.toolbar.setLocked(isLocked);
        editorManagers.image.setLocked(isLocked);
        editorManagers.link.setLocked(isLocked);
        editorManagers.comment.setLocked(isLocked);
        searchManager.setLocked(isLocked);
        shortcutManager.setLocked(isLocked);
        flowchartApp.setLocked(isLocked);
    });

    console.log('iEditWeb Initialized (Full Modular Structure)');

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker Registered', reg))
            .catch(err => console.error('Service Worker Registration Failed', err));
    }
});
