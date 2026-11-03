/**
 * サイドバーレイヤー管理コントローラー
 * 
 * サイドバーの幅を400pxに拡張し、アウトラインツリーと連動した
 * イラストソフト風のレイヤー・表示非表示管理画面を提供します。
 * 
 * @module ui/HeadingVisibilityPopup
 */

import { TOGGLE_ICONS } from '../assets/icons/OutlineIcons.js';

const LAYER_VISIBILITY_ICONS = {
    // 表示時（文字色と同様）
    visible: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM214-281.5Q94-363 40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200q-146 0-266-81.5Z"/></svg>`,
    // 非表示時（ミュートのグレーアウトカラー）
    hidden: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M792-56 624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM480-320q11 0 20.5-1t20.5-4L305-541q-3 11-4 20.5t-1 20.5q0 75 52.5 127.5T480-320Zm292 18L645-428q7-17 11-34.5t4-37.5q0-75-52.5-127.5T480-680q-20 0-37.5 4T408-664L306-766q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302ZM587-486 467-606q28-5 51.5 4.5T559-574q17 18 24.5 41.5T587-486Z"/></svg>`
};

/**
 * フローティングメニューと同一のH1〜H4見出しSVGアイコン
 */
const HEADING_LEVEL_ICONS = {
    1: `<svg class="icon" viewBox="0 -960 960 960"><path d="M200-280v-400h80v160h160v-160h80v400h-80v-160H280v160h-80Zm480 0v-320h-80v-80h160v400h-80Z"/></svg>`,
    2: `<svg class="icon" viewBox="0 -960 960 960"><path d="M120-280v-400h80v160h160v-160h80v400h-80v-160H200v160h-80Zm400 0v-160q0-33 23.5-56.5T600-520h160v-80H520v-80h240q33 0 56.5 23.5T840-600v80q0 33-23.5 56.5T760-440H600v80h240v80H520Z"/></svg>`,
    3: `<svg class="icon" viewBox="0 -960 960 960"><path d="M120-280v-400h80v160h160v-160h80v400h-80v-160H200v160h-80Zm400 0v-80h240v-80H600v-80h160v-80H520v-80h240q33 0 56.5 23.5T840-600v240q0 33-23.5 56.5T760-280H520Z"/></svg>`,
    4: `<svg class="icon" viewBox="0 -960 960 960"><path d="M120-280v-400h80v160h160v-160h80v400h-80v-160H200v160h-80Zm600 0v-120H520v-280h80v200h120v-200h80v200h80v80h-80v120h-80Z"/></svg>`
};

export class HeadingVisibilityPopup {
    /**
     * @param {Object} options
     * @param {import('../managers/HeadingVisibilityManager.js').HeadingVisibilityManager} options.visibilityManager
     * @param {import('../managers/OutlineManager.js').OutlineManager} options.outlineManager
     * @param {import('../flowchart/FlowchartApp.js').FlowchartApp} [options.flowchartApp]
     * @param {import('../core/EventBus.js').EventBus} options.eventBus
     */
    constructor({ visibilityManager, outlineManager, flowchartApp, eventBus }) {
        this.visibilityManager = visibilityManager;
        this.outlineManager = outlineManager;
        this.flowchartApp = flowchartApp || null;
        this.eventBus = eventBus;

        // DOM参照
        this.sidebar = document.getElementById('sidebar');
        this.triggerBtn = document.getElementById('outline-layer-mgr-btn');
        this.toolbar = document.getElementById('outline-layer-toolbar');
        this.batchSection = document.getElementById('layer-batch-section');
        this.batchHeader = document.getElementById('layer-batch-header');
        this.batchToggle = document.getElementById('layer-batch-toggle');
        this.batchList = document.getElementById('layer-batch-list');

        this.isOpen = false;
        this.isBatchCollapsed = false;
        this.savedSidebarWidth = null;
        this._locked = false;

        // OutlineManagerにフローチャート参照を登録
        if (this.outlineManager && this.flowchartApp) {
            this.outlineManager.setFlowchartApp(this.flowchartApp);
        }

        this._init();
    }

