const CACHE = 'ssr-pixel-v6';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/cars.js',
  './js/cars-draw.js',
  './js/audio.js',
  './js/game.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isNav = e.request.mode === 'navigate';
  const isCode = /\.(js|css|html)$/.test(url.pathname);
  if (isNav || isCode) {
    // network-first so GitHub Pages updates stick
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
