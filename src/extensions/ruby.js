/**
 * Ruby Node Extension for Tiptap
 * ルビ（振り仮名）をサポートするカスタム inline Node 拡張
 * 
 * 設計指針:
 * - inline Node として実装
 * - ベーステキストは編集可能（content: 'text*'）
 * - ルビテキスト（rt要素）は編集不可（パネル経由のみ）
 * - NodeViewで<ruby>ベーステキスト<rt contenteditable="false">...</rt></ruby>を生成
 */
import { Node, mergeAttributes, DOMParser } from 'tiptap';

export const Ruby = Node.create({
    name: 'ruby',

    // インライン要素として扱う
    group: 'inline',
    inline: true,

    // 内部にテキストコンテンツを持つ（編集可能）
    content: 'text*',

    // アトミックではない（内部テキストを編集可能にする）
    atom: false,

    // 選択可能
    selectable: true,

    // 属性の定義
    addAttributes() {
        return {
            // ルビテキスト（rt要素の内容）
            rubyText: {
                default: '',
                parseHTML: element => {
                    const rtElement = element.querySelector('rt');
                    return rtElement ? rtElement.textContent : '';
                }
            },
            // テキストの色（オプション）
            color: {
                default: null,
                parseHTML: element => element.style.color || null
            },
            // 背景色（オプション）
            backgroundColor: {
                default: null,
                parseHTML: element => element.style.backgroundColor || null
            }
        };
    },

    // HTMLからのパース設定
    parseHTML() {
        return [
            {
                tag: 'ruby',
                // rt要素を除いたコンテンツを本文として取得
                getContent: (element, schema) => {
                    // 一時的なコンテナ（インライン要素としてパースさせるためspanを使用）
                    const temp = document.createElement('span');

                    // 子要素を走査
                    Array.from(element.childNodes).forEach(node => {
                        // RT, RP 要素以外を抽出
                        const nodeName = node.nodeName.toUpperCase();
                        if (nodeName !== 'RT' && nodeName !== 'RP') {
                            temp.appendChild(node.cloneNode(true));
                        }
                    });

                    // DOMParserを使ってパース（マークを保持）
                    // contentDOMとして扱うため、Sliceとしてパース
                    const parser = DOMParser.fromSchema(schema);
                    const slice = parser.parseSlice(temp);

                    // Fragmentの内容を配列として返す（ProseMirrorがgetContentに期待する形式）
                    return slice.content;
                }
            }
        ];
    },

    // HTMLへのレンダリング設定
    renderHTML({ node, HTMLAttributes }) {
        const rubyText = node.attrs.rubyText || '';

        const rubyStyle = [];
        if (node.attrs.color) {
            rubyStyle.push(`color: ${node.attrs.color}`);
        }
        if (node.attrs.backgroundColor) {
            rubyStyle.push(`background-color: ${node.attrs.backgroundColor}`);
        }

        const rubyAttrs = mergeAttributes(HTMLAttributes);
        if (rubyStyle.length > 0) {
            rubyAttrs.style = rubyStyle.join('; ');
        }

        const rtAttrs = {
            contenteditable: 'false'
        };
        if (rubyStyle.length > 0) {
            rtAttrs.style = rubyStyle.join('; ');
        }

        // <ruby><span>0(コンテンツ)</span><rt contenteditable="false">ルビ</rt></ruby>
        // 0はTiptapのcontent hole（ベーステキストが入る）
        return ['ruby', rubyAttrs, ['span', 0], ['rt', rtAttrs, rubyText]];
    },

    // NodeViewの追加（rt要素を動的に管理）
    addNodeView() {
        return ({ node, getPos, editor, HTMLAttributes }) => {
            // コンテナ（ruby要素）
            const dom = document.createElement('ruby');

            // コンテンツコンテナ（編集可能なベーステキスト領域）
            const contentDOM = document.createElement('span');
            contentDOM.className = 'ruby-base-text';
            dom.appendChild(contentDOM);

            // rt要素（編集不可）
            const rt = document.createElement('rt');
            rt.contentEditable = 'false';
            rt.textContent = node.attrs.rubyText || '';
            dom.appendChild(rt);

            /**
             * コンテンツからカラー情報を抽出する
             * @param {Node} node - ProseMirrorノード
             * @returns {{color: string|null, backgroundColor: string|null}}
             */
            const extractColorsFromContent = (node) => {
                let color = null;
                let backgroundColor = null;

                // ノードのコンテンツを走査してマークから色を取得
                node.content.forEach(child => {
                    if (child.marks && child.marks.length > 0) {
                        for (const mark of child.marks) {
                            // textStyleマークからcolor属性を取得
                            if (mark.type.name === 'textStyle' && mark.attrs.color) {
                                color = mark.attrs.color;
                            }
                            // highlightマークからcolor属性を取得
                            if (mark.type.name === 'highlight' && mark.attrs.color) {
                                backgroundColor = mark.attrs.color;
                            }
                        }
                    }
                });

                return { color, backgroundColor };
            };

            /**
             * スタイルを適用する
             */
            const applyStyles = (node) => {
                // ノード属性からの色
                let color = node.attrs.color;
                let backgroundColor = node.attrs.backgroundColor;

                // コンテンツのマークからの色（属性より優先）
                const contentColors = extractColorsFromContent(node);
                if (contentColors.color) {
                    color = contentColors.color;
                }
                if (contentColors.backgroundColor) {
                    backgroundColor = contentColors.backgroundColor;
                }

                // スタイル適用
                if (color) {
                    rt.style.color = color;
                    dom.style.color = color;
                } else {
                    rt.style.color = '';
                    dom.style.color = '';
                }
                if (backgroundColor) {
                    rt.style.backgroundColor = backgroundColor;
                    dom.style.backgroundColor = backgroundColor;
                } else {
                    rt.style.backgroundColor = '';
                    dom.style.backgroundColor = '';
                }
            };

            // 初期スタイル適用
            applyStyles(node);

            return {
                dom,
                contentDOM, // これによりTiptapがベーステキストを管理
                update: (updatedNode) => {
                    if (updatedNode.type.name !== 'ruby') {
                        return false;
                    }

                    // rt要素のテキストを更新
                    rt.textContent = updatedNode.attrs.rubyText || '';

                    // スタイルを更新（コンテンツのマークも考慮）
                    applyStyles(updatedNode);

                    return true;
                }
            };
        };
    },

    // コマンドの追加
    addCommands() {
        return {
            /**
             * 選択範囲にルビを設定する
             * 選択されたテキストをベーステキストとして使用
             * @param {string} rubyText - ルビテキスト
             */
            setRuby: (rubyText) => ({ state, commands, chain }) => {
                const { from, to } = state.selection;
                const baseText = state.doc.textBetween(from, to, '');

                if (!baseText) {
                    return false;
                }

                // 選択範囲のマーク（色・ハイライト）を取得
                let marks = [];
                state.doc.nodesBetween(from, to, (node, pos) => {
                    if (node.isText && node.marks && node.marks.length > 0) {
                        marks = node.marks;
                        return false; // 最初のテキストノードのマークを使用
                    }
                });

                // テキストコンテンツにマークを適用
                const textContent = {
                    type: 'text',
                    text: baseText,
                    marks: marks.map(mark => ({
                        type: mark.type.name,
                        attrs: mark.attrs
                    }))
                };

                // 選択範囲をルビノードに置き換える
                return chain()
                    .deleteRange({ from, to })
                    .insertContentAt(from, {
                        type: this.name,
                        attrs: { rubyText },
                        content: [textContent]
                    })
                    .run();
            },
            /**
             * ルビを更新する
             * @param {string} rubyText - 新しいルビテキスト
             */
            updateRuby: (rubyText) => ({ state, commands }) => {
                const { from } = state.selection;
                const $pos = state.doc.resolve(from);

                // 現在位置からrubyノードを探す
                for (let d = $pos.depth; d >= 0; d--) {
                    const node = $pos.node(d);
                    if (node.type.name === this.name) {
                        const start = $pos.before(d);
                        return commands.updateAttributes(this.name, { rubyText });
                    }
                }

                return false;
            },
            /**
             * ルビを削除してベーステキストのみを残す
             */
            unsetRuby: () => ({ state, chain }) => {
                const { from, to } = state.selection;
                const $pos = state.doc.resolve(from);

                // 現在位置からrubyノードを探す
                for (let d = $pos.depth; d >= 0; d--) {
                    const node = $pos.node(d);
                    if (node.type.name === this.name) {
                        const start = $pos.before(d);
                        const end = $pos.after(d);
                        const baseText = node.textContent;

                        return chain()
                            .deleteRange({ from: start, to: end })
                            .insertContentAt(start, baseText)
                            .run();
                    }
                }

                return false;
            }
        };
    }
});

export default Ruby;
