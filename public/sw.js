/*
 * Service worker Semai (area karyawan, scope /app).
 * - Aset statis Next (/_next/static) disimpan: cache-first.
 * - Halaman /app: network-first, simpan salinan terakhir supaya aplikasi
 *   tetap terbuka saat sinyal hilang (absen masuk antrean di IndexedDB).
 * - /api dan request selain GET tidak pernah disimpan.
 */
const VERSION = "v1";
const STATIC_CACHE = `semai-static-${VERSION}`;
const PAGE_CACHE = `semai-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("semai-") && ![STATIC_CACHE, PAGE_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAppPage(url) {
  return url.pathname === "/app" || url.pathname.startsWith("/app/");
}

/** Halaman masuk/aktivasi tidak disimpan; sesi habis = hapus salinan halaman. */
function isPublicPage(url) {
  return url.pathname.startsWith("/app/masuk") || url.pathname.startsWith("/app/aktivasi");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate" && isAppPage(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const finalUrl = new URL(response.url || request.url);
          if (isPublicPage(finalUrl)) {
            // Keluar atau sesi habis: jangan tampilkan data karyawan lama saat offline.
            caches.delete(PAGE_CACHE);
          } else if (response.ok && !isPublicPage(url)) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(url.pathname + url.search, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(PAGE_CACHE);
          return (
            (await cache.match(url.pathname + url.search)) ||
            (await cache.match("/app")) ||
            (await caches.match(OFFLINE_URL))
          );
        }),
    );
  }
});
