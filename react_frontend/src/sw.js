import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache all static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Cache Google Fonts stylesheets (StaleWhileRevalidate — ok if offline with no cache)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Cache Google Fonts webfont files
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Cache API GET requests — network-first with 5s timeout
registerRoute(
  /\/api\/.*/i,
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 5,
  })
);

// Cache product/storage images from backend
registerRoute(
  /\/storage\/.*/i,
  new CacheFirst({
    cacheName: 'storage-images-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Graceful fallback: if any route handler fails (e.g. offline + no cache), return empty response
setCatchHandler(async ({ request }) => {
  if (request.destination === 'style') {
    return new Response('', { headers: { 'Content-Type': 'text/css' } });
  }
  if (request.destination === 'font') {
    return new Response('', { headers: { 'Content-Type': 'font/woff2' } });
  }
  return Response.error();
});

// Auto-activate new service worker immediately (no waiting)
self.skipWaiting();

// Take control of all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Also listen for skip waiting messages from the client (backward compat)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
