-- =============================================================================
-- Semai · Absen karyawan (EMP-02, EMP-04)
--
-- - Karyawan absen lewat RPC clock_in / clock_out (security definer). Waktu
--   resmi = now() server; jam HP hanya info (device_captured_at).
-- - Radius dihitung di database (haversine) dari lokasi karyawan.
-- - Telat dihitung dari jam masuk jadwal kalau melewati toleransi
--   (toleransi 10 menit, masuk 08.15 → telat 15 menit).
-- - Absen di luar hari kerja jadwal ditolak.
-- - Lembur hanya dihitung kalau karyawan punya jam kerja, dan selalu
--   menunggu persetujuan owner (overtime_status).
-- - Owner memilih mode absen per usaha: masuk saja, atau masuk dan pulang.
-- - Status langganan TIDAK dicek di sini: absen tidak pernah diblokir.
-- - Aman dijalankan ulang (if not exists / or replace), misalnya kalau
--   sebagian sempat jalan di SQL Editor.
-- - Foto di bucket privat absen-foto, path {company_id}/{employee_id}/...
--   Upload lewat server (service role); RPC memastikan file sudah ada.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Pengaturan absen per usaha
-- -----------------------------------------------------------------------------

alter table public.companies
  add column if not exists attendance_mode text not null default 'masuk_pulang'
    check (attendance_mode in ('masuk', 'masuk_pulang'));

comment on column public.companies.attendance_mode is 'masuk = karyawan cukup absen masuk. masuk_pulang = absen masuk dan pulang (selfie + radius).';

grant update (attendance_mode) on public.companies to authenticated;


-- -----------------------------------------------------------------------------
-- Kolom tambahan absen
-- -----------------------------------------------------------------------------

alter table public.attendances
  add column if not exists clock_in_request_id   uuid unique,
  add column if not exists clock_out_request_id  uuid unique,
  add column if not exists clock_in_offline      boolean not null default false,
  add column if not exists clock_out_offline     boolean not null default false,
  add column if not exists overtime_status       text check (overtime_status in ('menunggu', 'disetujui', 'ditolak')),
  add column if not exists overtime_decided_at   timestamptz,
  add column if not exists overtime_decided_by   uuid references auth.users (id) on delete set null;

alter table public.attendances drop constraint if exists attendances_overtime_needs_status;
alter table public.attendances add constraint attendances_overtime_needs_status
  check (overtime_minutes = 0 or overtime_status is not null);

comment on column public.attendances.clock_in_request_id is 'ID unik dari HP. Antrean offline yang terkirim dua kali tidak membuat absen ganda.';
comment on column public.attendances.clock_in_offline is 'Absen disimpan di HP saat offline lalu dikirim belakangan. Jam resmi tetap jam terkirim.';
comment on column public.attendances.overtime_status is 'Lembur menunggu persetujuan owner. Hanya lembur disetujui yang masuk gajian.';

create index if not exists attendances_employee_date_idx on public.attendances (employee_id, work_date desc);


-- -----------------------------------------------------------------------------
-- Jarak (haversine), dalam meter
-- -----------------------------------------------------------------------------

create or replace function public.distance_m(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select round(
    2 * 6371000 * asin(sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
    ))
  )::integer;
$$;


-- -----------------------------------------------------------------------------
-- Bucket foto absen (privat)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('absen-foto', 'absen-foto', false, 102400, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Segmen pertama path = company_id. Path yang bukan uuid tidak cocok (bukan error).
create or replace function public.storage_company_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Owner/admin bisa membaca foto usahanya (untuk signed URL di dashboard).
-- Tidak ada policy insert/update/delete: upload hanya lewat server (service role).
-- Super admin tidak punya policy di sini (aturan data no. 9).
drop policy if exists "Anggota melihat foto absen usahanya" on storage.objects;
create policy "Anggota melihat foto absen usahanya" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'absen-foto'
    and public.is_company_member(public.storage_company_id(name))
  );


-- -----------------------------------------------------------------------------
-- RPC absen
-- -----------------------------------------------------------------------------

