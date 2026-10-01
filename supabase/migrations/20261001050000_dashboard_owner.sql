-- =============================================================================
-- Semai · Dashboard owner (OWN-03, OWN-06)
--
-- - Koreksi absen manual lewat RPC correct_attendance: wajib alasan, nilai
--   sebelum/sesudah dicatat di audit_logs, alasan terlihat karyawan
--   (kolom correction_reason, dibaca lewat RLS absen miliknya).
-- - Koreksi bisa mengubah jam masuk/pulang, mengubah status (izin, sakit,
--   alpa, libur), atau membuat catatan untuk hari tanpa absen.
-- - Telat, pulang cepat, dan lembur dihitung ulang dari jadwal dengan rumus
--   yang sama seperti clock_in / clock_out. Lembur yang berubah karena
--   koreksi otomatis disetujui (owner sendiri yang mengisi jamnya).
-- - Lembur menunggu disetujui/ditolak lewat RPC decide_overtime, tercatat
--   di audit_logs.
-- - Tanggal yang masuk gajian terkunci tidak bisa dikoreksi (aturan no. 8).
-- - Aman dijalankan ulang (or replace).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper
-- -----------------------------------------------------------------------------

-- Tanggal ini sudah masuk periode gajian yang dikunci.
create or replace function public.is_work_date_locked(p_company_id uuid, p_work_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payroll_runs r
    where r.company_id = p_company_id
      and r.status = 'dikunci'
      and p_work_date between r.period_start and r.period_end
  );
$$;

