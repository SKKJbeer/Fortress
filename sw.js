const CACHE = 'fortress-v1';
const CORE = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-96.png'];

// Beim ersten Laden: Core-Dateien cachen, sofort übernehmen
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

// Alte Caches löschen, sofort alle Clients übernehmen
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
  // Firebase, CDNs und externe Ressourcen nicht abfangen
  if (url.includes('firebase') || url.includes('gstatic') || url.includes('unpkg') ||
      url.includes('googleapis') || !url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        // Nur 200er cachen
        if (r && r.status === 200 && r.type === 'basic') {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
