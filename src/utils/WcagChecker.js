/**
 * WCAGコントラストチェッカー
 * 
 * WCAG 2.1に基づくコントラスト比チェックユーティリティ。
 * 前景色と背景色のコントラスト比を計算し、AA/AAA基準への適合を判定します。
 * 
 * 既存のhexToRgb関数を再利用して色変換を行います。
 * 
 * @module utils/WcagChecker
 */

// =====================================================
// 定数定義
// =====================================================

/** WCAG 2.1 コントラスト比基準 */
const CONTRAST_THRESHOLDS = {
    /** AA基準: 通常テキスト（4.5:1） */
    AA_NORMAL: 4.5,
    /** AA基準: 大テキスト（3:1） */
    AA_LARGE: 3,
    /** AAA基準: 通常テキスト（7:1） */
    AAA_NORMAL: 7,
    /** AAA基準: 大テキスト（4.5:1） */
    AAA_LARGE: 4.5,
};

/** 大テキストの定義（CSS font-size基準） */
const LARGE_TEXT_THRESHOLD = {
    /** 通常フォント: 18pt (24px)以上 */
    NORMAL_PT: 18,
    /** 太字フォント: 14pt (18.66px)以上 */
    BOLD_PT: 14,
};

// =====================================================
// WcagCheckerクラス
// =====================================================

/**
 * WCAGコントラストチェッカークラス
 * 静的メソッドによるユーティリティ
 */
export class WcagChecker {

    // ========================================
    // パブリック API
    // ========================================

    /**
     * 2色間のコントラスト比を計算
     * 
     * @param {string} foreground - 前景色（hex: '#RRGGBB' または rgb: 'rgb(R,G,B)'）
     * @param {string} background - 背景色（同上）
     * @returns {number} コントラスト比（1〜21の範囲、小数2桁）
     */
    static getContrastRatio(foreground, background) {
        const fgRgb = WcagChecker._parseColor(foreground);
        const bgRgb = WcagChecker._parseColor(background);

        if (!fgRgb || !bgRgb) return 1;

        const fgLuminance = WcagChecker._getRelativeLuminance(fgRgb);
        const bgLuminance = WcagChecker._getRelativeLuminance(bgRgb);

        const lighter = Math.max(fgLuminance, bgLuminance);
        const darker = Math.min(fgLuminance, bgLuminance);

        const ratio = (lighter + 0.05) / (darker + 0.05);
        return Math.round(ratio * 100) / 100;
    }

    /**
     * コントラスト比がWCAG基準を満たすか判定
     * 
     * @param {number} ratio - コントラスト比
     * @param {boolean} [isLargeText=false] - 大テキストかどうか
     * @returns {{ aa: boolean, aaa: boolean }} AA/AAA適合状態
     */
    static checkLevel(ratio, isLargeText = false) {
        const aaThreshold = isLargeText
            ? CONTRAST_THRESHOLDS.AA_LARGE
            : CONTRAST_THRESHOLDS.AA_NORMAL;
        const aaaThreshold = isLargeText
            ? CONTRAST_THRESHOLDS.AAA_LARGE
            : CONTRAST_THRESHOLDS.AAA_NORMAL;

        return {
            aa: ratio >= aaThreshold,
            aaa: ratio >= aaaThreshold,
        };
    }

    /**
     * 要素のスタイルからコントラストチェック結果を返す
     * 
     * @param {Object} styles - スタイルオブジェクト
     * @param {string} styles.color - 前景色
     * @param {string} styles.backgroundColor - 背景色
     * @param {string} [styles.fontSize] - フォントサイズ（例: '24px'）
     * @param {string} [styles.fontWeight] - フォント太さ（例: 'bold', '700'）
     * @returns {{ ratio: number, aa: boolean, aaa: boolean, isLargeText: boolean }}
     */
    static checkElement(styles) {
        if (!styles || !styles.color || !styles.backgroundColor) {
            return { ratio: 0, aa: false, aaa: false, isLargeText: false };
        }

        const isLargeText = WcagChecker._isLargeText(
            styles.fontSize,
            styles.fontWeight
        );

        const ratio = WcagChecker.getContrastRatio(
            styles.color,
            styles.backgroundColor
        );

        const level = WcagChecker.checkLevel(ratio, isLargeText);

        return {
            ratio,
            ...level,
            isLargeText,
        };
    }

