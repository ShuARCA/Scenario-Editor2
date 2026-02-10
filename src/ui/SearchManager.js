/**
 * 検索・置換ロジック (Tiptap対応版)
 * エディタ内のテキスト検索と置換機能を提供します。
 * Tiptapエディタと完全に統合されています。
 */
export class SearchManager {
    /**
     * @param {import('../core/EditorCore.js').EditorCore} editorCore
     */
    constructor(editorCore) {
        this.editorCore = editorCore;

        // UI要素の参照
        this.searchContainer = document.getElementById('search-panel');
        this.searchInput = document.getElementById('search-input');
        this.replaceInput = document.getElementById('replace-input');
        this.regexModeCheckbox = document.getElementById('regex-mode-checkbox');
        this.caseSensitiveCheckbox = document.getElementById('case-sensitive-checkbox');
        this.searchInfo = document.getElementById('search-info');

        // 検索状態
        this.matches = [];
        this.currentMatchIndex = -1;
        this.regexMode = false;
        this.caseSensitive = false;

        /** @type {boolean} 編集ロック状態 */
        this._locked = false;

        this.init();
    }

    /**
     * TiptapのDOM要素を取得します。
     * @returns {HTMLElement|null} Tiptapがレンダリングしたエディタ要素
     */
    getEditorElement() {
        return this.editorCore.editorContainer.querySelector('.tiptap');
    }

