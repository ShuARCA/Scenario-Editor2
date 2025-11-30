/**
 * エディタロジック
 */
import { debounce, rgbToHex } from './utils.js';
import { Sanitizer } from './sanitizer.js';

export class EditorManager {
    constructor(flowchartApp) {
        this.editor = document.getElementById('editor');
        this.outlineList = document.getElementById('outline-list');
        this.floatToolbar = document.getElementById('float-toolbar');
        this.textColorPicker = document.getElementById('textColorPicker');
        this.highlightPicker = document.getElementById('highlightPicker');
        this.flowchartApp = flowchartApp;
        this.sanitizer = new Sanitizer();

        this.savedSelection = null;

        this.init();
    }

    init() {
        // 入力処理
        this.editor.addEventListener('input', debounce(() => {
            this.updateOutline();
            if (this.flowchartApp) this.flowchartApp.syncFromEditor();
        }, 500));

        // 浮動ツールバーのための選択処理
        document.addEventListener('selectionchange', () => this.handleSelectionChange());

        // 画像ハンドリング
        this.setupImageHandling();

        // ツールバーアクションのセットアップ
        this.setupToolbarActions();
    }

    setupImageHandling() {
        // ドラッグ＆ドロップ
        this.editor.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFiles(files);
            } else {
                // HTMLコンテンツのドロップ
                const html = e.dataTransfer.getData('text/html');
                if (html) {
                    const cleanHtml = this.sanitizer.sanitize(html);
                    document.execCommand('insertHTML', false, cleanHtml);
                }
            }
        });

        this.editor.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        // 貼り付け
        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            let hasFile = false;

            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        this.handleFiles([file]);
                        hasFile = true;
                    }
                }
            }

            if (!hasFile) {
                const html = (e.clipboardData || e.originalEvent.clipboardData).getData('text/html');
                const text = (e.clipboardData || e.originalEvent.clipboardData).getData('text/plain');

                if (html) {
                    const cleanHtml = this.sanitizer.sanitize(html);
                    document.execCommand('insertHTML', false, cleanHtml);
                } else if (text) {
                    document.execCommand('insertText', false, text);
                }
            }
        });
    }

    handleFiles(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.insertImage(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    insertImage(src) {
        const container = document.createElement('div');
        container.className = 'resizable-container';
        container.contentEditable = 'false'; // コンテナ自体は編集不可にすることでリサイズハンドルを有効化
    }

    handleSelectionChange() {
        const selection = window.getSelection();

        // 選択範囲がエディタ内にあるかチェック
        if (!selection.rangeCount) {
            this.hideFloatToolbar();
            return;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const isInsideEditor = this.editor.contains(container) || container === this.editor;

        if (!isInsideEditor || selection.isCollapsed) {
            this.hideFloatToolbar();
            return;
        }

        this.showFloatToolbar(range);
        this.updateToolbarState();
    }

    showFloatToolbar(range) {
        const rect = range.getBoundingClientRect();
        const toolbarRect = this.floatToolbar.getBoundingClientRect();

        let top = rect.top - toolbarRect.height - 10;
        let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);

        // 境界チェック
        if (top < 10) top = rect.bottom + 10;
        if (left < 10) left = 10;
        if (left + toolbarRect.width > window.innerWidth - 10) left = window.innerWidth - toolbarRect.width - 10;

        this.floatToolbar.style.top = `${top + window.scrollY}px`;
        this.floatToolbar.style.left = `${left + window.scrollX}px`;
        this.floatToolbar.classList.remove('hidden');
    }

    hideFloatToolbar() {
        this.floatToolbar.classList.add('hidden');
        this.textColorPicker.classList.add('hidden');
        this.highlightPicker.classList.add('hidden');
    }

    setupToolbarActions() {
        // ボタン
        this.floatToolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                document.execCommand(cmd, false, null);
                this.updateToolbarState();
            });
        });

        // フォーマットブロック選択
        const formatSelect = document.getElementById('formatBlockSelect');
        formatSelect.addEventListener('change', () => {
            document.execCommand('formatBlock', false, formatSelect.value);
            this.editor.focus();
        });

        // カラーピッカー
        this.setupColorPicker('textColorBtn', 'textColorPicker', 'foreColor');
        this.setupColorPicker('highlightBtn', 'highlightPicker', 'hiliteColor');

        // ルビとコードブロック
        document.getElementById('rubyBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.insertRuby();
        });
        document.getElementById('codeBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.insertCodeBlock();
        });
    }

    setupColorPicker(btnId, pickerId, command) {
        const btn = document.getElementById(btnId);
        const picker = document.getElementById(pickerId);

        const colors = [
            '#000000', '#4b5563', '#ef4444', '#f59e0b', '#10b981',
            '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ffffff'
        ];

        // ピッカーの生成
        picker.innerHTML = '';
        colors.forEach(color => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            div.addEventListener('mousedown', (e) => {
                e.preventDefault(); // 選択範囲が失われるのを防ぐ
                document.execCommand(command, false, color);
                picker.classList.add('hidden');
            });
            picker.appendChild(div);
        });

        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            picker.classList.toggle('hidden');

            // ピッカーの位置設定
            const rect = btn.getBoundingClientRect();
            picker.style.top = `${rect.bottom + 5 + window.scrollY}px`;
            picker.style.left = `${rect.left + window.scrollX}px`;
        });
    }

    updateToolbarState() {
        // ボタンのアクティブ状態を更新
        ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].forEach(cmd => {
            const btn = this.floatToolbar.querySelector(`button[data-cmd="${cmd}"]`);
            if (btn) {
                if (document.queryCommandState(cmd)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });

        // 選択ボックスの更新
        const formatSelect = document.getElementById('formatBlockSelect');
        const selection = window.getSelection();
        if (selection.rangeCount) {
            let parent = selection.getRangeAt(0).commonAncestorContainer;
            if (parent.nodeType === 3) parent = parent.parentNode;

            const tagName = parent.tagName.toLowerCase();
            if (['p', 'h1', 'h2', 'h3', 'h4', 'pre', 'blockquote'].includes(tagName)) {
                formatSelect.value = tagName;
            } else {
                formatSelect.value = 'p';
            }
        }
    }

    updateOutline() {
        this.outlineList.innerHTML = '';
        const headings = this.editor.querySelectorAll('h1, h2, h3, h4');

        headings.forEach((h, index) => {
            const item = document.createElement('div');
            item.className = 'outline-item';
            item.textContent = h.textContent || '(タイトルなし)';
            item.style.paddingLeft = `${(parseInt(h.tagName[1]) - 1) * 12 + 8}px`;

            item.addEventListener('click', () => {
                h.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // アクティブハイライト
                this.outlineList.querySelectorAll('.outline-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });

            this.outlineList.appendChild(item);
        });
    }

    getHeadings() {
        return Array.from(this.editor.querySelectorAll('h1, h2, h3, h4')).map(h => ({
            text: h.textContent,
            level: parseInt(h.tagName[1]),
            element: h
        }));
    }
}
