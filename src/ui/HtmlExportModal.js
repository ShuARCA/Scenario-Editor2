/**
 * HTML エクスポート モーダルの管理を行います。
 * フローチャートを含めるかどうかの設定を選択してエクスポートを実行します。
 * 
 * @module ui/HtmlExportModal
 */

export class HtmlExportModal {
    /**
     * @param {import('../storage/ViewerExporter.js').ViewerExporter|Function} viewerExporterOrGetter
     */
    constructor(viewerExporterOrGetter) {
        /** @type {import('../storage/ViewerExporter.js').ViewerExporter|Function} */
        this._viewerExporter = viewerExporterOrGetter;

        /** @type {string} ドキュメントタイトル */
        this.documentTitle = '無題のドキュメント';

        /** @type {string} ベースファイル名 */
        this.baseFilename = 'document';

        // DOM Elements
        this.modal = document.getElementById('html-export-modal');
        this.closeBtn = document.getElementById('close-html-export-btn');
        this.cancelBtn = document.getElementById('cancel-html-export-btn');
        this.execBtn = document.getElementById('exec-html-export-btn');
        this.flowchartSelect = document.getElementById('html-export-flowchart');

        this._initBinding();
    }

    /**
     * ViewerExporterインスタンスを取得します。
     * @returns {import('../storage/ViewerExporter.js').ViewerExporter|null}
     */
    get viewerExporter() {
        if (typeof this._viewerExporter === 'function') {
            return this._viewerExporter();
        }
        return this._viewerExporter;
    }

    /**
     * イベントバインディングを初期化します。
     * @private
     */
    _initBinding() {
        if (!this.modal) return;

        // 閉じるボタン
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hide());
        }

        // キャンセルボタン
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.hide());
        }

        // モーダル背景クリックで閉じる
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        // エスケープキーで閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.hide();
            }
        });

        // エクスポート実行
        if (this.execBtn) {
            this.execBtn.addEventListener('click', () => this._executeExport());
        }
    }

    /**
     * モーダルを表示します。
     * @param {string} title - ドキュメントタイトル
     * @param {string} filename - 保存ベースファイル名
     */
    show(title, filename) {
        this.documentTitle = title || '無題のドキュメント';
        this.baseFilename = filename || 'document';

        if (!this.modal) {
            // モーダルDOMが存在しない場合はフォールバックとして直接エクスポート
            this.viewerExporter?.export(this.documentTitle, this.baseFilename, { includeFlowchart: true });
            return;
        }

        this.modal.classList.remove('hidden');
    }

    /**
     * モーダルを非表示にします。
     */
    hide() {
        if (!this.modal) return;
        this.modal.classList.add('hidden');
    }

    /**
     * エクスポートを実行します。
     * @private
     */
    async _executeExport() {
        const includeFlowchart = this.flowchartSelect ? this.flowchartSelect.value === 'include' : true;

        this.hide();

        if (this.viewerExporter) {
            await this.viewerExporter.export(this.documentTitle, this.baseFilename, {
                includeFlowchart
            });
        }
    }
}
