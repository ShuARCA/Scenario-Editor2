/**
 * PDF エクスポート モーダルの管理と、背景トリミングUIの制御を行います。
 */
import { PdfExporter } from '../storage/PdfExporter.js';

export class PdfExportModal {
    /**
     * @param {import('../core/EditorCore.js').EditorCore} editorCore
     * @param {import('../ui/SettingsManager.js').SettingsManager} settingsManager
     * @param {import('../managers/CommentManager.js').CommentManager} commentManager
     * @param {import('../managers/OutlineManager.js').OutlineManager} outlineManager
     */
    constructor(editorCore, settingsManager, commentManager, outlineManager) {
        this.editorCore = editorCore;
        this.settingsManager = settingsManager;
        this.commentManager = commentManager;
        this.outlineManager = outlineManager;

        // Exporter
        this.pdfExporter = new PdfExporter(editorCore, settingsManager, commentManager, outlineManager);

        // Elements
        this.modal = document.getElementById('pdf-export-modal');
        this.closeBtn = document.getElementById('close-pdf-export-btn');
        this.execBtn = document.getElementById('exec-pdf-export-btn');

        // Form Inputs
        this.pageSizeSelect = document.getElementById('pdf-page-size');
        this.colorModeSelect = document.getElementById('pdf-color-mode');
        this.commentDisplaySelect = document.getElementById('pdf-comment-display');
        this.pageNumberSelect = document.getElementById('pdf-page-number');
        this.pageBreakSelect = document.getElementById('pdf-page-break');

        // Background Crop Elements
        this.bgCropContainer = document.getElementById('pdf-bg-crop-container');
        this.cropArea = document.getElementById('pdf-crop-area');
        this.cropImage = document.getElementById('pdf-crop-image');
        this.resetCropBtn = document.getElementById('pdf-reset-crop-btn');

        // Crop State
        this.cropState = {
            scale: 1,
            x: 0,
            y: 0,
            isDragging: false,
            startX: 0,
            startY: 0,
            imageWidth: 0,
            imageHeight: 0,
            bgUrl: null
        };

        // Aspect Ratios for UI
        this.aspectRatios = {
            'a4': 297 / 210, // ~1.414
            'b5': 257 / 182, // ~1.412
            'letter': 11 / 8.5 // ~1.294
        };

        this._initBinding();
    }

    _initBinding() {
        if (!this.modal) return;

        // ドロップダウンやモーダル外クリックから呼ばれるようにしておく
        this.closeBtn.addEventListener('click', () => this.hide());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        this.execBtn.addEventListener('click', () => this._executeExport());

        // 用紙サイズ変更時にトリミング枠のアスペクト比を更新
        this.pageSizeSelect.addEventListener('change', () => {
            this._updateCropAreaRatio();
        });

        // 背景トリミングUIのイベント（ドラッグ、ズーム）
        this._initCropEvents();
    }

    /**
     * モーダルを表示します
     * @param {string} title 
     */
    show(title) {
        this.documentTitle = title || '無題のドキュメント';
        this.modal.classList.remove('hidden');

        // 既存設定や背景の状態を反映
        this._setupBackgroundPreview();
        this._updateCropAreaRatio();
    }

    hide() {
        this.modal.classList.add('hidden');
    }

    // ==========================================
    // Background Cropping Logic
    // ==========================================

    _setupBackgroundPreview() {
        // SettingsManagerから現在の背景設定を取得
        const settings = this.settingsManager.getSettings();
        const editorBgColor = settings.editorBgColor || '#ffffff';
        const bgImage = settings.backgroundImage;

        if (bgImage) {
            this.bgCropContainer.classList.remove('hidden');
            this.cropState.bgUrl = bgImage;

            // DOMに画像をセット
            this.cropImage.style.backgroundImage = `url("${bgImage}")`;

            // 初回表示用にスケールリセット（元画像のサイズを取得）
            const img = new Image();
            img.onload = () => {
                this.cropState.imageWidth = img.width;
                this.cropState.imageHeight = img.height;

                // 画像要素のベースサイズをアスペクト比固定の枠全体にするか、実寸にするか
                // ここでは実寸相当の比率を維持しつつ、scale=1でcoverのように振る舞うため100%に。
                this.cropImage.style.width = '100%';
                this.cropImage.style.height = '100%';

                this._resetCrop();
            };
            img.src = bgImage;
        } else {
            this.bgCropContainer.classList.add('hidden');
            this.cropState.bgUrl = null;
            // 画像がない場合は背景色を枠に適用してイメージを伝える
            this.cropArea.style.backgroundColor = editorBgColor;
            this.cropImage.style.backgroundImage = 'none';
        }
    }

