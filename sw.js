// Offline-Speicher. VERSION muss zu version.json und APP_VERSION in js/app.js passen.
const VERSION = 'schrein-2.28.0';
const DATEIEN = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/kristallmine.js', 'js/kristallmine-ui.js', 'kristallmine/km.css', 'js/splitter.js', 'js/bildschirm.js', 'js/bildschirm-bild.js', 'js/lernplan.js', 'js/wochenplan.js', 'js/steinschieber.js', 'js/steinschieber-level.js', 'js/steinschieber-ui.js', 'js/steinschieber-tipp.js', 'steinschieber/ss.css', 'js/anleitungen.js', 'js/spielbilder.js', 'anleitung.css', 'hinweiskarten.css', 'js/hinweiskarten.js', 'formeluebersicht.css', 'js/formeluebersicht.js', 'data/formeluebersicht.json', 'js/runenfall.js', 'js/runenfall-ui.js', 'runenfall/rn.css', 'js/runenreihen.js', 'js/runenreihen-ui.js', 'js/runenreihen-steine.js', 'runenreihen/rr.css', 'js/hoehlenkarte.js', 'js/hoehlenkarte-ui.js', 'hoehlenkarte/hk.css', 'js/runenbrecher.js', 'js/runenbrecher-ui.js', 'runenbrecher/rb.css', 'js/jadeschlange.js', 'js/jadeschlange-ui.js', 'jadeschlange/jsg.css', 'js/logic.js', 'js/namen.js', 'js/paket.js', 'js/bloecke.js', 'js/einrichtung.js', 'js/render.js', 'js/store.js', 'js/gen.js', 'js/sync.js', 'js/physik.js', 'js/umformen.js', 'js/feedback.js', 'vendor/html2canvas.min.js', 'js/gen-physik.js', 'js/gefaerbt.js', 'js/sternzeit.js', 'js/uebungszeit-bild.js', 'sternzeit.css',
  'data/aufgaben.json', 'data/hinweise.json', 'data/logbuch.json', 'data/wissensarchiv.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den Browser-Zwischenspeicher, damit wirklich die neuen Dateien kommen
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(DATEIEN.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
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
  // Versionsdatei nie zwischenspeichern
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(url.href, { cache: 'no-store' }).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // Eigene Dateien: erst Netz (beim Server nachfragen, ob neu), sonst Speicher (offline)
  e.respondWith(fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
    if (res.ok) { const kopie = res.clone(); caches.open(VERSION).then(c => c.put(e.request, kopie)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
