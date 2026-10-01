import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/session";
import { companyLogoUrl } from "@/lib/company/logo";
import { createClient } from "@/lib/supabase/server";
import { LogoForm } from "./logo-form";
import { ModeAbsenForm } from "./mode-absen-form";
import { ProfilForm } from "./profil-form";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function PengaturanPage() {
  const owner = await requireOwner();
  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("attendance_mode, name, business_type, city, timezone, address, phone, logo_path")
    .eq("id", owner.companyId)
    .single();
  if (error) throw new Error("Gagal memuat pengaturan. Coba muat ulang halaman.");

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">Pengaturan</h1>
      </div>
      <Card className="flex max-w-2xl flex-col gap-5">
        <div>
          <CardTitle>Profil usaha</CardTitle>
          <CardDescription>Nama dan logo tampil di aplikasi karyawan dan slip gaji.</CardDescription>
        </div>
        <LogoForm logoUrl={companyLogoUrl(company.logo_path)} companyName={company.name ?? ""} />
        <div className="h-px bg-stone" />
        <ProfilForm
          initial={{
            name: company.name ?? "",
            businessType: company.business_type,
            city: company.city ?? "",
            timezone: company.timezone,
            address: company.address ?? "",
            phone: company.phone,
          }}
        />
      </Card>
      <Card className="flex max-w-2xl flex-col gap-5">
        <div>
          <CardTitle>Absen</CardTitle>
          <CardDescription>
            Lembur hanya dihitung kalau karyawan absen pulang, di hari kerja sesuai jadwalnya, dan
            selalu menunggu persetujuanmu sebelum masuk gajian.
          </CardDescription>
        </div>
        <ModeAbsenForm initial={company.attendance_mode} />
      </Card>
    </>
  );
}
