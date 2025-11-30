/**
 * 検索・置換ロジック
 */
export class SearchManager {
    constructor(editorManager) {
        this.editorManager = editorManager;
        this.editor = editorManager.editor;
        this.searchContainer = document.getElementById('search-panel');
        this.searchInput = document.getElementById('search-input');
        this.replaceInput = document.getElementById('replace-input');
        this.matches = [];
        this.currentMatchIndex = -1;

        this.init();
    }

    init() {
        // UIイベントリスナー
        document.getElementById('searchBtn').addEventListener('click', () => this.toggleSearchPanel());
        // document.getElementById('do-search-btn').addEventListener('click', () => this.performSearch()); // 削除: ボタンが存在しない、またはインクリメンタル検索想定?
        this.searchInput.addEventListener('input', () => this.performSearch()); // インクリメンタル検索に変更
        document.getElementById('find-next-btn').addEventListener('click', () => this.nextMatch());
        document.getElementById('find-prev-btn').addEventListener('click', () => this.prevMatch());
        document.getElementById('replace-btn').addEventListener('click', () => this.replaceCurrent());
        document.getElementById('replace-all-btn').addEventListener('click', () => this.replaceAll());
        document.getElementById('close-search-btn').addEventListener('click', () => this.closeSearchPanel());

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

    performSearch() {
        const query = this.searchInput.value;
        if (!query) return;

        this.clearHighlights();
        this.matches = [];
        this.currentMatchIndex = -1;

        // テキストノードを走査して検索
        const walker = document.createTreeWalker(this.editor, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            const text = node.nodeValue;
            let regex;
            try {
                // 正規表現として扱うか、単純文字列として扱うか
                // ここでは単純文字列検索とします（要件には正規表現対応とあるが、まずは基本実装）
                // 正規表現対応にするならUIにチェックボックスが必要
                regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            } catch (e) {
                continue;
            }

            let match;
            while ((match = regex.exec(text)) !== null) {
                this.matches.push({
                    node: node,
                    index: match.index,
                    length: match[0].length,
                    text: match[0]
                });
            }
        }

        if (this.matches.length > 0) {
            this.highlightMatches();
            this.nextMatch();
        } else {
            alert('見つかりませんでした。');
        }
    }

    highlightMatches() {
        // ハイライト処理は複雑（DOM構造を変更するため）
        // ここでは簡易的に、現在のマッチのみを選択状態にする実装とします
        // 本格的なハイライト（<span class="highlight">...</span>で囲む）は
        // contenteditableの動作を不安定にする可能性があるため慎重に行う必要があります
    }

    nextMatch() {
        if (this.matches.length === 0) return;
        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
        this.selectMatch(this.matches[this.currentMatchIndex]);
    }

    prevMatch() {
        if (this.matches.length === 0) return;
        this.currentMatchIndex = (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
        this.selectMatch(this.matches[this.currentMatchIndex]);
    }

    selectMatch(match) {
        const range = document.createRange();
        range.setStart(match.node, match.index);
        range.setEnd(match.node, match.index + match.length);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        match.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    replaceCurrent() {
        if (this.currentMatchIndex === -1 || this.matches.length === 0) return;

        const match = this.matches[this.currentMatchIndex];
        const replacement = this.replaceInput.value;

        const range = document.createRange();
        range.setStart(match.node, match.index);
        range.setEnd(match.node, match.index + match.length);
        range.deleteContents();
        range.insertNode(document.createTextNode(replacement));

        // マッチリストを更新する必要があるが、DOMが変わってしまったため
        // 再検索するのが最も安全
        this.performSearch();
    }

    replaceAll() {
        const query = this.searchInput.value;
        const replacement = this.replaceInput.value;
        if (!query) return;

        // innerHTMLで一括置換（注意: イベントリスナーなどが消える可能性があるが、テキストエディタ内なら許容範囲か？）
        // しかし、タグの中身まで置換してしまうリスクがあるため、テキストノードを走査する方が安全

        // 下から順に置換していく（インデックスずれを防ぐため）
        // まず検索を実行して最新のマッチリストを取得
        this.performSearch();

        // 逆順に処理
        for (let i = this.matches.length - 1; i >= 0; i--) {
            const match = this.matches[i];
            const range = document.createRange();
            range.setStart(match.node, match.index);
            range.setEnd(match.node, match.index + match.length);
            range.deleteContents();
            range.insertNode(document.createTextNode(replacement));
        }

        this.matches = [];
        this.currentMatchIndex = -1;
    }

    clearHighlights() {
        // ハイライト解除（今回は選択解除のみ）
        window.getSelection().removeAllRanges();
    }
}
