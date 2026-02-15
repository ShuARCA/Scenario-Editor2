/**
 * iEditWeb Service Worker
 * オフラインキャッシュとPWA機能を提供
 * 
 * 要件 12.1: PWAとしてインストール可能
 * 要件 12.2: オフライン状態でService Workerによりキャッシュされたリソースを使用
 * 要件 12.3: オフライン状態でのドキュメント編集・保存をサポート
 */

const CACHE_NAME = 'ieditweb-v2';
const ASSETS = [
  // ルートファイル
  './',
  './index.html',
  './manifest.json',

  // JavaScriptモジュール
  './src/main.js',
  './src/editor.js',
  './src/flowchart.js',
  './src/ui.js',
  './src/utils.js',
  './src/sanitizer.js',
  './src/storage.js',
  './src/search.js',
  './src/settings.js',
  './src/eventBus.js',
  './src/config.js',

  // スタイルシート
  './styles/main.css',
  './styles/editor.css',
  './styles/flowchart.css',
  './styles/search.css',
  './styles/settings.css',

  // ライブラリ
  './assets/lib/jszip.min.js',
  './assets/lib/FileSaver.min.js',

  // アイコン
  './icon/icon.png'
];

/**
 * インストールイベント
 * すべてのアセットをキャッシュに追加
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] キャッシュを開きました');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] すべてのアセットをキャッシュしました');
        // 新しいService Workerを即座にアクティブ化
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] キャッシュ追加エラー:', error);
      })
  );
});

/**
 * フェッチイベント
 * キャッシュファースト戦略：キャッシュにあればキャッシュから、なければネットワークから取得
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(event.request.url);
  } catch (_error) {
    return;
  }

  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache))
            .catch((cacheError) => {
              console.warn('[Service Worker] Failed to cache request:', event.request.url, cacheError);
            });

          return networkResponse;
        });
      })
      .catch((error) => {
        console.warn('[Service Worker] Fetch handler failed:', event.request.url, error);
        return Response.error();
      })
  );
});

/**
 * アクティベートイベント
 * 古いキャッシュを削除
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keyList) => {
        return Promise.all(
          keyList.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[Service Worker] 古いキャッシュを削除:', key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] アクティベート完了');
        // 新しいService Workerがすべてのクライアントを制御
        return self.clients.claim();
      })
  );
});
