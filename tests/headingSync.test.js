import { describe, it, expect, beforeEach } from 'vitest';

// jsdom環境用のポリフィル
if (typeof global.ClipboardEvent === 'undefined') {
    global.ClipboardEvent = class ClipboardEvent extends Event {};
}
if (typeof global.DragEvent === 'undefined') {
    global.DragEvent = class DragEvent extends Event {};
}
if (typeof Range.prototype.getClientRects === 'undefined') {
    Range.prototype.getClientRects = () => [];
    Range.prototype.getBoundingClientRect = () => ({
        x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0
    });
}
if (typeof Element.prototype.getClientRects === 'undefined') {
    Element.prototype.getClientRects = () => [];
}

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { HeadingWithId } from '../src/extensions/headingWithId.js';
import { EventBus } from '../src/core/EventBus.js';
import { OutlineManager } from '../src/managers/OutlineManager.js';
import { FlowchartApp } from '../src/flowchart/FlowchartApp.js';

/**
 * テスト用のDOM環境を準備するヘルパー
 */
function setupDOM() {
    document.body.innerHTML = `
        <div id="editor-container"><div class="tiptap"></div></div>
        <div id="outline-list"></div>
        <div id="outline-icon-picker" class="hidden"></div>
        <div id="outline-context-menu" class="hidden"></div>
        <div id="flowchart-container">
            <div id="flowchart-canvas">
                <div id="canvas-content">
                    <div id="shapes-layer"></div>
                    <div id="connections-layer"></div>
                </div>
            </div>
        </div>
        <div id="flowchart-context-menu" class="context-menu hidden">
            <div id="shape-edit-section"></div>
            <div id="connection-edit-section"></div>
            <div id="overlay-edit-section"></div>
        </div>
        <div id="global-color-picker-container"></div>
    `;
}

