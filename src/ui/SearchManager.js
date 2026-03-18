/**
 * 検索・置換ロジック (Tiptap対応版)
 * エディタ内のテキスト検索と置換機能を提供します。
 * ハイライトは CSS Custom Highlight API を使用し、DOMを一切変更しません。
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

        /** @type {boolean} IME変換中フラグ */
        this.isComposing = false;

        // CSS Custom Highlight API のハイライトオブジェクト
        this._highlightAll = new Highlight();
        this._highlightCurrent = new Highlight();
        CSS.highlights.set('search-all', this._highlightAll);
        CSS.highlights.set('search-current', this._highlightCurrent);

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

        // IME入力状態の管理
        this.searchInput.addEventListener('compositionstart', () => { this.isComposing = true; });
        this.searchInput.addEventListener('compositionend', () => {
            this.isComposing = false;
            this.performSilentSearch();
        });

        // リアルタイム検索
        this.searchInput.addEventListener('input', () => {
            if (!this.isComposing) {
                this.performSilentSearch();
            }
        });

        // Enter / Shift+Enter でマッチ間を移動
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.matches.length > 0) {
                    if (e.shiftKey) {
                        this.prevMatch();
                    } else {
                        this.nextMatch();
                    }
                }
            }
        });

        // ナビゲーションボタン（フォーカスを検索入力欄に保持）
        document.getElementById('find-next-btn').addEventListener('click', () => {
            this.nextMatch();
            this.searchInput.focus();
        });
        document.getElementById('find-prev-btn').addEventListener('click', () => {
            this.prevMatch();
            this.searchInput.focus();
        });

        // 置換ボタン
        document.getElementById('replace-btn').addEventListener('click', () => this.replaceCurrent());
        document.getElementById('replace-all-btn').addEventListener('click', () => this.replaceAll());

        // 閉じるボタン
        document.getElementById('close-search-btn').addEventListener('click', () => this.closeSearchPanel());

        // オプションチェックボックス
        if (this.regexModeCheckbox) {
            this.regexModeCheckbox.addEventListener('change', () => {
                this.regexMode = this.regexModeCheckbox.checked;
                this.performSilentSearch();
            });
        }
        if (this.caseSensitiveCheckbox) {
            this.caseSensitiveCheckbox.addEventListener('change', () => {
                this.caseSensitive = this.caseSensitiveCheckbox.checked;
                this.performSilentSearch();
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

    // ─────────────── UI状態管理 ───────────────

    /**
     * 編集ロック状態を設定します。
     * @param {boolean} locked
     */
    setLocked(locked) {
        this._locked = locked;
        if (this.replaceInput) {
            this.replaceInput.disabled = locked;
            const replaceBtn = document.getElementById('replace-btn');
            const replaceAllBtn = document.getElementById('replace-all-btn');
            if (replaceBtn) replaceBtn.disabled = locked;
            if (replaceAllBtn) replaceAllBtn.disabled = locked;
            if (replaceBtn) replaceBtn.style.opacity = locked ? '0.5' : '1';
            if (replaceAllBtn) replaceAllBtn.style.opacity = locked ? '0.5' : '1';
        }
    }

    /**
     * 検索パネルの表示/非表示を切り替えます。
     */
    toggleSearchPanel() {
        this.searchContainer.classList.toggle('hidden');
        if (!this.searchContainer.classList.contains('hidden')) {
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

    // ─────────────── 検索オプション設定 ───────────────

    setRegexMode(enabled) {
        this.regexMode = enabled;
        if (this.regexModeCheckbox) this.regexModeCheckbox.checked = enabled;
    }

    setCaseSensitive(enabled) {
        this.caseSensitive = enabled;
        if (this.caseSensitiveCheckbox) this.caseSensitiveCheckbox.checked = enabled;
    }

    // ─────────────── 検索ロジック ───────────────

    /**
     * 検索用の正規表現を作成します。
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
     * エディタ内のテキストノードを走査し、マッチ情報の配列を返します。
     * @private
     */
    _findMatches(searchQuery, useRegex, useCaseSensitive) {
        const matches = [];
        if (!searchQuery) return matches;

        const regex = this._createSearchRegex(searchQuery, useRegex, useCaseSensitive);
        if (!regex) return matches;

        const editorEl = this.getEditorElement();
        if (!editorEl) return matches;

        const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
        let node;
        let nodeIndex = 0;

        while (node = walker.nextNode()) {
            const text = node.nodeValue;
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    node: node,
                    nodeIndex: nodeIndex,
                    index: match.index,
                    length: match[0].length,
                    text: match[0]
                });
                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
            nodeIndex++;
        }

        return matches;
    }

    /**
     * 検索を実行します (旧APIとの互換用)。
     */
    search(query, options = {}) {
        const searchQuery = query !== undefined ? query : this.searchInput.value;
        const useRegex = options.regex !== undefined ? options.regex : this.regexMode;
        const useCaseSensitive = options.caseSensitive !== undefined ? options.caseSensitive : this.caseSensitive;

        this.clearHighlights();
        this.matches = this._findMatches(searchQuery, useRegex, useCaseSensitive);
        this.currentMatchIndex = -1;
        this.updateSearchInfo();
        return this.matches;
    }

    // ─────────────── 検索実行フロー ───────────────

    /**
     * 検索を実行し、ハイライトとナビゲーションを適用します。
     */
    performSearch() {
        this.search();
        if (this.matches.length > 0) {
            this._applyHighlights();
            this.nextMatch();
        }
    }

    /**
     * 検索を実行しますが、フォーカスを検索入力欄に保持します。
     */
    performSearchWithoutFocusChange() {
        this.search();
        if (this.matches.length > 0) {
            this._applyHighlights();
            this.currentMatchIndex = 0;
            this._updateCurrentHighlight();
            this._scrollToCurrentMatch();
            this.updateSearchInfo();
        }
        if (this.searchInput && document.activeElement !== this.searchInput) {
            this.searchInput.focus();
        }
    }

    /**
     * 入力操作を阻害しないための静かな検索。
     * DOMやSelectionを一切操作せず、ハイライトと件数表示だけ更新します。
     */
    performSilentSearch() {
        const searchQuery = this.searchInput.value;

        this._clearHighlightRanges();
        this.matches = this._findMatches(searchQuery, this.regexMode, this.caseSensitive);
        this.currentMatchIndex = -1;

        if (this.matches.length > 0) {
            this._applyHighlights();
        }

        this.updateSearchInfo();
    }

    // ─────────────── マッチ移動 ───────────────

    /**
     * 次のマッチに移動します。
     */
    nextMatch() {
        if (this.matches.length === 0) return;
        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
        this._updateCurrentHighlight();
        this._scrollToCurrentMatch();
        this.updateSearchInfo();
    }

    /**
     * 前のマッチに移動します。
     */
    prevMatch() {
        if (this.matches.length === 0) return;
        this.currentMatchIndex = (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
        this._updateCurrentHighlight();
        this._scrollToCurrentMatch();
        this.updateSearchInfo();
    }

    // ─────────────── CSS Custom Highlight API ───────────────

    /**
     * 全マッチのハイライト Range を登録します。
     * @private
     */
    _applyHighlights() {
        this._highlightAll.clear();
        this._highlightCurrent.clear();

        for (const m of this.matches) {
            try {
                const range = new Range();
                range.setStart(m.node, m.index);
                range.setEnd(m.node, m.index + m.length);
                this._highlightAll.add(range);
            } catch (e) {
                // ノード参照が無効な場合はスキップ
            }
        }
    }

    /**
     * 現在のマッチだけを「濃い」ハイライトとして登録します。
     * @private
     */
    _updateCurrentHighlight() {
        this._highlightCurrent.clear();

        if (this.currentMatchIndex < 0 || this.currentMatchIndex >= this.matches.length) return;

        const m = this.matches[this.currentMatchIndex];
        try {
            const range = new Range();
            range.setStart(m.node, m.index);
            range.setEnd(m.node, m.index + m.length);
            this._highlightCurrent.add(range);
        } catch (e) {
            // ノード参照が無効な場合はスキップ
        }
    }

    /**
     * 現在のマッチ位置にスクロールします（フォーカスは移しません）。
     * @private
     */
    _scrollToCurrentMatch() {
        if (this.currentMatchIndex < 0 || this.currentMatchIndex >= this.matches.length) return;

        const m = this.matches[this.currentMatchIndex];
        if (m.node.parentElement && typeof m.node.parentElement.scrollIntoView === 'function') {
            m.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * ハイライト Range をすべてクリアします。
     * @private
     */
    _clearHighlightRanges() {
        this._highlightAll.clear();
        this._highlightCurrent.clear();
    }

    /**
     * ハイライトと検索状態をすべてクリアします。
     */
    clearHighlights() {
        this._clearHighlightRanges();
        this.matches = [];
        this.currentMatchIndex = -1;
        this.updateSearchInfo();
    }

    // ─────────────── 旧互換メソッド ───────────────

    highlightMatches() {
        this._applyHighlights();
    }

    scrollToMatch(match) {
        if (match.node.parentElement && typeof match.node.parentElement.scrollIntoView === 'function') {
            match.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    selectMatch(match) {
        this.scrollToMatch(match);
    }

    // ─────────────── 置換ロジック ───────────────

    /**
     * Tiptapのeditorインスタンスを取得します。
     * @returns {Object} Tiptap editor
     * @private
     */
    _getTiptapEditor() {
        return this.editorCore.tiptap;
    }

    /**
     * 現在のマッチを置換します。
     * @param {string} [replacement]
     * @returns {boolean}
     */
    replace(replacement) {
        if (this.currentMatchIndex === -1 || this.matches.length === 0) return false;

        const editor = this._getTiptapEditor();
        if (!editor || !editor.view) return false;

        const match = this.matches[this.currentMatchIndex];
        const replaceText = replacement !== undefined ? replacement : this.replaceInput.value;

        // ハイライトを除去してから置換
        this._clearHighlightRanges();

        try {
            // DOM ノードから ProseMirror の Pos を取得
            const from = editor.view.posAtDOM(match.node, match.index);
            const to = editor.view.posAtDOM(match.node, match.index + match.length);

            // Tiptap コマンドで指定範囲を置換
            editor.chain().setTextSelection({ from, to }).insertContent(replaceText).run();
        } catch (e) {
            console.error('Failed to replace text at pos', e);
        }

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
     * 後方のマッチから置換することで、前方のPosズレを防ぎます。
     * @param {string} [replacement]
     * @returns {number}
     */
    replaceAll(replacement) {
        if (this._locked) return 0;
        const query = this.searchInput.value;
        const replaceText = replacement !== undefined ? replacement : this.replaceInput.value;
        if (!query) return 0;

        const editor = this._getTiptapEditor();
        if (!editor || !editor.view) return 0;

        this._clearHighlightRanges();
        this.search();
        
        const count = this.matches.length;
        if (count === 0) return 0;

        // すべてのDOMに対応するPosを収集
        // 注意: 置換によってDOMが変わるため、先に全てのPosを解決してから置換するのが安全ですが、
        // Pos も前方置換するとズレるので、後方から処理します。
        const positions = [];
        for (const match of this.matches) {
            try {
                const from = editor.view.posAtDOM(match.node, match.index);
                const to = editor.view.posAtDOM(match.node, match.index + match.length);
                positions.push({ from, to });
            } catch (e) {
                // Ignore invalid DOM pos
            }
        }

        // 後ろから置換 (Posズレ回避)
        positions.sort((a, b) => b.from - a.from);

        const chain = editor.chain();
        for (const pos of positions) {
            chain.setTextSelection({ from: pos.from, to: pos.to }).insertContent(replaceText);
        }
        chain.run();

        this.matches = [];
        this.currentMatchIndex = -1;
        this.updateSearchInfo();

        return count;
    }

    // ─────────────── 検索情報表示 ───────────────

    updateSearchInfo(message) {
        if (!this.searchInfo) return;

        if (message) {
            this.searchInfo.textContent = message;
        } else if (this.matches.length === 0) {
            if (this.searchInput.value) {
                this.searchInfo.textContent = '0 / 0';
            } else {
                this.searchInfo.textContent = '';
            }
        } else {
            this.searchInfo.textContent = `${this.currentMatchIndex + 1} / ${this.matches.length} `;
        }
    }
}
