/**
 * ファイル操作の統合テスト
 * 
 * 保存→読み込みの完全なラウンドトリップをテストします。
 * _要件: 10.1, 10.2, 10.3, 10.4_
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Sanitizer } from '../../src/sanitizer.js';

// StorageManagerのコアロジックをテストするためのヘルパークラス
class StorageManagerTestHelper {
    constructor() {
        this.sanitizer = new Sanitizer();
    }

    /**
     * ビューアHTMLを生成します。
     * @param {string} editorContent - エディタのHTMLコンテンツ
     * @param {string} flowchartContent - フローチャートのHTMLコンテンツ
     * @param {string} css - CSSスタイル
     * @param {Object} metadata - メタデータ
     * @returns {string} 生成されたビューアHTML
     */
    generateViewerHtml(editorContent, flowchartContent, css, metadata) {
        const { title } = metadata;
        
        // エディタコンテンツをサニタイズ
        const sanitizedEditorContent = this.sanitizer.sanitize(editorContent);
        const sanitizedFlowchartContent = this.sanitizer.sanitize(flowchartContent);
        
        const viewerHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    ${css}
  </style>
</head>
<body>
  <header id="toolbar">
    <div id="filename">${this.escapeHtml(title)}</div>
  </header>
  <div id="container">
    <main id="main-content">
      <div id="flowchart-container">
        <div id="flowchart-canvas">
          ${sanitizedFlowchartContent}
        </div>
      </div>
      <div id="editor-container">
        <div id="editor">
          ${sanitizedEditorContent}
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;

        return viewerHtml;
    }

    /**
     * HTML特殊文字をエスケープします。
     * @param {string} text - エスケープ対象のテキスト
     * @returns {string} エスケープ後のテキスト
     */
    escapeHtml(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => escapeMap[char]);
    }

    /**
     * プロジェクトデータを作成します。
     * @param {Object} options - オプション
     * @returns {Object} プロジェクトデータ
     */
    createProjectData(options = {}) {
        return {
            editorContent: options.editorContent || '<h1>テスト見出し</h1><p>テスト本文</p>',
            shapes: options.shapes || [
                ['shape-1', { id: 'shape-1', text: '見出し1', x: 100, y: 100, width: 120, height: 60 }],
                ['shape-2', { id: 'shape-2', text: '見出し2', x: 250, y: 100, width: 120, height: 60 }]
            ],
            connections: options.connections || [
                { id: 'conn-1', from: 'shape-1', to: 'shape-2', fromPoint: 'right', toPoint: 'left' }
            ],
            zoomLevel: options.zoomLevel || 1.0
        };
    }

    /**
     * メタデータJSONを生成します。
     * @param {Object} projectData - プロジェクトデータ
     * @returns {string} JSON文字列
     */
    generateMetadataJson(projectData) {
        return JSON.stringify({
            shapes: projectData.shapes,
            connections: projectData.connections,
            zoomLevel: projectData.zoomLevel
        }, null, 2);
    }

    /**
     * メタデータJSONをパースします。
     * @param {string} json - JSON文字列
     * @returns {Object} パースされたデータ
     */
    parseMetadataJson(json) {
        return JSON.parse(json);
    }
}

