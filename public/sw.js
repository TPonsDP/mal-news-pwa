// Service Worker mínimo para habilitar el prompt "Instalar app" en Android.
// No cacheamos respuestas de /api/* (siempre van frescas a la red).

const CACHE_NAME = 'mal-news-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API: siempre red, nunca caché
  if (url.pathname.startsWith('/api/')) {
    return; // dejamos que el navegador maneje normal
  }

  // Estáticos: network-first con fallback a caché (PWA siempre actualizada al abrir online)
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
