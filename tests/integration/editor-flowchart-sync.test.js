/**
 * エディタとフローチャートの同期統合テスト
 * 
 * 見出し追加/編集/削除時の図形同期、図形クリック時のエディタスクロールをテストします。
 * _要件: 5.1, 5.2, 6.1, 6.2, 6.3, 6.5_
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../src/eventBus.js';
import { EditorManager } from '../../src/editor.js';

describe('エディタとフローチャートの同期統合テスト', () => {
    let eventBus;
    let editorManager;
    let editorElement;

    beforeEach(() => {
        // DOM要素のセットアップ
        document.body.innerHTML = `
            <div id="editor" contenteditable="true"></div>
            <div id="outline-list"></div>
            <div id="float-toolbar" class="hidden">
                <button data-cmd="bold">B</button>
                <button data-cmd="italic">I</button>
                <button data-cmd="underline">U</button>
                <button data-cmd="insertUnorderedList">UL</button>
                <button data-cmd="insertOrderedList">OL</button>
                <select id="formatBlockSelect">
                    <option value="p">段落</option>
                    <option value="h1">見出し1</option>
                    <option value="h2">見出し2</option>
                    <option value="h3">見出し3</option>
                    <option value="h4">見出し4</option>
                    <option value="pre">コード</option>
                </select>
                <button id="textColorBtn">色</button>
                <button id="highlightBtn">ハイライト</button>
                <button id="rubyBtn">ルビ</button>
                <button id="codeBtn">コード</button>
            </div>
            <div id="textColorPicker" class="hidden"></div>
            <div id="highlightPicker" class="hidden"></div>
        `;

        editorElement = document.getElementById('editor');
        eventBus = new EventBus();
        editorManager = new EditorManager(eventBus);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('見出し追加時の図形同期（要件6.1）', () => {
        it('見出しを追加するとeditor:updateイベントが発火する', () => {
            const callback = vi.fn();
            eventBus.on('editor:update', callback);

            editorManager.setContent('<h1>新しい見出し</h1>');

            expect(callback).toHaveBeenCalled();
            const headings = callback.mock.calls[0][0];
            expect(headings.length).toBe(1);
            expect(headings[0].text).toBe('新しい見出し');
            expect(headings[0].level).toBe(1);
        });

        it('複数の見出しを追加すると全ての見出しがイベントに含まれる', () => {
            const callback = vi.fn();
            eventBus.on('editor:update', callback);

            editorManager.setContent(`
                <h1>見出し1</h1>
                <h2>見出し2</h2>
                <h3>見出し3</h3>
            `);

            expect(callback).toHaveBeenCalled();
            const headings = callback.mock.calls[0][0];
            expect(headings.length).toBe(3);
            expect(headings[0].text).toBe('見出し1');
            expect(headings[1].text).toBe('見出し2');
            expect(headings[2].text).toBe('見出し3');
        });

        it('見出しにはIDが自動付与される', () => {
            const callback = vi.fn();
            eventBus.on('editor:update', callback);

            editorManager.setContent('<h1>テスト見出し</h1>');

            const headings = callback.mock.calls[0][0];
            expect(headings[0].id).toBeDefined();
            expect(headings[0].id).toMatch(/^id-/);
        });
    });

    describe('見出し編集時の図形同期（要件6.2）', () => {
        it('見出しテキストを編集するとイベントに反映される', () => {
            // 初期コンテンツを設定
            editorManager.setContent('<h1 id="test-heading">元のテキスト</h1>');

            const callback = vi.fn();
            eventBus.on('editor:update', callback);

            // 見出しテキストを変更
            editorManager.setContent('<h1 id="test-heading">更新されたテキスト</h1>');

            expect(callback).toHaveBeenCalled();
            const headings = callback.mock.calls[0][0];
            expect(headings[0].text).toBe('更新されたテキスト');
            expect(headings[0].id).toBe('test-heading');
        });

        it('既存のIDは保持される', () => {
            const callback = vi.fn();
            eventBus.on('editor:update', callback);

            editorManager.setContent('<h1 id="existing-id">テスト</h1>');

            const headings = callback.mock.calls[0][0];
            expect(headings[0].id).toBe('existing-id');
        });
    });

    describe('見出し削除時の図形同期（要件6.3）', () => {
        it('見出しを削除するとイベントから除外される', () => {
            // 初期コンテンツを設定
            editorManager.setContent(`
                <h1>見出し1</h1>
                <h2>見出し2</h2>
            `);

            const callback = vi.fn();
            eventBus.on('editor:update', callback);

            // 見出し2を削除
            editorManager.setContent('<h1>見出し1</h1>');

            expect(callback).toHaveBeenCalled();
            const headings = callback.mock.calls[0][0];
            expect(headings.length).toBe(1);
            expect(headings[0].text).toBe('見出し1');
        });

        it('全ての見出しを削除すると空配列がイベントに含まれる', () => {
            // 初期コンテンツを設定
            editorManager.setContent('<h1>見出し</h1>');

            const callback = vi.fn();
            eventBus.on('editor:update', callback);

            // 全ての見出しを削除
            editorManager.setContent('<p>通常のテキスト</p>');

            expect(callback).toHaveBeenCalled();
            const headings = callback.mock.calls[0][0];
            expect(headings.length).toBe(0);
        });
    });

    describe('図形クリック時のエディタスクロール（要件6.5）', () => {
        it('editor:scrollToHeadingイベントを受信するとスクロールが実行される', () => {
            // 見出しを含むコンテンツを設定
            editorManager.setContent('<h1 id="target-heading">ターゲット見出し</h1>');

            // scrollIntoViewをモック
            const heading = document.getElementById('target-heading');
            heading.scrollIntoView = vi.fn();

            // イベントを発火
            eventBus.emit('editor:scrollToHeading', 'target-heading');

            expect(heading.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'center'
            });
        });

        it('存在しないIDの場合はスクロールが実行されない', () => {
            editorManager.setContent('<h1 id="existing-heading">見出し</h1>');

            const heading = document.getElementById('existing-heading');
            heading.scrollIntoView = vi.fn();

            // 存在しないIDでイベントを発火
            eventBus.emit('editor:scrollToHeading', 'non-existent-id');

            expect(heading.scrollIntoView).not.toHaveBeenCalled();
        });
    });

    describe('アウトライン同期（要件5.1, 5.2）', () => {
        it('見出しを追加するとアウトラインが更新される', () => {
            editorManager.setContent(`
                <h1>見出し1</h1>
                <h2>見出し2</h2>
            `);

            const outlineList = document.getElementById('outline-list');
            const items = outlineList.querySelectorAll('.outline-item');

            expect(items.length).toBe(2);
            expect(items[0].textContent).toBe('見出し1');
            expect(items[1].textContent).toBe('見出し2');
        });

        it('アウトライン項目のインデントが見出しレベルに対応する', () => {
            editorManager.setContent(`
                <h1>H1見出し</h1>
                <h2>H2見出し</h2>
                <h3>H3見出し</h3>
                <h4>H4見出し</h4>
            `);

            const outlineList = document.getElementById('outline-list');
            const items = outlineList.querySelectorAll('.outline-item');

            // H1: (1-1)*12+8 = 8px
            // H2: (2-1)*12+8 = 20px
            // H3: (3-1)*12+8 = 32px
            // H4: (4-1)*12+8 = 44px
            expect(items[0].style.paddingLeft).toBe('8px');
            expect(items[1].style.paddingLeft).toBe('20px');
            expect(items[2].style.paddingLeft).toBe('32px');
            expect(items[3].style.paddingLeft).toBe('44px');
        });

        it('アウトライン項目をクリックすると対応する見出しにスクロールする', () => {
            editorManager.setContent('<h1 id="test-h1">テスト見出し</h1>');

            const heading = document.getElementById('test-h1');
            heading.scrollIntoView = vi.fn();

            const outlineList = document.getElementById('outline-list');
            const item = outlineList.querySelector('.outline-item');

            // クリックイベントを発火
            item.click();

            expect(heading.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'center'
            });
        });

        it('アウトライン項目クリック時にアクティブ状態が更新される', () => {
            editorManager.setContent(`
                <h1>見出し1</h1>
                <h2>見出し2</h2>
            `);

            // jsdom環境ではscrollIntoViewがサポートされていないため、モックを設定
            const headings = editorElement.querySelectorAll('h1, h2');
            headings.forEach(h => {
                h.scrollIntoView = vi.fn();
            });

            const outlineList = document.getElementById('outline-list');
            const items = outlineList.querySelectorAll('.outline-item');

            // 最初の項目をクリック
            items[0].click();
            expect(items[0].classList.contains('active')).toBe(true);
            expect(items[1].classList.contains('active')).toBe(false);

            // 2番目の項目をクリック
            items[1].click();
            expect(items[0].classList.contains('active')).toBe(false);
            expect(items[1].classList.contains('active')).toBe(true);
        });
    });

    describe('見出しレベルの正確性', () => {
        it('H1〜H4の見出しレベルが正しく取得される', () => {
            editorManager.setContent(`
                <h1>H1</h1>
                <h2>H2</h2>
                <h3>H3</h3>
                <h4>H4</h4>
            `);

            const headings = editorManager.getHeadings();

            expect(headings[0].level).toBe(1);
            expect(headings[1].level).toBe(2);
            expect(headings[2].level).toBe(3);
            expect(headings[3].level).toBe(4);
        });

        it('H5以降の見出しは取得されない', () => {
            editorManager.setContent(`
                <h1>H1</h1>
                <h5>H5</h5>
                <h6>H6</h6>
            `);

            const headings = editorManager.getHeadings();

            expect(headings.length).toBe(1);
            expect(headings[0].text).toBe('H1');
        });
    });
});