    /**
     * イベントリスナーを初期化します。
     */
    init() {
        // 検索パネルの表示/非表示
        document.getElementById('searchBtn').addEventListener('click', () => this.toggleSearchPanel());

        // 検索ボタン
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

        // ナビゲーションボタン
        document.getElementById('find-next-btn').addEventListener('click', () => this.nextMatch());
        document.getElementById('find-prev-btn').addEventListener('click', () => this.prevMatch());

        // 置換ボタン
        document.getElementById('replace-btn').addEventListener('click', () => this.replaceCurrent());
        document.getElementById('replace-all-btn').addEventListener('click', () => this.replaceAll());

        // 閉じるボタン
        document.getElementById('close-search-btn').addEventListener('click', () => this.closeSearchPanel());

        // オプションチェックボックス
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

    /**
     * 編集ロック状態を設定します。
     * ロック中は置換機能をブロックしますが、検索はそのまま利用可能です。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
        // 置換関連UIの表示/非表示
        const replaceRow = document.getElementById('replace-row');
        if (replaceRow) {
            replaceRow.style.display = locked ? 'none' : '';
        }
    }

    /**
     * 検索パネルの表示/非表示を切り替えます。
     */
    toggleSearchPanel() {
        this.searchContainer.classList.toggle('hidden');
        if (!this.searchContainer.classList.contains('hidden')) {
            // ポップアップ位置の計算
            const btn = document.getElementById('searchBtn');
            if (!btn) return;
            const rect = btn.getBoundingClientRect();

            this.searchContainer.style.position = 'absolute';
            this.searchContainer.style.top = `${rect.bottom + 10}px`;
            const right = window.innerWidth - rect.right;
            this.searchContainer.style.right = `${Math.max(10, right - 10)}px`;
            this.searchContainer.style.left = 'auto';
            this.searchContainer.style.bottom = 'auto';

            this.searchInput.focus();
        } else {
            this.clearHighlights();
        }
    }

    /**
     * 検索パネルを閉じます。
     */
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
     * 検索用の正規表現を作成します。
     * @param {string} query - 検索クエリ
     * @param {boolean} useRegex - 正規表現モード
     * @param {boolean} useCaseSensitive - 大文字/小文字区別
     * @returns {RegExp|null} 正規表現オブジェクト（無効な場合はnull）
     * @private
     */
    _createSearchRegex(query, useRegex, useCaseSensitive) {
        try {
            const flags = useCaseSensitive ? 'g' : 'gi';
            if (useRegex) {
                return new RegExp(query, flags);
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return new RegExp(escapedQuery, flags);
            }
        } catch (e) {
            return null;
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

        // 正規表現を作成
        const regex = this._createSearchRegex(searchQuery, useRegex, useCaseSensitive);
        if (!regex) {
            this.updateSearchInfo('無効な正規表現です');
            return this.matches;
        }

        // Tiptap要素からテキストノードを走査
        const editorEl = this.getEditorElement();
        if (!editorEl) {
            this.updateSearchInfo();
            return this.matches;
        }

        const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
        let node;
        let nodeIndex = 0;

        while (node = walker.nextNode()) {
            const text = node.nodeValue;
            // 正規表現のlastIndexをリセット
            regex.lastIndex = 0;

            let match;
            while ((match = regex.exec(text)) !== null) {
                this.matches.push({
                    node: node,
                    nodeIndex: nodeIndex,
                    index: match.index,
                    length: match[0].length,
                    text: match[0]
                });
                // 空文字列にマッチした場合の無限ループ防止
                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
            nodeIndex++;
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
     */
    performSearchWithoutFocusChange() {
        this.search();

        if (this.matches.length > 0) {
            this.highlightMatches();
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
     * 指定されたマッチ位置にスクロールします。
     * @param {Object} match - マッチ情報
     */
    scrollToMatch(match) {
        if (match.node.parentElement && typeof match.node.parentElement.scrollIntoView === 'function') {
            match.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * マッチした箇所をハイライト表示します（現状は簡易実装）。
     */
    highlightMatches() {
        // 本格的なハイライトはcontenteditable/Tiptapの動作を不安定にする可能性があるため
        // 現在のマッチのみを選択状態にする実装としています
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

        if (match.node.parentElement && typeof match.node.parentElement.scrollIntoView === 'function') {
            match.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * HTMLコンテンツ内の特定のマッチを置換します（単一置換用）。
     * @param {string} html - 元のHTMLコンテンツ
     * @param {Object} match - マッチ情報
     * @param {string} replacement - 置換文字列
     * @returns {string} 置換後のHTMLコンテンツ
     * @private
     */
    _replaceInHtml(html, match, replacement) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
        let currentIndex = 0;
        let node;

        while (node = walker.nextNode()) {
            if (currentIndex === match.nodeIndex) {
                const text = node.nodeValue;
                node.nodeValue = text.substring(0, match.index) +
                    replacement +
                    text.substring(match.index + match.length);
                break;
            }
            currentIndex++;
        }

        return tempDiv.innerHTML;
    }

    /**
     * HTMLコンテンツ内のすべてのマッチを置換します。
     * @param {string} html - 元のHTMLコンテンツ
     * @param {string} query - 検索クエリ
     * @param {string} replacement - 置換文字列
     * @returns {string} 置換後のHTMLコンテンツ
     * @private
     */
    _replaceAllInHtml(html, query, replacement) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const regex = this._createSearchRegex(query, this.regexMode, this.caseSensitive);
        if (!regex) return html;

        const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
        const nodesToReplace = [];
        let node;

        while (node = walker.nextNode()) {
            nodesToReplace.push(node);
        }

        nodesToReplace.forEach(textNode => {
            textNode.nodeValue = textNode.nodeValue.replace(regex, replacement);
        });

        return tempDiv.innerHTML;
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

        // TiptapのHTMLを取得して置換
        const currentHtml = this.editorCore.getContent();
        const newHtml = this._replaceInHtml(currentHtml, match, replaceText);

        // Tiptapに反映（setContentを使用）
        this.editorCore.setContent(newHtml);

        // 再検索
        this.performSearch();
        return true;
    }

    /**
     * 現在のマッチを置換します（UIボタン用）。
     */
    replaceCurrent() {
        if (this._locked) return;
        this.replace();
    }

    /**
     * すべてのマッチを置換します。
     * @param {string} [replacement] - 置換文字列（省略時は入力フィールドの値を使用）
     * @returns {number} 置換した件数
     */
    replaceAll(replacement) {
        if (this._locked) return 0;
        const query = this.searchInput.value;
        const replaceText = replacement !== undefined ? replacement : this.replaceInput.value;
        if (!query) return 0;

        // まず検索を実行して件数を取得
        this.search();
        const count = this.matches.length;

        if (count === 0) return 0;

        // TiptapのHTMLを取得して一括置換
        const currentHtml = this.editorCore.getContent();
        const newHtml = this._replaceAllInHtml(currentHtml, query, replaceText);

        // Tiptapに反映
        this.editorCore.setContent(newHtml);

        // 状態をリセット
        this.matches = [];
        this.currentMatchIndex = -1;
        this.updateSearchInfo();

        return count;
    }

    /**
     * ハイライトをクリアします。
     */
    clearHighlights() {
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
