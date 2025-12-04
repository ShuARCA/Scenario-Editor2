/**
 * UIインタラクションロジック
 */

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
        // サイドバーの切り替え
        this.toggleSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.toggle('hidden');
            if (!this.sidebar.classList.contains('hidden')) {
                this.sidebar.style.width = `${this.sidebarWidth}px`;
            } else {
                this.sidebar.style.width = '0px';
            }
        });

        // サイドバーのリサイズ
        this.resizer.addEventListener('mousedown', (e) => {
            if (this.sidebar.classList.contains('hidden')) return;
            this.isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;
            const newWidth = Math.max(150, Math.min(500, e.clientX));
            this.sidebar.style.width = `${newWidth}px`;
            this.sidebarWidth = newWidth;
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;
                document.body.style.cursor = 'default';
            }
            if (this.isVerticalResizing) {
                this.isVerticalResizing = false;
                document.body.style.cursor = 'default';
            }
        });

        // 垂直リサイズ（フローチャートとエディタの間）
        this.verticalResizer = document.getElementById('vertical-resizer');
        this.flowchartContainer = document.getElementById('flowchart-container');
        this.editorContainer = document.getElementById('editor-container');
        this.isVerticalResizing = false;

        if (this.verticalResizer) {
            this.verticalResizer.addEventListener('mousedown', (e) => {
                this.isVerticalResizing = true;
                document.body.style.cursor = 'row-resize';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!this.isVerticalResizing) return;

                // ヘッダーの高さを考慮
                const headerHeight = 50;
                const containerTop = headerHeight;
                const totalHeight = window.innerHeight - headerHeight;

                let newHeight = e.clientY - containerTop;

                // 最小・最大サイズの制限
                newHeight = Math.max(100, Math.min(totalHeight - 100, newHeight));

                this.flowchartContainer.style.height = `${newHeight}px`;
                this.flowchartContainer.style.flexGrow = '0'; // flex-growを無効化して固定高さにする
                // エディタはflex-grow: 1なので自動的に残りのスペースを埋める
            });
        }
    }
}
