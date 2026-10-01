import "server-only";
import { createClient } from "@/lib/supabase/server";
import { currentWorkDate, isWorkDay, type ScheduleLite } from "./dates";

export type AttendanceMode = "masuk" | "masuk_pulang";

export type AbsenLocation = {
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
};

export type TodayState =
  | { kind: "belum" }
  | { kind: "masuk"; clockInAt: string; lateMinutes: number }
  | {
      kind: "selesai";
      clockInAt: string;
      clockOutAt: string | null;
      lateMinutes: number;
      overtimeMinutes: number;
      overtimeStatus: string | null;
    }
  | { kind: "tercatat"; status: string };

export type RemoteInfo = {
  /** Absen tanpa cek radius berlaku sekarang. */
  active: boolean;
  /** Masa tenggang setelah paket turun ke Benih. */
  graceUntil: string | null;
  /** Ditandai remote tapi tidak berlaku lagi (paket Benih). */
  ended: boolean;
};

export type AbsenHome = {
  mode: AttendanceMode;
  remote: RemoteInfo;
  location: AbsenLocation | null;
  schedule: (ScheduleLite & { name: string }) | null;
  workDate: string;
  isWorkDay: boolean;
  today: TodayState;
};

/** Absen terbuka maksimal 20 jam, sama dengan RPC clock_out. */
const OPEN_WINDOW_MS = 20 * 60 * 60 * 1000;

/** Data halaman utama karyawan untuk satu usaha. */
export async function getAbsenHome(employeeId: string, timezone: string): Promise<AbsenHome> {
  const supabase = await createClient();

  const { data: employee, error } = await supabase
    .from("employees")
    .select(
      "company_id, is_remote, companies (attendance_mode), locations (name, latitude, longitude, radius_m, is_active), work_schedules (name, start_time, end_time, work_days)",
    )
    .eq("id", employeeId)
    .single();
  if (error) {
    console.error("[getAbsenHome] employee", error);
    throw new Error("Gagal memuat data absen. Coba muat ulang halaman.");
  }

  const schedule = employee.work_schedules
    ? {
        name: employee.work_schedules.name,
        start_time: employee.work_schedules.start_time,
        end_time: employee.work_schedules.end_time,
        work_days: employee.work_schedules.work_days,
      }
    : null;
  const location =
    employee.locations && employee.locations.is_active
      ? {
          name: employee.locations.name,
          latitude: employee.locations.latitude,
          longitude: employee.locations.longitude,
          radiusM: employee.locations.radius_m,
        }
      : null;
  const mode: AttendanceMode =
    employee.companies?.attendance_mode === "masuk" ? "masuk" : "masuk_pulang";

  let remote: RemoteInfo = { active: false, graceUntil: null, ended: false };
  if (employee.is_remote) {
    const { data: status, error: statusError } = await supabase.rpc("remote_attendance_status", {
      p_company_id: employee.company_id,
    });
    if (statusError) console.error("[getAbsenHome] remote", statusError);
    const row = status?.[0];
    remote = {
      active: Boolean(row?.allowed),
      graceUntil: row?.grace_until ?? null,
      ended: !statusError && !row?.allowed,
    };
  }

  const now = new Date();
  const workDate = currentWorkDate(now, timezone, schedule);

  const { data: rows, error: rowsError } = await supabase
    .from("attendances")
    .select(
      "work_date, status, clock_in_at, clock_out_at, late_minutes, overtime_minutes, overtime_status",
    )
    .eq("employee_id", employeeId)
    .order("work_date", { ascending: false })
    .limit(2);
  if (rowsError) {
    console.error("[getAbsenHome] attendances", rowsError);
    throw new Error("Gagal memuat data absen. Coba muat ulang halaman.");
  }

  let today: TodayState = { kind: "belum" };
  const open = rows.find(
    (r) =>
      r.clock_in_at &&
      !r.clock_out_at &&
      now.getTime() - new Date(r.clock_in_at).getTime() < OPEN_WINDOW_MS,
  );
  const current = rows.find((r) => r.work_date === workDate);

  if (open?.clock_in_at && mode === "masuk_pulang") {
    today = { kind: "masuk", clockInAt: open.clock_in_at, lateMinutes: open.late_minutes };
  } else if (current?.clock_in_at) {
    today = {
      kind: "selesai",
      clockInAt: current.clock_in_at,
      clockOutAt: current.clock_out_at,
      lateMinutes: current.late_minutes,
      overtimeMinutes: current.overtime_minutes,
      overtimeStatus: current.overtime_status,
    };
  } else if (current) {
    today = { kind: "tercatat", status: current.status };
  }

  return {
    mode,
    remote,
    location,
    schedule,
    workDate,
    isWorkDay: isWorkDay(workDate, schedule),
    today,
  };
}
