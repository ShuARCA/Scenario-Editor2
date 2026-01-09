/**
 * UIManagerのユニットテスト
 * 
 * サイドバー表示切り替え、リサイザー機能をテストします。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIManager } from '../../src/ui.js';

describe('UIManager', () => {
    let uiManager;
    let sidebar;
    let toggleSidebarBtn;
    let resizer;
    let verticalResizer;
    let flowchartContainer;
    let editorContainer;

    beforeEach(() => {
        // DOM要素のセットアップ
        document.body.innerHTML = `
            <div id="container">
                <aside id="sidebar" style="width: 250px;">
                    <div id="resizer"></div>
                    <div class="sidebar-section">
                        <h3>アウトライン</h3>
                        <div id="outline-list"></div>
                    </div>
                </aside>
                <main id="main-content">
                    <div id="flowchart-container" style="height: 300px;"></div>
                    <div id="vertical-resizer"></div>
                    <div id="editor-container"></div>
                </main>
            </div>
            <div id="toggleSidebar"></div>
        `;

        sidebar = document.getElementById('sidebar');
        toggleSidebarBtn = document.getElementById('toggleSidebar');
        resizer = document.getElementById('resizer');
        verticalResizer = document.getElementById('vertical-resizer');
        flowchartContainer = document.getElementById('flowchart-container');
        editorContainer = document.getElementById('editor-container');

        uiManager = new UIManager();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('サイドバー表示切り替え機能（要件5.1, 5.2）', () => {
        it('UIManagerが正しく初期化される', () => {
            expect(uiManager).toBeDefined();
            expect(uiManager.sidebar).toBe(sidebar);
            expect(uiManager.toggleSidebarBtn).toBe(toggleSidebarBtn);
        });

        it('サイドバー切り替えボタンをクリックするとサイドバーが非表示になる', () => {
            // 初期状態ではサイドバーは表示されている
            expect(sidebar.classList.contains('hidden')).toBe(false);
            
            // ボタンをクリック
            toggleSidebarBtn.click();
            
            // サイドバーが非表示になる
            expect(sidebar.classList.contains('hidden')).toBe(true);
            expect(sidebar.style.width).toBe('0px');
        });

        it('サイドバー切り替えボタンを再度クリックするとサイドバーが表示される', () => {
            // サイドバーを非表示にする
            toggleSidebarBtn.click();
            expect(sidebar.classList.contains('hidden')).toBe(true);
            
            // 再度クリックして表示
            toggleSidebarBtn.click();
            expect(sidebar.classList.contains('hidden')).toBe(false);
            expect(sidebar.style.width).toBe('250px');
        });

        it('サイドバーの幅が保持される', () => {
            // 初期幅を確認
            expect(uiManager.sidebarWidth).toBe(250);
            
            // サイドバーを非表示→表示
            toggleSidebarBtn.click();
            toggleSidebarBtn.click();
            
            // 幅が保持されている
            expect(sidebar.style.width).toBe('250px');
        });
    });

    describe('サイドバーリサイズ機能', () => {
        it('リサイザー要素が正しく参照されている', () => {
            expect(uiManager.resizer).toBe(resizer);
        });

        it('リサイザーのmousedownでリサイズモードが開始される', () => {
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: 250
            });
            
            resizer.dispatchEvent(mousedownEvent);
            expect(uiManager.isResizing).toBe(true);
        });

        it('サイドバーが非表示の場合はリサイズモードが開始されない', () => {
            // サイドバーを非表示にする
            sidebar.classList.add('hidden');
            
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: 250
            });
            
            resizer.dispatchEvent(mousedownEvent);
            expect(uiManager.isResizing).toBe(false);
        });

        it('mousemoveでサイドバーの幅が変更される', () => {
            // リサイズモードを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: 250
            });
            resizer.dispatchEvent(mousedownEvent);
            
            // マウスを移動
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: 300
            });
            document.dispatchEvent(mousemoveEvent);
            
            // サイドバーの幅が変更される
            expect(sidebar.style.width).toBe('300px');
            expect(uiManager.sidebarWidth).toBe(300);
        });

        it('サイドバーの幅は最小150pxに制限される', () => {
            // リサイズモードを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: 250
            });
            resizer.dispatchEvent(mousedownEvent);
            
            // マウスを左に移動（幅を小さくする）
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: 100
            });
            document.dispatchEvent(mousemoveEvent);
            
            // 最小幅150pxに制限される
            expect(sidebar.style.width).toBe('150px');
        });

        it('サイドバーの幅は最大500pxに制限される', () => {
            // リサイズモードを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: 250
            });
            resizer.dispatchEvent(mousedownEvent);
            
            // マウスを右に移動（幅を大きくする）
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: 600
            });
            document.dispatchEvent(mousemoveEvent);
            
            // 最大幅500pxに制限される
            expect(sidebar.style.width).toBe('500px');
        });

        it('mouseupでリサイズモードが終了する', () => {
            // リサイズモードを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: 250
            });
            resizer.dispatchEvent(mousedownEvent);
            expect(uiManager.isResizing).toBe(true);
            
            // mouseupでリサイズモード終了
            const mouseupEvent = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(mouseupEvent);
            expect(uiManager.isResizing).toBe(false);
        });
    });

    describe('垂直リサイザー機能（設計書UIManager）', () => {
        it('垂直リサイザー要素が正しく参照されている', () => {
            expect(uiManager.verticalResizer).toBe(verticalResizer);
        });

        it('フローチャートコンテナが正しく参照されている', () => {
            expect(uiManager.flowchartContainer).toBe(flowchartContainer);
        });

        it('エディタコンテナが正しく参照されている', () => {
            expect(uiManager.editorContainer).toBe(editorContainer);
        });

        it('垂直リサイザーのmousedownで垂直リサイズモードが開始される', () => {
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientY: 300
            });
            
            verticalResizer.dispatchEvent(mousedownEvent);
            expect(uiManager.isVerticalResizing).toBe(true);
        });

        it('垂直リサイズ中にmousemoveでフローチャートコンテナの高さが変更される', () => {
            // 垂直リサイズモードを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientY: 300
            });
            verticalResizer.dispatchEvent(mousedownEvent);
            
            // マウスを移動
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientY: 400
            });
            document.dispatchEvent(mousemoveEvent);
            
            // フローチャートコンテナの高さが変更される
            // ヘッダー高さ50pxを考慮: 400 - 50 = 350px
            expect(flowchartContainer.style.height).toBe('350px');
        });

        it('垂直リサイズの高さは最小100pxに制限される', () => {
            // 垂直リサイズモードを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientY: 300
            });
            verticalResizer.dispatchEvent(mousedownEvent);
            
            // マウスを上に移動（高さを小さくする）
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientY: 50 // ヘッダー高さと同じ位置
            });
            document.dispatchEvent(mousemoveEvent);
            
            // 最小高さ100pxに制限される
            expect(flowchartContainer.style.height).toBe('100px');
        });

        it('mouseupで垂直リサイズモードが終了する', () => {
            // 垂直リサイズモードを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientY: 300
            });
            verticalResizer.dispatchEvent(mousedownEvent);
            expect(uiManager.isVerticalResizing).toBe(true);
            
            // mouseupで垂直リサイズモード終了
            const mouseupEvent = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(mouseupEvent);
            expect(uiManager.isVerticalResizing).toBe(false);
        });

        it('垂直リサイズ後にflex-growが0に設定される', () => {
            // 垂直リサイズモードを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientY: 300
            });
            verticalResizer.dispatchEvent(mousedownEvent);
            
            // マウスを移動
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientY: 400
            });
            document.dispatchEvent(mousemoveEvent);
            
            // flex-growが0に設定される（固定高さにするため）
            expect(flowchartContainer.style.flexGrow).toBe('0');
        });
    });

    describe('カーソルスタイルの変更', () => {
        it('サイドバーリサイズ中はカーソルがcol-resizeになる', () => {
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: 250
            });
            resizer.dispatchEvent(mousedownEvent);
            
            expect(document.body.style.cursor).toBe('col-resize');
        });

        it('垂直リサイズ中はカーソルがrow-resizeになる', () => {
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientY: 300
            });
            verticalResizer.dispatchEvent(mousedownEvent);
            
            expect(document.body.style.cursor).toBe('row-resize');
        });

        it('リサイズ終了後はカーソルがdefaultに戻る', () => {
            // サイドバーリサイズを開始
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: 250
            });
            resizer.dispatchEvent(mousedownEvent);
            
            // リサイズ終了
            const mouseupEvent = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(mouseupEvent);
            
            expect(document.body.style.cursor).toBe('default');
        });
    });
});
