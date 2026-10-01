import { KehadiranBar } from "@/components/kehadiran-bar";
import { Tag } from "@/components/ui/tag";

type Baris = {
  nama: string;
  posisi: string;
  jam: string | null;
  status: React.ReactNode;
};

// Contoh pagi di sebuah kafe, jadwal masuk 07.00.
const BARIS: Baris[] = [
  { nama: "Dimas", posisi: "Barista", jam: "06.54", status: <Tag>Masuk</Tag> },
  { nama: "Wulan", posisi: "Barista", jam: "06.58", status: <Tag>Masuk</Tag> },
  { nama: "Sari", posisi: "Kasir", jam: "07.12", status: <Tag tone="accent">Telat 12 mnt</Tag> },
  { nama: "Andi", posisi: "Dapur", jam: null, status: <Tag tone="outline">Izin</Tag> },
  { nama: "Rudi", posisi: "Dapur", jam: null, status: <Tag tone="ink">Belum absen</Tag> },
];

const JEDA_MS = 350;

/**
 * Papan absen contoh di hero: tampilan yang sama dengan dashboard owner,
 * baris muncul satu per satu seperti karyawan yang baru absen.
 */
export function PapanHero() {
  return (
    <figure className="rounded-card bg-taupe p-5 sm:p-6" aria-label="Contoh papan absen pagi ini di sebuah kafe">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">Kopi Senja</p>
        <p className="text-sm text-smoke">Pagi ini · jadwal masuk 07.00</p>
      </div>

      <p className="mt-5 font-display text-3xl tracking-tight">3 dari 5 sudah absen</p>
      <div className="mt-3 absen-masuk" style={{ animationDelay: `${BARIS.length * JEDA_MS + 150}ms` }}>
        <KehadiranBar data={{ tepat: 2, telat: 1, izin: 1, lainnya: 0, belum: 1 }} legend={false} />
      </div>

      <ul className="mt-5 flex flex-col divide-y divide-stone border-t border-stone">
        {BARIS.map((b, i) => (
          <li
            key={b.nama}
            className="absen-masuk grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 last:pb-0"
            style={{ animationDelay: `${i * JEDA_MS}ms` }}
          >
            <span className="min-w-0 truncate">
              <span className="font-medium">{b.nama}</span>
              <span className="text-smoke"> {b.posisi}</span>
            </span>
            <span className="w-12 text-right font-mono text-sm text-graphite tabular-nums">{b.jam ?? "–"}</span>
            <span className="flex justify-end">{b.status}</span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-4 text-xs text-ash">Jam absen dari server, bukan jam HP karyawan.</figcaption>
    </figure>
  );
}
