/**
 * 環境設定ロジック
 * テーマ、フォント、エディタの色設定、背景画像などを管理します。
 */

// ========================================
// 定数定義
// ========================================

/** 設定項目のデフォルト値 */
const DEFAULT_SETTINGS = {
    theme: 'light',
    primaryColor: '#0d9488',
    fontFamily: 'sans-serif',
    fontSize: '16px',
    editorBgColor: '#feffffff',
    editorTextColor: '#2c2c2c',
    backgroundImage: null,
    commentDisplayMode: 'hover'
};

/** テーマ定義 */
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
};

/** テーマ別のカラーパレット */
const THEME_COLORS = {
    [THEMES.LIGHT]: {
        surface: '#fafafb',
        text: '#2c2c2c',
        border: '#dedfde',
        background: '#feffffff'
    },
    [THEMES.DARK]: {
        surface: '#303030',
        text: '#e7e7e7',
        border: '#3c3c3d',
        background: '#282829ff',
        editorBgFallback: '#303030'
    }
};

/** 
 * フォントファミリーマッピング
 * 日本語対応を強化した6種類のフォントセット
 */
const FONT_FAMILIES = {
    // ゴシック体 - 一般的な文章、メモ、レポートに最適
    'sans-serif': 'Inter, "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',

    // 丸ゴシック体 - カジュアルな文章、アイデアメモ、日記に最適
    'rounded': '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", sans-serif',

    // 明朝体 - 論文、公式文書、長文に最適
    'serif': 'Merriweather, "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif',

    // 等幅フォント（コーディング向け） - プログラミング、技術文書に最適
    'monospace': '"Fira Code", "Consolas", "Courier New", monospace',

    // 等幅フォント（日本語対応） - 日本語混じりのコード、AAに最適
    'monospace-jp': '"Source Han Code JP", "MS Gothic", "Osaka-Mono", monospace',

    // システムフォント - 大量のテキスト、パフォーマンス重視に最適
    'system': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif'
};

/** 
 * フォントファミリーの表示名
 * UI上でユーザーに表示される名前
 */
const FONT_DISPLAY_NAMES = {
    'sans-serif': 'ゴシック体',
    'rounded': '丸ゴシック体',
    'serif': '明朝体',
    'monospace': '等幅（コーディング）',
    'monospace-jp': '等幅（日本語対応）',
    'system': 'システムフォント'
};

/** フォントサイズの制限 */
const FONT_SIZE_LIMITS = {
    MIN: 10,
    MAX: 32
};

/** 背景画像の透明度（16進数） */
const BG_IMAGE_OPACITY = 'cc'; // 80%

/** LocalStorageキー */
const STORAGE_KEY = 'ieditweb-settings';

/** DOM要素ID */
const ELEMENT_IDS = {
    settingsModal: 'settings-modal',
    closeBtn: 'close-settings-btn',
    saveBtn: 'save-settings-btn',
    settingsBtn: 'settingsBtn',
    themeSelect: 'theme-select',
    primaryColorPicker: 'primary-color-picker',
    fontSelect: 'font-select',
    fontSizeInput: 'font-size-input',
    editorBgColor: 'editor-bg-color',
    editorTextColor: 'editor-text-color',
    commentDisplaySelect: 'comment-display-select',
    bgImageInput: 'bg-image-input',
    deleteBgBtn: 'delete-bg-image-btn',
    bgImagePreview: 'bg-image-preview',
    editor: 'editor',
    mainContent: 'main-content',
    editorContainer: 'editor-container',
    openCustomCssBtn: 'open-custom-css-btn'
};


// ========================================
// SettingsManagerクラス
// ========================================

export class SettingsManager {
    /**
     * SettingsManagerのコンストラクタ
     * @param {Object} options - オプション設定
     * @param {boolean} options.skipDomInit - DOM初期化をスキップするか（テスト用）
     */
    constructor(options = {}) {
        // 設定値の初期化（デフォルト値のコピー）
        this.settings = { ...DEFAULT_SETTINGS };

        // DOM初期化をスキップするオプション（テスト用）
        if (!options.skipDomInit) {
            this._initializeDomElements();
            this.init();
        }
    }

    // ========================================
    // 初期化処理
    // ========================================

    /**
     * DOM要素の参照を初期化
     * @private
     */
    _initializeDomElements() {
        this.settingsModal = document.getElementById(ELEMENT_IDS.settingsModal);
        this.closeBtn = document.getElementById(ELEMENT_IDS.closeBtn);
        this.saveBtn = document.getElementById(ELEMENT_IDS.saveBtn);
    }

