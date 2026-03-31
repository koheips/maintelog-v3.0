/* maintelog sw v16b-2026-03-30 */
const CACHE_NAME = "maintelog-v16b-2026-03-30";
const CORE_ASSETS = [
  "./","./index.html","./app.js","./manifest.json",
  "./icon-192.png","./icon-512.png","./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(async url => {
      try {
        const res = await fetch(new Request(url, { cache:"reload" }));
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (_) {}
    }));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k===CACHE_NAME ? Promise.resolve() : caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    /* 同一オリジン: Stale-while-revalidate */
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request, { ignoreSearch:true });
      const fetchPromise = fetch(event.request).then(res => {
        if (res && res.ok) cache.put(event.request, res.clone());
        return res;
      }).catch(() => null);
      return cached || await fetchPromise || Response.error();
    })());
  } else {
    /* 外部: ネットワーク優先 */
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(event.request) || Response.error();
    }));
  }
});
