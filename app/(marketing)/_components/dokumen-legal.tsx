import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { LEGAL } from "@/lib/legal";

export type BagianLegal = {
  id: string;
  judul: string;
  /** Ringkasan satu-dua kalimat untuk dibaca sekilas. */
  intinya?: string;
  isi: ReactNode;
};

const dokumen = [
  { href: "/privasi", label: "Kebijakan Privasi" },
  { href: "/syarat", label: "Syarat & Ketentuan" },
] as const;

/** Kerangka halaman legal: judul, tanggal berlaku, daftar isi, dan bagian bernomor. */
export function DokumenLegal({
  judul,
  pembuka,
  bagian,
  sekarang,
}: {
  judul: string;
  pembuka: ReactNode;
  bagian: BagianLegal[];
  sekarang: (typeof dokumen)[number]["href"];
}) {
  const lain = dokumen.find((d) => d.href !== sekarang)!;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-stone bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="font-display text-2xl tracking-tight">
            semai
          </Link>
          <Link
            href={lain.href}
            className="flex min-h-11 items-center rounded-button px-3 text-sm text-graphite hover:text-ink"
          >
            {lain.label}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-5 pt-10 pb-16 sm:px-8 sm:pt-16">
        <div className="flex flex-col gap-4">
          <p className="font-mono text-xs tracking-wide text-ash uppercase">Dokumen legal</p>
          <h1 className="text-4xl sm:text-5xl">{judul}</h1>
          <p className="text-sm text-smoke">
            Berlaku sejak{" "}
            <time dateTime={LEGAL.berlakuSejak} className="text-graphite">
              {formatDate(LEGAL.berlakuSejak)}
            </time>
          </p>
          <div className="flex max-w-prose flex-col gap-3 leading-relaxed text-graphite">
            {pembuka}
          </div>
        </div>

        <nav aria-label="Daftar isi" className="rounded-card bg-taupe p-5 sm:p-6">
          <p className="mb-3 text-sm font-medium text-ink">Daftar isi</p>
          <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {bagian.map((b, i) => (
              <li key={b.id}>
                <a
                  href={`#${b.id}`}
                  className="flex min-h-9 items-baseline gap-2 text-graphite hover:text-ink"
                >
                  <span className="font-mono text-xs text-ash">{String(i + 1).padStart(2, "0")}</span>
                  {b.judul}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex flex-col">
          {bagian.map((b, i) => (
            <section
              key={b.id}
              id={b.id}
              aria-labelledby={`${b.id}-judul`}
              className="flex scroll-mt-20 flex-col gap-4 border-t border-stone py-8 first:border-t-0 first:pt-0"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-ash">{String(i + 1).padStart(2, "0")}</span>
                <h2 id={`${b.id}-judul`} className="text-2xl sm:text-3xl">
                  {b.judul}
                </h2>
              </div>
              {b.intinya && (
                <p className="flex max-w-prose flex-col items-start gap-2 rounded-card bg-taupe px-5 py-4 text-sm text-graphite">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">
                    Intinya
                  </span>
                  {b.intinya}
                </p>
              )}
              <div className="flex max-w-prose flex-col gap-3 leading-relaxed text-smoke [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:text-ink [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-medium [&_strong]:text-graphite [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
                {b.isi}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-stone">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-8 text-sm text-ash sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 Semai</p>
          <TautanLegal />
        </div>
      </footer>
    </div>
  );
}

/** Tautan ke kedua dokumen legal, untuk footer. */
export function TautanLegal({ className }: { className?: string }) {
  return (
    <p className={className ?? "flex gap-4"}>
      {dokumen.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          className="text-graphite underline underline-offset-4 hover:text-ink"
        >
          {d.label}
        </Link>
      ))}
    </p>
  );
}
