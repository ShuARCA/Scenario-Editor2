/**
 * 接続線機能のプロパティベーステスト
 * 
 * **Feature: iedit-web-core, Property 12: 接続線作成の正確性**
 * **検証対象: 要件 8.1**
 * 
 * 任意の2つの図形に対して、接続線作成後は両図形間に接続線が存在する
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * FlowchartDataManagerのテスト用実装
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
        const id = shapeData.id || `shape-${Math.random().toString(36).substr(2, 9)}`;
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
            folded: shapeData.folded || false
        };
        this.shapes.set(id, shape);
        return id;
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
     * 全接続線を取得します
     * @returns {Array<Object>} 接続線データの配列
     */
    getConnections() {
        return [...this.connections];
    }

    /**
     * 2つの図形間に接続線が存在するかを確認します
     * @param {string} fromId - 接続元図形ID
     * @param {string} toId - 接続先図形ID
     * @returns {boolean} 接続線が存在する場合true
     */
    hasConnection(fromId, toId) {
        return this.connections.some(c => c.from === fromId && c.to === toId);
    }

    /**
     * 図形が存在するかを確認します
     * @param {string} shapeId - 図形ID
     * @returns {boolean} 図形が存在する場合true
     */
    hasShape(shapeId) {
        return this.shapes.has(shapeId);
    }
}

// カスタムArbitrary: 図形データ生成
const shapeDataArb = fc.record({
    text: fc.string({ minLength: 1, maxLength: 50 }),
    x: fc.integer({ min: 0, max: 2000 }),
    y: fc.integer({ min: 0, max: 2000 }),
    width: fc.integer({ min: 50, max: 300 }),
    height: fc.integer({ min: 30, max: 200 })
});

// カスタムArbitrary: 接続ポイント
const connectionPointArb = fc.constantFrom('top', 'bottom', 'left', 'right');

// カスタムArbitrary: 接続線スタイル
const connectionStyleArb = fc.record({
    color: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
    type: fc.constantFrom('solid', 'dashed'),
    arrow: fc.constantFrom('none', 'end', 'start', 'both'),
    label: fc.string({ maxLength: 30 })
});

