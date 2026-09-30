import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";

const areas = [
  { href: "/owner", title: "Dashboard owner", desc: "Absen hari ini, karyawan, gajian." },
  { href: "/app", title: "Aplikasi karyawan", desc: "Absen selfie + GPS, riwayat, slip gaji." },
  { href: "/admin", title: "Super admin", desc: "Usaha terdaftar, paket, tagihan." },
];

export default function LandingPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-16 px-5 py-6 sm:px-8 sm:py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          semai
        </Link>
        <Link href="/masuk" className="text-sm font-medium text-graphite hover:text-ink">
          Masuk
        </Link>
      </header>

      <section className="flex max-w-2xl flex-col gap-6">
        <Tag tone="accent" className="self-start">
          Segera hadir
        </Tag>
        <h1 className="text-4xl leading-[1.1] sm:text-6xl">
          Absen dan gajian usaha kecil, beres dari HP.
        </h1>
        <p className="text-lg text-smoke">
          Karyawan absen pakai selfie dan GPS. Telat, lembur, dan kasbon dihitung otomatis.
          Slip gaji tinggal kirim ke WhatsApp.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/daftar" className="sm:min-w-52">
            Daftar gratis
          </ButtonLink>
          <ButtonLink href="/masuk" variant="secondary">
            Sudah punya akun
          </ButtonLink>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {areas.map((area) => (
          <Link key={area.href} href={area.href} className="group rounded-card">
            <Card className="h-full transition-colors group-hover:bg-stone">
              <span className="font-mono text-xs text-ash">{area.href}</span>
              <CardTitle className="mt-3">{area.title}</CardTitle>
              <CardDescription>{area.desc}</CardDescription>
            </Card>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">Komponen dasar</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col gap-4">
            <CardTitle>Tombol & tag</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Tag>Belum absen</Tag>
              <Tag tone="accent">Masuk</Tag>
              <Tag tone="ink">Telat 12 mnt</Tag>
              <Tag tone="outline">Izin</Tag>
            </div>
            <div className="flex flex-col gap-3">
              <ButtonLink href="/owner" fullWidth>
                Proses gajian
              </ButtonLink>
              <ButtonLink href="/owner" variant="secondary" fullWidth>
                Lihat rekap
              </ButtonLink>
            </div>
            <p className="text-sm text-smoke">
              ID usaha <span className="font-mono text-graphite">SMI-00042</span> · 30 Sep 2026 ·
              Gaji pokok Rp1.250.000
            </p>
          </Card>
          <Card className="flex flex-col gap-4">
            <CardTitle>Input</CardTitle>
            <Input label="Nama usaha" placeholder="Kopi Senja" />
            <Input
              label="Nomor HP"
              inputMode="tel"
              defaultValue="0812"
              error="Nomor HP terlalu pendek. Masukkan 10–13 digit, contoh 081234567890."
            />
            <Input label="Radius absen (meter)" inputMode="numeric" defaultValue="100" hint="Default 100 m dari titik lokasi." />
          </Card>
        </div>
      </section>

      <footer className="border-t border-stone pt-6 text-sm text-ash">© 2026 Semai</footer>
    </div>
  );
}
