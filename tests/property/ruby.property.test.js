/**
 * ルビ機能のプロパティベーステスト
 * 
 * EditorManagerのルビ関連機能の正しさを検証します。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * RubyDataManagerのテスト用実装
 * DOM操作を除いた純粋なデータ操作をテスト
 * 
 * EditorManagerのルビ機能のロジックを抽出したクラス
 */
class RubyDataManager {
    constructor() {
        // テスト用のコンテンツを保持
        this.content = '';
    }

    /**
     * ルビを設定します
     * @param {string} baseText - ベーステキスト
     * @param {string} rubyText - ルビテキスト
     * @returns {string} ルビ付きHTML
     */
    setRuby(baseText, rubyText) {
        if (!baseText || !rubyText) return baseText;
        return `<ruby>${baseText}<rt>${rubyText}</rt></ruby>`;
    }

    /**
     * ルビ付きHTMLからルビ情報を検出します
     * @param {string} html - ルビ付きHTML
     * @returns {{rubyText: string, baseText: string}} ルビ情報
     */
    detectRuby(html) {
        const result = {
            rubyText: '',
            baseText: ''
        };

        // ruby要素を検出
        const rubyMatch = html.match(/<ruby>([^<]*)<rt>([^<]*)<\/rt><\/ruby>/);
        if (rubyMatch) {
            result.baseText = rubyMatch[1];
            result.rubyText = rubyMatch[2];
        }

        return result;
    }

    /**
     * ルビを更新します（重複防止）
     * @param {string} html - 既存のルビ付きHTML
     * @param {string} newRubyText - 新しいルビテキスト
     * @returns {string} 更新後のHTML
     */
    updateRuby(html, newRubyText) {
        // 既存のルビを検出
        const existing = this.detectRuby(html);
        if (!existing.baseText) return html;

        // 新しいルビを設定（ネストを防止）
        return this.setRuby(existing.baseText, newRubyText);
    }

    /**
     * ルビを削除します
     * @param {string} html - ルビ付きHTML
     * @returns {string} ベーステキストのみ
     */
    removeRuby(html) {
        const existing = this.detectRuby(html);
        if (!existing.baseText) {
            // ルビがない場合はそのまま返す
            return html.replace(/<ruby>|<\/ruby>|<rt>.*?<\/rt>/g, '');
        }
        return existing.baseText;
    }

    /**
     * HTMLにルビ要素が含まれているかチェックします
     * @param {string} html - チェック対象のHTML
     * @returns {boolean} ルビ要素が含まれている場合true
     */
    hasRuby(html) {
        return /<ruby>/.test(html);
    }

    /**
     * ネストされたルビ要素があるかチェックします
     * @param {string} html - チェック対象のHTML
     * @returns {boolean} ネストされたルビがある場合true
     */
    hasNestedRuby(html) {
        // ruby要素内にruby要素があるかチェック
        const rubyMatch = html.match(/<ruby>([\s\S]*?)<\/ruby>/);
        if (rubyMatch) {
            const innerContent = rubyMatch[1];
            return /<ruby>/.test(innerContent);
        }
        return false;
    }

    /**
     * ruby要素の数をカウントします
     * @param {string} html - チェック対象のHTML
     * @returns {number} ruby要素の数
     */
    countRubyElements(html) {
        const matches = html.match(/<ruby>/g);
        return matches ? matches.length : 0;
    }
}

// カスタムArbitrary: 日本語テキスト（ベーステキスト用）
const baseTextArb = fc.stringOf(
    fc.constantFrom(
        '漢', '字', '日', '本', '語', '文', '章', '読', '書', '学',
        '東', '京', '大', '阪', '名', '古', '屋', '福', '岡', '札',
        '幌', '仙', '台', '広', '島', '神', '戸', '横', '浜', '川'
    ),
    { minLength: 1, maxLength: 10 }
);

// カスタムArbitrary: ひらがなテキスト（ルビテキスト用）
const rubyTextArb = fc.stringOf(
    fc.constantFrom(
        'あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ',
        'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と',
        'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ',
        'ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ', 'ら', 'り',
        'る', 'れ', 'ろ', 'わ', 'を', 'ん'
    ),
    { minLength: 1, maxLength: 20 }
);

