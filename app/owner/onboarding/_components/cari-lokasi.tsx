"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { HasilLokasi } from "@/app/api/cari-lokasi/route";
import type { Point } from "./location-map";

/**
 * Kotak cari alamat di atas peta. Bukan <form> sendiri (ada di dalam form
 * lokasi): Enter dan tombol Cari ditangani manual. Mencari hanya saat diminta,
 * bukan tiap ketikan (batas Nominatim ±1 permintaan per detik).
 */
export function CariLokasi({ onPick }: { onPick: (point: Point) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HasilLokasi[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    const q = query.trim();
    if (q.length < 3) {
      setMessage("Tulis minimal 3 huruf. Contoh: Pasar Baru Bandung.");
      setResults(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/cari-lokasi?q=${encodeURIComponent(q)}`);
      const body = (await response.json()) as { results?: HasilLokasi[]; message?: string };
      if (!response.ok) {
        setResults(null);
        setMessage(body.message ?? "Pencarian gagal. Coba lagi.");
        return;
      }
      const found = body.results ?? [];
      setResults(found);
      if (found.length === 0) {
        setMessage("Tempat tidak ditemukan. Coba nama jalan, nama tempat, atau tambahkan nama kota.");
      }
    } catch {
      setResults(null);
      setMessage("Tidak ada koneksi internet. Coba lagi, atau ketuk titik di peta.");
    } finally {
      setLoading(false);
    }
  }

  function choose(result: HasilLokasi) {
    onPick({ lat: result.lat, lng: result.lng });
    setResults(null);
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
              void search();
            }
          }}
          placeholder="Cari alamat atau nama tempat"
          aria-label="Cari alamat atau nama tempat"
          enterKeyHint="search"
          maxLength={120}
          className="min-h-11 w-full min-w-0 rounded-button border border-stone bg-canvas px-3.5 text-base text-ink placeholder:text-ash hover:border-ash focus:border-ink focus:outline-none"
        />
        <Button variant="secondary" arrow={false} onClick={() => void search()} disabled={loading} aria-busy={loading} className="shrink-0">
          {loading ? "Mencari…" : "Cari"}
        </Button>
      </div>
      {results && results.length > 0 && (
        <ul className="flex flex-col divide-y divide-stone overflow-hidden rounded-button border border-stone bg-canvas">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
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
