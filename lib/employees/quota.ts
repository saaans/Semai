import "server-only";
import { getBillingOverview } from "@/lib/billing/server";

export type EmployeeQuota = {
  /** Karyawan aktif + diundang, termasuk yang disembunyikan karena batas paket. */
  used: number;
  /** null = tanpa batas. */
  limit: number | null;
  planName: string;
  full: boolean;
};

/** Pemakaian kursi karyawan. Batas dibaca dari paket di database. */
export async function getEmployeeQuota(companyId: string): Promise<EmployeeQuota> {
  const overview = await getBillingOverview(companyId);
  const { employeesUsed: used, employeeLimit: limit } = overview;
  return {
    used,
    limit,
    planName: overview.planName,
    full: limit !== null && used >= limit,
  };
}
