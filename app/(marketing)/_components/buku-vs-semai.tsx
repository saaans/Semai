import { Caveat } from "next/font/google";
import { Tag } from "@/components/ui/tag";

const tulisan = Caveat({ subsets: ["latin"], weight: ["400", "600"], display: "swap" });

const BUKU = [
  { nama: "Dimas", jam: "7.00", paraf: "D" },
  { nama: "Sari", jam: "7.00", paraf: "S", catatan: "jam aslinya?" },
  { nama: "Andi", jam: "7.00", paraf: "A", catatan: "diisi Rudi?" },
  { nama: "Rudi", jam: "7.00", paraf: "R" },
];

/** Perbandingan buku absen (mudah dititip) dengan absen Semai. */
export function BukuVsSemai() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <figure className="relative overflow-hidden rounded-card bg-taupe p-5 sm:p-6">
        <figcaption className="text-sm text-smoke">Sebelum: buku absen</figcaption>
        <div
          className={`${tulisan.className} relative mt-4 rounded-button bg-canvas px-5 pt-3 pb-4 text-2xl text-graphite`}
          style={{
            backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 39px, var(--stone) 39px 40px)",
            backgroundPosition: "0 12px",
          }}
        >
          <span aria-hidden className="absolute inset-y-0 left-12 w-px bg-danger/30" />
          <ul className="flex flex-col">
            {BUKU.map((b) => (
              <li key={b.nama} className="flex h-10 items-center gap-4 pl-10">
                <span className="w-16">{b.nama}</span>
                <span className="w-12">{b.jam}</span>
                <span className="font-semibold">{b.paraf}</span>
                {b.catatan && <span className="ml-auto -rotate-3 text-lg whitespace-nowrap text-danger sm:text-xl">{b.catatan}</span>}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-sm text-smoke">
          Semua tertulis 7.00. Paraf bisa dititip, rekap akhir bulan makan satu malam.
        </p>
      </figure>

      <figure className="rounded-card bg-ink p-5 text-canvas sm:p-6">
        <figcaption className="text-sm text-ash">Sesudah: absen Semai</figcaption>
        <ul className="mt-4 flex flex-col divide-y divide-graphite/40 rounded-button border border-graphite/40">
          {[
            { nama: "Dimas", jam: "06.54", tag: <Tag tone="neutral">Masuk</Tag>, info: "Selfie · 32 m" },
            { nama: "Sari", jam: "07.12", tag: <Tag tone="accent">Telat 12 mnt</Tag>, info: "Selfie · 18 m" },
            { nama: "Andi", jam: "–", tag: <Tag tone="outline" className="border-graphite text-ash">Izin</Tag>, info: "Sakit, ada surat" },
            { nama: "Rudi", jam: "07.31", tag: <Tag tone="accent">Telat 31 mnt</Tag>, info: "Selfie · 41 m" },
          ].map((r) => (
            <li key={r.nama} className="grid h-14 grid-cols-[1fr_auto_auto] items-center gap-3 px-4">
              <span className="min-w-0">
                <span className="block font-medium">{r.nama}</span>
                <span className="block truncate text-xs text-ash">{r.info}</span>
              </span>
              <span className="font-mono text-sm tabular-nums">{r.jam}</span>
              <span className="flex w-24 justify-end">{r.tag}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ash">
          Jam dari server, wajah dari kamera, lokasi dari GPS. Tidak ada yang bisa dititip.
        </p>
      </figure>
    </div>
  );
}
