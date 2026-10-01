"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Muat ulang halaman tiap 5 detik (maksimal 2 menit) selama menunggu konfirmasi bayar. */
export function RefreshSoon() {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 120_000) {
        clearInterval(timer);
        return;
      }
      if (document.visibilityState === "visible") router.refresh();
    }, 5_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
