// Hasim service worker – offline cache. © 2026 Prof. Hani Muhsen.
const CACHE = 'hasim-v2.0.0-37f85e58f3';
const FILES = ["./", "index.html", "manifest.webmanifest", "css/hasim.min.css", "js/hasim.min.js", "icons/icon-32.png", "icons/icon-192.png", "icons/icon-512.png"];
// precache bypasses the HTTP cache; only the application files and page navigations are cached
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
// old versions are removed; open windows are told that a new version is active (not on the first installation)
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => { const old = k.filter(x => x.startsWith('hasim-') && x !== CACHE);
  return Promise.all(old.map(x => caches.delete(x))).then(() => self.clients.claim()).then(() => old.length ? self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.postMessage({ type: 'hasim-updated', version: CACHE }))) : null); })));
const APP = new Set(FILES.map(f => new URL(f, self.registration.scope).pathname));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  const nav = r.mode === 'navigate', app = nav || APP.has(u.pathname);
  if (!app) return;                                   // documents and other files go to the network unchanged
  e.respondWith(caches.match(r, { ignoreSearch: nav }).then(hit => hit || fetch(r).then(res => { if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
    .catch(() => (nav ? caches.match('index.html') : Response.error()))));
});
