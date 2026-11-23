// SİLİVRİ SERHENDİ - PWA Servis Çalışanı (Service Worker)
const CACHE_NAME = 'serhendi-cari-v1';
const STATIC_ASSETS = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.url.includes('/api/') || request.url.includes('/admin/')) {
    return;
  }
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});
