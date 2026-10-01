import "server-only";
import { createClient } from "@/lib/supabase/server";
import { currentWorkDate, isWorkDay, localClock, localDate, addDays, type ScheduleLite } from "./dates";
import { buildRecap, emptySummary, resolveMonth, type RecapDay, type RecapSummary } from "./recap";

/** Signed URL foto absen berlaku 10 menit (bucket privat). */
const PHOTO_URL_TTL_S = 600;

const ATTENDANCE_COLUMNS =
  "id, employee_id, work_date, status, clock_in_at, clock_out_at, clock_in_distance_m, clock_out_distance_m, clock_in_photo_path, clock_out_photo_path, photos_deleted_at, clock_in_offline, clock_out_offline, late_minutes, early_leave_minutes, overtime_minutes, overtime_status, corrected_at, correction_reason";

type AttendanceRow = {
  id: string;
  employee_id: string;
  work_date: string;
  status: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  clock_in_distance_m: number | null;
  clock_out_distance_m: number | null;
  clock_in_photo_path: string | null;
  clock_out_photo_path: string | null;
  photos_deleted_at: string | null;
  clock_in_offline: boolean;
  clock_out_offline: boolean;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  overtime_status: string | null;
  corrected_at: string | null;
  correction_reason: string | null;
};

/** Satu absen untuk tampilan owner, dengan link foto sementara. */
export type OwnerAttendance = {
  id: string;
  workDate: string;
  status: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInDistanceM: number | null;
  clockOutDistanceM: number | null;
  clockInPhotoUrl: string | null;
  clockOutPhotoUrl: string | null;
  photosDeleted: boolean;
  offline: boolean;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  overtimeStatus: string | null;
  correctionReason: string | null;
};

export type AttendanceMode = "masuk" | "masuk_pulang";

type CompanyInfo = { timezone: string; attendanceMode: AttendanceMode; createdAt: string };

function fail(where: string, error: unknown): never {
  console.error(`[${where}]`, error);
  throw new Error("Gagal memuat data absen. Coba muat ulang halaman.");
}

async function getCompanyInfo(companyId: string): Promise<CompanyInfo> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("timezone, attendance_mode, created_at")
    .eq("id", companyId)
    .single();
  if (error) fail("getCompanyInfo", error);
  return {
    timezone: data.timezone,
    attendanceMode: data.attendance_mode === "masuk" ? "masuk" : "masuk_pulang",
    createdAt: data.created_at,
  };
}

/** Link sementara untuk banyak foto sekaligus. Gagal = tanpa foto, bukan error halaman. */
async function signPhotos(rows: AttendanceRow[]): Promise<Map<string, string>> {
  const paths = rows
    .filter((r) => !r.photos_deleted_at)
    .flatMap((r) => [r.clock_in_photo_path, r.clock_out_photo_path])
    .filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("absen-foto").createSignedUrls(paths, PHOTO_URL_TTL_S);
  if (error) {
    console.error("[signPhotos]", error);
    return urls;
  }
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

function toOwnerAttendance(row: AttendanceRow, urls: Map<string, string>): OwnerAttendance {
  return {
    id: row.id,
    workDate: row.work_date,
    status: row.status,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    clockInDistanceM: row.clock_in_distance_m,
    clockOutDistanceM: row.clock_out_distance_m,
    clockInPhotoUrl: row.clock_in_photo_path ? (urls.get(row.clock_in_photo_path) ?? null) : null,
    clockOutPhotoUrl: row.clock_out_photo_path ? (urls.get(row.clock_out_photo_path) ?? null) : null,
    photosDeleted: Boolean(row.photos_deleted_at),
    offline: row.clock_in_offline || row.clock_out_offline,
    lateMinutes: row.late_minutes,
    earlyLeaveMinutes: row.early_leave_minutes,
    overtimeMinutes: row.overtime_minutes,
    overtimeStatus: row.overtime_status,
    correctionReason: row.correction_reason,
  };
}

/** Semua baris absen sesuai filter, melewati batas 1.000 baris per request. */
async function fetchAllAttendances(
  companyId: string,
  from: string,
  to: string,
  employeeId?: string,
): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  const pageSize = 1000;
  const rows: AttendanceRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("attendances")
      .select(ATTENDANCE_COLUMNS)
      .eq("company_id", companyId)
      .gte("work_date", from)
      .lte("work_date", to);
    if (employeeId) query = query.eq("employee_id", employeeId);
    const { data, error } = await query
      .order("work_date", { ascending: false })
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) fail("fetchAllAttendances", error);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

