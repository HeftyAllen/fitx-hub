/* Cache only public app assets. Auth, API responses and member data stay out of Cache Storage. */
const FITX_BASE = new URL(self.registration.scope).pathname;
const fitxAsset = path => `${FITX_BASE}${path}`;
importScripts(new URL('offline-assets.js', self.registration.scope).href);
const FITX_CACHE_PREFIX = `fitx-shell-${encodeURIComponent(FITX_BASE)}-`;
const FITX_CACHE = `${FITX_CACHE_PREFIX}${self.FITX_BUILD}`;
const FITX_BRAND_CACHE = `fitx-public-brand-v1:${FITX_BASE}`;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(FITX_CACHE).then(cache => cache.addAll(self.FITX_ASSETS)));
  // Let existing tabs finish their session before a new build takes control.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(FITX_CACHE_PREFIX) && name !== FITX_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === fitxAsset('manifest.webmanifest')) {
    event.respondWith((async () => {
      const brand = await caches.open(FITX_BRAND_CACHE);
      return (await brand.match(fitxAsset('manifest.webmanifest'))) || (await (await caches.open(FITX_CACHE)).match(fitxAsset('manifest.webmanifest'))) || fetch(request);
    })());
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(FITX_CACHE)).match(fitxAsset('index.html')).then(response => response || Response.error())));
  } else if (self.FITX_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(FITX_CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
  }
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'FITX_BRAND') return;
  const brand = event.data.manifest;
  if (!brand || typeof brand.name !== 'string' || typeof brand.short_name !== 'string') return;
  const validColor = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);
  let logo;
  try { const url = new URL(brand.logo, self.location.origin); if (brand.logo && (url.protocol === 'https:' || (url.origin === self.location.origin && brand.logo.startsWith('/')))) logo = url.href; } catch { /* use default */ }
  const manifest = {
    name: brand.name.slice(0, 60), short_name: brand.short_name.slice(0, 20),
    description: typeof brand.description === 'string' ? brand.description.slice(0, 500) : '',
    theme_color: validColor(brand.theme_color) ? brand.theme_color : '#087f68',
    background_color: validColor(brand.background_color) ? brand.background_color : '#101714',
    display: 'standalone', start_url: FITX_BASE, scope: FITX_BASE,
    icons: logo ? [{ src: logo, sizes: 'any', purpose: 'any' }] : [{ src: fitxAsset('placeholder.svg'), sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
  event.waitUntil((async () => {
    const cache = await caches.open(FITX_BRAND_CACHE);
    await cache.put(fitxAsset('manifest.webmanifest'), new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json' } }));
    event.source?.postMessage({ type: 'FITX_BRAND_UPDATED' });
  })());
});