    /**
     * コントラスト比からラベルテキストを生成
     * 
     * @param {number} ratio - コントラスト比
     * @param {boolean} [isLargeText=false] - 大テキストかどうか
     * @returns {string} 表示用ラベル（例: '4.5:1 ✓ AA'）
     */
    static getLabel(ratio, isLargeText = false) {
        const level = WcagChecker.checkLevel(ratio, isLargeText);
        const ratioText = `${ratio.toFixed(1)}:1`;

        if (level.aaa) return `${ratioText} ✓ AAA`;
        if (level.aa) return `${ratioText} ✓ AA`;
        return `${ratioText} ✗ 不適合`;
    }

    // ========================================
    // プライベートメソッド
    // ========================================

    /**
     * 色文字列をRGB配列にパース
     * hex('#RRGGBB', '#RGB')、rgb('rgb(R,G,B)')に対応
     * 
     * @param {string} color - 色文字列
     * @returns {number[]|null} [R, G, B]（0-255）またはnull
     * @private
     */
    static _parseColor(color) {
        if (!color || typeof color !== 'string') return null;

        color = color.trim();

        // Hex形式
        if (color.startsWith('#')) {
            let hex = color.slice(1);

            // 3桁を6桁に展開
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }

            // 8桁（アルファ付き）は6桁に切り詰め
            if (hex.length === 8) {
                hex = hex.substring(0, 6);
            }

            if (hex.length !== 6) return null;

            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
            return [r, g, b];
        }

        // RGB形式
        const rgbMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgbMatch) {
            return [
                parseInt(rgbMatch[1]),
                parseInt(rgbMatch[2]),
                parseInt(rgbMatch[3]),
            ];
        }

        // HSL形式
        const hslMatch = color.match(/^hsla?\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/);
        if (hslMatch) {
            return WcagChecker._hslToRgb(
                parseInt(hslMatch[1]),
                parseInt(hslMatch[2]),
                parseInt(hslMatch[3])
            );
        }

        return null;
    }

    /**
     * sRGB色空間の相対輝度を計算
     * WCAG 2.1定義に準拠
     * 
     * @param {number[]} rgb - [R, G, B]（0-255）
     * @returns {number} 相対輝度（0〜1）
     * @private
     */
    static _getRelativeLuminance(rgb) {
        const [r, g, b] = rgb.map(channel => {
            const srgb = channel / 255;
            return srgb <= 0.04045
                ? srgb / 12.92
                : Math.pow((srgb + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * テキストがWCAG定義の「大テキスト」かどうかを判定
     * 
     * @param {string} [fontSize] - フォントサイズ（例: '24px', '18pt', '2em'）
     * @param {string} [fontWeight] - フォント太さ（例: 'bold', '700'）
     * @returns {boolean} 大テキストの場合true
     * @private
     */
    static _isLargeText(fontSize, fontWeight) {
        if (!fontSize) return false;

        const isBold = fontWeight === 'bold' ||
            fontWeight === 'bolder' ||
            (parseInt(fontWeight) >= 700);

        // ptをpxに変換して判定
        let sizeInPt;
        if (fontSize.endsWith('pt')) {
            sizeInPt = parseFloat(fontSize);
        } else if (fontSize.endsWith('px')) {
            // 1pt = 1.333px の標準変換
            sizeInPt = parseFloat(fontSize) / 1.333;
        } else if (fontSize.endsWith('em') || fontSize.endsWith('rem')) {
            // 1em = 16px = 12pt のベース換算
            sizeInPt = parseFloat(fontSize) * 12;
        } else {
            sizeInPt = parseFloat(fontSize) / 1.333; // デフォルトはpx想定
        }

        if (isNaN(sizeInPt)) return false;

        if (isBold) {
            return sizeInPt >= LARGE_TEXT_THRESHOLD.BOLD_PT;
        }
        return sizeInPt >= LARGE_TEXT_THRESHOLD.NORMAL_PT;
    }

    /**
     * HSLをRGBに変換
     * 
     * @param {number} h - 色相（0-360）
     * @param {number} s - 彩度（0-100）
     * @param {number} l - 明度（0-100）
     * @returns {number[]} [R, G, B]（0-255）
     * @private
     */
    static _hslToRgb(h, s, l) {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return [
            Math.round(r * 255),
            Math.round(g * 255),
            Math.round(b * 255),
        ];
    }
}
