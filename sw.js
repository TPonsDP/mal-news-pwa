// ============ MAL NEWS · SERVICE WORKER ============
// Sube CACHE_VERSION cada vez que despliegues algo que deba llegar sí o sí al móvil.
// Ese número es lo único que invalida la caché anterior.
const CACHE_VERSION = 'mal-news-v4';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

// Solo el esqueleto. Los paquetes de Vite llevan hash en el nombre y cambian en cada
// despliegue, así que no se pueden precargar por nombre: se guardan al usarse.
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/mal-news-logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll falla entero si un archivo da 404, así que se piden de uno en uno.
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    // Sin esto, el service worker nuevo se queda esperando a que cierres TODAS las
    // pestañas y la app. Es la causa del clásico "he desplegado y no cambia nada".
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => !n.startsWith(CACHE_VERSION)).map(n => caches.delete(n))
    );
    // Toma el control de las pestañas ya abiertas sin esperar a que se recarguen.
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) La API NUNCA se cachea. Un briefing servido de caché es un briefing viejo.
  if (url.pathname.startsWith('/api/')) return;

  // 2) Navegación: red primero. Si hay red, siempre ves la versión desplegada;
  //    si no la hay, se sirve el index guardado y la app arranca sin conexión.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch (_) {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // 3) Paquetes con hash de Vite: caché primero. El nombre cambia en cada despliegue,
  //    así que servirlos de caché no puede devolver contenido obsoleto.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const fresh = await fetch(req);
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })());
    return;
  }

  // 4) Iconos, manifest y demás estáticos de nombre fijo: se sirve la copia guardada
  //    y se refresca por detrás, así que el cambio entra en la visita siguiente.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const hit = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || network;
  })());
});

// Permite forzar la activación desde la app, si algún día quieres un aviso de
// "hay una versión nueva, pulsa para recargar".
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
