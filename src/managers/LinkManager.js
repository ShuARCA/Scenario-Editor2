/**
 * リンク管理
 * 
 * URL/見出しリンクの挿入・編集・削除、リンクパネルを担当します。
 * 
 * @module managers/LinkManager
 */

import { PanelPositioner } from '../ui/PanelPositioner.js';
import { isValidUrl } from '../extensions/link.js';

/**
 * リンク管理クラス
 */
export class LinkManager {
    /**
     * LinkManagerのコンストラクタ
     * 
     * @param {Object} editorCore - EditorManagerまたはEditorCoreへの参照
     */
    constructor(editorCore) {
        /** @type {Object} エディタへの参照 */
        this.editor = editorCore;

        /** @type {PanelPositioner} 位置計算ユーティリティ */
        this.positioner = new PanelPositioner();

        /** @type {Object|null} 編集中のリンク情報（詳細） */
        this.existingLinkInfo = null;

        /** @type {Object|null} リンクパネル操作開始時の選択範囲 */
        this.savedLinkSelection = null;

        /** @type {string|null} 選択された見出しID */
        this.selectedHeadingId = null;

        /** @type {string|null} ポップアップで表示中のリンクID */
        this.currentPopupLinkId = null;

        // DOM参照
        this.linkPanel = document.getElementById('link-panel');
        this.linkInput = document.getElementById('link-input');
        this.linkTitleInput = document.getElementById('link-title-input');
        this.linkHeadingList = document.getElementById('link-heading-list');
        this.linkApplyBtn = document.getElementById('link-apply-btn');
        this.linkDeleteBtn = document.getElementById('link-delete-btn');
        this.linkBtn = document.getElementById('linkBtn');
        this.linkPopup = document.getElementById('link-popup');
        this.floatToolbar = document.getElementById('float-toolbar');

        /** @type {boolean} 編集ロック状態 */
        this._locked = false;
    }

    // =====================================================
    // 初期化
    // =====================================================

