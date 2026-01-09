/**
 * FlowchartAppクラスのユニットテスト
 * 
 * 図形管理機能（addShape、updateShape、removeShape、getShapes）の動作確認
 * 図形位置更新機能の動作確認
 * 図形スタイル機能の動作確認
 * 接続線機能の動作確認
 * _要件: 6.1, 6.2, 6.3, 6.4, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4_
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/eventBus.js';

// FlowchartAppのテスト用モック
// 実際のFlowchartAppはDOM要素に強く依存しているため、
// コアロジックをテストするためのヘルパークラスを作成

/**
 * FlowchartAppのコアロジックをテストするためのヘルパークラス
 * DOM操作を除いた純粋なデータ操作をテスト
 */
class FlowchartDataManager {
    constructor() {
        /** @type {Map<string, Object>} id -> shapeData */
        this.shapes = new Map();
        /** @type {Array<Object>} 接続線データ */
        this.connections = [];
    }

    /**
     * 図形を追加します
     * @param {Object} shapeData - 図形データ
     * @returns {string} 追加された図形のID
     */
    addShape(shapeData) {
        const id = shapeData.id || `id-${Math.random().toString(36).substr(2, 9)}`;
        const shape = {
            id,
            text: shapeData.text || '',
            x: shapeData.x || 0,
            y: shapeData.y || 0,
            width: shapeData.width || 120,
            height: shapeData.height || 60,
            backgroundColor: shapeData.backgroundColor || '#ffffff',
            borderColor: shapeData.borderColor || '#cbd5e1',
            color: shapeData.color || '#334155',
            headingId: shapeData.headingId || null,
            parent: shapeData.parent || null,
            children: shapeData.children || [],
            folded: shapeData.folded || false,
            collapsed: shapeData.collapsed || false
        };
        this.shapes.set(id, shape);
        return id;
    }

    /**
     * 図形の折りたたみ状態を切り替えます
     * @param {string} shapeId - 図形ID
     * @returns {boolean} 切り替え成功の場合true
     */
    toggleFold(shapeId) {
        const shape = this.shapes.get(shapeId);
        if (!shape) return false;
        
        // 子要素がない場合は折りたたみ不可
        if (!shape.children || shape.children.length === 0) return false;
        
        shape.collapsed = !shape.collapsed;
        
        // 子要素の表示状態を更新
        this.setChildrenVisibility(shape, !shape.collapsed);
        
        return true;
    }

