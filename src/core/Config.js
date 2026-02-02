/**
 * アプリケーション設定
 * 
 * マジックナンバーや定数をここで一元管理します。
 * アプリケーション全体で使用される設定値を定義します。
 * 
 * @module core/Config
 */

/**
 * アプリケーション設定オブジェクト
 * @constant {Object}
 */
export const CONFIG = {
    // =====================================================
    // フローチャート設定
    // =====================================================
    FLOWCHART: {
        /** シェイプのデフォルトサイズ設定 */
        SHAPE: {
            WIDTH: 120,          // デフォルト幅（px）
            HEIGHT: 36,          // デフォルト高さ（px）
            MIN_WIDTH: 120,      // 最小幅（px）
            MIN_HEIGHT: 36       // 最小高さ（px）
        },

        /** レイアウト設定 */
        LAYOUT: {
            START_X: 50,             // 初期配置X座標
            START_Y: 50,             // 初期配置Y座標
            STEP_X: 150,             // 横方向の間隔
            STEP_Y: 100,             // 縦方向の間隔
            WRAP_X: 800,             // 折り返し位置
            GROUP_PADDING: 20,        // グループの内側余白
            GROUP_HEADER_HEIGHT: 40   // グループヘッダーの高さ
        },

        /** 色設定 */
        COLORS: {
            DEFAULT_BG: '#ffffff',                    // デフォルト背景色
            DEFAULT_BORDER: '#cbd5e1',                // デフォルト枠線色
            DEFAULT_TEXT: 'var(--text-color)',        // デフォルト文字色
            SELECTED_BORDER: 'var(--primary-color)', // 選択時枠線色
            CONNECTION_DEFAULT: '#94a3b8',            // 接続線デフォルト色
            CONNECTION_SELECTED: 'var(--primary-color)' // 接続線選択時色
        }
    },

    // =====================================================
    // エディタ設定
    // =====================================================
    EDITOR: {
        DEBOUNCE_WAIT: 500,      // デバウンス待機時間（ms）
        MAX_IMAGE_WIDTH: 500,    // 画像の最大幅（px）

        /** 
         * 文字色用カラーパレット
         * 1行目左上がnull = デフォルト色に戻す
         */
        TEXT_COLORS: [
            { color: null, name: 'デフォルト' },
            { color: '#abb1b5', name: 'フォッグ' },
            { color: '#946c45', name: 'カフェオレ' },
            { color: '#f39800', name: 'マリーゴールド' },
            { color: '#e9bc00', name: 'トパーズ' },
            { color: '#578a3d', name: 'アイビーグリーン' },
            { color: '#0068b7', name: 'コバルトブルー' },
            { color: '#5a4498', name: 'バイオレット' },
            { color: '#dc6b9a', name: 'コスモス' },
            { color: '#ea5550', name: 'ポピーレッド' }
        ],

        /** 
         * ハイライト色用カラーパレット
         * 1行目左上がnull = クリア/透明
         */
        HIGHLIGHT_COLORS: [
            { color: null, name: 'クリア' },
            { color: '#efefef', name: 'シルバーホワイト' },
            { color: '#f6e5cc', name: 'エクルベージュ' },
            { color: '#fbd8b5', name: 'ピーチ' },
            { color: '#fff3b8', name: 'クリームイエロー' },
            { color: '#f0f6da', name: 'ホワイトリリー' },
            { color: '#bbdbf3', name: 'フロスティブルー' },
            { color: '#d1baba', name: 'ライラック' },
            { color: '#e5c1cd', name: 'ローズドラジェ' },
            { color: '#fbdac8', name: 'シェルピンク' }
        ]
    },

    // =====================================================
    // アプリケーション共通設定
    // =====================================================
    APP: {
        NAME: 'iEditWeb',
        VERSION: '1.0.0'
    },

    // =====================================================
    // キーボードショートカット設定
    // =====================================================
    /**
     * ショートカットキー設定
     * - key: KeyboardEvent.key の値
     * - ctrlKey, shiftKey, altKey: 修飾キー（デフォルト: false）
     * - action: アクション識別子
     * - context: ショートカットが有効なコンテキスト
     */
    SHORTCUTS: {
        OUTLINE: [
            { key: 'ArrowLeft', ctrlKey: true, action: 'promote', label: '階層を上げる' },
            { key: 'ArrowRight', ctrlKey: true, action: 'demote', label: '階層を下げる' },
            { key: 'ArrowUp', ctrlKey: true, action: 'moveUp', label: '上へ移動' },
            { key: 'ArrowDown', ctrlKey: true, action: 'moveDown', label: '下へ移動' }
        ]
    }
};
