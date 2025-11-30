/**
 * 環境設定ロジック
 */
export class SettingsManager {
    constructor() {
        this.settingsModal = document.getElementById('settings-modal');
        this.closeBtn = document.getElementById('close-settings-btn');
        this.saveBtn = document.getElementById('save-settings-btn');

        // 設定値のデフォルト
        this.settings = {
            theme: 'light',
            fontFamily: 'sans-serif',
            fontSize: '16px',
            editorBgColor: '#ffffff',
            editorTextColor: '#334155'
        };

        this.init();
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
        // 現在の設定をフォームに反映
        document.getElementById('theme-select').value = this.settings.theme;
        document.getElementById('font-select').value = this.settings.fontFamily;
        document.getElementById('font-size-input').value = parseInt(this.settings.fontSize);
        document.getElementById('editor-bg-color').value = this.settings.editorBgColor;
        document.getElementById('editor-text-color').value = this.settings.editorTextColor;
    }

    close() {
        this.settingsModal.classList.add('hidden');
    }

    saveSettings() {
        this.settings.theme = document.getElementById('theme-select').value;
        this.settings.fontFamily = document.getElementById('font-select').value;
        this.settings.fontSize = document.getElementById('font-size-input').value + 'px';
        this.settings.editorBgColor = document.getElementById('editor-bg-color').value;
        this.settings.editorTextColor = document.getElementById('editor-text-color').value;

        localStorage.setItem('ieditweb-settings', JSON.stringify(this.settings));
        this.applySettings();
        this.close();
    }

    loadSettings() {
        const saved = localStorage.getItem('ieditweb-settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    }

    applySettings() {
        const root = document.documentElement;
        const editor = document.getElementById('editor');

        // フォント
        let fontFamily = 'Inter, system-ui, sans-serif';
        if (this.settings.fontFamily === 'serif') fontFamily = 'Merriweather, serif';
        else if (this.settings.fontFamily === 'monospace') fontFamily = 'Fira Code, monospace';

        root.style.setProperty('--font-family', fontFamily);
        editor.style.fontFamily = fontFamily;
        editor.style.fontSize = this.settings.fontSize;

        // エディタ色
        editor.style.backgroundColor = this.settings.editorBgColor;
        editor.style.color = this.settings.editorTextColor;

        // テーマ (簡易実装: ダークモード切り替えなどはCSS変数で行うのが理想だが、要件は「背景色・文字色の変更」が主)
        if (this.settings.theme === 'dark') {
            root.style.setProperty('--surface-color', '#1e293b');
            root.style.setProperty('--background-color', '#0f172a');
            root.style.setProperty('--text-color', '#f8fafc');
            root.style.setProperty('--border-color', '#334155');
            // エディタ色がカスタム設定されていない場合のみ上書き
            if (this.settings.editorBgColor === '#ffffff') editor.style.backgroundColor = '#1e293b';
            if (this.settings.editorTextColor === '#334155') editor.style.color = '#f8fafc';
        } else {
            root.style.setProperty('--surface-color', '#ffffff');
            root.style.setProperty('--background-color', '#fbfbff');
            root.style.setProperty('--text-color', '#334155');
            root.style.setProperty('--border-color', '#e2e8f0');
        }
    }
}
