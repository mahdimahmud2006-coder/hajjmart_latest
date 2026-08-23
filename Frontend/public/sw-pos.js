const CACHE = "hajjmart-commerce-shell-v2";
const SHELL = ["/admin/pos", "/admin/social-commerce", "/pos.webmanifest", "/pos-icon.svg", "/images/products/travel-kit.svg", "/images/products/ihram-package.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => (key.startsWith("hajjmart-pos-shell-") || key.startsWith("hajjmart-commerce-shell-")) && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
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

  const commerceShell = url.pathname.startsWith("/admin/pos")
    ? "/admin/pos"
    : url.pathname.startsWith("/admin/social-commerce") ? "/admin/social-commerce" : null;
  const wantsCommerceDocument = commerceShell &&
    (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html"));
  if (wantsCommerceDocument) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (!response.ok) throw new Error(`Commerce document returned ${response.status}`);
        cache.put(commerceShell, response.clone());
        return response;
      } catch {
        return (await cache.match(commerceShell)) || Response.error();
      }
    }));
  }
});