    /**
     * フローチャートコントローラーを設定します。
     * @param {import('../flowchart/FlowchartApp.js').FlowchartApp} flowchartApp
     */
    setFlowchartApp(flowchartApp) {
        this.flowchartApp = flowchartApp;
        if (this.outlineManager) {
            this.outlineManager.setFlowchartApp(flowchartApp);
        }
    }

    /**
     * イベントリスナーの初期化
     * @private
     */
    _init() {
        if (this.triggerBtn) {
            this.triggerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }

        // 一括操作セクションのヘッダークリック / トグルクリックで折りたたみ
        if (this.batchHeader) {
            this.batchHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleBatchSection();
            });
        }
        if (this.batchToggle) {
            this.batchToggle.innerHTML = TOGGLE_ICONS.expanded;
            this.batchToggle.title = '一括操作を折りたたむ';
            this.batchToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleBatchSection();
            });
        }

        // Escキーで閉じる
        document.addEventListener('keydown', (e) => {
            if (this.isOpen && e.key === 'Escape') {
                this.close();
            }
        });

        // UI同期イベントを監視してレベル別一括バーを最新化
        if (this.eventBus) {
            this.eventBus.on('heading:visibility:layer-ui-sync', () => {
                if (this.isOpen) {
                    this._renderLevelToolbar();
                }
            });

            // 見出し一覧の更新イベント（本文で見出し作成・削除された際）を監視してリアルタイム更新
            this.eventBus.on('outline:updated', () => {
                if (this.isOpen) {
                    this._renderLevelToolbar();
                }
            });
            this.eventBus.on('editor:update', () => {
                if (this.isOpen) {
                    this._renderLevelToolbar();
                }
            });

            // 編集ロック変更イベントを監視
            this.eventBus.on('lock:changed', (isLocked) => {
                this.setLocked(isLocked);
            });
        }
    }

    /**
     * 一括操作セクションの展開/折りたたみを切り替えます。
     * @param {boolean} [forceState]
     * @private
     */
    _toggleBatchSection(forceState) {
        if (typeof forceState === 'boolean') {
            this.isBatchCollapsed = forceState;
        } else {
            this.isBatchCollapsed = !this.isBatchCollapsed;
        }

        if (this.batchList) {
            this.batchList.classList.toggle('collapsed', this.isBatchCollapsed);
        }
        if (this.batchToggle) {
            this.batchToggle.innerHTML = this.isBatchCollapsed
                ? TOGGLE_ICONS.collapsed
                : TOGGLE_ICONS.expanded;
            this.batchToggle.title = this.isBatchCollapsed ? '一括操作を展開' : '一括操作を折りたたむ';
        }
    }

    /**
     * 編集ロック状態を設定します。
     * ロック時は開いているUIを閉じ、トリガーボタンを非表示にします。
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = !!locked;
        if (this._locked) {
            if (this.isOpen) {
                this.close();
            }
            if (this.triggerBtn) {
                this.triggerBtn.style.display = 'none';
            }
        } else {
            if (this.triggerBtn) {
                this.triggerBtn.style.display = '';
            }
        }
    }

    /**
     * レイヤー管理モードの表示/非表示を切り替えます。
     */
    toggle() {
        if (this._locked) return;
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * レイヤー管理モードを開始します（サイドバーを400pxに拡張）。
     */
    open() {
        if (this._locked || !this.sidebar) return;
        this.isOpen = true;

        // 1. 現在のサイドバー幅を退避（復元用）
        const computedWidth = this.sidebar.style.getPropertyValue('--sidebar-width') ||
            (this.sidebar.offsetWidth ? `${this.sidebar.offsetWidth}px` : '250px');
        this.savedSidebarWidth = computedWidth;

        // 2. サイドバーを400pxに拡張し、クラスを付与
        this.sidebar.classList.add('sidebar-layer-mode');
        this.sidebar.style.setProperty('--sidebar-width', '400px');

        if (this.triggerBtn) {
            this.triggerBtn.classList.add('active');
            this.triggerBtn.title = 'レイヤー管理モードを終了 (幅を復元)';
        }

        // 3. 上部ツールバーを表示
        if (this.toolbar) {
            this.toolbar.classList.remove('hidden');
        }

        // 4. アウトラインマネージャーをレイヤーモード（グレーアウト＆トグルボタン表示）へ切り替え
        if (this.outlineManager) {
            this.outlineManager.setLayerMode(true);
        }

        // 5. レベル別一括行（H1〜H4）を描画
        this._renderLevelToolbar();
    }

    /**
     * レイヤー管理モードを終了します（幅を復元し、非表示を反映）。
     */
    close() {
        if (!this.sidebar) return;
        this.isOpen = false;

        // 1. サイドバーからクラスを除去し、保存した幅を復元
        this.sidebar.classList.remove('sidebar-layer-mode');
        if (this.savedSidebarWidth) {
            this.sidebar.style.setProperty('--sidebar-width', this.savedSidebarWidth);
        }

        if (this.triggerBtn) {
            this.triggerBtn.classList.remove('active');
            this.triggerBtn.title = '表示・レイヤー管理';
        }

        // 2. 上部ツールバーを非表示
        if (this.toolbar) {
            this.toolbar.classList.add('hidden');
        }

        // 3. 「メニューを非表示とした時に非表示を反映させてください」
        // レイヤーモードをOFFにし、非表示項目をアウトライン上から完全に隠す（display: none）
        if (this.outlineManager) {
            this.outlineManager.setLayerMode(false);
        }
    }

    /**
     * レベル別一括切り替え行（H1〜H4）を描画します。
     * 各見出しと同じ見た目（.outline-item-row）で縦に並べ、
     * 右側のコントロール部（.outline-layer-controls）を下の見出し項目と全く同一の列で配置します。
     * @private
     */
    _renderLevelToolbar() {
        if (!this.batchList || !this.outlineManager) return;
        this.batchList.innerHTML = '';

        // トグルアイコンの初期化/同期
        if (this.batchToggle) {
            this.batchToggle.innerHTML = this.isBatchCollapsed
                ? TOGGLE_ICONS.collapsed
                : TOGGLE_ICONS.expanded;
            this.batchToggle.title = this.isBatchCollapsed ? '一括操作を展開' : '一括操作を折りたたむ';
        }

        const headings = this.outlineManager.getHeadings() || [];
        const levels = [1, 2, 3, 4];

        levels.forEach(level => {
            const levelHeadings = headings.filter(h => h.level === level);
            const hasHeadings = levelHeadings.length > 0;
            // 全員が非表示の場合のみ「非表示」アイコンを表示（一部非表示では連動しない）
            const allOutlineHidden = hasHeadings && levelHeadings.every(h => !this.visibilityManager.isOutlineVisible(h.id));
            const allNodeHidden = hasHeadings && levelHeadings.every(h => !this.visibilityManager.isFlowchartSelfVisible(h.id));

            // 行コンテナ（下の見出し項目と同じ .outline-item-row）
            const rowEl = document.createElement('div');
            rowEl.className = 'outline-item-row layer-batch-row';

            // 1. 見出し項目部 (.outline-item)
            const itemEl = document.createElement('div');
            itemEl.className = 'outline-item layer-batch-item';

            // 1-1. レベルアイコン (フローティングメニューと同一のH1〜H4 SVG)
            const iconEl = document.createElement('div');
            iconEl.className = 'outline-icon layer-batch-level-icon';
            iconEl.innerHTML = HEADING_LEVEL_ICONS[level] || '';
            itemEl.appendChild(iconEl);

            // 1-2. テキスト部
            const textEl = document.createElement('span');
            textEl.className = 'outline-text';
            textEl.textContent = `見出し${level}`;
            if (!hasHeadings) {
                rowEl.classList.add('is-empty');
                textEl.title = `ドキュメント内に H${level} の見出しがありません`;
                itemEl.classList.add('layer-batch-empty');
            }
            itemEl.appendChild(textEl);

            rowEl.appendChild(itemEl);

            // 2. レイヤー操作部 (.outline-layer-controls: 下の見出し項目と完全同一のクラス・構造)
            const controls = document.createElement('div');
            controls.className = 'outline-layer-controls';
            controls.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // 2-1. 目次一括ボタン
            const outlineBtn = document.createElement('button');
            outlineBtn.className = `outline-layer-btn outline-vis-btn ${allOutlineHidden ? 'is-hidden' : 'is-visible'}`;
            if (!hasHeadings) {
                outlineBtn.classList.add('is-disabled');
                outlineBtn.disabled = true;
                outlineBtn.title = `H${level} の見出しがありません`;
            } else {
                outlineBtn.title = allOutlineHidden ? `H${level} の目次を一括表示` : `H${level} の目次を一括非表示`;
            }
            outlineBtn.innerHTML = allOutlineHidden ? LAYER_VISIBILITY_ICONS.hidden : LAYER_VISIBILITY_ICONS.visible;
            outlineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!hasHeadings) return;
                const freshHeadings = this.outlineManager.getHeadings() || [];
                const freshLevelHeadings = freshHeadings.filter(h => h.level === level);
                // 全員が非表示なら表示に戻す、それ以外（全員表示 or 一部非表示）は全員非表示にする
                const isAllHidden = freshLevelHeadings.length > 0 && freshLevelHeadings.every(h => !this.visibilityManager.isOutlineVisible(h.id));
                this.visibilityManager.setLevelOutlineVisible(freshHeadings, level, isAllHidden);
                if (this.outlineManager) {
                    this.outlineManager.updateOutline();
                }
                this._renderLevelToolbar();
            });
            controls.appendChild(outlineBtn);

            // 2-2. ノード一括ボタン
            const nodeBtn = document.createElement('button');
            nodeBtn.className = `outline-layer-btn node-vis-btn ${allNodeHidden ? 'is-hidden' : 'is-visible'}`;
            if (!hasHeadings) {
                nodeBtn.classList.add('is-disabled');
                nodeBtn.disabled = true;
                nodeBtn.title = `H${level} の見出しがありません`;
            } else {
                nodeBtn.title = allNodeHidden ? `H${level} のノードを一括表示` : `H${level} のノードを一括非表示`;
            }
            nodeBtn.innerHTML = allNodeHidden ? LAYER_VISIBILITY_ICONS.hidden : LAYER_VISIBILITY_ICONS.visible;
            nodeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!hasHeadings) return;
                const freshHeadings = this.outlineManager.getHeadings() || [];
                const freshLevelHeadings = freshHeadings.filter(h => h.level === level);
                // 全員が非表示なら表示に戻す、それ以外（全員表示 or 一部非表示）は全員非表示にする
                const isAllHidden = freshLevelHeadings.length > 0 && freshLevelHeadings.every(h => !this.visibilityManager.isFlowchartSelfVisible(h.id));
                this.visibilityManager.setLevelFlowchartVisible(freshHeadings, level, isAllHidden);
                if (this.flowchartApp) {
                    this.flowchartApp.applyVisibility();
                }
                if (this.outlineManager) {
                    this.outlineManager.updateOutline();
                }
                this._renderLevelToolbar();
            });
            controls.appendChild(nodeBtn);

            rowEl.appendChild(controls);
            this.batchList.appendChild(rowEl);
        });
    }
}
