/**
 * Comment Mark Extension for Tiptap
 * テキストにコメントを追加するためのカスタム Mark 拡張
 * 
 * 設計指針:
 * - Mark（装飾）として実装（範囲選択に適用）
 * - コメントIDで複数コメントを識別
 * - コメント範囲の末尾にアイコンを表示（decoration）
 */
import { Mark, mergeAttributes } from 'tiptap';

// 一意のコメントIDを生成
const generateCommentId = () => {
    return 'comment-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

export const Comment = Mark.create({
    name: 'comment',

    // 包括的にマークを適用可能
    inclusive: false,

    // 排他モード: 同じ範囲に複数コメントを重ねない
    excludes: 'comment',

    // 属性の定義
    addAttributes() {
        return {
            // コメントの一意ID
            commentId: {
                default: null,
                parseHTML: element => element.getAttribute('data-comment-id'),
                renderHTML: attributes => {
                    if (!attributes.commentId) return {};
                    return { 'data-comment-id': attributes.commentId };
                }
            },
            // コメント本文
            commentText: {
                default: '',
                parseHTML: element => element.getAttribute('data-comment-text') || '',
                renderHTML: attributes => {
                    if (!attributes.commentText) return {};
                    return { 'data-comment-text': attributes.commentText };
                }
            }
        };
    },

    // HTMLからのパース設定
    parseHTML() {
        return [
            {
                tag: 'span[data-comment-id]'
            }
        ];
    },

    // HTMLへのレンダリング設定
    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(HTMLAttributes, { class: 'comment-mark' }),
            0
        ];
    },

    // コマンドの追加
    addCommands() {
        return {
            /**
             * 選択範囲にコメントを設定する
             * @param {string} commentText - コメント本文
             */
            setComment: (commentText) => ({ commands }) => {
                const commentId = generateCommentId();
                return commands.setMark(this.name, { commentId, commentText });
            },

            /**
             * 既存コメントを更新する
             * @param {string} commentId - 更新対象のコメントID
             * @param {string} commentText - 新しいコメント本文
             */
            updateComment: (commentId, commentText) => ({ state, tr, dispatch }) => {
                if (!dispatch) return false;

                const { doc, schema } = state;
                const markType = schema.marks.comment;

                // ドキュメント全体からコメントIDに一致するマークを探して更新
                let updated = false;
                doc.descendants((node, pos) => {
                    if (node.isText) {
                        const marks = node.marks.filter(mark =>
                            mark.type.name === 'comment' &&
                            mark.attrs.commentId === commentId
                        );
                        if (marks.length > 0) {
                            const from = pos;
                            const to = pos + node.nodeSize;
                            // 古いマークを削除して新しいマークを追加
                            tr.removeMark(from, to, markType);
                            tr.addMark(from, to, markType.create({
                                commentId,
                                commentText
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
             * 選択範囲のコメントを削除する
             */
            unsetComment: () => ({ commands }) => {
                return commands.unsetMark(this.name);
            },

            /**
             * 指定IDのコメントを削除する
             * @param {string} commentId - 削除対象のコメントID
             */
            removeCommentById: (commentId) => ({ state, tr, dispatch }) => {
                if (!dispatch) return false;

                const { doc, schema } = state;
                const markType = schema.marks.comment;

                let removed = false;
                doc.descendants((node, pos) => {
                    if (node.isText) {
                        const marks = node.marks.filter(mark =>
                            mark.type.name === 'comment' &&
                            mark.attrs.commentId === commentId
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
    }
});

export default Comment;