    /**
     * イベントリスナーの設定と初期設定の適用
     */
    init() {
        this._setupEventListeners();
        this.loadSettings();
        this.applySettings();
    }

    /**
     * イベントリスナーを設定
     * @private
     */
    _setupEventListeners() {
        // 設定モーダルの開閉
        this._addEventListener(ELEMENT_IDS.settingsBtn, 'click', () => this.open());
        this._addEventListener(this.closeBtn, 'click', () => this.close());
        this._addEventListener(this.saveBtn, 'click', () => this.saveSettings());

        // 背景画像の設定と削除
        this._addEventListener(ELEMENT_IDS.bgImageInput, 'change', (e) => this.handleImageSelect(e));
        this._addEventListener(ELEMENT_IDS.deleteBgBtn, 'click', () => this.clearBackgroundImage());

        // モーダル外側クリックで閉じる
        if (this.settingsModal) {
            this.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.settingsModal) {
                    this.close();
                }
            });
        }

        // カスタムCSS設定ボタン
        this._addEventListener(ELEMENT_IDS.openCustomCssBtn, 'click', () => {
            if (this._onOpenCustomCss) {
                this._onOpenCustomCss();
            }
        });
    }

    /**
     * 安全にイベントリスナーを追加するヘルパーメソッド
     * @private
     * @param {string|HTMLElement} elementOrId - 要素またはID
     * @param {string} event - イベント名
     * @param {Function} handler - イベントハンドラ
     */
    _addEventListener(elementOrId, event, handler) {
        const element = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;

        if (element) {
            element.addEventListener(event, handler);
        }
    }

    // ========================================
    // 設定モーダルの開閉
    // ========================================

    /**
     * 設定モーダルを開く
     */
    open() {
        if (!this.settingsModal) return;

        this.settingsModal.classList.remove('hidden');
        this.updateBgImagePreview();
        this._positionModal();
        this._populateFormFields();
    }

    /**
     * モーダルの位置を調整
     * @private
     */
    _positionModal() {
        const btn = document.getElementById(ELEMENT_IDS.settingsBtn);
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const content = this.settingsModal.querySelector('.settings-content');
        if (!content) return;

        // ボタンの下、右揃え気味に表示
        content.style.position = 'absolute';
        content.style.top = `${rect.bottom + 10}px`;

        // 画面幅からはみ出さないように調整
        const right = window.innerWidth - rect.right;
        content.style.right = `${Math.max(10, right - 10)}px`;

        // その他のスタイルをリセット
        content.style.left = 'auto';
        content.style.bottom = 'auto';
        content.style.transform = 'none';
    }

    /**
     * フォームフィールドに現在の設定値を反映
     * @private
     */
    _populateFormFields() {
        this._setFieldValue(ELEMENT_IDS.themeSelect, this.settings.theme);
        this._setFieldValue(ELEMENT_IDS.primaryColorPicker, this.settings.primaryColor);
        this._setFieldValue(ELEMENT_IDS.fontSelect, this.settings.fontFamily);
        this._setFieldValue(ELEMENT_IDS.fontSizeInput, parseInt(this.settings.fontSize));
        this._setFieldValue(ELEMENT_IDS.editorBgColor, this.settings.editorBgColor);
        this._setFieldValue(ELEMENT_IDS.editorTextColor, this.settings.editorTextColor);
        this._setFieldValue(ELEMENT_IDS.commentDisplaySelect, this.settings.commentDisplayMode);
    }

    /**
     * フォームフィールドに値を設定するヘルパーメソッド
     * @private
     * @param {string} elementId - 要素ID
     * @param {*} value - 設定する値
     */
    _setFieldValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.value = value;
        }
    }

    /**
     * 設定モーダルを閉じる
     */
    close() {
        if (this.settingsModal) {
            this.settingsModal.classList.add('hidden');
        }
    }

    // ========================================
    // 設定の保存と読み込み
    // ========================================

    /**
     * 設定を保存し、適用します
     */
    saveSettings() {
        this._collectFormData();
        this._saveToLocalStorage();
        this.applySettings();
        this._notifyCommentDisplayModeChange();
        this.close();
    }

    /**
     * フォームからデータを収集
     * @private
     */
    _collectFormData() {
        this.settings.theme = this._getFieldValue(ELEMENT_IDS.themeSelect);
        this.settings.primaryColor = this._getFieldValue(ELEMENT_IDS.primaryColorPicker);
        this.settings.fontFamily = this._getFieldValue(ELEMENT_IDS.fontSelect);
        this.settings.fontSize = this._getFieldValue(ELEMENT_IDS.fontSizeInput) + 'px';
        this.settings.editorBgColor = this._getFieldValue(ELEMENT_IDS.editorBgColor);
        this.settings.editorTextColor = this._getFieldValue(ELEMENT_IDS.editorTextColor);
        this.settings.commentDisplayMode = this._getFieldValue(ELEMENT_IDS.commentDisplaySelect);
    }

    /**
     * フォームフィールドから値を取得するヘルパーメソッド
     * @private
     * @param {string} elementId - 要素ID
     * @returns {string} フィールドの値
     */
    _getFieldValue(elementId) {
        const element = document.getElementById(elementId);
        return element ? element.value : '';
    }

    /**
     * LocalStorageに設定を保存
     * @private
     */
    _saveToLocalStorage() {
        // 背景画像以外の設定を保存（セキュリティと容量のため）
        const settingsToSave = { ...this.settings };
        delete settingsToSave.backgroundImage;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
        } catch (error) {
            console.error('設定の保存に失敗しました:', error);
        }
    }

    /**
     * コメント表示モード変更をエディタに通知
     * @private
     */
    _notifyCommentDisplayModeChange() {
        document.dispatchEvent(new CustomEvent('commentDisplayModeChange', {
            detail: { mode: this.settings.commentDisplayMode }
        }));
    }

    /**
     * LocalStorageから設定を読み込みます
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const parsed = JSON.parse(saved);

            // 背景画像はLocalStorageから読み込まない（セキュリティと容量と要件のため）
            if (parsed.backgroundImage) {
                delete parsed.backgroundImage;
            }

            this.settings = { ...this.settings, ...parsed };
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
        }
    }

    // ========================================
    // パブリックAPI - テーマ設定
    // ========================================

    /**
     * テーマを設定します
     * @param {string} theme - テーマ名（'light' | 'dark'）
     * @throws {Error} 無効なテーマが指定された場合
     */
    setTheme(theme) {
        if (!Object.values(THEMES).includes(theme)) {
            throw new Error(
                `無効なテーマ: ${theme}。'${THEMES.LIGHT}' または '${THEMES.DARK}' を指定してください。`
            );
        }
        this.settings.theme = theme;
        this.applySettings();
    }

    /**
     * 現在のテーマを取得します
     * @returns {string} 現在のテーマ（'light' | 'dark'）
     */
    getTheme() {
        return this.settings.theme;
    }

    // ========================================
    // パブリックAPI - フォント設定
    // ========================================

    /**
     * フォントファミリを設定します
     * @param {string} family - フォントファミリ
     *   'sans-serif' - ゴシック体（標準）
     *   'rounded' - 丸ゴシック体（柔らか）
     *   'serif' - 明朝体
     *   'monospace' - 等幅（コーディング）
     *   'monospace-jp' - 等幅（日本語対応）
     *   'system' - システムフォント（高速）
     * @throws {Error} 無効なフォントファミリが指定された場合
     */
    setFontFamily(family) {
        const validFamilies = Object.keys(FONT_FAMILIES);
        if (!validFamilies.includes(family)) {
            throw new Error(
                `無効なフォントファミリ: ${family}。${validFamilies.join(', ')} のいずれかを指定してください。`
            );
        }
        this.settings.fontFamily = family;
        this.applySettings();
    }

    /**
     * 利用可能なフォントファミリのリストを取得
     * @returns {Array<{value: string, label: string}>} フォントファミリのリスト
     */
    getAvailableFonts() {
        return Object.keys(FONT_FAMILIES).map(key => ({
            value: key,
            label: FONT_DISPLAY_NAMES[key] || key
        }));
    }

    /**
     * フォントサイズを設定します
     * @param {string|number} size - フォントサイズ（例: '16px' または 16）
     * @throws {Error} 無効なフォントサイズが指定された場合
     */
    setFontSize(size) {
        const sizeStr = typeof size === 'number' ? `${size}px` : size;
        const numericSize = parseInt(sizeStr, 10);

        if (isNaN(numericSize) || numericSize < FONT_SIZE_LIMITS.MIN || numericSize > FONT_SIZE_LIMITS.MAX) {
            throw new Error(
                `無効なフォントサイズ: ${size}。${FONT_SIZE_LIMITS.MIN}〜${FONT_SIZE_LIMITS.MAX}の範囲で指定してください。`
            );
        }

        this.settings.fontSize = sizeStr;
        this.applySettings();
    }

    // ========================================
    // 背景画像の管理
    // ========================================

    /**
     * 画像選択時のハンドラ
     * @param {Event} e - changeイベント
     */
    handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            this.setBackgroundImage(event.target.result);
            this.updateBgImagePreview();
        };
        reader.onerror = () => {
            console.error('画像の読み込みに失敗しました');
        };
        reader.readAsDataURL(file);

        // inputをリセットして同じファイルを再選択可能にする
        e.target.value = '';
    }

    /**
     * 背景画像のプレビューを更新
     */
    updateBgImagePreview() {
        const preview = document.getElementById(ELEMENT_IDS.bgImagePreview);
        const deleteBtn = document.getElementById(ELEMENT_IDS.deleteBgBtn);

        if (!preview || !deleteBtn) return;

        if (this.settings.backgroundImage) {
            preview.style.backgroundImage = `url(${this.settings.backgroundImage})`;
            preview.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');
        } else {
            preview.style.backgroundImage = '';
            preview.classList.add('hidden');
            deleteBtn.classList.add('hidden');
        }
    }

    /**
     * 背景画像を設定します
     * メモリ上でのみ保持し、LocalStorageには保存しません
     * @param {string} dataUrl - 背景画像のBase64データURL
     */
    setBackgroundImage(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            console.error('背景画像のデータURLが無効です。');
            return;
        }
        this.settings.backgroundImage = dataUrl;
        this.updateBgImagePreview();
    }

    /**
     * 背景画像をクリアします
     */
    clearBackgroundImage() {
        this.settings.backgroundImage = null;
        this.updateBgImagePreview();
    }

    // ========================================
    // 設定のインポート・エクスポート
    // ========================================

    /**
     * 設定を一括で取り込み、適用します
     * @param {Object} newSettings - 新しい設定オブジェクト
     */
    importSettings(newSettings) {
        if (!newSettings || typeof newSettings !== 'object') return;

        // 既存の設定にマージ
        Object.keys(this.settings).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(newSettings, key)) {
                this.settings[key] = newSettings[key];
            }
        });

        this.applySettings();
        this.updateBgImagePreview();
    }

    /**
     * 現在の設定を取得します
     * @returns {Object} 現在の設定オブジェクトのコピー
     */
    getSettings() {
        return { ...this.settings };
    }

    // ========================================
    // 設定の適用
    // ========================================

    /**
     * 現在の設定をDOMに適用します
     */
    applySettings() {
        const elements = this._getRequiredElements();

        // DOM要素が存在しない場合は早期リターン
        if (!elements.root || !elements.editor) {
            return;
        }

        this._applyBasicSettings(elements.root, elements.editor);
        this._applyThemeColors(elements.root, elements.editor);
        this._applyBackgroundImage(elements);
    }

    /**
     * 必要なDOM要素を取得
     * @private
     * @returns {Object} DOM要素のオブジェクト
     */
    _getRequiredElements() {
        return {
            root: document.documentElement,
            editor: document.getElementById(ELEMENT_IDS.editor),
            mainContent: document.getElementById(ELEMENT_IDS.mainContent),
            editorContainer: document.getElementById(ELEMENT_IDS.editorContainer)
        };
    }

    /**
     * 基本設定を適用（フォント、プライマリーカラー）
     * @private
     * @param {HTMLElement} root - ルート要素
     * @param {HTMLElement} editor - エディタ要素
     */
    _applyBasicSettings(root, editor) {
        // プライマリーカラーの設定
        root.style.setProperty('--primary-color', this.settings.primaryColor);
        root.style.setProperty('--primary-hover', this.settings.primaryColor + '0.8');

        // フォントファミリーの設定
        const fontFamily = FONT_FAMILIES[this.settings.fontFamily] || FONT_FAMILIES['sans-serif'];
        root.style.setProperty('--font-family', fontFamily);
        editor.style.fontFamily = fontFamily;

        // フォントサイズの設定
        root.style.setProperty('--editor-font-size', this.settings.fontSize);

        // エディタのテキストカラー
        editor.style.color = this.settings.editorTextColor;
    }

    /**
     * テーマカラーを適用
     * @private
     * @param {HTMLElement} root - ルート要素
     * @param {HTMLElement} editor - エディタ要素
     */
    _applyThemeColors(root, editor) {
        const isDark = this.settings.theme === THEMES.DARK;
        const themeColors = isDark ? THEME_COLORS[THEMES.DARK] : THEME_COLORS[THEMES.LIGHT];

        // 共通のテーマカラーを設定
        root.style.setProperty('--surface-color', themeColors.surface);
        root.style.setProperty('--text-color', themeColors.text);
        root.style.setProperty('--border-color', themeColors.border);

        // 背景色の決定
        let bgColor = this.settings.editorBgColor;

        if (isDark) {
            // ダークモード時、ユーザー設定がデフォルト（白）のままなら暗い背景にオーバーライド
            if (this.settings.editorBgColor === DEFAULT_SETTINGS.editorBgColor) {
                bgColor = themeColors.editorBgFallback;
                root.style.setProperty('--bg-color', themeColors.background);
            } else {
                root.style.setProperty('--bg-color', this.settings.editorBgColor);
            }

            // テキストカラーもデフォルトのままなら明るい色に変更
            if (this.settings.editorTextColor === DEFAULT_SETTINGS.editorTextColor) {
                editor.style.color = themeColors.text;
            }
        } else {
            // ライトモード
            root.style.setProperty('--bg-color', this.settings.editorBgColor);
        }

        return bgColor;
    }

    /**
     * 背景画像とエディタ背景を適用
     * @private
     * @param {Object} elements - DOM要素のオブジェクト
     */
    _applyBackgroundImage(elements) {
        const { root, editor, mainContent, editorContainer } = elements;
        const targetBgColor = this._applyThemeColors(root, editor);

        if (this.settings.backgroundImage && mainContent) {
            // 背景画像がある場合
            this._setBackgroundImageStyles(mainContent, editorContainer, editor, targetBgColor);
        } else {
            // 背景画像がない場合
            this._clearBackgroundImageStyles(mainContent, editorContainer, editor, targetBgColor);
        }
    }

    /**
     * 背景画像使用時のスタイルを設定
     * @private
     * @param {HTMLElement} mainContent - メインコンテンツ要素
     * @param {HTMLElement} editorContainer - エディタコンテナ要素
     * @param {HTMLElement} editor - エディタ要素
     * @param {string} targetBgColor - 背景色
     */
    _setBackgroundImageStyles(mainContent, editorContainer, editor, targetBgColor) {
        // 背景画像を設定
        mainContent.style.backgroundImage = `url(${this.settings.backgroundImage})`;
        mainContent.style.backgroundSize = 'cover';
        mainContent.style.backgroundPosition = 'center';
        mainContent.style.backgroundRepeat = 'no-repeat';

        // コンテナを透過
        if (editorContainer) {
            editorContainer.style.backgroundColor = 'transparent';
        }

        // エディタ本体を半透過（80%）
        const finalEditorColor = this._addOpacityToHexColor(targetBgColor);
        editor.style.backgroundColor = finalEditorColor;
    }

    /**
     * 背景画像未使用時のスタイルをクリア
     * @private
     * @param {HTMLElement} mainContent - メインコンテンツ要素
     * @param {HTMLElement} editorContainer - エディタコンテナ要素
     * @param {HTMLElement} editor - エディタ要素
     * @param {string} targetBgColor - 背景色
     */
    _clearBackgroundImageStyles(mainContent, editorContainer, editor, targetBgColor) {
        if (mainContent) {
            mainContent.style.backgroundImage = '';
            mainContent.style.backgroundSize = '';
            mainContent.style.backgroundPosition = '';
            mainContent.style.backgroundRepeat = '';
        }

        if (editorContainer) {
            editorContainer.style.backgroundColor = '';
        }

        // エディタ背景を不透明色に
        editor.style.backgroundColor = targetBgColor;
    }

    /**
     * Hex色コードに透明度を追加
     * @private
     * @param {string} hexColor - Hex色コード（#RRGGBB形式）
     * @returns {string} 透明度付きのHex色コード（#RRGGBBcc形式）
     */
    _addOpacityToHexColor(hexColor) {
        if (hexColor.startsWith('#') && hexColor.length === 7) {
            return hexColor + BG_IMAGE_OPACITY;
        }
        return hexColor;
    }
}