-- Peran user di usaha ini untuk audit_logs (owner/admin), null = bukan anggota.
create or replace function public.member_role(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.company_members m
  where m.company_id = p_company_id and m.user_id = (select auth.uid());
$$;

-- Bagian absen yang dicatat sebelum/sesudah di audit_logs.
create or replace function public.attendance_audit_snapshot(p_row public.attendances)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_row.id is null then null else jsonb_build_object(
    'status',              p_row.status,
    'clock_in_at',         p_row.clock_in_at,
    'clock_out_at',        p_row.clock_out_at,
    'late_minutes',        p_row.late_minutes,
    'early_leave_minutes', p_row.early_leave_minutes,
    'overtime_minutes',    p_row.overtime_minutes,
    'overtime_status',     p_row.overtime_status
  ) end;
$$;


-- -----------------------------------------------------------------------------
-- Koreksi absen
-- -----------------------------------------------------------------------------

-- p_clock_in / p_clock_out = jam lokal di zona usaha. Jam pulang lebih kecil
-- dari jam masuk = keesokan harinya (shift malam).
create or replace function public.correct_attendance(
  p_company_id   uuid,
  p_employee_id  uuid,
  p_work_date    date,
  p_status       text,
  p_clock_in     time,
  p_clock_out    time,
  p_reason       text
)
returns setof public.attendances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now       timestamptz := now();
  v_role      text;
  v_reason    text := nullif(trim(p_reason), '');
  v_emp       record;
  v_old       public.attendances;
  v_new       public.attendances;
  v_start     timestamptz;
  v_end       timestamptz;
  v_in        timestamptz;
  v_out       timestamptz;
  v_diff      integer;
  v_late      integer := 0;
  v_early     integer := 0;
  v_overtime  integer := 0;
  v_ot_status text;
  v_ot_at     timestamptz;
  v_ot_by     uuid;
begin
  v_role := public.member_role(p_company_id);
  if v_role is null then
    raise exception 'Kamu tidak punya akses ke usaha ini.'
      using errcode = '42501', hint = 'bukan_anggota';
  end if;

  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Tulis alasan koreksi minimal 5 huruf, misalnya "HP karyawan rusak".'
      using errcode = 'P0001', hint = 'alasan_kosong';
  end if;
  if length(v_reason) > 300 then
    raise exception 'Alasan koreksi terlalu panjang. Maksimal 300 huruf.'
      using errcode = 'P0001', hint = 'alasan_panjang';
  end if;

  if p_status is null or p_status not in ('hadir', 'izin', 'sakit', 'alpa', 'libur') then
    raise exception 'Pilih status: hadir, izin, sakit, tidak masuk, atau libur.'
      using errcode = 'P0001', hint = 'status_tidak_valid';
  end if;

  select e.id, e.status, e.location_id, c.timezone,
         w.start_time, w.end_time, w.late_tolerance_min, w.early_leave_tolerance_min
    into v_emp
  from public.employees e
  join public.companies c on c.id = e.company_id
  left join public.work_schedules w on w.id = e.work_schedule_id
  where e.id = p_employee_id and e.company_id = p_company_id;

  if v_emp.id is null or v_emp.status = 'diundang' then
    raise exception 'Karyawan tidak ditemukan atau belum aktivasi.'
      using errcode = 'P0001', hint = 'karyawan_tidak_ada';
  end if;

  if p_work_date is null or p_work_date > (v_now at time zone v_emp.timezone)::date then
    raise exception 'Tanggal koreksi belum terjadi. Pilih hari ini atau tanggal sebelumnya.'
      using errcode = 'P0001', hint = 'tanggal_depan';
  end if;

  if public.is_work_date_locked(p_company_id, p_work_date) then
    raise exception 'Gajian untuk tanggal ini sudah dikunci. Catat perubahan sebagai penyesuaian di gajian berikutnya.'
      using errcode = 'P0001', hint = 'gajian_dikunci';
  end if;

  select * into v_old from public.attendances a
  where a.employee_id = p_employee_id and a.work_date = p_work_date
  for update;

  if p_status = 'hadir' then
    if p_clock_in is null then
      raise exception 'Isi jam masuk untuk status hadir.'
        using errcode = 'P0001', hint = 'jam_masuk_kosong';
    end if;

    v_in := (p_work_date + p_clock_in) at time zone v_emp.timezone;
    if p_clock_out is not null then
      v_out := (p_work_date + p_clock_out
                + case when p_clock_out <= p_clock_in then interval '1 day' else interval '0' end)
               at time zone v_emp.timezone;
    end if;

    if v_in > v_now or v_out > v_now then
      raise exception 'Jam yang diisi belum terjadi. Periksa jam masuk dan pulang.'
        using errcode = 'P0001', hint = 'jam_depan';
    end if;

    -- Jadwal saat absen tercatat dipakai kalau ada; kalau tidak, jadwal sekarang.
    v_start := v_old.scheduled_start;
    v_end := v_old.scheduled_end;
    if v_start is null and v_emp.start_time is not null then
      v_start := (p_work_date + v_emp.start_time) at time zone v_emp.timezone;
      v_end := (p_work_date + v_emp.end_time
                + case when v_emp.end_time < v_emp.start_time then interval '1 day' else interval '0' end)
               at time zone v_emp.timezone;
    end if;

    if v_start is not null then
      v_diff := floor(extract(epoch from (v_in - v_start)) / 60)::integer;
      if v_diff > coalesce(v_emp.late_tolerance_min, 0) then
        v_late := v_diff;
      end if;
    end if;

    if v_end is not null and v_out is not null then
      v_diff := floor(extract(epoch from (v_end - v_out)) / 60)::integer;
      if v_diff > coalesce(v_emp.early_leave_tolerance_min, 0) then
        v_early := v_diff;
      end if;
      v_overtime := greatest(floor(extract(epoch from (v_out - v_end)) / 60)::integer, 0);
    end if;

    -- Lembur sama seperti sebelumnya: keputusan lama tetap. Berubah: disetujui.
    if v_overtime > 0 and v_overtime = v_old.overtime_minutes and v_old.overtime_status is not null then
      v_ot_status := v_old.overtime_status;
      v_ot_at := v_old.overtime_decided_at;
      v_ot_by := v_old.overtime_decided_by;
    elsif v_overtime > 0 then
      v_ot_status := 'disetujui';
      v_ot_at := v_now;
      v_ot_by := auth.uid();
    end if;
  end if;

  -- Tidak ada yang berubah: jangan buat catatan koreksi kosong.
  if v_old.id is not null
     and v_old.status = p_status
     and v_old.clock_in_at is not distinct from v_in
     and v_old.clock_out_at is not distinct from v_out then
    raise exception 'Tidak ada yang berubah. Ubah status atau jam sebelum menyimpan.'
      using errcode = 'P0001', hint = 'tidak_berubah';
  end if;

  if v_old.id is null then
    begin
      insert into public.attendances (
        company_id, employee_id, location_id, work_date, status,
        scheduled_start, scheduled_end, clock_in_at, clock_out_at,
        late_minutes, early_leave_minutes, overtime_minutes,
        overtime_status, overtime_decided_at, overtime_decided_by,
        corrected_at, corrected_by, correction_reason
      )
      values (
        p_company_id, p_employee_id, v_emp.location_id, p_work_date, p_status,
        v_start, v_end, v_in, v_out,
        v_late, v_early, v_overtime,
        v_ot_status, v_ot_at, v_ot_by,
        v_now, auth.uid(), v_reason
      )
      returning * into v_new;
    exception when unique_violation then
      raise exception 'Karyawan baru saja absen untuk tanggal ini. Muat ulang halaman lalu coba lagi.'
        using errcode = 'P0001', hint = 'baru_absen';
    end;
  else
    update public.attendances a
    set status = p_status,
        scheduled_start = v_start,
        scheduled_end = v_end,
        clock_in_at = v_in,
        clock_out_at = v_out,
        late_minutes = v_late,
        early_leave_minutes = v_early,
        overtime_minutes = v_overtime,
        overtime_status = v_ot_status,
        overtime_decided_at = v_ot_at,
        overtime_decided_by = v_ot_by,
        corrected_at = v_now,
        corrected_by = auth.uid(),
        correction_reason = v_reason
    where a.id = v_old.id
    returning * into v_new;
  end if;

  perform public.log_audit(
    p_company_id, v_role, 'attendance.correct', 'attendances', v_new.id, v_reason,
    public.attendance_audit_snapshot(v_old),
    public.attendance_audit_snapshot(v_new) || jsonb_build_object('work_date', v_new.work_date, 'employee_id', v_new.employee_id)
  );

  return next v_new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Setujui / tolak lembur
-- -----------------------------------------------------------------------------

create or replace function public.decide_overtime(
  p_attendance_id  uuid,
  p_approve        boolean
)
returns setof public.attendances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old   public.attendances;
  v_new   public.attendances;
  v_role  text;
begin
  select * into v_old from public.attendances a where a.id = p_attendance_id for update;

  v_role := public.member_role(v_old.company_id);
  if v_old.id is null or v_role is null then
    raise exception 'Data absen tidak ditemukan.'
      using errcode = 'P0001', hint = 'absen_tidak_ada';
  end if;

  if p_approve is null then
    raise exception 'Pilih setujui atau tolak lembur.'
      using errcode = 'P0001', hint = 'keputusan_kosong';
  end if;

  if v_old.overtime_status is distinct from 'menunggu' then
    raise exception 'Lembur ini sudah diputuskan. Muat ulang halaman untuk melihat status terbaru.'
      using errcode = 'P0001', hint = 'sudah_diputuskan';
  end if;

  if public.is_work_date_locked(v_old.company_id, v_old.work_date) then
    raise exception 'Gajian untuk tanggal ini sudah dikunci. Catat lembur sebagai penyesuaian di gajian berikutnya.'
      using errcode = 'P0001', hint = 'gajian_dikunci';
  end if;

  update public.attendances a
  set overtime_status = case when p_approve then 'disetujui' else 'ditolak' end,
      overtime_decided_at = now(),
      overtime_decided_by = auth.uid()
  where a.id = v_old.id
  returning * into v_new;

  perform public.log_audit(
    v_old.company_id, v_role, 'attendance.overtime_decide', 'attendances', v_old.id, null,
    jsonb_build_object('overtime_status', v_old.overtime_status, 'overtime_minutes', v_old.overtime_minutes),
    jsonb_build_object('overtime_status', v_new.overtime_status, 'overtime_minutes', v_new.overtime_minutes)
  );

  return next v_new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.is_work_date_locked(uuid, date),
  public.member_role(uuid),
  public.attendance_audit_snapshot(public.attendances),
  public.correct_attendance(uuid, uuid, date, text, time, time, text),
  public.decide_overtime(uuid, boolean)
from public, anon, authenticated;

grant execute on function
  public.correct_attendance(uuid, uuid, date, text, time, time, text),
  public.decide_overtime(uuid, boolean)
to authenticated;
