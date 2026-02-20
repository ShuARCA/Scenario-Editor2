/**
 * PDFインポーター
 * PDFファイルを解析し、Tiptap互換のHTMLに変換します。
 *
 * 責務:
 * - pdf.js を使用したPDFドキュメントの読み込み
 * - テキスト抽出（位置・スタイル情報付き）
 * - 画像の抽出とBase64変換
 * - 見出し検出（PDF構造情報 + フォントサイズベース推定）
 * - 段組みレイアウトの検出と上下連結
 * - 解析結果からTiptap互換HTMLの構築
 */

// pdf.js は import map 経由で読み込み
import * as pdfjsLib from 'pdfjs';

export class PdfImporter {
    // ========================================
    // 定数
    // ========================================

    /** 段組み検出の最小ギャップ幅（ページ幅に対する割合） */
    static COLUMN_GAP_RATIO = 0.05;

    /** 行間とみなすY座標の差（フォントサイズの倍率） */
    static LINE_HEIGHT_FACTOR = 1.5;

    /** 同一行と判定するY座標の許容誤差 */
    static Y_TOLERANCE = 2;

    /** スペースと判定するX座標のギャップ（フォントサイズの倍率） */
    static SPACE_GAP_FACTOR = 0.3;

    /** 見出し検出: 本文フォントサイズに対する最小拡大率 */
    static HEADING_MIN_SIZE_RATIO = 1.15;

    /** 見出し検出のフォントサイズ閾値（H1〜H4の段階） */
    static HEADING_LEVELS = [
        { level: 1, ratio: 1.8 },
        { level: 2, ratio: 1.5 },
        { level: 3, ratio: 1.3 },
        { level: 4, ratio: 1.15 },
    ];

    // ========================================
    // 初期化
    // ========================================

    constructor() {
        this._initWorker();
    }

    /**
     * pdf.js の Worker を初期化します。
     * @private
     */
    _initWorker() {
        // Worker のパスを設定（assets/lib にダウンロード済み）
        pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/lib/pdf.worker.min.mjs';
    }

    // ========================================
    // パブリックAPI
    // ========================================

    /**
     * PDFファイルをインポートし、Tiptap互換のHTMLを返します。
     * @param {File} file - PDFファイル
     * @returns {Promise<string>} Tiptap互換のHTMLコンテンツ
     */
    async importFromFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await this._loadPdfDocument(arrayBuffer);

        // しおり（アウトライン）を取得
        const outline = await this._getOutline(pdfDoc);

