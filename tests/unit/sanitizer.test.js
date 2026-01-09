/**
 * Sanitizerクラスのユニットテスト
 * 
 * 要件: 13.1, 13.2, 13.3
 * - scriptタグ、iframeタグの除去
 * - イベントハンドラ属性の除去
 * - javascript: URLの除去
 */

import { describe, it, expect } from 'vitest';
import { Sanitizer } from '../../src/sanitizer.js';

describe('Sanitizer', () => {
    let sanitizer;

    beforeEach(() => {
        sanitizer = new Sanitizer();
    });

    describe('基本機能', () => {
        it('空文字列を処理できること', () => {
            expect(sanitizer.sanitize('')).toBe('');
        });

        it('nullを処理できること', () => {
            expect(sanitizer.sanitize(null)).toBe('');
        });

        it('undefinedを処理できること', () => {
            expect(sanitizer.sanitize(undefined)).toBe('');
        });

        it('通常のテキストをそのまま返すこと', () => {
            const html = '<p>Hello World</p>';
            expect(sanitizer.sanitize(html)).toBe('<p>Hello World</p>');
        });

        it('許可されたタグを保持すること', () => {
            const html = '<h1>見出し</h1><p>段落</p><b>太字</b>';
            const result = sanitizer.sanitize(html);
            expect(result).toContain('<h1>');
            expect(result).toContain('<p>');
            expect(result).toContain('<b>');
        });
    });

    describe('scriptタグの除去 (要件 13.1)', () => {
        it('scriptタグを除去すること', () => {
            const html = '<p>テスト</p><script>alert("XSS")</script>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('<script');
            expect(result).not.toContain('alert');
        });

        it('インラインscriptタグを除去すること', () => {
            const html = '<script type="text/javascript">document.cookie</script>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('script');
            expect(result).not.toContain('document.cookie');
        });

        it('複数のscriptタグを除去すること', () => {
            const html = '<script>a</script><p>text</p><script>b</script>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('script');
            expect(result).toContain('<p>text</p>');
        });
    });

    describe('iframeタグの除去 (要件 13.1)', () => {
        it('iframeタグを除去すること', () => {
            const html = '<iframe src="https://evil.com"></iframe>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('evil.com');
        });

        it('iframeタグの中身も除去すること', () => {
            const html = '<iframe>内部コンテンツ</iframe>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('iframe');
            expect(result).not.toContain('内部コンテンツ');
        });
    });

    describe('イベントハンドラ属性の除去 (要件 13.1)', () => {
        it('onclick属性を除去すること', () => {
            const html = '<p onclick="alert(1)">テスト</p>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('onclick');
            expect(result).toContain('<p>テスト</p>');
        });

        it('onerror属性を除去すること', () => {
            const html = '<img src="x" onerror="alert(1)">';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('onerror');
        });

        it('onload属性を除去すること', () => {
            const html = '<img src="test.jpg" onload="alert(1)">';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('onload');
        });

        it('onmouseover属性を除去すること', () => {
            const html = '<div onmouseover="alert(1)">テスト</div>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('onmouseover');
        });

        it('複数のイベントハンドラを除去すること', () => {
            const html = '<div onclick="a" onmouseover="b" onmouseout="c">テスト</div>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('onclick');
            expect(result).not.toContain('onmouseover');
            expect(result).not.toContain('onmouseout');
        });
    });

    describe('javascript: URLの除去 (要件 13.2)', () => {
        it('href属性のjavascript: URLを除去すること', () => {
            const html = '<a href="javascript:alert(1)">リンク</a>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('href');
        });

        it('src属性のjavascript: URLを除去すること', () => {
            const html = '<img src="javascript:alert(1)">';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('javascript:');
        });

        it('大文字小文字混在のjavascript: URLを除去すること', () => {
            const html = '<a href="JaVaScRiPt:alert(1)">リンク</a>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('javascript');
            expect(result).not.toContain('JaVaScRiPt');
        });

        it('空白を含むjavascript: URLを除去すること', () => {
            const html = '<a href="java script:alert(1)">リンク</a>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('href');
        });

        it('改行を含むjavascript: URLを除去すること', () => {
            const html = '<a href="java\nscript:alert(1)">リンク</a>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('href');
        });

        it('vbscript: URLを除去すること', () => {
            const html = '<a href="vbscript:msgbox(1)">リンク</a>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('vbscript');
            expect(result).not.toContain('href');
        });

        it('data: URLを除去すること', () => {
            const html = '<a href="data:text/html,<script>alert(1)</script>">リンク</a>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('data:');
            expect(result).not.toContain('href');
        });
    });

    describe('style属性のサニタイズ (要件 13.2)', () => {
        it('expression()を除去すること', () => {
            const html = '<div style="width: expression(alert(1))">テスト</div>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('expression');
        });

        it('style内のjavascript:を除去すること', () => {
            const html = '<div style="background: url(javascript:alert(1))">テスト</div>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('javascript');
        });

        it('安全なstyle属性は保持すること', () => {
            const html = '<div style="color: red; font-size: 14px;">テスト</div>';
            const result = sanitizer.sanitize(html);
            expect(result).toContain('color: red');
            expect(result).toContain('font-size: 14px');
        });
    });

    describe('その他の危険なタグの除去', () => {
        it('objectタグを除去すること', () => {
            const html = '<object data="evil.swf"></object>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('object');
        });

        it('embedタグを除去すること', () => {
            const html = '<embed src="evil.swf">';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('embed');
        });

        it('formタグを除去すること', () => {
            const html = '<form action="evil.com"><input></form>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('form');
            expect(result).not.toContain('input');
        });
    });

    describe('許可されていないタグのunwrap', () => {
        it('許可されていないタグの中身を保持すること', () => {
            const html = '<article>記事の内容</article>';
            const result = sanitizer.sanitize(html);
            expect(result).not.toContain('<article');
            expect(result).toContain('記事の内容');
        });
    });
});
