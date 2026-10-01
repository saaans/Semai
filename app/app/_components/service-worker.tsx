"use client";

import { useEffect } from "react";

/** Daftarkan service worker untuk area karyawan (PWA + buka saat offline). */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/app" }).catch((error) => {
      console.warn("[sw] gagal didaftarkan", error);
    });
  }, []);
  return null;
}
