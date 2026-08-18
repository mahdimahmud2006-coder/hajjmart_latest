"use client";

import { useEffect } from "react";

export function PosServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw-pos.js", { scope: "/" }).then(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) return;
      // Prime resources that built the currently visible admin page so the POS
      // can reopen after an outage once it has been visited online at least once.
      const resources = performance.getEntriesByType("resource")
        .map((entry) => (entry as PerformanceResourceTiming).name)
        .filter((url) => url.startsWith(location.origin) && (url.includes("/_next/") || url.endsWith(".css") || url.endsWith(".js")));
      await Promise.allSettled(resources.map((url) => fetch(url, { cache: "reload" })));
      await fetch("/admin/pos", { cache: "reload", headers: { Accept: "text/html" } }).catch(() => undefined);
    }).catch(() => undefined);
  }, []);
  return null;
}
