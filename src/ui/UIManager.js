/**
 * UIインタラクションロジック
 * サイドバーの開閉やリサイズなどのUI操作を管理します。
 */
export class UIManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.toggleSidebarBtn = document.getElementById('toggleSidebar');
        this.resizer = document.getElementById('resizer');
        this.sidebarWidth = 250;
        this.isResizing = false;

        this.init();
    }

    init() {
        // 初期幅をCSS変数に適用
        this.sidebar.style.setProperty('--sidebar-width', `${this.sidebarWidth}px`);

        // サイドバーの切り替え
        this.toggleSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
            // クラスの付け替えのみでアニメーションさせるため、JSによるwidth操作は削除
        });

        // サイドバーのリサイズ（ポインター・タッチ・マウス対応）
        const startSidebarResize = (e) => {
            if (e.button !== 0) return;
            if (this.sidebar.classList.contains('collapsed')) return;
            this.isResizing = true;
            this.resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
            if (e.pointerId !== undefined) {
                this.resizer.setPointerCapture?.(e.pointerId);
            }
        };
        this.resizer.addEventListener('pointerdown', startSidebarResize);
        this.resizer.addEventListener('mousedown', startSidebarResize);

        // 垂直リサイズ（フローチャートとエディタの間、ポインター・タッチ・マウス対応）
        this.verticalResizer = document.getElementById('vertical-resizer');
        this.flowchartContainer = document.getElementById('flowchart-container');
        this.editorContainer = document.getElementById('editor-container');
        this.isVerticalResizing = false;

        const startVerticalResize = (e) => {
            if (e.button !== 0) return;
            if (this.flowchartContainer && this.flowchartContainer.classList.contains('collapsed')) return;
            this.isVerticalResizing = true;
            if (this.verticalResizer) {
                this.verticalResizer.classList.add('resizing');
                if (e.pointerId !== undefined) {
                    this.verticalResizer.setPointerCapture?.(e.pointerId);
                }
            }
            document.body.style.cursor = 'row-resize';
            e.preventDefault();
        };

        if (this.verticalResizer) {
            this.verticalResizer.addEventListener('pointerdown', startVerticalResize);
            this.verticalResizer.addEventListener('mousedown', startVerticalResize);
        }

        // 移動イベント（ポインター・マウス両対応）
        const handleMove = (e) => {
            // サイドバーリサイズ中
            if (this.isResizing) {
                const newWidth = Math.max(150, Math.min(500, e.clientX));
                this.sidebar.style.setProperty('--sidebar-width', `${newWidth}px`);
                this.sidebarWidth = newWidth;
            }

            // 垂直リサイズ中
            if (this.isVerticalResizing && this.flowchartContainer) {
                const containerRect = this.flowchartContainer.getBoundingClientRect();
                const containerTop = containerRect.top;
                const totalHeight = window.innerHeight;
                const maxAllowed = totalHeight - containerTop - 100;

                let newHeight = e.clientY - containerTop;
                newHeight = Math.max(100, Math.min(maxAllowed, newHeight));

                this.flowchartContainer.style.height = `${newHeight}px`;
                this.flowchartContainer.style.flexGrow = '0';
            }
        };

        document.addEventListener('pointermove', handleMove);
        document.addEventListener('mousemove', handleMove);

        // 終了イベント（ポインター・マウス両対応）
        const handleEnd = () => {
            let wasVertical = this.isVerticalResizing;
            if (this.isResizing) {
                this.isResizing = false;
                this.resizer.classList.remove('resizing');
                document.body.style.cursor = 'default';
            }
            if (this.isVerticalResizing) {
                this.isVerticalResizing = false;
                if (this.verticalResizer) {
                    this.verticalResizer.classList.remove('resizing');
                }
                document.body.style.cursor = 'default';
            }
            if (wasVertical) {
                window.dispatchEvent(new Event('resize'));
            }
        };

        document.addEventListener('pointerup', handleEnd);
        document.addEventListener('pointercancel', handleEnd);
        document.addEventListener('mouseup', handleEnd);
    }
}
