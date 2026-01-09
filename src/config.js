/**
 * アプリケーション設定
 * マジックナンバーや定数をここで一元管理します。
 */

export const CONFIG = {
    // フローチャート設定
    FLOWCHART: {
        SHAPE: {
            WIDTH: 120,
            HEIGHT: 36,
            MIN_WIDTH: 120,
            MIN_HEIGHT: 36
        },
        LAYOUT: {
            START_X: 50,
            START_Y: 50,
            STEP_X: 150,
            STEP_Y: 100,
            WRAP_X: 800,
            GROUP_PADDING: 20,
            GROUP_HEADER_HEIGHT: 40
        },
        COLORS: {
            DEFAULT_BG: '#ffffff',
            DEFAULT_BORDER: '#cbd5e1',
            DEFAULT_TEXT: '#334155',
            SELECTED_BORDER: 'var(--primary-color)',
            CONNECTION_DEFAULT: '#94a3b8',
            CONNECTION_SELECTED: 'var(--primary-color)'
        }
    },
    // エディタ設定
    EDITOR: {
        DEBOUNCE_WAIT: 500,
        MAX_IMAGE_WIDTH: 500,
        // 文字色用（1行目左上がnull=デフォルト色に戻す）
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
        // ハイライト色用（1行目左上がnull=クリア/透明）
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
    }
};
