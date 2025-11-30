/**
 * フローチャートロジック
 */
import { generateId, rgbToHex } from './utils.js';

export class FlowchartApp {
    constructor(editorManager) {
        this.container = document.getElementById('flowchart-container');
        this.canvas = document.getElementById('flowchart-canvas');
        this.shapesLayer = document.getElementById('shapes-layer');
        this.connectionsLayer = document.getElementById('connections-layer');
        this.editorManager = editorManager; // init後に設定されます

        this.shapes = new Map(); // id -> shapeData
        this.connections = []; // { from: shapeId, to: shapeId, id: ... }

        this.mode = 'select'; // select, connect, pan
        this.isDragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };

        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.scrollStart = { left: 0, top: 0 };

        this.connectStartShape = null;

        this.init();
    }

    setEditorManager(em) {
        this.editorManager = em;
    }

    init() {
        // ツールバー
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMode(btn.dataset.mode);
            });
        });

        // キャンバスイベント
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // コンテキストメニューのセットアップ
        this.setupContextMenu();
    }

    setupContextMenu() {
        this.contextMenu = document.getElementById('flowchart-context-menu');
        this.selectedShapeForContext = null;

        // 右クリックイベント
        this.shapesLayer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const shapeEl = e.target.closest('.shape');
            if (shapeEl) {
                this.selectedShapeForContext = shapeEl.id;
                this.selectShape(shapeEl.id);
                this.showContextMenu(e.clientX, e.clientY);
            }
        });

        // コンテキストメニューのクリックイベント
        this.contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item) {
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            }
        });

        // 外側クリックでメニューを閉じる
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }

    showContextMenu(x, y) {
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.remove('hidden');
    }

    hideContextMenu() {
        this.contextMenu.classList.add('hidden');
        this.selectedShapeForContext = null;
    }

    handleContextMenuAction(action) {
        if (!this.selectedShapeForContext) return;

        if (action === 'editStyle') {
            // スタイル編集ダイアログを表示（簡易実装: promptを使用）
            const shape = this.shapes.get(this.selectedShapeForContext);
            if (shape) {
                const bgColor = prompt('背景色を入力 (例: #ffffff):', shape.backgroundColor || '#ffffff');
                if (bgColor) {
                    shape.backgroundColor = bgColor;
                    shape.element.style.backgroundColor = bgColor;
                }
                const textColor = prompt('文字色を入力 (例: #334155):', shape.color || '#334155');
                if (textColor) {
                    shape.color = textColor;
                    shape.element.style.color = textColor;
                }
            }
        } else if (action === 'delete') {
            this.removeShape(this.selectedShapeForContext);
        }
    }

    setupPropertyPanel() {
        this.propertiesPanel = document.getElementById('flowchart-properties');
        this.shapeBgColorInput = document.getElementById('shapeBgColor');
        this.shapeTextColorInput = document.getElementById('shapeTextColor');
        this.connectionStyleSelect = document.getElementById('connectionStyle');

        this.shapeBgColorInput.addEventListener('input', (e) => {
            this.updateSelectedShapeStyle('backgroundColor', e.target.value);
        });

        this.shapeTextColorInput.addEventListener('input', (e) => {
            this.updateSelectedShapeStyle('color', e.target.value);
        });

        this.connectionStyleSelect.addEventListener('change', (e) => {
            this.updateSelectedConnectionStyle('type', e.target.value);
        });
    }

    updateSelectedShapeStyle(prop, value) {
        this.shapes.forEach(shape => {
            if (shape.element && shape.element.classList.contains('selected')) {
                shape[prop] = value;
                shape.element.style[prop] = value;
            }
        });
    }

    updateSelectedConnectionStyle(prop, value) {
        // 接続の選択状態管理はまだ不十分ですが、選択された接続に対して適用します
        // 現在のdrawConnectionsは再描画時にスタイルをリセットするため、データを更新する必要があります
        // 接続の選択ロジックを追加する必要があります
    }

    setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        this.canvas.classList.toggle('panning', mode === 'pan');

        // 状態のリセット
        this.connectStartShape = null;
        this.clearSelection();
    }

    syncFromEditor() {
        if (!this.editorManager) return;
        const headings = this.editorManager.getHeadings();

        // 簡易同期: 新しい見出しに対して図形を作成し、既存のテキストを更新します。
        // これは簡易版です。堅牢なバージョンではIDを追跡するか、diffアルゴリズムを使用します。
        // このデモでは、インデックスまたはテキストで一致させようとします。

        // すべて未確認としてマーク
        this.shapes.forEach(s => s.seen = false);

        headings.forEach((h, index) => {
            // ヒューリスティックで既存の図形を見つけようとします（例：見出し要素に保存されたID？）
            // 今のところ、可能であれば線形マッピングを想定するか、新規作成します。

            let shape = Array.from(this.shapes.values()).find(s => s.headingIndex === index);

            if (shape) {
                shape.text = h.text;
                shape.seen = true;
                this.updateShapeElement(shape);
            } else {
                // 新規作成
                const id = generateId();
                const newShape = {
                    id: id,
                    text: h.text,
                    x: 50 + (index * 150) % 800,
                    y: 50 + Math.floor(index / 5) * 100,
                    width: 120,
                    height: 60,
                    headingIndex: index,
                    seen: true,
                    children: []
                };
                this.shapes.set(id, newShape);
                this.createShapeElement(newShape);
            }
        });

        // 未確認の図形を削除しますか？ユーザーが手動で追加した可能性があります。
        // 要件には「H1-H4見出しが自動生成される」とあります。
        // 見出しに紐付いていたが存在しなくなった図形を削除します。
        const toRemove = [];
        this.shapes.forEach((s, id) => {
            if (s.headingIndex !== undefined && !s.seen) {
                toRemove.push(id);
            }
        });
        toRemove.forEach(id => this.removeShape(id));

        this.drawConnections();
    }

    createShapeElement(shapeData) {
        const el = document.createElement('div');
        el.className = 'shape';
        el.id = shapeData.id;
        el.textContent = shapeData.text;
        el.style.left = `${shapeData.x}px`;
        el.style.top = `${shapeData.y}px`;
        el.style.width = `${shapeData.width}px`;
        el.style.height = `${shapeData.height}px`; // 実際には最小の高さ

        // スタイルの適用
        if (shapeData.backgroundColor) el.style.backgroundColor = shapeData.backgroundColor;
        if (shapeData.color) el.style.color = shapeData.color;

        // 接続ポイントの追加
        ['top', 'bottom', 'left', 'right'].forEach(pos => {
            const pt = document.createElement('div');
            pt.className = `connection-point ${pos}`;
            pt.dataset.pos = pos;
            el.appendChild(pt);
        });

        this.shapesLayer.appendChild(el);
        shapeData.element = el;
    }

    // ... (updateShapeElement, removeShape, handleMouseDown, handleMouseMove, handleMouseUp, handleDrop, checkCollision, isDescendant, groupShapes, ungroupShape, updateShapeStyle, toggleCollapse, setChildrenVisibility methods remain same)

    selectShape(id) {
        this.clearSelection();
        const shape = this.shapes.get(id);
        if (shape && shape.element) {
            shape.element.classList.add('selected');

            // プロパティパネルの表示と値の更新
            this.propertiesPanel.classList.remove('hidden');
            this.shapeBgColorInput.value = rgbToHex(shape.element.style.backgroundColor) || '#ffffff';
            this.shapeTextColorInput.value = rgbToHex(shape.element.style.color) || '#334155';
        }
    }

    clearSelection() {
        this.shapes.forEach(s => {
            if (s.element) s.element.classList.remove('selected');
        });
        // プロパティパネルを隠す
        if (this.propertiesPanel) this.propertiesPanel.classList.add('hidden');
    }

    updateShapeElement(shapeData) {
        if (shapeData.element) {
            // 接続ポイントを保持
            const points = Array.from(shapeData.element.querySelectorAll('.connection-point'));
            shapeData.element.textContent = shapeData.text;
            points.forEach(p => shapeData.element.appendChild(p));
        }
    }

    updateSelectedConnectionStyle(prop, value) {
        // 簡易的な実装: 選択された接続がないため、すべての接続に適用するか、
        // または接続を選択可能にする必要があります。
        // ここでは、現在選択されている図形から出る接続に適用してみます。
        this.shapes.forEach(shape => {
            if (shape.element && shape.element.classList.contains('selected')) {
                // この図形から出る接続を探す
                this.connections.forEach(conn => {
                    if (conn.from === shape.id) {
                        conn[prop] = value;
                    }
                });
            }
        });
        this.drawConnections();
    }

    handleMouseDown(e) {
        if (this.mode === 'pan') {
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.scrollStart = { left: this.container.scrollLeft, top: this.container.scrollTop };
            return;
        }

        const target = e.target;

        // 接続ポイントのクリック処理
        if (this.mode === 'connect' && target.classList.contains('connection-point')) {
            const shapeEl = target.closest('.shape');
            if (shapeEl) {
                this.connectStartShape = shapeEl.id;
                // ポイントをハイライト？
            }
            return;
        }

        // 図形のクリック処理
        const shapeEl = target.closest('.shape');
        if (shapeEl) {
            if (this.mode === 'select') {
                this.isDragging = true;
                this.dragTarget = shapeEl;
                const rect = shapeEl.getBoundingClientRect();
                // 図形の左上に対するオフセットを計算
                this.dragOffset = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                this.selectShape(shapeEl.id);
            }
        } else {
            // 背景をクリック
            this.clearSelection();
        }
    }

    handleMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.container.scrollLeft = this.scrollStart.left - dx;
            this.container.scrollTop = this.scrollStart.top - dy;
            return;
        }

        if (this.isDragging && this.dragTarget && this.mode === 'select') {
            // canvas-content に対する新しい位置を計算
            const canvasRect = this.canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left + this.container.scrollLeft - this.dragOffset.x;
            const y = e.clientY - canvasRect.top + this.container.scrollTop - this.dragOffset.y;

            const shape = this.shapes.get(this.dragTarget.id);
            if (shape) {
                const dx = x - shape.x;
                const dy = y - shape.y;

                this.moveShape(shape, dx, dy);
                this.drawConnections();
            }
        }
    }

    moveShape(shape, dx, dy) {
        shape.x += dx;
        shape.y += dy;
        if (shape.element) {
            shape.element.style.left = `${shape.x}px`;
            shape.element.style.top = `${shape.y}px`;
        }

        // 子要素も移動
        if (shape.children) {
            shape.children.forEach(childId => {
                const child = this.shapes.get(childId);
                if (child) {
                    this.moveShape(child, dx, dy);
                }
            });
        }
    }

    handleMouseUp(e) {
        if (this.isDragging && this.dragTarget && this.mode === 'select') {
            // ドロップ時のグループ化判定
            const droppedShape = this.shapes.get(this.dragTarget.id);
            if (droppedShape) {
                this.handleDrop(droppedShape);
            }
        }

        this.isDragging = false;
        this.dragTarget = null;
        this.isPanning = false;

        if (this.mode === 'connect' && this.connectStartShape) {
            const target = e.target;
            if (target.classList.contains('connection-point')) {
                const shapeEl = target.closest('.shape');
                if (shapeEl && shapeEl.id !== this.connectStartShape) {
                    // 接続を作成
                    this.connections.push({
                        id: generateId(),
                        from: this.connectStartShape,
                        to: shapeEl.id
                    });
                    this.drawConnections();
                }
            }
            this.connectStartShape = null;
        }
    }

    handleDrop(shape) {
        // 他の図形の上にドロップされたかチェック
        let parentCandidate = null;

        for (const [id, other] of this.shapes) {
            if (id === shape.id) continue;
            if (this.isDescendant(shape.id, id)) continue; // 自分の子孫にはドロップできない

            if (this.checkCollision(shape, other)) {
                parentCandidate = other;
            }
        }

        if (parentCandidate) {
            // グループ化
            this.groupShapes(parentCandidate, shape);
        } else {
            // 親がいた場合、親の外に出たかチェック
            if (shape.parent) {
                const parent = this.shapes.get(shape.parent);
                if (parent && !this.checkCollision(shape, parent)) {
                    this.ungroupShape(shape);
                }
            }
        }
    }

    checkCollision(inner, outer) {
        // innerの中心がouterに含まれているかで判定
        const cx = inner.x + inner.width / 2;
        const cy = inner.y + inner.height / 2;

        return (
            cx >= outer.x &&
            cx <= outer.x + outer.width &&
            cy >= outer.y &&
            cy <= outer.y + outer.height
        );
    }

    isDescendant(parentId, childId) {
        const parent = this.shapes.get(parentId);
        if (!parent || !parent.children) return false;
        if (parent.children.includes(childId)) return true;
        return parent.children.some(c => this.isDescendant(c, childId));
    }

    groupShapes(parent, child) {
        if (child.parent === parent.id) return; // 既に子

        // 既存の親から削除
        if (child.parent) {
            this.ungroupShape(child);
        }

        // 新しい親に追加
        child.parent = parent.id;
        if (!parent.children) parent.children = [];
        parent.children.push(child.id);

        // スタイル更新
        this.updateShapeStyle(parent);
    }

    ungroupShape(child) {
        if (!child.parent) return;

        const parent = this.shapes.get(child.parent);
        if (parent) {
            parent.children = parent.children.filter(id => id !== child.id);
            this.updateShapeStyle(parent);
        }
        child.parent = null;
    }

    updateShapeStyle(shape) {
        if (!shape.element) return;

        if (shape.children && shape.children.length > 0) {
            shape.element.classList.add('group-parent');
            // 折りたたみボタンの追加（なければ）
            if (!shape.element.querySelector('.group-toggle')) {
                const toggle = document.createElement('div');
                toggle.className = 'group-toggle';
                toggle.textContent = '-';
                toggle.addEventListener('mousedown', (e) => {
                    e.stopPropagation(); // ドラッグ開始を防ぐ
                    this.toggleCollapse(shape);
                });
                shape.element.appendChild(toggle);
            }
        } else {
            shape.element.classList.remove('group-parent');
            const toggle = shape.element.querySelector('.group-toggle');
            if (toggle) toggle.remove();
        }
    }

    toggleCollapse(shape) {
        shape.collapsed = !shape.collapsed;
        const toggle = shape.element.querySelector('.group-toggle');
        if (toggle) toggle.textContent = shape.collapsed ? '+' : '-';

        // 子要素の表示/非表示
        this.setChildrenVisibility(shape, !shape.collapsed);
        this.drawConnections();
    }

    setChildrenVisibility(shape, visible) {
        if (!shape.children) return;
        shape.children.forEach(childId => {
            const child = this.shapes.get(childId);
            if (child && child.element) {
                child.element.style.display = visible ? 'flex' : 'none';
                // 再帰的に処理（子が展開されていれば表示、折りたたまれていれば非表示のまま）
                if (visible && child.children && child.children.length > 0) {
                    this.setChildrenVisibility(child, !child.collapsed);
                } else if (!visible && child.children) {
                    // 親が非表示なら子も非表示
                    this.setChildrenVisibility(child, false);
                }
            }
        });
    }


    drawConnections() {
        // SVGレイヤーをクリア
        while (this.connectionsLayer.firstChild) {
            this.connectionsLayer.removeChild(this.connectionsLayer.firstChild);
        }

        this.connections.forEach(conn => {
            const fromShape = this.shapes.get(conn.from);
            const toShape = this.shapes.get(conn.to);

            if (!fromShape || !toShape || !fromShape.element || !toShape.element) return;

            // 親が折りたたまれていて、自分が非表示の場合は描画しない
            if (fromShape.element.style.display === 'none' || toShape.element.style.display === 'none') return;

            // 接続ポイントの計算 (簡易的に中心から中心、または最近接ポイント)
            // ここでは簡易的に各図形の中心を使用し、矩形との交点を求めるロジックなどが理想だが、
            // まずは中心座標を使用
            const startX = fromShape.x + fromShape.width / 2;
            const startY = fromShape.y + fromShape.height / 2;
            const endX = toShape.x + toShape.width / 2;
            const endY = toShape.y + toShape.height / 2;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

            // ベジェ曲線
            const dx = Math.abs(endX - startX);
            const cp1x = startX + dx * 0.5;
            const cp1y = startY;
            const cp2x = endX - dx * 0.5;
            const cp2y = endY;

            const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

            path.setAttribute('d', d);
            path.setAttribute('stroke', '#94a3b8');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');

            // 矢印マーカーなどが欲しい場合はdefsに追加が必要だが、一旦線のみ

            this.connectionsLayer.appendChild(path);
        });
    }
}