// -----------------------------------------------------------------------------
// Hari ini
// -----------------------------------------------------------------------------

export type TodayStatus = "masuk" | "telat" | "izin" | "alpa" | "belum" | "libur";

export type TodayEntry = {
  employeeId: string;
  name: string;
  position: string | null;
  workDate: string;
  status: TodayStatus;
  /** Jam masuk jadwal "08.00", kalau ada jadwal. */
  scheduleStart: string | null;
  /** Belum absen padahal sudah lewat jam masuk + toleransi. */
  pastStart: boolean;
  radiusM: number | null;
  locationName: string | null;
  attendance: OwnerAttendance | null;
};

export type TodayBoard = {
  timezone: string;
  attendanceMode: AttendanceMode;
  today: string;
  updatedAt: string;
  summary: { masuk: number; telat: number; izin: number; belum: number };
  entries: TodayEntry[];
  pendingOvertime: {
    id: string;
    employeeId: string;
    name: string;
    workDate: string;
    clockOutAt: string | null;
    overtimeMinutes: number;
  }[];
};

/** "08:30" atau "08:30:00" → 510. */
function clockMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

const STATUS_ORDER: Record<TodayStatus, number> = { belum: 0, telat: 1, masuk: 2, izin: 3, alpa: 4, libur: 5 };

/** Ringkasan dan daftar absen hari ini untuk dashboard owner. */
export async function getTodayBoard(companyId: string): Promise<TodayBoard> {
  const supabase = await createClient();
  const company = await getCompanyInfo(companyId);
  const tz = company.timezone;
  const now = new Date();
  const today = localDate(now, tz);

  const [{ data: employees, error: employeesError }, rows, { data: pending, error: pendingError }] =
    await Promise.all([
      supabase
        .from("employees")
        .select(
          "id, full_name, position, locations (name, radius_m, is_active), work_schedules (start_time, end_time, work_days, late_tolerance_min)",
        )
        .eq("company_id", companyId)
        .eq("status", "aktif")
        .order("full_name"),
      // Kemarin ikut diambil untuk shift malam yang belum selesai.
      fetchAllAttendances(companyId, addDays(today, -1), today),
      supabase
        .from("attendances")
        .select("id, employee_id, work_date, clock_out_at, overtime_minutes, employees (full_name)")
        .eq("company_id", companyId)
        .eq("overtime_status", "menunggu")
        .order("work_date", { ascending: false })
        .limit(30),
    ]);
  if (employeesError) fail("getTodayBoard employees", employeesError);
  if (pendingError) fail("getTodayBoard pending", pendingError);

  const urls = await signPhotos(rows);
  const byKey = new Map(rows.map((r) => [`${r.employee_id}:${r.work_date}`, r]));
  const summary = { masuk: 0, telat: 0, izin: 0, belum: 0 };

  const entries: TodayEntry[] = employees.map((employee) => {
    const ws = employee.work_schedules;
    const schedule: ScheduleLite | null = ws
      ? { start_time: ws.start_time, end_time: ws.end_time, work_days: ws.work_days }
      : null;
    const workDate = currentWorkDate(now, tz, schedule);
    const row = byKey.get(`${employee.id}:${workDate}`);

    let status: TodayStatus;
    if (row?.status === "hadir") status = row.late_minutes > 0 ? "telat" : "masuk";
    else if (row?.status === "izin" || row?.status === "sakit") status = "izin";
    else if (row?.status === "alpa") status = "alpa";
    else if (row?.status === "libur") status = "libur";
    else status = isWorkDay(workDate, schedule) ? "belum" : "libur";

    if (status === "masuk" || status === "telat") summary.masuk += 1;
    if (status === "telat") summary.telat += 1;
    if (status === "izin") summary.izin += 1;
    if (status === "belum") summary.belum += 1;

    let pastStart = false;
    if (status === "belum" && ws) {
      const startMinutes = clockMinutes(ws.start_time) + ws.late_tolerance_min;
      const nowMinutes = clockMinutes(localClock(now, tz)) + (workDate < today ? 24 * 60 : 0);
      pastStart = nowMinutes > startMinutes;
    }

    const location = employee.locations?.is_active ? employee.locations : null;
    return {
      employeeId: employee.id,
      name: employee.full_name,
      position: employee.position,
      workDate,
      status,
      scheduleStart: ws ? ws.start_time.slice(0, 5).replace(":", ".") : null,
      pastStart,
      radiusM: location?.radius_m ?? null,
      locationName: location?.name ?? null,
      attendance: row ? toOwnerAttendance(row, urls) : null,
    };
  });

  entries.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "id"));

  return {
    timezone: tz,
    attendanceMode: company.attendanceMode,
    today,
    updatedAt: now.toISOString(),
    summary,
    entries,
    pendingOvertime: pending.map((p) => ({
      id: p.id,
      employeeId: p.employee_id,
      name: p.employees?.full_name ?? "Karyawan",
      workDate: p.work_date,
      clockOutAt: p.clock_out_at,
      overtimeMinutes: p.overtime_minutes,
    })),
  };
}