describe('見出し同期・複数行見出し適用のテスト', () => {
    let editor;
    let eventBus;
    let outlineManager;
    let flowchartApp;
    let container;

    beforeEach(() => {
        setupDOM();
        container = document.getElementById('editor-container');
        eventBus = new EventBus();

        editor = new Editor({
            element: container,
            extensions: [
                StarterKit.configure({ heading: false }),
                HeadingWithId
            ],
            content: '<p>最初の行</p><p>2行目のテキスト</p><p>3行目のテキスト</p>'
        });

        const mockEditorCore = {
            tiptap: editor,
            editorContainer: container,
            eventBus: eventBus
        };

        outlineManager = new OutlineManager(mockEditorCore);
        flowchartApp = new FlowchartApp(eventBus);
        flowchartApp.setEditorManager(mockEditorCore);
        flowchartApp.init();
    });

    // ========================================
    // 基本機能テスト
    // ========================================

    it('複数行を選択してtoggleHeadingを実行した際、各行に固有のユニークIDが付与されること', () => {
        editor.commands.selectAll();
        editor.commands.toggleHeading({ level: 1 });

        const headings = outlineManager.getHeadings();

        expect(headings).toHaveLength(3);
        expect(headings[0].text).toBe('最初の行');
        expect(headings[1].text).toBe('2行目のテキスト');
        expect(headings[2].text).toBe('3行目のテキスト');

        expect(headings[0].id).toBeTruthy();
        expect(headings[1].id).toBeTruthy();
        expect(headings[2].id).toBeTruthy();

        const uniqueIds = new Set(headings.map(h => h.id));
        expect(uniqueIds.size).toBe(3);
    });

    it('複数行の見出しをフローチャートに同期した際、各見出しごとに個別のノード（シェイプ）が作成されること', () => {
        editor.commands.selectAll();
        editor.commands.toggleHeading({ level: 1 });

        const headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(3);

        flowchartApp.syncFromEditor(headings);

        const shapes = Array.from(flowchartApp.shapes.values());
        expect(shapes).toHaveLength(3);

        const shapeHeadingIds = shapes.map(s => s.headingId);
        expect(shapeHeadingIds).toContain(headings[0].id);
        expect(shapeHeadingIds).toContain(headings[1].id);
        expect(shapeHeadingIds).toContain(headings[2].id);

        expect(shapes.find(s => s.headingId === headings[0].id)?.text).toBe('最初の行');
        expect(shapes.find(s => s.headingId === headings[1].id)?.text).toBe('2行目のテキスト');
        expect(shapes.find(s => s.headingId === headings[2].id)?.text).toBe('3行目のテキスト');
    });

    it('重複IDを持つ見出しが挿入された場合でも、appendTransactionにより即座にユニークIDに自動補正されること', () => {
        editor.commands.setContent(`
            <h1 id="duplicate-id">見出しA</h1>
            <h1 id="duplicate-id">見出しB</h1>
        `);

        const headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(2);
        expect(headings[0].id).not.toBe(headings[1].id);
    });

    it('複数行の見出しに対してもう一度toggleHeadingを実行した際、正しく段落に戻ること（トグル動作）', () => {
        editor.commands.selectAll();
        editor.commands.toggleHeading({ level: 1 });

        let headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(3);

        editor.commands.selectAll();
        editor.commands.toggleHeading({ level: 1 });

        headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(0);

        const html = editor.getHTML();
        expect(html).toContain('<p>最初の行</p>');
        expect(html).toContain('<p>2行目のテキスト</p>');
        expect(html).toContain('<p>3行目のテキスト</p>');
    });

    it('アウトラインのupdateOutline実行時に各見出しの要素クリックで正しいIDへのスクロールが設定されること', () => {
        editor.commands.selectAll();
        editor.commands.toggleHeading({ level: 1 });

        outlineManager.updateOutline();

        const outlineItems = document.querySelectorAll('.outline-item');
        expect(outlineItems).toHaveLength(3);

        const headings = outlineManager.getHeadings();
        expect(outlineItems[0].dataset.headingId).toBe(headings[0].id);
        expect(outlineItems[1].dataset.headingId).toBe(headings[1].id);
        expect(outlineItems[2].dataset.headingId).toBe(headings[2].id);

        expect(outlineItems[0].dataset.headingId).not.toBe(outlineItems[1].dataset.headingId);
        expect(outlineItems[1].dataset.headingId).not.toBe(outlineItems[2].dataset.headingId);
    });

    it('setHeadingを複数行に対して実行した際、全行にユニークIDが付与されること', () => {
        editor.commands.selectAll();
        editor.commands.setHeading({ level: 2 });

        const headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(3);
        expect(headings.every(h => h.level === 2)).toBe(true);

        const uniqueIds = new Set(headings.map(h => h.id));
        expect(uniqueIds.size).toBe(3);
    });

    it('見出しレベルの変更（H1→H2）時にも各ノードが正常にレベル変更されること', () => {
        editor.commands.selectAll();
        editor.commands.toggleHeading({ level: 1 });

        let headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(3);
        expect(headings.every(h => h.level === 1)).toBe(true);

        editor.commands.selectAll();
        editor.commands.toggleHeading({ level: 2 });

        headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(3);
        expect(headings.every(h => h.level === 2)).toBe(true);
        expect(new Set(headings.map(h => h.id)).size).toBe(3);
    });

    // ========================================
    // chain API 互換性テスト
    // ========================================

    it('chain().focus().toggleHeading()でも複数行に正しく見出しが適用されること', () => {
        editor.commands.selectAll();
        editor.chain().focus().toggleHeading({ level: 1 }).run();

        const headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(3);

        const uniqueIds = new Set(headings.map(h => h.id));
        expect(uniqueIds.size).toBe(3);
    });

    it('chain().focus().toggleHeading()でトグルオフ（段落に戻す）が正常動作すること', () => {
        // まず見出しにする
        editor.commands.selectAll();
        editor.chain().focus().toggleHeading({ level: 1 }).run();

        let headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(3);

        // トグルオフ
        editor.commands.selectAll();
        editor.chain().focus().toggleHeading({ level: 1 }).run();

        headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(0);
    });

    it('chain().focus().setHeading()でも複数行に正しく見出しが適用されること', () => {
        editor.commands.selectAll();
        editor.chain().focus().setHeading({ level: 3 }).run();

        const headings = outlineManager.getHeadings();
        expect(headings).toHaveLength(3);
        expect(headings.every(h => h.level === 3)).toBe(true);

        const uniqueIds = new Set(headings.map(h => h.id));
        expect(uniqueIds.size).toBe(3);
    });
});
