import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DirtyStateManager } from '../src/managers/DirtyStateManager.js';
import { EventBus } from '../src/core/EventBus.js';

describe('DirtyStateManager (未保存変更管理・離脱ダイアログ)', () => {
    let eventBus;
    let manager;

    beforeEach(() => {
        eventBus = new EventBus();
        manager = new DirtyStateManager(eventBus);
    });

    afterEach(() => {
        if (manager) {
            manager.destroy();
        }
    });

    it('初期状態では未保存フラグが false であり、離脱イベントをインターセプトしないこと', () => {
        expect(manager.isDirty()).toBe(false);
        expect(manager.isSuspended()).toBe(false);

        // beforeunload イベントを発火させても preventDefault されないこと
        const event = new Event('beforeunload', { cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        window.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('markDirty() 呼び出しで isDirty が true になり、beforeunload で preventDefault が呼ばれること', () => {
        const dirtyListener = vi.fn();
        eventBus.on('dirty:changed', dirtyListener);

        manager.markDirty();

        expect(manager.isDirty()).toBe(true);
        expect(dirtyListener).toHaveBeenCalledWith(true);

        // beforeunload イベントを発火させてインターセプトを確認
        const event = new Event('beforeunload', { cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        window.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
    });

    it('既に dirty の状態で再度 markDirty() を呼んでも、イベントの重複発行やリスナー多重登録が起きないこと', () => {
        const dirtyListener = vi.fn();
        eventBus.on('dirty:changed', dirtyListener);

        manager.markDirty();
        manager.markDirty();

        expect(dirtyListener).toHaveBeenCalledTimes(1);
    });

    it('markClean() 呼び出しで isDirty が false になり、beforeunload リスナーが解除されること', () => {
        const dirtyListener = vi.fn();
        eventBus.on('dirty:changed', dirtyListener);

        manager.markDirty();
        expect(manager.isDirty()).toBe(true);

        manager.markClean();
        expect(manager.isDirty()).toBe(false);
        expect(dirtyListener).toHaveBeenCalledWith(false);

        // リスナー解除後の beforeunload 発火では preventDefault されないこと
        const event = new Event('beforeunload', { cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        window.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('suspend() 中は markDirty() を呼び出してもダーティ状態にならないこと（ファイル読み込み時の誤検知防止）', () => {
        manager.suspend();
        expect(manager.isSuspended()).toBe(true);

        manager.markDirty();
        expect(manager.isDirty()).toBe(false);

        // resume() すると再度検知可能になる
        manager.resume();
        expect(manager.isSuspended()).toBe(false);

        manager.markDirty();
        expect(manager.isDirty()).toBe(true);
    });

    it('resume(true) を呼ぶとサスペンド解除と同時にクリーン状態にリセットされること', () => {
        manager.markDirty();
        expect(manager.isDirty()).toBe(true);

        manager.suspend();
        manager.resume(true);

        expect(manager.isSuspended()).toBe(false);
        expect(manager.isDirty()).toBe(false);
    });

    it('destroy() を呼ぶとリスナーが解除されること', () => {
        manager.markDirty();
        manager.destroy();

        const event = new Event('beforeunload', { cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        window.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
});
