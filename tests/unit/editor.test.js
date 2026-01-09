/**
 * EditorManagerのユニットテスト
 * 
 * テキスト編集機能、スタイル適用、見出し抽出、画像挿入機能をテストします。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorManager } from '../../src/editor.js';
import { EventBus } from '../../src/eventBus.js';

describe('EditorManager', () => {
    let editorManager;
    let eventBus;
    let editorElement;
    let outlineElement;
    let floatToolbar;
    let textColorPicker;
    let highlightPicker;
    let formatBlockSelect;

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
        outlineElement = document.getElementById('outline-list');
        floatToolbar = document.getElementById('float-toolbar');
        textColorPicker = document.getElementById('textColorPicker');
        highlightPicker = document.getElementById('highlightPicker');
        formatBlockSelect = document.getElementById('formatBlockSelect');

        eventBus = new EventBus();
        editorManager = new EditorManager(eventBus);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('テキスト編集機能（要件1.1, 1.2）', () => {
        it('getContentでエディタのHTMLコンテンツを取得できる', () => {
            editorElement.innerHTML = '<p>テストテキスト</p>';
            expect(editorManager.getContent()).toBe('<p>テストテキスト</p>');
        });

        it('setContentでエディタにHTMLコンテンツを設定できる', () => {
            editorManager.setContent('<p>新しいテキスト</p>');
            expect(editorElement.innerHTML).toBe('<p>新しいテキスト</p>');
        });

        it('setContentはコンテンツをサニタイズする', () => {
            editorManager.setContent('<p>テスト</p><script>alert("xss")</script>');
            expect(editorElement.innerHTML).not.toContain('<script>');
            expect(editorElement.innerHTML).toContain('<p>テスト</p>');
        });

        it('setContent後にeditor:updateイベントが発火する', () => {
            const callback = vi.fn();
            eventBus.on('editor:update', callback);
            editorManager.setContent('<h1>見出し</h1>');
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('Undo/Redo機能（要件1.3, 1.4）', () => {
        it('undoメソッドが存在する', () => {
            // jsdom環境ではexecCommandがサポートされていないため、メソッドの存在のみ確認
            expect(typeof editorManager.undo).toBe('function');
        });

        it('redoメソッドが存在する', () => {
            // jsdom環境ではexecCommandがサポートされていないため、メソッドの存在のみ確認
            expect(typeof editorManager.redo).toBe('function');
        });
    });

    describe('スタイル適用機能（要件3.2-3.11）', () => {
        it('applyStyleメソッドが存在する', () => {
            expect(typeof editorManager.applyStyle).toBe('function');
        });

        it('setHeadingLevelメソッドが存在する', () => {
            expect(typeof editorManager.setHeadingLevel).toBe('function');
        });

        it('setTextColorメソッドが存在する', () => {
            expect(typeof editorManager.setTextColor).toBe('function');
        });

        it('setBackgroundColorメソッドが存在する', () => {
            expect(typeof editorManager.setBackgroundColor).toBe('function');
        });

        it('setRubyメソッドが存在する', () => {
            expect(typeof editorManager.setRuby).toBe('function');
        });

        it('insertRubyメソッドが存在する', () => {
            expect(typeof editorManager.insertRuby).toBe('function');
        });

        it('insertCodeBlockメソッドが存在する', () => {
            expect(typeof editorManager.insertCodeBlock).toBe('function');
        });
    });

    describe('見出し抽出機能（要件5.1, 6.1）', () => {
        it('getHeadingsメソッドが存在する', () => {
            expect(typeof editorManager.getHeadings).toBe('function');
        });

        it('見出しがない場合は空配列を返す', () => {
            editorElement.innerHTML = '<p>通常のテキスト</p>';
            const headings = editorManager.getHeadings();
            expect(headings).toEqual([]);
        });

        it('H1〜H4の見出しを抽出できる', () => {
            editorElement.innerHTML = `
                <h1>見出し1</h1>
                <h2>見出し2</h2>
                <h3>見出し3</h3>
                <h4>見出し4</h4>
            `;
            const headings = editorManager.getHeadings();
            expect(headings.length).toBe(4);
            expect(headings[0].text).toBe('見出し1');
            expect(headings[0].level).toBe(1);
            expect(headings[1].text).toBe('見出し2');
            expect(headings[1].level).toBe(2);
            expect(headings[2].text).toBe('見出し3');
            expect(headings[2].level).toBe(3);
            expect(headings[3].text).toBe('見出し4');
            expect(headings[3].level).toBe(4);
        });

        it('見出しにIDが自動付与される', () => {
            editorElement.innerHTML = '<h1>テスト見出し</h1>';
            const headings = editorManager.getHeadings();
            expect(headings[0].id).toBeDefined();
            expect(headings[0].id).toMatch(/^id-/);
        });

        it('既存のIDは保持される', () => {
            editorElement.innerHTML = '<h1 id="existing-id">テスト見出し</h1>';
            const headings = editorManager.getHeadings();
            expect(headings[0].id).toBe('existing-id');
        });

        it('scrollToHeadingメソッドが存在する', () => {
            expect(typeof editorManager.scrollToHeading).toBe('function');
        });
    });

    describe('画像挿入・リサイズ機能（要件2.1-2.4）', () => {
        it('insertImageメソッドが存在する', () => {
            expect(typeof editorManager.insertImage).toBe('function');
        });

        it('resizeImageメソッドが存在する', () => {
            expect(typeof editorManager.resizeImage).toBe('function');
        });

        it('insertImageで画像を挿入するとIDが返される', () => {
            // 小さなテスト用のdata URL
            const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const imageId = editorManager.insertImage(testDataUrl);
            expect(imageId).toBeDefined();
            expect(imageId).toMatch(/^id-/);
        });

        it('insertImageで挿入された画像がエディタに存在する', () => {
            const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const imageId = editorManager.insertImage(testDataUrl);
            const img = document.getElementById(imageId);
            expect(img).not.toBeNull();
            expect(editorElement.contains(img)).toBe(true);
        });

        it('resizeImageで画像サイズを変更できる', () => {
            const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const imageId = editorManager.insertImage(testDataUrl);
            const result = editorManager.resizeImage(imageId, 200);
            expect(result).toBe(true);
            const img = document.getElementById(imageId);
            expect(img.style.width).toBe('200px');
        });

        it('存在しない画像IDでresizeImageを呼ぶとfalseを返す', () => {
            const result = editorManager.resizeImage('non-existent-id', 200);
            expect(result).toBe(false);
        });

        it('resizeImageは最小幅50pxを保証する', () => {
            const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const imageId = editorManager.insertImage(testDataUrl);
            editorManager.resizeImage(imageId, 10);
            const img = document.getElementById(imageId);
            expect(img.style.width).toBe('50px');
        });
    });
});
