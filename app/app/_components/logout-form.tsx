"use client";

import { keluarKaryawan } from "../actions";

/** Keluar + hapus salinan halaman di service worker (HP bisa dipakai bergantian). */
export function LogoutForm({ className }: { className: string }) {
  function clearPageCache() {
    if (!("caches" in window)) return;
    void caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("semai-pages-")).map((key) => caches.delete(key))),
      );
  }

  return (
    <form action={keluarKaryawan} onSubmit={clearPageCache}>
      <button type="submit" className={className}>
        Keluar
      </button>
    </form>
  );
}
