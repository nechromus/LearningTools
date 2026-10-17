// Offline-Speicher. Bei jeder neuen Version VERSION erhöhen.
const VERSION = 'schrein-1.1.0';
const DATEIEN = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/logic.js', 'js/render.js', 'js/store.js', 'js/gen.js',
  'data/aufgaben.json', 'data/hinweise.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Schriften: erst aus dem Speicher
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Eigene Dateien: erst Netz (immer aktuell), sonst Speicher (offline)
  e.respondWith(fetch(e.request).then(res => {
    const kopie = res.clone();
    caches.open(VERSION).then(c => c.put(e.request, kopie));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
