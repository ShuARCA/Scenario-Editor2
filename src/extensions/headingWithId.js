/**
 * HeadingWithId - Tiptap用 見出し拡張機能
 * 
 * このモジュールは、Tiptapエディタの見出し（H1-H4）に以下の機能を追加します：
 * - id属性の自動生成と永続化
 * - data-outline-icon属性によるアウトライン機能との連携
 * 
 * 設計思想:
 * - Single Source of Truth: Tiptap状態を唯一の情報源とする
 * - 自動ID付与: onCreate/onTransactionフックでIDを確実に付与
 * - Undo履歴に影響しない: ID付与は履歴に残さない
 * 
 * @module extensions/headingWithId
 */
import { Node, mergeAttributes } from 'tiptap';

// ============================================================
// 定数・設定
// ============================================================

/** 
 * サポートする見出しレベル
 * @constant {number[]}
 */
const HEADING_LEVELS = [1, 2, 3, 4];

/**
 * デフォルトのアウトラインアイコン
 * @constant {string}
 */
const DEFAULT_ICON = 'document';

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * 見出し用のユニークIDを生成します。
 * 形式: "h-" + ランダム英数字9文字
 * 
 * @returns {string} 生成されたユニークID
 * @example
 * generateId() // => "h-abc123def"
 */
function generateId() {
    return 'h-' + Math.random().toString(36).substring(2, 11);
}

/**
 * 見出しレベルが有効かどうかを検証します。
 * 
 * @param {number} level - 検証する見出しレベル
 * @param {number[]} validLevels - 有効なレベルの配列
 * @returns {boolean} 有効な場合true
 */
function isValidLevel(level, validLevels) {
    return validLevels.includes(level);
}

// ============================================================
// ID管理機能
// ============================================================

/**
 * 全見出しノードのID付与を確認・補完します。
 * 
 * この関数は以下のタイミングで呼び出されます：
 * - エディタ作成時（onCreate）
 * - ドキュメント変更時（onTransaction）
 * 
 * 特徴:
 * - IDがない見出しのみに新規IDを付与
 * - Undo履歴には残さない（addToHistory: false）
 * - 変更がない場合はdispatchしない（パフォーマンス考慮）
 * 
 * @param {import('tiptap').Editor} editor - Tiptapエディタインスタンス
 */
function ensureHeadingIds(editor) {
    const { state } = editor;
    const { tr, doc } = state;
    let hasModifications = false;

    // ドキュメント内の全ノードを走査
    doc.descendants((node, pos) => {
        // 見出しノードでIDがない場合のみ処理
        if (node.type.name === 'heading' && !node.attrs.id) {
            const newId = generateId();

            // ノードの属性を更新（IDを付与）
            tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                id: newId
            });

            hasModifications = true;
        }
    });

    // 変更があった場合のみ適用
    if (hasModifications) {
        // Undo履歴に残さない設定
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
    }
}

// ============================================================
// Tiptap拡張定義
// ============================================================

/**
 * HeadingWithId拡張
 * 
 * StarterKitのHeading拡張を上書きし、以下の機能を追加：
 * - 見出しへのID自動付与
 * - アウトラインアイコンの管理
 * - 各種コマンド（setHeading, toggleHeading, setHeadingIcon）
 */
