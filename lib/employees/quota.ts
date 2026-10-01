import "server-only";
import { createClient } from "@/lib/supabase/server";

export type EmployeeQuota = {
  /** Karyawan aktif + diundang. */
  used: number;
  /** null = tanpa batas. */
  limit: number | null;
  planName: string;
  full: boolean;
};

/** Pemakaian kursi karyawan. Batas dibaca dari paket di database. */
export async function getEmployeeQuota(companyId: string): Promise<EmployeeQuota> {
  const supabase = await createClient();
  const [count, limit, planCode] = await Promise.all([
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["aktif", "diundang"]),
    supabase.rpc("employee_limit", { p_company_id: companyId }),
    supabase.rpc("current_plan_code", { p_company_id: companyId }),
  ]);
  if (count.error || limit.error || planCode.error) {
    throw new Error("Gagal memuat kuota karyawan. Coba muat ulang halaman.");
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("name")
    .eq("code", planCode.data)
    .maybeSingle();

  const used = count.count ?? 0;
  return {
    used,
    limit: limit.data,
    planName: plan?.name ?? "Benih",
    full: limit.data !== null && used >= limit.data,
  };
}
