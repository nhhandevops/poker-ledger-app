/* Poker Ledger — service worker (P31). build-static.js thay 50daf700e3 bằng mã băm của bản build,
 * nên MỖI lần publish là 1 service worker mới: tự tải vỏ app mới, xoá cache cũ.
 * Chiến lược:
 *  • Trang (index.html): trả bản đã lưu NGAY (mở tức thì), đồng thời tải bản mới về lưu cho lần sau.
 *  • Icon / manifest: lấy từ cache, thiếu thì mạng.
 *  • KHÔNG đụng yêu cầu khác nguồn (API Apps Script) và mọi yêu cầu không phải GET — dữ liệu luôn đi thẳng server.
 */
var CACHE = 'poker-ledger-50daf700e3';
var SHELL = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('poker-ledger-') === 0 && k !== CACHE) return caches.delete(k);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // API Apps Script & mọi thứ khác nguồn: để trình duyệt tự lo

  var isPage = req.mode === 'navigate' || url.pathname.slice(-1) === '/' || url.pathname.slice(-11) === '/index.html';
  if (isPage) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match('./index.html').then(function (cached) {
        var fresh = fetch(new Request('./index.html', { cache: 'no-cache' }))
          .then(function (res) { if (res && res.ok) c.put('./index.html', res.clone()); return res; })
          .catch(function () { return cached; });
        if (cached) { e.waitUntil(fresh.then(function () {}, function () {})); return cached; }
        return fresh;
      });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
});
