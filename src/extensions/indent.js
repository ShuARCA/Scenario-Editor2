
import { Extension } from 'tiptap';

export const Indent = Extension.create({
    name: 'indent',

    addOptions() {
        return {
            types: ['heading', 'paragraph'],
            indentLevels: [0, 1, 2, 3, 4, 5, 6, 7],
            defaultIndentLevel: 0,
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    indent: {
                        default: this.options.defaultIndentLevel,
                        renderHTML: attributes => {
                            if (!attributes.indent || attributes.indent === 0) {
                                return {};
                            }
                            return {
                                style: `margin-left: ${attributes.indent}em`,
                            };
                        },
                        parseHTML: element => {
                            const marginLeft = element.style.marginLeft;
                            if (!marginLeft) {
                                return this.options.defaultIndentLevel;
                            }
                            const value = parseInt(marginLeft, 10);
                            return isNaN(value) ? this.options.defaultIndentLevel : value;
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            indent: () => ({ tr, state, dispatch }) => {
                const { selection } = state;
                const { from, to } = selection;

                let applied = false;

                tr.doc.nodesBetween(from, to, (node, pos) => {
                    if (this.options.types.includes(node.type.name)) {
                        const currentIndent = node.attrs.indent || 0;
                        if (currentIndent < this.options.indentLevels.length - 1) {
                            if (dispatch) {
                                tr.setNodeMarkup(pos, null, {
                                    ...node.attrs,
                                    indent: currentIndent + 1,
                                });
                            }
                            applied = true;
                        }
                    }
                });

                return applied;
            },
            outdent: () => ({ tr, state, dispatch }) => {
                const { selection } = state;
                const { from, to } = selection;

                let applied = false;

                tr.doc.nodesBetween(from, to, (node, pos) => {
                    if (this.options.types.includes(node.type.name)) {
                        const currentIndent = node.attrs.indent || 0;
                        if (currentIndent > 0) {
                            if (dispatch) {
                                tr.setNodeMarkup(pos, null, {
                                    ...node.attrs,
                                    indent: currentIndent - 1,
                                });
                            }
                            applied = true;
                        }
                    }
                });

                return applied;
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Tab': () => {
                // リスト内であればデフォルトの挙動（ネスト）を優先
                if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList') || this.editor.isActive('taskList')) {
                    return this.editor.commands.sinkListItem('listItem') || this.editor.commands.sinkListItem('taskItem');
                }
                return this.editor.commands.indent();
            },
            'Shift-Tab': () => {
                // リスト内であればデフォルトの挙動（ネスト解除）を優先
                if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList') || this.editor.isActive('taskList')) {
                    return this.editor.commands.liftListItem('listItem') || this.editor.commands.liftListItem('taskItem');
                }
                return this.editor.commands.outdent();
            },
        };
    },
});
