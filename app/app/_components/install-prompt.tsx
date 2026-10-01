"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "hidden" | "android" | "ios";

/** Ajak pasang Semai ke layar utama (Android: tombol, iPhone: petunjuk). */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode("android");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      timer = setTimeout(() => setMode("ios"), 0);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (mode === "hidden") return null;

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
    setMode("hidden");
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-stone p-5">
      <div>
        <p className="font-medium text-ink">Pasang Semai di layar utama</p>
        <p className="mt-1 text-sm text-smoke">
          {mode === "android"
            ? "Buka absen dengan satu ketukan, tanpa mengetik alamat."
            : "Ketuk tombol Bagikan di Safari, lalu pilih Tambah ke Layar Utama."}
        </p>
      </div>
      {mode === "android" && (
        <Button variant="secondary" arrow={false} onClick={() => void install()} className="self-start">
          Pasang aplikasi
        </Button>
      )}
    </div>
  );
}
