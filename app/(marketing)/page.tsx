import Link from "next/link";
import { IkonPaket } from "@/components/ikon-paket";
import { ButtonLink } from "@/components/ui/button";
import { rangeLabel, TIER_LABEL, type PlanRow } from "@/lib/billing/catalog";
import { getPlans } from "@/lib/billing/server";
import { hasSupabaseEnv } from "@/lib/env";
import { formatRupiah } from "@/lib/format";
import { BukuVsSemai } from "./_components/buku-vs-semai";
import { Faq } from "./_components/faq";
import { FiturGrid } from "./_components/fitur-grid";
import { HpAbsen } from "./_components/hp-absen";
import { PapanHero } from "./_components/papan-hero";

const usaha = ["resto", "kafe", "toko", "klinik", "salon", "bengkel", "laundry"];

/** Paket yang dijual (Benih + berbayar), dari tabel plans. null kalau gagal dimuat. */
async function loadPlans(): Promise<PlanRow[] | null> {
  if (!hasSupabaseEnv()) return null;
  try {
    const plans = await getPlans();
    return plans.filter((p) => p.level === "benih" || p.level === "plus");
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const plans = await loadPlans();

  return (
    <div className="relative overflow-x-clip">
      {/* Latar hero: grid titik tipis yang memudar, dengan cahaya lime samar di belakang papan. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem]"
        style={{
          backgroundImage: "radial-gradient(var(--stone) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 right-0 -z-10 hidden size-[36rem] rounded-full bg-accent/25 blur-[120px] lg:block"
      />

      <div className="sticky top-0 z-20 bg-canvas/80 backdrop-blur-md">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="font-display text-2xl tracking-tight">
          semai
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a href="#fitur" className="hidden min-h-11 items-center rounded-button px-3 text-sm text-graphite hover:text-ink md:flex">
            Fitur
          </a>
          <a href="#paket" className="hidden min-h-11 items-center rounded-button px-3 text-sm text-graphite hover:text-ink md:flex">
            Harga
          </a>
          <a href="#tanya" className="hidden min-h-11 items-center rounded-button px-3 text-sm text-graphite hover:text-ink md:flex">
            Tanya jawab
          </a>
          <Link href="/masuk" className="flex min-h-11 items-center rounded-button px-3 text-sm font-medium text-graphite hover:text-ink">
            Masuk
          </Link>
          <ButtonLink href="/daftar" className="hidden sm:inline-flex">
            Daftar gratis
          </ButtonLink>
        </nav>
      </header>
      </div>

    <div className="mx-auto flex max-w-6xl flex-col px-5 sm:px-8">

      <section className="grid items-center gap-12 pt-8 pb-12 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:pb-16">
        <div className="flex flex-col gap-7">
          <p className="inline-flex items-center gap-2 self-start rounded-full border border-stone bg-canvas/70 py-1 pr-3 pl-1 text-sm text-graphite">
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">Baru</span>
            Absen, gajian, dan kasbon di satu tempat
          </p>
          <h1 className="text-[2.75rem] leading-[1.03] sm:text-6xl lg:text-[4.5rem]">
            Absen dan gajian usaha kecil, beres dari HP.
          </h1>
          <p className="max-w-xl text-lg text-smoke">
            Karyawan absen pakai selfie dan GPS, jadi tidak ada titip absen. Telat, lembur, dan
            kasbon dihitung otomatis. Slip gaji tinggal kirim ke WhatsApp.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/daftar" className="sm:min-w-52">
              Daftar gratis
            </ButtonLink>
            <ButtonLink href="/masuk" variant="secondary">
              Sudah punya akun
            </ButtonLink>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-smoke">
            {["Gratis untuk 5 karyawan", "Tanpa kartu kredit", "Siap dipakai hari ini"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-ink">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-start">
          <div className="relative z-10 min-w-0 flex-1">
            <PapanHero />
          </div>
          <HpAbsen className="-ml-4 mt-28 hidden shrink-0 rotate-[4deg] md:block" />
        </div>
      </section>

      <section aria-labelledby="titip" className="py-16 sm:py-24">
        <h2 id="titip" className="max-w-3xl text-3xl leading-tight sm:text-5xl">
          Buku absen gampang dititip. Selfie dan GPS tidak.
        </h2>
        <div className="mt-10">
          <BukuVsSemai />
        </div>
      </section>

      <section aria-labelledby="sebulan" className="border-t border-stone py-16 sm:py-24">
        <h2 id="sebulan" className="max-w-2xl text-3xl leading-tight sm:text-5xl">
          Dari absen pagi sampai slip gaji, tanpa buku dan Excel.
        </h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          <Langkah nomor={1} kapan="Setiap hari" judul="Karyawan absen dari HP">
            <div className="rounded-button bg-canvas p-4">
              <p className="font-medium">Absen masuk tercatat</p>
              <p className="mt-1 font-mono text-2xl tabular-nums">06.54</p>
              <p className="mt-2 text-sm text-smoke">32 m dari Kopi Senja, dalam radius 100 m.</p>
            </div>
          </Langkah>
          <Langkah nomor={2} kapan="Akhir bulan" judul="Gaji dihitung otomatis">
            <dl className="rounded-button bg-canvas p-4 text-sm">
              {[
                ["Gaji pokok", 2_800_000],
                ["Lembur 6 jam", 150_000],
                ["Telat 3 kali", -45_000],
                ["Kasbon", -300_000],
              ].map(([label, nominal]) => (
                <div key={label} className="flex justify-between gap-3 py-1">
                  <dt className="text-smoke">{label}</dt>
                  <dd className="font-mono tabular-nums">
                    {(nominal as number) < 0 ? "−" : ""}
                    {formatRupiah(Math.abs(nominal as number))}
                  </dd>
                </div>
              ))}
              <div className="mt-2 flex justify-between gap-3 border-t border-stone pt-3">
                <dt className="font-medium">Total dibayar</dt>
                <dd className="font-mono font-medium tabular-nums">{formatRupiah(2_605_000)}</dd>
              </div>
            </dl>
          </Langkah>
          <Langkah nomor={3} kapan="Hari gajian" judul="Slip gaji ke WhatsApp">
            <div className="rounded-button bg-canvas p-4">
              <p className="text-sm text-smoke">Slip gaji September 2026</p>
              <p className="mt-1 font-medium">Dimas, Barista</p>
              <p className="mt-3 font-display text-3xl tabular-nums">{formatRupiah(2_605_000)}</p>
              <p className="mt-3 text-sm text-smoke">PDF siap dibagikan. Karyawan juga bisa buka sendiri di HP.</p>
            </div>
          </Langkah>
        </ol>
      </section>

      <section id="fitur" aria-labelledby="fitur-judul" className="scroll-mt-24 border-t border-stone py-16 sm:py-24">
        <h2 id="fitur-judul" className="max-w-2xl text-3xl leading-tight sm:text-5xl">
          Yang dikerjakan Semai untukmu.
        </h2>
        <div className="mt-10">
          <FiturGrid />
        </div>
      </section>

      <section aria-label="Untuk siapa" className="border-t border-stone py-16 sm:py-24">
        <p className="max-w-4xl font-display text-3xl leading-snug font-light tracking-tight sm:text-5xl sm:leading-tight">
          Dibuat untuk{" "}
          {usaha.map((u, i) => (
            <span key={u}>
              {i === usaha.length - 1 ? "dan " : ""}
              {u}
              {i < usaha.length - 1 ? ", " : ""}
            </span>
          ))}{" "}
          <span className="text-ash">dengan 2 sampai 50 karyawan.</span>
        </p>
      </section>

      {plans && plans.length > 0 && (
        <section id="paket" aria-labelledby="paket-judul" className="scroll-mt-24 border-t border-stone py-16 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <h2 id="paket-judul" className="text-3xl leading-tight sm:text-5xl">
                Harga ikut jumlah karyawan.
              </h2>
              <p className="text-smoke">
                Benih gratis untuk mulai. Semua paket berbayar membuka semua fitur; yang beda hanya
                jumlah karyawan. Bayar tahunan gratis 2 bulan.
              </p>
              <p className="text-smoke">Coba semua fitur 14 hari, sekali per usaha.</p>
            </div>
            <ul className="flex flex-col divide-y divide-stone rounded-card bg-taupe px-5 sm:px-6">
              {plans.map((plan) => (
                <li key={plan.code} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4">
                  <IkonPaket tier={plan.tier} size={28} />
                  <div className="min-w-0">
                    <p className="font-medium">{TIER_LABEL[plan.tier] ?? plan.name}</p>
                    <p className="text-sm text-smoke">{rangeLabel(plan)}</p>
                  </div>
                  <p className="text-right">
                    {plan.price_monthly === null ? (
                      <span className="text-graphite">Hubungi kami</span>
                    ) : plan.price_monthly === 0 ? (
                      <span className="font-medium">Gratis</span>
                    ) : (
                      <>
                        <span className="font-medium tabular-nums">{formatRupiah(plan.price_monthly)}</span>
                        <span className="text-sm text-smoke"> /bulan</span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="tanya" aria-labelledby="tanya-judul" className="grid scroll-mt-24 gap-8 border-t border-stone py-16 sm:py-24 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <h2 id="tanya-judul" className="text-3xl leading-tight sm:text-5xl">
          Tanya jawab
        </h2>
        <Faq />
      </section>

      <section className="relative mb-10 overflow-hidden rounded-[28px] bg-ink px-6 py-14 text-canvas sm:px-12 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-accent/30 blur-[90px]" />
        <div className="relative flex flex-col items-start gap-6">
          <h2 className="max-w-3xl text-3xl leading-tight sm:text-5xl">
            Daftar hari ini, besok pagi karyawan sudah absen dari HP.
          </h2>
          <p className="max-w-xl text-ash">Gratis untuk 5 karyawan. Coba semua fitur 14 hari tanpa kartu kredit.</p>
          <ButtonLink href="/daftar" className="sm:min-w-52">
            Daftar gratis
          </ButtonLink>
        </div>
      </section>

      <footer className="flex flex-col gap-3 border-t border-stone py-8 text-sm text-ash sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Semai</p>
        <p>
          Karyawan?{" "}
          <Link href="/app/masuk" className="text-graphite underline underline-offset-4 hover:text-ink">
            Masuk untuk absen
          </Link>
        </p>
      </footer>
    </div>
    </div>
  );
}

function Langkah({
  nomor,
  kapan,
  judul,
  children,
}: {
  nomor: number;
  kapan: string;
  judul: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-5 rounded-card bg-taupe p-5 sm:p-6">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm text-ash">{nomor}</span>
        <div>
          <p className="text-sm text-smoke">{kapan}</p>
          <h3 className="text-xl">{judul}</h3>
        </div>
      </div>
      {children}
    </li>
  );
}
