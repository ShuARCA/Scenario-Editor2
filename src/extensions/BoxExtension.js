import { Node, mergeAttributes, Extension } from 'tiptap';
import { ColorPicker } from '../ui/ColorPicker.js';

/**
 * 定数定義
 */
const CLASS_NAMES = {
    WRAPPER: 'box-container box',
    TITLE: 'box-title',
    BODY: 'box-body',
    CONTROLS: 'box-controls',
    COPY_BTN: 'box-control-btn box-copy-btn',
    SETTINGS_BTN: 'box-control-btn box-settings-btn',
    SETTINGS_PANEL: 'box-settings-panel',
    SETTINGS_SECTION: 'box-settings-section',
    SETTINGS_TITLE: 'box-settings-title',
    SETTINGS_ROW: 'box-settings-row',
    COLOR_SWATCH: 'box-settings-color-swatch', // クラス名変更
    CONTENT_WRAPPER: 'box-content-wrapper',
    HIDDEN: 'hidden',
    ACTIVE: 'active',
}

const ICONS = {
    COPY: `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
        </svg>
    `,
    CHECK: `
        <svg viewBox="0 0 24 24" width="16" height="16" style="color: #10b981;">
            <path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
        </svg>
    `,
    SETTINGS: `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.04 4.95,18.95L7.44,17.95C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.95L19.05,18.95C19.27,19.04 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
        </svg>
    `
}

/**
 * BoxNodeView クラス
 * BoxContainer の NodeView を管理する
 */
class BoxNodeView {
    // 現在開いている設定パネルのインスタンスを保持
    static activeInstance = null;

    constructor(node, view, getPos, editor) {
        this.node = node;
        this.view = editor.view; // editor.view を使用
        this.getPos = getPos;
        this.editor = editor;

        // ユニークIDの生成（ラジオボタンのグループ化等に使用）
        this.nodeId = `box-${Math.random().toString(36).substring(7)}`;

        // コンポーネント参照用
        this.dom = null;
        this.contentDOM = null;
        this.controlsDiv = null;
        this.settingsPanel = null;
        this.settingsBtn = null;
        this.copyBtn = null;
        this.styleSelect = null; // select要素への参照
        this.colorSwatch = null; // スウォッチ要素への参照
        this.activeColorPicker = null; // ColorPickerインスタンス
        this.globalPickerContainer = document.getElementById('global-color-picker-container');

        // イベントハンドラをバインド（削除時に参照が必要なため）
        this.outsideClickHandler = (e) => {
            if (!this.settingsPanel.classList.contains(CLASS_NAMES.HIDDEN)) {
                // パネル内または設定ボタン内のクリックは無視
                if (this.settingsPanel.contains(e.target) || this.settingsBtn.contains(e.target)) {
                    return;
                }
                this.closeSettings();
            }
        };

        this._initDOM();
        this._bindEvents();
        this._updateAttributes(this.node.attrs);
    }

    _initDOM() {
        // Main Wrapper
        this.dom = document.createElement('div');
        this.dom.className = CLASS_NAMES.WRAPPER;
        this.dom.style.position = 'relative';

        // Controls Area
        this.controlsDiv = document.createElement('div');
        this.controlsDiv.className = CLASS_NAMES.CONTROLS;

        // Copy Button
        this.copyBtn = this._createButton(CLASS_NAMES.COPY_BTN, '内容をコピー', ICONS.COPY);

        // Settings Button
        this.settingsBtn = this._createButton(CLASS_NAMES.SETTINGS_BTN, 'ボックス設定', ICONS.SETTINGS);

        this.controlsDiv.appendChild(this.copyBtn);
        this.controlsDiv.appendChild(this.settingsBtn);
        this.dom.appendChild(this.controlsDiv);

        // Settings Panel
        this.settingsPanel = this._createSettingsPanel();
        this.dom.appendChild(this.settingsPanel);

        // Content Wrapper
        this.contentDOM = document.createElement('div');
        this.contentDOM.className = CLASS_NAMES.CONTENT_WRAPPER;
        this.dom.appendChild(this.contentDOM);
    }

    _createButton(className, title, iconHtml) {
        const btn = document.createElement('button');
        btn.className = className;
        btn.contentEditable = 'false';
        btn.title = title;
        btn.innerHTML = iconHtml;
        return btn;
    }

