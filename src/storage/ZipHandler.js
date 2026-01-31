/**
 * ZIPファイル操作ハンドラ
 * JSZipのラッパーとして、ZIPファイルの生成・読み込みを行います。
 */
export class ZipHandler {
    constructor() {
        this.zip = new JSZip();
    }

    /**
     * 新しいZIPインスタンスを初期化します。
     */
    initNew() {
        this.zip = new JSZip();
    }

    /**
     * ZIPファイルを読み込みます。
     * @param {File} file - 読み込むファイル
     */
    async loadAsync(file) {
        this.zip = await JSZip.loadAsync(file);
    }

    /**
     * フォルダを取得または作成します。
     * @param {string} name - フォルダ名
     * @returns {Object} JSZipのフォルダオブジェクト
     */
    getFolder(name) {
        return this.zip.folder(name);
    }

    /**
     * ファイルを追加します。
     * @param {string} path - ファイルパス
     * @param {string|Blob} content - コンテンツ
     * @param {Object} options - オプション
     */
    addFile(path, content, options = {}) {
        this.zip.file(path, content, options);
    }

    /**
     * ファイルを取得します。
     * @param {string} path - ファイルパス
     * @returns {Object|null} JSZipのファイルオブジェクト
     */
    getFile(path) {
        return this.zip.file(path);
    }

    /**
     * ファイルの内容を文字列として非同期に取得します。
     * @param {string} path - ファイルパス
     * @returns {Promise<string|null>} ファイルの内容
     */
    async getFileContentAsString(path) {
        const file = this.zip.file(path);
        if (!file) return null;
        return await file.async('string');
    }

    /**
     * ZIPファイルをBlobとして生成します。
     * @returns {Promise<Blob>} ZIPファイルのBlob
     */
    async generateBlob() {
        return await this.zip.generateAsync({ type: 'blob' });
    }
}
