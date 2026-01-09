/**
 * StorageManagerのユニットテスト
 * 
 * ZIP保存/読み込み機能をテストします。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// JSZipとFileSaverのモック
const mockZipFile = vi.fn();
const mockZipFolder = vi.fn(() => ({ file: mockZipFile }));
const mockGenerateAsync = vi.fn(() => Promise.resolve(new Blob(['test'], { type: 'application/zip' })));
const mockLoadAsync = vi.fn();

// グローバルJSZipモック
global.JSZip = vi.fn(() => ({
    file: mockZipFile,
    folder: mockZipFolder,
    generateAsync: mockGenerateAsync
}));
global.JSZip.loadAsync = mockLoadAsync;

// グローバルsaveAsモック
global.saveAs = vi.fn();

describe('StorageManager', () => {
    let StorageManager;
    let storageManager;
    let mockEditorManager;
    let mockFlowchartApp;
    let mockSettingsManager;

    beforeEach(async () => {
        // DOM要素のセットアップ
        document.body.innerHTML = `
            <button id="saveBtn">保存</button>
            <button id="loadBtn">開く</button>
            <div id="editor" contenteditable="true">
                <h1 id="heading-1">テスト見出し</h1>
                <p>テストコンテンツ</p>
            </div>
            <div id="flowchart-canvas">
                <div class="shape" data-id="shape-1">図形1</div>
            </div>
            <div id="filename">document</div>
        `;

        // モックのリセット
        vi.clearAllMocks();

        // EditorManagerのモック
        mockEditorManager = {
            getContent: vi.fn(() => '<h1 id="heading-1">テスト見出し</h1><p>テストコンテンツ</p>'),
            setContent: vi.fn(),
            updateOutline: vi.fn(),
            getCustomColors: vi.fn(() => ({ text: [], highlight: [] })),
            setCustomColors: vi.fn()
        };

        // FlowchartAppのモック
        mockFlowchartApp = {
            shapes: new Map([
                ['shape-1', {
                    id: 'shape-1',
                    text: 'テスト図形',
                    level: 1,
                    x: 100,
                    y: 100,
                    width: 150,
                    height: 50,
                    style: {
                        backgroundColor: '#ffffff',
                        borderColor: '#333333',
                        textColor: '#000000'
                    },
                    parentId: null,
                    children: [],
                    folded: false
                }]
            ]),
            connections: [
                {
                    id: 'conn-1',
                    sourceId: 'shape-1',
                    targetId: 'shape-2',
                    label: 'テスト接続',
                    style: {
                        color: '#333333',
                        arrow: 'target',
                        lineStyle: 'solid'
                    }
                }
            ],
            zoomLevel: 1.0,
            shapesLayer: document.createElement('div'),
            connectionsLayer: document.createElement('svg'),
            canvasContent: document.createElement('div'),
            createShapeElement: vi.fn(),
            updateShapeStyle: vi.fn(),
            setChildrenVisibility: vi.fn(),
            updateAllZIndexes: vi.fn(),
            drawConnections: vi.fn(),
            updateCanvasSize: vi.fn()
        };

        // SettingsManagerのモック
        mockSettingsManager = {
            getSettings: vi.fn(() => ({
                fontFamily: 'sans-serif',
                fontSize: 16,
                backgroundImage: null
            })),
            importSettings: vi.fn()
        };

        // StorageManagerを動的にインポート
        const module = await import('../../src/storage.js');
        StorageManager = module.StorageManager;
        storageManager = new StorageManager(mockEditorManager, mockFlowchartApp, mockSettingsManager);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    // ========================================
    // ZIP保存機能テスト
    // ========================================

    describe('ZIP保存機能', () => {
        it('saveメソッドが存在する', () => {
            expect(typeof storageManager.save).toBe('function');
        });

        it('saveメソッドはZIPファイルを生成する', async () => {
            await storageManager.save();
            expect(global.JSZip).toHaveBeenCalled();
            expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
            expect(global.saveAs).toHaveBeenCalled();
        });

        it('saveメソッドはassetsフォルダを作成する', async () => {
            await storageManager.save();
            expect(mockZipFolder).toHaveBeenCalledWith('assets');
        });

        it('saveメソッドはeditor.htmlを含める', async () => {
            await storageManager.save();
            const calls = mockZipFile.mock.calls;
            const editorHtmlCall = calls.find(call => call[0] === 'editor.html');
            expect(editorHtmlCall).toBeDefined();
        });

        it('saveメソッドはmetadata.jsonを含める', async () => {
            await storageManager.save();
            const calls = mockZipFile.mock.calls;
            const metadataCall = calls.find(call => call[0] === 'metadata.json');
            expect(metadataCall).toBeDefined();
        });

        it('saveメソッドはcontent.mdを含める', async () => {
            await storageManager.save();
            const calls = mockZipFile.mock.calls;
            const contentMdCall = calls.find(call => call[0] === 'content.md');
            expect(contentMdCall).toBeDefined();
        });

        it('saveメソッドはEditorManagerのgetContentを使用する', async () => {
            await storageManager.save();
            expect(mockEditorManager.getContent).toHaveBeenCalled();
        });

        it('metadata.jsonにはshapes、connections、zoomLevelが含まれる', async () => {
            await storageManager.save();
            const calls = mockZipFile.mock.calls;
            const metadataCall = calls.find(call => call[0] === 'metadata.json');
            expect(metadataCall).toBeDefined();
            const metadata = JSON.parse(metadataCall[1]);
            expect(metadata).toHaveProperty('shapes');
            expect(metadata).toHaveProperty('connections');
            expect(metadata).toHaveProperty('zoomLevel');
        });

        it('metadata.jsonのshapesは正しいデータを含む', async () => {
            await storageManager.save();
            const calls = mockZipFile.mock.calls;
            const metadataCall = calls.find(call => call[0] === 'metadata.json');
            const metadata = JSON.parse(metadataCall[1]);
            expect(Array.isArray(metadata.shapes)).toBe(true);
            expect(metadata.shapes.length).toBe(1);
            expect(metadata.shapes[0][0]).toBe('shape-1');
            expect(metadata.shapes[0][1].text).toBe('テスト図形');
        });

        it('metadata.jsonにcustomColorsが含まれる', async () => {
            await storageManager.save();
            const calls = mockZipFile.mock.calls;
            const metadataCall = calls.find(call => call[0] === 'metadata.json');
            const metadata = JSON.parse(metadataCall[1]);
            expect(metadata).toHaveProperty('customColors');
        });
    });

    // ========================================
    // ZIP読み込み機能テスト
    // ========================================

    describe('ZIP読み込み機能', () => {
        beforeEach(() => {
            // loadAsyncのモックをセットアップ
            const mockZipInstance = {
                file: vi.fn((filename) => {
                    if (filename === 'editor.html') {
                        return {
                            async: vi.fn(() => Promise.resolve('<h1>読み込みテスト</h1><p>コンテンツ</p>'))
                        };
                    }
                    if (filename === 'metadata.json') {
                        return {
                            async: vi.fn(() => Promise.resolve(JSON.stringify({
                                title: '読み込みドキュメント',
                                shapes: [
                                    ['shape-loaded', {
                                        id: 'shape-loaded',
                                        text: '読み込み図形',
                                        level: 1,
                                        x: 200,
                                        y: 200,
                                        width: 150,
                                        height: 50,
                                        style: {
                                            backgroundColor: '#ffffff',
                                            borderColor: '#333333',
                                            textColor: '#000000'
                                        },
                                        parentId: null,
                                        children: [],
                                        folded: false
                                    }]
                                ],
                                connections: [],
                                zoomLevel: 1.5,
                                settings: {
                                    fontFamily: 'serif',
                                    fontSize: 18
                                },
                                customColors: {
                                    text: ['#ff0000'],
                                    highlight: ['#00ff00']
                                }
                            })))
                        };
                    }
                    if (filename === 'content.md') {
                        return {
                            async: vi.fn(() => Promise.resolve('# 読み込みテスト\nコンテンツ'))
                        };
                    }
                    if (filename && filename.startsWith('assets/')) {
                        return {
                            async: vi.fn(() => Promise.resolve('base64imagedata'))
                        };
                    }
                    return null;
                })
            };
            mockLoadAsync.mockResolvedValue(mockZipInstance);
        });

        it('loadメソッドが存在する', () => {
            expect(typeof storageManager.load).toBe('function');
        });

        it('triggerLoadメソッドが存在する', () => {
            expect(typeof storageManager.triggerLoad).toBe('function');
        });

        it('loadメソッドはJSZip.loadAsyncを呼び出す', async () => {
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(mockLoadAsync).toHaveBeenCalledWith(mockFile);
        });

        it('loadメソッドはファイル名を設定する', async () => {
            const mockFile = new File(['test'], 'loaded-document.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            // タイトルから設定されたファイル名（日本語タイトルからの変換）
            expect(storageManager.filename).toBe('読み込みドキュメント.zip');
        });

        it('loadメソッドはEditorManagerのsetContentを呼び出す', async () => {
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(mockEditorManager.setContent).toHaveBeenCalled();
        });

        it('loadメソッドはフローチャートデータを復元する', async () => {
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(mockFlowchartApp.shapes.has('shape-loaded')).toBe(true);
            expect(mockFlowchartApp.shapes.get('shape-loaded').text).toBe('読み込み図形');
        });

        it('loadメソッドはズームレベルを復元する', async () => {
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(mockFlowchartApp.zoomLevel).toBe(1.5);
        });

        it('loadメソッドはタイトルを復元する', async () => {
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(storageManager.title).toBe('読み込みドキュメント');
        });

        it('loadメソッドは設定を復元する', async () => {
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(mockSettingsManager.importSettings).toHaveBeenCalled();
        });

        it('loadメソッドはカスタムカラーを復元する', async () => {
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(mockEditorManager.setCustomColors).toHaveBeenCalledWith({
                text: ['#ff0000'],
                highlight: ['#00ff00']
            });
        });

        it('loadメソッドはdrawConnectionsを呼び出す', async () => {
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(mockFlowchartApp.drawConnections).toHaveBeenCalled();
        });

        it('loadメソッドはファイルがない場合は何もしない', async () => {
            const mockEvent = { target: { files: [], value: '' } };
            await storageManager.load(mockEvent);
            expect(mockLoadAsync).not.toHaveBeenCalled();
        });

        it('loadメソッドはエラー時にアラートを表示する', async () => {
            mockLoadAsync.mockRejectedValue(new Error('読み込みエラー'));
            const mockFile = new File(['test'], 'test.zip', { type: 'application/zip' });
            const mockEvent = { target: { files: [mockFile], value: '' } };
            global.alert = vi.fn();
            await storageManager.load(mockEvent);
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('読み込みに失敗しました'));
        });
    });

    // ========================================
    // タイトル管理テスト
    // ========================================

    describe('タイトル管理', () => {
        it('setTitleメソッドはタイトルを更新する', () => {
            storageManager.setTitle('新しいタイトル');
            expect(storageManager.title).toBe('新しいタイトル');
        });

        it('setTitleメソッドはファイル名も更新する', () => {
            storageManager.setTitle('テストドキュメント');
            expect(storageManager.filename).toBe('テストドキュメント.zip');
        });

        it('setTitleメソッドはDOM要素を更新する', () => {
            storageManager.setTitle('表示タイトル');
            const filenameEl = document.getElementById('filename');
            expect(filenameEl.textContent).toBe('表示タイトル');
        });

        it('ファイル名の不正文字はサニタイズされる', () => {
            storageManager.setTitle('テスト:ファイル*名?');
            expect(storageManager.filename).toBe('テスト_ファイル_名_.zip');
        });
    });
});
