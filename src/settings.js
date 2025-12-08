/**
 * 環境設定ロジック
 * テーマ、フォント、エディタの色設定、背景画像などを管理します。
 */
export class SettingsManager {
    /**
     * SettingsManagerのコンストラクタ
     * @param {Object} options - オプション設定
     * @param {boolean} options.skipDomInit - DOM初期化をスキップするか（テスト用）
     */
    constructor(options = {}) {
        // 設定値のデフォルト
        this.settings = {
            theme: 'light',
            primaryColor: '#0d9488',
            fontFamily: 'sans-serif',
            fontSize: '16px',
            editorBgColor: '#ffffff',
            editorTextColor: '#334155',
            backgroundImage: null
        };

        // DOM初期化をスキップするオプション（テスト用）
        if (!options.skipDomInit) {
            this.settingsModal = document.getElementById('settings-modal');
            this.closeBtn = document.getElementById('close-settings-btn');
            this.saveBtn = document.getElementById('save-settings-btn');
            this.init();
        }
    }

    init() {
        // 設定ボタンイベント
        document.getElementById('settingsBtn').addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());
        this.saveBtn.addEventListener('click', () => this.saveSettings());

        // 外側クリックで閉じる
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.close();
        });

        // 初期設定の適用
        this.loadSettings();
        this.applySettings();
    }

    open() {
        this.settingsModal.classList.remove('hidden');

        // ポップアップ位置の計算
        const btn = document.getElementById('settingsBtn');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const content = this.settingsModal.querySelector('.settings-content');

        // ボタンの下、右揃え気味に表示
        content.style.position = 'absolute';
        content.style.top = `${rect.bottom + 10}px`;
        // 画面幅からはみ出さないように調整
        const right = window.innerWidth - rect.right;
        content.style.right = `${Math.max(10, right - 10)}px`;
        content.style.left = 'auto'; // リセット
        content.style.bottom = 'auto'; // リセット
        content.style.transform = 'none'; // 中央揃えなどの解除

        // 現在の設定をフォームに反映
        document.getElementById('theme-select').value = this.settings.theme;
        document.getElementById('primary-color-picker').value = this.settings.primaryColor;
        document.getElementById('font-select').value = this.settings.fontFamily;
        document.getElementById('font-size-input').value = parseInt(this.settings.fontSize);
        document.getElementById('editor-bg-color').value = this.settings.editorBgColor;
        document.getElementById('editor-text-color').value = this.settings.editorTextColor;
    }

    close() {
        this.settingsModal.classList.add('hidden');
    }

    /**
     * 設定を保存し、適用します。
     */
    saveSettings() {
        this.settings.theme = document.getElementById('theme-select').value;
        this.settings.primaryColor = document.getElementById('primary-color-picker').value;
        this.settings.fontFamily = document.getElementById('font-select').value;
        this.settings.fontSize = document.getElementById('font-size-input').value + 'px';
        this.settings.editorBgColor = document.getElementById('editor-bg-color').value;
        this.settings.editorTextColor = document.getElementById('editor-text-color').value;

        localStorage.setItem('ieditweb-settings', JSON.stringify(this.settings));
        this.applySettings();
        this.close();
    }

    /**
     * localStorageから設定を読み込みます。
     */
    loadSettings() {
        const saved = localStorage.getItem('ieditweb-settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    }

    /**
     * テーマを設定します。
     * @param {string} theme - テーマ名（'light' | 'dark'）
     */
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            throw new Error(`無効なテーマ: ${theme}。'light' または 'dark' を指定してください。`);
        }
        this.settings.theme = theme;
        this.applySettings();
    }

    /**
     * 現在のテーマを取得します。
     * @returns {string} 現在のテーマ（'light' | 'dark'）
     */
    getTheme() {
        return this.settings.theme;
    }

    /**
     * フォントファミリを設定します。
     * @param {string} family - フォントファミリ（'sans-serif' | 'serif' | 'monospace'）
     */
    setFontFamily(family) {
        const validFamilies = ['sans-serif', 'serif', 'monospace'];
        if (!validFamilies.includes(family)) {
            throw new Error(`無効なフォントファミリ: ${family}。${validFamilies.join(', ')} のいずれかを指定してください。`);
        }
        this.settings.fontFamily = family;
        this.applySettings();
    }

    /**
     * フォントサイズを設定します。
     * @param {string|number} size - フォントサイズ（例: '16px' または 16）
     */
    setFontSize(size) {
        // 数値の場合は 'px' を付加
        const sizeStr = typeof size === 'number' ? `${size}px` : size;
        // 数値部分を抽出して検証
        const numericSize = parseInt(sizeStr, 10);
        if (isNaN(numericSize) || numericSize < 10 || numericSize > 32) {
            throw new Error(`無効なフォントサイズ: ${size}。10〜32の範囲で指定してください。`);
        }
        this.settings.fontSize = sizeStr;
        this.applySettings();
    }

    /**
     * 背景画像を設定します。
     * @param {string} dataUrl - 背景画像のBase64データURL
     */
    setBackgroundImage(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            throw new Error('背景画像のデータURLが無効です。');
        }
        this.settings.backgroundImage = dataUrl;
        this.applySettings();
    }

    /**
     * 背景画像をクリアします。
     */
    clearBackgroundImage() {
        this.settings.backgroundImage = null;
        this.applySettings();
    }

    /**
     * 現在の設定を取得します。
     * @returns {Object} 現在の設定オブジェクト
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * 現在の設定をDOMに適用します。
     */
    applySettings() {
        const root = document.documentElement;
        const editor = document.getElementById('editor');
        const mainContent = document.getElementById('main-content');

        // DOM要素が存在しない場合は早期リターン（テスト環境対応）
        if (!root || !editor) {
            return;
        }

        // プライマリーカラー
        root.style.setProperty('--primary-color', this.settings.primaryColor);
        root.style.setProperty('--primary-hover', this.settings.primaryColor + '0.8');

        // フォント
        let fontFamily = 'Inter, system-ui, sans-serif';
        if (this.settings.fontFamily === 'serif') fontFamily = 'Merriweather, serif';
        else if (this.settings.fontFamily === 'monospace') fontFamily = 'Fira Code, monospace';

        root.style.setProperty('--font-family', fontFamily);
        editor.style.fontFamily = fontFamily;
        editor.style.fontSize = this.settings.fontSize;

        // エディタ色
        editor.style.backgroundColor = this.settings.editorBgColor;
        root.style.setProperty('--bg-color', this.settings.editorBgColor);
        editor.style.color = this.settings.editorTextColor;

        // テーマ (簡易実装: ダークモード切り替えなどはCSS変数で行うのが理想だが、要件は「背景色・文字色の変更」が主)
        if (this.settings.theme === 'dark') {
            root.style.setProperty('--surface-color', '#303030ff');
            root.style.setProperty('--background-color', '#202020ff');
            root.style.setProperty('--text-color', '#f8fafc');
            root.style.setProperty('--border-color', '#334155');
            // エディタ色がカスタム設定されていない場合のみ上書き
            if (this.settings.editorBgColor === '#ffffff') editor.style.backgroundColor = '#303030ff';
            if (this.settings.editorTextColor === '#334155') editor.style.color = '#f8fafc';
        } else {
            root.style.setProperty('--surface-color', '#ffffff');
            root.style.setProperty('--background-color', '#fbfbff');
            root.style.setProperty('--text-color', '#334155');
            root.style.setProperty('--border-color', '#e2e8f0');
        }

        // 背景画像の適用
        if (mainContent) {
            if (this.settings.backgroundImage) {
                mainContent.style.backgroundImage = `url(${this.settings.backgroundImage})`;
                mainContent.style.backgroundSize = 'cover';
                mainContent.style.backgroundPosition = 'center';
                mainContent.style.backgroundRepeat = 'no-repeat';
            } else {
                mainContent.style.backgroundImage = '';
                mainContent.style.backgroundSize = '';
                mainContent.style.backgroundPosition = '';
                mainContent.style.backgroundRepeat = '';
            }
        }
    }
}
