const CACHE_NAME = 'ieditweb-v1';
const ASSETS = [
  './',
  './index.html',
  './src/main.js',
  './src/editor.js',
  './src/flowchart.js',
  './src/ui.js',
  './src/utils.js',
  './src/sanitizer.js',
  './src/storage.js',
  './src/search.js',
  './src/settings.js',
  './styles/main.css',
  './styles/editor.css',
  './styles/flowchart.css',
  './styles/search.css',
  './styles/settings.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
});
