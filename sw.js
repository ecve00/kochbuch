// Service Worker: hält die App-Dateien vor, damit das Kochbuch auch ohne Netz startet.
// Bei jeder Änderung an den App-Dateien VERSION erhöhen.
const VERSION = 'kochbuch-v7';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/config.js', 'js/store.js', 'js/state.js', 'js/util.js', 'js/wake.js', 'js/demo.js',
  'js/views/recipes.js', 'js/views/menus.js', 'js/views/shopping.js', 'js/views/cook.js', 'js/views/account.js', 'js/views/home.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Eigene Dateien, die Supabase-Bibliothek und das Foto der Startseite: zuerst Netz, sonst Zwischenspeicher.
// Datenbank-Anfragen an Supabase laufen nie über den Zwischenspeicher.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const own = url.origin === location.origin;
  const lib = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'images.unsplash.com';
  if (!own && !lib) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: own }).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
