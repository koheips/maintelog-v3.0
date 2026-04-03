/* maintelog sw v17-20260401
   ネットワーク優先（Network First）戦略
   - 常に最新ファイルをネットワークから取得
   - オフライン時のみキャッシュにフォールバック
   - 古いキャッシュは全て削除
*/
const CACHE_NAME = "maintelog-v17-20260401";
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
        const res = await fetch(new Request(url, { cache:"no-store" }));
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (_) {}
    }));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // 旧キャッシュを全て削除
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network First: 常にネットワークを優先、失敗時のみキャッシュ
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request, { cache:"no-store" });
      if (res && res.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, res.clone());
      }
      return res;
    } catch (_) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request, { ignoreSearch:true });
      return cached || Response.error();
    }
  })());
});
