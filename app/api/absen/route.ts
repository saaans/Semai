import { NextResponse } from "next/server";
import { getSessionUser, isEmployeeEmail } from "@/lib/auth/session";
import {
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  absenSchema,
  type AbsenResponse,
} from "@/lib/attendance/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "absen-foto";
const SERVER_ERROR = "Ada kendala di server. Absen belum tercatat, coba kirim lagi.";

function reply(body: AbsenResponse, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function rejected(message: string, status = 422) {
  return reply({ ok: false, retry: false, message }, status);
}

function field(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Absen masuk/pulang: foto ke storage privat (service role), lalu RPC
 * clock_in/clock_out dengan sesi karyawan. Jam resmi dan radius diputuskan
 * database. Dipakai langsung dan oleh antrean offline di HP.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !isEmployeeEmail(user.email)) {
      // Antrean di HP tetap disimpan sampai karyawan masuk lagi.
      return reply(
        {
          ok: false,
          retry: true,
          sessionExpired: true,
          message: "Sesi kamu sudah habis. Masuk lagi dengan nomor HP dan PIN.",
        },
        401,
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return rejected("Data absen tidak terbaca. Ambil foto lagi lalu kirim ulang.", 400);
    }

    const parsed = absenSchema.safeParse({
      action: field(formData, "action"),
      companyId: field(formData, "companyId"),
      requestId: field(formData, "requestId"),
      lat: field(formData, "lat"),
      lng: field(formData, "lng"),
      accuracy: field(formData, "accuracy") ?? "0",
      offline: field(formData, "offline") ?? "false",
      deviceCapturedAt: field(formData, "deviceCapturedAt"),
    });
    if (!parsed.success) {
      return rejected(parsed.error.issues[0]?.message ?? "Data absen tidak lengkap.", 400);
    }
    const input = parsed.data;

    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size === 0) {
      return rejected("Foto absen wajib ada. Ambil selfie lalu kirim ulang.", 400);
    }
    if (!PHOTO_TYPES.includes(photo.type as (typeof PHOTO_TYPES)[number])) {
      return rejected("Format foto tidak didukung. Ambil foto lagi dari aplikasi Semai.", 400);
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return rejected("Ukuran foto terlalu besar. Ambil foto lagi dari aplikasi Semai.", 400);
    }

    const supabase = await createClient();
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("user_id", user.id)
      .eq("status", "aktif")
      .maybeSingle();
    if (employeeError) {
      console.error("[absen] karyawan", employeeError);
      return reply({ ok: false, retry: true, message: SERVER_ERROR }, 500);
    }
    if (!employee) {
      return rejected("Kamu tidak terdaftar aktif di usaha ini. Hubungi pemilik usaha.", 403);
    }

    // Path tetap per permintaan: kiriman ulang dari antrean menimpa file yang sama.
    const ext = photo.type === "image/webp" ? "webp" : "jpg";
    const path = `${input.companyId}/${employee.id}/${input.requestId}.${ext}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, photo, { contentType: photo.type, upsert: true });
    if (uploadError) {
      console.error("[absen] upload", uploadError);
      return reply({ ok: false, retry: true, message: SERVER_ERROR }, 502);
    }

    const args = {
      p_company_id: input.companyId,
      p_lat: input.lat,
      p_lng: input.lng,
      p_accuracy_m: input.accuracy,
      p_photo_path: path,
      p_request_id: input.requestId,
      p_device_captured_at: input.deviceCapturedAt ?? null,
      p_offline: input.offline,
    };
    const { data, error } =
      input.action === "masuk"
        ? await supabase.rpc("clock_in", args)
        : await supabase.rpc("clock_out", args);

    if (error || !data?.[0]) {
      // Absen ditolak: foto tidak dipakai baris mana pun, jadi dihapus.
      await admin.storage.from(BUCKET).remove([path]);
      // P0001/42501 = penolakan aturan absen dengan pesan untuk karyawan.
      if (error && (error.code === "P0001" || error.code === "42501")) {
        return rejected(error.message);
      }
      console.error("[absen] rpc", error);
      return reply({ ok: false, retry: true, message: SERVER_ERROR }, 500);
    }

    const row = data[0];
    const at = input.action === "masuk" ? row.clock_in_at : row.clock_out_at;
    return reply(
      { ok: true, action: input.action, at: at ?? new Date().toISOString(), lateMinutes: row.late_minutes },
      200,
    );
  } catch (error) {
    console.error("[absen]", error);
    return reply({ ok: false, retry: true, message: SERVER_ERROR }, 500);
  }
}