describe('Property 12: 接続線作成の正確性', () => {
    /**
     * **Feature: iedit-web-core, Property 12: 接続線作成の正確性**
     * **Validates: Requirements 8.1**
     * 
     * 任意の2つの図形に対して、接続線作成後は両図形間に接続線が存在する
     */
    it('任意の2つの図形に対して、接続線作成後は両図形間に接続線が存在する', () => {
        fc.assert(
            fc.property(
                // 2つの図形データを生成
                shapeDataArb,
                shapeDataArb,
                // 接続ポイントを生成
                connectionPointArb,
                connectionPointArb,
                (shape1Data, shape2Data, fromPoint, toPoint) => {
                    // Arrange: FlowchartDataManagerを初期化
                    const manager = new FlowchartDataManager();
                    
                    // 2つの図形を追加
                    const shape1Id = manager.addShape(shape1Data);
                    const shape2Id = manager.addShape(shape2Data);
                    
                    // 両方の図形が存在することを確認（前提条件）
                    expect(manager.hasShape(shape1Id)).toBe(true);
                    expect(manager.hasShape(shape2Id)).toBe(true);
                    
                    // Act: 接続線を作成
                    const connId = manager.addConnection({
                        from: shape1Id,
                        to: shape2Id,
                        fromPoint: fromPoint,
                        toPoint: toPoint
                    });
                    
                    // Assert: 接続線が存在することを確認
                    expect(connId).toBeDefined();
                    expect(manager.hasConnection(shape1Id, shape2Id)).toBe(true);
                    
                    // 接続線の詳細を確認
                    const connections = manager.getConnections();
                    const createdConn = connections.find(c => c.id === connId);
                    
                    expect(createdConn).toBeDefined();
                    expect(createdConn.from).toBe(shape1Id);
                    expect(createdConn.to).toBe(shape2Id);
                    expect(createdConn.fromPoint).toBe(fromPoint);
                    expect(createdConn.toPoint).toBe(toPoint);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 接続線作成後、接続線の数が1増加することを確認
     */
    it('接続線作成後、接続線の数が1増加する', () => {
        fc.assert(
            fc.property(
                shapeDataArb,
                shapeDataArb,
                // 既存の接続線数（0〜10）
                fc.integer({ min: 0, max: 10 }),
                (shape1Data, shape2Data, existingConnCount) => {
                    // Arrange
                    const manager = new FlowchartDataManager();
                    
                    // 図形を追加
                    const shape1Id = manager.addShape(shape1Data);
                    const shape2Id = manager.addShape(shape2Data);
                    
                    // 既存の接続線を追加（同じ図形間に複数の接続線を許可）
                    for (let i = 0; i < existingConnCount; i++) {
                        manager.addConnection({
                            from: shape1Id,
                            to: shape2Id
                        });
                    }
                    
                    const countBefore = manager.getConnections().length;
                    expect(countBefore).toBe(existingConnCount);
                    
                    // Act: 新しい接続線を作成
                    manager.addConnection({
                        from: shape1Id,
                        to: shape2Id
                    });
                    
                    // Assert: 接続線の数が1増加
                    const countAfter = manager.getConnections().length;
                    expect(countAfter).toBe(countBefore + 1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 接続線のスタイルが正しく保存されることを確認
     */
    it('接続線のスタイルが正しく保存される', () => {
        fc.assert(
            fc.property(
                shapeDataArb,
                shapeDataArb,
                connectionStyleArb,
                (shape1Data, shape2Data, style) => {
                    // Arrange
                    const manager = new FlowchartDataManager();
                    const shape1Id = manager.addShape(shape1Data);
                    const shape2Id = manager.addShape(shape2Data);
                    
                    // Act: スタイル付きの接続線を作成
                    const connId = manager.addConnection({
                        from: shape1Id,
                        to: shape2Id,
                        style: style
                    });
                    
                    // Assert: スタイルが保存されている
                    const connections = manager.getConnections();
                    const createdConn = connections.find(c => c.id === connId);
                    
                    expect(createdConn.style).toEqual(style);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 同じ図形間に複数の接続線を作成できることを確認
     */
    it('同じ図形間に複数の接続線を作成できる', () => {
        fc.assert(
            fc.property(
                shapeDataArb,
                shapeDataArb,
                fc.integer({ min: 2, max: 5 }),
                (shape1Data, shape2Data, connectionCount) => {
                    // Arrange
                    const manager = new FlowchartDataManager();
                    const shape1Id = manager.addShape(shape1Data);
                    const shape2Id = manager.addShape(shape2Data);
                    
                    // Act: 複数の接続線を作成
                    const connIds = [];
                    for (let i = 0; i < connectionCount; i++) {
                        const connId = manager.addConnection({
                            from: shape1Id,
                            to: shape2Id
                        });
                        connIds.push(connId);
                    }
                    
                    // Assert: すべての接続線が存在する
                    const connections = manager.getConnections();
                    expect(connections.length).toBe(connectionCount);
                    
                    // すべての接続線IDがユニーク
                    const uniqueIds = new Set(connIds);
                    expect(uniqueIds.size).toBe(connectionCount);
                    
                    // すべての接続線が正しい図形間を接続している
                    connections.forEach(conn => {
                        expect(conn.from).toBe(shape1Id);
                        expect(conn.to).toBe(shape2Id);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 双方向の接続線を作成できることを確認
     */
    it('双方向の接続線を作成できる', () => {
        fc.assert(
            fc.property(
                shapeDataArb,
                shapeDataArb,
                (shape1Data, shape2Data) => {
                    // Arrange
                    const manager = new FlowchartDataManager();
                    const shape1Id = manager.addShape(shape1Data);
                    const shape2Id = manager.addShape(shape2Data);
                    
                    // Act: 双方向の接続線を作成
                    manager.addConnection({ from: shape1Id, to: shape2Id });
                    manager.addConnection({ from: shape2Id, to: shape1Id });
                    
                    // Assert: 両方向の接続線が存在する
                    expect(manager.hasConnection(shape1Id, shape2Id)).toBe(true);
                    expect(manager.hasConnection(shape2Id, shape1Id)).toBe(true);
                    expect(manager.getConnections().length).toBe(2);
                }
            ),
            { numRuns: 100 }
        );
    });
});
