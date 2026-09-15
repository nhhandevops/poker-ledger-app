/* Poker Ledger — service worker (P31, P35). build-static.js thay 43223889be bằng mã băm của bản build,
 * nên MỖI lần publish là 1 service worker mới: tự tải vỏ app mới, xoá cache cũ.
 * Chiến lược:
 *  • Trang (index.html) — P35 MẠNG TRƯỚC: lấy bản mới từ mạng; mạng chậm quá 2,5s hoặc mất mạng thì trả bản đã lưu.
 *    (P31 trả bản lưu TRƯỚC ⇒ publish xong người chơi vẫn chạy code cũ tới lần mở sau — gặp thật 15/09/2026:
 *    PC vẫn hiện lỗi "Server trả về không đúng định dạng" của bản trước P33.) Bản mới luôn được lưu lại cho lúc offline.
 *  • Icon / manifest: lấy từ cache, thiếu thì mạng.
 *  • KHÔNG đụng yêu cầu khác nguồn (API Apps Script) và mọi yêu cầu không phải GET — dữ liệu luôn đi thẳng server.
 */
var CACHE = 'poker-ledger-43223889be';
var PAGE_TIMEOUT_MS = 2500;
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
    var cached = function () { return caches.open(CACHE).then(function (c) { return c.match('./index.html'); }); };
    var fresh = fetch(new Request('./index.html', { cache: 'no-cache' })).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { return c.put('./index.html', copy); });
      }
      return res;
    });
    e.waitUntil(fresh.then(function () {}, function () {}));   // mạng về muộn vẫn lưu bản mới cho lần sau
    e.respondWith(new Promise(function (resolve, reject) {
      var done = false;
      function finish(r) { if (!done && r) { done = true; resolve(r); } }
      var timer = setTimeout(function () { cached().then(finish); }, PAGE_TIMEOUT_MS);
      fresh.then(function (res) {
        if (res && res.ok) { clearTimeout(timer); finish(res); return; }
        cached().then(function (hit) { clearTimeout(timer); finish(hit || res); });
      }, function (err) {
        clearTimeout(timer);
        cached().then(function (hit) { if (hit) finish(hit); else if (!done) { done = true; reject(err); } });
      });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
});
