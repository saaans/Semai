import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { requireOwner } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/format";
import { furthestStep, getOnboardingData, type OnboardingData } from "@/lib/onboarding/data";
import {
  DEFAULT_RADIUS_M,
  TOTAL_STEPS,
  recommendPlan,
  scheduleDefaultsFor,
  trialPlanCode,
  type BusinessType,
  type EmployeeRange,
  type ScheduleDefaults,
} from "@/lib/onboarding/defaults";
import { createClient } from "@/lib/supabase/server";
import { JamKerjaForm } from "../_components/jam-kerja-form";
import { LewatiForm } from "../_components/lewati-form";
import { LokasiForm } from "../_components/lokasi-form";
import { PaketForm } from "../_components/paket-form";
import { ProfilForm } from "../_components/profil-form";
import { StepHeader } from "../_components/step-header";
import { UkuranForm } from "../_components/ukuran-form";

export const metadata: Metadata = { title: "Siapkan usaha" };

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ langkah: string }>;
}) {
  const owner = await requireOwner();
  if (owner.onboardingCompleted) redirect("/owner");

  const { langkah } = await params;
  const step = Number(langkah);
  if (!Number.isInteger(step) || step < 1 || step > TOTAL_STEPS) notFound();

  const data = await getOnboardingData(owner.companyId);
  const allowed = furthestStep(data.progress);
  if (step > allowed) redirect(`/owner/onboarding/${allowed}`);

  switch (step) {
    case 1:
      return (
        <Step
          step={1}
          title="Profil usaha"
          description="Kenalkan usahamu. Bidang usaha dipakai untuk mengisi pengaturan awal."
        >
          <ProfilForm
            initial={{
              name: data.company.name,
              businessType: data.company.business_type,
              city: data.company.city,
              timezone: data.company.timezone,
              phone: owner.phone ? `0${owner.phone.replace(/^62/, "")}` : "",
            }}
          />
        </Step>
      );
    case 2:
      return (
        <Step
          step={2}
          title="Ukuran usaha"
          description="Perkiraan saja. Dipakai untuk menyarankan paket yang pas."
        >
          <UkuranForm
            initial={{
              employeeRange: data.company.employee_range,
              branchCount: data.company.branch_count,
            }}
          />
        </Step>
      );
    case 3:
      return (
        <Step
          step={3}
          title="Jam kerja"
          description="Dipakai untuk menghitung telat dan lembur. Sudah kami isi sesuai bidang usahamu."
        >
          <JamKerjaForm initial={scheduleInitial(data)} />
        </Step>
      );
    case 4:
      return (
        <Step
          step={4}
          title="Lokasi absen"
          description="Karyawan hanya bisa absen kalau berada di sekitar titik ini."
        >
          <LokasiForm
            initial={{
              name: data.location?.name ?? data.company.name ?? "Lokasi utama",
              point: data.location
                ? { lat: data.location.latitude, lng: data.location.longitude }
                : null,
              radiusM: data.location?.radius_m ?? DEFAULT_RADIUS_M,
            }}
          />
        </Step>
      );
    case 5:
      return (
        <Step
          step={5}
          title="Undang karyawan"
          description="Karyawan absen dari HP masing-masing lewat link undangan."
        >
          <Card>
            <CardTitle>Undang setelah ini</CardTitle>
            <CardDescription>
              Kamu bisa menambah karyawan satu per satu, atau membagikan link dan QR undangan dari
              dashboard. Karyawan tinggal buka link, lalu buat PIN.
            </CardDescription>
          </Card>
          <LewatiForm />
        </Step>
      );
    default:
      return <PaketStep data={data} />;
  }
}

function Step({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <StepHeader step={step} title={title} description={description} />
      {children}
    </div>
  );
}

/** Jam kerja tersimpan kalau owner kembali ke langkah 3, atau isian awal per bidang. */
function scheduleInitial(data: OnboardingData): ScheduleDefaults {
  const first = data.schedules[0];
  if (!first) {
    return scheduleDefaultsFor(data.company.business_type as BusinessType | null);
  }
  return {
    mode: data.progress.mode ?? (data.schedules.length > 1 ? "shift" : "tetap"),
    schedules: data.schedules.map((s) => ({
      name: s.name,
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
    })),
    workDays: first.work_days,
    lateToleranceMin: first.late_tolerance_min,
  };
}

function priceLabel(plan: { level: string; price_monthly: number | null }): string {
  if (plan.level === "benih") return "Gratis";
  if (plan.price_monthly === null) return "Harga custom";
  return `${formatRupiah(plan.price_monthly)}/bulan`;
}

async function PaketStep({ data }: { data: OnboardingData }) {
  const employeeRange = (data.company.employee_range ?? "1-5") as EmployeeRange;
  const recommendation = recommendPlan({
    employeeRange,
    mode: data.progress.mode ?? "tetap",
    branchCount: data.company.branch_count,
  });
  // Rekomendasi Benih: pilihan berbayar termurah untuk rentang ini.
  const paidCode = recommendation.level === "benih" ? "tunas_plus" : recommendation.code;
  const trialCode = trialPlanCode(employeeRange);

  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("plans")
    .select("code, name, level, price_monthly, max_employees")
    .in("code", [...new Set([recommendation.code, paidCode, trialCode, "benih"])]);
  if (error) throw new Error("Gagal memuat daftar paket. Coba muat ulang halaman.");

  const byCode = new Map(plans.map((p) => [p.code, p]));
  const recommended = byCode.get(recommendation.code);
  const paid = byCode.get(paidCode);
  const trial = byCode.get(trialCode);
  const benih = byCode.get("benih");
  if (!recommended || !paid || !trial || !benih) {
    throw new Error("Data paket belum lengkap. Hubungi tim Semai.");
  }

  const benihMax = benih.max_employees ?? 5;
  const benihNote =
    employeeRange === "1-5"
      ? `Benih gratis untuk maksimal ${benihMax} karyawan aktif. Bisa upgrade kapan saja.`
      : `Benih hanya untuk maksimal ${benihMax} karyawan aktif. Karyawan lain bisa ditambah setelah upgrade.`;

  return (
    <Step
      step={6}
      title="Pilih paket"
      description="Absen karyawan tetap jalan di paket apa pun. Paket hanya menentukan fitur untukmu."
    >
      <Card>
        <Tag tone="accent">Rekomendasi</Tag>
        <CardTitle className="mt-3">{recommended.name}</CardTitle>
        <p className="mt-1 font-display text-2xl">{priceLabel(recommended)}</p>
        <CardDescription className="mt-2">{recommendation.reason}</CardDescription>
        <p className="mt-3 text-sm text-graphite">
          Coba {trial.name} gratis 14 hari dulu. Setelah itu pilih paket, atau turun ke Benih
          tanpa kehilangan data.
        </p>
      </Card>
      <PaketForm
        paid={{ code: paid.code, label: `Pilih ${paid.name} · ${priceLabel(paid)}` }}
        benihNote={benihNote}
      />
    </Step>
  );
}
