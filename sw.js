// Minimal service worker: required by Chrome for the Install-App prompt to fire,
// and gives a basic "last seen" offline fallback via runtime caching.
const CACHE = "adage-day-2026-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first so live scores/announcements are never served stale while online;
// falls back to the last cached copy only when the network request fails.
self.addEventListener("fetch", (event) => {
  // Only our own files. Firebase/Firestore, Tailwind and font requests go
  // straight to the network: Firestore's live listener is a long-running
  // stream that must never be cloned into the cache.
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
