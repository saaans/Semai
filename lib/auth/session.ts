import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { companyLogoUrl } from "@/lib/company/logo";
import { createClient } from "@/lib/supabase/server";

const EMPLOYEE_EMAIL_DOMAIN = "@karyawan.semai.internal";

export function isEmployeeEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(EMPLOYEE_EMAIL_DOMAIN));
}

/**
 * Hanya terima path internal (/owner, /owner/...) supaya ?next= tidak bisa
 * dipakai untuk redirect ke situs lain.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}

/** User yang sedang login (sudah divalidasi ke Supabase), atau null. */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});

export type OwnerState =
  | { kind: "anonymous" }
  | { kind: "employee" }
  | { kind: "platform_admin" }
  | { kind: "error" }
  | {
      kind: "member";
      userId: string;
      email: string | null;
      companyId: string;
      role: "owner" | "admin";
      phone: string | null;
      onboardingCompleted: boolean;
      /** Ditangguhkan tim Semai: owner/admin tidak bisa mengubah data. */
      suspended: boolean;
    };

/**
 * Status owner untuk request ini. Kalau user belum punya usaha (pertama kali
 * daftar), buat usaha kosong + keanggotaan owner lewat RPC.
 */
export const getOwnerState = cache(async (): Promise<OwnerState> => {
  const user = await getSessionUser();
  if (!user) return { kind: "anonymous" };
  if (isEmployeeEmail(user.email)) return { kind: "employee" };

  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (membershipError) return { kind: "error" };

  let companyId = membership?.company_id ?? null;
  let role = (membership?.role ?? "owner") as "owner" | "admin";

  if (!companyId) {
    // Tim Semai tanpa usaha tidak dibuatkan usaha kosong.
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (isAdmin) return { kind: "platform_admin" };

    const { data: newCompanyId, error } = await supabase.rpc("ensure_owner_company");
    if (error || !newCompanyId) return { kind: "error" };
    companyId = newCompanyId;
    role = "owner";
  }

  const [{ data: company }, { data: profile }] = await Promise.all([
    supabase
      .from("companies")
      .select("onboarding_completed_at, suspended_at")
      .eq("id", companyId)
      .maybeSingle(),
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
  ]);

  return {
    kind: "member",
    userId: user.id,
    email: user.email,
    companyId,
    role,
    phone: profile?.phone ?? null,
    onboardingCompleted: Boolean(company?.onboarding_completed_at),
    suspended: Boolean(company?.suspended_at),
  };
});

/** Ke mana user diarahkan setelah login/daftar. */
export function homePathFor(state: OwnerState): string {
  switch (state.kind) {
    case "anonymous":
      return "/masuk";
    case "employee":
      return "/app";
    case "platform_admin":
      return "/admin";
    case "error":
      return "/masuk?error=server";
    case "member":
      if (state.suspended) return "/ditangguhkan";
      if (!state.phone) return "/lengkapi-wa";
      if (!state.onboardingCompleted) return "/owner/onboarding";
      return "/owner";
  }
}

/**
 * Wajib owner/admin usaha. Dipakai di layout /owner.
 * Nomor WA wajib ada sebelum masuk area owner.
 */
export async function requireOwner() {
  const state = await getOwnerState();
  if (state.kind === "anonymous") redirect("/masuk?next=/owner");
  if (state.kind === "error") {
    throw new Error("Gagal memuat data usaha. Coba muat ulang halaman.");
  }
  if (state.kind !== "member") redirect(homePathFor(state));
  // Ditangguhkan tim Semai: seluruh area owner ditutup. Penulisan juga
  // ditolak di database (guard_read_only); absen karyawan tetap jalan.
  if (state.suspended) redirect("/ditangguhkan");
  if (!state.phone) redirect("/lengkapi-wa");
  return state;
}

/** Wajib super admin (is_platform_admin). Selain itu 404. */
export async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/masuk?next=/admin");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();
  return user;
}

export type EmployeeMembership = {
  employeeId: string;
  companyId: string;
  companyName: string;
  /** URL publik logo usaha, null kalau belum ada. */
  logoUrl: string | null;
  timezone: string;
  fullName: string;
};

/**
 * Wajib karyawan yang sudah login. Dipakai di halaman /app.
 * Mengembalikan semua usaha tempat dia aktif (bisa lebih dari satu).
 */
export async function requireEmployee() {
  const user = await getSessionUser();
  if (!user) redirect("/app/masuk");
  if (!isEmployeeEmail(user.email)) {
    redirect(homePathFor(await getOwnerState()));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, company_id, full_name, companies (name, timezone, logo_path)")
    .eq("user_id", user.id)
    .eq("status", "aktif")
    .order("activated_at");
  if (error) {
    console.error("[requireEmployee]", error);
    throw new Error("Gagal memuat data karyawan. Coba muat ulang halaman.");
  }

  const memberships: EmployeeMembership[] = data.map((row) => ({
    employeeId: row.id,
    companyId: row.company_id,
    companyName: row.companies?.name ?? "Usaha",
    logoUrl: companyLogoUrl(row.companies?.logo_path),
    timezone: row.companies?.timezone ?? "Asia/Jakarta",
    fullName: row.full_name,
  }));

  return { userId: user.id, memberships };
}