    /**
     * 子要素の表示状態を設定します
     * @param {Object} shape - 親図形
     * @param {boolean} visible - 表示状態
     */
    setChildrenVisibility(shape, visible) {
        if (!shape.children) return;
        
        shape.children.forEach(childId => {
            const child = this.shapes.get(childId);
            if (child) {
                child.visible = visible;
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

    /**
     * グループの展開/折りたたみに伴うレイアウト調整
     * サイズ変化量（deltaX, deltaY）に基づいて周囲のノードを移動する
     * - 展開時: deltaが正の値 → ノードを外側へ移動
     * - 折りたたみ時: deltaが負の値 → ノードを内側へ移動
     * 
     * 判定基準：各ノードの左上座標とソースノードの右端/下端を比較
     * - 水平移動: ノードの左上X座標がソースの右端以上の場合、すべて移動
     * - 垂直移動: ノードの左上Y座標がソースの下端以上の場合、すべて移動
     * 
     * 移動対象の判定：
     * - ソースがルートノードの場合：他のルートノードのみ移動
     * - ソースが子ノードの場合：同じ親を持つ兄弟ノードのみ移動
     * 
     * @param {string} sourceShapeId - サイズが変更された図形のID
     * @param {number} deltaX - X方向の変化量（正: 拡大, 負: 縮小）
     * @param {number} deltaY - Y方向の変化量（正: 拡大, 負: 縮小）
     */
    adjustLayout(sourceShapeId, deltaX, deltaY) {
        const sourceShape = this.shapes.get(sourceShapeId);
        if (!sourceShape) return;

        // ソースノードの右端と下端の座標
        const sourceRight = sourceShape.x + sourceShape.width;
        const sourceBottom = sourceShape.y + sourceShape.height;

        // ソースノードが親を持つ場合、同じ親を持つ兄弟ノードのみを移動対象とする
        const sourceParentId = sourceShape.parent;

        this.shapes.forEach((shape, id) => {
            if (id === sourceShapeId) return;
            if (this.isDescendant(sourceShapeId, id)) return; // 子孫は親と一緒に動く

            // 移動対象の判定
            if (sourceParentId) {
                // ソースが子ノードの場合、同じ親を持つ兄弟のみ対象
                if (shape.parent !== sourceParentId) return;
            } else {
                // ソースがルートノードの場合、他のルートノードのみ対象
                if (shape.parent) return;
            }

            let dx = 0;
            let dy = 0;

            // ノードの左上X座標がソースの右端以上の場合、水平移動
            const isRightOfSource = shape.x >= sourceRight;

            // ノードの左上Y座標がソースの下端以上の場合、垂直移動
            const isBelowSource = shape.y >= sourceBottom;

            // 右側にあるノードを水平移動（deltaXの符号に従う）
            if (isRightOfSource) {
                dx = deltaX;
            }

            // 下側にあるノードを垂直移動（deltaYの符号に従う）
            if (isBelowSource) {
                dy = deltaY;
            }

            if (dx !== 0 || dy !== 0) {
                shape.x += dx;
                shape.y += dy;
            }
        });
    }


    /**
     * 図形を更新します
     * @param {string} shapeId - 図形ID
     * @param {Object} data - 更新データ
     * @returns {boolean} 更新成功の場合true
     */
    updateShape(shapeId, data) {
        const shape = this.shapes.get(shapeId);
        if (!shape) return false;
        
        Object.assign(shape, data);
        return true;
    }

    /**
     * 図形を削除します
     * @param {string} shapeId - 図形ID
     * @returns {boolean} 削除成功の場合true
     */
    removeShape(shapeId) {
        const shape = this.shapes.get(shapeId);
        if (!shape) return false;

        // 親子関係の解消
        if (shape.parent) {
            const parent = this.shapes.get(shape.parent);
            if (parent && parent.children) {
                parent.children = parent.children.filter(id => id !== shapeId);
            }
        }
        
        // 子要素の親参照を削除
        if (shape.children) {
            shape.children.forEach(childId => {
                const child = this.shapes.get(childId);
                if (child) {
                    child.parent = null;
                }
            });
        }

        // 関連する接続線を削除
        this.connections = this.connections.filter(
            c => c.from !== shapeId && c.to !== shapeId
        );

        return this.shapes.delete(shapeId);
    }

    /**
     * 全図形を取得します
     * @returns {Array<Object>} 図形データの配列
     */
    getShapes() {
        return Array.from(this.shapes.values());
    }

    /**
     * 図形のスタイルを設定します
     * @param {string} shapeId - 図形ID
     * @param {Object} style - スタイルオブジェクト
     * @returns {boolean} 設定成功の場合true
     */
    setShapeStyle(shapeId, style) {
        const shape = this.shapes.get(shapeId);
        if (!shape) return false;

        if (style.backgroundColor !== undefined) {
            shape.backgroundColor = style.backgroundColor;
        }
        if (style.borderColor !== undefined) {
            shape.borderColor = style.borderColor;
        }
        if (style.textColor !== undefined) {
            shape.color = style.textColor;
        }
        return true;
    }


    /**
     * 接続線を追加します
     * @param {Object} connectionData - 接続線データ
     * @returns {string} 追加された接続線のID
     */
    addConnection(connectionData) {
        const id = connectionData.id || `conn-${Math.random().toString(36).substr(2, 9)}`;
        const connection = {
            id,
            from: connectionData.from,
            to: connectionData.to,
            fromPoint: connectionData.fromPoint || 'bottom',
            toPoint: connectionData.toPoint || 'top',
            style: connectionData.style || {}
        };
        this.connections.push(connection);
        return id;
    }

    /**
     * 接続線を更新します
     * @param {string} connId - 接続線ID
     * @param {Object} data - 更新データ
     * @returns {boolean} 更新成功の場合true
     */
    updateConnection(connId, data) {
        const conn = this.connections.find(c => c.id === connId);
        if (!conn) return false;

        if (data.style) {
            conn.style = { ...conn.style, ...data.style };
        }
        if (data.from !== undefined) conn.from = data.from;
        if (data.to !== undefined) conn.to = data.to;
        if (data.fromPoint !== undefined) conn.fromPoint = data.fromPoint;
        if (data.toPoint !== undefined) conn.toPoint = data.toPoint;
        
        return true;
    }

    /**
     * 接続線を削除します
     * @param {string} connId - 接続線ID
     * @returns {boolean} 削除成功の場合true
     */
    removeConnection(connId) {
        const index = this.connections.findIndex(c => c.id === connId);
        if (index === -1) return false;
        
        this.connections.splice(index, 1);
        return true;
    }

    /**
     * 全接続線を取得します
     * @returns {Array<Object>} 接続線データの配列
     */
    getConnections() {
        return [...this.connections];
    }

    /**
     * 図形をグループ化します
     * @param {string} parentId - 親図形ID
     * @param {string} childId - 子図形ID
     * @returns {boolean} グループ化成功の場合true
     */
    groupShapes(parentId, childId) {
        const parent = this.shapes.get(parentId);
        const child = this.shapes.get(childId);
        
        if (!parent || !child) return false;
        if (parentId === childId) return false;
        
        // 循環関係のチェック
        if (this.isDescendant(childId, parentId)) return false;

        // 既存の親から削除
        if (child.parent) {
            const oldParent = this.shapes.get(child.parent);
            if (oldParent && oldParent.children) {
                oldParent.children = oldParent.children.filter(id => id !== childId);
            }
        }

        // 新しい親に追加
        child.parent = parentId;
        if (!parent.children) parent.children = [];
        if (!parent.children.includes(childId)) {
            parent.children.push(childId);
        }
        
        return true;
    }


    /**
     * グループを解除します
     * @param {string} childId - 子図形ID
     * @returns {boolean} 解除成功の場合true
     */
    ungroupShape(childId) {
        const child = this.shapes.get(childId);
        if (!child || !child.parent) return false;

        const parent = this.shapes.get(child.parent);
        if (parent && parent.children) {
            parent.children = parent.children.filter(id => id !== childId);
        }
        child.parent = null;
        
        return true;
    }

    /**
     * 指定した図形が別の図形の子孫かどうかを判定します
     * @param {string} ancestorId - 祖先候補のID
     * @param {string} descendantId - 子孫候補のID
     * @returns {boolean} 子孫の場合true
     */
    isDescendant(ancestorId, descendantId) {
        const ancestor = this.shapes.get(ancestorId);
        if (!ancestor || !ancestor.children) return false;
        
        if (ancestor.children.includes(descendantId)) return true;
        
        return ancestor.children.some(childId => 
            this.isDescendant(childId, descendantId)
        );
    }

    /**
     * 図形の位置を更新します
     * @param {string} shapeId - 図形ID
     * @param {number} x - 新しいX座標
     * @param {number} y - 新しいY座標
     * @returns {boolean} 更新成功の場合true
     */
    updatePosition(shapeId, x, y) {
        const shape = this.shapes.get(shapeId);
        if (!shape) return false;
        
        shape.x = x;
        shape.y = y;
        return true;
    }
}

// テストスイート
describe('FlowchartDataManager', () => {
    let manager;

    beforeEach(() => {
        manager = new FlowchartDataManager();
    });

    // 8.1 図形管理機能のテスト
    describe('図形管理機能 (8.1)', () => {
        describe('addShape', () => {
            it('図形を追加できること', () => {
                const id = manager.addShape({
                    text: 'テスト図形',
                    x: 100,
                    y: 200
                });
                
                expect(id).toBeDefined();
                expect(manager.shapes.size).toBe(1);
                
                const shape = manager.shapes.get(id);
                expect(shape.text).toBe('テスト図形');
                expect(shape.x).toBe(100);
                expect(shape.y).toBe(200);
            });

            it('デフォルト値が設定されること', () => {
                const id = manager.addShape({ text: 'テスト' });
                const shape = manager.shapes.get(id);
                
                expect(shape.width).toBe(120);
                expect(shape.height).toBe(60);
                expect(shape.backgroundColor).toBe('#ffffff');
                expect(shape.borderColor).toBe('#cbd5e1');
                expect(shape.color).toBe('#334155');
            });

            it('指定したIDで図形を追加できること', () => {
                const id = manager.addShape({
                    id: 'custom-id',
                    text: 'カスタムID'
                });
                
                expect(id).toBe('custom-id');
                expect(manager.shapes.has('custom-id')).toBe(true);
            });
        });


        describe('updateShape', () => {
            it('図形のテキストを更新できること', () => {
                const id = manager.addShape({ text: '元のテキスト' });
                
                const result = manager.updateShape(id, { text: '更新後のテキスト' });
                
                expect(result).toBe(true);
                expect(manager.shapes.get(id).text).toBe('更新後のテキスト');
            });

            it('存在しない図形の更新はfalseを返すこと', () => {
                const result = manager.updateShape('nonexistent', { text: 'テスト' });
                expect(result).toBe(false);
            });

            it('複数のプロパティを同時に更新できること', () => {
                const id = manager.addShape({ text: 'テスト', x: 0, y: 0 });
                
                manager.updateShape(id, {
                    text: '更新',
                    x: 100,
                    y: 200,
                    width: 150
                });
                
                const shape = manager.shapes.get(id);
                expect(shape.text).toBe('更新');
                expect(shape.x).toBe(100);
                expect(shape.y).toBe(200);
                expect(shape.width).toBe(150);
            });
        });

        describe('removeShape', () => {
            it('図形を削除できること', () => {
                const id = manager.addShape({ text: 'テスト' });
                expect(manager.shapes.size).toBe(1);
                
                const result = manager.removeShape(id);
                
                expect(result).toBe(true);
                expect(manager.shapes.size).toBe(0);
            });

            it('存在しない図形の削除はfalseを返すこと', () => {
                const result = manager.removeShape('nonexistent');
                expect(result).toBe(false);
            });

            it('図形削除時に関連する接続線も削除されること', () => {
                const id1 = manager.addShape({ text: '図形1' });
                const id2 = manager.addShape({ text: '図形2' });
                manager.addConnection({ from: id1, to: id2 });
                
                expect(manager.connections.length).toBe(1);
                
                manager.removeShape(id1);
                
                expect(manager.connections.length).toBe(0);
            });

            it('親図形削除時に子の親参照がクリアされること', () => {
                const parentId = manager.addShape({ text: '親' });
                const childId = manager.addShape({ text: '子' });
                manager.groupShapes(parentId, childId);
                
                manager.removeShape(parentId);
                
                const child = manager.shapes.get(childId);
                expect(child.parent).toBeNull();
            });
        });

        describe('getShapes', () => {
            it('全図形を配列で取得できること', () => {
                manager.addShape({ text: '図形1' });
                manager.addShape({ text: '図形2' });
                manager.addShape({ text: '図形3' });
                
                const shapes = manager.getShapes();
                
                expect(shapes.length).toBe(3);
                expect(shapes.map(s => s.text)).toContain('図形1');
                expect(shapes.map(s => s.text)).toContain('図形2');
                expect(shapes.map(s => s.text)).toContain('図形3');
            });

            it('図形がない場合は空配列を返すこと', () => {
                const shapes = manager.getShapes();
                expect(shapes).toEqual([]);
            });
        });
    });


    // 8.3 図形位置更新機能のテスト
    describe('図形位置更新機能 (8.3)', () => {
        it('図形の位置を更新できること', () => {
            const id = manager.addShape({ text: 'テスト', x: 0, y: 0 });
            
            const result = manager.updatePosition(id, 150, 250);
            
            expect(result).toBe(true);
            const shape = manager.shapes.get(id);
            expect(shape.x).toBe(150);
            expect(shape.y).toBe(250);
        });

        it('存在しない図形の位置更新はfalseを返すこと', () => {
            const result = manager.updatePosition('nonexistent', 100, 100);
            expect(result).toBe(false);
        });

        it('負の座標も設定できること', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            manager.updatePosition(id, -50, -100);
            
            const shape = manager.shapes.get(id);
            expect(shape.x).toBe(-50);
            expect(shape.y).toBe(-100);
        });

        it('ドラッグ後の座標が保持されること', () => {
            const id = manager.addShape({ text: 'テスト', x: 100, y: 100 });
            
            // ドラッグをシミュレート（複数回の位置更新）
            manager.updatePosition(id, 110, 110);
            manager.updatePosition(id, 120, 120);
            manager.updatePosition(id, 200, 300);
            
            const shape = manager.shapes.get(id);
            expect(shape.x).toBe(200);
            expect(shape.y).toBe(300);
        });
    });

    // 8.5 図形スタイル機能のテスト
    describe('図形スタイル機能 (8.5)', () => {
        it('背景色を変更できること', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            const result = manager.setShapeStyle(id, { backgroundColor: '#ff0000' });
            
            expect(result).toBe(true);
            expect(manager.shapes.get(id).backgroundColor).toBe('#ff0000');
        });

        it('枠線色を変更できること', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            manager.setShapeStyle(id, { borderColor: '#00ff00' });
            
            expect(manager.shapes.get(id).borderColor).toBe('#00ff00');
        });

        it('文字色を変更できること', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            manager.setShapeStyle(id, { textColor: '#0000ff' });
            
            expect(manager.shapes.get(id).color).toBe('#0000ff');
        });

        it('複数のスタイルを同時に変更できること', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            manager.setShapeStyle(id, {
                backgroundColor: '#ff0000',
                borderColor: '#00ff00',
                textColor: '#0000ff'
            });
            
            const shape = manager.shapes.get(id);
            expect(shape.backgroundColor).toBe('#ff0000');
            expect(shape.borderColor).toBe('#00ff00');
            expect(shape.color).toBe('#0000ff');
        });

        it('存在しない図形のスタイル変更はfalseを返すこと', () => {
            const result = manager.setShapeStyle('nonexistent', { backgroundColor: '#ff0000' });
            expect(result).toBe(false);
        });
    });