    _createSettingsPanel() {
        const panel = document.createElement('div');
        panel.className = `${CLASS_NAMES.SETTINGS_PANEL} ${CLASS_NAMES.HIDDEN}`;
        panel.contentEditable = 'false';

        // Section
        const section = document.createElement('div');
        section.className = CLASS_NAMES.SETTINGS_SECTION;
        panel.appendChild(section);

        // Title
        const title = document.createElement('div');
        title.className = CLASS_NAMES.SETTINGS_TITLE;
        title.textContent = 'ボックス設定'; // 必要に応じて変更
        section.appendChild(title);

        // Style Row (Select)
        const styleRow = document.createElement('div');
        styleRow.className = CLASS_NAMES.SETTINGS_ROW;

        const styleLabel = document.createElement('label');
        styleLabel.textContent = 'タイトル表示';
        styleRow.appendChild(styleLabel);

        this.styleSelect = document.createElement('select');
        const styles = [
            { value: 'inside', label: 'ボックス内' },
            { value: 'on-border', label: '枠線上' },
            { value: 'none', label: 'なし' }
        ];

        styles.forEach(style => {
            const option = document.createElement('option');
            option.value = style.value;
            option.textContent = style.label;
            this.styleSelect.appendChild(option);
        });

        // イベント設定
        this.styleSelect.addEventListener('change', (e) => {
            this._handleAttributeChange({ titleStyle: e.target.value });
        });

        styleRow.appendChild(this.styleSelect);
        section.appendChild(styleRow);

        // Color Row
        const colorRow = document.createElement('div');
        colorRow.className = CLASS_NAMES.SETTINGS_ROW;

        const colorLabel = document.createElement('label');
        colorLabel.textContent = '枠線の色';
        colorRow.appendChild(colorLabel);

        this.colorSwatch = document.createElement('div');
        this.colorSwatch.className = CLASS_NAMES.COLOR_SWATCH;
        this.colorSwatch.tabIndex = 0; // フォーカス可能にする

        // イベント設定
        this.colorSwatch.addEventListener('click', (e) => {
            const currentColor = this.node.attrs.borderColor || '#cbd5e1';
            this._openColorPicker(this.colorSwatch, currentColor);
        });

        colorRow.appendChild(this.colorSwatch);
        section.appendChild(colorRow);

        return panel;
    }

    _openColorPicker(targetEl, initialColor) {
        // 既存のピッカーがあれば閉じる（他で開いている場合など）
        this._closeColorPicker();

        if (!this.globalPickerContainer) return;

        // 位置計算 (Box設定メニューの横に出すなど)
        const rect = targetEl.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const left = rect.right + 5 + window.scrollX;

        this.globalPickerContainer.style.top = `${top}px`;
        this.globalPickerContainer.style.left = `${left}px`;
        this.globalPickerContainer.style.display = 'block';

        // ピッカー生成
        this.activeColorPicker = new ColorPicker(this.globalPickerContainer, {
            color: initialColor,
            onChange: (hex) => {
                // UIへの即時反映（プレビュー）
                this.dom.style.setProperty('--box-border-color', hex);
                this._updateSwatch(hex);
                // 属性更新
                this._handleAttributeChange({ borderColor: hex });
            }
        });
    }

    _closeColorPicker() {
        if (this.globalPickerContainer) {
            this.globalPickerContainer.innerHTML = '';
            this.globalPickerContainer.style.display = 'none';
        }
        this.activeColorPicker = null;
    }

    _updateSwatch(color) {
        if (this.colorSwatch) {
            this.colorSwatch.style.setProperty('--swatch-color', color);
            this.colorSwatch.dataset.color = color;
        }
    }

