/**
 * Utilsモジュールのユニットテスト
 * 
 * debounce、generateId、rgbToHex、clamp、rectsOverlap、escapeHtml、deepClone関数の動作確認
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, generateId, rgbToHex, clamp, rectsOverlap, escapeHtml, deepClone } from '../../src/utils.js';

describe('Utils', () => {
    describe('debounce', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('指定した時間後に関数が実行されること', () => {
            const mockFn = vi.fn();
            const debouncedFn = debounce(mockFn, 100);

            debouncedFn();
            expect(mockFn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('連続呼び出し時は最後の呼び出しのみ実行されること', () => {
            const mockFn = vi.fn();
            const debouncedFn = debounce(mockFn, 100);

            debouncedFn('first');
            debouncedFn('second');
            debouncedFn('third');

            vi.advanceTimersByTime(100);
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(mockFn).toHaveBeenCalledWith('third');
        });

        it('待機時間内に再呼び出しするとタイマーがリセットされること', () => {
            const mockFn = vi.fn();
            const debouncedFn = debounce(mockFn, 100);

            debouncedFn();
            vi.advanceTimersByTime(50);
            expect(mockFn).not.toHaveBeenCalled();

            debouncedFn();
            vi.advanceTimersByTime(50);
            expect(mockFn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('thisコンテキストが正しく渡されること', () => {
            const obj = {
                value: 42,
                getValue: vi.fn(function() {
                    return this.value;
                })
            };
            
            obj.debouncedGetValue = debounce(obj.getValue, 100);
            obj.debouncedGetValue();
            
            vi.advanceTimersByTime(100);
            expect(obj.getValue).toHaveBeenCalled();
        });
    });

    describe('generateId', () => {
        it('文字列を返すこと', () => {
            const id = generateId();
            expect(typeof id).toBe('string');
        });

        it('id-プレフィックスで始まること', () => {
            const id = generateId();
            expect(id.startsWith('id-')).toBe(true);
        });

        it('適切な長さのIDを生成すること', () => {
            const id = generateId();
            // 'id-' + 9文字 = 12文字
            expect(id.length).toBe(12);
        });

        it('複数回呼び出しで異なるIDを生成すること', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(generateId());
            }
            // 100回生成して、すべて異なるIDであることを確認
            expect(ids.size).toBe(100);
        });

        it('英数字のみで構成されること', () => {
            const id = generateId();
            // 'id-'の後の部分が英数字のみ
            const suffix = id.substring(3);
            expect(/^[a-z0-9]+$/.test(suffix)).toBe(true);
        });
    });

    describe('rgbToHex', () => {
        it('RGB形式をHEX形式に変換すること', () => {
            expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
            expect(rgbToHex('rgb(0, 255, 0)')).toBe('#00ff00');
            expect(rgbToHex('rgb(0, 0, 255)')).toBe('#0000ff');
        });

        it('黒色を正しく変換すること', () => {
            expect(rgbToHex('rgb(0, 0, 0)')).toBe('#000000');
        });

        it('白色を正しく変換すること', () => {
            expect(rgbToHex('rgb(255, 255, 255)')).toBe('#ffffff');
        });

        it('中間色を正しく変換すること', () => {
            expect(rgbToHex('rgb(128, 128, 128)')).toBe('#808080');
        });

        it('既にHEX形式の場合はそのまま返すこと', () => {
            expect(rgbToHex('#ff0000')).toBe('#ff0000');
            expect(rgbToHex('#000000')).toBe('#000000');
        });

        it('nullの場合はデフォルト値を返すこと', () => {
            expect(rgbToHex(null)).toBe('#000000');
        });

        it('undefinedの場合はデフォルト値を返すこと', () => {
            expect(rgbToHex(undefined)).toBe('#000000');
        });

        it('空文字列の場合はデフォルト値を返すこと', () => {
            expect(rgbToHex('')).toBe('#000000');
        });

        it('不正な形式の場合はそのまま返すこと', () => {
            expect(rgbToHex('invalid')).toBe('invalid');
            expect(rgbToHex('rgba(255, 0, 0, 0.5)')).toBe('rgba(255, 0, 0, 0.5)');
        });
    });
});


    describe('clamp', () => {
        it('値が範囲内の場合はそのまま返すこと', () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(0, 0, 10)).toBe(0);
            expect(clamp(10, 0, 10)).toBe(10);
        });

        it('値が最小値より小さい場合は最小値を返すこと', () => {
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(-100, 0, 10)).toBe(0);
        });

        it('値が最大値より大きい場合は最大値を返すこと', () => {
            expect(clamp(15, 0, 10)).toBe(10);
            expect(clamp(100, 0, 10)).toBe(10);
        });

        it('負の範囲でも正しく動作すること', () => {
            expect(clamp(-5, -10, -1)).toBe(-5);
            expect(clamp(-15, -10, -1)).toBe(-10);
            expect(clamp(0, -10, -1)).toBe(-1);
        });

        it('小数でも正しく動作すること', () => {
            expect(clamp(0.5, 0, 1)).toBe(0.5);
            expect(clamp(-0.5, 0, 1)).toBe(0);
            expect(clamp(1.5, 0, 1)).toBe(1);
        });
    });

    describe('rectsOverlap', () => {
        it('重なっている矩形に対してtrueを返すこと', () => {
            const rect1 = { x: 0, y: 0, width: 100, height: 100 };
            const rect2 = { x: 50, y: 50, width: 100, height: 100 };
            expect(rectsOverlap(rect1, rect2)).toBe(true);
        });

        it('完全に含まれる矩形に対してtrueを返すこと', () => {
            const rect1 = { x: 0, y: 0, width: 100, height: 100 };
            const rect2 = { x: 25, y: 25, width: 50, height: 50 };
            expect(rectsOverlap(rect1, rect2)).toBe(true);
        });

        it('離れている矩形に対してfalseを返すこと', () => {
            const rect1 = { x: 0, y: 0, width: 100, height: 100 };
            const rect2 = { x: 200, y: 200, width: 100, height: 100 };
            expect(rectsOverlap(rect1, rect2)).toBe(false);
        });

        it('辺が接している矩形に対してfalseを返すこと', () => {
            const rect1 = { x: 0, y: 0, width: 100, height: 100 };
            const rect2 = { x: 100, y: 0, width: 100, height: 100 };
            expect(rectsOverlap(rect1, rect2)).toBe(false);
        });

        it('水平方向のみ重なっている場合はfalseを返すこと', () => {
            const rect1 = { x: 0, y: 0, width: 100, height: 100 };
            const rect2 = { x: 50, y: 200, width: 100, height: 100 };
            expect(rectsOverlap(rect1, rect2)).toBe(false);
        });

        it('垂直方向のみ重なっている場合はfalseを返すこと', () => {
            const rect1 = { x: 0, y: 0, width: 100, height: 100 };
            const rect2 = { x: 200, y: 50, width: 100, height: 100 };
            expect(rectsOverlap(rect1, rect2)).toBe(false);
        });
    });

    describe('escapeHtml', () => {
        it('特殊文字をエスケープすること', () => {
            expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
            expect(escapeHtml('&')).toBe('&amp;');
            expect(escapeHtml('"')).toBe('&quot;');
            expect(escapeHtml("'")).toBe('&#39;');
        });

        it('複数の特殊文字を含む文字列をエスケープすること', () => {
            expect(escapeHtml('<div class="test">')).toBe('&lt;div class=&quot;test&quot;&gt;');
        });

        it('特殊文字を含まない文字列はそのまま返すこと', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });

        it('空文字列を処理できること', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('nullを処理できること', () => {
            expect(escapeHtml(null)).toBe('');
        });

        it('undefinedを処理できること', () => {
            expect(escapeHtml(undefined)).toBe('');
        });
    });

    describe('deepClone', () => {
        it('オブジェクトの深いコピーを作成すること', () => {
            const original = { a: 1, b: { c: 2 } };
            const cloned = deepClone(original);
            
            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned.b).not.toBe(original.b);
        });

        it('配列の深いコピーを作成すること', () => {
            const original = [1, [2, 3], { a: 4 }];
            const cloned = deepClone(original);
            
            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned[1]).not.toBe(original[1]);
            expect(cloned[2]).not.toBe(original[2]);
        });

        it('元のオブジェクトを変更してもコピーに影響しないこと', () => {
            const original = { a: 1, b: { c: 2 } };
            const cloned = deepClone(original);
            
            original.a = 100;
            original.b.c = 200;
            
            expect(cloned.a).toBe(1);
            expect(cloned.b.c).toBe(2);
        });

        it('nullを処理できること', () => {
            expect(deepClone(null)).toBe(null);
        });

        it('プリミティブ値を処理できること', () => {
            expect(deepClone(42)).toBe(42);
            expect(deepClone('hello')).toBe('hello');
            expect(deepClone(true)).toBe(true);
        });
    });
