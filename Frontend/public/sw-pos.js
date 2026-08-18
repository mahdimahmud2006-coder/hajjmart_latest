const CACHE = "hajjmart-pos-shell-v1";
const SHELL = ["/admin/pos", "/pos.webmanifest", "/pos-icon.svg", "/images/products/travel-kit.svg", "/images/products/ihram-package.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("hajjmart-pos-shell-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.destination === "image") {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match("/images/products/travel-kit.svg")) || Response.error();
      }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/pos.webmanifest" || url.pathname === "/pos-icon.svg") {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    }));
    return;
  }

  const wantsPosDocument = url.pathname.startsWith("/admin/pos") &&
    (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html"));
  if (wantsPosDocument) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (!response.ok) throw new Error(`POS document returned ${response.status}`);
        cache.put("/admin/pos", response.clone());
        return response;
      } catch {
        return (await cache.match("/admin/pos")) || Response.error();
      }
    }));
  }
});