    _bindEvents() {
        // コピーボタンの動作
        this.copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this._handleCopy();
        });

        // 設定ボタンの動作
        this.settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this._toggleSettings();
        });

        // 設定パネル内のクリックイベント伝播防止
        this.settingsPanel.addEventListener('mousedown', (e) => e.stopPropagation());
        this.settingsPanel.addEventListener('click', (e) => e.stopPropagation());

        // 外部クリックで設定パネルを閉じる処理は、エディタ全体のイベント管理に委ねるのが理想だが、
        // ここでは簡易的に実装するか、ユーザー操作に任せる。
        // 今回は実装をシンプルに保つため、トグル動作のみとする。
    }

    _handleCopy() {
        const bodyEl = this.dom.querySelector(`.${CLASS_NAMES.BODY}`);
        if (bodyEl) {
            const text = bodyEl.innerText;
            navigator.clipboard.writeText(text).then(() => {
                const originalIcon = this.copyBtn.innerHTML;
                this.copyBtn.innerHTML = ICONS.CHECK;
                setTimeout(() => this.copyBtn.innerHTML = originalIcon, 2000);
            }).catch(err => console.error('Copy failed:', err));
        }
    }

    _toggleSettings() {
        const isHidden = this.settingsPanel.classList.contains(CLASS_NAMES.HIDDEN);

        if (isHidden) {
            // 開く処理

            // 他に開いているものがあれば閉じる
            if (BoxNodeView.activeInstance && BoxNodeView.activeInstance !== this) {
                BoxNodeView.activeInstance.closeSettings();
            }

            // アンカー設定
            this.settingsBtn.style.anchorName = '--box-settings-anchor';

            this.settingsPanel.classList.remove(CLASS_NAMES.HIDDEN);
            this.settingsBtn.classList.add(CLASS_NAMES.ACTIVE);

            BoxNodeView.activeInstance = this;

            // 外側クリックの監視を開始
            // setTimeoutを使用して、現在のクリックイベントが即座に反応しないようにする（必要であれば）
            // ここではmousedownを使用しているため、clickイベントとの競合は少ないが念のため
            requestAnimationFrame(() => {
                document.addEventListener('mousedown', this.outsideClickHandler);
            });
        } else {
            // 閉じる処理
            this.closeSettings();
        }
    }

    closeSettings() {
        this.settingsPanel.classList.add(CLASS_NAMES.HIDDEN);
        this.settingsBtn.classList.remove(CLASS_NAMES.ACTIVE);
        this.settingsBtn.style.anchorName = ''; // アンカー解除

        // カラーピッカーも閉じる
        this._closeColorPicker();

        // 外側クリックの監視を解除
        document.removeEventListener('mousedown', this.outsideClickHandler);

        if (BoxNodeView.activeInstance === this) {
            BoxNodeView.activeInstance = null;
        }
    }

    _handleAttributeChange(attrs) {
        if (typeof this.getPos === 'function') {
            const pos = this.getPos();
            if (pos !== undefined) {
                const tr = this.editor.view.state.tr.setNodeMarkup(pos, null, {
                    ...this.node.attrs,
                    ...attrs
                });
                this.editor.view.dispatch(tr);
            }
        }
    }

    _updateAttributes(attrs) {
        const titleStyle = attrs.titleStyle || 'inside';
        const borderColor = attrs.borderColor || '#cbd5e1';

        // DOM属性の更新
        this.dom.setAttribute('data-title-style', titleStyle);
        this.dom.setAttribute('data-border-color', borderColor);
        this.dom.style.setProperty('--box-border-color', borderColor);

        // セレクトボックスの更新
        if (this.styleSelect && this.styleSelect.value !== titleStyle) {
            this.styleSelect.value = titleStyle;
        }

        // スウォッチの更新
        this._updateSwatch(borderColor);
    }

    update(node) {
        if (node.type.name !== this.node.type.name) {
            return false;
        }

        this.node = node;
        this._updateAttributes(node.attrs);
        return true;
    }

    ignoreMutation(mutation) {
        // UIコントロール内での変更はTiTipに無視させる
        if (this.controlsDiv.contains(mutation.target) || this.settingsPanel.contains(mutation.target)) {
            return true;
        }
        // 親DOMの属性変更も無視
        if (mutation.target === this.dom && mutation.type === 'attributes') {
            return true;
        }
        return false;
    }

    stopEvent(event) {
        // UIコントロール内のイベントはエディタに伝播させない
        if (this.controlsDiv.contains(event.target) || this.settingsPanel.contains(event.target)) {
            return true;
        }
        return false;
    }
}

/**
 * BoxTitle ノード
 */
export const BoxTitle = Node.create({
    name: 'boxTitle',
    content: 'inline*',
    group: 'block',
    defining: true,
    isolating: true,

    parseHTML() {
        return [
            { tag: `div.${CLASS_NAMES.TITLE}` },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: CLASS_NAMES.TITLE }), 0]
    },

    addKeyboardShortcuts() {
        return {
            'Enter': () => {
                if (!this.editor.isActive('boxTitle')) {
                    return false
                }
                const pos = this.editor.state.selection.$head.after()
                try {
                    this.editor.commands.setTextSelection(pos)
                    return true
                } catch (e) {
                    return false
                }
            }
        }
    }
})

/**
 * BoxBody ノード
 */
export const BoxBody = Node.create({
    name: 'boxBody',
    content: 'block+',
    group: 'block',
    defining: true,
    isolating: true,

    parseHTML() {
        return [{ tag: `div.${CLASS_NAMES.BODY}` }]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, { class: CLASS_NAMES.BODY }),
            0,
        ]
    },

    addKeyboardShortcuts() {
        return {
            'Shift-Enter': () => {
                if (!this.editor.isActive('boxBody')) {
                    return false;
                }
                const { state } = this.editor;
                const { $from } = state.selection;
                let wrapperPos = -1;

                // 親の boxContainer を探す
                for (let d = $from.depth; d > 0; d--) {
                    if ($from.node(d).type.name === 'boxContainer') {
                        wrapperPos = $from.after(d);
                        break;
                    }
                }

                if (wrapperPos > -1) {
                    return this.editor.chain()
                        .insertContentAt(wrapperPos, { type: 'paragraph' })
                        .setTextSelection(wrapperPos + 1)
                        .scrollIntoView()
                        .run();
                }
                return false;
            },
        }
    }
})

