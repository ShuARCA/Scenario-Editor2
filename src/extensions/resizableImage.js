/**
 * Resizable Image Extension for Tiptap
 * 画像のリサイズ機能を提供するカスタム Node 拡張
 * 
 * 設計指針:
 * - StarterKitのImageを拡張
 * - ドラッグハンドル付きリサイズ UI を提供
 * - data-original-width属性でリサイズ後の幅を永続化
 */
import { Node, mergeAttributes } from 'tiptap';

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
                        originalWidth: img.getAttribute('data-original-width')
                    };
                }
            }
        ];
    },

    // HTMLへのレンダリング設定
    renderHTML({ HTMLAttributes }) {
        return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
    },

    // NodeViewの追加（リサイズハンドル付き）
    addNodeView() {
        return ({ node, getPos, editor }) => {
            // コンテナ要素
            const container = document.createElement('div');
            container.className = 'resizable-container';
            container.contentEditable = 'false';
            Object.assign(container.style, {
                position: 'relative',
                display: 'inline-block',
                margin: '10px'
            });

            // 画像要素
            const img = document.createElement('img');
            img.src = node.attrs.src;
            if (node.attrs.alt) img.alt = node.attrs.alt;
            if (node.attrs.title) img.title = node.attrs.title;
            img.style.display = 'block';

            // 初期幅の設定
            if (node.attrs.width) {
                img.style.width = `${node.attrs.width}px`;
                container.style.maxWidth = `${node.attrs.width}px`;
            } else {
                // 画像読み込み後に初期幅を設定
                img.onload = () => {
                    const initialWidth = Math.min(img.naturalWidth, this.options.maxWidth);
                    img.style.width = `${initialWidth}px`;
                    container.style.maxWidth = `${initialWidth}px`;

                    // ノードの属性を更新
                    if (typeof getPos === 'function') {
                        const pos = getPos();
                        if (pos !== undefined) {
                            editor.commands.updateAttributes('image', {
                                width: initialWidth,
                                originalWidth: initialWidth
                            });
                        }
                    }
                };
            }
            img.style.height = 'auto';

            // リサイズハンドル
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            Object.assign(handle.style, {
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '10px',
                height: '10px',
                backgroundColor: '#3b82f6',
                cursor: 'nwse-resize'
            });

            // リサイズ処理
            let isResizing = false;
            let startX, startWidth;

            const onMouseMove = (e) => {
                if (!isResizing) return;
                const newWidth = Math.max(50, startWidth + (e.clientX - startX));
                img.style.width = `${newWidth}px`;
                container.style.maxWidth = `${newWidth}px`;
            };

            const onMouseUp = () => {
                if (isResizing) {
                    isResizing = false;
                    const newWidth = parseInt(img.style.width, 10);

                    // ノードの属性を更新
                    if (typeof getPos === 'function') {
                        const pos = getPos();
                        if (pos !== undefined) {
                            const { tr } = editor.state;
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                width: newWidth,
                                originalWidth: newWidth
                            });
                            editor.view.dispatch(tr);
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
                startX = e.clientX;
                startWidth = img.offsetWidth;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            container.appendChild(img);
            container.appendChild(handle);

            return {
                dom: container,
                update: (updatedNode) => {
                    if (updatedNode.type.name !== 'image') {
                        return false;
                    }
                    img.src = updatedNode.attrs.src;
                    if (updatedNode.attrs.alt) img.alt = updatedNode.attrs.alt;
                    if (updatedNode.attrs.title) img.title = updatedNode.attrs.title;
                    if (updatedNode.attrs.width) {
                        img.style.width = `${updatedNode.attrs.width}px`;
                        container.style.maxWidth = `${updatedNode.attrs.width}px`;
                    }
                    return true;
                },
                destroy: () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }
            };
        };
    },

    // コマンドの追加
    addCommands() {
        return {
            /**
             * 画像を挿入する
             * @param {Object} options - { src, alt?, title?, width? }
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
            }
        };
    }
});

export default ResizableImage;
