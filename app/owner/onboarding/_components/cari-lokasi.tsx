"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HasilLokasi } from "@/app/api/cari-lokasi/route";
import type { Point } from "./location-map";

/** Jeda setelah berhenti mengetik sebelum mencari (hemat permintaan ke layanan peta). */
const DEBOUNCE_MS = 500;

/**
 * Kotak cari alamat di atas peta. Hasil muncul sambil mengetik (minimal 3
 * huruf), atau lewat tombol Cari / Enter. Bukan <form> sendiri karena ada di
 * dalam form lokasi.
 */
export function CariLokasi({ onPick }: { onPick: (point: Point) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HasilLokasi[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hasil yang baru dipilih mengisi kotak cari: jangan langsung dicari ulang.
  const skipNextRef = useRef(false);

  async function search(raw: string) {
    const q = raw.trim();
    if (q.length < 3) {
      setResults(null);
      setMessage(q.length > 0 ? "Tulis minimal 3 huruf. Contoh: Pasar Baru Bandung." : null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/cari-lokasi?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      const body = (await response.json()) as { results?: HasilLokasi[]; message?: string };
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setResults(null);
        setMessage(body.message ?? "Pencarian gagal. Coba lagi.");
        return;
      }
      const found = body.results ?? [];
      setResults(found);
      if (found.length === 0) {
        setMessage("Tempat tidak ditemukan. Coba nama jalan atau nama tempat, lalu tambahkan nama kota.");
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setResults(null);
      setMessage("Tidak ada koneksi internet. Coba lagi, atau ketuk titik di peta.");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }

  // Cari otomatis setelah berhenti mengetik.
  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 3) return;
    timerRef.current = setTimeout(() => void search(query), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function searchNow() {
    if (timerRef.current) clearTimeout(timerRef.current);
    void search(query);
  }

  function choose(result: HasilLokasi) {
    abortRef.current?.abort();
    skipNextRef.current = true;
    setQuery(result.name.split(",")[0] ?? result.name);
    onPick({ lat: result.lat, lng: result.lng });
    setResults(null);
    setLoading(false);
    setMessage("Titik dipindah ke hasil pencarian. Ketuk peta untuk menggeser kalau kurang pas.");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              searchNow();
            }
          }}
          placeholder="Cari alamat atau nama tempat"
          aria-label="Cari alamat atau nama tempat"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={120}
          className="min-h-11 w-full min-w-0 rounded-button border border-stone bg-canvas px-3.5 text-base text-ink placeholder:text-ash hover:border-ash focus:border-ink focus:outline-none"
        />
        <Button variant="secondary" arrow={false} onClick={searchNow} disabled={loading} aria-busy={loading} className="shrink-0">
          {loading ? "Mencari…" : "Cari"}
        </Button>
      </div>
      {results && results.length > 0 && (
        <ul className="flex flex-col divide-y divide-stone overflow-hidden rounded-button border border-stone bg-canvas">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng},${result.name}`}>
              <button
                type="button"
                onClick={() => choose(result)}
                className="flex min-h-11 w-full items-center px-3.5 py-2.5 text-left text-sm text-ink hover:bg-taupe"
              >
                {result.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p className="text-sm text-smoke" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
