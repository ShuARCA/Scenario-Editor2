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
            backgroundImage: null // メモリ保持のみ
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
        this.closeBtn.addEventListener('click', () => this.close());
        this.saveBtn.addEventListener('click', () => this.saveSettings());

        // 背景画像設定
        const bgInput = document.getElementById('bg-image-input');
        const deleteBgBtn = document.getElementById('delete-bg-image-btn');

        if (bgInput) {
            bgInput.addEventListener('change', (e) => this.handleImageSelect(e));
        }
        if (deleteBgBtn) {
            deleteBgBtn.addEventListener('click', () => this.clearBackgroundImage());
        }

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
        this.updateBgImagePreview();

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

        this.settings.editorTextColor = document.getElementById('editor-text-color').value;

        // 背景画像以外の設定を保存
        const settingsToSave = { ...this.settings };
        delete settingsToSave.backgroundImage;
        localStorage.setItem('ieditweb-settings', JSON.stringify(settingsToSave));

        this.applySettings();
        this.close();
        this.applySettings();
        this.close();
    }

    /**
     * localStorageから設定を読み込みます。
     */
    loadSettings() {
        const saved = localStorage.getItem('ieditweb-settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            // 背景画像はlocalStorageから読み込まない（セキュリティと容量と要件のため）
            if (parsed.backgroundImage) delete parsed.backgroundImage;
            this.settings = { ...this.settings, ...parsed };
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

    handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            this.setBackgroundImage(event.target.result);
            this.updateBgImagePreview();
        };
        reader.readAsDataURL(file);

        // inputをリセットして同じファイルを再選択可能にする
        e.target.value = '';
    }

    updateBgImagePreview() {
        const preview = document.getElementById('bg-image-preview');
        const deleteBtn = document.getElementById('delete-bg-image-btn');
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
     * 背景画像を設定します。
     * メモリ上でのみ保持し、localStorageには保存しません。
     * @param {string} dataUrl - 背景画像のBase64データURL
     */
    setBackgroundImage(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            console.error('背景画像のデータURLが無効です。');
            return;
        }
        this.settings.backgroundImage = dataUrl;
        // 即時プレビュー反映したい場合はここでapplySettingsを呼ぶ手もあるが、
        // 「保存して適用」で一括適用のUIフローなので、プレビューのみ更新でもよい。
        // ただし現状のUIフローでは設定変更即反映ではないが、
        // 背景画像だけはプレビューで見せる形にする。
        // ここでは内部状態の更新にとどめ、実際の画面反映はapplySettingsで行うのが整合性がいいが
        // ユーザー体験的には選択した時点で背景が変わってもいいかもしれない。
        // しかし他の設定項目（フォントなど）は「保存」まで適用されないUIなので、それに合わせる。
        this.updateBgImagePreview();
    }

    /**
     * 背景画像をクリアします。
     */
    clearBackgroundImage() {
        this.settings.backgroundImage = null;
        this.updateBgImagePreview();
    }

    /**
     * 設定を一括で取り込み、適用します。
     * @param {Object} newSettings - 新しい設定オブジェクト
     */
    importSettings(newSettings) {
        if (!newSettings || typeof newSettings !== 'object') return;

        // 既存の設定にマージ（未知のキーは無視するなどのバリデーションも可能だが、
        // ここでは単純に上書きし、applySettingsで利用するものだけが反映される前提とする）
        // ただし、this.settingsのキーのみを対象とすることで余計なデータの混入を防ぐ
        Object.keys(this.settings).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(newSettings, key)) {
                this.settings[key] = newSettings[key];
            }
        });

        this.applySettings();
        // プレビューなども更新
        this.updateBgImagePreview();
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
        const editorContainer = document.getElementById('editor-container');

        // DOM要素が存在しない場合は早期リターン
        if (!root || !editor) {
            return;
        }

        // --- 1. 基本設定 (フォント、プライマリーカラー) ---
        root.style.setProperty('--primary-color', this.settings.primaryColor);
        root.style.setProperty('--primary-hover', this.settings.primaryColor + '0.8');

        let fontFamily = 'Inter, system-ui, sans-serif';
        if (this.settings.fontFamily === 'serif') fontFamily = 'Merriweather, serif';
        else if (this.settings.fontFamily === 'monospace') fontFamily = 'Fira Code, monospace';

        root.style.setProperty('--font-family', fontFamily);
        editor.style.fontFamily = fontFamily;
        editor.style.fontSize = this.settings.fontSize;
        editor.style.color = this.settings.editorTextColor;


        // --- 2. テーマ色の決定 ---
        let targetBgColor = this.settings.editorBgColor;

        if (this.settings.theme === 'dark') {
            root.style.setProperty('--surface-color', '#303030ff');
            // ダークモード時のデフォルト背景色
            // ユーザー設定がデフォルト(白)のままならダークグレーにオーバーライド
            if (this.settings.editorBgColor === '#ffffff') {
                targetBgColor = '#303030';
                root.style.setProperty('--bg-color', '#202020ff'); // 全体背景も暗く
            } else {
                root.style.setProperty('--bg-color', this.settings.editorBgColor);
            }
            root.style.setProperty('--text-color', '#f8fafc');
            root.style.setProperty('--border-color', '#3c3c3d');

            if (this.settings.editorTextColor === '#334155') editor.style.color = '#f8fafc';

        } else {
            root.style.setProperty('--surface-color', '#ffffff');
            root.style.setProperty('--bg-color', this.settings.editorBgColor);
            root.style.setProperty('--text-color', '#334155');
            root.style.setProperty('--border-color', '#dedfde');
            targetBgColor = this.settings.editorBgColor;
        }


        // --- 3. 背景画像とエディタ背景の適用 ---
        // 背景画像がある場合はエディタなどを透過させる
        if (mainContent && this.settings.backgroundImage) {
            // 背景画像設定
            mainContent.style.backgroundImage = `url(${this.settings.backgroundImage})`;
            mainContent.style.backgroundSize = 'cover';
            mainContent.style.backgroundPosition = 'center';
            mainContent.style.backgroundRepeat = 'no-repeat';

            // コンテナの透過
            if (editorContainer) {
                editorContainer.style.backgroundColor = 'transparent';
            }

            // エディタ本体の半透過 (80% opacity)
            // Hex(#RRGGBB)形式を前提に'cc'を付与
            let finalEditorColor = targetBgColor;
            if (finalEditorColor.startsWith('#') && finalEditorColor.length === 7) {
                finalEditorColor += 'cc';
            }
            editor.style.backgroundColor = finalEditorColor;

        } else {
            // 背景画像なし
            if (mainContent) {
                mainContent.style.backgroundImage = '';
                mainContent.style.backgroundSize = '';
                mainContent.style.backgroundPosition = '';
                mainContent.style.backgroundRepeat = '';
            }

            // コンテナ背景のリセット (CSS継承 or 空文字)
            if (editorContainer) {
                editorContainer.style.backgroundColor = '';
            }

            // エディタ背景を不透明色に
            editor.style.backgroundColor = targetBgColor;
        }
    }
}
