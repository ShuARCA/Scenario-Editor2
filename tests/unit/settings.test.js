/**
 * SettingsManager ユニットテスト
 * 要件 11.1, 11.2, 11.3, 11.4, 11.5 の動作確認
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsManager } from '../../src/settings.js';

describe('SettingsManager', () => {
    let settingsManager;
    let mockLocalStorage;

    beforeEach(() => {
        // localStorageのモック
        mockLocalStorage = {};
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key) => mockLocalStorage[key] || null),
            setItem: vi.fn((key, value) => { mockLocalStorage[key] = value; }),
            removeItem: vi.fn((key) => { delete mockLocalStorage[key]; }),
            clear: vi.fn(() => { mockLocalStorage = {}; })
        });

        // DOM要素のモック
        vi.stubGlobal('document', {
            documentElement: {
                style: {
                    setProperty: vi.fn()
                }
            },
            getElementById: vi.fn((id) => {
                if (id === 'editor') {
                    return { style: {} };
                }
                if (id === 'main-content') {
                    return { style: {} };
                }
                return null;
            })
        });

        // skipDomInitオプションでDOM初期化をスキップ
        settingsManager = new SettingsManager({ skipDomInit: true });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('13.1 テーマ切り替え機能', () => {
        it('デフォルトテーマはlightである', () => {
            expect(settingsManager.getTheme()).toBe('light');
        });

        it('setThemeでダークテーマに切り替えられる', () => {
            settingsManager.setTheme('dark');
            expect(settingsManager.getTheme()).toBe('dark');
        });

        it('setThemeでライトテーマに切り替えられる', () => {
            settingsManager.setTheme('dark');
            settingsManager.setTheme('light');
            expect(settingsManager.getTheme()).toBe('light');
        });

        it('無効なテーマを設定するとエラーがスローされる', () => {
            expect(() => settingsManager.setTheme('invalid')).toThrow('無効なテーマ');
        });

        it('getThemeは現在のテーマを返す', () => {
            expect(settingsManager.getTheme()).toBe('light');
            settingsManager.settings.theme = 'dark';
            expect(settingsManager.getTheme()).toBe('dark');
        });
    });


    describe('13.2 フォント設定機能', () => {
        it('デフォルトフォントファミリはsans-serifである', () => {
            expect(settingsManager.settings.fontFamily).toBe('sans-serif');
        });

        it('setFontFamilyでserifに変更できる', () => {
            settingsManager.setFontFamily('serif');
            expect(settingsManager.settings.fontFamily).toBe('serif');
        });

        it('setFontFamilyでmonospaceに変更できる', () => {
            settingsManager.setFontFamily('monospace');
            expect(settingsManager.settings.fontFamily).toBe('monospace');
        });

        it('無効なフォントファミリを設定するとエラーがスローされる', () => {
            expect(() => settingsManager.setFontFamily('invalid')).toThrow('無効なフォントファミリ');
        });

        it('デフォルトフォントサイズは16pxである', () => {
            expect(settingsManager.settings.fontSize).toBe('16px');
        });

        it('setFontSizeで数値を指定できる', () => {
            settingsManager.setFontSize(20);
            expect(settingsManager.settings.fontSize).toBe('20px');
        });

        it('setFontSizeで文字列（px付き）を指定できる', () => {
            settingsManager.setFontSize('18px');
            expect(settingsManager.settings.fontSize).toBe('18px');
        });

        it('範囲外のフォントサイズを設定するとエラーがスローされる', () => {
            expect(() => settingsManager.setFontSize(5)).toThrow('無効なフォントサイズ');
            expect(() => settingsManager.setFontSize(50)).toThrow('無効なフォントサイズ');
        });
    });

    describe('13.3 背景設定機能', () => {
        it('デフォルトでは背景画像はnullである', () => {
            expect(settingsManager.settings.backgroundImage).toBeNull();
        });

        it('setBackgroundImageで背景画像を設定できる', () => {
            const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            settingsManager.setBackgroundImage(dataUrl);
            expect(settingsManager.settings.backgroundImage).toBe(dataUrl);
        });

        it('clearBackgroundImageで背景画像をクリアできる', () => {
            const dataUrl = 'data:image/png;base64,test';
            settingsManager.setBackgroundImage(dataUrl);
            settingsManager.clearBackgroundImage();
            expect(settingsManager.settings.backgroundImage).toBeNull();
        });

        it('無効なデータURLを設定するとエラーがスローされる', () => {
            expect(() => settingsManager.setBackgroundImage(null)).toThrow('背景画像のデータURLが無効です');
            expect(() => settingsManager.setBackgroundImage('')).toThrow('背景画像のデータURLが無効です');
        });
    });

    describe('13.4 設定永続化機能', () => {
        it('saveSettingsでlocalStorageに設定が保存される', () => {
            // DOM要素のモックを追加
            document.getElementById = vi.fn((id) => {
                const mockElements = {
                    'theme-select': { value: 'dark' },
                    'primary-color-picker': { value: '#ff0000' },
                    'font-select': { value: 'serif' },
                    'font-size-input': { value: '20' },
                    'editor-bg-color': { value: '#000000' },
                    'editor-text-color': { value: '#ffffff' },
                    'editor': { style: {} },
                    'main-content': { style: {} }
                };
                return mockElements[id] || null;
            });

            settingsManager.settingsModal = { classList: { add: vi.fn() } };
            settingsManager.saveSettings();

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'ieditweb-settings',
                expect.any(String)
            );

            const savedSettings = JSON.parse(mockLocalStorage['ieditweb-settings']);
            expect(savedSettings.theme).toBe('dark');
            expect(savedSettings.fontFamily).toBe('serif');
            expect(savedSettings.fontSize).toBe('20px');
        });

        it('loadSettingsでlocalStorageから設定が読み込まれる', () => {
            const savedSettings = {
                theme: 'dark',
                fontFamily: 'monospace',
                fontSize: '18px',
                backgroundImage: 'data:image/png;base64,test'
            };
            mockLocalStorage['ieditweb-settings'] = JSON.stringify(savedSettings);

            settingsManager.loadSettings();

            expect(settingsManager.settings.theme).toBe('dark');
            expect(settingsManager.settings.fontFamily).toBe('monospace');
            expect(settingsManager.settings.fontSize).toBe('18px');
            expect(settingsManager.settings.backgroundImage).toBe('data:image/png;base64,test');
        });

        it('localStorageに設定がない場合はデフォルト値が維持される', () => {
            settingsManager.loadSettings();

            expect(settingsManager.settings.theme).toBe('light');
            expect(settingsManager.settings.fontFamily).toBe('sans-serif');
            expect(settingsManager.settings.fontSize).toBe('16px');
        });

        it('getSettingsで現在の設定のコピーを取得できる', () => {
            settingsManager.setTheme('dark');
            settingsManager.setFontFamily('serif');

            const settings = settingsManager.getSettings();

            expect(settings.theme).toBe('dark');
            expect(settings.fontFamily).toBe('serif');
            // 返されたオブジェクトを変更しても元の設定に影響しない
            settings.theme = 'light';
            expect(settingsManager.getTheme()).toBe('dark');
        });
    });
});
