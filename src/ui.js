/**
 * UIインタラクションロジック
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
        });
    }
}
