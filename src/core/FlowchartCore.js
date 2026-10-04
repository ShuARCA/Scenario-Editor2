/**
 * フローチャートコア
 * 
 * フローチャートの基本機能とシェイプ・接続線のデータ管理を担当します。
 * 各マネージャーはこのクラスへの参照を通じてフローチャートを操作します。
 * 
 * @module core/FlowchartCore
 */

import { generateId } from '../utils/helpers.js';
import { CONFIG } from './Config.js';

/**
 * フローチャートコアクラス
 * フローチャートの基本機能を提供します。
 */
export class FlowchartCore {
    /**
     * FlowchartCoreのコンストラクタ
     * 
     * @param {import('./EventBus.js').EventBus} eventBus - イベントバス
     */
    constructor(eventBus) {
        /** @type {import('./EventBus.js').EventBus} イベントバス */
        this.eventBus = eventBus;

        /** @type {Map<string, Object>} シェイプデータ */
        this.shapes = new Map();

        /** @type {Array<Object>} 接続線データ */
        this.connections = [];

        /** @type {string} 現在の操作モード */
        this.mode = 'select'; // 'select' | 'connect' | 'pan'

        /** @type {number} ズームレベル */
        this.zoomLevel = 1.0;

        // DOM参照
        this.container = null;
        this.canvas = null;
        this.shapesLayer = null;
        this.connectionsLayer = null;
        this.canvasContent = null;
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * フローチャートを初期化します。
     * 
     * @param {Object} [options={}] - オプション
     */
    init(options = {}) {
        // DOM要素の取得
        this.container = document.getElementById('flowchart-container');
        this.canvas = document.getElementById('flowchart-canvas');
        this.shapesLayer = document.getElementById('shapes-layer');
        this.connectionsLayer = document.getElementById('connections-layer');
        this.canvasContent = document.getElementById('canvas-content');
    }

    // =====================================================
    // シェイプ操作
    // =====================================================

    /**
     * シェイプを作成します。
     * 
     * @param {Object} data - シェイプデータ
     * @returns {Object} 作成されたシェイプ
     */
    createShape(data) {
        const id = data.id || generateId();
        const shape = {
            id: id,
            text: data.text || '',
            type: data.type || 'rounded',
            x: data.x ?? CONFIG.FLOWCHART.LAYOUT.START_X,
            y: data.y ?? CONFIG.FLOWCHART.LAYOUT.START_Y,
            width: data.width ?? CONFIG.FLOWCHART.SHAPE.WIDTH,
            height: data.height ?? CONFIG.FLOWCHART.SHAPE.HEIGHT,
            headingId: data.headingId || null,
            headingIndex: data.headingIndex,
            seen: data.seen ?? false,
            backgroundColor: data.backgroundColor || null,
            borderColor: data.borderColor || null,
            color: data.color || null,
            children: data.children || [],
            parent: data.parent || null,
            groupMode: data.groupMode || (data.collapsed ? 'overlay' : (CONFIG.FLOWCHART.LAYOUT?.GROUP_MODE_DEFAULT || 'inline')),
            overlaySize: data.overlaySize || null,
            overlayBounds: data.overlayBounds || null,  // overlayモード時の枠位置・サイズ（永続化）
            overlayOpen: data.overlayOpen ?? (data.collapsed === false ? true : false),  // overlay開閉状態（永続化）
            overlayStyle: data.overlayStyle || null,  // overlayキャンバスのスタイル（背景色・枠線色）
            element: null
        };

        this.shapes.set(id, shape);
        return shape;
    }

    /**
     * シェイプを更新します。
     * 
     * @param {string} id - シェイプID
     * @param {Object} data - 更新データ
     * @returns {Object|null} 更新されたシェイプ
     */
    updateShape(id, data) {
        const shape = this.shapes.get(id);
        if (!shape) return null;

        Object.assign(shape, data);
        return shape;
    }

    /**
     * シェイプを取得します。
     * 
     * @param {string} id - シェイプID
     * @returns {Object|null} シェイプデータ
     */
    getShape(id) {
        return this.shapes.get(id) || null;
    }

    /**
     * すべてのシェイプを取得します。
     * 
     * @returns {Map<string, Object>} シェイプマップ
     */
    getAllShapes() {
        return this.shapes;
    }

    /**
     * シェイプを削除します。
     * 
     * @param {string} id - シェイプID
     * @returns {boolean} 成功したかどうか
     */
    removeShape(id) {
        const shape = this.shapes.get(id);
        if (!shape) return false;

        // 関連する接続線を削除（親ノード自身およびオーバーレイ枠宛て）
        const overlayId = `overlay-area-${id}`;
        this.connections = this.connections.filter(c => 
            c.from !== id && c.to !== id && c.from !== overlayId && c.to !== overlayId
        );

        // DOM要素を削除
        if (shape.element) {
            shape.element.remove();
        }

        return this.shapes.delete(id);
    }

    // =====================================================
    // 接続線操作
    // =====================================================

    /**
     * 接続線を作成します。
     * 
     * @param {string} from - 開始シェイプID
     * @param {string} to - 終了シェイプID
     * @param {Object} [options={}] - オプション
     * @returns {Object} 作成された接続線
     */
    createConnection(from, to, options = {}) {
        const connection = {
            id: options.id || generateId('conn'),
            from: from,
            to: to,
            fromPoint: options.fromPoint || 'bottom',
            toPoint: options.toPoint || 'top',
            style: options.style || {
                type: 'solid',
                arrow: 'end',
                color: '#94a3b8'
            }
        };

        this.connections.push(connection);
        return connection;
    }

    /**
     * 接続線を取得します。
     * 
     * @param {string} id - 接続線ID
     * @returns {Object|null} 接続線データ
     */
    getConnection(id) {
        return this.connections.find(c => c.id === id) || null;
    }

    /**
     * すべての接続線を取得します。
     * 
     * @returns {Array<Object>} 接続線配列
     */
    getAllConnections() {
        return this.connections;
    }

    /**
     * 接続線を削除します。
     * 
     * @param {string} id - 接続線ID
     * @returns {boolean} 成功したかどうか
     */
    removeConnection(id) {
        const index = this.connections.findIndex(c => c.id === id);
        if (index === -1) return false;

        this.connections.splice(index, 1);
        return true;
    }

    // =====================================================
    // モード操作
    // =====================================================

    /**
     * 操作モードを設定します。
     * 
     * @param {string} mode - モード（'select', 'connect', 'pan'）
     */
    setMode(mode) {
        this.mode = mode;

        // ボタンのアクティブ状態を更新
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // キャンバスのクラスを更新
        if (this.canvas) {
            this.canvas.classList.toggle('panning', mode === 'pan');
            this.canvas.classList.toggle('connect-mode', mode === 'connect');
        }
    }

    /**
     * 現在のモードを取得します。
     * 
     * @returns {string} 現在のモード
     */
    getMode() {
        return this.mode;
    }

    // =====================================================
    // データ操作
    // =====================================================

    /**
     * フローチャートのデータを取得します。
     * 
     * @returns {Object} フローチャートデータ
     */
    getData() {
        const shapesData = {};
        this.shapes.forEach((shape, id) => {
            const { element, ...data } = shape;
            shapesData[id] = data;
        });

        return {
            shapes: shapesData,
            connections: this.connections.map(c => ({ ...c }))
        };
    }

    /**
     * フローチャートのデータを設定します。
     * 
     * @param {Object} data - フローチャートデータ
     */
    setData(data) {
        // 既存データをクリア
        this.shapes.clear();
        this.connections = [];

        const defaultGroupMode = CONFIG.FLOWCHART.LAYOUT?.GROUP_MODE_DEFAULT || 'inline';

        const migrateShape = (id, shapeData) => {
            let groupMode = shapeData.groupMode;
            if (!groupMode) {
                if (shapeData.collapsed === true) {
                    groupMode = 'overlay';
                } else {
                    groupMode = defaultGroupMode;
                }
            }
            const overlaySize = shapeData.overlaySize || (shapeData.width && shapeData.height ? { width: shapeData.width, height: shapeData.height } : null);
            const { collapsed, collapsedSize, expandedSize, ...cleanData } = shapeData;

            return {
                ...cleanData,
                id,
                groupMode,
                overlaySize,
                overlayBounds: shapeData.overlayBounds || null,  // overlay枠の位置・サイズを復元
                overlayOpen: shapeData.overlayOpen ?? (shapeData.collapsed === false ? true : false),  // overlay開閉状態を復元
                overlayStyle: shapeData.overlayStyle || null,  // overlayキャンバスのスタイルを復元
                element: null
            };
        };

        // シェイプを復元
        if (data.shapes) {
            if (Array.isArray(data.shapes)) {
                // 配列形式（Map.entries() からの保存）の場合
                data.shapes.forEach(([id, shapeData]) => {
                    if (id && shapeData) {
                        this.shapes.set(id, migrateShape(id, shapeData));
                    }
                });
            } else {
                // オブジェクト形式の場合
                Object.entries(data.shapes).forEach(([id, shapeData]) => {
                    this.shapes.set(id, migrateShape(id, shapeData));
                });
            }
        }

        // 接続線を復元
        if (data.connections) {
            this.connections = data.connections.map(c => ({ ...c }));
        }
    }

    /**
     * フローチャートをクリアします。
     */
    clear() {
        // DOM要素を削除
        this.shapes.forEach(shape => {
            if (shape.element) {
                shape.element.remove();
            }
        });

        this.shapes.clear();
        this.connections = [];
    }

    // =====================================================
    // ユーティリティ
    // =====================================================

    /**
     * シェイプのバウンディングボックスを計算します。
     * 
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null}
     */
    getBoundingBox() {
        if (this.shapes.size === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.shapes.forEach(shape => {
            minX = Math.min(minX, shape.x);
            minY = Math.min(minY, shape.y);
            maxX = Math.max(maxX, shape.x + shape.width);
            maxY = Math.max(maxY, shape.y + shape.height);
        });

        return { minX, minY, maxX, maxY };
    }

    /**
     * キャンバスサイズを更新します。
     */
    updateCanvasSize() {
        const box = this.getBoundingBox();
        if (!box || !this.canvasContent) return;

        const padding = 200;
        const width = Math.max(2000, box.maxX + padding);
        const height = Math.max(2000, box.maxY + padding);

        this.canvasContent.style.width = `${width}px`;
        this.canvasContent.style.height = `${height}px`;
    }
}