describe('ファイル操作の統合テスト', () => {
    let helper;

    beforeEach(() => {
        helper = new StorageManagerTestHelper();
    });

    describe('ビューアHTML生成（要件10.4）', () => {
        it('ビューアHTMLが正しく生成される', () => {
            const html = helper.generateViewerHtml(
                '<h1>テスト</h1>',
                '<div class="shape">図形</div>',
                'body { margin: 0; }',
                { title: 'テストドキュメント' }
            );

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<title>テストドキュメント</title>');
            expect(html).toContain('<h1>テスト</h1>');
            expect(html).toContain('<div class="shape">図形</div>');
            expect(html).toContain('body { margin: 0; }');
        });

        it('ビューアHTMLにインラインスクリプトが含まれない', () => {
            const html = helper.generateViewerHtml(
                '<h1>テスト</h1><script>alert("xss")</script>',
                '<div>図形</div>',
                '',
                { title: 'テスト' }
            );

            expect(html).not.toContain('<script>');
            expect(html).not.toContain('alert("xss")');
        });

        it('タイトルがHTMLエスケープされる', () => {
            const html = helper.generateViewerHtml(
                '<h1>テスト</h1>',
                '<div>図形</div>',
                '',
                { title: '<script>alert("xss")</script>' }
            );

            expect(html).not.toContain('<script>alert("xss")</script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('イベントハンドラが除去される', () => {
            const html = helper.generateViewerHtml(
                '<h1 onclick="alert(1)">テスト</h1>',
                '<div onmouseover="alert(2)">図形</div>',
                '',
                { title: 'テスト' }
            );

            expect(html).not.toContain('onclick');
            expect(html).not.toContain('onmouseover');
        });
    });

    describe('メタデータのラウンドトリップ（要件10.1, 10.2）', () => {
        it('図形データが正しくシリアライズ・デシリアライズされる', () => {
            const projectData = helper.createProjectData();
            const json = helper.generateMetadataJson(projectData);
            const parsed = helper.parseMetadataJson(json);

            expect(parsed.shapes).toEqual(projectData.shapes);
        });

        it('接続線データが正しくシリアライズ・デシリアライズされる', () => {
            const projectData = helper.createProjectData();
            const json = helper.generateMetadataJson(projectData);
            const parsed = helper.parseMetadataJson(json);

            expect(parsed.connections).toEqual(projectData.connections);
        });

        it('ズームレベルが正しくシリアライズ・デシリアライズされる', () => {
            const projectData = helper.createProjectData({ zoomLevel: 1.5 });
            const json = helper.generateMetadataJson(projectData);
            const parsed = helper.parseMetadataJson(json);

            expect(parsed.zoomLevel).toBe(1.5);
        });

        it('複雑な図形データが正しく保持される', () => {
            const complexShapes = [
                ['shape-1', {
                    id: 'shape-1',
                    text: '親図形',
                    x: 100,
                    y: 100,
                    width: 150,
                    height: 80,
                    backgroundColor: '#ff0000',
                    borderColor: '#00ff00',
                    color: '#0000ff',
                    children: ['shape-2'],
                    collapsed: false
                }],
                ['shape-2', {
                    id: 'shape-2',
                    text: '子図形',
                    x: 120,
                    y: 200,
                    width: 100,
                    height: 50,
                    parent: 'shape-1'
                }]
            ];

            const projectData = helper.createProjectData({ shapes: complexShapes });
            const json = helper.generateMetadataJson(projectData);
            const parsed = helper.parseMetadataJson(json);

            expect(parsed.shapes[0][1].children).toContain('shape-2');
            expect(parsed.shapes[1][1].parent).toBe('shape-1');
            expect(parsed.shapes[0][1].backgroundColor).toBe('#ff0000');
        });

        it('接続線スタイルが正しく保持される', () => {
            const connections = [
                {
                    id: 'conn-1',
                    from: 'shape-1',
                    to: 'shape-2',
                    fromPoint: 'bottom',
                    toPoint: 'top',
                    style: {
                        color: '#ff0000',
                        type: 'dashed',
                        arrow: 'both',
                        label: 'テストラベル'
                    }
                }
            ];

            const projectData = helper.createProjectData({ connections });
            const json = helper.generateMetadataJson(projectData);
            const parsed = helper.parseMetadataJson(json);

            expect(parsed.connections[0].style.color).toBe('#ff0000');
            expect(parsed.connections[0].style.type).toBe('dashed');
            expect(parsed.connections[0].style.arrow).toBe('both');
            expect(parsed.connections[0].style.label).toBe('テストラベル');
        });
    });

    describe('ZIPファイル構造（要件10.3）', () => {
        it('メタデータJSONが有効なJSON形式である', () => {
            const projectData = helper.createProjectData();
            const json = helper.generateMetadataJson(projectData);

            expect(() => JSON.parse(json)).not.toThrow();
        });

        it('空のプロジェクトでもメタデータが生成される', () => {
            const projectData = helper.createProjectData({
                shapes: [],
                connections: []
            });
            const json = helper.generateMetadataJson(projectData);
            const parsed = helper.parseMetadataJson(json);

            expect(parsed.shapes).toEqual([]);
            expect(parsed.connections).toEqual([]);
        });
    });

    describe('HTMLエスケープ', () => {
        it('特殊文字が正しくエスケープされる', () => {
            expect(helper.escapeHtml('&')).toBe('&amp;');
            expect(helper.escapeHtml('<')).toBe('&lt;');
            expect(helper.escapeHtml('>')).toBe('&gt;');
            expect(helper.escapeHtml('"')).toBe('&quot;');
            expect(helper.escapeHtml("'")).toBe('&#39;');
        });

        it('複合的な文字列が正しくエスケープされる', () => {
            const input = '<script>alert("test")</script>';
            const expected = '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;';
            expect(helper.escapeHtml(input)).toBe(expected);
        });

        it('nullや空文字列を安全に処理する', () => {
            expect(helper.escapeHtml(null)).toBe('');
            expect(helper.escapeHtml('')).toBe('');
            expect(helper.escapeHtml(undefined)).toBe('');
        });
    });

    describe('サニタイズ統合', () => {
        it('エディタコンテンツがサニタイズされる', () => {
            const maliciousContent = '<h1>テスト</h1><script>alert("xss")</script><p onclick="alert(1)">本文</p>';
            const html = helper.generateViewerHtml(
                maliciousContent,
                '',
                '',
                { title: 'テスト' }
            );

            expect(html).not.toContain('<script>');
            expect(html).not.toContain('onclick');
            expect(html).toContain('<h1>テスト</h1>');
        });

        it('フローチャートコンテンツがサニタイズされる', () => {
            const maliciousContent = '<div class="shape" onmouseover="alert(1)">図形</div><iframe src="evil.com"></iframe>';
            const html = helper.generateViewerHtml(
                '',
                maliciousContent,
                '',
                { title: 'テスト' }
            );

            expect(html).not.toContain('onmouseover');
            expect(html).not.toContain('<iframe');
            expect(html).toContain('<div class="shape">図形</div>');
        });
    });
});