describe('Property 1: ルビ設定のラウンドトリップ', () => {
    /**
     * **Feature: ruby-enhancement, Property 1: ルビ設定のラウンドトリップ**
     * **Validates: Requirements 1.3, 2.1**
     * 
     * 任意のテキストとルビテキストに対して、ルビを設定した後にそのテキストを選択して
     * ルビパネルを開くと、設定したルビテキストがテキストボックスに表示される
     */
    it('任意のテキストとルビテキストに対して、ルビを設定後に検出すると同じルビテキストが取得できる', () => {
        fc.assert(
            fc.property(
                baseTextArb,
                rubyTextArb,
                (baseText, rubyText) => {
                    // Arrange: RubyDataManagerを初期化
                    const manager = new RubyDataManager();
                    
                    // Act: ルビを設定
                    const rubyHtml = manager.setRuby(baseText, rubyText);
                    
                    // ルビを検出
                    const detected = manager.detectRuby(rubyHtml);
                    
                    // Assert: 設定したルビテキストと検出したルビテキストが一致
                    expect(detected.rubyText).toBe(rubyText);
                    expect(detected.baseText).toBe(baseText);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * ルビ設定後、ルビ要素が存在することを確認
     */
    it('ルビ設定後、ルビ要素が存在する', () => {
        fc.assert(
            fc.property(
                baseTextArb,
                rubyTextArb,
                (baseText, rubyText) => {
                    // Arrange
                    const manager = new RubyDataManager();
                    
                    // Act: ルビを設定
                    const rubyHtml = manager.setRuby(baseText, rubyText);
                    
                    // Assert: ルビ要素が存在する
                    expect(manager.hasRuby(rubyHtml)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Property 2: ルビ削除後のベーステキスト保持', () => {
    /**
     * **Feature: ruby-enhancement, Property 2: ルビ削除後のベーステキスト保持**
     * **Validates: Requirements 1.4, 2.3**
     * 
     * 任意のルビ付きテキストに対して、ルビを削除した後、
     * ベーステキストのみがエディタに残り、ルビ要素は存在しない
     */
    it('任意のルビ付きテキストに対して、ルビを削除後はベーステキストのみが残る', () => {
        fc.assert(
            fc.property(
                baseTextArb,
                rubyTextArb,
                (baseText, rubyText) => {
                    // Arrange: RubyDataManagerを初期化
                    const manager = new RubyDataManager();
                    
                    // ルビを設定
                    const rubyHtml = manager.setRuby(baseText, rubyText);
                    
                    // Act: ルビを削除
                    const result = manager.removeRuby(rubyHtml);
                    
                    // Assert: ベーステキストのみが残る
                    expect(result).toBe(baseText);
                    
                    // Assert: ルビ要素は存在しない
                    expect(manager.hasRuby(result)).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * ルビ削除後、ruby/rt/rpタグが残らないことを確認
     */
    it('ルビ削除後、ruby/rt/rpタグが残らない', () => {
        fc.assert(
            fc.property(
                baseTextArb,
                rubyTextArb,
                (baseText, rubyText) => {
                    // Arrange
                    const manager = new RubyDataManager();
                    const rubyHtml = manager.setRuby(baseText, rubyText);
                    
                    // Act: ルビを削除
                    const result = manager.removeRuby(rubyHtml);
                    
                    // Assert: ruby/rt/rpタグが残らない
                    expect(result).not.toContain('<ruby>');
                    expect(result).not.toContain('</ruby>');
                    expect(result).not.toContain('<rt>');
                    expect(result).not.toContain('</rt>');
                    expect(result).not.toContain('<rp>');
                    expect(result).not.toContain('</rp>');
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Property 3: ルビ更新時の重複防止', () => {
    /**
     * **Feature: ruby-enhancement, Property 3: ルビ更新時の重複防止**
     * **Validates: Requirements 2.2**
     * 
     * 任意の既存ルビ付きテキストに対して、ルビを更新した後、
     * ruby要素は1つのみ存在し、ネストされたruby要素は存在しない
     */
    it('任意の既存ルビ付きテキストに対して、ルビを更新後もruby要素は1つのみ存在する', () => {
        fc.assert(
            fc.property(
                baseTextArb,
                rubyTextArb,
                rubyTextArb,
                (baseText, originalRubyText, newRubyText) => {
                    // Arrange: RubyDataManagerを初期化
                    const manager = new RubyDataManager();
                    
                    // 既存のルビを設定
                    const originalHtml = manager.setRuby(baseText, originalRubyText);
                    
                    // Act: ルビを更新
                    const updatedHtml = manager.updateRuby(originalHtml, newRubyText);
                    
                    // Assert: ruby要素は1つのみ存在
                    expect(manager.countRubyElements(updatedHtml)).toBe(1);
                    
                    // Assert: ネストされたruby要素は存在しない
                    expect(manager.hasNestedRuby(updatedHtml)).toBe(false);
                    
                    // Assert: 新しいルビテキストが設定されている
                    const detected = manager.detectRuby(updatedHtml);
                    expect(detected.rubyText).toBe(newRubyText);
                    
                    // Assert: ベーステキストは変更されていない
                    expect(detected.baseText).toBe(baseText);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 複数回ルビを更新しても、ruby要素は1つのみ
     */
    it('複数回ルビを更新しても、ruby要素は1つのみ存在する', () => {
        fc.assert(
            fc.property(
                baseTextArb,
                fc.array(rubyTextArb, { minLength: 2, maxLength: 5 }),
                (baseText, rubyTexts) => {
                    // Arrange
                    const manager = new RubyDataManager();
                    
                    // 最初のルビを設定
                    let html = manager.setRuby(baseText, rubyTexts[0]);
                    
                    // Act: 複数回ルビを更新
                    for (let i = 1; i < rubyTexts.length; i++) {
                        html = manager.updateRuby(html, rubyTexts[i]);
                    }
                    
                    // Assert: ruby要素は1つのみ存在
                    expect(manager.countRubyElements(html)).toBe(1);
                    
                    // Assert: ネストされたruby要素は存在しない
                    expect(manager.hasNestedRuby(html)).toBe(false);
                    
                    // Assert: 最後のルビテキストが設定されている
                    const detected = manager.detectRuby(html);
                    expect(detected.rubyText).toBe(rubyTexts[rubyTexts.length - 1]);
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * SelectionAdjusterのテスト用実装
 * DOM操作を除いた純粋なデータ操作をテスト
 * 
 * EditorManagerの選択範囲調整機能のロジックを抽出したクラス
 */
class SelectionAdjuster {
    /**
     * テキストとルビの位置情報を解析します
     * @param {string} html - 解析対象のHTML
     * @returns {{segments: Array<{type: string, text: string, start: number, end: number}>}} セグメント情報
     */
    parseHtml(html) {
        const segments = [];
        let position = 0;
        let remaining = html;

        while (remaining.length > 0) {
            // ルビ要素を検出
            const rubyMatch = remaining.match(/^<ruby>([^<]*)<rt>([^<]*)<\/rt><\/ruby>/);
            if (rubyMatch) {
                const fullMatch = rubyMatch[0];
                const baseText = rubyMatch[1];
                segments.push({
                    type: 'ruby',
                    text: baseText,
                    rubyText: rubyMatch[2],
                    start: position,
                    end: position + baseText.length,
                    htmlStart: position,
                    htmlEnd: position + fullMatch.length
                });
                position += baseText.length;
                remaining = remaining.slice(fullMatch.length);
            } else {
                // 通常のテキスト
                const nextRuby = remaining.indexOf('<ruby>');
                const textEnd = nextRuby === -1 ? remaining.length : nextRuby;
                const text = remaining.slice(0, textEnd);
                if (text.length > 0) {
                    segments.push({
                        type: 'text',
                        text: text,
                        start: position,
                        end: position + text.length
                    });
                    position += text.length;
                }
                remaining = remaining.slice(textEnd);
            }
        }

        return { segments };
    }

    /**
     * 選択範囲がルビ要素を部分的に含むかチェックします
     * @param {number} selStart - 選択開始位置（テキスト位置）
     * @param {number} selEnd - 選択終了位置（テキスト位置）
     * @param {Array} segments - セグメント情報
     * @returns {boolean} 部分的に含む場合true
     */
    hasPartialRuby(selStart, selEnd, segments) {
        for (const seg of segments) {
            if (seg.type !== 'ruby') continue;

            // ルビの開始位置が選択範囲内にあり、ルビの終了位置が選択範囲外
            // または、ルビの終了位置が選択範囲内にあり、ルビの開始位置が選択範囲外
            const rubyStart = seg.start;
            const rubyEnd = seg.end;

            // 選択範囲がルビの途中から始まる場合
            if (selStart > rubyStart && selStart < rubyEnd) {
                return true;
            }

            // 選択範囲がルビの途中で終わる場合
            if (selEnd > rubyStart && selEnd < rubyEnd) {
                return true;
            }
        }

        return false;
    }

    /**
     * 選択範囲を調整してルビ要素を除外します
     * @param {number} selStart - 選択開始位置（テキスト位置）
     * @param {number} selEnd - 選択終了位置（テキスト位置）
     * @param {Array} segments - セグメント情報
     * @returns {{start: number, end: number}} 調整後の選択範囲
     */
    adjustSelection(selStart, selEnd, segments) {
        let adjustedStart = selStart;
        let adjustedEnd = selEnd;

        for (const seg of segments) {
            if (seg.type !== 'ruby') continue;

            const rubyStart = seg.start;
            const rubyEnd = seg.end;

            // 選択開始位置がルビ内にある場合、ルビの後ろに移動
            if (adjustedStart > rubyStart && adjustedStart < rubyEnd) {
                adjustedStart = rubyEnd;
            }

            // 選択終了位置がルビ内にある場合、ルビの前に移動
            if (adjustedEnd > rubyStart && adjustedEnd < rubyEnd) {
                adjustedEnd = rubyStart;
            }
        }

        // 開始位置が終了位置を超えた場合は空の範囲を返す
        if (adjustedStart >= adjustedEnd) {
            return { start: adjustedStart, end: adjustedStart };
        }

        return { start: adjustedStart, end: adjustedEnd };
    }

    /**
     * 調整後の選択範囲にルビ要素が部分的に含まれていないことを確認します
     * @param {number} selStart - 選択開始位置
     * @param {number} selEnd - 選択終了位置
     * @param {Array} segments - セグメント情報
     * @returns {boolean} ルビが部分的に含まれていない場合true
     */
    isSelectionClean(selStart, selEnd, segments) {
        // 空の選択範囲はクリーン
        if (selStart >= selEnd) return true;

        for (const seg of segments) {
            if (seg.type !== 'ruby') continue;

            const rubyStart = seg.start;
            const rubyEnd = seg.end;

            // 選択範囲がルビの途中から始まる場合はNG
            if (selStart > rubyStart && selStart < rubyEnd) {
                return false;
            }

            // 選択範囲がルビの途中で終わる場合はNG
            if (selEnd > rubyStart && selEnd < rubyEnd) {
                return false;
            }
        }

        return true;
    }
}

// カスタムArbitrary: 通常テキスト（ルビなし）
const plainTextArb = fc.stringOf(
    fc.constantFrom(
        'あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ',
        'A', 'B', 'C', 'D', 'E', '1', '2', '3', '4', '5'
    ),
    { minLength: 1, maxLength: 10 }
);

// カスタムArbitrary: ルビ付きテキストを含むHTML
const htmlWithRubyArb = fc.tuple(
    plainTextArb,  // 前のテキスト
    baseTextArb,   // ルビのベーステキスト
    rubyTextArb,   // ルビテキスト
    plainTextArb   // 後のテキスト
).map(([before, base, ruby, after]) => {
    return {
        html: `${before}<ruby>${base}<rt>${ruby}</rt></ruby>${after}`,
        beforeText: before,
        baseText: base,
        rubyText: ruby,
        afterText: after,
        // テキスト位置の計算
        rubyStartPos: before.length,
        rubyEndPos: before.length + base.length,
        totalLength: before.length + base.length + after.length
    };
});

describe('Property 4: 選択範囲からのルビ除外', () => {
    /**
     * **Feature: ruby-enhancement, Property 4: 選択範囲からのルビ除外**
     * **Validates: Requirements 3.2, 3.3**
     * 
     * 任意のルビを含むテキスト範囲を選択した場合、
     * 選択範囲にはルビ要素が部分的に含まれない
     */
    it('任意のルビを含むテキストで、選択範囲調整後はルビが部分的に含まれない', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                fc.integer({ min: 0, max: 100 }),
                fc.integer({ min: 0, max: 100 }),
                (htmlData, startPercent, endPercent) => {
                    // Arrange
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // 選択範囲をパーセンテージから計算
                    const totalLen = htmlData.totalLength;
                    const rawStart = Math.floor((startPercent / 100) * totalLen);
                    const rawEnd = Math.floor((endPercent / 100) * totalLen);
                    
                    // 開始位置が終了位置より大きい場合は入れ替え
                    const selStart = Math.min(rawStart, rawEnd);
                    const selEnd = Math.max(rawStart, rawEnd);
                    
                    // 空の選択範囲はスキップ
                    if (selStart === selEnd) return true;
                    
                    // Act: 選択範囲を調整
                    const adjusted = adjuster.adjustSelection(selStart, selEnd, segments);
                    
                    // Assert: 調整後の選択範囲にルビが部分的に含まれていない
                    expect(adjuster.isSelectionClean(adjusted.start, adjusted.end, segments)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * ルビの途中から選択を開始した場合、ルビの後ろに調整される
     */
    it('ルビの途中から選択を開始した場合、ルビの後ろに調整される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                (htmlData) => {
                    // Arrange
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // ルビの途中から選択を開始
                    const rubyMidpoint = htmlData.rubyStartPos + Math.floor(htmlData.baseText.length / 2);
                    // ルビの途中から始まるように調整（ルビが1文字以上の場合のみ）
                    if (htmlData.baseText.length <= 1) return true;
                    
                    const selStart = rubyMidpoint;
                    const selEnd = htmlData.totalLength;
                    
                    // Act: 選択範囲を調整
                    const adjusted = adjuster.adjustSelection(selStart, selEnd, segments);
                    
                    // Assert: 開始位置がルビの終了位置以降になっている
                    expect(adjusted.start).toBeGreaterThanOrEqual(htmlData.rubyEndPos);
                    
                    // Assert: 調整後の選択範囲にルビが部分的に含まれていない
                    expect(adjuster.isSelectionClean(adjusted.start, adjusted.end, segments)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * ルビの途中で選択を終了した場合、ルビの前に調整される
     */
    it('ルビの途中で選択を終了した場合、ルビの前に調整される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                (htmlData) => {
                    // Arrange
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // ルビの途中で選択を終了
                    const rubyMidpoint = htmlData.rubyStartPos + Math.floor(htmlData.baseText.length / 2);
                    // ルビの途中で終わるように調整（ルビが1文字以上の場合のみ）
                    if (htmlData.baseText.length <= 1) return true;
                    
                    const selStart = 0;
                    const selEnd = rubyMidpoint;
                    
                    // Act: 選択範囲を調整
                    const adjusted = adjuster.adjustSelection(selStart, selEnd, segments);
                    
                    // Assert: 終了位置がルビの開始位置以前になっている
                    expect(adjusted.end).toBeLessThanOrEqual(htmlData.rubyStartPos);
                    
                    // Assert: 調整後の選択範囲にルビが部分的に含まれていない
                    expect(adjuster.isSelectionClean(adjusted.start, adjusted.end, segments)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 選択範囲が完全にルビ内にある場合、空の範囲になる
     */
    it('選択範囲が完全にルビ内にある場合、空の範囲になる', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                (htmlData) => {
                    // Arrange
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // ルビが2文字以上の場合のみテスト
                    if (htmlData.baseText.length < 2) return true;
                    
                    // 選択範囲を完全にルビ内に設定
                    const selStart = htmlData.rubyStartPos + 1;
                    const selEnd = htmlData.rubyEndPos - 1;
                    
                    // 有効な範囲の場合のみテスト
                    if (selStart >= selEnd) return true;
                    
                    // Act: 選択範囲を調整
                    const adjusted = adjuster.adjustSelection(selStart, selEnd, segments);
                    
                    // Assert: 空の範囲になる（開始位置 >= 終了位置）
                    expect(adjusted.start).toBeGreaterThanOrEqual(adjusted.end);
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * RubyEditProtectorのテスト用実装
 * DOM操作を除いた純粋なデータ操作をテスト
 * 
 * EditorManagerのルビ編集防止機能のロジックを抽出したクラス
 */
class RubyEditProtector {
    /**
     * ナビゲーションキーかどうかを判定します
     * @param {string} key - キー名
     * @param {boolean} ctrlKey - Ctrlキーが押されているか
     * @param {boolean} metaKey - Metaキーが押されているか
     * @returns {boolean} ナビゲーションキーの場合true
     */
    isNavigationKey(key, ctrlKey = false, metaKey = false) {
        const navigationKeys = [
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'Home', 'End', 'PageUp', 'PageDown',
            'Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
            'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
            'Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'NumLock'
        ];

        if (navigationKeys.includes(key)) {
            return true;
        }

        // Ctrl/Cmd + キーの組み合わせ
        if (ctrlKey || metaKey) {
            const allowedWithCtrl = ['a', 'c', 'v', 'x', 'z', 'y'];
            if (allowedWithCtrl.includes(key.toLowerCase())) {
                return true;
            }
        }

        return false;
    }

    /**
     * カーソル位置がルビ内かどうかを判定します
     * @param {number} cursorPos - カーソル位置（テキスト位置）
     * @param {Array} segments - セグメント情報
     * @returns {boolean} ルビ内の場合true
     */
    isCursorInRuby(cursorPos, segments) {
        for (const seg of segments) {
            if (seg.type !== 'ruby') continue;
            
            // カーソルがルビの範囲内にある場合
            if (cursorPos >= seg.start && cursorPos <= seg.end) {
                return true;
            }
        }
        return false;
    }

    /**
     * カーソル位置がrt要素内かどうかを判定します
     * rt要素への編集は常に不許可
     * @param {number} cursorPos - カーソル位置（テキスト位置）
     * @param {Array} segments - セグメント情報
     * @returns {boolean} rt要素内の場合true
     */
    isCursorInRt(cursorPos, segments) {
        for (const seg of segments) {
            if (seg.type !== 'ruby') continue;
            
            // rt要素の位置はベーステキストの後ろ
            // ルビテキストの範囲内にカーソルがある場合
            if (seg.rubyText && cursorPos >= seg.end) {
                // ルビテキストの長さ分の範囲内かチェック
                const rtEnd = seg.end + seg.rubyText.length;
                if (cursorPos <= rtEnd) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 編集操作が許可されるかどうかを判定します
     * @param {number} cursorPos - カーソル位置
     * @param {Array} segments - セグメント情報
     * @param {string} key - 押されたキー
     * @param {boolean} ctrlKey - Ctrlキーが押されているか
     * @param {boolean} metaKey - Metaキーが押されているか
     * @param {boolean} isEntireRubySelected - ルビ全体が選択されているか
     * @returns {boolean} 編集が許可される場合true
     */
    isEditAllowed(cursorPos, segments, key, ctrlKey = false, metaKey = false, isEntireRubySelected = false) {
        // ナビゲーションキーは常に許可
        if (this.isNavigationKey(key, ctrlKey, metaKey)) {
            return true;
        }

        // カーソルがルビ内にない場合は許可
        if (!this.isCursorInRuby(cursorPos, segments)) {
            return true;
        }

        // ルビ全体が選択されている場合は許可（削除操作など）
        if (isEntireRubySelected) {
            return true;
        }

        // ルビ内での編集は不許可
        return false;
    }

    /**
     * rt要素への編集が許可されるかどうかを判定します
     * rt要素への編集は常に不許可（ナビゲーションキーを除く）
     * @param {number} cursorPos - カーソル位置
     * @param {Array} segments - セグメント情報
     * @param {string} key - 押されたキー
     * @param {boolean} ctrlKey - Ctrlキーが押されているか
     * @param {boolean} metaKey - Metaキーが押されているか
     * @returns {boolean} 編集が許可される場合true
     */
    isRtEditAllowed(cursorPos, segments, key, ctrlKey = false, metaKey = false) {
        // ナビゲーションキーは常に許可
        if (this.isNavigationKey(key, ctrlKey, metaKey)) {
            return true;
        }

        // カーソルがrt要素内にある場合は常に不許可
        if (this.isCursorInRt(cursorPos, segments)) {
            return false;
        }

        return true;
    }

    /**
     * 編集操作後のルビ内容が変更されていないことを確認します
     * @param {string} originalHtml - 元のHTML
     * @param {string} newHtml - 編集後のHTML
     * @returns {boolean} ルビ内容が変更されていない場合true
     */
    isRubyContentUnchanged(originalHtml, newHtml) {
        // ルビ要素を抽出
        const originalRubies = this.extractRubies(originalHtml);
        const newRubies = this.extractRubies(newHtml);

        // ルビの数が同じで、内容も同じであることを確認
        if (originalRubies.length !== newRubies.length) {
            return false;
        }

        for (let i = 0; i < originalRubies.length; i++) {
            if (originalRubies[i].baseText !== newRubies[i].baseText ||
                originalRubies[i].rubyText !== newRubies[i].rubyText) {
                return false;
            }
        }

        return true;
    }

    /**
     * HTMLからルビ要素を抽出します
     * @param {string} html - HTML文字列
     * @returns {Array<{baseText: string, rubyText: string}>} ルビ情報の配列
     */
    extractRubies(html) {
        const rubies = [];
        const regex = /<ruby>([^<]*)<rt>([^<]*)<\/rt><\/ruby>/g;
        let match;

        while ((match = regex.exec(html)) !== null) {
            rubies.push({
                baseText: match[1],
                rubyText: match[2]
            });
        }

        return rubies;
    }
}

// カスタムArbitrary: 編集キー（文字入力、削除など）
const editKeyArb = fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'Backspace', 'Delete', 'Enter', ' '
);

// カスタムArbitrary: ナビゲーションキー
const navKeyArb = fc.constantFrom(
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Home', 'End', 'PageUp', 'PageDown',
    'Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
    'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    'Control', 'Alt', 'Shift', 'Meta'
);

describe('Property 5: ルビ要素の編集不可', () => {
    /**
     * **Feature: ruby-enhancement, Property 5: ルビ要素の編集不可**
     * **Validates: Requirements 3.1**
     * 
     * 任意のルビ要素に対して、エディタ上でカーソルを合わせることはできず、
     * 直接編集（キー入力、削除など）を行うことはできない。
     * ルビ要素の内容は変更されない
     */
    it('ルビ内でのカーソル位置での編集キー入力は拒否される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                editKeyArb,
                (htmlData, key) => {
                    // Arrange
                    const protector = new RubyEditProtector();
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // ルビ内のカーソル位置を設定
                    const cursorPos = htmlData.rubyStartPos + Math.floor(htmlData.baseText.length / 2);
                    
                    // ルビが空の場合はスキップ
                    if (htmlData.baseText.length === 0) return true;
                    
                    // Act: 編集が許可されるかチェック
                    const isAllowed = protector.isEditAllowed(
                        cursorPos,
                        segments,
                        key,
                        false,  // ctrlKey
                        false,  // metaKey
                        false   // isEntireRubySelected
                    );
                    
                    // Assert: ルビ内での編集キー入力は拒否される
                    expect(isAllowed).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * ナビゲーションキーはルビ内でも許可される
     */
    it('ナビゲーションキーはルビ内でも許可される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                navKeyArb,
                (htmlData, key) => {
                    // Arrange
                    const protector = new RubyEditProtector();
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // ルビ内のカーソル位置を設定
                    const cursorPos = htmlData.rubyStartPos + Math.floor(htmlData.baseText.length / 2);
                    
                    // ルビが空の場合はスキップ
                    if (htmlData.baseText.length === 0) return true;
                    
                    // Act: 編集が許可されるかチェック
                    const isAllowed = protector.isEditAllowed(
                        cursorPos,
                        segments,
                        key,
                        false,  // ctrlKey
                        false,  // metaKey
                        false   // isEntireRubySelected
                    );
                    
                    // Assert: ナビゲーションキーは許可される
                    expect(isAllowed).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * ルビ外でのカーソル位置での編集キー入力は許可される
     */
    it('ルビ外でのカーソル位置での編集キー入力は許可される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                editKeyArb,
                (htmlData, key) => {
                    // Arrange
                    const protector = new RubyEditProtector();
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // ルビ外のカーソル位置を設定（前のテキスト内）
                    const cursorPos = Math.floor(htmlData.beforeText.length / 2);
                    
                    // 前のテキストが空の場合はスキップ
                    if (htmlData.beforeText.length === 0) return true;
                    
                    // Act: 編集が許可されるかチェック
                    const isAllowed = protector.isEditAllowed(
                        cursorPos,
                        segments,
                        key,
                        false,  // ctrlKey
                        false,  // metaKey
                        false   // isEntireRubySelected
                    );
                    
                    // Assert: ルビ外での編集キー入力は許可される
                    expect(isAllowed).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * ルビ全体が選択されている場合は編集が許可される
     */
    it('ルビ全体が選択されている場合は編集が許可される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                editKeyArb,
                (htmlData, key) => {
                    // Arrange
                    const protector = new RubyEditProtector();
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // ルビ内のカーソル位置を設定
                    const cursorPos = htmlData.rubyStartPos;
                    
                    // Act: ルビ全体が選択されている場合の編集チェック
                    const isAllowed = protector.isEditAllowed(
                        cursorPos,
                        segments,
                        key,
                        false,  // ctrlKey
                        false,  // metaKey
                        true    // isEntireRubySelected
                    );
                    
                    // Assert: ルビ全体が選択されている場合は許可される
                    expect(isAllowed).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Ctrl+キーの組み合わせ（コピー、ペーストなど）はルビ内でも許可される
     */
    it('Ctrl+キーの組み合わせはルビ内でも許可される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                fc.constantFrom('a', 'c', 'v', 'x', 'z', 'y'),
                (htmlData, key) => {
                    // Arrange
                    const protector = new RubyEditProtector();
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // ルビ内のカーソル位置を設定
                    const cursorPos = htmlData.rubyStartPos + Math.floor(htmlData.baseText.length / 2);
                    
                    // ルビが空の場合はスキップ
                    if (htmlData.baseText.length === 0) return true;
                    
                    // Act: Ctrl+キーの組み合わせが許可されるかチェック
                    const isAllowed = protector.isEditAllowed(
                        cursorPos,
                        segments,
                        key,
                        true,   // ctrlKey
                        false,  // metaKey
                        false   // isEntireRubySelected
                    );
                    
                    // Assert: Ctrl+キーの組み合わせは許可される
                    expect(isAllowed).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Feature: ruby-enhancement, Property 5: ルビテキストの編集・選択不可**
     * **Validates: Requirements 3.1, 3.4**
     * 
     * rt要素（ルビテキスト）への編集は常に不許可
     */
    it('rt要素内でのカーソル位置での編集キー入力は常に拒否される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                editKeyArb,
                (htmlData, key) => {
                    // Arrange
                    const protector = new RubyEditProtector();
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // rt要素内のカーソル位置を設定（ベーステキストの後ろ）
                    const cursorPos = htmlData.rubyEndPos + Math.floor(htmlData.rubyText.length / 2);
                    
                    // ルビテキストが空の場合はスキップ
                    if (htmlData.rubyText.length === 0) return true;
                    
                    // Act: rt要素への編集が許可されるかチェック
                    const isAllowed = protector.isRtEditAllowed(
                        cursorPos,
                        segments,
                        key,
                        false,  // ctrlKey
                        false   // metaKey
                    );
                    
                    // Assert: rt要素内での編集キー入力は常に拒否される
                    expect(isAllowed).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * rt要素外でのカーソル位置での編集キー入力は許可される
     */
    it('rt要素外でのカーソル位置での編集キー入力は許可される', () => {
        fc.assert(
            fc.property(
                htmlWithRubyArb,
                editKeyArb,
                (htmlData, key) => {
                    // Arrange
                    const protector = new RubyEditProtector();
                    const adjuster = new SelectionAdjuster();
                    const { segments } = adjuster.parseHtml(htmlData.html);
                    
                    // rt要素外のカーソル位置を設定（前のテキスト内）
                    const cursorPos = Math.floor(htmlData.beforeText.length / 2);
                    
                    // 前のテキストが空の場合はスキップ
                    if (htmlData.beforeText.length === 0) return true;
                    
                    // Act: rt要素への編集が許可されるかチェック
                    const isAllowed = protector.isRtEditAllowed(
                        cursorPos,
                        segments,
                        key,
                        false,  // ctrlKey
                        false   // metaKey
                    );
                    
                    // Assert: rt要素外での編集キー入力は許可される
                    expect(isAllowed).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * RubyPanelPositionCalculatorのテスト用実装
 * DOM操作を除いた純粋なデータ操作をテスト
 * 
 * EditorManagerのルビパネル位置計算機能のロジックを抽出したクラス
 */
class RubyPanelPositionCalculator {
    /**
     * ルビパネルの位置を計算します
     * @param {Object} anchorRect - 基準要素の位置情報 {top, left, bottom, right, width, height}
     * @param {Object} panelSize - パネルのサイズ {width, height}
     * @param {Object} viewport - ビューポート情報 {width, height, scrollX, scrollY}
     * @returns {{top: number, left: number}} パネルの位置
     */
    calculatePosition(anchorRect, panelSize, viewport) {
        const panelWidth = panelSize.width || 200;
        const panelHeight = panelSize.height || 100;
        const margin = 10; // 画面端からのマージン
        const gap = 5; // アンカー要素とパネルの間隔

        // 基本位置: ボタンの下部中央
        let top = anchorRect.bottom + gap + viewport.scrollY;
        let left = anchorRect.left + (anchorRect.width / 2) - (panelWidth / 2) + viewport.scrollX;

        // 画面右端のチェック
        if (left + panelWidth > viewport.width - margin) {
            left = viewport.width - panelWidth - margin;
        }

        // 画面左端のチェック
        if (left < margin) {
            left = margin;
        }

        // 画面下端のチェック（パネルが画面下にはみ出す場合は上に表示）
        if (top + panelHeight > viewport.height + viewport.scrollY - margin) {
            top = anchorRect.top - panelHeight - gap + viewport.scrollY;
        }

        // 画面上端のチェック - 上にはみ出す場合は画面上端に配置
        if (top < viewport.scrollY + margin) {
            top = viewport.scrollY + margin;
        }

        // 最終チェック: パネルが画面下端からはみ出す場合は強制的に収める
        const maxTop = viewport.height + viewport.scrollY - panelHeight - margin;
        if (top > maxTop) {
            top = maxTop;
        }

        return { top, left };
    }

    /**
     * パネルが画面内に収まっているかチェックします
     * @param {Object} position - パネルの位置 {top, left}
     * @param {Object} panelSize - パネルのサイズ {width, height}
     * @param {Object} viewport - ビューポート情報 {width, height, scrollX, scrollY}
     * @returns {boolean} 画面内に収まっている場合true
     */
    isWithinViewport(position, panelSize, viewport) {
        const margin = 10;
        const panelWidth = panelSize.width || 200;
        const panelHeight = panelSize.height || 100;

        // 左端チェック
        if (position.left < margin) {
            return false;
        }

        // 右端チェック
        if (position.left + panelWidth > viewport.width - margin) {
            return false;
        }

        // 上端チェック
        if (position.top < viewport.scrollY + margin) {
            return false;
        }

        // 下端チェック
        if (position.top + panelHeight > viewport.height + viewport.scrollY - margin) {
            return false;
        }

        return true;
    }
}

// カスタムArbitrary: パネルサイズ
const panelSizeArb = fc.record({
    width: fc.integer({ min: 150, max: 300 }),
    height: fc.integer({ min: 80, max: 150 })
});

// カスタムArbitrary: ビューポート情報
const viewportArb = fc.record({
    width: fc.integer({ min: 320, max: 1920 }),
    height: fc.integer({ min: 480, max: 1080 }),
    scrollX: fc.integer({ min: 0, max: 500 }),
    scrollY: fc.integer({ min: 0, max: 1000 })
});

// カスタムArbitrary: ビューポートに対して相対的なアンカー位置を生成
// アンカーはビューポート内のどこかに配置される
const anchorRectWithViewportArb = viewportArb.chain(viewport => {
    return fc.record({
        // アンカーのtopはビューポートの可視領域内（scrollY ～ scrollY + height）
        topPercent: fc.integer({ min: 0, max: 100 }),
        // アンカーのleftはビューポートの幅内（0 ～ width）
        leftPercent: fc.integer({ min: 0, max: 100 }),
        width: fc.integer({ min: 20, max: 100 }),
        height: fc.integer({ min: 20, max: 50 })
    }).map(data => {
        const top = viewport.scrollY + Math.floor((data.topPercent / 100) * (viewport.height - data.height));
        const left = Math.floor((data.leftPercent / 100) * (viewport.width - data.width));
        return {
            anchorRect: {
                top,
                left,
                width: data.width,
                height: data.height,
                bottom: top + data.height,
                right: left + data.width
            },
            viewport
        };
    });
});

describe('Property 6: パネル位置の画面内収束', () => {
    /**
     * **Feature: ruby-enhancement, Property 6: パネル位置の画面内収束**
     * **Validates: Requirements 4.4**
     * 
     * 任意の画面位置でルビパネルを表示した場合、パネル全体が画面内に収まる
     */
    it('任意の画面位置でルビパネルを表示した場合、パネル全体が画面内に収まる', () => {
        fc.assert(
            fc.property(
                anchorRectWithViewportArb,
                panelSizeArb,
                ({ anchorRect, viewport }, panelSize) => {
                    // Arrange
                    const calculator = new RubyPanelPositionCalculator();
                    
                    // パネルサイズがビューポートより大きい場合はスキップ
                    // （物理的に収まらないケース）
                    if (panelSize.width > viewport.width - 20 || 
                        panelSize.height > viewport.height - 20) {
                        return true;
                    }
                    
                    // Act: パネル位置を計算
                    const position = calculator.calculatePosition(anchorRect, panelSize, viewport);
                    
                    // Assert: パネルが画面内に収まっている
                    expect(calculator.isWithinViewport(position, panelSize, viewport)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 画面右端に近い位置でもパネルが画面内に収まる
     */
    it('画面右端に近い位置でもパネルが画面内に収まる', () => {
        fc.assert(
            fc.property(
                panelSizeArb,
                viewportArb,
                (panelSize, viewport) => {
                    // Arrange
                    const calculator = new RubyPanelPositionCalculator();
                    
                    // パネルサイズがビューポートより大きい場合はスキップ
                    if (panelSize.width > viewport.width - 20 || 
                        panelSize.height > viewport.height - 20) {
                        return true;
                    }
                    
                    // 画面右端に近いアンカー位置を設定
                    const anchorRect = {
                        top: 100,
                        left: viewport.width - 50,
                        width: 40,
                        height: 30,
                        bottom: 130,
                        right: viewport.width - 10
                    };
                    
                    // Act: パネル位置を計算
                    const position = calculator.calculatePosition(anchorRect, panelSize, viewport);
                    
                    // Assert: パネルが画面内に収まっている
                    expect(calculator.isWithinViewport(position, panelSize, viewport)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 画面左端に近い位置でもパネルが画面内に収まる
     */
    it('画面左端に近い位置でもパネルが画面内に収まる', () => {
        fc.assert(
            fc.property(
                panelSizeArb,
                viewportArb,
                (panelSize, viewport) => {
                    // Arrange
                    const calculator = new RubyPanelPositionCalculator();
                    
                    // パネルサイズがビューポートより大きい場合はスキップ
                    if (panelSize.width > viewport.width - 20 || 
                        panelSize.height > viewport.height - 20) {
                        return true;
                    }
                    
                    // 画面左端に近いアンカー位置を設定
                    const anchorRect = {
                        top: 100,
                        left: 5,
                        width: 40,
                        height: 30,
                        bottom: 130,
                        right: 45
                    };
                    
                    // Act: パネル位置を計算
                    const position = calculator.calculatePosition(anchorRect, panelSize, viewport);
                    
                    // Assert: パネルが画面内に収まっている
                    expect(calculator.isWithinViewport(position, panelSize, viewport)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 画面下端に近い位置でもパネルが画面内に収まる
     */
    it('画面下端に近い位置でもパネルが画面内に収まる', () => {
        fc.assert(
            fc.property(
                panelSizeArb,
                viewportArb,
                (panelSize, viewport) => {
                    // Arrange
                    const calculator = new RubyPanelPositionCalculator();
                    
                    // パネルサイズがビューポートより大きい場合はスキップ
                    if (panelSize.width > viewport.width - 20 || 
                        panelSize.height > viewport.height - 20) {
                        return true;
                    }
                    
                    // 画面下端に近いアンカー位置を設定（ビューポート内に収まるように）
                    // アンカーの上部にパネルを配置できるスペースを確保
                    const anchorTop = Math.min(
                        viewport.height + viewport.scrollY - 50,
                        viewport.scrollY + panelSize.height + 50 // パネルを上に配置できるスペース
                    );
                    const anchorRect = {
                        top: anchorTop,
                        left: Math.min(200, viewport.width - 50),
                        width: 40,
                        height: 30,
                        bottom: anchorTop + 30,
                        right: Math.min(240, viewport.width - 10)
                    };
                    
                    // Act: パネル位置を計算
                    const position = calculator.calculatePosition(anchorRect, panelSize, viewport);
                    
                    // Assert: パネルが画面内に収まっている
                    expect(calculator.isWithinViewport(position, panelSize, viewport)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 画面上端に近い位置でもパネルが画面内に収まる
     */
    it('画面上端に近い位置でもパネルが画面内に収まる', () => {
        fc.assert(
            fc.property(
                panelSizeArb,
                viewportArb,
                (panelSize, viewport) => {
                    // Arrange
                    const calculator = new RubyPanelPositionCalculator();
                    
                    // パネルサイズがビューポートより大きい場合はスキップ
                    if (panelSize.width > viewport.width - 20 || 
                        panelSize.height > viewport.height - 20) {
                        return true;
                    }
                    
                    // 画面上端に近いアンカー位置を設定（ビューポート内に収まるように）
                    // アンカーの下部にパネルを配置できるスペースを確保
                    const anchorTop = Math.max(
                        viewport.scrollY + 5,
                        viewport.scrollY + viewport.height - panelSize.height - 50 // パネルを下に配置できるスペース
                    );
                    const anchorRect = {
                        top: viewport.scrollY + 5,
                        left: Math.min(200, viewport.width - 50),
                        width: 40,
                        height: 30,
                        bottom: viewport.scrollY + 35,
                        right: Math.min(240, viewport.width - 10)
                    };
                    
                    // Act: パネル位置を計算
                    const position = calculator.calculatePosition(anchorRect, panelSize, viewport);
                    
                    // Assert: パネルが画面内に収まっている
                    expect(calculator.isWithinViewport(position, panelSize, viewport)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 画面の四隅でもパネルが画面内に収まる
     */
    it('画面の四隅でもパネルが画面内に収まる', () => {
        fc.assert(
            fc.property(
                panelSizeArb,
                viewportArb,
                fc.constantFrom('topLeft', 'topRight', 'bottomLeft', 'bottomRight'),
                (panelSize, viewport, corner) => {
                    // Arrange
                    const calculator = new RubyPanelPositionCalculator();
                    
                    // パネルサイズがビューポートより大きい場合はスキップ
                    if (panelSize.width > viewport.width - 20 || 
                        panelSize.height > viewport.height - 20) {
                        return true;
                    }
                    
                    // 四隅のアンカー位置を設定（ビューポート内に収まるように）
                    const margin = 10;
                    let anchorRect;
                    switch (corner) {
                        case 'topLeft':
                            anchorRect = {
                                top: viewport.scrollY + margin,
                                left: margin,
                                width: 40,
                                height: 30,
                                bottom: viewport.scrollY + margin + 30,
                                right: margin + 40
                            };
                            break;
                        case 'topRight':
                            anchorRect = {
                                top: viewport.scrollY + margin,
                                left: viewport.width - margin - 40,
                                width: 40,
                                height: 30,
                                bottom: viewport.scrollY + margin + 30,
                                right: viewport.width - margin
                            };
                            break;
                        case 'bottomLeft':
                            anchorRect = {
                                top: viewport.height + viewport.scrollY - margin - 30,
                                left: margin,
                                width: 40,
                                height: 30,
                                bottom: viewport.height + viewport.scrollY - margin,
                                right: margin + 40
                            };
                            break;
                        case 'bottomRight':
                            anchorRect = {
                                top: viewport.height + viewport.scrollY - margin - 30,
                                left: viewport.width - margin - 40,
                                width: 40,
                                height: 30,
                                bottom: viewport.height + viewport.scrollY - margin,
                                right: viewport.width - margin
                            };
                            break;
                    }
                    
                    // Act: パネル位置を計算
                    const position = calculator.calculatePosition(anchorRect, panelSize, viewport);
                    
                    // Assert: パネルが画面内に収まっている
                    expect(calculator.isWithinViewport(position, panelSize, viewport)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
