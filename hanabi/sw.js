// 一筆花火2 のアプリ化（PWA・Microsoft Store 用）。いつもネットを先に読み、つながらないときだけ取っておいた分で動く。
// 先に取っておく分を読むと、更新した JS と古い JS が混ざって壊れるので、キャッシュは「つながらないときの控え」だけ。
const CACHE = 'hanabi2-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // ランキング・字形など外は触らない
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || Response.error())));
});
