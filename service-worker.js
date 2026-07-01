const CACHE_NAME = "poolz-dose-v27";
const ASSET_VERSION = "20260701-pool-ez-logo";
const APP_SHELL = [
  "./",
  "./index.html",
  `./styles.css?v=${ASSET_VERSION}`,
  `./app.js?v=${ASSET_VERSION}`,
  `./manifest.webmanifest?v=${ASSET_VERSION}`,
  `./assets/poolz-logo.png?v=${ASSET_VERSION}`,
  `./assets/app-icon-32.png?v=${ASSET_VERSION}`,
  `./assets/app-icon-180.png?v=${ASSET_VERSION}`,
  `./assets/app-icon-192.png?v=${ASSET_VERSION}`,
  `./assets/app-icon-512.png?v=${ASSET_VERSION}`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))))
    )
  );
  self.clients.claim();
});

function networkFirst(request, fallbackUrl) {
  return fetch(request)
    .then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || caches.match(fallbackUrl)));
}

function cacheFirst(request) {
  return caches.match(request).then((cached) =>
    cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isLocalAsset = url.origin === self.location.origin;
  const isFreshAsset =
    event.request.mode === "navigate"
    || url.pathname.endsWith("/index.html")
    || url.pathname.endsWith("/app.js")
    || url.pathname.endsWith("/styles.css")
    || url.pathname.endsWith("/manifest.webmanifest");

  if (isLocalAsset && isFreshAsset) {
    event.respondWith(networkFirst(event.request, "./index.html"));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