    // 8.6 接続線機能のテスト
    describe('接続線機能 (8.6)', () => {
        let shape1Id, shape2Id, shape3Id;

        beforeEach(() => {
            shape1Id = manager.addShape({ text: '図形1', x: 0, y: 0 });
            shape2Id = manager.addShape({ text: '図形2', x: 200, y: 0 });
            shape3Id = manager.addShape({ text: '図形3', x: 100, y: 200 });
        });

        describe('addConnection', () => {
            it('2つの図形間に接続線を作成できること', () => {
                const connId = manager.addConnection({
                    from: shape1Id,
                    to: shape2Id
                });
                
                expect(connId).toBeDefined();
                expect(manager.connections.length).toBe(1);
                
                const conn = manager.connections[0];
                expect(conn.from).toBe(shape1Id);
                expect(conn.to).toBe(shape2Id);
            });

            it('接続ポイントを指定できること', () => {
                const connId = manager.addConnection({
                    from: shape1Id,
                    to: shape2Id,
                    fromPoint: 'right',
                    toPoint: 'left'
                });
                
                const conn = manager.connections.find(c => c.id === connId);
                expect(conn.fromPoint).toBe('right');
                expect(conn.toPoint).toBe('left');
            });

            it('デフォルトの接続ポイントが設定されること', () => {
                manager.addConnection({ from: shape1Id, to: shape2Id });
                
                const conn = manager.connections[0];
                expect(conn.fromPoint).toBe('bottom');
                expect(conn.toPoint).toBe('top');
            });

            it('複数の接続線を作成できること', () => {
                manager.addConnection({ from: shape1Id, to: shape2Id });
                manager.addConnection({ from: shape2Id, to: shape3Id });
                manager.addConnection({ from: shape1Id, to: shape3Id });
                
                expect(manager.connections.length).toBe(3);
            });
        });

        describe('updateConnection', () => {
            it('接続線のスタイルを更新できること', () => {
                const connId = manager.addConnection({
                    from: shape1Id,
                    to: shape2Id
                });
                
                const result = manager.updateConnection(connId, {
                    style: {
                        color: '#ff0000',
                        type: 'dashed',
                        arrow: 'both'
                    }
                });
                
                expect(result).toBe(true);
                const conn = manager.connections.find(c => c.id === connId);
                expect(conn.style.color).toBe('#ff0000');
                expect(conn.style.type).toBe('dashed');
                expect(conn.style.arrow).toBe('both');
            });

            it('接続線にラベルを設定できること', () => {
                const connId = manager.addConnection({
                    from: shape1Id,
                    to: shape2Id
                });
                
                manager.updateConnection(connId, {
                    style: { label: 'テストラベル' }
                });
                
                const conn = manager.connections.find(c => c.id === connId);
                expect(conn.style.label).toBe('テストラベル');
            });

            it('存在しない接続線の更新はfalseを返すこと', () => {
                const result = manager.updateConnection('nonexistent', {
                    style: { color: '#ff0000' }
                });
                expect(result).toBe(false);
            });
        });

        describe('removeConnection', () => {
            it('接続線を削除できること', () => {
                const connId = manager.addConnection({
                    from: shape1Id,
                    to: shape2Id
                });
                
                expect(manager.connections.length).toBe(1);
                
                const result = manager.removeConnection(connId);
                
                expect(result).toBe(true);
                expect(manager.connections.length).toBe(0);
            });

            it('存在しない接続線の削除はfalseを返すこと', () => {
                const result = manager.removeConnection('nonexistent');
                expect(result).toBe(false);
            });

            it('特定の接続線のみ削除されること', () => {
                const conn1Id = manager.addConnection({ from: shape1Id, to: shape2Id });
                const conn2Id = manager.addConnection({ from: shape2Id, to: shape3Id });
                
                manager.removeConnection(conn1Id);
                
                expect(manager.connections.length).toBe(1);
                expect(manager.connections[0].id).toBe(conn2Id);
            });
        });

        describe('getConnections', () => {
            it('全接続線を配列で取得できること', () => {
                manager.addConnection({ from: shape1Id, to: shape2Id });
                manager.addConnection({ from: shape2Id, to: shape3Id });
                
                const connections = manager.getConnections();
                
                expect(connections.length).toBe(2);
            });

            it('接続線がない場合は空配列を返すこと', () => {
                const connections = manager.getConnections();
                expect(connections).toEqual([]);
            });
        });
    });


