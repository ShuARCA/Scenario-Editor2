/**
 * Link Mark Extension for Tiptap
 * テキストにリンク（URL/見出し）を追加するためのカスタム Mark 拡張
 * 
 * 設計指針:
 * - Mark（装飾）として実装（範囲選択に適用）
 * - linkIdで複数リンクを識別
 * - URLリンクまたは見出しリンク（headingId）に対応
 * - コメント機能と同様の排他モード（重複リンク防止）
 * 
 * @module extensions/link
 */
import { Mark, mergeAttributes } from 'tiptap';

// ============================================================
// 定数・ユーティリティ
// ============================================================

/**
 * 一意のリンクIDを生成
 * @returns {string} 生成されたリンクID
 */
const generateLinkId = () => {
    return 'link-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

/**
 * 文字列がURLかどうかを判定
 * @param {string} str - 判定する文字列
 * @returns {boolean} URLの場合true
 */
const isValidUrl = (str) => {
    if (!str || typeof str !== 'string') return false;
    // httpsまたはhttpで始まるか、www.で始まる場合をURL扱い
    return /^(https?:\/\/|www\.)/i.test(str.trim());
};

// ============================================================
// Tiptap Mark拡張定義
// ============================================================

export const Link = Mark.create({
    name: 'link',

    // 包括的にマークを適用可能
    inclusive: false,

    // 排他モード: 同じ範囲に複数リンクを重ねない
    excludes: 'link',

    // ========================================
    // 属性定義
    // ========================================

    addAttributes() {
        return {
            // リンクの一意ID
            linkId: {
                default: null,
                parseHTML: element => element.getAttribute('data-link-id'),
                renderHTML: attributes => {
                    if (!attributes.linkId) return {};
                    return { 'data-link-id': attributes.linkId };
                }
            },
            // リンク先URL（外部リンク用）
            href: {
                default: null,
                parseHTML: element => element.getAttribute('href'),
                renderHTML: attributes => {
                    if (!attributes.href) return {};
                    return { href: attributes.href };
                }
            },

            // 見出しリンク用の見出しID
            headingId: {
                default: null,
                parseHTML: element => element.getAttribute('data-heading-id'),
                renderHTML: attributes => {
                    if (!attributes.headingId) return {};
                    return { 'data-heading-id': attributes.headingId };
                }
            }
        };
    },

    // ========================================
    // HTMLパース・レンダリング
    // ========================================

    parseHTML() {
        return [
            {
                tag: 'a[data-link-id]'
            },
            {
                tag: 'a[href]',
                // 通常のaタグもパース対象とする
                getAttrs: element => {
                    const href = element.getAttribute('href');
                    return href ? { href } : false;
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'a',
            mergeAttributes(HTMLAttributes, { class: 'link-mark' }),
            0
        ];
    },

    // ========================================
    // コマンド定義
    // ========================================

    addCommands() {
        return {
            /**
             * 選択範囲にリンクを設定する
             * @param {Object} attrs - リンク属性
             * @param {string} [attrs.href] - リンク先URL
             * @param {string} [attrs.title] - リンクタイトル
             * @param {string} [attrs.headingId] - 見出しID
             */
            setLink: (attrs = {}) => ({ commands }) => {
                const linkId = generateLinkId();
                return commands.setMark(this.name, { linkId, ...attrs });
            },

            /**
             * 既存リンクを更新する
             * @param {string} linkId - 更新対象のリンクID
             * @param {Object} attrs - 新しいリンク属性
             */
            updateLink: (linkId, attrs) => ({ state, tr, dispatch }) => {
                if (!dispatch) return false;

                const { doc, schema } = state;
                const markType = schema.marks.link;

                let updated = false;
                doc.descendants((node, pos) => {
                    if (node.isText) {
                        const marks = node.marks.filter(mark =>
                            mark.type.name === 'link' &&
                            mark.attrs.linkId === linkId
                        );
                        if (marks.length > 0) {
                            const from = pos;
                            const to = pos + node.nodeSize;
                            // 古いマークを削除して新しいマークを追加
                            tr.removeMark(from, to, markType);
                            tr.addMark(from, to, markType.create({
                                linkId,
                                ...marks[0].attrs,
                                ...attrs
                            }));
                            updated = true;
                        }
                    }
                });

                if (updated) {
                    dispatch(tr);
                }
                return updated;
            },

            /**
             * リンクテキストを更新する（表示テキストを変更）
             * @param {string} linkId - 更新対象のリンクID
             * @param {string} newText - 新しいテキスト
             */
            updateLinkText: (linkId, newText) => ({ state, tr, dispatch }) => {
                if (!dispatch || !newText) return false;

                const { doc, schema } = state;
                const markType = schema.marks.link;

                // リンクの範囲を収集（複数ノードにまたがる場合も考慮）
                let linkRange = null;
                let linkMark = null;

                doc.descendants((node, pos) => {
                    if (node.isText && !linkRange) {
                        const marks = node.marks.filter(mark =>
                            mark.type.name === 'link' &&
                            mark.attrs.linkId === linkId
                        );
                        if (marks.length > 0) {
                            linkRange = { from: pos, to: pos + node.nodeSize };
                            linkMark = marks[0];

                            // 連続するリンクノードを探す
                            const nextPos = pos + node.nodeSize;
                            doc.nodesBetween(nextPos, doc.content.size, (nextNode, nextNodePos) => {
                                if (nextNode.isText) {
                                    const nextMarks = nextNode.marks.filter(mark =>
                                        mark.type.name === 'link' &&
                                        mark.attrs.linkId === linkId
                                    );
                                    if (nextMarks.length > 0 && nextNodePos === linkRange.to) {
                                        linkRange.to = nextNodePos + nextNode.nodeSize;
                                    }
                                }
                            });
                        }
                    }
                });

                if (!linkRange || !linkMark) return false;

                // テキストを置換し、リンクマークを再適用
                const textNode = schema.text(newText, [linkMark]);
                tr.replaceWith(linkRange.from, linkRange.to, textNode);

                if (dispatch) {
                    dispatch(tr);
                }
                return true;
            },

            /**
             * 選択範囲のリンクを削除する
             */
            unsetLink: () => ({ commands }) => {
                return commands.unsetMark(this.name);
            },

            /**
             * 指定IDのリンクを削除する
             * @param {string} linkId - 削除対象のリンクID
             */
            removeLinkById: (linkId) => ({ state, tr, dispatch }) => {
                if (!dispatch) return false;

                const { doc, schema } = state;
                const markType = schema.marks.link;

                let removed = false;
                doc.descendants((node, pos) => {
                    if (node.isText) {
                        const marks = node.marks.filter(mark =>
                            mark.type.name === 'link' &&
                            mark.attrs.linkId === linkId
                        );
                        if (marks.length > 0) {
                            const from = pos;
                            const to = pos + node.nodeSize;
                            tr.removeMark(from, to, markType);
                            removed = true;
                        }
                    }
                });

                if (removed) {
                    dispatch(tr);
                }
                return removed;
            },

            /**
             * 指定した見出しIDを持つリンクをすべて解除する
             * 見出し削除時に呼び出される
             * @param {string} headingId - 見出しID
             */
            removeLinksToHeading: (headingId) => ({ state, tr, dispatch }) => {
                if (!dispatch) return false;

                const { doc, schema } = state;
                const markType = schema.marks.link;

                let removed = false;
                doc.descendants((node, pos) => {
                    if (node.isText) {
                        const marks = node.marks.filter(mark =>
                            mark.type.name === 'link' &&
                            mark.attrs.headingId === headingId
                        );
                        if (marks.length > 0) {
                            const from = pos;
                            const to = pos + node.nodeSize;
                            tr.removeMark(from, to, markType);
                            removed = true;
                        }
                    }
                });

                if (removed) {
                    dispatch(tr);
                }
                return removed;
            }
        };
    },

    // ========================================
    // クリック動作
    // ========================================

    addProseMirrorPlugins() {
        const extension = this;
        return [];
        // クリック動作はEditorManager側で処理するため、ここでは空
    }
});

// ユーティリティ関数もエクスポート
export { isValidUrl };
export default Link;
