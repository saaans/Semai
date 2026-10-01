import { notFound, redirect } from "next/navigation";
import { getSessionUser, isEmployeeEmail } from "@/lib/auth/session";
import { getPayslipView, payslipPdf, pdfResponse } from "@/lib/payroll/slip";

/** Unduh slip gaji PDF (karyawan). RLS: hanya slip sendiri yang sudah dikunci. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !isEmployeeEmail(user.email)) redirect(`/app/masuk?next=/app/slip/${encodeURIComponent(id)}`);

  const view = await getPayslipView(id);
  if (!view) notFound();
  return pdfResponse(await payslipPdf(view));
}
