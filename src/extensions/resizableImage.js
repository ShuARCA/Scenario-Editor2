/**
 * Resizable Image Extension for Tiptap
 * 画像のリサイズ機能を提供するカスタム Node 拡張
 * 
 * 設計指針:
 * - StarterKitのImageを拡張
 * - 4隅ドラッグハンドル付きリサイズ UI を提供
 * - 配置（左/中央/右）とfloat（段組み）機能をサポート
 * - data-original-width属性でリサイズ後の幅を永続化
 */
import { Node, mergeAttributes } from 'tiptap';

// ========================================
// ヘルパー関数（NodeView外で定義）
// ========================================

/**
 * 配置とfloat用のCSSクラスを適用
 */
function applyAlignmentClasses(container, attrs) {
    container.classList.remove('align-left', 'align-center', 'align-right', 'float-enabled');

    const alignment = attrs.alignment || 'left';
    const floatEnabled = attrs.floatEnabled && alignment !== 'center';

    container.classList.add(`align-${alignment}`);
    if (floatEnabled) {
        container.classList.add('float-enabled');
    }
}

// ========================================
// ResizableImage Extension
// ========================================

export const ResizableImage = Node.create({
    name: 'image',

    // ブロック要素
    group: 'block',

    // コンテンツなし（リーフノード）
    atom: true,

    // ドラッグ可能
    draggable: true,

    // オプション
    addOptions() {
        return {
            inline: false,
            allowBase64: true,
            HTMLAttributes: {},
            maxWidth: 800
        };
    },

    // 属性の追加
    addAttributes() {
        return {
            src: {
                default: null
            },
            alt: {
                default: null
            },
            title: {
                default: null
            },
            width: {
                default: null,
                parseHTML: element => {
                    const width = element.style.width || element.getAttribute('width');
                    return width ? parseInt(width, 10) : null;
                },
                renderHTML: attributes => {
                    if (!attributes.width) {
                        return {};
                    }
                    return {
                        style: `width: ${attributes.width}px`
                    };
                }
            },
            originalWidth: {
                default: null,
                parseHTML: element => element.getAttribute('data-original-width'),
                renderHTML: attributes => {
                    if (!attributes.originalWidth) {
                        return {};
                    }
                    return {
                        'data-original-width': attributes.originalWidth
                    };
                }
            },
            // 配置属性（left/center/right）
            alignment: {
                default: 'left',
                parseHTML: element => element.getAttribute('data-alignment') || 'left',
                renderHTML: attributes => {
                    return {
                        'data-alignment': attributes.alignment || 'left'
                    };
                }
            },
            // 段組み有効/無効
            floatEnabled: {
                default: false,
                parseHTML: element => element.getAttribute('data-float-enabled') === 'true',
                renderHTML: attributes => {
                    return {
                        'data-float-enabled': attributes.floatEnabled ? 'true' : 'false'
                    };
                }
            }
        };
    },

    // HTMLからのパース設定
    parseHTML() {
        return [
            {
                tag: 'img[src]'
            },
            {
                // 既存のリサイズコンテナもパース
                tag: 'div.resizable-container',
                getAttrs: element => {
                    const img = element.querySelector('img');
                    if (!img) return false;
                    return {
                        src: img.getAttribute('src'),
                        alt: img.getAttribute('alt'),
                        title: img.getAttribute('title'),
                        width: img.style.width ? parseInt(img.style.width, 10) : null,
                        originalWidth: img.getAttribute('data-original-width'),
                        alignment: element.getAttribute('data-alignment') || 'left',
                        floatEnabled: element.getAttribute('data-float-enabled') === 'true'
                    };
                }
            }
        ];
    },

    // HTMLへのレンダリング設定
    renderHTML({ HTMLAttributes }) {
        return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
    },

    // NodeViewの追加（4隅リサイズハンドル付き）
    addNodeView() {
        const maxWidth = this.options.maxWidth;

        return ({ node, getPos, editor }) => {
            // コンテナ要素
            const container = document.createElement('div');
            container.className = 'resizable-container';
            container.contentEditable = 'false';

            // 配置・float クラスを適用
            applyAlignmentClasses(container, node.attrs);

            // 画像要素
            const img = document.createElement('img');
            img.src = node.attrs.src;
            if (node.attrs.alt) img.alt = node.attrs.alt;
            if (node.attrs.title) img.title = node.attrs.title;
            img.style.display = 'block';
            img.style.height = 'auto';
            img.style.maxWidth = '100%';

            // 初期幅の設定
            if (node.attrs.width) {
                img.style.width = `${node.attrs.width}px`;
                container.style.width = `${node.attrs.width}px`;
            } else {
                // 画像読み込み後に初期幅を設定
                img.onload = () => {
                    if (!img.style.width || img.style.width === 'auto') {
                        const initialWidth = Math.min(img.naturalWidth, maxWidth);
                        img.style.width = `${initialWidth}px`;
                        container.style.width = `${initialWidth}px`;

                        // ノードの属性を更新（トランザクション使用）
                        if (typeof getPos === 'function') {
                            const pos = getPos();
                            if (pos !== undefined && pos !== null) {
                                try {
                                    const { tr } = editor.state;
                                    const currentNode = editor.state.doc.nodeAt(pos);
                                    if (currentNode && currentNode.type.name === 'image') {
                                        tr.setNodeMarkup(pos, undefined, {
                                            ...currentNode.attrs,
                                            width: initialWidth,
                                            originalWidth: initialWidth
                                        });
                                        editor.view.dispatch(tr);
                                    }
                                } catch (e) {
                                    console.warn('Failed to update initial image width:', e);
                                }
                            }
                        }
                    }
                };
            }

            // 4隅リサイズハンドルを作成
            const positions = ['nw', 'ne', 'sw', 'se'];
            const handles = [];

            positions.forEach(posName => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${posName}`;

                let isResizing = false;
                let startX, startWidth;

                const onMouseMove = (e) => {
                    if (!isResizing) return;
                    e.preventDefault();

                    let deltaX = e.clientX - startX;

                    // ハンドル位置に応じて計算方向を調整
                    if (posName === 'nw' || posName === 'sw') {
                        deltaX = -deltaX;
                    }

                    // 新しい幅を計算
                    const newWidth = Math.max(50, startWidth + deltaX);

                    // リアルタイムで画像とコンテナのサイズを更新
                    img.style.width = `${newWidth}px`;
                    container.style.width = `${newWidth}px`;
                };

                const onMouseUp = () => {
                    if (isResizing) {
                        isResizing = false;
                        container.classList.remove('resizing');

                        const newWidth = parseInt(img.style.width, 10);

                        // ノードの属性を更新
                        if (typeof getPos === 'function') {
                            const nodePos = getPos();
                            if (nodePos !== undefined && nodePos !== null) {
                                try {
                                    const { tr } = editor.state;
                                    const currentNode = editor.state.doc.nodeAt(nodePos);
                                    if (currentNode && currentNode.type.name === 'image') {
                                        tr.setNodeMarkup(nodePos, undefined, {
                                            ...currentNode.attrs,
                                            width: newWidth,
                                            originalWidth: newWidth
                                        });
                                        editor.view.dispatch(tr);
                                    }
                                } catch (e) {
                                    console.warn('Failed to update image width:', e);
                                }
                            }
                        }
                    }
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                handle.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isResizing = true;
                    container.classList.add('resizing');
                    startX = e.clientX;
                    startWidth = img.offsetWidth;
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });

                handles.push({
                    element: handle,
                    cleanup: () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    }
                });
            });

            container.appendChild(img);
            handles.forEach(h => container.appendChild(h.element));

            // クリック時に選択状態を示す
            container.addEventListener('click', (e) => {
                e.stopPropagation();
                container.classList.add('selected');
            });

            // 選択解除
            const handleDocClick = (e) => {
                if (!container.contains(e.target)) {
                    container.classList.remove('selected');
                }
            };
            document.addEventListener('click', handleDocClick);

            return {
                dom: container,
                update: (updatedNode) => {
                    if (updatedNode.type.name !== 'image') {
                        return false;
                    }

                    // 属性更新
                    if (img.src !== updatedNode.attrs.src) {
                        img.src = updatedNode.attrs.src;
                    }
                    if (updatedNode.attrs.alt) img.alt = updatedNode.attrs.alt;
                    if (updatedNode.attrs.title) img.title = updatedNode.attrs.title;

                    // 幅の更新
                    if (updatedNode.attrs.width) {
                        img.style.width = `${updatedNode.attrs.width}px`;
                        container.style.width = `${updatedNode.attrs.width}px`;
                    }

                    // 配置・floatクラスを更新
                    applyAlignmentClasses(container, updatedNode.attrs);
                    return true;
                },
                destroy: () => {
                    handles.forEach(h => h.cleanup());
                    document.removeEventListener('click', handleDocClick);
                }
            };
        };
    },

    // コマンドの追加
    addCommands() {
        return {
            /**
             * 画像を挿入する
             * @param {Object} options - { src, alt?, title?, width?, alignment?, floatEnabled? }
             */
            setImage: (options) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: options
                });
            },
            /**
             * 画像をリサイズする
             * @param {number} width - 新しい幅
             */
            resizeImage: (width) => ({ commands }) => {
                return commands.updateAttributes(this.name, {
                    width,
                    originalWidth: width
                });
            },
            /**
             * 画像の配置を設定する
             * @param {string} alignment - 'left', 'center', 'right'
             */
            setImageAlignment: (alignment) => ({ commands }) => {
                // 中央揃えの場合はfloatを自動で無効化
                const attrs = { alignment };
                if (alignment === 'center') {
                    attrs.floatEnabled = false;
                }
                return commands.updateAttributes(this.name, attrs);
            },
            /**
             * 画像の段組みを切り替える
             * @param {boolean} enabled - 有効/無効
             */
            toggleImageFloat: (enabled) => ({ commands }) => {
                return commands.updateAttributes(this.name, {
                    floatEnabled: enabled
                });
            }
        };
    }
});

export default ResizableImage;
