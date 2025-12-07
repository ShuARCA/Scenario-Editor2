/**
 * 検索・置換ロジック
 * エディタ内のテキスト検索と置換機能を提供します。
 */
export class SearchManager {
    /**
     * @param {import('./editor.js').EditorManager} editorManager 
     */
    constructor(editorManager) {
        this.editorManager = editorManager;
        this.editor = editorManager.editor;
        this.searchContainer = document.getElementById('search-panel');
        this.searchInput = document.getElementById('search-input');
        this.replaceInput = document.getElementById('replace-input');
        this.regexModeCheckbox = document.getElementById('regex-mode-checkbox');
        this.caseSensitiveCheckbox = document.getElementById('case-sensitive-checkbox');
        this.searchInfo = document.getElementById('search-info');
        this.matches = [];
        this.currentMatchIndex = -1;
        this.regexMode = false;
        this.caseSensitive = false;

        this.init();
    }

    init() {
        // UIイベントリスナー
        document.getElementById('searchBtn').addEventListener('click', () => this.toggleSearchPanel());
        
        // 検索ボタンで検索実行
        const doSearchBtn = document.getElementById('do-search-btn');
        if (doSearchBtn) {
            doSearchBtn.addEventListener('click', () => this.performSearchWithoutFocusChange());
        }
        
        // Enterキーで検索実行
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.matches.length > 0) {
                    this.nextMatch();
                } else {
                    this.performSearchWithoutFocusChange();
                }
            }
        });
        
        document.getElementById('find-next-btn').addEventListener('click', () => this.nextMatch());
        document.getElementById('find-prev-btn').addEventListener('click', () => this.prevMatch());
        document.getElementById('replace-btn').addEventListener('click', () => this.replaceCurrent());
        document.getElementById('replace-all-btn').addEventListener('click', () => this.replaceAll());
        document.getElementById('close-search-btn').addEventListener('click', () => this.closeSearchPanel());

        // 正規表現モードと大文字/小文字区別のチェックボックス
        if (this.regexModeCheckbox) {
            this.regexModeCheckbox.addEventListener('change', () => {
                this.regexMode = this.regexModeCheckbox.checked;
            });
        }
        if (this.caseSensitiveCheckbox) {
            this.caseSensitiveCheckbox.addEventListener('change', () => {
                this.caseSensitive = this.caseSensitiveCheckbox.checked;
            });
        }

        // ショートカットキー (Ctrl+F)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.toggleSearchPanel();
                this.searchInput.focus();
            }
        });
    }


    toggleSearchPanel() {
        this.searchContainer.classList.toggle('hidden');
        if (!this.searchContainer.classList.contains('hidden')) {
            // ポップアップ位置の計算
            const btn = document.getElementById('searchBtn');
            if (!btn) return;
            const rect = btn.getBoundingClientRect();

            // ボタンの下、右揃え気味に表示
            this.searchContainer.style.position = 'absolute';
            this.searchContainer.style.top = `${rect.bottom + 10}px`;
            // 画面幅からはみ出さないように調整
            const right = window.innerWidth - rect.right;
            this.searchContainer.style.right = `${Math.max(10, right - 10)}px`;
            this.searchContainer.style.left = 'auto';
            this.searchContainer.style.bottom = 'auto';

            this.searchInput.focus();
        } else {
            this.clearHighlights();
        }
    }

    closeSearchPanel() {
        this.searchContainer.classList.add('hidden');
        this.clearHighlights();
    }

    /**
     * 正規表現モードを設定します。
     * @param {boolean} enabled - 正規表現モードを有効にするかどうか
     */
    setRegexMode(enabled) {
        this.regexMode = enabled;
        if (this.regexModeCheckbox) {
            this.regexModeCheckbox.checked = enabled;
        }
    }

    /**
     * 大文字/小文字区別を設定します。
     * @param {boolean} enabled - 大文字/小文字を区別するかどうか
     */
    setCaseSensitive(enabled) {
        this.caseSensitive = enabled;
        if (this.caseSensitiveCheckbox) {
            this.caseSensitiveCheckbox.checked = enabled;
        }
    }

    /**
     * 検索を実行します。
     * @param {string} [query] - 検索クエリ（省略時は入力フィールドの値を使用）
     * @param {Object} [options] - 検索オプション
     * @param {boolean} [options.regex] - 正規表現モード
     * @param {boolean} [options.caseSensitive] - 大文字/小文字区別
     * @returns {Array} マッチした箇所の配列
     */
    search(query, options = {}) {
        const searchQuery = query !== undefined ? query : this.searchInput.value;
        const useRegex = options.regex !== undefined ? options.regex : this.regexMode;
        const useCaseSensitive = options.caseSensitive !== undefined ? options.caseSensitive : this.caseSensitive;

        this.clearHighlights();
        this.matches = [];
        this.currentMatchIndex = -1;

        if (!searchQuery) {
            this.updateSearchInfo();
            return this.matches;
        }

        // テキストノードを走査して検索
        const walker = document.createTreeWalker(this.editor, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            const text = node.nodeValue;
            let regex;
            try {
                if (useRegex) {
                    // 正規表現モード
                    const flags = useCaseSensitive ? 'g' : 'gi';
                    regex = new RegExp(searchQuery, flags);
                } else {
                    // 通常検索モード（特殊文字をエスケープ）
                    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const flags = useCaseSensitive ? 'g' : 'gi';
                    regex = new RegExp(escapedQuery, flags);
                }
            } catch (e) {
                // 無効な正規表現の場合はスキップ
                this.updateSearchInfo('無効な正規表現です');
                return this.matches;
            }

            let match;
            while ((match = regex.exec(text)) !== null) {
                this.matches.push({
                    node: node,
                    index: match.index,
                    length: match[0].length,
                    text: match[0]
                });
                // 空文字列にマッチした場合の無限ループ防止
                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
        }

        this.updateSearchInfo();
        return this.matches;
    }

    /**
     * 検索を実行し、マッチした箇所をリストアップします。
     */
    performSearch() {
        this.search();

        if (this.matches.length > 0) {
            this.highlightMatches();
            this.nextMatch();
        }
    }

    /**
     * 検索を実行しますが、フォーカスを検索入力欄に保持します。
     * ボタン/Enterキーでの検索用。
     */
    performSearchWithoutFocusChange() {
        this.search();

        if (this.matches.length > 0) {
            this.highlightMatches();
            // 最初のマッチを選択するが、スクロールのみ行いフォーカスは移動しない
            this.currentMatchIndex = 0;
            this.scrollToMatch(this.matches[this.currentMatchIndex]);
            this.updateSearchInfo();
        }
        
        // 検索入力欄にフォーカスを戻す
        if (this.searchInput && document.activeElement !== this.searchInput) {
            this.searchInput.focus();
        }
    }

    /**
     * 指定されたマッチ位置にスクロールします（選択はしない）。
     * @param {Object} match - マッチ情報
     */
    scrollToMatch(match) {
        if (match.node.parentElement && typeof match.node.parentElement.scrollIntoView === 'function') {
            match.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }


    /**
     * マッチした箇所をハイライト表示します。
     */
    highlightMatches() {
        // ハイライト処理は複雑（DOM構造を変更するため）
        // ここでは簡易的に、現在のマッチのみを選択状態にする実装とします
        // 本格的なハイライト（<span class="highlight">...</span>で囲む）は
        // contenteditableの動作を不安定にする可能性があるため慎重に行う必要があります
    }

    /**
     * 次のマッチに移動します。
     */
    nextMatch() {
        if (this.matches.length === 0) return;
        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
        this.selectMatch(this.matches[this.currentMatchIndex]);
        this.updateSearchInfo();
    }

    /**
     * 前のマッチに移動します。
     */
    prevMatch() {
        if (this.matches.length === 0) return;
        this.currentMatchIndex = (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
        this.selectMatch(this.matches[this.currentMatchIndex]);
        this.updateSearchInfo();
    }

    /**
     * 指定されたマッチを選択状態にします。
     * @param {Object} match - マッチ情報
     */
    selectMatch(match) {
        const range = document.createRange();
        range.setStart(match.node, match.index);
        range.setEnd(match.node, match.index + match.length);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // scrollIntoViewが存在する場合のみ呼び出す（テスト環境対応）
        if (match.node.parentElement && typeof match.node.parentElement.scrollIntoView === 'function') {
            match.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * 現在のマッチを置換します。
     * @param {string} [replacement] - 置換文字列（省略時は入力フィールドの値を使用）
     * @returns {boolean} 置換が成功したかどうか
     */
    replace(replacement) {
        if (this.currentMatchIndex === -1 || this.matches.length === 0) return false;

        const match = this.matches[this.currentMatchIndex];
        const replaceText = replacement !== undefined ? replacement : this.replaceInput.value;

        const range = document.createRange();
        range.setStart(match.node, match.index);
        range.setEnd(match.node, match.index + match.length);
        range.deleteContents();
        range.insertNode(document.createTextNode(replaceText));

        // マッチリストを更新する必要があるが、DOMが変わってしまったため
        // 再検索するのが最も安全
        this.performSearch();
        return true;
    }

    /**
     * 現在のマッチを置換します（UIボタン用）。
     */
    replaceCurrent() {
        this.replace();
    }

    /**
     * すべてのマッチを置換します。
     * @param {string} [replacement] - 置換文字列（省略時は入力フィールドの値を使用）
     * @returns {number} 置換した件数
     */
    replaceAll(replacement) {
        const query = this.searchInput.value;
        const replaceText = replacement !== undefined ? replacement : this.replaceInput.value;
        if (!query) return 0;

        // まず検索を実行して最新のマッチリストを取得
        this.search();

        const count = this.matches.length;

        // 逆順に処理（インデックスずれを防ぐため）
        for (let i = this.matches.length - 1; i >= 0; i--) {
            const match = this.matches[i];
            const range = document.createRange();
            range.setStart(match.node, match.index);
            range.setEnd(match.node, match.index + match.length);
            range.deleteContents();
            range.insertNode(document.createTextNode(replaceText));
        }

        this.matches = [];
        this.currentMatchIndex = -1;
        this.updateSearchInfo();

        return count;
    }

    /**
     * ハイライトをクリアします。
     */
    clearHighlights() {
        // ハイライト解除（今回は選択解除のみ）
        window.getSelection().removeAllRanges();
        this.updateSearchInfo();
    }

    /**
     * 検索情報を更新します。
     * @param {string} [message] - カスタムメッセージ
     */
    updateSearchInfo(message) {
        if (!this.searchInfo) return;

        if (message) {
            this.searchInfo.textContent = message;
        } else if (this.matches.length === 0) {
            if (this.searchInput.value) {
                this.searchInfo.textContent = '見つかりませんでした';
            } else {
                this.searchInfo.textContent = '';
            }
        } else {
            this.searchInfo.textContent = `${this.currentMatchIndex + 1} / ${this.matches.length} 件`;
        }
    }
}
