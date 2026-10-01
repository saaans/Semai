"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { buildInviteLink, type InviteLink } from "@/lib/employees/invite";
import { randomPassword } from "@/lib/employees/pin";
import { tambahKaryawanSchema } from "@/lib/employees/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InviteResult = InviteLink & { employeeId: string; employeeName: string };

export type KaryawanFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
  /** Batas karyawan paket terlewati: tampilkan layar upgrade. */
  limitReached?: boolean;
  invite?: InviteResult;
  /** Info tambahan di samping link undangan, misalnya remote gagal disimpan. */
  notice?: string;
};

const SAVE_FAILED = "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireManager() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");
  return owner;
}

async function getCompany(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("name, timezone")
    .eq("id", companyId)
    .single();
  return { name: data?.name ?? "usaha kami", timezone: data?.timezone ?? "Asia/Jakarta" };
}

async function inviteFor(
  companyId: string,
  employee: { id: string; full_name: string; phone: string },
  token: { token: string; expires_at: string },
  reset = false,
): Promise<InviteResult> {
  const company = await getCompany(companyId);
  const link = await buildInviteLink({
    token: token.token,
    expiresAt: token.expires_at,
    employeeName: employee.full_name,
    companyName: company.name,
    phone: employee.phone,
    timezone: company.timezone,
    reset,
  });
  return { ...link, employeeId: employee.id, employeeName: employee.full_name };
}

/** Karyawan milik usaha owner ini (RLS memastikan usaha lain tidak terbaca). */
async function getEmployee(companyId: string, employeeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id, full_name, phone, status, user_id")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

export async function tambahKaryawan(
  _prev: KaryawanFormState,
  formData: FormData,
): Promise<KaryawanFormState> {
  const owner = await requireManager();
  const values = {
    fullName: text(formData, "fullName"),
    phone: text(formData, "phone"),
    position: text(formData, "position"),
    baseSalary: text(formData, "baseSalary"),
    remote: text(formData, "remote"),
  };
  const parsed = tambahKaryawanSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_employee", {
    p_company_id: owner.companyId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_position: parsed.data.position,
    p_base_salary: parsed.data.baseSalary,
  });

  if (error) {
    if (error.hint === "karyawan_maks") return { limitReached: true, message: error.message, values };
    if (error.hint === "nomor_terdaftar") return { errors: { phone: error.message }, values };
    return { message: SAVE_FAILED, values };
  }

  const row = data[0];
  if (!row) return { message: SAVE_FAILED, values };

  let notice: string | undefined;
  if (values.remote === "ya") {
    const { error: remoteError } = await supabase.rpc("set_employee_remote", {
      p_employee_id: row.employee_id,
      p_remote: true,
    });
    if (remoteError) {
      if (remoteError.code !== "P0001") console.error("[tambahKaryawan] remote", remoteError);
      notice = `Karyawan tersimpan, tapi kerja remote belum aktif: ${
        remoteError.code === "P0001" ? remoteError.message : "coba nyalakan lagi dari halaman detail karyawan."
      }`;
    }
  }

  revalidatePath("/owner/karyawan");
  return {
    notice,
    invite: await inviteFor(
      owner.companyId,
      { id: row.employee_id, full_name: parsed.data.fullName, phone: parsed.data.phone },
      { token: row.token, expires_at: row.expires_at },
    ),
  };
}

/** Link undangan baru untuk yang belum aktivasi. Link lama tidak berlaku. */
export async function buatLinkBaru(
  _prev: KaryawanFormState,
  formData: FormData,
): Promise<KaryawanFormState> {
  const owner = await requireManager();
  const employee = await getEmployee(owner.companyId, text(formData, "employeeId"));
  if (!employee) return { message: "Karyawan tidak ditemukan. Muat ulang halaman." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_employee_invite", {
    p_employee_id: employee.id,
  });
  const row = data?.[0];
  if (error || !row) return { message: error?.code === "P0001" ? error.message : SAVE_FAILED };

  return { invite: await inviteFor(owner.companyId, employee, row) };
}

