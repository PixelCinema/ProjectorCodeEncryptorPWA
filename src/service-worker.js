const CACHE_NAME = 'hdcp-cache-v6';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './main.js',
  './manifest.json',
  './openssl.wasm',
  './openssl.js'
];

// نصب: فایل‌ها رو کش می‌کنیم
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// فعال‌سازی: کش‌های قدیمی پاک میشن
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// واکشی: فایل‌ها از کش یا شبکه
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});