    // グループ化機能のテスト（関連機能）
    describe('グループ化機能', () => {
        it('図形をグループ化できること', () => {
            const parentId = manager.addShape({ text: '親' });
            const childId = manager.addShape({ text: '子' });
            
            const result = manager.groupShapes(parentId, childId);
            
            expect(result).toBe(true);
            expect(manager.shapes.get(childId).parent).toBe(parentId);
            expect(manager.shapes.get(parentId).children).toContain(childId);
        });

        it('グループを解除できること', () => {
            const parentId = manager.addShape({ text: '親' });
            const childId = manager.addShape({ text: '子' });
            manager.groupShapes(parentId, childId);
            
            const result = manager.ungroupShape(childId);
            
            expect(result).toBe(true);
            expect(manager.shapes.get(childId).parent).toBeNull();
            expect(manager.shapes.get(parentId).children).not.toContain(childId);
        });

        it('グループ解除後、親のchildren配列が空になること', () => {
            const parentId = manager.addShape({ text: '親' });
            const childId = manager.addShape({ text: '子' });
            manager.groupShapes(parentId, childId);
            
            manager.ungroupShape(childId);
            
            const parent = manager.shapes.get(parentId);
            expect(parent.children).toEqual([]);
        });

        it('親を持たない図形のグループ解除はfalseを返すこと', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            const result = manager.ungroupShape(id);
            
            expect(result).toBe(false);
        });

        it('複数の子を持つ親から1つの子を解除できること', () => {
            const parentId = manager.addShape({ text: '親' });
            const child1Id = manager.addShape({ text: '子1' });
            const child2Id = manager.addShape({ text: '子2' });
            manager.groupShapes(parentId, child1Id);
            manager.groupShapes(parentId, child2Id);
            
            manager.ungroupShape(child1Id);
            
            const parent = manager.shapes.get(parentId);
            expect(parent.children).not.toContain(child1Id);
            expect(parent.children).toContain(child2Id);
            expect(manager.shapes.get(child1Id).parent).toBeNull();
            expect(manager.shapes.get(child2Id).parent).toBe(parentId);
        });

        it('循環関係のグループ化は拒否されること', () => {
            const id1 = manager.addShape({ text: '図形1' });
            const id2 = manager.addShape({ text: '図形2' });
            const id3 = manager.addShape({ text: '図形3' });
            
            // id1 -> id2 -> id3 の親子関係を作成
            manager.groupShapes(id1, id2);
            manager.groupShapes(id2, id3);
            
            // id3 を id1 の親にしようとする（循環）
            const result = manager.groupShapes(id3, id1);
            
            expect(result).toBe(false);
        });

        it('直接の循環関係（親を子にする）は拒否されること', () => {
            const parentId = manager.addShape({ text: '親' });
            const childId = manager.addShape({ text: '子' });
            
            manager.groupShapes(parentId, childId);
            
            // 親を子の子にしようとする（直接循環）
            const result = manager.groupShapes(childId, parentId);
            
            expect(result).toBe(false);
            // 元の関係が維持されていること
            expect(manager.shapes.get(childId).parent).toBe(parentId);
        });

        it('深い階層での循環関係も拒否されること', () => {
            const id1 = manager.addShape({ text: '図形1' });
            const id2 = manager.addShape({ text: '図形2' });
            const id3 = manager.addShape({ text: '図形3' });
            const id4 = manager.addShape({ text: '図形4' });
            const id5 = manager.addShape({ text: '図形5' });
            
            // id1 -> id2 -> id3 -> id4 -> id5 の親子関係を作成
            manager.groupShapes(id1, id2);
            manager.groupShapes(id2, id3);
            manager.groupShapes(id3, id4);
            manager.groupShapes(id4, id5);
            
            // id5 を id1 の親にしようとする（深い循環）
            const result = manager.groupShapes(id5, id1);
            
            expect(result).toBe(false);
        });

        it('循環関係が拒否された後も元の親子関係が維持されること', () => {
            const id1 = manager.addShape({ text: '図形1' });
            const id2 = manager.addShape({ text: '図形2' });
            const id3 = manager.addShape({ text: '図形3' });
            
            manager.groupShapes(id1, id2);
            manager.groupShapes(id2, id3);
            
            // 循環を試みる
            manager.groupShapes(id3, id1);
            
            // 元の関係が維持されていること
            expect(manager.shapes.get(id2).parent).toBe(id1);
            expect(manager.shapes.get(id3).parent).toBe(id2);
            expect(manager.shapes.get(id1).parent).toBeNull();
        });

        it('自分自身をグループ化できないこと', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            const result = manager.groupShapes(id, id);
            
            expect(result).toBe(false);
        });