-- Data karyawan aktif milik user ini di usaha tertentu, plus lokasi & jadwal.
-- Hanya dipakai clock_in / clock_out.
create or replace function public.attendance_context(p_company_id uuid)
returns table (
  employee_id      uuid,
  timezone         text,
  attendance_mode  text,
  location_id      uuid,
  location_name    text,
  latitude         double precision,
  longitude        double precision,
  radius_m         integer,
  start_time       time,
  end_time         time,
  work_days        smallint[],
  late_tolerance   integer,
  early_tolerance  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id, c.timezone, c.attendance_mode,
    l.id, l.name, l.latitude, l.longitude, l.radius_m,
    w.start_time, w.end_time, w.work_days, w.late_tolerance_min, w.early_leave_tolerance_min
  from public.employees e
  join public.companies c on c.id = e.company_id
  left join public.locations l on l.id = e.location_id and l.is_active
  left join public.work_schedules w on w.id = e.work_schedule_id
  where e.company_id = p_company_id
    and e.user_id = auth.uid()
    and e.status = 'aktif';
$$;

-- Validasi bersama: lokasi, radius, dan foto. Mengembalikan jarak (meter).
create or replace function public.check_attendance_position(
  p_company_id     uuid,
  p_employee_id    uuid,
  p_location_id    uuid,
  p_location_name  text,
  p_loc_lat        double precision,
  p_loc_lng        double precision,
  p_radius_m       integer,
  p_lat            double precision,
  p_lng            double precision,
  p_photo_path     text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_distance integer;
begin
  if p_location_id is null then
    raise exception 'Lokasi absenmu belum diatur. Minta pemilik usaha mengatur lokasi absen.'
      using errcode = 'P0001', hint = 'lokasi_belum_diatur';
  end if;

  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Lokasi HP tidak terbaca. Nyalakan GPS lalu coba lagi.'
      using errcode = 'P0001', hint = 'gps_tidak_valid';
  end if;

  v_distance := public.distance_m(p_lat, p_lng, p_loc_lat, p_loc_lng);
  if v_distance > p_radius_m then
    raise exception 'Kamu berada % m dari lokasi %. Absen hanya bisa dalam radius % m.',
      v_distance, p_location_name, p_radius_m
      using errcode = 'P0001', hint = 'di_luar_radius';
  end if;

  if p_photo_path is null
     or p_photo_path not like p_company_id::text || '/' || p_employee_id::text || '/%'
     or not exists (
       select 1 from storage.objects o where o.bucket_id = 'absen-foto' and o.name = p_photo_path
     ) then
    raise exception 'Foto absen belum terkirim. Ambil foto lagi lalu kirim ulang.'
      using errcode = 'P0001', hint = 'foto_tidak_ada';
  end if;

  return v_distance;
end;
$$;

create or replace function public.clock_in(
  p_company_id          uuid,
  p_lat                 double precision,
  p_lng                 double precision,
  p_accuracy_m          integer,
  p_photo_path          text,
  p_request_id          uuid,
  p_device_captured_at  timestamptz default null,
  p_offline             boolean default false
)
returns setof public.attendances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now        timestamptz := now();
  v_ctx        record;
  v_local      timestamp;
  v_work_date  date;
  v_start      timestamptz;
  v_end        timestamptz;
  v_late       integer := 0;
  v_diff       integer;
  v_distance   integer;
  v_existing   public.attendances;
begin
  if p_request_id is null then
    raise exception 'Permintaan absen tidak lengkap. Muat ulang aplikasi lalu coba lagi.'
      using errcode = 'P0001', hint = 'request_id_kosong';
  end if;

  select * into v_ctx from public.attendance_context(p_company_id);
  if v_ctx.employee_id is null then
    raise exception 'Kamu tidak terdaftar aktif di usaha ini. Hubungi pemilik usaha.'
      using errcode = '42501', hint = 'bukan_karyawan';
  end if;

  -- Permintaan yang sama terkirim ulang (antrean offline): kembalikan hasil lama.
  return query
    select a.* from public.attendances a
    where a.clock_in_request_id = p_request_id and a.employee_id = v_ctx.employee_id;
  if found then
    return;
  end if;

  v_local := v_now at time zone v_ctx.timezone;
  v_work_date := v_local::date;

  if v_ctx.start_time is not null then
    -- Shift lewat tengah malam: masuk setelah 00.00 tapi sebelum jam pulang
    -- masih termasuk shift kemarin.
    if v_ctx.end_time < v_ctx.start_time and v_local::time < v_ctx.end_time then
      v_work_date := v_work_date - 1;
    end if;

    if not (extract(isodow from v_work_date)::smallint = any (v_ctx.work_days)) then
      raise exception 'Hari ini bukan hari kerjamu. Absen hanya bisa di hari kerja sesuai jadwal.'
        using errcode = 'P0001', hint = 'bukan_hari_kerja';
    end if;

    v_start := (v_work_date + v_ctx.start_time) at time zone v_ctx.timezone;
    v_end := (v_work_date + v_ctx.end_time
              + case when v_ctx.end_time < v_ctx.start_time then interval '1 day' else interval '0' end)
             at time zone v_ctx.timezone;

    v_diff := floor(extract(epoch from (v_now - v_start)) / 60)::integer;
    if v_diff > v_ctx.late_tolerance then
      v_late := v_diff;
    end if;
  end if;

  select * into v_existing from public.attendances a
  where a.employee_id = v_ctx.employee_id and a.work_date = v_work_date;
  if v_existing.id is not null then
    if v_existing.clock_in_at is not null then
      raise exception 'Kamu sudah absen masuk hari ini jam %.',
        to_char(v_existing.clock_in_at at time zone v_ctx.timezone, 'HH24.MI')
        using errcode = 'P0001', hint = 'sudah_absen';
    end if;
    raise exception 'Hari ini sudah tercatat %. Hubungi pemilik usaha kalau ini keliru.', v_existing.status
      using errcode = 'P0001', hint = 'sudah_tercatat';
  end if;

  v_distance := public.check_attendance_position(
    p_company_id, v_ctx.employee_id, v_ctx.location_id, v_ctx.location_name,
    v_ctx.latitude, v_ctx.longitude, v_ctx.radius_m, p_lat, p_lng, p_photo_path
  );

  begin
    return query
      insert into public.attendances (
        company_id, employee_id, location_id, work_date, status,
        scheduled_start, scheduled_end,
        clock_in_at, clock_in_lat, clock_in_lng, clock_in_accuracy_m, clock_in_distance_m,
        clock_in_photo_path, clock_in_request_id, clock_in_offline,
        device_captured_at, late_minutes
      )
      values (
        p_company_id, v_ctx.employee_id, v_ctx.location_id, v_work_date, 'hadir',
        v_start, v_end,
        v_now, p_lat, p_lng, greatest(p_accuracy_m, 0), v_distance,
        p_photo_path, p_request_id, coalesce(p_offline, false),
        case when p_offline then p_device_captured_at end, v_late
      )
      returning *;
  exception when unique_violation then
    -- Dua ketukan bersamaan: yang kedua kalah.
    raise exception 'Kamu sudah absen masuk hari ini.'
      using errcode = 'P0001', hint = 'sudah_absen';
  end;
end;
$$;

create or replace function public.clock_out(
  p_company_id          uuid,
  p_lat                 double precision,
  p_lng                 double precision,
  p_accuracy_m          integer,
  p_photo_path          text,
  p_request_id          uuid,
  p_device_captured_at  timestamptz default null,
  p_offline             boolean default false
)
returns setof public.attendances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now       timestamptz := now();
  v_ctx       record;
  v_open      public.attendances;
  v_distance  integer;
  v_diff      integer;
  v_early     integer := 0;
  v_overtime  integer := 0;
begin
  if p_request_id is null then
    raise exception 'Permintaan absen tidak lengkap. Muat ulang aplikasi lalu coba lagi.'
      using errcode = 'P0001', hint = 'request_id_kosong';
  end if;

  select * into v_ctx from public.attendance_context(p_company_id);
  if v_ctx.employee_id is null then
    raise exception 'Kamu tidak terdaftar aktif di usaha ini. Hubungi pemilik usaha.'
      using errcode = '42501', hint = 'bukan_karyawan';
  end if;

  return query
    select a.* from public.attendances a
    where a.clock_out_request_id = p_request_id and a.employee_id = v_ctx.employee_id;
  if found then
    return;
  end if;

  if v_ctx.attendance_mode <> 'masuk_pulang' then
    raise exception 'Usaha ini hanya memakai absen masuk. Absen pulang tidak diperlukan.'
      using errcode = 'P0001', hint = 'pulang_nonaktif';
  end if;

  -- Absen masuk terakhir yang belum pulang, maksimal 20 jam lalu (shift malam aman).
  select * into v_open from public.attendances a
  where a.employee_id = v_ctx.employee_id
    and a.clock_in_at is not null
    and a.clock_out_at is null
    and a.clock_in_at > v_now - interval '20 hours'
  order by a.clock_in_at desc
  limit 1
  for update;

  if v_open.id is null then
    if exists (
      select 1 from public.attendances a
      where a.employee_id = v_ctx.employee_id
        and a.clock_out_at > v_now - interval '20 hours'
    ) then
      raise exception 'Kamu sudah absen pulang.'
        using errcode = 'P0001', hint = 'sudah_pulang';
    end if;
    raise exception 'Kamu belum absen masuk. Absen masuk dulu sebelum absen pulang.'
      using errcode = 'P0001', hint = 'belum_masuk';
  end if;

  v_distance := public.check_attendance_position(
    p_company_id, v_ctx.employee_id, v_ctx.location_id, v_ctx.location_name,
    v_ctx.latitude, v_ctx.longitude, v_ctx.radius_m, p_lat, p_lng, p_photo_path
  );

  -- Pulang cepat dan lembur hanya kalau ada jadwal.
  if v_open.scheduled_end is not null then
    v_diff := floor(extract(epoch from (v_open.scheduled_end - v_now)) / 60)::integer;
    if v_diff > coalesce(v_ctx.early_tolerance, 0) then
      v_early := v_diff;
    end if;
    v_overtime := greatest(floor(extract(epoch from (v_now - v_open.scheduled_end)) / 60)::integer, 0);
  end if;

  return query
    update public.attendances a
    set clock_out_at = v_now,
        clock_out_lat = p_lat,
        clock_out_lng = p_lng,
        clock_out_accuracy_m = greatest(p_accuracy_m, 0),
        clock_out_distance_m = v_distance,
        clock_out_photo_path = p_photo_path,
        clock_out_request_id = p_request_id,
        clock_out_offline = coalesce(p_offline, false),
        device_captured_at = coalesce(case when p_offline then p_device_captured_at end, a.device_captured_at),
        early_leave_minutes = v_early,
        overtime_minutes = v_overtime,
        overtime_status = case when v_overtime > 0 then 'menunggu' end
    where a.id = v_open.id
    returning a.*;
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.distance_m(double precision, double precision, double precision, double precision),
  public.storage_company_id(text),
  public.attendance_context(uuid),
  public.check_attendance_position(uuid, uuid, uuid, text, double precision, double precision, integer, double precision, double precision, text),
  public.clock_in(uuid, double precision, double precision, integer, text, uuid, timestamptz, boolean),
  public.clock_out(uuid, double precision, double precision, integer, text, uuid, timestamptz, boolean)
from public, anon, authenticated;

-- storage_company_id dipakai policy storage, jadi harus bisa dieksekusi.
grant execute on function
  public.storage_company_id(text),
  public.clock_in(uuid, double precision, double precision, integer, text, uuid, timestamptz, boolean),
  public.clock_out(uuid, double precision, double precision, integer, text, uuid, timestamptz, boolean)
to authenticated;