    _updateCropAreaRatio() {
        const size = this.pageSizeSelect.value;
        const ratio = this.aspectRatios[size] || 1.414;

        // コンテナのwidth(240pxなどに固定)に対する高さを算出
        const areaWidth = 240;
        const areaHeight = areaWidth * ratio;

        this.cropArea.style.width = areaWidth + 'px';
        this.cropArea.style.height = areaHeight + 'px';

        // 枠が変わったので中央などの計算をリセットする
        if (this.cropState.bgUrl) {
            this._resetCrop();
        }
    }

    _initCropEvents() {
        this.resetCropBtn.addEventListener('click', () => this._resetCrop());

        // ドラッグ移動 (パン)
        this.cropArea.addEventListener('mousedown', (e) => {
            this.cropState.isDragging = true;
            this.cropState.startX = e.clientX - this.cropState.x;
            this.cropState.startY = e.clientY - this.cropState.y;
            e.preventDefault(); // 選択防止
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.cropState.isDragging) return;
            this.cropState.x = e.clientX - this.cropState.startX;
            this.cropState.y = e.clientY - this.cropState.startY;
            this._applyCropTransform();
        });

        window.addEventListener('mouseup', () => {
            this.cropState.isDragging = false;
        });

        // ズーム (ホイール)
        this.cropArea.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSensitivity = 0.05;
            if (e.deltaY < 0) {
                // 上スクロール: 拡大
                this.cropState.scale += zoomSensitivity;
            } else {
                // 下スクロール: 縮小
                this.cropState.scale = Math.max(0.1, this.cropState.scale - zoomSensitivity);
            }
            this._applyCropTransform();
        });
    }

    _resetCrop() {
        this.cropState.scale = 1.0;
        this.cropState.x = 0;
        this.cropState.y = 0;
        this._applyCropTransform();
    }

    _applyCropTransform() {
        // transform: translate(-50%, -50%) しているため、そこからのオフセット
        // 中央ベース (-50%, -50%) に対してさらに translate(x, y) して scale
        this.cropImage.style.transform = `translate(calc(-50% + ${this.cropState.x}px), calc(-50% + ${this.cropState.y}px)) scale(${this.cropState.scale})`;
    }

    // ==========================================
    // Export Execution
    // ==========================================

    async _executeExport() {
        const config = {
            title: this.documentTitle,
            pageSize: this.pageSizeSelect.value,
            colorMode: this.colorModeSelect.value,
            commentDisplay: this.commentDisplaySelect.value,
            pageNumber: this.pageNumberSelect.value,
            pageBreak: this.pageBreakSelect.value,
            // 背景情報
            bgOptions: {
                url: this.cropState.bgUrl,
                scale: this.cropState.scale,
                xOffset: this.cropState.x,
                yOffset: this.cropState.y,
                // UI上の表示領域サイズ（240x340等）に対する比率を渡すため
                uiAreaWidth: parseInt(this.cropArea.style.width, 10),
                uiAreaHeight: parseInt(this.cropArea.style.height, 10),
                editorBgColor: this.settingsManager.getSettings().editorBgColor || '#ffffff'
            }
        };

        const execBtnOriginalText = this.execBtn.textContent;
        this.execBtn.textContent = '生成中...';
        this.execBtn.disabled = true;

        try {
            await this.pdfExporter.export(config);
            this.hide();
        } catch (error) {
            console.error('PDFエクスポートに失敗しました', error);
            alert('エクスポート中にエラーが発生しました。\n' + error.message);
        } finally {
            this.execBtn.textContent = execBtnOriginalText;
            this.execBtn.disabled = false;
        }
    }
}
