const CACHE_NAME = 'meraki-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/logo.png',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Ignorar peticiones que no sean HTTP/HTTPS (como extensiones de Chrome o esquemas locales)
  if (!e.request.url.startsWith('http')) return;

  const isAsset = e.request.url.includes('/assets/');

  if (isAsset) {
    // Para recursos estáticos inmutables en la carpeta assets, usar Cache First
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(e.request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  } else {
    // Para index.html y otros recursos, usar Network First
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (e.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
        })
    );
  }
});
