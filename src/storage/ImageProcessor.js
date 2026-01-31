/**
 * 画像処理ユーティリティ
 * 画像データの抽出、MIMEタイプ判定、Base64処理などを担当します。
 */
export class ImageProcessor {
    constructor() { }

    /**
     * Data URLから画像データを抽出します。
     * @param {string} dataUrl - Data URL
     * @param {number} index - 画像のインデックス
     * @returns {Object} { filename, data }
     */
    extractImageData(dataUrl, index) {
        const extension = dataUrl.split(';')[0].split('/')[1] || 'png';
        const filename = `image_${Date.now()}_${index}.${extension}`;
        const data = dataUrl.split(',')[1];
        return { filename, data };
    }

    /**
     * ファイル拡張子からMIMEタイプを取得します。
     * @param {string} filename - ファイル名
     * @returns {string} MIMEタイプ
     */
    getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'png': 'image/png'
        };
        return mimeTypes[ext] || 'image/png';
    }

    /**
     * エディタのHTMLコンテンツ内の画像をZIP用に処理します。
     * @param {string} html - エディタのHTML
     * @param {Object} zipHandler - ZipHandlerインスタンス
     * @returns {string} 処理済みのHTML
     */
    processEditorImagesForSave(html, zipHandler) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const images = tempDiv.querySelectorAll('img');
        const imgFolder = zipHandler.getFolder('assets');

        images.forEach((img, index) => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('data:')) {
                const { filename, data } = this.extractImageData(src, index);
                imgFolder.file(filename, data, { base64: true });
                img.setAttribute('src', `assets/${filename}`);
            }
        });

        return tempDiv.innerHTML;
    }

    /**
     * HTML内の画像パスをBase64に復元します。
     * @param {string} html - HTMLコンテンツ
     * @param {Object} zipHandler - ZipHandlerインスタンス
     * @returns {Promise<string>} 復元されたHTML
     */
    async restoreImages(html, zipHandler) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const images = tempDiv.querySelectorAll('img');

        for (const img of images) {
            const src = img.getAttribute('src');
            if (src && src.startsWith('assets/')) {
                const imgFile = zipHandler.getFile(src);
                if (imgFile) {
                    const base64 = await imgFile.async('base64');
                    const mimeType = this.getMimeType(src);
                    img.src = `data:${mimeType};base64,${base64}`;
                }
            }
        }

        return tempDiv.innerHTML;
    }
}
