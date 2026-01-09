/**
 * PWA機能のユニットテスト
 * 
 * 要件 12.1: PWAとしてインストール可能
 * 要件 12.2: オフラインキャッシュ機能
 * 要件 12.3: オフライン状態でのドキュメント編集・保存
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('PWA機能', () => {
    describe('Service Worker', () => {
        let swContent;
        
        beforeEach(() => {
            // Service Workerファイルの内容を読み込み
            swContent = readFileSync(resolve(__dirname, '../../service-worker.js'), 'utf-8');
        });
        
        it('キャッシュ名が定義されている', () => {
            expect(swContent).toContain('CACHE_NAME');
            expect(swContent).toMatch(/CACHE_NAME\s*=\s*['"]ieditweb-v\d+['"]/);
        });
        
        it('必要なアセットがキャッシュリストに含まれている', () => {
            // 必須ファイル
            const requiredAssets = [
                'index.html',
                'manifest.json',
                'main.js',
                'editor.js',
                'flowchart.js',
                'storage.js',
                'main.css',
                'editor.css',
                'flowchart.css'
            ];
            
            requiredAssets.forEach(asset => {
                expect(swContent).toContain(asset);
            });
        });
        
        it('installイベントハンドラが定義されている', () => {
            expect(swContent).toContain("addEventListener('install'");
            expect(swContent).toContain('caches.open');
            expect(swContent).toContain('cache.addAll');
        });
        
        it('fetchイベントハンドラが定義されている', () => {
            expect(swContent).toContain("addEventListener('fetch'");
            expect(swContent).toContain('caches.match');
        });
        
        it('activateイベントハンドラが定義されている', () => {
            expect(swContent).toContain("addEventListener('activate'");
            expect(swContent).toContain('caches.keys');
            expect(swContent).toContain('caches.delete');
        });
        
        it('キャッシュファースト戦略が実装されている', () => {
            // キャッシュにヒットした場合はキャッシュから返す
            expect(swContent).toContain('cachedResponse');
            // キャッシュにない場合はネットワークから取得
            expect(swContent).toContain('fetch(event.request)');
        });
        
        it('古いキャッシュの削除ロジックが含まれている', () => {
            expect(swContent).toContain('key !== CACHE_NAME');
            expect(swContent).toContain('caches.delete');
        });
    });
    
    describe('マニフェスト', () => {
        let manifest;
        
        beforeEach(() => {
            // マニフェストファイルを読み込み
            const manifestContent = readFileSync(resolve(__dirname, '../../manifest.json'), 'utf-8');
            manifest = JSON.parse(manifestContent);
        });
        
        it('アプリ名が定義されている', () => {
            expect(manifest.name).toBeDefined();
            expect(manifest.name.length).toBeGreaterThan(0);
        });
        
        it('短縮名が定義されている', () => {
            expect(manifest.short_name).toBeDefined();
            expect(manifest.short_name).toBe('iEditWeb');
        });
        
        it('開始URLが定義されている', () => {
            expect(manifest.start_url).toBeDefined();
            expect(manifest.start_url).toContain('index.html');
        });
        
        it('表示モードがstandaloneに設定されている', () => {
            expect(manifest.display).toBe('standalone');
        });
        
        it('背景色が定義されている', () => {
            expect(manifest.background_color).toBeDefined();
            expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
        
        it('テーマカラーが定義されている', () => {
            expect(manifest.theme_color).toBeDefined();
            expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
        
        it('アイコンが定義されている', () => {
            expect(manifest.icons).toBeDefined();
            expect(Array.isArray(manifest.icons)).toBe(true);
            expect(manifest.icons.length).toBeGreaterThan(0);
        });
        
        it('192x192サイズのアイコンが含まれている', () => {
            const icon192 = manifest.icons.find(icon => icon.sizes.includes('192'));
            expect(icon192).toBeDefined();
            expect(icon192.type).toBe('image/png');
        });
        
        it('512x512サイズのアイコンが含まれている', () => {
            const icon512 = manifest.icons.find(icon => icon.sizes.includes('512'));
            expect(icon512).toBeDefined();
            expect(icon512.type).toBe('image/png');
        });
        
        it('言語が日本語に設定されている', () => {
            expect(manifest.lang).toBe('ja');
        });
    });
    
    describe('index.html PWA設定', () => {
        let htmlContent;
        
        beforeEach(() => {
            htmlContent = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');
        });
        
        it('マニフェストへのリンクが含まれている', () => {
            expect(htmlContent).toContain('rel="manifest"');
            expect(htmlContent).toContain('manifest.json');
        });
        
        it('Service Worker登録コードが含まれている', () => {
            expect(htmlContent).toContain('serviceWorker');
            expect(htmlContent).toContain('register');
            expect(htmlContent).toContain('service-worker.js');
        });
        
        it('Service Worker対応チェックが含まれている', () => {
            expect(htmlContent).toContain("'serviceWorker' in navigator");
        });
        
        it('theme-colorメタタグが含まれている', () => {
            expect(htmlContent).toContain('name="theme-color"');
            expect(htmlContent).toMatch(/content="#[0-9a-fA-F]{6}"/);
        });
        
        it('descriptionメタタグが含まれている', () => {
            expect(htmlContent).toContain('name="description"');
        });
        
        it('Apple PWA対応メタタグが含まれている', () => {
            expect(htmlContent).toContain('apple-mobile-web-app-capable');
            expect(htmlContent).toContain('apple-mobile-web-app-status-bar-style');
            expect(htmlContent).toContain('apple-mobile-web-app-title');
            expect(htmlContent).toContain('apple-touch-icon');
        });
    });
});
