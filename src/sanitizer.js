/**
 * HTMLサニタイズロジック
 * 簡易的な実装として、危険なタグや属性を除去します。
 * 本番環境ではDOMPurifyなどのライブラリを使用することを推奨しますが、
 * ここでは要件に従い、外部ライブラリなしで実装します。
 * 
 * 要件: 13.1, 13.2, 13.3
 * - scriptタグ、iframeタグの除去
 * - イベントハンドラ属性の除去
 * - javascript: URLの除去
 */
export class Sanitizer {
    constructor() {
        // 許可するタグのリスト
        this.allowedTags = [
            'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr',
            'b', 'i', 'u', 's', 'strong', 'em', 'span', 'div', 'font',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
            'img', 'ruby', 'rt', 'rp', 'a', 'table', 'tr', 'td', 'th', 'thead', 'tbody'
        ];
        
        // 許可する属性のリスト
        this.allowedAttributes = [
            'class', 'id', 'style', 'src', 'alt', 'title', 'href', 'target', 'color',
            'width', 'height', 'colspan', 'rowspan'
        ];
        
        // 完全に削除するタグ（中身も含めて）
        this.dangerousTags = [
            'script', 'iframe', 'object', 'embed', 'style', 'link', 'meta',
            'frame', 'frameset', 'applet', 'base', 'form', 'input', 'button',
            'select', 'textarea', 'noscript'
        ];
        
        // 危険なURLプロトコル（正規化後にチェック）
        this.dangerousProtocols = [
            'javascript',
            'vbscript',
            'data'
        ];
    }

    /**
     * HTML文字列をサニタイズします。
     * @param {string} html - サニタイズ対象のHTML文字列
     * @returns {string} サニタイズ後のHTML文字列
     */
    sanitize(html) {
        if (!html || typeof html !== 'string') {
            return '';
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        this.cleanNode(doc.body);

        return doc.body.innerHTML;
    }

    /**
     * ノードを再帰的にクリーンアップします。
     * @param {Node} node - クリーンアップ対象のノード
     */
    cleanNode(node) {
        // ノードリストを配列に変換してループ（削除操作があるため）
        const children = Array.from(node.childNodes);

        children.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();

                // 危険なタグは中身ごと削除
                if (this.dangerousTags.includes(tagName)) {
                    node.removeChild(child);
                    return;
                }

                // 許可されていないタグの場合
                if (!this.allowedTags.includes(tagName)) {
                    // タグのみ削除して中身を残す (unwrap)
                    while (child.firstChild) {
                        node.insertBefore(child.firstChild, child);
                    }
                    node.removeChild(child);
                    return;
                }

                // 許可されたタグの場合、属性をチェック
                this.cleanAttributes(child);

                // 再帰的に処理
                this.cleanNode(child);
            } else if (child.nodeType === Node.TEXT_NODE) {
                // テキストノードは安全
            } else {
                // コメントノードなどは削除
                node.removeChild(child);
            }
        });
    }

    /**
     * 要素の属性をクリーンアップします。
     * @param {Element} element - クリーンアップ対象の要素
     */
    cleanAttributes(element) {
        const attrs = Array.from(element.attributes);
        
        attrs.forEach(attr => {
            const attrName = attr.name.toLowerCase();
            const attrValue = attr.value;

            // イベントハンドラの削除 (on*)
            if (attrName.startsWith('on')) {
                element.removeAttribute(attr.name);
                return;
            }

            // 許可されていない属性を削除
            if (!this.allowedAttributes.includes(attrName)) {
                element.removeAttribute(attr.name);
                return;
            }

            // URL属性のチェック（src, href）
            if (['src', 'href'].includes(attrName)) {
                if (this.isDangerousUrl(attrValue)) {
                    element.removeAttribute(attr.name);
                    return;
                }
            }

            // style属性のチェック
            if (attrName === 'style') {
                const cleanedStyle = this.cleanStyleAttribute(attrValue);
                if (cleanedStyle) {
                    element.setAttribute('style', cleanedStyle);
                } else {
                    element.removeAttribute('style');
                }
            }
        });
    }

    /**
     * URLが危険かどうかをチェックします。
     * @param {string} url - チェック対象のURL
     * @returns {boolean} 危険な場合はtrue
     */
    isDangerousUrl(url) {
        if (!url) return false;
        
        // 空白文字、制御文字、NULL文字を除去して正規化
        const normalizedUrl = url
            .replace(/[\x00-\x20\x7f-\x9f]/g, '')  // 制御文字を除去
            .replace(/\s/g, '')                     // 空白を除去
            .toLowerCase();
        
        // 危険なプロトコルをチェック
        for (const protocol of this.dangerousProtocols) {
            if (normalizedUrl.startsWith(protocol + ':')) {
                return true;
            }
        }
        
        // エンコードされたjavascript:のチェック
        const decodedUrl = this.decodeUrl(normalizedUrl);
        for (const protocol of this.dangerousProtocols) {
            if (decodedUrl.startsWith(protocol + ':')) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * URLをデコードします（複数回のエンコードに対応）。
     * @param {string} url - デコード対象のURL
     * @returns {string} デコード後のURL
     */
    decodeUrl(url) {
        let decoded = url;
        let prev = '';
        
        // 最大10回までデコードを試行（無限ループ防止）
        for (let i = 0; i < 10 && decoded !== prev; i++) {
            prev = decoded;
            try {
                decoded = decodeURIComponent(decoded);
            } catch (e) {
                // デコードエラーは無視
                break;
            }
        }
        
        return decoded.toLowerCase();
    }

    /**
     * style属性をクリーンアップします。
     * @param {string} style - クリーンアップ対象のstyle文字列
     * @returns {string} クリーンアップ後のstyle文字列
     */
    cleanStyleAttribute(style) {
        if (!style) return '';
        
        // 危険なパターンを除去
        const dangerousPatterns = [
            /expression\s*\(/gi,           // IE expression()
            /javascript\s*:/gi,            // javascript: URL
            /vbscript\s*:/gi,              // vbscript: URL
            /-moz-binding\s*:/gi,          // Firefox XBL binding
            /behavior\s*:/gi,              // IE behavior
            /url\s*\(\s*["']?\s*javascript/gi,  // url(javascript:...)
            /url\s*\(\s*["']?\s*data\s*:/gi,    // url(data:...)
        ];
        
        let cleanedStyle = style;
        
        for (const pattern of dangerousPatterns) {
            cleanedStyle = cleanedStyle.replace(pattern, '');
        }
        
        return cleanedStyle.trim();
    }
}
