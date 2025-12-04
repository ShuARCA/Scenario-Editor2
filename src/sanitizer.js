/**
 * HTMLサニタイズロジック
 * 簡易的な実装として、危険なタグや属性を除去します。
 * 本番環境ではDOMPurifyなどのライブラリを使用することを推奨しますが、
 * ここでは要件に従い、外部ライブラリなしで実装します。
 */
export class Sanitizer {
    constructor() {
        this.allowedTags = [
            'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr',
            'b', 'i', 'u', 's', 'strong', 'em', 'span', 'div',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
            'img', 'ruby', 'rt', 'rp'
        ];
        this.allowedAttributes = [
            'class', 'id', 'style', 'src', 'alt', 'title', 'href', 'target'
        ];
    }

    /**
     * HTML文字列をサニタイズします。
     * @param {string} html - サニタイズ対象のHTML文字列
     * @returns {string} サニタイズ後のHTML文字列
     */
    sanitize(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        this.cleanNode(doc.body);

        return doc.body.innerHTML;
    }

    cleanNode(node) {
        // ノードリストを配列に変換してループ（削除操作があるため）
        const children = Array.from(node.childNodes);

        children.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();

                // 許可されていないタグの場合
                if (!this.allowedTags.includes(tagName)) {
                    // script, iframe, objectなどは中身ごと削除
                    if (['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta'].includes(tagName)) {
                        node.removeChild(child);
                    } else {
                        // それ以外のタグは、タグのみ削除して中身を残す (unwrap)
                        while (child.firstChild) {
                            node.insertBefore(child.firstChild, child);
                        }
                        node.removeChild(child);
                    }
                } else {
                    // 許可されたタグの場合、属性をチェック
                    const attrs = Array.from(child.attributes);
                    attrs.forEach(attr => {
                        if (!this.allowedAttributes.includes(attr.name.toLowerCase())) {
                            child.removeAttribute(attr.name);
                        }
                        // javascript: プロトコルのチェック
                        if (['src', 'href'].includes(attr.name.toLowerCase())) {
                            if (attr.value.trim().toLowerCase().startsWith('javascript:')) {
                                child.removeAttribute(attr.name);
                            }
                        }
                        // イベントハンドラの削除 (on*)
                        if (attr.name.toLowerCase().startsWith('on')) {
                            child.removeAttribute(attr.name);
                        }
                    });

                    // 再帰的に処理
                    this.cleanNode(child);
                }
            } else if (child.nodeType === Node.TEXT_NODE) {
                // テキストノードは安全
            } else {
                // コメントノードなどは削除
                node.removeChild(child);
            }
        });
    }
}
