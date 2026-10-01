import "server-only";
import { monthLabel } from "@/lib/attendance/recap";
import { companyLogoUrl } from "@/lib/company/logo";
import { formatDate, formatMinutes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PayslipLine } from "./calculate";
import { renderSlipPdf } from "./pdf";
import { parseLines } from "./server";

export type PayslipView = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string | null;
  periodStart: string;
  periodEnd: string;
  lockedAt: string;
  netPay: number;
  lines: PayslipLine[];
  attendance: { label: string; value: string }[];
  company: { name: string; address: string | null; phone: string | null; logoPath: string | null; timezone: string };
  watermark: boolean;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function num(summary: Record<string, unknown>, key: string): number {
  const v = summary[key];
  return typeof v === "number" ? v : 0;
}

/** Ringkasan absen di slip, dari attendance_summary yang disimpan saat kunci. */
function attendanceFacts(summary: unknown): { label: string; value: string }[] {
  if (!summary || typeof summary !== "object") return [];
  const s = summary as Record<string, unknown>;
  const facts = [
    { label: "Hari kerja", value: `${num(s, "hariKerjaDibayar")} hari` },
    { label: "Hadir", value: `${num(s, "hadir")} hari` },
    { label: "Telat", value: num(s, "telatKali") > 0 ? `${num(s, "telatKali")}× (${formatMinutes(num(s, "telatMenit"))})` : "0" },
    { label: "Tidak masuk", value: `${num(s, "alpa")} hari` },
    { label: "Izin/sakit", value: `${num(s, "izin")} hari` },
    { label: "Lembur", value: num(s, "lemburMenit") > 0 ? formatMinutes(num(s, "lemburMenit")) : "0" },
  ];
  if (num(s, "pulangCepatKali") > 0) {
    facts.splice(3, 0, { label: "Pulang cepat", value: `${num(s, "pulangCepatKali")}×` });
  }
  return facts;
}

/**
 * Satu slip terkunci. RLS menentukan siapa yang bisa membaca: anggota usaha,
 * atau karyawan pemilik slip setelah gajian dikunci. null = tidak ada/akses ditolak.
 */
export async function getPayslipView(payslipId: string): Promise<PayslipView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(payslipId)) return null;
  const supabase = await createClient();
  const [{ data: slip, error }, { data: runs, error: runError }] = await Promise.all([
    supabase
      .from("payslips")
      .select("id, employee_id, employee_name, employee_position, net_pay, lines, attendance_summary")
      .eq("id", payslipId)
      .maybeSingle(),
    supabase.rpc("get_payslip_run", { p_payslip_id: payslipId }),
  ]);
  if (error || runError) {
    console.error("[getPayslipView]", error ?? runError);
    throw new Error("Gagal memuat slip gaji. Coba muat ulang halaman.");
  }
  const run = runs?.[0];
  if (!slip || !run) return null;

  const snap = (run.company_snapshot ?? {}) as Record<string, unknown>;
  return {
    id: slip.id,
    employeeId: slip.employee_id,
    employeeName: slip.employee_name ?? "Karyawan",
    employeePosition: slip.employee_position,
    periodStart: run.period_start,
    periodEnd: run.period_end,
    lockedAt: run.locked_at,
    netPay: slip.net_pay,
    lines: parseLines(slip.lines),
    attendance: attendanceFacts(slip.attendance_summary),
    company: {
      name: str(snap.name) ?? "Usaha",
      address: str(snap.address),
      phone: str(snap.phone),
      logoPath: str(snap.logo_path),
      timezone: str(snap.timezone) ?? "Asia/Jakarta",
    },
    watermark: run.watermark,
  };
}

/** Logo usaha sebagai PNG untuk PDF (react-pdf tidak bisa WebP). Gagal = tanpa logo. */
async function logoPng(path: string | null): Promise<Buffer | null> {
  const url = companyLogoUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const { default: sharp } = await import("sharp");
    return await sharp(input).resize(160, 160, { fit: "inside" }).png().toBuffer();
  } catch (error) {
    console.error("[logoPng]", error);
    return null;
  }
}

function dateLabel(date: string) {
  return formatDate(`${date}T00:00:00Z`, "UTC");
}

export async function payslipPdf(view: PayslipView): Promise<{ pdf: Buffer; filename: string }> {
  const month = view.periodStart.slice(0, 7);
  const pdf = await renderSlipPdf({
    company: {
      name: view.company.name,
      address: view.company.address,
      phone: view.company.phone,
      logo: await logoPng(view.company.logoPath),
    },
    employee: { name: view.employeeName, position: view.employeePosition },
    periodLabel: monthLabel(month),
    periodRange: `${dateLabel(view.periodStart)} – ${dateLabel(view.periodEnd)}`,
    lockedLabel: formatDate(view.lockedAt, view.company.timezone),
    slipId: view.id,
    lines: view.lines,
    netPay: view.netPay,
    attendance: view.attendance,
    watermark: view.watermark,
  });
  const slug = view.employeeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { pdf, filename: `slip-gaji-${month}-${slug || "karyawan"}.pdf` };
}

export function pdfResponse({ pdf, filename }: { pdf: Buffer; filename: string }) {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