        it('存在しない図形のグループ化はfalseを返すこと', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            expect(manager.groupShapes('nonexistent', id)).toBe(false);
            expect(manager.groupShapes(id, 'nonexistent')).toBe(false);
        });
    });

    // 折りたたみ/展開機能のテスト（要件9.3, 9.4）
    describe('折りたたみ/展開機能', () => {
        it('親図形を折りたたむと子図形が非表示になること', () => {
            const parentId = manager.addShape({ text: '親' });
            const childId = manager.addShape({ text: '子' });
            manager.groupShapes(parentId, childId);
            
            const result = manager.toggleFold(parentId);
            
            expect(result).toBe(true);
            expect(manager.shapes.get(parentId).collapsed).toBe(true);
            expect(manager.shapes.get(childId).visible).toBe(false);
        });

        it('折りたたまれた親図形を展開すると子図形が再表示されること', () => {
            const parentId = manager.addShape({ text: '親' });
            const childId = manager.addShape({ text: '子' });
            manager.groupShapes(parentId, childId);
            
            // 折りたたみ
            manager.toggleFold(parentId);
            expect(manager.shapes.get(childId).visible).toBe(false);
            
            // 展開
            manager.toggleFold(parentId);
            expect(manager.shapes.get(parentId).collapsed).toBe(false);
            expect(manager.shapes.get(childId).visible).toBe(true);
        });

        it('子要素がない図形は折りたたみできないこと', () => {
            const id = manager.addShape({ text: 'テスト' });
            
            const result = manager.toggleFold(id);
            
            expect(result).toBe(false);
        });

        it('存在しない図形の折りたたみはfalseを返すこと', () => {
            const result = manager.toggleFold('nonexistent');
            expect(result).toBe(false);
        });

        it('ネストされた子図形も折りたたみ時に非表示になること', () => {
            const grandparentId = manager.addShape({ text: '祖父' });
            const parentId = manager.addShape({ text: '親' });
            const childId = manager.addShape({ text: '子' });
            
            manager.groupShapes(grandparentId, parentId);
            manager.groupShapes(parentId, childId);
            
            // 祖父を折りたたむ
            manager.toggleFold(grandparentId);
            
            expect(manager.shapes.get(parentId).visible).toBe(false);
            expect(manager.shapes.get(childId).visible).toBe(false);
        });

        it('折りたたまれた子グループを持つ親を展開しても、子グループの子は非表示のままであること', () => {
            const grandparentId = manager.addShape({ text: '祖父' });
            const parentId = manager.addShape({ text: '親' });
            const childId = manager.addShape({ text: '子' });
            
            manager.groupShapes(grandparentId, parentId);
            manager.groupShapes(parentId, childId);
            
            // 親を折りたたむ
            manager.toggleFold(parentId);
            expect(manager.shapes.get(childId).visible).toBe(false);
            
            // 祖父を折りたたむ
            manager.toggleFold(grandparentId);
            
            // 祖父を展開
            manager.toggleFold(grandparentId);
            
            // 親は表示されるが、親が折りたたまれているので子は非表示のまま
            expect(manager.shapes.get(parentId).visible).toBe(true);
            expect(manager.shapes.get(childId).visible).toBe(false);
        });
    });

    // 重なり回避機能のテスト（要件9.5）
    describe('重なり回避機能', () => {
        it('図形のサイズ変更時に下にある図形が移動すること', () => {
            // 上の図形
            const topId = manager.addShape({ text: '上', x: 100, y: 100, width: 120, height: 60 });
            // 下の図形（水平方向に重なりあり）
            const bottomId = manager.addShape({ text: '下', x: 100, y: 200, width: 120, height: 60 });
            
            const originalBottomY = manager.shapes.get(bottomId).y;
            
            // 上の図形のサイズを変更（高さを増加）
            manager.adjustLayout(topId, 0, 50);
            
            const newBottomY = manager.shapes.get(bottomId).y;
            expect(newBottomY).toBe(originalBottomY + 50);
        });

        it('ソースの下端より下にある図形はすべて垂直移動すること', () => {
            // 上の図形
            const topId = manager.addShape({ text: '上', x: 0, y: 100, width: 120, height: 60 });
            // 下の図形（水平方向に重なりなし、でも下端より下なので移動する）
            const bottomId = manager.addShape({ text: '下', x: 300, y: 200, width: 120, height: 60 });
            
            const originalBottomY = manager.shapes.get(bottomId).y;
            
            // 上の図形のサイズを変更
            manager.adjustLayout(topId, 0, 50);
            
            const newBottomY = manager.shapes.get(bottomId).y;
            // 下端（100 + 60 = 160）より下（200）にあるので移動する
            expect(newBottomY).toBe(originalBottomY + 50);
        });

        it('上にある図形は移動しないこと', () => {
            // 下の図形
            const bottomId = manager.addShape({ text: '下', x: 100, y: 200, width: 120, height: 60 });
            // 上の図形
            const topId = manager.addShape({ text: '上', x: 100, y: 50, width: 120, height: 60 });
            
            const originalTopY = manager.shapes.get(topId).y;
            
            // 下の図形のサイズを変更
            manager.adjustLayout(bottomId, 0, 50);
            
            const newTopY = manager.shapes.get(topId).y;
            expect(newTopY).toBe(originalTopY);
        });

        it('子要素は親と一緒に移動するため個別に移動しないこと', () => {
            const parentId = manager.addShape({ text: '親', x: 100, y: 100, width: 200, height: 150 });
            const childId = manager.addShape({ text: '子', x: 120, y: 130, width: 80, height: 40 });
            manager.groupShapes(parentId, childId);
            
            // 別の図形を上に配置
            const topId = manager.addShape({ text: '上', x: 100, y: 0, width: 120, height: 60 });
            
            const originalChildY = manager.shapes.get(childId).y;
            
            // 上の図形のサイズを変更
            manager.adjustLayout(topId, 0, 50);
            
            // 子要素は親がいるので個別には移動しない
            const newChildY = manager.shapes.get(childId).y;
            expect(newChildY).toBe(originalChildY);
        });

        it('図形のサイズ変更時に右にある図形が水平移動すること', () => {
            // 左の図形
            const leftId = manager.addShape({ text: '左', x: 100, y: 100, width: 120, height: 60 });
            // 右の図形（垂直方向に重なりあり）
            const rightId = manager.addShape({ text: '右', x: 300, y: 100, width: 120, height: 60 });
            
            const originalRightX = manager.shapes.get(rightId).x;
            
            // 左の図形のサイズを変更（幅を増加）
            manager.adjustLayout(leftId, 50, 0);
            
            const newRightX = manager.shapes.get(rightId).x;
            expect(newRightX).toBe(originalRightX + 50);
        });

        it('ソースの右端より右にある図形はすべて水平移動すること', () => {
            // 左の図形
            const leftId = manager.addShape({ text: '左', x: 100, y: 0, width: 120, height: 60 });
            // 右下の図形（垂直方向に重なりなし、でも右端より右なので移動する）
            const rightBottomId = manager.addShape({ text: '右下', x: 300, y: 200, width: 120, height: 60 });
            
            const originalRightX = manager.shapes.get(rightBottomId).x;
            
            // 左の図形のサイズを変更（幅を増加）
            manager.adjustLayout(leftId, 50, 0);
            
            const newRightX = manager.shapes.get(rightBottomId).x;
            // 右端（100 + 120 = 220）より右（300）にあるので移動する
            expect(newRightX).toBe(originalRightX + 50);
        });

        it('左にある図形は水平移動しないこと', () => {
            // 右の図形
            const rightId = manager.addShape({ text: '右', x: 300, y: 100, width: 120, height: 60 });
            // 左の図形
            const leftId = manager.addShape({ text: '左', x: 50, y: 100, width: 120, height: 60 });
            
            const originalLeftX = manager.shapes.get(leftId).x;
            
            // 右の図形のサイズを変更
            manager.adjustLayout(rightId, 50, 0);
            
            const newLeftX = manager.shapes.get(leftId).x;
            expect(newLeftX).toBe(originalLeftX);
        });

        it('折りたたみ時（負のdeltaY）に下にある図形が上に移動すること', () => {
            // 上の図形
            const topId = manager.addShape({ text: '上', x: 100, y: 100, width: 120, height: 60 });
            // 下の図形（水平方向に重なりあり）
            const bottomId = manager.addShape({ text: '下', x: 100, y: 200, width: 120, height: 60 });
            
            const originalBottomY = manager.shapes.get(bottomId).y;
            
            // 上の図形のサイズを縮小（高さを減少）
            manager.adjustLayout(topId, 0, -50);
            
            const newBottomY = manager.shapes.get(bottomId).y;
            expect(newBottomY).toBe(originalBottomY - 50);
        });

        it('折りたたみ時（負のdeltaX）に右にある図形が左に移動すること', () => {
            // 左の図形
            const leftId = manager.addShape({ text: '左', x: 100, y: 100, width: 120, height: 60 });
            // 右の図形（垂直方向に重なりあり）
            const rightId = manager.addShape({ text: '右', x: 300, y: 100, width: 120, height: 60 });
            
            const originalRightX = manager.shapes.get(rightId).x;
            
            // 左の図形のサイズを縮小（幅を減少）
            manager.adjustLayout(leftId, -50, 0);
            
            const newRightX = manager.shapes.get(rightId).x;
            expect(newRightX).toBe(originalRightX - 50);
        });

        it('ルートノードの展開時は他のルートノードのみ移動すること', () => {
            // ノード1: ルート（ノード2, ノード4の親）
            const node1Id = manager.addShape({ text: 'ノード1', x: 100, y: 100, width: 200, height: 150 });
            // ノード2: ノード1の子
            const node2Id = manager.addShape({ text: 'ノード2', x: 120, y: 130, width: 80, height: 40 });
            // ノード4: ノード1の子
            const node4Id = manager.addShape({ text: 'ノード4', x: 220, y: 130, width: 80, height: 40 });
            // ノード5: 独立（親子関係なし）
            const node5Id = manager.addShape({ text: 'ノード5', x: 400, y: 100, width: 120, height: 60 });
            
            manager.groupShapes(node1Id, node2Id);
            manager.groupShapes(node1Id, node4Id);
            
            const originalNode5X = manager.shapes.get(node5Id).x;
            
            // ノード1（ルート）のサイズを変更
            manager.adjustLayout(node1Id, 50, 0);
            
            // ノード5（ルート）は移動する
            const newNode5X = manager.shapes.get(node5Id).x;
            expect(newNode5X).toBe(originalNode5X + 50);
        });

        it('子ノードの展開時は同じ親を持つ兄弟ノードのみ移動すること', () => {
            // ノード1: ルート（ノード2, ノード4の親）
            const node1Id = manager.addShape({ text: 'ノード1', x: 100, y: 100, width: 300, height: 200 });
            // ノード2: ノード1の子、ノード3の親
            const node2Id = manager.addShape({ text: 'ノード2', x: 120, y: 130, width: 100, height: 80 });
            // ノード3: ノード2の子
            const node3Id = manager.addShape({ text: 'ノード3', x: 130, y: 150, width: 60, height: 30 });
            // ノード4: ノード1の子（ノード2の兄弟）
            const node4Id = manager.addShape({ text: 'ノード4', x: 280, y: 130, width: 80, height: 40 });
            // ノード5: 独立（親子関係なし）
            const node5Id = manager.addShape({ text: 'ノード5', x: 500, y: 100, width: 120, height: 60 });
            
            manager.groupShapes(node1Id, node2Id);
            manager.groupShapes(node1Id, node4Id);
            manager.groupShapes(node2Id, node3Id);
            
            const originalNode4X = manager.shapes.get(node4Id).x;
            const originalNode5X = manager.shapes.get(node5Id).x;
            
            // ノード2（子ノード）のサイズを変更
            manager.adjustLayout(node2Id, 50, 0);
            
            // ノード4（同じ親を持つ兄弟）は移動する
            const newNode4X = manager.shapes.get(node4Id).x;
            expect(newNode4X).toBe(originalNode4X + 50);
            
            // ノード5（独立ノード）は移動しない
            const newNode5X = manager.shapes.get(node5Id).x;
            expect(newNode5X).toBe(originalNode5X);
        });

        it('子ノードの展開時は異なる親を持つノードは移動しないこと', () => {
            // ノード1: ルート
            const node1Id = manager.addShape({ text: 'ノード1', x: 100, y: 100, width: 200, height: 150 });
            // ノード2: ノード1の子
            const node2Id = manager.addShape({ text: 'ノード2', x: 120, y: 130, width: 80, height: 40 });
            // 別のルートノード
            const otherRootId = manager.addShape({ text: '別ルート', x: 400, y: 100, width: 200, height: 150 });
            // 別ルートの子
            const otherChildId = manager.addShape({ text: '別子', x: 420, y: 130, width: 80, height: 40 });
            
            manager.groupShapes(node1Id, node2Id);
            manager.groupShapes(otherRootId, otherChildId);
            
            const originalOtherChildX = manager.shapes.get(otherChildId).x;
            
            // ノード2（子ノード）のサイズを変更
            manager.adjustLayout(node2Id, 50, 0);
            
            // 別の親を持つ子ノードは移動しない
            const newOtherChildX = manager.shapes.get(otherChildId).x;
            expect(newOtherChildX).toBe(originalOtherChildX);
        });
    });

    // エディタとの同期テスト
    describe('エディタとの同期', () => {
        it('見出しIDで図形を検索できること', () => {
            manager.addShape({ text: '見出し1', headingId: 'h1' });
            manager.addShape({ text: '見出し2', headingId: 'h2' });
            
            const shapes = manager.getShapes();
            const shape = shapes.find(s => s.headingId === 'h1');
            
            expect(shape).toBeDefined();
            expect(shape.text).toBe('見出し1');
        });

        it('見出しIDを持つ図形のテキストを更新できること', () => {
            const id = manager.addShape({ text: '元のテキスト', headingId: 'h1' });
            
            manager.updateShape(id, { text: '更新後のテキスト' });
            
            const shape = manager.shapes.get(id);
            expect(shape.text).toBe('更新後のテキスト');
            expect(shape.headingId).toBe('h1');
        });
    });
});
