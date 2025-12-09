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
        COLORS: [
            '#24140e', '#abb1b5', '#946c45', '#f39800', '#e9bc00',
            '#578a3d', '#0068b7', '#5a4498', '#dc6b9a', '#ea5550'
        ]
    }
};