/** Reset PIN: PIN lama langsung mati, karyawan membuat PIN baru lewat link. */
export async function resetPin(
  _prev: KaryawanFormState,
  formData: FormData,
): Promise<KaryawanFormState> {
  const owner = await requireManager();
  const employee = await getEmployee(owner.companyId, text(formData, "employeeId"));
  if (!employee) return { message: "Karyawan tidak ditemukan. Muat ulang halaman." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_employee_pin", {
    p_employee_id: employee.id,
  });
  const row = data?.[0];
  if (error || !row) return { message: error?.code === "P0001" ? error.message : SAVE_FAILED };

  // Hak akses sudah dicek RPC di atas. Ganti password dengan service role.
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(row.user_id, {
    password: randomPassword(),
    app_metadata: { pin_reset: true },
  });
  if (authError) return { message: SAVE_FAILED };
  await admin.rpc("employee_login_succeeded", { p_phone: employee.phone });

  return { invite: await inviteFor(owner.companyId, employee, row, true) };
}

export async function ubahStatus(
  _prev: KaryawanFormState,
  formData: FormData,
): Promise<KaryawanFormState> {
  const owner = await requireManager();
  const employee = await getEmployee(owner.companyId, text(formData, "employeeId"));
  if (!employee) return { message: "Karyawan tidak ditemukan. Muat ulang halaman." };

  const target = text(formData, "status");
  const supabase = await createClient();

  if (target === "nonaktif") {
    const { error } = await supabase
      .from("employees")
      .update({ status: "nonaktif", deactivated_at: new Date().toISOString() })
      .eq("id", employee.id);
    if (error) return { message: SAVE_FAILED };
  } else if (target === "aktif") {
    if (employee.status !== "nonaktif") return {};
    const { error } = await supabase
      .from("employees")
      .update({ status: employee.user_id ? "aktif" : "diundang", deactivated_at: null })
      .eq("id", employee.id);
    if (error) {
      if (error.hint === "karyawan_maks") return { limitReached: true, message: error.message };
      return { message: SAVE_FAILED };
    }
  } else {
    return { message: "Status tidak dikenal." };
  }

  revalidatePath("/owner/karyawan");
  revalidatePath(`/owner/karyawan/${employee.id}`);
  return {};
}

/** Hapus karyawan yang belum pernah aktivasi. */
export async function batalkanUndangan(
  _prev: KaryawanFormState,
  formData: FormData,
): Promise<KaryawanFormState> {
  const owner = await requireManager();
  const employee = await getEmployee(owner.companyId, text(formData, "employeeId"));
  if (!employee) return { message: "Karyawan tidak ditemukan. Muat ulang halaman." };
  if (employee.status !== "diundang") {
    return { message: "Karyawan yang sudah aktif tidak bisa dihapus. Nonaktifkan saja." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("employees").delete().eq("id", employee.id);
  if (error) return { message: SAVE_FAILED };

  revalidatePath("/owner/karyawan");
  redirect("/owner/karyawan");
}

export type RemoteState = { message?: string; saved?: boolean };

/** Nyalakan/matikan absen remote. Menyalakan butuh paket berbayar (dicek di RPC). */
export async function ubahRemote(_prev: RemoteState, formData: FormData): Promise<RemoteState> {
  await requireManager();
  const employeeId = text(formData, "employeeId");
  const remote = text(formData, "remote");
  if (!/^[0-9a-f-]{36}$/i.test(employeeId) || (remote !== "ya" && remote !== "tidak")) {
    return { message: "Data tidak dikenal. Muat ulang halaman lalu coba lagi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_employee_remote", {
    p_employee_id: employeeId,
    p_remote: remote === "ya",
  });
  if (error) {
    if (error.code !== "P0001") console.error("[ubahRemote]", error);
    return { message: error.code === "P0001" ? error.message : SAVE_FAILED };
  }

  revalidatePath(`/owner/karyawan/${employeeId}`);
  revalidatePath("/owner/karyawan");
  revalidatePath("/owner");
  return { saved: true };
}
