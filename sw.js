const CACHE = 'fortress-v3.39.1';
const CORE = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-96.png',
  './sounds/shoot.mp3', './sounds/impact.mp3', './sounds/destroy.mp3', './sounds/place.mp3',
  './sounds/buy.mp3', './sounds/win.mp3', './sounds/lose.mp3',
  // ES-Module (v3.34.0, Phase 1 der Modularisierung) — müssen offline verfügbar sein
  './src/engine/const.js', './src/engine/economy.js', './src/engine/terrain.js',
  './src/engine/flood.js', './src/engine/progression.js', './src/engine/catalog.js',
  './src/i18n.js', './src/net/protocol.js', './src/net/matchmaking.js',
  './src/ui/icons.js', './src/render/sprites.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: immer neueste Version wenn online, Cache als Fallback
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('firebase') || url.includes('gstatic') || url.includes('unpkg') ||
      url.includes('googleapis') || !url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.status === 200 && r.type === 'basic') {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
