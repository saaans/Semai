import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function Ikon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-button border border-stone bg-canvas text-ink">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </span>
  );
}

function Kotak({ ikon, judul, children, visual, className }: { ikon: ReactNode; judul: string; children: ReactNode; visual?: ReactNode; className?: string }) {
  return (
    <li className={cn("flex flex-col gap-4 rounded-card bg-taupe p-5 sm:p-6", className)}>
      <Ikon>{ikon}</Ikon>
      <div>
        <h3 className="text-xl">{judul}</h3>
        <p className="mt-1 text-sm text-smoke">{children}</p>
      </div>
      {visual && <div className="mt-auto">{visual}</div>}
    </li>
  );
}

/** Grid fitur dengan ukuran kotak berbeda sesuai bobot fiturnya. */
export function FiturGrid() {
  return (
    <ul className="grid gap-4 md:grid-cols-6">
      <Kotak
        className="md:col-span-4"
        judul="Absen selfie dan GPS"
        ikon={
          <>
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </>
        }
        visual={
          <div className="flex flex-wrap gap-2 text-sm">
            {["Dalam radius 100 m", "Foto wajah tiap absen", "Tetap tercatat saat sinyal hilang"].map((t) => (
              <span key={t} className="rounded-full border border-stone bg-canvas px-3 py-1.5 text-graphite">
                {t}
              </span>
            ))}
          </div>
        }
      >
        Absen hanya bisa dari lokasi usaha. Kalau karyawan terlalu jauh, Semai memberi tahu berapa meter
        jaraknya.
      </Kotak>
      <Kotak
        className="md:col-span-2"
        judul="Jam dari server"
        ikon={
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </>
        }
      >
        Mengubah jam di HP tidak mengubah jam absen.
      </Kotak>
      <Kotak
        className="md:col-span-2"
        judul="Telat dan lembur otomatis"
        ikon={
          <>
            <path d="M4 19h16M7 15l3-4 3 2 4-6" />
          </>
        }
      >
        Dihitung dari jadwal masuk. Lembur masuk gajian setelah kamu setujui.
      </Kotak>
      <Kotak
        className="md:col-span-2"
        judul="Kasbon terpotong sendiri"
        ikon={
          <>
            <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" />
            <path d="M9 8.5h6M9 12h6" />
          </>
        }
      >
        Catat sekali, cicilannya dipotong di gajian berikutnya.
      </Kotak>
      <Kotak
        className="md:col-span-2"
        judul="Tanpa install aplikasi"
        ikon={
          <>
            <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" />
          </>
        }
      >
        Karyawan buka dari browser HP dan pasang ke layar utama. Ringan untuk kuota.
      </Kotak>
    </ul>
  );
}