    /**
     * リンクパネルをセットアップします。
     */
    setupLinkPanel() {
        if (!this.linkPanel) return;

        // 適用ボタン
        if (this.linkApplyBtn) {
            this.linkApplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._applyLinkFromPanel();
            });
        }

        // 削除ボタン
        if (this.linkDeleteBtn) {
            this.linkDeleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this._deleteLinkFromPanel();
            });
        }

        // Enterキーで適用
        if (this.linkInput) {
            this.linkInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enterは改行などを許容する場合があるが今回は確定とする
                    e.preventDefault();
                    this._applyLinkFromPanel();
                } else if (e.key === 'Escape') {
                    this.hideLinkPanel();
                }
            });

            // 入力時に見出し候補を表示
            this.linkInput.addEventListener('input', () => {
                this._filterHeadings(this.linkInput.value);
            });
        }

        if (this.linkTitleInput) {
            this.linkTitleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._applyLinkFromPanel();
                } else if (e.key === 'Escape') {
                    this.hideLinkPanel();
                }
            });
        }

        // パネル外クリックで閉じる
        document.addEventListener('mousedown', (e) => {
            if (this.linkPanel &&
                !this.linkPanel.classList.contains('hidden') &&
                !this.linkPanel.contains(e.target) &&
                e.target !== this.linkBtn &&
                !this.linkBtn?.contains(e.target)) { // nullチェック追加
                this.hideLinkPanel();
            }
        });
    }

    /**
     * リンクホバー機能をセットアップします。
     */
    setupLinkHover() {
        const editorContainer = this.editor.editorContainer;
        if (!editorContainer) return;

        // リンクマーク（.link-markクラスまたはa[data-link-id]）へのホバー
        editorContainer.addEventListener('mouseover', (e) => {
            const linkMark = e.target.closest('a[data-link-id], .link-mark');
            if (linkMark) {
                this._showLinkPopup(linkMark);
            }
        });

        editorContainer.addEventListener('mouseout', (e) => {
            const linkMark = e.target.closest('a[data-link-id], .link-mark');
            if (linkMark) {
                setTimeout(() => {
                    if (!this.linkPopup?.matches(':hover')) {
                        this._hideLinkPopup();
                    }
                }, 300);
            }
        });

        // ポップアップからマウスが離れたら非表示
        if (this.linkPopup) {
            this.linkPopup.addEventListener('mouseleave', () => {
                this._hideLinkPopup();
            });

            // 編集ボタン
            const editBtn = this.linkPopup.querySelector('.link-popup-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (this.currentPopupLinkId) {
                        this._hideLinkPopup();
                        this._editLinkById(this.currentPopupLinkId);
                    }
                });
            }
        }

        // リンククリック処理
        editorContainer.addEventListener('click', (e) => {
            const linkMark = e.target.closest('a[data-link-id], .link-mark');
            if (linkMark && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this._handleLinkClick(linkMark);
            }
        });
    }

    // =====================================================
    // ロック制御
    // =====================================================

    /**
     * 編集ロック状態を設定します。
     * ロック中はリンク挿入/編集をブロックします。
     * ポップアップでのリンク先表示やCtrl+クリックジャンプは維持されます。
     * 
     * @param {boolean} locked - trueでロック、falseで解除
     */
    setLocked(locked) {
        this._locked = locked;
        if (locked) {
            this.hideLinkPanel();
        }
        // ポップアップ内の編集ボタンの表示/非表示
        if (this.linkPopup) {
            const editBtn = this.linkPopup.querySelector('.link-popup-edit-btn');
            if (editBtn) {
                editBtn.style.display = locked ? 'none' : '';
            }
        }
    }

    // =====================================================
    // リンク操作
    // =====================================================

    /**
     * リンクを挿入/編集します。
     */
    insertLink() {
        if (!this.editor.tiptap || this._locked) return;

        const { from, to, empty } = this.editor.tiptap.state.selection;

        // 選択範囲がない場合は何もしない（ただし、カーソル位置に新規挿入したい場合は別ロジックが必要だが、
        // 基本的にリンクはテキストに対して設定するため選択必須とする。空のaタグ挿入はUX的に微妙）
        if (empty) return;

        // 選択範囲を保存（パネル操作でフォーカスが外れるため）
        this.savedLinkSelection = { from, to };

        // 既存のリンクを検出
        const linkInfo = this.detectExistingLink();

        // 既存リンクがある場合、それを保持
        this.existingLinkInfo = linkInfo.allLinks.length > 0 ? linkInfo : null;

        this.showLinkPanel();
    }

    /**
     * 選択範囲内の既存リンクを検出します。
     * 
     * @returns {{firstLink: Object|null, allLinks: Array}}
     */
    detectExistingLink() {
        const result = {
            firstLink: null,
            allLinks: []
        };

        if (!this.editor.tiptap) return result;

        const { from, to } = this.editor.tiptap.state.selection;
        const { doc, schema } = this.editor.tiptap.state;
        const markType = schema.marks.link;

        if (!markType) return result; // linkマークが定義されていない場合

        doc.nodesBetween(from, to, (node, pos) => {
            if (node.isText && node.marks) {
                const linkMark = node.marks.find(m => m.type.name === 'link');
                if (linkMark) {
                    const linkData = {
                        linkId: linkMark.attrs.linkId,
                        href: linkMark.attrs.href || '',
                        title: linkMark.attrs.title || '', // 注: これはHTML title属性。表示テキストではない。
                        headingId: linkMark.attrs.headingId || '',
                        from: pos,
                        to: pos + node.nodeSize,
                        mark: linkMark
                    };
                    // 重複チェック
                    if (!result.allLinks.find(l => l.linkId === linkData.linkId)) {
                        result.allLinks.push(linkData);
                        if (!result.firstLink) {
                            result.firstLink = linkData;
                        }
                    }
                }
            }
        });

        return result;
    }

    /**
     * URLペースト時にリンクを挿入します。
     * 
     * @param {string} url - ペーストされたURL
     */
    insertLinkFromPaste(url) {
        if (!this.editor.tiptap) return;

        // http/httpsが無い場合は追加
        let href = url;
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
            href = 'https://' + href;
        }

        const { from, to, empty } = this.editor.tiptap.state.selection;

        if (!empty && from !== to) {
            // テキスト選択がある場合: 選択テキストにリンクを適用
            this.editor.tiptap.chain()
                .focus()
                .setLink({ href })
                .run();
        } else {
            // テキスト選択がない場合: URLをテキストとして挿入し、リンクを適用
            // ここでは一意なID生成などは Extension 側 (setLink) に任せるか、独自に生成する
            // Extension の setLink コマンドを使うのが一番安全
            this.editor.tiptap.chain()
                .focus()
                .insertContent(url)
                .setTextSelection({ from: from, to: from + url.length })
                .setLink({ href })
                .run();
        }
    }

    // =====================================================
    // パネル表示/非表示
    // =====================================================

    /**
     * リンクパネルを表示します。
     */
    showLinkPanel() {
        if (!this.linkPanel) return;

        // 初期化
        if (this.linkInput) this.linkInput.value = '';
        if (this.linkTitleInput) this.linkTitleInput.value = '';
        this.selectedHeadingId = null;

        // 既存リンクがある場合は編集モードとして値をセット
        if (this.existingLinkInfo && this.existingLinkInfo.firstLink) {
            const link = this.existingLinkInfo.firstLink;

            // 表示テキストの設定：保存された範囲のテキストを取得
            if (this.linkTitleInput) {
                const text = this._getLinkText(link.from, link.to);
                this.linkTitleInput.value = text;
            }

            if (link.headingId) {
                // 見出しリンク
                this.selectedHeadingId = link.headingId;
                if (this.linkInput) {
                    // 見出しテキストを取得して表示
                    const headings = this.editor.getHeadings?.() || [];
                    const heading = headings.find(h => h.id === link.headingId);
                    this.linkInput.value = heading?.text || link.headingId;
                }
            } else if (link.href) {
                // URLリンク
                if (this.linkInput) {
                    this.linkInput.value = link.href;
                }
            }

            if (this.linkDeleteBtn) {
                this.linkDeleteBtn.classList.remove('hidden');
            }
        } else {
            // 新規作成モード
            // 選択中のテキストを「表示テキスト」欄にセット
            if (this.savedLinkSelection && this.linkTitleInput) {
                const text = this._getLinkText(this.savedLinkSelection.from, this.savedLinkSelection.to);
                this.linkTitleInput.value = text;
            }

            if (this.linkDeleteBtn) {
                this.linkDeleteBtn.classList.add('hidden');
            }
        }

        // 見出し候補リストを初期化（非表示のまま）
        if (this.linkHeadingList) {
            this.linkHeadingList.classList.add('hidden');
            this.linkHeadingList.innerHTML = '';
        }

        // 位置計算
        const position = this._calculatePanelPosition();
        if (position) {
            this.linkPanel.style.top = `${position.top}px`;
            this.linkPanel.style.left = `${position.left}px`;
        }

        this.linkPanel.classList.remove('hidden');

        setTimeout(() => {
            this.linkInput?.focus();
        }, 10);
    }

    /**
     * リンクパネルを非表示にします。
     */
    hideLinkPanel() {
        if (this.linkPanel) {
            this.linkPanel.classList.add('hidden');
        }
        if (this.linkHeadingList) {
            this.linkHeadingList.classList.add('hidden');
        }
        this.existingLinkInfo = null;
        this.savedLinkSelection = null;
        this.selectedHeadingId = null;
    }

    // =====================================================
    // ボタン状態
    // =====================================================

    /**
     * リンクボタンの状態を更新します。
     */
    updateLinkButtonState() {
        if (!this.linkBtn) return;

        // ここでは単純に現在の選択範囲にリンクがあるかをチェック
        // detectExistingLink は負荷が高い可能性があるので、isActive を使う
        const isActive = this.editor.tiptap && this.editor.tiptap.isActive('link');

        if (isActive) {
            this.linkBtn.classList.add('has-link'); // クラス名はCSSに合わせて調整
            this.linkBtn.classList.add('active');
        } else {
            this.linkBtn.classList.remove('has-link');
            this.linkBtn.classList.remove('active');
        }
    }

    // =====================================================
    // プライベートメソッド
    // =====================================================

    /**
     * パネル位置を計算します。
     * 
     * @returns {{top: number, left: number}|null}
     * @private
     */
    _calculatePanelPosition() {
        const panelWidth = 300;
        const panelHeight = 220; // 少し高さを確保

        // リンクボタンが表示されていればそこを基準に
        // ここでの this.floatToolbar の参照は constructor で取得している前提
        const isFloatToolbarVisible = this.floatToolbar && !this.floatToolbar.classList.contains('hidden');
        if (this.linkBtn && isFloatToolbarVisible) {
            return this.positioner.calculateFromAnchor(this.linkBtn, {
                offsetY: 8,
                panelWidth,
                panelHeight
            });
        }

        // ボタンがない場合は選択範囲から計算
        return this.positioner.calculateFromSelection({
            panelWidth,
            panelHeight
        });
    }

    /**
     * 見出しをフィルタリングして候補リストを更新します。
     * 
     * @param {string} query - 検索クエリ
     * @private
     */
    _filterHeadings(query) {
        if (!this.linkHeadingList) return;

        // URLっぽい文字列の場合はリストを非表示
        if (isValidUrl(query)) {
            this.linkHeadingList.classList.add('hidden');
            this.selectedHeadingId = null; // リストから選んでないので解除
            return;
        }

        const headings = this.editor.getHeadings?.() || [];
        const lowerQuery = query.toLowerCase().trim();

        const filteredHeadings = lowerQuery
            ? headings.filter(h => h.text.toLowerCase().includes(lowerQuery))
            : headings;

        if (filteredHeadings.length === 0) {
            this.linkHeadingList.classList.add('hidden');
            return;
        }

        this.linkHeadingList.innerHTML = '';
        filteredHeadings.forEach(heading => {
            const item = document.createElement('div');
            item.className = 'link-heading-item';

            // インデント表示
            item.style.paddingLeft = `${(heading.level - 1) * 12 + 8}px`;

            // 現在入力と完全一致または選択済みIDならハイライト
            if (heading.id === this.selectedHeadingId || heading.text === query) {
                item.classList.add('selected');
            }

            item.textContent = heading.text || '(無題)';

            item.addEventListener('click', () => {
                this.selectedHeadingId = heading.id;
                if (this.linkInput) {
                    this.linkInput.value = heading.text;
                }
                this.linkHeadingList.classList.add('hidden');
            });

            this.linkHeadingList.appendChild(item);
        });

        this.linkHeadingList.classList.remove('hidden');
    }

    /**
     * リンクパネルからリンクを適用します。
     * 
     * @private
     */
    _applyLinkFromPanel() {
        if (!this.linkInput || !this.editor.tiptap) return;

        const inputValue = this.linkInput.value.trim();
        const displayValue = this.linkTitleInput?.value.trim() || '';

        // 入力が空で、かつ見出し選択もなければキャンセル扱い、または削除
        if (!inputValue && !this.selectedHeadingId) {
            this.hideLinkPanel();
            return;
        }

        // 保存していた選択範囲を復元
        if (this.savedLinkSelection) {
            this.editor.tiptap.chain()
                .focus()
                .setTextSelection(this.savedLinkSelection)
                .run();
        }

        const attrs = {};

        // リンク先の設定
        if (this.selectedHeadingId) {
            // 見出しリンク（優先）
            attrs.headingId = this.selectedHeadingId;
        } else if (isValidUrl(inputValue)) {
            // URLリンク
            let href = inputValue;
            if (!href.startsWith('http://') && !href.startsWith('https://')) {
                href = 'https://' + href;
            }
            attrs.href = href;
        } else {
            // 入力値を見出しテキストとみなして検索（念のため）
            const headings = this.editor.getHeadings?.() || [];
            const exactMatch = headings.find(h => h.text === inputValue);
            if (exactMatch) {
                attrs.headingId = exactMatch.id;
            } else {
                // 有効なURLでも見出しでもない場合は、とりあえずhttpsをつけてURL扱いにするか、
                // エラーにするかだが、ユーザビリティ的にURL扱いにする
                attrs.href = 'https://' + inputValue;
            }
        }

        // 既存リンクの更新か、新規作成か
        const isUpdate = !!(this.existingLinkInfo && this.existingLinkInfo.firstLink);

        if (isUpdate) {
            const link = this.existingLinkInfo.firstLink;
            const linkId = link.linkId;
            const currentText = this._getLinkText(link.from, link.to);

            // 表示テキストを変更する場合
            if (displayValue && displayValue !== currentText) {
                // extensionの updateLinkText コマンドを使用
                this.editor.tiptap.chain()
                    .focus()
                    .updateLinkText(linkId, displayValue)
                    .run();
            }

            // 属性（リンク先）を更新
            this.editor.tiptap.chain()
                .focus()
                .updateLink(linkId, attrs)
                .run();

        } else {
            // 新規作成
            if (displayValue) {
                // 表示テキストが明示されている場合
                const sel = this.savedLinkSelection || this.editor.tiptap.state.selection;
                const currentSelText = this._getLinkText(sel.from, sel.to);

                // 選択中のテキストと入力された表示テキストが異なる場合、置換してからリンク
                if (displayValue !== currentSelText) {
                    this.editor.tiptap.chain()
                        .focus()
                        .deleteSelection()
                        .insertContent(displayValue)
                        .setTextSelection({ from: sel.from, to: sel.from + displayValue.length })
                        .setLink(attrs)
                        .run();
                } else {
                    // テキスト変更なし
                    this.editor.tiptap.chain()
                        .focus()
                        .setLink(attrs)
                        .run();
                }
            } else {
                // 表示テキスト空欄なら現在の選択範囲にそのまま適用
                this.editor.tiptap.chain()
                    .focus()
                    .setLink(attrs) // setLink内で linkId 生成
                    .run();
            }
        }

        this.hideLinkPanel();
    }

    /**
     * リンクパネルからリンクを削除します。
     * 
     * @private
     */
    _deleteLinkFromPanel() {
        if (this.existingLinkInfo && this.existingLinkInfo.allLinks.length > 0) {
            this.existingLinkInfo.allLinks.forEach(link => {
                if (link.linkId) {
                    this.editor.tiptap.chain()
                        .focus()
                        .removeLinkById(link.linkId)
                        .run();
                }
            });
        }
        this.hideLinkPanel();
    }

    /**
     * ID指定でリンクを編集します（ポップアップなどから呼ばれる）。
     * 
     * @param {string} linkId 
     * @private
     */
    _editLinkById(linkId) {
        if (!this.editor.tiptap) return;

        // 全リンク走査はコストがかかるが、ID検索のために必要
        const { doc } = this.editor.tiptap.state;
        let foundNode = null;
        let foundPos = -1;

        doc.descendants((node, pos) => {
            if (foundNode) return false;
            if (node.isText && node.marks) {
                const mark = node.marks.find(m => m.type.name === 'link' && m.attrs.linkId === linkId);
                if (mark) {
                    foundNode = node;
                    foundPos = pos;
                }
            }
        });

        if (foundNode && foundPos >= 0) {
            // 見つかったノードを選択
            const from = foundPos;
            const to = foundPos + foundNode.nodeSize;

            // 連続する同じLineIDのノードがあれば範囲を広げるべきだが、
            // ここでは簡易的に最初のノードを選択してパネルを開く
            this.editor.tiptap.chain()
                .focus()
                .setTextSelection({ from, to })
                .run();

            // 編集モードに入る
            this.insertLink();
        }
    }

    /**
     * リンクポップアップを表示します。
     * 
     * @param {HTMLElement} linkMark - リンク要素
     * @private
     */
    _showLinkPopup(linkMark) {
        if (!this.linkPopup) return;

        const href = linkMark.getAttribute('href');
        const headingId = linkMark.getAttribute('data-heading-id');
        const linkId = linkMark.getAttribute('data-link-id');

        this.currentPopupLinkId = linkId;

        let displayText = '';
        if (headingId) {
            const headings = this.editor.getHeadings?.() || [];
            const heading = headings.find(h => h.id === headingId);
            displayText = heading ? `→ ${heading.text}` : '(リンク切れ)';
        } else if (href) {
            displayText = href;
        }

        const textEl = this.linkPopup.querySelector('.link-popup-text');
        if (textEl) {
            textEl.textContent = displayText;
        }

        const rect = linkMark.getBoundingClientRect();
        this.linkPopup.style.top = `${rect.bottom + 2 + window.scrollY}px`;
        this.linkPopup.style.left = `${rect.left + window.scrollX}px`;
        this.linkPopup.classList.remove('hidden');
    }

    /**
     * リンクポップアップを非表示にします。
     * 
     * @private
     */
    _hideLinkPopup() {
        // マウスがポップアップ上にある場合は閉じない（安全策）
        if (this.linkPopup && this.linkPopup.matches(':hover')) return;

        if (this.linkPopup) {
            this.linkPopup.classList.add('hidden');
        }
        this.currentPopupLinkId = null;
    }

    /**
     * リンククリック処理を行います。
     * 
     * @param {HTMLElement} linkMark - リンク要素
     * @private
     */
    _handleLinkClick(linkMark) {
        const href = linkMark.getAttribute('href');
        const headingId = linkMark.dataset.headingId;

        if (headingId) {
            // 見出しリンク：その見出しにスクロール
            this.editor.scrollToHeading?.(headingId);
        } else if (href) {
            // URLリンク：新しいタブで開く
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * 無効な見出しリンクをチェックして解除します。
     */
    checkBrokenHeadingLinks() {
        if (!this.editor.tiptap) return;

        const headings = this.editor.getHeadings?.() || [];
        const validIds = new Set(headings.map(h => h.id));

        const brokenLinkIds = [];

        this.editor.tiptap.state.doc.descendants((node, pos) => {
            if (node.isText && node.marks) {
                const linkMark = node.marks.find(m => m.type.name === 'link');
                if (linkMark && linkMark.attrs.headingId && !validIds.has(linkMark.attrs.headingId)) {
                    if (!brokenLinkIds.includes(linkMark.attrs.headingId)) {
                        brokenLinkIds.push(linkMark.attrs.headingId);
                    }
                }
            }
        });

        if (brokenLinkIds.length > 0) {
            brokenLinkIds.forEach(hid => {
                this.editor.tiptap.chain()
                    .removeLinksToHeading(hid)
                    .run();
            });
        }
    }

    /**
     * 指定範囲のテキストを取得します。
     * 
     * @param {number} from 
     * @param {number} to 
     * @returns {string}
     * @private
     */
    _getLinkText(from, to) {
        if (!this.editor.tiptap) return '';
        return this.editor.tiptap.state.doc.textBetween(from, to, ' ');
    }
}
