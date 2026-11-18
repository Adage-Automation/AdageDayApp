// Service worker: required by Chrome for the Install-App prompt, and keeps the
// app usable with weak or no signal at the venue.
const CACHE = "adage-day-2026-v2";

// Every page is saved on install, so Schedule, Contacts etc. open offline
// even if the user never visited them while online.
const PRECACHE = [
  "./",
  "index.html",
  "schedule.html",
  "message.html",
  "rules.html",
  "contacts.html",
  "guest.html",
  "announcements.html",
  "live_status.html",
  "manifest.json",
  "static/images/25-JGS.png",
  "static/images/25-JGS-icon.png",
  "static/images/md_photo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Firestore's live listener and sign-in calls are long-running streams or
// private data: never cache them. Everything else (our files, Tailwind,
// fonts, Firebase SDK) is network-first with the last copy as offline fallback.
const SKIP_HOSTS = /(^|\.)(firestore|identitytoolkit|securetoken)\.googleapis\.com$/;

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (SKIP_HOSTS.test(new URL(event.request.url).hostname)) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // "opaque" = cross-origin script/font loaded without CORS (e.g. Tailwind).
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: event.request.mode === "navigate" }))
  );
});