export const HeadingWithId = Node.create({
    /** ノード名（StarterKitのheadingを上書き） */
    name: 'heading',

    // ========================================
    // オプション設定
    // ========================================

    /**
     * 拡張のオプションを定義します。
     * @returns {Object} オプション設定
     */
    addOptions() {
        return {
            /** サポートする見出しレベル */
            levels: HEADING_LEVELS,
            /** HTMLレンダリング時の追加属性 */
            HTMLAttributes: {}
        };
    },

    // ========================================
    // ノード設定
    // ========================================

    /** ブロック要素として扱う */
    group: 'block',

    /** インライン要素を子として許可 */
    content: 'inline*',

    /** 見出し固有のコンテンツとして定義 */
    defining: true,

    // ========================================
    // 属性定義
    // ========================================

    /**
     * 見出しノードの属性を定義します。
     * @returns {Object} 属性定義オブジェクト
     */
    addAttributes() {
        return {
            /**
             * 見出しレベル（1-4）
             * HTMLタグ名として表現するため、属性としてはレンダリングしない
             */
            level: {
                default: 1,
                rendered: false
            },

            /**
             * 見出しの一意識別子
             * アウトライン・フローチャートとの連携に使用
             */
            id: {
                default: null,
                parseHTML: (element) => element.getAttribute('id') || null,
                renderHTML: (attributes) => ({ id: attributes.id })
            },

            /**
             * アウトラインアイコンID
             * サイドバーのアウトライン表示で使用
             */
            outlineIcon: {
                default: DEFAULT_ICON,
                parseHTML: (element) => element.getAttribute('data-outline-icon') || DEFAULT_ICON,
                renderHTML: (attributes) => ({
                    'data-outline-icon': attributes.outlineIcon || DEFAULT_ICON
                })
            }
        };
    },

    // ========================================
    // ライフサイクルフック
    // ========================================

    /**
     * エディタ作成時の処理
     * 初期コンテンツの全見出しにIDを付与
     */
    onCreate() {
        // 初回レンダリング完了後に実行
        setTimeout(() => ensureHeadingIds(this.editor), 0);
    },

    /**
     * トランザクション発生時の処理
     * 新規見出し作成時にIDを自動付与
     * 
     * @param {Object} param0 - トランザクション情報
     * @param {Transaction} param0.transaction - ProseMirrorトランザクション
     */
    onTransaction({ transaction }) {
        // ドキュメント変更時のみ処理
        if (transaction.docChanged) {
            // 現在のトランザクション完了後に実行
            setTimeout(() => ensureHeadingIds(this.editor), 0);
        }
    },

    // ========================================
    // HTMLパース・レンダリング
    // ========================================

    /**
     * HTMLから見出しをパースする設定
     * H1-H4タグを認識し、対応するレベル属性を設定
     * 
     * @returns {Array} パース設定の配列
     */
    parseHTML() {
        return this.options.levels.map(level => ({
            tag: `h${level}`,
            attrs: { level }
        }));
    },

    /**
     * 見出しをHTMLとしてレンダリングする設定
     * 
     * @param {Object} param0 - レンダリング情報
     * @param {Node} param0.node - ProseMirrorノード
     * @param {Object} param0.HTMLAttributes - HTML属性
     * @returns {Array} Tiptapレンダリング形式の配列
     */
    renderHTML({ node, HTMLAttributes }) {
        const level = node.attrs.level;
        // 無効なレベルの場合はデフォルト（H1）を使用
        const safeLevel = isValidLevel(level, this.options.levels)
            ? level
            : this.options.levels[0];

        return [
            `h${safeLevel}`,
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
            0  // コンテンツスロット
        ];
    },

    // ========================================
    // コマンド定義
    // ========================================

    /**
     * 見出し操作用のコマンドを定義します。
     * @returns {Object} コマンド定義オブジェクト
     */
    addCommands() {
        return {
            /**
             * 選択範囲を見出しに変換します。
             * 
             * @param {Object} attributes - 見出し属性
             * @param {number} attributes.level - 見出しレベル（1-4）
             * @param {string} [attributes.id] - 見出しID（省略時は自動生成）
             * @param {string} [attributes.outlineIcon] - アウトラインアイコンID
             * @returns {Function} コマンド関数
             */
            setHeading: (attributes) => ({ commands }) => {
                if (!isValidLevel(attributes.level, this.options.levels)) {
                    return false;
                }

                const attrs = {
                    ...attributes,
                    id: attributes.id || generateId()
                };

                return commands.setNode(this.name, attrs);
            },

            /**
             * 見出しと段落をトグルします。
             * 見出しの場合は段落に、段落の場合は見出しに変換
             * 
             * @param {Object} attributes - 見出し属性
             * @param {number} attributes.level - 見出しレベル（1-4）
             * @returns {Function} コマンド関数
             */
            toggleHeading: (attributes) => ({ commands }) => {
                if (!isValidLevel(attributes.level, this.options.levels)) {
                    return false;
                }

                const attrs = {
                    ...attributes,
                    id: generateId()  // トグル時は新規ID
                };

                return commands.toggleNode(this.name, 'paragraph', attrs);
            },

            /**
             * 現在の見出しのアウトラインアイコンを変更します。
             * 
             * @param {string} iconId - 設定するアイコンID
             * @returns {Function} コマンド関数
             */
            setHeadingIcon: (iconId) => ({ commands }) => {
                return commands.updateAttributes(this.name, { outlineIcon: iconId });
            },

            /**
             * 全見出しにIDが付与されていることを確認します。
             * 外部から明示的にID付与を実行する場合に使用
             * 
             * @returns {Function} コマンド関数
             */
            ensureHeadingIds: () => ({ editor }) => {
                ensureHeadingIds(editor);
                return true;
            }
        };
    },

    // ========================================
    // キーボードショートカット
    // ========================================

    /**
     * 見出し操作用のキーボードショートカットを定義します。
     * Mod+Alt+数字 で対応するレベルの見出しにトグル
     * 
     * @returns {Object} ショートカット定義オブジェクト
     * @example
     * Mod+Alt+1 -> H1にトグル
     * Mod+Alt+2 -> H2にトグル
     */
    addKeyboardShortcuts() {
        return this.options.levels.reduce((shortcuts, level) => ({
            ...shortcuts,
            [`Mod-Alt-${level}`]: () => this.editor.commands.toggleHeading({ level })
        }), {});
    }
});

// デフォルトエクスポート
export default HeadingWithId;
