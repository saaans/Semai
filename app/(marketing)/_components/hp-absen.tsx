/**
 * Mockup layar absen karyawan di HP: selfie, peta radius, tombol absen.
 * Murni ilustrasi, tidak interaktif.
 */
export function HpAbsen({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`w-[13.5rem] rounded-[2.2rem] border border-stone bg-canvas p-2 shadow-[0_30px_60px_-25px_rgb(0_0_0/0.35)] ${className ?? ""}`}
    >
      <div className="overflow-hidden rounded-[1.75rem] bg-taupe">
        <div className="flex items-center justify-between px-4 pt-3 text-[10px] text-smoke">
          <span className="font-mono">06.54</span>
          <span className="h-1.5 w-12 rounded-full bg-stone" />
          <span className="font-mono">4G</span>
        </div>

        <div className="px-4 pt-4">
          <p className="text-[11px] text-smoke">Kopi Senja</p>
          <p className="font-display text-xl font-light tracking-tight">Halo, Dimas</p>
        </div>

        {/* Peta mini dengan radius lokasi */}
        <div className="relative mx-3 mt-3 h-28 overflow-hidden rounded-2xl bg-canvas">
          <svg viewBox="0 0 200 112" className="absolute inset-0 size-full text-stone" fill="none" stroke="currentColor" strokeWidth="6">
            <path d="M-10 70 C40 60 70 90 120 70 S190 40 220 50" />
            <path d="M60 -10 L80 130" strokeWidth="4" />
            <path d="M150 -10 L130 130" strokeWidth="3" />
          </svg>
          <span className="absolute top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-ink/40 bg-accent/25" />
          <span className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-4 ring-canvas" />
          <span className="absolute right-2 bottom-2 rounded-full bg-canvas px-2 py-0.5 text-[10px] text-graphite">32 m · radius 100 m</span>
        </div>

        {/* Selfie */}
        <div className="mx-3 mt-2 flex items-center gap-3 rounded-2xl bg-canvas p-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-stone text-smoke">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="9" r="4" />
              <path d="M4.5 20c1-3.6 3.9-5.5 7.5-5.5s6.5 1.9 7.5 5.5" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="text-[11px] font-medium text-ink">Selfie siap</span>
            <span className="text-[10px] text-smoke">Foto dikompres ±50 KB</span>
          </span>
        </div>

        <div className="p-3">
          <span className="flex h-11 items-center justify-between rounded-[10px] bg-linear-to-b from-accent-soft to-accent pr-1.5 pl-3.5 text-[13px] font-medium text-on-accent">
            Absen masuk
            <span className="flex size-8 items-center justify-center rounded-[7px] bg-on-accent text-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