        // 各ページを処理
        const pagesData = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const pageData = await this._processPage(page, i, pdfDoc);
            pagesData.push(pageData);
        }

        // 本文のフォントサイズを算出（見出し検出に使用）
        const bodyFontSize = this._detectBodyFontSize(pagesData);

        // しおりのジャンプ先を解決して見出しターゲットを構築
        const outlineTargets = await this._buildOutlineTargets(outline, pdfDoc, pagesData);

        // HTMLを構築
        return this._buildHtml(pagesData, bodyFontSize, outlineTargets);
    }

    // ========================================
    // PDF読み込み
    // ========================================

    /**
     * ArrayBuffer から pdf.js ドキュメントを読み込みます。
     * @private
     * @param {ArrayBuffer} arrayBuffer
     * @returns {Promise<PDFDocumentProxy>}
     */
    async _loadPdfDocument(arrayBuffer) {
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            useSystemFonts: true,
        });
        return loadingTask.promise;
    }

    /**
     * PDFのしおり（アウトライン）情報を取得します。
     * @private
     * @param {PDFDocumentProxy} pdfDoc
     * @returns {Promise<Array|null>}
     */
    async _getOutline(pdfDoc) {
        try {
            return await pdfDoc.getOutline();
        } catch {
            return null;
        }
    }

    // ========================================
    // ページ処理
    // ========================================

    /**
     * 1ページを処理し、テキスト・画像データを抽出します。
     * @private
     * @param {PDFPageProxy} page
     * @param {number} pageIndex - ページ番号（1始まり）
     * @param {PDFDocumentProxy} pdfDoc
     * @returns {Promise<Object>} ページデータ
     */
    async _processPage(page, pageIndex, pdfDoc) {
        const viewport = page.getViewport({ scale: 1 });

        // テキスト抽出
        const textItems = await this._extractTextContent(page, viewport);

        // 画像抽出
        const images = await this._extractImages(page, viewport);

        return {
            pageIndex,
            width: viewport.width,
            height: viewport.height,
            textItems,
            images,
        };
    }

    // ========================================
    // テキスト抽出
    // ========================================

    /**
     * ページからテキストコンテンツを抽出します。
     * @private
     * @param {PDFPageProxy} page
     * @param {PDFPageViewport} viewport
     * @returns {Promise<Array>} テキストアイテムの配列
     */
    async _extractTextContent(page, viewport) {
        const textContent = await page.getTextContent({
            includeMarkedContent: false,
        });

        const styles = textContent.styles || {};
        const items = [];

        for (const item of textContent.items) {
            if (!item.str && !item.hasEOL) continue;

            // 変換行列から位置とサイズを算出
            const tx = item.transform;
            const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
            const x = tx[4];
            // PDFの座標系はY軸が上向きなので、viewport.heightから引く
            const y = viewport.height - tx[5];

            // フォント情報からスタイルを解析
            const fontStyle = this._analyzeFontStyle(item.fontName, styles[item.fontName]);

            items.push({
                text: item.str || '',
                x,
                y,
                width: item.width,
                height: item.height || fontSize,
                fontSize,
                fontName: item.fontName,
                fontStyle,
                hasEOL: item.hasEOL || false,
                color: this._extractTextColor(styles[item.fontName]),
            });
        }

        return items;
    }

    /**
     * フォント名とスタイル情報からテキストスタイルを解析します。
     * @private
     * @param {string} fontName
     * @param {Object} styleInfo
     * @returns {Object} { isBold, isItalic }
     */
    _analyzeFontStyle(fontName, styleInfo) {
        const name = (fontName || '').toLowerCase();
        const isBold = name.includes('bold') || name.includes('heavy') || name.includes('black');
        const isItalic = name.includes('italic') || name.includes('oblique') ||
            (styleInfo && styleInfo.italic === true);
        return { isBold, isItalic };
    }

    /**
     * スタイル情報からテキスト色を抽出します。
     * @private
     * @param {Object} styleInfo
     * @returns {string|null} CSSカラー文字列 or null
     */
    _extractTextColor(styleInfo) {
        // pdf.js のスタイル情報には色が含まれないことが多いため、nullを返す
        // 将来的にOperatorListから色情報を抽出する拡張ポイント
        return null;
    }

    // ========================================
    // 画像抽出
    // ========================================

    /**
     * ページから画像を抽出します。
     * @private
     * @param {PDFPageProxy} page
     * @param {PDFPageViewport} viewport
     * @returns {Promise<Array>} 画像データの配列
     */
    async _extractImages(page, viewport) {
        const images = [];

        try {
            const operatorList = await page.getOperatorList();
            const OPS = pdfjsLib.OPS;

            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const fn = operatorList.fnArray[i];

                if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
                    const imgName = operatorList.argsArray[i][0];

                    try {
                        const imgData = await this._getImageAsDataUrl(page, imgName);
                        if (imgData) {
                            images.push({
                                dataUrl: imgData,
                                name: imgName,
                            });
                        }
                    } catch (imgError) {
                        console.warn(`画像の抽出に失敗しました (${imgName}):`, imgError);
                    }
                }
            }
        } catch (error) {
            console.warn('画像の抽出処理でエラーが発生しました:', error);
        }

        return images;
    }

    /**
     * 画像XObjectをData URLに変換します。
     * @private
     * @param {PDFPageProxy} page
     * @param {string} imageName
     * @returns {Promise<string|null>}
     */
    async _getImageAsDataUrl(page, imageName) {
        try {
            // commonObjs または objs から画像データを取得
            let imgData = null;
            try {
                imgData = await page.objs.get(imageName);
            } catch {
                // nop
            }

            if (!imgData) return null;

            // Canvas に描画してData URLを取得
            const canvas = document.createElement('canvas');
            canvas.width = imgData.width;
            canvas.height = imgData.height;
            const ctx = canvas.getContext('2d');

            // ImageData を作成
            if (imgData.data) {
                let imageData;
                if (imgData.data instanceof Uint8ClampedArray && imgData.data.length === imgData.width * imgData.height * 4) {
                    // RGBA データ
                    imageData = new ImageData(imgData.data, imgData.width, imgData.height);
                } else if (imgData.data instanceof Uint8ClampedArray) {
                    // RGB データ → RGBA に変換
                    const rgba = new Uint8ClampedArray(imgData.width * imgData.height * 4);
                    const src = imgData.data;
                    for (let j = 0, k = 0; j < src.length; j += 3, k += 4) {
                        rgba[k] = src[j];
                        rgba[k + 1] = src[j + 1];
                        rgba[k + 2] = src[j + 2];
                        rgba[k + 3] = 255;
                    }
                    imageData = new ImageData(rgba, imgData.width, imgData.height);
                } else {
                    return null;
                }
                ctx.putImageData(imageData, 0, 0);
            } else if (imgData instanceof ImageBitmap) {
                ctx.drawImage(imgData, 0, 0);
            } else {
                return null;
            }

            return canvas.toDataURL('image/png');
        } catch {
            return null;
        }
    }

    // ========================================
    // 段組み検出
    // ========================================

    /**
     * テキストアイテムから段組みレイアウトを検出します。
     * X座標の開始位置をクラスタリングし、2つ以上のクラスタがあれば段組みと判定します。
     * @private
     * @param {Array} textItems - テキストアイテムの配列
     * @param {number} pageWidth - ページ幅
     * @returns {Array<Array>} カラムごとに分割されたテキストアイテムの配列
     */
    _detectColumns(textItems, pageWidth) {
        if (textItems.length === 0) return [[]];

        // 有効なテキストアイテムのみ取得
        const validItems = textItems.filter(item => item.text.trim().length > 0);
        if (validItems.length < 6) return [textItems];

        // 各行（同一Y座標）の左端X座標を収集
        const lines = this._groupIntoLines(validItems);
        const lineStartXs = lines.map(line => Math.min(...line.map(item => item.x)));

        if (lineStartXs.length < 4) return [textItems];

        // X座標の開始位置をソートし、クラスタを検出
        const sortedXs = [...lineStartXs].sort((a, b) => a - b);
        const clusters = this._clusterValues(sortedXs, pageWidth * 0.05);

        // 2つ以上のクラスタがあり、各クラスタに十分な行数がある場合は段組み
        if (clusters.length < 2) return [textItems];

        // 各クラスタに最低2行以上必要
        const significantClusters = clusters.filter(c => c.count >= 2);
        if (significantClusters.length < 2) return [textItems];

        // クラスタの境界値を算出（隣接クラスタの中間点）
        significantClusters.sort((a, b) => a.center - b.center);
        const boundaries = [];
        for (let i = 0; i < significantClusters.length - 1; i++) {
            boundaries.push(
                (significantClusters[i].center + significantClusters[i + 1].center) / 2
            );
        }

        // 境界値で全テキストアイテムを分割
        const columnItems = significantClusters.map(() => []);
        for (const item of textItems) {
            let colIdx = 0;
            for (let b = 0; b < boundaries.length; b++) {
                if (item.x >= boundaries[b]) colIdx = b + 1;
            }
            columnItems[colIdx].push(item);
        }

        // 空のカラムを除外
        return columnItems.filter(col => col.length > 0);
    }

    /**
     * 数値の配列をクラスタに分割します。
     * @private
     * @param {Array<number>} values - ソート済みの数値配列
     * @param {number} threshold - クラスタ分割の閾値
     * @returns {Array<{center: number, count: number}>}
     */
    _clusterValues(values, threshold) {
        if (values.length === 0) return [];

        const clusters = [{ values: [values[0]], center: values[0], count: 1 }];

        for (let i = 1; i < values.length; i++) {
            const lastCluster = clusters[clusters.length - 1];
            if (values[i] - lastCluster.center <= threshold) {
                lastCluster.values.push(values[i]);
                lastCluster.count++;
                // 重心を再計算
                lastCluster.center = lastCluster.values.reduce((a, b) => a + b, 0) / lastCluster.count;
            } else {
                clusters.push({ values: [values[i]], center: values[i], count: 1 });
            }
        }

        return clusters;
    }

    // ========================================
    // 見出し検出
    // ========================================

    /**
     * 全ページのテキストアイテムから本文のフォントサイズを検出します。
     * @private
     * @param {Array} pagesData
     * @returns {number} 本文の推定フォントサイズ
     */
    _detectBodyFontSize(pagesData) {
        const fontSizeCounts = new Map();

        for (const page of pagesData) {
            for (const item of page.textItems) {
                if (item.text.trim().length === 0) continue;
                const size = Math.round(item.fontSize * 10) / 10;
                const textLen = item.text.trim().length;
                fontSizeCounts.set(size, (fontSizeCounts.get(size) || 0) + textLen);
            }
        }

        // 最も文字数が多いフォントサイズを本文サイズとする
        let maxCount = 0;
        let bodySize = 12;
        for (const [size, count] of fontSizeCounts) {
            if (count > maxCount) {
                maxCount = count;
                bodySize = size;
            }
        }

        return bodySize;
    }

    /**
     * PDFのしおり情報からジャンプ先を解決し、見出しターゲットを構築します。
     * しおりのdest（ジャンプ先）からページ番号・Y座標を取得し、
     * そこにあるテキストを見出しとして登録します。
     * @private
     * @param {Array|null} outline
     * @param {PDFDocumentProxy} pdfDoc
     * @param {Array} pagesData - 解析済みのページデータ
     * @returns {Promise<Map<string, number>>} "pageIndex:y" → 見出しレベルのマップ
     */
    async _buildOutlineTargets(outline, pdfDoc, pagesData) {
        const targets = new Map();
        if (!outline || outline.length === 0) return targets;

        await this._resolveOutlineDestinations(outline, 1, pdfDoc, pagesData, targets);
        return targets;
    }

    /**
     * しおりツリーを再帰的に処理し、ジャンプ先の位置をキーにしたマップを構築します。
     * @private
     * @param {Array} items - しおりアイテムの配列
     * @param {number} level - 現在の階層レベル
     * @param {PDFDocumentProxy} pdfDoc
     * @param {Array} pagesData
     * @param {Map} targets - 結果マップ
     */
    async _resolveOutlineDestinations(items, level, pdfDoc, pagesData, targets) {
        for (const item of items) {
            const headingLevel = Math.min(level, 4);

            try {
                // ジャンプ先を解決
                let dest = item.dest;
                if (typeof dest === 'string') {
                    // 名前付きdestを解決
                    dest = await pdfDoc.getDestination(dest);
                }

                if (dest && Array.isArray(dest) && dest.length >= 2) {
                    // dest[0] はページ参照、dest[1] は表示モード
                    const pageRef = dest[0];
                    const pageIndex = await pdfDoc.getPageIndex(pageRef);
                    // dest[3] がY座標（PDFの座標系で上からの位置）
                    const destY = dest.length >= 4 && dest[3] !== null ? dest[3] : null;

                    if (pageIndex >= 0 && pageIndex < pagesData.length) {
                        const pageData = pagesData[pageIndex];
                        // PDF Y座標をビューポート座標に変換
                        const viewportY = destY !== null ? (pageData.height - destY) : 0;

                        // ジャンプ先Y座標付近のテキストブロックを見出しとしてマーク
                        // キーは "pageIndex:y" の形式
                        const key = `${pageIndex}:${Math.round(viewportY)}`;
                        targets.set(key, headingLevel);
                    }
                } else if (item.title) {
                    // destが解決できない場合はタイトルテキストでフォールバック
                    targets.set(`title:${item.title.trim()}`, headingLevel);
                }
            } catch {
                // destの解決に失敗した場合はタイトルテキストでフォールバック
                if (item.title) {
                    targets.set(`title:${item.title.trim()}`, headingLevel);
                }
            }

            if (item.items && item.items.length > 0) {
                await this._resolveOutlineDestinations(item.items, level + 1, pdfDoc, pagesData, targets);
            }
        }
    }

    /**
     * ブロックがしおりのジャンプ先に該当するか判定します。
     * @private
     * @param {Object} block - ブロックオブジェクト
     * @param {number} pageIndex - ページインデックス（0始まり）
     * @param {Map} outlineTargets
     * @returns {number|null} 見出しレベル (1-4) or null
     */
    _matchOutlineHeading(block, pageIndex, outlineTargets) {
        if (outlineTargets.size === 0) return null;

        // ブロックの先頭行のY座標
        const firstLine = block.lines[0];
        if (!firstLine || firstLine.length === 0) return null;
        const blockY = Math.round(firstLine[0].y);
        const blockText = block.lines
            .map(line => line.map(item => item.text).join(''))
            .join('').trim();

        if (blockText.length === 0) return null;

        // 1. 位置ベースのマッチング（ジャンプ先Y座標との比較）
        const yTolerance = 15; // Y座標の許容誤差
        for (const [key, level] of outlineTargets) {
            if (key.startsWith('title:')) continue;

            const [pi, y] = key.split(':').map(Number);
            if (pi === pageIndex && Math.abs(y - blockY) <= yTolerance) {
                return level;
            }
        }

        // 2. タイトルテキストベースのフォールバック
        for (const [key, level] of outlineTargets) {
            if (!key.startsWith('title:')) continue;
            const outlineText = key.substring(6);
            if (blockText.includes(outlineText) || outlineText.includes(blockText)) {
                return level;
            }
        }

        return null;
    }

    /**
     * フォントサイズに基づいて見出しレベルを推定します。
     * @private
     * @param {number} fontSize
     * @param {number} bodyFontSize
     * @returns {number|null} 見出しレベル (1-4) or null
     */
    _detectHeadingByFontSize(fontSize, bodyFontSize) {
        const ratio = fontSize / bodyFontSize;
        if (ratio < PdfImporter.HEADING_MIN_SIZE_RATIO) return null;

        for (const { level, ratio: threshold } of PdfImporter.HEADING_LEVELS) {
            if (ratio >= threshold) return level;
        }

        return 4; // 最小の見出しレベル
    }

    // ========================================
    // HTML構築
    // ========================================

    /**
     * 解析結果からTiptap互換のHTMLを構築します。
     * @private
     * @param {Array} pagesData
     * @param {number} bodyFontSize
     * @param {Map} outlineTargets
     * @returns {string} HTML文字列
     */
    _buildHtml(pagesData, bodyFontSize, outlineTargets) {
        const htmlParts = [];

        for (const pageData of pagesData) {
            const pageIndex = pageData.pageIndex - 1; // 0始まりに変換

            // 段組み検出
            const columns = this._detectColumns(pageData.textItems, pageData.width);

            // 各カラムを処理
            for (const columnItems of columns) {
                const lines = this._groupIntoLines(columnItems);
                const blocks = this._groupIntoBlocks(lines, bodyFontSize, outlineTargets, pageIndex);
                htmlParts.push(this._renderBlocks(blocks));
            }

            // ページ内の画像を追加
            for (const image of pageData.images) {
                htmlParts.push(this._buildImageTag(image.dataUrl));
            }
        }

        return htmlParts.join('\n');
    }

    /**
     * テキストアイテムを行ごとにグループ化します。
     * @private
     * @param {Array} textItems
     * @returns {Array<Array>} 行ごとにグループ化されたテキストアイテム
     */
    _groupIntoLines(textItems) {
        if (textItems.length === 0) return [];

        // Y座標でソート
        const sorted = [...textItems].sort((a, b) => a.y - b.y || a.x - b.x);

        const lines = [];
        let currentLine = [sorted[0]];
        let currentY = sorted[0].y;

        for (let i = 1; i < sorted.length; i++) {
            const item = sorted[i];
            if (Math.abs(item.y - currentY) <= PdfImporter.Y_TOLERANCE) {
                currentLine.push(item);
            } else {
                // X座標でソートして行を確定
                currentLine.sort((a, b) => a.x - b.x);
                lines.push(currentLine);
                currentLine = [item];
                currentY = item.y;
            }
        }

        if (currentLine.length > 0) {
            currentLine.sort((a, b) => a.x - b.x);
            lines.push(currentLine);
        }

        return lines;
    }

    /**
     * 行をブロック（段落・見出し）にグループ化します。
     * @private
     * @param {Array} lines
     * @param {number} bodyFontSize
     * @param {Map} outlineTargets
     * @param {number} pageIndex - ページインデックス（0始まり）
     * @returns {Array} ブロックの配列
     */
    _groupIntoBlocks(lines, bodyFontSize, outlineTargets, pageIndex) {
        if (lines.length === 0) return [];

        const blocks = [];
        let currentBlock = { lines: [lines[0]], type: 'paragraph' };

        for (let i = 1; i < lines.length; i++) {
            const prevLine = lines[i - 1];
            const currentLine = lines[i];

            const prevY = prevLine[prevLine.length - 1].y;
            const currY = currentLine[0].y;
            const prevFontSize = this._getLineFontSize(prevLine);
            const gap = currY - prevY;

            // 段落間の判定: フォントサイズの1.5倍以上の間隔があれば新しいブロック
            const lineThreshold = prevFontSize * PdfImporter.LINE_HEIGHT_FACTOR;
            const isNewBlock = gap > lineThreshold * 1.3;

            // フォントサイズが大きく変わった場合も新しいブロック
            const currFontSize = this._getLineFontSize(currentLine);
            const sizeChanged = Math.abs(currFontSize - prevFontSize) > bodyFontSize * 0.15;

            if (isNewBlock || sizeChanged) {
                this._finalizeBlock(currentBlock, bodyFontSize, outlineTargets, pageIndex);
                blocks.push(currentBlock);
                currentBlock = { lines: [currentLine], type: 'paragraph' };
            } else {
                currentBlock.lines.push(currentLine);
            }
        }

        // 最後のブロック
        this._finalizeBlock(currentBlock, bodyFontSize, outlineTargets, pageIndex);
        blocks.push(currentBlock);

        return blocks;
    }

    /**
     * ブロックの種類（見出し/段落）を確定します。
     * @private
     * @param {Object} block
     * @param {number} bodyFontSize
     * @param {Map} outlineTargets
     * @param {number} pageIndex - ページインデックス（0始まり）
     */
    _finalizeBlock(block, bodyFontSize, outlineTargets, pageIndex) {
        const blockText = block.lines
            .map(line => line.map(item => item.text).join(''))
            .join('');

        const fontSize = this._getBlockFontSize(block);

        // 1. しおりベースの見出し検出（位置ベース + テキストフォールバック）
        const outlineLevel = this._matchOutlineHeading(block, pageIndex, outlineTargets);
        if (outlineLevel) {
            block.type = 'heading';
            block.level = outlineLevel;
            return;
        }

        // 2. フォントサイズベースの見出し検出（しおりがない場合）
        if (outlineTargets.size === 0) {
            const sizeLevel = this._detectHeadingByFontSize(fontSize, bodyFontSize);
            if (sizeLevel && blockText.trim().length > 0 && blockText.trim().length < 200) {
                block.type = 'heading';
                block.level = sizeLevel;
                return;
            }
        }

        block.type = 'paragraph';
    }

    /**
     * 行の代表フォントサイズを取得します。
     * @private
     * @param {Array} line
     * @returns {number}
     */
    _getLineFontSize(line) {
        if (line.length === 0) return 12;
        // テキスト量による加重平均
        let totalLen = 0;
        let weightedSize = 0;
        for (const item of line) {
            const len = item.text.length || 1;
            totalLen += len;
            weightedSize += item.fontSize * len;
        }
        return totalLen > 0 ? weightedSize / totalLen : 12;
    }

    /**
     * ブロックの代表フォントサイズを取得します。
     * @private
     * @param {Object} block
     * @returns {number}
     */
    _getBlockFontSize(block) {
        let totalLen = 0;
        let weightedSize = 0;
        for (const line of block.lines) {
            for (const item of line) {
                const len = item.text.length || 1;
                totalLen += len;
                weightedSize += item.fontSize * len;
            }
        }
        return totalLen > 0 ? weightedSize / totalLen : 12;
    }

    /**
     * ブロックの配列をHTMLに変換します。
     * @private
     * @param {Array} blocks
     * @returns {string}
     */
    _renderBlocks(blocks) {
        return blocks
            .map(block => this._renderBlock(block))
            .filter(html => html.length > 0)
            .join('\n');
    }

    /**
     * 1つのブロックをHTMLに変換します。
     * @private
     * @param {Object} block
     * @returns {string}
     */
    _renderBlock(block) {
        // 改行を保持: 行間を <br> で結合
        const renderedLines = block.lines
            .map(line => this._renderLine(line))
            .filter(l => l.trim().length > 0);

        if (renderedLines.length === 0) return '';

        if (block.type === 'heading') {
            const tag = `h${block.level}`;
            // 見出しは改行なしで結合
            return `<${tag}>${renderedLines.join(' ')}</${tag}>`;
        }

        // 段落内の複数行は <br> で改行を保持
        return `<p>${renderedLines.join('<br>')}</p>`;
    }

    /**
     * 1行をHTMLに変換します。
     * テキストアイテム間の適切なスペーシングを考慮します。
     * @private
     * @param {Array} line
     * @returns {string}
     */
    _renderLine(line) {
        if (line.length === 0) return '';

        const parts = [];

        for (let i = 0; i < line.length; i++) {
            const item = line[i];
            if (item.text.length === 0) continue;

            // 前のアイテムとの間にスペースが必要か判定
            if (i > 0) {
                const prev = line[i - 1];
                const gap = item.x - (prev.x + prev.width);
                if (gap > item.fontSize * PdfImporter.SPACE_GAP_FACTOR) {
                    parts.push(' ');
                }
            }

            parts.push(this._buildTextSpan(item));
        }

        return parts.join('');
    }

    /**
     * テキストアイテムをHTML spanに変換します。
     * スタイル情報（太字、斜体、色）を反映します。
     * @private
     * @param {Object} item
     * @returns {string}
     */
    _buildTextSpan(item) {
        const text = this._escapeHtml(item.text);
        const styles = [];
        const wrappers = [];

        // 色
        if (item.color) {
            styles.push(`color: ${item.color}`);
        }

        // 太字・斜体はTiptapのマークとして表現
        let result = text;

        if (item.fontStyle.isBold && item.fontStyle.isItalic) {
            result = `<strong><em>${result}</em></strong>`;
        } else if (item.fontStyle.isBold) {
            result = `<strong>${result}</strong>`;
        } else if (item.fontStyle.isItalic) {
            result = `<em>${result}</em>`;
        }

        // スタイル属性がある場合は span で囲む
        if (styles.length > 0) {
            result = `<span style="${styles.join('; ')}">${result}</span>`;
        }

        return result;
    }

    /**
     * 画像データをHTMLのimgタグに変換します。
     * @private
     * @param {string} dataUrl
     * @returns {string}
     */
    _buildImageTag(dataUrl) {
        return `<p><img src="${dataUrl}" /></p>`;
    }

    /**
     * HTMLエスケープを行います。
     * @private
     * @param {string} text
     * @returns {string}
     */
    _escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
