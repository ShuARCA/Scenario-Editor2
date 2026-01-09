/**
 * EventBusクラスのユニットテスト
 * 
 * on、off、emitメソッドの動作確認
 * 複数リスナーの登録と解除のテスト
 * _要件: 設計書EventBus_
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/eventBus.js';

describe('EventBus', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
    });

    describe('on', () => {
        it('イベントリスナーを登録できること', () => {
            const callback = vi.fn();
            eventBus.on('test', callback);
            
            eventBus.emit('test', 'data');
            expect(callback).toHaveBeenCalledWith('data');
        });

        it('同じイベントに複数のリスナーを登録できること', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();
            
            eventBus.on('test', callback1);
            eventBus.on('test', callback2);
            eventBus.on('test', callback3);
            
            eventBus.emit('test', 'data');
            
            expect(callback1).toHaveBeenCalledWith('data');
            expect(callback2).toHaveBeenCalledWith('data');
            expect(callback3).toHaveBeenCalledWith('data');
        });

        it('異なるイベントに別々のリスナーを登録できること', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            eventBus.on('event1', callback1);
            eventBus.on('event2', callback2);
            
            eventBus.emit('event1', 'data1');
            
            expect(callback1).toHaveBeenCalledWith('data1');
            expect(callback2).not.toHaveBeenCalled();
        });
    });

    describe('off', () => {
        it('イベントリスナーを解除できること', () => {
            const callback = vi.fn();
            eventBus.on('test', callback);
            eventBus.off('test', callback);
            
            eventBus.emit('test', 'data');
            expect(callback).not.toHaveBeenCalled();
        });

        it('特定のリスナーのみ解除できること', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            eventBus.on('test', callback1);
            eventBus.on('test', callback2);
            eventBus.off('test', callback1);
            
            eventBus.emit('test', 'data');
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledWith('data');
        });

        it('存在しないイベントの解除を試みてもエラーにならないこと', () => {
            const callback = vi.fn();
            
            // エラーが発生しないことを確認
            expect(() => {
                eventBus.off('nonexistent', callback);
            }).not.toThrow();
        });

        it('登録されていないコールバックの解除を試みてもエラーにならないこと', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            eventBus.on('test', callback1);
            
            // callback2は登録されていないが、エラーにならない
            expect(() => {
                eventBus.off('test', callback2);
            }).not.toThrow();
            
            // callback1はまだ登録されている
            eventBus.emit('test', 'data');
            expect(callback1).toHaveBeenCalledWith('data');
        });
    });

    describe('emit', () => {
        it('登録されたリスナーにデータを渡すこと', () => {
            const callback = vi.fn();
            eventBus.on('test', callback);
            
            const testData = { key: 'value', num: 42 };
            eventBus.emit('test', testData);
            
            expect(callback).toHaveBeenCalledWith(testData);
        });

        it('リスナーが登録されていないイベントを発火してもエラーにならないこと', () => {
            expect(() => {
                eventBus.emit('nonexistent', 'data');
            }).not.toThrow();
        });

        it('リスナーが登録順に呼び出されること', () => {
            const order = [];
            const callback1 = vi.fn(() => order.push(1));
            const callback2 = vi.fn(() => order.push(2));
            const callback3 = vi.fn(() => order.push(3));
            
            eventBus.on('test', callback1);
            eventBus.on('test', callback2);
            eventBus.on('test', callback3);
            
            eventBus.emit('test', 'data');
            
            expect(order).toEqual([1, 2, 3]);
        });

        it('データなしでイベントを発火できること', () => {
            const callback = vi.fn();
            eventBus.on('test', callback);
            
            eventBus.emit('test');
            
            expect(callback).toHaveBeenCalledWith(undefined);
        });

        it('複数回イベントを発火できること', () => {
            const callback = vi.fn();
            eventBus.on('test', callback);
            
            eventBus.emit('test', 'first');
            eventBus.emit('test', 'second');
            eventBus.emit('test', 'third');
            
            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 'first');
            expect(callback).toHaveBeenNthCalledWith(2, 'second');
            expect(callback).toHaveBeenNthCalledWith(3, 'third');
        });
    });

    describe('複合シナリオ', () => {
        it('リスナーの登録・発火・解除・再発火が正しく動作すること', () => {
            const callback = vi.fn();
            
            // 登録
            eventBus.on('test', callback);
            
            // 発火
            eventBus.emit('test', 'first');
            expect(callback).toHaveBeenCalledTimes(1);
            
            // 解除
            eventBus.off('test', callback);
            
            // 再発火（呼ばれない）
            eventBus.emit('test', 'second');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('同じコールバックを複数回登録した場合、複数回呼び出されること', () => {
            const callback = vi.fn();
            
            eventBus.on('test', callback);
            eventBus.on('test', callback);
            
            eventBus.emit('test', 'data');
            
            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('editor:updateイベントが正しく動作すること', () => {
            // 設計書で定義されている主要イベントのテスト
            const callback = vi.fn();
            const headings = [
                { id: 'h1', text: '見出し1', level: 1 },
                { id: 'h2', text: '見出し2', level: 2 }
            ];
            
            eventBus.on('editor:update', callback);
            eventBus.emit('editor:update', headings);
            
            expect(callback).toHaveBeenCalledWith(headings);
        });

        it('editor:scrollToHeadingイベントが正しく動作すること', () => {
            // 設計書で定義されている主要イベントのテスト
            const callback = vi.fn();
            const headingId = 'heading-123';
            
            eventBus.on('editor:scrollToHeading', callback);
            eventBus.emit('editor:scrollToHeading', headingId);
            
            expect(callback).toHaveBeenCalledWith(headingId);
        });
    });
});
