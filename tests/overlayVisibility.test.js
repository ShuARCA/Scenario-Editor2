import { describe, it, expect, beforeEach } from 'vitest';

// jsdom環境用のポリフィル
if (typeof global.ClipboardEvent === 'undefined') {
    global.ClipboardEvent = class ClipboardEvent extends Event { };
}
if (typeof global.DragEvent === 'undefined') {
    global.DragEvent = class DragEvent extends Event { };
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
import { HeadingVisibilityManager } from '../src/managers/HeadingVisibilityManager.js';
import { FlowchartApp } from '../src/flowchart/FlowchartApp.js';

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

describe('親ノード非表示時のオーバーレイキャンバス連動閉鎖テスト', () => {
    let editor;
    let eventBus;
    let outlineManager;
    let visibilityManager;
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
            content: '<h1 id="h-parent">親ノード見出し</h1><h2 id="h-child1">子ノード見出し1</h2><h2 id="h-child2">子ノード見出し2</h2><h3 id="h-grandchild">孫ノード見出し</h3>'
        });

        const mockEditorCore = {
            tiptap: editor,
            editorContainer: container,
            eventBus: eventBus
        };

        outlineManager = new OutlineManager(mockEditorCore);
        visibilityManager = new HeadingVisibilityManager(eventBus);
        outlineManager.setVisibilityManager(visibilityManager);

        flowchartApp = new FlowchartApp(eventBus);
        flowchartApp.setEditorManager(mockEditorCore);
        flowchartApp.setHeadingVisibilityManager(visibilityManager);
        flowchartApp.init();

        // エディタの見出しをフローチャートに同期
        const headings = outlineManager.getHeadings();
        flowchartApp.syncFromEditor(headings);
    });

    it('グループ親ノードを非表示にした際、表示中のオーバーレイキャンバスが自動的に閉じられ子ノードも非表示になること', () => {
        const shapes = Array.from(flowchartApp.shapes.values());
        const parentShape = shapes.find(s => s.headingId === 'h-parent');
        const child1Shape = shapes.find(s => s.headingId === 'h-child1');
        const child2Shape = shapes.find(s => s.headingId === 'h-child2');

        expect(parentShape).toBeDefined();
        expect(child1Shape).toBeDefined();
        expect(child2Shape).toBeDefined();

        // グループ化してオーバーレイモードに設定
        flowchartApp.groupManager.groupShapes(parentShape, child1Shape);
        flowchartApp.groupManager.groupShapes(parentShape, child2Shape);
        flowchartApp.groupManager.setGroupMode(parentShape, 'overlay');

        expect(parentShape.groupMode).toBe('overlay');
        expect(parentShape.children).toEqual([child1Shape.id, child2Shape.id]);

        // 初期状態ではオーバーレイは閉じており、子ノードは非表示
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(false);
        expect(child1Shape.element.style.display).toBe('none');

        // オーバーレイキャンバスを開く
        flowchartApp.groupManager.overlayStrategy.openOverlay(parentShape);
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(true);

        const overlayArea = document.querySelector('.overlay-group-area');
        expect(overlayArea).not.toBeNull();
        expect(child1Shape.element.style.display).toBe('flex');
        expect(child2Shape.element.style.display).toBe('flex');

        // 親ノードを非表示にする
        visibilityManager.setFlowchartVisible('h-parent', false);

        // 検証1: 親ノードが非表示になっていること
        expect(parentShape.visible).toBe(false);
        expect(parentShape.element.style.display).toBe('none');

        // 検証2: オーバーレイキャンバスが自動的に閉じられていること
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(false);
        expect(document.querySelector('.overlay-group-area')).toBeNull();

        // 検証3: 子ノードも非表示になっていること
        expect(child1Shape.visible).toBe(false);
        expect(child1Shape.element.style.display).toBe('none');
        expect(child2Shape.visible).toBe(false);
        expect(child2Shape.element.style.display).toBe('none');
    });

    it('親ノードを再表示した際、オーバーレイキャンバスは閉じた状態を維持し、親ノードのみが表示されること', () => {
        const shapes = Array.from(flowchartApp.shapes.values());
        const parentShape = shapes.find(s => s.headingId === 'h-parent');
        const child1Shape = shapes.find(s => s.headingId === 'h-child1');

        flowchartApp.groupManager.groupShapes(parentShape, child1Shape);
        flowchartApp.groupManager.setGroupMode(parentShape, 'overlay');

        // オーバーレイを開く
        flowchartApp.groupManager.overlayStrategy.openOverlay(parentShape);
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(true);

        // 親ノードを非表示にする
        visibilityManager.setFlowchartVisible('h-parent', false);
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(false);

        // 再度親ノードを表示にする
        visibilityManager.setFlowchartVisible('h-parent', true);

        // 親ノードは表示される
        expect(parentShape.visible).toBe(true);
        expect(parentShape.element.style.display).toBe('flex');

        // オーバーレイは閉じたまま
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(false);
        expect(document.querySelector('.overlay-group-area')).toBeNull();

        // 子ノードも非表示のまま（オーバーレイを開くまで表示されない）
        expect(child1Shape.element.style.display).toBe('none');
    });

    it('コンテキストメニューのhideNodeアクションから親ノードを非表示にした場合もオーバーレイが閉じること', () => {
        const shapes = Array.from(flowchartApp.shapes.values());
        const parentShape = shapes.find(s => s.headingId === 'h-parent');
        const child1Shape = shapes.find(s => s.headingId === 'h-child1');

        flowchartApp.groupManager.groupShapes(parentShape, child1Shape);
        flowchartApp.groupManager.setGroupMode(parentShape, 'overlay');

        // オーバーレイを開く
        flowchartApp.groupManager.overlayStrategy.openOverlay(parentShape);
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(true);

        // コンテキストメニューから親ノード非表示
        flowchartApp.contextMenuManager.selectedShapeForContext = parentShape.id;
        flowchartApp.contextMenuManager.handleContextMenuAction('hideNode');

        // オーバーレイが閉じられていること
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(false);
        expect(document.querySelector('.overlay-group-area')).toBeNull();
        expect(parentShape.element.style.display).toBe('none');
        expect(child1Shape.element.style.display).toBe('none');
    });

    it('入れ子グループで子ノードがオーバーレイ展開中に最上位親が非表示になった場合、子オーバーレイも閉じること', () => {
        const shapes = Array.from(flowchartApp.shapes.values());
        const parentShape = shapes.find(s => s.headingId === 'h-parent');
        const child1Shape = shapes.find(s => s.headingId === 'h-child1');
        const grandchildShape = shapes.find(s => s.headingId === 'h-grandchild');

        // 親 -> 子1、子1 -> 孫
        flowchartApp.groupManager.groupShapes(parentShape, child1Shape);
        flowchartApp.groupManager.groupShapes(child1Shape, grandchildShape);
        flowchartApp.groupManager.setGroupMode(parentShape, 'overlay');
        flowchartApp.groupManager.setGroupMode(child1Shape, 'overlay');

        // 親と子の両方のオーバーレイを開く
        flowchartApp.groupManager.overlayStrategy.openOverlay(parentShape);
        flowchartApp.groupManager.overlayStrategy.openOverlay(child1Shape);

        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(true);
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(child1Shape.id)).toBe(true);

        // 最上位の親を非表示にする
        visibilityManager.setFlowchartVisible('h-parent', false);

        // 親・子どちらのオーバーレイも閉じていること
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(parentShape.id)).toBe(false);
        expect(flowchartApp.groupManager.overlayStrategy.isOverlayOpen(child1Shape.id)).toBe(false);
        expect(document.querySelectorAll('.overlay-group-area')).toHaveLength(0);

        // 孫ノードも非表示になっていること
        expect(grandchildShape.visible).toBe(false);
        expect(grandchildShape.element.style.display).toBe('none');
    });
});