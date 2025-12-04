/**
 * エディタロジック
 */
import { debounce, rgbToHex, generateId } from './utils.js';
import { Sanitizer } from './sanitizer.js';
import { CONFIG } from './config.js';

/**
 * エディタのロジックを管理するクラス
 * テキストの入力、画像の挿入、ツールバーの操作などを担当します。
 */
export class EditorManager {
    /**
     * @param {import('./eventBus.js').EventBus} eventBus - イベントバス
     */
    constructor(eventBus) {
        this.editor = document.getElementById('editor');
        this.outlineList = document.getElementById('outline-list');
        this.floatToolbar = document.getElementById('float-toolbar');
        this.textColorPicker = document.getElementById('textColorPicker');
        this.highlightPicker = document.getElementById('highlightPicker');
        this.eventBus = eventBus;
        this.sanitizer = new Sanitizer();

        this.savedSelection = null;

        this.init();
    }

    init() {
        // 入力処理
        this.editor.addEventListener('input', debounce(() => {
            this.updateOutline();
            // イベント発火
            this.eventBus.emit('editor:update', this.getHeadings());
        }, CONFIG.EDITOR.DEBOUNCE_WAIT));

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
        container.contentEditable = 'false';
        container.style.position = 'relative';
        container.style.display = 'inline-block';
        container.style.margin = '10px';

        const img = document.createElement('img');
        img.src = src;
        img.style.maxWidth = '100%';
        img.style.display = 'block';

        // デフォルトサイズ（大きすぎないように）
        img.onload = () => {
            if (img.width > CONFIG.EDITOR.MAX_IMAGE_WIDTH) img.style.width = `${CONFIG.EDITOR.MAX_IMAGE_WIDTH}px`;
        };

        container.appendChild(img);

        // リサイズハンドル
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.style.position = 'absolute';
        handle.style.bottom = '0';
        handle.style.right = '0';
        handle.style.width = '10px';
        handle.style.height = '10px';
        handle.style.backgroundColor = '#3b82f6';
        handle.style.cursor = 'nwse-resize';

        container.appendChild(handle);

        // 挿入
        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            range.insertNode(container);
            range.collapse(false);
        } else {
            this.editor.appendChild(container);
        }

        // リサイズイベント
        this.setupResizeHandler(container, img, handle);
    }

    setupResizeHandler(container, img, handle) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = img.offsetWidth;
            startHeight = img.offsetHeight;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        const onMouseMove = (e) => {
            if (!isResizing) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // アスペクト比を維持するかどうか？
            // ここでは簡易的に幅だけ変更し、高さはautoにする
            const newWidth = startWidth + dx;
            if (newWidth > 50) {
                img.style.width = `${newWidth}px`;
                img.style.height = 'auto';
            }
        };

        const onMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
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

        const colors = CONFIG.EDITOR.COLORS;

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

    /**
     * エディタ内の見出し要素を取得します。
     * 各見出しに一意のIDを付与し、フローチャートとの同期に使用します。
     * @returns {Array<{text: string, level: number, element: HTMLElement, id: string}>} 見出し情報の配列
     */
    getHeadings() {
        return Array.from(this.editor.querySelectorAll('h1, h2, h3, h4'))
            .map(h => {
                // IDがなければ生成して付与
                if (!h.id) {
                    h.id = generateId();
                }
                return {
                    text: h.textContent,
                    level: parseInt(h.tagName[1]),
                    element: h,
                    id: h.id
                };
            });
    }
    insertRuby() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const text = range.toString();

        if (!text) {
            alert('ルビを振るテキストを選択してください。');
            return;
        }

        const rubyText = prompt('ルビを入力してください:', '');
        if (rubyText) {
            const ruby = document.createElement('ruby');
            ruby.textContent = text;
            const rt = document.createElement('rt');
            rt.textContent = rubyText;
            ruby.appendChild(rt);

            range.deleteContents();
            range.insertNode(ruby);

            // カーソルをルビの後ろに移動
            range.setStartAfter(ruby);
            range.setEndAfter(ruby);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    insertCodeBlock() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const pre = document.createElement('pre');
        const code = document.createElement('code');

        const text = range.toString();
        code.textContent = text || 'コードを入力...';

        pre.appendChild(code);

        if (text) {
            range.deleteContents();
            range.insertNode(pre);
        } else {
            range.insertNode(pre);
        }

        // カーソルをコードブロック内に移動したいが、contentEditableの挙動が怪しいので
        // 一旦後ろに移動するか、そのままにする
        range.setStartAfter(pre);
        range.setEndAfter(pre);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}
