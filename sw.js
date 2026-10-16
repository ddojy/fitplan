/* FitPlan Service Worker
   策略：页面用 Network-First（保证更新后刷新立即拿到新版，离线时回退到缓存）；
   静态资源用 Cache-First + 版本化缓存名（SW 更新时自动换新缓存）。 */

const CACHE_PREFIX = 'fitplan-';
const CACHE = CACHE_PREFIX + 'v' + 2;
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.startsWith(CACHE_PREFIX) && k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只处理同源 GET；图片/AI 等跨域请求不强干涉（交由浏览器默认）
  if (url.origin !== self.location.origin) return;

  // 页面导航：Network-First
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // 其余资源：Cache-First
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});