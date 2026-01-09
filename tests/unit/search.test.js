/**
 * SearchManagerのユニットテスト
 * 検索・置換機能の動作確認
 * 要件: 4.1, 4.2, 4.3, 4.4
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// SearchManagerのテスト用モック環境を構築
describe('SearchManager', () => {
    let dom;
    let document;
    let window;
    let SearchManager;
    let searchManager;
    let mockEditorManager;

    beforeEach(async () => {
        // JSDOMでブラウザ環境をシミュレート
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <button id="searchBtn"></button>
                <div id="search-panel" class="hidden">
                    <input type="text" id="search-input">
                    <input type="text" id="replace-input">
                    <input type="checkbox" id="regex-mode-checkbox">
                    <input type="checkbox" id="case-sensitive-checkbox">
                        <button id="do-search-btn"></button>
                    <button id="find-next-btn"></button>
                    <button id="find-prev-btn"></button>
                    <button id="replace-btn"></button>
                    <button id="replace-all-btn"></button>
                    <button id="close-search-btn"></button>
                    <div id="search-info"></div>
                </div>
                <div id="editor-container">
                    <div class="tiptap" contenteditable="true">
                        <p>Hello World</p>
                        <p>This is a test document.</p>
                        <p>Hello again!</p>
                    </div>
                </div>
            </body>
            </html>
        `, { url: 'http://localhost' });

        document = dom.window.document;
        window = dom.window;

        // グローバルオブジェクトを設定
        global.document = document;
        global.window = window;
        global.NodeFilter = window.NodeFilter;

        // EditorManagerのモック (Tiptap対応)
        const editorContainer = document.getElementById('editor-container');
        mockEditorManager = {
            editorContainer: editorContainer,
            getContent: () => editorContainer.querySelector('.tiptap').innerHTML,
            setContent: (html) => { editorContainer.querySelector('.tiptap').innerHTML = html; }
        };

        // SearchManagerを動的にインポート
        const module = await import('../../src/search.js');
        SearchManager = module.SearchManager;
        searchManager = new SearchManager(mockEditorManager);
    });

    afterEach(() => {
        dom.window.close();
        vi.clearAllMocks();
    });

    describe('search メソッド', () => {
        it('通常検索で一致するテキストを見つける', () => {
            // 要件 4.1: 検索文字列に一致するテキストをハイライト表示
            const matches = searchManager.search('Hello');

            expect(matches.length).toBe(2);
            expect(matches[0].text).toBe('Hello');
            expect(matches[1].text).toBe('Hello');
        });

        it('大文字/小文字を区別しない検索（デフォルト）', () => {
            const matches = searchManager.search('hello');

            expect(matches.length).toBe(2);
        });

        it('大文字/小文字を区別する検索', () => {
            const matches = searchManager.search('hello', { caseSensitive: true });

            expect(matches.length).toBe(0);
        });

        it('正規表現モードで検索', () => {
            // 要件 4.2: 正規表現パターンに一致するテキストをハイライト表示
            const matches = searchManager.search('Hello.*', { regex: true });

            expect(matches.length).toBe(2);
            expect(matches[0].text).toBe('Hello World');
            expect(matches[1].text).toBe('Hello again!');
        });

        it('正規表現モードで特殊パターンを検索', () => {
            const matches = searchManager.search('\\w+', { regex: true });

            // 複数の単語にマッチ
            expect(matches.length).toBeGreaterThan(0);
        });

        it('無効な正規表現の場合は空の結果を返す', () => {
            const matches = searchManager.search('[invalid', { regex: true });

            expect(matches.length).toBe(0);
        });

        it('空のクエリの場合は空の結果を返す', () => {
            const matches = searchManager.search('');

            expect(matches.length).toBe(0);
        });

        it('一致しない場合は空の結果を返す', () => {
            const matches = searchManager.search('NotFound');

            expect(matches.length).toBe(0);
        });
    });

    describe('highlightMatches メソッド', () => {
        it('検索後にハイライトメソッドが呼び出せる', () => {
            searchManager.search('Hello');

            // highlightMatchesは現在簡易実装のため、エラーなく呼び出せることを確認
            expect(() => searchManager.highlightMatches()).not.toThrow();
        });
    });

    describe('clearHighlights メソッド', () => {
        it('ハイライトをクリアできる', () => {
            searchManager.search('Hello');

            expect(() => searchManager.clearHighlights()).not.toThrow();
            expect(searchManager.matches.length).toBe(2); // マッチリストは保持される
        });
    });

    describe('nextMatch / prevMatch メソッド', () => {
        it('次のマッチに移動できる', () => {
            searchManager.search('Hello');

            expect(searchManager.currentMatchIndex).toBe(-1);

            searchManager.nextMatch();
            expect(searchManager.currentMatchIndex).toBe(0);

            searchManager.nextMatch();
            expect(searchManager.currentMatchIndex).toBe(1);

            // 最後から最初に戻る
            searchManager.nextMatch();
            expect(searchManager.currentMatchIndex).toBe(0);
        });

        it('前のマッチに移動できる', () => {
            searchManager.search('Hello');
            searchManager.nextMatch(); // index 0

            searchManager.prevMatch();
            expect(searchManager.currentMatchIndex).toBe(1); // 最後に戻る

            searchManager.prevMatch();
            expect(searchManager.currentMatchIndex).toBe(0);
        });

        it('マッチがない場合は何もしない', () => {
            searchManager.search('NotFound');

            searchManager.nextMatch();
            expect(searchManager.currentMatchIndex).toBe(-1);

            searchManager.prevMatch();
            expect(searchManager.currentMatchIndex).toBe(-1);
        });
    });

    describe('setRegexMode / setCaseSensitive メソッド', () => {
        it('正規表現モードを設定できる', () => {
            searchManager.setRegexMode(true);
            expect(searchManager.regexMode).toBe(true);

            searchManager.setRegexMode(false);
            expect(searchManager.regexMode).toBe(false);
        });

        it('大文字/小文字区別を設定できる', () => {
            searchManager.setCaseSensitive(true);
            expect(searchManager.caseSensitive).toBe(true);

            searchManager.setCaseSensitive(false);
            expect(searchManager.caseSensitive).toBe(false);
        });
    });

    describe('replace メソッド', () => {
        it('現在のマッチを置換できる', () => {
            // 要件 4.3: 現在ハイライトされている一致箇所を置換文字列で置き換える
            searchManager.searchInput.value = 'Hello';
            searchManager.search('Hello');
            searchManager.nextMatch(); // 最初のマッチを選択

            const result = searchManager.replace('Hi');

            expect(result).toBe(true);
            // 置換後、再検索されるため新しいマッチリストが作成される
            // "Hello" が "Hi" に置換されたので、残りは1つ
            expect(searchManager.matches.length).toBe(1);
        });

        it('マッチがない場合は置換しない', () => {
            searchManager.searchInput.value = 'NotFound';
            searchManager.search('NotFound');

            const result = searchManager.replace('replacement');

            expect(result).toBe(false);
        });

        it('currentMatchIndexが-1の場合は置換しない', () => {
            searchManager.searchInput.value = 'Hello';
            searchManager.search('Hello');
            // nextMatchを呼ばずにreplaceを呼ぶ

            const result = searchManager.replace('Hi');

            expect(result).toBe(false);
        });
    });

    describe('replaceAll メソッド', () => {
        it('すべてのマッチを置換できる', () => {
            // 要件 4.4: すべての一致箇所を置換文字列で置き換える
            searchManager.searchInput.value = 'Hello';
            searchManager.search('Hello');

            const count = searchManager.replaceAll('Hi');

            expect(count).toBe(2);
            // 置換後、マッチリストはクリアされる
            expect(searchManager.matches.length).toBe(0);
        });

        it('クエリが空の場合は置換しない', () => {
            searchManager.searchInput.value = '';

            const count = searchManager.replaceAll('replacement');

            expect(count).toBe(0);
        });

        it('マッチがない場合は0を返す', () => {
            searchManager.searchInput.value = 'NotFound';

            const count = searchManager.replaceAll('replacement');

            expect(count).toBe(0);
        });

        it('正規表現モードで置換できる', () => {
            searchManager.searchInput.value = 'Hello.*';
            searchManager.setRegexMode(true);

            const count = searchManager.replaceAll('Greeting');

            expect(count).toBe(2);
        });
    });

    describe('replaceCurrent メソッド', () => {
        it('replaceInputの値を使用して置換する', () => {
            searchManager.searchInput.value = 'Hello';
            searchManager.search('Hello');
            searchManager.nextMatch();
            searchManager.replaceInput.value = 'Bonjour';

            searchManager.replaceCurrent();

            // 置換後、再検索されるため新しいマッチリストが作成される
            expect(searchManager.matches.length).toBe(1);
        });
    });
});
