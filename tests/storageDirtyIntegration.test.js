import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { DirtyStateManager } from '../src/managers/DirtyStateManager.js';
import { StorageManager } from '../src/storage/StorageManager.js';

describe('StorageManager & DirtyStateManager 統合テスト (ライフサイクル検証)', () => {
    let eventBus;
    let dirtyStateManager;
    let storageManager;
    let mockEditorCore;
    let mockFlowchartApp;
    let mockSettingsManager;

    beforeEach(() => {
        // グローバルの JSZip モック
        global.JSZip = class MockJSZip {
            constructor() {
                this.files = {};
            }
            static loadAsync() {
                return Promise.resolve(new MockJSZip());
            }
            file() { return this; }
            folder() { return this; }
            async generateAsync() { return new Blob(['dummy']); }
        };

        eventBus = new EventBus();
        dirtyStateManager = new DirtyStateManager(eventBus);

        // モック依存
        mockEditorCore = {
            getContent: vi.fn().mockReturnValue('<p>テスト本文</p>'),
            setContent: vi.fn().mockImplementation(() => {
                // setContent 実行時にエディタの rawUpdate が発火する状況をシミュレート
                eventBus.emit('editor:rawUpdate');
            }),
            getJSON: vi.fn().mockReturnValue({})
        };

        mockFlowchartApp = {
            getData: vi.fn().mockReturnValue({ shapes: [], connections: [] }),
            setData: vi.fn().mockImplementation(() => {
                // setData 実行時にフローチャート変更が発火する状況をシミュレート
                eventBus.emit('flowchart:change');
            }),
            canvasContent: null,
            zoomLevel: 1.0
        };

        mockSettingsManager = {
            getSettings: vi.fn().mockReturnValue({}),
            applySettings: vi.fn()
        };

        storageManager = new StorageManager(
            mockEditorCore,
            null,
            mockFlowchartApp,
            mockSettingsManager,
            null,
            null,
            dirtyStateManager
        );

        // eventBus 経由の変更購読を配線
        eventBus.on('editor:rawUpdate', () => dirtyStateManager.markDirty());
        eventBus.on('flowchart:change', () => dirtyStateManager.markDirty());

        // DOMのモック
        document.body.innerHTML = `
            <div id="filename">無題のドキュメント</div>
            <button id="saveBtn"></button>
            <div id="save-menu" class="hidden"></div>
            <button id="loadBtn"></button>
            <div id="load-menu" class="hidden"></div>
            <input type="file" id="hidden-file-input" />
        `;
        storageManager._initTitleEditing();
    });

    afterEach(() => {
        dirtyStateManager.destroy();
        vi.restoreAllMocks();
    });

    it('起動直後はクリーン状態であり、beforeunload で警告が出ないこと', () => {
        expect(dirtyStateManager.isDirty()).toBe(false);

        const event = new Event('beforeunload', { cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        window.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('本文編集が発生するとダーティ状態になり、beforeunload で警告が出ること', () => {
        eventBus.emit('editor:rawUpdate');

        expect(dirtyStateManager.isDirty()).toBe(true);

        const event = new Event('beforeunload', { cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        window.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('フローチャート変更が発生するとダーティ状態になること', () => {
        eventBus.emit('flowchart:change');

        expect(dirtyStateManager.isDirty()).toBe(true);
    });

    it('ファイル読み込み処理中（_processLoadedFile）は setContent/setData の変更通知があっても、読み込み完了後にクリーン状態になること', async () => {
        // ZipHandlerのモック
        storageManager.zipHandler = {
            loadAsync: vi.fn().mockResolvedValue({}),
            getFileContentAsString: vi.fn().mockImplementation((path) => {
                if (path === 'editor.html') return Promise.resolve('<p>読み込みデータ</p>');
                if (path === 'metadata.json') return Promise.resolve(JSON.stringify({ title: '保存済み文書', shapes: [], connections: [] }));
                return Promise.resolve('');
            })
        };
        storageManager.imageProcessor = {
            restoreImages: vi.fn().mockImplementation((html) => Promise.resolve(html))
        };
        vi.spyOn(window, 'alert').mockImplementation(() => {});

        // 読み込み実行
        await storageManager._processLoadedFile(new File(['dummy'], 'test.zip'));

        // 読み込み完了直後はクリーン状態！
        expect(dirtyStateManager.isDirty()).toBe(false);

        // 離脱警告が出ないこと
        const event = new Event('beforeunload', { cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        window.dispatchEvent(event);
        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('読み込み後に編集が行われた場合、ダーティ状態になり警告が有効になること', async () => {
        // 読み込み完了
        dirtyStateManager.markClean();
        expect(dirtyStateManager.isDirty()).toBe(false);

        // その後にユーザーが入力
        eventBus.emit('editor:rawUpdate');

        expect(dirtyStateManager.isDirty()).toBe(true);

        const event = new Event('beforeunload', { cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        window.dispatchEvent(event);
        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('保存完了後にクリーン状態にリセットされ、その後の再編集で再度ダーティになること', () => {
        // 編集してダーティにする
        dirtyStateManager.markDirty();
        expect(dirtyStateManager.isDirty()).toBe(true);

        // 保存完了
        dirtyStateManager.markClean();
        expect(dirtyStateManager.isDirty()).toBe(false);

        // 保存後に再度編集
        eventBus.emit('editor:rawUpdate');
        expect(dirtyStateManager.isDirty()).toBe(true);
    });

    it('タイトルが手動変更された場合、ダーティ状態になること', () => {
        const filenameEl = document.getElementById('filename');
        filenameEl.click();

        const input = filenameEl.querySelector('input');
        expect(input).not.toBeNull();

        input.value = '新しいタイトル';
        input.dispatchEvent(new Event('blur'));

        expect(storageManager.title).toBe('新しいタイトル');
        expect(dirtyStateManager.isDirty()).toBe(true);
    });

    it('タイトル編集で同じタイトルのまま blur された場合はダーティにならないこと', () => {
        const filenameEl = document.getElementById('filename');
        filenameEl.click();

        const input = filenameEl.querySelector('input');
        input.value = '無題のドキュメント'; // 変更なし
        input.dispatchEvent(new Event('blur'));

        expect(dirtyStateManager.isDirty()).toBe(false);
    });
});
