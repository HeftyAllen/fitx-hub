/* Cache only public app assets. Auth, API responses and member data stay out of Cache Storage. */
importScripts('/offline-assets.js');
const FITX_CACHE = `fitx-shell-${self.FITX_BUILD}`;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(FITX_CACHE).then(cache => cache.addAll(self.FITX_ASSETS)));
  // Let existing tabs finish their session before a new build takes control.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('fitx-shell-') && name !== FITX_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(FITX_CACHE)).match('/index.html').then(response => response || Response.error())));
  } else if (self.FITX_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(FITX_CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
  }
});