// -----------------------------------------------------------------------------
// Rekap bulanan
// -----------------------------------------------------------------------------

type EmployeeForRecap = {
  id: string;
  full_name: string;
  position: string | null;
  status: string;
  activated_at: string | null;
  deactivated_at: string | null;
  created_at: string;
  work_schedules: ScheduleLite | null;
};

const EMPLOYEE_RECAP_COLUMNS =
  "id, full_name, position, status, activated_at, deactivated_at, created_at, work_schedules (start_time, end_time, work_days)";

/** Rentang hari yang dihitung untuk satu karyawan dalam bulan ini. */
function employeeRange(
  employee: EmployeeForRecap,
  { first, last, today, tz }: { first: string; last: string; today: string; tz: string },
) {
  const start = localDate(new Date(employee.activated_at ?? employee.created_at), tz);
  const stop = employee.deactivated_at ? localDate(new Date(employee.deactivated_at), tz) : today;
  const end = [last, today, stop].reduce((a, b) => (b < a ? b : a));
  return { begin: first > start ? first : start, end };
}

async function getMonthBounds(companyId: string, company: CompanyInfo, requested: string | undefined) {
  const supabase = await createClient();
  const { data: limit, error } = await supabase.rpc("plan_limit", {
    p_company_id: companyId,
    p_limit_key: "riwayat_bulan",
  });
  if (error) fail("getMonthBounds", error);
  const today = localDate(new Date(), company.timezone);
  return {
    today,
    ...resolveMonth(requested, {
      thisMonth: today.slice(0, 7),
      startMonth: localDate(new Date(company.createdAt), company.timezone).slice(0, 7),
      limitMonths: limit,
    }),
  };
}

export type MonthlyRecap = {
  month: string;
  prevMonth: string | null;
  nextMonth: string | null;
  employees: {
    id: string;
    name: string;
    position: string | null;
    active: boolean;
    summary: RecapSummary;
  }[];
  totals: RecapSummary;
};

