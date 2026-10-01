import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { getPayslipView, payslipPdf, pdfResponse } from "@/lib/payroll/slip";

/** Unduh slip gaji PDF (owner). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (owner.role !== "owner") notFound();

  const { id } = await params;
  const view = await getPayslipView(id);
  if (!view) notFound();
  return pdfResponse(await payslipPdf(view));
}
