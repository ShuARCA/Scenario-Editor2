/**
 * セキュリティの最終確認テスト
 * 
 * 各種入力に対するサニタイズの動作確認をテストします。
 * _要件: 13.1, 13.2, 13.3_
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Sanitizer } from '../../src/sanitizer.js';

describe('セキュリティの最終確認テスト', () => {
    let sanitizer;

    beforeEach(() => {
        sanitizer = new Sanitizer();
    });

    describe('scriptタグの除去（要件13.1）', () => {
        it('基本的なscriptタグが除去される', () => {
            const input = '<p>テスト</p><script>alert("xss")</script>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert');
            expect(result).toContain('<p>テスト</p>');
        });

        it('属性付きscriptタグが除去される', () => {
            const input = '<script type="text/javascript" src="evil.js"></script>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<script');
            expect(result).not.toContain('evil.js');
        });

        it('複数のscriptタグが全て除去される', () => {
            const input = '<script>alert(1)</script><p>テスト</p><script>alert(2)</script>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<script>');
            expect(result).toContain('<p>テスト</p>');
        });

        it('ネストされたscriptタグが除去される', () => {
            const input = '<div><script>alert("nested")</script></div>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<script>');
            expect(result).toContain('<div>');
        });
    });

    describe('iframeタグの除去（要件13.1）', () => {
        it('基本的なiframeタグが除去される', () => {
            const input = '<p>テスト</p><iframe src="evil.com"></iframe>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('evil.com');
            expect(result).toContain('<p>テスト</p>');
        });

        it('属性付きiframeタグが除去される', () => {
            const input = '<iframe src="evil.com" width="100" height="100" frameborder="0"></iframe>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<iframe');
        });
    });

    describe('イベントハンドラ属性の除去（要件13.1）', () => {
        it('onclickが除去される', () => {
            const input = '<p onclick="alert(1)">テスト</p>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('onclick');
            expect(result).toContain('<p>テスト</p>');
        });

        it('onerrorが除去される', () => {
            const input = '<img src="x" onerror="alert(1)">';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('onerror');
        });

        it('onloadが除去される', () => {
            const input = '<img src="test.jpg" onload="alert(1)">';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('onload');
        });

        it('onmouseoverが除去される', () => {
            const input = '<div onmouseover="alert(1)">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('onmouseover');
        });

        it('onfocusが除去される', () => {
            const input = '<div onfocus="alert(1)">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('onfocus');
        });

        it('複数のイベントハンドラが全て除去される', () => {
            const input = '<div onclick="alert(1)" onmouseover="alert(2)" onmouseout="alert(3)">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('onclick');
            expect(result).not.toContain('onmouseover');
            expect(result).not.toContain('onmouseout');
        });
    });

    describe('javascript: URLの除去（要件13.1）', () => {
        it('href属性のjavascript:が除去される', () => {
            const input = '<a href="javascript:alert(1)">リンク</a>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('javascript:');
            expect(result).toContain('リンク');
        });

        it('src属性のjavascript:が除去される', () => {
            const input = '<img src="javascript:alert(1)">';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('javascript:');
        });

        it('大文字小文字混在のjavascript:が除去される', () => {
            const input = '<a href="JaVaScRiPt:alert(1)">リンク</a>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('javascript:');
            expect(result.toLowerCase()).not.toContain('javascript:');
        });

        it('空白を含むjavascript:が除去される', () => {
            const input = '<a href="java script:alert(1)">リンク</a>';
            const result = sanitizer.sanitize(input);

            // 空白を除去して正規化されるため、javascript:として検出される
            expect(result).not.toContain('href');
        });

        it('エンコードされたjavascript:が除去される', () => {
            const input = '<a href="&#106;avascript:alert(1)">リンク</a>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('javascript:');
        });
    });

    describe('vbscript: URLの除去', () => {
        it('vbscript:が除去される', () => {
            const input = '<a href="vbscript:msgbox(1)">リンク</a>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('vbscript:');
        });
    });

    describe('data: URLの除去', () => {
        it('data: URLが除去される', () => {
            const input = '<a href="data:text/html,<script>alert(1)</script>">リンク</a>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('data:');
        });
    });

    describe('その他の危険なタグの除去', () => {
        it('objectタグが除去される', () => {
            const input = '<object data="evil.swf"></object>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<object');
        });

        it('embedタグが除去される', () => {
            const input = '<embed src="evil.swf">';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<embed');
        });

        it('formタグが除去される', () => {
            const input = '<form action="evil.com"><input type="text"></form>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<form');
            expect(result).not.toContain('<input');
        });

        it('styleタグが除去される', () => {
            const input = '<style>body { background: url("javascript:alert(1)"); }</style>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('<style');
        });
    });

    describe('style属性のサニタイズ', () => {
        it('expression()が除去される', () => {
            const input = '<div style="width: expression(alert(1))">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('expression');
        });

        it('javascript: in styleが除去される', () => {
            const input = '<div style="background: url(javascript:alert(1))">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('javascript:');
        });

        it('安全なスタイルは保持される', () => {
            const input = '<div style="color: red; font-size: 14px;">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('color: red');
            expect(result).toContain('font-size: 14px');
        });
    });

    describe('許可されたタグの保持', () => {
        it('見出しタグが保持される', () => {
            const input = '<h1>見出し1</h1><h2>見出し2</h2><h3>見出し3</h3><h4>見出し4</h4>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('<h1>見出し1</h1>');
            expect(result).toContain('<h2>見出し2</h2>');
            expect(result).toContain('<h3>見出し3</h3>');
            expect(result).toContain('<h4>見出し4</h4>');
        });

        it('段落タグが保持される', () => {
            const input = '<p>段落テキスト</p>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('<p>段落テキスト</p>');
        });

        it('リストタグが保持される', () => {
            const input = '<ul><li>項目1</li><li>項目2</li></ul>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('<ul>');
            expect(result).toContain('<li>項目1</li>');
        });

        it('書式タグが保持される', () => {
            const input = '<b>太字</b><i>斜体</i><u>下線</u>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('<b>太字</b>');
            expect(result).toContain('<i>斜体</i>');
            expect(result).toContain('<u>下線</u>');
        });

        it('画像タグが保持される（安全な属性のみ）', () => {
            const input = '<img src="test.jpg" alt="テスト画像">';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('<img');
            expect(result).toContain('src="test.jpg"');
            expect(result).toContain('alt="テスト画像"');
        });

        it('ルビタグが保持される', () => {
            const input = '<ruby>漢字<rt>かんじ</rt></ruby>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('<ruby>');
            expect(result).toContain('<rt>かんじ</rt>');
        });

        it('コードブロックが保持される', () => {
            const input = '<pre><code>const x = 1;</code></pre>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('<pre>');
            expect(result).toContain('<code>');
        });
    });

    describe('許可された属性の保持', () => {
        it('class属性が保持される', () => {
            const input = '<div class="test-class">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('class="test-class"');
        });

        it('id属性が保持される', () => {
            const input = '<div id="test-id">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('id="test-id"');
        });

        it('安全なstyle属性が保持される', () => {
            const input = '<div style="color: blue;">テスト</div>';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('style="color: blue;"');
        });
    });

    describe('エッジケース', () => {
        it('空文字列を安全に処理する', () => {
            const result = sanitizer.sanitize('');
            expect(result).toBe('');
        });

        it('nullを安全に処理する', () => {
            const result = sanitizer.sanitize(null);
            expect(result).toBe('');
        });

        it('undefinedを安全に処理する', () => {
            const result = sanitizer.sanitize(undefined);
            expect(result).toBe('');
        });

        it('プレーンテキストを安全に処理する', () => {
            const input = 'これはプレーンテキストです';
            const result = sanitizer.sanitize(input);

            expect(result).toContain('これはプレーンテキストです');
        });

        it('深くネストされたHTMLを処理する', () => {
            const input = '<div><div><div><p onclick="alert(1)">テスト</p></div></div></div>';
            const result = sanitizer.sanitize(input);

            expect(result).not.toContain('onclick');
            expect(result).toContain('<p>テスト</p>');
        });
    });

    describe('ZIPファイル読み込み時のサニタイズ（要件13.2）', () => {
        it('悪意のあるHTMLコンテンツがサニタイズされる', () => {
            // ZIPから読み込まれる可能性のある悪意のあるコンテンツ
            const maliciousContent = `
                <h1>正常な見出し</h1>
                <script>document.cookie</script>
                <p onclick="stealData()">クリックしてください</p>
                <iframe src="https://evil.com/phishing"></iframe>
                <img src="x" onerror="alert('xss')">
                <a href="javascript:void(0)">リンク</a>
            `;
            const result = sanitizer.sanitize(maliciousContent);

            expect(result).toContain('<h1>正常な見出し</h1>');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('onclick');
            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('javascript:');
        });
    });

    describe('ビューアHTML生成時のサニタイズ（要件13.3）', () => {
        it('生成されるHTMLにインラインスクリプトが含まれない', () => {
            const content = '<h1>テスト</h1><script>alert(1)</script>';
            const result = sanitizer.sanitize(content);

            expect(result).not.toContain('<script>');
        });

        it('生成されるHTMLにイベントハンドラが含まれない', () => {
            const content = '<div onclick="alert(1)" onmouseover="alert(2)">テスト</div>';
            const result = sanitizer.sanitize(content);

            expect(result).not.toContain('onclick');
            expect(result).not.toContain('onmouseover');
        });
    });
});