/**
 * BoxContainer ノード
 */
export const BoxContainer = Node.create({
    name: 'boxContainer',
    group: 'block',
    content: 'boxTitle boxBody',
    defining: true,
    isolating: true,

    addAttributes() {
        return {
            titleStyle: {
                default: 'inside', // 'none', 'inside', 'on-border'
            },
            borderColor: {
                default: '#cbd5e1',
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'div',
                class: 'box-container',
                contentElement: `.${CLASS_NAMES.CONTENT_WRAPPER}`,
                getAttrs: node => {
                    const style = node.getAttribute('data-title-style');
                    const color = node.getAttribute('data-border-color') || node.style.getPropertyValue('--box-border-color');
                    return {
                        titleStyle: style || 'inside',
                        borderColor: color || '#cbd5e1'
                    };
                }
            }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        // SSR/静的レンダリング用
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                class: CLASS_NAMES.WRAPPER,
                'data-title-style': HTMLAttributes.titleStyle,
                'data-border-color': HTMLAttributes.borderColor,
                style: `--box-border-color: ${HTMLAttributes.borderColor}`
            }),
            ['div', { class: CLASS_NAMES.CONTENT_WRAPPER }, 0]
        ]
    },

    addNodeView() {
        return ({ node, view, getPos, editor }) => {
            // BoxNodeView インスタンスを生成して返す
            return new BoxNodeView(node, view, getPos, editor);
        }
    },

    addCommands() {
        return {
            setBox: attributes => ({ commands }) => {
                return commands.setNode(this.name, attributes)
            },
            toggleBox: attributes => ({ chain, state }) => {
                const isActive = state.selection.$from.node(-1).type.name === this.name ||
                    (state.selection.$from.depth > 1 && state.selection.$from.node(-2)?.type.name === this.name);

                if (isActive) {
                    return chain().unsetBox().run();
                }

                return chain()
                    .command(({ tr, state, dispatch }) => {
                        if (dispatch) {
                            const { $from, $to } = state.selection
                            const range = $from.blockRange($to)
                            if (!range) return false

                            const text = state.doc.textBetween(range.start, range.end, '\n', '\n')

                            const titleNode = state.schema.nodes.boxTitle.create({}, state.schema.text('タイトル'))

                            const lines = text.split('\n');
                            const paragraphs = lines.map(line =>
                                state.schema.nodes.paragraph.create({}, line ? state.schema.text(line) : null)
                            );
                            if (paragraphs.length === 0) {
                                paragraphs.push(state.schema.nodes.paragraph.create());
                            }

                            const bodyNode = state.schema.nodes.boxBody.create(attributes, paragraphs)
                            const wrapperNode = state.schema.nodes.boxContainer.create(attributes, [titleNode, bodyNode])

                            tr.replaceRangeWith(range.start, range.end, wrapperNode)
                        }
                        return true
                    })
                    .run()
            },
            unsetBox: () => ({ state, dispatch, tr }) => {
                const { $from } = state.selection;
                let depth = $from.depth;
                let wrapperPos = -1;
                while (depth > 0) {
                    if ($from.node(depth).type.name === this.name) {
                        wrapperPos = $from.before(depth);
                        break;
                    }
                    depth--;
                }

                if (wrapperPos === -1) return false;

                const wrapperNode = state.doc.nodeAt(wrapperPos);
                if (!wrapperNode) return false;

                const titleNode = wrapperNode.child(0);
                const bodyNode = wrapperNode.child(1);
                const titleText = titleNode.textContent;

                if (dispatch) {
                    const newNodes = [];
                    if (titleText) {
                        newNodes.push(state.schema.nodes.paragraph.create({}, state.schema.text(titleText)));
                    }
                    bodyNode.content.forEach(node => {
                        newNodes.push(node);
                    });
                    if (newNodes.length === 0) {
                        newNodes.push(state.schema.nodes.paragraph.create());
                    }
                    tr.replaceWith(wrapperPos, wrapperPos + wrapperNode.nodeSize, newNodes);
                }
                return true;
            },
        }
    },

    addKeyboardShortcuts() {
        return {
            'Mod-Alt-c': () => this.editor.commands.toggleBox(),
        }
    },
})

/**
 * BoxExtension 拡張
 */
export const BoxExtension = Extension.create({
    name: 'boxExtension',
    addExtensions() {
        return [
            BoxTitle,
            BoxBody,
            BoxContainer,
        ]
    }
})
