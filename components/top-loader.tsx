"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Batas aman: bar hilang sendiri kalau tidak ada tanda selesai. */
const MAX_MS = 15_000;
/** Form yang tombolnya tidak pernah disabled dianggap selesai setelah ini. */
const QUICK_MS = 1_500;

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Pindah ke anchor di halaman yang sama bukan navigasi.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * Bar tipis di atas layar: muncul saat klik tautan internal atau kirim form,
 * hilang saat halaman baru tampil atau tombol form selesai memproses.
 */
export function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const stopRef = useRef<() => void>(() => {});

  // Halaman baru tampil: selesai.
  useEffect(() => {
    stopRef.current();
  }, [pathname, searchParams]);

  useEffect(() => {
    let timers: number[] = [];
    let poll: number | undefined;

    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
      if (poll) clearInterval(poll);
      poll = undefined;
      setActive(false);
    };
    stopRef.current = stop;

    const start = () => {
      stop();
      setActive(true);
      timers.push(window.setTimeout(stop, MAX_MS));
    };

    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) start();
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      // Form dengan method dialog atau target lain tidak memproses apa-apa di sini.
      if (form.method === "dialog") return;
      start();
      const submitter = event.submitter as HTMLButtonElement | null;
      if (!submitter) return;
      // Tombol form di Semai disabled selama diproses. Selesai saat aktif lagi
      // atau saat tombolnya hilang dari halaman (form diganti hasilnya).
      let seenBusy = false;
      poll = window.setInterval(() => {
        const busy = submitter.disabled || submitter.getAttribute("aria-busy") === "true";
        if (busy) seenBusy = true;
        if (!submitter.isConnected || (seenBusy && !busy)) stop();
      }, 120);
      timers.push(
        window.setTimeout(() => {
          if (!seenBusy) stop();
        }, QUICK_MS),
      );
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      stop();
    };
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="Memuat"
      aria-hidden={!active}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}
    >
      {active && <div className="loader-jalan h-full w-2/5 rounded-full bg-linear-to-r from-transparent via-accent to-accent shadow-[0_1px_0_rgb(0_0_0/0.12)]" />}
    </div>
  );
}
