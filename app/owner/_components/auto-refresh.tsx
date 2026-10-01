"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const REFRESH_MS = 60_000;

function ago(updatedAt: string, now: number) {
  const minutes = Math.floor((now - Date.parse(updatedAt)) / 60_000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  return `${Math.floor(minutes / 60)} jam lalu`;
}

/**
 * Muat ulang data halaman tiap 1 menit selama tab terlihat, dan langsung
 * saat tab dibuka lagi atau internet tersambung. `updatedAt` = jam server
 * saat data dibuat, jadi "Update terakhir" tetap jujur kalau refresh gagal.
 */
export function AutoRefresh({ updatedAt }: { updatedAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.parse(updatedAt));
  const updatedAtRef = useRef(updatedAt);

  useEffect(() => {
    updatedAtRef.current = updatedAt;
  }, [updatedAt]);

  useEffect(() => {
    const refresh = () => startTransition(() => router.refresh());
    const stale = () => Date.now() - Date.parse(updatedAtRef.current) >= REFRESH_MS;

    const tick = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible" && stale()) refresh();
    }, 15_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      if (stale()) refresh();
    };
    const onOnline = () => refresh();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ash" aria-live="polite">
      <span>
        {pending ? "Memperbarui…" : `Update terakhir ${ago(updatedAt, Math.max(now, Date.parse(updatedAt)))}`}
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        className="min-h-11 rounded-button px-1 text-graphite underline underline-offset-4 hover:text-ink disabled:opacity-50"
      >
        Muat ulang
      </button>
    </div>
  );
}