/** Rekap satu bulan per karyawan: hadir, telat, izin, tidak masuk, lembur. */
export async function getMonthlyRecap(companyId: string, requestedMonth: string | undefined): Promise<MonthlyRecap> {
  const supabase = await createClient();
  const company = await getCompanyInfo(companyId);
  const bounds = await getMonthBounds(companyId, company, requestedMonth);

  const [{ data: employees, error }, rows] = await Promise.all([
    supabase
      .from("employees")
      .select(EMPLOYEE_RECAP_COLUMNS)
      .eq("company_id", companyId)
      .neq("status", "diundang")
      .order("full_name"),
    fetchAllAttendances(companyId, bounds.first, bounds.last),
  ]);
  if (error) fail("getMonthlyRecap employees", error);

  const rowsByEmployee = new Map<string, AttendanceRow[]>();
  for (const row of rows) {
    const list = rowsByEmployee.get(row.employee_id) ?? [];
    list.push(row);
    rowsByEmployee.set(row.employee_id, list);
  }

  const totals = emptySummary();
  const result: MonthlyRecap["employees"] = [];
  for (const employee of employees) {
    const own = rowsByEmployee.get(employee.id) ?? [];
    const range = employeeRange(employee, { ...bounds, tz: company.timezone });
    // Belum mulai bekerja atau sudah nonaktif sebelum bulan ini: lewati.
    if (range.begin > range.end) continue;

    const { summary } = buildRecap(own, {
      begin: range.begin,
      end: range.end,
      today: bounds.today,
      schedule: employee.work_schedules,
    });
    for (const key of Object.keys(totals) as (keyof RecapSummary)[]) totals[key] += summary[key];
    result.push({
      id: employee.id,
      name: employee.full_name,
      position: employee.position,
      active: employee.status === "aktif",
      summary,
    });
  }

  return {
    month: bounds.month,
    prevMonth: bounds.prevMonth,
    nextMonth: bounds.nextMonth,
    employees: result,
    totals,
  };
}

// -----------------------------------------------------------------------------
// Detail satu karyawan
// -----------------------------------------------------------------------------

export type EmployeeMonthDay =
  | { date: string; kind: "tercatat"; attendance: OwnerAttendance }
  | { date: string; kind: "tidak_masuk" };

export type EmployeeMonth = {
  employee: { id: string; name: string; position: string | null; active: boolean };
  timezone: string;
  attendanceMode: AttendanceMode;
  today: string;
  month: string;
  prevMonth: string | null;
  nextMonth: string | null;
  summary: RecapSummary;
  days: EmployeeMonthDay[];
};

/** Absen per hari satu karyawan dalam satu bulan, dengan foto. null = bukan karyawan usaha ini. */
export async function getEmployeeMonth(
  companyId: string,
  employeeId: string,
  requestedMonth: string | undefined,
): Promise<EmployeeMonth | null> {
  const supabase = await createClient();
  const company = await getCompanyInfo(companyId);

  const { data: employee, error } = await supabase
    .from("employees")
    .select(EMPLOYEE_RECAP_COLUMNS)
    .eq("company_id", companyId)
    .eq("id", employeeId)
    .neq("status", "diundang")
    .maybeSingle();
  if (error) fail("getEmployeeMonth employee", error);
  if (!employee) return null;

  const bounds = await getMonthBounds(companyId, company, requestedMonth);
  const rows = await fetchAllAttendances(companyId, bounds.first, bounds.last, employeeId);
  const range = employeeRange(employee, { ...bounds, tz: company.timezone });
  const { days, summary } = buildRecap(rows, {
    begin: range.begin,
    end: range.end,
    today: bounds.today,
    schedule: employee.work_schedules,
  });
  const urls = await signPhotos(rows);

  return {
    employee: {
      id: employee.id,
      name: employee.full_name,
      position: employee.position,
      active: employee.status === "aktif",
    },
    timezone: company.timezone,
    attendanceMode: company.attendanceMode,
    today: bounds.today,
    month: bounds.month,
    prevMonth: bounds.prevMonth,
    nextMonth: bounds.nextMonth,
    summary,
    days: days.map((day: RecapDay<AttendanceRow>) =>
      day.kind === "tercatat"
        ? { date: day.date, kind: "tercatat", attendance: toOwnerAttendance(day.row, urls) }
        : day,
    ),
  };
}
