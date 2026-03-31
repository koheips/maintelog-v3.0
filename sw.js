/* maintelog sw v15 */
const CACHE_NAME = "maintelog-v15-2026-03-02";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // iOS Safari の強いHTTPキャッシュを避けるため、各アセットを cache: "reload" で取得してから保存
    await Promise.all(
      CORE_ASSETS.map(async (url) => {
        const req = new Request(url, { cache: "reload" });
        const res = await fetch(req);
        if (res && res.ok) {
          await cache.put(url, res.clone());
        }
      })
    );
  })());
});



self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => (key === CACHE_NAME ? Promise.resolve() : caches.delete(key)))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      const url = new URL(req.url);
      if (url.origin === location.origin && res.ok) {
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});