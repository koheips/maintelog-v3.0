/* maintelog sw v18c-dev-20260402 */
const CACHE_NAME = "maintelog-dev-20260402";
const CORE_ASSETS = [
  "./","./index.html","./app.js","./manifest.json",
  "./icon-192.png","./icon-512.png","./apple-touch-icon.png"
];
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(async url => {
      try { const res = await fetch(new Request(url,{cache:"no-store"})); if(res&&res.ok) await cache.put(url,res.clone()); } catch(_){}
    }));
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request,{cache:"no-store"});
      if(res&&res.ok){ const cache=await caches.open(CACHE_NAME); cache.put(event.request,res.clone()); }
      return res;
    } catch(_) {
      const cache=await caches.open(CACHE_NAME);
      return await cache.match(event.request,{ignoreSearch:true})||Response.error();
    }
  })());
});
